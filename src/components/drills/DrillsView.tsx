import React, { useEffect, useState } from 'react';
import { AlertOctagon, CheckSquare, Clock, Eye, LifeBuoy, Plus, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { EmergencyDrill } from '../../types/index.ts';

export const DrillsView: React.FC = () => {
  const { currentUser, locations, users } = useAuth();
  const [drills, setDrills] = useState<EmergencyDrill[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDrill, setSelectedDrill] = useState<EmergencyDrill | null>(null);
  const [drillActions, setDrillActions] = useState<any[]>([]);

  // Evaluation form state
  const [evalAlarmTime, setEvalAlarmTime] = useState('10:00');
  const [evalEvacStart, setEvalEvacStart] = useState('10:01');
  const [evalEvacComp, setEvalEvacComp] = useState('10:04');
  const [evalMusterComp, setEvalMusterComp] = useState('10:06');
  const [evalTotalMinutes, setEvalTotalMinutes] = useState(4);
  const [evalHeadcount, setEvalHeadcount] = useState(142);
  const [evalUnaccounted, setEvalUnaccounted] = useState(0);
  const [evalPerformance, setEvalPerformance] = useState<'Satisfactory' | 'Needs Improvement' | 'Unsatisfactory'>('Satisfactory');
  const [evalObservations, setEvalObservations] = useState('');
  const [evalFindings, setEvalFindings] = useState('');
  const [evalLessons, setEvalLessons] = useState('');

  // Action creation modal
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionDesc, setActionDesc] = useState('');
  const [actionRpId, setActionRpId] = useState('');

  // Create form state
  const [title, setTitle] = useState('');
  const [drillType, setDrillType] = useState('Fire Drill');
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [locId, setLocId] = useState('');
  const [scenario, setScenario] = useState('Simulated electrical fire in main substation with smoke generation in Assembly Hall 1');
  const [targetMinutes, setTargetMinutes] = useState(5);

  const loadDrills = async () => {
    try {
      setLoading(true);
      const data = await api.getDrills();
      setDrills(data);
    } catch (err) {
      console.error('Failed to load emergency drills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrills();
  }, []);

  const openDrill = async (d: EmergencyDrill) => {
    try {
      setSelectedDrill(d);
      const res = await api.getDrillDetails(d.id);
      setDrillActions(res.actions || []);
      setEvalAlarmTime(d.alarmActivationTime || '10:00');
      setEvalEvacStart(d.evacuationStartTime || '10:01');
      setEvalEvacComp(d.evacuationCompletionTime || '10:04');
      setEvalMusterComp(d.musterCompletionTime || '10:06');
      setEvalTotalMinutes(d.totalEvacuationMinutes || 4);
      setEvalHeadcount(d.participantCount || 140);
      setEvalUnaccounted(d.unaccountedCount || 0);
      setEvalPerformance(d.performanceEvaluation || 'Satisfactory');
      setEvalObservations(d.keyObservations || '');
      setEvalFindings(d.findings || '');
      setEvalLessons(d.lessonsLearned || '');
    } catch (err: any) {
      alert('Error fetching drill details: ' + err.message);
    }
  };

  const handleCreateDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !locId) {
      alert('Title and location required');
      return;
    }

    try {
      await api.createDrill({
        title,
        drillType,
        plannedDate,
        locationId: locId,
        scenarioDescription: scenario,
        targetEvacuationMinutes: targetMinutes,
      });

      setShowCreateModal(false);
      setTitle('');
      await loadDrills();
      alert('Emergency drill planned with unique Drill ID!');
    } catch (err: any) {
      alert('Error creating drill: ' + err.message);
    }
  };

  const handleSaveEvaluation = async () => {
    if (!selectedDrill) return;
    try {
      await api.evaluateDrill(selectedDrill.id, {
        actualDate: new Date().toISOString().split('T')[0],
        alarmActivationTime: evalAlarmTime,
        evacuationStartTime: evalEvacStart,
        evacuationCompletionTime: evalEvacComp,
        musterCompletionTime: evalMusterComp,
        totalEvacuationMinutes: evalTotalMinutes,
        participantCount: evalHeadcount,
        unaccountedCount: evalUnaccounted,
        performanceEvaluation: evalPerformance,
        keyObservations: evalObservations,
        findings: evalFindings,
        lessonsLearned: evalLessons,
        status: 'Evaluated',
      });

      alert('Drill evaluation metrics saved!');
      const res = await api.getDrillDetails(selectedDrill.id);
      setSelectedDrill(res.drill);
      await loadDrills();
    } catch (err: any) {
      alert('Evaluation error: ' + err.message);
    }
  };

  const handleCreateDrillAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrill || !actionDesc || !actionRpId) return;

    try {
      await api.createDrillAction(selectedDrill.id, {
        recommendedAction: actionDesc,
        responsiblePersonId: actionRpId,
      });

      setShowActionModal(false);
      setActionDesc('');
      const res = await api.getDrillDetails(selectedDrill.id);
      setDrillActions(res.actions || []);
      alert('CAPA action created from drill finding!');
    } catch (err: any) {
      alert('Action error: ' + err.message);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-rose-500" />
            <span>Emergency Preparedness & Drill Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Evacuation drill stopwatch benchmarks, muster verification, lessons learned, and CAPA resolution
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Plan Emergency Drill</span>
        </button>
      </div>

      {/* Drills Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Drill ID</th>
                <th className="py-3 px-4">Exercise Title & Type</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Planned Date</th>
                <th className="py-3 px-4">Evac Time vs Target</th>
                <th className="py-3 px-4">Performance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {drills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No emergency drills planned.
                  </td>
                </tr>
              ) : (
                drills.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-rose-400">{d.drillId}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{d.title}</div>
                      <div className="text-[11px] text-slate-400">{d.drillType}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{d.location?.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{d.plannedDate}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-white">{d.totalEvacuationMinutes || '-'} min</span>{' '}
                      <span className="text-[11px] text-slate-500">(Target: {d.targetEvacuationMinutes} min)</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.performanceEvaluation === 'Satisfactory'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {d.performanceEvaluation}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openDrill(d)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Evaluate & CAPA</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRILL EVALUATION & ACTION MODAL */}
      {selectedDrill && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-extrabold text-rose-400">{selectedDrill.drillId}</span>
                <span className="text-slate-500">|</span>
                <h3 className="text-sm font-bold text-white truncate max-w-lg">{selectedDrill.title}</h3>
              </div>
              <button onClick={() => setSelectedDrill(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-300">
              {/* Timing Stopwatch Metrics */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-400" />
                  <span>Execution Timelines & Evacuation Metrics</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 text-[10px]">Alarm Activation</label>
                    <input
                      type="text"
                      value={evalAlarmTime}
                      onChange={(e) => setEvalAlarmTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px]">Evacuation Start</label>
                    <input
                      type="text"
                      value={evalEvacStart}
                      onChange={(e) => setEvalEvacStart(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px]">Evacuation Complete</label>
                    <input
                      type="text"
                      value={evalEvacComp}
                      onChange={(e) => setEvalEvacComp(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px]">Total Evac Minutes</label>
                    <input
                      type="number"
                      value={evalTotalMinutes}
                      onChange={(e) => setEvalTotalMinutes(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px]">Muster Headcount</label>
                    <input
                      type="number"
                      value={evalHeadcount}
                      onChange={(e) => setEvalHeadcount(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px]">Persons Unaccounted For</label>
                    <input
                      type="number"
                      value={evalUnaccounted}
                      onChange={(e) => setEvalUnaccounted(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white mt-0.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-slate-400 text-[10px]">Performance Evaluation</label>
                    <select
                      value={evalPerformance}
                      onChange={(e: any) => setEvalPerformance(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white mt-0.5"
                    >
                      <option value="Satisfactory">Satisfactory (Within target thresholds)</option>
                      <option value="Needs Improvement">Needs Improvement</option>
                      <option value="Unsatisfactory">Unsatisfactory (Critical bottlenecks identified)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Qualitative Observations & Findings */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Key Observations & Crowd Flow</label>
                  <textarea
                    rows={2}
                    value={evalObservations}
                    onChange={(e) => setEvalObservations(e.target.value)}
                    placeholder="Assembly point crowding, audible alarm clarity..."
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Deficiencies / Findings Identified</label>
                  <textarea
                    rows={2}
                    value={evalFindings}
                    onChange={(e) => setEvalFindings(e.target.value)}
                    placeholder="Emergency exit door 4 latch stuck, secondary route unlit..."
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Lessons Learned</label>
                  <textarea
                    rows={2}
                    value={evalLessons}
                    onChange={(e) => setEvalLessons(e.target.value)}
                    placeholder="Floor wardens need higher-visibility vests..."
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  />
                </div>
              </div>

              {/* Linked Actions */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    <span>Traceable Corrective Actions from Drill ({drillActions.length})</span>
                  </h4>
                  <button
                    onClick={() => setShowActionModal(true)}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold"
                  >
                    + Create Drill Action
                  </button>
                </div>

                <div className="space-y-1.5">
                  {drillActions.length === 0 ? (
                    <div className="p-4 text-slate-500 text-center bg-slate-950/40 rounded-lg">
                      No corrective actions generated from this drill yet.
                    </div>
                  ) : (
                    drillActions.map((act) => (
                      <div key={act.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
                        <div>
                          <span className="font-mono font-bold text-rose-400 mr-2">{act.actionId}</span>
                          <span className="text-slate-200">{act.recommendedAction}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300">
                          {act.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
              <button
                onClick={handleSaveEvaluation}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs"
              >
                Save Evaluation Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE DRILL ACTION MODAL */}
      {showActionModal && selectedDrill && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Create CAPA Action from Drill Finding
            </h3>

            <form onSubmit={handleCreateDrillAction} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Recommended Corrective Action *</label>
                <textarea
                  rows={2}
                  required
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  placeholder="e.g. Overhaul panic hardware on Emergency Door #4..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Assign Responsible Person (RP) *</label>
                <select
                  required
                  value={actionRpId}
                  onChange={(e) => setActionRpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                >
                  <option value="">Select Assignee</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowActionModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-semibold"
                >
                  Create Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PLAN DRILL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Schedule Emergency Drill
            </h3>

            <form onSubmit={handleCreateDrill} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Drill Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Plant Alpha Full Site Chemical Spill & Evacuation Exercise"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Drill Scenario Type</label>
                  <select
                    value={drillType}
                    onChange={(e) => setDrillType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  >
                    <option value="Fire Drill">Fire Drill</option>
                    <option value="Evacuation Drill">Evacuation Drill</option>
                    <option value="Chemical Spill Drill">Chemical Spill Drill</option>
                    <option value="Medical Emergency Drill">Medical Emergency Drill</option>
                    <option value="Confined Space Rescue Drill">Confined Space Rescue Drill</option>
                    <option value="Emergency Shutdown Drill">Emergency Shutdown Drill</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Planned Date *</label>
                  <input
                    type="date"
                    required
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Location *</label>
                  <select
                    required
                    value={locId}
                    onChange={(e) => setLocId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  >
                    <option value="">Select Location</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Target Evacuation (Minutes)</label>
                  <input
                    type="number"
                    value={targetMinutes}
                    onChange={(e) => setTargetMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Scenario Narrative</label>
                <textarea
                  rows={2}
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-semibold"
                >
                  Schedule Drill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
