import { Navigate } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import FallbackState from '../FallbackState'

type Props = {
  children: ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  const { firebaseUser, currentUser, loading } = useAuth()

  // Unifichiamo le fasi di caricamento per evitare un cambio di testo ("sfarfallio").
  // Mostriamo un unico caricamento se:
  // 1. L'AuthContext sta ancora caricando in generale (loading === true)
  // 2. Oppure Firebase ha riconosciuto l'utente, ma il profilo app (currentUser) non è ancora stato scaricato
  if (loading || (firebaseUser && !currentUser)) {
    return <FallbackState type="loading" /> 
  }

  // Se non esiste un utente autenticato, torno alla pagina auth.
  if (!firebaseUser) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}