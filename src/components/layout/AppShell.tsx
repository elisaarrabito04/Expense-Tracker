import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import NavBar from './NavBar'
import { useNotifications } from '../../context/NotificationsContext'

export default function AppShell() {
  const { unreadCount } = useNotifications()

  useEffect(() => {
    const setupNotifications = async () => {
      // Se il browser non supporta le notifiche, non facciamo nulla
      if (!('Notification' in window)) return

      // Chiediamo il permesso nativo al browser se l'utente non ha mai scelto
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }

      // Se il permesso è garantito e ci sono notifiche non lette...
      if (permission === 'granted' && unreadCount > 0) {
        const hasShown = sessionStorage.getItem('startupNotifShown')
        
        // ...e se non l'abbiamo già mostrata in questa sessione
        if (!hasShown) {
          const title = 'ExpenseTracker'
          const options = {
            body: `Hai ${unreadCount} ${unreadCount === 1 ? 'nuova notifica' : 'nuove notifiche'} da leggere!`,
            icon: '/pwa-192x192.png',
            badge: '/favicon.svg',
          }

          // Usiamo il Service Worker per sparare la notifica (migliore su Android/PWA)
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options)).catch(() => new Notification(title, options))
          } else {
            new Notification(title, options)
          }
          
          sessionStorage.setItem('startupNotifShown', 'true')
        }
      }
    }

    setupNotifications()
  }, [unreadCount]) // L'effetto si riattiva quando il database scarica il numero di notifiche

  return (
    <div className="app-shell">
      <TopBar />

      <main className="app-content">
        <Outlet />
      </main>

      <NavBar />
    </div>
  )
}