import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export const WindowControls: React.FC = () => {
  const handleMinimize = () => window.seznikApi?.minimizeWindow();
  const handleMaximize = () => window.seznikApi?.maximizeWindow();
  const handleClose = () => window.seznikApi?.closeWindow();

  return (
    <div className="flex items-center space-x-1 titlebar-no-drag">
      <button
        onClick={handleMinimize}
        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        title="Minimize"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleMaximize}
        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        title="Maximize"
      >
        <Square className="w-3 h-3" />
      </button>
      <button
        onClick={handleClose}
        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white hover:bg-red-500 rounded-lg transition-colors"
        title="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
