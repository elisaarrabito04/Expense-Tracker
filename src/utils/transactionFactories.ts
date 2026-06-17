import type {
  NewExpenseTransaction,
  NewSettlementTransaction,
  ExpenseTransaction,
  TransactionStatus,
  ParticipantStatus,
} from '../types/types'

type BuildNewExpenseInput = {
  amount: number
  description: string
  date: string
  createdByUserId: string
  payerId: string
  splitType: 'equal' | 'custom'
  shares: ExpenseTransaction['shares']
  tagId: string | null
  status: TransactionStatus
  participantStatuses: Record<string, ParticipantStatus>
  note?: string
}

export function buildNewExpense({
  amount,
  description,
  date,
  createdByUserId,
  payerId,
  splitType,
  shares,
  tagId,
  status,
  participantStatuses,
  note,
}: BuildNewExpenseInput): NewExpenseTransaction {
  return {
    type: 'expense',
    description: description.trim(),
    amount,
    date,
    createdByUserId,
    payerId,
    tagId,
    splitType,
    shares,
    status,
    participantStatuses,
    note: note?.trim() || null, // ricorda che firestore non supporta undefined
  }
}


//------------------------------
type BuildNewSettlementInput = {
  amount: number
  description: string
  date: string
  createdByUserId: string
  fromUserId: string
  toUserId: string
  status: TransactionStatus
  participantStatuses: Record<string, ParticipantStatus>
  note?: string
}

export function buildNewSettlement({
  amount,
  description,
  date,
  createdByUserId,
  fromUserId,
  toUserId,
  status,
  participantStatuses,
  note,
}: BuildNewSettlementInput): NewSettlementTransaction {
  return {
    type: 'settlement',
    description: description.trim(),
    amount,
    date,
    createdByUserId,
    fromUserId,
    toUserId,
    status,
    participantStatuses,
    note: note?.trim() || null,
  }
}