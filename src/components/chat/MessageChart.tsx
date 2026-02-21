"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CHART_COLORS = {
  primary: "#e4e4e7",
  grid: "rgba(255,255,255,0.08)",
  weight: "#a3e635",
  calories: "#f59e0b",
  protein: "#22d3ee",
  carbs: "#a78bfa",
  fat: "#f472b6",
  energy: "#38bdf8",
  hunger: "#fbbf24",
  activity: "#34d399",
};

export type ChartPayload =
  | { type: "weight"; title: string | null; data: { date: string; weight: number }[] }
  | { type: "calories"; title: string | null; data: { date: string; calories: number; protein: number; carbs: number; fat: number }[] }
  | { type: "activity"; title: string | null; data: { date: string; label: string; duration: number; calories: number }[] }
  | { type: "energy_hunger"; title: string | null; data: { date: string; energy: number; hunger: number }[] }
  | { type: "pie"; title: string | null; data: { name: string; value: number }[] };

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "Z");
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export default function MessageChart({ chart }: { chart: ChartPayload }) {
  const { type, title, data } = chart;
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const height = 220;

  if (type === "weight") {
    return (
      <div className="mt-3 w-full min-w-[260px]" style={{ minHeight: height + 32 }}>
        {title && <p className="mb-2 text-xs font-medium text-white/70">{title}</p>}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={formatDateShort} stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
            <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              labelFormatter={(label: any) => formatDateShort(label as string)}
              formatter={(value: number | undefined) => [`${value ?? 0} kg`, "Gewicht"]}
              labelStyle={{ color: "rgba(255,255,255,0.8)" }}
            />
            <Line type="monotone" dataKey="weight" stroke={CHART_COLORS.weight} strokeWidth={2} dot={{ fill: CHART_COLORS.weight, r: 3 }} name="Gewicht (kg)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "calories") {
    const hasAny = data.some((d: { calories?: number; protein?: number; carbs?: number; fat?: number }) => (d.calories ?? 0) > 0 || (d.protein ?? 0) > 0 || (d.carbs ?? 0) > 0 || (d.fat ?? 0) > 0);
    if (!hasAny) return null;
    return (
      <div className="mt-3 w-full min-w-[260px]" style={{ minHeight: height + 32 }}>
        {title && <p className="mb-2 text-xs font-medium text-white/70">{title}</p>}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={formatDateShort} stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
            <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              labelFormatter={(label: any) => formatDateShort(label as string)}
              formatter={(value: number, name: string) => [value, name === "calories" ? "Kcal" : name === "protein" ? "Protein (g)" : name === "carbs" ? "Carbs (g)" : "Fett (g)"]}
              labelStyle={{ color: "rgba(255,255,255,0.8)" }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v) => (v === "calories" ? "Kcal" : v === "protein" ? "Protein" : v === "carbs" ? "Carbs" : "Fett")} />
            <Bar dataKey="calories" fill={CHART_COLORS.calories} name="calories" radius={[4, 4, 0, 0]} />
            <Bar dataKey="protein" fill={CHART_COLORS.protein} name="protein" radius={[4, 4, 0, 0]} />
            <Bar dataKey="carbs" fill={CHART_COLORS.carbs} name="carbs" radius={[4, 4, 0, 0]} />
            <Bar dataKey="fat" fill={CHART_COLORS.fat} name="fat" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "activity") {
    return (
      <div className="mt-3 w-full min-w-[260px]" style={{ minHeight: height + 32 }}>
        {title && <p className="mb-2 text-xs font-medium text-white/70">{title}</p>}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={formatDateShort} stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
            <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              labelFormatter={(label: any) => formatDateShort(label as string)}
              formatter={(value: number, _: unknown, props: { payload: { label: string; duration: number; calories: number } }) => [
                value ? `${value} min` : (props.payload.calories ? `${props.payload.calories} kcal` : props.payload.label),
                "Aktivität",
              ]}
              labelStyle={{ color: "rgba(255,255,255,0.8)" }}
            />
            <Bar dataKey="duration" fill={CHART_COLORS.activity} name="Dauer (min)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "energy_hunger") {
    return (
      <div className="mt-3 w-full min-w-[260px]" style={{ minHeight: height + 32 }}>
        {title && <p className="mb-2 text-xs font-medium text-white/70">{title}</p>}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={formatDateShort} stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
            <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} domain={[1, 5]} />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              labelFormatter={(label: any) => formatDateShort(label as string)}
              formatter={(value: number, name: string) => [value, name === "energy" ? "Energie" : "Hunger"]}
              labelStyle={{ color: "rgba(255,255,255,0.8)" }}
            />
            <Line type="monotone" dataKey="energy" stroke={CHART_COLORS.energy} strokeWidth={2} dot={{ fill: CHART_COLORS.energy, r: 3 }} name="Energie" />
            <Line type="monotone" dataKey="hunger" stroke={CHART_COLORS.hunger} strokeWidth={2} dot={{ fill: CHART_COLORS.hunger, r: 3 }} name="Hunger" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "pie") {
    const pieData = data as { name: string; value: number }[];
    const PIE_COLORS = [CHART_COLORS.protein, CHART_COLORS.carbs, CHART_COLORS.fat];
    return (
      <div className="mt-3 w-full min-w-[260px]" style={{ minHeight: height + 32 }}>
        {title && <p className="mb-2 text-xs font-medium text-white/70">{title}</p>}
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: "rgba(255,255,255,0.4)" }}
            >
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              formatter={(value: number, name: string) => [`${value} g`, name]}
              labelStyle={{ color: "rgba(255,255,255,0.8)" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
