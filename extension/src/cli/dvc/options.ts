import { dirname } from 'path'
import { Args } from './constants'
import { getCaseSensitiveCwd } from './cwd'
import { getProcessEnv } from '../../env'
import { joinEnvPath } from '../../util/env'
import { ProcessOptions } from '../../process/execution'

type ExecutionOptions = ProcessOptions & {
  env: NodeJS.ProcessEnv
}

const getPATH = (existingPath: string, pythonBinPath?: string): string => {
  const python = pythonBinPath ? dirname(pythonBinPath) : ''
  return joinEnvPath(python, existingPath)
}

const getEnv = (pythonBinPath?: string): NodeJS.ProcessEnv => {
  const env = getProcessEnv()
  const PATH = getPATH(env?.PATH as string, pythonBinPath)
  return {
    ...env,
    DVCLIVE_OPEN: 'false',
    DVC_NO_ANALYTICS: 'true',
    PATH
  }
}

const getArgs = (
  pythonBinPath: string | undefined,
  cliPath: string,
  ...args: Args
) => (!cliPath && pythonBinPath ? ['-m', 'dvc', ...args] : args)

const getExecutable = (pythonBinPath: string | undefined, cliPath: string) =>
  cliPath || pythonBinPath || 'dvc'

export const getOptions = (
  pythonBinPath: string | undefined,
  cliPath: string,
  cwd: string,
  ...originalArgs: Args
): ExecutionOptions => {
  const executable = getExecutable(pythonBinPath, cliPath)
  const args = getArgs(pythonBinPath, cliPath, ...originalArgs)
  return {
    args,
    cwd: getCaseSensitiveCwd(cwd),
    env: getEnv(pythonBinPath),
    executable
  }
}

export const addStudioAccessToken = (
  options: ExecutionOptions,
  studioAccessToken: string | undefined,
  repoUrl?: string
): ExecutionOptions => {
  if (!studioAccessToken) {
    return options
  }

  if (!repoUrl) {
    return {
      ...options,
      env: { ...options.env, STUDIO_TOKEN: studioAccessToken }
    }
  }

  return {
    ...options,
    env: {
      ...options.env,
      STUDIO_REPO_URL: repoUrl,
      STUDIO_TOKEN: studioAccessToken
    }
  }
}
