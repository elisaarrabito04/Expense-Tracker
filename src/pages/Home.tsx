import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTransactions } from '../context/TransactionsContext'

import './Home.css'

import BalanceSummarySection from '../components/home/BalanceSummarySection'
import TransactionList from '../components/home/TransactionList'
import HomeFilters from '../components/home/HomeFilters'
import FallbackState from '../components/FallbackState'

import { useTransactionFilters } from '../hooks/useTransactionFilters'
import { useTransactionActions } from '../hooks/useTransactionActions'

import {
  getUserBalancesByPerson,
  getUserBalanceSummary,
  getAvailableUsersIds,
  getAvailableTags,
} from '../utils/transactions'

export default function Home() {
  const navigate = useNavigate()
  const { currentUser, loading: authLoading } = useAuth()
  const {
    userTransactions: transactions,
    knownParticipants, // considerando tutte le userTransactions (anche non active)
    knownTags: availableTags, // considerando tutte le userTransaction (anxche non active)
    isLoading,
    error
  } = useTransactions()

  const currentUserId = currentUser?.id

  // Delego le logiche di modifica/eliminazione/accettazione al custom hook
  const {
    handleDeleteTransaction,
    handleAcceptTransaction,
    handleRejectTransaction,
    handleEditTransaction,
  } = useTransactionActions(transactions, currentUserId)

  // Delego tutta la logica dei filtri al custom hook
  const {
    filters,
    actions,
    filteredTransactions,
  } = useTransactionFilters(transactions, currentUserId)

  
  // Aggiungiamo l'utente corrente alla lista degli involvedUsers
  // così le card possono renderizzare correttamente il suo nome (es. "Tu")
  const involvedUsers = useMemo(() => {
    if (!currentUser) return knownParticipants
    return [...knownParticipants, currentUser]
  }, [knownParticipants, currentUser])


  const balances = useMemo(() => {
    if (!currentUserId) return {}
    return getUserBalancesByPerson(transactions, currentUserId)
  }, [transactions, currentUserId])

  const balanceSummary = useMemo(() => {
    return getUserBalanceSummary(balances)
  }, [balances])

  const availablePeopleForFilters = useMemo(() => {
    const activeIds = getAvailableUsersIds(transactions)
    return involvedUsers.filter(u => activeIds.includes(u.id) && u.id !== currentUserId)
  }, [involvedUsers, transactions, currentUserId])

  const availableTagsForFilters = useMemo(() => {
    const activeIds = getAvailableTags(transactions)
    return availableTags.filter(t => activeIds.includes(t.id))
  }, [availableTags, transactions])


  if (authLoading || isLoading) {
    return (
      <FallbackState 
        type="loading" 
        title="Caricamento Home..." 
        message="Stiamo recuperando i tuoi saldi e movimenti." 
      />
    )
  }

  if (!currentUserId) {
    return <FallbackState type="unauthorized" />
  }

  if (error) {
    return (
      <FallbackState 
        type="error" 
        message={error} 
        action={{ label: 'Ricarica pagina', onClick: () => window.location.reload() }}
      />
    )
  }

  return (
    <div className="home-page">

      <BalanceSummarySection balanceSummary={balanceSummary} />

      <HomeFilters
        availableTags={availableTagsForFilters}
        availablePeople={availablePeopleForFilters}
        filters={filters}
        actions={actions}
      />

      {/* TransasactionList fa da intermediario tra Home e le Card, che devono mostrare tutti i nomi di utenti e tag.
      Questo lieve prop drilling va bene perchè così Home si sottoscrive al TransactionsContext una sola volta.
      Altrimenti se ogni TransactionCard dovesse chiamare useTransactions() per conto suo, avresti decine (o centinaia) di sottoscrizioni allo stesso contesto, il che è meno efficiente e può portare a re-render inaspettati.*/}
      {/* Gestione dell'Empty State! Se non ci sono transazioni mostriamo un invito all'azione */}
      {filteredTransactions.length === 0 ? (
        <FallbackState 
          type="empty" 
          title="Nessun movimento trovato"
          message="Non ci sono spese o pagamenti che corrispondono ai filtri attuali, oppure non hai ancora registrato nulla."
          action={{ label: '+ Nuova Spesa', onClick: () => navigate('/add') }}
        />
      ) : (
        <TransactionList
          transactions={filteredTransactions}
          users={involvedUsers}
          tags={availableTags}
          currentUserId={currentUserId}
          onEditTransaction={handleEditTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onAcceptTransaction={handleAcceptTransaction}
          onRejectTransaction={handleRejectTransaction}
        />
      )}
    </div>
  )
}