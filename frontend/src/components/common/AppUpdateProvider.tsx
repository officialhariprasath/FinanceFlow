import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAppUpdate } from "../../hooks/useAppUpdate";
import AppUpdateModal from "./AppUpdateModal";

type AppUpdateContextValue = ReturnType<typeof useAppUpdate>;

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const value = useAppUpdate();

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
      {value.update ? (
        <AppUpdateModal
          versionName={value.update.versionName}
          notes={value.update.notes}
          force={value.update.force}
          installing={value.installing}
          progress={value.progress}
          error={value.error}
          onUpdate={() => {
            void value.installUpdate();
          }}
          onLater={value.dismiss}
        />
      ) : null}
    </AppUpdateContext.Provider>
  );
}

export function useAppUpdateContext() {
  const ctx = useContext(AppUpdateContext);
  if (!ctx) {
    throw new Error("useAppUpdateContext must be used inside AppUpdateProvider");
  }
  return ctx;
}
