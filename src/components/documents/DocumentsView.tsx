import React, { useEffect, useState } from 'react';
import { Download, File, FolderOpen, Plus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { DocumentItem } from '../../types/index.ts';

export const DocumentsView: React.FC = () => {
  const { currentUser, globalSearch } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkedModule, setLinkedModule] = useState('Incident');
  const [linkedRecordId, setLinkedRecordId] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const loadDocs = async () => {
    try {
      setLoading(true);
      const data = await api.getDocuments();
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('linkedModule', linkedModule);
      formData.append('linkedRecordId', linkedRecordId);
      formData.append('description', description);
      formData.append('tags', tags);

      await api.uploadDocument(formData);
      setShowUploadModal(false);
      setSelectedFile(null);
      setDescription('');
      await loadDocs();
      alert('Document and evidence uploaded successfully!');
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (!globalSearch) return true;
    const q = globalSearch.toLowerCase();
    return (
      d.documentId.toLowerCase().includes(q) ||
      d.originalFilename.toLowerCase().includes(q) ||
      d.linkedRecordId.toLowerCase().includes(q) ||
      d.linkedModule.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-amber-400" />
            <span>Document & Evidence Repository</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Centralized evidence storage linked to Incidents, Investigations, Inspections, and CAPA resolutions
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Evidence</span>
        </button>
      </div>

      {/* Documents Grid / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Doc ID</th>
                <th className="py-3 px-4">Filename & Description</th>
                <th className="py-3 px-4">Linked Reference</th>
                <th className="py-3 px-4">File Size</th>
                <th className="py-3 px-4">Uploaded By</th>
                <th className="py-3 px-4">Upload Date</th>
                <th className="py-3 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No documents or evidence files uploaded yet.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{doc.documentId}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <File className="w-3.5 h-3.5 text-slate-400" />
                        <span>{doc.originalFilename}</span>
                      </div>
                      {doc.description && <div className="text-[11px] text-slate-400 mt-0.5">{doc.description}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300 mr-1.5">
                        {doc.linkedModule}
                      </span>
                      <span className="font-mono text-slate-400 text-[11px]">{doc.linkedRecordId || 'Repository'}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {(doc.fileSize / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 px-4 text-slate-300">{doc.uploadedBy?.fullName || 'User'}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`/api/documents/${doc.id}/download`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Upload Evidence / Attachment</span>
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Select File *</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Linked Module</label>
                  <select
                    value={linkedModule}
                    onChange={(e) => setLinkedModule(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  >
                    <option value="Incident">Incident</option>
                    <option value="Investigation">Investigation</option>
                    <option value="Action">CAPA Action</option>
                    <option value="Inspection">Inspection</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Training">Training</option>
                    <option value="Drill">Emergency Drill</option>
                    <option value="Repository">General Repository</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Linked Record ID</label>
                  <input
                    type="text"
                    value={linkedRecordId}
                    onChange={(e) => setLinkedRecordId(e.target.value)}
                    placeholder="e.g. EVT-2026-000001"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Photograph of damaged rack anchor bolt on Assembly Line 1"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Tags</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. photo, equipment, mechanical"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold"
                >
                  Upload File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
