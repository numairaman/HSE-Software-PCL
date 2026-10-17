import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Eye, Filter, Plus, RefreshCw, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { TrainingAttendance, TrainingSession } from '../../types/index.ts';

export const TrainingsView: React.FC = () => {
  const { currentUser, departments, users } = useAuth();
  const [trainings, setTrainings] = useState<TrainingSession[]>([]);
  const [complianceStats, setComplianceStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<TrainingSession | null>(null);
  const [participants, setParticipants] = useState<TrainingAttendance[]>([]);

  // Create state
  const [title, setTitle] = useState('');
  const [trainingType, setTrainingType] = useState('Planned');
  const [category, setCategory] = useState('Occupational Safety');
  const [trainerName, setTrainerName] = useState('Sarah Connor (EHS Lead)');
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [deptId, setDeptId] = useState('');
  const [validityMonths, setValidityMonths] = useState(12);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getTrainings();
      setTrainings(data);
      const comp = await api.getTrainingCompliance();
      setComplianceStats(comp);
    } catch (err) {
      console.error('Failed to load training data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openTraining = async (t: TrainingSession) => {
    try {
      setSelectedTraining(t);
      const res = await api.getTrainingDetails(t.id);
      setParticipants(res.participants || []);
    } catch (err: any) {
      alert('Error fetching details: ' + err.message);
    }
  };

  const handleCreateTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deptId) {
      alert('Mandatory fields required');
      return;
    }

    try {
      await api.createTraining({
        title,
        trainingType,
        category,
        trainerName,
        plannedDate,
        departmentId: deptId,
        validityPeriodMonths: validityMonths,
        participantUserIds: users.slice(0, 4).map((u) => u.id),
      });

      setShowCreateModal(false);
      setTitle('');
      await loadData();
      alert('Training session planned and participants enrolled!');
    } catch (err: any) {
      alert('Create error: ' + err.message);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedTraining) return;
    try {
      await api.saveTrainingAttendance(selectedTraining.id, {
        actualDate: new Date().toISOString().split('T')[0],
        status: 'Completed',
        participants,
      });

      alert('Attendance and competency ratings recorded! Refresher dates calculated.');
      const res = await api.getTrainingDetails(selectedTraining.id);
      setParticipants(res.participants || []);
      await loadData();
    } catch (err: any) {
      alert('Attendance error: ' + err.message);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            <span>EHS Training & Competency Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Mandatory safety induction, refresher dates, attendance grading, and department compliance tracking
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Plan Training Session</span>
        </button>
      </div>

      {/* Compliance Overview Cards */}
      {complianceStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(complianceStats).map(([dept, stat]: any) => {
            const pct = stat.totalEmployees > 0 ? Math.round((stat.trainedEmployees / stat.totalEmployees) * 100) : 0;
            return (
              <div key={dept} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-white">{dept}</span>
                  <span className="text-emerald-400 font-bold">{pct}% Compliant</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>{stat.trainedEmployees} of {stat.totalEmployees} employees verified</span>
                  {stat.overdueCount > 0 && (
                    <span className="text-rose-400 font-semibold">{stat.overdueCount} refresher overdue</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Training Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Training ID</th>
                <th className="py-3 px-4">Course Title & Category</th>
                <th className="py-3 px-4">Trainer</th>
                <th className="py-3 px-4">Planned Date</th>
                <th className="py-3 px-4">Enrolled / Attended</th>
                <th className="py-3 px-4">Pass Rate</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {trainings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No training sessions found.
                  </td>
                </tr>
              ) : (
                trainings.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{t.trainingId}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{t.title}</div>
                      <div className="text-[11px] text-slate-400">{t.category}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{t.trainerName}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{t.plannedDate}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-white">{t.actualParticipants || 0}</span> / {t.plannedParticipants || 0}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">
                      {t.completionRate || 0}%
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openTraining(t)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Attendance & Grading</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ATTENDANCE & GRADING MODAL */}
      {selectedTraining && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-extrabold text-emerald-400">
                  {selectedTraining.trainingId}
                </span>
                <span className="text-slate-500">|</span>
                <h3 className="text-sm font-bold text-white truncate max-w-lg">
                  {selectedTraining.title}
                </h3>
              </div>
              <button onClick={() => setSelectedTraining(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-300">
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Trainer</span>
                  <div className="font-semibold text-white mt-0.5">{selectedTraining.trainerName}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Validity Period</span>
                  <div className="font-semibold text-white mt-0.5">{selectedTraining.validityPeriodMonths} Months</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Department</span>
                  <div className="font-semibold text-white mt-0.5">{selectedTraining.department?.name}</div>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Participant Attendance, Competency Score, and Refresher Certification</span>
                </h4>

                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
                    <thead className="bg-slate-950 text-[10px] font-semibold text-slate-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Enrolled Employee</th>
                        <th className="py-2.5 px-3">Attended</th>
                        <th className="py-2.5 px-3">Evaluation Score (0-100)</th>
                        <th className="py-2.5 px-3">Competency Result</th>
                        <th className="py-2.5 px-3">Refresher Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                      {participants.map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 font-semibold text-slate-200">
                            {p.user?.fullName} ({p.user?.email})
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={p.attended}
                              onChange={(e) => {
                                const copy = [...participants];
                                copy[idx].attended = e.target.checked;
                                if (!e.target.checked) copy[idx].competencyResult = 'Fail';
                                setParticipants(copy);
                              }}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={p.score || 0}
                              onChange={(e) => {
                                const copy = [...participants];
                                copy[idx].score = Number(e.target.value);
                                setParticipants(copy);
                              }}
                              className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={p.competencyResult}
                              onChange={(e: any) => {
                                const copy = [...participants];
                                copy[idx].competencyResult = e.target.value;
                                setParticipants(copy);
                              }}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                            >
                              <option value="Pending">Pending</option>
                              <option value="Pass">Pass (Certified)</option>
                              <option value="Fail">Fail</option>
                              <option value="Needs Refresher">Needs Refresher</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            {p.refresherDueDate || 'Calculated on save'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
              <button
                onClick={handleSaveAttendance}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs"
              >
                Record Attendance & Grade Competency
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAN TRAINING MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Plan EHS Training Session
            </h3>

            <form onSubmit={handleCreateTraining} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Training Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chemical Handling & Spill Response Level 2"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  >
                    <option value="Occupational Safety">Occupational Safety</option>
                    <option value="Fire Prevention">Fire Prevention</option>
                    <option value="Hazardous Materials">Hazardous Materials</option>
                    <option value="Work at Height">Work at Height</option>
                    <option value="Electrical Safety">Electrical Safety</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Planned Date *</label>
                  <input
                    type="date"
                    required
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
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
                  <label className="text-slate-300 font-semibold">Validity Period (Months)</label>
                  <input
                    type="number"
                    value={validityMonths}
                    onChange={(e) => setValidityMonths(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Trainer / Facilitator</label>
                <input
                  type="text"
                  value={trainerName}
                  onChange={(e) => setTrainerName(e.target.value)}
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
                  Plan & Enroll Participants
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
