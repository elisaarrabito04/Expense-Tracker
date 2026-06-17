import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout, updateUserProfile } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import { useTransactions } from '../context/TransactionsContext'
import { getUserBalancesByPerson, formatCurrency } from '../utils/transactions'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useDialog } from '../context/DialogContext'
import type { AppUser } from '../types/types'

import './Profile.css'
import FallbackState from '../components/FallbackState'
import logoutIcon from '../assets/logout.svg'

export default function Profile() {
  const navigate = useNavigate()
  const { currentUser, loading: authLoading } = useAuth()
  const {
    userTransactions: transactions,
    knownParticipants,
    isLoading,
    error
  } = useTransactions()
  const { showAlert } = useDialog()

  // Stati per la gestione della modifica profilo
  const [isEditing, setIsEditing] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editNickname, setEditNickname] = useState('')
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // STATO DI RETE
  const isOnline = useNetworkStatus()
  const isOffline = !isOnline

  // Mappiamo l'array knownParticipants in un dizionario per accesso O(1)
  // esattamente come facevamo prima
  const involvedUsers = useMemo(() => {
    return knownParticipants.reduce((acc, user) => {
      acc[user.id] = user
      return acc
    }, {} as Record<string, AppUser>)
  }, [knownParticipants])

  // le utility di calcolo hanno dei controlli interni, 
  // per filtrare già solo quelle "active"
  const balances = useMemo(() => {
    if (!currentUser?.id) return {}
    return getUserBalancesByPerson(transactions, currentUser.id)
  }, [transactions, currentUser?.id])

  // 4. Filtriamo i saldi escludendo quelli a zero (gestendo possibili arrotondamenti Javascript coi float)
  const pendingBalances = Object.entries(balances).filter(([_, amount]) => Math.abs(amount) > 0.01)
  
  // Requisito: numero persone con cui è in pari
  const totalPeopleInteracted = Object.keys(balances).length
  const peopleSettledUp = totalPeopleInteracted - pendingBalances.length

  async function handleLogout() {
    try {
      await logout()
      // La navigazione esplicita a /auth è una buona pratica,
      // anche se il ProtectedRoute farebbe comunque il redirect
      // non appena rileva l'utente come non autenticato.
      navigate('/auth', { replace: true })
    } catch (error) {
      console.error('Errore durante il logout:', error)
      await showAlert('Errore', 'Logout non riuscito. Riprova.')
    }
  }

  // Funzione che invocherai quando l'utente clicca "Salda" accanto a una persona
  function handleSettleUp(personId: string, amount: number, isDebt: boolean) {
    // Se io ero in debito (isDebt === true), significa che io pago lui (direction: 'i_paid').
    // Se io ero in credito (isDebt === false) significa che la persona mi ha restituito i soldi, 
    // e io sto registrando l'azione (direction: 'they_paid').
    navigate('/add', {
      state: {
        type: 'settlement',
        otherUserId: personId,
        amount: amount,
        direction: isDebt ? 'i_paid' : 'they_paid',
      },
    })
  }

  function handleEditClick() {
    // Pre-compiliamo i campi con i dati attuali al momento del click
    setEditDisplayName(currentUser?.displayName || '')
    setEditNickname(currentUser?.nickname || '')
    setUpdateError(null)
    setIsEditing(true)
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()

    // Blocchiamo il salvataggio se l'utente è offline.
    // Questo perché la validazione del nickname (per vedere se esiste già)
    // necessita di interrogare l'intero database, operazione non permessa offline.
    if (isOffline) {
      setUpdateError('Sei offline. Per modificare il profilo e verificare il nickname è necessaria la connessione.')
      return
    }

    const normalizedDisplayName = editDisplayName.trim()
    const normalizedNickname = editNickname.trim().toLowerCase()

    if (!normalizedDisplayName || !normalizedNickname) {
      setUpdateError('Nome e Nickname sono obbligatori.')
      return
    }

    if (!/^[a-z0-9_.]+$/.test(normalizedNickname)) {
      setUpdateError('Il nickname può contenere solo lettere minuscole, numeri, underscore (_) e punti (.). Non sono ammessi spazi.')
      return
    }

    setIsUpdating(true)
    setUpdateError(null)

    try {
      await updateUserProfile({
        currentNickname: currentUser?.nickname,
        newDisplayName: editDisplayName,
        newNickname: editNickname
      })
      setIsEditing(false) // Chiudiamo il form se è andato tutto a buon fine
    } catch (err: any) {
      setUpdateError(err.message || 'Errore durante l\'aggiornamento.')
    } finally {
      setIsUpdating(false)
    }
  }

  // Sostituzione dei semplici div testuali pre-rendering con il componente FallbackState
  if (authLoading || isLoading) {
    return <FallbackState type="loading" message="Caricamento profilo in corso..." />
  }

  if (!currentUser) {
    return <FallbackState type="unauthorized" />
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        {isEditing ? (
          <form onSubmit={handleUpdateProfile} className="profile-edit-form">
            <div className="form-group">
              <label htmlFor="edit-displayName">Nome visualizzato</label>
              <input
                id="edit-displayName"
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-nickname">Nickname</label>
              <input
                id="edit-nickname"
                type="text"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                required
              />
            </div>
            
            {updateError && <p className="profile-error">{updateError}</p>}
            
            <div className="profile-edit-actions">
              <button type="submit" className="submit-btn" disabled={isUpdating || isOffline}>
                {isOffline 
                  ? 'Offline' 
                  : isUpdating 
                    ? 'Salvataggio...' 
                    : 'Salva'}
              </button>
              <button type="button" className="submit-btn cancel-btn" onClick={() => setIsEditing(false)} disabled={isUpdating}>Annulla</button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="profile-title">Ciao, {currentUser.displayName}!</h1>
            <p className="profile-subtitle">email: {currentUser.email}</p>
            {currentUser.nickname && <p className="profile-nickname">nickname: {currentUser.nickname}</p>}
            <button className="profile-edit-btn" onClick={handleEditClick}>Modifica Profilo</button>
          </>
        )}
      </header>

      <p className="profile-settled-text">Sei in pari con {peopleSettledUp} {peopleSettledUp === 1 ? 'persona' : 'persone'}.</p>

      <h3>Saldi in sospeso</h3>
      {error && <p className="profile-error">{error}</p>}
      
      {pendingBalances.length === 0 ? (
        // Sostituiamo il paragrafo testuale con il FallbackState di tipo "empty"
        <FallbackState type="empty" message="Non hai nessun saldo in sospeso al momento." />
      ) : (
        <ul className="pending-balances-list">
          {pendingBalances.map(([personId, amount]) => {
            const person = involvedUsers[personId]
            const personName = person ? person.displayName : 'Utente sconosciuto'
            const isDebt = amount < 0 // Se il saldo è negativo, l'utente loggato DEVE soldi a personId
            const absoluteAmount = Math.abs(amount)

            return (
              <li key={personId} className="pending-balance-item">
                <div>
                  <strong className="pending-balance-name">
                    {personName}{person?.nickname ? ` (${person.nickname})` : ''}
                  </strong>
                  <span className={`pending-balance-amount ${isDebt ? 'balance-negative' : 'balance-positive'}`}>
                    {isDebt ? 'Devi ' : 'Ti deve '} {formatCurrency(absoluteAmount)}
                  </span>
                </div>
                <button onClick={() => handleSettleUp(personId, absoluteAmount, isDebt)} className="submit-btn settle-btn">
                  Salda
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <br /><br />

      <button className="submit-btn cancel-btn" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 auto' }}>
        <img src={logoutIcon} alt="Logout" style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)' }} />
        Logout
      </button>
    </div>
  )
}