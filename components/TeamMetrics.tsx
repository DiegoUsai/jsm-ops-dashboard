"use client";

import type { TeamMetrics as TM } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const TEAM_COLORS = [
  "#6366f1",
  "#059669",
  "#d97706",
  "#dc2626",
  "#8b5cf6",
  "#0891b2",
  "#ea580c",
  "#64748b",
];

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function buildTrend(data: TM[]) {
  const dateMap = new Map<string, Record<string, number>>();
  const teams = new Set<string>();

  for (const d of data) {
    teams.add(d.team_name);
    const entry = dateMap.get(d.metric_date) ?? {};
    entry[d.team_name] = d.backlog_size;
    dateMap.set(d.metric_date, entry);
  }

  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date: formatDate(date), ...values }));

  return { chartData, teams: Array.from(teams) };
}

export function TeamMetricsTable({ data }: { data: TM[] }) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Nessuna metrica di team disponibile</p>
      </div>
    );
  }

  const latestDate = data[0]?.metric_date;
  const latest = data.filter((d) => d.metric_date === latestDate);
  const dates = new Set(data.map((d) => d.metric_date));
  const hasTrend = dates.size >= 2;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="text-left p-3 font-medium text-slate-500">Team</th>
              <th className="text-right p-3 font-medium text-slate-500">Aperti</th>
              <th className="text-right p-3 font-medium text-slate-500">Risolti</th>
              <th className="text-right p-3 font-medium text-slate-500">Breach SLA</th>
              <th className="text-right p-3 font-medium text-slate-500">Backlog</th>
              <th className="text-right p-3 font-medium text-slate-500">Avg risposta</th>
              <th className="text-right p-3 font-medium text-slate-500">Avg risoluzione</th>
            </tr>
          </thead>
          <tbody>
            {latest.map((m) => (
              <tr
                key={m.team_name}
                className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
              >
                <td className="p-3 font-medium text-slate-900">{m.team_name}</td>
                <td className="p-3 text-right font-mono tabular-nums">{m.tickets_opened}</td>
                <td className="p-3 text-right font-mono tabular-nums">{m.tickets_resolved}</td>
                <td className="p-3 text-right font-mono tabular-nums">
                  <span className={m.sla_breach_count > 0 ? "text-red-600 font-medium" : ""}>
                    {m.sla_breach_count}
                  </span>
                </td>
                <td className="p-3 text-right font-mono tabular-nums">{m.backlog_size}</td>
                <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                  {formatMs(m.avg_first_response_ms)}
                </td>
                <td className="p-3 text-right font-mono tabular-nums text-slate-600">
                  {formatMs(m.avg_resolution_ms)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasTrend && <BacklogTrend data={data} />}
    </div>
  );
}

function BacklogTrend({ data }: { data: TM[] }) {
  const { chartData, teams } = buildTrend(data);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium text-slate-500 mb-3">Backlog per team (30g)</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              fontSize: 12,
            }}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
          />
          {teams.map((team, i) => (
            <Line
              key={team}
              type="monotone"
              dataKey={team}
              stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
