/** Renders a query result as the chart the plan asked for, with sensible fallbacks. */
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { QueryResult } from "@/lib/db";
import { fmtValue, fmtX, label, type Fmt } from "@/lib/format";
import type { Plan } from "@/lib/plan";

export const SERIES = [
  "var(--color-cobalt)",
  "var(--color-coral)",
  "var(--color-mint)",
  "var(--color-violet)",
];

export function AnswerChart({
  plan,
  result,
  height = 300,
}: {
  plan: Plan;
  result: QueryResult;
  height?: number;
}) {
  const { chart } = plan;
  const cols = result.columns.map((c) => c.name);
  const y = chart.y.filter((c) => cols.includes(c));
  const numeric = cols.filter((c) => result.rows.some((r) => typeof r[c] === "number"));
  const ys = y.length ? y : numeric.slice(0, 1);
  const x = cols.includes(chart.x) ? chart.x : (cols.find((c) => !numeric.includes(c)) ?? cols[0]);
  let kind = chart.kind;
  if (kind !== "table" && (!ys.length || !result.rows.length)) kind = "table";
  if (kind === "kpi" && result.rows.length > 1) kind = "table";

  const data = useMemo(() => result.rows.slice(0, 400), [result.rows]);
  const fmt = chart.format as Fmt;

  if (kind === "kpi") {
    return (
      <div className="flex min-h-[160px] flex-col justify-center gap-2 py-6">
        {ys.map((c) => (
          <div key={c}>
            <div className="eyebrow">{label(c)}</div>
            <div className="display num text-6xl font-semibold sm:text-7xl">
              {fmtValue(data[0]?.[c], fmt)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "table") return <DataTable result={result} fmt={fmt} />;

  const axis = { stroke: "var(--color-muted)", fontSize: 11, fontFamily: "var(--font-mono)" };
  const tooltip = (
    <Tooltip
      cursor={{ fill: "var(--color-line)", stroke: "var(--color-line-strong)" }}
      contentStyle={{
        background: "var(--color-card)",
        border: "1px solid var(--color-line-strong)",
        borderRadius: 12,
        fontSize: 12,
        boxShadow: "0 12px 30px -16px rgba(0,0,0,.35)",
      }}
      labelFormatter={(v) => fmtX(v)}
      formatter={(v: number, name: string) => [fmtValue(v, fmt), label(name)]}
    />
  );
  const grid = <CartesianGrid stroke="var(--color-line)" vertical={false} />;

  if (kind === "hbar") {
    return (
      <ResponsiveContainer width="100%" height={Math.max(height, data.length * 30 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--color-line)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => fmtValue(v, fmt, true)}
            {...axis}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey={x}
            width={190}
            {...axis}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => String(v).slice(0, 28)}
          />
          {tooltip}
          {ys.map((c, i) => (
            <Bar
              key={c}
              dataKey={c}
              radius={[0, 6, 6, 0]}
              fill={SERIES[i % SERIES.length]}
              isAnimationActive
              animationDuration={700}
            >
              {ys.length === 1 &&
                data.map((row, j) => (
                  <Cell key={j} fill={Number(row[c]) < 0 ? "var(--color-coral)" : SERIES[0]} />
                ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const common = {
    data,
    margin: { left: 4, right: 12, top: 12, bottom: 4 },
  };
  const xAxis = (
    <XAxis
      dataKey={x}
      tickFormatter={fmtX}
      {...axis}
      tickLine={false}
      axisLine={false}
      minTickGap={24}
    />
  );
  const yAxis = (
    <YAxis
      tickFormatter={(v) => fmtValue(v, fmt, true)}
      {...axis}
      tickLine={false}
      axisLine={false}
      width={64}
    />
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {kind === "bar" ? (
        <BarChart {...common}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          {ys.map((c, i) => (
            <Bar
              key={c}
              dataKey={c}
              radius={[6, 6, 0, 0]}
              fill={SERIES[i % SERIES.length]}
              maxBarSize={56}
            >
              {ys.length === 1 &&
                data.map((row, j) => (
                  <Cell key={j} fill={Number(row[c]) < 0 ? "var(--color-coral)" : SERIES[0]} />
                ))}
            </Bar>
          ))}
        </BarChart>
      ) : kind === "area" ? (
        <AreaChart {...common}>
          <defs>
            {ys.map((c, i) => (
              <linearGradient key={c} id={`g-${c}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={SERIES[i % SERIES.length]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={SERIES[i % SERIES.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          {ys.map((c, i) => (
            <Area
              key={c}
              type="monotone"
              dataKey={c}
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={2.2}
              fill={`url(#g-${c})`}
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart {...common}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          {ys.map((c, i) => (
            <Line
              key={c}
              type="monotone"
              dataKey={c}
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={2.2}
              dot={false}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

export function DataTable({
  result,
  fmt,
  max = 200,
}: {
  result: QueryResult;
  fmt?: Fmt;
  max?: number;
}) {
  const rows = result.rows.slice(0, max);
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 bg-bg-2">
          <tr>
            {result.columns.map((c) => (
              <th
                key={c.name}
                className="whitespace-nowrap border-b border-line px-3 py-2 font-mono text-[11px] font-normal text-muted"
              >
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0 hover:bg-bg-2/60">
              {result.columns.map((c) => {
                const v = r[c.name];
                const isNum = typeof v === "number";
                return (
                  <td
                    key={c.name}
                    className={`whitespace-nowrap px-3 py-1.5 ${isNum ? "num text-right" : ""}`}
                  >
                    {isNum &&
                    fmt &&
                    /revenue|total|spend|price|cost|profit|mrr|value|amount/.test(c.name)
                      ? fmtValue(v, fmt)
                      : isNum
                        ? fmtValue(v, "number")
                        : (v ?? "—")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > max && (
        <p className="border-t border-line px-3 py-2 text-xs text-muted">
          Showing {max} of {result.rows.length.toLocaleString()} rows.
        </p>
      )}
    </div>
  );
}
