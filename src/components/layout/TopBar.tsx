import { useState } from 'react';
import BellIcon from '../../assets/bell.svg?react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useNotifications } from '../../context/NotificationsContext';
import NotificationsDropdown from './NotificationsDropdown';
import './TopBar.css';

export default function TopBar() {
  const isOnline = useNetworkStatus()
  const isOffline = !isOnline
  
  const { unreadCount } = useNotifications()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  return (
    <header className="top-bar">
      <div className="top-bar__inner">
        <h1 className="top-bar__title">ExpenseTracker</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isOffline && (
            <div title="Sei offline" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: '#ffe3e3', color: '#c92a2a',
              padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600
            }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#e03131', borderRadius: '50%', display: 'inline-block' }}></span>
              Offline
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="top-bar__icon-button"
              aria-label="Notifiche"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ position: 'relative' }}
            >
              <BellIcon className="top-bar__icon" />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '0', right: '0',
                  backgroundColor: '#e03131', color: 'white',
                  fontSize: '0.65rem', fontWeight: 'bold',
                  minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%', transform: 'translate(25%, -25%)'
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationsDropdown isOpen={isDropdownOpen} onClose={() => setIsDropdownOpen(false)} />
          </div>
        </div>
      </div>
    </header>
  )
}