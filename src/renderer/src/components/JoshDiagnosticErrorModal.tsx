import React from 'react';
import { AlertTriangle, X, RefreshCw, ShieldAlert, HelpCircle } from 'lucide-react';
import { JoshTestPrintResult } from '../../../shared/types';

interface JoshDiagnosticErrorModalProps {
  isOpen: boolean;
  result: JoshTestPrintResult | null;
  onClose: () => void;
  onRetry?: () => void;
}

export const JoshDiagnosticErrorModal: React.FC<JoshDiagnosticErrorModalProps> = ({
  isOpen,
  result,
  onClose,
  onRetry,
}) => {
  if (!isOpen || !result || result.success) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-rose-200 dark:border-rose-900/50 shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 select-none">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-rose-600 to-red-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-rose-950/50 text-rose-200 px-2 py-0.5 rounded">
                PIPELINE VERIFICATION FAILED
              </span>
              <h2 className="text-lg font-black tracking-tight mt-0.5">
                JOSH Test Print Failed
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Failed Stage Banner */}
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Failed Pipeline Stage
              </span>
              <div className="text-sm font-extrabold text-rose-900 dark:text-rose-100 font-mono">
                {result.stage}
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-200 mt-1 font-medium leading-relaxed">
                {result.message}
              </p>
            </div>
          </div>

          {/* Diagnostic Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Printer Hardware</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate block mt-0.5">
                {result.printerName || 'JOSH LD0801'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Brand</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 block mt-0.5">
                {result.brand || 'JOSH'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Connection</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">USB</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Spooler Queue</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 truncate block mt-0.5">
                {result.queueName || 'None'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Spooler Service</span>
              <span className={`font-bold block mt-0.5 ${result.spoolerStatus === 'STOPPED' ? 'text-rose-600' : 'text-emerald-600'}`}>
                {result.spoolerStatus || 'RUNNING'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Printer Status</span>
              <span className={`font-bold block mt-0.5 ${result.printerStatus === 'OFFLINE' || result.printerStatus === 'ERROR' ? 'text-rose-600' : 'text-emerald-600'}`}>
                {result.printerStatus || 'UNKNOWN'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Print Format</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">50×50mm TSPL</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Error Code</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400 block mt-0.5">
                {result.code || 'UNKNOWN_ERROR'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Windows Job ID</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                {result.jobId ? `#${result.jobId}` : 'None'}
              </span>
            </div>
          </div>

          {/* Details & Suggested Action */}
          <div className="space-y-2.5 text-xs">
            {result.details && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px] leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5">Technical Details:</span>
                {result.details}
              </div>
            )}

            {result.suggestedAction && (
              <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200 flex items-start space-x-2.5">
                <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-indigo-950 dark:text-indigo-100">Suggested Action:</span>
                  <span className="font-medium mt-0.5 block">{result.suggestedAction}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors"
          >
            Dismiss
          </button>

          {onRetry && (
            <button
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center space-x-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Test Print</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
