import React from 'react';
import { Usb, RefreshCw, CheckCircle2, Printer } from 'lucide-react';
import { usePrinterStore } from '../store/usePrinterStore';

export const PrinterDetection: React.FC = () => {
  const { isScanning, fetchOsPrinters, osPrinters } = usePrinterStore();

  const handleScan = async () => {
    await fetchOsPrinters();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto select-none">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">USB Connected Printers</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Real-time status of thermal printers connected via USB</p>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning Ports...' : 'Scan Ports'}
        </button>
      </div>

      {/* Detection Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="synapse-card rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-2"><Usb className="w-4 h-4 text-blue-600" /> USB Hardware Link</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-200">Active</span>
          </div>
          <p className="text-xs text-slate-400 font-medium">Auto-detects USB printer connection and port binding.</p>
        </div>

        <div className="synapse-card rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Print Spooler</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-200">Ready</span>
          </div>
          <p className="text-xs text-slate-400 font-medium">Windows printer queue subsystem is online and ready.</p>
        </div>
      </div>

      {/* Detected Device Table */}
      <div className="synapse-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-150 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-700">Detected USB Printer Queues</h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-150 text-slate-400 font-semibold bg-slate-50/30">
              <th className="py-3 px-4">Interface</th>
              <th className="py-3 px-4">Printer Name</th>
              <th className="py-3 px-4">Driver</th>
              <th className="py-3 px-4">Port</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {osPrinters.map((p, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-blue-600 flex items-center gap-1.5">
                  <Usb className="w-3.5 h-3.5" /> USB
                </td>
                <td className="py-3.5 px-4 font-semibold text-slate-900">{p.name}</td>
                <td className="py-3.5 px-4 text-slate-500">{p.driverName}</td>
                <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">{p.portName}</td>
                <td className="py-3.5 px-4 text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {p.status || 'Ready'}
                </td>
              </tr>
            ))}
            {osPrinters.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No active USB printers detected. Connect a printer via USB to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
