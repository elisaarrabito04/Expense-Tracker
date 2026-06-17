# Attuali firestore rules (da modificare in base alle decisioni che prenderò)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isParticipant(docData) {
      return request.auth.uid in docData.participantIds;
    }

    // USERS
    match /users/{userId} {
      // Consentiamo la lettura pubblica per permettere al form di 
      // verificare se un nickname esiste prima della registrazione
      allow read: if true;
      // Solo l'utente stesso (proprietario del documento) può crearlo o modificarlo
      allow create, update: if isSignedIn() && request.auth.uid == userId;
      allow delete: if false; // Mai cancellare fisicamente un utente dal client
    }

    // TRANSACTIONS
    match /transactions/{transactionId} {
      // LETTURA: Consentita solo se l'utente loggato è nell'array participantIds
      allow read: if isSignedIn() && isParticipant(resource.data);

      // CREAZIONE: L'utente loggato deve essere il creatore e far parte dei partecipanti
      allow create: if isSignedIn() 
                    && request.auth.uid == request.resource.data.createdByUserId
                    && isParticipant(request.resource.data);

      // MODIFICA (Include l'Accettazione/Rifiuto e il Soft Delete):
      // Consentita solo se l'utente fa GIA' parte della transazione esistente.
      allow update: if isSignedIn() && isParticipant(resource.data);

      // ELIMINAZIONE FISICA: Disabilitata del tutto! 
      // L'app usa il "Soft Delete" (aggiornando il campo status a 'deleted').
      allow delete: if false;
    }

    // TAGS
    match /tags/{tagId} {
      // I tag sono globali: tutti gli utenti loggati possono cercarli (bottom sheet)
      allow read: if isSignedIn();
      
      // Tutti gli utenti loggati possono creare un nuovo tag
      allow create: if isSignedIn();

      // Evitiamo che un client modifichi o elimini un tag esistente, 
      // altrimenti romperebbe le visualizzazioni storiche degli altri utenti.
      allow update, delete: if false;
    }
  }
}


# AGGIUNGI:
Anche se permetti le operazioni offline, c'è un altro caso: cosa succede se Y tenta di modificare una spesa che X ha già cancellato (ed X era online, quindi il server sa già che è cancellata, ma per un micro-ritardo di rete Y sta ancora visualizzando il form)?

// Firestore Rules
match /transactions/{transactionId} {
  // Permetti l'aggiornamento solo se il documento ATTUALE non è 'deleted'
  allow update: if resource.data.status != 'deleted';
}

In questo modo, se Y tenta la modifica di una spesa già eliminata, la chiamata updateExpense restituirà un errore di permessi (che la tua UI potrà catturare dicendo "Errore: questa transazione è stata eliminata da un altro utente").