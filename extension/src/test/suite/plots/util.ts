import { Disposer } from '@hediet/std/disposable'
import { stub } from 'sinon'
import * as FileSystem from '../../../fileSystem'
import expShowFixtureWithoutErrors from '../../fixtures/expShow/base/noErrors'
import checkpointPlotsFixture from '../../fixtures/expShow/base/checkpointPlots'
import { Plots } from '../../../plots'
import { buildMockMemento, dvcDemoPath } from '../../util'
import { WorkspacePlots } from '../../../plots/workspace'
import { WorkspaceExperiments } from '../../../experiments/workspace'
import { PlotsModel } from '../../../plots/model'
import { PlotsData } from '../../../plots/data'
import { Experiments } from '../../../experiments'
import { buildDependencies, buildMockData } from '../util'
import { FileSystemData } from '../../../fileSystem/data'
import { ExperimentsData } from '../../../experiments/data'
import { mockHasCheckpoints } from '../experiments/util'
import { MOCK_IMAGE_MTIME } from '../../fixtures/plotsDiff'
import { PathsModel } from '../../../plots/paths/model'
import { Color } from '../../../experiments/model/status/colors'
import { BaseWorkspaceWebviews } from '../../../webview/workspace'
import { WebviewMessages } from '../../../plots/webview/messages'
import { ExperimentsModel } from '../../../experiments/model'
import { Experiment } from '../../../experiments/webview/contract'
import { EXPERIMENT_WORKSPACE_ID } from '../../../cli/dvc/contract'

export const buildPlots = async (
  disposer: Disposer,
  plotsDiff = {},
  expShow = expShowFixtureWithoutErrors
) => {
  const {
    internalCommands,
    mockPlotsDiff,
    messageSpy,
    updatesPaused,
    resourceLocator
  } = buildDependencies(disposer, expShow, plotsDiff)

  const mockRemoveDir = stub(FileSystem, 'removeDir').returns(undefined)
  const mockGetModifiedTime = stub(FileSystem, 'getModifiedTime').returns(
    MOCK_IMAGE_MTIME
  )

  const experiments = disposer.track(
    new Experiments(
      dvcDemoPath,
      internalCommands,
      updatesPaused,
      resourceLocator,
      buildMockMemento(),
      () => Promise.resolve(true),
      buildMockData<ExperimentsData>(),
      buildMockData<FileSystemData>()
    )
  )
  const plots = disposer.track(
    new Plots(
      dvcDemoPath,
      internalCommands,
      experiments,
      updatesPaused,
      resourceLocator.scatterGraph,
      buildMockMemento()
    )
  )

  mockHasCheckpoints(expShow)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const experimentsModel: ExperimentsModel = (experiments as any).experiments
  experimentsModel.setSelected([
    { id: EXPERIMENT_WORKSPACE_ID },
    { id: 'main' },
    { id: 'exp-e7a67' },
    { id: 'test-branch' },
    { id: 'exp-83425' },
    { id: 'exp-f13bca' }
  ] as Experiment[])

  void experiments.setState(expShow)

  await plots.isReady()

  stub(BaseWorkspaceWebviews.prototype, 'getDvcRoots').returns([dvcDemoPath])
  stub(WorkspaceExperiments.prototype, 'getRepository').returns(experiments)
  stub(WorkspacePlots.prototype, 'getRepository').returns(plots)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: PlotsData = (plots as any).data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plotsModel: PlotsModel = (plots as any).plots

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pathsModel: PathsModel = (plots as any).paths

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webviewMessages: WebviewMessages = (plots as any).webviewMessages

  return {
    data,
    experiments,
    messageSpy,
    mockGetModifiedTime,
    mockPlotsDiff,
    mockRemoveDir,
    pathsModel,
    plots,
    plotsModel,
    webviewMessages
  }
}

export const buildWorkspacePlots = (disposer: Disposer) => {
  const { config, internalCommands, messageSpy, resourceLocator } =
    buildDependencies(disposer)

  const workspacePlots = disposer.track(
    new WorkspacePlots(internalCommands, buildMockMemento())
  )

  return {
    config,
    internalCommands,
    messageSpy,
    resourceLocator,
    workspacePlots
  }
}

export const getExpectedCheckpointPlotsData = (
  domain: string[],
  range: Color[]
) => {
  const { plots, selectedMetrics, nbItemsPerRow, height } =
    checkpointPlotsFixture
  return {
    checkpoint: {
      colors: {
        domain,
        range
      },
      height,
      nbItemsPerRow,
      plots: plots.map(plot => ({
        id: plot.id,
        title: plot.title,
        values: plot.values.filter(values => domain.includes(values.group))
      })),
      selectedMetrics
    }
  }
}
