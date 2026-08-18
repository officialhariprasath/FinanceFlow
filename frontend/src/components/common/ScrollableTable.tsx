import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Horizontal scroll wrapper for wide tables on mobile. */
export default function ScrollableTable({ children, className = "" }: Props) {
  return (
    <div
      className={`table-scroll ${className}`}
      role="region"
      aria-label="Scrollable table"
    >
      {children}
    </div>
  );
}
