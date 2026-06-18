import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { subscribeToUserNotifications, markNotificationAsRead } from '../services/notificationsService'
import type { AppNotification } from '../types/types'

type NotificationsContextType = {
  notifications: AppNotification[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
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
    const unsubscribe = subscribeToUserNotifications(currentUser.id, setNotifications)
    return () => unsubscribe()
  }, [currentUser])

  // L'array 'notifications' contiene già solo le notifiche non lette grazie alla query Firestore
  const unreadCount = notifications.length

  const markAsRead = async (id: string) => {
    if (currentUser) await markNotificationAsRead(currentUser.id, id)
  }

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAsRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) throw new Error("useNotifications deve essere usato dentro NotificationsProvider")
  return context
}