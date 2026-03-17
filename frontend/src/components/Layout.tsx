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
    <div style={{ display: 'flex', height: '100vh', background: '#f1f5f9', padding: 16, gap: 16, boxSizing: 'border-box' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220,
        background: 'linear-gradient(175deg, #1a1f35 0%, #0d1220 100%)',
        borderRadius: 18,
        padding: '0 10px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        flexShrink: 0,
        alignSelf: 'stretch',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 14px 16px', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.5)',
              flexShrink: 0,
            }}>
              <i className="bi bi-lightning-charge-fill" style={{ fontSize: 16, color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', letterSpacing: 0.2 }}>AI API</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>中转站</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)', margin: '0 4px 12px' }} />

        {/* Nav items */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {navItems.map(item => {
            const active = isActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 14px',
                  gap: 11,
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  color: active ? '#f1f5f9' : '#94a3b8',
                  background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                  borderRadius: 11,
                  textDecoration: 'none',
                  transition: 'all 0.18s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Active left accent bar */}
                {active && (
                  <span style={{
                    position: 'absolute', left: 0, top: '20%', bottom: '20%',
                    width: 3, borderRadius: 2,
                    background: 'linear-gradient(180deg, #818cf8, #6366f1)',
                  }} />
                )}
                {/* Icon container */}
                <span style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                  transition: 'all 0.18s ease',
                }}>
                  <i className={`bi ${item.icon}`} style={{
                    fontSize: 14,
                    color: active ? '#818cf8' : '#7c8da6',
                  }} />
                </span>
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Bottom: status + logout */}
        <div style={{ margin: '8px 4px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            padding: '7px 10px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
              boxShadow: '0 0 6px rgba(34,197,94,0.6)', flexShrink: 0,
            }} />
            <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>服务运行中</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 14px', borderRadius: 11, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.07)',
              color: '#64748b', fontSize: 13, fontWeight: 500,
              transition: 'all 0.18s', width: '100%',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
              e.currentTarget.style.color = '#f87171'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#64748b'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
            }}
          >
            <i className="bi bi-box-arrow-left" style={{ fontSize: 14 }} />
            退出登录
          </button>
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
