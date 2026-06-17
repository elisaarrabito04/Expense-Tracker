/* DOVREI ANCORA INSERIRLO IN APP.TSX e usarlo nell'hook transactionsActions */

/*
  useCallback è un hook di ottimizzazione delle performance di React. Il suo scopo è mantenere in memoria (memoizzare) la stessa identica funzione tra un render e l'altro.
 In questo file, showAlert e showConfirm sono dichiarate dentro il componente DialogProvider. 
 Di norma, in React, ogni volta che un componente fa un re-render (ad esempio perché lo stato dialogState cambia per mostrare il popup), tutte le funzioni al suo interno vengono ricreate da zero.
 Se queste funzioni venissero ricreate ad ogni render del Provider, l'oggetto value cambierebbe riferimento in memoria ogni volta. Questo provocherebbe un re-render a cascata di 
 TUTTI i componenti della tua applicazione che usano l'hook useDialog(), anche se non c'entrano nulla con il popup in quel momento.
 Con l'array vuoto diciamo: "Crea questa funzione una volta sola al primo caricamento, e poi riusa sempre la stessa identica istanza per tutta la vita dell'applicazione".
  In questo modo il Context non fa scattare render inutili nei componenti figli. 
*/

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import '../Dialog.css'

type DialogType = 'alert' | 'confirm'

// per lo stato del dialog
type DialogOptions = {
  title: string
  message: string
  type: DialogType
  confirmText?: string
  cancelText?: string
}

// Definiamo cosa espone il nostro hook
type DialogContextType = {
  // Restituisce una Promise void: aspettiamo solo che l'utente clicchi "Ok"
  showAlert: (title: string, message: string, confirmText?: string) => Promise<void>
  // Restituisce una Promise boolean: aspettiamo di sapere se ha confermato (true) o annullato (false)
  showConfirm: (title: string, message: string, confirmText?: string, cancelText?: string) => Promise<boolean>
}

const DialogContext = createContext<DialogContextType | undefined>(undefined)

export function DialogProvider({ children }: { children: ReactNode }) {
  // Stato per i testi e il tipo di popup
  const [dialogState, setDialogState] = useState<DialogOptions | null>(null) // per sapere che tipo di popup mostrare
  
  // STATO PER LA PROMISE
  // Attenzione qui: in React, se passi una funzione dentro setState, React proverà a eseguirla.
  // Per salvare una funzione vera e propria nello stato, dobbiamo racchiuderla dentro un oggetto { resolve: ... }
  const [resolver, setResolver] = useState<{ resolve: (value: boolean) => void } | null>(null) // per sapere quale promise sbloccare quando l'utente clicca

  const showAlert = useCallback((title: string, message: string, confirmText = 'Ok') => {
    return new Promise<void>((resolve) => {
      setDialogState({ title, message, type: 'alert', confirmText })
      // "Trucco": castiamo il resolve di tipo void a boolean solo per usare un unico stato resolver.
      setResolver({ resolve: resolve as unknown as (value: boolean) => void })
    })
  }, [])

  const showConfirm = useCallback((title: string, message: string, confirmText = 'Conferma', cancelText = 'Annulla') => {
    return new Promise<boolean>((resolve) => {
      setDialogState({ title, message, type: 'confirm', confirmText, cancelText })
      setResolver({ resolve })
    })
  }, [])


  // Se l'utente conferma, risolviamo la Promise con "true"
  const handleConfirm = () => {
    if (resolver) resolver.resolve(true) // sblocco la promise con il valore che deve ritornare
    closeDialog()
  }

  // Se l'utente annulla, risolviamo la Promise con "false"
  const handleCancel = () => {
    if (resolver) resolver.resolve(false) // sblocco la promise con il valore che deve ritornare
    closeDialog()
  }

  const closeDialog = () => {
    setDialogState(null)
    setResolver(null)
  }

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Il markup del Dialog viene renderizzato globalmente, fuori dai singoli componenti! */}
      {dialogState && (
        <div className="dialog-overlay">
          <div className="dialog-box" role="dialog" aria-modal="true">
            <h3 className="dialog-title">{dialogState.title}</h3>
            <p className="dialog-message">{dialogState.message}</p>
            
            <div className="dialog-actions">
              {/* Se è un 'confirm', mostriamo il tasto annulla */}
              {dialogState.type === 'confirm' && (
                <button className="dialog-btn dialog-btn--cancel" onClick={handleCancel}>
                  {dialogState.cancelText}
                </button>
              )}
              
              {/* Tasto principale, usato sia per 'alert' che per 'confirm' */}
              <button className="dialog-btn dialog-btn--confirm" onClick={handleConfirm}>
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

// Custom hook per usare facilmente il Dialog nei componenti
export function useDialog() {
  const context = useContext(DialogContext)
  if (context === undefined) {
    throw new Error('useDialog deve essere usato all\'interno di un DialogProvider')
  }
  return context
}