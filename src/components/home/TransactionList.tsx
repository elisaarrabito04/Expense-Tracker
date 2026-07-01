import type { AppUser, Transaction, Tag } from '../../types/types'
import './TransactionList.css'
import TransactionCard from './TransactionCard'

type TransactionListProps = {
  transactions: Transaction[] // riceve quelle già filtrate in home
  users: AppUser[] // per darlo alla card (per i nomi)
  tags: Tag[]  // per darlo alla card (per le labels)
  currentUserId: string
  onEditTransaction: (transactionId: string) => void
  onDeleteTransaction: (transactionId: string) => void
  onAcceptTransaction?: (transactionId: string) => void
  onRejectTransaction?: (transactionId: string) => void
}

export default function TransactionList({
  transactions,
  users,
  tags,
  currentUserId,
  onEditTransaction,
  onDeleteTransaction,
  onAcceptTransaction,
  onRejectTransaction,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <section className="transaction-list transaction-list--empty">
        <p className="transaction-list__empty-message">
          Nessun movimento trovato con i filtri attuali.
        </p>
      </section>
    )
  }

  return (
    <section className="transaction-list">
      {transactions.map((transaction) => (
        <TransactionCard
          key={transaction.id} // per virtual dom (Quando la lista si aggiorna la key permette a React di capire esattamente quale elemento è cambiato)
          tx={transaction}
          users={users} // per i nomi
          tags={tags} // per le labels
          currentUserId={currentUserId} // per mostrare (Tu) e la possibilità di modifica di quelle in revisione
          onEdit={onEditTransaction}
          onDelete={onDeleteTransaction}
          onAccept={onAcceptTransaction}
          onReject={onRejectTransaction}
        />
      ))}
    </section>
  )
}