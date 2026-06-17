import type { TransactionType } from '../../types/types'
import '../../pages/AddTransaction.css'

type TransactionTypeSwitcherProps = {
  value: TransactionType
  onChange: (value: TransactionType) => void
}

export default function TransactionTypeSwitcher({
  value,
  onChange,
}: TransactionTypeSwitcherProps) {
  return (
    <div className="transaction-type-toggle">
      <button
        type="button"
        className={value === 'expense' ? 'active' : ''}
        onClick={() => onChange('expense')}
      >
        Spesa
      </button>

      <button
        type="button"
        className={value === 'settlement' ? 'active' : ''}
        onClick={() => onChange('settlement')}
      >
        Pagamento
      </button>
    </div>
  )
}