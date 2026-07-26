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
        <div className="rounded-lg bg-red-100 p-3 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-100 p-3 text-green-700">
          {success}
        </div>
      )}

      <div>
        <label className="mb-2 block font-medium">
          Finance Name
        </label>

        <input
          type="text"
          name="business_name"
          value={form.business_name}
          onChange={handleChange}
          placeholder="Enter finance name"
          required
          className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-2 block font-medium">
          Owner Name
        </label>

        <input
          type="text"
          name="owner_name"
          value={form.owner_name}
          onChange={handleChange}
          placeholder="Enter owner name"
          required
          className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-2 block font-medium">
          Email Address
        </label>

        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Enter email"
          required
          className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-2 block font-medium">
          Mobile Number
        </label>

        <input
          type="tel"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="Enter mobile number"
          required
          className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-2 block font-medium">
          Address
        </label>

        <input
          type="text"
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="Enter address"
          required
          className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-2 block font-medium">
          Password
        </label>

        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Enter password"
          required
          className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-2 block font-medium">
          Confirm Password
        </label>

        <input
          type="password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          placeholder="Confirm password"
          required
          className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
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