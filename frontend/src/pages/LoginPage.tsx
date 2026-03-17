import { useState } from 'react'
import { authApi, authStorage } from '../api'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) { setError('请填写用户名和密码'); return }
    setLoading(true)
    setError(null)
    try {
      const { token } = await authApi.login(username, password)
      authStorage.set(token)
      onLogin()
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Background decoration */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '15%', left: '10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', right: '10%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
        }} />
      </div>

      <div style={{ width: 380, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99,102,241,0.45)',
          }}>
            <i className="bi bi-lightning-charge-fill" style={{ fontSize: 26, color: '#fff' }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', letterSpacing: 0.3 }}>AI API 中转站</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 5 }}>登录管理面板</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 20,
          padding: '32px 32px 28px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94a3b8', marginBottom: 7 }}>
                用户名
              </label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-person" style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  color: '#475569', fontSize: 15,
                }} />
                <input
                  type="text"
                  autoFocus
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 14px 11px 38px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 10, fontSize: 14, color: '#e2e8f0',
                    outline: 'none',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94a3b8', marginBottom: 7 }}>
                密码
              </label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-lock" style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  color: '#475569', fontSize: 15,
                }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 40px 11px 38px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 10, fontSize: 14, color: '#e2e8f0',
                    outline: 'none',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#475569', fontSize: 14, padding: 2,
                  }}
                >
                  <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 9, padding: '9px 13px', marginBottom: 16,
                fontSize: 13, color: '#fca5a5',
              }}>
                <i className="bi bi-exclamation-circle-fill" style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                border: 'none', borderRadius: 11, cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14.5, fontWeight: 600, color: '#fff', letterSpacing: 0.3,
                boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.4)',
                transition: 'all 0.18s',
              }}
            >
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2" style={{ width: 14, height: 14, borderWidth: 2 }} />登录中...</>
                : '登 录'
              }
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#334155' }}>
          通过 ADMIN_USERNAME / ADMIN_PASSWORD 环境变量配置凭据
        </div>
      </div>
    </div>
  )
}
