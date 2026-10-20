"use client";

import { useEffect, useState, useCallback } from "react";
import { HealthSemaphore } from "@/components/HealthSemaphore";
import { SlaTracker } from "@/components/SlaTracker";
import { BacklogAging } from "@/components/BacklogAging";
import { VolumeTrend } from "@/components/VolumeTrend";
import { VipTickets } from "@/components/VipTickets";
import type { DashboardData, HealthStatus } from "@/lib/types";

function computeHealth(slaCompliance: number, totalBreached: number): HealthStatus {
  if (slaCompliance >= 95 && totalBreached === 0) return "green";
  if (slaCompliance >= 80) return "yellow";
  return "red";
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
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
      const slaCompliancePercent = totalOpen > 0 ? ((totalOpen - totalBreached) / totalOpen) * 100 : 100;

      setData({
        health: computeHealth(slaCompliancePercent, totalBreached),
        slaAtRisk: slaData.atRisk ?? [],
        vipOpen: (vipData.tickets ?? []).filter(
          (t: { status: string }) => !["Resolved", "Closed", "Done"].includes(t.status)
        ),
        backlogAging: metricsData.backlogAging ?? [],
        volumeTrend: metricsData.volumeTrend ?? [],
        totalOpen,
        totalBreached,
        slaCompliancePercent,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento dati");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Caricamento dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">
          {error ?? "Errore sconosciuto"}
          <button onClick={fetchData} className="ml-4 text-blue-600 underline">
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={fetchData}
          className="text-sm text-gray-500 hover:text-gray-800 border rounded px-3 py-1"
        >
          Aggiorna
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
          <h3 className="text-base font-semibold mb-3">SLA a rischio</h3>
          <SlaTracker tickets={data.slaAtRisk} />
        </section>

        <section>
          <h3 className="text-base font-semibold mb-3">Ticket VIP aperti</h3>
          <VipTickets tickets={data.vipOpen} />
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h3 className="text-base font-semibold mb-3">Backlog per anzianità</h3>
          <div className="border rounded-xl p-4 bg-white">
            <BacklogAging data={data.backlogAging} />
          </div>
        </section>

        <section>
          <h3 className="text-base font-semibold mb-3">Trend volume (30g)</h3>
          <div className="border rounded-xl p-4 bg-white">
            <VolumeTrend data={data.volumeTrend} />
          </div>
        </section>
      </div>
    </div>
  );
}
