# PWA Expense Tracker
---

## Contesto del Progetto

Vorrei sviluppare una PWA per la condivisione delle spese tra amici, usando Vite + React. L'architettura deve abbandonare il concetto classico di "Gruppi Statici" in favore di una gestione più organica basata su **Cluster Dinamici di Partecipanti** (suggeriti dal sistema in base alla frequenza) e **Tag Semantici di contesto** (es. `#casa`, `#vacanza_roma`) che aggregano i saldi in viste virtuali.

Attualmente non mi serve che sia un'app responsive, ma vorrei focalizzarmi sul mobile layout, possibilmente con una navbar in basso fissa.

## Visione generale

L'idea non è una "app a gruppi statici", ma una web app di gestione spese e rimborsi in cui:

- le **transazioni** sono l'elemento centrale;
- i **partecipanti** vengono scelti al momento dell'inserimento della spesa;
- i **cluster** emergono come combinazioni frequenti di persone e servono a velocizzare l'inserimento dei partecipanti al momento della registrazione della spesa poiché il sistema li suggerisce;
- i **tag semantici di contesto** organizzano le transazioni in viste virtuali (es. `#Casa` o `#Londra2024`) e servono a dare significato e fare analisi.

Sui tag:

- esistono tag a livello globale dell'app e l'utente può scegliere tra quelli o crearne di nuovi al momento dell'inserimento della spesa;
- un tag come `#casa` può essere riusato da più persone, però ogni utente vede solo le transazioni in cui è coinvolto;
- il tag filtra e organizza, ma non amplia la visibilità oltre i propri movimenti: quindi, se qualcun altro usa `#casa` in una transazione dove tu non sei coinvolta, quella transazione **non** compare nel tuo feed né nelle tue analisi.

### Smart Tags

- **Smart Tags** (es. `#ricorrente`) che automatizzano la logica delle transazioni (su questi non ho ancora idee abbastanza chiare...).
- Uno smart tag può essere usato per precompilare automaticamente i campi di una spesa ricorrente al momento della sua registrazione.
- In una versione avanzata, gli smart tag possono attivare la generazione automatica di bozze o transazioni periodiche mediante funzioni schedulate Firebase.

Tradotto in modo pratico: l'utente non entra prima in un gruppo e poi inserisce una spesa; inserisce direttamente una spesa scegliendo persone e contesto, e l'app poi permette di navigare i dati per filtri.

## Schermata HOME

- Preview in alto della condizione finanziaria utente: saldo netto, devi, ti devono.
- Feed cronologico di spese e pagamenti, con filtri per persona, tag, tipo movimento (spese o rimborsi) e data.
- Mostro solo spese/rimborsi che lo riguardano.

Nel feed ogni card ha espansione inline leggera per non introdurre routing aggiuntivi:

- **Card chiusa**: titolo, importo, pagante, data, partecipanti compattati ("n persone"), tag, tipo di movimento (spesa o pagamento), menu contestuale per modifica/elimina (consentita solo al creatore del movimento).
- **Card aperta**: partecipanti completi con le rispettive quote, tipo di split (equa o custom), nota (opzionale al momento della registrazione), "modificata da/il".

Il feed resta quindi personale e centrato sui movimenti dell'utente.

## Schermata AGGIUNGI TRANSAZIONE

La prima selezione riguarda la scelta del tipo di movimento, a seguito della quale seguiranno due form distinti: uno per la spesa e uno per il pagamento, inteso come scambio di denaro tra due persone.

### Registrazione SPESA

Campi coinvolti al momento della registrazione della spesa (con check e avviso per quelli mandatory incompleti):

- importo;
- descrizione/titolo;
- tag di contesto (facoltativo);
- data;
- pagante evitabile perché è di default l'utente che sta registrando la spesa;
- partecipanti (pagante incluso di default ma rimovibile qualora la spesa non lo coinvolga e abbia solo anticipato i soldi);
- tipo split (con preview della quota equa e con possibilità di specificare le quote di ciascuno nel caso custom);
- smart tag predefiniti, come ad esempio `#ogniMese`, `#ogniSettimana`, `#ogniAnno`;
- note facoltative con "Aggiungi dettagli aggiuntivi...".

#### Tag di contesto

- Selezionabili tra quelli delle transazioni in cui già l'utente è stato coinvolto.
- Potrei mostrare max i primi `n` ed espandere per vederli tutti.
- Serebbe un input di ricerca + auto-complete, così da suggerire quelli esistenti
- è prevista la possibilità di cercarne nuovi, qualora quello che vuole inserire non è tra quelli già conosciuti. Si apre un bottom sheet con una barra di ricerca per cercare tra TUTTI quelli esistenti nell'app, con possibilità di crearne uno nuovo con un bottone "crea" che appare disabilitato finchè non viene inserito un tag che NON esiste già (con controllo case-insensitive e trim degli spazi).

I tag sono memorizzati con id la loro forma canonica normalizzata (es. `#casa`), ma possono essere visualizzati con la forma originale di creazione (es. `#Casa` o `#casa `) per dare un tocco più personale e umano, senza però creare duplicati.

#### Partecipanti

- Scelti da un elenco di persone selezionabili tra quelle con cui l'utente ha già condiviso almeno una spes (scelta multipla)
- Potrei mostrare max le prime `n` ed espandere su richiesta.
- E' prevista la possibilità di cercarne di NUOVI (come per i tag), qualora non abbia ancora mai avuto a che fare con loro in transazioni. Anche in questo caso un bottom sheet con barra di ricerca per cercare tra TUTTI gli utenti registrati nell'app, con possibilità di aggiungerli alla lista dei partecipanti alla spesa con bottone "aggiungi".

#### Cluster di partecipanti

Suggerimenti di cluster di partecipanti suggeriti dal sistema e ottenuti on demand a seconda dei partecipanti parziali inseriti nel form. Non sono gruppi statici, ma combinazioni frequenti di partecipanti e servono a velocizzare l'inserimento.

- Esempio 1: l'utente non seleziona alcun partecipante, ma vengono suggeriti X + Y per via di spese frequenti tra l'utente, X e Y.
- Esempio 2: l'utente seleziona W, quindi tra i suggerimenti scompaiono quelli che non lo riguardano.

Possibilità di aggiungere un nuovo partecipante cercandolo tra tutti gli utenti registrati nell'app; di conseguenza credo sia fattibile solo se si è online, mentre offline si possono selezionare solo persone già presenti localmente. Dopo la selezione, il partecipante compare nella sezione delle persone selezionabili.

#### Tipo split

- Può essere equo o custom.
- Qualora sia personalizzato, devono comparire le persone coinvolte selezionate con la possibilità di specificare l'importo di ciascuno.
- Serve un check per non sforare o inserire del tutto, nel complesso, la somma indicata nel campo `importo`.

### Registrazione PAGAMENTO

Campi coinvolti al momento della registrazione del pagamento (con check e avviso per quelli mandatory incompleti):

- i due utenti coinvolti nello scambio (`da` e `a`);
- importo;
- descrizione;
- data;
- note (facoltative).

La registrazione di spesa e pagamento comporta il reindirizzamento verso il feed della Home, dove sarà visibile la nuova aggiunta.

## Schermata ANALISI

Qui le idee sono un po' meno chiare.

- Info dell'utente: totale speso, numero spese in cui è coinvolto, media.
- Distribuzione delle spese che coinvolgono l'utente distinte per tag, con possibilità di filtrare per mese e anno (quelle senza tag categorizzate in "altro").
- Visualizzazione pie chart inerente alle spese che coinvolgono l'utente loggato, a seconda del filtro.

Possibili casi:

- **Tag selezionato**: distribuzione del numero di spese come pagante o somme pagate da parte di ciascuna delle persone con cui l'utente ha interagito con quel tag. Esempio: tag Casa, mostro che U1 è stato il pagante del 50% e U2 dell'altro 50%, oppure mostro la quantità spesa in qualità di pagante.
- **Tutti i tag**: distribuzione delle spese tra tutti i tag in cui l'utente è stato coinvolto. Esempio: tag Casa 80%, tag Londra 20%.

La cosa importante è che l'analisi non mostra il mondo globale di un tag, dato che possono usarli tutti gli utenti dell'app, ma sempre la porzione di dati che riguarda l'utente.

Eventuale grafico di andamento temporale, per esempio istogramma con quantitativo di spese effettuate in ogni mese, filtrando per anno.

## Schermata PROFILO

- Riepilogo saldi dell'utente: ti devono, devi (come nella Home), più numero persone con cui è in pari.
- Lista persone con saldi in sospeso.
- Logout.

Accanto alle persone con saldo in sospeso c'è il bottone `salda`; al click l'utente viene reindirizzato alla pagina `/add` di "Aggiungi transazione" con prefill dei campi del form per il rimborso, riconosciuto come registrazione di un pagamento. Non è necessario il controllo del tetto massimo saldabile.

Poi la conferma del saldo determina la registrazione di un pagamento (da parte mia se ero in debito o da parte della persona se ero in credito), che di conseguenza dovrà apparire anche nella cronologia dei movimenti della Home.

### Smart Tags nel profilo

- Sezione espandibile di transazioni di smart tags in cui l'utente è coinvolto, con possibilità di crearne di nuovi (idea ancora da chiarire).

## Gestione notifiche

L'app prevede l'invio di una notifica al momento dell'inserimento di:

- pagamento che coinvolga l'utente, tranne ovviamente se è lui stesso a inserirlo;
- spesa in cui è coinvolto l'utente, tranne ovviamente se è lui stesso a inserirla.


## REMINDERS
Ricorda che la versione finale della PWA prevede l’uso di firestore quindi vorrei che la logica verta verso quella direzione.
Inoltre essendo una PWA non devo perdere di vista l’idea di avere dati disponibili localmente per non dipendere troppo dallo stato online (sebbene dovrò decidere anche quali azioni sono permesse online e quali no o se permetterle lo stesso e lasciare che firestore sincronizzi una volta tornata la connessione).
Ricorda anche che voglio imparare, quindi sii chiaro e spiega bene le scelte che fai.
