import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Filter,
  Flame,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { api } from '../../services/api.ts';
import { HazardReport } from '../../types/index.ts';
import {
  LIKELIHOOD_LEVELS,
  RiskMatrix,
  SEVERITY_LEVELS,
} from './RiskMatrix.tsx';
import { HazardImportModal } from './HazardImportModal.tsx';

function computeRiskTier(severity: number, likelihood: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  const score = severity * likelihood;
  if (score >= 15) return 'Critical';
  if (score >= 10) return 'High';
  if (score >= 5) return 'Medium';
  return 'Low';
}

export const HazardsView: React.FC = () => {
  const { currentUser, departments, locations, subLocations, users, activeTab } = useAuth();
  const { toast } = useToast();

  const [hazards, setHazards] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState(true);

  // View Navigation: 'matrix' (Risk Matrix & Observations) or 'register' (Consolidated Hazard Register)
  const [viewMode, setViewMode] = useState<'matrix' | 'register'>('matrix');

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);

  // Sync with Sidebar activeTab
  useEffect(() => {
    if (activeTab === 'hazard-register') {
      setViewMode('register');
    } else if (activeTab === 'hazard-import') {
      setShowImportModal(true);
    }
  }, [activeTab]);

  // Active matrix cell and risk level filter states (for Matrix view)
  const [selectedCell, setSelectedCell] = useState<{ likelihood: number; severity: number } | null>(null);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('All');

  // Search and tabular filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterRiskRating, setFilterRiskRating] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterResponsiblePerson, setFilterResponsiblePerson] = useState('All');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);

  // Sorting state (for Register view)
  const [sortField, setSortField] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination state (for Register view)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedHazardDetail, setSelectedHazardDetail] = useState<HazardReport | null>(null);
  const [editingHazard, setEditingHazard] = useState<HazardReport | null>(null);
  const [reassessingHazard, setReassessingHazard] = useState<HazardReport | null>(null);

  // Create Hazard Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [observationType, setObservationType] = useState('Unsafe Condition');
  const [hazardClassification, setHazardClassification] = useState('Physical / Mechanical');
  const [activity, setActivity] = useState('');
  const [hazardSource, setHazardSource] = useState('');
  const [potentialConsequences, setPotentialConsequences] = useState('');
  const [personsAtRisk, setPersonsAtRisk] = useState('');
  const [existingControls, setExistingControls] = useState('');
  const [severity, setSeverity] = useState<number>(3);
  const [likelihood, setLikelihood] = useState<number>(3);
  const [deptId, setDeptId] = useState('');
  const [locId, setLocId] = useState('');
  const [subLocId, setSubLocId] = useState('');
  const [immediateAction, setImmediateAction] = useState('');
  const [recommendedAction, setRecommendedAction] = useState('');
  const [responsiblePersonText, setResponsiblePersonText] = useState('');
  const [targetCompletionDate, setTargetCompletionDate] = useState('');
  const [autoCreateAction, setAutoCreateAction] = useState(true);
  const [rpId, setRpId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Hazard Form State
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editLocId, setEditLocId] = useState('');
  const [editSeverity, setEditSeverity] = useState<number>(3);
  const [editLikelihood, setEditLikelihood] = useState<number>(3);
  const [editExistingControls, setEditExistingControls] = useState('');
  const [editAdditionalControls, setEditAdditionalControls] = useState('');
  const [editResponsiblePerson, setEditResponsiblePerson] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editStatus, setEditStatus] = useState<'Open' | 'In Progress' | 'Closed'>('Open');

  // Re-assessment form state
  const [newSeverity, setNewSeverity] = useState<number>(3);
  const [newLikelihood, setNewLikelihood] = useState<number>(3);
  const [reassessmentNote, setReassessmentNote] = useState('');

  const loadHazards = async () => {
    try {
      setLoading(true);
      const data = await api.getHazards();
      setHazards(data);
    } catch (err: any) {
      console.error('Failed to load hazards:', err);
      toast.error('Failed to load hazard reports: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHazards();
  }, []);

  // Computed Risk Score for Create modal
  const computedScore = severity * likelihood;
  const computedTier = useMemo(() => {
    if (computedScore >= 15) return 'Critical';
    if (computedScore >= 10) return 'High';
    if (computedScore >= 5) return 'Medium';
    return 'Low';
  }, [computedScore]);

  // Handle Create Hazard
  const handleCreateHazard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !deptId || !locId) {
      toast.warning('Please fill in observation title, description, department, and location.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.createHazard({
        title: title.trim(),
        description: description.trim(),
        observationType,
        hazardClassification,
        activity: activity.trim(),
        hazardSource: hazardSource.trim(),
        potentialConsequences: potentialConsequences.trim(),
        personsAtRisk: personsAtRisk.trim(),
        existingControls: existingControls.trim(),
        severity,
        likelihood,
        riskRating: computedTier,
        departmentId: deptId,
        locationId: locId,
        subLocationId: subLocId || undefined,
        immediateAction: immediateAction.trim(),
        recommendedAction: recommendedAction.trim(),
        responsiblePerson: responsiblePersonText.trim(),
        targetCompletionDate: targetCompletionDate || undefined,
        createAction: autoCreateAction,
        responsiblePersonId: rpId || undefined,
      });

      setShowCreateModal(false);
      resetCreateForm();
      await loadHazards();
      toast.success('Hazard report filed and mapped on the Risk Matrix!');
    } catch (err: any) {
      toast.error('Failed to report hazard: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setTitle('');
    setDescription('');
    setObservationType('Unsafe Condition');
    setHazardClassification('Physical / Mechanical');
    setActivity('');
    setHazardSource('');
    setPotentialConsequences('');
    setPersonsAtRisk('');
    setExistingControls('');
    setSeverity(3);
    setLikelihood(3);
    setDeptId('');
    setLocId('');
    setSubLocId('');
    setImmediateAction('');
    setRecommendedAction('');
    setResponsiblePersonText('');
    setTargetCompletionDate('');
    setAutoCreateAction(true);
    setRpId('');
  };

  // Open Edit Modal
  const openEditModal = (h: HazardReport) => {
    setEditingHazard(h);
    setEditTitle(h.title || '');
    setEditDescription(h.description || '');
    setEditCategory(h.hazardClassification || 'Physical / Mechanical');
    setEditDeptId(String(h.departmentId || ''));
    setEditLocId(String(h.locationId || ''));
    setEditSeverity(h.severity || 3);
    setEditLikelihood(h.likelihood || 3);
    setEditExistingControls(h.existingControls || '');
    setEditAdditionalControls(h.additionalControls || h.recommendedAction || '');
    setEditResponsiblePerson(h.responsiblePerson || '');
    setEditTargetDate(h.targetCompletionDate || '');
    setEditStatus(h.status || 'Open');
  };

  // Handle Save Edit Hazard
  const handleSaveEditHazard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHazard) return;

    try {
      setIsSubmitting(true);
      const score = editSeverity * editLikelihood;
      let rating: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
      if (score >= 15) rating = 'Critical';
      else if (score >= 10) rating = 'High';
      else if (score >= 5) rating = 'Medium';

      const updated = await api.updateHazard(editingHazard.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        hazardClassification: editCategory,
        departmentId: Number(editDeptId) || editingHazard.departmentId,
        locationId: Number(editLocId) || editingHazard.locationId,
        severity: editSeverity,
        likelihood: editLikelihood,
        riskScore: score,
        riskRating: rating,
        existingControls: editExistingControls,
        additionalControls: editAdditionalControls,
        recommendedAction: editAdditionalControls,
        responsiblePerson: editResponsiblePerson,
        targetCompletionDate: editTargetDate,
        status: editStatus,
      });

      setHazards((prev) => prev.map((h) => (h.id === updated.id ? { ...h, ...updated } : h)));
      if (selectedHazardDetail?.id === updated.id) {
        setSelectedHazardDetail({ ...selectedHazardDetail, ...updated });
      }
      setEditingHazard(null);
      toast.success(`Hazard ${editingHazard.hazardId} updated successfully.`);
    } catch (err: any) {
      toast.error('Failed to update hazard: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Quick Re-assessment
  const handleSaveReassessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassessingHazard) return;

    try {
      setIsSubmitting(true);
      const score = newSeverity * newLikelihood;
      let rating: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
      if (score >= 15) rating = 'Critical';
      else if (score >= 10) rating = 'High';
      else if (score >= 5) rating = 'Medium';

      const updated = await api.updateHazard(reassessingHazard.id, {
        severity: newSeverity,
        likelihood: newLikelihood,
        riskScore: score,
        riskRating: rating,
        recommendedAction: reassessmentNote
          ? `${reassessingHazard.recommendedAction || ''}\n[Re-assessed]: ${reassessmentNote}`.trim()
          : reassessingHazard.recommendedAction,
      });

      setHazards((prev) => prev.map((h) => (h.id === updated.id ? { ...h, ...updated } : h)));
      if (selectedHazardDetail?.id === updated.id) {
        setSelectedHazardDetail({ ...selectedHazardDetail, ...updated });
      }
      setReassessingHazard(null);
      toast.success(`Risk re-assessed! Hazard moved to Cell [${newLikelihood} × ${newSeverity}] (${rating} Risk).`);
    } catch (err: any) {
      toast.error('Failed to update risk assessment: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Status Update
  const handleUpdateStatus = async (hazard: HazardReport, newStatus: 'Open' | 'In Progress' | 'Closed') => {
    try {
      const updated = await api.updateHazard(hazard.id, { status: newStatus });
      setHazards((prev) => prev.map((h) => (h.id === hazard.id ? { ...h, status: newStatus } : h)));
      if (selectedHazardDetail?.id === hazard.id) {
        setSelectedHazardDetail({ ...selectedHazardDetail, status: newStatus });
      }
      toast.success(`Status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  // Check if hazard control action is overdue
  const isOverdue = (targetDate?: string, status?: string) => {
    if (!targetDate || status === 'Closed') return false;
    const now = new Date().toISOString().split('T')[0];
    return targetDate < now;
  };

  // Filtered Hazards list
  const filteredHazards = useMemo(() => {
    return hazards.filter((h) => {
      // Matrix cell filter (when viewing matrix)
      if (selectedCell) {
        if ((h.likelihood || 3) !== selectedCell.likelihood || (h.severity || 3) !== selectedCell.severity) {
          return false;
        }
      }

      // Risk level filter
      if (selectedRiskLevel !== 'All' && h.riskRating !== selectedRiskLevel) {
        return false;
      }
      if (filterRiskRating !== 'All' && h.riskRating !== filterRiskRating) {
        return false;
      }

      // Category filter
      if (filterCategory !== 'All' && (h.hazardClassification || '') !== filterCategory) {
        return false;
      }

      // Department filter
      if (filterDepartment !== 'All') {
        const dName = h.department?.name || '';
        if (dName !== filterDepartment) return false;
      }

      // Responsible person filter
      if (filterResponsiblePerson !== 'All') {
        const resp = h.responsiblePerson || '';
        if (resp !== filterResponsiblePerson) return false;
      }

      // Status filter
      if (filterStatus !== 'All' && h.status !== filterStatus) {
        return false;
      }

      // Overdue filter
      if (filterOverdueOnly && !isOverdue(h.targetCompletionDate, h.status)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = h.hazardId.toLowerCase().includes(q);
        const matchTitle = h.title.toLowerCase().includes(q);
        const matchDesc = (h.description || '').toLowerCase().includes(q);
        const matchDept = (h.department?.name || '').toLowerCase().includes(q);
        const matchLoc = (h.location?.name || '').toLowerCase().includes(q);
        const matchResp = (h.responsiblePerson || '').toLowerCase().includes(q);
        const matchCat = (h.hazardClassification || '').toLowerCase().includes(q);
        const matchSource = (h.hazardSource || '').toLowerCase().includes(q);

        if (!matchId && !matchTitle && !matchDesc && !matchDept && !matchLoc && !matchResp && !matchCat && !matchSource) {
          return false;
        }
      }

      return true;
    });
  }, [
    hazards,
    selectedCell,
    selectedRiskLevel,
    filterRiskRating,
    filterCategory,
    filterDepartment,
    filterResponsiblePerson,
    filterStatus,
    filterOverdueOnly,
    searchQuery,
  ]);

  // Sorted Hazards for Register
  const sortedHazards = useMemo(() => {
    return [...filteredHazards].sort((a, b) => {
      let valA: any = a[sortField as keyof HazardReport];
      let valB: any = b[sortField as keyof HazardReport];

      if (sortField === 'department') {
        valA = a.department?.name || '';
        valB = b.department?.name || '';
      } else if (sortField === 'riskScore') {
        valA = (a.severity || 3) * (a.likelihood || 3);
        valB = (b.severity || 3) * (b.likelihood || 3);
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [filteredHazards, sortField, sortDirection]);

  // Paginated Hazards for Register
  const paginatedHazards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedHazards.slice(start, start + pageSize);
  }, [sortedHazards, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedHazards.length / pageSize) || 1;

  // Toggle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Overall statistics
  const stats = useMemo(() => {
    const total = hazards.length;
    const critical = hazards.filter((h) => (h.severity || 3) * (h.likelihood || 3) >= 15 || h.riskRating === 'Critical').length;
    const high = hazards.filter((h) => {
      const s = (h.severity || 3) * (h.likelihood || 3);
      return (s >= 10 && s < 15) || (h.riskRating === 'High' && s < 15);
    }).length;
    const open = hazards.filter((h) => h.status === 'Open').length;
    const closed = hazards.filter((h) => h.status === 'Closed').length;
    const overdue = hazards.filter((h) => isOverdue(h.targetCompletionDate, h.status)).length;
    return { total, critical, high, open, closed, overdue };
  }, [hazards]);

  // Distinct values for dropdown filters
  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    hazards.forEach((h) => {
      if (h.hazardClassification) set.add(h.hazardClassification);
    });
    return Array.from(set);
  }, [hazards]);

  const distinctResponsiblePersons = useMemo(() => {
    const set = new Set<string>();
    hazards.forEach((h) => {
      if (h.responsiblePerson) set.add(h.responsiblePerson);
    });
    return Array.from(set);
  }, [hazards]);

  // Export hazards to formatted Excel (.xlsx) file
  const handleExportExcel = () => {
    if (hazards.length === 0) {
      toast.info('No hazard observations to export.');
      return;
    }

    const exportRows = filteredHazards.map((h) => ({
      'Hazard ID': h.hazardId,
      'Hazard Title / Description': h.title,
      'Hazard Category': h.hazardClassification || 'Physical / Mechanical',
      'Department': h.department?.name || '',
      'Location / Work Area': h.location?.name || '',
      'Activity / Task': h.activity || '',
      'Hazard Source': h.hazardSource || '',
      'Potential Consequences': h.potentialConsequences || '',
      'Persons at Risk': h.personsAtRisk || '',
      'Existing Control Measures': h.existingControls || h.immediateAction || '',
      'Likelihood / Probability': h.likelihood || 3,
      'Severity / Consequence Rating': h.severity || 3,
      'Initial Risk Rating': h.riskRating || computeRiskTier(h.severity || 3, h.likelihood || 3),
      'Initial Risk Score': (h.severity || 3) * (h.likelihood || 3),
      'Additional / Proposed Controls': h.additionalControls || h.recommendedAction || '',
      'Residual Likelihood': h.residualLikelihood || 2,
      'Residual Severity': h.residualSeverity || 2,
      'Residual Risk Rating': h.residualRiskRating || 'Low',
      'Responsible Person': h.responsiblePerson || '',
      'Target Completion Date': h.targetCompletionDate || '',
      'Status': h.status,
      'Date Identified': h.dateIdentified || (h.createdAt ? h.createdAt.split('T')[0] : ''),
      'Reported By': h.reportedBy?.fullName || h.reportedByText || 'EHS Team',
      'Source / Reference': h.sourceReference || '',
      'Remarks': h.remarks || '',
      'Record Source': h.recordSource || 'Manual',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const colWidths = Object.keys(exportRows[0]).map((key) => ({
      wch: Math.max(key.length + 3, 16),
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hazard_Register');
    XLSX.writeFile(wb, `EHS_Consolidated_Hazard_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${filteredHazards.length} hazards to Excel (.xlsx).`);
  };

  // Export hazards CSV
  const handleExportCSV = () => {
    if (hazards.length === 0) {
      toast.info('No hazard observations to export.');
      return;
    }
    const headers = [
      'Hazard ID',
      'Title',
      'Category',
      'Department',
      'Location',
      'Severity',
      'Likelihood',
      'Risk Score',
      'Risk Rating',
      'Responsible Person',
      'Target Date',
      'Status',
    ];
    const rows = filteredHazards.map((h) => [
      h.hazardId,
      `"${h.title.replace(/"/g, '""')}"`,
      h.hazardClassification,
      `"${h.department?.name || ''}"`,
      `"${h.location?.name || ''}"`,
      h.severity || 3,
      h.likelihood || 3,
      (h.severity || 3) * (h.likelihood || 3),
      h.riskRating,
      `"${h.responsiblePerson || ''}"`,
      h.targetCompletionDate || '',
      h.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `HSE_Hazard_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Hazard Register exported to CSV.');
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header with Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Hazard Management & Register</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Map hazards on the interactive 5×5 Risk Matrix, manage the consolidated register, and import Excel records into Cloud Firestore.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadHazards}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            title="Refresh hazard records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          {/* HAZARD REGISTER EXCEL IMPORT BUTTON */}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-950/40 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Hazard Register Import</span>
          </button>

          <button
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Report Hazard</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('matrix')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              viewMode === 'matrix'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Risk Matrix & Heatmap</span>
          </button>

          <button
            onClick={() => setViewMode('register')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              viewMode === 'register'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Consolidated Hazard Register</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
              {hazards.length}
            </span>
          </button>
        </div>

        <button
          onClick={() => setShowImportModal(true)}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 pb-1"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Upload Register (.xlsx)</span>
        </button>
      </div>

      {/* Metric Counters Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400">Total Hazards</div>
          <div className="text-xl font-bold text-white font-mono tabular-nums mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Identified in register</div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
            <Flame className="w-3 h-3" />
            <span>Critical Risk</span>
          </div>
          <div className="text-xl font-bold text-rose-400 font-mono tabular-nums mt-1">{stats.critical}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Score ≥ 15</div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>High Risk</span>
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono tabular-nums mt-1">{stats.high}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Score 10–14</div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>Open Status</span>
          </div>
          <div className="text-xl font-bold text-cyan-400 font-mono tabular-nums mt-1">{stats.open}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Requiring attention</div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Closed</span>
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono tabular-nums mt-1">{stats.closed}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Controls verified</div>
        </div>

        <div
          onClick={() => {
            setViewMode('register');
            setFilterOverdueOnly((prev) => !prev);
          }}
          className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
            stats.overdue > 0
              ? 'bg-rose-500/10 border-rose-500/40 hover:bg-rose-500/20'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>Overdue Actions</span>
          </div>
          <div className="text-xl font-bold text-rose-400 font-mono tabular-nums mt-1">{stats.overdue}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Past target date</div>
        </div>
      </div>

      {/* VIEW MODE 1: MATRIX & OBSERVATIONS */}
      {viewMode === 'matrix' && (
        <div className="space-y-6">
          <RiskMatrix
            hazards={hazards}
            selectedCell={selectedCell}
            onSelectCell={setSelectedCell}
            selectedRiskLevel={selectedRiskLevel}
            onSelectRiskLevel={setSelectedRiskLevel}
            onHazardClick={(h) => setSelectedHazardDetail(h)}
            onQuickReassess={(h, newSev, newLik) => {
              setReassessingHazard(h);
              setNewSeverity(newSev);
              setNewLikelihood(newLik);
            }}
          />

          {/* Observations Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search hazards by ID, title, keyword, department, location..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="All">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>

                {(selectedCell || selectedRiskLevel !== 'All' || searchQuery || filterDepartment !== 'All' || filterStatus !== 'All') && (
                  <button
                    onClick={() => {
                      setSelectedCell(null);
                      setSelectedRiskLevel('All');
                      setSearchQuery('');
                      setFilterDepartment('All');
                      setFilterStatus('All');
                    }}
                    className="flex items-center gap-1 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Observations Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Hazard Observations ({filteredHazards.length})
                </span>
                {selectedCell && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                    Matrix Cell [L={selectedCell.likelihood} × S={selectedCell.severity}]
                  </span>
                )}
              </div>

              <button
                onClick={() => setViewMode('register')}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <span>View Full Register Table</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950/70 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Hazard ID</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4">Department / Location</th>
                    <th className="py-3 px-4 text-center">Likelihood</th>
                    <th className="py-3 px-4 text-center">Severity</th>
                    <th className="py-3 px-4">Risk Rating</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredHazards.map((hazard) => {
                    const score = (hazard.severity || 3) * (hazard.likelihood || 3);
                    const overdueFlag = isOverdue(hazard.targetCompletionDate, hazard.status);
                    return (
                      <tr key={hazard.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                          {hazard.hazardId}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-semibold text-slate-100 truncate">{hazard.title}</div>
                          <div className="text-[11px] text-slate-400 truncate">{hazard.description}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                          {hazard.hazardClassification || 'Physical'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                          <div>{hazard.department?.name || 'General Operations'}</div>
                          <div className="text-[10px] text-slate-500">{hazard.location?.name || 'Main Plant'}</div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                          {hazard.likelihood || 3}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                          {hazard.severity || 3}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              hazard.riskRating === 'Critical'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : hazard.riskRating === 'High'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : hazard.riskRating === 'Medium'
                                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {hazard.riskRating || 'Medium'} ({score})
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                hazard.status === 'Closed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : hazard.status === 'In Progress'
                                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {hazard.status}
                            </span>
                            {overdueFlag && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" /> Overdue
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedHazardDetail(hazard)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(hazard)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                              title="Edit hazard"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setReassessingHazard(hazard);
                                setNewSeverity(hazard.severity || 3);
                                setNewLikelihood(hazard.likelihood || 3);
                                setReassessmentNote('');
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                              title="Re-assess on Risk Matrix"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredHazards.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        No hazard records match your current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: CONSOLIDATED HAZARD REGISTER */}
      {viewMode === 'register' && (
        <div className="space-y-4">
          {/* Multi-Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search register by Hazard ID, title, description, activity, source..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Department filter */}
                <select
                  value={filterDepartment}
                  onChange={(e) => {
                    setFilterDepartment(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="All">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>

                {/* Category filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="All">All Categories</option>
                  {distinctCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Risk Rating filter */}
                <select
                  value={filterRiskRating}
                  onChange={(e) => {
                    setFilterRiskRating(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="All">All Risk Ratings</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                {/* Status filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>

                {/* Overdue toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterOverdueOnly((prev) => !prev);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                    filterOverdueOnly
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Overdue Only</span>
                </button>

                {(searchQuery || filterDepartment !== 'All' || filterCategory !== 'All' || filterRiskRating !== 'All' || filterStatus !== 'All' || filterOverdueOnly) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterDepartment('All');
                      setFilterCategory('All');
                      setFilterRiskRating('All');
                      setFilterStatus('All');
                      setFilterOverdueOnly(false);
                      setCurrentPage(1);
                    }}
                    className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Consolidated Register Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800 select-none">
                  <tr>
                    <th
                      onClick={() => handleSort('hazardId')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        <span>Hazard ID</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('title')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white min-w-[200px]"
                    >
                      <div className="flex items-center gap-1">
                        <span>Hazard Description</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('hazardClassification')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        <span>Category</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('department')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        <span>Department & Location</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('riskScore')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        <span>Initial Risk</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Residual Risk</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Responsible Person</th>
                    <th
                      onClick={() => handleSort('targetCompletionDate')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        <span>Target Date</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {paginatedHazards.map((h) => {
                    const overdueFlag = isOverdue(h.targetCompletionDate, h.status);
                    const isHigh = h.riskRating === 'Critical' || h.riskRating === 'High';
                    const score = (h.severity || 3) * (h.likelihood || 3);

                    return (
                      <tr
                        key={h.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isHigh ? 'bg-rose-500/[0.02]' : ''
                        }`}
                      >
                        <td className="py-3 px-3.5 font-mono font-bold text-amber-400 whitespace-nowrap">
                          {h.hazardId}
                        </td>
                        <td className="py-3 px-3.5 max-w-sm">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            {isHigh && <Flame className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />}
                            <span className="truncate">{h.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{h.description}</div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-slate-300">
                          {h.hazardClassification || 'Physical'}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-slate-400">
                          <div>{h.department?.name || 'General Operations'}</div>
                          <div className="text-[10px] text-slate-500">{h.location?.name || 'Main Facility'}</div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              h.riskRating === 'Critical'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : h.riskRating === 'High'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : h.riskRating === 'Medium'
                                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {h.riskRating || 'Medium'} ({score})
                          </span>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {h.residualRiskRating || 'Low'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-slate-300">
                          {h.responsiblePerson || '—'}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {h.targetCompletionDate ? (
                            <div className="flex items-center gap-1">
                              <span className={overdueFlag ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                                {h.targetCompletionDate}
                              </span>
                              {overdueFlag && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              h.status === 'Closed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : h.status === 'In Progress'
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedHazardDetail(h)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(h)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                              title="Edit hazard"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedHazards.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        No hazard records match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span>Showing</span>
                <span className="font-bold text-white">
                  {Math.min((currentPage - 1) * pageSize + 1, sortedHazards.length)}
                </span>
                <span>to</span>
                <span className="font-bold text-white">
                  {Math.min(currentPage * pageSize, sortedHazards.length)}
                </span>
                <span>of</span>
                <span className="font-bold text-white">{sortedHazards.length}</span>
                <span>hazards</span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300"
                >
                  <option value={10}>10 per page</option>
                  <option value={15}>15 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>

                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-mono">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HAZARD REGISTER EXCEL IMPORT MODAL */}
      <HazardImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={async () => {
          await loadHazards();
          setViewMode('register');
        }}
        existingHazards={hazards}
        departments={departments}
        locations={locations}
        users={users}
      />

      {/* CREATE HAZARD MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-white">Report Workplace Hazard Observation</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHazard} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">
                    Observation Headline / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Chemical acid vapor leak from flange seal"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">
                    Detailed Hazard Description *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe exact conditions, machinery involved, and immediate exposure risk..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Observation Type</label>
                  <select
                    value={observationType}
                    onChange={(e) => setObservationType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Unsafe Condition">Unsafe Condition</option>
                    <option value="Unsafe Act">Unsafe Act</option>
                    <option value="Near Miss Finding">Near Miss Finding</option>
                    <option value="Positive Safety Practice">Positive Safety Practice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Hazard Category</label>
                  <select
                    value={hazardClassification}
                    onChange={(e) => setHazardClassification(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Chemical">Chemical</option>
                    <option value="Physical">Physical</option>
                    <option value="Biological">Biological</option>
                    <option value="Ergonomic">Ergonomic</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Fire">Fire & Explosion</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Environmental">Environmental</option>
                    <option value="Work at Height">Work at Height</option>
                    <option value="Manual Handling">Manual Handling</option>
                    <option value="Psychosocial">Psychosocial</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Department *</label>
                  <select
                    required
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Location *</label>
                  <select
                    required
                    value={locId}
                    onChange={(e) => setLocId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
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

              {/* Initial Risk Matrix Selectors */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">Risk Matrix Assessment</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Calculated Rating:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        computedTier === 'Critical'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : computedTier === 'High'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : computedTier === 'Medium'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {computedTier} (Score: {computedScore})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Likelihood / Frequency (1 to 5)</label>
                    <select
                      value={likelihood}
                      onChange={(e) => setLikelihood(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                    >
                      {LIKELIHOOD_LEVELS.map((lvl) => (
                        <option key={lvl.level} value={lvl.level}>
                          Level {lvl.level}: {lvl.label} ({lvl.desc})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Severity / Consequence (1 to 5)</label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                    >
                      {SEVERITY_LEVELS.map((lvl) => (
                        <option key={lvl.level} value={lvl.level}>
                          Level {lvl.level}: {lvl.label} ({lvl.desc})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Immediate & Recommended Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Immediate Containment Action</label>
                  <input
                    type="text"
                    value={immediateAction}
                    onChange={(e) => setImmediateAction(e.target.value)}
                    placeholder="e.g. Warning flag placed, cordon installed"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Recommended Controls</label>
                  <input
                    type="text"
                    value={recommendedAction}
                    onChange={(e) => setRecommendedAction(e.target.value)}
                    placeholder="e.g. Replace seal during shutdown"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Responsible Person & Target Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Responsible Person (Assignee)</label>
                  <input
                    type="text"
                    value={responsiblePersonText}
                    onChange={(e) => setResponsiblePersonText(e.target.value)}
                    placeholder="e.g. David Chen"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Completion Date</label>
                  <input
                    type="date"
                    value={targetCompletionDate}
                    onChange={(e) => setTargetCompletionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'File Hazard Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT HAZARD MODAL */}
      {editingHazard && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-white">
                  Edit Hazard Record <span className="font-mono text-amber-400">[{editingHazard.hazardId}]</span>
                </h3>
              </div>
              <button onClick={() => setEditingHazard(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditHazard} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    <option value="Chemical">Chemical</option>
                    <option value="Physical">Physical</option>
                    <option value="Biological">Biological</option>
                    <option value="Ergonomic">Ergonomic</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Fire">Fire & Explosion</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Environmental">Environmental</option>
                    <option value="Work at Height">Work at Height</option>
                    <option value="Manual Handling">Manual Handling</option>
                    <option value="Psychosocial">Psychosocial</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Likelihood (1 to 5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={editLikelihood}
                    onChange={(e) => setEditLikelihood(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Severity (1 to 5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={editSeverity}
                    onChange={(e) => setEditSeverity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Responsible Person</label>
                  <input
                    type="text"
                    value={editResponsiblePerson}
                    onChange={(e) => setEditResponsiblePerson(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Date</label>
                  <input
                    type="date"
                    value={editTargetDate}
                    onChange={(e) => setEditTargetDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Proposed / Additional Controls</label>
                <input
                  type="text"
                  value={editAdditionalControls}
                  onChange={(e) => setEditAdditionalControls(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingHazard(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK RE-ASSESSMENT MODAL */}
      {reassessingHazard && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-white">Re-assess Hazard Risk Rating</h3>
              </div>
              <button
                onClick={() => setReassessingHazard(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReassessment} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="font-mono text-amber-400 font-bold">{reassessingHazard.hazardId}</span>
                <p className="font-semibold text-white mt-0.5">{reassessingHazard.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">New Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {SEVERITY_LEVELS.map((lvl) => (
                      <option key={lvl.level} value={lvl.level}>
                        Level {lvl.level}: {lvl.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">New Likelihood</label>
                  <select
                    value={newLikelihood}
                    onChange={(e) => setNewLikelihood(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {LIKELIHOOD_LEVELS.map((lvl) => (
                      <option key={lvl.level} value={lvl.level}>
                        Level {lvl.level}: {lvl.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Re-assessment Rationale / Note</label>
                <textarea
                  rows={2}
                  value={reassessmentNote}
                  onChange={(e) => setReassessmentNote(e.target.value)}
                  placeholder="e.g. Residual risk after machine guard re-installed"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReassessingHazard(null)}
                  className="px-3.5 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  {isSubmitting ? 'Updating...' : 'Save Re-assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HAZARD DETAIL DRAWER / MODAL */}
      {selectedHazardDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {selectedHazardDetail.hazardId}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-xs text-slate-300 font-medium">{selectedHazardDetail.hazardClassification || 'Physical'}</span>
                {selectedHazardDetail.recordSource && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {selectedHazardDetail.recordSource}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedHazardDetail(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-base font-bold text-white">{selectedHazardDetail.title}</h3>
                <p className="text-slate-300 mt-1 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {selectedHazardDetail.description}
                </p>
              </div>

              {/* Grid Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Initial Risk</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {selectedHazardDetail.riskRating || 'Medium'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    S: {selectedHazardDetail.severity || 3} · L: {selectedHazardDetail.likelihood || 3}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Residual Risk</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {selectedHazardDetail.residualRiskRating || 'Low'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    S: {selectedHazardDetail.residualSeverity || 2} · L: {selectedHazardDetail.residualLikelihood || 2}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Status</div>
                  <div className="text-sm font-bold text-amber-400 mt-0.5">
                    {selectedHazardDetail.status}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {selectedHazardDetail.targetCompletionDate ? `Target: ${selectedHazardDetail.targetCompletionDate}` : 'No deadline'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Responsible</div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5 truncate">
                    {selectedHazardDetail.responsiblePerson || 'EHS Safety Team'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {selectedHazardDetail.department?.name || 'General Operations'}
                  </div>
                </div>
              </div>

              {/* Additional Context Fields */}
              {(selectedHazardDetail.activity || selectedHazardDetail.hazardSource || selectedHazardDetail.potentialConsequences || selectedHazardDetail.personsAtRisk) && (
                <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl grid grid-cols-2 gap-3 text-xs">
                  {selectedHazardDetail.activity && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Activity / Task:</span>
                      <p className="text-slate-300 mt-0.5">{selectedHazardDetail.activity}</p>
                    </div>
                  )}
                  {selectedHazardDetail.hazardSource && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Hazard Source:</span>
                      <p className="text-slate-300 mt-0.5">{selectedHazardDetail.hazardSource}</p>
                    </div>
                  )}
                  {selectedHazardDetail.potentialConsequences && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Potential Consequences:</span>
                      <p className="text-slate-300 mt-0.5">{selectedHazardDetail.potentialConsequences}</p>
                    </div>
                  )}
                  {selectedHazardDetail.personsAtRisk && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Persons at Risk:</span>
                      <p className="text-slate-300 mt-0.5">{selectedHazardDetail.personsAtRisk}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="space-y-2">
                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                  <div className="font-semibold text-slate-300">Existing Control Measures</div>
                  <div className="text-slate-400 mt-1">
                    {selectedHazardDetail.existingControls || selectedHazardDetail.immediateAction || 'None specified during initial report.'}
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                  <div className="font-semibold text-slate-300">Proposed / Recommended Action</div>
                  <div className="text-slate-400 mt-1 whitespace-pre-wrap">
                    {selectedHazardDetail.additionalControls || selectedHazardDetail.recommendedAction || 'None specified.'}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const h = selectedHazardDetail;
                      setSelectedHazardDetail(null);
                      openEditModal(h);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit Record</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const h = selectedHazardDetail;
                      setSelectedHazardDetail(null);
                      setReassessingHazard(h);
                      setNewSeverity(h.severity || 3);
                      setNewLikelihood(h.likelihood || 3);
                      setReassessmentNote('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Re-assess on Matrix</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedHazardDetail(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
