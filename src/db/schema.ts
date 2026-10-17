import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Organizations
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().default('Apex Industrial Group'),
  logoUrl: text('logo_url').default(''),
  trirMultiplier: integer('trir_multiplier').notNull().default(200000),
  ltifrMultiplier: integer('ltifr_multiplier').notNull().default(1000000),
  totalHoursWorked: integer('total_hours_worked').notNull().default(750000),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Departments
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Locations
export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  locationType: text('location_type').notNull().default('Plant'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Sub-locations
export const subLocations = pgTable('sub_locations', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('rp'),
  departmentId: integer('department_id').references(() => departments.id),
  locationId: integer('location_id').references(() => locations.id),
  jobTitle: text('job_title').default('EHS Officer'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Events / Incidents
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  eventId: text('event_id').notNull().unique(),
  title: text('title').notNull(),
  eventType: text('event_type').notNull(),
  occurrenceDate: text('occurrence_date').notNull(),
  occurrenceTime: text('occurrence_time').notNull(),
  reportedAt: timestamp('reported_at').defaultNow().notNull(),
  reportedByUserId: integer('reported_by_user_id').references(() => users.id).notNull(),
  departmentId: integer('department_id').references(() => departments.id).notNull(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  subLocationId: integer('sub_location_id').references(() => subLocations.id),
  eventCategory: text('event_category').notNull().default('Safety'),
  actualConsequence: text('actual_consequence').notNull(),
  potentialConsequence: text('potential_consequence').notNull(),
  immediateActionsTaken: text('immediate_actions_taken').notNull(),
  personsInvolved: text('persons_involved').default(''),
  witnesses: text('witnesses').default(''),
  injuryOrEnvironmentalDetails: text('injury_or_environmental_details').default(''),
  initialRiskClassification: text('initial_risk_classification').notNull().default('Medium'),
  potentialRiskClassification: text('potential_risk_classification').notNull().default('High'),
  status: text('status').notNull().default('Reported'),
  assignedRglId: integer('assigned_rgl_id').references(() => users.id),
  assignedRpId: integer('assigned_rp_id').references(() => users.id),
  investigationDueDate: text('investigation_due_date').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. Incident Investigation Reports
export const incidentReports = pgTable('incident_reports', {
  id: serial('id').primaryKey(),
  reportId: text('report_id').notNull().unique(),
  eventId: integer('event_id').references(() => events.id).notNull(),
  assignedRpId: integer('assigned_rp_id').references(() => users.id).notNull(),
  reviewingRglId: integer('reviewing_rgl_id').references(() => users.id).notNull(),
  status: text('status').notNull().default('Open'),
  investigationStartDate: text('investigation_start_date').notNull(),
  investigationDueDate: text('investigation_due_date').notNull(),
  sequenceOfEvents: text('sequence_of_events').notNull().default(''),
  immediateCauses: text('immediate_causes').notNull().default(''),
  contributingFactors: text('contributing_factors').notNull().default(''),
  failedOrMissingControls: text('failed_or_missing_controls').notNull().default(''),
  finalRootCause: text('final_root_cause').notNull().default(''),
  rootCauseCategory: text('root_cause_category').default('Procedures & Compliance'),
  rpSubmissionStatus: text('rp_submission_status').notNull().default('Draft'),
  rpSubmittedAt: timestamp('rp_submitted_at'),
  rglReviewStatus: text('rgl_review_status').notNull().default('Pending'),
  rglReviewComments: text('rgl_review_comments').default(''),
  rglReviewedAt: timestamp('rgl_reviewed_at'),
  approvalDate: text('approval_date').default(''),
  closureDate: text('closure_date').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Five Whys
export const fiveWhys = pgTable('five_whys', {
  id: serial('id').primaryKey(),
  incidentReportId: integer('incident_report_id').references(() => incidentReports.id).notNull(),
  whyNumber: integer('why_number').notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  evidence: text('evidence').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Key Findings
export const keyFindings = pgTable('key_findings', {
  id: serial('id').primaryKey(),
  incidentReportId: integer('incident_report_id').references(() => incidentReports.id).notNull(),
  findingRef: text('finding_ref').notNull(),
  description: text('description').notNull(),
  evidence: text('evidence').default(''),
  significance: text('significance').notNull().default('Medium'),
  recommendedAction: text('recommended_action').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Corrective & Preventive Actions
export const actionItems = pgTable('action_items', {
  id: serial('id').primaryKey(),
  actionId: text('action_id').notNull().unique(),
  sourceModule: text('source_module').notNull().default('Incident'),
  sourceRecordId: text('source_record_id').notNull().default(''),
  sourceEventId: integer('source_event_id').references(() => events.id),
  sourceIncidentReportId: integer('source_incident_report_id').references(() => incidentReports.id),
  sourceFindingId: integer('source_finding_id').references(() => keyFindings.id),
  observationFinding: text('observation_finding').notNull(),
  recommendedAction: text('recommended_action').notNull(),
  actionType: text('action_type').notNull().default('Corrective'),
  responsibleDepartmentId: integer('responsible_department_id').references(() => departments.id).notNull(),
  responsiblePersonId: integer('responsible_person_id').references(() => users.id).notNull(),
  responsibleGroupLeaderId: integer('responsible_group_leader_id').references(() => users.id).notNull(),
  priority: text('priority').notNull().default('Medium'),
  riskClassification: text('risk_classification').notNull().default('Medium'),
  targetDate: text('target_date').notNull(),
  rpActionDetails: text('rp_action_details').default(''),
  completionEvidence: text('completion_evidence').default(''),
  rpSubmissionDate: text('rp_submission_date').default(''),
  rglReviewComments: text('rgl_review_comments').default(''),
  rglApprovalDecision: text('rgl_approval_decision').default(''),
  status: text('status').notNull().default('Open'),
  actualCompletionDate: text('actual_completion_date').default(''),
  closureDate: text('closure_date').default(''),
  verificationEvidence: text('verification_evidence').default(''),
  escalationLevel: integer('escalation_level').notNull().default(0),
  lastReminderDate: text('last_reminder_date').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 11. Standalone Hazard Reports
export const hazardReports = pgTable('hazard_reports', {
  id: serial('id').primaryKey(),
  hazardId: text('hazard_id').notNull().unique(),
  title: text('title').notNull(),
  reportedByUserId: integer('reported_by_user_id').references(() => users.id).notNull(),
  departmentId: integer('department_id').references(() => departments.id).notNull(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  subLocationId: integer('sub_location_id').references(() => subLocations.id),
  observationType: text('observation_type').notNull().default('Unsafe Condition'),
  hazardClassification: text('hazard_classification').notNull().default('Physical / Mechanical'),
  description: text('description').notNull(),
  riskRating: text('risk_rating').notNull().default('Medium'),
  severity: integer('severity').notNull().default(3),
  likelihood: integer('likelihood').notNull().default(3),
  riskScore: integer('risk_score').notNull().default(9),
  immediateAction: text('immediate_action').default(''),
  recommendedAction: text('recommended_action').default(''),
  activity: text('activity').default(''),
  hazardSource: text('hazard_source').default(''),
  potentialConsequences: text('potential_consequences').default(''),
  personsAtRisk: text('persons_at_risk').default(''),
  existingControls: text('existing_controls').default(''),
  additionalControls: text('additional_controls').default(''),
  residualLikelihood: integer('residual_likelihood').default(2),
  residualSeverity: integer('residual_severity').default(2),
  residualRiskScore: integer('residual_risk_score').default(4),
  residualRiskRating: text('residual_risk_rating').default('Low'),
  responsiblePerson: text('responsible_person').default(''),
  targetCompletionDate: text('target_completion_date').default(''),
  dateIdentified: text('date_identified').default(''),
  reportedByText: text('reported_by_text').default(''),
  sourceReference: text('source_reference').default(''),
  remarks: text('remarks').default(''),
  customFields: text('custom_fields').default('{}'),
  importBatchId: text('import_batch_id').default(''),
  recordSource: text('record_source').default('Manual'),
  status: text('status').notNull().default('Open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 12. Inspections
export const inspectionEvents = pgTable('inspection_events', {
  id: serial('id').primaryKey(),
  inspectionId: text('inspection_id').notNull().unique(),
  title: text('title').notNull(),
  inspectionType: text('inspection_type').notNull().default('Routine HSE Inspection'),
  scheduledDate: text('scheduled_date').notNull(),
  completedDate: text('completed_date').default(''),
  areaCovered: text('area_covered').notNull(),
  departmentId: integer('department_id').references(() => departments.id).notNull(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  leadInspectorId: integer('lead_inspector_id').references(() => users.id).notNull(),
  teamMembers: text('team_members').notNull().default('[]'),
  checklistName: text('checklist_name').notNull().default('Comprehensive Workplace HSE Checklist'),
  summary: text('summary').default(''),
  status: text('status').notNull().default('Planned'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 13. Observations
export const inspectionObservations = pgTable('inspection_observations', {
  id: serial('id').primaryKey(),
  observationId: text('observation_id').notNull().unique(),
  inspectionEventId: integer('inspection_event_id').references(() => inspectionEvents.id).notNull(),
  observationDate: text('observation_date').notNull(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  subLocationId: integer('sub_location_id').references(() => subLocations.id),
  observationType: text('observation_type').notNull().default('Unsafe Condition'),
  hazardClassification: text('hazard_classification').notNull().default('Mechanical'),
  description: text('description').notNull(),
  riskRating: text('risk_rating').notNull().default('Medium'),
  recommendedAction: text('recommended_action').notNull(),
  departmentId: integer('department_id').references(() => departments.id).notNull(),
  responsiblePersonId: integer('responsible_person_id').references(() => users.id),
  responsibleGroupLeaderId: integer('responsible_group_leader_id').references(() => users.id),
  targetDate: text('target_date').default(''),
  linkedActionId: integer('linked_action_id').references(() => actionItems.id),
  status: text('status').notNull().default('Open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Meetings
export const meetings = pgTable('meetings', {
  id: serial('id').primaryKey(),
  meetingId: text('meeting_id').notNull().unique(),
  title: text('title').notNull(),
  meetingType: text('meeting_type').notNull().default('Monthly HSE Meeting'),
  dateTime: text('date_time').notNull(),
  venue: text('venue').notNull().default('Main Conference Room / Teams'),
  departmentId: integer('department_id').references(() => departments.id),
  chairpersonId: integer('chairperson_id').references(() => users.id).notNull(),
  organizerId: integer('organizer_id').references(() => users.id).notNull(),
  agenda: text('agenda').notNull().default(''),
  topicsDiscussed: text('topics_discussed').default(''),
  minutesOfMeeting: text('minutes_of_meeting').default(''),
  status: text('status').notNull().default('Scheduled'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 15. Attendees
export const meetingAttendees = pgTable('meeting_attendees', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id').references(() => meetings.id).notNull(),
  userId: integer('user_id').references(() => users.id),
  name: text('name').notNull(),
  email: text('email').default(''),
  department: text('department').default(''),
  isExternal: boolean('is_external').notNull().default(false),
  attended: boolean('attended').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. Training Sessions
export const trainingSessions = pgTable('training_sessions', {
  id: serial('id').primaryKey(),
  trainingId: text('training_id').notNull().unique(),
  title: text('title').notNull(),
  trainingType: text('training_type').notNull().default('Planned'),
  category: text('category').notNull().default('Occupational Safety'),
  trainerName: text('trainer_name').notNull(),
  plannedDate: text('planned_date').notNull(),
  actualDate: text('actual_date').default(''),
  venue: text('venue').notNull().default('Training Center Room 1'),
  departmentId: integer('department_id').references(() => departments.id).notNull(),
  agenda: text('agenda').default(''),
  learningObjectives: text('learning_objectives').default(''),
  validityPeriodMonths: integer('validity_period_months').notNull().default(12),
  status: text('status').notNull().default('Planned'),
  evaluationFeedback: text('evaluation_feedback').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 17. Training Attendance
export const trainingAttendance = pgTable('training_attendance', {
  id: serial('id').primaryKey(),
  trainingSessionId: integer('training_session_id').references(() => trainingSessions.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  attended: boolean('attended').notNull().default(false),
  score: integer('score').default(0),
  competencyResult: text('competency_result').notNull().default('Pending'),
  refresherDueDate: text('refresher_due_date').default(''),
  feedbackNotes: text('feedback_notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Emergency Drills
export const emergencyDrills = pgTable('emergency_drills', {
  id: serial('id').primaryKey(),
  drillId: text('drill_id').notNull().unique(),
  title: text('title').notNull(),
  drillType: text('drill_type').notNull().default('Fire Drill'),
  plannedDate: text('planned_date').notNull(),
  actualDate: text('actual_date').default(''),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  scenarioDescription: text('scenario_description').notNull(),
  objectives: text('objectives').notNull(),
  drillControllerId: integer('drill_controller_id').references(() => users.id).notNull(),
  evaluatorId: integer('evaluator_id').references(() => users.id).notNull(),
  alarmActivationTime: text('alarm_activation_time').default('10:00'),
  evacuationStartTime: text('evacuation_start_time').default('10:01'),
  evacuationCompletionTime: text('evacuation_completion_time').default('10:05'),
  musterCompletionTime: text('muster_completion_time').default('10:07'),
  totalEvacuationMinutes: integer('total_evacuation_minutes').default(4),
  targetEvacuationMinutes: integer('target_evacuation_minutes').notNull().default(5),
  participantCount: integer('participant_count').notNull().default(0),
  unaccountedCount: integer('unaccounted_count').notNull().default(0),
  performanceEvaluation: text('performance_evaluation').notNull().default('Satisfactory'),
  keyObservations: text('key_observations').default(''),
  findings: text('findings').default(''),
  lessonsLearned: text('lessons_learned').default(''),
  status: text('status').notNull().default('Planned'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 19. Documents
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  documentId: text('document_id').notNull().unique(),
  originalFilename: text('original_filename').notNull(),
  storedFilename: text('stored_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  uploadedByUserId: integer('uploaded_by_user_id').references(() => users.id).notNull(),
  linkedModule: text('linked_module').notNull().default('Repository'),
  linkedRecordId: text('linked_record_id').notNull().default(''),
  description: text('description').default(''),
  tags: text('tags').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 20. Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  recordType: text('record_type').notNull(),
  recordId: text('record_id').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 21. Audit Trail
export const auditEvents = pgTable('audit_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  userEmail: text('user_email').notNull().default('system'),
  userRole: text('user_role').notNull().default('system'),
  action: text('action').notNull(),
  module: text('module').notNull(),
  recordType: text('record_type').notNull(),
  recordId: text('record_id').notNull(),
  previousValues: text('previous_values').default(''),
  newValues: text('new_values').default(''),
  comments: text('comments').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 22. System Config
export const systemConfig = pgTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description').default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  location: one(locations, {
    fields: [users.locationId],
    references: [locations.id],
  }),
  reportedEvents: many(events),
  assignedActions: many(actionItems),
  notifications: many(notifications),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  department: one(departments, {
    fields: [events.departmentId],
    references: [departments.id],
  }),
  location: one(locations, {
    fields: [events.locationId],
    references: [locations.id],
  }),
  subLocation: one(subLocations, {
    fields: [events.subLocationId],
    references: [subLocations.id],
  }),
  reportedBy: one(users, {
    fields: [events.reportedByUserId],
    references: [users.id],
  }),
  assignedRgl: one(users, {
    fields: [events.assignedRglId],
    references: [users.id],
  }),
  assignedRp: one(users, {
    fields: [events.assignedRpId],
    references: [users.id],
  }),
  investigationReport: one(incidentReports),
  actions: many(actionItems),
}));

export const incidentReportsRelations = relations(incidentReports, ({ one, many }) => ({
  event: one(events, {
    fields: [incidentReports.eventId],
    references: [events.id],
  }),
  assignedRp: one(users, {
    fields: [incidentReports.assignedRpId],
    references: [users.id],
  }),
  reviewingRgl: one(users, {
    fields: [incidentReports.reviewingRglId],
    references: [users.id],
  }),
  whys: many(fiveWhys),
  findings: many(keyFindings),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  department: one(departments, {
    fields: [actionItems.responsibleDepartmentId],
    references: [departments.id],
  }),
  responsiblePerson: one(users, {
    fields: [actionItems.responsiblePersonId],
    references: [users.id],
  }),
  responsibleGroupLeader: one(users, {
    fields: [actionItems.responsibleGroupLeaderId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [actionItems.sourceEventId],
    references: [events.id],
  }),
}));

export const inspectionEventsRelations = relations(inspectionEvents, ({ one, many }) => ({
  department: one(departments, {
    fields: [inspectionEvents.departmentId],
    references: [departments.id],
  }),
  location: one(locations, {
    fields: [inspectionEvents.locationId],
    references: [locations.id],
  }),
  leadInspector: one(users, {
    fields: [inspectionEvents.leadInspectorId],
    references: [users.id],
  }),
  observations: many(inspectionObservations),
}));

export const inspectionObservationsRelations = relations(inspectionObservations, ({ one }) => ({
  inspectionEvent: one(inspectionEvents, {
    fields: [inspectionObservations.inspectionEventId],
    references: [inspectionEvents.id],
  }),
  department: one(departments, {
    fields: [inspectionObservations.departmentId],
    references: [departments.id],
  }),
  location: one(locations, {
    fields: [inspectionObservations.locationId],
    references: [locations.id],
  }),
  subLocation: one(subLocations, {
    fields: [inspectionObservations.subLocationId],
    references: [subLocations.id],
  }),
  responsiblePerson: one(users, {
    fields: [inspectionObservations.responsiblePersonId],
    references: [users.id],
  }),
  responsibleGroupLeader: one(users, {
    fields: [inspectionObservations.responsibleGroupLeaderId],
    references: [users.id],
  }),
}));

export const hazardReportsRelations = relations(hazardReports, ({ one }) => ({
  reportedBy: one(users, {
    fields: [hazardReports.reportedByUserId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [hazardReports.departmentId],
    references: [departments.id],
  }),
  location: one(locations, {
    fields: [hazardReports.locationId],
    references: [locations.id],
  }),
  subLocation: one(subLocations, {
    fields: [hazardReports.subLocationId],
    references: [subLocations.id],
  }),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  chairperson: one(users, {
    fields: [meetings.chairpersonId],
    references: [users.id],
  }),
  organizer: one(users, {
    fields: [meetings.organizerId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [meetings.departmentId],
    references: [departments.id],
  }),
  attendees: many(meetingAttendees),
}));

export const meetingAttendeesRelations = relations(meetingAttendees, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingAttendees.meetingId],
    references: [meetings.id],
  }),
  user: one(users, {
    fields: [meetingAttendees.userId],
    references: [users.id],
  }),
}));

export const trainingSessionsRelations = relations(trainingSessions, ({ one, many }) => ({
  department: one(departments, {
    fields: [trainingSessions.departmentId],
    references: [departments.id],
  }),
  attendance: many(trainingAttendance),
}));

export const trainingAttendanceRelations = relations(trainingAttendance, ({ one }) => ({
  trainingSession: one(trainingSessions, {
    fields: [trainingAttendance.trainingSessionId],
    references: [trainingSessions.id],
  }),
  user: one(users, {
    fields: [trainingAttendance.userId],
    references: [users.id],
  }),
}));

export const emergencyDrillsRelations = relations(emergencyDrills, ({ one }) => ({
  location: one(locations, {
    fields: [emergencyDrills.locationId],
    references: [locations.id],
  }),
  drillController: one(users, {
    fields: [emergencyDrills.drillControllerId],
    references: [users.id],
  }),
  evaluator: one(users, {
    fields: [emergencyDrills.evaluatorId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  uploadedBy: one(users, {
    fields: [documents.uploadedByUserId],
    references: [users.id],
  }),
}));
