import type { KycFieldRule, OccupationOption } from "../types/customer";

export const DEFAULT_KYC_FIELD_RULES: Record<string, KycFieldRule> = {
  date_of_birth: { enabled: true, required: true },
  gender: { enabled: true, required: true },
  alternate_phone: { enabled: true, required: true },
  id_type: { enabled: true, required: true },
  id_number: { enabled: true, required: true },
  addr_line1: { enabled: true, required: true },
  addr_line2: { enabled: true, required: false },
  city: { enabled: true, required: true },
  state: { enabled: true, required: true },
  postal_code: { enabled: true, required: true },
  address_comment: { enabled: true, required: false },
  temporary_address_block: { enabled: true, required: true },
  area_landmark: { enabled: true, required: true },
  house_ownership: { enabled: true, required: true },
  occupation: { enabled: true, required: true },
  occupation_detail: { enabled: true, required: false },
  business_name: { enabled: true, required: false },
  monthly_income: { enabled: true, required: true },
  has_other_loans: { enabled: true, required: true },
  other_loans_emi: { enabled: true, required: false },
  guarantor_name: { enabled: true, required: true },
  guarantor_phone: { enabled: true, required: true },
  reference1: { enabled: true, required: true },
  reference2: { enabled: true, required: false },
};

export const DEFAULT_OCCUPATIONS: OccupationOption[] = [
  { value: "SALARY", label: "Salary" },
  { value: "SHOP", label: "Shop" },
  { value: "DAILY_WAGE", label: "Daily wage" },
  { value: "OTHER", label: "Other" },
];

export const KYC_RULE_LABELS: Record<string, string> = {
  date_of_birth: "Date of birth",
  gender: "Gender",
  alternate_phone: "Alternate mobile",
  id_type: "ID type",
  id_number: "ID number",
  addr_line1: "Address / street",
  addr_line2: "Address line 2",
  city: "City",
  state: "State / province",
  postal_code: "Postal / ZIP",
  address_comment: "Address comment",
  temporary_address_block: "Current address",
  area_landmark: "Area / landmark",
  house_ownership: "House ownership",
  occupation: "Occupation",
  occupation_detail: "Occupation detail (Other)",
  business_name: "Business name (Shop)",
  monthly_income: "Monthly income",
  has_other_loans: "Other loans elsewhere",
  other_loans_emi: "Other EMI amount",
  guarantor_name: "Guarantor name",
  guarantor_phone: "Guarantor phone",
  reference1: "Reference 1",
  reference2: "Reference 2",
};

export function mergeKycRules(
  raw?: Record<string, KycFieldRule> | null
): Record<string, KycFieldRule> {
  const out = { ...DEFAULT_KYC_FIELD_RULES };
  if (!raw) return out;
  for (const key of Object.keys(out)) {
    if (raw[key]) {
      out[key] = {
        enabled: !!raw[key].enabled,
        required: raw[key].enabled ? !!raw[key].required : false,
      };
    }
  }
  return out;
}
