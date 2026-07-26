export function fmt(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function statusBadge(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-700";
    case "CLOSED":
      return "bg-slate-200 text-slate-600";
    case "RENEWED":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
