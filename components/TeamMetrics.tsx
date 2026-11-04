"use client";

import { useEffect, useState } from "react";

interface TeamRow {
  team: string;
  opened: number;
  resolved: number;
  same_day: number;
  backlog: number;
  avg_fr: number | null;
  avg_res: number | null;
}

const PERIODS = [
  { key: "year", label: "Anno" },
  { key: "quarter", label: "Trimestre" },
  { key: "month", label: "Mese" },
  { key: "week", label: "Settimana" },
  { key: "day", label: "Oggi" },
] as const;

type Period = (typeof PERIODS)[number]["key"];

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function TeamMetricsTable() {
  const [period, setPeriod] = useState<Period>("month");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/metrics/teams?period=${period}`)
      .then((r) => r.json())
      .then((d) => setTeams(d.teams ?? []))
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
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

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400 animate-pulse">Caricamento…</p>
          </div>
        ) : !teams.length ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">Nessuna metrica disponibile per questo periodo</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="text-left p-3 font-medium text-slate-500">Team</th>
                <th className="text-right p-3 font-medium text-slate-500">Aperti</th>
                <th className="text-right p-3 font-medium text-slate-500">Risolti</th>
                <th className="text-right p-3 font-medium text-slate-500">Same-day</th>
                <th className="text-right p-3 font-medium text-slate-500">Backlog</th>
                <th className="text-right p-3 font-medium text-slate-500">Avg risposta</th>
                <th className="text-right p-3 font-medium text-slate-500">Avg risoluzione</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((m) => (
                <tr
                  key={m.team}
                  className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="p-3 font-medium text-slate-900">{m.team}</td>
                  <td className="p-3 text-right font-mono tabular-nums">{m.opened}</td>
                  <td className="p-3 text-right font-mono tabular-nums">{m.resolved}</td>
                  <td className="p-3 text-right font-mono tabular-nums text-emerald-600">{m.same_day}</td>
                  <td className="p-3 text-right font-mono tabular-nums">{m.backlog}</td>
                  <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                    {formatMs(m.avg_fr)}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                    {formatMs(m.avg_res)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
