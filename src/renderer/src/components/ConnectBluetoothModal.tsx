import React, { useEffect } from 'react';
import { Bluetooth, RefreshCw, X, CheckCircle2, AlertTriangle, Printer, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrinterStore } from '../store/usePrinterStore';

interface ConnectBluetoothModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectBluetoothModal: React.FC<ConnectBluetoothModalProps> = ({ isOpen, onClose }) => {
  const {
    bluetoothState,
    scanBluetoothDevices,
    connectBluetoothDevice,
    triggerBluetoothTestPrint,
  } = usePrinterStore();

  useEffect(() => {
    if (isOpen) {
      scanBluetoothDevices();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isBusy = bluetoothState.step === 'SCANNING' || bluetoothState.step === 'CONNECTING' || bluetoothState.step === 'TEST_PRINTING';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden text-slate-800"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                <Bluetooth className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Connect via Bluetooth</h2>
                <p className="text-[11px] text-slate-500 font-medium">Pick a Windows-paired printer to connect wirelessly</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Instructions */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 font-medium leading-relaxed">
              Pair your printer in <strong className="text-slate-800">Windows Settings → Bluetooth & devices</strong> first if it isn't listed
              below. Connecting here installs it as a real <strong className="text-slate-800">Windows printer</strong> — it'll show up in
              any app's Print dialog (Ctrl+P), not just SEZNIK — and fires one test receipt to confirm it actually prints.
            </div>

            {/* Scan bar */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600">{bluetoothState.stepMessage}</span>
              <button
                onClick={() => scanBluetoothDevices()}
                disabled={isBusy}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
              >
                <RefreshCw className={`w-3 h-3 ${bluetoothState.step === 'SCANNING' ? 'animate-spin' : ''}`} />
                <span>Rescan</span>
              </button>
            </div>

            {/* Device list */}
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {bluetoothState.devices.length === 0 && bluetoothState.step !== 'SCANNING' && (
                <div className="p-6 text-center border border-dashed border-slate-300 rounded-lg bg-slate-50 space-y-1">
                  <Bluetooth className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">No paired Bluetooth devices found.</p>
                  <p className="text-[11px] text-slate-400">Pair your printer in Windows Bluetooth settings, then rescan.</p>
                </div>
              )}

              {bluetoothState.devices.map((device) => {
                const isThisConnected = bluetoothState.connectedDeviceId === device.id && bluetoothState.step !== 'ERROR';
                const isThisConnecting = isBusy && bluetoothState.connectedDeviceId === device.id;

                return (
                  <div
                    key={device.id}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isThisConnected ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${device.isLikelyPrinter ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                          <Printer className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 truncate">{device.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {device.comPort ? (
                              <span className="font-mono">{device.comPort}</span>
                            ) : (
                              <span className="text-amber-600 font-bold">No serial port bound</span>
                            )}
                            {device.isLikelyPrinter && <span className="ml-1.5 text-blue-600 font-bold">• Likely printer</span>}
                          </p>
                        </div>
                      </div>

                      {isThisConnected ? (
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> CONNECTED
                          </span>
                          {bluetoothState.connectedQueueName && (
                            <span className="text-[9px] text-slate-400 font-mono truncate max-w-[140px]" title={bluetoothState.connectedQueueName}>
                              {bluetoothState.connectedQueueName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => connectBluetoothDevice(device.id)}
                          disabled={isBusy || !device.comPort}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold shrink-0 flex items-center gap-1.5 transition-all"
                        >
                          {isThisConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bluetooth className="w-3 h-3" />}
                          <span>Connect</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Connection / test print result */}
            {(bluetoothState.step === 'CONNECTED' ||
              bluetoothState.step === 'TEST_PRINTING' ||
              bluetoothState.step === 'TEST_PRINT_SUCCESS' ||
              bluetoothState.step === 'TEST_PRINT_FAILED') && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
                  bluetoothState.step === 'TEST_PRINT_SUCCESS'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : bluetoothState.step === 'TEST_PRINT_FAILED'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                {bluetoothState.step === 'TEST_PRINTING' && <Loader2 className="w-4 h-4 shrink-0 animate-spin mt-0.5" />}
                {bluetoothState.step === 'TEST_PRINT_SUCCESS' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                {bluetoothState.step === 'TEST_PRINT_FAILED' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                {bluetoothState.step === 'CONNECTED' && <Bluetooth className="w-4 h-4 shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p>{bluetoothState.stepMessage}</p>
                  {bluetoothState.step === 'TEST_PRINT_FAILED' && (
                    <button
                      onClick={() => triggerBluetoothTestPrint()}
                      className="mt-2 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all"
                    >
                      Retry Test Print
                    </button>
                  )}
                </div>
              </div>
            )}

            {bluetoothState.step === 'ERROR' && (
              <div className="p-3 rounded-xl border bg-rose-50 border-rose-200 text-rose-900 text-xs font-semibold flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{bluetoothState.stepMessage}</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
