# ------------------------------------------------
# FIXES
- OPTIMISTIC UI -> necessario che la gestisca io o già firestore se ne occupa aggiornando subito la sua cache locale?

- potrei fare in modo che tot tag esistano già di default?



**COSE DA FARE**
1) potrei mettere un **badge** (tipo pallino rosso) nei filtri revisione/attesa quando ci sono ancora nuove transazioni (di cui è arrivata la notifica) da revisionare
2) Voglio implementare il controllo offline con navigator.onLine. Come posso mostrare il FallbackState type="offline" se perdo la connessione?
3) Fammi vedere come modificare ExpenseForm, SettlementForm e profile per risolvere il problema del "salvataggio in loop" offline per creazioni/modifiche di transazioni/profilo..
4) uso di fallbackstate per non modificare il nickname offline
5) Ottimo! Nel frattempo, come potrei mostrare un piccolo indicatore globale "Offline" da qualche parte nella navbar quando si perde la connessione?

- **COME GESTISCO MODIFICHE CONCORRENTI?**

- INSERIRE NICKNAME PER DISTINGUERE EVENTUALI NOMI UGUALI ?? (non sono sicura di voler mostrare la mail)
  - devo aggiornare i filtri per fare in modo che l'utente cerchi anche per nickname e non solo per displayName
  - perchè campo nickname opzionale nel tipo AppUser se al momento della registrazione è obbligatorio?

- Sistema di notifiche

- permessi firestore (rules) 

- coerenza tra i caricamenti nelle varie pagine


# ----------------------------------------------
# POSSIBILI MODIFICHE
- **cloud functions** per aggiornamento/lettura di un documento personale di ogni user per il calcolo del balance, invece di calcolarlo ogni volta date tutte le transazioni
  - può essere utile specialmente se, per scalabilità firestore, dovessi optare per non caricare tutte le transazioni in una volta, bensì tot alla volta (paginazione con "carica altre"). Quindi per i saldi in Home e Profilo serve leggere un documento apposito che però deve essere aggiornato a ogni aggiunta/modifica di transazione...
- **salvataggio per utente di tag/utenti conosciuti**, ma andrebbero aggiornati su firebase quando un utente fa una nuova spesa. Così per le tendine dei suggerimenti basterebbe leggere senza calcolare sullo storico.
- **refactoring**
  - la UI della divisione equa/custom dentro ExpenseForm.tsx (dalla riga 250 in poi circa) andrebbe separata in un <SplitManager participants={selectedParticipants} amount={numericAmount} splitType={splitType} ... />
- **in espenseform renderizzare i gli initial fields passandoli come unico stato nello useState**, senza usare useEffect su i dati initial



# -----------------------------------------------
### Non necessariamente:
- smart tags
- messaggi esplicativi su stato offline o sincronizzazione in corso/sospeso

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

  
# RICHIESTE
- Ho bisogno del tuo aiuto per avere una chiara **visione a 360 gradi** di tutto il mio codice in src, in modo da sapermi muovere tranquillamente qualora io voglia aggiungere/rimuovere qualcosa. Aiutami a capire le varie parti dell'applicazione, come si intrecciano tra di loro e perchè.
- se dovesse non esserci connessione (o fin dall'accesso in app o durante la sessione di utilizzo) come viene gestito attualmente?
- e se qualcuno modifica/elimina una transazione mentre è offline? come viene gestito? sarebbe meglio non consentirlo o no? Se per esempio X la cancella ma offline e dunque Y ancora la visualizza e la modifica?


# -----------------------------------------------
- **PWA e Offline First**: Avendo raggruppato tutto nei **Context**, se l'utente va offline l'app continua a mostrare la UI navigabile (Home, Analytics) basandosi sull'ultimo stato in memoria (e grazie anche alla **cache locale di Firestore**).
- 