"use client";

import type { HealthStatus } from "@/lib/types";

const CONFIG: Record<HealthStatus, { bg: string; label: string; desc: string }> = {
  green: { bg: "bg-green-500", label: "OK", desc: "SLA rispettati, backlog sotto controllo" },
  yellow: { bg: "bg-yellow-400", label: "Attenzione", desc: "Alcuni SLA a rischio o backlog in crescita" },
  red: { bg: "bg-red-500", label: "Critico", desc: "SLA sforati o situazione fuori controllo" },
};

export function HealthSemaphore({
  status,
  slaCompliance,
  totalOpen,
  totalBreached,
}: {
  status: HealthStatus;
  slaCompliance: number;
  totalOpen: number;
  totalBreached: number;
}) {
  const c = CONFIG[status];
  return (
    <div className="rounded-xl border p-6 flex items-center gap-6">
      <div className={`${c.bg} w-16 h-16 rounded-full flex items-center justify-center shadow-lg`}>
        <span className="text-white text-2xl font-bold">{c.label[0]}</span>
      </div>
      <div>
        <h2 className="text-xl font-semibold">{c.label}</h2>
        <p className="text-sm text-gray-500">{c.desc}</p>
        <div className="flex gap-4 mt-2 text-sm">
          <span>Ticket aperti: <strong>{totalOpen}</strong></span>
          <span>SLA compliance: <strong>{slaCompliance.toFixed(0)}%</strong></span>
          <span>Sforati: <strong className="text-red-600">{totalBreached}</strong></span>
        </div>
      </div>
    </div>
  );
}
