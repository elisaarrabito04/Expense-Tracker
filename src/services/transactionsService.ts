import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  onSnapshot,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type {
  ExpenseTransaction,
  SettlementTransaction,
  Transaction,
  NewExpenseTransaction,
  NewSettlementTransaction,
  AppNotification,
  NotificationType,
} from '../types/types'

// -----------------------------------------------------------------------------
// COSTANTI
// -----------------------------------------------------------------------------

// Collezione Firestore unica che contiene sia expense sia settlement.
// Questa scelta è coerente con l'architettura del progetto, che è centrata
// sulle transazioni e non su gruppi statici.
const TRANSACTIONS_COLLECTION = 'transactions'

// -----------------------------------------------------------------------------
// HELPERS INTERNI GENERICI
// -----------------------------------------------------------------------------

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids))
}

// Utility per controllare che una stringa non sia vuota dopo trim.
// Utile per evitare salvataggi con campi formalmente presenti ma inutilizzabili.
function assertNonEmptyString(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`Il campo "${fieldName}" è obbligatorio.`)
  }
}

// Utility per controllare che un importo sia valido.
function assertPositiveAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("L'importo deve essere un numero maggiore di 0.")
  }
}


// -----------------------------------------------------------------------------
// HELPERS DOMINIO
// -----------------------------------------------------------------------------

// Ricostruisce l'elenco delle persone coinvolte in una spesa.
// Questo campo è fondamentale perché verrà usato per il feed personale della Home
// tramite query Firestore con array-contains sull'id dell'utente loggato.
export function buildExpenseParticipantIds(
  createdByUserId: string,
  payerId: string,
  shares: ExpenseTransaction['shares']
): string[] {
  return uniqueIds([
    createdByUserId,
    payerId,
    ...shares.map((share) => share.userId),
  ])
}

// Ricostruisce l'elenco delle persone coinvolte in un rimborso.
export function buildSettlementParticipantIds(
  createdByUserId: string,
  fromUserId: string,
  toUserId: string
): string[] {
  return uniqueIds([createdByUserId, fromUserId, toUserId])
}

// HELPER: Crea una notifica all'interno di un batch
function addNotificationToBatch(
  batch: any, // Usiamo un tipo generico per il batch per flessibilità, ma è WriteBatch
  targetUserId: string,
  type: NotificationType,
  txId: string,
  txTitle: string,
  actorId: string
) {
  const notifRef = doc(collection(db, 'users', targetUserId, 'notifications'))
  const notification: AppNotification = {
    id: notifRef.id,
    type,
    txId,
    txTitle,
    actorId,
    read: false,
    createdAt: new Date().toISOString(), // Usiamo ISO string locale per uniformità offline/online
  }
  batch.set(notifRef, notification)
}



// Validazione minima per spese.
// Qui non faccio una validazione “perfetta” di tutto il dominio,
// ma blocco i casi evidentemente incoerenti.
function validateExpense(transaction: ExpenseTransaction): void {
  assertNonEmptyString(transaction.createdByUserId, 'createdByUserId')
  assertNonEmptyString(transaction.payerId, 'payerId')
  assertNonEmptyString(transaction.description, 'description')
  assertNonEmptyString(transaction.date, 'date')
  assertPositiveAmount(transaction.amount)

  if (!transaction.shares.length) {
    throw new Error('Una spesa deve avere almeno una quota.')
  }

  const invalidShares = transaction.shares.some(
    (share) => !share.userId.trim() || !Number.isFinite(share.amount) || share.amount < 0
  )

  if (invalidShares) {
    throw new Error('Le quote della spesa non sono valide.')
  }
}

// Validazione minima per rimborsi.
function validateSettlement(transaction: SettlementTransaction): void {
  assertNonEmptyString(transaction.createdByUserId, 'createdByUserId')
  assertNonEmptyString(transaction.fromUserId, 'fromUserId')
  assertNonEmptyString(transaction.toUserId, 'toUserId')
  assertNonEmptyString(transaction.description, 'description')
  assertNonEmptyString(transaction.date, 'date')
  assertPositiveAmount(transaction.amount)

  if (transaction.fromUserId === transaction.toUserId) {
    throw new Error('Nel rimborso mittente e destinatario devono essere diversi.')
  }
}

// Converte un documento Firestore nel tuo tipo dominio Transaction.
// Assumo che i documenti salvati abbiano già una shape compatibile con i tipi TS.
function mapDocToTransaction(
  snapshot: QueryDocumentSnapshot<DocumentData>
): Transaction {
  const data = snapshot.data()

  // Retrocompatibilità: se manca lo stato, assumiamo sia una vecchia transazione già 'active'
  const status = data.status || 'active'
  let participantStatuses = data.participantStatuses
  if (!participantStatuses) {
    participantStatuses = {}
    const participantIds = data.participantIds || []
    participantIds.forEach((id: string) => {
      participantStatuses[id] = 'accepted'
    })
  }

  return {
    id: snapshot.id, // inserisco come campo id quello assegnato da firestore alla creazione
    ...data,
    status,
    participantStatuses,
  } as Transaction
}

// Variante per getDoc singolo.
function mapDataToTransaction(id: string, data: DocumentData): Transaction {
  // Retrocompatibilità
  const status = data.status || 'active'
  let participantStatuses = data.participantStatuses
  if (!participantStatuses) {
    participantStatuses = {}
    const participantIds = data.participantIds || []
    participantIds.forEach((pid: string) => {
      participantStatuses[pid] = 'accepted'
    })
  }

  return {
    id,
    ...data,
    status,
    participantStatuses,
  } as Transaction
}




// -----------------------------------------------------------------------------
// LETTURA
// -----------------------------------------------------------------------------

// USATA PER LA SOTTOSCRIZIONE AL LISTENER
// Recupera tutte le transazioni in cui l'utente compare tra i participantIds.
export async function getTransactionsForUser(userId: string): Promise<Transaction[]> {
  assertNonEmptyString(userId, 'userId')

  const q = query(
    collection(db, TRANSACTIONS_COLLECTION),
    where('participantIds', 'array-contains', userId),
    orderBy('date', 'desc')
  )

  const snapshot = await getDocs(q)

  // converto ogni documento nel tipo transaction che mi aspetto
  // cioè aggiungendo il campo id creato da firestore inserendolo come campo id della transazione per poterlo usare
  // (per esempio serve per la list per avere un campo univoco per renderizzare, oppure per la URL per una modifica, anche se non per forza..)
  return snapshot.docs.map(mapDocToTransaction)
}

// API per ascoltare le transazioni in tempo reale.
// Perfetta per sfruttare la Latency Compensation di Firestore (Optimistic UI)
// anzichè usare una normale getTransactionForUser in Home.tsx
export function subscribeToTransactionsForUser(
  userId: string,
  onData: (transactions: Transaction[]) => void, // per aggiornare gli STATES in Home
  onError?: (error: Error) => void
): () => void {
  assertNonEmptyString(userId, 'userId')

  const q = query(
    collection(db, TRANSACTIONS_COLLECTION),
    where('participantIds', 'array-contains', userId),
    orderBy('date', 'desc')
  )

  // onSnapshot restituisce una funzione "unsubscribe" per chiudere il listener
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const transactions = snapshot.docs.map(mapDocToTransaction)
      onData(transactions) // chiamo la funzione passata in input usare i dati una volta ottenuti
    },
    (error) => {
      console.error('Errore Firestore originale:', error)
      if (onError) onError(error)
    }
  )

  return unsubscribe
}

// Recupera una transazione per id.
// Utile per la pagina di dettaglio/edit.
export async function getTransactionById(
  transactionId: string
): Promise<Transaction | null> {
  assertNonEmptyString(transactionId, 'transactionId')

  const snapshot = await getDoc(doc(db, TRANSACTIONS_COLLECTION, transactionId))

  if (!snapshot.exists()) {
    return null
  }

  return mapDataToTransaction(snapshot.id, snapshot.data())
}

// API per ascoltare eventuali eliminazioni concorrenti di una transazione.
export function subscribeToTransactionDeletion(
  transactionId: string,
  onDeleted: () => void
): () => void {
  assertNonEmptyString(transactionId, 'transactionId')

  const unsubscribe = onSnapshot(
    doc(db, TRANSACTIONS_COLLECTION, transactionId),
    (snapshot) => {
      // Se il documento non esiste (o ha smesso di esistere), scatta la callback
      if (!snapshot.exists()) {
        onDeleted()
      }
    }
  )

  return unsubscribe
}

// Restituisce gli id delle persone con cui l'utente ha interagito.
// È molto utile per popolare filtri e suggerimenti partecipanti.
export async function getKnownParticipantIdsForUser(
  userId: string
): Promise<string[]> {
  const userTransactions = await getTransactionsForUser(userId)

  const knownIds = userTransactions
    .filter((tx) => tx.status === 'active')
    .flatMap((transaction) =>
      transaction.participantIds.filter((participantId) => participantId !== userId)
    )

  return uniqueIds(knownIds)
}

// -----------------------------------------------------------------------------
// SCRITTURA - CREATE
// -----------------------------------------------------------------------------




// Crea una expense su Firestore.
// Ricostruisco participantIds lato service per evitare di fidarmi ciecamente della UI.
export async function createExpense(
  newTransactionData: NewExpenseTransaction
): Promise<void> {
  // 1. Validazione Dati: Controlliamo che l'importo sia > 0, che le date ci siano, ecc.
  // La validazione non controlla id, participantIds, createdAt, updatedAt,
  // quindi possiamo fare un cast temporaneo per riutilizzare la funzione.
  validateExpense(newTransactionData as ExpenseTransaction)

  // 2. Calcolo dei Partecipanti (Cruciale per le query future!):
  // Mettiamo in un unico array senza duplicati: il creatore, chi ha pagato e chiunque abbia una quota.
  // Questo array servirà alla Home per dire "dammi tutte le transazioni dove il mio ID è qui dentro".
  const participantIds = buildExpenseParticipantIds(
    newTransactionData.createdByUserId,
    newTransactionData.payerId,
    newTransactionData.shares
  )

  // 3. Preparazione del Payload per Firestore:
  // Aggiungiamo i participantIds calcolati e i timestamp generati dal server.
  // Usare serverTimestamp() è importante perché garantisce uniformità oraria globale.
  const payload = {
    ...newTransactionData,
    tagId: newTransactionData.tagId ?? null,
    participantIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  // 4. Batch Write: Transazione + Notifiche
  const batch = writeBatch(db)
  const txRef = doc(collection(db, TRANSACTIONS_COLLECTION))

  batch.set(txRef, payload)

  // Invio notifica 'added' a tutti tranne al creatore
  participantIds.forEach((userId) => {
    if (userId !== newTransactionData.createdByUserId) {
      addNotificationToBatch(batch, userId, 'added', txRef.id, newTransactionData.description, newTransactionData.createdByUserId)
    }
  })

  await batch.commit()
}

// Crea un settlement su Firestore.
export async function createSettlement(
  newTransactionData: NewSettlementTransaction
): Promise<void> {
  // 1. Validazione: controlla importo e che mittente/destinatario siano diversi
  validateSettlement(newTransactionData as SettlementTransaction)

  // 2. Calcolo dei Partecipanti:
  // Nel caso del pagamento sono solo il creatore, chi paga e chi riceve.
  const participantIds = buildSettlementParticipantIds(
    newTransactionData.createdByUserId,
    newTransactionData.fromUserId,
    newTransactionData.toUserId
  )

  // 3. Preparazione Payload
  const payload = {
    ...newTransactionData,
    participantIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const batch = writeBatch(db)
  const txRef = doc(collection(db, TRANSACTIONS_COLLECTION))

  batch.set(txRef, payload)

  // Invio notifica 'added' a tutti tranne al creatore
  participantIds.forEach((userId) => {
    if (userId !== newTransactionData.createdByUserId) {
      addNotificationToBatch(batch, userId, 'added', txRef.id, newTransactionData.description, newTransactionData.createdByUserId)
    }
  })

  await batch.commit()
}

// -----------------------------------------------------------------------------
// SCRITTURA - UPDATE
// -----------------------------------------------------------------------------

// Aggiorna una expense esistente.
// Anche qui ricostruisco participantIds per mantenere coerenza nel feed personale.
export async function updateExpense(
  updatedTransaction: ExpenseTransaction,
  oldTx: ExpenseTransaction, // <-- OTTIMIZZAZIONE: Passiamo la transazione originale dal frontend per evitare 1 lettura fatturata
  updaterId: string
): Promise<void> {
  assertNonEmptyString(updatedTransaction.id, 'id')
  validateExpense(updatedTransaction)

  const participantIds = buildExpenseParticipantIds(
    updatedTransaction.createdByUserId,
    updatedTransaction.payerId,
    updatedTransaction.shares
  )

  // RECUPERO LA VECCHIA TRANSAZIONE (OTTIMIZZATO)
  // Non facciamo più: const oldTx = await getTransactionById(updatedTransaction.id)
  // perché abbiamo già oldTx passato come parametro dal frontend! Risparmiamo costi di lettura Firestore.
  if (!oldTx) throw new Error("Transazione non trovata")

  const oldParticipantIds = new Set(oldTx.participantIds)
  const newParticipantIds = new Set(participantIds)

  const { id, ...rest } = updatedTransaction

  const batch = writeBatch(db)
  const txRef = doc(db, TRANSACTIONS_COLLECTION, id)

  batch.update(txRef, {
    ...rest,
    tagId: updatedTransaction.tagId ?? null,
    participantIds,
    updatedAt: serverTimestamp(),
  })

  // CALCOLO NOTIFICHE
  const isStatusChangeOnly = updaterId !== updatedTransaction.createdByUserId &&
    oldTx.participantStatuses[updaterId] !== updatedTransaction.participantStatuses[updaterId];

  participantIds.forEach((userId) => {
    if (userId === updaterId) return // Non auto-notificarsi!

    if (isStatusChangeOnly) {
      // È solo un accetta/rifiuta. Avvisiamo SOLO il creatore e ignoriamo gli altri.
      if (userId === updatedTransaction.createdByUserId) {
        const newStatus = updatedTransaction.participantStatuses[updaterId]
        if (newStatus === 'accepted' || newStatus === 'rejected') {
          addNotificationToBatch(batch, userId, newStatus, id, updatedTransaction.description, updaterId)
        }
      }
      return
    }

    // Se è una vera modifica ai dati della transazione
    if (!oldParticipantIds.has(userId)) {
      addNotificationToBatch(batch, userId, 'added', id, updatedTransaction.description, updaterId)
    } else {
      addNotificationToBatch(batch, userId, 'modified', id, updatedTransaction.description, updaterId)
    }
  })
  oldTx.participantIds.forEach((userId) => {
    if (userId !== updaterId && !newParticipantIds.has(userId)) {
      addNotificationToBatch(batch, userId, 'removed', id, oldTx.description, updaterId)
    }
  })

  await batch.commit()
}

// Aggiorna un settlement esistente.
export async function updateSettlement(
  updatedTransaction: SettlementTransaction,
  oldTx: SettlementTransaction, // <-- OTTIMIZZAZIONE
  updaterId: string
): Promise<void> {
  assertNonEmptyString(updatedTransaction.id, 'id')
  validateSettlement(updatedTransaction)

  const participantIds = buildSettlementParticipantIds(
    updatedTransaction.createdByUserId,
    updatedTransaction.fromUserId,
    updatedTransaction.toUserId
  )

  // Non facciamo più: const oldTx = await getTransactionById(updatedTransaction.id)
  // Usiamo oldTx passato come prop per risparmiare query
  if (!oldTx) throw new Error("Transazione non trovata")

  const { id, ...rest } = updatedTransaction

  const batch = writeBatch(db)
  const txRef = doc(db, TRANSACTIONS_COLLECTION, id)

  batch.update(txRef, {
    ...rest,
    participantIds,
    updatedAt: serverTimestamp(),
  })

  const isStatusChangeOnly = updaterId !== updatedTransaction.createdByUserId &&
    oldTx.participantStatuses[updaterId] !== updatedTransaction.participantStatuses[updaterId];

  participantIds.forEach((userId) => {
    if (userId === updaterId) return // Non auto-notificarsi!

    if (isStatusChangeOnly) {
      if (userId === updatedTransaction.createdByUserId) {
        const newStatus = updatedTransaction.participantStatuses[updaterId]
        if (newStatus === 'accepted' || newStatus === 'rejected') {
          addNotificationToBatch(batch, userId, newStatus, id, updatedTransaction.description, updaterId)
        }
      }
      return
    }

    addNotificationToBatch(batch, userId, 'modified', id, updatedTransaction.description, updaterId)
  })

  await batch.commit()
}

// fa dispatch del tipo di update
export async function updateTransaction(transaction: Transaction, oldTx: Transaction, updaterId: string): Promise<void> {
  if (transaction.type === 'expense') {
    await updateExpense(transaction, oldTx as ExpenseTransaction, updaterId)
    return
  }

  await updateSettlement(transaction, oldTx as SettlementTransaction, updaterId)
}

// -----------------------------------------------------------------------------
// SCRITTURA - DELETE
// -----------------------------------------------------------------------------

// Elimina una transazione per id.
// Passata ad approccio "Soft Delete": aggiorniamo lo status a 'deleted'.
export async function deleteTransaction(transactionId: string, currentUserId: string): Promise<void> {
  assertNonEmptyString(transactionId, 'transactionId')
  assertNonEmptyString(currentUserId, 'currentUserId')

  const oldTx = await getTransactionById(transactionId)
  if (!oldTx) return

  const batch = writeBatch(db)
  const txRef = doc(db, TRANSACTIONS_COLLECTION, transactionId)

  batch.update(txRef, {
    status: 'deleted',
    deletedAt: serverTimestamp(),
    deletedByUserId: currentUserId,
  })

  oldTx.participantIds.forEach((userId) => {
    if (userId !== currentUserId) {
      addNotificationToBatch(batch, userId, 'deleted', transactionId, oldTx.description, currentUserId)
    }
  })

  await batch.commit()
}