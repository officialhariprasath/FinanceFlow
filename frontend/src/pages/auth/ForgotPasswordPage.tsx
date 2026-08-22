import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { forgotPassword, resetPassword } from "../../services/authService";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      setLoading(true);
      const res = await forgotPassword(identifier);
      setInfo(
        res.mailed
          ? "Code sent to your registered email."
          : `Testing mode — use code: ${res.dev_code}`
      );
      if (res.dev_code) setCode(res.dev_code);
      setStep("reset");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not send reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      await resetPassword(identifier, code, password);
      setInfo("Password updated. Redirecting to login…");
      setTimeout(() => navigate("/"), 1200);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      setError(typeof detail === "string" ? detail : "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="safe-top safe-bottom flex min-h-screen min-h-[100dvh] items-center justify-center bg-slate-100 p-4 dark:bg-slate-900">
      <div className="w-full max-w-md surface-card p-6 shadow-lg sm:p-8">
        <h1 className="text-center text-2xl font-bold text-blue-600">Reset password</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Use your email or mobile number. We send a 6-digit code to the account email.
        </p>

        {error && <div className="alert-error mt-4">{error}</div>}
        {info && <div className="alert-info mt-4">{info}</div>}

        {step === "request" ? (
          <form onSubmit={handleRequest} className="mt-6 space-y-4">
            <div>
              <label className="label-field">Email or mobile</label>
              <input
                className="input-field px-4 py-3"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@example.com or 9876543210"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 text-white disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="mt-6 space-y-4">
            <div>
              <label className="label-field">6-digit code</label>
              <input
                className="input-field px-4 py-3 tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                required
              />
            </div>
            <div>
              <label className="label-field">New password</label>
              <input
                type="password"
                className="input-field px-4 py-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="label-field">Confirm password</label>
              <input
                type="password"
                className="input-field px-4 py-3"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 text-white disabled:opacity-50"
            >
              {loading ? "Saving…" : "Update password"}
            </button>
            <button
              type="button"
              className="w-full text-sm text-blue-600"
              onClick={() => setStep("request")}
            >
              Resend code
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <Link to="/" className="text-blue-600 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
