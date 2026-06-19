import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { ensureAppUserFromAuth } from '../services/usersService'
import type { AppUser } from '../types/types'

type AuthContextType = {
  firebaseUser: FirebaseUser | null
  currentUser: AppUser | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Se c'era un listener Firestore precedente attivo, puliscilo per evitare memory leaks
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot()
        unsubscribeSnapshot = undefined
      }

      setFirebaseUser(user)

      if (!user) {
        setCurrentUser(null)
        setLoading(false)
        return
      }

      // Mettiamo in loading mentre aspettiamo la risposta da Firestore
      setLoading(true)

      // Ascoltiamo il documento utente in tempo reale.
      // Questo disaccoppia la UI asincrona dalle tempistiche di registrazione e risolve la Race Condition.
      unsubscribeSnapshot = onSnapshot(
        doc(db, 'users', user.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data()
            setCurrentUser({
              id: snapshot.id,
              displayName: data.displayName,
              email: user.email || undefined, // recuperata da Auth
              nickname: data.nickname,
              createdAt: data.createdAt,
            })
            setLoading(false) // Il profilo è pronto, sblocchiamo la UI
          } else {
            // Il documento non esiste ancora: probabilmente siamo nel mezzo del flusso di registrazione
            // authService sta per completare la scrittura. Nel frattempo manteniamo la schermata in caricamento.
            // Come rete di sicurezza per DB sporchi usiamo l'helper (che si arresta da solo se auth incompleto):
            ensureAppUserFromAuth(user).catch(console.error)
          }
        },
        (error) => {
          console.error('Errore AuthProvider nel listener utente:', error)
          setCurrentUser(null)
          setLoading(false)
        }
      )
    })

    return () => {
      unsubscribe()
      if (unsubscribeSnapshot) unsubscribeSnapshot()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}