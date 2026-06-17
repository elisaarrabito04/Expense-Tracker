import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

import type { TransactionType, Tag, AppUser, Transaction } from '../types/types'
import {useTransactions} from '../context/TransactionsContext'
import { getAvailableTags, getAvailableUsersIds } from '../utils/transactions'
import TransactionTypeSwitcher from '../components/transactions/TransactionTypeSwitcher'
import ExpenseForm from '../components/transactions/ExpenseForm'
import SettlementForm from '../components/transactions/SettlementForm'
import './AddTransaction.css'
import FallbackState from '../components/FallbackState'

export default function AddTransaction() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() // per leggere i dati della navigazione

  // Definiamo un tipo per lo stato in ingresso, che potrebbe essere null se navighiamo normalmente
  const prefillState = location.state as {
    type?: TransactionType
    otherUserId?: string
    amount?: number
    direction?: 'i_paid' | 'they_paid'
  } | null

  // 1. Stato per il tipo di transazione: lo impostiamo subito su "settlement" se arriviamo dal Profilo
  const [transactionType, setTransactionType] = useState<TransactionType>(
    prefillState?.type || 'expense'
  )

  // 2. Dati globali necessari a entrambi i form
  const { userTransactions, knownTags, knownParticipants, isLoading } = useTransactions();

  // Se l'utente non è loggato, per sicurezza redirigiamo al login
  useEffect(() => {
    if (!currentUser) {
      navigate('/auth', { replace: true })
    }
  }, [currentUser, navigate])

  // Deriviamo solo i tag e gli utenti "attivi" per popolare i form di aggiunta,
  // ignorando quelli provenienti da transazioni pending, in revisione o eliminate.
  const activeKnownTags = useMemo(() => {
    const activeTagIds = getAvailableTags(userTransactions)
    return knownTags.filter(t => activeTagIds.includes(t.id))
  }, [knownTags, userTransactions])

  const activeKnownParticipants = useMemo(() => {
    const activeUserIds = getAvailableUsersIds(userTransactions)
    return knownParticipants.filter(p => activeUserIds.includes(p.id))
  }, [knownParticipants, userTransactions])

  // Mostriamo il fallback di caricamento mentre recuperiamo i dati in background dal context
  if (isLoading) return <FallbackState type="loading" message="Caricamento dati in corso..." />

  // Mostriamo il fallback di accesso negato se l'utente non è autenticato
  if (!currentUser) return <FallbackState type="unauthorized" />


  // Funzione di servizio: torneremo alla Home a transazione salvata
  const handleSuccess = () => {
    navigate('/home')
  }

  return (
    <div className="add-transaction-page">
      <header className="add-transaction-header">
        <h2>Aggiungi Transazione</h2>
      </header>

      {/* TYPE SELECTOR: Toggle tra Spesa e Rimborso */}
      <TransactionTypeSwitcher 
        value={transactionType} 
        onChange={setTransactionType} 
      />

      {transactionType === 'expense' ? (
        <ExpenseForm 
          currentUser={currentUser as AppUser} 
          knownTags={activeKnownTags} 
          knownParticipants={activeKnownParticipants} 
          userTransactions={userTransactions}
          onSuccess={handleSuccess}
          onCancel={() => navigate(-1)}
        />
      ) : (
        <SettlementForm 
          currentUser={currentUser as AppUser} 
          knownParticipants={activeKnownParticipants} 
          onSuccess={handleSuccess}
          initialOtherUserId={prefillState?.otherUserId}
          initialAmount={prefillState?.amount}
          initialDirection={prefillState?.direction}
          onCancel={() => navigate(-1)}
        />
      )}
    </div>
  )
}