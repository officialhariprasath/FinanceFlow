import { useState } from "react";
import { Navigate } from "react-router-dom";
import LoginForm from "../../components/forms/LoginForm";
import RegisterForm from "../../components/forms/RegisterForm";
import { useAuth } from "../../context/AuthContext";
import { IS_AGENT_APP } from "../../config/api";

function AuthPage() {
  const { isAuthenticated } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const agentApp = IS_AGENT_APP;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="safe-top safe-bottom flex min-h-screen min-h-[100dvh] items-center justify-center bg-slate-100 p-4 dark:bg-slate-900">
      <div className="w-full max-w-md surface-card shadow-lg p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-blue-600">
          FinanceFlow
        </h1>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-slate-400 sm:text-base">
          {agentApp ? "Collection Agent App" : "Finance Management System"}
        </p>

        {!agentApp && (
          <div className="mt-6 flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600 sm:mt-8">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`w-1/2 py-3 text-sm font-semibold sm:text-base ${isLogin ? "bg-blue-600 text-white" : "bg-white text-gray-700 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-200"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`w-1/2 py-3 text-sm font-semibold sm:text-base ${!isLogin ? "bg-blue-600 text-white" : "bg-white text-gray-700 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-200"}`}
            >
              Register
            </button>
          </div>
        )}

        <div className={agentApp ? "mt-6" : "mt-8"}>
          {agentApp || isLogin ? <LoginForm agentOnly={agentApp} /> : <RegisterForm />}
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
