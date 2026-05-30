import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import Home from "@/pages/Home";
import Patient from "@/pages/Patient";

import Dashboard from "@/pages/Dashboard";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Home />} />
          <Route path="/p/:patientId" element={<Patient />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
