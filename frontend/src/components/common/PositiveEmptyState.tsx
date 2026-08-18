type Props = {
  title: string;
  message: string;
  icon?: string;
};

export default function PositiveEmptyState({ title, message, icon = "✓" }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700 dark:bg-green-900/40 dark:text-green-300">
        {icon}
      </div>
      <p className="section-title dark:text-slate-100">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}
