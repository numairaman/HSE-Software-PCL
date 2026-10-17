import React, { useEffect, useState } from 'react';
import { Filter, History, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { AuditEventItem } from '../../types/index.ts';

export const AuditView: React.FC = () => {
  const { globalSearch } = useAuth();
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

  const loadAudit = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (selectedModule) params.module = selectedModule;
      if (selectedAction) params.action = selectedAction;
      if (globalSearch) params.search = globalSearch;

      const data = await api.getAuditTrail(params);
      setAuditEvents(data);
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, [selectedModule, selectedAction, globalSearch]);

  const actionColor = (act: string) => {
    const map: Record<string, string> = {
      CREATE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      UPDATE: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      ASSIGN: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      SUBMIT: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      APPROVE: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      RETURN: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      CLOSE: 'bg-slate-700/50 text-slate-300 border-slate-600',
      REOPEN: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      ESCALATE: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      UPLOAD: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${map[act] || map.CREATE}`}>
        {act}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            <span>Tamper-Resistant Regulatory Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Immutable, append-only historical log of all business events, state changes, and supervisory reviews
          </p>
        </div>

        <button
          onClick={loadAudit}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Refresh Audit</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter Audit Events:</span>
        </div>

        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300"
        >
          <option value="">All Operational Modules</option>
          <option value="Incident Management">Incident Management</option>
          <option value="Incident Investigation">Incident Investigation</option>
          <option value="Central CAPA">Central CAPA</option>
          <option value="HSE Inspections">HSE Inspections</option>
          <option value="Hazard Reporting">Hazard Reporting</option>
          <option value="Meetings & Minutes">Meetings & Minutes</option>
          <option value="Training Management">Training Management</option>
          <option value="Emergency Drills">Emergency Drills</option>
          <option value="User Management">User Management</option>
          <option value="Organization Settings">Organization Settings</option>
        </select>

        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300"
        >
          <option value="">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="ASSIGN">ASSIGN</option>
          <option value="SUBMIT">SUBMIT</option>
          <option value="APPROVE">APPROVE</option>
          <option value="RETURN">RETURN</option>
          <option value="CLOSE">CLOSE</option>
          <option value="REOPEN">REOPEN</option>
          <option value="ESCALATE">ESCALATE</option>
          <option value="UPLOAD">UPLOAD</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Record ID</th>
                <th className="py-3 px-4">User & Role</th>
                <th className="py-3 px-4">Details & Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {auditEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No audit records matching query.
                  </td>
                </tr>
              ) : (
                auditEvents.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 truncate max-w-[150px]">
                      {new Date(a.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4">{actionColor(a.action)}</td>
                    <td className="py-3 px-4 font-sans text-slate-300">{a.module}</td>
                    <td className="py-3 px-4 font-bold text-emerald-400">{a.recordId}</td>
                    <td className="py-3 px-4 font-sans">
                      <div className="text-slate-200">{a.userEmail}</div>
                      <div className="text-[10px] text-slate-500 uppercase">{a.userRole}</div>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-300 max-w-md">
                      <div>{a.comments || '-'}</div>
                      {a.previousValues && a.newValues && (
                        <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                          Change: {a.previousValues} → {a.newValues}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
