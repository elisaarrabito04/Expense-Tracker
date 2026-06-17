import { useState, useEffect } from 'react'
import type { AppUser, SettlementTransaction } from '../../types/types'
import SingleUserSelector from './SingleUserSelector'
import { createSettlement, updateSettlement } from '../../services/transactionsService'
import { buildNewSettlement } from '../../utils/transactionFactories'
import { getUserById } from '../../services/usersService'

// Helper per gestire in modo pulito il salvataggio ottimistico
// senza dover ripetere la logica if/else in ogni punto di salvataggio.
async function executeOptimisticWrite(writePromise: Promise<void>) {
  if (!navigator.onLine) {
    writePromise.catch(err => console.error("Errore sync in background offline", err))
    return Promise.resolve() // Risolve istantaneamente per sbloccare la UI
  }
  return writePromise // Attende normalmente la risposta del server
}

type SettlementFormProps = {
  currentUser: AppUser
  knownParticipants: AppUser[]
  onSuccess: () => void // Funzione da richiamare quando il salvataggio va a buon fine
  initialOtherUserId?: string // ID precompilato della persona
  initialAmount?: number // Importo del debito/credito
  initialDirection?: 'i_paid' | 'they_paid' // Direzione suggerita
  initialTransaction?: SettlementTransaction // PER IL CLICK SU MODIFICA
  initialOtherUser?: AppUser | null
  isSyncing?: boolean
  onCancel?: () => void
}

export default function SettlementForm({
  currentUser,
  knownParticipants,
  onSuccess,
  initialOtherUserId,
  initialAmount,
  initialDirection,
  initialTransaction,
  initialOtherUser,
  isSyncing,
  onCancel,
}: SettlementFormProps) {
  // --- INIZIALIZZAZIONE DEGLI STATI ---
  // Il callback in useState determina il prefill iniziale.
  const [amount, setAmount] = useState<string>(() => {
    // Se siamo in modalità Modifica (EditTransaction)
    if (initialTransaction) return initialTransaction.amount.toString()
    // Se stiamo saldando un debito dalla pagina Profilo (Profile)
    return initialAmount !== undefined ? initialAmount.toFixed(2) : ''
  })
  const [description, setDescription] = useState<string>(initialTransaction ? initialTransaction.description : '')
  const [date, setDate] = useState<string>(initialTransaction ? initialTransaction.date : new Date().toISOString().split('T')[0])
  const [note, setNote] = useState<string>(initialTransaction?.note || '')

  const [otherUser, setOtherUser] = useState<AppUser | null>(initialOtherUser || null)
  

  const [direction, setDirection] = useState<'i_paid' | 'they_paid'>(() => {
    if (initialTransaction) {
      // Quando modifichiamo, deduciamo la "direzione" del pagamento verificando 
      // se il mittente originale era l'utente corrente
      return initialTransaction.fromUserId === currentUser.id ? 'i_paid' : 'they_paid'
    }
    // Altrimenti, se fornita come prop per il saldo dal profilo la usiamo, se no diamo un default.
    return initialDirection || 'i_paid'
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- SINCRONIZZAZIONE BACKGROUND E PREFILL ---
  // Se riceviamo un initialOtherUserId, dobbiamo preimpostare "otherUser" come oggetto AppUser
  // quindi dipende da knownParticipants (che viene servito dalla cache locale)
  // e potrebbe servire (eventualmente) una chiamata a firestore con getUserById per poter mostrare il nome se non è tra i known
  useEffect(() => {
    if (initialOtherUser) {
      setOtherUser(initialOtherUser)
      return
    }

    if (!initialOtherUserId || initialTransaction) return

    // È quasi certo che la persona con cui vogliamo saldare sia nei "knownParticipants"
    const foundUser = knownParticipants.find((u) => u.id === initialOtherUserId)
    if (foundUser) {
      setOtherUser(foundUser)
    } else {
      // Fallback: se per caso mancasse, lo recuperiamo dal database Firebase in tempo reale
      getUserById(initialOtherUserId).then((u) => {
        if (u) setOtherUser(u)
      })
    }
  }, [initialOtherUserId, knownParticipants, initialOtherUser, initialTransaction])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!otherUser) {
      setError('Devi selezionare la persona con cui scambi denaro.')
      return
    }

    const numericAmount = parseFloat(amount) || 0
    if (numericAmount <= 0) {
      setError("L'importo deve essere maggiore di zero.")
      return
    }

    setIsSubmitting(true)

    // --- GESTIONE ACCETTAZIONE PREVENTIVA ---
    const participantStatuses: Record<string, 'accepted' | 'pending' | 'rejected'> = {}
    
    // L'utente che compila il form accetta sempre
    participantStatuses[currentUser.id] = 'accepted'

    // Gestiamo lo stato dell'altro utente
    if (initialTransaction?.participantStatuses && initialTransaction.participantStatuses[otherUser.id]) {
      participantStatuses[otherUser.id] = initialTransaction.participantStatuses[otherUser.id]
    } else if (!knownParticipants.some(ku => ku.id === otherUser.id)) {
      participantStatuses[otherUser.id] = 'pending'
    } else {
      participantStatuses[otherUser.id] = 'accepted'
    }

    const statusesArray = Object.values(participantStatuses)
    const txStatus = statusesArray.includes('rejected') ? 'revision' : (statusesArray.includes('pending') ? 'pending' : 'active')

    try {
      const fromUserId = direction === 'i_paid' ? currentUser.id : otherUser.id
      const toUserId = direction === 'i_paid' ? otherUser.id : currentUser.id

      if (initialTransaction) {
        // --- RAMO UPDATE ---
        const changedFields: string[] = []
        if (initialTransaction.amount !== numericAmount) changedFields.push('Importo')
        if (initialTransaction.description !== description) changedFields.push('Descrizione')
        if (initialTransaction.date !== date) changedFields.push('Data')
        if ((initialTransaction.note || '') !== note) changedFields.push('Note')
        if (initialTransaction.fromUserId !== fromUserId) changedFields.push('Mittente')
        if (initialTransaction.toUserId !== toUserId) changedFields.push('Destinatario')

        let updatedLogs = initialTransaction.editLogs || []
        if (changedFields.length > 0) {
          updatedLogs = [...updatedLogs, {
            editedAt: new Date().toISOString(),
            editedByUserId: currentUser.id,
            changedFields
          }]
        }

        const updatedPayload: SettlementTransaction = {
          ...initialTransaction,
          amount: numericAmount,
          description,
          date,
          note,
          fromUserId,
          toUserId,
          status: txStatus,
          participantStatuses,
          editLogs: updatedLogs,
        }

        // Eseguiamo l'aggiornamento sfruttando l'helper
        await executeOptimisticWrite(updateSettlement(updatedPayload))
      } else {
        const payload = buildNewSettlement({
          amount: numericAmount,
          description,
          date,
          note,
          fromUserId,
          toUserId,
          createdByUserId: currentUser.id,
          status: txStatus,
          participantStatuses,
        })
        
        // Eseguiamo la creazione sfruttando l'helper
        await executeOptimisticWrite(createSettlement(payload))
      }

      onSuccess()
    } catch (err) {
      console.error('Errore durante la creazione del pagamento:', err)
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
        <label htmlFor="settlement-amount">Importo (€) *</label>
        <input
          id="settlement-amount"
          type="number" step="0.01" min="0.01" required
          value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
        />
      </div>

      <div className="form-group">
        <label htmlFor="settlement-desc">Descrizione *</label>
        <input
          id="settlement-desc"
          type="text" required
          value={description} onChange={(e) => setDescription(e.target.value)} placeholder="es. Restituzione soldi cena"
        />
      </div>

      <div className="form-group">
        <label htmlFor="settlement-date">Data *</label>
        <input id="settlement-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="settlement-specifics" style={{ marginBottom: '1.5rem' }}>
        <SingleUserSelector
          label="Con chi stai scambiando soldi? *"
          knownUsers={knownParticipants}
          selectedUser={otherUser}
          onSelectUser={setOtherUser}
          currentAppUser={currentUser}
          excludeCurrentUser={true}
        />

        {otherUser && (
          <div className="form-group direction-toggle-group" style={{ marginTop: '1rem' }}>
            <label>Direzione del pagamento</label>
            <div className="transaction-type-toggle" style={{ marginTop: '8px' }}>
              <button type="button" className={`dirSettlement-btn ${direction === 'i_paid' ? 'active' : ''}`} onClick={() => setDirection('i_paid')}>
                Pago io
              </button>
              <button type="button" className={`dirSettlement-btn ${direction === 'they_paid' ? 'active' : ''}`} onClick={() => setDirection('they_paid')}>
                Paga {otherUser.displayName}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="settlement-note">Note (facoltative)</label>
        <textarea id="settlement-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Aggiungi dettagli aggiuntivi..." />
      </div>

      {error && <p className="transaction-form__error" style={{ color: '#b42318', fontWeight: 'bold' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        {onCancel && (
          <button type="button" className="submit-btn" onClick={onCancel} disabled={isSubmitting || isSyncing} style={{ flex: 1, backgroundColor: '#f8f9fa', color: '#495057', border: '1px solid #ced4da' }}>
            Annulla
          </button>
        )}
        <button type="submit" className="submit-btn" disabled={isSubmitting || isSyncing} style={{ flex: 1 }}>
          {isSubmitting ? 'Salvataggio in corso...' : (initialTransaction ? 'Aggiorna Pagamento' : 'Salva Pagamento')}
        </button>
      </div>
    </form>
  )
}