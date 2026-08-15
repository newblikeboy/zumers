import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner } from '../components/ErrorBanner'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { login, signup } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const form = new FormData(event.currentTarget)

    try {
      if (mode === 'login') {
        await login(String(form.get('email')), String(form.get('password')))
      } else {
        await signup({
          email: String(form.get('email')),
          password: String(form.get('password')),
          date_of_birth: String(form.get('date_of_birth')),
          display_name: String(form.get('display_name')),
          username: String(form.get('username')),
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand auth-brand">
          <div className="brand-mark">Z</div>
          <div>
            <strong>Zumers</strong>
            <span>18+ individual network</span>
          </div>
        </div>

        <h1>{mode === 'login' ? 'Welcome back' : 'Create your profile'}</h1>
        <ErrorBanner message={error} />

        <form className="form-stack" onSubmit={submit}>
          {mode === 'signup' ? (
            <>
              <label>
                Display name
                <input name="display_name" required />
              </label>
              <label>
                Username
                <input name="username" minLength={3} required />
              </label>
              <label>
                Date of birth
                <input name="date_of_birth" type="date" required />
              </label>
            </>
          ) : null}
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Password
            <span className="password-field">
              <input
                name="password"
                required
                type={showPassword ? 'text' : 'password'}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <button className="primary-button" disabled={busy}>
            {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            <span>
              {busy ? 'Please wait' : mode === 'login' ? 'Login' : 'Signup'}
            </span>
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>
              Need an account? <Link to="/signup">Signup</Link>
            </>
          ) : (
            <>
              Already registered? <Link to="/login">Login</Link>
            </>
          )}
        </p>
      </section>
    </main>
  )
}
