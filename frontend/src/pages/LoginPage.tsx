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

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '13px 16px',
    border: '1px solid #dadce0',
    borderRadius: 4, fontSize: 16, color: '#202124',
    outline: 'none', background: '#fff',
    transition: 'border-color 0.15s',
    fontFamily: "'Google Sans', Roboto, sans-serif",
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f9fa',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Google Sans', Roboto, sans-serif",
    }}>
      <div style={{ width: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(66,133,244,0.3)',
          }}>
            <i className="bi bi-lightning-charge-fill" style={{ fontSize: 26, color: '#fff' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 400, color: '#202124' }}>AI API 中转站</div>
          <div style={{ fontSize: 14, color: '#5f6368', marginTop: 8 }}>登录管理面板</div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          border: '1px solid #dadce0',
          borderRadius: 8,
          padding: '40px 40px 32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#3c4043', marginBottom: 8 }}>
                用户名
              </label>
              <input
                type="text"
                autoFocus
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#1a73e8'}
                onBlur={e => e.currentTarget.style.borderColor = '#dadce0'}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#3c4043', marginBottom: 8 }}>
                密码
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={e => e.currentTarget.style.borderColor = '#1a73e8'}
                  onBlur={e => e.currentTarget.style.borderColor = '#dadce0'}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#5f6368', fontSize: 16, padding: 4,
                  }}
                >
                  <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#fce8e6', borderRadius: 4,
                padding: '10px 14px', marginBottom: 20,
                fontSize: 13, color: '#c5221f',
              }}>
                <i className="bi bi-exclamation-circle-fill" style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? '#a8c7fa' : '#1a73e8',
                border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14, fontWeight: 500, color: '#fff',
                letterSpacing: 0.25, transition: 'background 0.15s',
                fontFamily: "'Google Sans', Roboto, sans-serif",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1557b0' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#1a73e8' }}
            >
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2" style={{ width: 14, height: 14, borderWidth: 2 }} />登录中...</>
                : '登录'
              }
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9aa0a6' }}>
          通过 ADMIN_USERNAME / ADMIN_PASSWORD 环境变量配置凭据
        </div>
      </div>
    </div>
  )
}
