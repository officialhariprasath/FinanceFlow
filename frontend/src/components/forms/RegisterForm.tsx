import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  register,
  sendOtp,
  type RegisterRequest,
} from "../../services/authService";

export default function RegisterForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    phone: "",
    email: "",
    address: "",
    password: "",
    confirmPassword: "",
    otp_code: "",
  });

  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [otpHint, setOtpHint] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSendOtp() {
    setError("");
    setOtpHint("");
    if (!form.email.trim()) {
      setError("Enter your email first, then send the code.");
      return;
    }
    try {
      setSendingOtp(true);
      const res = await sendOtp(form.email, "register_owner");
      setOtpHint(
        res.mailed
          ? "Code sent to your email. Check inbox/spam."
          : `Testing mode — use code: ${res.dev_code}`
      );
      if (res.dev_code) {
        setForm((f) => ({ ...f, otp_code: res.dev_code || "" }));
      }
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { detail?: unknown }; status?: number };
        code?: string;
        message?: string;
      };
      const detail = ax.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError("Enter a valid email address.");
      } else if (!ax.response && (ax.message === "Network Error" || ax.code === "ERR_NETWORK")) {
        setError(
          "Cannot reach the server. Wait a few seconds (server may be waking up) and try again."
        );
      } else if (ax.code === "ECONNABORTED") {
        setError("Server took too long. Please try Send code again.");
      } else {
        setError("Could not send verification code.");
      }
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!form.otp_code.trim()) {
      setError("Enter the 6-digit email verification code.");
      return;
    }

    try {
      setLoading(true);
      const payload: RegisterRequest = {
        business_name: form.business_name,
        owner_name: form.owner_name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        password: form.password,
        otp_code: form.otp_code.trim(),
      };
      await register(payload);
      setSuccess("Registration successful. You can log in now.");
      setTimeout(() => navigate("/"), 1200);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      setError(typeof detail === "string" ? detail : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}
      {otpHint && <div className="alert-info">{otpHint}</div>}

      <div>
        <label className="label-field">Finance Name</label>
        <input
          type="text"
          name="business_name"
          value={form.business_name}
          onChange={handleChange}
          placeholder="Enter finance name"
          required
          className="input-field px-4 py-3"
        />
      </div>

      <div>
        <label className="label-field">Owner Name</label>
        <input
          type="text"
          name="owner_name"
          value={form.owner_name}
          onChange={handleChange}
          placeholder="Enter owner name"
          required
          className="input-field px-4 py-3"
        />
      </div>

      <div>
        <label className="label-field">Email Address</label>
        <div className="flex gap-2">
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter email"
            required
            className="input-field flex-1 px-4 py-3"
          />
          <button
            type="button"
            onClick={() => void handleSendOtp()}
            disabled={sendingOtp}
            className="shrink-0 rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300"
          >
            {sendingOtp ? "Sending…" : "Send code"}
          </button>
        </div>
      </div>

      <div>
        <label className="label-field">Email verification code (6 digits)</label>
        <input
          type="text"
          name="otp_code"
          inputMode="numeric"
          maxLength={6}
          value={form.otp_code}
          onChange={handleChange}
          placeholder="123456"
          required
          className="input-field px-4 py-3 tracking-widest"
        />
      </div>

      <div>
        <label className="label-field">Mobile Number</label>
        <input
          type="tel"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="Enter mobile number"
          required
          className="input-field px-4 py-3"
        />
      </div>

      <div>
        <label className="label-field">Address</label>
        <input
          type="text"
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="Enter address"
          required
          className="input-field px-4 py-3"
        />
      </div>

      <div>
        <label className="label-field">Password</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Enter password"
          required
          className="input-field px-4 py-3"
        />
      </div>

      <div>
        <label className="label-field">Confirm Password</label>
        <input
          type="password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          placeholder="Confirm password"
          required
          className="input-field px-4 py-3"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Registering..." : "Register"}
      </button>
    </form>
  );
}
