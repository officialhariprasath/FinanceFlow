import { useEffect, useMemo, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import DashboardCard from "../../components/dashboard/DashboardCard";
import { PageError, PageLoading } from "../../components/common/PageStates";
import ConfirmModal from "../../components/common/ConfirmModal";
import PromptModal from "../../components/common/PromptModal";
import PositiveEmptyState from "../../components/common/PositiveEmptyState";
import StatusChip from "../../components/common/StatusChip";
import { useToast } from "../../context/ToastContext";
import { useNavBadges } from "../../context/NavBadgesContext";
import {
  approveSettlement,
  getAllSettlements,
  getPendingSettlements,
  listAgentWallets,
  rejectSettlement,
} from "../../services/agentWalletService";
import type { AgentSettlement, AgentWalletBalance } from "../../types/agentWallet";
import { fmt } from "../../utils/fmt";

function num(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function deliveryLabel(method: string) {
  switch (method) {
    case "UPI":
      return "UPI";
    case "BANK":
      return "Bank";
    case "MIXED":
      return "Mixed";
    default:
      return "Cash";
  }
}

function isCrossChannel(s: AgentSettlement) {
  return (
    num(s.cash_amount) !== num(s.delivery_cash_amount) ||
    num(s.upi_amount) !== num(s.delivery_upi_amount) ||
    num(s.other_amount) !== num(s.delivery_other_amount)
  );
}

function isSameLocalDay(iso?: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function relativeTime(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleString();
}

function agentStateLabel(a: AgentWalletBalance): { label: string; className: string } {
  if (a.has_pending_settlement) {
    return {
      label: "Awaiting you",
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    };
  }
  const unsettled = num(a.unsettled_balance ?? a.total_balance);
  if (unsettled <= 0.009) {
    return {
      label: "Clear",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    };
  }
  if (a.status === "red" || unsettled >= 5000) {
    return {
      label: "At risk",
      className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    };
  }
  return {
    label: "Holding",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  };
}

function sortAgents(list: AgentWalletBalance[]) {
  return [...list].sort((a, b) => {
    const ap = a.has_pending_settlement ? 1 : 0;
    const bp = b.has_pending_settlement ? 1 : 0;
    if (ap !== bp) return bp - ap;
    const au = num(a.unsettled_balance ?? a.total_balance);
    const bu = num(b.unsettled_balance ?? b.total_balance);
    return bu - au;
  });
}

function ChannelLines({
  cash,
  upi,
  other,
  otherLabel = "Other",
}: {
  cash: string;
  upi: string;
  other: string;
  otherLabel?: string;
}) {
  return (
    <div className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
      <p>Cash {fmt(cash)}</p>
      <p>UPI {fmt(upi)}</p>
      <p>
        {otherLabel} {fmt(other)}
      </p>
    </div>
  );
}

export default function OwnerSettlementsPage() {
  const toast = useToast();
  const { refresh: refreshBadges } = useNavBadges();
  const [agents, setAgents] = useState<AgentWalletBalance[]>([]);
  const [pending, setPending] = useState<AgentSettlement[]>([]);
  const [history, setHistory] = useState<AgentSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);

  const [filterAgent, setFilterAgent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  async function load(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      const [agentList, pendingList, allList] = await Promise.all([
        listAgentWallets(),
        getPendingSettlements(),
        getAllSettlements(),
      ]);
      setAgents(agentList);
      setPending(pendingList);
      setHistory(allList.filter((s) => s.status !== "PENDING_VERIFICATION"));
    } catch {
      setError("Failed to load settlements. Owner access required.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmApprove() {
    if (!approveId) return;
    setActionId(approveId);
    try {
      await approveSettlement(approveId);
      toast.success("Settlement approved. Agent wallet updated.");
      await load(true);
      refreshBadges();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(typeof detail === "string" ? detail : "Approval failed.");
    } finally {
      setActionId(null);
      setApproveId(null);
    }
  }

  async function confirmReject(reason: string) {
    if (!rejectId) return;
    setActionId(rejectId);
    try {
      await rejectSettlement(rejectId, reason);
      toast.info("Settlement rejected. Agent has been notified.");
      await load(true);
      refreshBadges();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(typeof detail === "string" ? detail : "Rejection failed.");
    } finally {
      setActionId(null);
      setRejectId(null);
    }
  }

  const sortedAgents = useMemo(() => sortAgents(agents), [agents]);

  const summary = useMemo(() => {
    const unsettledTotal = agents.reduce(
      (sum, a) => sum + num(a.unsettled_balance ?? a.total_balance),
      0
    );
    const holdingCount = agents.filter(
      (a) => !a.has_pending_settlement && num(a.unsettled_balance ?? a.total_balance) > 0.009
    ).length;
    const atRiskCount = agents.filter(
      (a) => a.status === "red" || num(a.unsettled_balance ?? a.total_balance) >= 5000
    ).length;
    const pendingTotal = pending.reduce((sum, s) => sum + num(s.total_amount), 0);
    const approvedToday = history.filter(
      (s) =>
        (s.status === "COMPLETED" || s.status === "APPROVED") &&
        isSameLocalDay(s.reviewed_at ?? s.submitted_at)
    );
    const approvedTodayTotal = approvedToday.reduce((sum, s) => sum + num(s.total_amount), 0);
    return {
      unsettledTotal,
      holdingCount,
      atRiskCount,
      pendingCount: pending.length,
      pendingTotal,
      approvedTodayCount: approvedToday.length,
      approvedTodayTotal,
    };
  }, [agents, pending, history]);

  const filteredHistory = useMemo(() => {
    return history.filter((s) => {
      if (filterAgent !== "all" && String(s.agent_id) !== filterAgent) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (filterFrom) {
        const from = new Date(`${filterFrom}T00:00:00`);
        if (new Date(s.submitted_at) < from) return false;
      }
      if (filterTo) {
        const to = new Date(`${filterTo}T23:59:59.999`);
        if (new Date(s.submitted_at) > to) return false;
      }
      return true;
    });
  }, [history, filterAgent, filterStatus, filterFrom, filterTo]);

  const filteredHistoryTotal = useMemo(
    () => filteredHistory.reduce((sum, s) => sum + num(s.total_amount), 0),
    [filteredHistory]
  );

  const agentOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of agents) {
      if (a.agent_id != null) map.set(a.agent_id, a.agent_name || `Agent ${a.agent_id}`);
    }
    for (const s of history) {
      if (!map.has(s.agent_id)) {
        map.set(s.agent_id, s.agent_name || `Agent ${s.agent_id}`);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [agents, history]);

  const pendingSettlement = pending.find((s) => s.id === approveId);

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading settlements..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <PageError message={error} onRetry={() => load()} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Agent Settlements
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review pending handovers, track unsettled cash, and approve settlements
            </p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => load(true)}
            className="btn-secondary disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DashboardCard title="Unsettled with agents" value={fmt(summary.unsettledTotal)} />
          <div
            className={`surface-card flex min-h-[110px] flex-col justify-between p-4 ${
              summary.pendingCount
                ? "border-amber-300 dark:border-amber-700"
                : ""
            }`}
          >
            <h3 className="text-sm font-medium text-muted">Pending approval</h3>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 sm:text-3xl">
                {summary.pendingCount}
              </p>
              <p className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-200">
                {fmt(summary.pendingTotal)}
              </p>
            </div>
          </div>
          <DashboardCard
            title="Approved today"
            value={`${summary.approvedTodayCount} · ${fmt(summary.approvedTodayTotal)}`}
          />
          <DashboardCard
            title="Holding / at risk"
            value={`${summary.holdingCount} holding · ${summary.atRiskCount} at risk`}
          />
        </div>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="section-title">Needs your review</h2>
              <p className="text-sm text-muted">
                Approve only after you have received the cash, UPI, or bank transfer.
              </p>
            </div>
            {pending.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                {pending.length} pending
              </span>
            )}
          </div>

          {!pending.length ? (
            <div className="surface-card">
              <PositiveEmptyState
                title="All clear"
                message="No settlements waiting for your approval. Agents can submit from My Settlement."
              />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {pending.map((s) => {
                const cross = isCrossChannel(s);
                return (
                  <article
                    key={s.id}
                    className={`surface-card flex flex-col gap-4 p-4 sm:p-5 ${
                      cross ? "border-amber-300 dark:border-amber-700" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {s.agent_name || `Agent ${s.agent_id}`}
                        </p>
                        <p className="text-xs text-muted">
                          Submitted {relativeTime(s.submitted_at)} ·{" "}
                          {new Date(s.submitted_at).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {fmt(s.total_amount)}
                      </p>
                    </div>

                    {cross && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                        Cross-channel handover — clearing wallet mix differs from how they say they
                        delivered.
                      </p>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="surface-inset p-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                          Clearing from wallet
                        </p>
                        <ChannelLines
                          cash={s.cash_amount}
                          upi={s.upi_amount}
                          other={s.other_amount}
                        />
                      </div>
                      <div className="surface-inset p-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                          Received via {deliveryLabel(s.delivery_method)}
                        </p>
                        <ChannelLines
                          cash={s.delivery_cash_amount}
                          upi={s.delivery_upi_amount}
                          other={s.delivery_other_amount}
                          otherLabel="Bank"
                        />
                      </div>
                    </div>

                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted">Reference</dt>
                        <dd className="font-medium">{s.transfer_reference || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Transfer date</dt>
                        <dd className="font-medium">{s.transfer_date || "—"}</dd>
                      </div>
                      {(s.proof_notes || s.reconciliation_note) && (
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-muted">Notes</dt>
                          <dd className="font-medium text-slate-700 dark:text-slate-200">
                            {[s.proof_notes, s.reconciliation_note].filter(Boolean).join(" · ")}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={actionId === s.id}
                        onClick={() => setApproveId(s.id)}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionId === s.id}
                        onClick={() => setRejectId(s.id)}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="section-title">Collection agents</h2>
            <p className="text-sm text-muted">
              Sorted by what needs attention — pending first, then highest unsettled.
            </p>
          </div>

          {!sortedAgents.length ? (
            <div className="surface-card">
              <PositiveEmptyState
                title="No agents yet"
                message="Collection agents will appear here once they are added and start collecting."
              />
            </div>
          ) : (
            <div className="table-shell">
              <table className="min-w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3 text-left">Agent</th>
                    <th className="px-4 py-3 text-left">Area</th>
                    <th className="px-4 py-3 text-right">Today</th>
                    <th className="px-4 py-3 text-right">Unsettled</th>
                    <th className="px-4 py-3 text-left">Channels</th>
                    <th className="px-4 py-3 text-right">Pending</th>
                    <th className="px-4 py-3 text-center">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {sortedAgents.map((a) => {
                    const state = agentStateLabel(a);
                    const unsettled = a.unsettled_balance ?? a.total_balance;
                    return (
                      <tr
                        key={a.agent_id}
                        className={
                          a.has_pending_settlement
                            ? "bg-amber-50/60 dark:bg-amber-950/20"
                            : undefined
                        }
                      >
                        <td className="px-4 py-3 table-cell-strong">{a.agent_name}</td>
                        <td className="px-4 py-3 table-cell">{a.assigned_area || "—"}</td>
                        <td className="px-4 py-3 text-right">{fmt(a.today_collected ?? "0")}</td>
                        <td className="px-4 py-3 text-right font-semibold">{fmt(unsettled)}</td>
                        <td className="px-4 py-3">
                          <ChannelLines
                            cash={a.cash_balance}
                            upi={a.upi_balance}
                            other={a.other_balance}
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-300">
                          {a.has_pending_settlement
                            ? fmt(a.pending_settlement_total ?? "0")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${state.className}`}
                          >
                            {state.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title">Settlement history</h2>
              <p className="text-sm text-muted">
                Completed and rejected settlements
                {filteredHistory.length
                  ? ` · ${filteredHistory.length} shown · ${fmt(filteredHistoryTotal)}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="surface-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label-field" htmlFor="hist-agent">
                Agent
              </label>
              <select
                id="hist-agent"
                className="input-field"
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
              >
                <option value="all">All agents</option>
                {agentOptions.map(([id, name]) => (
                  <option key={id} value={String(id)}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="hist-status">
                Status
              </label>
              <select
                id="hist-status"
                className="input-field"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="hist-from">
                From
              </label>
              <input
                id="hist-from"
                type="date"
                className="input-field"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field" htmlFor="hist-to">
                To
              </label>
              <input
                id="hist-to"
                type="date"
                className="input-field"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>
          </div>

          {!filteredHistory.length ? (
            <div className="surface-card">
              <PositiveEmptyState
                title="No history yet"
                message={
                  history.length
                    ? "No settlements match these filters."
                    : "Approved and rejected settlements will show up here."
                }
              />
            </div>
          ) : (
            <div className="table-shell">
              <table className="min-w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3 text-left">Agent</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left">Delivery</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Submitted</th>
                    <th className="px-4 py-3 text-left">Reviewed / reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredHistory.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 table-cell">{s.agent_name}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(s.total_amount)}</td>
                      <td className="px-4 py-3">{deliveryLabel(s.delivery_method)}</td>
                      <td className="px-4 py-3">
                        <StatusChip status={s.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(s.submitted_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {s.status === "REJECTED" && s.rejection_reason ? (
                          <span className="text-red-700 dark:text-red-300">
                            {s.rejection_reason}
                          </span>
                        ) : s.reviewed_at ? (
                          <span className="text-muted">
                            {new Date(s.reviewed_at).toLocaleString()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {approveId && (
        <ConfirmModal
          title="Approve settlement?"
          message={
            pendingSettlement
              ? `Approve ${pendingSettlement.agent_name}'s settlement of ${fmt(pendingSettlement.total_amount)}? Agent wallet will be debited.`
              : "Approve this settlement?"
          }
          confirmLabel="Approve"
          confirmClass="bg-green-600 hover:bg-green-700"
          loading={actionId === approveId}
          onConfirm={confirmApprove}
          onCancel={() => setApproveId(null)}
        />
      )}

      {rejectId && (
        <PromptModal
          title="Reject settlement"
          message="Provide a reason for the agent."
          label="Rejection reason"
          confirmLabel="Reject"
          loading={actionId === rejectId}
          onConfirm={confirmReject}
          onCancel={() => setRejectId(null)}
        />
      )}
    </MainLayout>
  );
}
