import React from 'react';
import { Info, Printer, ShieldCheck, Heart } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white">About SEZNIK Printer Manager</h1>
        <p className="text-xs text-slate-400">Enterprise Desktop Application for Automated Printer Management</p>
      </div>

      <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-seznik-600 to-blue-800 flex items-center justify-center shadow-fluent-glow">
            <Printer className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">SEZNIK Printer Manager</h2>
            <p className="text-xs text-slate-400">Version 1.0.0 (Enterprise Production Architecture)</p>
          </div>
        </div>

        <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Core Stack</span>
            <p className="text-slate-200 font-semibold">Electron + React + Vite + TypeScript + Tailwind CSS</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Backend & Database</span>
            <p className="text-slate-200 font-semibold">Node.js Express REST API + PostgreSQL + Prisma ORM</p>
          </div>
        </div>
      </div>
    </div>
  );
};
