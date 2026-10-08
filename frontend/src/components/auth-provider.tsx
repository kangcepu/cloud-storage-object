'use client'

import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch, apiJson, clearCsrf, refreshCsrf } from '@/src/lib/api'
import type { User } from '@/src/types'

interface AuthContextValue {
  user: User | null
  ready: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiFetch<{ user: User }>('/api/auth/me')
      setUser(response.user)
      return response.user
    } catch {
      setUser(null)
      return null
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    await refreshCsrf()
    const response = await apiJson<{ user: User }>('/api/auth/login', 'POST', { email, password })
    clearCsrf()
    await refreshCsrf()
    setUser(response.user)
    setReady(true)
    return response.user
  }, [])

  const logout = useCallback(async () => {
    await apiJson('/api/auth/logout', 'POST')
    clearCsrf()
    setUser(null)
    router.replace('/login')
    router.refresh()
  }, [router])

  const value = useMemo(
    () => ({ user, ready, login, logout, refreshUser }),
    [user, ready, login, logout, refreshUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider tidak tersedia')
  return context
}
