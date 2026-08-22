import { useAutoDeviceBackup } from "./hooks/useAutoDeviceBackup";
import { AppUpdateProvider } from "./components/common/AppUpdateProvider";
import AppRouter from "./routes/AppRouter";

function App() {
  useAutoDeviceBackup();
  return (
    <AppUpdateProvider>
      <AppRouter />
    </AppUpdateProvider>
  );
}

export default App;
