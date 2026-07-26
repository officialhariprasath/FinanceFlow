import { useEffect, useState } from "react";
import MainLayout from "../../components/layout/MainLayout";
import { PageLoading, PageError } from "../../components/common/PageStates";
import { getSettings, updateSettings } from "../../services/settingsService";
import type { FinanceSettings } from "../../types/settings";

export default function SettingsPage() {
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [saveError, setSaveError] = useState("");

  // Form state mirrors FinanceSettings fields
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
        const data = await getSettings();
        setSettings(data);
        setForm({
          business_name: data.business_name ?? "",
          owner_name: data.owner_name ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          default_interest_method: data.default_interest_method ?? "PERCENTAGE",
          default_interest_rate: data.default_interest_rate ?? "",
          default_loan_duration: String(data.default_loan_duration ?? ""),
          default_grace_period: String(data.default_grace_period ?? ""),
          currency: data.currency ?? "INR",
          date_format: data.date_format ?? "DD/MM/YYYY",
          timezone: data.timezone ?? "Asia/Kolkata",
          maturity_alert_days: String(data.maturity_alert_days ?? ""),
        });
      } catch {
        setError("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        default_loan_duration: form.default_loan_duration ? Number(form.default_loan_duration) : null,
        default_grace_period: form.default_grace_period ? Number(form.default_grace_period) : null,
        currency: form.currency || null,
        date_format: form.date_format || null,
        timezone: form.timezone || null,
        maturity_alert_days: form.maturity_alert_days ? Number(form.maturity_alert_days) : null,
      });
      setSuccess("Settings saved successfully.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
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
          <h1 className="text-3xl font-bold text-slate-800">Finance Settings</h1>
          <p className="mt-1 text-slate-500">Configure your finance business defaults.</p>
        </div>

        {error && <PageError message={error} />}

        {loading ? (
          <PageLoading message="Loading settings..." />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Info */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 font-semibold text-slate-800">Business Information</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {inp("Business Name", "business_name")}
                {inp("Owner Name", "owner_name")}
                {inp("Phone", "phone")}
                {inp("Email", "email", "email")}
                <div className="md:col-span-2">
                  {inp("Address", "address")}
                </div>
              </div>
            </div>

            {/* Loan Defaults */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 font-semibold text-slate-800">Loan Defaults</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Default Interest Method</label>
                  <select
                    value={form.default_interest_method}
                    onChange={(e) => setForm({ ...form, default_interest_method: e.target.value })}
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

            {/* Regional */}
            <div className="rounded-lg bg-white p-6 shadow">
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
      </div>
    </MainLayout>
  );
}
