import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginWithEmail, registerWithEmail } from '../services/authService'
import { isNicknameTaken } from '../services/usersService'
import './AuthPage.css'

type Mode = 'login' | 'register'

export default function AuthPage() {
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('login')
  const [displayName, setDisplayName] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (mode === 'register') {
      const normalizedDisplayName = displayName.trim()
      const normalizedNickname = nickname.trim().toLowerCase()

      if (!normalizedDisplayName) {
        setError('Inserisci il nome.')
        return
      }

      if (!normalizedNickname) {
        setError('Inserisci un nickname.')
        return
      }
      
      if (!/^[a-z0-9_.]+$/.test(normalizedNickname)) {
        setError('Il nickname può contenere solo lettere minuscole, numeri, underscore (_) e punti (.). Non sono ammessi spazi.')
        return
      }

      const taken = await isNicknameTaken(normalizedNickname)
      if (taken) {
        setError('Questo nickname è già in uso. Scegline un altro.')
        return
      }

      if (password !== confirmPassword) {
        setError('Le password non coincidono.')
        return
      }
    }

    setIsSubmitting(true)

    try {
      if (mode === 'register') {
        await registerWithEmail({ displayName, email, password, nickname: nickname.trim().toLowerCase() })
      } else {
        await loginWithEmail({ email, password })
      }

      // Dopo login/registrazione navighiamo verso /home.
      // L'accesso effettivo alla pagina protetta verrà comunque sbloccato
      // solo quando AuthContext avrà risolto anche currentUser.
      navigate('/home', { replace: true })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Operazione non riuscita.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <header className="auth-header">
          <h1 className="auth-title">
            {mode === 'login' ? 'Bentornato!' : 'Crea un account'}
          </h1>
          <p className="auth-subtitle">
            {mode === 'login' 
              ? 'Accedi per gestire le tue spese condivise' 
              : 'Registrati per iniziare a condividere le tue spese'}
          </p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div>
              <div className="form-group">
                <label htmlFor="displayName">Nome</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  placeholder="Il tuo nome"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="nickname">Nickname univoco</label>
                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="es. mario_89"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="es. mario.rossi@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="La tua password"
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Conferma password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Ripeti la password"
              />
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="submit-btn auth-submit-btn" disabled={isSubmitting}>
            {isSubmitting
              ? 'Attendi...'
              : mode === 'login'
              ? 'Accedi'
              : 'Registrati'}
          </button>
        </form>

        <button
          type="button"
          className="auth-toggle-btn"
          onClick={() =>
            setMode((prev) => (prev === 'login' ? 'register' : 'login'))
          }
        >
          {mode === 'login'
            ? 'Non hai un account? Registrati'
            : 'Hai già un account? Accedi'}
        </button>
      </div>
    </div>
  )
}