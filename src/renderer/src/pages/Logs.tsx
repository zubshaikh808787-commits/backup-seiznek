import React from 'react';
import { Terminal, RefreshCw, Filter, FileText } from 'lucide-react';
import { useLogsStore } from '../store/useLogsStore';

export const Logs: React.FC = () => {
  const { logs, fetchLogs, isLoading } = useLogsStore();

  React.useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto select-none">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Activity Logs</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Recent printer setup and print activity history</p>
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={isLoading}
          className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="synapse-card rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-150 text-slate-400 font-semibold bg-slate-50/50">
              <th className="py-3 px-4">Time</th>
              <th className="py-3 px-4">Level</th>
              <th className="py-3 px-4">Event</th>
              <th className="py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">{log.timestamp}</td>
                <td className="py-3.5 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    log.level === 'ERROR' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    log.level === 'WARN' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {log.level}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-semibold text-slate-900">{log.actionType}</td>
                <td className="py-3.5 px-4 text-slate-600 font-sans">{log.message}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  No activity logs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
