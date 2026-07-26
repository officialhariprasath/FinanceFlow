export function PageLoading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="rounded-lg bg-white p-10 text-center text-slate-500 shadow">
      {message}
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-white p-10 text-center text-slate-500 shadow">
      {message}
    </div>
  );
}
