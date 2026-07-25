type DashboardCardProps = {
  title: string;
  value: string | number;
};

function DashboardCard({ title, value }: DashboardCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border">
      <h3 className="text-gray-500 text-sm font-medium">
        {title}
      </h3>

      <p className="text-3xl font-bold text-gray-800 mt-2">
        {value}
      </p>
    </div>
  );
}

export default DashboardCard;