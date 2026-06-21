import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTransactions } from '../context/TransactionsContext'
import { getTransactionById, subscribeToTransactionDeletion } from '../services/transactionsService'
import { getUsersByIds } from '../services/usersService'
import type { AppUser, Transaction, ExpenseTransaction, SettlementTransaction } from '../types/types'
import ExpenseForm from '../components/transactions/ExpenseForm'
import SettlementForm from '../components/transactions/SettlementForm'
import './AddTransaction.css'
import FallbackState from '../components/FallbackState'

export default function EditTransaction() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAuth()

  // Estraiamo la transazione ottimistica passata dalla Home
  const navState = location.state as { initialTransaction?: Transaction }

  // Prepopoliamo immediatamente lo stato se abbiamo i dati in cache
  const [transaction, setTransaction] = useState<Transaction | null>(navState?.initialTransaction || null)

  // Recuperiamo i dati globali per evitare fetch inutili
  const { userTransactions, knownTags, knownParticipants, isLoading: isContextLoading } = useTransactions()


  const [initialOtherUser, setInitialOtherUser] = useState<AppUser | null>(null)

  // Blocchiamo la UI solo se NON abbiamo la transazione in memoria
  const [isLoading, setIsLoading] = useState(!navState?.initialTransaction)
  // Mostriamo un indicatore "soft" se stiamo aggiornando in background
  const [isSyncing, setIsSyncing] = useState(!!navState?.initialTransaction)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Aspettiamo che il context abbia finito di caricare la RAM prima di valutare se fare fetch
    if (!currentUser || !id || isContextLoading) return

    async function loadData() {
      if (!transaction) setIsLoading(true)
      else setIsSyncing(true)
      setError(null)
      try {
        // 1. Cerchiamo la transazione in locale (ottimizzazione). 
        // Se non c'è, facciamo fallback sul DB (es. utente atterra da link diretto)
        let tx: Transaction | null | undefined = userTransactions.find(t => t.id === id) || navState?.initialTransaction
        if (!tx) {
          tx = await getTransactionById(id!)
        }

        if (!tx) {
          setError('Transazione non trovata.')
          return
        }

        // 2. Controllo di sicurezza addizionale (nel caso in cui un utente provi 
        // ad accedere direttamente all'URL ignorando i controlli della Home)
        if (!tx.participantIds.includes(currentUser!.id)) {
          setError('Non hai i permessi per modificare questa transazione, poiché non vi partecipi.')
          return
        }

        if (tx.status === 'deleted') {
          setError('Non puoi modificare una transazione che è stata eliminata.')
          return
        }

        if (tx.status === 'pending' && tx.createdByUserId !== currentUser!.id) {
          setError('Solo il creatore può modificare una transazione in attesa di accettazione.')
          return
        }

        if (tx.status === 'revision' && tx.createdByUserId !== currentUser!.id) {
          setError('Solo il creatore può modificare una transazione in revisione.')
          return
        }

        // 3. Prefill asincrono per Settlement
        if (tx.type === 'settlement') {
          // Nel rimborso, estraiamo l'ID dell'ALTRA persona e ne recuperiamo il profilo
          const otherId = tx.fromUserId === currentUser!.id ? tx.toUserId : tx.fromUserId
          const other = knownParticipants.find(p => p.id === otherId) || (await getUsersByIds([otherId]))[0]
          if (other) setInitialOtherUser(other)
        }

        // 4. Infine salviamo la transazione nello stato per triggerare il render dei Form
        setTransaction(tx)
      } catch (err) {
        setError('Errore durante il caricamento della transazione.')
      } finally {
        setIsLoading(false)
        setIsSyncing(false)
      }
    }

    loadData()
  }, [id, currentUser, isContextLoading]) // Aspettiamo isContextLoading per aspettare che il provider ha finito di sistemare i dati in memoria

  // --- LISTENER ELIMINAZIONI CONCORRENTI ---
  // Questo effetto si accorge in tempo reale se un altro utente elimina la transazione dal DB.
  useEffect(() => {
    // Se stiamo modificando un template, non avviamo il listener sulla collezione globale!
    if (!id || navState?.initialTransaction?.status === 'template') return

    const unsubscribe = subscribeToTransactionDeletion(id, () => {
      // Se la transazione scompare da Firestore mentre siamo qui, avvisiamo e cacciamo l'utente
      window.alert("Attenzione: Questa transazione è appena stata eliminata da un altro utente.")
      navigate('/home', { replace: true })
    })

    return () => unsubscribe()
  }, [id, navigate, navState?.initialTransaction?.status])

  // Gestione centralizzata degli stati di fallback (non autenticato, caricamento, errore)
  if (!currentUser) return <FallbackState type="unauthorized" />

  if (isLoading) return <FallbackState type="loading" message="Caricamento transazione in corso..." />

  if (error) {
    // Se si verifica un errore di recupero/sicurezza forniamo anche l'azione per tornare alla Home
    return <FallbackState type="error" message={error} action={{ label: 'Torna alla Home', onClick: () => navigate('/home') }} />
  }

  if (!transaction) return null

  return (
    <div className="add-transaction-page">
      <header className="add-transaction-header">
        <h2>Modifica Transazione</h2>
        {isSyncing && (
          <span style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic', display: 'block', marginTop: '4px' }}>
            Sincronizzazione dati in corso...
          </span>
        )}
      </header>

      {transaction.type === 'expense' ? (
        <ExpenseForm
          currentUser={currentUser as AppUser}
          knownTags={knownTags}
          knownParticipants={knownParticipants}
          userTransactions={userTransactions}
          onSuccess={() => navigate('/home')}
          initialTransaction={transaction as ExpenseTransaction}
          isSyncing={isSyncing}
          onCancel={() => navigate('/home')}
        />
      ) : (
        <SettlementForm
          currentUser={currentUser as AppUser}
          knownParticipants={knownParticipants}
          onSuccess={() => navigate('/home')}
          initialTransaction={transaction as SettlementTransaction}
          initialOtherUser={initialOtherUser}
          isSyncing={isSyncing}
          onCancel={() => navigate('/home')}
        />
      )}
    </div>
  )
}