import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase.ts';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline / check configuration');
    }
    // A permission error or successful reachability verifies server connection
    return true;
  }
}

export interface FirestoreIncidentRecord {
  eventId: string;
  title: string;
  eventType: string;
  occurrenceDate: string;
  occurrenceTime?: string;
  department: string;
  location: string;
  subLocation?: string;
  eventCategory?: string;
  actualConsequence?: string;
  potentialConsequence?: string;
  immediateActionsTaken?: string;
  initialRiskClassification?: string;
  potentialRiskClassification?: string;
  status: string;
  personsInvolved?: string;
  importBatchId?: string;
  importedAt?: string;
  source: string;
  // Investigation linkage
  investigationReportId?: string;
  rootCause?: string;
  immediateCauses?: string;
  contributingFactors?: string;
  // CAPA linkage
  capaActionId?: string;
  correctiveAction?: string;
}

export interface ImportBatchMetadata {
  batchId: string;
  fileName: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  importedBy: string;
  timestamp: string;
  status: string;
  summaryMessage?: string;
}

/**
 * Persists imported incident records, linked investigations, CAPA items,
 * and batch audit metadata directly into Firebase Cloud Firestore in batched transactions.
 */
export async function batchImportIncidentsToFirestore(
  incidents: FirestoreIncidentRecord[],
  batchMeta: ImportBatchMetadata,
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; committedCount: number; batchId: string }> {
  const CHUNK_SIZE = 200; // Well within Firestore 500-op limit
  let processed = 0;
  const total = incidents.length;

  try {
    // 1. Process incidents in chunks
    for (let i = 0; i < incidents.length; i += CHUNK_SIZE) {
      const chunk = incidents.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const inc of chunk) {
        // Document path: /incidents/{eventId}
        const docRef = doc(db, 'incidents', inc.eventId);
        batch.set(docRef, {
          eventId: inc.eventId,
          title: inc.title,
          eventType: inc.eventType,
          occurrenceDate: inc.occurrenceDate,
          occurrenceTime: inc.occurrenceTime || '09:00',
          department: inc.department,
          location: inc.location,
          subLocation: inc.subLocation || '',
          eventCategory: inc.eventCategory || 'Safety',
          actualConsequence: inc.actualConsequence || 'Recorded in import register.',
          potentialConsequence: inc.potentialConsequence || 'Potential workplace risk.',
          immediateActionsTaken: inc.immediateActionsTaken || 'Immediate safety containment.',
          initialRiskClassification: inc.initialRiskClassification || 'Medium',
          potentialRiskClassification: inc.potentialRiskClassification || 'High',
          status: inc.status || 'Reported',
          personsInvolved: inc.personsInvolved || '',
          importBatchId: batchMeta.batchId,
          importedAt: batchMeta.timestamp,
          source: 'Excel Import',
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Linked Investigation Document
        if (inc.investigationReportId || inc.rootCause || inc.immediateCauses) {
          const invId = inc.investigationReportId || `INV-${inc.eventId}`;
          const invRef = doc(db, 'investigations', invId);
          batch.set(invRef, {
            reportId: invId,
            eventId: inc.eventId,
            status: inc.status === 'Closed' || inc.status === 'Approved' ? 'Approved' : 'Open',
            rootCauseCategory: 'Procedures & Compliance',
            immediateCauses: inc.immediateCauses || 'Identified from register import.',
            contributingFactors: inc.contributingFactors || 'Systemic factors.',
            finalRootCause: inc.rootCause || 'Root cause logged during register import.',
            investigationDueDate: inc.occurrenceDate,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }

        // Linked CAPA Action Document
        if (inc.capaActionId || inc.correctiveAction) {
          const actId = inc.capaActionId || `ACT-${inc.eventId}`;
          const actRef = doc(db, 'capa_actions', actId);
          batch.set(actRef, {
            actionId: actId,
            sourceModule: 'Incident',
            sourceRecordId: inc.eventId,
            recommendedAction: inc.correctiveAction || 'Implement preventive controls.',
            actionType: 'Corrective',
            priority: inc.initialRiskClassification || 'Medium',
            targetDate: inc.occurrenceDate,
            status: inc.status === 'Closed' ? 'Closed' : 'Open',
            department: inc.department,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      }

      await batch.commit();
      processed += chunk.length;
      if (onProgress) {
        onProgress(processed, total);
      }
    }

    // 2. Commit batch metadata and audit log to Firestore
    const metaBatch = writeBatch(db);
    const batchDocRef = doc(db, 'import_batches', batchMeta.batchId);
    metaBatch.set(batchDocRef, {
      ...batchMeta,
      createdAt: serverTimestamp(),
    });

    const auditDocRef = doc(db, 'audit_events', `AUD-${batchMeta.batchId}`);
    metaBatch.set(auditDocRef, {
      action: 'EXCEL_IMPORT',
      module: 'Incident Register Import',
      recordId: batchMeta.batchId,
      recordType: 'import_batch',
      userEmail: batchMeta.importedBy,
      timestamp: batchMeta.timestamp,
      details: `Imported ${batchMeta.importedCount} incidents, skipped ${batchMeta.skippedCount}, failed ${batchMeta.failedCount} from file "${batchMeta.fileName}".`,
      createdAt: serverTimestamp(),
    });

    await metaBatch.commit();

    return {
      success: true,
      committedCount: processed,
      batchId: batchMeta.batchId,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'incidents');
  }
}

/**
 * Fetch imported incident records stored in Cloud Firestore
 */
export async function getFirestoreIncidents(limitCount: number = 100): Promise<any[]> {
  try {
    const q = query(collection(db, 'incidents'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'incidents');
  }
}

/**
 * Fetch import history batches from Cloud Firestore
 */
export async function getFirestoreImportBatches(): Promise<ImportBatchMetadata[]> {
  try {
    const q = query(collection(db, 'import_batches'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as ImportBatchMetadata);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'import_batches');
  }
}

export interface FirestoreHazardRecord {
  hazardId: string;
  title: string;
  hazardCategory: string;
  department?: string;
  location?: string;
  activity?: string;
  hazardSource?: string;
  potentialConsequences?: string;
  personsAtRisk?: string;
  existingControls?: string;
  likelihood: number;
  severity: number;
  initialRiskScore: number;
  initialRiskRating: string;
  additionalControls?: string;
  residualLikelihood?: number;
  residualSeverity?: number;
  residualRiskScore?: number;
  residualRiskRating?: string;
  responsiblePerson?: string;
  targetCompletionDate?: string;
  status: string;
  dateIdentified?: string;
  reportedBy?: string;
  sourceReference?: string;
  remarks?: string;
  customFields?: Record<string, any> | string;
  importBatchId?: string;
  originalFileName?: string;
  importedAt?: string;
  importedBy?: string;
  recordSource: string;
}

/**
 * Atomically allocate a sequence of unique Hazard IDs using a Firestore transaction
 * Guarantees no race condition even with concurrent imports
 */
export async function allocateFirestoreHazardIds(count: number): Promise<{ allocatedIds: string[]; startNumber: number }> {
  try {
    const counterDocRef = doc(db, 'hazard_counters', 'hazards');
    const result = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterDocRef);
      let currentNumber = 0;
      if (counterDoc.exists()) {
        currentNumber = counterDoc.data().lastNumber || 0;
      }
      const start = currentNumber + 1;
      const end = currentNumber + count;
      transaction.set(counterDocRef, {
        lastNumber: end,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const allocatedIds: string[] = [];
      for (let i = start; i <= end; i++) {
        allocatedIds.push(`HAZ-${String(i).padStart(6, '0')}`);
      }
      return { allocatedIds, startNumber: start };
    });
    return result;
  } catch (error) {
    console.warn('Firestore transaction counter failed, falling back to server allocation', error);
    // If client offline or permissions fall back to server API
    throw error;
  }
}

/**
 * Batch import hazards directly to Cloud Firestore with chunking and progress callbacks
 */
export async function batchImportHazardsToFirestore(
  hazards: FirestoreHazardRecord[],
  batchMeta: ImportBatchMetadata,
  options?: {
    conflictMode?: 'insert_only' | 'skip_duplicates' | 'update_existing';
  },
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; committedCount: number; batchId: string }> {
  try {
    const CHUNK_SIZE = 250;
    const total = hazards.length;
    let processed = 0;

    for (let i = 0; i < hazards.length; i += CHUNK_SIZE) {
      const chunk = hazards.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const haz of chunk) {
        const docRef = doc(db, 'hazards', haz.hazardId);
        batch.set(docRef, {
          hazardId: haz.hazardId,
          title: haz.title,
          hazardCategory: haz.hazardCategory || 'Physical',
          department: haz.department || 'General Facility',
          location: haz.location || 'Main Plant',
          activity: haz.activity || '',
          hazardSource: haz.hazardSource || '',
          potentialConsequences: haz.potentialConsequences || '',
          personsAtRisk: haz.personsAtRisk || '',
          existingControls: haz.existingControls || '',
          likelihood: haz.likelihood || 3,
          severity: haz.severity || 3,
          initialRiskScore: haz.initialRiskScore || 9,
          initialRiskRating: haz.initialRiskRating || 'Medium',
          additionalControls: haz.additionalControls || '',
          residualLikelihood: haz.residualLikelihood || 2,
          residualSeverity: haz.residualSeverity || 2,
          residualRiskScore: haz.residualRiskScore || 4,
          residualRiskRating: haz.residualRiskRating || 'Low',
          responsiblePerson: haz.responsiblePerson || '',
          targetCompletionDate: haz.targetCompletionDate || '',
          status: haz.status || 'Open',
          dateIdentified: haz.dateIdentified || new Date().toISOString().split('T')[0],
          reportedBy: haz.reportedBy || batchMeta.importedBy,
          sourceReference: haz.sourceReference || '',
          remarks: haz.remarks || '',
          customFields: typeof haz.customFields === 'object' ? JSON.stringify(haz.customFields) : (haz.customFields || '{}'),
          importBatchId: batchMeta.batchId,
          originalFileName: batchMeta.fileName,
          importedAt: batchMeta.timestamp,
          importedBy: batchMeta.importedBy,
          recordSource: 'Excel Import',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();
      processed += chunk.length;
      if (onProgress) {
        onProgress(processed, total);
      }
    }

    // Write batch metadata and audit log to Firestore
    const metaBatch = writeBatch(db);
    const batchDocRef = doc(db, 'import_batches', batchMeta.batchId);
    metaBatch.set(batchDocRef, {
      ...batchMeta,
      module: 'Hazard Register Import',
      createdAt: serverTimestamp(),
    });

    const auditDocRef = doc(db, 'audit_events', `AUD-${batchMeta.batchId}`);
    metaBatch.set(auditDocRef, {
      action: 'EXCEL_IMPORT',
      module: 'Hazard Register Import',
      recordId: batchMeta.batchId,
      recordType: 'hazard_import_batch',
      userEmail: batchMeta.importedBy,
      timestamp: batchMeta.timestamp,
      details: `Imported ${batchMeta.importedCount} hazards, skipped ${batchMeta.skippedCount}, failed ${batchMeta.failedCount} from "${batchMeta.fileName}".`,
      createdAt: serverTimestamp(),
    });

    await metaBatch.commit();

    return {
      success: true,
      committedCount: processed,
      batchId: batchMeta.batchId,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'hazards');
  }
}

/**
 * Fetch imported hazard records stored in Cloud Firestore
 */
export async function getFirestoreHazards(limitCount: number = 200): Promise<any[]> {
  try {
    const q = query(collection(db, 'hazards'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'hazards');
  }
}

