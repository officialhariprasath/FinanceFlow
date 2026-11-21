import { Navigate, useParams } from "react-router-dom";

/** Legacy URL — score lives on the customer ledger Score tab. */
export default function CustomerScorePage() {
  const { customerId } = useParams();
  if (!customerId) return <Navigate to="/customers" replace />;
  return (
    <Navigate to={`/customers/${customerId}/ledger?tab=score`} replace />
  );
}
