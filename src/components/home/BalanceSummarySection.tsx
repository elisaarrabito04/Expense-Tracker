import { formatCurrency } from '../../utils/transactions'
import './BalanceSummarySection.css'

type BalanceSummary = {
  netBalance: number
  totalOwedByUser: number
  totalOwedToUser: number
}

type BalanceSummarySectionProps = {
  balanceSummary: BalanceSummary
}

export default function BalanceSummarySection({
  balanceSummary,
}: BalanceSummarySectionProps) {
  let netBalanceClassName = 'balance-summary__amount balance-summary__amount--neutral'
  if (balanceSummary.netBalance > 0) {
    netBalanceClassName = 'balance-summary__amount balance-summary__amount--positive'
  } else if (balanceSummary.netBalance < 0) {
    netBalanceClassName = 'balance-summary__amount balance-summary__amount--negative'
  }

  return (
    <section className="balance-summary">
      {/* Card principale: mette in evidenza il saldo netto,
          cioè l'informazione più importante della sezione */}
      <div className="balance-summary__main-card">
        <p className="balance-summary__label">Saldo netto</p>
        <p className={netBalanceClassName}>
          {formatCurrency(balanceSummary.netBalance)}
        </p>
      </div>

      {/* Card secondarie: separiamo "devi" e "ti devono"
          per rendere la lettura più rapida */}
      <div className="balance-summary__details">
        <div className="balance-summary__detail-card">
          <p className="balance-summary__label">Devi</p>
          <p className="balance-summary__detail-value balance-summary__detail-value--negative">
            {formatCurrency(balanceSummary.totalOwedByUser)}
          </p>
        </div>

        <div className="balance-summary__detail-card">
          <p className="balance-summary__label">Ti devono</p>
          <p className="balance-summary__detail-value balance-summary__detail-value--positive">
            {formatCurrency(balanceSummary.totalOwedToUser)}
          </p>
        </div>
      </div>
    </section>
  )
}