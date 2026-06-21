import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout, updateUserProfile } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import { useTransactions } from '../context/TransactionsContext'
import { getUserBalancesByPerson, formatCurrency } from '../utils/transactions'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useDialog } from '../context/DialogContext'
import type { AppUser, ExpenseTransaction } from '../types/types'
import { getTemplatesForUser, deleteTemplate } from '../services/templatesService'
import { getFirebaseErrorMessage } from '../utils/firebaseErrors'

import './Profile.css'
import FallbackState from '../components/FallbackState'
import logoutIcon from '../assets/logout.svg'
import PencilIcon from '../assets/pencil.svg?react'
import TrashIcon from '../assets/trash.svg?react'

export default function Profile() {
  const navigate = useNavigate()
  const { currentUser, loading: authLoading } = useAuth()
  const {
    userTransactions: transactions,
    knownParticipants,
    isLoading,
    error
  } = useTransactions()
  const { showAlert, showConfirm } = useDialog()

  // Stati per la gestione della modifica profilo
  const [isEditing, setIsEditing] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editNickname, setEditNickname] = useState('')
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Stati per i modelli (template)
  const [templates, setTemplates] = useState<ExpenseTransaction[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  // Recuperiamo i modelli dell'utente all'avvio. 
  // Funziona anche Offline grazie alla cache di Firestore!
  useEffect(() => {
    if (!currentUser?.id) return
    getTemplatesForUser(currentUser.id)
      .then(setTemplates)
      .catch(err => console.error('Errore durante il recupero dei modelli:', err))
      .finally(() => setLoadingTemplates(false))
  }, [currentUser?.id])

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

  // Funzione invocata quando si clicca su "Usa" in un modello
  function handleUseTemplate(template: ExpenseTransaction) {
    navigate('/add', {
      state: {
        template: template // Passiamo l'oggetto intero alla pagina di inserimento!
      }
    })
  }

  // Naviga alla pagina di modifica passando il template
  function handleEditTemplate(template: ExpenseTransaction) {
    navigate(`/transactions/${template.id}/edit`, {
      state: { initialTransaction: template }
    })
  }

  // Elimina fisicamente il template
  async function handleDeleteTemplate(template: ExpenseTransaction) {
    const confirmed = await showConfirm('Elimina modello', `Sei sicuro di voler eliminare il modello "${template.templateName}"?`)
    if (!confirmed || !currentUser) return

    try {
      await deleteTemplate(currentUser.id, template.id)
      setTemplates(prev => prev.filter(t => t.id !== template.id)) // Aggiorniamo la UI
    } catch (err) {
      await showAlert('Errore', 'Impossibile eliminare il modello.')
    }
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
      setUpdateError(getFirebaseErrorMessage(err))
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
            <div style={{ display: 'flex', gap: '12px', marginTop: '1rem' }}>
              <button className="profile-edit-btn" onClick={handleEditClick} style={{ margin: 0 }}>Modifica Profilo</button>
              <button className="profile-edit-btn" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: 0, backgroundColor: '#dc3545', color: 'white', border: 'none' }}>
                <img src={logoutIcon} alt="Logout" style={{ width: '18px', height: '18px', filter: 'brightness(0) invert(1)' }} />
                Logout
              </button>
            </div>
          </>
        )}
      </header>

      <p className="profile-settled-text">Sei in pari con {peopleSettledUp} {peopleSettledUp === 1 ? 'persona' : 'persone'}.</p>

      {/* SEZIONE MODELLI / TEMPLATE */}
      <div className="profile-templates" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <h3>I tuoi Modelli</h3>
        {loadingTemplates ? (
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Caricamento modelli...</p>
        ) : templates.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Non hai ancora salvato alcun modello.</p>
        ) : (
          <ul className="pending-balances-list">
            {templates.map((template) => (
              <li key={template.id} className="pending-balance-item">
                <div>
                  <strong className="pending-balance-name">{template.templateName}</strong>
                  <span className="pending-balance-amount" style={{ color: '#666', fontSize: '0.85rem', display: 'block', marginTop: '2px' }}>
                    {formatCurrency(template.amount)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleUseTemplate(template)} className="submit-btn settle-btn" style={{ backgroundColor: '#099268', color: 'white', border: 'none', padding: '6px 12px' }}>
                    Usa
                  </button>
                  <button onClick={() => handleEditTemplate(template)} title="Modifica" aria-label="Modifica" className="submit-btn settle-btn" style={{ backgroundColor: '#f8f9fa', color: '#495057', border: '1px solid #ced4da', padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PencilIcon style={{ width: '16px', height: '16px' }} />
                  </button>
                  <button onClick={() => handleDeleteTemplate(template)} title="Elimina" aria-label="Elimina" className="submit-btn settle-btn" style={{ backgroundColor: '#fff0f0', color: '#c92a2a', border: '1px solid #ffc9c9', padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrashIcon style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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

    </div>
  )
}