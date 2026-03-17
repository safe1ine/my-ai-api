import { ReactNode } from 'react'
import { useLocation, Link } from 'react-router-dom'

const navItems = [
  { to: '/stats', icon: 'bi-bar-chart-line', label: '统计' },
  { to: '/logs', icon: 'bi-journal-text', label: '调用记录' },
  { to: '/providers', icon: 'bi-cloud-arrow-up', label: '上游管理' },
  { to: '/keys', icon: 'bi-key', label: 'API Key 管理' },
  { to: '/docs', icon: 'bi-book', label: '使用说明' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  
  const isActive = (path: string) => {
    if (path === '/stats') return location.pathname === '/stats'
    return location.pathname.startsWith(path)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f1f5f9', padding: 16, gap: 16, boxSizing: 'border-box' }}>
      {/* Sidebar */}
      <nav
        style={{ 
          width: 220, 
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', 
          borderRadius: 16,
          padding: '20px 12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          flexShrink: 0,
          alignSelf: 'stretch',
        }}
      >
        <div
          className="px-3 py-3 fw-bold text-white"
          style={{ fontSize: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 8 }}
        >
          <i className="bi bi-lightning-charge-fill me-2" style={{ color: '#60a5fa' }} />
          AI API 中转站
        </div>
        <div style={{ marginTop: 8 }}>
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                gap: 12,
                fontSize: 14,
                cursor: 'pointer',
                color: isActive(item.to) ? '#fff' : 'rgba(255,255,255,0.5)',
                background: isActive(item.to) ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                borderRadius: 10,
                textDecoration: 'none',
                marginBottom: 4,
                transition: 'all 0.2s ease',
              }}
            >
              <i className={`bi ${item.icon}`} style={{ fontSize: 16, color: isActive(item.to) ? '#60a5fa' : '#94a3b8' }} />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'auto' }}>
        <div style={{ padding: 24 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
