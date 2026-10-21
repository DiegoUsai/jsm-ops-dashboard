export interface Ticket {
  id: number;
  jira_key: string;
  jira_id: number;
  project_key: string;
  summary: string;
  status: string;
  priority: string | null;
  issue_type: string | null;
  assignee_team: string | null;
  reporter_pseudo: string | null;
  organization_id: string | null;
  organization_name: string | null;
  is_vip: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  first_response_at: string | null;
  custom_fields: Record<string, unknown>;
}

export interface SlaSnapshot {
  id: number;
  ticket_id: number;
  sla_name: string;
  status: string;
  elapsed_ms: number | null;
  remaining_ms: number | null;
  breached: boolean;
  goal_ms: number | null;
  projected_breach_at: string | null;
  captured_at: string;
}

export interface TicketWithSla extends Ticket {
  sla: SlaSnapshot[];
}

export interface VipRule {
  id: number;
  organization_id: string | null;
  organization_name: string | null;
  reporter_pattern: string | null;
  priority_boost: number;
  max_first_response_ms: number | null;
  active: boolean;
}

export interface TeamMetrics {
  team_name: string;
  metric_date: string;
  tickets_opened: number;
  tickets_resolved: number;
  avg_first_response_ms: number | null;
  avg_resolution_ms: number | null;
  sla_breach_count: number;
  backlog_size: number;
}

export type HealthStatus = "green" | "yellow" | "red";

export interface DashboardData {
  health: HealthStatus;
  slaAtRisk: TicketWithSla[];
  vipOpen: Ticket[];
  backlogAging: { bucket: string; count: number }[];
  volumeTrend: { date: string; opened: number; resolved: number }[];
  teamMetrics: TeamMetrics[];
  totalOpen: number;
  totalBreached: number;
  slaCompliancePercent: number;
}
