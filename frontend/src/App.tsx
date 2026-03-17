import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import StatsPage from './pages/StatsPage'
import LogsPage from './pages/LogsPage'
import ProvidersPage from './pages/ProvidersPage'
import KeysPage from './pages/KeysPage'
import DocsPage from './pages/DocsPage'
import LoginPage from './pages/LoginPage'
import { authApi, authStorage } from './api'

type AuthState = 'checking' | 'authed' | 'unauthed'

export default function App() {
  const [auth, setAuth] = useState<AuthState>('checking')

  useEffect(() => {
    const token = authStorage.get()
    if (!token) { setAuth('unauthed'); return }
    authApi.me()
      .then(() => setAuth('authed'))
      .catch(() => { authStorage.clear(); setAuth('unauthed') })
  }, [])

  if (auth === 'checking') {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="spinner-border" style={{ color: '#6366f1', width: 28, height: 28, borderWidth: 3 }} />
      </div>
    )
  }

  if (auth === 'unauthed') {
    return <LoginPage onLogin={() => setAuth('authed')} />
  }

  return (
    <Layout onLogout={() => setAuth('unauthed')}>
      <Routes>
        <Route path="/" element={<Navigate to="/stats" replace />} />
        <Route path="/login" element={<Navigate to="/stats" replace />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/keys" element={<KeysPage />} />
        <Route path="/docs" element={<DocsPage />} />
      </Routes>
    </Layout>
  )
}
