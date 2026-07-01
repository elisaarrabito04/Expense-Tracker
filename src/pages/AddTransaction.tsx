import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

import type { TransactionType, AppUser, ExpenseTransaction } from '../types/types'
import { useTransactions } from '../context/TransactionsContext'
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

  // Tipoper lo stato in ingresso, che potrebbe essere null se navighiamo normalmente
  const prefillState = location.state as {
    type?: TransactionType
    otherUserId?: string
    amount?: number
    direction?: 'i_paid' | 'they_paid'
    template?: ExpenseTransaction
  } | null

  const [transactionType, setTransactionType] = useState<TransactionType>(
    prefillState?.type || 'expense'
  )

  const { userTransactions, knownTags, knownParticipants, isLoading } = useTransactions();

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

  // entre recuperiamo i dati in background dal context
  if (isLoading) return <FallbackState type="loading" message="Caricamento dati in corso..." />

  // accesso negato se l'utente non è autenticato
  if (!currentUser) return <FallbackState type="unauthorized" />


  const handleSuccess = () => {
    navigate('/home')
  }

  return (
    <div className="add-transaction-page">
      <header className="add-transaction-header">
        <h2>Aggiungi Transazione</h2>
      </header>

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
          templateTransaction={prefillState?.template}
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