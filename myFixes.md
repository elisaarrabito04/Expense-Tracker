# ------------------------------------------------
# POSSIBILI FIXES
- potrei fare in modo che tot **tag esistano già di default**?
- navigate al profilo dopo **aggiorna modello**
- richiesta permesso notifiche solo se effettivamente arriva una notifica
- toglie righe di codice di retrocompatibilità per gestione notifiche vecchie senza "actorName" tra i campi (semplicemente cancello quelle vecchie non compatibili dal db)

# FIXED
- **cluster** ? Solo se ho più di 2 persone da suggerire (escluso il loggato)
- per usa/modifica di template che contengono utenti/tag sconosciuti si percepisce un rerender... altro modo per farlo? -> uso di **fallabackState** per il caricamento del prefetching (getuserbyid funziona perchè c'è la query in cache avendolo cercato online per la creazione del template)



**COSE DA FARE**
- a che servono i **includeAssets** in vitePWA nel vite config?
- a che serve **vite-env.d.ts** in src?

- funzionalità per **eliminare l'account**?
  
1) controlla cronologia appena ritorni online se inserisci una spesa offline
2) come sfruttare lo stato "Offline" di **fallbackstate** ??
3) perchè solo le **ultime 30 notifiche**? e se fossero di più?
4) perchè l'ordine è sfalsato nel feed ?

- INSERIRE NICKNAME PER DISTINGUERE EVENTUALI NOMI UGUALI ?? (non sono sicura di voler mostrare la mail)
  - devo aggiornare i filtri per fare in modo che l'utente cerchi anche per nickname e non solo per displayName
  - perchè campo nickname opzionale nel tipo AppUser se al momento della registrazione è obbligatorio?


# ----------------------------------------------
# POSSIBILI MODIFICHE
- **salvataggio per utente di tag/utenti/bilanci**, ma andrebbero aggiornati su firebase quando un utente fa una nuova spesa. Così per le tendine dei suggerimenti basterebbe leggere senza calcolare sullo storico.


# -----------------------------------------------
### Non necessariamente:
- messaggi esplicativi su sincronizzazione in corso/sospeso
- possibile modalità di **ripristino transazione eliminata**


# -----------------------------------------------
# FIXED:
1) loop nella preparazione del profilo post registrazione -> listener on snapshot nell'authContext
2) rimozione del campo id dai documenti tag/users/transactions e fare in modo di convertire quanto letto da firestore nell'oggetto di dominio che mi aspetto (cioè con il campo id, dato che torna utile nelle operazioni, per esempio nel caso di transaction mi serve per la url di modifica)
3) sincronizzazione in tempo reale con firestore al momento della modifica di una spesa, con sottoscrizione a eliminazione se mentre modifico qualcuno la elimina
4) Perchè uso comunque UseParams per passare da URL l'id della transazione da modificare:
   - Sfruttando location.state.initialTransaction eviti all'utente di dover aspettare i tempi di rete. Appena clicca su "Modifica", il form si presenta istantaneamente precompilato con i dati che la Home aveva già in cache.
   - Robustezza e Sicurezza (Fallabck): Mantenendo id nell'URL tramite useParams, crei una "rete di sicurezza". Se lo stato dovesse mancare (perché l'utente ha fatto refresh o è atterrato lì tramite link diretto), il tuo useEffect si accorge che transaction è null e va a ricaricare i dati freschi da Firestore usando proprio l'ID letto dall'URL (await getTransactionById(id!)).
5) introduzione di **transactionsContext** (contesto globale che benomale serve in tutte le pagine):
   - Firestore viene chiamato una sola volta da TransactionsContext.
   - I dati (transazioni, tag, utenti conosciuti) vengono scaricati e mantenuti aggiornati nella RAM di React.
   - Se tu navighi da Home a Analytics, il passaggio di pagina è istantaneo (0 millisecondi) perché Analytics non fa più il fetch, ma legge direttamente l'array dalla RAM tramite l'hook.
   - NOTA PATTERN **Normalized Cache** (avere un mega-contenitore globale con tutti i dati) combinato a **Derived State** (filtrare il contenitore localmente in base alla vista): le card hanno bisogno di poter mostrare anche i nomi degli sconosciuti (prelevandoli dai dati TOTALI forniti dal context globale), ma i filtri della Home, Analytics e i due form nelle tendine dei suggerimenti, hanno bisogno di filtrarli per mostrare solo quelli conosciuti (cioè delle transazioni active)
6) perchè non potrei scrivere notification con un array di destinatari invece di una notifica per ogni destinatario?
   - non potrei gestire facilmente le varie casistiche per mandare notifiche diverse (nuovo utente, rimosso, aggiunto ecc.)
   - con un dest sfrutto il fatto di poter interrogare direttamente la sottocollezione di quello user piuttosto che fare query particolari
7) perchè è servita la **collection user**? (al di là della sottocollezione notifications e templates)
   - Firebase Auth non è interrogabile, per esempio "dammi l'utente il cui nickname è x". L'DSK di Firebase Auth ti permette solo di ottenere i dati dell'utente attualmente loggato. Se avessi messo tra i miei dati (transazioni per esempio) oltre allo user ID anche il suo nickname avrei avuto problemi di consistenza ogni qualvolta l'utente avrebbe cambiato nickname
   - L'oggetto utente di Firebase Auth ha una struttura fissa: uid, displayName, email, photoURL, etc. Non puoi aggiungergli campi personalizzati come il nickname che hai giustamente voluto inserire per distinguere omonimi. Invece con la colletions in futuro potremmo aggiungere una biografia, le preferenze sulle notifiche, la valuta preferita, ecc. Questo rende l'app estensibile.
   - Anche qualora potessi listare tutti gli utenti da Auth, sarebbe una chiamata di rete separata, non ottimizzata e non gestita dalla cache offline di Firestore.
   - La nostra app ha bisogno di informazioni su un utente, sa che la fonte autorevole e completa è il documento in users, non l'oggetto Auth.

8) fallback "utente sconosciuto" se qualcuno cancella l'account? Anche se in realtà non ho implementato questa feature per cancellare l'account


  
# RICHIESTE
- Ho bisogno del tuo aiuto per avere una chiara **visione a 360 gradi** di tutto il mio codice in src, in modo da sapermi muovere tranquillamente qualora io voglia aggiungere/rimuovere qualcosa. Aiutami a capire le varie parti dell'applicazione, come si intrecciano tra di loro e perchè.
- se dovesse non esserci connessione (o fin dall'accesso in app o durante la sessione di utilizzo) come viene gestito attualmente?
- e se qualcuno modifica/elimina una transazione mentre è offline? come viene gestito? sarebbe meglio non consentirlo o no? **Se per esempio X la cancella ma offline e dunque Y ancora la visualizza e la modifica**?


# -----------------------------------------------
1) USO DI **TRANSACTION CONTEXT**:
   - crea **una sola connessione** in tempo reale (subscribeToTransactionsForUser) al tuo database. Tutti i componenti che leggono le transazioni si abbeverano da quest'unica fonte. Senza questo, rischieresti di fare chiamate multiple al database, moltiplicando i costi di lettura su Firebase/Firestore.
2) perchè nonostante il TransactionContext, i form/selectors prendono i dati via **prop**?
   - Passando la lista tramite props (knownUsers={knownParticipants}), rendi il componente "puro" (o **Dumb Component**): si limita a stampare a schermo quello che gli viene dato, risultando riutilizzabile ovunque nel progetto.
   - Spesso il componente genitore (es. la pagina che ospita il form) ha bisogno di manipolare i dati prima di darli in pasto al Form. Ad esempio AddTransaction manipola per ricavare un **DERIVED STATE**, cioè considerando SOLO le transazioni ACTIVE per le tendine dei form.