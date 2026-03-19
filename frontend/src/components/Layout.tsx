import { ReactNode } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { authApi, authStorage } from '../api'

const navItems = [
  { to: '/stats',     icon: 'bi-bar-chart-line',  label: '统计' },
  { to: '/logs',      icon: 'bi-journal-text',     label: 'Logs' },
  { to: '/providers', icon: 'bi-cloud-arrow-up',   label: 'Upstream' },
  { to: '/keys',      icon: 'bi-key',              label: 'API Token' },
  { to: '/docs',      icon: 'bi-book',             label: '使用说明' },
]

export default function Layout({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const location = useLocation()

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    authStorage.clear()
    onLogout()
  }

  const isActive = (path: string) => {
    if (path === '/stats') return location.pathname === '/stats'
    return location.pathname.startsWith(path)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8f9fa', fontFamily: "'Google Sans', Roboto, sans-serif" }}>
      {/* Sidebar */}
      <nav style={{
        width: 200,
        background: '#fff',
        borderRight: '1px solid #e8eaed',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 8,
      }}>
        {/* Logo */}
        <div style={{ padding: '12px 16px 8px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <i className="bi bi-lightning-charge-fill" style={{ fontSize: 18, color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#202124', letterSpacing: 0.1 }}>AI API</div>
              <div style={{ fontSize: 12, color: '#5f6368', fontWeight: 400 }}>中转站</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const active = isActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 16px',
                  gap: 14,
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  color: active ? '#1a73e8' : '#3c4043',
                  background: active ? '#e8f0fe' : 'transparent',
                  borderRadius: 24,
                  textDecoration: 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f1f3f4' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <i className={`bi ${item.icon}`} style={{
                  fontSize: 18,
                  color: active ? '#1a73e8' : '#5f6368',
                  width: 20, textAlign: 'center',
                }} />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Bottom */}
        <div style={{ padding: '8px 16px 16px', borderTop: '1px solid #e8eaed', marginTop: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', marginBottom: 4,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: '#34a853',
              boxShadow: '0 0 0 2px rgba(52,168,83,0.2)', flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: '#5f6368' }}>服务运行中</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderRadius: 24, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: '#5f6368', fontSize: 14, fontWeight: 400,
              transition: 'background 0.15s', width: '100%',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <i className="bi bi-box-arrow-left" style={{ fontSize: 18, color: '#5f6368', width: 20, textAlign: 'center' }} />
            退出登录
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto', background: '#f8f9fa' }}>
        <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
