# JSM Ops Dashboard

Monitoraggio operativo **read-only** per Jira Service Management.
Semaforo di salute, SLA tracker con proiezione, backlog aging, trend volume, ticket VIP.

## Stack

- **Next.js 16** (App Router, serverless su Vercel)
- **PostgreSQL 16+** (Neon / Vercel Postgres)
- **Recharts** per i grafici
- **MS Teams** per gli alert (Adaptive Card via webhook)

## Setup

```bash
cp .env.example .env.local   # compila con i tuoi valori
npm install
npm run dev
```

Applica lo schema DB:

```bash
psql $DATABASE_URL < schema.sql
```

## Architettura

- **Webhook Jira** → `/api/webhook` (ingestion in tempo reale)
- **SLA on-demand** → `/api/sla` (fetch live verso Jira, cache 60s)
- **Riconciliazione** → `/api/cron/reconcile` (Vercel Cron, giornaliero)
- **Alert** → `/api/alert` (POST per inviare Adaptive Card su Teams)
