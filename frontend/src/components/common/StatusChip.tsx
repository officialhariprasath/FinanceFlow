type StatusKind = "paid" | "pending" | "overdue" | "partial" | "default" | "rejected" | "neutral";

const STYLES: Record<StatusKind, string> = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  default: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function statusToKind(status: string): StatusKind {
  const s = status.toUpperCase();
  if (s === "PAID" || s === "COMPLETED") return "paid";
  if (s === "REJECTED") return "rejected";
  if (s === "OVERDUE" || s === "DEFAULTED") return "overdue";
  if (s === "PARTIAL" || s === "PENDING" || s === "PENDING_VERIFICATION") return "pending";
  return "neutral";
}

export default function StatusChip({
  status,
  kind,
}: {
  status: string;
  kind?: StatusKind;
}) {
  const k = kind ?? statusToKind(status);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[k]}`}>
      {status}
    </span>
  );
}
