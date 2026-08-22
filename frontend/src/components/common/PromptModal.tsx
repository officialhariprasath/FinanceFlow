import { useState } from "react";

type PromptModalProps = {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  required?: boolean;
  loading?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export default function PromptModal({
  title,
  message,
  label = "Reason",
  placeholder,
  confirmLabel = "Submit",
  required = true,
  loading = false,
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (required && !value.trim()) {
      setError("This field is required.");
      return;
    }
    onConfirm(value.trim());
  }

  return (
    <div className="modal-backdrop">
      <form
        onSubmit={handleSubmit}
        className="modal-panel max-w-md"
      >
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        {message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {label}
          </label>
          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            rows={3}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            autoFocus
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
