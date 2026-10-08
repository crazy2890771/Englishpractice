"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const AXIS = { stroke: "rgb(var(--muted))", fontSize: 12, tickLine: false, axisLine: false } as const;
const TOOLTIP = {
  contentStyle: { background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12, color: "rgb(var(--fg))", fontSize: 12 },
  labelStyle: { color: "rgb(var(--fg))", fontWeight: 600 },
  cursor: { fill: "rgb(var(--brand) / 0.08)" },
};
export const SERIES = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4"];

export function ActivityBars({ data, height = 180 }: { data: { label: string; minutes: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`Study minutes: ${data.map((d) => `${d.label} ${d.minutes}`).join(", ")}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis {...AXIS} allowDecimals={false} />
          <Tooltip {...TOOLTIP} formatter={(v: number) => [`${v} min`, "Study time"]} />
          <Bar dataKey="minutes" radius={[6, 6, 0, 0]} fill="url(#barGrad)" maxBarSize={36} />
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#818cf8" />
              <stop offset="1" stopColor="#6366f1" stopOpacity={0.7} />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLines({ data, lines, height = 220, yMax = 100 }: { data: Record<string, string | number | null>[]; lines: { key: string; label: string }[]; height?: number; yMax?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`Trend chart: ${lines.map((l) => l.label).join(", ")}`}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis {...AXIS} domain={[0, yMax]} />
          <Tooltip {...TOOLTIP} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lines.map((l, i) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={SERIES[i % SERIES.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryPie({ data, height = 220 }: { data: { name: string; value: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`Mistakes by category: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={3}>
            {data.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} stroke="none" />)}
          </Pie>
          <Tooltip {...TOOLTIP} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompareRadar({ data, height = 300 }: { data: { skill: string; day1: number; day30: number | null }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`Skill comparison: ${data.map((d) => `${d.skill} ${d.day1} to ${d.day30 ?? "pending"}`).join(", ")}`}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="rgb(var(--border))" />
          <PolarAngleAxis dataKey="skill" tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar name="Day 1" dataKey="day1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.25} />
          <Radar name="Day 30" dataKey="day30" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip {...TOOLTIP} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
