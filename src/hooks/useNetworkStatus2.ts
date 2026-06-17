import { useSyncExternalStore } from 'react'

// --- GESTIONE GLOBALE (Singleton) ---
// Queste variabili vivono fuori dai componenti React, quindi 
// esisteranno in una singola istanza per tutta l'applicazione.

let listeners: Array<() => void> = [] // lista iscritti (ogni componente che usa l'hook)
let isInitialized = false

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  // Al primo componente che si iscrive, attacchiamo i listener al browser
  if (!isInitialized) {
    window.addEventListener('online', emitChange)
    window.addEventListener('offline', emitChange)
    isInitialized = true
  }

  listeners.push(listener)

  // Funzione di cleanup quando il componente viene smontato
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot() {
  // Ritorna lo stato attuale (true se offline, false se online)
  return !navigator.onLine
}

export function useNetworkStatus() {
  // React 18 Hook: collega in modo efficiente uno store esterno 
  // (in questo caso lo stato della rete) ai componenti React.
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}