import { Link } from 'react-router-dom';
import BellIcon from '../../assets/bell.svg?react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import './TopBar.css';

export default function TopBar() {
  const isOffline = useNetworkStatus()

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
          <button
            type="button"
            className="top-bar__icon-button"
            aria-label="Notifiche"
          >
            <BellIcon className="top-bar__icon" />
          </button>
        </div>
      </div>
    </header>
  )
}