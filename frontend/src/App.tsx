import { useAutoDeviceBackup } from "./hooks/useAutoDeviceBackup";
import AppRouter from "./routes/AppRouter";

function App() {
  useAutoDeviceBackup();
  return <AppRouter />;
}

export default App;
