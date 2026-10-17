import { ActionItem, AuditEventItem, Department, DocumentItem, EmergencyDrill, EventItem, HazardReport, IncidentReport, InspectionEvent, Location, Meeting, NotificationItem, Organization, TrainingSession, User } from '../types/index.ts';

let simulatedUserId: number | null = null;
let currentToken: string | null = null;

export function setSimulatedUser(userId: number | null) {
  simulatedUserId = userId;
  if (userId) {
    localStorage.setItem('ehs_sim_user_id', String(userId));
  } else {
    localStorage.removeItem('ehs_sim_user_id');
  }
}

export function getSimulatedUserId(): number | null {
  if (simulatedUserId !== null) return simulatedUserId;
  const stored = localStorage.getItem('ehs_sim_user_id');
  if (stored) {
    simulatedUserId = Number(stored);
    return simulatedUserId;
  }
  return null;
}

export function setAuthToken(token: string | null) {
  currentToken = token;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (currentToken) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }
  
  const simId = getSimulatedUserId();
  if (simId) {
    headers.set('X-Simulated-User-Id', String(simId));
  }

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error) {
        errorMsg = errJson.error;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Master data
  getMasterData: () => request<{
    departments: Department[];
    locations: Location[];
    subLocations: any[];
    users: User[];
    organization: Organization;
    systemConfig: any[];
    currentUser?: User;
  }>('/api/masterdata'),

  updateOrganization: (data: Partial<Organization>) => request<Organization>('/api/masterdata/organization', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // User & Email Access Management
  createUser: (data: {
    email: string;
    fullName?: string;
    role?: 'admin' | 'rgl' | 'rp' | 'viewer';
    departmentId?: number | null;
    locationId?: number | null;
    jobTitle?: string;
    isActive?: boolean;
  }) => request<User>('/api/masterdata/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateUser: (id: number, data: {
    email?: string;
    fullName?: string;
    role?: 'admin' | 'rgl' | 'rp' | 'viewer';
    departmentId?: number | null;
    locationId?: number | null;
    jobTitle?: string;
    isActive?: boolean;
  }) => request<User>(`/api/masterdata/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  updateUserRole: (id: number, data: any) => request<User>(`/api/masterdata/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  deleteUser: (id: number) => request<{ success: boolean; message: string; mode: string }>(`/api/masterdata/users/${id}`, {
    method: 'DELETE',
  }),

  // Analytics
  getDashboardAnalytics: () => request<any>('/api/analytics/dashboard'),
  getExportData: (reportType: string) => request<any>(`/api/analytics/export?reportType=${reportType}`),

  // Incidents & Investigation
  getIncidents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<EventItem[]>(`/api/incidents${qs}`);
  },
  createIncident: (data: any) => request<EventItem>('/api/incidents', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  importIncidents: (data: { records: any[]; duplicateHandling?: 'skip' | 'update' }) =>
    request<{
      success: boolean;
      summary: {
        totalProcessed: number;
        importedCount: number;
        updatedCount: number;
        skippedCount: number;
        failedCount: number;
        linkedInvestigationsCount: number;
        linkedActionsCount: number;
      };
      results: Array<{
        rowNumber: number;
        eventId: string;
        title: string;
        status: 'imported' | 'updated' | 'skipped' | 'failed';
        message: string;
        linkedInvestigation?: string;
        linkedAction?: string;
        errors?: string[];
      }>;
    }>('/api/incidents/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getIncidentDetails: (id: string | number) => request<{
    event: EventItem;
    investigationReport: IncidentReport | null;
    actions: ActionItem[];
  }>(`/api/incidents/${id}`),
  assignInvestigation: (id: string | number, data: any) => request<any>(`/api/incidents/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  saveInvestigationDraft: (id: string | number, data: any) => request<any>(`/api/incidents/${id}/investigation/save-draft`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  submitInvestigation: (id: string | number) => request<any>(`/api/incidents/${id}/investigation/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  reviewInvestigation: (id: string | number, data: { decision: 'Approved' | 'Returned'; reviewComments: string }) => 
    request<any>(`/api/incidents/${id}/investigation/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  closeIncident: (id: string | number) => request<any>(`/api/incidents/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),

  // Central CAPA Engine
  getActions: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<ActionItem[]>(`/api/actions${qs}`);
  },
  createAction: (data: any) => request<ActionItem>('/api/actions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getActionDetails: (id: string | number) => request<ActionItem>(`/api/actions/${id}`),
  startAction: (id: string | number) => request<any>(`/api/actions/${id}/start`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  submitAction: (id: string | number, data: { rpActionDetails: string; completionEvidence?: string; actualCompletionDate?: string }) => 
    request<any>(`/api/actions/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reviewAction: (id: string | number, data: { decision: 'Approved' | 'Returned'; rglReviewComments: string; verificationEvidence?: string }) => 
    request<any>(`/api/actions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reopenAction: (id: string | number, reopenReason: string) => 
    request<any>(`/api/actions/${id}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reopenReason }),
    }),

  // Inspections
  getInspections: () => request<InspectionEvent[]>('/api/inspections'),
  createInspection: (data: any) => request<InspectionEvent>('/api/inspections', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getInspectionDetails: (id: string | number) => request<any>(`/api/inspections/${id}`),
  addObservation: (id: string | number, data: any) => request<any>(`/api/inspections/${id}/observations`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  completeInspection: (id: string | number, summary?: string) => request<any>(`/api/inspections/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ summary }),
  }),

  // Hazards
  getHazards: () => request<HazardReport[]>('/api/hazards'),
  createHazard: (data: any) => request<HazardReport>('/api/hazards', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateHazard: (id: string | number, data: Partial<HazardReport>) => request<HazardReport>(`/api/hazards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteHazard: (id: string | number) => request<{ success: boolean; message: string }>(`/api/hazards/${id}`, {
    method: 'DELETE',
  }),
  allocateHazardIds: (count: number, preferredIds?: string[]) => request<{ allocatedIds: string[]; startNumber: number; count: number; conflicts: string[] }>('/api/hazards/allocate-ids', {
    method: 'POST',
    body: JSON.stringify({ count, preferredIds }),
  }),
  batchSyncHazards: (records: any[], options?: { conflictMode?: 'insert_only' | 'skip_duplicates' | 'update_existing'; batchId?: string; fileName?: string }) => request<{ success: boolean; batchId: string; inserted: number; updated: number; skipped: number; total: number; records: HazardReport[] }>('/api/hazards/batch-sync', {
    method: 'POST',
    body: JSON.stringify({ records, ...options }),
  }),

  // Meetings
  getMeetings: () => request<Meeting[]>('/api/meetings'),
  createMeeting: (data: any) => request<Meeting>('/api/meetings', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMeetingDetails: (id: string | number) => request<any>(`/api/meetings/${id}`),
  saveMeetingMinutes: (id: string | number, data: any) => request<any>(`/api/meetings/${id}/minutes`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createMeetingAction: (id: string | number, data: any) => request<ActionItem>(`/api/meetings/${id}/create-action`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Trainings
  getTrainings: () => request<TrainingSession[]>('/api/trainings'),
  createTraining: (data: any) => request<TrainingSession>('/api/trainings', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getTrainingDetails: (id: string | number) => request<any>(`/api/trainings/${id}`),
  saveTrainingAttendance: (id: string | number, data: any) => request<any>(`/api/trainings/${id}/attendance`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getTrainingCompliance: () => request<any>('/api/trainings/compliance/overview'),

  // Emergency Drills
  getDrills: () => request<EmergencyDrill[]>('/api/drills'),
  createDrill: (data: any) => request<EmergencyDrill>('/api/drills', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getDrillDetails: (id: string | number) => request<any>(`/api/drills/${id}`),
  evaluateDrill: (id: string | number, data: any) => request<any>(`/api/drills/${id}/evaluate`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createDrillAction: (id: string | number, data: any) => request<ActionItem>(`/api/drills/${id}/create-action`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Documents
  getDocuments: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<DocumentItem[]>(`/api/documents${qs}`);
  },
  uploadDocument: async (formData: FormData) => {
    return request<DocumentItem>('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // Audit trail
  getAuditTrail: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<AuditEventItem[]>(`/api/masterdata/audit${qs}`);
  },

  // Notifications
  getNotifications: () => request<NotificationItem[]>('/api/masterdata/notifications'),
  markNotificationRead: (id: number) => request<any>(`/api/masterdata/notifications/${id}/read`, {
    method: 'POST',
  }),
  markAllNotificationsRead: () => request<any>('/api/masterdata/notifications/read-all', {
    method: 'POST',
  }),

  // Automation / Reminders
  runReminders: () => request<any>('/api/masterdata/automation/run-reminders', {
    method: 'POST',
  }),
};
