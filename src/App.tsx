import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/routing/ProtectedRoute'
import { TransactionProvider } from './context/TransactionsContext'
import Home from './pages/Home'
import AddTransaction from './pages/AddTransaction'
import EditTransaction from './pages/EditTransaction'
import Analytics from './pages/Analytics'
import Profile from './pages/Profile'
import AuthPage from './pages/AuthPage'

// dove non c'è path, allora la route corrisponde alla route padre (AppShell)
// e renderizza il componente specificato in element.
// index element indica che questa route è la route predefinita quando si accede
// alla route padre (AppShell) senza specificare un percorso aggiuntivo.

/*
Se un utente anonimo prova a digitare /home, /analytics o /profile,
viene immediatamente intercettato e rispedito a /auth.
Una volta inserite le credenziali corrette, Firebase aggiorna lo stato,
AuthContext bootstrapa anche il profilo applicativo e solo dopo
ProtectedRoute dà il via libera.
*/

function App() {
  return (
    <AuthProvider>
      <TransactionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/home" replace />} />
              <Route path="home" element={<Home />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="profile" element={<Profile />} />

              <Route path="add" element={<AddTransaction />} />
              <Route path="/transactions/:id/edit" element={<EditTransaction />} />
            </Route>

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </BrowserRouter>
      </TransactionProvider>
    </AuthProvider>
  )
}

export default App