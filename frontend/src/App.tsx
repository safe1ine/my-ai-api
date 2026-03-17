import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import StatsPage from './pages/StatsPage'
import LogsPage from './pages/LogsPage'
import ProvidersPage from './pages/ProvidersPage'
import KeysPage from './pages/KeysPage'
import DocsPage from './pages/DocsPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/stats" replace />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/keys" element={<KeysPage />} />
        <Route path="/docs" element={<DocsPage />} />
      </Routes>
    </Layout>
  )
}
