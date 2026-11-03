import type { JiraSlaValue } from "./jira";

export interface SlaProjection {
  sla_name: string;
  status: "ONGOING" | "PAUSED" | "BREACHED" | "COMPLETED";
  elapsed_ms: number | null;
  remaining_ms: number | null;
  breached: boolean;
  goal_ms: number | null;
  projected_breach_at: string | null;
}

export function projectSla(slaValues: JiraSlaValue[]): SlaProjection[] {
  return slaValues.map((sla) => {
    const cycle = sla.ongoingCycle;
    if (!cycle) {
      const last = sla.completedCycles?.[sla.completedCycles.length - 1];
      return {
        sla_name: sla.name,
        status: "COMPLETED" as const,
        elapsed_ms: last?.elapsedTime.millis ?? null,
        remaining_ms: null,
        breached: last?.breached ?? false,
        goal_ms: last?.goalDuration.millis ?? null,
        projected_breach_at: null,
      };
    }

    const remaining = cycle.remainingTime.millis;
    const breached = cycle.breached;
    const status = breached ? "BREACHED" : cycle.paused ? "PAUSED" : "ONGOING";

    return {
      sla_name: sla.name,
      status,
      elapsed_ms: cycle.elapsedTime.millis,
      remaining_ms: breached ? null : remaining,
      breached,
      goal_ms: cycle.goalDuration.millis,
      projected_breach_at:
        !breached && remaining > 0
          ? new Date(Date.now() + remaining).toISOString()
          : null,
    };
  });
}
