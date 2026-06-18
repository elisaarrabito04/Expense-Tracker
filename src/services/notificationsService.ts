import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AppNotification } from '../types/types'

// Ascolta in tempo reale le ultime 30 notifiche dell'utente loggato
export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void
) {
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(30)
  )

  return onSnapshot(q, (snapshot) => {
    const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification))
    onUpdate(notifs)
  })
}

// Segna come letta una singola notifica
export async function markNotificationAsRead(userId: string, notificationId: string) {
  const notifRef = doc(db, 'users', userId, 'notifications', notificationId)
  await updateDoc(notifRef, { read: true })
}