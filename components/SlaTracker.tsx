"use client";

import type { TicketWithSla } from "@/lib/types";

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function progressColor(remaining: number, goal: number): string {
  const ratio = remaining / goal;
  if (ratio > 0.5) return "bg-emerald-500";
  if (ratio > 0.2) return "bg-amber-500";
  return "bg-red-500";
}

export function SlaTracker({ tickets }: { tickets: TicketWithSla[] }) {
  if (!tickets.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Nessun SLA a rischio</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <th className="text-left p-3 font-medium text-slate-500">Ticket</th>
            <th className="text-left p-3 font-medium text-slate-500">SLA</th>
            <th className="text-left p-3 font-medium text-slate-500">Rimanente</th>
            <th className="text-left p-3 font-medium text-slate-500">Proiezione</th>
            <th className="text-left p-3 font-medium text-slate-500 w-36">Progresso</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) =>
            t.sla
              .filter((s) => s.status === "ONGOING")
              .map((s) => (
                <tr
                  key={`${t.jira_key}-${s.sla_name}`}
                  className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="p-3">
                    <span className="font-mono font-medium text-slate-900">{t.jira_key}</span>
                    {t.is_vip && (
                      <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">
                        VIP
                      </span>
                    )}
                    <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">{t.summary}</div>
                  </td>
                  <td className="p-3 text-slate-700">{s.sla_name}</td>
                  <td className="p-3 font-mono tabular-nums text-slate-900">
                    {s.remaining_ms != null ? formatMs(s.remaining_ms) : "—"}
                  </td>
                  <td className="p-3 text-xs text-slate-600">
                    {s.projected_breach_at
                      ? new Date(s.projected_breach_at).toLocaleString("it-IT", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="p-3">
                    {s.remaining_ms != null && s.goal_ms != null && (
                      <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all ${progressColor(s.remaining_ms, s.goal_ms)}`}
                          style={{
                            width: `${Math.max(0, Math.min(100, (s.remaining_ms / s.goal_ms) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              )),
          )}
        </tbody>
      </table>
    </div>
  );
}
