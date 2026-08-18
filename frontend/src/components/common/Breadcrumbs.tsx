import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500 dark:text-slate-400">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-400">/</span>}
            {item.to ? (
              <Link to={item.to} className="text-blue-600 hover:underline dark:text-blue-400">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
