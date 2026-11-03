"use client";

import { useState } from "react";

interface DailyTicket {
  jira_key: string;
  summary: string;
  status: string;
  priority: string | null;
  organization_name: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface DailyData {
  opened_today: number;
  closed_same_day: number;
  closed_from_backlog: number;
  openedList: DailyTicket[];
  closedSameDayList: DailyTicket[];
  closedBacklogList: DailyTicket[];
}

type Tab = "opened" | "same_day" | "backlog";

const JIRA_BASE = process.env.NEXT_PUBLIC_JIRA_BASE_URL;

function TicketRow({ t }: { t: DailyTicket }) {
  const link = JIRA_BASE ? `${JIRA_BASE}/browse/${t.jira_key}` : null;
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="p-2.5 text-sm font-mono">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            {t.jira_key}
          </a>
        ) : t.jira_key}
      </td>
      <td className="p-2.5 text-sm text-slate-700 max-w-xs truncate">{t.summary}</td>
      <td className="p-2.5 text-sm text-slate-500">{t.status}</td>
      <td className="p-2.5 text-sm text-slate-500">{t.organization_name ?? "—"}</td>
    </tr>
  );
}

export function DailyDetail({ data }: { data: DailyData }) {
  const [tab, setTab] = useState<Tab>("opened");

  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const closedToday = data.closed_same_day + data.closed_from_backlog;

  const tabs: { key: Tab; label: string; count: number; color: string }[] = [
    { key: "opened", label: "Aperti oggi", count: data.opened_today, color: "text-blue-600" },
    { key: "same_day", label: "Chiusi oggi (aperti oggi)", count: data.closed_same_day, color: "text-emerald-600" },
    { key: "backlog", label: "Chiusi oggi (da backlog)", count: data.closed_from_backlog, color: "text-amber-600" },
  ];

  const listMap: Record<Tab, DailyTicket[]> = {
    opened: data.openedList,
    same_day: data.closedSameDayList,
    backlog: data.closedBacklogList,
  };

  const activeList = listMap[tab];

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <p className="text-xs text-slate-400 capitalize">{today}</p>
          <p className="text-xs text-slate-400">
            Chiusi oggi: <span className="font-medium text-slate-600">{closedToday}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg p-3 text-left transition-colors ${
                tab === t.key
                  ? "bg-slate-50 ring-1 ring-slate-200"
                  : "hover:bg-slate-50/50"
              }`}
            >
              <p className={`text-2xl font-semibold tabular-nums ${t.color}`}>{t.count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t.label}</p>
            </button>
          ))}
        </div>
      </div>

      {activeList.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="text-left p-2.5 font-medium text-slate-500 w-32">Key</th>
                <th className="text-left p-2.5 font-medium text-slate-500">Sommario</th>
                <th className="text-left p-2.5 font-medium text-slate-500 w-40">Stato</th>
                <th className="text-left p-2.5 font-medium text-slate-500 w-40">Organizzazione</th>
              </tr>
            </thead>
            <tbody>
              {activeList.map((t) => <TicketRow key={t.jira_key} t={t} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-6 text-center text-sm text-slate-400">Nessun ticket</p>
      )}
    </div>
  );
}
