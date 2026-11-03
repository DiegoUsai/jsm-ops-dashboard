"use client";

import { useEffect, useState } from "react";

interface VipRule {
  id: number;
  organization_id: string | null;
  organization_name: string | null;
  reporter_pattern: string | null;
  priority_boost: number;
  max_first_response_ms: number | null;
  notes: string | null;
  active: boolean;
}

export default function VipConfig() {
  const [rules, setRules] = useState<VipRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [reporterPattern, setReporterPattern] = useState("");
  const [priorityBoost, setPriorityBoost] = useState("0.3");
  const [maxResponseH, setMaxResponseH] = useState("");
  const [notes, setNotes] = useState("");

  async function fetchRules() {
    const res = await fetch("/api/vip");
    const data = await res.json();
    setRules(data.rules ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchRules();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/vip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_name: orgName || null,
        organization_id: orgId || null,
        reporter_pattern: reporterPattern || null,
        priority_boost: parseFloat(priorityBoost) || 0.3,
        max_first_response_ms: maxResponseH
          ? Math.round(parseFloat(maxResponseH) * 3_600_000)
          : null,
        notes: notes || null,
      }),
    });
    setOrgName("");
    setOrgId("");
    setReporterPattern("");
    setPriorityBoost("0.3");
    setMaxResponseH("");
    setNotes("");
    setShowForm(false);
    setSaving(false);
    fetchRules();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/vip?id=${id}`, { method: "DELETE" });
    fetchRules();
  }

  function formatMs(ms: number | null): string {
    if (ms == null) return "—";
    const h = ms / 3_600_000;
    return h >= 1 ? `${h}h` : `${Math.round(ms / 60_000)}m`;
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="rounded-xl border border-slate-200 bg-slate-100 h-64" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-500">Regole VIP</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organizzazioni e reporter con priorità elevata
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Dashboard
          </a>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm font-medium text-white bg-slate-800 rounded-lg px-4 py-2 hover:bg-slate-700 transition-colors"
          >
            {showForm ? "Annulla" : "Aggiungi regola"}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                Nome organizzazione
              </span>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="es. Acme Corp"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                ID organizzazione
              </span>
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="opzionale"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                Pattern reporter
              </span>
              <input
                type="text"
                value={reporterPattern}
                onChange={(e) => setReporterPattern(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="es. *@acme.com"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                Priority boost
              </span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={priorityBoost}
                onChange={(e) => setPriorityBoost(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                Max prima risposta (ore)
              </span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={maxResponseH}
                onChange={(e) => setMaxResponseH(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="es. 2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Note</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="opzionale"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving || (!orgName && !reporterPattern)}
            className="text-sm font-medium text-white bg-slate-800 rounded-lg px-4 py-2 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Salvataggio…" : "Salva"}
          </button>
        </form>
      )}

      {rules.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            Nessuna regola VIP configurata
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="text-left p-3 font-medium text-slate-500">
                  Organizzazione
                </th>
                <th className="text-left p-3 font-medium text-slate-500">
                  Reporter
                </th>
                <th className="text-right p-3 font-medium text-slate-500">
                  Boost
                </th>
                <th className="text-right p-3 font-medium text-slate-500">
                  Max risposta
                </th>
                <th className="text-left p-3 font-medium text-slate-500">
                  Note
                </th>
                <th className="p-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="p-3 text-slate-900">
                    {r.organization_name ?? "—"}
                    {r.organization_id && (
                      <span className="block text-xs text-slate-500">
                        {r.organization_id}
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-slate-700">
                    {r.reporter_pattern ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.priority_boost}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {formatMs(r.max_first_response_ms)}
                  </td>
                  <td className="p-3 text-slate-600 text-xs">{r.notes ?? ""}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
