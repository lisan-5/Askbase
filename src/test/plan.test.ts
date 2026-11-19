import { describe, expect, it } from "vitest";
import { checkSql } from "@/lib/plan";
import { generateDemo, toCsv } from "@/lib/demo-data";
import { genericPlan, offlinePlan } from "@/lib/offline";

describe("checkSql", () => {
  it.each([
    "SELECT 1",
    "with t as (select 1) select * from t;",
    "-- comment\nSELECT count(*) FROM orders",
    "SELECT 'drop table x; --' AS s",
  ])("allows read-only: %s", (sql) => {
    expect(checkSql(sql).ok).toBe(true);
  });

  it.each([
    "DROP TABLE orders",
    "SELECT 1; DELETE FROM orders",
    "INSERT INTO orders VALUES (1)",
    "SELECT * FROM read_csv_auto('https://evil.example/x.csv')",
    "INSTALL httpfs",
    "",
  ])("blocks: %s", (sql) => {
    expect(checkSql(sql).ok).toBe(false);
  });
});

describe("sample data", () => {
  const demo = generateDemo();
  it("is deterministic and sizeable", () => {
    expect(generateDemo().orders.length).toBe(demo.orders.length);
    expect(demo.orders.length).toBeGreaterThan(5000);
    expect(demo.customers.length).toBeGreaterThan(1500);
  });
  it("bakes in the March 2026 refund spike", () => {
    const rate = (m: string) => {
      const os = demo.orders.filter((o) => String(o.order_date).startsWith(m));
      return os.filter((o) => o.status === "refunded").length / os.length;
    };
    expect(rate("2026-03")).toBeGreaterThan(rate("2026-02") * 3);
  });
  it("writes valid CSV", () => {
    const csv = toCsv(demo.products);
    expect(csv.split("\n")[0]).toBe("product_id,name,category,unit_price,unit_cost");
  });
});

describe("offline engine", () => {
  it.each([
    ["What was net revenue by month?", "area"],
    ["Which products lost money last quarter?", "hbar"],
    ["revenue by channel", "bar"],
    ["refund rate by month", "line"],
    ["MRR by plan", "bar"],
    ["How many orders in total?", "kpi"],
  ])("plans %s", (q, kind) => {
    const plan = offlinePlan(q);
    expect(plan).not.toBeNull();
    expect(plan!.chart.kind).toBe(kind);
    expect(checkSql(plan!.sql).ok).toBe(true);
  });
  it("declines what it can't answer", () => {
    expect(offlinePlan("write me a poem about coffee")).toBeNull();
  });
});

describe("generic built-in patterns (uploaded files)", () => {
  const t = {
    name: "sales_export_2026",
    columns: [
      { name: "month", type: "DATE" },
      { name: "region", type: "VARCHAR" },
      { name: "revenue", type: "BIGINT" },
    ],
  };
  it.each([
    ["What's in sales_export_2026?", "table"],
    ["Total revenue by region in sales_export_2026", "bar"],
    ["revenue over time in sales_export_2026", "area"],
    ["how many rows in sales_export_2026", "kpi"],
  ])("plans %s", (q, kind) => {
    const plan = genericPlan(q, [t]);
    expect(plan?.chart.kind).toBe(kind);
    expect(checkSql(plan!.sql).ok).toBe(true);
  });
});
