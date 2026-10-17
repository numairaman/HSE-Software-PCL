import React, { useState } from 'react';
import { Building, MapPin, Save, Settings, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { api } from '../../services/api.ts';
import { UsersView } from '../users/UsersView.tsx';

export const SettingsView: React.FC = () => {
  const { organization, departments, locations, currentUser, users, refreshMasterData } = useAuth();
  const toast = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'org' | 'users'>('org');

  const [orgName, setOrgName] = useState(organization?.name || 'Apex Industrial Group');
  const [hoursWorked, setHoursWorked] = useState(organization?.totalHoursWorked || 750000);
  const [trirMult, setTrirMult] = useState(organization?.trirMultiplier || 200000);
  const [ltifrMult, setLtifrMult] = useState(organization?.ltifrMultiplier || 1000000);

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'admin') {
      toast.warning('Only Administrators can modify organization parameters.');
      return;
    }

    try {
      await api.updateOrganization({
        name: orgName,
        totalHoursWorked: Number(hoursWorked),
        trirMultiplier: Number(trirMult),
        ltifrMultiplier: Number(ltifrMult),
      });

      await refreshMasterData();
      toast.success('Organization parameters & calculation formulas updated successfully.');
    } catch (err: any) {
      toast.error('Error updating organization: ' + err.message);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Settings Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>System Settings & Governance</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure entity profile, statutory rate multipliers, and manage user accounts & role permissions
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('org')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'org'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Organization & Parameters</span>
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'users'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User & Role Access</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-bold border border-slate-700">
              {users.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 2: User & Role Access view directly inside settings */}
      {activeSubTab === 'users' ? (
        <div className="-mx-6 lg:-mx-8">
          <UsersView />
        </div>
      ) : (
        /* Tab 1: Organization Parameters & Master Facilities */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Organization Parameters */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Building className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white uppercase tracking-wider text-xs">
                Corporate Safety & Calculation Basis
              </h3>
            </div>

            <form onSubmit={handleSaveOrg} className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Organization Display Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Total Cumulative Hours Worked (Current Cycle)</label>
                <input
                  type="number"
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500">
                  Directly divides recordables and lost-time injuries in safety rate calculations.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">TRIR Multiplier (OSHA)</label>
                  <input
                    type="number"
                    value={trirMult}
                    onChange={(e) => setTrirMult(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500">Standard: 200,000</p>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">LTIFR Multiplier (ISO)</label>
                  <input
                    type="number"
                    value={ltifrMult}
                    onChange={(e) => setLtifrMult(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500">Standard: 1,000,000</p>
                </div>
              </div>

              {currentUser?.role === 'admin' && (
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Formula Parameters</span>
                </button>
              )}
            </form>
          </div>

          {/* Master Facilities & Departments */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <MapPin className="w-4 h-4 text-sky-400" />
              <h3 className="font-bold text-white uppercase tracking-wider text-xs">
                Active Industrial Facilities & Plants
              </h3>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {locations.map((loc) => (
                <div key={loc.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-white">{loc.name}</div>
                    <div className="text-[10px] text-slate-500">Type: {loc.locationType}</div>
                  </div>
                  <span className="font-mono text-sky-400 font-bold">{loc.code}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800">
              <h4 className="font-semibold text-white mb-2">Registered Departments</h4>
              <div className="flex flex-wrap gap-1.5">
                {departments.map((d) => (
                  <span key={d.id} className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
                    {d.name} ({d.code})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
