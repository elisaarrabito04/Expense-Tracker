import { useState, useMemo } from 'react'
import type {
  Transaction,
  MovementFilter,
  StatusFilter,
  FiltersState,
  FiltersActions,
} from '../types/types'
import { filterTransactions } from '../utils/transactions'

export function useTransactionFilters(
  transactions: Transaction[],
  currentUserId?: string
) {

  // stati dei filtri
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([])
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [personalOnly, setPersonalOnly] = useState<boolean>(false)

  const filters: FiltersState = {
    movement: movementFilter,
    selectedTag,
    selectedPersonIds,
    fromDate,
    toDate,
    status: statusFilter,
    personalOnly,
  }

  const actions: FiltersActions = {
    onMovementChange: setMovementFilter,
    onTagChange: setSelectedTag,
    onTogglePerson: (personId: string) => {
      setPersonalOnly(false)
      setSelectedPersonIds((prev) =>
        prev.includes(personId)
          ? prev.filter((id) => id !== personId)
          : [...prev, personId]
      )
    },
    onTogglePersonalOnly: () => {
      setPersonalOnly((prev) => {
        const next = !prev
        if (next) setSelectedPersonIds([])
        return next
      })
    },
    onClearPeople: () => setSelectedPersonIds([]),
    onFromDateChange: setFromDate,
    onToDateChange: setToDate,
    onStatusChange: setStatusFilter,
    onClearAll: () => { // attualmente inusato
      setMovementFilter('all')
      setSelectedTag('all')
      setSelectedPersonIds([])
      setFromDate('')
      setToDate('')
      setStatusFilter('active')
      setPersonalOnly(false)
    },
  }

  const filteredTransactions = useMemo(() => {
    return filterTransactions(
      transactions,
      {
        movement: movementFilter,
        tag: selectedTag,
        personIds: selectedPersonIds,
        fromDate,
        toDate,
        status: statusFilter,
        personalOnly,
      },
      currentUserId
    )

    // dipendenze con le singole variabili di stato anzichè direttamente l'oggetto filters
    // perchè esso viene creato a ogni render, quindi causerebbe un ricalcolo continuo intuile
  }, [
    transactions,
    movementFilter,
    selectedTag,
    selectedPersonIds,
    fromDate,
    toDate,
    statusFilter,
    currentUserId,
    personalOnly,
  ])

  return {
    filters,
    actions,
    filteredTransactions
  }
}