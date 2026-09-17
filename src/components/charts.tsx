"use client";

import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { courseBreakdown, weeklyPresence } from "@/lib/data";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--text)",
};

export function PresenceChart() {
  const { resolvedTheme } = useTheme();
  const stroke = resolvedTheme === "dark" ? "#e7a53c" : "#0b1c33";

  return (
    <div className="h-[240px] px-2 pb-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={weeklyPresence}>
          <defs>
            <linearGradient id="navyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} domain={[70, 100]} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey="present"
            stroke={stroke}
            strokeWidth={2}
            fill="url(#navyFill)"
            name="Présents (%)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CourseChart() {
  const { resolvedTheme } = useTheme();
  const fill = resolvedTheme === "dark" ? "#1c3d66" : "#143054";
  const highlight = resolvedTheme === "dark" ? "#e7a53c" : "#e29a2b";

  return (
    <div className="h-[240px] px-2 pb-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={courseBreakdown} barSize={28}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="course" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="rate" radius={[6, 6, 0, 0]} name="Assiduité (%)">
            {courseBreakdown.map((entry) => (
              <Cell key={entry.course} fill={entry.rate < 90 ? highlight : fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
