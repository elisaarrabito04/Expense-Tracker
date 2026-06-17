import { useState, useEffect, useMemo } from 'react'
import type { AppUser, Tag, Transaction, ExpenseTransaction } from '../../types/types'
import TagSelector from './TagSelector'
import ParticipantSelector from './ParticipantSelector'
import SingleUserSelector from './SingleUserSelector'
import './Selector.css'
import './TransactionForm.css'
import SplitManager from './SplitManager'
import { createExpense, updateExpense } from '../../services/transactionsService'
import { buildNewExpense } from '../../utils/transactionFactories'
import { getSuggestedClusters } from '../../utils/transactions'

// Helper per gestire in modo pulito il salvataggio ottimistico
// senza dover ripetere la logica if/else in ogni punto di salvataggio.
async function executeOptimisticWrite(writePromise: Promise<void>) {
  if (!navigator.onLine) {
    writePromise.catch(err => console.error("Errore sync in background offline", err))
    return Promise.resolve() // Risolve istantaneamente per sbloccare la UI
  }
  return writePromise // Attende normalmente la risposta del server
}

type ExpenseFormProps = {
  currentUser: AppUser
  userTransactions: Transaction[] // per il calcolo dei cluster
  knownTags: Tag[]
  knownParticipants: AppUser[] // per poter già mostrare i nomi
  onSuccess: () => void
  initialTransaction?: ExpenseTransaction // PER IL CLICK SU MODIFICA (per sapere ID, importi, log e tipo di divisione)
  initialParticipants?: AppUser[] // per mostrare il nome
  initialTag?: Tag | null // per mostrare il nome
  initialPayer?: AppUser | null // per mostrare il nome
  isSyncing?: boolean // se il padre EditTransaction sta aspettando ancora si sincronizzare la cache con firestore (per evitare race condition, salvataggi su dati vecchi ecc)
  onCancel?: () => void
}

export default function ExpenseForm({
  currentUser,
  userTransactions,
  knownTags,
  knownParticipants,
  onSuccess,
  initialTransaction,
  initialParticipants,
  initialTag,
  initialPayer,
  isSyncing,
  onCancel,
}: ExpenseFormProps) {
  // --- INIZIALIZZAZIONE DEGLI STATI ---
  // Utilizziamo un operatore ternario (o il coalescing ??) per riempire i campi con i
  // valori di initialTransaction (se stiamo modificando) oppure con stringhe vuote/default (se stiamo creando).
  const [amount, setAmount] = useState<string>(initialTransaction ? initialTransaction.amount.toString() : '')
  const [title, setTitle] = useState<string>(initialTransaction ? initialTransaction.description : '')
  const [date, setDate] = useState<string>(initialTransaction ? initialTransaction.date : new Date().toISOString().split('T')[0])
  const [note, setNote] = useState<string>(initialTransaction?.note || '')

  const [selectedTag, setSelectedTag] = useState<Tag | null>(initialTag || null)
  
  const [selectedPayer, setSelectedPayer] = useState<AppUser | null>(() => {
    if (initialPayer) return initialPayer
    return currentUser // Default al creatore della spesa
  })

  // Inizializzazione "lazy" (con callback) per evitare computazioni a ogni render:
  const [selectedParticipants, setSelectedParticipants] = useState<AppUser[]>(() => {
    // Se riceviamo i partecipanti da EditTransaction, li impostiamo di default
    if (initialParticipants && initialParticipants.length > 0) return initialParticipants
    // Altrimenti (nuova spesa) inseriamo di default l'utente corrente
    return currentUser ? [currentUser] : []
  })

  // 1. Estraiamo gli ID dei partecipanti selezionati per passarli all'algoritmo di clustering
  const selectedParticipantIds = useMemo(
    () => selectedParticipants.map((p) => p.id),
    [selectedParticipants]
  )

  // creiamo una "virtual view" (derived state)
  // dipende direttamente dall'elenco di transazioni aggiornato
  const suggestedClusters = useMemo(() => {
    return getSuggestedClusters(userTransactions, currentUser.id, selectedParticipantIds)
  }, [userTransactions, currentUser.id, selectedParticipantIds])

  // 2. Funzione per aggiungere un intero cluster di partecipanti
  const handleAddCluster = (clusterParticipantIds: string[]) => {
    const usersToAdd = clusterParticipantIds
      .map((id) => knownParticipants.find((u) => u.id === id))
      .filter((u): u is AppUser => u !== undefined)

    setSelectedParticipants((prev) => {
      const existingIds = new Set(prev.map((p) => p.id))
      // Aggiungiamo solo le persone che non sono già state selezionate
      const newUsers = usersToAdd.filter((u) => !existingIds.has(u.id))
      return [...prev, ...newUsers]
    })
  }

  // --- SINCRONIZZAZIONE BACKGROUND ---
  // Ascoltiamo l'arrivo dei dati asincroni scaricati dal componente padre e popoliamo la UI
  useEffect(() => {
    if (initialTag) setSelectedTag(initialTag)
    if (initialPayer) setSelectedPayer(initialPayer)
    if (initialParticipants && initialParticipants.length > 0) setSelectedParticipants(initialParticipants)
  }, [initialTag, initialPayer, initialParticipants])

  const [splitType, setSplitType] = useState<'equal' | 'custom'>(initialTransaction && initialTransaction.splitType === 'custom' ? 'custom' : 'equal')
  const [customShares, setCustomShares] = useState<Record<string, string>>(() => {
    const shares: Record<string, string> = {}
    // Se stiamo modificando una spesa di tipo "custom", ricostruiamo il dizionario 
    // delle quote personalizzate estrapolando i valori dall'array `shares` del db
    if (initialTransaction && initialTransaction.splitType === 'custom') {
      initialTransaction.shares.forEach(s => {
        shares[s.userId] = s.amount.toString()
      })
    }
    return shares
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Valori numerici calcolati in tempo reale
  const numericAmount = parseFloat(amount) || 0
  const participantCount = selectedParticipants.length
  const equalShare = participantCount > 0 ? numericAmount / participantCount : 0

  // Somma delle quote custom inserite
  const totalCustomShares = Object.values(customShares).reduce((acc, val) => acc + (parseFloat(val) || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (selectedParticipants.length === 0) {
      setError('Aggiungi almeno un partecipante alla spesa.')
      return
    }

    if (!selectedPayer) {
      setError('Devi selezionare chi ha pagato la spesa.')
      return
    }

    // Validazione somme se lo split è personalizzato
    if (splitType === 'custom') {
      // Usiamo una tolleranza minima (0.01) per evitare problemi legati all'arrotondamento dei float javascript
      if (Math.abs(totalCustomShares - numericAmount) > 0.01) {
        setError(`La somma delle quote personalizzate (${totalCustomShares.toFixed(2)}€) non coincide con l'importo totale della spesa (${numericAmount.toFixed(2)}€).`)
        return
      }
    }

    setIsSubmitting(true)

    // --- GESTIONE ACCETTAZIONE PREVENTIVA ---
    const participantStatuses: Record<string, 'accepted' | 'pending' | 'rejected'> = {}
    
    selectedParticipants.forEach(user => {
      if (user.id === currentUser.id) {
        participantStatuses[user.id] = 'accepted' // Il creatore/utente corrente accetta sempre
      } else if (knownParticipants.some(ku => ku.id === user.id)) {
        participantStatuses[user.id] = 'accepted' // Gli amici già noti vengono auto-accettati per evitare attrito
      } else {
        // È un utente "nuovo" (non ancora noto)
        if (initialTransaction?.participantStatuses && initialTransaction.participantStatuses[user.id] === 'accepted') {
          // Se aveva già accettato la versione precedente (e non era lui ad aver rifiutato), manteniamo la sua accettazione
          participantStatuses[user.id] = 'accepted'
        } else {
          // Se era in 'pending', rimane in 'pending'.
          // Se aveva 'rejected', il creatore ha appena corretto l'errore: l'utente torna in 'pending' per valutare la correzione.
          participantStatuses[user.id] = 'pending'
        }
      }
    })

    const statusesArray = Object.values(participantStatuses)
    const txStatus = statusesArray.includes('rejected') ? 'revision' : (statusesArray.includes('pending') ? 'pending' : 'active')

    try {
      // Costruiamo l'array delle quote (shares) per il database
      const shares = selectedParticipants.map(user => ({
        userId: user.id,
        amount: splitType === 'equal' ? equalShare : (parseFloat(customShares[user.id]) || 0)
      }))

      if (initialTransaction) {
        // --- RAMO UPDATE ---
        
        // 1. Calcoliamo quali campi sono stati effettivamente modificati
        const changedFields: string[] = []
        if (initialTransaction.amount !== numericAmount) changedFields.push('Importo')
        if (initialTransaction.description !== title) changedFields.push('Titolo')
        if (initialTransaction.date !== date) changedFields.push('Data')
        if ((initialTransaction.note || '') !== note) changedFields.push('Note')
        if (initialTransaction.payerId !== selectedPayer.id) changedFields.push('Pagante')
        if (initialTransaction.tagId !== (selectedTag ? selectedTag.id : null)) changedFields.push('Tag')
        if (initialTransaction.splitType !== splitType) changedFields.push('Tipo divisione')
        
        // Confronto base delle quote
        const oldShares = initialTransaction.shares
        const sharesChanged = oldShares.length !== shares.length || oldShares.some(old => {
           const newS = shares.find(s => s.userId === old.userId)
           return !newS || newS.amount !== old.amount
        })
        if (sharesChanged) changedFields.push('Quote/Partecipanti')

        // 2. Creiamo il log (se ci sono modifiche testuali rilevanti)
        let updatedLogs = initialTransaction.editLogs || []
        if (changedFields.length > 0) {
          updatedLogs = [...updatedLogs, {
            editedAt: new Date().toISOString(),
            editedByUserId: currentUser.id,
            changedFields
          }]
        }

        // Uniamo (spread operator) i dati della transazione originale con quelli nuovi prelevati dallo stato
        const updatedPayload: ExpenseTransaction = {
          ...initialTransaction,
          description: title,
          amount: numericAmount,
          date,
          note,
          payerId: selectedPayer.id,
          splitType,
          shares,
          tagId: selectedTag ? selectedTag.id : null,
          status: txStatus,
          participantStatuses,
          editLogs: updatedLogs,
        }
        // Eseguiamo il salvataggio sfruttando l'helper
        await executeOptimisticWrite(updateExpense(updatedPayload))
      } else {
        // --- RAMO CREATE ---
        const payload = buildNewExpense({
          description: title,
          amount: numericAmount,
          date,
          note,
          payerId: selectedPayer.id,
          splitType,
          shares,
          tagId: selectedTag ? selectedTag.id : null,
          createdByUserId: currentUser.id,
          status: txStatus,
          participantStatuses,
        })
        
        // Eseguiamo il salvataggio sfruttando l'helper
        await executeOptimisticWrite(createExpense(payload))
      }
      onSuccess()
    } catch (err) {
      console.error('Errore durante la creazione della spesa:', err)
      setError('Si è verificato un errore durante il salvataggio. Riprova.')
      setIsSubmitting(false)
    }
  }

  return (
    <form 
      onSubmit={handleSubmit} 
      className="transaction-form"
      onKeyDown={(e) => {
        // Previene il submit del form se si preme Invio in un qualsiasi campo di testo (es. barra di ricerca del bottom sheet)
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault()
        }
      }}
    >
      <div className="form-group">
        <label htmlFor="expense-amount">Importo (€) *</label>
        <input
          id="expense-amount"
          type="number" step="0.01" min="0.01" required
          value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
        />
      </div>

      <div className="form-group">
        <label htmlFor="expense-title">Titolo spesa *</label>
        <input
          id="expense-title"
          type="text" required
          value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Cena in pizzeria"
        />
      </div>

      <div className="form-group">
        <label htmlFor="expense-date">Data *</label>
        <input id="expense-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="expense-specifics">
        <SingleUserSelector
          label="Chi ha pagato? *"
          knownUsers={knownParticipants}
          selectedUser={selectedPayer}
          onSelectUser={setSelectedPayer}
          currentAppUser={currentUser}
          excludeCurrentUser={false}
        />

        <TagSelector knownTags={knownTags} selectedTag={selectedTag} onSelectTag={setSelectedTag} currentUserId={currentUser.id} />
        
        {/* 3. SEZIONE CLUSTER DINAMICI (SUGGERIMENTI) POSIZIONATA SOPRA IL SELETTORE MANUALE */}
        {suggestedClusters.length > 0 && (
          <div className="form-group cluster-suggestions-group" style={{ marginBottom: '0.2rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#666' }}>Spesso insieme a:</label>
            <div className="transaction-pill-grid">
              {suggestedClusters.map((cluster) => {
                // Creiamo un'etichetta prendendo solo il nome (prima parola) di ogni partecipante
                const names = cluster.participantIds
                  .map((id) => knownParticipants.find((u) => u.id === id)?.displayName.split(' ')[0] || 'Sconosciuto')
                  .join(' + ')

                return (
                  <button
                    key={cluster.id}
                    type="button"
                    className="participant-pill"
                    onClick={() => handleAddCluster(cluster.participantIds)}
                    title="Aggiungi questo gruppo di persone"
                  >
                    ✨ {names}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <ParticipantSelector
          knownParticipants={knownParticipants}
          selectedParticipants={selectedParticipants}
          onToggleParticipant={(user) => {
            setSelectedParticipants((prev) => {
              const isAlreadySelected = prev.some((p) => p.id === user.id)
              if (isAlreadySelected) return prev.filter((p) => p.id !== user.id)
              return [...prev, user]
            })
          }}
          currentAppUser={currentUser}
        />

        {/* SEZIONE MODALITÀ DI DIVISIONE */}
        <SplitManager
          participants={selectedParticipants}
          currentUser={currentUser}
          amount={numericAmount}
          splitType={splitType}
          onSplitTypeChange={setSplitType}
          customShares={customShares}
          onCustomShareChange={(userId, value) => {
            if (splitType === 'custom') setCustomShares(prev => ({ ...prev, [userId]: value }))
          }}
        />
      </div>

      <div className="form-group">
        <label htmlFor="expense-note">Note (facoltative)</label>
        <textarea id="expense-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Aggiungi dettagli aggiuntivi..." />
      </div>

      {error && <p className="transaction-form__error">{error}</p>}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        {onCancel && (
          <button type="button" className="submit-btn" onClick={onCancel} disabled={isSubmitting || isSyncing} style={{ flex: 1, backgroundColor: '#f8f9fa', color: '#495057', border: '1px solid #ced4da' }}>
            Annulla
          </button>
        )}
        <button type="submit" className="submit-btn" disabled={isSubmitting || isSyncing} style={{ flex: 1 }}>
          {isSubmitting ? 'Salvataggio in corso...' : (initialTransaction ? 'Aggiorna Spesa' : 'Salva Spesa')}
        </button>
      </div>
    </form>
  )
}