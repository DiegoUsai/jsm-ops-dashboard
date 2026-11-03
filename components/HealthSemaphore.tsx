"use client";

import type { HealthStatus } from "@/lib/types";

const STATUS: Record<HealthStatus, { dot: string; bg: string; border: string; label: string; desc: string }> = {
  green: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    label: "Operativo",
    desc: "SLA rispettati, backlog sotto controllo",
  },
  yellow: {
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "Attenzione",
    desc: "Alcuni SLA a rischio o backlog in crescita",
  },
  red: {
    dot: "bg-red-500",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Critico",
    desc: "SLA sforati o situazione fuori controllo",
  },
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
  const c = STATUS[status];
  return (
    <div className={`rounded-xl ${c.bg} ${c.border} border p-5`}>
      <div className="flex items-center gap-2.5 mb-1">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${c.dot}`}
          style={status === "green" ? { animation: "pulse-alive 3s ease-in-out infinite" } : undefined}
        />
        <h2 className="text-lg font-semibold">{c.label}</h2>
      </div>
      <p className="text-sm text-slate-500 mb-3">{c.desc}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
        <span>
          Aperti: <strong className="font-mono tabular-nums">{totalOpen}</strong>
        </span>
        <span>
          SLA compliance: <strong className="font-mono tabular-nums">{slaCompliance.toFixed(0)}%</strong>
        </span>
        <span>
          Sforati:{" "}
          <strong className={`font-mono tabular-nums ${totalBreached > 0 ? "text-red-600" : ""}`}>
            {totalBreached}
          </strong>
        </span>
      </div>
    </div>
  );
}
