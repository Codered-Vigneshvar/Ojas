import { Home, Users, LogOut } from "lucide-react";
import { useState } from "react";
import HomeScreen from "./HomeScreen";
import PatientDetailScreen from "./PatientDetailScreen";
import PatientHistoryScreen from "./PatientHistoryScreen";
import SessionDetailScreen from "./SessionDetailScreen";

export default function DesktopLayout() {
  const [activeView, setActiveView] = useState<"home" | "patients" | "patient-detail" | "session-detail">("home");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(1);

  const patientNames: { [key: number]: string } = {
    1: "Vikram Sharma",
    2: "Anita Desai",
    3: "Rajesh Kumar",
    4: "Priya Patel",
    5: "Amit Singh",
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center">
            <h1 className="text-xl" style={{ fontFamily: 'Crimson Pro, serif' }}>DentAI</h1>
            <div className="w-1.5 h-1.5 rounded-full bg-primary ml-1"></div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveView("home")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeView === "home"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => setActiveView("patients")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeView === "patients" || activeView === "patient-detail" || activeView === "session-detail"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Patients</span>
          </button>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
              P
            </div>
            <div className="flex-1">
              <p className="text-sm">Dr. Priya</p>
              <p className="text-xs text-muted-foreground">Dentist</p>
            </div>
            <button className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {activeView === "home" && (
          <div className="max-w-4xl mx-auto">
            <HomeScreen
              onNewSession={() => {}}
              onPatientHistory={() => setActiveView("patients")}
            />
          </div>
        )}

        {activeView === "patients" && (
          <PatientHistoryScreen
            onSelectPatient={(id) => {
              setSelectedPatientId(id);
              setActiveView("patient-detail");
            }}
            onBack={() => setActiveView("home")}
          />
        )}

        {activeView === "patient-detail" && selectedPatientId && (
          <PatientDetailScreen
            patientName={patientNames[selectedPatientId]}
            onSelectSession={() => setActiveView("session-detail")}
            onBack={() => setActiveView("patients")}
          />
        )}

        {activeView === "session-detail" && (
          <SessionDetailScreen onBack={() => setActiveView("patient-detail")} />
        )}
      </div>
    </div>
  );
}
