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
    return <div className="text-sm text-gray-500 p-4">Nessun ticket VIP aperto.</div>;
  }

  return (
    <div className="space-y-2">
      {tickets.map((t) => (
        <div key={t.jira_key} className="flex items-center justify-between border rounded-lg px-4 py-3">
          <div>
            <span className="font-mono font-medium text-sm">{t.jira_key}</span>
            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">VIP</span>
            <p className="text-sm text-gray-600 truncate max-w-sm">{t.summary}</p>
            <p className="text-xs text-gray-400">{t.organization_name}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">{t.status}</div>
            <div className="text-xs text-gray-400">{timeAgo(t.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
