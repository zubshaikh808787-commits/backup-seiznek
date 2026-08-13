import React from 'react';
import { Download, CheckCircle2 } from 'lucide-react';

export const Downloads: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white">Downloaded Packages & Drivers</h1>
        <p className="text-xs text-slate-400">Manage downloaded driver installers, SDK archives, and firmware binaries</p>
      </div>

      <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3 text-xs">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-3">
            <Download className="w-4 h-4 text-blue-400" />
            <div>
              <p className="font-bold text-white">seznik_driver_v2.4.1_dual.exe</p>
              <p className="text-[10px] text-slate-500">SHA256: e3b0c44298fc1c1... | 14.2 MB</p>
            </div>
          </div>
          <span className="text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
        </div>
      </div>
    </div>
  );
};
