# Expense Tracker - SAW Project

Applicazione web moderna per il tracciamento e la condivisione delle spese tra coinquilini, amici o gruppi di viaggio. Il progetto è stato sviluppato come esame universitario, puntando fortemente su architettura **Offline-First**, UX reattiva e tecnologie web moderne (PWA).

## 🚀 Caratteristiche Principali

- **Gestione Spese e Rimborsi:** Inserimento di spese condivise con divisione in quote (equa o personalizzata) e registrazione dei rimborsi (settlements).
- **Architettura Offline-First:** L'applicazione è completamente utilizzabile anche in assenza di rete. I dati vengono salvati localmente e sincronizzati in background con il server non appena la connessione torna disponibile.
- **Progressive Web App (PWA):** L'app può essere installata sui dispositivi (Desktop, iOS, Android) comportandosi come un'app nativa.
- **Aggiornamenti in Tempo Reale:** Grazie ai listener di Firebase, le modifiche apportate da altri utenti compaiono istantaneamente nel feed senza necessità di aggiornare la pagina.
- **Gestione "Self-Healing":** I form di inserimento gestiscono dinamicamente e in background il recupero dei dati mancanti (utenti o tag cancellati/sconosciuti), garantendo un'interfaccia sempre coerente.
- **Suggerimenti Intelligenti (Clustering):** Algoritmo predittivo che suggerisce gruppi storici di persone con cui l'utente spende più spesso, scremando dinamicamente i risultati in tempo reale (Progressive Disclosure).
- **Notifiche & Event Sourcing:** Sistema di notifiche strutturato per cristallizzare i dati nel database (NoSQL), garantendo coerenza storica degli eventi anche in caso di eliminazione degli account.

## 🛠️ Stack Tecnologico

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** CSS Vanilla (Mobile-first)
- **Backend / Database:** Firebase (Authentication, Firestore Database)
- **PWA:** Vite PWA Plugin

## ⚙️ Prerequisiti

Per avviare l'applicazione in locale, assicurati di avere installato:
- [Node.js](https://nodejs.org/) (versione 16.x o superiore raccomandata)
- `npm` o `yarn`

## 📦 Installazione e Avvio Locale

1. **Clona il repository:**
   ```bash
   git clone <URL_DEL_TUO_REPO>
   cd <NOME_DELLA_CARTELLA>
   ```

2. **Installa le dipendenze:**
   ```bash
   npm install
   ```

3. **Configurazione Firebase (Variabili d'ambiente):**
   Crea un file `.env` o `.env.local` nella root del progetto e inserisci le tue credenziali Firebase per permettere il collegamento al database. L'applicazione si aspetta le seguenti chiavi:
   ```env
   VITE_FIREBASE_API_KEY="tua-api-key"
   VITE_FIREBASE_AUTH_DOMAIN="tuo-project.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="tuo-project-id"
   VITE_FIREBASE_STORAGE_BUCKET="tuo-project.appspot.com"
   VITE_FIREBASE_MESSAGING_SENDER_ID="tuo-sender-id"
   VITE_FIREBASE_APP_ID="tuo-app-id"
   ```

4. **Avvia il server di sviluppo:**
   ```bash
   npm run dev
   ```
   L'app sarà accessibile all'indirizzo mostrato nel terminale (di base `http://localhost:5173`).

## 🧪 Note per il Test (Docente)

Per testare le peculiarità architetturali dell'applicazione, suggeriamo le seguenti simulazioni:

1. **Test Architettura Offline-First:**
   - Effettua l'accesso nell'app.
   - Apri i Chrome DevTools -> tab `Network` -> imposta la limitazione su `Offline`.
   - Crea una nuova spesa. Noterai che l'app risponde immediatamente e reindirizza alla home, salvando la transazione nella cache locale di Firestore.
   - Rimetti la rete su `Online`: Firestore invierà automaticamente i dati al server sincronizzando la spesa.
   
2. **Test Real-time e Reattività Multi-utente:**
   - Apri l'app su due finestre diverse (es. una normale e una in Incognito) effettuando l'accesso con due account differenti.
   - Da un account, crea una spesa includendo il secondo utente.
   - Verifica la ricezione istantanea della notifica e l'aggiornamento simultaneo del saldo e del feed nell'altra finestra, senza alcun refresh della pagina.

3. **Test Algoritmo Clustering:**
   - Assicurati di avere uno storico di spese con un gruppo specifico (es. Utente A, B e C assieme).
   - Clicca sul + per creare una nuova spesa. In basso vedrai i bottoni rapidi che suggeriscono il gruppo completo.
   - Seleziona manualmente solo l'Utente A: i suggerimenti si ricalcoleranno dinamicamente in tempo reale per mostrare solo i cluster che includono A.
