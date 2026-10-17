import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  Filter,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { ActionItem } from '../../types/index.ts';

export const ActionsView: React.FC = () => {
  const { currentUser, departments, users, globalSearch } = useAuth();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);

  // Workflow submission modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitDetails, setSubmitDetails] = useState('');
  const [submitEvidence, setSubmitEvidence] = useState('');

  // Workflow review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<'Approved' | 'Returned'>('Approved');
  const [reviewComments, setReviewComments] = useState('');
  const [verificationEvidence, setVerificationEvidence] = useState('');

  // Reopen modal state
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Create form state
  const [createFinding, setCreateFinding] = useState('');
  const [createActionText, setCreateActionText] = useState('');
  const [createType, setCreateType] = useState<'Corrective' | 'Preventive' | 'Improvement'>('Corrective');
  const [createDeptId, setCreateDeptId] = useState('');
  const [createRpId, setCreateRpId] = useState('');
  const [createPriority, setCreatePriority] = useState('Medium');
  const [createTargetDate, setCreateTargetDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );

  const loadActions = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (selectedDept) params.departmentId = selectedDept;
      if (selectedPriority) params.priority = selectedPriority;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedSource) params.sourceModule = selectedSource;
      if (onlyOverdue) params.isOverdue = 'true';
      if (globalSearch) params.search = globalSearch;

      const data = await api.getActions(params);
      setActions(data);
    } catch (err) {
      console.error('Failed to load actions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, [selectedDept, selectedPriority, selectedStatus, selectedSource, onlyOverdue, globalSearch]);

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFinding || !createActionText || !createDeptId || !createRpId || !createTargetDate) {
      alert('Please fill all mandatory fields.');
      return;
    }

    try {
      await api.createAction({
        observationFinding: createFinding,
        recommendedAction: createActionText,
        actionType: createType,
        responsibleDepartmentId: createDeptId,
        responsiblePersonId: createRpId,
        responsibleGroupLeaderId: currentUser?.role === 'rgl' || currentUser?.role === 'admin' ? currentUser.id : undefined,
        priority: createPriority,
        targetDate: createTargetDate,
        sourceModule: 'General',
      });

      setShowCreateModal(false);
      setCreateFinding('');
      setCreateActionText('');
      await loadActions();
      alert('CAPA action created successfully with unique Action ID!');
    } catch (err: any) {
      alert('Failed to create action: ' + err.message);
    }
  };

  const handleStartAction = async (action: ActionItem) => {
    try {
      await api.startAction(action.id);
      await loadActions();
      if (selectedAction?.id === action.id) {
        const updated = await api.getActionDetails(action.id);
        setSelectedAction(updated);
      }
      alert('Action marked In Progress.');
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleSubmitAction = async () => {
    if (!selectedAction || !submitDetails.trim()) {
      alert('Detailed implementation notes (RP Action Details) are mandatory before submission.');
      return;
    }

    try {
      await api.submitAction(selectedAction.id, {
        rpActionDetails: submitDetails,
        completionEvidence: submitEvidence,
      });

      setShowSubmitModal(false);
      setSubmitDetails('');
      setSubmitEvidence('');
      const updated = await api.getActionDetails(selectedAction.id);
      setSelectedAction(updated);
      await loadActions();
      alert('Action submitted for RGL verification successfully!');
    } catch (err: any) {
      alert('Submission error: ' + err.message);
    }
  };

  const handleReviewAction = async () => {
    if (!selectedAction) return;
    if (reviewDecision === 'Returned' && !reviewComments.trim()) {
      alert('Mandatory review comments are required when returning an action for correction.');
      return;
    }

    try {
      await api.reviewAction(selectedAction.id, {
        decision: reviewDecision,
        rglReviewComments: reviewComments,
        verificationEvidence,
      });

      setShowReviewModal(false);
      setReviewComments('');
      setVerificationEvidence('');
      const updated = await api.getActionDetails(selectedAction.id);
      setSelectedAction(updated);
      await loadActions();
      alert(
        reviewDecision === 'Approved'
          ? 'Action formally verified and closed!'
          : 'Action returned to RP for correction.'
      );
    } catch (err: any) {
      alert('Review error: ' + err.message);
    }
  };

  const handleReopenAction = async () => {
    if (!selectedAction || !reopenReason.trim()) {
      alert('Mandatory reason is required to reopen a closed action.');
      return;
    }

    try {
      await api.reopenAction(selectedAction.id, reopenReason);
      setShowReopenModal(false);
      setReopenReason('');
      const updated = await api.getActionDetails(selectedAction.id);
      setSelectedAction(updated);
      await loadActions();
      alert('Action reopened and recorded in tamper-resistant audit trail.');
    } catch (err: any) {
      alert('Reopen error: ' + err.message);
    }
  };

  const statusBadge = (status: string, isOverdue?: boolean) => {
    if (isOverdue && status !== 'Closed') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
          <AlertOctagon className="w-3 h-3" />
          <span>OVERDUE</span>
        </span>
      );
    }
    const map: Record<string, string> = {
      Open: 'bg-slate-800 text-slate-300 border-slate-700',
      'In Progress': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      'Submitted for Review': 'bg-sky-500/10 text-sky-300 border-sky-500/30',
      'Returned for Correction': 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      Closed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${map[status] || map.Open}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span>Central Corrective & Preventive Action (CAPA) Tracker</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Universal action engine shared across Incidents, Inspections, Hazards, Meetings, Drills, and Standalone findings
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New CAPA Action</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter Actions:</span>
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>

        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Modules</option>
          <option value="Incident">Incident Investigation</option>
          <option value="Inspection">HSE Inspection</option>
          <option value="Hazard">Hazard Report</option>
          <option value="Meeting">EHS Meeting</option>
          <option value="Drill">Emergency Drill</option>
          <option value="General">Standalone CAPA</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Submitted for Review">Submitted for Review</option>
          <option value="Returned for Correction">Returned for Correction</option>
          <option value="Closed">Closed</option>
        </select>

        <label className="flex items-center gap-2 text-slate-300 cursor-pointer bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg select-none">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOnlyOverdue(e.target.checked)}
            className="rounded text-rose-500 focus:ring-rose-500"
          />
          <span className="font-semibold text-rose-400">Overdue Items Only</span>
        </label>

        <button
          onClick={loadActions}
          className="ml-auto p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Refresh actions"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Actions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Action ID</th>
                <th className="py-3 px-4">Source Reference</th>
                <th className="py-3 px-4">Finding & Required Action</th>
                <th className="py-3 px-4">Responsible Person</th>
                <th className="py-3 px-4">Group Leader (RGL)</th>
                <th className="py-3 px-4">Target Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {actions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No CAPA actions found matching active filters.
                  </td>
                </tr>
              ) : (
                actions.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{act.actionId}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300 mr-1.5">
                        {act.sourceModule}
                      </span>
                      <span className="font-mono text-slate-400 text-[11px]">{act.sourceRecordId}</span>
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-semibold text-white truncate">{act.recommendedAction}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{act.observationFinding}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-200">
                      {act.responsiblePerson?.fullName || 'RP'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {act.responsibleGroupLeader?.fullName || 'RGL'}
                    </td>
                    <td className="py-3 px-4">
                      <div className={`font-mono ${act.isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                        {act.targetDate}
                      </div>
                      {act.isOverdue && (
                        <div className="text-[10px] text-rose-400 font-bold">
                          +{act.overdueDays} days overdue
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">{statusBadge(act.status, act.isOverdue)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedAction(act)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Manage</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACTION DETAILS & WORKFLOW MODAL */}
      {selectedAction && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-6">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-extrabold text-emerald-400">
                  {selectedAction.actionId}
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-xs text-slate-400">
                  Source: {selectedAction.sourceModule} ({selectedAction.sourceRecordId})
                </span>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(selectedAction.status, selectedAction.isOverdue)}
                <button
                  onClick={() => setSelectedAction(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs text-slate-300">
              {/* Overdue Warning Alert */}
              {selectedAction.isOverdue && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/50 rounded-xl flex items-center gap-3 text-rose-300">
                  <AlertOctagon className="w-5 h-5 flex-shrink-0 text-rose-400 animate-pulse" />
                  <div>
                    <div className="font-bold text-xs uppercase">Action is Overdue by {selectedAction.overdueDays} Days</div>
                    <div className="text-[11px] text-rose-300/80">
                      Target deadline ({selectedAction.targetDate}) has passed. Escalation level: {selectedAction.escalationLevel}. Reminders logged.
                    </div>
                  </div>
                </div>
              )}

              {/* Action Specification */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Recommended Action</span>
                  <div className="font-semibold text-white mt-0.5">{selectedAction.recommendedAction}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Originating Finding</span>
                  <div className="font-medium text-slate-300 mt-0.5">{selectedAction.observationFinding}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Responsible Person (RP)</span>
                  <div className="font-medium text-slate-200 mt-0.5">
                    {selectedAction.responsiblePerson?.fullName} ({selectedAction.responsiblePerson?.email})
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Reviewing Group Leader (RGL)</span>
                  <div className="font-medium text-slate-200 mt-0.5">
                    {selectedAction.responsibleGroupLeader?.fullName} ({selectedAction.responsibleGroupLeader?.email})
                  </div>
                </div>
              </div>

              {/* RP Completion Section */}
              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-sky-400" />
                  <span>Responsible Person Implementation & Evidence</span>
                </span>
                <div className="text-xs text-slate-300">
                  {selectedAction.rpActionDetails ? (
                    <div>{selectedAction.rpActionDetails}</div>
                  ) : (
                    <span className="italic text-slate-500">No implementation notes entered yet.</span>
                  )}
                </div>
                {selectedAction.completionEvidence && (
                  <div className="pt-2 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Evidence:</span> {selectedAction.completionEvidence}
                  </div>
                )}
                {selectedAction.rpSubmissionDate && (
                  <div className="text-[10px] text-slate-500">Submitted on: {selectedAction.rpSubmissionDate}</div>
                )}
              </div>

              {/* RGL Review & Closure Section */}
              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span>RGL Verification & Closure Decision</span>
                </span>
                <div className="text-xs text-slate-300">
                  {selectedAction.rglReviewComments ? (
                    <div>{selectedAction.rglReviewComments}</div>
                  ) : (
                    <span className="italic text-slate-500">Pending supervisory review.</span>
                  )}
                </div>
                {selectedAction.closureDate && (
                  <div className="pt-1 text-[11px] text-emerald-400 font-semibold">
                    Closed on: {selectedAction.closureDate}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Workflow Actions Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400">
                Current Role: <span className="font-bold text-white uppercase">{currentUser?.role}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* RP Actions */}
                {selectedAction.status === 'Open' && (
                  <button
                    onClick={() => handleStartAction(selectedAction)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold text-xs transition-colors"
                  >
                    Mark In Progress
                  </button>
                )}

                {(selectedAction.status === 'Open' ||
                  selectedAction.status === 'In Progress' ||
                  selectedAction.status === 'Returned for Correction') && (
                  <button
                    onClick={() => {
                      setSubmitDetails(selectedAction.rpActionDetails || '');
                      setSubmitEvidence(selectedAction.completionEvidence || '');
                      setShowSubmitModal(true);
                    }}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-xs shadow-sm transition-colors"
                  >
                    Submit for Review
                  </button>
                )}

                {/* RGL Approval Gate */}
                {(currentUser?.role === 'admin' || currentUser?.role === 'rgl') &&
                  selectedAction.status === 'Submitted for Review' && (
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs shadow-sm transition-colors"
                    >
                      RGL Decision & Close
                    </button>
                  )}

                {/* Reopen Action (Admin / RGL only) */}
                {selectedAction.status === 'Closed' &&
                  (currentUser?.role === 'admin' || currentUser?.role === 'rgl') && (
                    <button
                      onClick={() => setShowReopenModal(true)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reopen Action</span>
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RP SUBMIT ACTION MODAL */}
      {showSubmitModal && selectedAction && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400" />
              <span>Submit CAPA Implementation for Review</span>
            </h3>
            <p className="text-xs text-slate-400">
              Enter implementation details and completion evidence for {selectedAction.actionId}.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">RP Action Details (Mandatory) *</label>
                <textarea
                  rows={3}
                  required
                  value={submitDetails}
                  onChange={(e) => setSubmitDetails(e.target.value)}
                  placeholder="Detail the mechanical fix, engineering control, or procedure update completed..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Completion Evidence / Reference</label>
                <input
                  type="text"
                  value={submitEvidence}
                  onChange={(e) => setSubmitEvidence(e.target.value)}
                  placeholder="e.g. Work Order #4928, Inspection photo DOC-2026-000004"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAction}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold"
              >
                Submit for RGL Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RGL REVIEW & APPROVAL MODAL */}
      {showReviewModal && selectedAction && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>RGL Verification & Approval</span>
            </h3>
            <p className="text-xs text-slate-400">
              Verify evidence and decide closure for {selectedAction.actionId}.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Decision *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="rglDecision"
                      value="Approved"
                      checked={reviewDecision === 'Approved'}
                      onChange={() => setReviewDecision('Approved')}
                    />
                    <span className="text-emerald-400 font-semibold">Approve & Close</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="rglDecision"
                      value="Returned"
                      checked={reviewDecision === 'Returned'}
                      onChange={() => setReviewDecision('Returned')}
                    />
                    <span className="text-rose-400 font-semibold">Return for Correction</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">
                  {reviewDecision === 'Returned' ? 'Mandatory Correction Comments *' : 'RGL Review Comments'}
                </label>
                <textarea
                  rows={3}
                  required={reviewDecision === 'Returned'}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder={
                    reviewDecision === 'Returned'
                      ? 'Explain what is missing from the evidence or fix...'
                      : 'Verified physical installation on-site. Work meets engineering safety standard.'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              {reviewDecision === 'Approved' && (
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Verification Evidence Note</label>
                  <input
                    type="text"
                    value={verificationEvidence}
                    onChange={(e) => setVerificationEvidence(e.target.value)}
                    placeholder="e.g. Visual inspection signed by Marcus Vance"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewAction}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
              >
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REOPEN MODAL */}
      {showReopenModal && selectedAction && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Reopen Closed CAPA Action</span>
            </h3>
            <p className="text-xs text-slate-400">
              Reopening requires mandatory justification and will be preserved in the audit log.
            </p>

            <div className="space-y-1 text-xs">
              <label className="text-slate-300 font-semibold">Reopen Reason *</label>
              <textarea
                rows={3}
                required
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Reason for reopening (e.g. Subsequent inspection revealed recurrence of vibration)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReopenModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleReopenAction}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE STANDALONE CAPA MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Create Central Corrective Action (CAPA)
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAction} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Observation / Finding *</label>
                <textarea
                  rows={2}
                  required
                  value={createFinding}
                  onChange={(e) => setCreateFinding(e.target.value)}
                  placeholder="Describe the identified hazard or non-conformity..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Recommended Action *</label>
                <textarea
                  rows={2}
                  required
                  value={createActionText}
                  onChange={(e) => setCreateActionText(e.target.value)}
                  placeholder="Action to prevent recurrence..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Responsible Department *</label>
                  <select
                    required
                    value={createDeptId}
                    onChange={(e) => setCreateDeptId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
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
                  <label className="text-slate-300 font-semibold">Responsible Person (RP) *</label>
                  <select
                    required
                    value={createRpId}
                    onChange={(e) => setCreateRpId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="">Select Assignee</option>
                    {users
                      .filter((u) => u.role === 'rp' || u.role === 'admin')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.role.toUpperCase()})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Priority</label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Target Completion Date *</label>
                  <input
                    type="date"
                    required
                    value={createTargetDate}
                    onChange={(e) => setCreateTargetDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
                >
                  Create Action Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
