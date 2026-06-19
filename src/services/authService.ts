// FUNZIONI PER REGISTER / LOGIN / LOGOUT

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'

import { auth } from '../lib/firebase'
import { createOrUpdateAppUser, ensureAppUserFromAuth, isNicknameTaken } from './usersService'

// --------------------

/**
 * Registra un nuovo utente tramite email e password.
 * Dopo la creazione dell'account Firebase:
 * 1. aggiorna il profilo Firebase con il displayName
 * 2. crea o aggiorna il documento utente nell'app/Firestore
 *
 * Nota importante:
 * il nome inserito nel form è la fonte di verità iniziale.
 * Non vogliamo entrare nell'app con nomi provvisori o di fallback.
 */
export async function registerWithEmail(params: {
  displayName: string
  email: string
  password: string
  nickname: string
}) {
  const { displayName, email, password, nickname } = params

  const normalizedDisplayName = displayName.trim().replace(/\s+/g, ' ')
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedNickname = nickname.trim().toLowerCase()

  // Crea l'utente nel sistema di autenticazione Firebase
  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  )

  // Estrae l'oggetto User restituito da Firebase
  const firebaseUser = credential.user

  // Aggiorna il profilo autenticato aggiungendo il nome visibile dell'utente
  await updateProfile(firebaseUser, {
    displayName: normalizedDisplayName,
  })

  // Ricarica l'utente per avere il profilo Firebase aggiornato lato client
  await firebaseUser.reload()

  // Salva o aggiorna anche i dati utente lato applicazione
  // (nel mio caso in Firestore, nella collezione users)
  const appUser = await createOrUpdateAppUser({
    uid: firebaseUser.uid,
    displayName: normalizedDisplayName,
    nickname: normalizedNickname,
  })

  // Restituisce sia l'utente Firebase sia il profilo applicativo (sto sfruttando questa cosa per optimistic UI??)
  return {
    firebaseUser: auth.currentUser ?? firebaseUser,
    appUser,
  }
}

/**
 * Effettua il login di un utente esistente tramite email e password.
 *
 * Nota importante:
 * qui NON usiamo nomi di fallback tipo "Utente", perché rischieremmo
 * di salvare in Firestore un nome provvisorio e sbagliato.
 *
 * Il bootstrap vero del profilo applicativo viene gestito dall'AuthContext.
 * Se il profilo Firestore esiste già, verrà letto.
 * Se in futuro manca per qualche motivo, l'AuthContext potrà decidere come gestirlo.
 */
export async function loginWithEmail(params: {
  email: string
  password: string
}) {
  const { email, password } = params

  // Esegue l'accesso con credenziali email/password
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password
  )

  // Estrae l'utente autenticato dalla risposta di Firebase
  const firebaseUser = credential.user

  // Assicura che l'utente esista in Firestore e sincronizza 
  // eventuali modifiche di nome ed email avvenute da altri dispositivi
  // o tramite provider esterni.
  await ensureAppUserFromAuth(firebaseUser)

  // Restituisce l'utente autenticato
  return firebaseUser
}

/**
 * Effettua il logout dell'utente attualmente autenticato.
 */
export async function logout() {
  // Termina la sessione Firebase sul client
  await signOut(auth)
}


//---------------------------

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider()
  const userCredential = await signInWithPopup(auth, provider)
  
  // Garantisce che il profilo applicativo su Firestore venga creato 
  // in caso di primo accesso con Google
  await ensureAppUserFromAuth(userCredential.user)
  
  return userCredential.user
}

// ---------------------------

/**
 * Aggiorna il profilo dell'utente (displayName e nickname).
 * Controlla che il nuovo nickname, se cambiato, non sia già in uso.
 */
export async function updateUserProfile(params: {
  currentNickname?: string
  newDisplayName: string
  newNickname: string
}) {
  const { currentNickname, newDisplayName, newNickname } = params
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('Nessun utente autenticato.')
  }

  const normalizedDisplayName = newDisplayName.trim().replace(/\s+/g, ' ')
  const normalizedNickname = newNickname.trim().toLowerCase()

  // Se il nickname è stato modificato, verifichiamo che non sia già in uso
  if (normalizedNickname !== (currentNickname?.trim().toLowerCase() || '')) {
    const taken = await isNicknameTaken(normalizedNickname)
    if (taken) {
      throw new Error('Questo nickname è già in uso. Scegline un altro.')
    }
  }

  // 1. Aggiorna il profilo auth di Firebase (utile per coerenza su FirebaseAuth)
  await updateProfile(user, { displayName: normalizedDisplayName })

  // 2. Aggiorna il documento su Firestore, triggerando l'aggiornamento automatico nei Context
  return createOrUpdateAppUser({
    uid: user.uid,
    displayName: normalizedDisplayName,
    nickname: normalizedNickname,
  })
}