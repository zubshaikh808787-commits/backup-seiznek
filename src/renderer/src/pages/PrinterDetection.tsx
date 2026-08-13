import React from 'react';
import { Usb, RefreshCw, CheckCircle2 } from 'lucide-react';
import { usePrinterStore } from '../store/usePrinterStore';

export const PrinterDetection: React.FC = () => {
  const { isScanning, fetchOsPrinters, osPrinters } = usePrinterStore();

  const handleScan = async () => {
    await fetchOsPrinters();
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto select-none">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wider">USB Hardware Detection & Spooler Monitor</h1>
          <p className="text-xs text-slate-500 font-medium">Real-time printer queue enumeration across USB ports</p>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning USB Ports...' : 'Scan Ports'}
        </button>
      </div>

      {/* Detection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs font-extrabold text-blue-700">
            <span className="flex items-center gap-1.5"><Usb className="w-4 h-4 text-blue-600" /> USB PnP Monitor</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">Active</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Monitors hardware USB insertion and PnP class entities.</p>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs font-extrabold text-emerald-700">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Spooler Subsystem</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">Ready</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Communicates with OS Spooler API (`Win32_Printer` / `lpstat`).</p>
        </div>
      </div>

      {/* Detected Device Table */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider">Enumerated USB Devices</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-extrabold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Interface</th>
                <th className="p-2.5">Printer Queue Name</th>
                <th className="p-2.5">Driver Name</th>
                <th className="p-2.5">Port</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {osPrinters.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-blue-700 flex items-center gap-1"><Usb className="w-3.5 h-3.5" /> USB</td>
                  <td className="p-2.5 font-extrabold text-slate-900">{p.name}</td>
                  <td className="p-2.5 text-slate-600 font-medium">{p.driverName}</td>
                  <td className="p-2.5 font-mono text-slate-700">{p.portName}</td>
                  <td className="p-2.5 text-emerald-700 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {p.status}</td>
                </tr>
              ))}
              {osPrinters.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 font-medium">
                    No active USB printer queue detected. Connect a physical USB printer to your PC.
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

