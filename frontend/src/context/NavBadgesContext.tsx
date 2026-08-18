import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "./AuthContext";
import { getFinanceFlowDashboard } from "../services/financeflowDashboardService";
import { getMyWallet } from "../services/agentWalletService";

interface NavBadges {
  pendingSettlements: number;
  agentPendingSettlement: boolean;
  refresh: () => void;
}

const NavBadgesContext = createContext<NavBadges | null>(null);

export function NavBadgesProvider({ children }: { children: ReactNode }) {
  const { session, isAuthenticated } = useAuth();
  const [pendingSettlements, setPendingSettlements] = useState(0);
  const [agentPendingSettlement, setAgentPendingSettlement] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !session) return;
    try {
      if (session.is_owner) {
        const dash = await getFinanceFlowDashboard();
        setPendingSettlements(dash.pending_settlement_count ?? 0);
        setAgentPendingSettlement(false);
      } else {
        const w = await getMyWallet();
        setAgentPendingSettlement(!!w.has_pending_settlement);
        setPendingSettlements(0);
      }
    } catch {
      // non-critical
    }
  }, [isAuthenticated, session]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const value = useMemo(
    () => ({ pendingSettlements, agentPendingSettlement, refresh }),
    [pendingSettlements, agentPendingSettlement, refresh]
  );

  return (
    <NavBadgesContext.Provider value={value}>{children}</NavBadgesContext.Provider>
  );
}

export function useNavBadges() {
  const ctx = useContext(NavBadgesContext);
  if (!ctx) throw new Error("useNavBadges must be used within NavBadgesProvider");
  return ctx;
}
