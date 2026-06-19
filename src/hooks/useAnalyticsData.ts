import { useMemo, useState, useEffect } from 'react'
import {
  getAvailableMonths,
  getPersonalExpenseAnalysisSummary,
  getPersonalSpendingByTag,
  getYearlySpendingTrend,
} from '../utils/transactions'
import type { ExpenseTransaction, Transaction, Tag } from '../types/types'

// Array di colori esadecimali per le fette del grafico a torta.
export const PIE_COLORS = [
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

export function useAnalyticsData(
  transactions: Transaction[],
  availableTags: Tag[],
  currentUserId: string | undefined
) {
  // Filtri stato locale
  const [selectedMonth, setSelectedMonth] = useState('') // YYYY-MM
  const [selectedYear, setSelectedYear] = useState('') // YYYY

  // 1. Isolo SUBITO solo le spese ATTIVE.
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

  // 4. Calcolo per Pie Chart
  const pieChartData = useMemo(() => {
    if (!currentUserId) return []
    return getPersonalSpendingByTag(monthExpenses, currentUserId, 6)
  }, [monthExpenses, currentUserId])

  // 5. Arricchiamo i dati del Pie Chart con le label dei tag
  const pieChartDataWithLabels = useMemo(() => {
    const tagsMap = new Map(availableTags.map((tag) => [tag.id, tag.label]))

    return pieChartData.map((dataPoint, index) => ({
      ...dataPoint,
      label: getReadableTagLabel(dataPoint.tagId, tagsMap),
      fill: PIE_COLORS[index % PIE_COLORS.length]
    }))
  }, [pieChartData, availableTags])

  // 6. Calcolo per Bar Chart (Andamento anno)
  const barChartData = useMemo(() => {
    if (!currentUserId) return []
    return getYearlySpendingTrend(activeExpenses, currentUserId, selectedYear)
  }, [activeExpenses, currentUserId, selectedYear])

  // Utility per formattare il nome del mese selezionato
  const formattedMonthName = useMemo(() => {
    if (!selectedMonth) return ''
    const date = new Date(`${selectedMonth}-01`)
    const monthStr = date.toLocaleDateString('it-IT', { month: 'long' })
    return monthStr.charAt(0).toUpperCase() + monthStr.slice(1) + ' ' + selectedYear
  }, [selectedMonth, selectedYear])

  return {
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
  }
}
