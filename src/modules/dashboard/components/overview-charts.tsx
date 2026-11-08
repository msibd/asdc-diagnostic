"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Kept in its own module so recharts is only downloaded where a chart is rendered.

export function TreatmentDonut({
  data,
  colors,
}: {
  data: { name: string; count: number }[];
  colors: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          innerRadius="57%"
          outerRadius="91%"
          paddingAngle={2}
          stroke="#fff"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((treatment, index) => (
            <Cell key={treatment.name} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value ?? 0}`, "Appointments"]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AppointmentsBarChart({
  data,
}: {
  data: { label: string; appointments: number; completed: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={5}>
        <CartesianGrid vertical={false} stroke="#edf1f5" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8290a2", fontSize: 11 }}
          dy={5}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#a1aab8", fontSize: 10 }}
          width={32}
        />
        <Tooltip
          cursor={{ fill: "#f4f7fc" }}
          contentStyle={{ border: "1px solid #e8edf2", borderRadius: 8, fontSize: 11 }}
        />
        <Legend verticalAlign="top" align="left" iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingBottom: 8, paddingLeft: 14 }} />
        <Bar dataKey="appointments" name="Appointments" fill="#4388ed" radius={[3, 3, 0, 0]} maxBarSize={13} isAnimationActive={false} />
        <Bar dataKey="completed" name="Completed" fill="#16d28b" radius={[3, 3, 0, 0]} maxBarSize={13} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
