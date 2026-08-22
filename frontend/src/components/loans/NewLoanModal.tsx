import { useEffect, useMemo, useState } from "react";



import { createLoan } from "../../services/loanService";

import { createCustomer } from "../../services/customerService";

import { getCapitalSummary } from "../../services/capitalService";

import api from "../../api/axios";

import type { LoanCreate } from "../../types/loan";

import type { CustomerCreate } from "../../types/customer";

import { fmt } from "../../utils/fmt";

import {

  calculateInstallmentLoanTerms,

  dueDateFromStart,

  FREQUENCY_COUNT_LABELS,

  FREQUENCY_LABELS,

  installmentAmountLabel,

  type CollectionFrequency,

} from "../../utils/loanCalc";



interface CustomerOption {

  id: number;

  full_name: string;

}



interface Props {

  onClose: () => void;

  onSuccess: () => void;

  preselectedCustomerId?: number;

}



type CustomerMode = "existing" | "new";



const DEFAULT_PRINCIPAL = "10000";

const DEFAULT_INTEREST = "20";

const DEFAULT_COUNT = "100";



const FREQUENCIES: CollectionFrequency[] = [

  "DAILY",

  "WEEKLY",

  "BI_WEEKLY",

  "MONTHLY",

];



export default function NewLoanModal({

  onClose,

  onSuccess,

  preselectedCustomerId,

}: Props) {

  const [mode, setMode] = useState<CustomerMode>("existing");

  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(

    preselectedCustomerId ?? 0

  );



  const [newCustomer, setNewCustomer] = useState<CustomerCreate>({

    full_name: "",

    phone: "",

    permanent_address: "",

    temporary_address: "",

  });



  const [frequency, setFrequency] = useState<CollectionFrequency>("DAILY");

  const [principalAmount, setPrincipalAmount] = useState(DEFAULT_PRINCIPAL);

  const [interestPercent, setInterestPercent] = useState(DEFAULT_INTEREST);

  const [installmentCount, setInstallmentCount] = useState(DEFAULT_COUNT);

  const [issueDate, setIssueDate] = useState(

    new Date().toISOString().split("T")[0]

  );

  const [dueStartDate, setDueStartDate] = useState(

    new Date().toISOString().split("T")[0]

  );



  const [availableCapital, setAvailableCapital] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

  const [apiError, setApiError] = useState("");



  const count = Number(installmentCount) || 0;



  const terms = useMemo(() => {

    const principal = Number(principalAmount) || 0;

    const interest = Number(interestPercent) || 0;

    if (principal <= 0 || count <= 0) return null;

    return calculateInstallmentLoanTerms(principal, interest, count);

  }, [principalAmount, interestPercent, count]);



  const dueDate = useMemo(

    () => dueDateFromStart(dueStartDate, frequency, count),

    [dueStartDate, frequency, count]

  );



  useEffect(() => {

    api

      .get<CustomerOption[]>("/customers/names")

      .then((r) => setCustomers(r.data))

      .catch(() => {});

    getCapitalSummary()

      .then((s) => setAvailableCapital(s.available_capital))

      .catch(() => {});

  }, []);



  useEffect(() => {

    if (dueStartDate < issueDate) {

      setDueStartDate(issueDate);

    }

  }, [issueDate, dueStartDate]);



  function validate(): boolean {

    const e: Record<string, string> = {};



    if (mode === "existing" && !selectedCustomerId) {

      e.customer_id = "Select a borrower.";

    }

    if (mode === "new") {

      if (!newCustomer.full_name.trim()) e.new_full_name = "Name required.";

      if (!/^\d{10}$/.test(newCustomer.phone.trim()))

        e.new_phone = "Valid 10-digit phone required.";

      if (!newCustomer.permanent_address.trim())

        e.new_permanent = "Permanent address required.";

    }

    if (Number(principalAmount) <= 0) e.principal_amount = "Invalid principal.";

    if (Number(interestPercent) <= 0) e.interest_percent = "Invalid interest %.";

    if (count <= 0) e.installment_count = "Invalid count.";

    if (dueStartDate < issueDate) {

      e.due_start_date = "First collection cannot be before issue date.";

    }

    if (

      availableCapital !== null &&

      Number(principalAmount) > Number(availableCapital)

    ) {

      e.capital = "Insufficient available capital.";

    }



    setErrors(e);

    return Object.keys(e).length === 0;

  }



  async function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (!validate() || !terms) return;



    try {

      setSaving(true);

      setApiError("");



      let customerId = selectedCustomerId;

      if (mode === "new") {

        const created = await createCustomer({

          full_name: newCustomer.full_name.trim(),

          phone: newCustomer.phone.trim(),

          permanent_address: newCustomer.permanent_address.trim(),

          temporary_address: newCustomer.temporary_address?.trim() || undefined,

        });

        customerId = created.id;

      }



      const payload: LoanCreate = {

        customer_id: customerId,

        principal_amount: principalAmount,

        interest_method: "DAILY_COLLECTION",

        interest_rate: "0",

        issue_date: issueDate,

        due_date: dueDate,

        collection_model: "DAILY_COLLECTION",

        collection_frequency: frequency,

        installment_count: count,

        due_start_date: dueStartDate,

        duration_days: frequency === "DAILY" ? count : undefined,

        daily_payment: terms.installmentAmount.toFixed(2),

        daily_principal: terms.installmentPrincipal.toFixed(2),

        daily_profit: terms.installmentProfit.toFixed(2),

      };



      await createLoan(payload);

      onSuccess();

    } catch (err: unknown) {

      const detail = (err as { response?: { data?: { detail?: string } } })

        ?.response?.data?.detail;

      setApiError(

        typeof detail === "string" ? detail : "Failed to create loan."

      );

    } finally {

      setSaving(false);

    }

  }



  const inputCls = (key: string) =>

    `w-full rounded-lg border px-3 py-2 text-sm ${

      errors[key] ? "border-red-400" : "border-slate-300"

    }`;



  return (

    <div className="modal-backdrop">
      <div className="surface-card-xl max-h-[90dvh] overflow-hidden flex flex-col">
        <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">New Loan</h2>
          <p className="text-sm text-slate-500">
            Choose collection frequency — amounts and schedule are auto-calculated
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-5 dark:bg-slate-800">
          {apiError && (

            <div className="mb-4 rounded-lg alert-error border p-3 text-sm text-red-700">

              {apiError}

            </div>

          )}



          {availableCapital !== null && (

            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">

              Available capital:{" "}

              <span className="font-semibold">{fmt(availableCapital)}</span>

            </div>

          )}



          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {!preselectedCustomerId && (

              <div className="flex rounded-lg border overflow-hidden">

                <button

                  type="button"

                  onClick={() => setMode("existing")}

                  className={`flex-1 py-2 text-sm ${

                    mode === "existing" ? "bg-blue-600 text-white" : ""

                  }`}

                >

                  Existing Borrower

                </button>

                <button

                  type="button"

                  onClick={() => setMode("new")}

                  className={`flex-1 py-2 text-sm ${

                    mode === "new" ? "bg-blue-600 text-white" : ""

                  }`}

                >

                  New Borrower

                </button>

              </div>

            )}



            {mode === "existing" && (

              <div>

                <label className="text-sm font-medium">Borrower</label>

                {preselectedCustomerId ? (

                  <div className="mt-1 rounded-lg border bg-slate-50 px-3 py-2 text-sm">

                    {customers.find((c) => c.id === preselectedCustomerId)

                      ?.full_name ?? `Customer #${preselectedCustomerId}`}

                  </div>

                ) : (

                  <select

                    value={selectedCustomerId}

                    onChange={(e) =>

                      setSelectedCustomerId(Number(e.target.value))

                    }

                    className={inputCls("customer_id")}

                  >

                    <option value={0}>Select borrower...</option>

                    {customers.map((c) => (

                      <option key={c.id} value={c.id}>{c.full_name}</option>

                    ))}

                  </select>

                )}

              </div>

            )}



            {mode === "new" && (

              <div className="space-y-3 rounded-lg border bg-blue-50 p-4">

                <input

                  placeholder="Full name *"

                  value={newCustomer.full_name}

                  onChange={(e) =>

                    setNewCustomer({ ...newCustomer, full_name: e.target.value })

                  }

                  className={inputCls("new_full_name")}

                />

                <input

                  placeholder="10-digit phone *"

                  value={newCustomer.phone}

                  onChange={(e) =>

                    setNewCustomer({ ...newCustomer, phone: e.target.value })

                  }

                  className={inputCls("new_phone")}

                />

                <textarea

                  placeholder="Permanent address *"

                  rows={2}

                  value={newCustomer.permanent_address}

                  onChange={(e) =>

                    setNewCustomer({

                      ...newCustomer,

                      permanent_address: e.target.value,

                    })

                  }

                  className={inputCls("new_permanent")}

                />

                <textarea

                  placeholder="Temporary / current address (optional)"

                  rows={2}

                  value={newCustomer.temporary_address ?? ""}

                  onChange={(e) =>

                    setNewCustomer({

                      ...newCustomer,

                      temporary_address: e.target.value,

                    })

                  }

                  className={inputCls("new_temp")}

                />

              </div>

            )}



            <div>

              <label className="text-sm font-medium">Collection frequency *</label>

              <select

                value={frequency}

                onChange={(e) =>

                  setFrequency(e.target.value as CollectionFrequency)

                }

                className={inputCls("frequency")}

              >

                {FREQUENCIES.map((f) => (

                  <option key={f} value={f}>

                    {FREQUENCY_LABELS[f]}

                  </option>

                ))}

              </select>

            </div>



            <div className="grid grid-cols-2 gap-3">

              <div>

                <label className="text-sm font-medium">Principal (₹) *</label>

                <input

                  type="number"

                  value={principalAmount}

                  onChange={(e) => setPrincipalAmount(e.target.value)}

                  className={inputCls("principal_amount")}

                />

              </div>

              <div>

                <label className="text-sm font-medium">Interest % *</label>

                <input

                  type="number"

                  value={interestPercent}

                  onChange={(e) => setInterestPercent(e.target.value)}

                  className={inputCls("interest_percent")}

                  placeholder="20"

                />

              </div>

              <div>

                <label className="text-sm font-medium">

                  {FREQUENCY_COUNT_LABELS[frequency]} *

                </label>

                <input

                  type="number"

                  value={installmentCount}

                  onChange={(e) => setInstallmentCount(e.target.value)}

                  className={inputCls("installment_count")}

                  placeholder={frequency === "DAILY" ? "100" : "12"}

                />

              </div>

              <div>

                <label className="text-sm font-medium">Issue date</label>

                <input

                  type="date"

                  value={issueDate}

                  onChange={(e) => setIssueDate(e.target.value)}

                  className={inputCls("issue_date")}

                />

              </div>

              <div className="col-span-2">

                <label className="text-sm font-medium">

                  First collection date *

                </label>

                <input

                  type="date"

                  value={dueStartDate}

                  min={issueDate}

                  onChange={(e) => setDueStartDate(e.target.value)}

                  className={inputCls("due_start_date")}

                />

                <p className="mt-1 text-xs text-slate-500">

                  Installments are scheduled from this date based on frequency

                </p>

              </div>

            </div>



            {errors.capital && (

              <p className="text-xs text-red-600">{errors.capital}</p>

            )}



            {terms && (

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-600 dark:bg-slate-700/50">
                <p className="font-medium text-slate-800 dark:text-slate-100">Auto-calculated</p>
                <div className="mt-2 grid grid-cols-2 gap-2">

                  <span>Final due date</span>

                  <span className="font-medium">{dueDate}</span>

                  <span>{installmentAmountLabel(frequency)}</span>

                  <span className="font-medium">{fmt(terms.installmentAmount)}</span>

                  <span>Principal / installment</span>

                  <span>{fmt(terms.installmentPrincipal)}</span>

                  <span>Profit / installment</span>

                  <span className="text-green-700">{fmt(terms.installmentProfit)}</span>

                  <span>Total repayment</span>

                  <span>{fmt(terms.totalRepayment)}</span>

                  <span>Expected profit</span>

                  <span className="text-green-700">{fmt(terms.totalProfit)}</span>

                  <span>Installments</span>

                  <span>{count}</span>

                </div>

              </div>

            )}



            <div className="flex gap-3">

              <button

                type="submit"

                disabled={saving}

                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"

              >

                {saving ? "Creating..." : "Create Loan"}

              </button>

              <button type="button" onClick={onClose} className="rounded-lg border px-6 py-2">

                Cancel

              </button>

            </div>

          </form>

        </div>

      </div>

    </div>

  );

}


