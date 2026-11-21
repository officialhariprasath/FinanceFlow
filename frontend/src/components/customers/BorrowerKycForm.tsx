import { useEffect, useMemo, useState } from "react";
import type {
  Customer,
  CustomerCreate,
  Gender,
  HouseOwnership,
  IdType,
  KycFieldRule,
  OccupationOption,
} from "../../types/customer";
import { getSettings } from "../../services/settingsService";
import {
  DEFAULT_OCCUPATIONS,
  mergeKycRules,
} from "../../utils/kycFormDefaults";

const ID_TYPES: { value: IdType; label: string }[] = [
  { value: "AADHAAR", label: "Aadhaar" },
  { value: "VOTER", label: "Voter ID" },
  { value: "PAN", label: "PAN" },
  { value: "DL", label: "Driving licence" },
];

const GENDERS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const HOUSE: { value: HouseOwnership; label: string }[] = [
  { value: "OWN", label: "Own" },
  { value: "RENT", label: "Rent" },
];

const STEP_LABELS = ["Identity", "Address & work", "Guarantor"];

type FormState = {
  full_name: string;
  date_of_birth: string;
  gender: Gender | "";
  phone: string;
  alternate_phone: string;
  id_type: IdType | "";
  id_number: string;
  addr_line1: string;
  addr_line2: string;
  city: string;
  state: string;
  postal_code: string;
  address_comment: string;
  same_as_permanent: boolean;
  temp_addr_line1: string;
  temp_addr_line2: string;
  temp_city: string;
  temp_state: string;
  temp_postal_code: string;
  temp_address_comment: string;
  area_landmark: string;
  house_ownership: HouseOwnership | "";
  occupation: string;
  occupation_detail: string;
  business_name: string;
  monthly_income: string;
  has_other_loans: "" | "yes" | "no";
  other_loans_emi: string;
  guarantor_name: string;
  guarantor_phone: string;
  reference1_name: string;
  reference1_phone: string;
  reference2_name: string;
  reference2_phone: string;
};

function emptyForm(): FormState {
  return {
    full_name: "",
    date_of_birth: "",
    gender: "",
    phone: "",
    alternate_phone: "",
    id_type: "",
    id_number: "",
    addr_line1: "",
    addr_line2: "",
    city: "",
    state: "",
    postal_code: "",
    address_comment: "",
    same_as_permanent: false,
    temp_addr_line1: "",
    temp_addr_line2: "",
    temp_city: "",
    temp_state: "",
    temp_postal_code: "",
    temp_address_comment: "",
    area_landmark: "",
    house_ownership: "",
    occupation: "",
    occupation_detail: "",
    business_name: "",
    monthly_income: "",
    has_other_loans: "",
    other_loans_emi: "",
    guarantor_name: "",
    guarantor_phone: "",
    reference1_name: "",
    reference1_phone: "",
    reference2_name: "",
    reference2_phone: "",
  };
}

function fromCustomer(c: Customer): FormState {
  return {
    ...emptyForm(),
    full_name: c.full_name ?? "",
    date_of_birth: c.date_of_birth ?? "",
    gender: (c.gender as Gender) || "",
    phone: c.phone ?? "",
    alternate_phone: c.alternate_phone ?? "",
    id_type: (c.id_type as IdType) || "",
    id_number: c.id_number ?? "",
    addr_line1: c.addr_line1 || c.permanent_address || "",
    addr_line2: c.addr_line2 ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    postal_code: c.postal_code ?? "",
    address_comment: c.address_comment ?? "",
    temp_addr_line1: c.temp_addr_line1 || c.temporary_address || "",
    temp_addr_line2: c.temp_addr_line2 ?? "",
    temp_city: c.temp_city ?? "",
    temp_state: c.temp_state ?? "",
    temp_postal_code: c.temp_postal_code ?? "",
    temp_address_comment: c.temp_address_comment ?? "",
    same_as_permanent: Boolean(
      c.temporary_address &&
        c.permanent_address &&
        c.temporary_address === c.permanent_address
    ),
    area_landmark: c.area_landmark ?? "",
    house_ownership: (c.house_ownership as HouseOwnership) || "",
    occupation: c.occupation ?? "",
    occupation_detail: c.occupation_detail ?? "",
    business_name: c.business_name ?? "",
    monthly_income:
      c.monthly_income != null && c.monthly_income !== ""
        ? String(c.monthly_income)
        : "",
    has_other_loans:
      c.has_other_loans === true ? "yes" : c.has_other_loans === false ? "no" : "",
    other_loans_emi:
      c.other_loans_emi != null && c.other_loans_emi !== ""
        ? String(c.other_loans_emi)
        : "",
    guarantor_name: c.guarantor_name ?? "",
    guarantor_phone: c.guarantor_phone ?? "",
    reference1_name: c.reference1_name ?? "",
    reference1_phone: c.reference1_phone ?? "",
    reference2_name: c.reference2_name ?? "",
    reference2_phone: c.reference2_phone ?? "",
  };
}

function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

type Props = {
  initialData?: Customer | null;
  loading?: boolean;
  submitLabel?: string;
  onSubmit: (data: CustomerCreate) => void;
  onCancel: () => void;
  embedded?: boolean;
};

export default function BorrowerKycForm({
  initialData,
  loading = false,
  submitLabel,
  onSubmit,
  onCancel,
  embedded = false,
}: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<Record<string, KycFieldRule>>(mergeKycRules());
  const [occupations, setOccupations] =
    useState<OccupationOption[]>(DEFAULT_OCCUPATIONS);

  useEffect(() => {
    setForm(initialData ? fromCustomer(initialData) : emptyForm());
    setStep(1);
    setErrors({});
  }, [initialData]);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setRules(mergeKycRules(s.kyc_field_rules));
        if (s.occupation_options?.length) setOccupations(s.occupation_options);
      })
      .catch(() => {});
  }, []);

  const age = useMemo(() => ageFromDob(form.date_of_birth), [form.date_of_birth]);

  function enabled(key: string) {
    return rules[key]?.enabled !== false;
  }
  function required(key: string) {
    return !!rules[key]?.enabled && !!rules[key]?.required;
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "same_as_permanent" && value === true) {
        next.temp_addr_line1 = prev.addr_line1;
        next.temp_addr_line2 = prev.addr_line2;
        next.temp_city = prev.city;
        next.temp_state = prev.state;
        next.temp_postal_code = prev.postal_code;
        next.temp_address_comment = prev.address_comment;
      }
      if (
        prev.same_as_permanent &&
        ["addr_line1", "addr_line2", "city", "state", "postal_code", "address_comment"].includes(
          key as string
        )
      ) {
        const map: Record<string, keyof FormState> = {
          addr_line1: "temp_addr_line1",
          addr_line2: "temp_addr_line2",
          city: "temp_city",
          state: "temp_state",
          postal_code: "temp_postal_code",
          address_comment: "temp_address_comment",
        };
        const tk = map[key as string];
        if (tk) (next as Record<string, unknown>)[tk] = value;
      }
      return next;
    });
  }

  function validateStep(s: number): boolean {
    const next: Record<string, string> = {};
    const req = (key: string, ok: boolean, msg: string) => {
      if (required(key) && !ok) next[key] = msg;
    };

    if (s === 1) {
      if (!form.full_name.trim() || form.full_name.trim().length < 2) {
        next.full_name = "Enter full name.";
      }
      if (!/^\d{10}$/.test(form.phone.trim())) {
        next.phone = "Enter a valid 10-digit mobile.";
      }
      req("date_of_birth", !!form.date_of_birth, "Date of birth is required.");
      req("gender", !!form.gender, "Select gender.");
      req(
        "alternate_phone",
        /^\d{10}$/.test(form.alternate_phone.trim()),
        "Enter a valid 10-digit alternate mobile."
      );
      req("id_type", !!form.id_type, "Select ID type.");
      req("id_number", !!form.id_number.trim(), "Enter ID number.");
    }
    if (s === 2) {
      req("addr_line1", !!form.addr_line1.trim(), "Address is required.");
      req("city", !!form.city.trim(), "City is required.");
      req("state", !!form.state.trim(), "State is required.");
      req("postal_code", !!form.postal_code.trim(), "Postal code is required.");
      if (enabled("temporary_address_block") && required("temporary_address_block")) {
        if (!form.same_as_permanent && !form.temp_addr_line1.trim()) {
          next.temp_addr_line1 = "Current address is required.";
        }
      }
      req("area_landmark", !!form.area_landmark.trim(), "Area / landmark required.");
      req("house_ownership", !!form.house_ownership, "Select house ownership.");
      req("occupation", !!form.occupation, "Select occupation.");
      if (form.occupation === "SHOP" && enabled("business_name") && !form.business_name.trim()) {
        next.business_name = "Business name required for shop.";
      }
      if (
        form.occupation === "OTHER" &&
        enabled("occupation_detail") &&
        !form.occupation_detail.trim()
      ) {
        next.occupation_detail = "Please describe occupation.";
      }
      req(
        "monthly_income",
        form.monthly_income !== "" && Number(form.monthly_income) >= 0,
        "Enter monthly income."
      );
      req("has_other_loans", !!form.has_other_loans, "Select yes or no.");
      if (
        form.has_other_loans === "yes" &&
        (form.other_loans_emi === "" || Number(form.other_loans_emi) < 0)
      ) {
        next.other_loans_emi = "Enter other EMI amount.";
      }
    }
    if (s === 3) {
      req("guarantor_name", !!form.guarantor_name.trim(), "Guarantor name required.");
      req(
        "guarantor_phone",
        /^\d{10}$/.test(form.guarantor_phone.trim()),
        "Valid 10-digit guarantor phone required."
      );
      if (required("reference1")) {
        if (!form.reference1_name.trim()) next.reference1_name = "Reference 1 name required.";
        if (!/^\d{10}$/.test(form.reference1_phone.trim())) {
          next.reference1_phone = "Valid reference 1 phone required.";
        }
      }
      if (form.reference2_phone && !/^\d{10}$/.test(form.reference2_phone.trim())) {
        next.reference2_phone = "Reference 2 phone must be 10 digits.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(3, s + 1));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function buildPayload(): CustomerCreate {
    const temp = form.same_as_permanent
      ? {
          temp_addr_line1: form.addr_line1,
          temp_addr_line2: form.addr_line2,
          temp_city: form.city,
          temp_state: form.state,
          temp_postal_code: form.postal_code,
          temp_address_comment: form.address_comment,
        }
      : {
          temp_addr_line1: form.temp_addr_line1,
          temp_addr_line2: form.temp_addr_line2,
          temp_city: form.temp_city,
          temp_state: form.temp_state,
          temp_postal_code: form.temp_postal_code,
          temp_address_comment: form.temp_address_comment,
        };

    return {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      require_full_kyc: true,
      id_type: (form.id_type || undefined) as IdType | undefined,
      id_number: form.id_number.trim() || undefined,
      alternate_phone: form.alternate_phone.trim() || undefined,
      date_of_birth: form.date_of_birth || undefined,
      gender: (form.gender || undefined) as Gender | undefined,
      occupation: form.occupation || undefined,
      occupation_detail:
        form.occupation === "OTHER"
          ? form.occupation_detail.trim() || undefined
          : undefined,
      business_name:
        form.occupation === "SHOP" ? form.business_name.trim() || undefined : undefined,
      monthly_income: form.monthly_income || undefined,
      area_landmark: form.area_landmark.trim() || undefined,
      house_ownership: (form.house_ownership || undefined) as HouseOwnership | undefined,
      guarantor_name: form.guarantor_name.trim() || undefined,
      guarantor_phone: form.guarantor_phone.trim() || undefined,
      reference1_name: form.reference1_name.trim() || undefined,
      reference1_phone: form.reference1_phone.trim() || undefined,
      reference2_name: form.reference2_name.trim() || undefined,
      reference2_phone: form.reference2_phone.trim() || undefined,
      has_other_loans: form.has_other_loans === "yes",
      other_loans_emi:
        form.has_other_loans === "yes" ? form.other_loans_emi || undefined : undefined,
      addr_line1: form.addr_line1.trim() || undefined,
      addr_line2: form.addr_line2.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      postal_code: form.postal_code.trim() || undefined,
      address_comment: form.address_comment.trim() || undefined,
      ...Object.fromEntries(
        Object.entries(temp).map(([k, v]) => [k, (v || "").trim() || undefined])
      ),
    };
  }

  function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep(3)) return;
    onSubmit(buildPayload());
  }

  const fieldCls = (key: string) =>
    `input-field w-full px-4 py-3 ${errors[key] ? "input-field-error" : ""}`;

  const shell = embedded
    ? "space-y-4"
    : "surface-card flex flex-col overflow-hidden p-0 md:shadow-sm";

  return (
    <div className={shell}>
      {!embedded && (
        <div className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-8 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            {initialData ? "Edit borrower" : "Add borrower"}
          </h2>
          <p className="text-sm text-slate-500">
            Step {step} of 3 — {STEP_LABELS[step - 1]}
          </p>
        </div>
      )}

      {embedded && (
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Borrower KYC — Step {step} of 3 ({STEP_LABELS[step - 1]})
        </p>
      )}

      <div className={`flex items-center gap-2 pt-4 ${embedded ? "" : "px-5 sm:px-8"}`}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  active
                    ? "bg-blue-600 text-white"
                    : done
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {done ? "✓" : n}
              </div>
              <span className="hidden text-center text-xs text-slate-500 sm:block">
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleFinalSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <div
          className={`flex-1 space-y-5 py-5 ${
            embedded ? "overflow-y-auto" : "px-5 sm:px-8 md:space-y-6"
          }`}
        >
          {Object.keys(errors).length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Please fix the highlighted fields to continue.
            </div>
          )}
          {step === 1 && (
            <>
              <Field label="Full name" required error={errors.full_name}>
                <input
                  className={fieldCls("full_name")}
                  value={form.full_name}
                  onChange={(e) => setField("full_name", e.target.value)}
                  autoComplete="name"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                {enabled("date_of_birth") && (
                  <Field
                    label="Date of birth"
                    required={required("date_of_birth")}
                    error={errors.date_of_birth}
                  >
                    <input
                      type="date"
                      className={fieldCls("date_of_birth")}
                      value={form.date_of_birth}
                      onChange={(e) => setField("date_of_birth", e.target.value)}
                    />
                    {age != null && (
                      <p className="mt-1 text-xs text-slate-500">Age: {age} years</p>
                    )}
                  </Field>
                )}
                {enabled("gender") && (
                  <Field label="Gender" required={required("gender")} error={errors.gender}>
                    <select
                      className={fieldCls("gender")}
                      value={form.gender}
                      onChange={(e) => setField("gender", e.target.value as Gender | "")}
                    >
                      <option value="">Select</option>
                      {GENDERS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Primary mobile" required error={errors.phone}>
                  <input
                    inputMode="numeric"
                    className={fieldCls("phone")}
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                  />
                </Field>
                {enabled("alternate_phone") && (
                  <Field
                    label="Alternate / family mobile"
                    required={required("alternate_phone")}
                    error={errors.alternate_phone}
                  >
                    <input
                      inputMode="numeric"
                      className={fieldCls("alternate_phone")}
                      value={form.alternate_phone}
                      onChange={(e) => setField("alternate_phone", e.target.value)}
                    />
                  </Field>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {enabled("id_type") && (
                  <Field label="ID type" required={required("id_type")} error={errors.id_type}>
                    <select
                      className={fieldCls("id_type")}
                      value={form.id_type}
                      onChange={(e) => setField("id_type", e.target.value as IdType | "")}
                    >
                      <option value="">Select</option>
                      {ID_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {enabled("id_number") && (
                  <Field
                    label="ID number"
                    required={required("id_number")}
                    error={errors.id_number}
                  >
                    <input
                      className={fieldCls("id_number")}
                      value={form.id_number}
                      onChange={(e) => setField("id_number", e.target.value)}
                    />
                  </Field>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <AddressFields
                prefix=""
                title="Permanent address"
                form={form}
                errors={errors}
                fieldCls={fieldCls}
                enabled={enabled}
                required={required}
                onChange={setField}
              />
              {enabled("temporary_address_block") && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={form.same_as_permanent}
                      onChange={(e) => setField("same_as_permanent", e.target.checked)}
                    />
                    Current address same as permanent
                  </label>
                  {!form.same_as_permanent && (
                    <AddressFields
                      prefix="temp_"
                      title="Current / temporary address"
                      form={form}
                      errors={errors}
                      fieldCls={fieldCls}
                      enabled={enabled}
                      required={required}
                      onChange={setField}
                    />
                  )}
                </>
              )}
              {enabled("area_landmark") && (
                <Field
                  label="Area / landmark"
                  required={required("area_landmark")}
                  error={errors.area_landmark}
                >
                  <input
                    className={fieldCls("area_landmark")}
                    value={form.area_landmark}
                    onChange={(e) => setField("area_landmark", e.target.value)}
                  />
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {enabled("house_ownership") && (
                  <Field
                    label="House ownership"
                    required={required("house_ownership")}
                    error={errors.house_ownership}
                  >
                    <select
                      className={fieldCls("house_ownership")}
                      value={form.house_ownership}
                      onChange={(e) =>
                        setField("house_ownership", e.target.value as HouseOwnership | "")
                      }
                    >
                      <option value="">Select</option>
                      {HOUSE.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {enabled("occupation") && (
                  <Field
                    label="Occupation"
                    required={required("occupation")}
                    error={errors.occupation}
                  >
                    <select
                      className={fieldCls("occupation")}
                      value={form.occupation}
                      onChange={(e) => setField("occupation", e.target.value)}
                    >
                      <option value="">Select</option>
                      {occupations.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              {form.occupation === "SHOP" && enabled("business_name") && (
                <Field label="Business name" required error={errors.business_name}>
                  <input
                    className={fieldCls("business_name")}
                    value={form.business_name}
                    onChange={(e) => setField("business_name", e.target.value)}
                  />
                </Field>
              )}
              {form.occupation === "OTHER" && enabled("occupation_detail") && (
                <Field
                  label="Describe occupation"
                  required
                  error={errors.occupation_detail}
                >
                  <input
                    className={fieldCls("occupation_detail")}
                    value={form.occupation_detail}
                    onChange={(e) => setField("occupation_detail", e.target.value)}
                  />
                </Field>
              )}
              {enabled("monthly_income") && (
                <Field
                  label="Approx. monthly income (₹)"
                  required={required("monthly_income")}
                  error={errors.monthly_income}
                >
                  <input
                    inputMode="decimal"
                    className={fieldCls("monthly_income")}
                    value={form.monthly_income}
                    onChange={(e) => setField("monthly_income", e.target.value)}
                  />
                </Field>
              )}
              {enabled("has_other_loans") && (
                <Field
                  label="Existing loans elsewhere?"
                  required={required("has_other_loans")}
                  error={errors.has_other_loans}
                >
                  <select
                    className={fieldCls("has_other_loans")}
                    value={form.has_other_loans}
                    onChange={(e) =>
                      setField("has_other_loans", e.target.value as "" | "yes" | "no")
                    }
                  >
                    <option value="">Select</option>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              )}
              {form.has_other_loans === "yes" && (
                <Field label="Other EMI amount (₹)" required error={errors.other_loans_emi}>
                  <input
                    inputMode="decimal"
                    className={fieldCls("other_loans_emi")}
                    value={form.other_loans_emi}
                    onChange={(e) => setField("other_loans_emi", e.target.value)}
                  />
                </Field>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {enabled("guarantor_name") && (
                  <Field
                    label="Guarantor name"
                    required={required("guarantor_name")}
                    error={errors.guarantor_name}
                  >
                    <input
                      className={fieldCls("guarantor_name")}
                      value={form.guarantor_name}
                      onChange={(e) => setField("guarantor_name", e.target.value)}
                    />
                  </Field>
                )}
                {enabled("guarantor_phone") && (
                  <Field
                    label="Guarantor phone"
                    required={required("guarantor_phone")}
                    error={errors.guarantor_phone}
                  >
                    <input
                      inputMode="numeric"
                      className={fieldCls("guarantor_phone")}
                      value={form.guarantor_phone}
                      onChange={(e) => setField("guarantor_phone", e.target.value)}
                    />
                  </Field>
                )}
              </div>
              {enabled("reference1") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Reference 1 name"
                    required={required("reference1")}
                    error={errors.reference1_name}
                  >
                    <input
                      className={fieldCls("reference1_name")}
                      value={form.reference1_name}
                      onChange={(e) => setField("reference1_name", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Reference 1 phone"
                    required={required("reference1")}
                    error={errors.reference1_phone}
                  >
                    <input
                      inputMode="numeric"
                      className={fieldCls("reference1_phone")}
                      value={form.reference1_phone}
                      onChange={(e) => setField("reference1_phone", e.target.value)}
                    />
                  </Field>
                </div>
              )}
              {enabled("reference2") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Reference 2 name (optional)">
                    <input
                      className={fieldCls("reference2_name")}
                      value={form.reference2_name}
                      onChange={(e) => setField("reference2_name", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Reference 2 phone (optional)"
                    error={errors.reference2_phone}
                  >
                    <input
                      inputMode="numeric"
                      className={fieldCls("reference2_phone")}
                      value={form.reference2_phone}
                      onChange={(e) => setField("reference2_phone", e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </>
          )}
        </div>

        <div
          className={`sticky bottom-0 flex shrink-0 gap-3 border-t border-slate-200 bg-white py-4 dark:border-slate-700 dark:bg-slate-800 ${
            embedded ? "px-0" : "px-5 sm:px-8"
          }`}
        >
          <button
            type="button"
            onClick={step === 1 ? onCancel : goBack}
            className="btn-secondary min-h-11 flex-1"
            disabled={loading}
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="btn-primary min-h-11 flex-1"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              className="btn-primary min-h-11 flex-1"
              disabled={loading}
            >
              {loading
                ? "Saving…"
                : submitLabel || (initialData ? "Save changes" : "Save borrower")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="label-field">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function AddressFields({
  prefix,
  title,
  form,
  errors,
  fieldCls,
  enabled,
  required,
  onChange,
}: {
  prefix: "" | "temp_";
  title: string;
  form: FormState;
  errors: Record<string, string>;
  fieldCls: (key: string) => string;
  enabled: (key: string) => boolean;
  required: (key: string) => boolean;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const line1 = prefix ? "temp_addr_line1" : "addr_line1";
  const line2 = prefix ? "temp_addr_line2" : "addr_line2";
  const city = prefix ? "temp_city" : "city";
  const state = prefix ? "temp_state" : "state";
  const postal = prefix ? "temp_postal_code" : "postal_code";
  const comment = prefix ? "temp_address_comment" : "address_comment";

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-800/40 sm:p-5">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      {enabled("addr_line1") && (
        <Field
          label="Address / street"
          required={!prefix && required("addr_line1")}
          error={errors[line1]}
        >
          <input
            className={fieldCls(line1)}
            value={form[line1]}
            onChange={(e) => onChange(line1, e.target.value)}
            autoComplete="street-address"
          />
        </Field>
      )}
      {enabled("addr_line2") && (
        <Field label="Street address line 2" error={errors[line2]}>
          <input
            className={fieldCls(line2)}
            value={form[line2]}
            onChange={(e) => onChange(line2, e.target.value)}
          />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {enabled("city") && (
          <Field label="City" required={!prefix && required("city")} error={errors[city]}>
            <input
              className={fieldCls(city)}
              value={form[city]}
              onChange={(e) => onChange(city, e.target.value)}
              autoComplete="address-level2"
            />
          </Field>
        )}
        {enabled("state") && (
          <Field
            label="State / Province"
            required={!prefix && required("state")}
            error={errors[state]}
          >
            <input
              className={fieldCls(state)}
              value={form[state]}
              onChange={(e) => onChange(state, e.target.value)}
              autoComplete="address-level1"
            />
          </Field>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {enabled("postal_code") && (
          <Field
            label="Postal / Zip Code"
            required={!prefix && required("postal_code")}
            error={errors[postal]}
          >
            <input
              className={fieldCls(postal)}
              value={form[postal]}
              onChange={(e) => onChange(postal, e.target.value)}
              autoComplete="postal-code"
            />
          </Field>
        )}
        {enabled("address_comment") && (
          <Field label="Comment" error={errors[comment]}>
            <input
              className={fieldCls(comment)}
              value={form[comment]}
              onChange={(e) => onChange(comment, e.target.value)}
            />
          </Field>
        )}
      </div>
    </div>
  );
}
