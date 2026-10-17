import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  ClipboardList,
  Download,
  FileSearch,
  FileSpreadsheet,
  FolderOpen,
  History,
  Layers,
  LifeBuoy,
  Settings,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { InstallModal } from '../common/InstallModal.tsx';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, unreadCount, organization } = useAuth();
  const [showInstallModal, setShowInstallModal] = useState(false);

  const navigationItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: Activity },
    { id: 'incidents', label: 'Incident Management', icon: ShieldAlert },
    { id: 'investigations', label: 'Incident Investigations', icon: FileSearch },
    { id: 'actions', label: 'CAPA Action Tracker', icon: CheckSquare },
    { id: 'hazards', label: 'Hazard Reporting & Matrix', icon: AlertTriangle },
    { id: 'hazard-register', label: 'Hazard Register', icon: Layers },
    { id: 'hazard-import', label: 'Hazard Register Import', icon: FileSpreadsheet },
    { id: 'inspections', label: 'HSE Inspections & Audits', icon: ClipboardList },
    { id: 'meetings', label: 'Meetings & Minutes', icon: Calendar },
    { id: 'trainings', label: 'Training Management', icon: Award },
    { id: 'drills', label: 'Emergency Drills', icon: LifeBuoy },
    { id: 'reports', label: 'Reports & Analytics', icon: FileSpreadsheet },
    { id: 'documents', label: 'Document Repository', icon: FolderOpen },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'users', label: 'User & Role Access', icon: Users },
    { id: 'settings', label: 'Organization Settings', icon: Settings },
    { id: 'audit', label: 'Audit Trail', icon: History },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 min-h-screen text-slate-300">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center gap-3 border-b border-slate-800 bg-slate-950/60">
        <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-900/30">
          <Shield className="w-5 h-5" />
        </div>
        <div className="overflow-hidden">
          <h1 className="font-bold text-sm text-white tracking-wide truncate">
            {organization?.name || 'Apex EHS'}
          </h1>
          <p className="text-[11px] text-emerald-400 font-medium tracking-wider uppercase">
            EHS Management
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-sm select-none">
        <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Operational Modules
        </div>
        {navigationItems.slice(0, 9).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors font-medium text-xs ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'hover:bg-slate-800 hover:text-slate-100 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-500 text-white font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-3 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Intelligence & Governance
        </div>
        {navigationItems.slice(9).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors font-medium text-xs ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'hover:bg-slate-800 hover:text-slate-100 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-500 text-white font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Industrial Safety Status Banner */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-medium">Compliance State</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ACTIVE
          </span>
        </div>
        <div className="text-[10px] text-slate-500 truncate">
          DB: Cloud SQL PostgreSQL (Dev)
        </div>

        <button
          onClick={() => setShowInstallModal(true)}
          className="w-full mt-2.5 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/25 text-[11px] font-semibold transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download & Install App</span>
        </button>
      </div>

      <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </aside>
  );
};
