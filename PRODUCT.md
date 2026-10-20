# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: team operativo Assistenza Sibar** — consulta la dashboard ogni mattina durante il daily standup per pianificare la giornata: quali ticket hanno SLA in scadenza, dove il backlog sta invecchiando, se ci sono VIP da gestire.

**Secondary: responsabile servizio / management** — review periodica (settimanale) per decisioni su staffing, priorità e compliance SLA.

Entrambi i profili usano la dashboard in modalità read-only: osservano, non agiscono dalla dashboard stessa.

## Product Purpose

Dashboard operativa sidecar per Jira Service Management. Aggrega in una vista unica i dati chiave del progetto AM00 ("Assistenza Sibar") su sibar.atlassian.net, eliminando la necessità di navigare più pagine Jira per avere il quadro della situazione.

Il successo si misura in: tempo risparmiato nel capire lo stato del servizio, breach SLA prevenuti grazie agli alert proattivi, e decisioni più rapide durante standup e review.

## Positioning

Tre capacità che Jira nativo non offre in un'unica vista:

1. **Semaforo di salute** — stato complessivo del servizio in un colpo d'occhio (verde/giallo/rosso), senza dover interpretare filtri e query JQL.
2. **Proiezione temporale breach SLA** — calcolo predittivo di quando un ticket sfonderà l'SLA, non disponibile nei report nativi JSM.
3. **Alert proattivi su MS Teams** — notifiche push automatiche su canali Teams quando si verificano condizioni critiche, senza aspettare che qualcuno apra Jira.

## Operating Context

- Istanza Jira: sibar.atlassian.net, progetto AM00 (service desk, "Assistenza Sibar")
- Edizione Jira: JSM Premium (necessaria per API SLA)
- Lingua interfaccia: italiano
- Il team usa MS Teams per comunicazione interna
- La dashboard è deployata su Vercel, consultata da browser desktop durante meeting

## Capabilities and Constraints

**Funzionalità:**
- Semaforo salute: compliance SLA aggregata → verde (≥95%, 0 breach), giallo (≥80%), rosso
- SLA tracker: ticket a rischio con barra progresso e proiezione temporale breach
- Backlog aging: distribuzione per fasce di anzianità (< 1g, 1–3g, 3–7g, > 7g)
- Volume trend: aperti vs risolti negli ultimi 30 giorni
- Ticket VIP: lista ticket da organizzazioni/reporter VIP
- Alert MS Teams: Adaptive Cards inviate su condizioni critiche
- Cron riconciliazione giornaliera (06:00 UTC)
- Webhook Jira per aggiornamenti real-time

**Vincolo fondamentale: sola lettura.** La dashboard non deve mai scrivere, modificare o eliminare dati su Jira. Nessuna operazione di scrittura verso l'istanza Jira è consentita.

**Pseudonimizzazione:** i dati personali (email reporter) vengono pseudonimizzati tramite HMAC-SHA256 prima dello storage nel DB.

## Evidence on Hand

- ~18.000+ ticket storici importati da AM00 (import completato)
- Dati SLA disponibili on-demand via API JSM Premium
- Nessun asset di brand specifico; la dashboard è uno strumento interno, non un prodotto commerciale

## Product Principles

1. **Osserva, non tocca** — la dashboard è un vetro: mostra tutto, non modifica nulla.
2. **Un colpo d'occhio basta** — ogni informazione critica deve essere leggibile in < 3 secondi.
3. **Allarma prima del danno** — proiezione e alert devono anticipare i problemi, non certificarli dopo.
4. **Privacy by design** — nessun dato personale in chiaro nel DB; pseudonimizzazione su tutto.
5. **Zero manutenzione** — sincronizzazione automatica via webhook + cron, nessun intervento manuale quotidiano.
