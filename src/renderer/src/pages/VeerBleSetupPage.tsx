import React, { useEffect, useRef } from 'react';
import {
  Bluetooth,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  HardDrive,
  Check,
  Star,
  Activity,
  Terminal,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVeerBleSetupStore } from '../store/useVeerBleSetupStore';

export const VeerBleSetupPage: React.FC = () => {
  const { state, isStarting, init, startSetup, resetSetup } = useVeerBleSetupStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.logs]);

  const isRunning = state.step !== 'IDLE' && state.step !== 'COMPLETE' && state.step !== 'FAILED';
  const isComplete = state.step === 'COMPLETE';
  const isFailed = state.step === 'FAILED';

  const getStepUserTitle = () => {
    switch (state.step) {
      case 'SCANNING':
        return 'Searching for Bluetooth printer...';
      case 'PRINTER_FOUND':
      case 'IDENTIFYING':
        return `${state.detectedPrinterName || 'VEER MPT-II'} detected`;
      case 'PAIRING':
      case 'PAIRED':
      case 'BLE_CONNECTING':
      case 'BLE_CONNECTED':
      case 'GATT_READY':
        return 'Connecting Bluetooth...';
      case 'CHECKING_DRIVER':
      case 'REQUESTING_ADMIN_PERMISSION':
        return 'Windows administrator permission required';
      case 'INSTALLING_DRIVER':
      case 'VERIFYING_DRIVER':
        return 'Installing printer driver...';
      case 'CREATING_OS_PRINTER':
      case 'VERIFYING_OS_PRINTER':
        return 'Configuring printer...';
      case 'SETTING_DEFAULT':
      case 'VERIFYING_DEFAULT':
        return 'Setting as default printer...';
      case 'TEST_PRINTING':
      case 'VERIFYING_TEST_PRINT':
        return 'Printing test page...';
      case 'COMPLETE':
        return 'SETUP COMPLETE';
      case 'FAILED':
        return 'Setup Needs Attention';
      default:
        return 'True BLE Windows Printer Setup';
    }
  };

  const checklistItems = [
    {
      id: 'printer',
      label: 'Printer',
      value: state.detectedPrinterName || (isComplete ? 'VEER MPT-II' : 'Detecting...'),
      done: !!state.detectedPrinterName || isComplete,
    },
    {
      id: 'connection',
      label: 'Connection',
      value: 'Bluetooth Low Energy (GATT)',
      done: state.isPaired || isComplete,
    },
    {
      id: 'driver',
      label: 'Driver',
      value: state.driverName ? `Installed (${state.driverName})` : (isComplete ? 'Installed' : 'Pending'),
      done: state.isDriverInstalled || isComplete,
    },
    {
      id: 'os_printer',
      label: 'Windows Printer',
      value: state.osPrinterQueueName ? `Ready (${state.osPrinterQueueName})` : (isComplete ? 'Ready' : 'Pending'),
      done: state.isOsPrinterCreated || isComplete,
    },
    {
      id: 'default',
      label: 'Default Printer',
      value: state.isDefaultPrinter || isComplete ? 'Yes' : 'Pending',
      done: state.isDefaultPrinter || isComplete,
    },
    {
      id: 'test_print',
      label: 'Test Print',
      value: state.isTestPrintSuccess || isComplete ? 'Success' : 'Pending',
      done: state.isTestPrintSuccess || isComplete,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 select-none">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20 flex items-center justify-center text-white">
            <Bluetooth className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              True BLE Windows Printer Setup
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50">
                100% BLE GATT
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated Windows driver staging, OS spooler registration & BLE GATT test print
            </p>
          </div>
        </div>

        {/* Top Control Buttons */}
        <div className="flex items-center space-x-2.5">
          {state.step === 'IDLE' ? (
            <button
              onClick={() => startSetup()}
              disabled={isStarting}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-blue-600/25 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Automated BLE Setup</span>
            </button>
          ) : isComplete ? (
            <button
              onClick={() => resetSetup()}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Run Setup Again</span>
            </button>
          ) : isFailed ? (
            <button
              onClick={() => startSetup()}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-600/25 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Setup</span>
            </button>
          ) : (
            <button
              disabled
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Setup in progress...</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Setup Progress Card */}
      <div className="synapse-card rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
        {/* Animated Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Current Status
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                State: {state.step}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              {isComplete ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" />
              ) : isFailed ? (
                <AlertCircle className="w-7 h-7 text-rose-500 shrink-0" />
              ) : (
                <Activity className={`w-6 h-6 ${isRunning ? 'animate-pulse text-blue-600' : 'text-slate-400'}`} />
              )}
              <span>{getStepUserTitle()}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              {state.stepMessage}
            </p>
          </div>

          {/* Progress Circle / Badge */}
          <div className="flex items-center space-x-3 self-start sm:self-center">
            <div className="text-right">
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {state.progressPercent}%
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Completed</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${
              isComplete
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : isFailed
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-blue-600 to-indigo-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${state.progressPercent}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Error Callout if Failed */}
        {isFailed && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 space-y-1 text-xs">
            <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{state.errorCode || 'SETUP_ERROR'}</span>
            </div>
            <p className="text-rose-700 dark:text-rose-400">{state.errorMessage}</p>
            {state.errorDetails && (
              <pre className="mt-2 p-2 bg-rose-900/10 dark:bg-rose-950/60 rounded text-[11px] font-mono text-rose-800 dark:text-rose-300 overflow-x-auto">
                {state.errorDetails}
              </pre>
            )}
          </div>
        )}

        {/* Official Technical Checklist Card */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 tracking-wide uppercase">
              System Verification Checklist
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                  item.done
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300'
                    : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="space-y-0.5 truncate pr-2">
                  <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    {item.label}
                  </div>
                  <div className="text-xs font-bold truncate">
                    {item.value}
                  </div>
                </div>

                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    item.done
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  {item.done ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Setup Log Terminal Drawer */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <div className="flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-600" />
              <span>Real-Time Setup Logs ({state.logs.length})</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Windows Native WinRT & Spooler Pipeline
            </span>
          </div>

          <div className="h-44 rounded-xl bg-slate-950 text-slate-300 p-3 font-mono text-[11px] overflow-y-auto space-y-1.5 border border-slate-800 shadow-inner">
            {state.logs.length > 0 ? (
              state.logs.map((log, idx) => (
                <div key={idx} className="flex items-start space-x-2 leading-relaxed">
                  <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                  <span
                    className={`font-bold shrink-0 text-[10px] px-1 py-0.2 rounded ${
                      log.category === 'SETUP'
                        ? 'bg-blue-900/60 text-blue-300'
                        : log.category === 'BLE'
                        ? 'bg-indigo-900/60 text-indigo-300'
                        : log.category === 'DRIVER'
                        ? 'bg-amber-900/60 text-amber-300'
                        : log.category === 'PRINTER'
                        ? 'bg-teal-900/60 text-teal-300'
                        : log.category === 'PRINT'
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : 'bg-rose-900/60 text-rose-300'
                    }`}
                  >
                    [{log.category}]
                  </span>
                  <span
                    className={
                      log.level === 'SUCCESS'
                        ? 'text-emerald-400 font-semibold'
                        : log.level === 'WARN'
                        ? 'text-amber-400'
                        : log.level === 'ERROR'
                        ? 'text-rose-400 font-semibold'
                        : 'text-slate-300'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-600 italic py-8 text-center">
                Click "Start Automated BLE Setup" to begin.
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
