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
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { Department, Location, User, EventItem } from '../../types/index.ts';
import { batchImportIncidentsToFirestore, FirestoreIncidentRecord } from '../../services/firestoreService.ts';
import firebaseConfig from '../../../firebase-applet-config.json';

interface IncidentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => Promise<void>;
  existingEvents: EventItem[];
  departments: Department[];
  locations: Location[];
  users: User[];
}

// System target fields definition
interface TargetField {
  key: string;
  label: string;
  required: boolean;
  category: 'core' | 'classification' | 'context' | 'investigation' | 'capa';
  description: string;
  aliases: string[];
}

const SYSTEM_FIELDS: TargetField[] = [
  // Core
  {
    key: 'eventId',
    label: 'Event ID / Reference No.',
    required: false,
    category: 'core',
    description: 'Existing reference number (e.g. EVT-2024-001). If blank, a unique EVT-YYYY-XXXXXX is generated.',
    aliases: ['eventid', 'event id', 'incident id', 'ref no', 'reference', 'reference no', 'incident reference', 'id'],
  },
  {
    key: 'title',
    label: 'Incident Title / Summary',
    required: true,
    category: 'core',
    description: 'Concise description of the event or near-miss occurrence.',
    aliases: ['title', 'incident title', 'event title', 'description', 'brief description', 'incident description', 'summary'],
  },
  {
    key: 'occurrenceDate',
    label: 'Occurrence Date',
    required: true,
    category: 'core',
    description: 'Date the incident occurred (YYYY-MM-DD or DD/MM/YYYY).',
    aliases: ['occurrencedate', 'date', 'incident date', 'occurrence date', 'event date', 'date of incident'],
  },
  {
    key: 'occurrenceTime',
    label: 'Occurrence Time',
    required: false,
    category: 'core',
    description: 'Time the incident occurred (e.g. 09:30 or 14:00). Defaults to 09:00.',
    aliases: ['occurrencetime', 'time', 'incident time', 'occurrence time', 'time of incident'],
  },
  {
    key: 'eventType',
    label: 'Incident Type / Classification',
    required: false,
    category: 'classification',
    description: 'Near Miss, First Aid, Medical Treatment, Lost Time (LTI), Environmental, Property Damage, etc.',
    aliases: ['eventtype', 'type', 'event type', 'incident type', 'classification', 'injury type'],
  },
  {
    key: 'eventCategory',
    label: 'Event Category',
    required: false,
    category: 'classification',
    description: 'Safety, Environmental, Health, Process Safety, Security, Quality.',
    aliases: ['eventcategory', 'category', 'event category', 'incident category', 'domain'],
  },
  {
    key: 'department',
    label: 'Department / Area',
    required: false,
    category: 'context',
    description: 'Department name or code. Matched automatically to existing departments.',
    aliases: ['department', 'dept', 'department name', 'department code', 'area', 'business unit'],
  },
  {
    key: 'location',
    label: 'Plant / Facility Location',
    required: false,
    category: 'context',
    description: 'Facility, Plant, or Site. Matched automatically to existing locations.',
    aliases: ['location', 'plant', 'facility', 'site', 'location name', 'location code', 'premises'],
  },
  {
    key: 'subLocation',
    label: 'Sub-Location / Zone',
    required: false,
    category: 'context',
    description: 'Specific unit, line, or room within the plant.',
    aliases: ['sublocation', 'sub location', 'zone', 'unit', 'line', 'section', 'room'],
  },
  {
    key: 'initialRiskClassification',
    label: 'Initial Risk Level',
    required: false,
    category: 'classification',
    description: 'Low, Medium, High, or Critical.',
    aliases: ['initialrisk', 'initial risk', 'risk', 'initial risk classification', 'severity rating', 'risk rating'],
  },
  {
    key: 'potentialRiskClassification',
    label: 'Potential Risk Level',
    required: false,
    category: 'classification',
    description: 'Worst-case realistic potential risk (Low, Medium, High, Critical).',
    aliases: ['potentialrisk', 'potential risk', 'potential risk classification', 'worst case risk'],
  },
  {
    key: 'status',
    label: 'Incident Status',
    required: false,
    category: 'classification',
    description: 'Reported, Under Investigation, Under Review, Approved, Closed.',
    aliases: ['status', 'incident status', 'state', 'investigation status'],
  },
  {
    key: 'actualConsequence',
    label: 'Actual Consequence / Severity',
    required: false,
    category: 'context',
    description: 'Description of actual injury, damage, or environmental release.',
    aliases: ['actualconsequence', 'actual consequence', 'consequence', 'outcome', 'actual outcome', 'impact'],
  },
  {
    key: 'potentialConsequence',
    label: 'Potential Consequence',
    required: false,
    category: 'context',
    description: 'Potential severity if barriers had completely failed.',
    aliases: ['potentialconsequence', 'potential consequence', 'potential outcome', 'potential impact'],
  },
  {
    key: 'immediateActionsTaken',
    label: 'Immediate Actions Taken',
    required: false,
    category: 'context',
    description: 'Containment, isolation, or first aid delivered immediately.',
    aliases: ['immediateactions', 'immediate actions', 'immediate actions taken', 'actions taken', 'containment'],
  },
  {
    key: 'reportedBy',
    label: 'Reported By (Name or Email)',
    required: false,
    category: 'context',
    description: 'Name or email of the reporting employee or officer.',
    aliases: ['reportedby', 'reported by', 'reporter', 'reporter email', 'reported by user'],
  },
  {
    key: 'assignedRgl',
    label: 'Assigned RGL / Supervisor',
    required: false,
    category: 'context',
    description: 'Responsible Group Leader overseeing verification.',
    aliases: ['assignedrgl', 'rgl', 'assigned rgl', 'supervisor', 'reviewing rgl', 'leader'],
  },
  {
    key: 'assignedRp',
    label: 'Assigned RP / Investigator',
    required: false,
    category: 'context',
    description: 'Responsible Person carrying out investigation and CAPA.',
    aliases: ['assignedrp', 'rp', 'assigned rp', 'investigator', 'lead investigator'],
  },
  {
    key: 'investigationDueDate',
    label: 'Investigation Due Date',
    required: false,
    category: 'context',
    description: 'Target completion date for statutory investigation.',
    aliases: ['investigationduedate', 'investigation due date', 'due date', 'target completion date'],
  },
  {
    key: 'personsInvolved',
    label: 'Persons Involved',
    required: false,
    category: 'context',
    description: 'Names, roles, or badge numbers of involved personnel.',
    aliases: ['personsinvolved', 'persons involved', 'injured person', 'person involved'],
  },
  {
    key: 'witnesses',
    label: 'Witnesses',
    required: false,
    category: 'context',
    description: 'Names of witnesses to the event.',
    aliases: ['witnesses', 'witness'],
  },
  // Auto-Link Integration Fields
  {
    key: 'rootCause',
    label: 'Investigation Root Cause (Links Report)',
    required: false,
    category: 'investigation',
    description: 'If provided, automatically generates and links an Incident Investigation Report.',
    aliases: ['rootcause', 'root cause', 'final root cause', 'root cause finding', 'cause'],
  },
  {
    key: 'immediateCauses',
    label: 'Immediate Causes',
    required: false,
    category: 'investigation',
    description: 'Unsafe acts or substandard conditions directly leading to the incident.',
    aliases: ['immediatecauses', 'immediate causes', 'direct cause', 'direct causes'],
  },
  {
    key: 'contributingFactors',
    label: 'Contributing Factors',
    required: false,
    category: 'investigation',
    description: 'Underlying environmental, operational, or organizational factors.',
    aliases: ['contributingfactors', 'contributing factors', 'indirect causes'],
  },
  {
    key: 'correctiveAction',
    label: 'CAPA Action Description (Links Action Item)',
    required: false,
    category: 'capa',
    description: 'If provided, automatically generates and links an active CAPA Action Item (ACT-YYYY-XXXXXX).',
    aliases: ['correctiveaction', 'corrective action', 'capa', 'capa action', 'recommended action', 'action item'],
  },
  {
    key: 'actionPriority',
    label: 'CAPA Action Priority',
    required: false,
    category: 'capa',
    description: 'Low, Medium, High, or Critical priority for the generated action item.',
    aliases: ['actionpriority', 'action priority', 'capa priority', 'priority'],
  },
  {
    key: 'actionTargetDate',
    label: 'CAPA Action Target Date',
    required: false,
    category: 'capa',
    description: 'Due date for corrective action completion.',
    aliases: ['actiontargetdate', 'action target date', 'action due date', 'capa target date'],
  },
];

export const IncidentImportModal: React.FC<IncidentImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  existingEvents,
  departments,
  locations,
  users,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state: 1 = upload, 2 = map columns, 3 = preview & validate, 4 = summary report
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // File parsing state
  const [fileName, setFileName] = useState<string>('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Column mapping: systemKey -> sourceColumnHeader
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Options
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update'>('skip');

  // Preview & Validation state
  const [validationFilter, setValidationFilter] = useState<'all' | 'valid' | 'warning' | 'error'>('all');
  const [previewPage, setPreviewPage] = useState<number>(1);
  const rowsPerPage = 8;

  // Processing state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [importResults, setImportResults] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState<{ percent: number; stage: string; current: number; total: number }>({
    percent: 0,
    stage: '',
    current: 0,
    total: 0,
  });
  const [firestoreBatchInfo, setFirestoreBatchInfo] = useState<{
    batchId: string;
    committedCount: number;
    synced: boolean;
  } | null>(null);

  // Reset modal state
  const handleReset = () => {
    setStep(1);
    setFileName('');
    setSheetNames([]);
    setSelectedSheet('');
    setWorkbook(null);
    setSourceHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setDuplicateHandling('skip');
    setValidationFilter('all');
    setPreviewPage(1);
    setIsImporting(false);
    setImportSummary(null);
    setImportResults([]);
    setImportProgress({ percent: 0, stage: '', current: 0, total: 0 });
    setFirestoreBatchInfo(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Helper: auto-map column headers to system fields using aliases
  const autoMapColumns = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const usedHeaders = new Set<string>();

    SYSTEM_FIELDS.forEach((field) => {
      // Find best match among headers
      const matched = headers.find((h) => {
        if (usedHeaders.has(h)) return false;
        const normalized = h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        return field.aliases.some((alias) => {
          const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalized === normAlias || normalized.includes(normAlias);
        });
      });

      if (matched) {
        mapping[field.key] = matched;
        usedHeaders.add(matched);
      } else {
        mapping[field.key] = '';
      }
    });

    return mapping;
  };

  // Handle file selection and parsing
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary', cellDates: true });
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          toast.error('The selected file does not contain any readable spreadsheet sheets.');
          return;
        }

        const initialSheet = wb.SheetNames[0];
        const sheet = wb.Sheets[initialSheet];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: '', raw: false });

        if (json.length === 0) {
          toast.error('No incident data rows found in the selected sheet.');
          return;
        }

        const headers = Object.keys(json[0]);
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setSelectedSheet(initialSheet);
        setFileName(file.name);
        setSourceHeaders(headers);
        setRawRows(json);

        // Compute auto-mapping
        const initialMapping = autoMapColumns(headers);
        setColumnMapping(initialMapping);

        setStep(2);
        toast.success(`Loaded "${file.name}" (${json.length} records detected).`);
      } catch (err: any) {
        console.error('File parsing error:', err);
        toast.error('Failed to parse file: ' + (err.message || 'Invalid format'));
      }
    };

    reader.readAsBinaryString(file);
  };

  // Switch sheet inside workbook
  const handleSheetChange = (newSheetName: string) => {
    if (!workbook) return;
    try {
      const sheet = workbook.Sheets[newSheetName];
      const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: '', raw: false });
      if (json.length === 0) {
        toast.warning(`Sheet "${newSheetName}" is empty.`);
        return;
      }
      const headers = Object.keys(json[0]);
      setSelectedSheet(newSheetName);
      setSourceHeaders(headers);
      setRawRows(json);
      setColumnMapping(autoMapColumns(headers));
      toast.info(`Switched to sheet "${newSheetName}" (${json.length} rows).`);
    } catch (err: any) {
      toast.error('Error switching sheet: ' + err.message);
    }
  };

  // Validate mapped rows
  const validatedRecords = useMemo(() => {
    if (rawRows.length === 0) return [];

    const existingEventIds = new Set(existingEvents.map((e) => e.eventId.toUpperCase().trim()));

    return rawRows.map((row, idx) => {
      const rowNumber = idx + 1;
      const mappedRecord: Record<string, any> = {};

      SYSTEM_FIELDS.forEach((f) => {
        const sourceHeader = columnMapping[f.key];
        mappedRecord[f.key] = sourceHeader && row[sourceHeader] !== undefined ? String(row[sourceHeader]).trim() : '';
      });

      const errors: string[] = [];
      const warnings: string[] = [];

      // Check required title
      if (!mappedRecord.title) {
        errors.push('Missing Incident Title / Summary');
      }

      // Check required date
      if (!mappedRecord.occurrenceDate) {
        warnings.push('Date is missing - system will default to today');
      }

      // Check existing Event ID
      const eventId = mappedRecord.eventId;
      const isDuplicate = eventId && existingEventIds.has(eventId.toUpperCase());
      if (isDuplicate) {
        if (duplicateHandling === 'skip') {
          warnings.push(`Event ID "${eventId}" exists in database; will be preserved & skipped`);
        } else {
          warnings.push(`Event ID "${eventId}" exists in database; will be updated`);
        }
      }

      // Auto-generated ID notice
      if (!eventId) {
        mappedRecord._autoGenerateId = true;
      }

      let status: 'valid' | 'warning' | 'error' = 'valid';
      if (errors.length > 0) status = 'error';
      else if (warnings.length > 0) status = 'warning';

      return {
        rowNumber,
        record: mappedRecord,
        status,
        errors,
        warnings,
        isDuplicate,
      };
    });
  }, [rawRows, columnMapping, duplicateHandling, existingEvents]);

  // Validation Summary Stats
  const validationStats = useMemo(() => {
    const total = validatedRecords.length;
    const valid = validatedRecords.filter((r) => r.status === 'valid').length;
    const warning = validatedRecords.filter((r) => r.status === 'warning').length;
    const error = validatedRecords.filter((r) => r.status === 'error').length;
    const duplicates = validatedRecords.filter((r) => r.isDuplicate).length;
    const ready = total - error;
    return { total, valid, warning, error, duplicates, ready };
  }, [validatedRecords]);

  // Filtered rows for preview table
  const filteredPreviewRows = useMemo(() => {
    if (validationFilter === 'all') return validatedRecords;
    return validatedRecords.filter((r) => r.status === validationFilter);
  }, [validatedRecords, validationFilter]);

  // Execute Import
  const handleExecuteImport = async () => {
    // Collect records to import (skip errors)
    const validToImport = validatedRecords
      .filter((r) => r.status !== 'error')
      .map((r) => r.record);

    if (validToImport.length === 0) {
      toast.error('No valid incident records to import. Please check mapping or source data.');
      return;
    }

    setIsImporting(true);
    setImportProgress({
      percent: 15,
      stage: 'Ingesting and normalizing records in incident database...',
      current: 0,
      total: validToImport.length,
    });

    try {
      // Step 1: Ingest into backend relational DB (generates Event IDs, links investigations, CAPAs)
      const response = await api.importIncidents({
        records: validToImport,
        duplicateHandling,
      });

      setImportProgress({
        percent: 50,
        stage: 'Batch importing records into Firebase Cloud Firestore...',
        current: 0,
        total: validToImport.length,
      });

      // Step 2: Prepare Firestore documents from imported results
      const batchId = `IMP-2026-${Date.now().toString().slice(-6)}`;
      const timestamp = new Date().toISOString();

      const firestoreRecords: FirestoreIncidentRecord[] = response.results
        .filter((r: any) => r.status === 'imported' || r.status === 'updated')
        .map((r: any, idx: number) => {
          const original = validToImport[r.rowNumber - 1] || validToImport[idx] || {};
          return {
            eventId: r.eventId,
            title: r.title || original.title,
            eventType: original.eventType || 'Near Miss',
            occurrenceDate: original.occurrenceDate || new Date().toISOString().split('T')[0],
            occurrenceTime: original.occurrenceTime || '09:00',
            department: original.department || 'Operations',
            location: original.location || 'Main Facility',
            subLocation: original.subLocation || '',
            eventCategory: original.eventCategory || 'Safety',
            actualConsequence: original.actualConsequence || 'Recorded in import register.',
            potentialConsequence: original.potentialConsequence || 'Potential workplace risk.',
            immediateActionsTaken: original.immediateActionsTaken || 'Immediate containment.',
            initialRiskClassification: original.initialRiskClassification || 'Medium',
            potentialRiskClassification: original.potentialRiskClassification || 'High',
            status: original.status || 'Reported',
            personsInvolved: original.personsInvolved || '',
            importBatchId: batchId,
            importedAt: timestamp,
            source: 'Excel Import',
            investigationReportId: r.linkedInvestigation,
            rootCause: original.rootCause || original.finalRootCause,
            immediateCauses: original.immediateCauses,
            contributingFactors: original.contributingFactors,
            capaActionId: r.linkedAction,
            correctiveAction: original.correctiveAction || original.recommendedAction,
          };
        });

      // Step 3: Batch write into Firebase Cloud Firestore
      if (firestoreRecords.length > 0) {
        const firestoreResult = await batchImportIncidentsToFirestore(
          firestoreRecords,
          {
            batchId,
            fileName: fileName || 'Incident_Register.xlsx',
            totalRows: validatedRecords.length,
            importedCount: response.summary.importedCount,
            skippedCount: response.summary.skippedCount,
            failedCount: response.summary.failedCount,
            importedBy: 'numairaman71@gmail.com',
            timestamp,
            status: response.summary.failedCount > 0 ? 'Completed with Warnings' : 'Success',
            summaryMessage: `Successfully imported ${response.summary.importedCount} incidents into Firebase Cloud Firestore.`,
          },
          (processed, total) => {
            const p = 50 + Math.round((processed / total) * 50);
            setImportProgress({
              percent: p,
              stage: `Writing Firestore batch (${processed}/${total} documents)...`,
              current: processed,
              total,
            });
          }
        );

        setFirestoreBatchInfo({
          batchId,
          committedCount: firestoreResult?.committedCount || firestoreRecords.length,
          synced: true,
        });
      }

      setImportSummary(response.summary);
      setImportResults(response.results);
      setStep(4);
      await onImportComplete();
      toast.success(
        `Import complete! ${response.summary.importedCount} incidents imported & persisted to Firebase Cloud Firestore.`
      );
    } catch (err: any) {
      console.error('Import failure:', err);
      toast.error(err.message || 'Failed to complete incident import.');
    } finally {
      setIsImporting(false);
    }
  };

  // Download Validation Error Report (.csv)
  const handleDownloadErrorReport = () => {
    const errorRows = validatedRecords.filter((r) => r.status === 'error' || r.errors.length > 0);
    if (errorRows.length === 0) {
      toast.info('No validation errors found in dataset.');
      return;
    }

    const reportHeaders = [
      'Row Number',
      'Event ID Reference',
      'Incident Title',
      'Validation Errors',
      'Warnings',
      'Recommended Fix',
    ];
    const rows = errorRows.map((r) => [
      r.rowNumber,
      `"${r.record.eventId || ''}"`,
      `"${(r.record.title || '').replace(/"/g, '""')}"`,
      `"${r.errors.join('; ').replace(/"/g, '""')}"`,
      `"${r.warnings.join('; ').replace(/"/g, '""')}"`,
      '"Check required fields (Title, Date) and ensure valid format."',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [reportHeaders.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Incident_Validation_Errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded Validation Error Report.');
  };

  // Download Sample Template (.xlsx)
  const handleDownloadSampleExcel = () => {
    const sampleData = [
      {
        'Event ID': 'EVT-2026-000101',
        'Incident Title': 'Forklift hydraulic oil seal breach near Staging Bay 3',
        'Occurrence Date': '2026-04-12',
        'Occurrence Time': '08:45',
        'Event Type': 'Near Miss',
        'Event Category': 'Safety',
        'Department': 'Logistics & Warehousing',
        'Facility Location': 'Main Chemical Plant',
        'Sub Location': 'Staging Bay 3',
        'Initial Risk': 'Medium',
        'Potential Risk': 'High',
        'Status': 'Under Review',
        'Actual Consequence': 'Approximately 2 liters of hydraulic oil pooled on concrete floor. Area cordoned off; no injuries.',
        'Potential Consequence': 'Slip/fall hazard with high pedestrian traffic or forklift skidding into pallet racks.',
        'Immediate Actions Taken': 'Dry absorbent compound applied immediately. Vehicle tagged out for workshop inspection.',
        'Reported By': 'sarah.miller@apexindustrial.com',
        'Assigned RGL': 'robert.chen@apexindustrial.com',
        'Assigned RP': 'marcus.vance@apexindustrial.com',
        'Persons Involved': 'Forklift Operator FL-08',
        'Witnesses': 'Bay 3 Lead Stager',
        'Investigation Root Cause': 'Seal fatigue occurred due to delayed PM schedule and heat buildup in transmission loop.',
        'Immediate Causes': 'Ruptured O-ring gasket under pressure.',
        'Contributing Factors': 'Heavy overtime shift duty without scheduled cool-down cycles.',
        'CAPA Action': 'Replace all secondary hydraulic seals on fleet units FL-01 through FL-12 with reinforced polymer O-rings.',
        'CAPA Priority': 'High',
        'CAPA Target Date': '2026-04-20',
      },
      {
        'Event ID': 'EVT-2026-000102',
        'Incident Title': 'Chemical splash on outer apron during solvent transfer',
        'Occurrence Date': '2026-04-14',
        'Occurrence Time': '14:20',
        'Event Type': 'First Aid Injury',
        'Event Category': 'Health',
        'Department': 'Chemical Processing',
        'Facility Location': 'Main Chemical Plant',
        'Sub Location': 'Tank Farm Delta',
        'Initial Risk': 'High',
        'Potential Risk': 'Critical',
        'Status': 'Approved',
        'Actual Consequence': 'Minor dermal irritation on left forearm; treated at on-site medical dispensary. Zero lost days.',
        'Potential Consequence': 'Severe chemical burns or eye contact had protective goggles not been worn.',
        'Immediate Actions Taken': 'Continuous eyewash and deluge shower rinse for 15 minutes. Neutralizing wash applied.',
        'Reported By': 'elena.rostova@apexindustrial.com',
        'Assigned RGL': 'robert.chen@apexindustrial.com',
        'Assigned RP': 'marcus.vance@apexindustrial.com',
        'Persons Involved': 'Junior Process Technician',
        'Witnesses': 'Shift Supervisor',
        'Investigation Root Cause': 'Manual coupling lever had mechanical slack allowing vapor-locked backpressure to surge during disconnect.',
        'Immediate Causes': 'Hose quick-connect clamp disengaged before depressurizing valve was opened.',
        'Contributing Factors': 'Inadequate interlock warning light on transfer station manifold.',
        'CAPA Action': 'Install automated pressure relief interlocks that prevent transfer coupling release while manifold is pressurized.',
        'CAPA Priority': 'Critical',
        'CAPA Target Date': '2026-04-28',
      },
      {
        'Event ID': '',
        'Incident Title': 'Emergency exit stairway illumination bulb failure',
        'Occurrence Date': '2026-04-15',
        'Occurrence Time': '18:10',
        'Event Type': 'Near Miss',
        'Event Category': 'Safety',
        'Department': 'Operations & Assembly',
        'Facility Location': 'West Assembly Hub',
        'Sub Location': 'Stairwell B',
        'Initial Risk': 'Low',
        'Potential Risk': 'Medium',
        'Status': 'Closed',
        'Actual Consequence': 'None. Deficiency noted during routine evening perimeter inspection.',
        'Potential Consequence': 'Trip and fall during facility emergency evacuation.',
        'Immediate Actions Taken': 'Temporary battery-powered work lamp positioned at landing.',
        'Reported By': 'david.kim@apexindustrial.com',
        'Assigned RGL': 'robert.chen@apexindustrial.com',
        'Assigned RP': 'marcus.vance@apexindustrial.com',
        'Persons Involved': 'Perimeter Inspector',
        'Witnesses': '',
        'Investigation Root Cause': 'LED driver burnt out due to power fluctuation in auxiliary distribution box.',
        'Immediate Causes': 'No voltage regulator installed on secondary lighting rail.',
        'Contributing Factors': '',
        'CAPA Action': 'Fit surge protector and LED ballast replacements across Stairwells A through D.',
        'CAPA Priority': 'Medium',
        'CAPA Target Date': '2026-04-18',
      },
      {
        'Event ID': '',
        'Incident Title': 'Overheated motor bearing on exhaust extraction blower EX-04',
        'Occurrence Date': '2026-04-16',
        'Occurrence Time': '11:05',
        'Event Type': 'Dangerous Occurrence',
        'Event Category': 'Environmental',
        'Department': 'Chemical Processing',
        'Facility Location': 'Main Chemical Plant',
        'Sub Location': 'Exhaust Scrubbing Stack',
        'Initial Risk': 'Medium',
        'Potential Risk': 'High',
        'Status': 'Reported',
        'Actual Consequence': 'Acoustic alarm triggered. Standby extractor automatically engaged; zero airborne emissions exceedance.',
        'Potential Consequence': 'Motor bearing seizure causing exhaust stoppage and solvent vapor accumulation.',
        'Immediate Actions Taken': 'Extractor EX-04 isolated and scheduled for maintenance overhaul.',
        'Reported By': 'ahmed.khalil@apexindustrial.com',
        'Assigned RGL': 'robert.chen@apexindustrial.com',
        'Assigned RP': 'marcus.vance@apexindustrial.com',
        'Persons Involved': 'Control Room Operator',
        'Witnesses': 'Maintenance Tech',
        'Investigation Root Cause': '',
        'Immediate Causes': '',
        'Contributing Factors': '',
        'CAPA Action': 'Perform thermographic ultrasound scan across all six scrubber blower motors.',
        'CAPA Priority': 'High',
        'CAPA Target Date': '2026-04-22',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Incident Register');
    XLSX.writeFile(wb, 'EHS_Incident_Register_Template.xlsx');
    toast.success('Downloaded "EHS_Incident_Register_Template.xlsx"');
  };

  // Download Sample Template (.csv)
  const handleDownloadSampleCsv = () => {
    const sampleHeaders = [
      'Event ID',
      'Incident Title',
      'Occurrence Date',
      'Occurrence Time',
      'Event Type',
      'Event Category',
      'Department',
      'Facility Location',
      'Sub Location',
      'Initial Risk',
      'Potential Risk',
      'Status',
      'Actual Consequence',
      'Potential Consequence',
      'Immediate Actions Taken',
      'Reported By',
      'Assigned RGL',
      'Assigned RP',
      'Investigation Root Cause',
      'CAPA Action',
    ];

    const row1 = [
      'EVT-2026-000101',
      '"Forklift hydraulic oil seal breach near Staging Bay 3"',
      '2026-04-12',
      '08:45',
      '"Near Miss"',
      'Safety',
      '"Logistics & Warehousing"',
      '"Main Chemical Plant"',
      '"Staging Bay 3"',
      'Medium',
      'High',
      '"Under Review"',
      '"2 liters of oil pooled on floor; area secured."',
      '"Slip/fall hazard or forklift skidding into racks."',
      '"Dry absorbent applied; vehicle tagged out."',
      'sarah.miller@apexindustrial.com',
      'robert.chen@apexindustrial.com',
      'marcus.vance@apexindustrial.com',
      '"Seal fatigue occurred due to deferred PM."',
      '"Replace all secondary hydraulic seals on fleet."',
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [sampleHeaders.join(','), row1.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'EHS_Incident_Register_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded "EHS_Incident_Register_Template.csv"');
  };

  // Download Import Audit Report (.csv)
  const handleDownloadAuditReport = () => {
    if (importResults.length === 0) return;

    const reportHeaders = [
      'Row Number',
      'Event ID',
      'Incident Title',
      'Import Status',
      'Diagnostic Message',
      'Linked Investigation Report ID',
      'Linked CAPA Action ID',
    ];

    const rows = importResults.map((r) => [
      r.rowNumber,
      `"${r.eventId || ''}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      r.status,
      `"${(r.message || '').replace(/"/g, '""')}"`,
      `"${r.linkedInvestigation || 'None'}"`,
      `"${r.linkedAction || 'None'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [reportHeaders.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Incident_Import_Audit_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded Import Audit & Error Report.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-4 text-xs">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Incident Register Import & System Integration</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono font-medium">
                  Step {step} of 4
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Upload Excel or CSV registers, map fields, deduplicate Event IDs, and auto-link investigations and CAPA
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Progress Steps */}
        <div className="px-6 py-2.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-[11px] flex-shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              1
            </span>
            <span className={step === 1 ? 'font-bold text-white' : 'text-slate-400'}>Upload File</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              2
            </span>
            <span className={step === 2 ? 'font-bold text-white' : 'text-slate-400'}>Map Columns</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              3
            </span>
            <span className={step === 3 ? 'font-bold text-white' : 'text-slate-400'}>Validate & Preview</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= 4 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              4
            </span>
            <span className={step === 4 ? 'font-bold text-white' : 'text-slate-400'}>Import Summary</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* STEP 1: UPLOAD FILE */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Drag & Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 hover:bg-slate-950/90 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 group-hover:scale-110 flex items-center justify-center text-emerald-400 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Click or drag & drop incident register file</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono">.xlsx</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono">.xls</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono">.csv</span>
                  <span>(Up to 25MB, up to 10,000 incident records)</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Sample Templates Download Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <FileDown className="w-4 h-4 text-emerald-400" />
                    <span>Need a standardized template?</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Download our ready-to-use register template with pre-configured headers, sample Near-Misses, LTIs, and Root Cause records.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleDownloadSampleExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Excel Template (.xlsx)</span>
                  </button>
                  <button
                    onClick={handleDownloadSampleCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV Template (.csv)</span>
                  </button>
                </div>
              </div>

              {/* System Integration Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Automatic Deduplication</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Preserves existing system data. Skips duplicate Event IDs or updates records based on your choice.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-[11px]">
                    <Layers className="w-4 h-4" />
                    <span>Investigation & CAPA Linkage</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Rows with root causes or corrective actions automatically create linked investigation reports & CAPA tickets.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px]">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Dashboard Metrics Sync</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Imported LTI and Recordable events immediately update TRIR, LTIFR, and departmental incident charts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MAP COLUMNS */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Workbook Details & Sheet Switcher */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-semibold text-white">{fileName}</span>
                    <span className="text-slate-400 ml-2">({rawRows.length} total rows)</span>
                  </div>
                </div>

                {sheetNames.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">Active Sheet:</span>
                    <select
                      value={selectedSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      {sheetNames.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Column Mapping Instruction */}
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <p>
                  Confirm or modify the mapping between your spreadsheet columns and the system's incident fields.
                </p>
                <button
                  onClick={() => setColumnMapping(autoMapColumns(sourceHeaders))}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Re-apply Smart Auto-Mapping</span>
                </button>
              </div>

              {/* Mapping Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <table className="w-full text-left divide-y divide-slate-800">
                  <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4 w-1/3">Target System Field</th>
                      <th className="py-2.5 px-4 w-1/3">Source File Column</th>
                      <th className="py-2.5 px-4 w-1/3">Sample Value (Row 1)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {SYSTEM_FIELDS.map((field) => {
                      const mappedColumn = columnMapping[field.key] || '';
                      const sampleVal =
                        mappedColumn && rawRows[0] && rawRows[0][mappedColumn] !== undefined
                          ? String(rawRows[0][mappedColumn])
                          : '-';

                      return (
                        <tr key={field.key} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{field.label}</span>
                              {field.required && (
                                <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] rounded font-bold uppercase">
                                  Required
                                </span>
                              )}
                              {field.category === 'investigation' && (
                                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] rounded font-bold uppercase">
                                  Links Investigation
                                </span>
                              )}
                              {field.category === 'capa' && (
                                <span className="px-1.5 py-0.2 bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[9px] rounded font-bold uppercase">
                                  Links CAPA
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">{field.description}</p>
                          </td>

                          <td className="py-2.5 px-4">
                            <select
                              value={mappedColumn}
                              onChange={(e) =>
                                setColumnMapping((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              className={`w-full bg-slate-900 border rounded-lg p-1.5 text-xs focus:outline-none ${
                                mappedColumn
                                  ? 'border-emerald-500/50 text-white'
                                  : field.required
                                  ? 'border-rose-500/50 text-slate-400'
                                  : 'border-slate-800 text-slate-400'
                              }`}
                            >
                              <option value="">-- Do Not Import / Skip --</option>
                              {sourceHeaders.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] truncate max-w-[200px]" title={sampleVal}>
                            {sampleVal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: VALIDATE & PREVIEW */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Validation Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400">Total Rows Detected</div>
                  <div className="text-xl font-bold text-white mt-1">{validationStats.total}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Parsed from sheet</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-emerald-400">Valid & Ready</div>
                  <div className="text-xl font-bold text-emerald-300 mt-1">{validationStats.ready}</div>
                  <div className="text-[10px] text-emerald-500/80 mt-0.5">Will be imported</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-amber-400">Existing Event IDs</div>
                  <div className="text-xl font-bold text-amber-300 mt-1">{validationStats.duplicates}</div>
                  <div className="text-[10px] text-amber-500/80 mt-0.5">
                    {duplicateHandling === 'skip' ? 'Will be skipped' : 'Will be updated'}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-rose-400">Invalid Rows</div>
                  <div className="text-xl font-bold text-rose-300 mt-1">{validationStats.error}</div>
                  <div className="text-[10px] text-rose-500/80 mt-0.5">Missing required title</div>
                </div>
              </div>

              {/* Deduplication & Handling Setting */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Duplicate Event ID Handling Strategy</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      duplicateHandling === 'skip'
                        ? 'bg-emerald-950/20 border-emerald-500/50 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dupHandling"
                      checked={duplicateHandling === 'skip'}
                      onChange={() => setDuplicateHandling('skip')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-semibold text-xs text-white">Skip Duplicates (Recommended)</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Preserves existing database incidents. Only inserts new records or unassigned IDs.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      duplicateHandling === 'update'
                        ? 'bg-sky-950/20 border-sky-500/50 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dupHandling"
                      checked={duplicateHandling === 'update'}
                      onChange={() => setDuplicateHandling('update')}
                      className="mt-0.5 text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <div className="font-semibold text-xs text-white">Update Existing Matching Records</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Overwrites fields for matching Event IDs while preserving historical audit timestamps.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview Filter & Pagination Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-lg">
                  <button
                    onClick={() => {
                      setValidationFilter('all');
                      setPreviewPage(1);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                      validationFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({validatedRecords.length})
                  </button>
                  <button
                    onClick={() => {
                      setValidationFilter('valid');
                      setPreviewPage(1);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                      validationFilter === 'valid'
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ready ({validationStats.valid})
                  </button>
                  <button
                    onClick={() => {
                      setValidationFilter('warning');
                      setPreviewPage(1);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                      validationFilter === 'warning'
                        ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Warnings ({validationStats.warning})
                  </button>
                  {validationStats.error > 0 && (
                    <button
                      onClick={() => {
                        setValidationFilter('error');
                        setPreviewPage(1);
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        validationFilter === 'error'
                          ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40'
                          : 'text-rose-400 hover:text-white'
                      }`}
                    >
                      Errors ({validationStats.error})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {validationStats.error > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-semibold transition-colors"
                      title="Download CSV report of records with validation issues"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Error Report ({validationStats.error})</span>
                    </button>
                  )}

                  <div className="text-[11px] text-slate-400">
                    Showing rows {(previewPage - 1) * rowsPerPage + 1} -{' '}
                    {Math.min(previewPage * rowsPerPage, filteredPreviewRows.length)} of {filteredPreviewRows.length}
                  </div>
                </div>
              </div>

              {/* Batch Import Progress Card (Active during import execution) */}
              {isImporting && (
                <div className="p-4 bg-slate-950 border border-emerald-500/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                      <span>{importProgress.stage || 'Executing batch import...'}</span>
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">{importProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-amber-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${importProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Batch processing in progress with Firebase Cloud Firestore synchronization</span>
                    <span>
                      {importProgress.current} / {importProgress.total} records
                    </span>
                  </div>
                </div>
              )}

              {/* Data Preview Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-800">
                    <thead className="bg-slate-900/80 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Row</th>
                        <th className="py-2.5 px-3">Validation Status</th>
                        <th className="py-2.5 px-3">Event ID</th>
                        <th className="py-2.5 px-3">Title & Summary</th>
                        <th className="py-2.5 px-3">Type & Category</th>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Integrations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px] text-slate-300">
                      {filteredPreviewRows
                        .slice((previewPage - 1) * rowsPerPage, previewPage * rowsPerPage)
                        .map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-500 font-semibold">
                              #{row.rowNumber}
                            </td>

                            <td className="py-2.5 px-3">
                              {row.status === 'valid' && (
                                <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-semibold">
                                  <Check className="w-3.5 h-3.5" /> Ready
                                </span>
                              )}
                              {row.status === 'warning' && (
                                <span
                                  className="inline-flex items-center gap-1 text-amber-400 text-[10px] font-semibold"
                                  title={row.warnings.join('; ')}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" /> Warning
                                </span>
                              )}
                              {row.status === 'error' && (
                                <span
                                  className="inline-flex items-center gap-1 text-rose-400 text-[10px] font-semibold"
                                  title={row.errors.join('; ')}
                                >
                                  <AlertCircle className="w-3.5 h-3.5" /> Incomplete
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 font-mono text-sky-400 font-semibold">
                              {row.record.eventId || (
                                <span className="text-slate-500 italic">[Auto-Gen ID]</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 max-w-[240px]">
                              <div className="font-medium text-white truncate">{row.record.title || '-'}</div>
                              {row.errors.length > 0 && (
                                <div className="text-[10px] text-rose-400 mt-0.5">{row.errors.join(', ')}</div>
                              )}
                              {row.warnings.length > 0 && (
                                <div className="text-[10px] text-amber-400/90 mt-0.5">{row.warnings.join(', ')}</div>
                              )}
                            </td>

                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                                {row.record.eventType || 'Near Miss'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">
                              {row.record.occurrenceDate || 'Default Today'} {row.record.occurrenceTime || ''}
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1">
                                {row.record.rootCause && (
                                  <span
                                    className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
                                    title={`Root cause: ${row.record.rootCause}`}
                                  >
                                    +INV
                                  </span>
                                )}
                                {row.record.correctiveAction && (
                                  <span
                                    className="px-1.5 py-0.2 rounded text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold"
                                    title={`Action: ${row.record.correctiveAction}`}
                                  >
                                    +CAPA
                                  </span>
                                )}
                                {!row.record.rootCause && !row.record.correctiveAction && (
                                  <span className="text-slate-600">-</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {filteredPreviewRows.length > rowsPerPage && (
                  <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs">
                    <button
                      onClick={() => setPreviewPage((p) => Math.max(p - 1, 1))}
                      disabled={previewPage === 1}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded"
                    >
                      Previous
                    </button>
                    <span className="text-slate-400 text-[11px]">
                      Page {previewPage} of {Math.ceil(filteredPreviewRows.length / rowsPerPage)}
                    </span>
                    <button
                      onClick={() =>
                        setPreviewPage((p) =>
                          Math.min(p + 1, Math.ceil(filteredPreviewRows.length / rowsPerPage))
                        )
                      }
                      disabled={previewPage >= Math.ceil(filteredPreviewRows.length / rowsPerPage)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: IMPORT SUMMARY & AUDIT */}
          {step === 4 && importSummary && (
            <div className="space-y-6">
              {/* Success Banner */}
              <div className="p-6 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Incident Register Successfully Integrated!</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Processed {importSummary.totalProcessed} records. All imported incidents are now live, searchable, and incorporated into TRIR/LTIFR calculations.
                  </p>
                </div>
              </div>

              {/* Metric Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400">Total Processed</div>
                  <div className="text-2xl font-bold text-white mt-1">{importSummary.totalProcessed}</div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-emerald-400">New Incidents</div>
                  <div className="text-2xl font-bold text-emerald-300 mt-1">{importSummary.importedCount}</div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-sky-400">Records Updated</div>
                  <div className="text-2xl font-bold text-sky-300 mt-1">{importSummary.updatedCount}</div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-amber-400">Duplicates Skipped</div>
                  <div className="text-2xl font-bold text-amber-300 mt-1">{importSummary.skippedCount}</div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-indigo-400">Investigations Linked</div>
                  <div className="text-2xl font-bold text-indigo-300 mt-1">
                    {importSummary.linkedInvestigationsCount}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-purple-400">CAPA Actions Linked</div>
                  <div className="text-2xl font-bold text-purple-300 mt-1">
                    {importSummary.linkedActionsCount}
                  </div>
                </div>
              </div>

              {/* Firebase Cloud Firestore Synchronization Status */}
              <div className="p-5 bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Firebase Cloud Firestore Database</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          ✓ Synced & Persisted
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Database ID: <code className="text-amber-300 font-mono text-[10px]">{firebaseConfig.firestoreDatabaseId || 'default'}</code> · Project: <code className="text-slate-300 font-mono text-[10px]">{firebaseConfig.projectId}</code>
                      </div>
                    </div>
                  </div>
                  {firestoreBatchInfo && (
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] text-slate-400 font-mono">
                        Batch ID: <span className="text-amber-400 font-bold">{firestoreBatchInfo.batchId}</span>
                      </div>
                      <div className="text-[10px] text-emerald-400 font-medium mt-0.5">
                        {firestoreBatchInfo.committedCount} documents persisted
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[10px]">Collection</div>
                    <div className="font-mono text-white text-xs font-semibold">/incidents</div>
                    <div className="text-emerald-400 text-[10px] mt-0.5">{importSummary.importedCount} records</div>
                  </div>
                  <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[10px]">Collection</div>
                    <div className="font-mono text-white text-xs font-semibold">/investigations</div>
                    <div className="text-indigo-400 text-[10px] mt-0.5">{importSummary.linkedInvestigationsCount} records</div>
                  </div>
                  <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[10px]">Collection</div>
                    <div className="font-mono text-white text-xs font-semibold">/capa_actions</div>
                    <div className="text-purple-400 text-[10px] mt-0.5">{importSummary.linkedActionsCount} records</div>
                  </div>
                  <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[10px]">Collection</div>
                    <div className="font-mono text-white text-xs font-semibold">/import_batches</div>
                    <div className="text-sky-400 text-[10px] mt-0.5">1 batch logged</div>
                  </div>
                  <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[10px]">Collection</div>
                    <div className="font-mono text-white text-xs font-semibold">/audit_events</div>
                    <div className="text-emerald-400 text-[10px] mt-0.5">Immutable audit trail</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons & Audit Report Download */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-xs font-bold text-white">Complete Traceability & Audit Trail Logged</h4>
                  <p className="text-[11px] text-slate-400">
                    Download the comprehensive CSV audit report with row-by-row status, linked investigation IDs, and CAPA action references.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {importSummary.failedCount > 0 && (
                    <button
                      onClick={handleDownloadErrorReport}
                      className="flex items-center gap-2 px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold transition-colors"
                      title="Download report of failed records"
                    >
                      <Download className="w-4 h-4 text-rose-400" />
                      <span>Download Error Report ({importSummary.failedCount})</span>
                    </button>
                  )}

                  <button
                    onClick={handleDownloadAuditReport}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Download className="w-4 h-4 text-sky-400" />
                    <span>Download Audit Report (.csv)</span>
                  </button>

                  <button
                    onClick={handleClose}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>View Incident Register</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between flex-shrink-0">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Upload</span>
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Mapping</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-xs font-semibold"
            >
              {step === 4 ? 'Close' : 'Cancel'}
            </button>

            {step === 2 && (
              <button
                type="button"
                onClick={() => {
                  if (!columnMapping.title) {
                    toast.error('Please map the "Incident Title / Summary" column before continuing.');
                    return;
                  }
                  setStep(3);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <span>Continue to Preview & Validate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isImporting || validationStats.ready === 0}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing Incidents...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Import {validationStats.ready} Incidents</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
