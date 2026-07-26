import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/loans": "Loans",
  "/payments": "Payments",
  "/renewals": "Renewals",
  "/settings": "Settings",
  "/reports": "Reports",
};

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const title =
    Object.entries(PAGE_TITLES).find(([path]) =>
      location.pathname.startsWith(path)
    )?.[1] ?? "FINNECT";

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
      <button
        onClick={handleLogout}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Logout
      </button>
    </header>
  );
}

export default Navbar;
