import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { actionItems, departments, hazardReports, locations, users } from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';
import { logAuditEvent } from '../../services/audit.ts';

const router = Router();

// Helper to determine risk rating from severity (1-5) and likelihood (1-5)
export function getRiskLevelFromMatrix(severity: number, likelihood: number): { score: number; rating: 'Low' | 'Medium' | 'High' | 'Critical' } {
  const score = Math.max(1, Math.min(5, severity)) * Math.max(1, Math.min(5, likelihood));
  let rating: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  if (score >= 15) {
    rating = 'Critical';
  } else if (score >= 10) {
    rating = 'High';
  } else if (score >= 5) {
    rating = 'Medium';
  } else {
    rating = 'Low';
  }
  return { score, rating };
}

// Sequential Hazard ID number finder
export async function getNextHazardIdNumber(): Promise<number> {
  const all = await db.select({ hazardId: hazardReports.hazardId }).from(hazardReports);
  let maxNum = 0;
  for (const item of all) {
    if (!item.hazardId) continue;
    const match = item.hazardId.match(/HAZ-(?:[0-9]+-)?([0-9]+)$/i);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return maxNum;
}

// Sequential HAZ-000001 generator
export async function generateHazardBusinessId(): Promise<string> {
  const maxNum = await getNextHazardIdNumber();
  const nextNum = maxNum + 1;
  return `HAZ-${String(nextNum).padStart(6, '0')}`;
}

// Seed sample hazards if database is empty so Risk Matrix and Register are populated
async function seedSampleHazardsIfEmpty(adminUserId: number) {
  try {
    const existing = await db.select().from(hazardReports).limit(1);
    if (existing.length > 0) return;

    const allDepts = await db.select().from(departments);
    const allLocs = await db.select().from(locations);
    const allUsers = await db.select().from(users);

    const deptId = allDepts[0]?.id || 1;
    const locId = allLocs[0]?.id || 1;
    const reportedBy = allUsers[0]?.id || adminUserId;

    const samples = [
      {
        title: 'High-Pressure Hydraulic Line Micro-Vibration & Hose Abrasion',
        description: 'Outer reinforcement wire mesh visible on hydraulic line supplying Press #2. Potential burst hazard under 280 bar pressure.',
        hazardCategory: 'Mechanical',
        observationType: 'Unsafe Condition',
        hazardClassification: 'Mechanical',
        activity: 'Hot stamping production run',
        hazardSource: 'Aging hydraulic supply hose',
        potentialConsequences: 'High-pressure oil injection injury, fire flash risk',
        personsAtRisk: 'Press operators, hydraulic technicians',
        existingControls: 'Daily walk-around visual check, blast shield drape',
        severity: 5,
        likelihood: 4,
        residualSeverity: 2,
        residualLikelihood: 2,
        residualRiskRating: 'Low',
        residualRiskScore: 4,
        immediateAction: 'Warning flag placed, operating crew alerted to stand clear.',
        additionalControls: 'Schedule emergency line replacement and install anti-whip safety socks.',
        recommendedAction: 'Schedule emergency line replacement and install anti-whip safety socks.',
        responsiblePerson: 'Marcus Vance',
        targetCompletionDate: '2026-10-25',
        dateIdentified: '2026-10-12',
        status: 'Open',
        deptIndex: 1,
        locIndex: 0,
      },
      {
        title: 'Emergency Evacuation Stairwell Blocked by Pallet Staging',
        description: 'Four wooden pallets containing cardboard packaging stacked in front of Fire Exit Door B-12 in Logistics bay.',
        hazardCategory: 'Fire',
        observationType: 'Unsafe Condition',
        hazardClassification: 'Fire',
        activity: 'Inbound warehouse deconsolidation',
        hazardSource: 'Temporary staging buffer spillover',
        potentialConsequences: 'Delayed emergency egress during fire alarm',
        personsAtRisk: 'Warehouse pickers, forklift drivers, visitors',
        existingControls: 'Illuminated exit signage',
        severity: 4,
        likelihood: 4,
        residualSeverity: 2,
        residualLikelihood: 1,
        residualRiskRating: 'Low',
        residualRiskScore: 2,
        immediateAction: 'Pallets shifted 3 meters away from doorway immediately.',
        additionalControls: 'Repaint yellow hatched "Keep Clear" zone on floor and brief logistics shift supervisor.',
        recommendedAction: 'Repaint yellow hatched "Keep Clear" zone on floor and brief logistics shift supervisor.',
        responsiblePerson: 'Sarah Jenkins',
        targetCompletionDate: '2026-10-20',
        dateIdentified: '2026-10-14',
        status: 'In Progress',
        deptIndex: 3,
        locIndex: 2,
      },
      {
        title: 'Unguarded Rotating Shaft on Infeed Transfer Conveyor',
        description: 'Lock-out inspection revealed yellow safety guard mesh removed during maintenance and not re-bolted to chassis.',
        hazardCategory: 'Mechanical',
        observationType: 'Unsafe Condition',
        hazardClassification: 'Mechanical',
        activity: 'Raw material conveyer transfer',
        hazardSource: 'Missing pinch point guard plate',
        potentialConsequences: 'Entanglement of clothing or hair, limb amputation',
        personsAtRisk: 'Line operators, cleaning staff',
        existingControls: 'Emergency pull wire stop switch along belt',
        severity: 4,
        likelihood: 3,
        residualSeverity: 2,
        residualLikelihood: 1,
        residualRiskRating: 'Low',
        residualRiskScore: 2,
        immediateAction: 'Conveyor shut down with temporary lockout tag.',
        additionalControls: 'Fabricate interlocking safety switch on guard panel so line cannot run without enclosure.',
        recommendedAction: 'Fabricate interlocking safety switch on guard panel so line cannot run without enclosure.',
        responsiblePerson: 'David Chen',
        targetCompletionDate: '2026-10-22',
        dateIdentified: '2026-10-15',
        status: 'Open',
        deptIndex: 1,
        locIndex: 0,
      },
      {
        title: 'Chemical Storage Acid Vapor Odor in Secondary Containment',
        description: 'Faint acidic vapor detected near hydrochloric acid storage tanks. Small leak suspected around flange gasket.',
        hazardCategory: 'Chemical',
        observationType: 'Unsafe Condition',
        hazardClassification: 'Chemical',
        activity: 'Acid bulk chemical transfer',
        hazardSource: 'Degraded PTFE flange gasket on transfer pipe',
        potentialConsequences: 'Respiratory tract irritation, chemical burns',
        personsAtRisk: 'Chemical batching technicians',
        existingControls: 'Eye wash and safety shower within 10 meters, chemical suits',
        severity: 5,
        likelihood: 2,
        residualSeverity: 2,
        residualLikelihood: 2,
        residualRiskRating: 'Low',
        residualRiskScore: 4,
        immediateAction: 'Mechanical exhaust ventilation ramped to maximum, vapor sensor readings verified below OEL.',
        additionalControls: 'Torque check flange bolts and replace PTFE gasket during scheduled shutdown.',
        recommendedAction: 'Torque check flange bolts and replace PTFE gasket during scheduled shutdown.',
        responsiblePerson: 'Elena Rostova',
        targetCompletionDate: '2026-10-28',
        dateIdentified: '2026-10-11',
        status: 'Open',
        deptIndex: 4,
        locIndex: 1,
      },
      {
        title: 'Worker Operating Reach Truck Without Seatbelt Fastened',
        description: 'Forklift operator observed navigating aisle 4 at warehouse speed limit with seatbelt clicked behind driver seat.',
        hazardCategory: 'Ergonomic',
        observationType: 'Unsafe Act',
        hazardClassification: 'Ergonomic',
        activity: 'High-rack pallet retrieval',
        hazardSource: 'Operator behavior bypassing safety interlock',
        potentialConsequences: 'Operator ejection and crushing during tip-over',
        personsAtRisk: 'Forklift operator',
        existingControls: 'Forklift seat sensor, overhead guard roll cage',
        severity: 3,
        likelihood: 4,
        residualSeverity: 3,
        residualLikelihood: 1,
        residualRiskRating: 'Low',
        residualRiskScore: 3,
        immediateAction: 'Operator stopped, briefed on rollover mechanics, seatbelt engaged.',
        additionalControls: 'Provide safety stand-down briefing to mobile equipment operators; audit shift compliance.',
        recommendedAction: 'Provide safety stand-down briefing to mobile equipment operators; audit shift compliance.',
        responsiblePerson: 'Marcus Vance',
        targetCompletionDate: '2026-10-18',
        dateIdentified: '2026-10-13',
        status: 'Closed',
        deptIndex: 3,
        locIndex: 2,
      },
      {
        title: 'Water Condensate Puddle on Polished Concrete Main Walkway',
        description: 'Chiller line overhead insulation sweating condensate dripping onto main walkway between QC lab and break room.',
        hazardCategory: 'Physical',
        observationType: 'Unsafe Condition',
        hazardClassification: 'Physical',
        activity: 'Pedestrian transit to QC testing facility',
        hazardSource: 'HVAC chilled water pipe condensation dripping',
        potentialConsequences: 'Slip, trip, fall causing fracture or contusion',
        personsAtRisk: 'All shift personnel, QC laboratory visitors',
        existingControls: 'Non-slip safety footwear mandate',
        severity: 2,
        likelihood: 4,
        residualSeverity: 1,
        residualLikelihood: 1,
        residualRiskRating: 'Low',
        residualRiskScore: 1,
        immediateAction: 'Yellow Caution Wet Floor cones deployed, floor dried with shop squeegee.',
        additionalControls: 'Wrap pipe with elastomeric thermal insulation to eliminate dew-point condensation.',
        recommendedAction: 'Wrap pipe with elastomeric thermal insulation to eliminate dew-point condensation.',
        responsiblePerson: 'Michael Scott',
        targetCompletionDate: '2026-10-19',
        dateIdentified: '2026-10-15',
        status: 'In Progress',
        deptIndex: 0,
        locIndex: 0,
      },
      {
        title: 'Overhead Crane Pendant Cable Sheath Cracked Exposing Wires',
        description: 'Control pendant for 5-ton bay crane shows outer orange rubber sheath cracked near strain relief spring.',
        hazardCategory: 'Electrical',
        observationType: 'Unsafe Condition',
        hazardClassification: 'Electrical',
        activity: 'Heavy steel die lifting and positioning',
        hazardSource: 'Fatigued pendant control cord',
        potentialConsequences: '110V electric shock hazard to rigger, unexpected crane motion',
        personsAtRisk: 'Crane riggers, tool and die makers',
        existingControls: 'GFCI circuit protection, monthly crane inspection sticker',
        severity: 3,
        likelihood: 3,
        residualSeverity: 1,
        residualLikelihood: 1,
        residualRiskRating: 'Low',
        residualRiskScore: 1,
        immediateAction: 'Crane tagged out on main distribution board until cord replaced.',
        additionalControls: 'Replace pendant cable assembly with heavy-duty neoprene armored cable or radio remote.',
        recommendedAction: 'Replace pendant cable assembly with heavy-duty neoprene armored cable or radio remote.',
        responsiblePerson: 'David Chen',
        targetCompletionDate: '2026-10-21',
        dateIdentified: '2026-10-14',
        status: 'Open',
        deptIndex: 1,
        locIndex: 0,
      },
      {
        title: 'Exhaust Louvers Rattle Causing Intermittent 88 dBA Noise Spike',
        description: 'Roof ventilator dampers on Line 3 metal stamping bay loose, generating acoustic reverberation above action level.',
        hazardCategory: 'Environmental',
        observationType: 'Unsafe Condition',
        hazardClassification: 'Environmental',
        activity: 'Continuous stamping press operations',
        hazardSource: 'Resonating rooftop sheet metal ventilation housing',
        potentialConsequences: 'Long-term noise-induced hearing threshold shift',
        personsAtRisk: 'Packaging and sorting operators',
        existingControls: 'Earplugs mandatory in designated noise zone',
        severity: 2,
        likelihood: 3,
        residualSeverity: 1,
        residualLikelihood: 1,
        residualRiskRating: 'Low',
        residualRiskScore: 1,
        immediateAction: 'Dampers secured with temporary rubber vibration isolator mounts.',
        additionalControls: 'Install engineered tuned acoustic baffles during next weekend plant maintenance window.',
        recommendedAction: 'Install engineered tuned acoustic baffles during next weekend plant maintenance window.',
        responsiblePerson: 'Sarah Jenkins',
        targetCompletionDate: '2026-10-30',
        dateIdentified: '2026-10-10',
        status: 'Closed',
        deptIndex: 2,
        locIndex: 1,
      },
    ];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const hazardId = `HAZ-${String(i + 1).padStart(6, '0')}`;
      const { score, rating } = getRiskLevelFromMatrix(s.severity, s.likelihood);
      const selDept = allDepts[s.deptIndex % allDepts.length]?.id || deptId;
      const selLoc = allLocs[s.locIndex % allLocs.length]?.id || locId;

      await db.insert(hazardReports).values({
        hazardId,
        title: s.title,
        description: s.description,
        reportedByUserId: reportedBy,
        departmentId: selDept,
        locationId: selLoc,
        observationType: s.observationType,
        hazardClassification: s.hazardClassification,
        severity: s.severity,
        likelihood: s.likelihood,
        riskScore: score,
        riskRating: rating,
        immediateAction: s.immediateAction,
        recommendedAction: s.recommendedAction,
        activity: s.activity,
        hazardSource: s.hazardSource,
        potentialConsequences: s.potentialConsequences,
        personsAtRisk: s.personsAtRisk,
        existingControls: s.existingControls,
        additionalControls: s.additionalControls,
        residualLikelihood: s.residualLikelihood,
        residualSeverity: s.residualSeverity,
        residualRiskScore: s.residualRiskScore,
        residualRiskRating: s.residualRiskRating,
        responsiblePerson: s.responsiblePerson,
        targetCompletionDate: s.targetCompletionDate,
        dateIdentified: s.dateIdentified,
        reportedByText: 'EHS Inspection Team',
        sourceReference: `HAZ-AUDIT-2026-${i + 1}`,
        remarks: 'Sample baseline hazard seeded for Risk Matrix calibration.',
        status: s.status,
        recordSource: 'Manual',
      });
    }
  } catch (err) {
    console.error('Failed to seed sample hazards:', err);
  }
}

// GET /api/hazards
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    await seedSampleHazardsIfEmpty(user.id);

    const list = await db.query.hazardReports.findMany({
      orderBy: [desc(hazardReports.id)],
      with: {
        reportedBy: true,
        department: true,
        location: true,
        subLocation: true,
      },
    });
    res.json(list);
  } catch (error) {
    console.error('Error fetching hazards:', error);
    res.status(500).json({ error: 'Failed to retrieve hazard reports' });
  }
});

// POST /api/hazards/allocate-ids - Allocate unique sequential HAZ-XXXXXX IDs
router.post('/allocate-ids', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { count = 1, preferredIds = [] } = req.body;
    const requestedCount = Math.max(1, Math.min(5000, Number(count) || 1));
    const all = await db.select({ hazardId: hazardReports.hazardId }).from(hazardReports);
    const existingIdSet = new Set(all.map((h) => h.hazardId.toUpperCase()));

    let currentMax = 0;
    for (const item of all) {
      if (!item.hazardId) continue;
      const match = item.hazardId.match(/HAZ-(?:[0-9]+-)?([0-9]+)$/i);
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > currentMax) {
          currentMax = n;
        }
      }
    }

    const allocatedIds: string[] = [];
    const conflicts: string[] = [];

    // Check if preferred IDs have collisions
    if (Array.isArray(preferredIds)) {
      for (const pref of preferredIds) {
        if (pref && typeof pref === 'string') {
          const clean = pref.trim().toUpperCase();
          if (existingIdSet.has(clean)) {
            conflicts.push(clean);
          }
        }
      }
    }

    for (let i = 0; i < requestedCount; i++) {
      currentMax += 1;
      const newId = `HAZ-${String(currentMax).padStart(6, '0')}`;
      allocatedIds.push(newId);
    }

    res.json({
      allocatedIds,
      startNumber: currentMax - requestedCount + 1,
      count: allocatedIds.length,
      conflicts,
    });
  } catch (error) {
    console.error('Error allocating hazard IDs:', error);
    res.status(500).json({ error: 'Failed to allocate sequential hazard IDs' });
  }
});

// POST /api/hazards/batch-sync - Sync imported hazards into database
router.post('/batch-sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const {
      records = [],
      conflictMode = 'skip_duplicates',
      batchId = `BAT-${Date.now()}`,
      fileName = 'hazard_register.xlsx',
    } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'No records provided for sync' });
    }

    const allDepts = await db.select().from(departments);
    const allLocs = await db.select().from(locations);
    const deptMap = new Map<string, number>();
    allDepts.forEach((d) => deptMap.set(d.name.toLowerCase().trim(), d.id));
    const locMap = new Map<string, number>();
    allLocs.forEach((l) => locMap.set(l.name.toLowerCase().trim(), l.id));

    const defaultDeptId = allDepts[0]?.id || 1;
    const defaultLocId = allLocs[0]?.id || 1;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const rec of records) {
      if (!rec.title) {
        skipped++;
        continue;
      }

      const hazardId = (rec.hazardId || '').trim();
      const existing = hazardId
        ? await db.query.hazardReports.findFirst({
            where: eq(hazardReports.hazardId, hazardId),
          })
        : null;

      // Department matching
      let dId = defaultDeptId;
      if (rec.department) {
        const found = deptMap.get(rec.department.toLowerCase().trim());
        if (found) dId = found;
      } else if (rec.departmentId) {
        dId = Number(rec.departmentId) || defaultDeptId;
      }

      // Location matching
      let lId = defaultLocId;
      if (rec.location) {
        const found = locMap.get(rec.location.toLowerCase().trim());
        if (found) lId = found;
      } else if (rec.locationId) {
        lId = Number(rec.locationId) || defaultLocId;
      }

      const severity = Math.max(1, Math.min(5, Number(rec.severity) || 3));
      const likelihood = Math.max(1, Math.min(5, Number(rec.likelihood) || 3));
      const { score, rating } = getRiskLevelFromMatrix(severity, likelihood);
      const riskRating = rec.initialRiskRating || rec.riskRating || rating;

      const resLikelihood = Math.max(1, Math.min(5, Number(rec.residualLikelihood) || 2));
      const resSeverity = Math.max(1, Math.min(5, Number(rec.residualSeverity) || 2));
      const resMatrix = getRiskLevelFromMatrix(resSeverity, resLikelihood);
      const residualRiskRating = rec.residualRiskRating || resMatrix.rating;
      const residualRiskScore = resLikelihood * resSeverity;

      if (existing) {
        if (conflictMode === 'update_existing') {
          const [upd] = await db.update(hazardReports).set({
            title: rec.title.trim(),
            description: rec.description || rec.title,
            hazardClassification: rec.hazardCategory || rec.hazardClassification || existing.hazardClassification,
            observationType: rec.observationType || existing.observationType,
            severity,
            likelihood,
            riskScore: score,
            riskRating,
            departmentId: dId,
            locationId: lId,
            activity: rec.activity !== undefined ? rec.activity : existing.activity,
            hazardSource: rec.hazardSource !== undefined ? rec.hazardSource : existing.hazardSource,
            potentialConsequences: rec.potentialConsequences !== undefined ? rec.potentialConsequences : existing.potentialConsequences,
            personsAtRisk: rec.personsAtRisk !== undefined ? rec.personsAtRisk : existing.personsAtRisk,
            existingControls: rec.existingControls !== undefined ? rec.existingControls : existing.existingControls,
            additionalControls: rec.additionalControls !== undefined ? rec.additionalControls : existing.additionalControls,
            residualLikelihood: resLikelihood,
            residualSeverity: resSeverity,
            residualRiskScore: residualRiskScore,
            residualRiskRating: residualRiskRating,
            responsiblePerson: rec.responsiblePerson !== undefined ? rec.responsiblePerson : existing.responsiblePerson,
            targetCompletionDate: rec.targetCompletionDate !== undefined ? rec.targetCompletionDate : existing.targetCompletionDate,
            dateIdentified: rec.dateIdentified !== undefined ? rec.dateIdentified : existing.dateIdentified,
            reportedByText: rec.reportedBy !== undefined ? rec.reportedBy : existing.reportedByText,
            sourceReference: rec.sourceReference !== undefined ? rec.sourceReference : existing.sourceReference,
            remarks: rec.remarks !== undefined ? rec.remarks : existing.remarks,
            customFields: typeof rec.customFields === 'object' ? JSON.stringify(rec.customFields) : (rec.customFields || existing.customFields || '{}'),
            status: rec.status || existing.status,
            importBatchId: batchId,
            recordSource: 'Excel Import',
            updatedAt: new Date(),
          }).where(eq(hazardReports.id, existing.id)).returning();
          updated++;
          results.push(upd);
        } else {
          skipped++;
        }
      } else {
        const finalHazardId = hazardId || (await generateHazardBusinessId());
        const [created] = await db.insert(hazardReports).values({
          hazardId: finalHazardId,
          title: rec.title.trim(),
          description: rec.description || rec.title,
          reportedByUserId: user.id,
          departmentId: dId,
          locationId: lId,
          observationType: rec.observationType || 'Unsafe Condition',
          hazardClassification: rec.hazardCategory || rec.hazardClassification || 'Physical / Mechanical',
          severity,
          likelihood,
          riskScore: score,
          riskRating,
          immediateAction: rec.immediateAction || '',
          recommendedAction: rec.additionalControls || rec.recommendedAction || '',
          activity: rec.activity || '',
          hazardSource: rec.hazardSource || '',
          potentialConsequences: rec.potentialConsequences || '',
          personsAtRisk: rec.personsAtRisk || '',
          existingControls: rec.existingControls || '',
          additionalControls: rec.additionalControls || '',
          residualLikelihood: resLikelihood,
          residualSeverity: resSeverity,
          residualRiskScore: residualRiskScore,
          residualRiskRating: residualRiskRating,
          responsiblePerson: rec.responsiblePerson || '',
          targetCompletionDate: rec.targetCompletionDate || '',
          dateIdentified: rec.dateIdentified || new Date().toISOString().split('T')[0],
          reportedByText: rec.reportedBy || user.fullName,
          sourceReference: rec.sourceReference || '',
          remarks: rec.remarks || '',
          customFields: typeof rec.customFields === 'object' ? JSON.stringify(rec.customFields) : (rec.customFields || '{}'),
          status: rec.status || 'Open',
          importBatchId: batchId,
          recordSource: 'Excel Import',
        }).returning();
        inserted++;
        results.push(created);
      }
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'IMPORT',
      module: 'Hazard Register Import',
      recordType: 'hazard_register_batch',
      recordId: batchId,
      comments: `Batch sync complete from "${fileName}". Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`,
    });

    res.json({
      success: true,
      batchId,
      inserted,
      updated,
      skipped,
      total: records.length,
      records: results,
    });
  } catch (error) {
    console.error('Error in hazard batch sync:', error);
    res.status(500).json({ error: 'Failed to batch sync hazard records' });
  }
});

// POST /api/hazards - Single report
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;

    if (!body.title || !body.description || !body.departmentId || !body.locationId) {
      return res.status(400).json({ error: 'Title, description, department, and location are required.' });
    }

    const hazardId = body.hazardId || (await generateHazardBusinessId());

    const severity = Math.max(1, Math.min(5, Number(body.severity) || 3));
    const likelihood = Math.max(1, Math.min(5, Number(body.likelihood) || 3));
    const { score, rating } = getRiskLevelFromMatrix(severity, likelihood);
    const finalRiskRating = body.riskRating && ['Low', 'Medium', 'High', 'Critical'].includes(body.riskRating)
      ? body.riskRating
      : rating;

    const resLikelihood = Math.max(1, Math.min(5, Number(body.residualLikelihood) || 2));
    const resSeverity = Math.max(1, Math.min(5, Number(body.residualSeverity) || 2));
    const resMatrix = getRiskLevelFromMatrix(resSeverity, resLikelihood);
    const residualRiskRating = body.residualRiskRating || resMatrix.rating;
    const residualRiskScore = resLikelihood * resSeverity;

    const [newHazard] = await db.insert(hazardReports).values({
      hazardId,
      title: body.title.trim(),
      reportedByUserId: user.id,
      departmentId: Number(body.departmentId),
      locationId: Number(body.locationId),
      subLocationId: body.subLocationId ? Number(body.subLocationId) : null,
      observationType: body.observationType || 'Unsafe Condition',
      hazardClassification: body.hazardClassification || 'Physical / Mechanical',
      description: body.description.trim(),
      severity,
      likelihood,
      riskScore: score,
      riskRating: finalRiskRating,
      immediateAction: body.immediateAction || '',
      recommendedAction: body.recommendedAction || '',
      activity: body.activity || '',
      hazardSource: body.hazardSource || '',
      potentialConsequences: body.potentialConsequences || '',
      personsAtRisk: body.personsAtRisk || '',
      existingControls: body.existingControls || '',
      additionalControls: body.additionalControls || '',
      residualLikelihood: resLikelihood,
      residualSeverity: resSeverity,
      residualRiskScore: residualRiskScore,
      residualRiskRating: residualRiskRating,
      responsiblePerson: body.responsiblePerson || '',
      targetCompletionDate: body.targetCompletionDate || '',
      dateIdentified: body.dateIdentified || new Date().toISOString().split('T')[0],
      reportedByText: body.reportedByText || user.fullName,
      sourceReference: body.sourceReference || '',
      remarks: body.remarks || '',
      status: 'Open',
      recordSource: 'Manual',
    }).returning();

    if (body.createAction && body.responsiblePersonId) {
      const targetDate = body.targetDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
      const allActions = await db.select().from(actionItems);
      const actionId = `ACT-${String(allActions.length + 1).padStart(6, '0')}`;

      await db.insert(actionItems).values({
        actionId,
        sourceModule: 'Hazard',
        sourceRecordId: hazardId,
        observationFinding: `[${hazardId}] ${body.title}: ${body.description}`,
        recommendedAction: body.recommendedAction || body.description,
        actionType: 'Preventive',
        responsibleDepartmentId: Number(body.departmentId),
        responsiblePersonId: Number(body.responsiblePersonId),
        responsibleGroupLeaderId: body.responsibleGroupLeaderId ? Number(body.responsibleGroupLeaderId) : user.id,
        priority: finalRiskRating === 'Critical' ? 'Urgent' : (finalRiskRating === 'High' ? 'High' : 'Medium'),
        riskClassification: finalRiskRating,
        targetDate,
        status: 'Open',
      });
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      module: 'Hazard Reporting',
      recordType: 'hazard_report',
      recordId: hazardId,
      comments: `New hazard logged: "${body.title}" (${hazardId}) Risk: ${finalRiskRating} (${score})`,
    });

    const fullRecord = await db.query.hazardReports.findFirst({
      where: eq(hazardReports.id, newHazard.id),
      with: {
        reportedBy: true,
        department: true,
        location: true,
        subLocation: true,
      },
    });

    res.status(201).json(fullRecord || newHazard);
  } catch (error) {
    console.error('Error creating hazard report:', error);
    res.status(500).json({ error: 'Failed to create hazard report' });
  }
});

// PUT /api/hazards/:id
router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const id = Number(req.params.id);
    const body = req.body;

    const existing = await db.query.hazardReports.findFirst({
      where: eq(hazardReports.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Hazard report not found' });
    }

    const severity = body.severity !== undefined ? Math.max(1, Math.min(5, Number(body.severity))) : existing.severity;
    const likelihood = body.likelihood !== undefined ? Math.max(1, Math.min(5, Number(body.likelihood))) : existing.likelihood;
    const { score, rating } = getRiskLevelFromMatrix(severity, likelihood);
    const finalRiskRating = body.riskRating || rating;

    const resSeverity = body.residualSeverity !== undefined ? Math.max(1, Math.min(5, Number(body.residualSeverity))) : (existing.residualSeverity || 2);
    const resLikelihood = body.residualLikelihood !== undefined ? Math.max(1, Math.min(5, Number(body.residualLikelihood))) : (existing.residualLikelihood || 2);
    const resMatrix = getRiskLevelFromMatrix(resSeverity, resLikelihood);
    const residualRiskRating = body.residualRiskRating || resMatrix.rating;
    const residualRiskScore = resSeverity * resLikelihood;

    const [updated] = await db.update(hazardReports).set({
      title: body.title !== undefined ? body.title : existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      observationType: body.observationType !== undefined ? body.observationType : existing.observationType,
      hazardClassification: body.hazardClassification !== undefined ? body.hazardClassification : existing.hazardClassification,
      severity,
      likelihood,
      riskScore: score,
      riskRating: finalRiskRating,
      departmentId: body.departmentId ? Number(body.departmentId) : existing.departmentId,
      locationId: body.locationId ? Number(body.locationId) : existing.locationId,
      immediateAction: body.immediateAction !== undefined ? body.immediateAction : existing.immediateAction,
      recommendedAction: body.recommendedAction !== undefined ? body.recommendedAction : existing.recommendedAction,
      activity: body.activity !== undefined ? body.activity : existing.activity,
      hazardSource: body.hazardSource !== undefined ? body.hazardSource : existing.hazardSource,
      potentialConsequences: body.potentialConsequences !== undefined ? body.potentialConsequences : existing.potentialConsequences,
      personsAtRisk: body.personsAtRisk !== undefined ? body.personsAtRisk : existing.personsAtRisk,
      existingControls: body.existingControls !== undefined ? body.existingControls : existing.existingControls,
      additionalControls: body.additionalControls !== undefined ? body.additionalControls : existing.additionalControls,
      residualLikelihood: resLikelihood,
      residualSeverity: resSeverity,
      residualRiskScore: residualRiskScore,
      residualRiskRating: residualRiskRating,
      responsiblePerson: body.responsiblePerson !== undefined ? body.responsiblePerson : existing.responsiblePerson,
      targetCompletionDate: body.targetCompletionDate !== undefined ? body.targetCompletionDate : existing.targetCompletionDate,
      dateIdentified: body.dateIdentified !== undefined ? body.dateIdentified : existing.dateIdentified,
      sourceReference: body.sourceReference !== undefined ? body.sourceReference : existing.sourceReference,
      remarks: body.remarks !== undefined ? body.remarks : existing.remarks,
      status: body.status !== undefined ? body.status : existing.status,
      updatedAt: new Date(),
    }).where(eq(hazardReports.id, id)).returning();

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'UPDATE',
      module: 'Hazard Reporting',
      recordType: 'hazard_report',
      recordId: existing.hazardId,
      comments: `Hazard updated: S=${severity}, L=${likelihood}, Score=${score}, Rating=${finalRiskRating}, Status=${body.status || existing.status}`,
    });

    const full = await db.query.hazardReports.findFirst({
      where: eq(hazardReports.id, id),
      with: {
        reportedBy: true,
        department: true,
        location: true,
        subLocation: true,
      },
    });

    res.json(full || updated);
  } catch (error) {
    console.error('Error updating hazard:', error);
    res.status(500).json({ error: 'Failed to update hazard report' });
  }
});

// DELETE /api/hazards/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const id = Number(req.params.id);

    const existing = await db.query.hazardReports.findFirst({
      where: eq(hazardReports.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Hazard report not found' });
    }

    if (user.role !== 'admin' && existing.reportedByUserId !== user.id) {
      return res.status(403).json({ error: 'Only Administrators or the original reporter can remove hazard records' });
    }

    await db.delete(hazardReports).where(eq(hazardReports.id, id));

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'DELETE',
      module: 'Hazard Reporting',
      recordType: 'hazard_report',
      recordId: existing.hazardId,
      comments: `Hazard report deleted: ${existing.hazardId} - ${existing.title}`,
    });

    res.json({ success: true, message: 'Hazard removed successfully' });
  } catch (error) {
    console.error('Error deleting hazard:', error);
    res.status(500).json({ error: 'Failed to delete hazard report' });
  }
});

export default router;
