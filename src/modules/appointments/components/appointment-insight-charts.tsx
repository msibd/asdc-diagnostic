"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Kept in its own module so recharts is only downloaded when the insights are shown.

export type StatusSlice = { key: string; name: string; count: number; color: string };
export type DayBar = { label: string; full: string; count: number; tone: "past" | "today" | "future" };
export type HourBar = { label: string; count: number };

const TONES: Record<DayBar["tone"], string> = {
  past: "#c9a994",
  today: "#c2410c",
  future: "#f97316",
};

export function StatusDonut({
  data,
  activeKey,
  onSelect,
}: {
  data: StatusSlice[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const visible = data.filter((slice) => slice.count > 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={visible}
          dataKey="count"
          nameKey="name"
          innerRadius="58%"
          outerRadius="92%"
          paddingAngle={visible.length > 1 ? 2 : 0}
          stroke="#fff"
          strokeWidth={2}
          isAnimationActive={false}
          onClick={(slice) => {
            const key = (slice as unknown as { payload?: StatusSlice }).payload?.key;
            if (key) onSelect(key);
          }}
          style={{ cursor: "pointer", outline: "none" }}
        >
          {visible.map((slice) => (
            <Cell
              key={slice.key}
              fill={slice.color}
              fillOpacity={activeKey === "ALL" || activeKey === slice.key ? 1 : 0.35}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value, name) => [`${value ?? 0}`, `${name ?? ""}`]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DayBars({ data }: { data: DayBar[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e8eef4" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} interval={0} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={34} />
        <Tooltip
          cursor={{ fill: "rgb(234 88 12 / 8%)" }}
          labelFormatter={(_, payload) => (payload?.[0]?.payload as DayBar | undefined)?.full ?? ""}
          formatter={(value) => [`${value ?? 0}`, "Appointments"]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
          {data.map((bar, index) => (
            <Cell key={`${bar.label}-${index}`} fill={TONES[bar.tone]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HourBars({ data }: { data: HourBar[] }) {
  const peak = Math.max(0, ...data.map((bar) => bar.count));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e8eef4" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} interval={0} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={34} />
        <Tooltip cursor={{ fill: "rgb(234 88 12 / 8%)" }} formatter={(value) => [`${value ?? 0}`, "Appointments"]} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
          {data.map((bar) => (
            <Cell key={bar.label} fill={peak > 0 && bar.count === peak ? "#c2410c" : "#fdba74"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
