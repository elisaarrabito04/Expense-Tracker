import React from 'react'
import './FallbackState.css'
import loadingIcon from '../assets/loading.svg'
import errorIcon from '../assets/error.svg'
import lockIcon from '../assets/lock.svg'
import inboxIcon from '../assets/inbox.svg'

type FallbackType = 'loading' | 'error' | 'empty' | 'unauthorized' | 'offline'

/**
 * Proprietà accettate dal componente FallbackState.
 * Permettono di sovrascrivere titolo e messaggio di default e di aggiungere un bottone di azione opzionale.
 */
type FallbackStateProps = {
  type: FallbackType
  title?: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * FallbackState è un componente UI generico e riutilizzabile.
 * Serve a comunicare all'utente stati non ideali o di transizione (caricamento, errori, assenza di dati, ecc.).
 */
export default function FallbackState({ type, title, message, action }: FallbackStateProps) {
  // Mappa di configurazione: definisce le icone e i testi di base per ogni 'FallbackType'
  const config = {
    loading: {
      icon: <img src={loadingIcon} alt="Caricamento..." style={{ width: '1em', height: '1em' }} />,
      defaultTitle: 'Caricamento in corso...',
      defaultMessage: 'Attendi un istante, stiamo recuperando i dati.'
    },
    error: {
      icon: <img src={errorIcon} alt="Errore" style={{ width: '1em', height: '1em' }} />,
      defaultTitle: 'Oops! Qualcosa è andato storto.',
      defaultMessage: 'Si è verificato un errore inaspettato.'
    },
    empty: {
      icon: <img src={inboxIcon} alt="Vuoto" style={{ width: '1em', height: '1em' }} />,
      defaultTitle: 'Nessun dato presente',
      defaultMessage: 'Non c\'è nulla da mostrare qui al momento.'
    },
    unauthorized: {
      icon: <img src={lockIcon} alt="Non autorizzato" style={{ width: '1em', height: '1em' }} />,
      defaultTitle: 'Accesso negato',
      defaultMessage: 'Devi essere autenticato per visualizzare questa pagina.'
    },
    offline: {
      icon: '📡',
      defaultTitle: 'Sei offline',
      defaultMessage: 'Controlla la tua connessione per visualizzare dati aggiornati.'
    }
  }

  // Estrapoliamo l'icona e i testi di default corrispondenti al tipo richiesto
  const { icon, defaultTitle, defaultMessage } = config[type]

  return (
    // Applichiamo una classe dinamica (es. fallback-state--error) per permettere stili CSS specifici per stato
    <div className={`fallback-state fallback-state--${type}`}>
      <div className="fallback-icon">{icon}</div>
      {/* Se il componente genitore passa un title o message custom, questi hanno la precedenza su quelli di default */}
      <h3 className="fallback-title">{title || defaultTitle}</h3>
      <p className="fallback-message">{message || defaultMessage}</p>
      {action && (
        <button className="submit-btn fallback-action-btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
