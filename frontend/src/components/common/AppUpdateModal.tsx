type Props = {
  versionName: string;
  notes?: string;
  installing: boolean;
  progress: number;
  error: string;
  force?: boolean;
  onUpdate: () => void;
  onLater: () => void;
};

export default function AppUpdateModal({
  versionName,
  notes,
  installing,
  progress,
  error,
  force,
  onUpdate,
  onLater,
}: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="modal-panel max-w-md shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Update available
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          FinanceFlow <span className="font-medium">{versionName}</span> is ready
          to install on this phone.
        </p>
        {notes ? (
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-700/40 dark:text-slate-200">
            {notes}
          </p>
        ) : null}
        {installing ? (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-center text-xs text-slate-500">
              Downloading… {progress}%
            </p>
          </div>
        ) : null}
        {error ? <p className="alert-error mt-3">{error}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {!force && !installing ? (
            <button type="button" onClick={onLater} className="btn-secondary">
              Later
            </button>
          ) : null}
          <button
            type="button"
            onClick={onUpdate}
            disabled={installing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {installing ? "Please wait…" : "Update app"}
          </button>
        </div>
      </div>
    </div>
  );
}
