import React, { useState, useEffect } from 'react';
import {
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Usb,
  FileText,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Unlink,
  AlertTriangle,
  Barcode,
} from 'lucide-react';
import { usePrinterStore } from '../store/usePrinterStore';

export const WePrintSetup: React.FC = () => {
  const {
    v1State,
    triggerV1TestPrint,
    startV1Pipeline,
  } = usePrinterStore();

  const [isPrinting, setIsPrinting] = useState(false);
  const [actionLog, setActionLog] = useState<string[]>([]);

  const appendLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setActionLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    appendLog(`V1 State: [${v1State.step}] ${v1State.stepMessage}`);
  }, [v1State.step]);

  const handlePrintTest = async () => {
    setIsPrinting(true);
    appendLog(`Executing real physical test print for brand [${v1State.brand}]...`);

    const res = await triggerV1TestPrint();
    setIsPrinting(false);
    appendLog(res.message);
  };

  return (
    <div className="space-y-6 select-none pb-8 text-slate-800">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-600/30 rounded-xl border border-blue-400/30 backdrop-blur-sm">
            <Printer className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-blue-500 text-white rounded-md">
                SEZNIK V1 AUTOMATED SETUP
              </span>
              <span className="text-xs text-slate-400 font-medium">Final V1 Architecture</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
              USB Hardware Auto-Identification & Setup Engine
            </h1>
          </div>
        </div>

        <div className="flex items-center bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-blue-400 space-x-2">
          <Usb className="w-4 h-4 text-blue-400" />
          <span>USB ONLY ARCHITECTURE</span>
        </div>
      </div>

      {/* Main Grid: Utility Specs + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Specs & Actions (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
                  Automated Hardware Detection
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {v1State.usbConnected ? (v1State.detectedHardwareName || 'REAL USB PRINTER DETECTED') : 'No USB printer detected.'}
                </h3>
              </div>

              {v1State.usbConnected ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  USB READY
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  <Unlink className="w-3.5 h-3.5 mr-1.5" />
                  DISCONNECTED
                </span>
              )}
            </div>

            {/* Spec Table Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Matched Brand</span>
                <span className="text-xs font-black text-blue-600 block mt-0.5">{v1State.brand}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Spooler Queue</span>
                <span className="text-xs font-black text-slate-800 block mt-0.5 truncate">{v1State.queueName || 'None'}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Driver Status</span>
                <span className={`text-xs font-black block mt-0.5 ${v1State.driverInstalled ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {v1State.driverInstalled ? 'Installed ✓' : 'Not Installed'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Media Type</span>
                <span className="text-xs font-black text-slate-800 block mt-0.5">
                  {v1State.brand === 'JOSH' ? '50x50mm Label' : v1State.brand === 'VEER' ? '58mm Receipt' : v1State.brand === 'DEV' ? 'Label + Receipt' : 'None'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase block">SEZNIK Default</span>
                <span className={`text-xs font-black block mt-0.5 ${v1State.isDefault ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {v1State.isDefault ? 'Yes ✓' : 'No'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Test Print Status</span>
                <span className={`text-xs font-black block mt-0.5 ${v1State.testPrintSuccess ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {v1State.testPrintSuccess ? 'Verified ✓' : 'Pending'}
                </span>
              </div>
            </div>

            {/* Pipeline Status Banner */}
            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-100 text-xs text-blue-900 font-semibold flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{v1State.stepMessage}</span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => startV1Pipeline()}
                className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Re-Scan USB Bus</span>
              </button>

              <button
                onClick={handlePrintTest}
                disabled={!v1State.usbConnected || !v1State.queueName || isPrinting}
                className="flex-1 min-w-[200px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                <span>RUN REAL PHYSICAL TEST PRINT</span>
              </button>
            </div>
          </div>

          {/* Realtime Execution Log */}
          <div className="bg-slate-900 rounded-2xl p-4 text-slate-300 font-mono text-[11px] space-y-2 border border-slate-800 shadow-inner">
            <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800 text-[10px] font-extrabold uppercase">
              <span className="flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>USB V1 Orchestrator Event Log</span>
              </span>
              <button onClick={() => setActionLog([])} className="hover:text-slate-200">
                Clear
              </button>
            </div>

            <div className="h-32 overflow-y-auto space-y-1 scrollbar-thin pr-1">
              {actionLog.map((log, i) => (
                <div key={i} className="leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Preview */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Live USB Print Specification
                  </h3>
                </div>
              </div>

              <div className="flex justify-center p-4 bg-slate-100/80 rounded-2xl border border-slate-200 min-h-[260px] items-center">
                {v1State.brand === 'JOSH' ? (
                  <div className="w-[180px] h-[180px] bg-white border-2 border-slate-800 rounded-lg shadow-xl p-3 flex flex-col justify-between text-center select-none">
                    <div className="text-[12px] font-black uppercase text-slate-900">JOSH TEST LABEL</div>
                    <div className="text-[8px] font-bold text-blue-600">50mm × 50mm TSPL</div>
                    <div className="text-[8px] font-bold text-emerald-600">REAL PRINT VERIFIED</div>
                    <div className="text-[9px] font-mono font-bold text-slate-900">SEZNIK-JOSH</div>
                  </div>
                ) : v1State.brand === 'VEER' ? (
                  <div className="w-[190px] bg-white border border-slate-300 shadow-xl rounded-b-lg p-3 text-slate-800 font-mono text-[9px] space-y-1.5">
                    <div className="text-center font-bold">SEZNIK POS STORE</div>
                    <div className="text-center text-[8px] text-slate-500">58mm Thermal Receipt</div>
                    <div className="text-[8px] text-emerald-700 font-bold text-center">REAL PRINT VERIFIED</div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 font-medium text-center">
                    {v1State.usbConnected ? 'Supported Hardware Connected' : 'No USB Printer Connected'}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 text-[11px] leading-relaxed">
              <span className="font-bold text-slate-700 block mb-0.5">Automated Verification</span>
              All driver detection, spooler queue creation, physical test printing, and default setting complete automatically.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
