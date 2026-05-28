import { useState } from "react";
import { getToken, clearToken } from "@/lib/api";
import LoginScreen from "./components/LoginScreen";
import HomeScreen from "./components/HomeScreen";
import PatientSearchScreen from "./components/PatientSearchScreen";
import ActiveSessionScreen from "./components/ActiveSessionScreen";
import PatientHistoryScreen from "./components/PatientHistoryScreen";
import PatientDetailScreen from "./components/PatientDetailScreen";
import SessionDetailScreen from "./components/SessionDetailScreen";
import DesktopLayout from "./components/DesktopLayout";
import LayoutSwitcher from "./components/LayoutSwitcher";

type Screen =
  | "login"
  | "home"
  | "patient-search"
  | "active-session"
  | "patient-history"
  | "patient-detail"
  | "session-detail"
  | "desktop";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() =>
    getToken() ? "home" : "login"
  );
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const handleLogin = () => {
    setCurrentScreen(isDesktop ? "desktop" : "home");
  };

  const handleLogout = () => {
    clearToken();
    setCurrentScreen("login");
  };

  const toggleLayout = () => {
    const next = !isDesktop;
    setIsDesktop(next);
    if (currentScreen !== "login") setCurrentScreen(next ? "desktop" : "home");
  };

  const selectPatientForSession = (id: string, name: string) => {
    setSelectedPatient({ id, name });
    setCurrentScreen("active-session");
  };

  const selectPatientForHistory = (id: string, name: string) => {
    setSelectedPatient({ id, name });
    setCurrentScreen("patient-detail");
  };

  const openSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setCurrentScreen("session-detail");
  };

  return (
    <div className="size-full">
      {currentScreen !== "login" && (
        <LayoutSwitcher isDesktop={isDesktop} onToggle={toggleLayout} />
      )}

      {currentScreen === "login" && <LoginScreen onLogin={handleLogin} />}

      {currentScreen === "desktop" && <DesktopLayout />}

      {currentScreen === "home" && (
        <HomeScreen
          onNewSession={() => setCurrentScreen("patient-search")}
          onPatientHistory={() => setCurrentScreen("patient-history")}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === "patient-search" && (
        <PatientSearchScreen
          onSelectPatient={selectPatientForSession}
          onBack={() => setCurrentScreen("home")}
        />
      )}

      {currentScreen === "active-session" && selectedPatient && (
        <ActiveSessionScreen
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
          onSaveClose={() => setCurrentScreen("patient-detail")}
          onBack={() => setCurrentScreen("patient-search")}
        />
      )}

      {currentScreen === "patient-history" && (
        <PatientHistoryScreen
          onSelectPatient={selectPatientForHistory}
          onBack={() => setCurrentScreen("home")}
        />
      )}

      {currentScreen === "patient-detail" && selectedPatient && (
        <PatientDetailScreen
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
          onSelectSession={openSession}
          onBack={() => setCurrentScreen("patient-history")}
        />
      )}

      {currentScreen === "session-detail" && selectedSessionId && (
        <SessionDetailScreen
          sessionId={selectedSessionId}
          onBack={() => setCurrentScreen("patient-detail")}
        />
      )}
    </div>
  );
}
