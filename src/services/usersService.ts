import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  limit,
  documentId,
  type DocumentData,
} from 'firebase/firestore'
import type { User as FirebaseUser } from 'firebase/auth'
import { db } from '../lib/firebase'
import type { AppUser } from '../types/types'

// Recupera gli id degli utenti che hanno già partecipato
// ad almeno una transazione con l'utente corrente.
// Serve per costruire suggerimenti rapidi nel form di inserimento spesa.
import { getKnownParticipantIdsForUser } from './transactionsService'

// ----------------------------
// HELPERS INTERNI
// ----------------------------

/**
 * Normalizza il display name:
 * - rimuove spazi iniziali e finali
 * - sostituisce sequenze di spazi multipli con un solo spazio
 *
 * Serve per evitare nomi salvati in modo incoerente,
 * ad esempio " Mario Rossi " -> "Mario Rossi".
 */
function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * Converte un oggetto generico letto da Firestore
 * in un oggetto conforme al tipo AppUser usato dall'app.
 *
 * È utile per avere un unico punto di mapping dei dati
 * e mantenere il codice più ordinato.
 *
 * Nota importante:
 * - in Firestore l'id sta nel document id, non nel payload
 * - per questo lo riceviamo separatamente come parametro `id`
 */
function toAppUser(id: string, data: DocumentData): AppUser {
  return {
    id,
    displayName: data.displayName,
    email: data.email,
    nickname: data.nickname,
    createdAt: data.createdAt,
  }
}

/**
 * Elimina eventuali duplicati da una lista di AppUser.
 *
 * Anche se getUsersByIds già riduce i duplicati sugli id in input,
 * questo helper aggiunge una protezione ulteriore sul risultato finale.
 *
 * È utile quando i dati arrivano da più passaggi o fonti diverse
 * e vuoi essere sicura di non mostrare la stessa persona due volte.
 */
function uniqueUsers(users: AppUser[]): AppUser[] {
  const seen = new Set<string>()

  return users.filter((user) => {
    if (seen.has(user.id)) return false
    seen.add(user.id)
    return true
  })
}

/**
 * Crea oppure aggiorna il documento utente dell'app nella collezione "users".
 *
 * Attenzione: questa funzione NON crea l'account di autenticazione Firebase.
 * L'account auth viene creato altrove.
 * Qui si salva invece il profilo applicativo dell'utente in Firestore.
 *
 * Con setDoc(..., { merge: true }):
 * - se il documento non esiste, viene creato
 * - se esiste già, vengono aggiornati solo i campi passati
 */
export async function createOrUpdateAppUser(params: {
  uid: string
  displayName: string
  email: string
  nickname?: string
}): Promise<AppUser> {
  const { uid, displayName, email, nickname } = params

  // Normalizza il nome da mostrare nell'app
  const normalizedDisplayName = normalizeDisplayName(displayName)
  const normalizedEmail = email.trim().toLowerCase()

  // Controlliamo se l'utente esiste già
  const existingUser = await getUserById(uid)

  if (existingUser) {
    // Se i dati sono identici, evitiamo scritture inutili su Firestore
    if (
      existingUser.displayName === normalizedDisplayName &&
      existingUser.email === normalizedEmail
    ) {
      return existingUser
    }

    // È un UPDATE: aggiorniamo solo i dati cambiati senza toccare `createdAt`
    const updates = {
      displayName: normalizedDisplayName,
      email: normalizedEmail,
    }
    if (nickname) {
      Object.assign(updates, { nickname: nickname.trim().toLowerCase() })
    }

    await setDoc(doc(db, 'users', uid), updates, { merge: true })
    return { ...existingUser, ...updates }
  }

  // È una CREATE
  // Costruisce l'oggetto utente nel formato previsto dall'app.
  // Non salviamo `id` nel documento perché l'id vero è già il path users/{uid}.
  const payload = {
    displayName: normalizedDisplayName,
    email: normalizedEmail,
    nickname: nickname ? nickname.trim().toLowerCase() : undefined,
    createdAt: new Date().toISOString(),
  }

  // Salva il nuovo documento nel path users/{uid}
  await setDoc(doc(db, 'users', uid), payload)

  return { id: uid, ...payload }
}

/**
 * Verifica se un nickname è già in uso.
 * Utile in fase di registrazione per garantire l'univocità.
 */
export async function isNicknameTaken(nickname: string): Promise<boolean> {
  const normalized = nickname.trim().toLowerCase()
  if (!normalized) return false

  const q = query(
    collection(db, 'users'),
    where('nickname', '==', normalized),
    limit(1)
  )
  
  const snap = await getDocs(q)
  return !snap.empty
}

/**
 * Si assicura che esista un profilo applicativo coerente
 * per l'utente autenticato da Firebase.
 *
 * Strategia:
 * - se il documento users/{uid} esiste già, lo usa come fonte di verità
 * - se non esiste, prova a crearlo usando i dati affidabili presenti in Auth
 * - se manca un displayName attendibile, NON inventa nomi provvisori
 *
 * Questo evita di sporcare Firestore con valori fittizi tipo "Utente"
 * e consente alla UI protetta di entrare solo quando il profilo è davvero pronto.
 */
export async function ensureAppUserFromAuth(
  firebaseUser: FirebaseUser
): Promise<AppUser | null> {
  const authDisplayName = firebaseUser.displayName?.trim()
  const authEmail = firebaseUser.email?.trim().toLowerCase()

  // Se manca un nome affidabile, meglio non creare un profilo incompleto.
  // In questo caso sarà la UI a decidere come gestire l'errore o il completamento profilo.
  if (!authDisplayName || !authEmail) {
    return null
  }

  return createOrUpdateAppUser({
    uid: firebaseUser.uid,
    displayName: authDisplayName,
    email: authEmail,
  })
}

// ----------------------------
// LETTURA
// ----------------------------

/**
 * Restituisce un utente dato il suo id.
 *
 * Se il documento non esiste, ritorna null.
 */
export async function getUserById(userId: string): Promise<AppUser | null> {
  const snapshot = await getDoc(doc(db, 'users', userId))

  if (!snapshot.exists()) return null

  return toAppUser(snapshot.id, snapshot.data())
}

/**
 * Recupera più utenti a partire da una lista di id.
 *
 * Perché non chiedere tutti gli utenti?
 * Perché nella maggior parte dei casi ci servono solo utenti specifici
 * (ad esempio partecipanti già noti), quindi è più efficiente lavorare
 * solo sugli id necessari.
 *
 * Inoltre Firestore impone limiti alla query con operatore "in",
 * quindi gli id vengono spezzati in blocchi da massimo 10.
 */
export async function getUsersByIds(userIds: string[]): Promise<AppUser[]> {
  if (userIds.length === 0) return []

  // Rimuove eventuali duplicati dagli id in input
  const uniqueIds = Array.from(new Set(userIds))
  const chunks: string[][] = []

  // Divide gli id in gruppi da 10 per compatibilità con where(..., 'in', ...)
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10))
  }

  // Esegue una query per ogni blocco e poi unisce i risultati.
  // Usiamo documentId() perché l'id del documento NON è salvato nel payload.
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(
        collection(db, 'users'),
        where(documentId(), 'in', chunk)
      )
      const snap = await getDocs(q)

      return snap.docs.map((d) => toAppUser(d.id, d.data()))
    })
  )

  return uniqueUsers(results.flat())
}

/**
 * Cerca utenti per prefisso sul displayName normalizzato in lowercase.
 *
 * Utile, ad esempio, quando nel form l'utente vuole aggiungere
 * un NUOVO PARTECIPANTE cercandolo per nome.
 *
 * excludeIds permette di escludere alcuni utenti dai risultati
 * (ad esempio utenti già selezionati nel form).
 */
export async function searchUsers(params: {
  queryText: string
  excludeIds?: string[] // per escludere il current eventualmente
  // utile per registrazione del rimborso, per impedire auto-rimborsi
  limitCount?: number
}): Promise<AppUser[]> {
  const { queryText, excludeIds = [], limitCount = 10 } = params
  const normalized = queryText.trim().toLowerCase()

  // Se il testo di ricerca è vuoto, non ha senso interrogare Firestore
  if (!normalized) return []

  // Ricerca ESATTA per nickname per prevenire spam da sconosciuti.
  // L'utente deve conoscere e inserire esattamente il nickname univoco.
  const q = query(
    collection(db, 'users'),
    where('nickname', '==', normalized),
    limit(limitCount)
  )

  const snap = await getDocs(q)

  // Converte i documenti e scarta eventuali utenti esclusi
  return snap.docs
    .map((d) => toAppUser(d.id, d.data()))
    .filter((user) => !excludeIds.includes(user.id))
}

// ----------------------------------------
// HELPERS PER SUGGERIMENTI PARTECIPANTI
// ----------------------------------------

/**
 * Restituisce gli utenti con cui l'utente corrente ha già interagito
 * in almeno una transazione.
 *
 * Flusso:
 * 1. recupera gli id dei partecipanti "noti" dalle transazioni
 * 2. carica i relativi documenti utente dalla collezione users
 * 3. rimuove eventuali duplicati
 *
 * Questa è una funzione molto utile per ExpenseForm:
 * permette di mostrare rapidamente persone già coinvolte in spese/rimborsi passati,
 * senza dover cercare ogni volta tra tutti gli utenti registrati.
 *
 * In ottica PWA/offline-first è anche una buona base per distinguere:
 * - partecipanti già noti e disponibili localmente
 * - nuovi partecipanti da cercare online nell'intero database
 */
export async function getKnownParticipantsForUser(
  userId: string
): Promise<AppUser[]> {
  // Recupera solo gli id delle persone con cui l'utente ha già avuto transazioni
  const knownIds = await getKnownParticipantIdsForUser(userId)

  // Converte quegli id nei rispettivi oggetti AppUser
  const users = await getUsersByIds(knownIds)

  // Restituisce la lista finale senza duplicati
  return uniqueUsers(users)
}