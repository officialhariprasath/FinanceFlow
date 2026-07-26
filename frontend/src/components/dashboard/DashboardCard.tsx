type DashboardCardProps = {
  title: string;
  value: string | number;
  onClick?: () => void;
};

function DashboardCard({ title, value, onClick }: DashboardCardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-lg bg-white p-6 shadow border ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
    >
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-2 text-3xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

export default DashboardCard;
