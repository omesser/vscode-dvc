import {
  Event,
  EventEmitter,
  ExtensionContext,
  SecretStorage,
  ViewColumn,
  workspace
} from 'vscode'
import { Disposable, Disposer } from '@hediet/std/disposable'
import isEmpty from 'lodash.isempty'
import { SetupSection, SetupData as TSetupData } from './webview/contract'
import { collectSectionCollapsed } from './collect'
import { WebviewMessages } from './webview/messages'
import { validateTokenInput } from './inputBox'
import { findPythonBinForInstall } from './autoInstall'
import { run, runWithRecheck, runWorkspace } from './runner'
import { STUDIO_ACCESS_TOKEN_KEY, isStudioAccessToken } from './token'
import { pickFocusedProjects } from './quickPick'
import { BaseWebview } from '../webview'
import { ViewKey } from '../webview/constants'
import { BaseRepository } from '../webview/repository'
import { Resource } from '../resourceLocator'
import { isPythonExtensionInstalled } from '../extensions/python'
import {
  findAbsoluteDvcRootPath,
  findDvcRootPaths,
  findSubRootPaths,
  getBinDisplayText
} from '../fileSystem'
import { IExtensionSetup } from '../interfaces'
import { definedAndNonEmpty } from '../util/array'
import { Config } from '../config'
import {
  getFirstWorkspaceFolder,
  getWorkspaceFolderCount,
  getWorkspaceFolders
} from '../vscode/workspaceFolders'
import { ContextKey, setContextValue } from '../vscode/context'
import { RegisteredCommands } from '../commands/external'
import { AvailableCommands, InternalCommands } from '../commands/internal'
import { Status } from '../status'
import { WorkspaceExperiments } from '../experiments/workspace'
import { sendTelemetryEvent, sendTelemetryEventAndThrow } from '../telemetry'
import { StopWatch } from '../util/time'
import { getRelativePattern } from '../fileSystem/relativePattern'
import { createFileSystemWatcher } from '../fileSystem/watcher'
import { EventName } from '../telemetry/constants'
import { WorkspaceScale } from '../telemetry/collect'
import { gitPath } from '../cli/git/constants'
import { DOT_DVC } from '../cli/dvc/constants'
import { GLOBAL_WEBVIEW_DVCROOT } from '../webview/factory'
import { ConfigKey, getConfigValue } from '../vscode/config'
import { getValidInput } from '../vscode/inputBox'
import { Title } from '../vscode/title'

export type SetupWebviewWebview = BaseWebview<TSetupData>

export class Setup
  extends BaseRepository<TSetupData>
  implements IExtensionSetup
{
  public readonly viewKey = ViewKey.SETUP

  public readonly initialize: () => Promise<void[]>
  public readonly resetMembers: () => void

  private dvcRoots: string[] = []

  private readonly config: Config
  private readonly status: Status
  private readonly internalCommands: InternalCommands

  private readonly webviewMessages: WebviewMessages
  private readonly showExperiments: () => void
  private readonly getHasData: () => boolean | undefined
  private readonly collectWorkspaceScale: () => Promise<WorkspaceScale>

  private readonly workspaceChanged: EventEmitter<void> = this.dispose.track(
    new EventEmitter()
  )

  private readonly onDidChangeWorkspace: Event<void> =
    this.workspaceChanged.event

  private cliAccessible = false
  private cliCompatible: boolean | undefined

  private dotFolderWatcher?: Disposer

  private readonly secrets: SecretStorage
  private studioAccessToken: string | undefined = undefined
  private studioIsConnected = false

  private focusedSection: SetupSection | undefined = undefined

  constructor(
    context: ExtensionContext,
    config: Config,
    internalCommands: InternalCommands,
    experiments: WorkspaceExperiments,
    status: Status,
    webviewIcon: Resource,
    stopWatch: StopWatch,
    initialize: () => Promise<void[]>,
    resetMembers: () => void,
    collectWorkspaceScale: () => Promise<WorkspaceScale>
  ) {
    super(GLOBAL_WEBVIEW_DVCROOT, webviewIcon)

    this.config = config

    this.internalCommands = internalCommands

    this.status = status

    this.initialize = initialize
    this.resetMembers = resetMembers

    this.collectWorkspaceScale = collectWorkspaceScale

    this.setCommandsAvailability(false)
    this.setProjectAvailability()

    this.webviewMessages = this.createWebviewMessageHandler()

    if (this.webview) {
      void this.sendDataToWebview()
    }

    this.showExperiments = () => {
      void experiments.showWebview(this.dvcRoots[0], ViewColumn.Active)
    }

    this.getHasData = () => experiments.getHasData()
    const onDidChangeHasData = experiments.columnsChanged.event
    this.dispose.track(
      onDidChangeHasData(() =>
        Promise.all([
          this.sendDataToWebview(),
          setContextValue(ContextKey.PROJECT_HAS_DATA, this.getHasData())
        ])
      )
    )

    this.dispose.track(this.onDidChangeWorkspace(() => run(this)))
    this.watchForVenvChanges()
    this.watchConfigurationDetailsForChanges()
    this.watchDotFolderForChanges()
    this.watchPathForChanges(stopWatch)

    this.secrets = context.secrets

    void this.getSecret(STUDIO_ACCESS_TOKEN_KEY).then(
      async studioAccessToken => {
        this.studioAccessToken = studioAccessToken
        await this.updateIsStudioConnected()
        this.deferred.resolve()
      }
    )

    this.dispose.track(
      context.secrets.onDidChange(async e => {
        if (e.key !== STUDIO_ACCESS_TOKEN_KEY) {
          return
        }

        this.studioAccessToken = await this.getSecret(STUDIO_ACCESS_TOKEN_KEY)
        return this.updateIsStudioConnected()
      })
    )

    this.dispose.track(
      workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(ConfigKey.STUDIO_SHARE_EXPERIMENTS_LIVE)) {
          return this.sendDataToWebview()
        }
      })
    )
  }

  public getRoots() {
    return this.dvcRoots
  }

  public async getCliVersion(cwd: string, tryGlobalCli?: true) {
    await this.config.isReady()
    try {
      if (tryGlobalCli) {
        return await this.internalCommands.executeCommand(
          AvailableCommands.GLOBAL_VERSION,
          cwd
        )
      }
      return await this.internalCommands.executeCommand(
        AvailableCommands.VERSION,
        cwd
      )
    } catch {}
  }

  public hasRoots() {
    return definedAndNonEmpty(this.getRoots())
  }

  public async isPythonExtensionUsed() {
    await this.config.isReady()
    return !!this.config.isPythonExtensionUsed()
  }

  public unsetPythonBinPath() {
    this.config.unsetPythonBinPath()
  }

  public async showSetup(focusSection?: SetupSection) {
    this.focusedSection = focusSection
    if (this.webview) {
      void this.sendDataToWebview()
    }

    return await this.showWebview()
  }

  public shouldWarnUserIfCLIUnavailable() {
    return this.hasRoots() && !this.isFocused()
  }

  public async setRoots() {
    const nestedRoots = await this.findWorkspaceDvcRoots()
    this.dvcRoots =
      this.config.getFocusedProjects() || nestedRoots.flat().sort()

    void this.sendDataToWebview()
    return this.setProjectAvailability()
  }

  public setAvailable(available: boolean) {
    void this.status.setAvailability(available)
    this.setCommandsAvailability(available)
    this.cliAccessible = available
    void this.sendDataToWebview()
    return available
  }

  public setCliCompatible(compatible: boolean | undefined) {
    this.cliCompatible = compatible
    const incompatible = compatible === undefined ? undefined : !compatible
    void setContextValue(ContextKey.CLI_INCOMPATIBLE, incompatible)
  }

  public getAvailable() {
    return this.cliAccessible
  }

  public isFocused() {
    return !!this.webview?.isActive
  }

  public shouldBeShown() {
    return !this.cliCompatible || !this.hasRoots() || !this.getHasData()
  }

  public async selectFocusedProjects() {
    const dvcRoots = await this.findWorkspaceDvcRoots()
    const focusedProjects = await pickFocusedProjects(dvcRoots, this.getRoots())
    if (focusedProjects) {
      this.config.setFocusedProjectsOption(focusedProjects)
    }
  }

  public async setupWorkspace() {
    const stopWatch = new StopWatch()
    try {
      const previousCliPath = this.config.getCliPath()
      const previousPythonPath = this.config.getPythonBinPath()

      const completed = await this.runWorkspace()
      sendTelemetryEvent(
        RegisteredCommands.EXTENSION_SETUP_WORKSPACE,
        { completed },
        {
          duration: stopWatch.getElapsedTime()
        }
      )

      const executionDetailsUnchanged =
        this.config.getCliPath() === previousPythonPath &&
        this.config.getPythonBinPath() === previousCliPath

      if (completed && !this.cliAccessible && executionDetailsUnchanged) {
        this.workspaceChanged.fire()
      }

      return completed
    } catch (error: unknown) {
      return sendTelemetryEventAndThrow(
        RegisteredCommands.EXTENSION_SETUP_WORKSPACE,
        error as Error,
        stopWatch.getElapsedTime()
      )
    }
  }

  public removeStudioAccessToken() {
    return this.removeSecret(STUDIO_ACCESS_TOKEN_KEY)
  }

  public async saveStudioAccessToken() {
    const token = await getValidInput(
      Title.ENTER_STUDIO_TOKEN,
      validateTokenInput,
      { password: true }
    )
    if (!token) {
      return
    }

    return this.storeSecret(STUDIO_ACCESS_TOKEN_KEY, token)
  }

  public getStudioLiveShareToken() {
    return getConfigValue<boolean>(
      ConfigKey.STUDIO_SHARE_EXPERIMENTS_LIVE,
      false
    )
      ? this.getStudioAccessToken()
      : undefined
  }

  public getStudioAccessToken() {
    return this.studioAccessToken
  }

  public sendInitialWebviewData() {
    return this.sendDataToWebview()
  }

  private async sendDataToWebview() {
    const projectInitialized = this.hasRoots()
    const hasData = this.getHasData()

    const needsGitInitialized =
      !projectInitialized && !!(await this.needsGitInit())

    const canGitInitialize = await this.canGitInitialize(needsGitInitialized)

    const needsGitCommit =
      needsGitInitialized || (await this.needsGitCommit(needsGitInitialized))

    const pythonBinPath = await findPythonBinForInstall()

    this.webviewMessages.sendWebviewMessage({
      canGitInitialize,
      cliCompatible: this.cliCompatible,
      hasData,
      isPythonExtensionInstalled: isPythonExtensionInstalled(),
      isStudioConnected: this.studioIsConnected,
      needsGitCommit,
      needsGitInitialized,
      projectInitialized,
      pythonBinPath: getBinDisplayText(pythonBinPath),
      sectionCollapsed: collectSectionCollapsed(this.focusedSection),
      shareLiveToStudio: getConfigValue(ConfigKey.STUDIO_SHARE_EXPERIMENTS_LIVE)
    })
    this.focusedSection = undefined
  }

  private createWebviewMessageHandler() {
    const webviewMessages = new WebviewMessages(
      () => this.getWebview(),
      () => this.initializeGit(),
      () => this.showExperiments()
    )
    this.dispose.track(
      this.onDidReceivedWebviewMessage(message =>
        webviewMessages.handleMessageFromWebview(message)
      )
    )
    return webviewMessages
  }

  private async findWorkspaceDvcRoots() {
    let dvcRoots: Set<string> = new Set()

    for (const workspaceFolder of getWorkspaceFolders()) {
      const workspaceFolderRoots = await findDvcRootPaths(workspaceFolder)
      if (definedAndNonEmpty(workspaceFolderRoots)) {
        dvcRoots = new Set([...dvcRoots, ...workspaceFolderRoots])
        continue
      }

      await this.config.isReady()
      const absoluteRoot = await findAbsoluteDvcRootPath(
        workspaceFolder,
        this.internalCommands.executeCommand(
          AvailableCommands.ROOT,
          workspaceFolder
        )
      )
      if (absoluteRoot) {
        dvcRoots.add(absoluteRoot)
      }
    }

    const hasMultipleRoots = dvcRoots.size > 1
    void setContextValue(ContextKey.MULTIPLE_PROJECTS, hasMultipleRoots)

    return [...dvcRoots]
  }

  private setCommandsAvailability(available: boolean) {
    void setContextValue(ContextKey.COMMANDS_AVAILABLE, available)
  }

  private setProjectAvailability() {
    const available = this.hasRoots()
    void setContextValue(ContextKey.PROJECT_AVAILABLE, available)
    if (available && this.dotFolderWatcher && !this.dotFolderWatcher.disposed) {
      this.dispose.untrack(this.dotFolderWatcher)
      this.dotFolderWatcher.dispose()
    }
  }

  private async canGitInitialize(needsGitInit: boolean) {
    if (!needsGitInit) {
      return false
    }
    const nestedRoots = await Promise.all(
      getWorkspaceFolders().map(workspaceFolder =>
        findSubRootPaths(workspaceFolder, '.git')
      )
    )

    return isEmpty(nestedRoots.flat())
  }

  private async needsGitInit() {
    if (this.hasRoots()) {
      return false
    }

    const cwd = getFirstWorkspaceFolder()
    if (!cwd) {
      return undefined
    }

    try {
      return !(await this.internalCommands.executeCommand(
        AvailableCommands.GIT_GET_REPOSITORY_ROOT,
        cwd
      ))
    } catch {
      return true
    }
  }

  private initializeGit() {
    const cwd = getFirstWorkspaceFolder()
    if (cwd) {
      void this.internalCommands.executeCommand(AvailableCommands.GIT_INIT, cwd)
    }
  }

  private needsGitCommit(needsGitInit: boolean) {
    if (needsGitInit) {
      return true
    }

    const cwd = getFirstWorkspaceFolder()
    if (!cwd) {
      return true
    }
    return this.internalCommands.executeCommand<boolean>(
      AvailableCommands.GIT_HAS_NO_COMMITS,
      cwd
    )
  }

  private runWorkspace() {
    return runWorkspace(() => this.config.setPythonAndNotifyIfChanged())
  }

  private watchConfigurationDetailsForChanges() {
    this.dispose.track(
      this.config.onDidChangeConfigurationDetails(async () => {
        const stopWatch = new StopWatch()
        try {
          void this.sendDataToWebview()
          await runWithRecheck(this)

          return sendTelemetryEvent(
            EventName.EXTENSION_EXECUTION_DETAILS_CHANGED,
            await this.getEventProperties(),
            { duration: stopWatch.getElapsedTime() }
          )
        } catch (error: unknown) {
          return sendTelemetryEventAndThrow(
            EventName.EXTENSION_EXECUTION_DETAILS_CHANGED,
            error as Error,
            stopWatch.getElapsedTime(),
            await this.getEventProperties()
          )
        }
      })
    )
  }

  private watchPathForChanges(stopWatch: StopWatch) {
    runWithRecheck(this)
      .then(async () => {
        sendTelemetryEvent(
          EventName.EXTENSION_LOAD,
          await this.getEventProperties(),
          { duration: stopWatch.getElapsedTime() }
        )
      })
      .catch(async (error: Error) =>
        sendTelemetryEventAndThrow(
          EventName.EXTENSION_LOAD,
          error,
          stopWatch.getElapsedTime(),
          await this.getEventProperties()
        )
      )
  }

  private watchForVenvChanges() {
    return createFileSystemWatcher(
      disposable => this.dispose.track(disposable),
      '**/dvc{,.exe}',
      async path => {
        if (!path) {
          return
        }

        const previousPythonBinPath = this.config.getPythonBinPath()
        await this.config.setPythonBinPath()

        const trySetupWithVenv =
          previousPythonBinPath !== this.config.getPythonBinPath()

        if (!this.cliAccessible || !this.cliCompatible || trySetupWithVenv) {
          this.workspaceChanged.fire()
        }
      }
    )
  }

  private watchDotFolderForChanges() {
    const cwd = getFirstWorkspaceFolder()

    if (!cwd) {
      return
    }

    const disposer = Disposable.fn()
    this.dotFolderWatcher = disposer
    this.dispose.track(this.dotFolderWatcher)

    return createFileSystemWatcher(
      disposable => disposer.track(disposable),
      getRelativePattern(cwd, '**'),
      path => this.dotFolderListener(disposer, path)
    )
  }

  private dotFolderListener(disposer: Disposer, path: string) {
    if (
      !(path && (path.endsWith(gitPath.DOT_GIT) || path.includes(DOT_DVC))) ||
      disposer.disposed
    ) {
      return
    }

    if (path.includes(DOT_DVC)) {
      this.dispose.untrack(disposer)
      disposer.dispose()
    }

    return this.workspaceChanged.fire()
  }

  private async getEventProperties() {
    return {
      ...(this.cliAccessible ? await this.collectWorkspaceScale() : {}),
      cliAccessible: this.cliAccessible,
      dvcPathUsed: !!this.config.getCliPath(),
      dvcRootCount: this.getRoots().length,
      msPythonInstalled: this.config.isPythonExtensionInstalled(),
      msPythonUsed: await this.isPythonExtensionUsed(),
      pythonPathUsed: !!this.config.getPythonBinPath(),
      workspaceFolderCount: getWorkspaceFolderCount()
    }
  }

  private updateIsStudioConnected() {
    const storedToken = this.getStudioAccessToken()
    const isConnected = isStudioAccessToken(storedToken)
    return this.setStudioIsConnected(isConnected)
  }

  private setStudioIsConnected(isConnected: boolean) {
    this.studioIsConnected = isConnected
    void this.sendDataToWebview()
    return setContextValue(ContextKey.STUDIO_CONNECTED, isConnected)
  }

  private getSecret(key: string) {
    const secrets = this.getSecrets()
    return secrets.get(key)
  }

  private storeSecret(key: string, value: string) {
    const secrets = this.getSecrets()
    return secrets.store(key, value)
  }

  private removeSecret(key: string) {
    const secrets = this.getSecrets()
    return secrets.delete(key)
  }

  private getSecrets() {
    return this.secrets
  }
}
