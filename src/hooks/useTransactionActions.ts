import { useNavigate } from 'react-router-dom'
import {
  deleteTransaction,
  updateTransaction,
} from '../services/transactionsService'
import { useDialog } from '../context/DialogContext'
import type { Transaction, ParticipantStatus } from '../types/types'

export function useTransactionActions(
  transactions: Transaction[],
  currentUserId?: string
) {
  const navigate = useNavigate()
  const { showAlert, showConfirm } = useDialog()

  async function handleDeleteTransaction(transactionId: string) {
    try {
      const transactionToDelete =
        transactions.find((tx) => tx.id === transactionId) ?? null

      if (!transactionToDelete || !currentUserId) return

      if (!transactionToDelete.participantIds.includes(currentUserId)) {
        await showAlert('Errore', 'Puoi eliminare solo le transazioni in cui sei coinvolto.')
        return
      }

      if (transactionToDelete.status === 'pending' && transactionToDelete.createdByUserId !== currentUserId) {
        await showAlert('Errore', 'Solo il creatore può eliminare una transazione in attesa di accettazione.')
        return
      }

      if (transactionToDelete.status === 'revision' && transactionToDelete.createdByUserId !== currentUserId) {
        await showAlert('Errore', 'Solo il creatore può eliminare una transazione in revisione.')
        return
      }

      const confirmDelete = await showConfirm(
        'Elimina transazione',
        'Sei sicuro di voler eliminare questa transazione?'
      )

      if (!confirmDelete) return

      await deleteTransaction(transactionId, currentUserId)
    } catch (err) {
      await showAlert('Errore', 'Eliminazione non riuscita.')
    }
  }

  async function handleAcceptTransaction(transactionId: string) {
    try {
      const tx = transactions.find((t) => t.id === transactionId)
      if (!tx || !currentUserId) return

      const newStatuses = { ...tx.participantStatuses, [currentUserId]: 'accepted' as ParticipantStatus }
      const statusesArray = Object.values(newStatuses)
      const newStatus = statusesArray.includes('rejected') ? 'revision' : (statusesArray.includes('pending') ? 'pending' : 'active')

      await updateTransaction({
        ...tx,
        participantStatuses: newStatuses,
        status: newStatus,
      }, tx, currentUserId)
    } catch (err) {
      await showAlert('Errore', "Errore durante l'accettazione della transazione.")
    }
  }

  async function handleRejectTransaction(transactionId: string) {
    try {
      const tx = transactions.find((t) => t.id === transactionId)
      if (!tx || !currentUserId) return

      const confirmReject = await showConfirm('Rifiuta Transazione', 'Sei sicuro di voler rifiutare questa transazione?')
      if (!confirmReject) return

      const newStatuses = { ...tx.participantStatuses, [currentUserId]: 'rejected' as ParticipantStatus }

      await updateTransaction({
        ...tx,
        participantStatuses: newStatuses,
        status: 'revision',
      }, tx, currentUserId)
    } catch (err) {
      await showAlert('Errore', 'Errore durante il rifiuto della transazione.')
    }
  }

  async function handleEditTransaction(transactionId: string) {
    const transactionToEdit = transactions.find((tx) => tx.id === transactionId) ?? null

    if (!transactionToEdit || !currentUserId) {
      return
    }

    if (!transactionToEdit.participantIds.includes(currentUserId)) {
      await showAlert('Errore', 'Puoi modificare solo le transazioni in cui sei coinvolto.')
      return
    }

    if (transactionToEdit.status === 'pending' && transactionToEdit.createdByUserId !== currentUserId) {
      await showAlert('Errore', 'Solo il creatore può modificare una transazione in attesa di accettazione.')
      return
    }

    if (transactionToEdit.status === 'revision' && transactionToEdit.createdByUserId !== currentUserId) {
      await showAlert('Errore', 'Solo il creatore può modificare una transazione in revisione.')
      return
    }

    navigate(`/transactions/${transactionId}/edit`, {
      state: { initialTransaction: transactionToEdit }
    })
  }

  return {
    handleDeleteTransaction,
    handleAcceptTransaction,
    handleRejectTransaction,
    handleEditTransaction,
  }
}
