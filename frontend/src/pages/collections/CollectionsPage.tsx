import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import RecordPaymentModal from "../../components/loans/RecordPaymentModal";
import { PageError, PageLoading } from "../../components/common/PageStates";
import StatusChip from "../../components/common/StatusChip";
import { useToast } from "../../context/ToastContext";
import { useNavBadges } from "../../context/NavBadgesContext";
import { getTodayCollections } from "../../services/collectionService";
import { getMyWallet } from "../../services/agentWalletService";
import { useAuth } from "../../context/AuthContext";
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
          Collect
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
        }
      }
    } catch {
      setError("Failed to load today's collections.");
    } finally {
      setLoading(false);
    }
  }, [isAgent]);

  useEffect(() => {
    load();
  }, [load]);

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

  const summaryBar = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
      <div className="surface-card p-3">
        <p className="text-xs text-slate-500">Expected</p>
        <p className="text-lg font-bold">{fmt(data?.expected_collection)}</p>
      </div>
      <div className="surface-card p-3">
        <p className="text-xs text-slate-500">Collected</p>
        <p className="text-lg font-bold text-green-700 dark:text-green-400">{fmt(data?.collected)}</p>
      </div>
      <div className="surface-card p-3">
        <p className="text-xs text-slate-500">Pending</p>
        <p className="text-lg font-bold text-amber-600">{fmt(data?.pending)}</p>
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
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Pending approval</p>
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
                Installments due today — collect or pay in advance.
              </p>
            </div>
            {summaryBar}
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
            <h2 className="font-semibold">Borrowers to collect today</h2>
          </div>
          {!data?.items.length ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">
              No daily collection loans scheduled for today.
            </p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 p-4 md:hidden">
                {data.items.map((item) => {
                  const paid = item.status === "PAID";
                  return (
                    <div
                      key={`${item.loan_id}-${item.schedule_date}`}
                      className={`rounded-lg border p-4 ${
                        paid
                          ? "border-green-200 bg-green-50/80 dark:border-green-900 dark:bg-green-950/30"
                          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.customer_name}</p>
                          <p className="text-xs text-slate-500">{item.customer_phone}</p>
                          <p className="mt-1 text-xs text-slate-500">Loan #{item.loan_id}</p>
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
                          <p className="font-medium">{fmt(item.pending_amount)}</p>
                        </div>
                      </div>
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

              {/* Desktop table */}
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
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {data.items.map((item) => (
                      <tr
                        key={`${item.loan_id}-${item.schedule_date}`}
                        className={
                          item.status === "PAID"
                            ? "bg-green-50/50 dark:bg-green-950/20"
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
                        <td className="px-4 py-3 text-right">{fmt(item.pending_amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusChip status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <CollectionRowActions
                            item={item}
                            onCollect={() => openCollect(item)}
                            onView={() => navigate(`/loans/${item.loan_id}`)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {collectLoanId !== null && collectDefaults && (
        <RecordPaymentModal
          loanId={collectLoanId}
          collectionModel="DAILY_COLLECTION"
          defaultAmount={collectDefaults.amount}
          defaultScheduleDate={collectDefaults.scheduleDate}
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
