import { NavLink } from "react-router-dom";

function Sidebar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block w-full rounded px-4 py-3 ${
      isActive ? "bg-blue-800" : "hover:bg-blue-600"
    }`;

  return (
    <aside className="min-h-screen w-64 bg-blue-700 text-white">
      <div className="flex h-16 items-center justify-center border-b border-blue-600">
        <h1 className="text-xl font-bold">FINNECT</h1>
      </div>

      <nav className="space-y-2 p-4">
        <NavLink to="/dashboard" className={linkClass}>
          Dashboard
        </NavLink>

        <NavLink to="/customers" className={linkClass}>
          Customers
        </NavLink>

        <NavLink to="/loans" className={linkClass}>
          Loans
        </NavLink>

        <NavLink to="/payments" className={linkClass}>
          Payments
        </NavLink>

        <NavLink to="/renewals" className={linkClass}>
          Renewals
        </NavLink>

        <NavLink to="/settings" className={linkClass}>
          Settings
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;