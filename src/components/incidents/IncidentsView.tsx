import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  FileSearch,
  FileSpreadsheet,
  Filter,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { ActionItem, EventItem, FindingItem, IncidentReport, WhyItem } from '../../types/index.ts';
import { IncidentImportModal } from './IncidentImportModal.tsx';

export const IncidentsView: React.FC = () => {
  const { currentUser, departments, locations, subLocations, users, globalSearch, setActiveTab } = useAuth();
  const [incidents, setIncidents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<EventItem | null>(null);
  const [incidentDetails, setIncidentDetails] = useState<{
    event: EventItem;
    investigationReport: IncidentReport | null;
    actions: ActionItem[];
  } | null>(null);

  // Assignment & Review modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignRpId, setAssignRpId] = useState<string>('');
  const [assignDueDate, setAssignDueDate] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<'Approved' | 'Returned'>('Approved');
  const [reviewComments, setReviewComments] = useState<string>('');

  // Investigation form state (for RP draft & submission)
  const [invSequence, setInvSequence] = useState('');
  const [invImmediateCauses, setInvImmediateCauses] = useState('');
  const [invContributingFactors, setInvContributingFactors] = useState('');
  const [invFailedControls, setInvFailedControls] = useState('');
  const [invFinalRootCause, setInvFinalRootCause] = useState('');
  const [invRootCauseCategory, setInvRootCauseCategory] = useState('Procedures & Compliance');
  const [whys, setWhys] = useState<WhyItem[]>(
    Array.from({ length: 10 }, (_, i) => ({ whyNumber: i + 1, question: '', answer: '', evidence: '' }))
  );
  const [findings, setFindings] = useState<FindingItem[]>([
    { findingRef: 'KF-01', description: '', evidence: '', significance: 'High', recommendedAction: '' },
    { findingRef: 'KF-02', description: '', evidence: '', significance: 'Medium', recommendedAction: '' },
  ]);

  // Create incident form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('Near Miss');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState('09:30');
  const [formDeptId, setFormDeptId] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
  const [formSubLocationId, setFormSubLocationId] = useState('');
  const [formCategory, setFormCategory] = useState('Safety');
  const [formActualConsequence, setFormActualConsequence] = useState('');
  const [formPotentialConsequence, setFormPotentialConsequence] = useState('');
  const [formImmediateActions, setFormImmediateActions] = useState('');
  const [formPersonsInvolved, setFormPersonsInvolved] = useState('');
  const [formWitnesses, setFormWitnesses] = useState('');
  const [formInjuryDetails, setFormInjuryDetails] = useState('');
  const [formInitialRisk, setFormInitialRisk] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [formPotentialRisk, setFormPotentialRisk] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('High');

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (selectedDept) params.departmentId = selectedDept;
      if (selectedType) params.eventType = selectedType;
      if (selectedStatus) params.status = selectedStatus;
      if (globalSearch) params.search = globalSearch;

      const data = await api.getIncidents(params);
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [selectedDept, selectedType, selectedStatus, globalSearch]);

  const openDetails = async (event: EventItem) => {
    try {
      setSelectedIncident(event);
      const details = await api.getIncidentDetails(event.id);
      setIncidentDetails(details);

      // Populate investigation editor state
      if (details.investigationReport) {
        const rep = details.investigationReport;
        setInvSequence(rep.sequenceOfEvents || '');
        setInvImmediateCauses(rep.immediateCauses || '');
        setInvContributingFactors(rep.contributingFactors || '');
        setInvFailedControls(rep.failedOrMissingControls || '');
        setInvFinalRootCause(rep.finalRootCause || '');
        setInvRootCauseCategory(rep.rootCauseCategory || 'Procedures & Compliance');

        // Whys (ensure 10 items)
        const loadedWhys = Array.from({ length: 10 }, (_, i) => {
          const found = rep.whys?.find((w: WhyItem) => w.whyNumber === i + 1);
          return found || { whyNumber: i + 1, question: '', answer: '', evidence: '' };
        });
        setWhys(loadedWhys);

        // Findings (ensure at least 2)
        if (rep.findings && rep.findings.length > 0) {
          setFindings(rep.findings);
        } else {
          setFindings([
            { findingRef: 'KF-01', description: '', evidence: '', significance: 'High', recommendedAction: '' },
            { findingRef: 'KF-02', description: '', evidence: '', significance: 'Medium', recommendedAction: '' },
          ]);
        }
      } else {
        // Reset to empty
        setInvSequence('');
        setInvImmediateCauses('');
        setInvContributingFactors('');
        setInvFailedControls('');
        setInvFinalRootCause('');
        setWhys(Array.from({ length: 10 }, (_, i) => ({ whyNumber: i + 1, question: '', answer: '', evidence: '' })));
        setFindings([
          { findingRef: 'KF-01', description: '', evidence: '', significance: 'High', recommendedAction: '' },
          { findingRef: 'KF-02', description: '', evidence: '', significance: 'Medium', recommendedAction: '' },
        ]);
      }
    } catch (err: any) {
      alert('Error fetching incident details: ' + err.message);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formDeptId || !formLocationId) {
      alert('Please fill all mandatory fields (Title, Department, Location).');
      return;
    }

    try {
      await api.createIncident({
        title: formTitle,
        eventType: formType,
        occurrenceDate: formDate,
        occurrenceTime: formTime,
        departmentId: formDeptId,
        locationId: formLocationId,
        subLocationId: formSubLocationId || null,
        eventCategory: formCategory,
        actualConsequence: formActualConsequence || 'Operational delay / minor damage',
        potentialConsequence: formPotentialConsequence || 'Potential high injury risk without barrier',
        immediateActionsTaken: formImmediateActions || 'Area secured, supervisor informed',
        personsInvolved: formPersonsInvolved,
        witnesses: formWitnesses,
        injuryOrEnvironmentalDetails: formInjuryDetails,
        initialRiskClassification: formInitialRisk,
        potentialRiskClassification: formPotentialRisk,
      });

      setShowCreateModal(false);
      setFormTitle('');
      await loadIncidents();
      alert('Incident event reported successfully with unique Event ID!');
    } catch (err: any) {
      alert('Failed to report incident: ' + err.message);
    }
  };

  const handleAssignInvestigation = async () => {
    if (!selectedIncident || !assignRpId) {
      alert('Please select an assigned Responsible Person (RP).');
      return;
    }

    try {
      await api.assignInvestigation(selectedIncident.id, {
        assignedRpId: assignRpId,
        assignedRglId: currentUser?.role === 'rgl' || currentUser?.role === 'admin' ? currentUser.id : undefined,
        investigationDueDate: assignDueDate,
        assignmentNotes: assignNotes,
      });

      setShowAssignModal(false);
      await openDetails(selectedIncident);
      await loadIncidents();
      alert('Investigation successfully assigned to Responsible Person.');
    } catch (err: any) {
      alert('Assignment error: ' + err.message);
    }
  };

  const handleSaveInvestigationDraft = async () => {
    if (!selectedIncident) return;

    try {
      await api.saveInvestigationDraft(selectedIncident.id, {
        sequenceOfEvents: invSequence,
        immediateCauses: invImmediateCauses,
        contributingFactors: invContributingFactors,
        failedOrMissingControls: invFailedControls,
        finalRootCause: invFinalRootCause,
        rootCauseCategory: invRootCauseCategory,
        whys: whys.filter((w) => w.question.trim().length > 0 && w.answer.trim().length > 0),
        findings: findings.filter((f) => f.description.trim().length > 0 && f.recommendedAction.trim().length > 0),
      });

      await openDetails(selectedIncident);
      alert('Investigation draft saved successfully.');
    } catch (err: any) {
      alert('Draft save error: ' + err.message);
    }
  };

  const handleSubmitInvestigation = async () => {
    if (!selectedIncident) return;

    // Pre-save draft first
    await handleSaveInvestigationDraft();

    try {
      await api.submitInvestigation(selectedIncident.id);
      await openDetails(selectedIncident);
      await loadIncidents();
      alert('Investigation submitted for RGL verification!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReviewInvestigation = async () => {
    if (!selectedIncident) return;
    if (reviewDecision === 'Returned' && !reviewComments.trim()) {
      alert('Mandatory review comments are required when returning a report for correction.');
      return;
    }

    try {
      const res = await api.reviewInvestigation(selectedIncident.id, {
        decision: reviewDecision,
        reviewComments,
      });

      setShowReviewModal(false);
      setReviewComments('');
      await openDetails(selectedIncident);
      await loadIncidents();
      alert(
        reviewDecision === 'Approved'
          ? `Report approved! ${res.createdActionsCount} CAPA actions initialized.`
          : 'Report returned to RP for correction.'
      );
    } catch (err: any) {
      alert('Review error: ' + err.message);
    }
  };

  const handleCloseIncident = async () => {
    if (!selectedIncident) return;
    try {
      await api.closeIncident(selectedIncident.id);
      await openDetails(selectedIncident);
      await loadIncidents();
      alert('Incident closed successfully.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const riskBadge = (risk: string) => {
    const map: Record<string, string> = {
      Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      High: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      Critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${map[risk] || map.Medium}`}>
        {risk}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Reported: 'bg-slate-800 text-slate-300 border-slate-700',
      'Under Investigation': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      'Under Review': 'bg-sky-500/10 text-sky-300 border-sky-500/30',
      'Returned for Correction': 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      Approved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      Closed: 'bg-slate-700/50 text-slate-400 border-slate-600',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${map[status] || map.Reported}`}>
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
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <span>Incident & Near-Miss Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            System-generated Event IDs, RGL investigation assignment, 5-Whys root cause validation, and traceable CAPA
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            title="Upload and integrate an Excel (.xlsx / .xls) or CSV incident register"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Import Incident Register</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Incident</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter Records:</span>
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
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Event Types</option>
          <option value="Near Miss">Near Miss</option>
          <option value="Unsafe Act">Unsafe Act</option>
          <option value="Unsafe Condition">Unsafe Condition</option>
          <option value="First Aid Case">First Aid Case</option>
          <option value="Medical Treatment Case">Medical Treatment Case</option>
          <option value="Restricted Work Case">Restricted Work Case</option>
          <option value="Lost Time Injury">Lost Time Injury</option>
          <option value="Property Damage">Property Damage</option>
          <option value="Environmental Incident">Environmental Incident</option>
          <option value="Fire or Explosion">Fire or Explosion</option>
          <option value="Chemical Spill or Release">Chemical Spill or Release</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Statuses</option>
          <option value="Reported">Reported</option>
          <option value="Under Investigation">Under Investigation</option>
          <option value="Under Review">Under Review</option>
          <option value="Returned for Correction">Returned for Correction</option>
          <option value="Approved">Approved</option>
          <option value="Closed">Closed</option>
        </select>

        <button
          onClick={loadIncidents}
          className="ml-auto p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Refresh table"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Incidents Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Title & Classification</th>
                <th className="py-3 px-4">Department & Location</th>
                <th className="py-3 px-4">Occurrence Date</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Investigation RP</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No incidents recorded matching the active filters.
                  </td>
                </tr>
              ) : (
                incidents.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{e.eventId}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{e.title}</div>
                      <div className="text-[11px] text-slate-400">{e.eventType}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{e.department?.name || 'Department'}</div>
                      <div className="text-[11px] text-slate-500">{e.location?.name || 'Main Plant'}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      <div>{e.occurrenceDate}</div>
                      <div className="text-[10px] text-slate-500">{e.occurrenceTime}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {riskBadge(e.initialRiskClassification)}
                        <span className="text-[10px] text-slate-500">
                          (Pot: {e.potentialRiskClassification})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {e.assignedRp ? (
                        <div className="text-slate-200">{e.assignedRp.fullName}</div>
                      ) : (
                        <span className="text-amber-400 text-[11px] italic">Not Assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{statusBadge(e.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openDetails(e)}
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

      {/* CREATE INCIDENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <span>Report Industrial Safety Event / Incident</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-slate-300 font-semibold">Event Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Forklift collision with pallet rack upright in loading bay"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Event Classification *</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Near Miss">Near Miss</option>
                    <option value="Unsafe Act">Unsafe Act</option>
                    <option value="Unsafe Condition">Unsafe Condition</option>
                    <option value="First Aid Case">First Aid Case</option>
                    <option value="Medical Treatment Case">Medical Treatment Case</option>
                    <option value="Restricted Work Case">Restricted Work Case</option>
                    <option value="Lost Time Injury">Lost Time Injury</option>
                    <option value="Property Damage">Property Damage</option>
                    <option value="Environmental Incident">Environmental Incident</option>
                    <option value="Fire or Explosion">Fire or Explosion</option>
                    <option value="Chemical Spill or Release">Chemical Spill or Release</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Event Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Safety">Safety</option>
                    <option value="Health">Occupational Health</option>
                    <option value="Environmental">Environmental</option>
                    <option value="Security">Security</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Occurrence Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Occurrence Time *</label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Department *</label>
                  <select
                    required
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Location *</label>
                  <select
                    required
                    value={formLocationId}
                    onChange={(e) => setFormLocationId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Location</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Initial Actual Risk</label>
                  <select
                    value={formInitialRisk}
                    onChange={(e: any) => setFormInitialRisk(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Potential Risk Severity</label>
                  <select
                    value={formPotentialRisk}
                    onChange={(e: any) => setFormPotentialRisk(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-slate-300 font-semibold">Actual Consequence / Loss</label>
                  <input
                    type="text"
                    value={formActualConsequence}
                    onChange={(e) => setFormActualConsequence(e.target.value)}
                    placeholder="e.g. Scratched rack post, 10 min stoppage"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-slate-300 font-semibold">Potential Consequence / Loss</label>
                  <input
                    type="text"
                    value={formPotentialConsequence}
                    onChange={(e) => setFormPotentialConsequence(e.target.value)}
                    placeholder="e.g. Rack collapse, severe crushing injury"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-slate-300 font-semibold">Immediate Actions Taken *</label>
                  <textarea
                    rows={2}
                    required
                    value={formImmediateActions}
                    onChange={(e) => setFormImmediateActions(e.target.value)}
                    placeholder="Immediate containment steps, barricades, first aid..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Conditional details for injury or environmental */}
                {(formType.includes('Injury') || formType.includes('Case') || formType.includes('Fatality')) && (
                  <div className="md:col-span-2 space-y-1 p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg">
                    <label className="text-rose-300 font-semibold">Injury Details & Medical Attention</label>
                    <textarea
                      rows={2}
                      value={formInjuryDetails}
                      onChange={(e) => setFormInjuryDetails(e.target.value)}
                      placeholder="Nature of injury, body parts affected, treatment facility..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow-sm"
                >
                  Generate Event ID & Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INCIDENT DETAILS & INVESTIGATION WORKFLOW MODAL */}
      {selectedIncident && incidentDetails && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-extrabold text-emerald-400">
                  {selectedIncident.eventId}
                </span>
                <span className="text-slate-500">|</span>
                <h3 className="text-sm font-bold text-white truncate max-w-xl">
                  {selectedIncident.title}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(selectedIncident.status)}
                <button
                  onClick={() => {
                    setSelectedIncident(null);
                    setIncidentDetails(null);
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content Tabs/Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
              {/* Event Metadata Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Classification</span>
                  <div className="font-semibold text-slate-200 mt-0.5">{selectedIncident.eventType}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Occurrence Time</span>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {selectedIncident.occurrenceDate} at {selectedIncident.occurrenceTime}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Department</span>
                  <div className="font-semibold text-slate-200 mt-0.5">{selectedIncident.department?.name}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Risk Classification</span>
                  <div className="mt-0.5">{riskBadge(selectedIncident.initialRiskClassification)}</div>
                </div>
              </div>

              {/* RGL Assignment Section */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-sky-400" />
                    <span>Investigation Responsibility & Assignment</span>
                  </h4>
                  {(currentUser?.role === 'admin' || currentUser?.role === 'rgl') && (
                    <button
                      onClick={() => {
                        setAssignRpId(String(selectedIncident.assignedRpId || ''));
                        setAssignDueDate(selectedIncident.investigationDueDate || '');
                        setShowAssignModal(true);
                      }}
                      className="px-2.5 py-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      {selectedIncident.assignedRpId ? 'Reassign Investigation' : 'Assign Investigator (RP)'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px]">Lead Investigator (RP):</span>
                    <div className="font-medium text-slate-200 mt-0.5">
                      {selectedIncident.assignedRp?.fullName || 'Unassigned'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">Reviewing Group Leader (RGL):</span>
                    <div className="font-medium text-slate-200 mt-0.5">
                      {selectedIncident.assignedRgl?.fullName || 'Corporate EHS Lead'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">Target Due Date:</span>
                    <div className="font-medium text-amber-300 mt-0.5">
                      {selectedIncident.investigationDueDate || '7 days from occurrence'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Investigation Report Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Root Cause Investigation Report ({incidentDetails.investigationReport?.reportId || 'IR-Pending'})
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Status: <span className="font-semibold text-emerald-400">{incidentDetails.investigationReport?.status || 'Open'}</span>
                  </span>
                </div>

                {/* Narrative fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Sequence of Events *</label>
                    <textarea
                      rows={3}
                      value={invSequence}
                      onChange={(e) => setInvSequence(e.target.value)}
                      placeholder="Step-by-step chronology leading to the incident..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Immediate Causes *</label>
                    <textarea
                      rows={3}
                      value={invImmediateCauses}
                      onChange={(e) => setInvImmediateCauses(e.target.value)}
                      placeholder="Direct substandard act or condition immediately preceding the event..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Contributing Factors</label>
                    <textarea
                      rows={2}
                      value={invContributingFactors}
                      onChange={(e) => setInvContributingFactors(e.target.value)}
                      placeholder="Environmental, workplace pressure, fatigue, lighting, design..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Failed or Missing Controls</label>
                    <textarea
                      rows={2}
                      value={invFailedControls}
                      onChange={(e) => setInvFailedControls(e.target.value)}
                      placeholder="Physical barriers, interlocks, procedures, PPE, permit-to-work..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="text-emerald-400 font-semibold">Final Documented Root Cause *</label>
                      <select
                        value={invRootCauseCategory}
                        onChange={(e) => setInvRootCauseCategory(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs"
                      >
                        <option value="Procedures & Compliance">Procedures & Compliance</option>
                        <option value="Equipment & Engineering Design">Equipment & Engineering Design</option>
                        <option value="Training & Competency">Training & Competency</option>
                        <option value="Management System & Oversight">Management System & Oversight</option>
                        <option value="Human Factors & Work Environment">Human Factors & Work Environment</option>
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      value={invFinalRootCause}
                      onChange={(e) => setInvFinalRootCause(e.target.value)}
                      placeholder="Explicit final root cause derived from Five Whys analysis..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* FIVE WHYS SECTION (Mandatory >= 5 whys) */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <h5 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-400" />
                        <span>Five Whys Cause-and-Effect Chain (At least 5 Whys mandatory)</span>
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        Logical progression from symptom to systemic failure. Currently completed:{' '}
                        <span className="font-bold text-emerald-400">
                          {whys.filter((w) => w.question && w.answer).length}
                        </span>{' '}
                        / 5 required
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {whys.map((why, idx) => (
                      <div key={why.whyNumber} className="grid grid-cols-12 gap-2 items-center text-xs">
                        <div className="col-span-1 font-bold font-mono text-slate-400">
                          Why {why.whyNumber}:
                        </div>
                        <div className="col-span-5">
                          <input
                            type="text"
                            value={why.question}
                            onChange={(e) => {
                              const copy = [...whys];
                              copy[idx].question = e.target.value;
                              setWhys(copy);
                            }}
                            placeholder={`Why did ${idx === 0 ? 'the event occur?' : `the previous condition happen?`}`}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="col-span-6">
                          <input
                            type="text"
                            value={why.answer}
                            onChange={(e) => {
                              const copy = [...whys];
                              copy[idx].answer = e.target.value;
                              setWhys(copy);
                            }}
                            placeholder="Because..."
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* KEY FINDINGS SECTION (Mandatory >= 2 findings) */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <h5 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-sky-400" />
                        <span>Key Findings & Action Traceability (At least 2 Findings mandatory)</span>
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        Each key finding directly seeds a verified CAPA action upon RGL approval.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFindings([
                          ...findings,
                          {
                            findingRef: `KF-0${findings.length + 1}`,
                            description: '',
                            evidence: '',
                            significance: 'Medium',
                            recommendedAction: '',
                          },
                        ])
                      }
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium"
                    >
                      + Add Finding
                    </button>
                  </div>

                  <div className="space-y-3">
                    {findings.map((f, idx) => (
                      <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sky-400">{f.findingRef}</span>
                          <select
                            value={f.significance}
                            onChange={(e: any) => {
                              const copy = [...findings];
                              copy[idx].significance = e.target.value;
                              setFindings(copy);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-slate-300 text-xs"
                          >
                            <option value="Low">Low Significance</option>
                            <option value="Medium">Medium Significance</option>
                            <option value="High">High Significance</option>
                            <option value="Critical">Critical Significance</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={f.description}
                            onChange={(e) => {
                              const copy = [...findings];
                              copy[idx].description = e.target.value;
                              setFindings(copy);
                            }}
                            placeholder="Finding Description (e.g. Rack anchor bolts sheared due to absent guard rails)"
                            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                          />
                          <input
                            type="text"
                            value={f.recommendedAction}
                            onChange={(e) => {
                              const copy = [...findings];
                              copy[idx].recommendedAction = e.target.value;
                              setFindings(copy);
                            }}
                            placeholder="Traceable Recommended Action (e.g. Install heavy-duty steel bollards at post base)"
                            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* LINKED CAPA ACTIONS DISPLAY */}
                {incidentDetails.actions.length > 0 && (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                    <h5 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Traceable CAPA Action Items ({incidentDetails.actions.length})</span>
                    </h5>
                    <div className="divide-y divide-slate-800">
                      {incidentDetails.actions.map((act) => (
                        <div key={act.id} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono font-bold text-emerald-400 mr-2">{act.actionId}</span>
                            <span className="text-slate-300">{act.recommendedAction}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">Target: {act.targetDate}</span>
                            {statusBadge(act.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Workflow Actions */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
              <div className="text-[11px] text-slate-400">
                Logged in role: <span className="font-bold text-white uppercase">{currentUser?.role}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* RP Save Draft & Submit */}
                <button
                  type="button"
                  onClick={handleSaveInvestigationDraft}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium text-xs transition-colors"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={handleSubmitInvestigation}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
                >
                  Submit for RGL Review
                </button>

                {/* RGL Review & Decision */}
                {(currentUser?.role === 'admin' || currentUser?.role === 'rgl') && (
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(true)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
                  >
                    RGL Decision & Approve
                  </button>
                )}

                {/* Administrative Closure */}
                {(currentUser?.role === 'admin' || currentUser?.role === 'rgl') &&
                  selectedIncident.status !== 'Closed' && (
                    <button
                      type="button"
                      onClick={handleCloseIncident}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium"
                    >
                      Close Incident
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RGL ASSIGNMENT MODAL */}
      {showAssignModal && selectedIncident && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Assign Lead Investigator (RP)
            </h3>
            <p className="text-xs text-slate-400">
              Assign incident {selectedIncident.eventId} to an authorized Responsible Person.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Select Responsible Person (RP) *</label>
                <select
                  value={assignRpId}
                  onChange={(e) => setAssignRpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="">Select RP Investigator</option>
                  {users
                    .filter((u) => u.role === 'rp' || u.role === 'admin')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role.toUpperCase()}) - {u.jobTitle || 'Investigator'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Investigation Due Date *</label>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Assignment Instructions</label>
                <textarea
                  rows={2}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Focus on guarding mechanisms, procedural compliance..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignInvestigation}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RGL REVIEW & APPROVAL MODAL */}
      {showReviewModal && selectedIncident && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>RGL Investigation Review & Decision</span>
            </h3>
            <p className="text-xs text-slate-400">
              Reviewing investigation report for {selectedIncident.eventId}.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Review Decision *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      value="Approved"
                      checked={reviewDecision === 'Approved'}
                      onChange={() => setReviewDecision('Approved')}
                    />
                    <span className="text-emerald-400 font-semibold">Approve Report</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
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
                  {reviewDecision === 'Returned' ? 'Mandatory Correction Notes *' : 'RGL Approval Notes'}
                </label>
                <textarea
                  rows={3}
                  required={reviewDecision === 'Returned'}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder={
                    reviewDecision === 'Returned'
                      ? 'Specify why root cause or 5-Whys are inadequate...'
                      : 'Verified root cause and endorsed recommended CAPA items.'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewInvestigation}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
              >
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incident Register Import Modal */}
      <IncidentImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={loadIncidents}
        existingEvents={incidents}
        departments={departments}
        locations={locations}
        users={users}
      />
    </div>
  );
};
