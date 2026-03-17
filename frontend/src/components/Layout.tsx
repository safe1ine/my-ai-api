import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/stats', icon: 'bi-bar-chart-line', label: '统计' },
  { to: '/logs', icon: 'bi-journal-text', label: '调用记录' },
  { to: '/providers', icon: 'bi-cloud-arrow-up', label: '上游管理' },
  { to: '/keys', icon: 'bi-key', label: 'API Key 管理' },
  { to: '/docs', icon: 'bi-book', label: '使用说明' },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav
        className="d-flex flex-column p-0"
        style={{ width: 220, background: '#1a1d23', flexShrink: 0 }}
      >
        <div
          className="px-4 py-3 fw-bold text-white"
          style={{ fontSize: 16, borderBottom: '1px solid #2d3139', background: '#13151a' }}
        >
          <i className="bi bi-lightning-charge-fill text-warning me-2" />
          AI API 中转站
        </div>
        <div className="py-2 flex-grow-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `d-flex align-items-center px-4 py-2 text-decoration-none gap-2 ${
                  isActive
                    ? 'text-white fw-semibold'
                    : 'text-secondary'
                }`
              }
              style={({ isActive }) => ({
                fontSize: 14,
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid #6ea8fe' : '3px solid transparent',
                transition: 'all 0.15s',
              })}
            >
              <i className={`bi ${item.icon}`} style={{ fontSize: 15 }} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main className="flex-grow-1 p-4" style={{ background: '#f5f7fa', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
