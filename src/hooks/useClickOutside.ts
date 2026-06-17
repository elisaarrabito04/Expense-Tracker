import { useEffect } from 'react'

type OutsideClickEvent = MouseEvent | TouchEvent

export function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onClickOutside: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    // Se il dropdown non è aperto, non ha senso ascoltare click esterni.
    if (!enabled) {
      return
    }

    function handlePointerDown(event: OutsideClickEvent) {
      // Se il ref non punta ancora a nessun nodo DOM, usciamo.
      if (!ref.current) {
        return
      }

      // Recuperiamo il nodo su cui è avvenuto il click/touch.
      const targetNode = event.target as Node

      // Se il nodo cliccato NON è contenuto nel nostro elemento,
      // allora siamo fuori e chiamiamo la callback.
      if (!ref.current.contains(targetNode)) {
        onClickOutside()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    // Cleanup corretto: rimuoviamo i listener quando il componente si smonta
    // oppure quando enabled cambia.
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [ref, onClickOutside, enabled])
}