// src/types/index.ts

// -----------------------------------------------------------------------------
// UTENTI
// -----------------------------------------------------------------------------

export type AppUser = {
  // Coincide sempre con il uid di Firebase Auth.
  id: string
  displayName: string
  email: string
  displayNameLowercase: string
  nickname?: string; 
  createdAt?: string
  updatedAt?: string
}

// -----------------------------------------------------------------------------
// TAG
// -----------------------------------------------------------------------------

export type Tag = {
  id: string // normalizzato
  label: string // di creazione
}

// -----------------------------------------------------------------------------
// TRANSAZIONI - PARTI COMUNI
// -----------------------------------------------------------------------------

export type TransactionEditLog = {
  // Manteniamo la data in formato ISO (es. 2024-05-12T14:30:00.000Z)
  // generata lato client al momento del salvataggio.
  editedAt: string
  editedByUserId: string
  // Array testuale per indicare in modo leggibile cosa è stato modificato
  // es: ['Importo', 'Data', 'Quote']
  changedFields: string[]
}

export type TransactionType = 'expense' | 'settlement'

export type TransactionStatus = 'active' | 'pending' | 'revision' | 'deleted'
export type ParticipantStatus = 'accepted' | 'pending' | 'rejected'

export type BaseTransaction = {
  // Presente nelle transazioni lette da Firestore.
  // In create lato UI puoi anche costruire un oggetto senza id,
  // ma lato dominio conviene considerarlo disponibile dopo il salvataggio.
  id: string

  type: TransactionType
  description: string
  amount: number

  // Manteniamo una data "business" semplice in formato YYYY-MM-DD
  // perché è pratica per form e filtri.
  date: string

  createdByUserId: string

  // Campo fondamentale per il feed personale:
  // la Home legge le transazioni dell'utente con array-contains su questo array.
  participantIds: string[]

  // Gestione stato di accettazione
  status: TransactionStatus
  participantStatuses: Record<string, ParticipantStatus>

  note?: string | null // firestore non supporta undefined

  // Storico delle modifiche apportate
  editLogs?: TransactionEditLog[]

  // Timestamp applicativi serializzati.
  // In Firestore possono nascere come Timestamp, ma lato UI ti conviene
  // mapparli in stringa o tenerli opzionali finché non standardizzi il mapping.
  createdAt?: string
  updatedAt?: string

  deletedAt?: string
  deletedByUserId?: string
}

// -----------------------------------------------------------------------------
// EXPENSE
// -----------------------------------------------------------------------------

export type ExpenseSplitType = 'equal' | 'custom' | 'percentage'

export type ExpenseShare = {
  userId: string
  amount: number
}

export type ExpenseTransaction = BaseTransaction & {
  type: 'expense'
  payerId: string
  splitType: ExpenseSplitType
  shares: ExpenseShare[]
  tagId: string | null
}

// -----------------------------------------------------------------------------
// SETTLEMENT
// -----------------------------------------------------------------------------

export type SettlementTransaction = BaseTransaction & {
  type: 'settlement'
  fromUserId: string
  toUserId: string
}

// -----------------------------------------------------------------------------
// UNION
// -----------------------------------------------------------------------------

export type Transaction = ExpenseTransaction | SettlementTransaction

// ----------------------------
// DATI DERIVATI PER LA HOME / PROFILO
// ----------------------------

// riepilogo sintetico dei saldi dell'utente loggato
export type UserBalanceSummary = {
  totalOwedByUser: number   // quanto deve in totale
  totalOwedToUser: number   // quanto gli devono in totale
  netBalance: number        // saldo netto = crediti - debiti
}

// -----------------------------------------------------------------------------
// FILTRI HOME
// -----------------------------------------------------------------------------

export type MovementFilter = 'all' | 'expense' | 'settlement'
export type StatusFilter = 'active' | 'pending' | 'revision' | 'deleted'

// per HomeFilters e il custom hook dei filtri
export type FiltersState = {
  movement: MovementFilter
  selectedTag: string
  selectedPersonIds: string[]
  fromDate: string
  toDate: string
  status: StatusFilter
  personalOnly: boolean
}

// per HomeFilters e il custom hook dei filtri
export type FiltersActions = {
  onMovementChange: (value: MovementFilter) => void
  onTagChange: (value: string) => void
  onTogglePerson: (personId: string) => void
  onTogglePersonalOnly: () => void
  onClearPeople: () => void
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  onStatusChange: (value: StatusFilter) => void
  onClearAll: () => void
}

// -----------------------------------------------------------------------------
// UTILI PER FORM / CREATE
// -----------------------------------------------------------------------------

// Molto utile quando crei nuove transazioni prima del salvataggio.
export type NewExpenseTransaction = Omit<
  ExpenseTransaction,
  'id' | 'participantIds' | 'createdAt' | 'updatedAt'
>

export type NewSettlementTransaction = Omit<
  SettlementTransaction,
  'id' | 'participantIds' | 'createdAt' | 'updatedAt'
>