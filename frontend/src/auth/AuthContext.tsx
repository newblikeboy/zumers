import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { api, configureApiTokens } from '../lib/api'
import type { User } from '../lib/types'

type AuthContextValue = {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (body: {
    email: string
    password: string
    date_of_birth: string
    display_name: string
    username: string
  }) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const accessTokenKey = 'zumers.accessToken'
const refreshTokenKey = 'zumers.refreshToken'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState(() =>
    localStorage.getItem(accessTokenKey),
  )
  const [refreshToken, setRefreshToken] = useState(() =>
    localStorage.getItem(refreshTokenKey),
  )
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const setTokens = useCallback(
    (tokens: { accessToken: string; refreshToken: string }) => {
      setAccessToken(tokens.accessToken)
      setRefreshToken(tokens.refreshToken)
      localStorage.setItem(accessTokenKey, tokens.accessToken)
      localStorage.setItem(refreshTokenKey, tokens.refreshToken)
    },
    [],
  )

  const clear = useCallback(() => {
    setAccessToken(null)
    setRefreshToken(null)
    setUser(null)
    localStorage.removeItem(accessTokenKey)
    localStorage.removeItem(refreshTokenKey)
  }, [])

  useEffect(() => {
    configureApiTokens({
      accessToken,
      refreshToken,
      setTokens,
      clear,
    })
  }, [accessToken, refreshToken, setTokens, clear])

  useEffect(() => {
    let cancelled = false
    async function loadUser() {
      if (!accessToken && !refreshToken) {
        setLoading(false)
        return
      }
      try {
        const current = await api.me()
        if (!cancelled) setUser(current)
      } catch {
        if (!cancelled) clear()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadUser()
    return () => {
      cancelled = true
    }
  }, [accessToken, refreshToken, clear])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      loading,
      setUser,
      login: async (email, password) => {
        const response = await api.login({ email, password })
        setTokens({
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
        })
        setUser(response.user)
      },
      signup: async (body) => {
        const response = await api.signup(body)
        setTokens({
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
        })
        setUser(response.user)
      },
      logout: async () => {
        if (refreshToken) {
          await api.logout(refreshToken).catch(() => undefined)
        }
        clear()
      },
    }),
    [user, accessToken, refreshToken, loading, setTokens, clear],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
