import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AppNotification } from '../types/types'

export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void,
  onNewNotification?: (notification: AppNotification) => void,
  onInitialFetch?: (unreadCount: number) => void
) {
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(30)
  )

  let isInitialLoad = true;

  return onSnapshot(q, (snapshot) => {
    const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification))
    onUpdate(notifs)

    if (isInitialLoad) {
      if (onInitialFetch) onInitialFetch(notifs.length);
      isInitialLoad = false;
    } else if (onNewNotification) {
      snapshot.docChanges().forEach((change) => {
        const docType = change.doc.data().type;
        if (change.type === 'added' && ['added', 'accepted', 'rejected'].includes(docType)) {
          onNewNotification({ id: change.doc.id, ...change.doc.data() } as AppNotification)
        }
      })
    }
  })
}

// Segna come letta una singola notifica
export async function markNotificationAsRead(userId: string, notificationId: string) {
  const notifRef = doc(db, 'users', userId, 'notifications', notificationId)
  await updateDoc(notifRef, { read: true })
}

// Segna come lette tutte le notifiche passate
export async function markAllNotificationsAsRead(userId: string, notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  const batch = writeBatch(db);
  notificationIds.forEach(id => {
    const notifRef = doc(db, 'users', userId, 'notifications', id);
    batch.update(notifRef, { read: true });
  });
  await batch.commit();
}