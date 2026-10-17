import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Edit3,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Check,
  Building,
  MapPin,
  Briefcase,
  UserCheck,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { api } from '../../services/api.ts';
import { User } from '../../types/index.ts';

export const UsersView: React.FC = () => {
  const { users, currentUser, departments, locations, refreshMasterData } = useAuth();
  const toast = useToast();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'rgl' | 'rp' | 'viewer'>('rp');
  const [newDeptId, setNewDeptId] = useState<number | null>(null);
  const [newLocId, setNewLocId] = useState<number | null>(null);
  const [newJobTitle, setNewJobTitle] = useState('EHS Officer');
  const [newIsActive, setNewIsActive] = useState(true);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'rgl' | 'rp' | 'viewer'>('rp');
  const [editDeptId, setEditDeptId] = useState<number | null>(null);
  const [editLocId, setEditLocId] = useState<number | null>(null);
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete User Modal State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Role details mapping
  const roleInfo: Record<string, { title: string; color: string; badge: string; desc: string }> = {
    admin: {
      title: 'System Administrator',
      color: 'rose',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      desc: 'Full system control: User & email access, formula multipliers, org settings & master data.',
    },
    rgl: {
      title: 'Responsible Group Leader (RGL)',
      color: 'amber',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      desc: 'Department supervisor: Assigns investigation leads, reviews root cause findings, approves CAPA closure.',
    },
    rp: {
      title: 'Responsible Person (RP)',
      color: 'sky',
      badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      desc: 'Action & investigation assignee: Submits initial incidents, 5-Why analysis, executes CAPA actions.',
    },
    viewer: {
      title: 'Compliance Auditor / Viewer',
      color: 'slate',
      badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      desc: 'Read-only access: View live dashboards, safety KPIs, inspection logs & drill statistics.',
    },
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        (u.jobTitle && u.jobTitle.toLowerCase().includes(q)) ||
        (u.department?.name && u.department.name.toLowerCase().includes(q)) ||
        (u.location?.name && u.location.name.toLowerCase().includes(q));

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.isActive) ||
        (statusFilter === 'inactive' && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Metrics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const leaders = users.filter((u) => u.role === 'rgl').length;
    const rps = users.filter((u) => u.role === 'rp').length;
    return { total, active, admins, leaders, rps };
  }, [users]);

  // Copy email helper
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    toast.info(`Copied "${email}" to clipboard`);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  // Open Edit modal
  const handleStartEdit = (u: User) => {
    setEditingUser(u);
    setEditEmail(u.email);
    setEditFullName(u.fullName);
    setEditRole(u.role);
    setEditDeptId(u.departmentId);
    setEditLocId(u.locationId);
    setEditJobTitle(u.jobTitle || '');
    setEditIsActive(u.isActive);
  };

  // Open Delete modal
  const handleStartDelete = (u: User) => {
    if (currentUser && u.id === currentUser.id) {
      toast.warning('You cannot delete your own active administrator account.');
      return;
    }
    if (u.role === 'admin' && stats.admins <= 1) {
      toast.warning('Cannot delete the only active System Administrator.');
      return;
    }
    setDeletingUser(u);
  };

  // Handle Add User Form Submission
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    // Auto-generate display name if blank
    const cleanEmail = newEmail.toLowerCase().trim();
    const finalName =
      newFullName.trim() ||
      cleanEmail
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    setIsSubmittingAdd(true);
    try {
      const created = await api.createUser({
        email: cleanEmail,
        fullName: finalName,
        role: newRole,
        departmentId: newDeptId,
        locationId: newLocId,
        jobTitle: newJobTitle,
        isActive: newIsActive,
      });

      await refreshMasterData();
      setIsAddModalOpen(false);
      // Reset form
      setNewEmail('');
      setNewFullName('');
      setNewRole('rp');
      setNewDeptId(null);
      setNewLocId(null);
      setNewJobTitle('EHS Officer');
      setNewIsActive(true);

      toast.success(`User "${created.fullName}" (${created.email}) added successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add user');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Handle Save Edit Form Submission
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editEmail || !editEmail.includes('@')) {
      toast.error('Please provide a valid email address.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const updated = await api.updateUser(editingUser.id, {
        email: editEmail.toLowerCase().trim(),
        fullName: editFullName.trim(),
        role: editRole,
        departmentId: editDeptId,
        locationId: editLocId,
        jobTitle: editJobTitle,
        isActive: editIsActive,
      });

      await refreshMasterData();
      setEditingUser(null);
      toast.success(`User #${updated.id} (${updated.email}) updated successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    try {
      const res = await api.deleteUser(deletingUser.id);
      await refreshMasterData();
      setDeletingUser(null);
      toast.success(res.message || `User account and email were successfully removed.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-5 h-5 text-sky-400" />
            <span>User & Role Access Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage user accounts, assign/delete email addresses, and govern Role-Based Access Control (RBAC)
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User / Email Address</span>
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium">
            <span>Total Accounts</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1.5">{stats.total}</div>
          <div className="text-[10px] text-emerald-400 mt-0.5">{stats.active} Active</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium">
            <span>Administrators</span>
            <Shield className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-300 mt-1.5">{stats.admins}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Full System Access</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium">
            <span>Group Leaders (RGL)</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-1.5">{stats.leaders}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Reviewers & Approvers</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium">
            <span>Responsible Persons</span>
            <UserCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-300 mt-1.5">{stats.rps}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Action & 5-Why Owners</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium">
            <span>Auditors & Viewers</span>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-300 mt-1.5">{stats.total - stats.admins - stats.leaders - stats.rps}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Read-Only Scope</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email address, name, job title, department..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Roles</option>
              <option value="admin" className="bg-slate-900">Admin</option>
              <option value="rgl" className="bg-slate-900">RGL</option>
              <option value="rp" className="bg-slate-900">RP</option>
              <option value="viewer" className="bg-slate-900">Viewer</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Status</option>
              <option value="active" className="bg-slate-900">Active</option>
              <option value="inactive" className="bg-slate-900">Inactive</option>
            </select>
          </div>

          {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
                setStatusFilter('all');
              }}
              className="text-slate-400 hover:text-white underline text-[11px]"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3.5 px-4">User & Name</th>
                <th className="py-3.5 px-4">Email Address</th>
                <th className="py-3.5 px-4">System Role</th>
                <th className="py-3.5 px-4">Job Title</th>
                <th className="py-3.5 px-4">Department & Site</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-400">No users found matching current filter</p>
                    <p className="text-[11px] text-slate-600 mt-1">Try resetting search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleConfig = roleInfo[u.role] || roleInfo.rp;
                  const isCurrent = currentUser?.id === u.id;
                  const initials = u.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'US';

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isCurrent ? 'bg-slate-800/20' : ''
                      }`}
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-[11px] flex-shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] rounded font-bold uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">ID: #{u.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Email Address with Copy */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 group">
                          <Mail className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors flex-shrink-0" />
                          <span className="font-mono text-slate-300 text-[11px] truncate max-w-[200px]" title={u.email}>
                            {u.email}
                          </span>
                          <button
                            onClick={() => handleCopyEmail(u.email)}
                            title="Copy email to clipboard"
                            className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition-colors opacity-70 hover:opacity-100"
                          >
                            {copiedEmail === u.email ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* System Role */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-flex items-center gap-1 ${roleConfig.badge}`}
                          title={roleConfig.desc}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{u.role}</span>
                        </span>
                      </td>

                      {/* Job Title */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate max-w-[160px]">{u.jobTitle || 'EHS Officer'}</span>
                        </div>
                      </td>

                      {/* Department & Site */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="text-white text-[11px] font-medium truncate flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-500" />
                            <span>{u.department?.name || 'Unassigned'}</span>
                          </div>
                          <div className="text-slate-500 text-[10px] truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-600" />
                            <span>{u.location?.name || 'All Facilities'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            u.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.isActive ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          <span>{u.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleStartEdit(u)}
                              title="Edit user details and email address"
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleStartDelete(u)}
                              disabled={isCurrent}
                              title={
                                isCurrent
                                  ? 'Cannot delete your own active administrator account'
                                  : 'Delete user and email address'
                              }
                              className={`p-1.5 rounded border transition-colors ${
                                isCurrent
                                  ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-40'
                                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20 hover:border-rose-500/40'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic text-[11px]">Admin only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Explainer Cards */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-xs space-y-3">
        <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Role-Based Access Control (RBAC) Architecture</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(roleInfo).map(([rKey, info]) => (
            <div key={rKey} className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${info.badge}`}>
                  {rKey}
                </span>
                <span className="font-semibold text-white text-[11px]">{info.title.split('(')[0]}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{info.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ================= MODAL: ADD USER / EMAIL ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Add New User & Email Address</h3>
                  <p className="text-[11px] text-slate-400">Register new personnel and assign system permissions</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 text-xs">
              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1">
                  <span>Email Address</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. employee@company.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  This email will be used for notifications, actions, and Google login verification.
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Full Name</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Jane Doe (optional: auto-derived from email if left blank)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1">
                  <span>System Role & Permissions</span>
                  <span className="text-rose-400">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e: any) => setNewRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="admin">System Administrator (Full Settings & Config)</option>
                  <option value="rgl">Responsible Group Leader (Assign, Review & Close CAPA)</option>
                  <option value="rp">Responsible Person (Investigate, Root Cause & Execute)</option>
                  <option value="viewer">Auditor / Viewer (Read-Only Safety Reports)</option>
                </select>
                <p className="text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                  {roleInfo[newRole]?.desc}
                </p>
              </div>

              {/* Job Title */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Job Title</label>
                <input
                  type="text"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="e.g. HSE Supervisor / Safety Engineer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Department & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Department</label>
                  <select
                    value={newDeptId || ''}
                    onChange={(e) => setNewDeptId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">No Restriction</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Primary Site / Plant</label>
                  <select
                    value={newLocId || ''}
                    onChange={(e) => setNewLocId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">All Facilities</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer pt-2 select-none">
                <input
                  type="checkbox"
                  checked={newIsActive}
                  onChange={(e) => setNewIsActive(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Active Account (Able to sign in, receive alerts, and own tasks)</span>
              </label>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingAdd ? 'Adding User...' : 'Add User & Email'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT USER & EMAIL ================= */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit User Account & Email</h3>
                  <p className="text-[11px] text-slate-400">Update credentials, role scope, and contact email</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1">
                  <span>User Email Address</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Updating this email modifies the login identifier and notification recipient address.
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">System Role *</label>
                <select
                  value={editRole}
                  onChange={(e: any) => setEditRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="admin">System Administrator (Full Settings & Config)</option>
                  <option value="rgl">Responsible Group Leader (Assign, Review & Close CAPA)</option>
                  <option value="rp">Responsible Person (Investigate, Root Cause & Execute)</option>
                  <option value="viewer">Auditor / Viewer (Read-Only Safety Reports)</option>
                </select>
                <p className="text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                  {roleInfo[editRole]?.desc}
                </p>
              </div>

              {/* Job Title */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Job Title</label>
                <input
                  type="text"
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Department & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Department Assignment</label>
                  <select
                    value={editDeptId || ''}
                    onChange={(e) => setEditDeptId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">No Restriction</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Primary Site / Plant</label>
                  <select
                    value={editLocId || ''}
                    onChange={(e) => setEditLocId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">All Facilities</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer pt-2 select-none">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-sky-600 focus:ring-sky-500"
                />
                <span>Active Account (Able to login and be assigned tasks)</span>
              </label>

              {/* Modal Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const u = editingUser;
                    setEditingUser(null);
                    handleStartDelete(u);
                  }}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2 hover:bg-rose-500/10 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete User</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEdit}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmittingEdit ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-rose-500/30 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete User & Email Address</h3>
                <p className="text-[11px] text-slate-400">Confirm permanent account & email removal</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500">Name:</span>
                <span className="font-semibold text-white">{deletingUser.fullName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-rose-300 font-semibold">{deletingUser.email}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500">Role:</span>
                <span className="uppercase font-bold text-sky-400">{deletingUser.role}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete this user? Their email address will be removed from active access. Any historical incident or investigation records will be safely archived for ISO & OSHA compliance.
            </p>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition-colors text-xs disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete User'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
