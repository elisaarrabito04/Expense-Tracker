import { useRef } from 'react'
import { useNotifications } from '../../context/NotificationsContext'
import { useTransactions } from '../../context/TransactionsContext'
import { useClickOutside } from '../../hooks/useClickOutside'
import type { AppNotification } from '../../types/types'
import './NotificationsDropdown.css'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function NotificationsDropdown({ isOpen, onClose }: Props) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications()
  const { userTransactions, knownParticipants } = useTransactions()
  const containerRef = useRef<HTMLDivElement>(null)

  // Chiude il dropdown cliccando fuori
  useClickOutside(containerRef, onClose, isOpen)

  if (!isOpen) return null

  const handleMarkAsRead = (notif: AppNotification) => {
    if (!notif.read) {
      // Rimuoviamo l'await! Altrimenti offline la navigazione si bloccherebbe
      // finché la promessa di Firestore non viene risolta dal server in background.
      markAsRead(notif.id).catch(err => console.error("Errore notifica letta in background", err))
    }
  }

  const getNotificationMessage = (notif: AppNotification) => {
    // Cerchiamo chi ha compiuto l'azione tra le persone che già conosciamo
    const actor = knownParticipants.find(p => p.id === notif.actorId)
    const actorName = actor ? actor.displayName : 'Un nuovo utente'
    const boldTitle = <strong>{notif.txTitle}</strong>

    // È uno sconosciuto se NON abbiamo transazioni ATTIVE in comune
    const isStranger = !userTransactions.some(tx => 
      tx.status === 'active' && tx.participantIds.includes(notif.actorId)
    )

    switch (notif.type) {
      case 'added':
        if (isStranger) return <><strong>Un nuovo utente</strong> ({actorName}) ti ha aggiunto alla transazione in attesa {boldTitle}.</>
        return <><strong>{actorName}</strong> ti ha aggiunto a {boldTitle}.</>
      case 'modified':
        return <><strong>{actorName}</strong> ha modificato {boldTitle}.</>
      case 'removed':
        return <><strong>{actorName}</strong> ti ha rimosso da {boldTitle}.</>
      case 'deleted':
        return <><strong>{actorName}</strong> ha eliminato {boldTitle}.</>
      case 'accepted':
        return <><strong>{actorName}</strong> ha accettato {boldTitle}.</>
      case 'rejected':
        return <><strong>{actorName}</strong> ha rifiutato {boldTitle}.</>
    }
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead().catch(err => console.error("Errore markAllAsRead", err))
  }

  return (
    <div className="notifications-dropdown" ref={containerRef}>
      <div className="notifications-header">
        <h4>Notifiche</h4>
        {notifications.length > 0 && notifications.some(n => !n.read) && (
          <button 
            type="button" 
            className="mark-all-read-btn"
            onClick={handleMarkAllAsRead}
          >
            Segna tutte come lette
          </button>
        )}
      </div>
      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div className="notifications-empty">Non hai nuove notifiche.</div>
        ) : (
          notifications.map(notif => (
            <div key={notif.id} className={`notification-item ${!notif.read ? 'unread' : ''}`}>
              <div className="notification-content">
                <p className="notification-text">{getNotificationMessage(notif)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleMarkAsRead(notif)}
                  title="Segna come letta"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#868e96', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}