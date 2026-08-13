import React from 'react';
import { Terminal, RefreshCw, Filter } from 'lucide-react';
import { useLogsStore } from '../store/useLogsStore';

export const Logs: React.FC = () => {
  const { logs, fetchLogs, isLoading } = useLogsStore();

  React.useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-4 max-w-6xl mx-auto select-none">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wider">System Diagnostics & Hardware Audit Log</h1>
          <p className="text-xs text-slate-500 font-medium font-sans">Real-time Winston logger outputs for installation, spooler, driver, and print actions</p>
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={isLoading}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-extrabold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Level</th>
                <th className="p-2.5">Action Type</th>
                <th className="p-2.5">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-2.5 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                      log.level === 'ERROR' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                      log.level === 'WARN' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="p-2.5 font-bold text-slate-900">{log.actionType}</td>
                  <td className="p-2.5 text-slate-700">{log.message}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500 font-sans text-xs">
                    No diagnostic logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
