import {
  setDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  doc,
  getDoc,
  where,
  limit,
  documentId,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Tag } from '../types/types'

const TAGS_COLLECTION = 'tags'

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

// HELPER LOCALE PER buildTagId
// Normalizza la label "umana" che l'utente scrive:
// - rimuove spazi iniziali/finali
// - compatta sequenze di spazi interni in un solo spazio
//
// Esempi:
// "  Spesa   settimanale " -> "Spesa settimanale"
function normalizeTagLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ')
}

// Costruisce l'id canonico del tag.
// In questa versione l'id del tag COINCIDE con la canonicalLabel.
//
// Esempi:
// "Casa" -> "casa"
// "Spesa settimanale" -> "spesa settimanale"
//
// Se più avanti vorrai usare slug senza spazi (es. "spesa-settimanale"),
// ti basterà cambiare SOLO questa funzione.
function buildTagId(label: string): string {
  return normalizeTagLabel(label).toLowerCase()
}


// Verifica che una stringa obbligatoria non sia vuota o composta solo da spazi.
function assertNonEmptyString(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`Il campo "${fieldName}" è obbligatorio.`)
  }
}


// HELPER PER MAPPARE UN DOCUMENTO NEL TIPO DI DOMINIO
// In Firestore il document id è già l'id del tag.
function mapDocToTag(snapshotId: string, snapshotData: Record<string, unknown>): Tag {
  return {
    id: snapshotId,
    label: String(snapshotData.label ?? ''),
  }
}


// -----------------------------------------------------------------------------
// LETTURA
// -----------------------------------------------------------------------------


// Recupera un tag conoscendone l'id (canonico).
// basta leggere il documento "tags/{tagId}" senza query aggiuntive.
export async function getTagById(tagId: string): Promise<Tag | null> {
  assertNonEmptyString(tagId, 'tagId')

  const normalizedTagId = buildTagId(tagId) 
  const snapshot = await getDoc(doc(db, TAGS_COLLECTION, normalizedTagId)) // prende il docRef

  if (!snapshot.exists()) {
    return null
  }

  // snapshot.data() restituisce il contenuto del documento come oggetto
  return mapDocToTag(snapshot.id, snapshot.data())
}


// Recupera più tag a partire dai rispettivi id.
// - elimina duplicati
// - ignora eventuali id non trovati
export async function getTagsByIds(tagIds: string[]): Promise<Tag[]> {
  if (tagIds.length === 0) return []

  const uniqueIds = Array.from(
    new Set(tagIds.map((id) => buildTagId(id))) // ottengo array di id normalizzati
  )

  // richieste in PARALLELO
  const results = await Promise.all(uniqueIds.map((id) => getTagById(id)))

  return results.filter((tag): tag is Tag => tag !== null)
}


// Ricerca tag per autocomplete.
export async function searchTags(params: {
  queryText: string
  limitCount?: number
}): Promise<Tag[]> {
  const { queryText, limitCount = 10 } = params

  const normalizedQuery = buildTagId(queryText)
  if (!normalizedQuery) return []

  // Filtro LATO SERVER per prefisso ("inizia per...") sfruttando l'id del documento
  // Il carattere '\uf8ff' è un trucco standard in Firebase per creare un limite superiore
  const q = query(
    collection(db, TAGS_COLLECTION),
    where(documentId(), '>=', normalizedQuery),
    where(documentId(), '<=', normalizedQuery + '\uf8ff'),
    limit(limitCount)
  )

  const snapshot = await getDocs(q)

  return snapshot.docs
    .map((docSnap) => mapDocToTag(docSnap.id, docSnap.data())) // mappo ogni doc nel tipo di dominio
    .sort((a, b) => a.label.localeCompare(b.label, 'it')) // potrei usare orderBy ma predisporre di un indice... ???
}

// -----------------------------------------------------------------------------
// CREATE / UPSERT
// -----------------------------------------------------------------------------

// Restituisce il tag se esiste già.
// Altrimenti lo crea.
//
// Nota importante:
// usiamo setDoc(doc(...)) e NON addDoc(...) perché vogliamo controllare direttamente il document id.
// Il document id infatti deve essere la canonicalLabel.
export async function getOrCreateTag(params: {
  label: string // di creazione
  createdByUserId: string
}): Promise<Tag> {
  const { label, createdByUserId } = params

  assertNonEmptyString(label, 'label')
  assertNonEmptyString(createdByUserId, 'createdByUserId')

  const normalizedLabel = normalizeTagLabel(label) // rimuovo spazi
  const tagId = buildTagId(normalizedLabel) // aggiunge lowercase

  const existingTag = await getTagById(tagId) // usa mapDoc per ritornare il tipo di
  if (existingTag) {
    return existingTag
  }

  const payload = {
    label: normalizedLabel,
    createdByUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  // specifico io l'id del documento da creare
  await setDoc(doc(db, TAGS_COLLECTION, tagId), payload)

  return {
    id: tagId,
    label: normalizedLabel,
  }
}


// Utility per risolvere una lista di label in una lista di Tag già esistenti
// oppure appena creati.
//
// Anche se ora nel dominio hai deciso che una transaction avrà un solo tag,
// questa funzione può restare utile in contesti generici o di migrazione.
// Se vuoi essere più coerente col nuovo dominio, puoi anche sostituirla
// con una funzione singola resolveTagFromLabel(...).
export async function resolveTagsFromLabels(params: {
  labels: string[]
  createdByUserId: string
}): Promise<Tag[]> {
  const { labels, createdByUserId } = params

  const uniqueNormalizedLabels = Array.from(
    new Set(
      labels
        .map((label) => normalizeTagLabel(label))
        .filter((label) => label.length > 0)
    )
  )

  const tags = await Promise.all(
    uniqueNormalizedLabels.map((label) =>
      getOrCreateTag({
        label,
        createdByUserId,
      })
    )
  )

  return tags
}