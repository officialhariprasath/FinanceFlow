export function PageLoading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="surface-card p-10 text-center text-muted">
      {message}
    </div>
  );
}

export function PageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="alert-error p-4">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="surface-card p-10 text-center text-muted">
      {message}
    </div>
  );
}
