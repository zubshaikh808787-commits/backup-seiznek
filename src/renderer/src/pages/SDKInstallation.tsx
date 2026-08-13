import React from 'react';
import { Code2, Box, CheckCircle2, Download } from 'lucide-react';

export const SDKInstallation: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white">SDK Modular Architecture Interface</h1>
        <p className="text-xs text-slate-400">Extensible plugin interface designed for future DLL, EXE, Framework, and SDK binaries</p>
      </div>

      <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">SEZNIK Modular Integration Bridge</h2>
              <p className="text-xs text-slate-400">Status: Interfaces Registered & Ready for Binary Ingestion</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
            Architecture Ready
          </span>
        </div>
      </div>

      {/* Available SDK Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl glass-panel border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-400" /> SEZNIK Thermal Core SDK
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">v1.0.0</span>
          </div>
          <p className="text-xs text-slate-400">High-speed ESC/POS raster print engine, barcode builder, status query bindings.</p>
          <div className="pt-2 flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Core Interface Ready</span>
            <button className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700">View Interface API</button>
          </div>
        </div>

        <div className="p-5 rounded-xl glass-panel border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Box className="w-4 h-4 text-purple-400" /> SEZNIK TSPL/ZPL Vector Label SDK
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">v1.0.0</span>
          </div>
          <p className="text-xs text-slate-400">Vector label rendering, dynamic QR generator, sensor calibration helpers.</p>
          <div className="pt-2 flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Vector Interface Ready</span>
            <button className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700">View Interface API</button>
          </div>
        </div>
      </div>
    </div>
  );
};
