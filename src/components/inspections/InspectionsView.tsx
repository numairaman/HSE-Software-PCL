import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { InspectionEvent, InspectionObservation } from '../../types/index.ts';

export const InspectionsView: React.FC = () => {
  const { currentUser, departments, locations, users } = useAuth();
  const [inspections, setInspections] = useState<InspectionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<InspectionEvent | null>(null);
  const [observations, setObservations] = useState<InspectionObservation[]>([]);

  // Add observation modal state
  const [showAddObsModal, setShowAddObsModal] = useState(false);
  const [obsDescription, setObsDescription] = useState('');
  const [obsAction, setObsAction] = useState('');
  const [obsType, setObsType] = useState('Unsafe Condition');
  const [obsRisk, setObsRisk] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [obsRpId, setObsRpId] = useState('');
  const [autoCreateAction, setAutoCreateAction] = useState(true);

  // Create inspection state
  const [title, setTitle] = useState('');
  const [inspectionType, setInspectionType] = useState('Routine HSE Inspection');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [areaCovered, setAreaCovered] = useState('Production Floor & Chemical Storage');
  const [deptId, setDeptId] = useState('');
  const [locId, setLocId] = useState('');

  const loadInspections = async () => {
    try {
      setLoading(true);
      const data = await api.getInspections();
      setInspections(data);
    } catch (err) {
      console.error('Failed to load inspections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, []);

  const openInspection = async (insp: InspectionEvent) => {
    try {
      setSelectedInspection(insp);
      const res = await api.getInspectionDetails(insp.id);
      setObservations(res.observations || []);
    } catch (err: any) {
      alert('Error fetching details: ' + err.message);
    }
  };

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deptId || !locId) {
      alert('Mandatory fields required');
      return;
    }

    try {
      await api.createInspection({
        title,
        inspectionType,
        scheduledDate,
        areaCovered,
        departmentId: deptId,
        locationId: locId,
      });

      setShowCreateModal(false);
      setTitle('');
      await loadInspections();
      alert('HSE Inspection scheduled successfully with unique Inspection ID!');
    } catch (err: any) {
      alert('Create error: ' + err.message);
    }
  };

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInspection || !obsDescription || !obsAction) return;

    try {
      await api.addObservation(selectedInspection.id, {
        description: obsDescription,
        recommendedAction: obsAction,
        observationType: obsType,
        riskRating: obsRisk,
        responsiblePersonId: obsRpId || undefined,
        createAction: autoCreateAction,
      });

      setShowAddObsModal(false);
      setObsDescription('');
      setObsAction('');
      const res = await api.getInspectionDetails(selectedInspection.id);
      setObservations(res.observations || []);
      await loadInspections();
      alert('Observation recorded and linked to Central CAPA tracker!');
    } catch (err: any) {
      alert('Observation error: ' + err.message);
    }
  };

  const handleCompleteInspection = async () => {
    if (!selectedInspection) return;
    try {
      await api.completeInspection(selectedInspection.id, 'Inspection completed and signed off.');
      const res = await api.getInspectionDetails(selectedInspection.id);
      setSelectedInspection(res.inspection);
      await loadInspections();
      alert('Inspection marked Completed.');
    } catch (err: any) {
      alert('Error completing inspection: ' + err.message);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-sky-400" />
            <span>HSE Inspections & Audits</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Planned safety audits, checklists, multi-observation logging, and direct action conversion
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Inspection</span>
        </button>
      </div>

      {/* Inspections List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Inspection ID</th>
                <th className="py-3 px-4">Inspection Title & Type</th>
                <th className="py-3 px-4">Department & Area</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Observations</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No inspections recorded yet.
                  </td>
                </tr>
              ) : (
                inspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{insp.inspectionId}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{insp.title}</div>
                      <div className="text-[11px] text-slate-400">{insp.inspectionType}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{insp.department?.name}</div>
                      <div className="text-[11px] text-slate-500">{insp.areaCovered}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">{insp.scheduledDate}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-white">{insp.observationsCount || 0}</span> recorded
                      {(insp.highRiskCount || 0) > 0 && (
                        <span className="ml-1 text-[10px] text-rose-400 font-bold">
                          ({insp.highRiskCount} High Risk)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {insp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openInspection(insp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View / Log Obs</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECTION DETAILS & MULTI-OBSERVATION MODAL */}
      {selectedInspection && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-extrabold text-emerald-400">
                  {selectedInspection.inspectionId}
                </span>
                <span className="text-slate-500">|</span>
                <h3 className="text-sm font-bold text-white truncate max-w-lg">
                  {selectedInspection.title}
                </h3>
              </div>
              <button onClick={() => setSelectedInspection(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-300">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Type</span>
                  <div className="font-semibold text-slate-200 mt-0.5">{selectedInspection.inspectionType}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Area Covered</span>
                  <div className="font-semibold text-slate-200 mt-0.5">{selectedInspection.areaCovered}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Department</span>
                  <div className="font-semibold text-slate-200 mt-0.5">{selectedInspection.department?.name}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Status</span>
                  <div className="font-semibold text-emerald-400 mt-0.5">{selectedInspection.status}</div>
                </div>
              </div>

              {/* Observations Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Inspection Observations ({observations.length})</span>
                  </h4>
                  <button
                    onClick={() => setShowAddObsModal(true)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    + Add Observation
                  </button>
                </div>

                <div className="space-y-2">
                  {observations.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 bg-slate-950/40 rounded-xl">
                      No observations recorded yet. Click "+ Add Observation" to record findings.
                    </div>
                  ) : (
                    observations.map((obs) => (
                      <div key={obs.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-amber-400">{obs.observationId}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {obs.observationType} | Risk: {obs.riskRating}
                          </span>
                        </div>
                        <div className="font-medium text-slate-200">{obs.description}</div>
                        <div className="text-[11px] text-emerald-400">
                          Recommended Action: {obs.recommendedAction}
                        </div>
                        {obs.linkedActionId && (
                          <div className="text-[10px] text-sky-400 font-mono">
                            Linked Central CAPA Action Active
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
              {selectedInspection.status !== 'Completed' && (
                <button
                  onClick={handleCompleteInspection}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs"
                >
                  Sign Off & Complete Inspection
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD OBSERVATION MODAL */}
      {showAddObsModal && selectedInspection && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Record Inspection Observation
            </h3>

            <form onSubmit={handleAddObservation} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Observation Type *</label>
                <select
                  value={obsType}
                  onChange={(e) => setObsType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                >
                  <option value="Unsafe Condition">Unsafe Condition</option>
                  <option value="Unsafe Act">Unsafe Act</option>
                  <option value="Non-conformity">Non-conformity</option>
                  <option value="Good Practice">Good Practice</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Observation Description *</label>
                <textarea
                  rows={2}
                  required
                  value={obsDescription}
                  onChange={(e) => setObsDescription(e.target.value)}
                  placeholder="e.g. Fire extinguisher blocked by wooden pallets..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Recommended Corrective Action *</label>
                <textarea
                  rows={2}
                  required
                  value={obsAction}
                  onChange={(e) => setObsAction(e.target.value)}
                  placeholder="e.g. Clear pallet storage, apply yellow clearance box line..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Risk Rating</label>
                  <select
                    value={obsRisk}
                    onChange={(e: any) => setObsRisk(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Assign RP</label>
                  <select
                    value={obsRpId}
                    onChange={(e) => setObsRpId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  >
                    <option value="">Select Assignee</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoCreateAction}
                  onChange={(e) => setAutoCreateAction(e.target.checked)}
                />
                <span>Automatically convert into Central CAPA Action item</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddObsModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold"
                >
                  Save Observation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE INSPECTION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Schedule New HSE Inspection / Audit
            </h3>

            <form onSubmit={handleCreateInspection} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Inspection Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Plant Alpha Machine Safety Audit"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Inspection Type</label>
                  <select
                    value={inspectionType}
                    onChange={(e) => setInspectionType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  >
                    <option value="Routine HSE Inspection">Routine HSE Inspection</option>
                    <option value="Housekeeping Inspection">Housekeeping Inspection</option>
                    <option value="Fire Safety Inspection">Fire Safety Inspection</option>
                    <option value="Electrical Safety Inspection">Electrical Safety Inspection</option>
                    <option value="Machine Safety Inspection">Machine Safety Inspection</option>
                    <option value="Chemical Safety Inspection">Chemical Safety Inspection</option>
                    <option value="Internal EHS Audit">Internal EHS Audit</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Department *</label>
                  <select
                    required
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  >
                    <option value="">Select Dept</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
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
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Area / Lines Covered</label>
                <input
                  type="text"
                  value={areaCovered}
                  onChange={(e) => setAreaCovered(e.target.value)}
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
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold"
                >
                  Schedule Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
