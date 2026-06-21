export function getFirebaseErrorMessage(error: any): string {
  // Se non è un errore Firebase o non ha un codice, restituiamo il suo messaggio o un fallback
  if (!error || !error.code) {
    if (error instanceof Error) return error.message;
    return 'Si è verificato un errore imprevisto. Riprova.';
  }

  // Mappatura dei codici di errore Firebase ai messaggi in italiano
  switch (error.code) {
    case 'auth/invalid-email':
      return 'L\'indirizzo email non è valido.';
    case 'auth/user-disabled':
      return 'Questo account è stato disabilitato.';
    case 'auth/user-not-found':
      return 'Nessun account trovato con questa email.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Credenziali scorrette. Controlla email e password e riprova.';
    case 'auth/email-already-in-use':
      return 'Questa email è già associata a un account esistente.';
    case 'auth/weak-password':
      return 'La password è troppo debole (minimo 6 caratteri).';
    case 'auth/network-request-failed':
      return 'Errore di rete. Controlla la tua connessione internet.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi falliti. Riprova più tardi o reimposta la password.';
    case 'permission-denied':
      return 'Non hai i permessi necessari per eseguire questa operazione.';
    default:
      // Fallback per codici errore non esplicitamente mappati
      return `Errore: ${error.message || 'Si è verificato un errore.'}`;
  }
}
