import React from 'react';
import { Info, Printer, ShieldCheck, Heart, Laptop, Layers } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto select-none">
      <div className="pb-2 border-b border-slate-200/60">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">About SEZNIK</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Desktop Application for SEZNIK Thermal Printers</p>
      </div>

      <div className="synapse-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center shadow-sm text-white">
            <Printer className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">SEZNIK Printer Manager</h2>
            <p className="text-xs text-slate-400 font-medium">Version 1.0.0 (Desktop Edition)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-slate-400 font-medium">Architecture</span>
            <p className="text-slate-800 font-semibold">Electron • React • TypeScript • Tailwind CSS</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-slate-400 font-medium">Supported Hardware</span>
            <p className="text-slate-800 font-semibold">JOSH Label (50×50mm) • VEER Receipt (58mm)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
