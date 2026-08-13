import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RemovePrinterModalProps {
  isOpen: boolean;
  printerName: string;
  isDefault: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const RemovePrinterModal: React.FC<RemovePrinterModalProps> = ({
  isOpen,
  printerName,
  isDefault,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-md w-full space-y-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Remove Printer?</h3>
                <p className="text-xs font-semibold text-slate-500">DeskApp Printer Configuration</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed font-medium">
            <p>
              Are you sure you want to remove:
            </p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-extrabold text-slate-900 text-sm flex items-center justify-between">
              <span>{printerName}</span>
              {isDefault && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  CURRENT DEFAULT
                </span>
              )}
            </div>
            <p>
              from SEZNIK Printer Manager?
            </p>

            {isDefault && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold space-y-1">
                <div className="font-extrabold text-amber-800">Default Printer Protection</div>
                <p>This printer is currently your default printer. Removing it will automatically promote another available saved printer to default.</p>
              </div>
            )}

            <div className="p-3 bg-slate-100/70 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <span className="font-extrabold text-slate-800">System Clean Uninstallation:</span>
              <p>This will remove the printer data from SEZNIK Manager, <strong className="text-emerald-700 font-extrabold">delete the print queue from OS Spooler, and uninstall the driver package from Windows system</strong>.</p>
              <p className="text-[10px] text-slate-500 italic">No need to visit Control Panel or Programs & Features!</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all border border-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-500/20 transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Remove Printer</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
