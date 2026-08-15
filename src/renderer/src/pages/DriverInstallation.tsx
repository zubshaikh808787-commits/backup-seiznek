import React from 'react';
import { HardDriveDownload, ShieldCheck, CheckCircle2, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { usePrinterStore } from '../store/usePrinterStore';

export const DriverInstallation: React.FC = () => {
  const { installJoshDriver, installVeerDriver, installDevDriver, fetchOsPrinters } = usePrinterStore();
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [logMessage, setLogMessage] = React.useState<string | null>(null);

  const handleInstallJosh = async () => {
    setIsInstalling(true);
    setLogMessage('Setting up Label Printer Driver...');
    const res = await installJoshDriver();
    setLogMessage(res.success ? 'Label printer driver ready ✓' : res.log);
    await fetchOsPrinters();
    setIsInstalling(false);
  };

  const handleInstallVeer = async () => {
    setIsInstalling(true);
    setLogMessage('Setting up Receipt Printer Driver...');
    const res = await installVeerDriver();
    setLogMessage(res.success ? 'Receipt printer driver ready ✓' : res.log);
    await fetchOsPrinters();
    setIsInstalling(false);
  };

  const handleInstallDev = async () => {
    setIsInstalling(true);
    setLogMessage('Setting up Dual-Mode Printer Driver...');
    if (installDevDriver) {
      const res = await installDevDriver();
      setLogMessage(res.success ? 'Dual-mode printer driver ready ✓' : res.log);
    }
    await fetchOsPrinters();
    setIsInstalling(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto select-none">
      <div className="pb-2 border-b border-slate-200/60">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Printer Drivers & Setup</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Install drivers for SEZNIK thermal label and receipt printers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Label Driver */}
        <div className="synapse-card rounded-2xl p-5 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800">Label Printer Driver</h3>
                <p className="text-[11px] text-slate-400 font-medium">50×50mm TSPL Protocol</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Standard Windows driver for thermal barcode and product label printing.
            </p>
          </div>

          <button
            onClick={handleInstallJosh}
            disabled={isInstalling}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5"
          >
            <HardDriveDownload className={`w-3.5 h-3.5 ${isInstalling ? 'animate-spin' : ''}`} />
            <span>Install Label Driver</span>
          </button>
        </div>

        {/* Receipt Driver */}
        <div className="synapse-card rounded-2xl p-5 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800">Receipt Printer Driver</h3>
                <p className="text-[11px] text-slate-400 font-medium">58mm ESC/POS Protocol</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Standard Windows spooler driver for continuous receipt and bill printing.
            </p>
          </div>

          <button
            onClick={handleInstallVeer}
            disabled={isInstalling}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5"
          >
            <HardDriveDownload className={`w-3.5 h-3.5 ${isInstalling ? 'animate-spin' : ''}`} />
            <span>Install Receipt Driver</span>
          </button>
        </div>

        {/* Dual-Mode Driver */}
        <div className="synapse-card rounded-2xl p-5 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800">Dual-Mode Driver</h3>
                <p className="text-[11px] text-slate-400 font-medium">80mm Dual Label & Receipt</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              High-performance driver for hybrid receipt and large label thermal hardware.
            </p>
          </div>

          <button
            onClick={handleInstallDev}
            disabled={isInstalling}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5"
          >
            <HardDriveDownload className={`w-3.5 h-3.5 ${isInstalling ? 'animate-spin' : ''}`} />
            <span>Install Dual-Mode Driver</span>
          </button>
        </div>
      </div>

      {logMessage && (
        <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 text-xs text-emerald-400 font-mono">
          {logMessage}
        </div>
      )}
    </div>
  );
};
