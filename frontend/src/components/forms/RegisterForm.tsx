import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  register,
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
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
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
      };

      await register(payload);

      setSuccess("Registration successful.");

      setTimeout(() => {
        navigate("/");
      }, 1200);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {error && (
        <div className="alert-error">{error}</div>
      )}

      {success && (
        <div className="alert-success">{success}</div>
      )}

      <div>
        <label className="label-field">
          Finance Name
        </label>

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
        <label className="label-field">
          Owner Name
        </label>

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
        <label className="label-field">
          Email Address
        </label>

        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Enter email"
          required
          className="input-field px-4 py-3"
        />
      </div>

      <div>
        <label className="label-field">
          Mobile Number
        </label>

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
        <label className="label-field">
          Address
        </label>

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
        <label className="label-field">
          Password
        </label>

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
        <label className="label-field">
          Confirm Password
        </label>

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