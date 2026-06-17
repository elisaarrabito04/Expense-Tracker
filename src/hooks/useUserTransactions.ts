import { useEffect, useState } from 'react'
import { getTransactionsForUser } from '../services/transactionsService'
import type { Transaction } from '../types/types'

type UseUserTransactionsResult = {
  transactions: Transaction[]
  isLoading: boolean
  errorMessage: string
  reload: () => Promise<void> // comodo così i componenti che usando questo hook non devono preoccuparsi di importare getTransactionsForUser
}

export function useUserTransactions(userId: string | undefined): UseUserTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // da usare nello useeffect
  async function loadTransactions() {
    if (!userId) {
      setTransactions([])
      return
    }
    setIsLoading(true)
    setErrorMessage('') 
    try {
      const data = await getTransactionsForUser(userId)
      setTransactions(data)
    } catch {
      setErrorMessage('Errore nel caricamento delle transazioni.')
    } finally {
      setIsLoading(false)
    }
  }

  // carico le transazioni al montaggio e quando cambia userId passato in input
  useEffect(() => {
    void loadTransactions()
  }, [userId]) 

  return {
    transactions,
    isLoading,
    errorMessage,
    reload: loadTransactions, //serve a ricaricare dopo aggiunta/modifica (per esempio può servire a Home)
  }
}