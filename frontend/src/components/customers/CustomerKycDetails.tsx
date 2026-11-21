import type { Customer } from "../../types/customer";
import { fmt } from "../../utils/fmt";
import {
  GENDER_LABELS,
  HOUSE_LABELS,
  ID_TYPE_LABELS,
  OCCUPATION_LABELS,
  hasAnyKyc,
  labelOrDash,
} from "../../utils/customerKycDisplay";

type Props = {
  customer: Customer;
  compact?: boolean;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="break-words text-sm font-medium text-slate-800 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>
    </div>
  );
}

export default function CustomerKycDetails({ customer, compact = false }: Props) {
  const filled = hasAnyKyc(customer);

  return (
    <div
      className={
        compact
          ? "space-y-4"
          : "surface-card space-y-6 p-6"
      }
    >
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Borrower details
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              filled
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {filled ? "KYC on file" : "KYC empty — fill via Edit"}
          </span>
        </div>
      )}

      {!filled && (
        <p className="text-sm text-slate-500">
          No extended KYC was collected for this borrower yet. Existing records stay empty
          until you edit and save the full form.
        </p>
      )}

      <Section title="Identity">
        <Row label="Full name" value={labelOrDash(customer.full_name)} />
        <Row
          label="Date of birth"
          value={labelOrDash(customer.date_of_birth)}
        />
        <Row
          label="Gender"
          value={labelOrDash(customer.gender, GENDER_LABELS)}
        />
        <Row label="Primary mobile" value={labelOrDash(customer.phone)} />
        <Row
          label="Alternate mobile"
          value={labelOrDash(customer.alternate_phone)}
        />
        <Row
          label="ID type"
          value={labelOrDash(customer.id_type, ID_TYPE_LABELS)}
        />
        <Row label="ID number" value={labelOrDash(customer.id_number)} />
      </Section>

      <Section title="Address & work">
        <Row
          label="Permanent address"
          value={labelOrDash(customer.permanent_address)}
        />
        <Row
          label="Current address"
          value={labelOrDash(customer.temporary_address)}
        />
        <Row label="Area / landmark" value={labelOrDash(customer.area_landmark)} />
        <Row
          label="House"
          value={labelOrDash(customer.house_ownership, HOUSE_LABELS)}
        />
        <Row
          label="Occupation"
          value={labelOrDash(customer.occupation, OCCUPATION_LABELS)}
        />
        <Row label="Business name" value={labelOrDash(customer.business_name)} />
        <Row
          label="Monthly income"
          value={
            customer.monthly_income != null && customer.monthly_income !== ""
              ? fmt(customer.monthly_income)
              : "—"
          }
        />
        <Row
          label="Other loans"
          value={labelOrDash(customer.has_other_loans)}
        />
        <Row
          label="Other EMI"
          value={
            customer.other_loans_emi != null && customer.other_loans_emi !== ""
              ? fmt(customer.other_loans_emi)
              : "—"
          }
        />
      </Section>

      <Section title="Guarantor & references">
        <Row label="Guarantor" value={labelOrDash(customer.guarantor_name)} />
        <Row
          label="Guarantor phone"
          value={labelOrDash(customer.guarantor_phone)}
        />
        <Row
          label="Reference 1"
          value={
            customer.reference1_name || customer.reference1_phone
              ? `${labelOrDash(customer.reference1_name)} · ${labelOrDash(customer.reference1_phone)}`
              : "—"
          }
        />
        <Row
          label="Reference 2"
          value={
            customer.reference2_name || customer.reference2_phone
              ? `${labelOrDash(customer.reference2_name)} · ${labelOrDash(customer.reference2_phone)}`
              : "—"
          }
        />
      </Section>
    </div>
  );
}
