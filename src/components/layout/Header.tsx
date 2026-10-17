import React, { useState } from 'react';
import {
  Bell,
  Clock,
  Download,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserCheck2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { InstallModal } from '../common/InstallModal.tsx';

export const Header: React.FC = () => {
  const {
    currentUser,
    users,
    switchUser,
    signInWithGoogle,
    logout,
    firebaseUser,
    unreadCount,
    notifications,
    setActiveTab,
    globalSearch,
    setGlobalSearch,
    refreshNotifications,
  } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [automationResult, setAutomationResult] = useState<string | null>(null);

  const handleRunReminders = async () => {
    try {
      setRunningAutomation(true);
      const res = await api.runReminders();
      setAutomationResult(
        `Overdue check complete: Processed ${res.actionsProcessed} actions, triggered ${res.escalatedCount} escalations.`
      );
      await refreshNotifications();
      setTimeout(() => setAutomationResult(null), 5000);
    } catch (err: any) {
      alert('Error triggering reminder engine: ' + err.message);
    } finally {
      setRunningAutomation(false);
    }
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    rgl: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    rp: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    viewer: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-slate-100 flex-shrink-0 z-10">
      {/* Global Search Bar */}
      <div className="flex items-center gap-3 w-96">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search Event ID, CAPA ACT-..., keywords..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Get / Install App Button */}
        <button
          onClick={() => setShowInstallModal(true)}
          title="Install as Desktop/Mobile App or Download Source Code ZIP"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Download / Install</span>
        </button>

        {/* Automated Overdue & Escalation trigger */}
        <button
          onClick={handleRunReminders}
          disabled={runningAutomation}
          title="Run Overdue Action Scanner & Escalation Engine"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
        >
          <Clock className={`w-3.5 h-3.5 ${runningAutomation ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
          <span>{runningAutomation ? 'Scanning...' : 'Scan Overdue'}</span>
        </button>

        {automationResult && (
          <div className="fixed top-20 right-6 bg-slate-950 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-lg text-xs shadow-xl z-50 animate-bounce">
            {automationResult}
          </div>
        )}

        {/* Role Simulator Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 hidden sm:inline">Active User:</span>
          <select
            value={currentUser?.id || ''}
            onChange={(e) => switchUser(Number(e.target.value))}
            className="bg-transparent text-xs text-emerald-300 font-medium focus:outline-none cursor-pointer"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                {u.fullName} ({u.role.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Notifications Icon with popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                <span className="text-[11px] text-slate-400">{unreadCount} unread</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        api.markNotificationRead(n.id).then(() => refreshNotifications());
                        if (n.recordType === 'action') setActiveTab('actions');
                        if (n.recordType === 'event') setActiveTab('incidents');
                        setShowNotifications(false);
                      }}
                      className={`p-3 text-xs hover:bg-slate-800/60 cursor-pointer transition-colors ${
                        !n.isRead ? 'bg-slate-800/40' : ''
                      }`}
                    >
                      <div className="font-semibold text-slate-200">{n.title}</div>
                      <p className="text-slate-400 mt-1 line-clamp-2 text-[11px]">{n.message}</p>
                      <div className="text-[10px] text-slate-500 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Current user role badge & Google Auth */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
              roleColors[currentUser?.role || 'rp']
            }`}
          >
            {currentUser?.role || 'RP'}
          </span>

          {firebaseUser ? (
            <button
              onClick={logout}
              title="Sign Out Google Account"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              title="Sign in with Google OAuth"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Google Login</span>
            </button>
          )}
        </div>
      </div>

      <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </header>
  );
};
