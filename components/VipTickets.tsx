"use client";

import type { Ticket } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m fa`;
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

export function VipTickets({ tickets }: { tickets: Ticket[] }) {
  if (!tickets.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Nessun ticket VIP aperto</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
      {tickets.map((t) => (
        <div
          key={t.jira_key}
          className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium text-sm text-slate-900">{t.jira_key}</span>
              <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">VIP</span>
            </div>
            <p className="text-sm text-slate-600 truncate mt-0.5">{t.summary}</p>
            {t.organization_name && <p className="text-xs text-slate-500 mt-0.5">{t.organization_name}</p>}
          </div>
          <div className="text-right ml-4 shrink-0">
            <div className="text-sm font-medium text-slate-700">{t.status}</div>
            <div className="text-xs text-slate-500 tabular-nums">{timeAgo(t.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
