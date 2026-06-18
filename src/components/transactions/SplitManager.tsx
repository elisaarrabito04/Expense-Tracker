import type { AppUser } from '../../types/types'

type SplitManagerProps = {
  participants: AppUser[]
  currentUser: AppUser
  amount: number
  splitType: 'equal' | 'custom'
  onSplitTypeChange: (type: 'equal' | 'custom') => void
  customShares: Record<string, string>
  onCustomShareChange: (userId: string, value: string) => void
}

export default function SplitManager({
  participants,
  currentUser,
  amount,
  splitType,
  onSplitTypeChange,
  customShares,
  onCustomShareChange,
}: SplitManagerProps) {
  if (participants.length === 0) return null

  const participantCount = participants.length
  const equalShare = participantCount > 0 ? amount / participantCount : 0
  const totalCustomShares = Object.values(customShares).reduce((acc, val) => acc + (parseFloat(val) || 0), 0)
  const isCustomError = Math.abs(totalCustomShares - amount) > 0.01

  return (
    <div className="form-group split-section-container">
      <label>Modalità di divisione</label>
      <div className="transaction-type-toggle split-toggle-container">
        <button type="button" className={splitType === 'equal' ? 'active' : ''} onClick={() => onSplitTypeChange('equal')}>
          Equa
        </button>
        <button type="button" className={splitType === 'custom' ? 'active' : ''} onClick={() => onSplitTypeChange('custom')}>
          Personalizzata
        </button>
      </div>

      <div className="custom-split-list">
        {participants.map((user) => (
          <div key={user.id} className="custom-split-row">
            <span className="custom-split-row__name">
              {user.id === currentUser.id ? `${user.displayName} (Tu)` : user.displayName}
            </span>
            
            <div className="custom-split-amount-wrapper">
              <input
                type="number" step="0.01" min="0" className="custom-split-input"
                value={splitType === 'equal' ? equalShare.toFixed(2) : (customShares[user.id] || '')}
                onChange={(e) => onCustomShareChange(user.id, e.target.value)}
                disabled={splitType === 'equal'} placeholder="0.00"
              />
              
            </div>
          </div>
        ))}
      </div>
      
      {splitType === 'custom' && (
        <div className={`custom-split-total ${isCustomError ? 'custom-split-total--error' : 'custom-split-total--success'}`}>
          Totale assegnato: {totalCustomShares.toFixed(2)} € / {amount.toFixed(2)} €
        </div>
      )}
    </div>
  )
}