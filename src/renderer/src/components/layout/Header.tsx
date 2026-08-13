import React, { useEffect, useState } from 'react';
import { Printer, Zap, RefreshCw } from 'lucide-react';
import { WindowControls } from './WindowControls';
import { usePrinterStore } from '../../store/usePrinterStore';

export const Header: React.FC = () => {
  const { v1State, osPrinters, savedPrinters, startV1Pipeline, fetchOsPrinters, fetchSavedPrinters } = usePrinterStore();
  const [platform, setPlatform] = useState<string>('win32');

  useEffect(() => {
    if (window.seznikApi) {
      window.seznikApi.getSystemInfo().then(info => setPlatform(info.platform));
    }
  }, []);

  const isUsbConnected = v1State.usbConnected;

  return (
    <header className="h-[38px] bg-slate-900 border-b border-slate-800/90 px-3 flex items-center justify-between select-none titlebar-drag shrink-0 z-50 text-slate-300">
      {/* Left Branding */}
      <div className="flex items-center space-x-2.5 titlebar-no-drag">
        <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white">
          <Printer className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-black tracking-wider text-slate-100 uppercase">
            SEZNIK PRINTER MANAGER
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono font-bold border border-slate-700">
            v1.0 ({platform === 'win32' ? 'Windows' : 'macOS'})
          </span>
        </div>
      </div>

      {/* Center Status Pill */}
      <div className="hidden md:flex items-center space-x-3 titlebar-no-drag">
        {isUsbConnected ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            1 USB Printer Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-950/80 text-rose-400 border border-rose-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            No USB Printer Connected
          </span>
        )}

        <button
          onClick={() => { fetchOsPrinters(); fetchSavedPrinters(); }}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Refresh Hardware Scanning"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Right Window Controls */}
      <div className="flex items-center space-x-2 titlebar-no-drag">
        <WindowControls />
      </div>
    </header>
  );
};

