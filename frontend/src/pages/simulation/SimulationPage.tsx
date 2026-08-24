import { useState } from "react";
import MainLayout from "../../components/layout/MainLayout";
import {
  compareSimulations,
  fetchSimulationSnapshot,
  runSimulation,
  type LoanProductInput,
  type SimulationResult,
  type SimulationRunRequest,
} from "../../services/simulationService";

const SCENARIO_KEY = "ff_simulation_scenarios";

function inr(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function defaultProduct(): LoanProductInput {
  return {
    product_id: "P1",
    name: "Product A",
    principal: 5000,
    installment_amount: 120,
    installment_principal: 100,
    installment_profit: 20,
    installment_count: 50,
    frequency: "DAILY",
    same_day_collection: false,
    weight: 1,
  };
}

function defaultRequest(): SimulationRunRequest {
  return {
    simulation_mode: "HYPOTHETICAL",
    capital_source: "MANUAL",
    manual_starting_capital: 100000,
    additional_capital: 0,
    products: [defaultProduct()],
    reinvestment: { percentage: 100, mode: "TOTAL_ELIGIBLE_CASH" },
    withdrawal: { percentage: 0, start_day: 0 },
    target: {
      target_type: "MONTHLY_PROFIT",
      target_value: 100000,
      monthly_method: "RUN_RATE_X30",
    },
    simulation_days: 365,
    risk: {
      preset: "OPTIMISTIC",
      collection_efficiency: 100,
      idle_cash_percent: 0,
      operating_expense_per_day: 0,
      agent_commission_percent: 0,
    },
    deploy_on_start_day: true,
    scenario_name: "Scenario",
    include_daily: true,
    include_aggregates: true,
    max_daily_rows: 400,
  };
}

export default function SimulationPage() {
  const [form, setForm] = useState<SimulationRunRequest>(defaultRequest);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [compare, setCompare] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tableView, setTableView] = useState<"daily" | "weekly" | "monthly">("daily");
  const [explainDay, setExplainDay] = useState<number | null>(null);
  const [savedNames, setSavedNames] = useState<string[]>(() => {
    try {
      return Object.keys(JSON.parse(localStorage.getItem(SCENARIO_KEY) || "{}"));
    } catch {
      return [];
    }
  });

  const product = form.products[0] ?? defaultProduct();

  function updateProduct(patch: Partial<LoanProductInput>) {
    const next = { ...product, ...patch };
    if (
      patch.installment_principal != null ||
      patch.installment_profit != null
    ) {
      next.installment_amount =
        Number(next.installment_principal) + Number(next.installment_profit);
    }
    setForm({ ...form, products: [next, ...form.products.slice(1)] });
  }

  async function loadCurrentBusiness() {
    setError("");
    try {
      setLoading(true);
      const snap = await fetchSimulationSnapshot();
      const products =
        snap.products?.length > 0
          ? snap.products.map((p: Record<string, string>, i: number) => ({
              product_id: String(p.product_id || `P${i + 1}`),
              name: String(p.name || `Product ${i + 1}`),
              principal: Number(p.principal || 5000),
              installment_amount: Number(p.installment_amount || 120),
              installment_principal: Number(p.installment_principal || 100),
              installment_profit: Number(p.installment_profit || 20),
              installment_count: Number(p.installment_count || 50),
              frequency: String(p.frequency || "DAILY"),
            }))
          : [defaultProduct()];
      setForm({
        ...form,
        simulation_mode: "CURRENT_BUSINESS",
        capital_source: "CURRENT",
        manual_starting_capital: Number(snap.available_cash || 0),
        products,
        scenario_name: "Current business",
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } })
        ?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      if (status === 401 || status === 403) {
        setError("Owner login required to load current business data.");
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Could not load current business snapshot. Try again in a moment.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    setError("");
    setCompare(null);
    try {
      setLoading(true);
      const data = await runSimulation(form);
      setResult(data);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      setError(typeof detail === "string" ? detail : "Simulation failed.");
    } finally {
      setLoading(false);
    }
  }

  function saveScenario() {
    const name = form.scenario_name.trim() || `Scenario ${Date.now()}`;
    const all = JSON.parse(localStorage.getItem(SCENARIO_KEY) || "{}");
    all[name] = form;
    localStorage.setItem(SCENARIO_KEY, JSON.stringify(all));
    setSavedNames(Object.keys(all));
  }

  function loadScenario(name: string) {
    const all = JSON.parse(localStorage.getItem(SCENARIO_KEY) || "{}");
    if (all[name]) setForm(all[name]);
  }

  async function handleCompare() {
    const all = JSON.parse(localStorage.getItem(SCENARIO_KEY) || "{}");
    const names = Object.keys(all).slice(0, 5);
    if (names.length < 2) {
      setError("Save at least 2 scenarios to compare.");
      return;
    }
    setError("");
    try {
      setLoading(true);
      const data = await compareSimulations(names.map((n) => ({ ...all[n], scenario_name: n })));
      setCompare(data.scenarios || []);
    } catch {
      setError("Compare failed.");
    } finally {
      setLoading(false);
    }
  }

  const days = result?.days ?? [];
  const explain = explainDay != null ? days.find((d) => d.day === explainDay) : null;

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 pb-16">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Lending Simulation</h1>
          <p className="text-sm text-slate-600">
            Dynamic forecast only — never creates real loans, payments, or capital movements.
          </p>
        </header>

        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="font-medium text-slate-800">1. Mode</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${form.simulation_mode === "CURRENT_BUSINESS" ? "bg-blue-600 text-white" : "border"}`}
                onClick={() => void loadCurrentBusiness()}
              >
                Use current business
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${form.simulation_mode === "HYPOTHETICAL" ? "bg-blue-600 text-white" : "border"}`}
                onClick={() =>
                  setForm({
                    ...defaultRequest(),
                    simulation_mode: "HYPOTHETICAL",
                    capital_source: "MANUAL",
                  })
                }
              >
                New hypothetical
              </button>
            </div>

            <label className="block text-sm">
              Starting capital source
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.capital_source}
                onChange={(e) => setForm({ ...form, capital_source: e.target.value })}
              >
                <option value="CURRENT">Current available capital</option>
                <option value="MANUAL">Manual</option>
                <option value="CURRENT_PLUS_ADDITIONAL">Current + additional</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </label>
            <label className="block text-sm">
              Manual / additional capital
              <input
                type="number"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.manual_starting_capital}
                onChange={(e) =>
                  setForm({ ...form, manual_starting_capital: Number(e.target.value) })
                }
              />
            </label>
            <label className="block text-sm">
              Additional capital
              <input
                type="number"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.additional_capital}
                onChange={(e) =>
                  setForm({ ...form, additional_capital: Number(e.target.value) })
                }
              />
            </label>
          </div>

          <div className="space-y-3">
            <h2 className="font-medium text-slate-800">2. Loan product</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                Principal
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border px-2 py-2"
                  value={product.principal}
                  onChange={(e) => updateProduct({ principal: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                Installments
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border px-2 py-2"
                  value={product.installment_count}
                  onChange={(e) =>
                    updateProduct({ installment_count: Number(e.target.value) })
                  }
                />
              </label>
              <label className="text-sm">
                Principal / installment
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border px-2 py-2"
                  value={product.installment_principal}
                  onChange={(e) =>
                    updateProduct({ installment_principal: Number(e.target.value) })
                  }
                />
              </label>
              <label className="text-sm">
                Profit / installment
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border px-2 py-2"
                  value={product.installment_profit}
                  onChange={(e) =>
                    updateProduct({ installment_profit: Number(e.target.value) })
                  }
                />
              </label>
              <label className="text-sm col-span-2">
                Collection / installment (auto)
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border px-2 py-2 bg-slate-50"
                  value={product.installment_amount}
                  readOnly
                />
              </label>
              <label className="text-sm col-span-2">
                Frequency
                <select
                  className="mt-1 w-full rounded-lg border px-2 py-2"
                  value={product.frequency}
                  onChange={(e) => updateProduct({ frequency: e.target.value })}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="BI_WEEKLY">Bi-weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-medium text-slate-800">3. Reinvestment & withdrawal</h2>
            <label className="block text-sm">
              Reinvestment %
              <input
                type="number"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.reinvestment.percentage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reinvestment: {
                      ...form.reinvestment,
                      percentage: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="block text-sm">
              Reinvestment mode
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.reinvestment.mode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reinvestment: { ...form.reinvestment, mode: e.target.value },
                  })
                }
              >
                <option value="TOTAL_ELIGIBLE_CASH">% of total eligible cash</option>
                <option value="FULL_PRINCIPAL_PLUS_PROFIT_PCT">
                  100% principal + % of profit
                </option>
                <option value="PCT_OF_BOTH">% of principal and profit</option>
              </select>
            </label>
            <label className="block text-sm">
              Profit withdrawal %
              <input
                type="number"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.withdrawal.percentage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    withdrawal: {
                      ...form.withdrawal,
                      percentage: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="block text-sm">
              Withdrawal start day
              <input
                type="number"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.withdrawal.start_day}
                onChange={(e) =>
                  setForm({
                    ...form,
                    withdrawal: {
                      ...form.withdrawal,
                      start_day: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          </div>

          <div className="space-y-3">
            <h2 className="font-medium text-slate-800">4. Target & horizon</h2>
            <label className="block text-sm">
              Target type
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.target.target_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    target: { ...form.target, target_type: e.target.value },
                  })
                }
              >
                <option value="MONTHLY_PROFIT">Monthly profit (×30 run-rate)</option>
                <option value="DAILY_PROFIT">Daily profit</option>
                <option value="CUMULATIVE_PROFIT">Cumulative profit</option>
                <option value="OWNER_WITHDRAWAL">Owner withdrawal (daily)</option>
                <option value="LENDING_CAPITAL">Available lending cash</option>
                <option value="ACTIVE_LOAN_COUNT">Active loan count</option>
                <option value="TOTAL_PORTFOLIO">Total portfolio</option>
                <option value="TOTAL_COLLECTIONS">Cumulative collections</option>
              </select>
            </label>
            <label className="block text-sm">
              Target value
              <input
                type="number"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.target.target_value}
                onChange={(e) =>
                  setForm({
                    ...form,
                    target: { ...form.target, target_value: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label className="block text-sm">
              Simulation days
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.simulation_days}
                onChange={(e) =>
                  setForm({ ...form, simulation_days: Number(e.target.value) })
                }
              >
                {[30, 60, 90, 180, 365, 730, 1095, 1825].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Collection efficiency %
              <input
                type="number"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.risk.collection_efficiency}
                onChange={(e) =>
                  setForm({
                    ...form,
                    risk: {
                      ...form.risk,
                      collection_efficiency: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="block text-sm">
              Scenario name
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.scenario_name}
                onChange={(e) => setForm({ ...form, scenario_name: e.target.value })}
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleRun()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Running…" : "Run simulation"}
          </button>
          <button type="button" onClick={saveScenario} className="rounded-lg border px-4 py-2 text-sm">
            Save scenario
          </button>
          <button type="button" onClick={() => void handleCompare()} className="rounded-lg border px-4 py-2 text-sm">
            Compare saved
          </button>
          {savedNames.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => loadScenario(n)}
              className="rounded-lg bg-slate-100 px-3 py-2 text-xs"
            >
              Load: {n}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <>
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                {result.message}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Target status</p>
                  <p className="text-lg font-semibold">{result.summary.target_status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Target day / date</p>
                  <p className="text-lg font-semibold">
                    {result.summary.target_day ?? "—"}{" "}
                    <span className="text-sm font-normal text-slate-600">
                      {result.summary.target_date ?? ""}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Monthly profit at target</p>
                  <p className="text-lg font-semibold">
                    {inr(result.summary.monthly_profit_at_target)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Active loans at target</p>
                  <p className="text-lg font-semibold">
                    {result.summary.active_loans_at_target ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Daily collection</p>
                  <p className="font-semibold">{inr(result.summary.daily_collection_at_target)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cumulative profit</p>
                  <p className="font-semibold">{inr(result.summary.cumulative_profit_at_target)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Max metric in horizon</p>
                  <p className="font-semibold">
                    {inr(result.summary.max_target_metric)} (day {result.summary.max_target_day})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Progress (last day)</p>
                  <p className="font-semibold">
                    {Number(days.at(-1)?.target_progress_pct ?? 0).toFixed(1)}%
                    {Number(days.at(-1)?.target_progress_pct ?? 0) > 100 ? "+" : ""}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-medium">Projection table</h2>
                {(["daily", "weekly", "monthly"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTableView(v)}
                    className={`rounded px-2 py-1 text-xs capitalize ${tableView === v ? "bg-slate-900 text-white" : "border"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {tableView === "daily" ? (
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        {[
                          "Day",
                          "Date",
                          "Cash start",
                          "Active",
                          "Collection",
                          "Principal",
                          "Profit",
                          "New loans",
                          "Deployed",
                          "Withdrawn",
                          "Cash end",
                          "×30",
                          "Progress",
                          "",
                        ].map((h) => (
                          <th key={h} className="px-2 py-2 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((d) => (
                        <tr
                          key={d.day}
                          className={`border-t ${d.target_reached ? "bg-emerald-50" : ""}`}
                        >
                          <td className="px-2 py-1">{d.day}</td>
                          <td className="px-2 py-1">{d.date}</td>
                          <td className="px-2 py-1">{inr(d.starting_cash)}</td>
                          <td className="px-2 py-1">{d.active_loans}</td>
                          <td className="px-2 py-1">{inr(d.collection)}</td>
                          <td className="px-2 py-1">{inr(d.principal_recovery)}</td>
                          <td className="px-2 py-1">{inr(d.profit)}</td>
                          <td className="px-2 py-1">{d.new_loans}</td>
                          <td className="px-2 py-1">{inr(d.capital_deployed)}</td>
                          <td className="px-2 py-1">{inr(d.withdrawn_profit)}</td>
                          <td className="px-2 py-1">{inr(d.ending_cash)}</td>
                          <td className="px-2 py-1">{inr(d.daily_profit_x30)}</td>
                          <td className="px-2 py-1">
                            {Number(d.target_progress_pct).toFixed(0)}%
                          </td>
                          <td className="px-2 py-1">
                            <button
                              type="button"
                              className="text-blue-600 underline"
                              onClick={() => setExplainDay(d.day)}
                            >
                              Why
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        {["Period", "Collection", "Profit", "New loans", "Ending cash", "Active"].map(
                          (h) => (
                            <th key={h} className="px-2 py-2">
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(tableView === "weekly" ? result.weekly : result.monthly).map(
                        (row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1">
                              {String(row.start_date)} → {String(row.end_date)}
                            </td>
                            <td className="px-2 py-1">{inr(Number(row.collection))}</td>
                            <td className="px-2 py-1">{inr(Number(row.profit))}</td>
                            <td className="px-2 py-1">{String(row.new_loans)}</td>
                            <td className="px-2 py-1">{inr(Number(row.ending_cash))}</td>
                            <td className="px-2 py-1">{String(row.active_loans)}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {explain && (
              <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
                <h3 className="font-medium">Day {explain.day} explanation</h3>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  <li>Starting cash: {inr(explain.starting_cash)}</li>
                  <li>Collections: {inr(explain.collection)}</li>
                  <li>Principal: {inr(explain.principal_recovery)}</li>
                  <li>Profit: {inr(explain.profit)}</li>
                  <li>New loans: {explain.new_loans}</li>
                  <li>Capital deployed: {inr(explain.capital_deployed)}</li>
                  <li>Withdrawals: {inr(explain.withdrawn_profit)}</li>
                  <li>Ending cash: {inr(explain.ending_cash)}</li>
                  <li>Monthly run-rate: {inr(explain.daily_profit_x30)}</li>
                  <li>
                    Target reached: {explain.target_reached ? "Yes" : "No"} (
                    {Number(explain.target_progress_pct).toFixed(1)}%)
                  </li>
                </ul>
              </section>
            )}
          </>
        )}

        {compare && (
          <section className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-medium">Scenario comparison</h2>
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-2">Scenario</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Target day</th>
                    <th className="px-2 py-2">Active loans</th>
                    <th className="px-2 py-2">Monthly profit</th>
                    <th className="px-2 py-2">Cumulative profit</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map((row, i) => {
                    const s = row.summary as Record<string, unknown>;
                    return (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-2">{String(row.name)}</td>
                        <td className="px-2 py-2">{String(s.target_status)}</td>
                        <td className="px-2 py-2">{String(s.target_day ?? "—")}</td>
                        <td className="px-2 py-2">
                          {String(s.active_loans_at_target ?? "—")}
                        </td>
                        <td className="px-2 py-2">
                          {inr(Number(s.monthly_profit_at_target))}
                        </td>
                        <td className="px-2 py-2">
                          {inr(Number(s.cumulative_profit_at_target))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </MainLayout>
  );
}
