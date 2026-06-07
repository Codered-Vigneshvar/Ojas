import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/lib/auth";
import Home from "@/pages/Home";
import Patient from "@/pages/Patient";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
  </div>
);

function ProtectedRoutes() {
  const { session, loading, passwordRecovery } = useAuth();

  if (loading) return <Spinner />;

  // User clicked a reset-password email link — force them to set a new password
  if (passwordRecovery) return <ResetPassword />;

  if (!session) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/patients" element={<Home />} />
      <Route path="/p/:patientId" element={<Patient />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LoginRoute() {
  const { session, loading, passwordRecovery } = useAuth();

  if (loading) return <Spinner />;
  if (passwordRecovery) return <ResetPassword />;
  if (session) return <Navigate to="/" replace />;

  return <Login />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/reset-password" element={<ResetPasswordRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Standalone reset-password route — always accessible so the email link lands here
function ResetPasswordRoute() {
  const { loading } = useAuth();
  if (loading) return <Spinner />;
  return <ResetPassword />;
}
