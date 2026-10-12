import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('antennaguard_user')) || null } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('antennaguard:unauthorized', onUnauthorized)
    const token = localStorage.getItem('antennaguard_token')
    if (!token) { setLoading(false); return }
    api.me()
      .then((data) => { setUser(data); localStorage.setItem('antennaguard_user', JSON.stringify(data)) })
      .catch(() => signOut())
      .finally(() => setLoading(false))
    return () => window.removeEventListener('antennaguard:unauthorized', onUnauthorized)
  }, [])

  async function signIn(email, password) {
    const token = await api.login({ email, password })
    localStorage.setItem('antennaguard_token', token.access_token)
    const me = await api.me()
    localStorage.setItem('antennaguard_user', JSON.stringify(me))
    setUser(me)
  }

  async function signUp(name, email, password) {
    await api.register({ name, email, password })
    await signIn(email, password)
  }

  function signOut() {
    localStorage.removeItem('antennaguard_token')
    localStorage.removeItem('antennaguard_user')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
    {children}
  </AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
