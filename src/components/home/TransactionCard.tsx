import { useState } from 'react'
import type { AppUser, Transaction, Tag } from '../../types/types'
import { getUserById,formatCurrency, formatDate } from '../../utils/transactions'
import './TransactionCard.css'
import PencilIcon from '../../assets/pencil.svg?react'
import TrashIcon from '../../assets/trash.svg?react'

type TransactionCardProps = {
  tx: Transaction
  users: AppUser[]
  tags: Tag[]
  currentUserId: string // per mostrare il bottone solo se user corrente è il creatore
  onEdit?: (transactionId: string) => void
  onDelete?: (transactionId: string) => void
  onAccept?: (transactionId: string) => void
  onReject?: (transactionId: string) => void
}

// prende la transazione specifica e usersMock per le info degli utenti partecipanti
export default function TransactionCard({
  tx,
  users,
  tags,
  currentUserId,
  onEdit,
  onAccept,
  onReject,
  onDelete,
}: TransactionCardProps) {
    const [isExpanded, setIsExpanded] = useState(false) // per mostrare/nascondere i dettagli

    const formatUserName = (userId: string) => {
      const user = getUserById(users, userId)
      if (!user) return 'Utente sconosciuto'
      if (user.id === currentUserId) return `${user.displayName} (Tu)`
      return user.nickname ? `${user.displayName} (@${user.nickname})` : user.displayName
    }

    const creatorName = formatUserName(tx.createdByUserId)
    const isCreatedByCurrentUser = tx.createdByUserId === currentUserId

    // --- STATI E AZIONI (BANNER) ---
    const isPendingForCurrentUser = tx.status === 'pending' && tx.participantStatuses?.[currentUserId] === 'pending'
    const isPendingButAccepted = tx.status === 'pending' && tx.participantStatuses?.[currentUserId] === 'accepted'
    const isRevisionForCreator = tx.status === 'revision' && isCreatedByCurrentUser
    const isDeleted = tx.status === 'deleted'
    const deletedByName = tx.deletedByUserId ? formatUserName(tx.deletedByUserId) : 'Un partecipante'

    const canEditOrDelete = !isDeleted && (tx.status !== 'pending' || isCreatedByCurrentUser)

    const renderStatusBanner = () => {
      if (isDeleted) {
        return (
          <div style={{ backgroundColor: '#f8f9fa', color: '#6c757d', padding: '12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.9rem', border: '1px solid #dee2e6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🗑️ <strong>Eliminata da {deletedByName}</strong>
          </div>
        )
      }

      if (isRevisionForCreator) {
        return (
          <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.9rem', fontWeight: 500 }}>
            ⚠️ Un partecipante ha rifiutato. Modifica la transazione per correggerla.
          </div>
        )
      }
      if (tx.status === 'revision' && !isCreatedByCurrentUser) {
        return (
          <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.9rem', border: '1px solid #f5c6cb' }}>
            🛑 Transazione in revisione: un partecipante l'ha rifiutata.
          </div>
        )
      }
      if (isPendingForCurrentUser) {
        return (
          <div style={{ backgroundColor: '#eef2ff', color: '#004085', padding: '12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #b8daff' }}>
            <strong>{creatorName} ti ha aggiunto a questa transazione.</strong>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => onAccept?.(tx.id)} style={{ flex: 1, padding: '6px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Accetta</button>
              <button type="button" onClick={() => onReject?.(tx.id)} style={{ flex: 1, padding: '6px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Rifiuta</button>
            </div>
          </div>
        )
      }
      if (isPendingButAccepted) {
        return (
          <div style={{ backgroundColor: '#f8f9fa', color: '#383d41', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.9rem', border: '1px solid #dae0e5' }}>
            ⏳ In attesa di accettazione da altri partecipanti.
          </div>
        )
      }
      return null
    }

    if (tx.type === 'expense') {
        const payerName = formatUserName(tx.payerId)
        const participantsCount = tx.shares.length        
        const tagObject = tx.tagId ? tags.find(t => t.id === tx.tagId) : null
        const tagLabel = tagObject ? tagObject.label : ''
        const participantsShares = tx.shares.map((share) => {
        const userName = formatUserName(share.userId)

        return {
            userId: share.userId,
            userName,
            amount: share.amount,
        }
    })

    return (
      <article className={`transaction-card transaction-card--expense ${isDeleted ? 'transaction-card--deleted' : ''}`} style={isDeleted ? { opacity: 0.7, filter: 'grayscale(100%)' } : {}}>
        {renderStatusBanner()}

        <div className="transaction-card__top">
          <span className="transaction-card__badge transaction-card__badge--expense">
            Spesa
          </span>

          <p className="transaction-card__amount">
            {formatCurrency(tx.amount)}
          </p>
        </div>

        <div className="transaction-card__main">
          <h3 className="transaction-card__title">{tx.description}</h3>

          <div className="transaction-card__meta">
            <p className="transaction-card__meta-item">
              <span className="transaction-card__meta-label">Pagato da:</span> {payerName}
            </p>

            <p className="transaction-card__meta-item">
              <span className="transaction-card__meta-label">Data:</span> {formatDate(tx.date)}
            </p>

            <p className="transaction-card__meta-item">
              <span className="transaction-card__meta-label">Partecipanti:</span> {participantsCount}
            </p>

            <p className="transaction-card__meta-item">
              <span className="transaction-card__meta-label">Tag:</span> {tagLabel || 'Nessun tag'}
            </p>
          </div>
        </div>

        <div className="transaction-card__actions">
          <button
            type="button"
            className="transaction-card__action-button"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? 'Nascondi dettagli' : 'Mostra dettagli'}
          </button>

          {canEditOrDelete && (
            <div className="transaction-card__owner-actions">
              <button
                type="button"
                className="transaction-card__icon-button"
                onClick={() => onEdit?.(tx.id)}
                title="Modifica"
                aria-label="Modifica"
              >
                <PencilIcon style={{ width: '16px', height: '16px' }} />
              </button>

              <button
                type="button"
                className="transaction-card__icon-button transaction-card__icon-button--danger"
                onClick={() => onDelete?.(tx.id)}
                title="Elimina"
                aria-label="Elimina"
              >
                <TrashIcon style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="transaction-card__details">
            <p className="transaction-card__detail-row">
              <span className="transaction-card__meta-label">Tipo di split:</span> {tx.splitType}
            </p>

            <p className="transaction-card__detail-row">
              <span className="transaction-card__meta-label">Creata da:</span> {creatorName}
            </p>

            <div className="transaction-card__shares">
              <p className="transaction-card__section-title">Quote partecipanti</p>

              <ul className="transaction-card__shares-list">
                {participantsShares.map((share) => (
                  <li key={share.userId} className="transaction-card__share-item">
                    <span>{share.userName}</span>
                    <span>{formatCurrency(share.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="transaction-card__detail-row">
              <span className="transaction-card__meta-label">Nota:</span> {tx.note || 'Nessuna nota'}
            </p>

            {tx.editLogs && tx.editLogs.length > 0 && (
              <div className="transaction-card__edit-logs" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e9ecef' }}>
                <p className="transaction-card__section-title" style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '8px' }}>Cronologia modifiche</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: '#495057' }}>
                  {tx.editLogs.map((log, i) => (
                    <li key={i} style={{ marginBottom: '8px' }}>
                      <strong>{formatUserName(log.editedByUserId)}</strong> ha modificato: {log.changedFields.join(', ')}
                      <div style={{ fontSize: '0.75rem', color: '#adb5bd', marginTop: '2px' }}>
                        {new Date(log.editedAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </article>
    )
  }

  const fromName = formatUserName(tx.fromUserId)
  const toName = formatUserName(tx.toUserId)

  return (
    <article className={`transaction-card transaction-card--settlement ${isDeleted ? 'transaction-card--deleted' : ''}`} style={isDeleted ? { opacity: 0.7, filter: 'grayscale(100%)' } : {}}>
      {renderStatusBanner()}

      <div className="transaction-card__top">
        <span className="transaction-card__badge transaction-card__badge--settlement">
          Rimborso
        </span>

        <p className="transaction-card__amount">
          {formatCurrency(tx.amount)}
        </p>
      </div>

      <div className="transaction-card__main">
        <h3 className="transaction-card__title">{tx.description}</h3>

        <div className="transaction-card__meta">
          <p className="transaction-card__meta-item">
            <span className="transaction-card__meta-label">Da:</span> {fromName}
          </p>

          <p className="transaction-card__meta-item">
            <span className="transaction-card__meta-label">A:</span> {toName}
          </p>

          <p className="transaction-card__meta-item">
            <span className="transaction-card__meta-label">Data:</span> {formatDate(tx.date)}
          </p>
        </div>
      </div>

      <div className="transaction-card__actions">
        <button
          type="button"
          className="transaction-card__action-button"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? 'Nascondi dettagli' : 'Mostra dettagli'}
        </button>

        {canEditOrDelete && (
          <div className="transaction-card__owner-actions">
            <button
              type="button"
              className="transaction-card__icon-button"
              onClick={() => onEdit?.(tx.id)}
              title="Modifica"
              aria-label="Modifica"
            >
              <PencilIcon style={{ width: '16px', height: '16px' }} />
            </button>

            <button
              type="button"
              className="transaction-card__icon-button transaction-card__icon-button--danger"
              onClick={() => onDelete?.(tx.id)}
              title="Elimina"
              aria-label="Elimina"
            >
              <TrashIcon style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="transaction-card__details">
          <p className="transaction-card__detail-row">
            <span className="transaction-card__meta-label">Creata da:</span> {creatorName}
          </p>

          <p className="transaction-card__detail-row">
            <span className="transaction-card__meta-label">Nota:</span> {tx.note || 'Nessuna nota'}
          </p>

          {tx.editLogs && tx.editLogs.length > 0 && (
            <div className="transaction-card__edit-logs" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e9ecef' }}>
              <p className="transaction-card__section-title" style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '8px' }}>Cronologia modifiche</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: '#495057' }}>
                {tx.editLogs.map((log, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>
                    <strong>{formatUserName(log.editedByUserId)}</strong> ha modificato: {log.changedFields.join(', ')}
                    <div style={{ fontSize: '0.75rem', color: '#adb5bd', marginTop: '2px' }}>
                      {new Date(log.editedAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  )
}