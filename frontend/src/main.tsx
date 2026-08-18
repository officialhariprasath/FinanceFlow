import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { ToastProvider } from "./context/ToastContext.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { NavBadgesProvider } from "./context/NavBadgesContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <NavBadgesProvider>
            <App />
          </NavBadgesProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
