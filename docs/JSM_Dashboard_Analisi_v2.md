# Analisi funzionale e tecnica
## JSM Ops Dashboard — monitoraggio operativo e intelligence per PM

| Metadato | Valore |
| :--- | :--- |
| **Progetto** | JSM Ops Dashboard |
| **Versione** | 2.0 — Specifiche per MVP a 1 settimana |
| **Stato** | Analisi funzionale e tecnica di dettaglio |
| **Autore** | Diego Usai (CTO SiMaggioli) |
| **Modalità operativa** | **Read-only sidecar** (nessuna scrittura su Jira) |
| **Piattaforma sorgente** | Atlassian Jira Service Management Cloud — edizione **Premium** |
| **Motore LLM** | Google **Gemini 2.5 Flash** via **Vertex AI** (regione Europa) |
| **Database** | **PostgreSQL** 16+ con supporto **JSONB** (Vercel Postgres / **Neon**) |
| **Hosting** | **Vercel** — architettura **serverless** (Next.js API Routes) |
| **Privacy** | Pseudonimizzazione dei dati utente; metriche agenti solo aggregate per team |

---

## 1. Problema e contesto

### 1.1 Il problema del PM oggi

Il **Project Manager** che gestisce contratti di servizio su **Jira Service Management** non ha un modo rapido per rispondere a cinque domande operative fondamentali:

| # | Domanda | Cosa manca oggi |
|---|---------|----------------|
| 1 | **I ragazzi stanno gestendo bene i ticket o sto per avere un problema?** | Non esiste un indicatore composito: il PM deve aprire più board, contare manualmente, incrociare dati |
| 2 | **Gli SLA sono rispettati?** | JSM mostra lo stato puntuale dello **SLA** ma non la proiezione: non dice "questo ticket sforerà tra 2 ore se non lo prendi" |
| 3 | **Gli utenti chiave che hanno aperto un ticket sono stati gestiti subito?** | Non c'è una lista **VIP** con soglie dedicate; tutti i ticket hanno la stessa visibilità |
| 4 | **Questo ticket è unico o correlato ad altri degli ultimi 30 giorni?** | La ricerca **Jira** è testuale e per campo; non c'è raggruppamento semantico |
| 5 | **Devo intervenire adesso o posso aspettare?** | Non esiste un **Risk Score** composito che correli urgenza, cliente, trend e stato **SLA** |

### 1.2 Perché non basta ciò che esiste

- **Atlassian Intelligence** (incluso in Premium) offre **sentiment analysis** nativa sui singoli ticket, ma non la correla con **SLA**, storico e peso del cliente. È un dato puntuale, non un indicatore operativo.
- **Atlassian Analytics** ed **eazyBI** risolvono il reporting statico ma non la proiezione, il clustering semantico e il **Risk Score** composito.
- Nessun prodotto di mercato conosce il dominio SiMaggioli: quali clienti sono strategici, quali contratti hanno soglie **SLA** diverse, quali pattern di ticket indicano un problema sistemico.

### 1.3 Posizionamento

L'applicazione nasce come **strumento interno** per i PM di SiMaggioli, con un'architettura che non preclude la trasformazione in **asset riusabile** (multi-tenant, configurabile per cliente).

### 1.4 Volumi e finestra temporale

| Parametro | Valore |
|-----------|--------|
| Ticket giornalieri | 70–100 |
| Finestra storica disponibile | ~20 mesi |
| Ticket totali stimati | ~42.000–60.000 |
| Corrispondenza **SLA** Jira ↔ contrattuale | Confermata |

---

## 2. Architettura

### 2.1 Principio: sidecar read-only

L'applicazione non scrive, non modifica stati e non compila campi in Jira. Riceve dati tramite **webhook** ed esegue chiamate **REST API** esclusivamente in lettura (`GET`). Il dato vive nel database proprietario della piattaforma.

### 2.2 Diagramma dell'architettura

```
┌─────────────────────────────────────────────────────────────────┐
│                  Jira Service Management Cloud                  │
│                    (Premium — simaggioli.atlassian.net)          │
└────────┬────────────────────────────────────────────────────────┘
         │                                           ▲
         │ 1. Webhook Events                         │ 3. GET on-demand
         │ (issue_created,                           │ (SLA, org, campi custom)
         │  issue_updated,                           │ ── solo quando il PM
         │  comment_created)                         │    apre la dashboard
         ▼                                           │
┌──────────────────────────────────── Vercel ─────────────────────┐
│                                                                 │
│  ┌─────────────────────┐          ┌─────────────────────┐      │
│  │  /api/webhook        │          │  /api/sla            │      │
│  │  (serverless fn)     │          │  (serverless fn)     │      │
│  │  • verifica firma    │          │  • GET SLA live      │      │
│  │  • normalizzazione   │          │  • proiezione sfora- │      │
│  │  • pseudonimizzaz.   │          │    mento             │──────┘
│  │  • VIP detection     │          │  • cache 60s         │
│  └────────┬─────────────┘          └─────────▲───────────┘
│           │                                  │
│           │ 2. Persistenza                   │ 4. Richiesta dal
│           ▼                                  │    frontend
│  ┌─────────────────────────────────────────────────────────────┐│
│  │           Vercel Postgres (Neon) — PostgreSQL 16+           ││
│  │  tickets │ comments │ sla_snapshots │ vip_rules │ metrics   ││
│  └─────────────────────────────────────────────────────────────┘│
│           │                                  │                  │
│           ▼                                  │                  │
│  ┌──────────────────┐        ┌───────────────┴────────────────┐│
│  │  /api/alert       │        │  Next.js Frontend (React)      ││
│  │  → MS Teams       │        │  • semaforo di salute          ││
│  │    Adaptive Card  │        │  • SLA tracker                 ││
│  └──────────────────┘        │  • backlog aging               ││
│                               │  • trend volume                ││
│  ┌──────────────────┐        └────────────────────────────────┘│
│  │  Gemini 2.5 Flash │ ◄── solo fase 2 (clustering)           │
│  │  (Vertex AI — EU) │                                         │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

**Flusso principale:**
1. **Webhook** → la serverless function `/api/webhook` riceve l'evento, verifica la firma HMAC, normalizza, pseudonimizza e persiste su Vercel Postgres
2. **Dashboard load** → il frontend chiama `/api/sla` che esegue `GET` live verso Jira per i dati **SLA** dei ticket aperti, calcola le proiezioni e risponde (cache 60 secondi)
3. **Nessun polling in background** → architettura puramente serverless, nessun processo persistente

### 2.3 Nota su Slack/Teams

Considerata la migrazione in corso da **Slack** a **Teams** nella BU Documentale, gli alert vanno configurati per **Microsoft Teams** tramite **Incoming Webhook** o **Adaptive Card**. Il canale Slack resta come fallback fino al completamento della migrazione.

---

## 3. Modello dati

### 3.1 Schema relazionale (PostgreSQL)

```sql
-- Ticket normalizzato
CREATE TABLE tickets (
    id              BIGSERIAL PRIMARY KEY,
    jira_key        VARCHAR(20) UNIQUE NOT NULL,  -- es. "SD-12345"
    jira_id         BIGINT UNIQUE NOT NULL,
    project_key     VARCHAR(10) NOT NULL,
    summary         TEXT NOT NULL,
    description_hash TEXT,                         -- hash del testo, non il testo
    status          VARCHAR(50) NOT NULL,
    priority        VARCHAR(20),
    issue_type      VARCHAR(50),
    assignee_team   VARCHAR(100),                  -- team, MAI singolo agente
    reporter_pseudo VARCHAR(64),                   -- pseudonimo dell'utente
    organization_id VARCHAR(64),                   -- Customer Organization JSM
    organization_name VARCHAR(200),
    is_vip          BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    resolved_at     TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    custom_fields   JSONB DEFAULT '{}',            -- campi custom flessibili
    raw_webhook     JSONB,                         -- payload originale (per debug)
    ingested_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot SLA (uno per ticket per tipo SLA per fetch on-demand)
CREATE TABLE sla_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT REFERENCES tickets(id),
    sla_name        VARCHAR(100) NOT NULL,         -- "Time to first response", "Time to resolution"
    status          VARCHAR(20) NOT NULL,           -- "ONGOING", "PAUSED", "BREACHED", "COMPLETED"
    elapsed_ms      BIGINT,
    remaining_ms    BIGINT,                         -- NULL se breached
    breached        BOOLEAN DEFAULT FALSE,
    goal_ms         BIGINT,                         -- durata target
    projected_breach_at TIMESTAMPTZ,               -- calcolato: now() + remaining_ms
    captured_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Commenti (testo pseudonimizzato)
CREATE TABLE comments (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT REFERENCES tickets(id),
    jira_comment_id BIGINT UNIQUE NOT NULL,
    author_team     VARCHAR(100),                  -- team, non persona
    is_public       BOOLEAN NOT NULL,              -- jsdPublic
    body_pseudo     TEXT,                           -- testo con nomi sostituiti
    body_hash       VARCHAR(128),                  -- hash per dedup
    created_at      TIMESTAMPTZ NOT NULL
);

-- Cluster semantici (prodotti da Gemini)
CREATE TABLE clusters (
    id              BIGSERIAL PRIMARY KEY,
    cluster_label   VARCHAR(200) NOT NULL,         -- etichetta generata dal LLM
    cluster_summary TEXT,
    first_seen_at   TIMESTAMPTZ NOT NULL,
    last_seen_at    TIMESTAMPTZ NOT NULL,
    ticket_count    INTEGER DEFAULT 1,
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE ticket_clusters (
    ticket_id       BIGINT REFERENCES tickets(id),
    cluster_id      BIGINT REFERENCES clusters(id),
    similarity_score FLOAT,
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (ticket_id, cluster_id)
);

-- Risk Score (calcolato periodicamente)
CREATE TABLE risk_scores (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT REFERENCES tickets(id),
    score           FLOAT NOT NULL,                -- 0.0 (tranquillo) → 1.0 (critico)
    components      JSONB NOT NULL,                -- dettaglio: {"sla": 0.8, "vip": 0.3, ...}
    computed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Regole VIP
CREATE TABLE vip_rules (
    id              BIGSERIAL PRIMARY KEY,
    organization_id VARCHAR(64),
    organization_name VARCHAR(200),
    reporter_pattern VARCHAR(200),                 -- pattern per match su reporter
    priority_boost  FLOAT DEFAULT 0.3,             -- quanto alza il Risk Score
    max_first_response_ms BIGINT,                  -- soglia personalizzata
    notes           TEXT,
    active          BOOLEAN DEFAULT TRUE
);

-- Metriche aggregate per team (per la vista PM)
CREATE TABLE team_metrics_daily (
    id              BIGSERIAL PRIMARY KEY,
    team_name       VARCHAR(100) NOT NULL,
    metric_date     DATE NOT NULL,
    tickets_opened  INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    avg_first_response_ms BIGINT,
    avg_resolution_ms BIGINT,
    sla_breach_count INTEGER DEFAULT 0,
    backlog_size    INTEGER DEFAULT 0,
    risk_score_avg  FLOAT,
    UNIQUE (team_name, metric_date)
);

-- Indici principali
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_org ON tickets(organization_id);
CREATE INDEX idx_tickets_created ON tickets(created_at);
CREATE INDEX idx_tickets_vip ON tickets(is_vip) WHERE is_vip = TRUE;
CREATE INDEX idx_sla_ticket ON sla_snapshots(ticket_id, captured_at DESC);
CREATE INDEX idx_sla_breach ON sla_snapshots(breached) WHERE breached = TRUE;
CREATE INDEX idx_risk_ticket ON risk_scores(ticket_id, computed_at DESC);
CREATE INDEX idx_comments_ticket ON comments(ticket_id);
```

### 3.2 Pseudonimizzazione

| Dato originale | Trattamento | Dove vive la corrispondenza |
|----------------|-------------|----------------------------|
| Nome e email del reporter | Sostituiti con `HMAC-SHA256(email, secret)` troncato a 16 char | Tabella `pseudo_mapping` separata, accesso ristretto |
| Nome agente | Sostituito con il nome del **team** di appartenenza | Mappatura team in configurazione |
| Testo dei commenti | Nomi e email nel body sostituiti con pseudonimi prima di invio a **Gemini** | Regex + dizionario runtime |
| **Customer Organization** | Mantenuta: è un dato aziendale (B2B), non personale | — |

---

## 4. Requisiti funzionali

### 4.1 MVP — settimana 1 (must-have)

#### RF-01: Dashboard di stato operativo

Vista principale con i seguenti elementi:

| Componente | Descrizione | Fonte dati |
|------------|-------------|------------|
| **Semaforo di salute** | Indicatore globale verde/giallo/rosso basato su: % SLA rispettati, backlog aging, trend | `sla_snapshots` + `tickets` |
| **SLA a rischio** | Lista dei ticket con `remaining_ms` < soglia (configurabile, default 2h) ordinati per urgenza | `sla_snapshots` |
| **Ticket VIP aperti** | Ticket da organizzazioni/utenti VIP non ancora risolti, con tempo trascorso | `tickets` + `vip_rules` |
| **Backlog aging** | Distribuzione dei ticket aperti per fasce di anzianità (< 1g, 1-3g, 3-7g, > 7g) | `tickets` |
| **Volume trend** | Grafico a linee: ticket aperti vs risolti ultimi 30 giorni | `tickets` aggregati |

#### RF-02: SLA tracker con proiezione

Per ogni ticket aperto con **SLA** attivo:
- Tempo rimanente in formato leggibile
- Barra di progresso con colore graduato (verde → giallo → rosso)
- **Proiezione di sforamento**: `projected_breach_at = NOW() + remaining_ms` calcolato ad ogni snapshot
- Alert automatico quando `remaining_ms < threshold` (configurabile per tipo **SLA**)

#### RF-03: Gestione VIP

- Tabella di configurazione: organizzazione + pattern reporter → priorità e soglie personalizzate
- Badge visivo sui ticket VIP nella dashboard
- Alert dedicato se un ticket VIP non riceve risposta entro la soglia ridotta

#### RF-04: Metriche aggregate per team

- Ticket aperti/risolti per team (giornaliero, settimanale)
- Tempo medio di prima risposta e risoluzione per team
- Tasso di rispetto **SLA** per team
- Trend su 30 giorni
- **Nessun dato per singolo agente** — solo aggregazioni a livello team

#### RF-05: Alert su MS Teams

- **Webhook** verso canale Teams configurabile
- Trigger: **SLA** in avvicinamento a sforamento, ticket VIP senza risposta, soglia di backlog superata
- Formato: **Adaptive Card** con link diretto al ticket su Jira

### 4.2 Fase 2 — settimane 2-4 (nice-to-have)

#### RF-06: Clustering semantico dei ticket

- Invio del testo pseudonimizzato (summary + primo commento) a **Gemini 2.5 Flash**
- **Prompt** strutturato che chiede: categoria, componente, similarità con cluster esistenti
- Raggruppamento automatico con etichetta leggibile
- Vista "problemi ricorrenti" con conteggio e trend

#### RF-07: Risk Score composito

Formula del **Risk Score** (0.0 → 1.0):

```
Risk Score = w1 × SLA_proximity
           + w2 × VIP_factor
           + w3 × Aging_factor
           + w4 × Cluster_size_factor
           + w5 × Reopening_factor
```

| Componente | Peso default | Calcolo |
|------------|-------------|---------|
| `SLA_proximity` | 0.35 | `1 - (remaining_ms / goal_ms)`, capped a 1.0 |
| `VIP_factor` | 0.25 | `priority_boost` dalla tabella `vip_rules`, 0 se non VIP |
| `Aging_factor` | 0.15 | `min(1.0, hours_open / 168)` — scala lineare fino a 7 giorni |
| `Cluster_size_factor` | 0.15 | `min(1.0, cluster_ticket_count / 10)` — segnala pattern |
| `Reopening_factor` | 0.10 | `min(1.0, reopen_count / 3)` — ticket che rimbalzano |

I pesi sono configurabili dal PM senza intervento tecnico.

#### RF-08: Analisi on-demand con linguaggio naturale

- Il PM scrive una domanda (es. "quanti ticket di tipo bug ha aperto RAS questa settimana?")
- **Gemini** traduce in query SQL parametrizzata
- Risultato presentato in tabella o grafico
- **Guardrail**: il prompt di sistema limita le query a `SELECT` su viste predefinite (no accesso a `pseudo_mapping`)

### 4.3 Fase 3 — mese 2+ (roadmap)

- Multi-tenancy per riuso/vendita
- Integrazione con **SIM Hub** per correlazione costo/ricavo
- Report automatici periodici (settimanale per il PM, mensile per il management)
- Confronto tra organizzazioni cliente (chi genera più ticket, chi ha SLA peggiori)

---

## 5. Integrazione con Jira

### 5.1 Webhook (push — tempo reale)

| Evento | Webhook Jira | Azione |
|--------|-------------|--------|
| Ticket creato | `jira:issue_created` | Inserimento in `tickets`, prima richiesta **SLA** |
| Ticket aggiornato | `jira:issue_updated` | Aggiornamento stato, assegnazione, priorità; snapshot **SLA** |
| Commento creato | `comment_created` | Inserimento in `comments` con pseudonimizzazione |

**Sicurezza webhook**: verifica della firma HMAC del payload (`X-Hub-Signature` header) e validazione dell'IP sorgente Atlassian.

### 5.2 API on-demand (pull — su richiesta)

Non è previsto alcun polling periodico in background. I dati **SLA** vengono recuperati **live** quando il PM apre la dashboard:

| Endpoint Jira | Trigger | Scopo |
|---------------|---------|-------|
| `GET /rest/servicedeskapi/request/{issueKey}/sla` | Apertura dashboard o refresh manuale | Dati **SLA** live: `remainingTime`, `elapsedTime`, `breached` |
| `GET /rest/api/3/search` con **JQL** | Cron job giornaliero (Vercel Cron) | Riconciliazione: cattura ticket eventualmente persi dai webhook |
| `GET /rest/servicedeskapi/organization` | Cron job giornaliero (Vercel Cron) | Sincronizzazione organizzazioni cliente |

**Pattern di fetch SLA on-demand:**
1. Il PM apre la dashboard → il frontend chiama `GET /api/sla?status=open`
2. La **serverless function** recupera i ticket aperti dal database locale
3. Per ogni ticket aperto esegue `GET /rest/servicedeskapi/request/{key}/sla` verso Jira (in parallelo, batch da 10)
4. Calcola `projected_breach_at = NOW() + remaining_ms` per ogni **SLA** attivo
5. Persiste lo snapshot in `sla_snapshots` e risponde al frontend
6. Risultato in **cache** per 60 secondi per evitare chiamate ripetute durante la navigazione

### 5.3 Autenticazione

- **API Token** associato a un account di servizio con permessi di sola lettura
- L'account deve essere **agente** nel progetto JSM per accedere ai dati **SLA** e ai commenti interni
- Rotazione del token ogni 90 giorni (automatizzabile)

### 5.4 Rate limiting

Jira Cloud impone un limite di **~100 richieste/minuto** per utente. Con l'architettura on-demand (nessun polling continuo) il consumo è molto contenuto:

| Operazione | Chiamate stimate | Quando |
|------------|-----------------|--------|
| SLA fetch on-demand (~150 ticket aperti, batch da 10) | ~15 chiamate | Solo quando il PM apre/aggiorna la dashboard |
| Riconciliazione JQL (Vercel Cron) | 1/giorno | Cron giornaliero |
| Org sync (Vercel Cron) | 1/giorno | Cron giornaliero |
| Webhook (ricezione, nessun consumo API) | 0 | Continuo |

Con questo approccio il rate limit non rappresenta un rischio concreto. Anche con 10 refresh al giorno da parte del PM, il totale è di ~150 chiamate/giorno, ben sotto le ~144.000 disponibili.

---

## 6. Integrazione LLM (Gemini)

### 6.1 Ambito di utilizzo nell'MVP

Nell'**MVP** (settimana 1), **Gemini** non è strettamente necessario. Le cinque domande del PM si risolvono con metriche deterministiche per 4 casi su 5. Il clustering semantico (domanda 4) è il primo caso d'uso per il **LLM** e va in **fase 2**.

Se si vuole comunque integrare nella settimana 1, l'unico use case giustificabile è: **classificazione automatica del tipo di problema** (bug, richiesta informativa, malfunzionamento, richiesta di evoluzione) a partire dal testo del ticket, per alimentare filtri nella dashboard.

### 6.2 Prompt di classificazione (fase 2)

```json
{
  "system": "Sei un classificatore di ticket di supporto IT per la pubblica amministrazione. Rispondi SOLO con il JSON richiesto, senza testo aggiuntivo.",
  "user": "Classifica il seguente ticket e verifica se è semanticamente simile a uno dei cluster esistenti.\n\nTicket:\n- Summary: {{summary_pseudo}}\n- Descrizione: {{description_pseudo}}\n- Tipo: {{issue_type}}\n\nCluster attivi:\n{{clusters_json}}\n\nRispondi con:\n{\n  \"category\": \"bug|richiesta_info|malfunzionamento|evoluzione|altro\",\n  \"component\": \"stringa breve del componente coinvolto\",\n  \"matching_cluster_id\": null oppure ID del cluster più simile,\n  \"similarity_confidence\": 0.0-1.0,\n  \"new_cluster_label\": \"solo se non matcha nessun cluster esistente\"\n}"
}
```

### 6.3 Stima dei costi

Con **Gemini 2.5 Flash** su **Vertex AI**:

| Parametro | Valore |
|-----------|--------|
| Token input per ticket (summary + descrizione + cluster context) | ~800 token |
| Token output | ~150 token |
| Costo per ticket | ~$0.000615 |
| Ticket/giorno | 100 |
| **Costo giornaliero** | **~$0.06** |
| **Costo mensile** | **~$1.85** |

Costo trascurabile anche con volumi 10× superiori.

### 6.4 Dati inviati a Gemini

| Dato | Inviato | Note |
|------|---------|------|
| Summary del ticket | Sì, pseudonimizzato | Nomi sostituiti |
| Descrizione | Sì, pseudonimizzata | Nomi, email, riferimenti a persone sostituiti |
| Commenti | No nell'MVP | In fase 3 per analisi trend di conversazione |
| Nome agente | **Mai** | Solo il team |
| Nome reporter | **Mai** | Solo lo pseudonimo |
| Dati **SLA** | **Mai** | Non servono al **LLM**, sono metriche deterministiche |

---

## 7. Privacy e compliance

### 7.1 Quadro normativo applicabile

| Norma | Rilevanza | Impatto |
|-------|-----------|---------|
| **GDPR** (Reg. UE 2016/679) | I commenti dei ticket possono contenere dati personali | Pseudonimizzazione prima del trattamento e dell'invio a Vertex AI |
| **AI Act** (Reg. UE 2024/1689) | Sistema di analisi con **LLM** su dati che riguardano lavoratori | Classificazione del sistema; metriche solo aggregate elimina il rischio "alto rischio" |
| Art. 4 **Statuto dei Lavoratori** | Monitoraggio a distanza dell'attività lavorativa | **Evitato**: nessuna metrica individuale, solo aggregazione per team |
| Contratto con Regione Sardegna | Possibili clausole su subfornitori e residenza dei dati | Da verificare: Vertex AI EU è sufficiente? |

### 7.2 Decisioni di design per la compliance

1. **Nessuna metrica individuale per agente**: tutte le metriche sono aggregate a livello team. Il sistema non permette di drill-down sul singolo operatore. Questo esclude l'applicabilità dell'Art. 4 e riduce la classificazione AI Act.

2. **Pseudonimizzazione dei dati utente**: nomi, email e riferimenti a persone fisiche sono sostituiti con pseudonimi **prima** di:
   - essere persistiti nel database
   - essere inviati a **Gemini** via **Vertex AI**

3. **Tabella di corrispondenza separata**: la `pseudo_mapping` è in uno schema PostgreSQL separato con accesso ristretto (solo l'account di servizio di ingestion).

4. **Data residency EU**: **Vertex AI** configurato su regione europea; il database **PostgreSQL** risiede su **Vercel Postgres** (powered by **Neon**) con regione configurabile (AWS eu-central-1 Frankfurt).

5. **Nessun dato persistito da Gemini**: **Vertex AI** con data processing agreement non usa i dati per l'addestramento del modello.

### 7.3 Azioni richieste prima del go-live

- [ ] Verificare con il DPO/referente privacy se serve aggiornamento del registro dei trattamenti
- [ ] Verificare le clausole contrattuali con RAS su subfornitori cloud
- [ ] Documentare la pseudonimizzazione nel registro dei trattamenti
- [ ] Se in futuro si volesse passare a metriche individuali per agente: **accordo sindacale o autorizzazione ITL obbligatori**

---

## 8. Stack tecnologico

### 8.1 Scelte per l'MVP

| Layer | Tecnologia | Motivazione |
|-------|-----------|-------------|
| **Framework** | **Next.js 14+** (App Router) | Frontend React + API Routes in un unico progetto; deployment nativo su Vercel |
| **Hosting** | **Vercel** (serverless) | Zero gestione infrastruttura; scaling automatico; deploy via `git push` |
| **Database** | **Vercel Postgres** (**Neon**) — **PostgreSQL 16+** | **JSONB** per flessibilità campi custom; gestito, serverless-compatible, backup automatici |
| **Frontend** | **React** + **Recharts** | Stack conosciuto; Recharts per grafici leggeri e performanti |
| **LLM** | **Gemini 2.5 Flash** via **Vertex AI** SDK | Costo irrisorio, latenza bassa, data residency EU |
| **Alert** | **MS Teams Incoming Webhook** | Nessuna dipendenza aggiuntiva |
| **Cron** | **Vercel Cron Jobs** | Riconciliazione giornaliera e sync organizzazioni, senza server persistente |

### 8.2 Struttura del progetto Next.js

```
jsm-ops-dashboard/
├── app/
│   ├── layout.tsx                  # Layout principale
│   ├── page.tsx                    # Dashboard home
│   ├── api/
│   │   ├── webhook/route.ts        # Ricezione webhook Jira
│   │   ├── sla/route.ts            # Fetch SLA on-demand
│   │   ├── tickets/route.ts        # Query ticket dal DB
│   │   ├── metrics/route.ts        # Metriche aggregate per team
│   │   └── alert/route.ts          # Invio alert a MS Teams
│   └── cron/
│       └── reconcile/route.ts      # Riconciliazione giornaliera (Vercel Cron)
├── lib/
│   ├── jira.ts                     # Client API Jira (solo GET)
│   ├── db.ts                       # Pool connessioni Neon/Postgres
│   ├── pseudonymize.ts             # HMAC-SHA256 + regex nomi
│   ├── sla-projection.ts           # Calcolo proiezione sforamento
│   └── vip.ts                      # Logica rilevamento VIP
├── components/
│   ├── HealthSemaphore.tsx         # Semaforo verde/giallo/rosso
│   ├── SlaTracker.tsx              # Tabella SLA con barre di progresso
│   ├── BacklogAging.tsx            # Distribuzione per anzianità
│   ├── VolumeTrend.tsx             # Grafico trend aperti vs risolti
│   └── VipTickets.tsx              # Lista ticket VIP aperti
├── vercel.json                     # Configurazione cron jobs
└── .env.local                      # Variabili: JIRA_TOKEN, DB_URL, HMAC_SECRET
```

### 8.3 Coerenza con il Technology Radar

Da verificare: lo stack proposto (Next.js, React, PostgreSQL) è allineato con le scelte nel Technology Radar SiMaggioli? Se React è in "Adopt" o "Trial", procediamo; se è in "Hold", va discussa un'alternativa.

---

## 9. Piano di esecuzione — settimana 1

### 9.1 Giorno per giorno

| Giorno | Attività | Deliverable |
|--------|----------|-------------|
| **Lun** | Setup progetto Next.js su Vercel, provisioning Vercel Postgres, schema DB, endpoint `/api/webhook` | Repository deployato, webhook endpoint live, schema SQL applicato |
| **Mar** | Ingestion pipeline completa: validazione firma HMAC, normalizzazione, pseudonimizzazione, persistenza | Ticket da Jira che arrivano in Vercel Postgres via webhook |
| **Mer** | API `/api/sla` on-demand: fetch live **SLA** da Jira, proiezione sforamento, regole VIP | Endpoint che restituisce SLA live con `projected_breach_at` |
| **Gio** | Dashboard React: semaforo di salute, **SLA** tracker, backlog aging, trend volume | UI funzionante con dati reali su Vercel |
| **Ven** | Alert Teams (`/api/alert`), cron riconciliazione, import storico (batch JQL per i 20 mesi) | Sistema completo end-to-end |
| **Sab** *(opz)* | Test con dati reali, fix, documentazione | MVP stabile |

### 9.2 Import storico

Per avere i 20 mesi di storico dal giorno 1:
- Script batch che usa `GET /rest/api/3/search` con **JQL** paginato (`startAt` + `maxResults=100`)
- Stima: 60.000 ticket × 1 chiamata/100 ticket = 600 chiamate
- Con rate limit: ~6 minuti per l'import completo
- **SLA** storici: disponibili solo per ticket ancora aperti o risolti di recente; per i vecchi, si importano solo `breached: true/false` dal campo `completedCycle`

### 9.3 Cosa NON è nell'MVP

- Clustering semantico con **Gemini** (fase 2)
- Risk Score composito (fase 2)
- Query in linguaggio naturale (fase 2)
- Multi-tenancy (fase 3)
- Integrazione **SIM Hub** (fuori scope)
- Report automatici periodici (fase 3)

---

## 10. Rischi e mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Webhook perde eventi | Media | Alto | Riconciliazione JQL giornaliera via Vercel Cron; retry con backoff esponenziale |
| Latenza fetch **SLA** on-demand con molti ticket aperti | Media | Medio | Batch parallelo (10 chiamate concorrenti), cache 60s, limite 150 ticket per pagina |
| **Cold start** serverless function su Vercel | Bassa | Basso | Le function Node.js su Vercel hanno cold start <1s; trascurabile per uso interno |
| Limiti Vercel Postgres (piano free/pro) | Bassa | Medio | Piano Pro Neon supporta fino a 10 GiB; con ~60k ticket e JSONB, stimati ~2 GiB |
| Dati **SLA** non accessibili via API per ticket storici | Alta | Medio | Import degradato: solo flag `breached`, senza tempi residui |
| Pseudonimizzazione incompleta (nomi nel testo libero) | Media | Alto | **NER** (Named Entity Recognition) con regex + dizionario prima dell'invio a Gemini |
| Classificazione AI Act come sistema ad alto rischio | Bassa (con sole metriche aggregate) | Alto | Documentare la scelta "no metriche individuali" come misura di design |
| Team non disponibile per una settimana full-time | Media | Critico | Scope ridotto: solo dashboard + SLA tracker, senza VIP e alert |

---

## 11. Decisioni aperte

| # | Decisione | Chi decide | Entro quando | Stato |
|---|-----------|-----------|-------------|-------|
| 1 | ~~Hosting: infrastruttura SiMaggioli o GCP?~~ | Diego | — | ✅ **Deciso: Vercel** |
| 2 | Piano Vercel: Hobby (gratis) o Pro ($20/mese)? | Diego | Prima di lunedì | ⏳ Aperto |
| 3 | Clausole contrattuali RAS su subfornitori cloud (Vercel/Neon = AWS US East per infra, dati in EU con Neon) | Diego + legale/DPO | Prima del go-live | ⏳ Aperto |
| 4 | Lista organizzazioni/utenti VIP | PM destinatario | Entro mercoledì | ⏳ Aperto |
| 5 | Canale Teams per gli alert | PM + team | Entro giovedì | ⏳ Aperto |
| 6 | Coerenza React/Next.js con Technology Radar | Diego + Filippo | Prima di lunedì | ⏳ Aperto |

---

## Fonti

- [Atlassian — Customer sentiment analysis in JSM](https://support.atlassian.com/jira-service-management-cloud/docs/about-customer-sentiment-analysis/)
- [Atlassian Community — Understanding Customer Sentiment in JSM](https://community.atlassian.com/forums/Jira-questions/Understanding-Customer-Sentiment-in-JSM-What-Data-Does-Atlassian/qaq-p/3269605)
- [Atlassian Developer — Jira Cloud Webhooks](https://developer.atlassian.com/cloud/jira/platform/webhooks/)
- [Atlassian Developer — Forge Data Residency](https://developer.atlassian.com/platform/forge/data-residency)
- [Vertex AI — Prezzi Gemini](https://cloud.google.com/vertex-ai/generative-ai/pricing?hl=it)
- [eazyBI vs Atlassian Analytics](https://docs.eazybi.com/partners/sales-and-marketing/eazybi-comparison/eazybi-vs-atlassian-analytics)
- [eazyBI vs Jira built-in reporting](https://docs.eazybi.com/partners/sales-and-marketing/eazybi-comparison/eazybi-vs-jira-built-in-reporting)
- [Atlassian Marketplace — Support Intelligence for JSM](https://marketplace.atlassian.com/apps/2653006222/support-intelligence-for-jira-service-management)
- [Atlassian — Data Residency](https://support.atlassian.com/security-and-access-policies/docs/understand-data-residency/)
- [Atlassian JIRA — SLA data via REST API](https://jira.atlassian.com/browse/JSDCLOUD-9973)
