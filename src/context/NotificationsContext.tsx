import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { subscribeToUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../services/notificationsService'
import type { AppNotification } from '../types/types'

type NotificationsContextType = {
  notifications: AppNotification[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  useEffect(() => {
    if (!currentUser) {
      setNotifications([])
      return
    }

    const handleNewNotification = async (notif: AppNotification) => {
      if (!('Notification' in window)) return
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      if (permission === 'granted') {
        const title = 'ExpenseTracker'
        
        let bodyText = `Nuova notifica: ${notif.txTitle}`
        if (notif.type === 'added') bodyText = `Sei stato aggiunto a una nuova transazione: ${notif.txTitle}`
        else if (notif.type === 'accepted') bodyText = `La transazione è stata accettata: ${notif.txTitle}`
        else if (notif.type === 'rejected') bodyText = `La transazione è stata rifiutata: ${notif.txTitle}`

        const options = {
          body: bodyText,
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
      }
    }

    const handleInitialFetch = async (unreadCount: number) => {
      // Se l'abbiamo già mostrata in questa sessione, non facciamo nulla
      if (sessionStorage.getItem('startupNotifShown')) return;

      // Segniamo subito che l'abbiamo controllata, in modo che non si ripeta
      sessionStorage.setItem('startupNotifShown', 'true')

      if (unreadCount > 0 && 'Notification' in window) {
        let permission = Notification.permission
        if (permission === 'default') {
          permission = await Notification.requestPermission()
        }
        if (permission === 'granted') {
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
        }
      }
    }

    const unsubscribe = subscribeToUserNotifications(
      currentUser.id, 
      setNotifications, 
      handleNewNotification,
      handleInitialFetch
    )
    return () => unsubscribe()
  }, [currentUser])

  // L'array 'notifications' contiene già solo le notifiche non lette grazie alla query Firestore
  const unreadCount = notifications.length

  const markAsRead = async (id: string) => {
    if (currentUser) await markNotificationAsRead(currentUser.id, id)
  }

  const markAllAsRead = async () => {
    if (currentUser) {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
      await markAllNotificationsAsRead(currentUser.id, unreadIds)
    }
  }

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) throw new Error("useNotifications deve essere usato dentro NotificationsProvider")
  return context
}