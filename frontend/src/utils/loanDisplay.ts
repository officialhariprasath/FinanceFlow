import type { LoanResponse } from "../types/loan";

/** Human-readable product line for installment / standard loans. */
export function loanProductLabel(loan: LoanResponse): string {
  if (loan.collection_model === "DAILY_COLLECTION") {
    const freq = (loan.collection_frequency || "DAILY").replace(/_/g, " ");
    const count = loan.installment_count ?? loan.duration_days;
    const installment = loan.daily_payment;
    const countPart = count != null ? ` × ${count}` : "";
    if (installment && Number(installment) > 0) {
      return `${freq}${countPart} · ₹${Number(installment).toLocaleString("en-IN")}`;
    }
    return `${freq}${countPart}`;
  }
  if (loan.interest_method === "PERCENTAGE") {
    return `${loan.interest_rate}% / mo`;
  }
  return `₹${loan.interest_rate}/₹100`;
}

export function displayStatus(loan: LoanResponse): string {
  if (loan.status === "CLOSED" && loan.closure_type === "WRITE_OFF") {
    return "WRITE_OFF";
  }
  return loan.status;
}
