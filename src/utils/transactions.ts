import type {
  AppUser,
  Transaction,
  ExpenseTransaction,
  UserBalanceSummary,
  MovementFilter,
  StatusFilter,
} from '../types/types'

// -----------------------------------------------------------------------------
// FUNZIONI DI LOGICA PURA ---> NO I/O
// -----------------------------------------------------------------------------


// Controlla se una transazione coinvolge un certo utente.
// - Expense: l'utente è coinvolto se è il pagante oppure compare tra le quote.
// - Settlement: l'utente è coinvolto se è il mittente o il destinatario del pagamento.
export function isUserInvolved(transaction: Transaction, userId: string): boolean {
  if (transaction.type === 'expense') {
    const isPayer = transaction.payerId === userId
    const isParticipant = transaction.shares.some((share) => share.userId === userId)
    return isPayer || isParticipant
  }
  return transaction.fromUserId === userId || transaction.toUserId === userId
}


// Restituisce l'utente corrispondente all'id, se presente nell'array di AppUser
export function getUserById(users: AppUser[], userId: string): AppUser | undefined {
  return users.find((user) => user.id === userId)
}


// -----------------------------------------------------------------------------
// DATI DISPONIBILI PER FILTRI / SELECTOR
// -----------------------------------------------------------------------------

// Utili per quando ho già ricavato userTransactions e potrei sfruttarlo invece di usare 
// getKnownParticipantsForUser o getKnownTagsForUser che internamente chiamano getUserTransactions
// (anche se in realtà andrebbe bene comunque perchè firestore funziona anche offline con la cache indexedDB)

// Restituisce TUTTI i tagId (utilizzati per visualizzare le labels nelle card).
export function getAllInvolvedTagIds(userTransactions: Transaction[]): string[] {
  return [
    ...new Set(
      userTransactions
        .filter((tx): tx is ExpenseTransaction => tx.type === 'expense')
        .map((tx) => tx.tagId)
        .filter((tagId): tagId is string => Boolean(tagId))
    ),
  ]
}

// Restituisce i tagId disponibili nelle expense ATTIVE dell'utente.
export function getAvailableTags(userTransactions: Transaction[]): string[] {
  return [
    ...new Set(
      userTransactions
        .filter((tx): tx is ExpenseTransaction => tx.type === 'expense' && tx.status === 'active')
        .map((tx) => tx.tagId)
        .filter((tagId): tagId is string => Boolean(tagId))
    ),
  ]
}

 // Restituisce TUTTE le persone coinvolte (per mostrare i nomi corretti in TUTTE le card).
export function getAllInvolvedUserIds(userTransactions: Transaction[]): string[] {
  return Array.from(
    new Set(
      userTransactions.flatMap((tx) => tx.participantIds)
    )
  )
}

// Restituisce le persone coinvolte nelle transazioni ATTIVE dell'utente
export function getAvailableUsersIds(
  userTransactions: Transaction[]
): string[] {
  const involvedUserIds = Array.from(
          new Set(
            userTransactions
              .filter((tx) => tx.status === 'active')
              .flatMap((tx) => tx.participantIds)
              // Non filtriamo qui il currentUserId, perché TransactionCard ha bisogno del suo oggetto AppUser
          )
        )

  return involvedUserIds
}


// Restituisce i mesi disponibili nel formato YYYY-MM,
// ordinati dal più recente al meno recente.
export function getAvailableMonths(userTransactions: Transaction[]): string[] {
  return Array.from(
    new Set(
      userTransactions
        .filter((tx) => tx.status === 'active')
        .map((tx) => tx.date.slice(0, 7))
    )
  ).sort((a, b) => b.localeCompare(a))
}



// -----------------------------------------------------------------------------
// FILTRI TRANSAZIONI
// -----------------------------------------------------------------------------

// USATA IN filterTransactions
// Verifica se una transazione soddisfa il filtro per persone.
// - Nessuna persona selezionata => passa sempre.
// - Una persona selezionata => basta che compaia tra i coinvolti.
// - Più persone selezionate =>
//   * settlement escluso, perché coinvolge solo 2 utenti
//   * expense valida solo se tutte le persone selezionate fanno parte dei coinvolti.
function matchesPeopleFilter(
  tx: Transaction,
  selectedPersonIds: string[]
): boolean {
  if (selectedPersonIds.length === 0) {
    return true
  }

  if (selectedPersonIds.length === 1) {
    const personId = selectedPersonIds[0]

    if (tx.type === 'expense') {
      return (
        tx.payerId === personId ||
        tx.shares.some((share) => share.userId === personId)
      )
    }

    return tx.fromUserId === personId || tx.toUserId === personId
  }

  // Con più persone selezionate, un settlement non può mai soddisfare il filtro
  // perché coinvolge solo due utenti.
  if (tx.type !== 'expense') {
    return false
  }

  // Per una expense considero come coinvolti il pagante + tutti gli utenti nelle quote.
  const participantIds = new Set([
    tx.payerId,
    ...tx.shares.map((share) => share.userId),
  ])

  return selectedPersonIds.every((personId) => participantIds.has(personId))
}

// tipo dell'oggetto richiesto dalla funzione filterTransactions
type TransactionFilters = {
  movement: MovementFilter
  tag: string // 'all' oppure un tagId
  personIds: string[]
  fromDate: string
  toDate: string
  status: StatusFilter
  personalOnly: boolean
}

// Filtra l'array di transazioni in base ai filtri della Home.
// Nota: il filtro tag ora usa tx.tagId invece di tx.tags.
export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  currentUserId?: string
): Transaction[] {
  return transactions.filter((tx) => {
    if (filters.personalOnly && currentUserId) {
      if (tx.participantIds.length > 1) return false
      if (tx.participantIds.length === 1 && tx.participantIds[0] !== currentUserId) return false
    }

    const matchesMovement =
      filters.movement === 'all' || tx.type === filters.movement

    const matchesStatus = tx.status === filters.status

    const matchesTag =
      filters.tag === 'all' ||
      (tx.type === 'expense' && tx.tagId === filters.tag)

    const matchesPeople = matchesPeopleFilter(tx, filters.personIds)

    const txTime = new Date(tx.date).getTime()

    const matchesFromDate =
      !filters.fromDate ||
      txTime >= new Date(filters.fromDate).getTime()

    const matchesToDate =
      !filters.toDate ||
      txTime <= new Date(`${filters.toDate}T23:59:59.999`).getTime()

    return (
      matchesMovement &&
      matchesStatus &&
      matchesTag &&
      matchesPeople &&
      matchesFromDate &&
      matchesToDate
    )
  })
}


// -----------------------------------------------------------------------------
// CLUSTERING PARTECIPANTI (SUGGERIMENTI DINAMICI)
// -----------------------------------------------------------------------------

export type ParticipantCluster = {
  id: string // la key dell'elenco da cui selezionarlo
  participantIds: string[] // per aggiornare istantaneamento l'elenco
  frequency: number
}

/**
 * Analizza lo storico delle transazioni e restituisce i cluster di partecipanti più frequenti.
 * È ottimizzato per suggerire "il resto del gruppo" in base a chi è già stato selezionato.
 */
export function getSuggestedClusters(
  transactions: Transaction[], // già filtrate solo spese
  currentUserId: string, // per escluderlo dai cluster
  selectedParticipantIds: string[] = [], // serve per skippare calcoli inutili
  // ma ogni volta che aggiorno con l'aggiunta di un partecipante ricalcolo??
  maxClusters: number = 4
): ParticipantCluster[] {
  const clusterMap = new Map<string, { ids: string[]; count: number }>()

  // Escludiamo il currentUserId dai partecipanti attualmente selezionati 
  // per non far fallire il match (dato che lo escludiamo anche da otherIds)
  const otherSelectedIds = selectedParticipantIds.filter((id) => id !== currentUserId)

  for (const tx of transactions) {
    if (tx.status !== 'active') continue // ignoriamo le spese non confermate nei cluster
    if (tx.type !== 'expense') continue // ignoriamo i pagamenti singoli (per cui non servono cluster)

    // Preleviamo i partecipanti escludendo l'utente corrente
    const otherIds = tx.participantIds.filter((id) => id !== currentUserId)
    if (otherIds.length <= 1) continue // Ignoriamo le spese singole (non fanno cluster)

    // Se l'utente ha già selezionato qualcuno, consideriamo solo le spese
    // storiche che INCLUDONO tutti i selezionati attuali.
    const containsAllSelected = otherSelectedIds.every((id) => otherIds.includes(id))
    if (!containsAllSelected) continue

    // Se la spesa storica non aggiunge nessuno di nuovo rispetto a quelli già selezionati, la ignoriamo
    if (otherIds.length <= otherSelectedIds.length) continue

    // Creiamo una chiave deterministica ordinando gli ID alfabeticamente
    const clusterIds = [...otherIds].sort()
    const clusterKey = clusterIds.join(',')

    const existing = clusterMap.get(clusterKey)
    clusterMap.set(clusterKey, { ids: clusterIds, count: (existing?.count || 0) + 1 })
  }

  return Array.from(clusterMap.entries())
    .map(([key, data]) => ({ id: key, participantIds: data.ids, frequency: data.count }))
    .sort((a, b) => b.frequency - a.frequency) // Ordiniamo per i più frequenti
    .slice(0, maxClusters)
}



// -----------------------------------------------------------------------------
// TRANSAZIONI CHE COINVOLGONO L'UTENTE --> PER SCHERMATA ANALISI 
// -----------------------------------------------------------------------------

// Restituisce la quota personale dell'utente dentro una expense.
// Se l'utente non compare nelle quote, ritorna 0.
export function getUserShareAmount(
  expenseTx: ExpenseTransaction,
  userId: string
): number {
  const userShare = expenseTx.shares.find((share) => share.userId === userId)
  return userShare?.amount ?? 0
}


// Riepilogo delle quote personali:
// - totale speso
// - numero di spese
// - media per spesa
export function getPersonalExpenseAnalysisSummary(
  personalExpenseTransactions: ExpenseTransaction[],
  currentUserId: string
) {
  const activeTransactions = personalExpenseTransactions.filter(tx => tx.status === 'active')
  const totalSpent = activeTransactions.reduce(
    (sum, transaction) => sum + getUserShareAmount(transaction, currentUserId),
    0
  )

  const expenseCount = activeTransactions.length
  const averageSpent = expenseCount > 0 ? totalSpent / expenseCount : 0

  return {
    totalSpent,
    expenseCount,
    averageSpent,
  }
}


// -----------------------------------------------------------------------------
// ANALISI PER TAG
// -----------------------------------------------------------------------------

export type PersonalSpendingByTag = {
  tagId: string
  totalSpent: number
  percentage?: number // Utile per la legenda della UI
  isOther?: boolean // Flag per sapere se è la categoria "altro"
}


// Raggruppa la spesa personale per tag.
// Poiché nella transaction ora c'è un solo tag, usiamo direttamente tagId.
// Le transazioni senza tag vengono aggregate sotto 'other'.
export function getPersonalSpendingByTag(
  monthExpenses: ExpenseTransaction[], // già filtrate per mese
  currentUserId: string,
  maxTags: number = 6 // Limite di tag da mostrare prima di raggruppare in "altro"
): PersonalSpendingByTag[] {
  const spendingMap = new Map<string, number>()
  let totalMonthSpend = 0

  for (const transaction of monthExpenses) {
    if (transaction.status !== 'active') continue

    const userShareAmount = getUserShareAmount(transaction, currentUserId)
    
    // Se l'utente non ha speso nulla in questa transazione, saltiamo
    if (userShareAmount <= 0) continue

    const tagId = transaction.tagId ?? 'senza_tag'
    const currentTotal = spendingMap.get(tagId) ?? 0

    spendingMap.set(tagId, currentTotal + userShareAmount)
    totalMonthSpend += userShareAmount
  }

  // Convertiamo la mappa in array di oggetti e ordiniamo per spesa decrescente
  const sortedTags = Array.from(spendingMap.entries())
    .map(([tagId, totalSpent]) => ({
      tagId,
      totalSpent,
      percentage: totalMonthSpend > 0 ? (totalSpent / totalMonthSpend) * 100 : 0
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)

  // Logica per raggruppare i tag in "Altro" se superano maxTags
  const tagsConNome = sortedTags.filter(t => t.tagId !== 'senza_tag')
  const senzaTag = sortedTags.find(t => t.tagId === 'senza_tag')
  if (tagsConNome.length <= maxTags) {
    return senzaTag ? [...tagsConNome, senzaTag] : tagsConNome // Non includiamo 'senza_tag' nel limite, lo teniamo sempre visibile se esiste.
  }

  // Prendiamo i top N
  const topTags = tagsConNome.slice(0, maxTags) // escluso maxTags
  // Raggruppiamo i restanti
  const otherTags = tagsConNome.slice(maxTags) // da maxTags in poi
  const otherTotal = otherTags.reduce((sum, t) => sum + t.totalSpent, 0) // accumulo il total spent degli others
  const altroCategory: PersonalSpendingByTag = {
    tagId: 'altro',
    totalSpent: otherTotal,
    percentage: totalMonthSpend > 0 ? (otherTotal / totalMonthSpend) * 100 : 0,
    isOther: true
  }

  const result = [...topTags, altroCategory]
  if (senzaTag) result.push(senzaTag) // se ci sono i senzaTags li mostro a prescindere

  return result
}

// -----------------------------------------------------------------------------
// ANALISI TEMPORALE (BAR CHART)
// -----------------------------------------------------------------------------

export type MonthlyTrend = {
  monthString: string // es. "01", "02", ecc. per indicare il mese
  totalSpent: number
}

// Dato un anno (es. "2024"), calcola il totale speso per ogni mese dell'anno.
// Restituisce un array di 12 elementi (da gennaio a dicembre).
export function getYearlySpendingTrend(
  personalExpenseTransactions: ExpenseTransaction[], // totali
  currentUserId: string,
  year: string
): MonthlyTrend[] {
  // Inizializziamo un array per i 12 mesi a 0€
  const trend: MonthlyTrend[] = Array.from({ length: 12 }, (_, i) => ({
    monthString: (i + 1).toString().padStart(2, '0'), // "01", "02", ... "12"
    totalSpent: 0
  }))

  for (const transaction of personalExpenseTransactions) {
    if (transaction.status !== 'active') continue

    // transaction.date è nel formato "YYYY-MM-DD"
    const [txYear, txMonth] = transaction.date.split('-')

    // man mano che scorro vedo se mi interessa considerarla a seconda del filtro anno del barchart
    if (txYear === year) {
      const userShareAmount = getUserShareAmount(transaction, currentUserId)
      
      // L'indice dell'array è il mese - 1 (es. "01" -> index 0)
      const monthIndex = parseInt(txMonth, 10) - 1
      if (monthIndex >= 0 && monthIndex < 12) {
        trend[monthIndex].totalSpent += userShareAmount
      }
    }
  }

  return trend
}

// -----------------------------------------------------------------------------
// FUNZIONI PER I BILANCI
// -----------------------------------------------------------------------------


// Significato dei saldi:
// - saldo positivo verso una persona => quella persona deve soldi all'utente
// - saldo negativo verso una persona => l'utente deve soldi a quella persona
//
// Il Record<string, number> è comodo perché indicizza direttamente per userId.
export function getUserBalancesByPerson(
  userTransactions: Transaction[],
  userId: string
): Record<string, number> {
  const balances: Record<string, number> = {}

  for (const transaction of userTransactions) {
    // Consideriamo nei saldi solo le transazioni confermate (active)
    if (transaction.status !== 'active') continue

    if (transaction.type === 'expense') {
      // Caso 1: l'utente è il pagante.
      // Ogni altro partecipante gli deve la propria quota.
      if (transaction.payerId === userId) {
        for (const share of transaction.shares) {
          if (share.userId !== userId) {
            // Aggiungo al saldo (+): questa persona mi deve la sua quota.
            // Il mio credito nei suoi confronti aumenta.
            balances[share.userId] = (balances[share.userId] ?? 0) + share.amount
          }
        }
      } else {
        // Caso 2: l'utente non è il pagante.
        // La sua quota rappresenta un debito verso il pagante.
        const userShare = transaction.shares.find((share) => share.userId === userId)
        if (userShare) {
          // Sottraggo dal saldo (-): sono io che devo questa quota al pagante.
          // Il mio debito nei suoi confronti aumenta (diventa più negativo).
          balances[transaction.payerId] =
            (balances[transaction.payerId] ?? 0) - userShare.amount
        }
      }
    } else {
      // Settlement:
      // - se l'utente paga qualcuno, riduce il credito / aumenta il debito verso quella persona
      // - se l'utente riceve da qualcuno, riduce il debito / aumenta il credito verso quella persona

      // Con la convenzione adottata qui:
      // saldo positivo = mi devono
      // saldo negativo = devo io
      if (transaction.fromUserId === userId) {
        // Se IO pago X, sto RIPAGANDO un mio debito.
        // Il mio debito verso di lui si presuppone sia negativo (io in debito e lui in credito)
        // Quindi, se gli dò dei soldi, devo SOMMARE (+) l'importo per riportare il saldo verso 0.
        balances[transaction.toUserId] = (balances[transaction.toUserId] ?? 0) + transaction.amount
      } else if (transaction.toUserId === userId) {
        // Se X paga ME, X sta RIPAGANDO il suo debito verso di me.
        // Il suo debito nei miei confronti si presuppone positivo (io sono in credito) 
        // Quindi, se mi dà dei soldi, devo SOTTRARRE (-) l'importo per riportare il saldo verso 0.
        balances[transaction.fromUserId] = (balances[transaction.fromUserId] ?? 0) - transaction.amount
      }
    }
  }
  return balances
}


// Calcola il riepilogo complessivo a partire dai saldi per persona.
export function getUserBalanceSummary(
  balances: Record<string, number>
): UserBalanceSummary {
  if (Object.keys(balances).length === 0) {
    return {
      totalOwedByUser: 0,
      totalOwedToUser: 0,
      netBalance: 0,
    }
  }

  let totalOwedByUser = 0
  let totalOwedToUser = 0

  for (const balance of Object.values(balances)) {
    if (balance > 0) {
      // Un saldo maggiore di zero significa che qualcuno mi deve dei soldi
      totalOwedToUser += balance
    } else if (balance < 0) {
      // Un saldo minore di zero significa che io devo dei soldi a qualcuno.
      // Lo sommo a totalOwedByUser convertendolo in positivo (valore assoluto).
      totalOwedByUser += Math.abs(balance)
    }
  }

  return {
    totalOwedByUser,
    totalOwedToUser,
    netBalance: totalOwedToUser - totalOwedByUser,
  }
}


// -----------------------------------------------------------------------------
// FUNZIONI DI FORMATTAZIONE
// -----------------------------------------------------------------------------


// Formatta un numero come valuta EUR in locale italiana.
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}


// Formatta una data ISO/simple date in formato italiano gg/mm/aaaa.
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}
