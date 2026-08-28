import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import RecordPaymentModal from "../../components/loans/RecordPaymentModal";
import { PageError, PageLoading } from "../../components/common/PageStates";
import StatusChip from "../../components/common/StatusChip";
import { useToast } from "../../context/ToastContext";
import { useNavBadges } from "../../context/NavBadgesContext";
import { getTodayCollections } from "../../services/collectionService";
import {
  assignCustomersToAgent,
  getMyWallet,
} from "../../services/agentWalletService";
import { getAgents } from "../../services/agentService";
import { useAuth } from "../../context/AuthContext";
import type { Agent } from "../../types/agent";
import type { CollectionItem, CollectionSummary } from "../../types/collection";
import { fmt } from "../../utils/fmt";

function CollectionRowActions({
  item,
  onCollect,
  onView,
}: {
  item: CollectionItem;
  onCollect: () => void;
  onView: () => void;
}) {
  const paid = item.status === "PAID";
  return (
    <div className="flex gap-2">
      {!paid && (
        <button
          type="button"
          onClick={onCollect}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
        >
          Record Payment
        </button>
      )}
      <button
        type="button"
        onClick={onView}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
      >
        View
      </button>
    </div>
  );
}

export default function CollectionsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh: refreshBadges } = useNavBadges();
  const { session } = useAuth();
  const isAgent = session && !session.is_owner;
  const isOwner = !!session?.is_owner;
  const [data, setData] = useState<CollectionSummary | null>(null);
  const [walletTotal, setWalletTotal] = useState<string | null>(null);
  const [pendingSettlement, setPendingSettlement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [collectLoanId, setCollectLoanId] = useState<number | null>(null);
  const [collectDefaults, setCollectDefaults] = useState<{
    amount: string;
    scheduleDate: string;
  } | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assignAgentId, setAssignAgentId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const summary = await getTodayCollections();
      setData(summary);
      if (isAgent) {
        try {
          const w = await getMyWallet();
          setWalletTotal(w.total_balance);
          setPendingSettlement(!!w.has_pending_settlement);
        } catch {
          setWalletTotal(null);
          setPendingSettlement(false);
        }
      }
      if (isOwner) {
        try {
          const list = await getAgents();
          setAgents(list.filter((a) => a.is_active));
        } catch {
          setAgents([]);
        }
      }
    } catch {
      setError("Failed to load today's collections.");
    } finally {
      setLoading(false);
    }
  }, [isAgent, isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (agents.length === 1 && !assignAgentId) {
      setAssignAgentId(String(agents[0].id));
    }
  }, [agents, assignAgentId]);

  const unassignedItems = useMemo(
    () =>
      (data?.items ?? []).filter(
        (item) => item.is_assigned_to_agent === false && Number(item.pending_amount) > 0
      ),
    [data]
  );

  async function assignUnassigned() {
    if (!assignAgentId || !unassignedItems.length) return;
    setAssigning(true);
    try {
      const customerIds = [...new Set(unassignedItems.map((i) => i.customer_id))];
      await assignCustomersToAgent(Number(assignAgentId), customerIds);
      toast.success(
        `Assigned ${customerIds.length} borrower${customerIds.length === 1 ? "" : "s"} to agent.`
      );
      await load();
      refreshBadges();
    } catch {
      toast.error("Could not assign borrowers. Try again from Agents.");
    } finally {
      setAssigning(false);
    }
  }

  function openCollect(item: CollectionItem) {
    setCollectLoanId(item.loan_id);
    setCollectDefaults({
      amount: item.pending_amount,
      scheduleDate: item.schedule_date,
    });
  }

  function onPaymentSuccess() {
    setCollectLoanId(null);
    setCollectDefaults(null);
    toast.success("Payment recorded successfully.");
    load();
    refreshBadges();
  }

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading collections..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <PageError message={error} onRetry={load} />
      </MainLayout>
    );
  }

  const overduePending = Number(data?.overdue_pending ?? 0);
  const pendingToday = Number(data?.pending ?? 0);
  const toCollectNow = pendingToday + overduePending;
  const hasOverdue = overduePending > 0 || (data?.overdue_count ?? 0) > 0;
  const unassignedCount = data?.unassigned_due_count ?? unassignedItems.length;
  const unassignedNames =
    data?.unassigned_borrower_names?.length
      ? data.unassigned_borrower_names
      : unassignedItems.map((i) => i.customer_name);

  const summaryBar = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <div className="surface-card p-3">
        <p className="text-xs text-slate-500">Expected today</p>
        <p className="text-lg font-bold">{fmt(data?.expected_collection)}</p>
      </div>
      <div className="surface-card p-3">
        <p className="text-xs text-slate-500">Collected</p>
        <p className="text-lg font-bold text-green-700 dark:text-green-400">
          {fmt(data?.collected)}
        </p>
      </div>
      <div className="surface-card p-3">
        <p className="text-xs text-slate-500">Pending today</p>
        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
          {fmt(data?.pending)}
        </p>
      </div>
      <div
        className={`p-3 ${
          hasOverdue
            ? "rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
            : "surface-card"
        }`}
      >
        <p className={`text-xs ${hasOverdue ? "text-red-700 dark:text-red-300" : "text-slate-500"}`}>
          Overdue pending
        </p>
        <p className={`text-lg font-bold ${hasOverdue ? "text-red-700 dark:text-red-300" : ""}`}>
          {fmt(data?.overdue_pending ?? "0")}
        </p>
        {hasOverdue && (
          <p className="text-[11px] text-red-600 dark:text-red-400">
            {data?.overdue_count} installment{data?.overdue_count === 1 ? "" : "s"}
          </p>
        )}
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/40">
        <p className="text-xs text-blue-800 dark:text-blue-200">To collect now</p>
        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
          {fmt(toCollectNow.toFixed(2))}
        </p>
        <p className="text-[11px] text-blue-700 dark:text-blue-300">Today + overdue</p>
      </div>
      {isAgent ? (
        <>
          <div className="surface-card p-3">
            <p className="text-xs text-slate-500">Unsettled</p>
            <p className="text-lg font-bold">{fmt(walletTotal)}</p>
          </div>
          {pendingSettlement && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-xs text-amber-800 dark:text-amber-200">Settlement</p>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Pending approval
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="surface-card p-3">
          <p className="text-xs text-slate-500">Rate</p>
          <p className="text-lg font-bold">{data?.collection_rate}%</p>
        </div>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-4 pb-6">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Collections</h1>
            <p className="text-sm text-slate-500">
              {isAgent
                ? "Showing borrowers assigned to you — due today plus overdue arrears."
                : "Due today plus overdue arrears — collect or pay in advance."}
            </p>
          </div>
          {summaryBar}

          {isOwner && unassignedCount > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                {unassignedCount} borrower{unassignedCount === 1 ? "" : "s"} due today{" "}
                {unassignedCount === 1 ? "is" : "are"} not assigned to any agent
              </p>
              <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
                Agents will not see them on the app until you assign.
                {unassignedNames.length
                  ? ` (${unassignedNames.slice(0, 5).join(", ")}${
                      unassignedNames.length > 5 ? "…" : ""
                    })`
                  : ""}{" "}
                · {fmt(data?.unassigned_due_total ?? "0")}
              </p>
              {agents.length === 0 ? (
                <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">
                  Add an active collection agent first, then assign these borrowers.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-amber-900 dark:text-amber-200">
                      Assign to agent
                    </label>
                    <select
                      className="input-field min-w-[180px]"
                      value={assignAgentId}
                      onChange={(e) => setAssignAgentId(e.target.value)}
                    >
                      <option value="">Select agent</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={!assignAgentId || assigning}
                    onClick={assignUnassigned}
                    className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                  >
                    {assigning ? "Assigning…" : "Assign now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/agents")}
                    className="btn-ghost text-amber-900 dark:text-amber-100"
                  >
                    Open Agents
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={load}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400 sm:hidden"
          >
            Pull to refresh ↻
          </button>
        </div>

        <div className="surface-card">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6">
            <h2 className="font-semibold">Borrowers to collect</h2>
          </div>
          {!data?.items.length ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">
              {isAgent
                ? "No assigned borrowers due today. Ask the owner to assign customers if you expected work."
                : "No collections due today and no overdue installments."}
            </p>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {data.items.map((item) => {
                  const paid = item.status === "PAID";
                  const overdueAmt = Number(item.overdue_pending_amount ?? 0);
                  const unassigned = isOwner && item.is_assigned_to_agent === false;
                  return (
                    <div
                      key={`${item.loan_id}-${item.schedule_date}-${item.status}`}
                      className={`rounded-lg border p-4 ${
                        paid
                          ? "border-green-200 bg-green-50/80 dark:border-green-900 dark:bg-green-950/30"
                          : item.status === "OVERDUE"
                            ? "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30"
                            : unassigned
                              ? "border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30"
                              : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.customer_name}</p>
                          <p className="text-xs text-slate-500">{item.customer_phone}</p>
                          <p className="mt-1 text-xs text-slate-500">Loan #{item.loan_id}</p>
                          {unassigned && (
                            <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                              Not assigned to any agent
                            </p>
                          )}
                        </div>
                        <StatusChip status={item.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Expected</p>
                          <p className="font-medium">{fmt(item.expected_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Paid</p>
                          <p className="font-medium text-green-700">{fmt(item.paid_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Pending</p>
                          <p className="font-medium text-amber-700 dark:text-amber-300">
                            {fmt(item.pending_amount)}
                          </p>
                        </div>
                      </div>
                      {overdueAmt > 0 && (
                        <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">
                          Includes {fmt(item.overdue_pending_amount)} overdue arrears
                        </p>
                      )}
                      <div className="mt-3">
                        <CollectionRowActions
                          item={item}
                          onCollect={() => openCollect(item)}
                          onView={() => navigate(`/loans/${item.loan_id}`)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <p className="table-scroll-hint">Swipe sideways to see all columns</p>
                <div className="table-responsive">
                  <table className="data-table table-wide text-sm">
                    <thead className="surface-muted">
                      <tr>
                        <th className="px-4 py-3 text-left">Borrower</th>
                        <th className="px-4 py-3 text-left">Loan</th>
                        <th className="px-4 py-3 text-right">Expected</th>
                        <th className="px-4 py-3 text-right">Paid</th>
                        <th className="px-4 py-3 text-right">Pending</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        {isOwner && <th className="px-4 py-3 text-left">Agent</th>}
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {data.items.map((item) => {
                        const overdueAmt = Number(item.overdue_pending_amount ?? 0);
                        const unassigned = isOwner && item.is_assigned_to_agent === false;
                        return (
                          <tr
                            key={`${item.loan_id}-${item.schedule_date}-${item.status}`}
                            className={
                              item.status === "PAID"
                                ? "bg-green-50/50 dark:bg-green-950/20"
                                : item.status === "OVERDUE"
                                  ? "bg-red-50/40 dark:bg-red-950/20"
                                  : unassigned
                                    ? "bg-amber-50/50 dark:bg-amber-950/20"
                                    : undefined
                            }
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium">{item.customer_name}</div>
                              <div className="text-xs text-slate-500">{item.customer_phone}</div>
                            </td>
                            <td className="px-4 py-3">#{item.loan_id}</td>
                            <td className="px-4 py-3 text-right">{fmt(item.expected_amount)}</td>
                            <td className="px-4 py-3 text-right">{fmt(item.paid_amount)}</td>
                            <td className="px-4 py-3 text-right">
                              {fmt(item.pending_amount)}
                              {overdueAmt > 0 && (
                                <div className="text-xs text-red-600">
                                  incl. {fmt(item.overdue_pending_amount)} overdue
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusChip status={item.status} />
                            </td>
                            {isOwner && (
                              <td className="px-4 py-3 text-sm">
                                {unassigned ? (
                                  <span className="font-medium text-amber-700 dark:text-amber-300">
                                    Unassigned
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Assigned</span>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right">
                              <CollectionRowActions
                                item={item}
                                onCollect={() => openCollect(item)}
                                onView={() => navigate(`/loans/${item.loan_id}`)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {collectLoanId && (
        <RecordPaymentModal
          loanId={collectLoanId}
          collectionModel="DAILY_COLLECTION"
          defaultAmount={collectDefaults?.amount}
          defaultScheduleDate={collectDefaults?.scheduleDate}
          onClose={() => {
            setCollectLoanId(null);
            setCollectDefaults(null);
          }}
          onSuccess={onPaymentSuccess}
        />
      )}
    </MainLayout>
  );
}
