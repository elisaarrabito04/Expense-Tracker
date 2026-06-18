import { useState, useEffect } from 'react'

// --- GESTIONE GLOBALE (Singleton) ---
// Queste variabili vivono fuori dai componenti React, quindi 
// esisteranno in una singola istanza per tutta l'applicazione.
let listeners: Array<(isOnline: boolean) => void> = []
let isInitialized = false
let currentStatus = navigator.onLine // ricorda sempre l'ultimo stato noto

function updateStatus(status: boolean) {
  currentStatus = status // aggiorno lo stato
  // Avvisiamo tutti i componenti iscritti del nuovo stato
  listeners.forEach(listener => listener(currentStatus)) // chiamo il listener SPECIFICO che nel suo corpo aggiornerà lo stato isOnline SPECIFICO
}

function initSystemListeners() {
  if (!isInitialized) {
    window.addEventListener('online', () => updateStatus(true))
    window.addEventListener('offline', () => updateStatus(false))
    isInitialized = true // così i listeners verranno agganciati al browser esattamente una sola volta (al montaggio del primissimo componente).
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(currentStatus) // stato di UNO SPECIFICO COMPONENTE

  useEffect(() => {
    // 1. Assicuriamoci che il browser stia ascoltando la rete.
    // (La funzione interna capirà da sola se è già stato fatto grazie a isInitialized)
    initSystemListeners()

    // 2. Iscriviamo LO SPECIFICO COMPONENTE alla lista di chi vuole ricevere gli aggiornamenti
    // con la sua FUNZIONE SPECIFICA
    const listener = (status: boolean) => setIsOnline(status)
    listeners.push(listener) // push nell'arra globale

    // 3. Cleanup: Quando il componente viene smontato, lo togliamo dalla lista
    return () => {
      listeners = listeners.filter(l => l !== listener)
    }
  }, [])

  return isOnline
}