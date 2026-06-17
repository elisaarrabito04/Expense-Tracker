import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTransactions } from '../context/TransactionsContext'
import {
  getAvailableMonths,
  getPersonalExpenseAnalysisSummary,
  getPersonalSpendingByTag,
  getYearlySpendingTrend,
  formatCurrency
} from '../utils/transactions'
import type { ExpenseTransaction } from '../types/types'
import './Analytics.css'
import FallbackState from '../components/FallbackState'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'

// Array di colori esadecimali per le fette del grafico a torta.
// Recharts li assegnerà in ordine iterando su questo array.
const PIE_COLORS = [
  '#0F766E', // Teal scuro
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#8B5CF6', // Viola
  '#F59E0B', // Ambra
  '#F97316', // Arancione
]

// Utility locale per trasformare "senza_tag" o tagId in una label più leggibile
function getReadableTagLabel(tagId: string, tagsMap: Map<string, string>) {
  if (tagId === 'senza_tag') return 'Senza tag'
  if (tagId === 'altro') return 'Altro'
  return tagsMap.get(tagId) || tagId
}

export default function Analytics() {
  const navigate = useNavigate()
  const { currentUser, loading: authLoading } = useAuth()

  const currentUserId = currentUser?.id

  const {
    userTransactions: transactions,
    knownTags: availableTags,
    isLoading,
    error
  } = useTransactions()

  // Filtri stato locale
  const [selectedMonth, setSelectedMonth] = useState('') // YYYY-MM
  const [selectedYear, setSelectedYear] = useState('') // YYYY

  // 1. Isolo SUBITO solo le spese ATTIVE.
  // Le analisi statistiche devono basarsi solo su transazioni confermate,
  // quindi filtriamo a monte per status === 'active' per pulire i dati una sola volta.
  const activeExpenses = useMemo(() => {
    return transactions.filter((tx): tx is ExpenseTransaction => tx.type === 'expense' && tx.status === 'active')
  }, [transactions])

  // per le opzioni dei filtri
  const availableMonths = useMemo(() => {
    if (!currentUserId) return []
    return getAvailableMonths(activeExpenses)
  }, [activeExpenses, currentUserId])

  // Estraiamo gli anni disponibili partendo dai mesi (es. da "2024-05" a "2024")
  const availableYears = useMemo(() => {
    const years = availableMonths.map((m) => m.slice(0, 4))
    return Array.from(new Set(years)) // Rimuove i duplicati
  }, [availableMonths])

  // Mesi disponibili per l'anno attualmente selezionato
  const availableMonthsInSelectedYear = useMemo(() => {
    return availableMonths.filter((m) => m.startsWith(selectedYear))
  }, [availableMonths, selectedYear])

  // Sincronizziamo l'anno selezionato: se quello attuale non c'è, prendiamo il più recente
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  // Sincronizziamo il mese selezionato in base all'anno
  useEffect(() => {
    if (availableMonthsInSelectedYear.length > 0 && !availableMonthsInSelectedYear.includes(selectedMonth)) {
      // Se cambiamo anno e il mese attuale non c'è, andiamo sul mese più recente di quell'anno
      setSelectedMonth(availableMonthsInSelectedYear[0])
    }
  }, [availableMonthsInSelectedYear, selectedMonth])

  // 2. Filtro per il mese selezionato per il Pie Chart e il Recap iniziale
  const monthExpenses = useMemo(() => {
    return activeExpenses.filter((tx) => tx.date.startsWith(selectedMonth))
  }, [activeExpenses, selectedMonth])

  // 3. Calcolo Recap (Totale, Media, Numero transazioni) delle spese filtrate per mese
  const monthSummary = useMemo(() => {
    return getPersonalExpenseAnalysisSummary(monthExpenses, currentUserId!)
  }, [monthExpenses, currentUserId])

  // 4. Calcolo per Pie Chart (con raggruppamento automatico 'altro' nella funzione stessa, oltre il limite)
  const pieChartData = useMemo(() => {
    if (!currentUserId) return []
    return getPersonalSpendingByTag(monthExpenses, currentUserId, 6) // limite numero tag visualizzabili (escluso i "senza tag")
  }, [monthExpenses, currentUserId])

  // 5. Arricchiamo i dati del Pie Chart con le label dei tag
  const pieChartDataWithLabels = useMemo(() => {
    const tagsMap = new Map(availableTags.map((tag) => [tag.id, tag.label])) // ricavo le coppie (tagId, label)

    return pieChartData.map((dataPoint, index) => ({
      ...dataPoint,
      // sovrascrivo cercando la label corrispondente nella mappa:
      // se c'è allora la sostituisco
      // se non c'è vorrà dire che è "senzaTag" o "altro" e va bene così
      label: getReadableTagLabel(dataPoint.tagId, tagsMap),
      fill: PIE_COLORS[index % PIE_COLORS.length] // Assegniamo il colore direttamente al dato
    }))
  }, [pieChartData, availableTags])

  // 6. Calcolo per Bar Chart (Andamento anno)
  const barChartData = useMemo(() => {
    if (!currentUserId) return []
    return getYearlySpendingTrend(activeExpenses, currentUserId, selectedYear)
  }, [activeExpenses, currentUserId, selectedYear])

  // Utility per formattare il nome del mese selezionato (es. da "2024-05" a "Maggio 2024")
  const formattedMonthName = useMemo(() => {
    if (!selectedMonth) return ''
    const date = new Date(`${selectedMonth}-01`)
    const monthStr = date.toLocaleDateString('it-IT', { month: 'long' })
    return monthStr.charAt(0).toUpperCase() + monthStr.slice(1) + ' ' + selectedYear
  }, [selectedMonth, selectedYear])

  // Gestione degli stati di base della pagina usando FallbackState per uniformità visiva
  if (authLoading || isLoading) {
    return <FallbackState type="loading" message="Caricamento analytics in corso..." />
  }

  if (!currentUserId) {
    return <FallbackState type="unauthorized" />
  }

  if (error) {
    return <FallbackState type="error" message={error} />
  }

  // Se l'utente non ha ancora registrato NESSUNA spesa in assoluto,
  // è meglio mostrare un unico Fallback globale invece di renderizzare 
  // filtri vuoti, statistiche a zero e due Fallback separati per i grafici.
  if (activeExpenses.length === 0) {
    return (
      <div className="analytics-page">
        <header className="analytics-page-header">
          <h2 className="analytics-page-title">Analisi delle tue spese</h2>
        </header>
        <FallbackState 
          type="empty" 
          title="Nessuna spesa da analizzare" 
          message="Non hai ancora registrato nessuna spesa. Aggiungi la tua prima spesa per iniziare a vedere le statistiche."
          action={{ label: '+ Nuova Spesa', onClick: () => navigate('/add') }}
        />
      </div>
    )
  }

  return (
    <div className="analytics-page">
      <header className="analytics-page-header">
        <h2 className="analytics-page-title">Analisi delle tue spese</h2>
      </header>

      {/* --- SEZIONE FILTRI --- */}
      <section className="analytics-section analytics-section--filters">
        <div className="analytics-section-header">
          <h3 className="analytics-section-title">Filtri</h3>
        </div>

        <div className="analytics-filters">
          <div className="analytics-filter-group">
            <label htmlFor="year-select">Anno</label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="analytics-filter-select analytics-filter-select--year"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="analytics-filter-group">
            <label htmlFor="month-select">Mese</label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="analytics-filter-select analytics-filter-select--month"
              disabled={availableMonthsInSelectedYear.length === 0}
            >
              {availableMonthsInSelectedYear.map((m) => {
                // Trasformiamo "2024-05" in "Maggio" per una UI più pulita
                const date = new Date(`${m}-01`)
                const monthStr = date.toLocaleDateString('it-IT', { month: 'long' })
                const capitalized = monthStr.charAt(0).toUpperCase() + monthStr.slice(1)

                return (
                  <option key={m} value={m}>
                    {capitalized}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </section>

      {/* --- SEZIONE 1: RECAP MENSILE --- */}
      <section className="analytics-section analytics-summary">
        <div className="analytics-section-header">
          <h3 className="analytics-section-title">Riassunto di {formattedMonthName}</h3>
        </div>

        <div className="analytics-summary-cards">
          <article className="analytics-summary-card analytics-summary-card--primary">
            <span className="analytics-summary-card-label">Totale speso</span>
            <strong className="analytics-summary-card-value">
              {formatCurrency(monthSummary.totalSpent)}
            </strong>
          </article>

          <article className="analytics-summary-card">
            <span className="analytics-summary-card-label">Transazioni</span>
            <strong className="analytics-summary-card-value">{monthSummary.expenseCount}</strong>
          </article>

          <article className="analytics-summary-card">
            <span className="analytics-summary-card-label">Media per spesa</span>
            <strong className="analytics-summary-card-value">
              {formatCurrency(monthSummary.averageSpent)}
            </strong>
          </article>
        </div>
      </section>

      {/* --- SEZIONE 2: GRAFICO A TORTA --- */}
      <section className="analytics-section analytics-pie-chart">
        <div className="analytics-section-header">
          <h3 className="analytics-section-title">Distribuzione per Tag</h3>
        </div>

        {pieChartDataWithLabels.length > 0 ? (
          <>
            {/* ResponsiveContainer fa in modo che il grafico si adatti alla larghezza dello schermo mobile */}
            <div className="analytics-chart-container analytics-chart-container--pie">
              <ResponsiveContainer 
                width="100%" 
                height="100%" 
                minWidth={0}
                minHeight={0}
                initialDimension={{ width: 1, height: 1 }}
              >
                <PieChart>
                  <Pie
                    data={pieChartDataWithLabels}
                    dataKey="totalSpent" // Definisce quale valore determina la grandezza della fetta
                    nameKey="label" // Definisce quale etichetta mostrare per ogni fetta
                    cx="50%" // Centro il grafico orizzontalmente
                    cy="50%" // Centro il grafico verticalmente
                    //innerRadius={52} // versione donut
                    paddingAngle={2}
                    outerRadius={100} // Raggio del cerchio
                  />
                  {/* Il Tooltip compare quando clicchi/tappi su una fetta. Formattiamo il valore come valuta */}
                  <Tooltip
                    formatter={(value) => {
                      const numericValue = Array.isArray(value) ? value[0] : value
                      return numericValue == null ? '' : formatCurrency(Number(numericValue))
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda personalizzata sotto il grafico: su mobile è più comoda da leggere rispetto a quella integrata di Recharts */}
            <ul className="analytics-legend">
              {pieChartDataWithLabels.map((entry, index) => (
                <li key={`${entry.tagId}-${index}`} className="analytics-legend-item">
                  <span
                    className="analytics-legend-color"
                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    aria-hidden="true"
                  />
                  <span className="analytics-legend-text">
                    <span className="analytics-legend-name">{entry.label}</span>
                    <span className="analytics-legend-values">
                      {formatCurrency(entry.totalSpent)} ({entry.percentage?.toFixed(1)}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          // Fallback in caso di assenza di spese nel mese selezionato, sostituisce il vecchio div testuale
          <FallbackState type="empty" message="Nessuna spesa registrata in questo mese." />
        )}
      </section>

      {/* --- SEZIONE 3: GRAFICO A BARRE (ANDAMENTO ANNUALE) --- */}
      <section className="analytics-section analytics-bar-chart">
        <div className="analytics-section-header">
          <h3 className="analytics-section-title">Andamento Spese {selectedYear}</h3>
          <p className="analytics-section-description">
            Il grafico mostra l’andamento mensile del totale speso nell’anno selezionato.
          </p>
        </div>

        {/* Controlliamo se c'è almeno un mese con spese > 0, ma dovrebbe essere scontato... */}
        {barChartData.some((d) => d.totalSpent > 0) ? (
          <div className="analytics-chart-container analytics-chart-container--bar">
            <ResponsiveContainer width="100%"
              height="100%"
              minWidth={0}
              minHeight={0}
              initialDimension={{ width: 1, height: 1 }}
            >
              <BarChart data={barChartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="monthString"
                  tickFormatter={(val) => {
                    // Trasformiamo "01" in "Gen", "02" in "Feb", ecc.
                    const date = new Date(`2000-${val}-01`)
                    const monthStr = date.toLocaleDateString('it-IT', { month: 'short' })
                    return monthStr.charAt(0).toUpperCase() + monthStr.slice(1)
                  }}
                />
                <YAxis
                  tickFormatter={(val) => `€${val}`}
                  width={60} // Riserva un po' di spazio a sinistra per evitare che i numeri lunghi si taglino
                />
                <Tooltip
                  formatter={(value: any) => {
                    const numericValue = Array.isArray(value) ? value[0] : value
                    return numericValue == null ? '' : formatCurrency(Number(numericValue))
                  }}
                  labelFormatter={(label) => {
                    const date = new Date(`2000-${label}-01`)
                    const monthStr = date.toLocaleDateString('it-IT', { month: 'long' })
                    return monthStr.charAt(0).toUpperCase() + monthStr.slice(1)
                  }}
                />
                {/* raggio arrotondato sui due angoli superiori per un tocco di design più moderno */}
                <Bar dataKey="totalSpent" fill="#0F766E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          // Fallback in caso di assenza di spese nell'anno selezionato
          <FallbackState type="empty" message={`Nessuna spesa registrata nel ${selectedYear}.`} />
        )}
      </section>
    </div>
  )
}