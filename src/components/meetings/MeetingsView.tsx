import React, { useEffect, useState } from 'react';
import { Calendar, CheckSquare, Eye, FileText, Plus, RefreshCw, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Meeting, MeetingAttendee } from '../../types/index.ts';

export const MeetingsView: React.FC = () => {
  const { currentUser, departments, users } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [meetingActions, setMeetingActions] = useState<any[]>([]);

  // Minutes editor
  const [minutesText, setMinutesText] = useState('');
  const [topicsText, setTopicsText] = useState('');

  // New action modal
  const [showNewActionModal, setShowNewActionModal] = useState(false);
  const [actionDesc, setActionDesc] = useState('');
  const [actionRpId, setActionRpId] = useState('');
  const [actionTargetDate, setActionTargetDate] = useState('');

  // Create form state
  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('Monthly HSE Meeting');
  const [dateTime, setDateTime] = useState(new Date().toISOString().slice(0, 16));
  const [venue, setVenue] = useState('Main Conference Room / Teams');
  const [chairpersonId, setChairpersonId] = useState('');
  const [agenda, setAgenda] = useState('');

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const data = await api.getMeetings();
      setMeetings(data);
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const openMeeting = async (m: Meeting) => {
    try {
      setSelectedMeeting(m);
      const res = await api.getMeetingDetails(m.id);
      setAttendees(res.attendees || []);
      setMeetingActions(res.actions || []);
      setMinutesText(m.minutesOfMeeting || '');
      setTopicsText(m.topicsDiscussed || '');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !chairpersonId) {
      alert('Title and chairperson required');
      return;
    }

    try {
      await api.createMeeting({
        title,
        meetingType,
        dateTime,
        venue,
        chairpersonId,
        agenda,
        attendees: users.slice(0, 4).map((u) => ({
          userId: u.id,
          name: u.fullName,
          email: u.email,
          attended: true,
        })),
      });

      setShowCreateModal(false);
      setTitle('');
      await loadMeetings();
      alert('Meeting scheduled with unique Meeting ID!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleSaveMinutes = async () => {
    if (!selectedMeeting) return;
    try {
      await api.saveMeetingMinutes(selectedMeeting.id, {
        minutesOfMeeting: minutesText,
        topicsDiscussed: topicsText,
        attendees,
        status: 'Completed',
      });
      alert('Minutes of Meeting saved successfully.');
      await loadMeetings();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting || !actionDesc || !actionRpId) return;

    try {
      await api.createMeetingAction(selectedMeeting.id, {
        recommendedAction: actionDesc,
        responsiblePersonId: actionRpId,
        targetDate: actionTargetDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      });

      setShowNewActionModal(false);
      setActionDesc('');
      const res = await api.getMeetingDetails(selectedMeeting.id);
      setMeetingActions(res.actions || []);
      alert('Decision action item created and linked to Central CAPA tracker!');
    } catch (err: any) {
      alert('Action error: ' + err.message);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" />
            <span>Meetings & Minutes of Meeting (MoM)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Official EHS committee meetings, attendance recording, and action tracking
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule EHS Meeting</span>
        </button>
      </div>

      {/* Meetings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Meeting ID</th>
                <th className="py-3 px-4">Title & Type</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Venue</th>
                <th className="py-3 px-4">Chairperson</th>
                <th className="py-3 px-4">Attendees</th>
                <th className="py-3 px-4">Actions</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {meetings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No EHS meetings scheduled yet.
                  </td>
                </tr>
              ) : (
                meetings.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{m.meetingId}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{m.title}</div>
                      <div className="text-[11px] text-slate-400">{m.meetingType}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{m.dateTime}</td>
                    <td className="py-3 px-4 text-slate-400">{m.venue}</td>
                    <td className="py-3 px-4 text-slate-200">{m.chairperson?.fullName}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-white">{m.actualAttendedCount || 0}</span> / {m.attendeesCount || 0}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 font-semibold text-emerald-400">
                        {m.actionsCount || 0} CAPAs
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openMeeting(m)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>MoM & Actions</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MEETING DETAILS & MINUTES MODAL */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-extrabold text-emerald-400">
                  {selectedMeeting.meetingId}
                </span>
                <span className="text-slate-500">|</span>
                <h3 className="text-sm font-bold text-white truncate max-w-lg">
                  {selectedMeeting.title}
                </h3>
              </div>
              <button onClick={() => setSelectedMeeting(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-300">
              {/* Meeting info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Meeting Type</span>
                  <div className="font-semibold text-slate-200 mt-0.5">{selectedMeeting.meetingType}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Date & Time</span>
                  <div className="font-semibold text-slate-200 mt-0.5">{selectedMeeting.dateTime}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Chairperson</span>
                  <div className="font-semibold text-slate-200 mt-0.5">{selectedMeeting.chairperson?.fullName}</div>
                </div>
              </div>

              {/* Attendance Checklist */}
              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Participant Attendance</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {attendees.map((att, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={att.attended}
                        onChange={(e) => {
                          const copy = [...attendees];
                          copy[idx].attended = e.target.checked;
                          setAttendees(copy);
                        }}
                      />
                      <span className="font-medium text-slate-200 truncate">{att.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Minutes of Meeting Editor */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Topics Discussed & Deliberations</label>
                  <textarea
                    rows={2}
                    value={topicsText}
                    onChange={(e) => setTopicsText(e.target.value)}
                    placeholder="Key items reviewed: incident trends, machine guarding, PPE compliance..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Minutes of Meeting (Official Record)</label>
                  <textarea
                    rows={4}
                    value={minutesText}
                    onChange={(e) => setMinutesText(e.target.value)}
                    placeholder="Formal minutes, resolutions, policy decisions..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              {/* Linked Actions */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    <span>Meeting Decision Action Items ({meetingActions.length})</span>
                  </h4>
                  <button
                    onClick={() => setShowNewActionModal(true)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                  >
                    + Assign Action Item
                  </button>
                </div>

                <div className="space-y-1.5">
                  {meetingActions.length === 0 ? (
                    <div className="p-4 text-slate-500 text-center bg-slate-950/40 rounded-lg">
                      No action items assigned from this meeting yet.
                    </div>
                  ) : (
                    meetingActions.map((act) => (
                      <div key={act.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
                        <div>
                          <span className="font-mono font-bold text-emerald-400 mr-2">{act.actionId}</span>
                          <span className="text-slate-200">{act.recommendedAction}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300">
                          {act.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
              <button
                onClick={handleSaveMinutes}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs"
              >
                Save Minutes & Finalize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MEETING ACTION MODAL */}
      {showNewActionModal && selectedMeeting && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Assign Action from Meeting Decision
            </h3>

            <form onSubmit={handleCreateAction} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Action Description *</label>
                <textarea
                  rows={2}
                  required
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  placeholder="e.g. Procure 20 additional flame-retardant welding screens..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Assign Responsible Person (RP) *</label>
                <select
                  required
                  value={actionRpId}
                  onChange={(e) => setActionRpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                >
                  <option value="">Select Assignee</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Target Completion Date</label>
                <input
                  type="date"
                  value={actionTargetDate}
                  onChange={(e) => setActionTargetDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewActionModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold"
                >
                  Create Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE MEETING MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Schedule Official EHS Meeting
            </h3>

            <form onSubmit={handleCreateMeeting} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Meeting Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. October 2026 Monthly Safety & HSE Review Meeting"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Category</label>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  >
                    <option value="Daily Plant Meeting">Daily Plant Meeting</option>
                    <option value="Monthly HSE Meeting">Monthly HSE Meeting</option>
                    <option value="Management Review Meeting">Management Review Meeting</option>
                    <option value="Incident Review Meeting">Incident Review Meeting</option>
                    <option value="Contractor Safety Meeting">Contractor Safety Meeting</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Meeting Chairperson *</label>
                  <select
                    required
                    value={chairpersonId}
                    onChange={(e) => setChairpersonId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  >
                    <option value="">Select Chairperson</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Venue / Platform</label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Agenda Items</label>
                <textarea
                  rows={2}
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="1. Review of open CAPA; 2. Machine guarding status; 3. Near-miss trends..."
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
                  Schedule Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
