import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTransactions } from '../context/TransactionsContext'
import { formatCurrency } from '../utils/transactions'
import './Analytics.css'
import FallbackState from '../components/FallbackState'
import { useAnalyticsData, PIE_COLORS } from '../hooks/useAnalyticsData'

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

  const {
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    activeExpenses,
    availableYears,
    availableMonthsInSelectedYear,
    monthSummary,
    pieChartDataWithLabels,
    barChartData,
    formattedMonthName
  } = useAnalyticsData(transactions, availableTags, currentUserId)

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