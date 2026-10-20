-- JSM Ops Dashboard — PostgreSQL 16+ schema

CREATE TABLE tickets (
    id              BIGSERIAL PRIMARY KEY,
    jira_key        VARCHAR(20) UNIQUE NOT NULL,
    jira_id         BIGINT UNIQUE NOT NULL,
    project_key     VARCHAR(10) NOT NULL,
    summary         TEXT NOT NULL,
    description_hash TEXT,
    status          VARCHAR(50) NOT NULL,
    priority        VARCHAR(20),
    issue_type      VARCHAR(50),
    assignee_team   VARCHAR(100),
    reporter_pseudo VARCHAR(64),
    organization_id VARCHAR(64),
    organization_name VARCHAR(200),
    is_vip          BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    resolved_at     TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    custom_fields   JSONB DEFAULT '{}',
    raw_webhook     JSONB,
    ingested_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sla_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT REFERENCES tickets(id),
    sla_name        VARCHAR(100) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    elapsed_ms      BIGINT,
    remaining_ms    BIGINT,
    breached        BOOLEAN DEFAULT FALSE,
    goal_ms         BIGINT,
    projected_breach_at TIMESTAMPTZ,
    captured_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comments (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT REFERENCES tickets(id),
    jira_comment_id BIGINT UNIQUE NOT NULL,
    author_team     VARCHAR(100),
    is_public       BOOLEAN NOT NULL,
    body_pseudo     TEXT,
    body_hash       VARCHAR(128),
    created_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE clusters (
    id              BIGSERIAL PRIMARY KEY,
    cluster_label   VARCHAR(200) NOT NULL,
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

CREATE TABLE risk_scores (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT REFERENCES tickets(id),
    score           FLOAT NOT NULL,
    components      JSONB NOT NULL,
    computed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vip_rules (
    id              BIGSERIAL PRIMARY KEY,
    organization_id VARCHAR(64),
    organization_name VARCHAR(200),
    reporter_pattern VARCHAR(200),
    priority_boost  FLOAT DEFAULT 0.3,
    max_first_response_ms BIGINT,
    notes           TEXT,
    active          BOOLEAN DEFAULT TRUE
);

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

-- Pseudonym mapping (separate access)
CREATE TABLE pseudo_mapping (
    id              BIGSERIAL PRIMARY KEY,
    original_email  VARCHAR(320) NOT NULL,
    pseudo          VARCHAR(64) UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_org ON tickets(organization_id);
CREATE INDEX idx_tickets_created ON tickets(created_at);
CREATE INDEX idx_tickets_vip ON tickets(is_vip) WHERE is_vip = TRUE;
CREATE INDEX idx_sla_ticket ON sla_snapshots(ticket_id, captured_at DESC);
CREATE INDEX idx_sla_breach ON sla_snapshots(breached) WHERE breached = TRUE;
CREATE INDEX idx_risk_ticket ON risk_scores(ticket_id, computed_at DESC);
CREATE INDEX idx_comments_ticket ON comments(ticket_id);
