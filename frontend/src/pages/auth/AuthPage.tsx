import { useState } from "react";
import { Navigate } from "react-router-dom";
import LoginForm from "../../components/forms/LoginForm";
import RegisterForm from "../../components/forms/RegisterForm";
import { useAuth } from "../../context/AuthContext";

function AuthPage() {
  const { isAuthenticated } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center text-blue-600">
          FINNECT Finance OS
        </h1>
        <p className="text-center text-gray-500 mt-2">Finance Management System</p>

        <div className="flex mt-8 border rounded-lg overflow-hidden">
          <button
            onClick={() => setIsLogin(true)}
            className={`w-1/2 py-3 font-semibold ${isLogin ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`w-1/2 py-3 font-semibold ${!isLogin ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
          >
            Register
          </button>
        </div>

        <div className="mt-8">
          {isLogin ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
