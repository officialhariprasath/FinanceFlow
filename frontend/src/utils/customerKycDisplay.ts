import type { Customer, CustomerKycFields } from "../types/customer";

export const ID_TYPE_LABELS: Record<string, string> = {
  AADHAAR: "Aadhaar",
  VOTER: "Voter ID",
  PAN: "PAN",
  DL: "Driving licence",
};

export const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

export const OCCUPATION_LABELS: Record<string, string> = {
  SALARY: "Salary",
  SHOP: "Shop",
  DAILY_WAGE: "Daily wage",
  OTHER: "Other",
};

export const HOUSE_LABELS: Record<string, string> = {
  OWN: "Own",
  RENT: "Rent",
};

export function labelOrDash(
  value: string | number | boolean | null | undefined,
  map?: Record<string, string>
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value);
  if (map) return map[text] ?? text;
  return text;
}

/** True when at least one extended KYC field is filled (legacy rows stay empty). */
export function hasAnyKyc(
  c: Partial<CustomerKycFields> | null | undefined
): boolean {
  if (!c) return false;
  return Boolean(
    c.id_type ||
      c.id_number ||
      c.alternate_phone ||
      c.date_of_birth ||
      c.gender ||
      c.occupation ||
      c.business_name ||
      c.monthly_income != null ||
      c.area_landmark ||
      c.house_ownership ||
      c.guarantor_name ||
      c.guarantor_phone ||
      c.reference1_name ||
      c.reference1_phone ||
      c.reference2_name ||
      c.reference2_phone ||
      c.has_other_loans != null ||
      c.other_loans_emi != null
  );
}

export function kycStatusLabel(c: Partial<Customer> | null | undefined): {
  label: string;
  tone: "ok" | "empty";
} {
  if (hasAnyKyc(c)) return { label: "KYC on file", tone: "ok" };
  return { label: "KYC empty", tone: "empty" };
}
