import { useState, useEffect, useMemo, useRef } from 'react'
import type { AppUser, Tag, Transaction, ExpenseTransaction } from '../../types/types'
import TagSelector from './TagSelector'
import ParticipantSelector from './ParticipantSelector'
import SingleUserSelector from './SingleUserSelector'
import './Selector.css'
import './TransactionForm.css'
import SplitManager from './SplitManager'
import { createExpense, updateExpense } from '../../services/transactionsService'
import { buildNewExpense } from '../../utils/transactionFactories'
import { createTemplate, updateTemplate, checkTemplateExists } from '../../services/templatesService'
import { getSuggestedClusters, getAvailableUsersIds } from '../../utils/transactions'
import { useNetworkStatus } from '../../hooks/useNetworkStatus' // per non poter creare un template offline (dato che serve sapere se il nome esiste già)

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
  userTransactions: Transaction[] // (presi dal genitore nel context) per il calcolo dei cluster
  knownTags: Tag[] // (presi dal genitore nel context) per mostrare le label
  knownParticipants: AppUser[] // (presi dal genitore nel context) per poter mostrare i nomi
  onSuccess: () => void
  initialTransaction?: ExpenseTransaction // PER IL CLICK SU MODIFICA (per sapere ID, importi, log e tipo di divisione)
  templateTransaction?: ExpenseTransaction // PER LA PRECOMPILAZIONE DA UN MODELLO
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
  templateTransaction,
  isSyncing,
  onCancel,
}: ExpenseFormProps) {
  // --- INIZIALIZZAZIONE DEGLI STATI ---
  // Utilizziamo un operatore ternario (o il coalescing ??) per riempire i campi con i
  // valori di initialTransaction (se stiamo modificando) oppure con stringhe vuote/default (se stiamo creando).
  const [amount, setAmount] = useState<string>(initialTransaction ? initialTransaction.amount.toString() : (templateTransaction ? templateTransaction.amount.toString() : ''))
  const [title, setTitle] = useState<string>(initialTransaction ? initialTransaction.description : (templateTransaction ? templateTransaction.description : ''))
  const [date, setDate] = useState<string>(initialTransaction ? initialTransaction.date : new Date().toISOString().split('T')[0])
  const [note, setNote] = useState<string>(initialTransaction?.note || templateTransaction?.note || '')

  const [selectedTag, setSelectedTag] = useState<Tag | null>(() => {
    if (initialTransaction?.tagId) return knownTags.find(t => t.id === initialTransaction.tagId) || null
    if (templateTransaction?.tagId) return knownTags.find(t => t.id === templateTransaction.tagId) || null
    return null
  })
  
  const [selectedPayer, setSelectedPayer] = useState<AppUser | null>(() => {
    if (initialTransaction?.payerId) return knownParticipants.find(p => p.id === initialTransaction.payerId) || currentUser
    if (templateTransaction?.payerId) return knownParticipants.find(p => p.id === templateTransaction.payerId) || currentUser
    return currentUser // Default al creatore della spesa
  })

  // Inizializzazione "lazy" (con callback) per evitare computazioni a ogni render:
  const [selectedParticipants, setSelectedParticipants] = useState<AppUser[]>(() => {
    if (initialTransaction?.shares) {
      const mapped = initialTransaction.shares.map(s => s.userId === currentUser.id ? currentUser : knownParticipants.find(p => p.id === s.userId)).filter((p): p is AppUser => p !== undefined)
      if (mapped.length > 0) return mapped
    }
    // Se abbiamo un template, peschiamo i partecipanti dalla cache locale
    if (templateTransaction?.participantIds) {
      const mapped = templateTransaction.participantIds.map(id => id === currentUser.id ? currentUser : knownParticipants.find(p => p.id === id)).filter((p): p is AppUser => p !== undefined)
      if (mapped.length > 0) return mapped
    }
    // Altrimenti (nuova spesa) inseriamo di default l'utente corrente
    return currentUser ? [currentUser] : []
  })

  // Ref per tracciare quale bottone è stato premuto ("expense" o "template")
  const submitAction = useRef<'expense' | 'template'>('expense')

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
  // Ascoltiamo l'arrivo dei dati asincroni (se mancavano e sono stati scaricati in un secondo momento dal genitore)
  const initializedTxId = useRef<string | null>(null)

  useEffect(() => {
    if (initialTransaction && initializedTxId.current !== initialTransaction.id) {
       const neededUserIds = [...initialTransaction.shares.map(s => s.userId), initialTransaction.payerId]
       const availableUserIds = new Set(knownParticipants.map(p => p.id).concat(currentUser.id))
       const allUsersAvailable = neededUserIds.every(id => availableUserIds.has(id))

       const neededTagId = initialTransaction.tagId
       const allTagsAvailable = !neededTagId || knownTags.some(t => t.id === neededTagId)

       if (allUsersAvailable && allTagsAvailable) {
          if (neededTagId) setSelectedTag(knownTags.find(t => t.id === neededTagId) || null)
          setSelectedPayer(knownParticipants.find(p => p.id === initialTransaction.payerId) || currentUser)
          
          const mappedParticipants = initialTransaction.shares.map(s => s.userId === currentUser.id ? currentUser : knownParticipants.find(p => p.id === s.userId)).filter((p): p is AppUser => p !== undefined)
          if (mappedParticipants.length > 0) setSelectedParticipants(mappedParticipants)

          initializedTxId.current = initialTransaction.id
       }
    }
  }, [initialTransaction, knownParticipants, knownTags, currentUser])

  const [splitType, setSplitType] = useState<'equal' | 'custom'>(initialTransaction && initialTransaction.splitType === 'custom' ? 'custom' : (templateTransaction && templateTransaction.splitType === 'custom' ? 'custom' : 'equal'))
  const [customShares, setCustomShares] = useState<Record<string, string>>(() => {
    const shares: Record<string, string> = {}
    // Se stiamo modificando una spesa di tipo "custom", ricostruiamo il dizionario 
    // delle quote personalizzate estrapolando i valori dall'array `shares` del db
    if (initialTransaction && initialTransaction.splitType === 'custom') {
      initialTransaction.shares.forEach(s => {
        shares[s.userId] = s.amount.toString()
      })
    } else if (templateTransaction && templateTransaction.splitType === 'custom') {
      templateTransaction.shares.forEach(s => {
        shares[s.userId] = s.amount.toString()
      })
    }
    return shares
  })

  const isOnline = useNetworkStatus()
  const isOffline = !isOnline
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Valori numerici calcolati in tempo reale
  const numericAmount = parseFloat(amount) || 0
  const participantCount = selectedParticipants.length
  const equalShare = participantCount > 0 ? numericAmount / participantCount : 0

  // Somma delle quote custom inserite
  const totalCustomShares = Object.values(customShares).reduce((acc, val) => acc + (parseFloat(val) || 0), 0)

  // Booleano comodo per sapere se stiamo modificando un modello esistente
  const isEditingTemplate = initialTransaction?.status === 'template'

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
    
    const activeUserIds = getAvailableUsersIds(userTransactions)
    
    selectedParticipants.forEach(user => {
      if (user.id === currentUser.id) {
        participantStatuses[user.id] = 'accepted' // Il creatore/utente corrente accetta sempre
      } else if (initialTransaction && initialTransaction.participantStatuses[user.id]) {
        // Se l'utente era già presente, valutiamo il suo stato precedente
        const prevStatus = initialTransaction.participantStatuses[user.id]
        if (prevStatus === 'rejected' || prevStatus === 'pending') {
          // Se aveva rifiutato, la modifica di X serve a correggere: torna in pending
          participantStatuses[user.id] = 'pending'
        } else {
          participantStatuses[user.id] = 'accepted'
        }
      } else {
        // È un utente "nuovo" (non ancora noto tramite transazioni attive)
        if (activeUserIds.includes(user.id)) {
          participantStatuses[user.id] = 'accepted' // Noto
        } else {
          participantStatuses[user.id] = 'pending'
        }
      }
    })

    const statusesArray = Object.values(participantStatuses)
    const txStatus = statusesArray.includes('rejected') ? 'revision' : (statusesArray.includes('pending') ? 'pending' : 'active')

    // Costruiamo l'array delle quote (shares) in anticipo, 
    // poiché ci serve sia per il template che per la spesa vera e propria
    const shares = selectedParticipants.map(user => ({
      userId: user.id,
      amount: splitType === 'equal' ? equalShare : (parseFloat(customShares[user.id]) || 0)
    }))

    // --- RAMO SALVATAGGIO / AGGIORNAMENTO TEMPLATE ---
    if (submitAction.current === 'template') {
      // Blocco di sicurezza invalicabile se l'utente riesce in qualche modo a premere il bottone offline
      if (isOffline) {
        setError("Sei offline. Non è possibile salvare o modificare i modelli senza connessione per verificare che il nome sia disponibile.")
        setIsSubmitting(false)
        return
      }

      // Se stiamo creando un NUOVO template, o se stiamo modificando il NOME di uno esistente, controlliamo l'unicità
      if (!isEditingTemplate || initialTransaction!.description !== title.trim()) {
        const exists = await checkTemplateExists(currentUser.id, title.trim())
        if (exists) {
          setError(`Hai già un modello salvato con il nome "${title.trim()}". Cambia il titolo della spesa per salvarne uno nuovo.`)
          setIsSubmitting(false)
          return
        }
      }

      // Costruiamo i participantIds esattamente come fa il service delle transazioni
      const participantIds = Array.from(new Set([currentUser.id, selectedPayer.id, ...shares.map(s => s.userId)]))

      const templatePayload: Omit<ExpenseTransaction, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'expense',
        description: title.trim(),
        amount: numericAmount,
        date,
        note,
        payerId: selectedPayer.id,
        splitType,
        shares,
        tagId: selectedTag ? selectedTag.id : null,
        createdByUserId: currentUser.id,
        participantIds,
        status: 'template',
        participantStatuses, 
        templateName: title.trim(), // Usiamo il titolo della spesa come nome del template
      }

      if (isEditingTemplate && initialTransaction) {
        await executeOptimisticWrite(updateTemplate(currentUser.id, initialTransaction.id, templatePayload))
      } else {
        await executeOptimisticWrite(createTemplate(currentUser.id, templatePayload))
      }
      
      onSuccess()
      return
    }

    try {
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
        await executeOptimisticWrite(updateExpense(updatedPayload, currentUser.id))
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

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        {onCancel && (
          <button type="button" className="submit-btn" onClick={onCancel} disabled={isSubmitting || isSyncing} style={{ flex: 1, backgroundColor: '#f8f9fa', color: '#495057', border: '1px solid #ced4da', minWidth: '100px' }}>
            Annulla
          </button>
        )}
        
        {isEditingTemplate ? (
          <button type="submit" className="submit-btn" disabled={isSubmitting || isSyncing || isOffline} onClick={() => submitAction.current = 'template'} style={{ flex: 1, backgroundColor: '#e6fcf5', color: '#099268', border: '1px solid #20c997', minWidth: '140px' }}>
            {isOffline ? 'Offline' : (isSubmitting ? 'Salvataggio...' : 'Aggiorna Modello')}
          </button>
        ) : (
          <>
            {/* Mostriamo il bottone "Salva come modello" solo per le spese nuove di zecca */}
            {!initialTransaction && (
              <button type="submit" className="submit-btn" disabled={isSubmitting || isSyncing || isOffline} onClick={() => submitAction.current = 'template'} style={{ flex: 1, backgroundColor: '#e6fcf5', color: '#099268', border: '1px solid #20c997', minWidth: '140px', padding: '0 8px' }}>
                {isOffline ? 'Offline' : (isSubmitting && submitAction.current === 'template' ? 'Salvataggio...' : 'Salva come modello')}
              </button>
            )}
            
            <button type="submit" className="submit-btn" disabled={isSubmitting || isSyncing} onClick={() => submitAction.current = 'expense'} style={{ flex: 2, minWidth: '140px' }}>
              {isSubmitting && submitAction.current === 'expense' ? 'Salvataggio...' : (initialTransaction ? 'Aggiorna Spesa' : 'Salva Spesa')}
            </button>
          </>
        )}
      </div>
    </form>
  )
}