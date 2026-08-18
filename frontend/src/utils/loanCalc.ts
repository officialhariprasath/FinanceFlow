export type CollectionFrequency = "DAILY" | "WEEKLY" | "BI_WEEKLY" | "MONTHLY";

export const FREQUENCY_LABELS: Record<CollectionFrequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BI_WEEKLY: "Bi-weekly",
  MONTHLY: "Monthly",
};

export const FREQUENCY_COUNT_LABELS: Record<CollectionFrequency, string> = {
  DAILY: "Number of days",
  WEEKLY: "Number of weeks",
  BI_WEEKLY: "Number of bi-weekly periods",
  MONTHLY: "Number of months",
};

export function calculateInstallmentLoanTerms(
  principal: number,
  interestPercent: number,
  installmentCount: number
) {
  const totalProfit = (principal * interestPercent) / 100;
  const totalRepayment = principal + totalProfit;
  const installmentAmount = totalRepayment / installmentCount;
  const installmentPrincipal = principal / installmentCount;
  const installmentProfit = totalProfit / installmentCount;

  return {
    totalProfit: round2(totalProfit),
    totalRepayment: round2(totalRepayment),
    installmentAmount: round2(installmentAmount),
    installmentPrincipal: round2(installmentPrincipal),
    installmentProfit: round2(installmentProfit),
    // legacy aliases
    dailyPayment: round2(installmentAmount),
    dailyPrincipal: round2(installmentPrincipal),
    dailyProfit: round2(installmentProfit),
  };
}

/** @deprecated use calculateInstallmentLoanTerms */
export const calculateDailyLoanTerms = calculateInstallmentLoanTerms;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function dueDateFromStart(
  dueStartDate: string,
  frequency: CollectionFrequency,
  installmentCount: number
): string {
  if (!dueStartDate || installmentCount <= 0) return dueStartDate;

  const start = new Date(dueStartDate);
  let end: Date;

  switch (frequency) {
    case "WEEKLY":
      end = new Date(start);
      end.setDate(end.getDate() + 7 * (installmentCount - 1));
      break;
    case "BI_WEEKLY":
      end = new Date(start);
      end.setDate(end.getDate() + 14 * (installmentCount - 1));
      break;
    case "MONTHLY":
      end = addMonths(start, installmentCount - 1);
      break;
    default:
      end = new Date(start);
      end.setDate(end.getDate() + (installmentCount - 1));
  }

  return toIsoDate(end);
}

/** @deprecated use dueDateFromStart */
export function dueDateFromIssue(issueDate: string, durationDays: number): string {
  return dueDateFromStart(issueDate, "DAILY", durationDays);
}

export function installmentAmountLabel(frequency: CollectionFrequency): string {
  switch (frequency) {
    case "WEEKLY":
      return "Weekly collection";
    case "BI_WEEKLY":
      return "Bi-weekly collection";
    case "MONTHLY":
      return "Monthly collection";
    default:
      return "Daily collection";
  }
}
