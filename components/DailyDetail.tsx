"use client";

import { useEffect, useState } from "react";

interface DailyTicket {
  jira_key: string;
  summary: string;
  status: string;
  priority: string | null;
  organization_name: string | null;
  assignee_team: string | null;
  created_at: string;
  resolved_at?: string | null;
  age_days?: number | null;
}

interface DailyResponse {
  opened: number;
  still_open: number;
  closed_same_day: number;
  closed_from_backlog: number;
  openedList: DailyTicket[];
  stillOpenList: DailyTicket[];
  closedSameDayList: DailyTicket[];
  closedBacklogList: DailyTicket[];
  jiraBaseUrl: string | null;
  period: string;
}

type Tab = "opened" | "still_open" | "same_day" | "backlog";

const PERIODS = [
  { key: "year", label: "Anno" },
  { key: "quarter", label: "Trimestre" },
  { key: "month", label: "Mese" },
  { key: "week", label: "Settimana" },
  { key: "day", label: "Oggi" },
] as const;

type Period = (typeof PERIODS)[number]["key"];

function formatAge(days: number | null | undefined): string {
  if (days == null) return "—";
  if (days === 0) return "oggi";
  if (days === 1) return "1g";
  return `${days}g`;
}

function TicketRow({ t, jiraBase, showAge }: { t: DailyTicket; jiraBase: string | null; showAge?: boolean }) {
  const link = jiraBase ? `${jiraBase}/browse/${t.jira_key}` : null;
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
      <td className="p-2.5 text-sm text-slate-500">{t.assignee_team ?? "—"}</td>
      {showAge && (
        <td className="p-2.5 text-sm font-mono tabular-nums text-amber-600">{formatAge(t.age_days)}</td>
      )}
      <td className="p-2.5 text-sm text-slate-500">{t.organization_name ?? "—"}</td>
    </tr>
  );
}

export function DailyDetail() {
  const [period, setPeriod] = useState<Period>("day");
  const [tab, setTab] = useState<Tab>("opened");
  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/daily?period=${period}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const closedTotal = (data?.closed_same_day ?? 0) + (data?.closed_from_backlog ?? 0);
  const showAge = tab === "backlog" || tab === "still_open";

  const tabs: { key: Tab; label: string; count: number; color: string }[] = data
    ? [
        { key: "opened", label: "Aperti", count: data.opened, color: "text-blue-600" },
        { key: "still_open", label: "Ancora aperti", count: data.still_open, color: "text-rose-600" },
        { key: "same_day", label: "Chiusi (same-day)", count: data.closed_same_day, color: "text-emerald-600" },
        { key: "backlog", label: "Chiusi (da backlog)", count: data.closed_from_backlog, color: "text-amber-600" },
      ]
    : [];

  const listMap: Record<Tab, DailyTicket[]> = data
    ? {
        opened: data.openedList,
        still_open: data.stillOpenList,
        same_day: data.closedSameDayList,
        backlog: data.closedBacklogList,
      }
    : { opened: [], still_open: [], same_day: [], backlog: [] };

  const activeList = listMap[tab];

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-baseline gap-4 flex-wrap text-left">
          <span className="text-xs text-slate-400 capitalize">{today}</span>
          {data && (
            <span className="text-xs text-slate-400">
              Aperti: <span className="font-medium text-slate-600">{data.opened}</span>
              {" · "}
              Chiusi: <span className="font-medium text-slate-600">{closedTotal}</span>
              {" · "}
              Ancora aperti: <span className="font-medium text-rose-600">{data.still_open}</span>
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="px-5 pb-5 border-t border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap mt-4 mb-4">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    period === p.key
                      ? "bg-slate-900 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-sm text-slate-400 animate-pulse py-4 text-center">Caricamento…</p>
            ) : data ? (
              <div className="grid grid-cols-4 gap-3">
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
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Errore nel caricamento</p>
            )}
          </div>

          {!loading && data && activeList.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="text-left p-2.5 font-medium text-slate-500 w-32">Key</th>
                    <th className="text-left p-2.5 font-medium text-slate-500">Sommario</th>
                    <th className="text-left p-2.5 font-medium text-slate-500 w-32">Stato</th>
                    <th className="text-left p-2.5 font-medium text-slate-500 w-36">Assegnatario</th>
                    {showAge && (
                      <th className="text-left p-2.5 font-medium text-slate-500 w-20">Età</th>
                    )}
                    <th className="text-left p-2.5 font-medium text-slate-500 w-40">Organizzazione</th>
                  </tr>
                </thead>
                <tbody>
                  {activeList.map((t) => (
                    <TicketRow key={t.jira_key} t={t} jiraBase={data.jiraBaseUrl} showAge={showAge} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && data && activeList.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">Nessun ticket</p>
          )}
        </>
      )}
    </div>
  );
}
