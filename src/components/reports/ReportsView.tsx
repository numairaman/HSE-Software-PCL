import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';

export const ReportsView: React.FC = () => {
  const { organization } = useAuth();
  const [selectedReport, setSelectedReport] = useState<string>('incidents');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = async (type: string) => {
    try {
      setLoading(true);
      setSelectedReport(type);
      const res = await api.getExportData(type);
      setReportData(res);
    } catch (err: any) {
      alert('Error generating report: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
      alert('No data to export');
      return;
    }

    const keys = Object.keys(reportData.rows[0]);
    const csvRows = [];
    csvRows.push(keys.map((k) => `"${k}"`).join(','));

    for (const row of reportData.rows) {
      const values = keys.map((k) => {
        const val = row[k] !== undefined && row[k] !== null ? String(row[k]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedReport}_register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <span>Statutory Reports & Regulatory Export Center</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Export structured Excel/CSV registers and print-ready PDF management documents
          </p>
        </div>

        <div className="flex items-center gap-2">
          {reportData && (
            <>
              <button
                onClick={downloadCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV / Excel</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print PDF View</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Select Report Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => loadReport('incidents')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedReport === 'incidents'
              ? 'bg-slate-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
              : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 text-slate-400'
          }`}
        >
          <div className="text-xs font-bold text-white uppercase tracking-wider">Incident Register Report</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Complete log of all events, classifications, severities, and investigation states
          </p>
        </button>

        <button
          onClick={() => loadReport('capa')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedReport === 'capa'
              ? 'bg-slate-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
              : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 text-slate-400'
          }`}
        >
          <div className="text-xs font-bold text-white uppercase tracking-wider">Corrective Action (CAPA) Register</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Central action tracker with responsible persons, overdue flags, and verification history
          </p>
        </button>

        <button
          onClick={() => loadReport('audits')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedReport === 'audits'
              ? 'bg-slate-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
              : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 text-slate-400'
          }`}
        >
          <div className="text-xs font-bold text-white uppercase tracking-wider">Tamper-Resistant Audit Trail</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Immutable log of all user actions, assignments, approvals, and system state transitions
          </p>
        </button>
      </div>

      {/* Preview Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Generating report dataset...</div>
      ) : reportData && reportData.rows ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6 space-y-4 print:bg-white print:text-black print:border-none">
          <div className="border-b border-slate-800 pb-3 flex justify-between items-end print:border-black">
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">{organization?.name}</div>
              <h3 className="text-base font-bold text-white print:text-black">{reportData.title}</h3>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              <div>Generated: {new Date(reportData.generatedAt).toLocaleString()}</div>
              <div>Total Records: {reportData.rows.length}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] text-slate-300 print:text-black divide-y divide-slate-800 print:divide-black">
              <thead className="bg-slate-950/80 print:bg-slate-100 font-bold text-slate-400 print:text-black uppercase text-[10px]">
                <tr>
                  {Object.keys(reportData.rows[0] || {}).map((col) => (
                    <th key={col} className="py-2 px-3">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-300">
                {reportData.rows.slice(0, 50).map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    {Object.values(row).map((val: any, cidx: number) => (
                      <td key={cidx} className="py-2 px-3 truncate max-w-xs">
                        {String(val || '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 text-xs bg-slate-900/40 border border-slate-800 rounded-xl">
          Select a report above to generate and preview data.
        </div>
      )}
    </div>
  );
};
