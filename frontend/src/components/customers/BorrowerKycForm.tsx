import { useEffect, useMemo, useState } from "react";
import type {
  Customer,
  CustomerCreate,
  Gender,
  HouseOwnership,
  IdType,
  Occupation,
} from "../../types/customer";

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

const OCCUPATIONS: { value: Occupation; label: string }[] = [
  { value: "SALARY", label: "Salary" },
  { value: "SHOP", label: "Shop" },
  { value: "DAILY_WAGE", label: "Daily wage" },
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
  permanent_address: string;
  temporary_address: string;
  same_as_permanent: boolean;
  area_landmark: string;
  house_ownership: HouseOwnership | "";
  occupation: Occupation | "";
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
    permanent_address: "",
    temporary_address: "",
    same_as_permanent: false,
    area_landmark: "",
    house_ownership: "",
    occupation: "",
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
    full_name: c.full_name ?? "",
    date_of_birth: c.date_of_birth ?? "",
    gender: (c.gender as Gender) || "",
    phone: c.phone ?? "",
    alternate_phone: c.alternate_phone ?? "",
    id_type: (c.id_type as IdType) || "",
    id_number: c.id_number ?? "",
    permanent_address: c.permanent_address ?? "",
    temporary_address: c.temporary_address ?? "",
    same_as_permanent: Boolean(
      c.temporary_address &&
        c.permanent_address &&
        c.temporary_address === c.permanent_address
    ),
    area_landmark: c.area_landmark ?? "",
    house_ownership: (c.house_ownership as HouseOwnership) || "",
    occupation: (c.occupation as Occupation) || "",
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

  useEffect(() => {
    setForm(initialData ? fromCustomer(initialData) : emptyForm());
    setStep(1);
    setErrors({});
  }, [initialData]);

  const age = useMemo(() => ageFromDob(form.date_of_birth), [form.date_of_birth]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "same_as_permanent" && value === true) {
        next.temporary_address = prev.permanent_address;
      }
      if (key === "permanent_address" && prev.same_as_permanent) {
        next.temporary_address = String(value);
      }
      return next;
    });
  }

  function validateStep(s: number): boolean {
    const next: Record<string, string> = {};
    if (s === 1) {
      if (!form.full_name.trim() || form.full_name.trim().length < 2) {
        next.full_name = "Enter full name.";
      }
      if (!form.date_of_birth) next.date_of_birth = "Date of birth is required.";
      if (!form.gender) next.gender = "Select gender.";
      if (!/^\d{10}$/.test(form.phone.trim())) {
        next.phone = "Enter a valid 10-digit mobile.";
      }
      if (!/^\d{10}$/.test(form.alternate_phone.trim())) {
        next.alternate_phone = "Enter a valid 10-digit alternate mobile.";
      }
      if (!form.id_type) next.id_type = "Select ID type.";
      if (!form.id_number.trim()) next.id_number = "Enter ID number.";
    }
    if (s === 2) {
      if (!form.permanent_address.trim()) {
        next.permanent_address = "Permanent address is required.";
      }
      const temp = form.same_as_permanent
        ? form.permanent_address
        : form.temporary_address;
      if (!temp.trim()) next.temporary_address = "Current address is required.";
      if (!form.area_landmark.trim()) next.area_landmark = "Area / landmark required.";
      if (!form.house_ownership) next.house_ownership = "Select house ownership.";
      if (!form.occupation) next.occupation = "Select occupation.";
      if (form.occupation === "SHOP" && !form.business_name.trim()) {
        next.business_name = "Business name required for shop.";
      }
      if (form.monthly_income === "" || Number(form.monthly_income) < 0) {
        next.monthly_income = "Enter monthly income.";
      }
      if (!form.has_other_loans) {
        next.has_other_loans = "Select yes or no.";
      }
      if (
        form.has_other_loans === "yes" &&
        (form.other_loans_emi === "" || Number(form.other_loans_emi) < 0)
      ) {
        next.other_loans_emi = "Enter other EMI amount.";
      }
    }
    if (s === 3) {
      if (!form.guarantor_name.trim()) next.guarantor_name = "Guarantor name required.";
      if (!/^\d{10}$/.test(form.guarantor_phone.trim())) {
        next.guarantor_phone = "Valid 10-digit guarantor phone required.";
      }
      if (!form.reference1_name.trim()) next.reference1_name = "Reference 1 name required.";
      if (!/^\d{10}$/.test(form.reference1_phone.trim())) {
        next.reference1_phone = "Valid reference 1 phone required.";
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
      ? form.permanent_address.trim()
      : form.temporary_address.trim();
    return {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      permanent_address: form.permanent_address.trim(),
      temporary_address: temp || undefined,
      require_full_kyc: true,
      id_type: form.id_type || undefined,
      id_number: form.id_number.trim() || undefined,
      alternate_phone: form.alternate_phone.trim() || undefined,
      date_of_birth: form.date_of_birth || undefined,
      gender: form.gender || undefined,
      occupation: form.occupation || undefined,
      business_name:
        form.occupation === "SHOP" ? form.business_name.trim() || undefined : undefined,
      monthly_income: form.monthly_income || undefined,
      area_landmark: form.area_landmark.trim() || undefined,
      house_ownership: form.house_ownership || undefined,
      guarantor_name: form.guarantor_name.trim() || undefined,
      guarantor_phone: form.guarantor_phone.trim() || undefined,
      reference1_name: form.reference1_name.trim() || undefined,
      reference1_phone: form.reference1_phone.trim() || undefined,
      reference2_name: form.reference2_name.trim() || undefined,
      reference2_phone: form.reference2_phone.trim() || undefined,
      has_other_loans: form.has_other_loans === "yes",
      other_loans_emi:
        form.has_other_loans === "yes" ? form.other_loans_emi || undefined : undefined,
    };
  }

  function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep(3)) return;
    onSubmit(buildPayload());
  }

  const fieldCls = (key: string) =>
    `input-field px-4 py-3 ${errors[key] ? "input-field-error" : ""}`;

  const shell = embedded
    ? "space-y-4"
    : "surface-card flex max-h-[90dvh] flex-col overflow-hidden p-0";

  return (
    <div className={shell}>
      {!embedded && (
        <div className="shrink-0 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
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

      <div className="flex items-center gap-2 px-6 pt-4">
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
              <span className="hidden text-center text-xs sm:block text-slate-500">
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleFinalSubmit}
        className="flex min-h-0 flex-1 flex-col"
        noValidate
      >
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {step === 1 && (
            <>
              <Field label="Full name" required error={errors.full_name}>
                <input
                  className={fieldCls("full_name")}
                  value={form.full_name}
                  onChange={(e) => setField("full_name", e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date of birth" required error={errors.date_of_birth}>
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
                <Field label="Gender" required error={errors.gender}>
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
                <Field
                  label="Alternate / family mobile"
                  required
                  error={errors.alternate_phone}
                >
                  <input
                    inputMode="numeric"
                    className={fieldCls("alternate_phone")}
                    value={form.alternate_phone}
                    onChange={(e) => setField("alternate_phone", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ID type" required error={errors.id_type}>
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
                <Field label="ID number" required error={errors.id_number}>
                  <input
                    className={fieldCls("id_number")}
                    value={form.id_number}
                    onChange={(e) => setField("id_number", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Permanent address" required error={errors.permanent_address}>
                <textarea
                  rows={2}
                  className={fieldCls("permanent_address")}
                  value={form.permanent_address}
                  onChange={(e) => setField("permanent_address", e.target.value)}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={form.same_as_permanent}
                  onChange={(e) => setField("same_as_permanent", e.target.checked)}
                />
                Current address same as permanent
              </label>
              {!form.same_as_permanent && (
                <Field
                  label="Current / temporary address"
                  required
                  error={errors.temporary_address}
                >
                  <textarea
                    rows={2}
                    className={fieldCls("temporary_address")}
                    value={form.temporary_address}
                    onChange={(e) => setField("temporary_address", e.target.value)}
                  />
                </Field>
              )}
              <Field label="Area / landmark" required error={errors.area_landmark}>
                <input
                  className={fieldCls("area_landmark")}
                  value={form.area_landmark}
                  onChange={(e) => setField("area_landmark", e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="House ownership" required error={errors.house_ownership}>
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
                <Field label="Occupation" required error={errors.occupation}>
                  <select
                    className={fieldCls("occupation")}
                    value={form.occupation}
                    onChange={(e) =>
                      setField("occupation", e.target.value as Occupation | "")
                    }
                  >
                    <option value="">Select</option>
                    {OCCUPATIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {form.occupation === "SHOP" && (
                <Field label="Business name" required error={errors.business_name}>
                  <input
                    className={fieldCls("business_name")}
                    value={form.business_name}
                    onChange={(e) => setField("business_name", e.target.value)}
                  />
                </Field>
              )}
              <Field label="Approx. monthly income (₹)" required error={errors.monthly_income}>
                <input
                  inputMode="decimal"
                  className={fieldCls("monthly_income")}
                  value={form.monthly_income}
                  onChange={(e) => setField("monthly_income", e.target.value)}
                />
              </Field>
              <Field label="Existing loans elsewhere?" required error={errors.has_other_loans}>
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
                <Field label="Guarantor name" required error={errors.guarantor_name}>
                  <input
                    className={fieldCls("guarantor_name")}
                    value={form.guarantor_name}
                    onChange={(e) => setField("guarantor_name", e.target.value)}
                  />
                </Field>
                <Field label="Guarantor phone" required error={errors.guarantor_phone}>
                  <input
                    inputMode="numeric"
                    className={fieldCls("guarantor_phone")}
                    value={form.guarantor_phone}
                    onChange={(e) => setField("guarantor_phone", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Reference 1 name" required error={errors.reference1_name}>
                  <input
                    className={fieldCls("reference1_name")}
                    value={form.reference1_name}
                    onChange={(e) => setField("reference1_name", e.target.value)}
                  />
                </Field>
                <Field label="Reference 1 phone" required error={errors.reference1_phone}>
                  <input
                    inputMode="numeric"
                    className={fieldCls("reference1_phone")}
                    value={form.reference1_phone}
                    onChange={(e) => setField("reference1_phone", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Reference 2 name (optional)">
                  <input
                    className={fieldCls("reference2_name")}
                    value={form.reference2_name}
                    onChange={(e) => setField("reference2_name", e.target.value)}
                  />
                </Field>
                <Field label="Reference 2 phone (optional)" error={errors.reference2_phone}>
                  <input
                    inputMode="numeric"
                    className={fieldCls("reference2_phone")}
                    value={form.reference2_phone}
                    onChange={(e) => setField("reference2_phone", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex shrink-0 gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={step === 1 ? onCancel : goBack}
            className="btn-secondary min-h-11 flex-1"
            disabled={loading}
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 3 ? (
            <button type="button" onClick={goNext} className="btn-primary min-h-11 flex-1">
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
                : submitLabel || (initialData ? "Save borrower" : "Save borrower")}
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
    <div>
      <label className="label-field">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
