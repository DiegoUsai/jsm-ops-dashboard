"use client";

import type { TicketWithSla } from "@/lib/types";

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function progressColor(remaining: number, goal: number): string {
  const ratio = remaining / goal;
  if (ratio > 0.5) return "bg-green-500";
  if (ratio > 0.2) return "bg-yellow-400";
  return "bg-red-500";
}

export function SlaTracker({ tickets }: { tickets: TicketWithSla[] }) {
  if (!tickets.length) {
    return <div className="text-sm text-gray-500 p-4">Nessun SLA a rischio.</div>;
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-3">Ticket</th>
            <th className="text-left p-3">SLA</th>
            <th className="text-left p-3">Rimanente</th>
            <th className="text-left p-3">Proiezione</th>
            <th className="text-left p-3 w-40">Progresso</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) =>
            t.sla
              .filter((s) => s.status === "ONGOING")
              .map((s) => (
                <tr key={`${t.jira_key}-${s.sla_name}`} className="border-t">
                  <td className="p-3">
                    <span className="font-mono font-medium">{t.jira_key}</span>
                    {t.is_vip && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">VIP</span>
                    )}
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">{t.summary}</div>
                  </td>
                  <td className="p-3">{s.sla_name}</td>
                  <td className="p-3 font-mono">
                    {s.remaining_ms != null ? formatMs(s.remaining_ms) : "—"}
                  </td>
                  <td className="p-3 text-xs">
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
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full ${progressColor(s.remaining_ms, s.goal_ms)}`}
                          style={{ width: `${Math.max(0, Math.min(100, (s.remaining_ms / s.goal_ms) * 100))}%` }}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))
          )}
        </tbody>
      </table>
    </div>
  );
}
