import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import NavBar from './NavBar'
import { useNotifications } from '../../context/NotificationsContext'

export default function AppShell() {
  const { unreadCount } = useNotifications()

  useEffect(() => {
    const setupNotifications = async () => {
      if (!('Notification' in window)) return

      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }

      if (permission === 'granted' && unreadCount > 0) {
        const hasShown = sessionStorage.getItem('startupNotifShown')
        
        if (!hasShown) {
          const title = 'ExpenseTracker'
          const options = {
            body: `Hai ${unreadCount} ${unreadCount === 1 ? 'nuova notifica' : 'nuove notifiche'} da leggere!`,
            icon: '/pwa-192x192.png',
            badge: '/favicon.svg',
          }

          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
              if (reg) {
                reg.showNotification(title, options).catch(() => new Notification(title, options))
              } else {
                new Notification(title, options)
              }
            }).catch(() => new Notification(title, options))
          } else {
            new Notification(title, options)
          }
          
          sessionStorage.setItem('startupNotifShown', 'true')
        }
      }
    }

    setupNotifications()
  }, [unreadCount])

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