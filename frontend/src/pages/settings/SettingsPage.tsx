import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import { PageLoading, PageError } from "../../components/common/PageStates";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import { getSettings, updateSettings } from "../../services/settingsService";
import {
  getNotifications,
  markNotificationRead,
  type Notification,
} from "../../services/extendedService";
import {
  createDeviceBackup,
  getBackupMeta,
  shareLatestBackup,
  type BackupMeta,
} from "../../services/localBackupService";
import { isNativeApp, platformLabel } from "../../utils/platform";
import { useAppUpdateContext } from "../../components/common/AppUpdateProvider";
import type { FinanceSettings } from "../../types/settings";

export default function SettingsPage() {
  const navigate = useNavigate();
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [sharing, setSharing] = useState(false);

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
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const notifPromise = getNotifications();
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
          });
        }
        setNotifications(await notifPromise);
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

  async function handleMarkRead(id: number) {
    await markNotificationRead(id);
    setNotifications(await getNotifications());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditBusiness) return;
    try {
      setSaving(true);
      setSaveError("");
      setSuccess("");
      await updateSettings({
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
      });
      setSuccess("Settings saved successfully.");
      toast.success("Settings saved.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      setSaveError(typeof detail === "string" ? detail : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function inp(label: string, key: keyof typeof form, type = "text") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-title">
            {canEditBusiness ? "Finance Settings" : "Account"}
          </h1>
          <p className="page-subtitle">
            {canEditBusiness
              ? "Configure your finance business defaults."
              : "Notifications and account options."}
          </p>
        </div>

        {error && <PageError message={error} />}

        {loading ? (
          <PageLoading message="Loading..." />
        ) : (
          <>
            <div className="surface-card">
              <div className="border-b px-6 py-4">
                <h2 className="font-semibold text-slate-800">Notifications</h2>
              </div>
              <ul className="divide-y">
                {notifications.length === 0 ? (
                  <li className="px-6 py-6 text-sm text-gray-500 dark:text-slate-400">No notifications.</li>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <li key={n.id} className="flex justify-between gap-4 px-6 py-4">
                      <div>
                        <p className="font-medium">{n.title}</p>
                        <p className="text-sm text-gray-600 dark:text-slate-400">{n.message}</p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                          {new Date(n.created_at).toLocaleString("en-IN")}
                        </p>
                      </div>
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          className="shrink-0 text-sm text-blue-700"
                        >
                          Mark read
                        </button>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>

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

            {canEditBusiness && (
              <form onSubmit={handleSubmit} className="space-y-6">
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

                <div className="surface-card p-6">
                  <h2 className="mb-4 font-semibold text-slate-800">Regional Settings</h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {inp("Currency", "currency")}
                    {inp("Date Format", "date_format")}
                    {inp("Timezone", "timezone")}
                  </div>
                </div>

                {saveError && <PageError message={saveError} />}
                {success && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
