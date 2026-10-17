import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { IncidentsView } from './components/incidents/IncidentsView.tsx';
import { ActionsView } from './components/actions/ActionsView.tsx';
import { InspectionsView } from './components/inspections/InspectionsView.tsx';
import { HazardsView } from './components/hazards/HazardsView.tsx';
import { MeetingsView } from './components/meetings/MeetingsView.tsx';
import { TrainingsView } from './components/trainings/TrainingsView.tsx';
import { DrillsView } from './components/drills/DrillsView.tsx';
import { ReportsView } from './components/reports/ReportsView.tsx';
import { DocumentsView } from './components/documents/DocumentsView.tsx';
import { UsersView } from './components/users/UsersView.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { AuditView } from './components/audit/AuditView.tsx';
import { ToastProvider, showGlobalToast } from './context/ToastContext.tsx';

const AppContent: React.FC = () => {
  const { activeTab, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Initializing Industrial EHS Management System...
          </span>
        </div>
      </div>
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'incidents':
      case 'investigations':
        return <IncidentsView />;
      case 'actions':
      case 'notifications':
        return <ActionsView />;
      case 'hazards':
      case 'hazard-register':
      case 'hazard-import':
        return <HazardsView />;
      case 'inspections':
        return <InspectionsView />;
      case 'meetings':
        return <MeetingsView />;
      case 'trainings':
        return <TrainingsView />;
      case 'drills':
        return <DrillsView />;
      case 'reports':
        return <ReportsView />;
      case 'documents':
        return <DocumentsView />;
      case 'users':
        return <UsersView />;
      case 'settings':
        return <SettingsView />;
      case 'audit':
        return <AuditView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans antialiased text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-slate-950/90">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};

// Ensure browser alerts gracefully map to in-app toasts
if (typeof window !== 'undefined') {
  window.alert = (msg?: any) => {
    showGlobalToast(String(msg || ''), 'info');
  };
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
