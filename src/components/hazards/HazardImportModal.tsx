import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Download,
  Check,
  RefreshCw,
  FileText,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Search,
  HelpCircle,
  FileDown,
  Database,
  Cloud,
  ChevronDown,
  Eye,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { Department, Location, User, HazardReport } from '../../types/index.ts';
import {
  batchImportHazardsToFirestore,
  allocateFirestoreHazardIds,
  FirestoreHazardRecord,
  ImportBatchMetadata,
} from '../../services/firestoreService.ts';
import firebaseConfig from '../../../firebase-applet-config.json';

interface HazardImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => Promise<void>;
  existingHazards: HazardReport[];
  departments: Department[];
  locations: Location[];
  users: User[];
}

export interface HazardTargetField {
  key: string;
  label: string;
  required: boolean;
  category: 'identification' | 'risk' | 'controls' | 'governance';
  description: string;
  aliases: string[];
}

export const HAZARD_SYSTEM_FIELDS: HazardTargetField[] = [
  // Identification
  {
    key: 'hazardId',
    label: 'Hazard ID / Code',
    required: false,
    category: 'identification',
    description: 'Unique identifier (e.g. HAZ-000001). If missing or empty, unique sequential ID is generated automatically.',
    aliases: ['hazardid', 'hazard id', 'hazard code', 'id', 'ref no', 'reference', 'hazard no', 'code'],
  },
  {
    key: 'title',
    label: 'Hazard Title / Description',
    required: true,
    category: 'identification',
    description: 'Concise description of the hazard, condition, or unsafe act (Required).',
    aliases: ['title', 'hazard title', 'hazard description', 'description', 'hazard', 'observation', 'summary', 'details'],
  },
  {
    key: 'hazardCategory',
    label: 'Hazard Category',
    required: false,
    category: 'identification',
    description: 'Chemical, Physical, Biological, Ergonomic, Electrical, Fire, Mechanical, Environmental, Work at Height, Manual Handling, Psychosocial, or Other.',
    aliases: ['hazardcategory', 'category', 'classification', 'hazard classification', 'hazard category', 'type', 'hazard type'],
  },
  {
    key: 'department',
    label: 'Department',
    required: false,
    category: 'identification',
    description: 'Responsible facility department.',
    aliases: ['department', 'dept', 'division', 'area', 'business unit'],
  },
  {
    key: 'location',
    label: 'Location / Work Area',
    required: false,
    category: 'identification',
    description: 'Plant location, building, shopfloor, or work area.',
    aliases: ['location', 'work area', 'facility', 'zone', 'site', 'plant', 'workplace'],
  },
  {
    key: 'activity',
    label: 'Activity / Task',
    required: false,
    category: 'identification',
    description: 'Specific operational task, activity, or process during which hazard presents.',
    aliases: ['activity', 'task', 'operation', 'process', 'work activity', 'job'],
  },
  {
    key: 'hazardSource',
    label: 'Hazard Source',
    required: false,
    category: 'identification',
    description: 'Physical source, equipment, tooling, or agent originating the hazard.',
    aliases: ['hazardsource', 'hazard source', 'source', 'equipment', 'source of hazard', 'agent', 'cause'],
  },
  {
    key: 'potentialConsequences',
    label: 'Potential Consequences',
    required: false,
    category: 'risk',
    description: 'Worst-case potential harm, injury, illness, or property damage.',
    aliases: ['potentialconsequences', 'potential consequences', 'consequences', 'harm', 'potential harm', 'injury', 'impact'],
  },
  {
    key: 'personsAtRisk',
    label: 'Persons at Risk',
    required: false,
    category: 'identification',
    description: 'Groups or personnel exposed (e.g. Operators, Maintenance Technicians, Contractors, Public).',
    aliases: ['personsatrisk', 'persons at risk', 'who is exposed', 'exposed persons', 'personnel at risk', 'workers'],
  },

  // Risk Rating
  {
    key: 'likelihood',
    label: 'Likelihood / Probability',
    required: false,
    category: 'risk',
    description: 'Initial likelihood score (1 to 5) or description (Rare, Unlikely, Possible, Likely, Almost Certain).',
    aliases: ['likelihood', 'probability', 'prob', 'freq', 'frequency', 'initial likelihood'],
  },
  {
    key: 'severity',
    label: 'Severity / Consequence Rating',
    required: false,
    category: 'risk',
    description: 'Initial severity score (1 to 5) or description (Negligible, Minor, Moderate, Major, Catastrophic).',
    aliases: ['severity', 'consequence rating', 'consequence', 'severity rating', 'initial severity', 'impact rating'],
  },
  {
    key: 'initialRiskRating',
    label: 'Initial Risk Rating',
    required: false,
    category: 'risk',
    description: 'Initial Risk tier: Low, Medium, High, or Critical. Calculated from Severity x Likelihood if not supplied.',
    aliases: ['initialriskrating', 'initial risk rating', 'initial risk', 'risk rating', 'risk score', 'risk level'],
  },

  // Controls & Residual Risk
  {
    key: 'existingControls',
    label: 'Existing Control Measures',
    required: false,
    category: 'controls',
    description: 'Currently implemented safeguards, PPE, interlocking guards, or procedures.',
    aliases: ['existingcontrols', 'existing control measures', 'existing controls', 'current controls', 'safeguards', 'controls in place'],
  },
  {
    key: 'additionalControls',
    label: 'Additional / Proposed Controls',
    required: false,
    category: 'controls',
    description: 'Action plan, recommended controls, engineering modifications, or CAPA items.',
    aliases: ['additionalcontrols', 'additional controls', 'proposed controls', 'recommended action', 'mitigation', 'action plan', 'further controls'],
  },
  {
    key: 'residualLikelihood',
    label: 'Residual Likelihood',
    required: false,
    category: 'controls',
    description: 'Likelihood after proposed controls are implemented (1 to 5).',
    aliases: ['residuallikelihood', 'residual likelihood', 'res likelihood', 'residual prob', 'residual probability'],
  },
  {
    key: 'residualSeverity',
    label: 'Residual Severity',
    required: false,
    category: 'controls',
    description: 'Severity after proposed controls are implemented (1 to 5).',
    aliases: ['residualseverity', 'residual severity', 'res severity', 'residual consequence', 'residual impact'],
  },
  {
    key: 'residualRiskRating',
    label: 'Residual Risk Rating',
    required: false,
    category: 'controls',
    description: 'Residual Risk tier: Low, Medium, High, or Critical.',
    aliases: ['residualriskrating', 'residual risk rating', 'residual risk', 'res risk rating', 'res risk'],
  },

  // Governance & Tracking
  {
    key: 'responsiblePerson',
    label: 'Responsible Person',
    required: false,
    category: 'governance',
    description: 'Action owner or assigned manager.',
    aliases: ['responsibleperson', 'responsible person', 'action owner', 'assignee', 'owner', 'responsible', 'assigned to'],
  },
  {
    key: 'targetCompletionDate',
    label: 'Target Completion Date',
    required: false,
    category: 'governance',
    description: 'Due date for controls completion (YYYY-MM-DD or standard date).',
    aliases: ['targetcompletiondate', 'target completion date', 'target date', 'due date', 'completion date', 'deadline'],
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    category: 'governance',
    description: 'Open, In Progress, Closed. Defaults to Open.',
    aliases: ['status', 'hazard status', 'state', 'workflow status'],
  },
  {
    key: 'dateIdentified',
    label: 'Date Identified',
    required: false,
    category: 'governance',
    description: 'Date hazard observation was recorded.',
    aliases: ['dateidentified', 'date identified', 'date', 'reported date', 'identification date', 'logged date'],
  },
  {
    key: 'reportedBy',
    label: 'Reported By',
    required: false,
    category: 'governance',
    description: 'Name or identifier of observer/reporter.',
    aliases: ['reportedby', 'reported by', 'reporter', 'observer', 'identified by', 'logged by'],
  },
  {
    key: 'sourceReference',
    label: 'Source / Reference',
    required: false,
    category: 'governance',
    description: 'Audit finding number, external inspection report, or cross-reference.',
    aliases: ['sourcereference', 'source reference', 'reference', 'audit ref', 'inspection ref', 'source'],
  },
  {
    key: 'remarks',
    label: 'Remarks',
    required: false,
    category: 'governance',
    description: 'General observations, review notes, or additional comments.',
    aliases: ['remarks', 'notes', 'comments', 'additional remarks'],
  },
];

// Helper to normalize text values
function normalizeStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

// Convert Excel dates (serial numbers or text strings) to YYYY-MM-DD
function parseExcelDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial date to JS Date
    const utcDays = Math.floor(val - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  const str = String(val).trim();
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  // General Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return str;
}

// Map descriptive or numeric Likelihood (1-5)
function parseLikelihood(val: any): number {
  if (!val) return 3;
  const num = Number(val);
  if (!isNaN(num) && num >= 1 && num <= 5) return Math.round(num);
  const s = String(val).toLowerCase().trim();
  if (s.includes('rare') || s.includes('very unlikely')) return 1;
  if (s.includes('unlikely') || s.includes('remote')) return 2;
  if (s.includes('possible') || s.includes('occasional')) return 3;
  if (s.includes('likely') || s.includes('probable')) return 4;
  if (s.includes('almost certain') || s.includes('frequent') || s.includes('high')) return 5;
  return 3;
}

// Map descriptive or numeric Severity (1-5)
function parseSeverity(val: any): number {
  if (!val) return 3;
  const num = Number(val);
  if (!isNaN(num) && num >= 1 && num <= 5) return Math.round(num);
  const s = String(val).toLowerCase().trim();
  if (s.includes('negligible') || s.includes('first aid') || s.includes('insignificant')) return 1;
  if (s.includes('minor') || s.includes('medical treatment')) return 2;
  if (s.includes('moderate') || s.includes('lost time')) return 3;
  if (s.includes('major') || s.includes('permanent disability')) return 4;
  if (s.includes('catastrophic') || s.includes('fatality') || s.includes('critical')) return 5;
  return 3;
}

// Calculate Risk Tier from Severity x Likelihood
function computeRiskTier(severity: number, likelihood: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  const score = severity * likelihood;
  if (score >= 15) return 'Critical';
  if (score >= 10) return 'High';
  if (score >= 5) return 'Medium';
  return 'Low';
}

export const HazardImportModal: React.FC<HazardImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  existingHazards,
  departments,
  locations,
  users,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard Steps: 1: Upload, 2: Mapping, 3: Validation & Resolution, 4: ID Preview & Confirmation, 5: Importing
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // File & Workbook state
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);

  // Column Mapping state: { [systemFieldKey]: excelColumnName }
  const [fieldMapping, setFieldMapping] = useState<{ [key: string]: string }>({});
  const [retainCustomFields, setRetainCustomFields] = useState<boolean>(true);

  // Conflict Resolution: 'skip_duplicates' | 'update_existing' | 'insert_only'
  const [conflictMode, setConflictMode] = useState<'skip_duplicates' | 'update_existing' | 'insert_only'>('skip_duplicates');

  // Processed Records & Validation state
  const [validatedRecords, setValidatedRecords] = useState<any[]>([]);
  const [allocatedIds, setAllocatedIds] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ row: number; field: string; error: string }[]>([]);
  const [duplicateConflicts, setDuplicateConflicts] = useState<{ row: number; hazardId: string; type: 'exact' | 'potential'; reason: string; existingRecord?: HazardReport }[]>([]);

  // Import Execution & Progress
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; percentage: number }>({ current: 0, total: 0, percentage: 0 });
  const [importResults, setImportResults] = useState<{
    success: boolean;
    batchId: string;
    insertedCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
  } | null>(null);

  // Reset wizard
  const resetState = () => {
    setCurrentStep(1);
    setFile(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setRawRows([]);
    setExcelHeaders([]);
    setFieldMapping({});
    setValidatedRecords([]);
    setAllocatedIds([]);
    setValidationErrors([]);
    setDuplicateConflicts([]);
    setIsImporting(false);
    setImportProgress({ current: 0, total: 0, percentage: 0 });
    setImportResults(null);
  };

  if (!isOpen) return null;

  // Handle Excel Template Download
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          'Hazard ID': 'HAZ-000001',
          'Hazard Title / Description': 'High-pressure hydraulic hose vibrating near walkway',
          'Hazard Category': 'Mechanical',
          'Department': 'Manufacturing',
          'Location / Work Area': 'Stamping Press Bay 2',
          'Activity / Task': 'Die changeover',
          'Hazard Source': 'Hydraulic power pack line',
          'Potential Consequences': 'High pressure injection injury, oil slip hazard',
          'Persons at Risk': 'Press operators, maintenance technicians',
          'Existing Control Measures': 'Daily visual walk-around inspection',
          'Likelihood': 4,
          'Severity': 4,
          'Initial Risk Rating': 'Critical',
          'Additional / Proposed Controls': 'Install anti-whip safety sleeve and secure clamp bracket',
          'Residual Likelihood': 1,
          'Residual Severity': 2,
          'Residual Risk Rating': 'Low',
          'Responsible Person': 'David Chen',
          'Target Completion Date': '2026-10-30',
          'Status': 'Open',
          'Date Identified': '2026-10-15',
          'Reported By': 'Marcus Vance',
          'Source / Reference': 'AUD-2026-08',
          'Remarks': 'Line runs at 250 bar operating pressure',
        },
        {
          'Hazard ID': '', // Leave blank to test automatic HAZ-XXXXXX generation
          'Hazard Title / Description': 'Emergency exit corridor restricted by wooden staging pallets',
          'Hazard Category': 'Fire',
          'Department': 'Logistics & Warehousing',
          'Location / Work Area': 'Exit Door B-14',
          'Activity / Task': 'Pallet put-away',
          'Hazard Source': 'Buffer staging overflow',
          'Potential Consequences': 'Impeded evacuation route during building alarm',
          'Persons at Risk': 'Warehouse staff, contractors',
          'Existing Control Measures': 'Emergency exit signage illuminated',
          'Likelihood': 3,
          'Severity': 4,
          'Initial Risk Rating': 'High',
          'Additional / Proposed Controls': 'Relocate pallets immediately and paint yellow keep-clear box',
          'Residual Likelihood': 1,
          'Residual Severity': 2,
          'Residual Risk Rating': 'Low',
          'Responsible Person': 'Sarah Jenkins',
          'Target Completion Date': '2026-10-22',
          'Status': 'In Progress',
          'Date Identified': '2026-10-16',
          'Reported By': 'Elena Rostova',
          'Source / Reference': 'HSE-WALK-OCT',
          'Remarks': 'Immediate clearance enforced on shift hand-over',
        },
        {
          'Hazard ID': '',
          'Hazard Title / Description': 'Organic solvent vapor odor detected near extraction bench',
          'Hazard Category': 'Chemical',
          'Department': 'Quality Control',
          'Location / Work Area': 'Main Chemical Testing Lab',
          'Activity / Task': 'Solvent purity titration',
          'Hazard Source': 'Fume hood sash counterbalance cable slack',
          'Potential Consequences': 'Respiratory irritation, VOC exposure',
          'Persons at Risk': 'QC analysts',
          'Existing Control Measures': 'N95 masks, general ventilation',
          'Likelihood': 3,
          'Severity': 3,
          'Initial Risk Rating': 'Medium',
          'Additional / Proposed Controls': 'Calibrate capture velocity and replace hood sash cable',
          'Residual Likelihood': 1,
          'Residual Severity': 1,
          'Residual Risk Rating': 'Low',
          'Responsible Person': 'Elena Rostova',
          'Target Completion Date': '2026-10-28',
          'Status': 'Open',
          'Date Identified': '2026-10-16',
          'Reported By': 'Sarah Jenkins',
          'Source / Reference': 'LAB-ENV-44',
          'Remarks': 'Air monitoring sample collected',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);

      // Auto-size columns for neat display
      const colWidths = Object.keys(templateData[0]).map((key) => ({
        wch: Math.max(key.length + 3, 16),
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Hazard_Register');

      XLSX.writeFile(wb, 'EHS_Hazard_Register_Import_Template.xlsx');
      toast.success('Hazard Register Excel template downloaded successfully.');
    } catch (err: any) {
      toast.error('Failed to generate Excel template: ' + err.message);
    }
  };

  // Handle File Selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.endsWith('.xlsx') && !uploadedFile.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls).');
      return;
    }

    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        const firstSheet = wb.SheetNames[0];
        setSelectedSheet(firstSheet);
        parseWorksheet(wb, firstSheet);
      } catch (err: any) {
        toast.error('Error reading Excel file: ' + err.message);
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  // Parse worksheet data and auto-map headers
  const parseWorksheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

    // Filter out completely blank rows
    const nonBlankRows = data.filter((row) =>
      Object.values(row).some((val) => normalizeStr(val).length > 0)
    );

    if (nonBlankRows.length === 0) {
      toast.warning(`Sheet "${sheetName}" contains no readable records.`);
      setRawRows([]);
      setExcelHeaders([]);
      return;
    }

    setRawRows(nonBlankRows);

    // Extract headers from first non-blank row
    const headers = Object.keys(nonBlankRows[0]);
    setExcelHeaders(headers);

    // Auto-detect column mapping
    const newMapping: { [key: string]: string } = {};
    HAZARD_SYSTEM_FIELDS.forEach((sysField) => {
      const matchedHeader = headers.find((h) => {
        const cleanHeader = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        return sysField.aliases.some((alias) => {
          const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanHeader === cleanAlias || cleanHeader.includes(cleanAlias);
        });
      });
      if (matchedHeader) {
        newMapping[sysField.key] = matchedHeader;
      }
    });

    setFieldMapping(newMapping);
    toast.info(`Parsed ${nonBlankRows.length} rows from sheet "${sheetName}".`);
  };

  // Change selected sheet
  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (workbook) {
      parseWorksheet(workbook, newSheet);
    }
  };

  // Proceed to Step 2: Review Mapping
  const handleGoToMapping = () => {
    if (rawRows.length === 0) {
      toast.warning('No records found to import.');
      return;
    }
    setCurrentStep(2);
  };

  // Validate records and check duplicates
  const handleRunValidation = async () => {
    const titleHeader = fieldMapping['title'];
    if (!titleHeader) {
      toast.error('You must map the required "Hazard Title / Description" field.');
      return;
    }

    const errors: { row: number; field: string; error: string }[] = [];
    const conflicts: { row: number; hazardId: string; type: 'exact' | 'potential'; reason: string; existingRecord?: HazardReport }[] = [];
    const parsedRecords: any[] = [];

    // Existing hazard index
    const existingHazardIdMap = new Map<string, HazardReport>();
    const existingTitleDeptMap = new Map<string, HazardReport>();

    existingHazards.forEach((h) => {
      if (h.hazardId) {
        existingHazardIdMap.set(h.hazardId.trim().toUpperCase(), h);
      }
      const key = `${(h.title || '').trim().toLowerCase()}|${h.departmentId || ''}`;
      existingTitleDeptMap.set(key, h);
    });

    // Count how many records need a new generated Hazard ID
    let missingIdCount = 0;
    const preferredIds: string[] = [];

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2; // Excel 1-based + header
      const rawTitle = normalizeStr(row[titleHeader]);

      if (!rawTitle) {
        errors.push({
          row: rowNum,
          field: 'Hazard Title / Description',
          error: 'Required field is empty.',
        });
      }

      const idHeader = fieldMapping['hazardId'];
      const rawId = idHeader ? normalizeStr(row[idHeader]) : '';
      if (!rawId) {
        missingIdCount++;
      } else {
        preferredIds.push(rawId);
      }
    });

    // Request allocated sequential IDs from the server / Firestore transaction
    let serverAllocatedIds: string[] = [];
    try {
      if (missingIdCount > 0) {
        const allocRes = await api.allocateHazardIds(missingIdCount, preferredIds);
        serverAllocatedIds = allocRes.allocatedIds;
      }
    } catch (allocErr) {
      console.warn('Fallback: allocating IDs client-side via sequence', allocErr);
      const startNum = existingHazards.length + 1;
      for (let i = 0; i < missingIdCount; i++) {
        serverAllocatedIds.push(`HAZ-${String(startNum + i).padStart(6, '0')}`);
      }
    }

    setAllocatedIds(serverAllocatedIds);

    let allocatedCursor = 0;

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const getVal = (fieldKey: string) => {
        const header = fieldMapping[fieldKey];
        return header ? row[header] : undefined;
      };

      const rawTitle = normalizeStr(getVal('title'));
      const rawId = normalizeStr(getVal('hazardId'));
      const rawCategory = normalizeStr(getVal('hazardCategory')) || 'Physical';
      const rawDept = normalizeStr(getVal('department')) || 'General Operations';
      const rawLoc = normalizeStr(getVal('location')) || 'Main Facility';
      const rawActivity = normalizeStr(getVal('activity'));
      const rawSource = normalizeStr(getVal('hazardSource'));
      const rawConsequences = normalizeStr(getVal('potentialConsequences'));
      const rawPersons = normalizeStr(getVal('personsAtRisk'));
      const rawExistingControls = normalizeStr(getVal('existingControls'));

      // Likelihood & Severity parsing
      const likelihood = parseLikelihood(getVal('likelihood'));
      const severity = parseSeverity(getVal('severity'));
      const initialRiskScore = likelihood * severity;
      const initialRiskRating = normalizeStr(getVal('initialRiskRating')) || computeRiskTier(severity, likelihood);

      // Residuals
      const rawAdditionalControls = normalizeStr(getVal('additionalControls'));
      const residualLikelihood = getVal('residualLikelihood') ? parseLikelihood(getVal('residualLikelihood')) : Math.max(1, likelihood - 1);
      const residualSeverity = getVal('residualSeverity') ? parseSeverity(getVal('residualSeverity')) : Math.max(1, severity - 1);
      const residualRiskScore = residualLikelihood * residualSeverity;
      const residualRiskRating = normalizeStr(getVal('residualRiskRating')) || computeRiskTier(residualSeverity, residualLikelihood);

      const rawResp = normalizeStr(getVal('responsiblePerson'));
      const rawTargetDate = parseExcelDate(getVal('targetCompletionDate'));
      const rawDateIdentified = parseExcelDate(getVal('dateIdentified')) || new Date().toISOString().split('T')[0];
      const rawStatus = normalizeStr(getVal('status')) || 'Open';
      const rawReportedBy = normalizeStr(getVal('reportedBy'));
      const rawRef = normalizeStr(getVal('sourceReference'));
      const rawRemarks = normalizeStr(getVal('remarks'));

      // Unmapped columns for custom field retention
      const customData: Record<string, any> = {};
      if (retainCustomFields) {
        const mappedHeaders = new Set(Object.values(fieldMapping));
        excelHeaders.forEach((h) => {
          if (!mappedHeaders.has(h) && row[h] !== undefined && row[h] !== '') {
            customData[h] = row[h];
          }
        });
      }

      // Final Hazard ID determination
      let finalHazardId = rawId;
      let idGenerated = false;

      if (!finalHazardId) {
        finalHazardId = serverAllocatedIds[allocatedCursor] || `HAZ-${String(Date.now() + idx).slice(-6)}`;
        allocatedCursor++;
        idGenerated = true;
      }

      // Check duplicates
      const upperId = finalHazardId.toUpperCase();
      const existingMatch = existingHazardIdMap.get(upperId);

      if (existingMatch) {
        conflicts.push({
          row: rowNum,
          hazardId: finalHazardId,
          type: 'exact',
          reason: `Hazard ID "${finalHazardId}" already exists in the system (${existingMatch.title}).`,
          existingRecord: existingMatch,
        });
      } else {
        // Check potential duplicate by title + department
        const titleKey = `${rawTitle.toLowerCase()}|${rawDept.toLowerCase()}`;
        if (existingTitleDeptMap.has(titleKey)) {
          conflicts.push({
            row: rowNum,
            hazardId: finalHazardId,
            type: 'potential',
            reason: `Potential duplicate: Identical title and department already registered.`,
            existingRecord: existingTitleDeptMap.get(titleKey),
          });
        }
      }

      parsedRecords.push({
        rowNum,
        hazardId: finalHazardId,
        idGenerated,
        title: rawTitle,
        hazardCategory: rawCategory,
        department: rawDept,
        location: rawLoc,
        activity: rawActivity,
        hazardSource: rawSource,
        potentialConsequences: rawConsequences,
        personsAtRisk: rawPersons,
        existingControls: rawExistingControls,
        likelihood,
        severity,
        initialRiskScore,
        initialRiskRating,
        additionalControls: rawAdditionalControls,
        residualLikelihood,
        residualSeverity,
        residualRiskScore,
        residualRiskRating,
        responsiblePerson: rawResp,
        targetCompletionDate: rawTargetDate,
        dateIdentified: rawDateIdentified,
        status: rawStatus,
        reportedBy: rawReportedBy,
        sourceReference: rawRef,
        remarks: rawRemarks,
        customFields: customData,
      });
    });

    setValidationErrors(errors);
    setDuplicateConflicts(conflicts);
    setValidatedRecords(parsedRecords);

    setCurrentStep(3);
  };

  // Download Validation Error Report as an Excel file
  const handleDownloadErrorReport = () => {
    try {
      if (validationErrors.length === 0 && duplicateConflicts.length === 0) {
        toast.info('No validation errors or duplicate conflicts to download.');
        return;
      }

      const errorRows = validationErrors.map((e) => ({
        'Row Number': e.row,
        'Issue Type': 'Validation Error',
        'Field / Item': e.field,
        'Details & Guidance': e.error,
      }));

      const conflictRows = duplicateConflicts.map((c) => ({
        'Row Number': c.row,
        'Issue Type': c.type === 'exact' ? 'Exact Duplicate ID' : 'Potential Duplicate Content',
        'Field / Item': c.hazardId,
        'Details & Guidance': c.reason,
      }));

      const combined = [...errorRows, ...conflictRows];

      const ws = XLSX.utils.json_to_sheet(combined);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Validation_Issues');

      XLSX.writeFile(wb, `Hazard_Import_Validation_Errors_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Validation issues downloaded to Excel.');
    } catch (err: any) {
      toast.error('Failed to export error report: ' + err.message);
    }
  };

  // Execute Import to Cloud Firestore and synchronize with backend
  const handleExecuteImport = async () => {
    try {
      setIsImporting(true);
      setCurrentStep(5);

      // Filter records according to conflict mode
      const conflictRowNumbers = new Set(duplicateConflicts.map((c) => c.row));
      const errorRowNumbers = new Set(validationErrors.map((e) => e.row));

      const importableRecords = validatedRecords.filter((rec) => {
        // Exclude hard validation failures
        if (errorRowNumbers.has(rec.rowNum)) return false;

        if (conflictRowNumbers.has(rec.rowNum)) {
          if (conflictMode === 'skip_duplicates') return false;
          // 'update_existing' or 'insert_only' proceed
        }
        return true;
      });

      if (importableRecords.length === 0) {
        toast.warning('No valid records to import based on your selected conflict resolution settings.');
        setIsImporting(false);
        setCurrentStep(3);
        return;
      }

      const batchId = `IMP-HAZ-${Date.now()}`;
      const timestamp = new Date().toISOString();

      const batchMetadata: ImportBatchMetadata = {
        batchId,
        fileName: file?.name || 'hazard_register.xlsx',
        totalRows: rawRows.length,
        importedCount: importableRecords.length,
        skippedCount: rawRows.length - importableRecords.length - validationErrors.length,
        failedCount: validationErrors.length,
        importedBy: users[0]?.email || 'ehs-admin@apex.local',
        timestamp,
        status: validationErrors.length > 0 ? 'Completed with Errors' : 'Success',
      };

      // 1. Commit to Firebase Cloud Firestore with batched writes & progress
      const firestoreRecords: FirestoreHazardRecord[] = importableRecords.map((rec) => ({
        hazardId: rec.hazardId,
        title: rec.title,
        hazardCategory: rec.hazardCategory,
        department: rec.department,
        location: rec.location,
        activity: rec.activity,
        hazardSource: rec.hazardSource,
        potentialConsequences: rec.potentialConsequences,
        personsAtRisk: rec.personsAtRisk,
        existingControls: rec.existingControls,
        likelihood: rec.likelihood,
        severity: rec.severity,
        initialRiskScore: rec.initialRiskScore,
        initialRiskRating: rec.initialRiskRating,
        additionalControls: rec.additionalControls,
        residualLikelihood: rec.residualLikelihood,
        residualSeverity: rec.residualSeverity,
        residualRiskScore: rec.residualRiskScore,
        residualRiskRating: rec.residualRiskRating,
        responsiblePerson: rec.responsiblePerson,
        targetCompletionDate: rec.targetCompletionDate,
        status: rec.status,
        dateIdentified: rec.dateIdentified,
        reportedBy: rec.reportedBy,
        sourceReference: rec.sourceReference,
        remarks: rec.remarks,
        customFields: rec.customFields,
        importBatchId: batchId,
        originalFileName: file?.name || 'hazard_register.xlsx',
        importedAt: timestamp,
        importedBy: batchMetadata.importedBy,
        recordSource: 'Excel Import',
      }));

      await batchImportHazardsToFirestore(
        firestoreRecords,
        batchMetadata,
        { conflictMode },
        (processed, total) => {
          setImportProgress({
            current: processed,
            total,
            percentage: Math.round((processed / total) * 100),
          });
        }
      );

      // 2. Synchronize with Application Cloud SQL Database for instant register and matrix visibility
      await api.batchSyncHazards(firestoreRecords, {
        conflictMode,
        batchId,
        fileName: file?.name || 'hazard_register.xlsx',
      });

      // Import Finished
      setImportResults({
        success: true,
        batchId,
        insertedCount: importableRecords.length,
        updatedCount: conflictMode === 'update_existing' ? duplicateConflicts.length : 0,
        skippedCount: rawRows.length - importableRecords.length,
        failedCount: validationErrors.length,
      });

      toast.success(`Successfully imported ${importableRecords.length} hazards to Cloud Firestore!`);
      await onImportComplete();
    } catch (err: any) {
      console.error('Import failed:', err);
      toast.error('Failed to import hazard register: ' + (err.message || 'Unknown error'));
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Hazard Register Excel Import</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Cloud className="w-3 h-3" /> Firestore Linked
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Upload existing workplace hazards, auto-generate sequential Hazard IDs, and save to Cloud Firestore
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Indicator */}
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto">
            {[
              { num: 1, title: 'Upload Excel' },
              { num: 2, title: 'Map Fields' },
              { num: 3, title: 'Validate & Conflicts' },
              { num: 4, title: 'ID Generation Preview' },
              { num: 5, title: 'Importing' },
            ].map((step) => (
              <div
                key={step.num}
                className={`flex items-center gap-1.5 whitespace-nowrap ${
                  currentStep === step.num
                    ? 'text-amber-400 font-semibold'
                    : currentStep > step.num
                    ? 'text-emerald-400 font-medium'
                    : 'text-slate-500'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    currentStep === step.num
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : currentStep > step.num
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {currentStep > step.num ? <Check className="w-3 h-3" /> : step.num}
                </div>
                <span>{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Body / Steps */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Upload & Sheet Selector */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Instructions Banner */}
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-slate-200">Standard Excel Hazard Register Template</p>
                    <p className="text-slate-400">
                      Use our predefined format with columns for Hazard ID, Likelihood, Severity, Controls, and Target Dates.
                      If your sheet already has different headings, you can map them in the next step.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors whitespace-nowrap shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel Template</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  file
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-slate-700 hover:border-amber-500/50 hover:bg-slate-800/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                    file ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-amber-400'
                  }`}
                >
                  <Upload className="w-7 h-7" />
                </div>

                {file ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{file.name}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB • {rawRows.length} records identified
                    </p>
                    <span className="inline-block mt-2 text-[11px] text-amber-400 underline">
                      Click to choose another workbook
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-200">
                      Click to browse or drop your Excel file here
                    </p>
                    <p className="text-xs text-slate-400">Supports .xlsx and .xls formats</p>
                  </div>
                )}
              </div>

              {/* Worksheet Selector if multiple sheets */}
              {sheetNames.length > 1 && (
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span className="font-medium text-slate-300">Select Worksheet to Import:</span>
                  </div>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-semibold focus:outline-none focus:border-amber-500"
                  >
                    {sheetNames.map((sheet) => (
                      <option key={sheet} value={sheet}>
                        {sheet}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Data Preview Table */}
              {rawRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      Quick Sheet Preview ({Math.min(5, rawRows.length)} of {rawRows.length} rows):
                    </span>
                    <span className="text-slate-400">Columns Detected: {excelHeaders.length}</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-900/90 text-slate-400 font-mono border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          {excelHeaders.slice(0, 6).map((h) => (
                            <th key={h} className="py-2 px-3 font-semibold text-slate-300 truncate max-w-[150px]">
                              {h}
                            </th>
                          ))}
                          {excelHeaders.length > 6 && <th className="py-2 px-3 text-slate-500">+{excelHeaders.length - 6} more</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {rawRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-1.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                            {excelHeaders.slice(0, 6).map((h) => (
                              <td key={h} className="py-1.5 px-3 truncate max-w-[150px]">
                                {String(row[h] || '—')}
                              </td>
                            ))}
                            {excelHeaders.length > 6 && <td className="py-1.5 px-3 text-slate-600">...</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Review & Custom Column Mapping */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Review Column Mappings</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    We automatically detected and mapped column headings from your sheet. Adjust mappings if needed.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={retainCustomFields}
                      onChange={(e) => setRetainCustomFields(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0"
                    />
                    <span>Retain unmapped columns as custom fields</span>
                  </label>
                </div>
              </div>

              {/* Grouped field mappings */}
              <div className="space-y-4">
                {[
                  { id: 'identification', title: '1. Hazard Identification & Source' },
                  { id: 'risk', title: '2. Initial Risk Assessment' },
                  { id: 'controls', title: '3. Controls & Residual Risk' },
                  { id: 'governance', title: '4. Governance, Status & Tracking' },
                ].map((group) => {
                  const fieldsInGroup = HAZARD_SYSTEM_FIELDS.filter((f) => f.category === group.id);
                  return (
                    <div key={group.id} className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-3">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400/90 font-mono">
                        {group.title}
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {fieldsInGroup.map((field) => {
                          const currentMapped = fieldMapping[field.key] || '';
                          return (
                            <div
                              key={field.key}
                              className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col justify-between gap-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                                  <span>{field.label}</span>
                                  {field.required && (
                                    <span className="text-[10px] text-rose-400 font-bold">*Required</span>
                                  )}
                                </label>
                                {currentMapped && (
                                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                                    <Check className="w-3 h-3" /> Mapped
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 line-clamp-1">{field.description}</p>
                              <select
                                value={currentMapped}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFieldMapping((prev) => ({
                                    ...prev,
                                    [field.key]: val,
                                  }));
                                }}
                                className={`w-full mt-1 px-2.5 py-1.5 rounded-lg text-xs font-medium focus:outline-none ${
                                  currentMapped
                                    ? 'bg-slate-800 border border-emerald-500/40 text-white'
                                    : field.required
                                    ? 'bg-rose-950/20 border border-rose-500/40 text-rose-300'
                                    : 'bg-slate-800 border border-slate-700 text-slate-400'
                                }`}
                              >
                                <option value="">-- Do not map (leave empty) --</option>
                                {excelHeaders.map((header) => (
                                  <option key={header} value={header}>
                                    Column: {header}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Validation, Duplicate Detection & Conflict Choices */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400 font-medium">Total Rows</div>
                  <div className="text-xl font-bold text-white font-mono mt-1">{validatedRecords.length}</div>
                </div>
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="text-[11px] text-emerald-400 font-medium">Valid Records</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                    {validatedRecords.length - validationErrors.length}
                  </div>
                </div>
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <div className="text-[11px] text-rose-400 font-medium">Validation Errors</div>
                  <div className="text-xl font-bold text-rose-400 font-mono mt-1">{validationErrors.length}</div>
                </div>
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="text-[11px] text-amber-400 font-medium">Duplicate Conflicts</div>
                  <div className="text-xl font-bold text-amber-400 font-mono mt-1">{duplicateConflicts.length}</div>
                </div>
              </div>

              {/* Conflict Resolution Choices */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                      Duplicate Conflict Resolution Strategy
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      How should records matching existing Hazard IDs or content be handled?
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  {[
                    {
                      id: 'skip_duplicates',
                      title: 'Skip Duplicates (Recommended)',
                      desc: 'Preserve existing records unchanged. Only import brand-new hazards.',
                    },
                    {
                      id: 'update_existing',
                      title: 'Update Existing Hazards',
                      desc: 'Overwrite existing records that share matching Hazard IDs with new data.',
                    },
                    {
                      id: 'insert_only',
                      title: 'Force New Records',
                      desc: 'Generate fresh sequential Hazard IDs for all rows and import as separate hazards.',
                    },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-colors ${
                        conflictMode === opt.id
                          ? 'bg-amber-500/10 border-amber-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="conflictMode"
                          value={opt.id}
                          checked={conflictMode === opt.id}
                          onChange={() => setConflictMode(opt.id as any)}
                          className="text-amber-500 focus:ring-0 bg-slate-800 border-slate-700"
                        />
                        <span className="text-xs font-bold text-slate-200">{opt.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 pl-5">{opt.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* Validation & Conflict Log */}
              {(validationErrors.length > 0 || duplicateConflicts.length > 0) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Validation & Duplicate Conflict Log</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium rounded-lg border border-slate-700"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Download Validation Error Report (.xlsx)</span>
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs">
                    {validationErrors.map((err, i) => (
                      <div
                        key={`err-${i}`}
                        className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2.5"
                      >
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-rose-300">Row {err.row}: </span>
                          <span className="font-semibold text-white">{err.field}</span> —{' '}
                          <span className="text-slate-300">{err.error}</span>
                        </div>
                      </div>
                    ))}

                    {duplicateConflicts.map((conf, i) => (
                      <div
                        key={`conf-${i}`}
                        className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5"
                      >
                        <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-300">Row {conf.row}: </span>
                          <span className="font-semibold text-white">ID [{conf.hazardId}]</span> —{' '}
                          <span className="text-slate-300">{conf.reason}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: ID Generation Preview & Confirmation */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Automatic Sequential Hazard ID Allocation</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Every imported hazard is assigned a unique permanent Hazard ID in the standard{' '}
                    <code className="text-amber-300 font-bold">HAZ-XXXXXX</code> format.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Total Valid Records</span>
                  <div className="text-xl font-bold text-white font-mono">
                    {validatedRecords.length - validationErrors.length}
                  </div>
                </div>
              </div>

              {/* Records preview before import */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    Preview Ready Records ({Math.min(10, validatedRecords.length)} shown):
                  </span>
                  <span className="text-slate-400">Conflict Policy: {conflictMode}</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 max-h-72">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-900/90 text-slate-400 font-mono border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Hazard ID</th>
                        <th className="py-2 px-3">Title / Description</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Dept & Location</th>
                        <th className="py-2 px-3">Initial Risk</th>
                        <th className="py-2 px-3">Residual Risk</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {validatedRecords.map((rec) => (
                        <tr key={rec.hazardId} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-mono font-bold text-amber-400 whitespace-nowrap">
                            {rec.hazardId}
                            {rec.idGenerated && (
                              <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-sans">
                                Generated
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-100 max-w-xs truncate">{rec.title}</td>
                          <td className="py-2 px-3 text-slate-300 whitespace-nowrap">{rec.hazardCategory}</td>
                          <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                            {rec.department} • {rec.location}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                rec.initialRiskRating === 'Critical'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : rec.initialRiskRating === 'High'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : rec.initialRiskRating === 'Medium'
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                            >
                              {rec.initialRiskRating} ({rec.initialRiskScore})
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                              {rec.residualRiskRating} ({rec.residualRiskScore})
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Importing Progress & Final Summary */}
          {currentStep === 5 && (
            <div className="py-8 space-y-6 flex flex-col items-center justify-center text-center">
              {isImporting ? (
                <div className="space-y-4 w-full max-w-md">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500 border-t-transparent animate-spin mx-auto" />
                  <div>
                    <h4 className="text-base font-bold text-white">Importing to Cloud Firestore...</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Writing batched documents to <code className="text-amber-400">/hazards</code> collection and synchronizing register
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>
                      {importProgress.current} of {importProgress.total} records
                    </span>
                    <span>{importProgress.percentage}%</span>
                  </div>
                </div>
              ) : importResults ? (
                <div className="space-y-6 w-full max-w-lg">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">Import Complete!</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Batch ID: <span className="font-mono text-amber-300">{importResults.batchId}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="text-[11px] text-emerald-400 font-medium">Successfully Added</div>
                      <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                        {importResults.insertedCount}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="text-[11px] text-amber-400 font-medium">Updated</div>
                      <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                        {importResults.updatedCount}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="text-[11px] text-slate-400 font-medium">Skipped / Failed</div>
                      <div className="text-xl font-bold text-slate-400 font-mono mt-1">
                        {importResults.skippedCount + importResults.failedCount}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    All imported records have been permanently saved in Cloud Firestore and are now active in the Risk Matrix and Consolidated Hazard Register.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div>
            {currentStep > 1 && currentStep < 5 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 5 && (
              <button
                type="button"
                onClick={() => {
                  resetState();
                  onClose();
                }}
                className="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            )}

            {currentStep === 1 && (
              <button
                type="button"
                disabled={rawRows.length === 0}
                onClick={handleGoToMapping}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <span>Review Column Mapping</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                onClick={handleRunValidation}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                <span>Validate Records & Duplicates</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                <span>Preview Assigned Hazard IDs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-md shadow-emerald-950/40"
              >
                <Cloud className="w-4 h-4" />
                <span>Confirm & Import to Cloud Firestore</span>
              </button>
            )}

            {currentStep === 5 && !isImporting && (
              <button
                type="button"
                onClick={() => {
                  resetState();
                  onClose();
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
