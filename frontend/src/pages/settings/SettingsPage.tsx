import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import { PageLoading, PageError } from "../../components/common/PageStates";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import { getSettings, updateSettings } from "../../services/settingsService";
import { recalibrateCreditScorecard } from "../../services/creditScoreService";
import {
  createDeviceBackup,
  getBackupMeta,
  shareLatestBackup,
  type BackupMeta,
} from "../../services/localBackupService";
import { isNativeApp, platformLabel } from "../../utils/platform";
import { useAppUpdateContext } from "../../components/common/AppUpdateProvider";
import type { FinanceSettings } from "../../types/settings";

const SCORE_SCALE_MAX = 1000;

type SectionId =
  | "account"
  | "device"
  | "business"
  | "loans"
  | "penalties"
  | "score"
  | "ids"
  | "regional";

function validateScoreBands(poorMax: number, fairMax: number, goodMax: number): string | null {
  if (
    !Number.isFinite(poorMax) ||
    !Number.isFinite(fairMax) ||
    !Number.isFinite(goodMax)
  ) {
    return "Enter valid score band To values (0–1000).";
  }
  if (!(0 <= poorMax && poorMax < fairMax && fairMax < goodMax && goodMax < SCORE_SCALE_MAX)) {
    return (
      `Score bands must be contiguous with no gaps: ` +
      `0 ≤ Poor To < Fair To < Good To < ${SCORE_SCALE_MAX} ` +
      `(Excellent then runs to ${SCORE_SCALE_MAX}).`
    );
  }
  return null;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const { logout, session, hasPermission } = useAuth();
  const appUpdate = useAppUpdateContext();
  const isOwner = session?.is_owner ?? false;
  const canEditBusiness = isOwner && hasPermission("settings");

  const [, setSettings] = useState<FinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [saveError, setSaveError] = useState("");
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);

  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    phone: "",
    email: "",
    address: "",
    default_interest_method: "PERCENTAGE",
    default_interest_rate: "",
    default_loan_duration: "",
    default_grace_period: "",
    currency: "INR",
    date_format: "DD/MM/YYYY",
    timezone: "Asia/Kolkata",
    maturity_alert_days: "",
    daily_grace_installments: "0",
    daily_penalty_per_installment: "0",
    weekly_grace_installments: "0",
    weekly_penalty_per_installment: "0",
    bi_weekly_grace_installments: "0",
    bi_weekly_penalty_per_installment: "0",
    monthly_grace_installments: "0",
    monthly_penalty_per_installment: "0",
    score_enabled: true,
    score_band_poor_max: "499",
    score_band_fair_max: "649",
    score_band_good_max: "799",
    score_suggest_mult_thin: "1",
    score_suggest_mult_poor: "1",
    score_suggest_mult_fair: "1.5",
    score_suggest_mult_good: "2",
    score_suggest_mult_excellent: "2.5",
    score_baseline_amount: "2000",
    score_max_amount: "20000",
    score_max_stepup_mult: "2",
    customer_code_prefix: "VMFC",
    loan_code_prefix: "VMFL",
    code_number_padding: "4",
    customer_code_next: 1,
    loan_code_next: 1,
  });

  const sections = useMemo(() => {
    const base: { id: SectionId; label: string; ownerOnly?: boolean }[] = [
      { id: "account", label: "Account" },
      { id: "device", label: "Device" },
    ];
    if (canEditBusiness) {
      base.push(
        { id: "business", label: "Business", ownerOnly: true },
        { id: "loans", label: "Loan defaults", ownerOnly: true },
        { id: "penalties", label: "Grace & penalty", ownerOnly: true },
        { id: "score", label: "Credit score", ownerOnly: true },
        { id: "ids", label: "ID prefixes", ownerOnly: true },
        { id: "regional", label: "Regional", ownerOnly: true }
      );
    }
    return base;
  }, [canEditBusiness]);

  const requested = (searchParams.get("section") || "account") as SectionId;
  const section: SectionId = sections.some((s) => s.id === requested)
    ? requested
    : "account";

  function setSection(id: SectionId) {
    setSearchParams({ section: id }, { replace: true });
  }

  const scoreBandError = useMemo(
    () =>
      validateScoreBands(
        Number(form.score_band_poor_max),
        Number(form.score_band_fair_max),
        Number(form.score_band_good_max)
      ),
    [form.score_band_poor_max, form.score_band_fair_max, form.score_band_good_max]
  );

  const poorTo = Number(form.score_band_poor_max);
  const fairTo = Number(form.score_band_fair_max);
  const goodTo = Number(form.score_band_good_max);
  const fairFrom = Number.isFinite(poorTo) ? poorTo + 1 : "—";
  const goodFrom = Number.isFinite(fairTo) ? fairTo + 1 : "—";
  const excellentFrom = Number.isFinite(goodTo) ? goodTo + 1 : "—";

  const pad = Math.max(3, Number(form.code_number_padding) || 4);
  const customerPreview = `${(form.customer_code_prefix || "VMFC").toUpperCase()}${String(
    form.customer_code_next || 1
  ).padStart(pad, "0")}`;
  const loanPreview = `${(form.loan_code_prefix || "VMFL").toUpperCase()}${String(
    form.loan_code_next || 1
  ).padStart(pad, "0")}`;

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        if (canEditBusiness) {
          const data = await getSettings();
          setSettings(data);
          setForm({
            business_name: data.business_name ?? "",
            owner_name: data.owner_name ?? "",
            phone: data.phone ?? "",
            email: data.email ?? "",
            address: data.address ?? "",
            default_interest_method: data.default_interest_method ?? "PERCENTAGE",
            default_interest_rate:
              data.default_interest_rate != null ? String(data.default_interest_rate) : "",
            default_loan_duration: String(data.default_loan_duration ?? ""),
            default_grace_period: String(data.default_grace_period ?? ""),
            currency: data.currency ?? "INR",
            date_format: data.date_format ?? "DD/MM/YYYY",
            timezone: data.timezone ?? "Asia/Kolkata",
            maturity_alert_days: String(data.maturity_alert_days ?? ""),
            daily_grace_installments: String(data.daily_grace_installments ?? 0),
            daily_penalty_per_installment: String(data.daily_penalty_per_installment ?? 0),
            weekly_grace_installments: String(data.weekly_grace_installments ?? 0),
            weekly_penalty_per_installment: String(data.weekly_penalty_per_installment ?? 0),
            bi_weekly_grace_installments: String(data.bi_weekly_grace_installments ?? 0),
            bi_weekly_penalty_per_installment: String(
              data.bi_weekly_penalty_per_installment ?? 0
            ),
            monthly_grace_installments: String(data.monthly_grace_installments ?? 0),
            monthly_penalty_per_installment: String(data.monthly_penalty_per_installment ?? 0),
            score_enabled: data.score_enabled !== false,
            score_band_poor_max: String(data.score_band_poor_max ?? 499),
            score_band_fair_max: String(data.score_band_fair_max ?? 649),
            score_band_good_max: String(data.score_band_good_max ?? 799),
            score_suggest_mult_thin: String(data.score_suggest_mult_thin ?? 1),
            score_suggest_mult_poor: String(data.score_suggest_mult_poor ?? 1),
            score_suggest_mult_fair: String(data.score_suggest_mult_fair ?? 1.5),
            score_suggest_mult_good: String(data.score_suggest_mult_good ?? 2),
            score_suggest_mult_excellent: String(data.score_suggest_mult_excellent ?? 2.5),
            score_baseline_amount: String(data.score_baseline_amount ?? 2000),
            score_max_amount: String(data.score_max_amount ?? 20000),
            score_max_stepup_mult: String(data.score_max_stepup_mult ?? 2),
            customer_code_prefix: data.customer_code_prefix ?? "VMFC",
            loan_code_prefix: data.loan_code_prefix ?? "VMFL",
            code_number_padding: String(data.code_number_padding ?? 4),
            customer_code_next: data.customer_code_next ?? 1,
            loan_code_next: data.loan_code_next ?? 1,
          });
        }
        setBackupMeta(await getBackupMeta());
      } catch {
        setError("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [canEditBusiness]);

  function handleLogout() {
    logout();
    navigate("/");
  }

  async function handleBackupNow() {
    try {
      setBackingUp(true);
      const meta = await createDeviceBackup(session?.display_name ?? undefined, {
        download: !isNativeApp(),
      });
      setBackupMeta(meta);
      toast.success(
        isNativeApp()
          ? "Backup saved on this phone."
          : "Backup downloaded to this device."
      );
    } catch {
      toast.error("Backup failed. Check your connection and try again.");
    } finally {
      setBackingUp(false);
    }
  }

  async function handleShareBackup() {
    try {
      setSharing(true);
      await shareLatestBackup();
    } catch {
      toast.error("Could not share backup. Create a backup first.");
    } finally {
      setSharing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditBusiness) return;
    const gracePenaltyErrors = [
      nonNegativeOrError(form.daily_grace_installments, "Daily grace installments"),
      nonNegativeOrError(form.daily_penalty_per_installment, "Daily penalty"),
      nonNegativeOrError(form.weekly_grace_installments, "Weekly grace installments"),
      nonNegativeOrError(form.weekly_penalty_per_installment, "Weekly penalty"),
      nonNegativeOrError(form.bi_weekly_grace_installments, "Bi-weekly grace installments"),
      nonNegativeOrError(form.bi_weekly_penalty_per_installment, "Bi-weekly penalty"),
      nonNegativeOrError(form.monthly_grace_installments, "Monthly grace installments"),
      nonNegativeOrError(form.monthly_penalty_per_installment, "Monthly penalty"),
    ].filter(Boolean);
    if (gracePenaltyErrors.length > 0) {
      setSaveError(gracePenaltyErrors[0] as string);
      return;
    }
    const prefix = (form.customer_code_prefix || "").trim();
    const loanPrefix = (form.loan_code_prefix || "").trim();
    if (!/^[A-Za-z0-9]{2,12}$/.test(prefix) || !/^[A-Za-z0-9]{2,12}$/.test(loanPrefix)) {
      setSaveError("ID prefixes must be 2–12 letters or digits (e.g. VMFC, VMFL).");
      setSection("ids");
      return;
    }
    const padding = Number(form.code_number_padding);
    if (!Number.isFinite(padding) || padding < 3 || padding > 8) {
      setSaveError("Number padding must be between 3 and 8.");
      setSection("ids");
      return;
    }
    try {
      setSaving(true);
      setSaveError("");
      setSuccess("");
      const bandErr = validateScoreBands(
        Number(form.score_band_poor_max),
        Number(form.score_band_fair_max),
        Number(form.score_band_good_max)
      );
      if (bandErr) {
        setSaveError(bandErr);
        setSection("score");
        return;
      }
      const saved = await updateSettings({
        business_name: form.business_name || null,
        owner_name: form.owner_name || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        default_interest_method: form.default_interest_method || null,
        default_interest_rate: form.default_interest_rate || null,
        default_loan_duration: form.default_loan_duration
          ? Number(form.default_loan_duration)
          : null,
        default_grace_period: form.default_grace_period
          ? Number(form.default_grace_period)
          : null,
        currency: form.currency || null,
        date_format: form.date_format || null,
        timezone: form.timezone || null,
        maturity_alert_days: form.maturity_alert_days
          ? Number(form.maturity_alert_days)
          : null,
        daily_grace_installments: Number(form.daily_grace_installments || 0),
        daily_penalty_per_installment: form.daily_penalty_per_installment || "0",
        weekly_grace_installments: Number(form.weekly_grace_installments || 0),
        weekly_penalty_per_installment: form.weekly_penalty_per_installment || "0",
        bi_weekly_grace_installments: Number(form.bi_weekly_grace_installments || 0),
        bi_weekly_penalty_per_installment: form.bi_weekly_penalty_per_installment || "0",
        monthly_grace_installments: Number(form.monthly_grace_installments || 0),
        monthly_penalty_per_installment: form.monthly_penalty_per_installment || "0",
        score_enabled: form.score_enabled,
        score_band_poor_max: Number(form.score_band_poor_max || 499),
        score_band_fair_max: Number(form.score_band_fair_max || 649),
        score_band_good_max: Number(form.score_band_good_max || 799),
        score_suggest_mult_thin: form.score_suggest_mult_thin || "1",
        score_suggest_mult_poor: form.score_suggest_mult_poor || "1",
        score_suggest_mult_fair: form.score_suggest_mult_fair || "1.5",
        score_suggest_mult_good: form.score_suggest_mult_good || "2",
        score_suggest_mult_excellent: form.score_suggest_mult_excellent || "2.5",
        score_baseline_amount: form.score_baseline_amount || "2000",
        score_max_amount: form.score_max_amount || "20000",
        score_max_stepup_mult: form.score_max_stepup_mult || "2",
        customer_code_prefix: prefix.toUpperCase(),
        loan_code_prefix: loanPrefix.toUpperCase(),
        code_number_padding: padding,
      });
      setForm((prev) => ({
        ...prev,
        customer_code_prefix: saved.customer_code_prefix ?? prev.customer_code_prefix,
        loan_code_prefix: saved.loan_code_prefix ?? prev.loan_code_prefix,
        code_number_padding: String(saved.code_number_padding ?? prev.code_number_padding),
        customer_code_next: saved.customer_code_next ?? prev.customer_code_next,
        loan_code_next: saved.loan_code_next ?? prev.loan_code_next,
      }));
      const updatedCount = saved?.penalty_loans_updated;
      const backfillNote =
        typeof updatedCount === "number"
          ? ` Updated ${updatedCount} existing installment loan${
              updatedCount === 1 ? "" : "s"
            }.`
          : "";
      setSuccess(`Settings saved successfully.${backfillNote}`);
      toast.success(
        typeof updatedCount === "number" && updatedCount > 0
          ? `Settings saved. ${updatedCount} loan${updatedCount === 1 ? "" : "s"} updated.`
          : "Settings saved."
      );
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      setSaveError(typeof detail === "string" ? detail : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function nonNegativeOrError(value: string, label: string): string | null {
    if (value === "" || Number.isNaN(Number(value)) || Number(value) < 0) {
      return `${label} must be 0 or greater.`;
    }
    return null;
  }

  function inp(label: string, key: Exclude<keyof typeof form, "score_enabled" | "customer_code_next" | "loan_code_next">, type = "text") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
        <input
          type={type}
          value={String(form[key])}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  }

  const showSave =
    canEditBusiness &&
    ["business", "loans", "penalties", "score", "ids", "regional"].includes(section);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-title">
            {canEditBusiness ? "Finance Settings" : "Account"}
          </h1>
          <p className="page-subtitle">
            {canEditBusiness
              ? "Configure one settings area at a time."
              : "Account and device options."}
          </p>
        </div>

        {error && <PageError message={error} />}

        {loading ? (
          <PageLoading message="Loading..." />
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <aside className="w-full shrink-0 lg:w-52">
              <nav className="surface-card flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                      section === s.id
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </nav>
            </aside>

            <div className="min-w-0 flex-1 space-y-4">
              {section === "account" && (
                <div className="surface-card p-6 dark:bg-slate-800">
                  <h2 className="mb-2 font-semibold text-slate-800 dark:text-slate-100">Account</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Signed in as{" "}
                    <span className="font-medium">{session?.display_name ?? "User"}</span>
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={theme === "dark"}
                        onChange={toggleTheme}
                        className="h-4 w-4 rounded"
                      />
                      Dark mode (easier outdoors)
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-4 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Log out
                  </button>
                </div>
              )}

              {section === "device" && (
                <>
                  {isNativeApp() && (
                    <div className="surface-card p-6 dark:bg-slate-800">
                      <h2 className="mb-2 font-semibold text-slate-800 dark:text-slate-100">
                        App updates
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Installed version:{" "}
                        <span className="font-medium">
                          {appUpdate.local?.versionName ?? "…"} (
                          {appUpdate.local?.versionCode ?? "—"})
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await appUpdate.checkNow();
                          if (result?.update) {
                            toast.success(`Update ${result.update.versionName} available.`);
                          } else if (result?.local) {
                            toast.success("You are on the latest version.");
                          } else {
                            toast.error("Could not check for updates.");
                          }
                        }}
                        disabled={appUpdate.checking || appUpdate.installing}
                        className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                      >
                        {appUpdate.checking ? "Checking…" : "Check for updates"}
                      </button>
                    </div>
                  )}

                  <div className="surface-card p-6 dark:bg-slate-800">
                    <h2 className="mb-2 font-semibold text-slate-800 dark:text-slate-100">
                      Device backup
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Running as <span className="font-medium">{platformLabel()}</span>.
                      A local copy of customers, loans, payments, renewals, collections, and
                      capital is stored on this device so you still have data if the cloud
                      is unreachable.
                    </p>
                    {backupMeta ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-600 dark:bg-slate-700/40">
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          Last backup:{" "}
                          {new Date(backupMeta.exported_at).toLocaleString("en-IN")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {backupMeta.counts.customers} customers · {backupMeta.counts.loans}{" "}
                          loans · {backupMeta.counts.payments} payments ·{" "}
                          {backupMeta.counts.renewals} renewals
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                        No local backup yet. Create one after you sync online.
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleBackupNow}
                        disabled={backingUp}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {backingUp ? "Backing up…" : "Backup now"}
                      </button>
                      <button
                        type="button"
                        onClick={handleShareBackup}
                        disabled={sharing}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                      >
                        {sharing ? "Opening…" : "Export / share backup"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {canEditBusiness && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {section === "business" && (
                    <div className="surface-card p-6">
                      <h2 className="mb-4 font-semibold text-slate-800">Business Information</h2>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {inp("Business Name", "business_name")}
                        {inp("Owner Name", "owner_name")}
                        {inp("Phone", "phone")}
                        {inp("Email", "email", "email")}
                        <div className="md:col-span-2">{inp("Address", "address")}</div>
                      </div>
                    </div>
                  )}

                  {section === "loans" && (
                    <div className="surface-card p-6">
                      <h2 className="mb-4 font-semibold text-slate-800">Loan Defaults</h2>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Default Interest Method
                          </label>
                          <select
                            value={form.default_interest_method}
                            onChange={(e) =>
                              setForm({ ...form, default_interest_method: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="PERCENTAGE">Percentage (% per month)</option>
                            <option value="RUPEES_PER_100">Rupees per ₹100 per month</option>
                          </select>
                        </div>
                        {inp("Default Interest Rate", "default_interest_rate", "number")}
                        {inp("Default Loan Duration (months)", "default_loan_duration", "number")}
                        {inp("Default Grace Period (days)", "default_grace_period", "number")}
                        {inp("Maturity Alert Days", "maturity_alert_days", "number")}
                      </div>
                    </div>
                  )}

                  {section === "penalties" && (
                    <div className="surface-card p-6">
                      <h2 className="mb-1 font-semibold text-slate-800">
                        Grace Installments &amp; Penalty
                      </h2>
                      <p className="mb-4 text-sm text-slate-500">
                        Grace is counted in <span className="font-medium">calendar days
                        from today</span>. Saving updates all existing installment loans.
                      </p>
                      <div className="space-y-4">
                        {(
                          [
                            ["Daily", "daily_grace_installments", "daily_penalty_per_installment"],
                            ["Weekly", "weekly_grace_installments", "weekly_penalty_per_installment"],
                            [
                              "Bi-weekly",
                              "bi_weekly_grace_installments",
                              "bi_weekly_penalty_per_installment",
                            ],
                            [
                              "Monthly",
                              "monthly_grace_installments",
                              "monthly_penalty_per_installment",
                            ],
                          ] as const
                        ).map(([label, graceKey, penaltyKey]) => (
                          <div
                            key={label}
                            className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-3"
                          >
                            <div className="flex items-center">
                              <p className="font-medium text-slate-800">{label}</p>
                            </div>
                            {inp("Grace Days (from today)", graceKey, "number")}
                            {inp("Penalty Per Day / Installment (₹)", penaltyKey, "number")}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {section === "score" && (
                    <div className="surface-card p-6">
                      <h2 className="mb-1 font-semibold text-slate-800">Credit Score Policy</h2>
                      <p className="mb-4 text-sm text-slate-500">
                        CIBIL-style score (0–1000), advisory only. Suggested next loan =
                        average of previous loan amounts × band multiplier.
                      </p>
                      <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.score_enabled}
                          onChange={(e) => setForm({ ...form, score_enabled: e.target.checked })}
                        />
                        Enable credit scoring
                      </label>

                      <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Level</th>
                              <th className="px-3 py-2">From</th>
                              <th className="px-3 py-2">To</th>
                              <th className="px-3 py-2">Multiplier</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <tr>
                              <td className="px-3 py-2 font-medium text-slate-800">Thin file</td>
                              <td className="px-3 py-2 text-slate-400">—</td>
                              <td className="px-3 py-2 text-slate-400">file status</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  value={form.score_suggest_mult_thin}
                                  onChange={(e) =>
                                    setForm({ ...form, score_suggest_mult_thin: e.target.value })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                />
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-medium text-slate-800">Poor</td>
                              <td className="px-3 py-2 text-slate-600">0</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={SCORE_SCALE_MAX - 3}
                                  value={form.score_band_poor_max}
                                  onChange={(e) =>
                                    setForm({ ...form, score_band_poor_max: e.target.value })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  value={form.score_suggest_mult_poor}
                                  onChange={(e) =>
                                    setForm({ ...form, score_suggest_mult_poor: e.target.value })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                />
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-medium text-slate-800">Fair</td>
                              <td className="px-3 py-2 text-slate-600">{fairFrom}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={SCORE_SCALE_MAX - 2}
                                  value={form.score_band_fair_max}
                                  onChange={(e) =>
                                    setForm({ ...form, score_band_fair_max: e.target.value })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  value={form.score_suggest_mult_fair}
                                  onChange={(e) =>
                                    setForm({ ...form, score_suggest_mult_fair: e.target.value })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                />
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-medium text-slate-800">Good</td>
                              <td className="px-3 py-2 text-slate-600">{goodFrom}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={SCORE_SCALE_MAX - 1}
                                  value={form.score_band_good_max}
                                  onChange={(e) =>
                                    setForm({ ...form, score_band_good_max: e.target.value })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  value={form.score_suggest_mult_good}
                                  onChange={(e) =>
                                    setForm({ ...form, score_suggest_mult_good: e.target.value })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                />
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-semibold text-slate-800">Excellent</td>
                              <td className="px-3 py-2 text-slate-600">{excellentFrom}</td>
                              <td className="px-3 py-2 text-slate-600">{SCORE_SCALE_MAX}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  value={form.score_suggest_mult_excellent}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      score_suggest_mult_excellent: e.target.value,
                                    })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {scoreBandError ? (
                        <p className="mb-4 text-sm text-red-600">{scoreBandError}</p>
                      ) : (
                        <p className="mb-4 text-xs text-slate-500">
                          From values auto-fill as previous To + 1 so bands stay contiguous.
                        </p>
                      )}

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {inp("Baseline / starter (₹)", "score_baseline_amount", "number")}
                        {inp("Max suggested (₹)", "score_max_amount", "number")}
                        {inp("Max step-up vs last closed (×)", "score_max_stepup_mult", "number")}
                      </div>
                      <div className="mt-4">
                        <button
                          type="button"
                          disabled={recalibrating}
                          onClick={async () => {
                            try {
                              setRecalibrating(true);
                              const result = await recalibrateCreditScorecard();
                              toast.success(
                                `Scorecard recalibrated (${result.version}). Good=${result.good}, Bad=${result.bad}.`
                              );
                            } catch (err: unknown) {
                              const detail = (err as { response?: { data?: { detail?: string } } })
                                ?.response?.data?.detail;
                              toast.error(
                                typeof detail === "string"
                                  ? detail
                                  : "Recalibration failed or not enough labeled history."
                              );
                            } finally {
                              setRecalibrating(false);
                            }
                          }}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {recalibrating ? "Recalibrating…" : "Recalibrate scorecard"}
                        </button>
                      </div>
                    </div>
                  )}

                  {section === "ids" && (
                    <div className="surface-card p-6">
                      <h2 className="mb-1 font-semibold text-slate-800">ID prefixes</h2>
                      <p className="mb-4 text-sm text-slate-500">
                        New customers and loans get codes like{" "}
                        <span className="font-medium">VMFC0001</span> /{" "}
                        <span className="font-medium">VMFL0001</span>. After{" "}
                        {pad === 4 ? "9999" : "9".repeat(pad)} the number grows automatically
                        (e.g. VMFL10000). Changing a prefix applies to{" "}
                        <span className="font-medium">new</span> records only; existing codes
                        stay as assigned.
                      </p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {inp("Customer prefix", "customer_code_prefix")}
                        {inp("Loan prefix", "loan_code_prefix")}
                        {inp("Number digits (min 3)", "code_number_padding", "number")}
                      </div>
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-600 dark:bg-slate-700/40">
                        <p>
                          Next customer:{" "}
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {customerPreview}
                          </span>
                        </p>
                        <p className="mt-1">
                          Next loan:{" "}
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {loanPreview}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {section === "regional" && (
                    <div className="surface-card p-6">
                      <h2 className="mb-4 font-semibold text-slate-800">Regional Settings</h2>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {inp("Currency", "currency")}
                        {inp("Date Format", "date_format")}
                        {inp("Timezone", "timezone")}
                      </div>
                    </div>
                  )}

                  {showSave && (
                    <>
                      {saveError && <PageError message={saveError} />}
                      {success && (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
                          {success}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={saving || Boolean(scoreBandError && section === "score")}
                        className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save Settings"}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
