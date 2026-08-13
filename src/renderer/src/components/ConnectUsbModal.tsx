import React from 'react';
import { Usb, RefreshCw, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConnectUsbModalProps {
  isOpen: boolean;
  onScanClick: () => void;
  isScanning: boolean;
}

export const ConnectUsbModal: React.FC<ConnectUsbModalProps> = ({
  isOpen,
  onScanClick,
  isScanning,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden p-6 space-y-5 text-slate-800 text-center"
        >
          {/* Animated Graphic Badge */}
          <div className="relative w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <Usb className="w-8 h-8 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white animate-ping"></span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
              Please Connect Your Printer via USB
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              No physical USB printer queue or hardware device detected. Connect your thermal printer cable to an active USB port on your PC.
            </p>
          </div>

          {/* Real-time Status Monitor Pill */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="text-[11px] text-slate-600 font-bold">Listening for USB hardware insertion...</span>
            </div>
            <button
              onClick={onScanClick}
              disabled={isScanning}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              <span>Scan Now</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-center space-x-2 text-[10px] text-slate-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Auto-detects JOSH (TSPL 50x50mm) & VEER (ESC/POS 58mm) Hardware</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
