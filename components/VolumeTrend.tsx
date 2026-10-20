"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export function VolumeTrend({ data }: { data: { date: string; opened: number; resolved: number }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) =>
              new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
            }
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="opened" stroke="#ef4444" name="Aperti" strokeWidth={2} />
          <Line type="monotone" dataKey="resolved" stroke="#22c55e" name="Risolti" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
