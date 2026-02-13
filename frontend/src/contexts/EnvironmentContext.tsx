import React, { createContext, useContext, useMemo, useState } from 'react'
import {
  type RuntimeEnv,
  getApiBaseUrl,
  getRuntimeEnv,
  getRuntimeEnvOptions,
  setRuntimeEnv,
} from '@/lib/runtimeEnv'

type EnvironmentContextValue = {
  env: RuntimeEnv
  apiBaseUrl: string
  setEnv: (nextEnv: RuntimeEnv) => void
  options: ReturnType<typeof getRuntimeEnvOptions>
}

const EnvironmentContext = createContext<EnvironmentContextValue | undefined>(undefined)

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const [env, setEnvState] = useState<RuntimeEnv>(() => getRuntimeEnv())

  const value = useMemo(
    () => ({
      env,
      apiBaseUrl: getApiBaseUrl(env),
      setEnv: (nextEnv: RuntimeEnv) => {
        setRuntimeEnv(nextEnv)
        setEnvState(nextEnv)
      },
      options: getRuntimeEnvOptions(),
    }),
    [env]
  )

  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext)
  if (!context) {
    throw new Error('useEnvironment must be used within EnvironmentProvider')
  }
  return context
}

