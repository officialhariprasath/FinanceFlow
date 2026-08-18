const LABELS = ["Clear wallet", "Delivery", "Details"];

export default function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {LABELS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                active
                  ? "bg-blue-600 text-white"
                  : done
                    ? "bg-green-600 text-white"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {done ? "✓" : n}
            </div>
            <span
              className={`hidden text-center text-xs sm:block ${
                active ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-500"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
