"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { HealthSemaphore } from "@/components/HealthSemaphore";
import { SlaTracker } from "@/components/SlaTracker";
import { BacklogAging } from "@/components/BacklogAging";
import { VolumeTrend } from "@/components/VolumeTrend";
import { VipTickets } from "@/components/VipTickets";
import type { DashboardData, HealthStatus } from "@/lib/types";

const REFRESH_MS = 5 * 60_000;

function computeHealth(slaCompliance: number, totalBreached: number): HealthStatus {
  if (slaCompliance >= 95 && totalBreached === 0) return "green";
  if (slaCompliance >= 80) return "yellow";
  return "red";
}

function Skeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="rounded-xl border border-slate-200 bg-slate-100 h-28" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-slate-100 h-72" />
        <div className="rounded-xl border border-slate-200 bg-slate-100 h-72" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-slate-100 h-72" />
        <div className="rounded-xl border border-slate-200 bg-slate-100 h-72" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const [slaRes, metricsRes, vipRes] = await Promise.all([
        fetch("/api/sla?status=open"),
        fetch("/api/metrics?days=30"),
        fetch("/api/tickets?vip=true&limit=20"),
      ]);

      const slaData = await slaRes.json();
      const metricsData = await metricsRes.json();
      const vipData = await vipRes.json();

      const totalOpen = slaData.totalOpen ?? 0;
      const totalBreached = slaData.totalBreached ?? 0;
      const slaCompliancePercent =
        totalOpen > 0 ? ((totalOpen - totalBreached) / totalOpen) * 100 : 100;

      setData({
        health: computeHealth(slaCompliancePercent, totalBreached),
        slaAtRisk: slaData.atRisk ?? [],
        vipOpen: (vipData.tickets ?? []).filter(
          (t: { status: string }) => !["Resolved", "Closed", "Done"].includes(t.status),
        ),
        backlogAging: metricsData.backlogAging ?? [],
        volumeTrend: metricsData.volumeTrend ?? [],
        totalOpen,
        totalBreached,
        slaCompliancePercent,
      });
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento dati");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    timer.current = setInterval(() => fetchData(true), REFRESH_MS);
    return () => clearInterval(timer.current);
  }, [fetchData]);

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-red-600">{error ?? "Errore sconosciuto"}</p>
        <button
          onClick={() => fetchData()}
          className="text-sm font-medium text-slate-700 border border-slate-300 rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-end gap-3">
        {lastUpdated && (
          <span className="text-xs text-slate-500 tabular-nums">
            {lastUpdated.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="shrink-0 text-sm text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          {refreshing ? "Aggiorno…" : "Aggiorna"}
        </button>
      </div>

      <HealthSemaphore
        status={data.health}
        slaCompliance={data.slaCompliancePercent}
        totalOpen={data.totalOpen}
        totalBreached={data.totalBreached}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-3">SLA a rischio</h2>
          <SlaTracker tickets={data.slaAtRisk} />
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-3">Ticket VIP aperti</h2>
          <VipTickets tickets={data.vipOpen} />
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-3">Backlog per anzianità</h2>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <BacklogAging data={data.backlogAging} />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-3">Trend volume (30g)</h2>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <VolumeTrend data={data.volumeTrend} />
          </div>
        </section>
      </div>
    </div>
  );
}
