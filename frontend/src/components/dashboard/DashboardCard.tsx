type DashboardCardProps = {
  title: string;
  value: string | number;
  onClick?: () => void;
};

function DashboardCard({ title, value, onClick }: DashboardCardProps) {
  return (
    <div
      onClick={onClick}
      className={`flex min-h-[110px] flex-col justify-between rounded-lg border bg-white p-4 shadow ${
        onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""
      }`}
    >
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-2 break-words text-2xl font-bold leading-tight text-gray-800 [word-break:break-word] sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

export default DashboardCard;
