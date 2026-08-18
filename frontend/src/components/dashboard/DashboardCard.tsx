type DashboardCardProps = {
  title: string;
  value: string | number;
  onClick?: () => void;
};

function DashboardCard({ title, value, onClick }: DashboardCardProps) {
  return (
    <div
      onClick={onClick}
      className={`surface-card flex min-h-[110px] flex-col justify-between p-4 ${
        onClick ? "cursor-pointer transition-shadow hover:shadow-md dark:hover:border-slate-600" : ""
      }`}
    >
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      <p className="mt-2 break-words text-2xl font-bold leading-tight text-slate-800 [word-break:break-word] dark:text-slate-100 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

export default DashboardCard;
