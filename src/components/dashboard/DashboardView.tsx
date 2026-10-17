import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  LifeBuoy,
  Plus,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';

export const DashboardView: React.FC = () => {
  const { organization, setActiveTab } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardAnalytics();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <Clock className="w-5 h-5 animate-spin text-emerald-500" />
          <span>Loading industrial EHS telemetry...</span>
        </div>
      </div>
    );
  }

  const { metrics, distributions } = data;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Executive EHS Performance Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time safety indicators, statutory OSHA/ISO rate computations, and CAPA resolution tracking
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('incidents')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Report Incident</span>
          </button>
          <button
            onClick={() => setActiveTab('hazards')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Report Hazard</span>
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open Actions</span>
          </button>
        </div>
      </div>

      {/* Top Level Safety KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TRIR Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              TRIR (OSHA Rate)
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{metrics.trir}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Based on {organization?.totalHoursWorked?.toLocaleString() || '750,000'} man-hours worked
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between">
            <span>Recordable injuries: {metrics.recordableInjuries}</span>
            <span>OSHA Multiplier: 200k</span>
          </div>
        </div>

        {/* LTIFR Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              LTIFR (ISO Rate)
            </span>
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{metrics.ltifr}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Lost Time Injuries: {metrics.lostTimeInjuries}
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between">
            <span>ISO standard multiplier: 1,000,000</span>
          </div>
        </div>

        {/* CAPA Closure Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              CAPA Closure Rate
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">{metrics.actionClosureRate}%</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics.closedActions} of {metrics.totalActions} actions resolved
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between">
            <span>Open: {metrics.openActions}</span>
            <span className="text-amber-400">Review pending: {metrics.actionsAwaitingReview}</span>
          </div>
        </div>

        {/* Overdue Actions Alert */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Overdue Actions
            </span>
            <span className={`p-1.5 rounded-lg ${metrics.overdueActions > 0 ? 'bg-rose-500/10 text-rose-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <div className={`text-3xl font-extrabold mt-2 ${metrics.overdueActions > 0 ? 'text-rose-400' : 'text-white'}`}>
            {metrics.overdueActions}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics.overdueActions > 0 ? 'Escalations notified to RGL / Dept' : 'All CAPA within target deadline'}
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between">
            <button
              onClick={() => setActiveTab('actions')}
              className="text-emerald-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>View overdue register</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">Total Incidents</div>
          <div className="text-xl font-bold text-white mt-1">{metrics.totalIncidents}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{metrics.nearMisses} Near Misses</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">Investigations</div>
          <div className="text-xl font-bold text-amber-300 mt-1">{metrics.openInvestigations}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{metrics.investigationsAwaitingApproval} awaiting RGL</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">HSE Inspections</div>
          <div className="text-xl font-bold text-white mt-1">{metrics.completedInspections}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{metrics.totalObservationsCount} observations</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">High Risk Findings</div>
          <div className="text-xl font-bold text-rose-400 mt-1">{metrics.highRiskObservations}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Critical hazards flagged</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">Training Completed</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{metrics.completedTrainings}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{metrics.trainingCompletionRate}% pass rate</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">Emergency Drills</div>
          <div className="text-xl font-bold text-white mt-1">{metrics.completedDrills}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{metrics.plannedDrills} scheduled total</div>
        </div>
      </div>

      {/* Analytical Breakdown Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Incident Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Department Safety Incident Breakdown
            </h3>
            <span className="text-[10px] text-slate-500">Live database counts</span>
          </div>

          <div className="mt-4 space-y-3">
            {Object.entries(distributions.incidentsByDepartment).length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">No departmental events recorded yet.</div>
            ) : (
              Object.entries(distributions.incidentsByDepartment).map(([dept, count]: any) => {
                const total = Math.max(1, metrics.totalIncidents);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{dept}</span>
                      <span className="text-slate-400">{count} events ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Incident Type Classification Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Incident Classification Distribution
            </h3>
            <span className="text-[10px] text-slate-500">Severity & Category</span>
          </div>

          <div className="mt-4 space-y-3">
            {Object.entries(distributions.incidentsByType).length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">No classified events recorded yet.</div>
            ) : (
              Object.entries(distributions.incidentsByType).map(([type, count]: any) => {
                const total = Math.max(1, metrics.totalIncidents);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{type}</span>
                      <span className="text-slate-400">{count} events ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
