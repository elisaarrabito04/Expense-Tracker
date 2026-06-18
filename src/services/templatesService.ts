import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { ExpenseTransaction } from '../types/types'

// I template vivono in una sottocollezione privata dell'utente: users/{userId}/templates
function getTemplatesCollection(userId: string) {
  return collection(db, 'users', userId, 'templates')
}

// Recupera tutti i template di un utente
export async function getTemplatesForUser(userId: string): Promise<ExpenseTransaction[]> {
  const q = query(getTemplatesCollection(userId), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  
  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  })) as ExpenseTransaction[]
}

// Verifica se un template con la stessa descrizione esiste già
export async function checkTemplateExists(userId: string, description: string): Promise<boolean> {
  const q = query(getTemplatesCollection(userId), where('description', '==', description))
  const snapshot = await getDocs(q)
  return !snapshot.empty
}

// Crea un nuovo template
export async function createTemplate(
  userId: string,
  templateData: Omit<ExpenseTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const templatesRef = getTemplatesCollection(userId)
  const newTemplateRef = doc(templatesRef) // Genera un ID automatico
  
  const payload = {
    ...templateData,
    status: 'template',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  
  await setDoc(newTemplateRef, payload)
}

// Aggiorna un template esistente
export async function updateTemplate(
  userId: string,
  templateId: string,
  updatedData: Partial<ExpenseTransaction>
): Promise<void> {
  const templateRef = doc(db, 'users', userId, 'templates', templateId)
  
  await setDoc(templateRef, {
    ...updatedData,
    updatedAt: serverTimestamp()
  }, { merge: true })
}

// Elimina un template
export async function deleteTemplate(userId: string, templateId: string): Promise<void> {
  const templateRef = doc(db, 'users', userId, 'templates', templateId)
  await deleteDoc(templateRef)
}