import React, { useEffect, useState } from 'react';
import {
  Printer,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sparkles,
  Star,
  RefreshCw,
  Usb,
  Bluetooth,
  ShieldCheck,
  FileText,
  Trash2,
  AlertTriangle,
  HardDriveDownload,
  PlusCircle,
  StarOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { usePrinterStore } from '../store/usePrinterStore';
import { RemovePrinterModal } from '../components/RemovePrinterModal';
import { ConnectBluetoothModal } from '../components/ConnectBluetoothModal';

export const Dashboard: React.FC = () => {
  const {
    v1State,
    osPrinters,
    savedPrinters,
    defaultPrinterId,
    toastMessage,
    initV1Orchestrator,
    startV1Pipeline,
    resetAndScanV1,
    triggerV1TestPrint,
    fetchOsPrinters,
    fetchSavedPrinters,
    savePrinter,
    uninstallDriver,
    removeSavedPrinter,
    clearSavedPrinters,
    setSavedDefaultPrinter,
    removeSavedDefaultPrinter,
    calibratePrinter,
    isScanning,
    setIsScanning,
    bluetoothState,
    initBluetooth,
    disconnectBluetoothDevice,
  } = usePrinterStore();

  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null);
  const [platformInfo, setPlatformInfo] = useState<{ platform: string; arch: string }>({ platform: 'win32', arch: 'x64' });
  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState(false);

  // Removal Modal State
  const [isRemovingPrinter, setIsRemovingPrinter] = useState(false);
  const [removeModalState, setRemoveModalState] = useState<{ isOpen: boolean; id: string; name: string; isDefault: boolean }>({
    isOpen: false,
    id: '',
    name: '',
    isDefault: false,
  });

  useEffect(() => {
    initV1Orchestrator();
    initBluetooth();
    fetchOsPrinters();
    fetchSavedPrinters();

    if (window.seznikApi) {
      window.seznikApi.getSystemInfo().then(info => setPlatformInfo(info));
    }
  }, []);

  const handleRunV1TestPrint = async () => {
    setTestPrintStatus('Executing real physical test print job over USB...');
    const res = await triggerV1TestPrint();
    setTestPrintStatus(res.message);
    setTimeout(() => setTestPrintStatus(null), 5000);
  };

  const handleCalibrate = async () => {
    const targetName = v1State.queueName || (osPrinters.length > 0 ? osPrinters[0].name : null);
    if (!targetName) {
      setTestPrintStatus('No connected USB printer found to calibrate.');
      setTimeout(() => setTestPrintStatus(null), 4000);
      return;
    }

    setTestPrintStatus(`Calibrating USB media sensors on "${targetName}"...`);
    const res = await calibratePrinter(targetName);
    setTestPrintStatus(res.message);
    setTimeout(() => setTestPrintStatus(null), 4000);
  };

  const handleSaveActivePrinter = async (targetName?: string) => {
    const nameToSave = targetName || v1State.queueName || (osPrinters.length > 0 ? osPrinters[0].name : 'USB Printer');
    if (!nameToSave) return;

    const savedId = `saved-${nameToSave.replace(/\s+/g, '-').toLowerCase()}`;
    const brandType = (nameToSave.toLowerCase().includes('pos58') || nameToSave.toLowerCase().includes('veer') ? 'RECEIPT' : 'LABEL') as any;

    const res = await savePrinter({
      id: savedId,
      name: nameToSave,
      driverName: nameToSave,
      portName: 'USB001',
      connectionType: 'USB',
      isDefault: true,
      printerType: brandType,
    });

    await fetchSavedPrinters();
    await fetchOsPrinters();
    setTestPrintStatus(`Printer "${nameToSave}" saved to SEZNIK Printer Manager & OS Default ✓`);
    setTimeout(() => setTestPrintStatus(null), 4000);
  };

  const handleConfirmRemove = async () => {
    const targetId = removeModalState.id;
    const targetName = removeModalState.name || removeModalState.id;
    setRemoveModalState({ isOpen: false, id: '', name: '', isDefault: false });

    if (targetId) {
      // 1. Instantly update UI state (<10ms single-click response)
      await removeSavedPrinter(targetId);
      
      // 2. Perform OS queue unregistration asynchronously in background
      if (uninstallDriver && targetName) {
        uninstallDriver(targetName).catch(() => {});
      }

      setTestPrintStatus(`Printer "${targetName}" removed successfully ✓`);
      setTimeout(() => setTestPrintStatus(null), 3000);

      // Refresh list in background
      if (v1State.queueName?.toLowerCase() === targetName.toLowerCase()) {
        resetAndScanV1().catch(() => {});
      } else {
        fetchOsPrinters().catch(() => {});
        fetchSavedPrinters().catch(() => {});
      }
    }
  };

  const handleSetDefaultPrinter = async (id: string) => {
    const res = await setSavedDefaultPrinter(id);
    setTestPrintStatus(res.message);
    setTimeout(() => setTestPrintStatus(null), 4000);
  };

  const isUsbConnected = v1State.usbConnected;
  const currentPrinterName = isUsbConnected ? (v1State.queueName || v1State.detectedHardwareName || 'USB PRINTER CONNECTED') : null;

  // Derive display list from savedPrinters (multi-printer list) or active OS spooler queues
  const displayList = savedPrinters.length > 0
    ? savedPrinters.map(sp => {
        const isThisConnected = isUsbConnected && (
          v1State.queueName?.toLowerCase() === sp.name.toLowerCase() ||
          v1State.detectedHardwareName?.toLowerCase() === sp.name.toLowerCase() ||
          osPrinters.some(op => op.name.toLowerCase() === sp.name.toLowerCase())
        );
        return {
          ...sp,
          isConnected: isThisConnected,
        };
      })
    : (osPrinters.length > 0
        ? osPrinters.map(p => ({
            id: `os-${p.name}`,
            name: p.name,
            driverName: p.driverName,
            portName: p.portName,
            connectionType: 'USB',
            isDefault: p.isDefault,
            printerType: (p.name.toLowerCase().includes('dp27') || p.name.toLowerCase().includes('josh') ? 'LABEL' : 'RECEIPT') as any,
            savedAt: new Date().toISOString(),
            isConnected: isUsbConnected,
          }))
        : (v1State.queueName ? [{
            id: `v1-${v1State.queueName}`,
            name: v1State.queueName,
            driverName: v1State.queueName,
            portName: 'USB001',
            connectionType: 'USB',
            isDefault: v1State.isDefault,
            printerType: (v1State.brand === 'JOSH' ? 'LABEL' : 'RECEIPT') as any,
            savedAt: new Date().toISOString(),
            isConnected: isUsbConnected,
          }] : [])
      );

  return (
    <div className="space-y-4 max-w-6xl mx-auto select-none text-slate-800">
      {/* Toast Notification Banner */}
      {(toastMessage || testPrintStatus) && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-slate-900 text-white font-semibold text-xs border border-slate-700 shadow-md flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage || testPrintStatus}</span>
          </div>
          <button
            onClick={() => setTestPrintStatus(null)}
            className="text-slate-400 hover:text-white font-bold text-[11px]"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* COMPACT REAL HARDWARE STATUS BAR */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3.5">
          <div className={`p-2.5 rounded-xl ${isUsbConnected ? (v1State.step === 'UNSUPPORTED_PRINTER' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200') : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
            <Usb className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-black uppercase text-slate-900 tracking-wider">
                {isUsbConnected
                  ? (v1State.step === 'UNSUPPORTED_PRINTER' ? 'UNSUPPORTED USB PRINTER DETECTED' : currentPrinterName)
                  : 'NO USB PRINTER DETECTED.'}
              </h2>
              {isUsbConnected ? (
                v1State.step === 'UNSUPPORTED_PRINTER' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                    UNSUPPORTED MODEL
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> REAL USB CONNECTED
                  </span>
                )
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                  DISCONNECTED
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Auto Hardware Brand: <strong className="text-blue-700 font-extrabold">{isUsbConnected ? v1State.brand : 'NONE'}</strong> | Spooler Queue: <span className="font-mono text-slate-700 font-bold">{v1State.queueName || 'None'}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {isUsbConnected && v1State.queueName && (
            <button
              onClick={() => handleSaveActivePrinter()}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1.5"
              title="Save current printer configuration to app storage & default printer"
            >
              <HardDriveDownload className="w-3.5 h-3.5" />
              <span>Save Option</span>
            </button>
          )}

          <button
            onClick={() => startV1Pipeline()}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
            title="Re-scan current physical USB connection"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${v1State.step !== 'SETUP_COMPLETE' && v1State.step !== 'NO_USB_CONNECTED' ? 'animate-spin' : ''}`} />
            <span>Re-Scan USB</span>
          </button>

          <button
            onClick={() => resetAndScanV1()}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1.5"
            title="Clear cached hardware state & scan for a new/different physical USB device"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Different Device</span>
          </button>

          {defaultPrinterId && (
            <button
              onClick={async () => {
                const res = await removeSavedDefaultPrinter();
                setTestPrintStatus(res.message);
                setTimeout(() => setTestPrintStatus(null), 4000);
              }}
              className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 font-bold text-xs border border-amber-200 transition-all flex items-center gap-1.5"
              title="Remove default printer designation"
            >
              <StarOff className="w-3.5 h-3.5 text-amber-600 group-hover:text-white" />
              <span>Remove Default</span>
            </button>
          )}

          <button
            onClick={handleRunV1TestPrint}
            disabled={!isUsbConnected && displayList.length === 0 && !v1State.queueName}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>REAL TEST PRINT</span>
          </button>

          <button
            onClick={handleCalibrate}
            disabled={!isUsbConnected}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold text-xs border border-slate-300 transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            <span>Calibrate</span>
          </button>
        </div>
      </div>

      {/* AUTOMATED V1 FLOW STEPPER */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">SEZNIK V1 AUTOMATED SETUP PIPELINE</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            Progress: {v1State.progressPercent}%
          </span>
        </div>

        {/* Message Alert Banner */}
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center space-x-2.5 ${
          v1State.step === 'UNSUPPORTED_PRINTER' ? 'bg-amber-50 border-amber-200 text-amber-900 font-extrabold' :
          v1State.step === 'NO_USB_CONNECTED' ? 'bg-slate-100 border-slate-200 text-slate-700' :
          v1State.step === 'SETUP_COMPLETE' ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-extrabold' :
          v1State.step === 'ERROR' ? 'bg-rose-50 border-rose-200 text-rose-900 font-bold' : 'bg-blue-50 border-blue-200 text-blue-900 font-bold'
        }`}>
          {v1State.step === 'UNSUPPORTED_PRINTER' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
          {v1State.step === 'NO_USB_CONNECTED' && <Usb className="w-4 h-4 text-slate-500 shrink-0" />}
          {v1State.step === 'SETUP_COMPLETE' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {v1State.step === 'ERROR' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          {v1State.step !== 'UNSUPPORTED_PRINTER' && v1State.step !== 'NO_USB_CONNECTED' && v1State.step !== 'SETUP_COMPLETE' && v1State.step !== 'ERROR' && (
            <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 animate-spin" />
          )}
          <span className="flex-1">{v1State.stepMessage}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className={`h-full transition-all duration-500 ${v1State.step === 'SETUP_COMPLETE' ? 'bg-emerald-600' : v1State.step === 'UNSUPPORTED_PRINTER' ? 'bg-amber-500' : v1State.step === 'ERROR' ? 'bg-rose-600' : 'bg-blue-600'}`}
            style={{ width: `${v1State.progressPercent}%` }}
          />
        </div>

        {/* Automated Flow Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2 text-[10px] font-extrabold text-center select-none">
          <div className={`p-2 rounded-lg border transition-all ${v1State.usbConnected ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            1. USB Detect
          </div>
          <div className={`p-2 rounded-lg border transition-all ${v1State.brand && v1State.brand !== 'UNSUPPORTED' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            2. Identify {v1State.brand && v1State.brand !== 'UNSUPPORTED' ? `[${v1State.brand}]` : ''}
          </div>
          <div className={`p-2 rounded-lg border transition-all ${v1State.driverInstalled ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            3. Driver Setup
          </div>
          <div className={`p-2 rounded-lg border transition-all ${v1State.queueName ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            4. Configure Queue
          </div>
          <div className={`p-2 rounded-lg border transition-all ${(v1State.savedPrinterId || ['SAVING_PRINTER', 'SETTING_DEFAULT', 'SETUP_COMPLETE'].includes(v1State.step)) ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            5. Save Storage
          </div>
          <div className={`p-2 rounded-lg border transition-all ${(v1State.isDefault || v1State.step === 'SETUP_COMPLETE') ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            6. Set Default
          </div>
          <div className={`p-2 rounded-lg border transition-all ${v1State.step === 'SETUP_COMPLETE' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            7. Setup Complete {v1State.testPrintSuccess ? '✓ (1 Label)' : ''}
          </div>
        </div>
      </div>

      {/* OPTIONAL NEXT STEP: BLUETOOTH PAIRING (available once USB setup has completed at least once) */}
      {(v1State.step === 'SETUP_COMPLETE' || bluetoothState.connectedQueueName) && (
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3.5">
            <div className={`p-2.5 rounded-xl ${bluetoothState.connectedQueueName ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-black uppercase text-slate-900 tracking-wider">
                  {bluetoothState.connectedQueueName || 'Optional: Connect via Bluetooth'}
                </h2>
                {bluetoothState.connectedQueueName ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> INSTALLED IN WINDOWS
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                    STEP 2
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {bluetoothState.connectedQueueName
                  ? `On ${bluetoothState.connectedComPort} — visible in any app's Print dialog (Ctrl+P)${bluetoothState.testPrintSuccess ? ', test receipt verified ✓' : ''}`
                  : 'USB setup is done. Pair the same printer over Bluetooth so it shows up in Ctrl+P everywhere, not just SEZNIK.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {bluetoothState.connectedQueueName ? (
              <>
                <button
                  onClick={() => setIsBluetoothModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Bluetooth className="w-3.5 h-3.5 text-blue-600" />
                  <span>Manage</span>
                </button>
                <button
                  onClick={() => disconnectBluetoothDevice()}
                  title="Clears SEZNIK's selection only — the printer stays installed in Windows and keeps working from Ctrl+P"
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 font-bold text-xs border border-rose-200 transition-all flex items-center gap-1.5"
                >
                  <span>Deselect</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsBluetoothModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1.5"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>Pair &amp; Connect Bluetooth Printer</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (7 cols): Real USB Printers List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Printer className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">ENUMERATED USB SPOOLER QUEUES</h3>
              </div>
              <div className="flex items-center space-x-2">
                {savedPrinters.length > 0 && (
                  <button
                    onClick={async () => {
                      await clearSavedPrinters();
                    }}
                    className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors border border-rose-200"
                    title="Remove all saved printers"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                )}
                <button
                  onClick={async () => {
                    setIsScanning(true);
                    await fetchOsPrinters();
                    await fetchSavedPrinters();
                    setTimeout(() => setIsScanning(false), 500);
                  }}
                  disabled={isScanning}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors border border-slate-200 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 text-blue-600 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Scanning...' : 'Scan Spooler'}</span>
                </button>
              </div>
            </div>

            {displayList.length > 0 ? (
              <div className="space-y-2.5">
                {displayList.map((prt: any, idx: number) => {
                  const prtId = prt.id || `os-${idx}`;
                  const isDef = prt.isDefault || prtId === defaultPrinterId;

                  return (
                    <div
                      key={prtId}
                      className={`p-3 rounded-lg border text-xs transition-all ${isDef ? 'bg-blue-50/50 border-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-extrabold text-slate-900">{prt.name}</h4>
                            {isDef && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-600 text-white">
                                <Star className="w-2 h-2 fill-white" /> SEZNIK DEFAULT
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            Port: <span className="font-mono text-slate-700">{prt.portName || 'USB001'}</span> | Driver: <span className="text-slate-700">{prt.driverName || 'Standard Spooler'}</span>
                          </p>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${isUsbConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {isUsbConnected ? 'READY' : 'DISCONNECTED'}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        {!isDef ? (
                          <button
                            onClick={() => handleSetDefaultPrinter(prtId)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-[11px] font-bold transition-all border border-slate-200"
                          >
                            Set Default
                          </button>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] text-emerald-700 font-extrabold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Default Printer
                            </span>
                            <button
                              onClick={async () => {
                                const res = await removeSavedDefaultPrinter();
                                setTestPrintStatus(res.message);
                                setTimeout(() => setTestPrintStatus(null), 4000);
                              }}
                              className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 text-[10px] font-bold transition-all border border-amber-200 flex items-center gap-1"
                              title="Unset default status"
                            >
                              <StarOff className="w-3 h-3" />
                              <span>Remove Default</span>
                            </button>
                          </div>
                        )}

                        <div className="flex items-center space-x-1.5">
                          {!savedPrinters.some(sp => sp.name.toLowerCase() === prt.name.toLowerCase()) && (
                            <button
                              onClick={() => handleSaveActivePrinter(prt.name)}
                              className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white border border-teal-200 text-[11px] font-bold transition-all flex items-center gap-1"
                              title="Save printer configuration"
                            >
                              <HardDriveDownload className="w-3 h-3" />
                              <span>Save Option</span>
                            </button>
                          )}
                          <button
                            onClick={() => setRemoveModalState({ isOpen: true, id: prtId, name: prt.name, isDefault: isDef })}
                            className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-[11px] font-bold transition-all flex items-center gap-1"
                            title="Remove printer and uninstall driver completely from OS"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove Option</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Honest Empty State (Zero Mock Data) */
              <div className="p-6 text-center border border-dashed border-slate-300 rounded-lg bg-slate-50 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800">No USB printer detected.</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Connect a USB thermal printer cable to your PC. The V1 pipeline will automatically detect, identify, and configure it.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Physically Accurate Previews based on Matched Profile */}
        <div className="lg:col-span-5 space-y-3">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                {v1State.brand === 'JOSH' ? 'JOSH 50x50mm Label Preview' : v1State.brand === 'VEER' ? 'VEER 58mm Receipt Preview' : v1State.brand === 'DEV' ? 'DEV Combo (Label + Receipt) Preview' : 'No Printer Selected'}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {v1State.brand === 'JOSH' ? '50x50mm TSPL' : v1State.brand === 'VEER' ? '58mm ESC/POS' : v1State.brand === 'DEV' ? 'Dual Mode' : 'USB Standby'}
              </span>
            </div>

            {/* PREVIEWS CONTAINER */}
            <div className="flex justify-center p-4 bg-slate-100 rounded-lg border border-slate-200 min-h-[240px] items-center">
              {v1State.brand === 'JOSH' ? (
                /* Physically Proportional JOSH 50mm x 50mm Barcode Label Preview */
                <div className="w-[190px] h-[190px] bg-white border-2 border-slate-400 shadow-lg rounded p-3 flex flex-col justify-between select-none aspect-square shrink-0 font-sans text-slate-900">
                  <div className="flex justify-between items-start w-full">
                    <div className="text-[10px] font-mono leading-tight">
                      <div className="text-slate-600 font-medium">4338-9856-82-M</div>
                      <div className="font-extrabold text-slate-900 text-[11px]">08MT1-08Y-TRYU</div>
                    </div>
                    <div className="text-[9px] font-bold text-slate-700">
                      Lot #: 19/05/2023
                    </div>
                  </div>

                  <div className="flex flex-col items-center w-full mt-2">
                    <div className="flex items-end justify-between h-12 w-full px-1">
                      <div className="w-1.5 h-full bg-slate-900"></div>
                      <div className="w-0.5 h-full bg-slate-900"></div>
                      <div className="w-2 h-full bg-slate-900"></div>
                      <div className="w-0.5 h-full bg-slate-900"></div>
                      <div className="w-1 h-full bg-slate-900"></div>
                      <div className="w-0.5 h-full bg-slate-900"></div>
                      <div className="w-2.5 h-full bg-slate-900"></div>
                      <div className="w-0.5 h-full bg-slate-900"></div>
                      <div className="w-1.5 h-full bg-slate-900"></div>
                      <div className="w-0.5 h-full bg-slate-900"></div>
                      <div className="w-2 h-full bg-slate-900"></div>
                      <div className="w-0.5 h-full bg-slate-900"></div>
                      <div className="w-1 h-full bg-slate-900"></div>
                      <div className="w-1.5 h-full bg-slate-900"></div>
                      <div className="w-0.5 h-full bg-slate-900"></div>
                      <div className="w-2 h-full bg-slate-900"></div>
                      <div className="w-0.5 h-full bg-slate-900"></div>
                      <div className="w-1.5 h-full bg-slate-900"></div>
                      <div className="w-1 h-full bg-slate-900"></div>
                    </div>
                    <span className="text-[10px] font-mono font-black text-slate-900 tracking-widest mt-1">3 5 6 8 4 4 8 7 9 3 2 - A - K - R</span>
                  </div>
                </div>
              ) : v1State.brand === 'VEER' ? (
                /* Physically Proportional VEER 58mm Thermal Receipt Preview */
                <div className="w-[200px] bg-white border border-slate-300 shadow-md p-3 font-mono text-[10px] text-slate-800 space-y-2 select-none shrink-0 relative">
                  <div className="text-center font-bold border-b border-slate-300 pb-1">
                    <div>SEZNIK POS STORE</div>
                    <div className="text-[8px] font-normal text-slate-500">58mm Thermal Receipt</div>
                  </div>

                  <div className="text-[9px] space-y-0.5 border-b border-slate-200 pb-1">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="font-bold text-emerald-700">REAL VERIFIED</span>
                    </div>
                    <div>Date: {new Date().toLocaleDateString()}</div>
                  </div>

                  <div className="text-[9px] space-y-1">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>VEER Automated Test</span>
                      <span>₹0.00</span>
                    </div>
                  </div>

                  <div className="text-center text-[8px] text-slate-500 pt-1 border-t border-slate-200">
                    Thank you for using SEZNIK!
                  </div>
                </div>
              ) : v1State.brand === 'DEV' ? (
                /* DEV Combo Preview */
                <div className="space-y-2 text-center">
                  <div className="p-3 bg-white border border-slate-300 rounded-lg shadow-xs text-xs font-bold text-slate-800">
                    DEV Profile Active: 50x50mm Label + 58mm Receipt Dual Printing Supported
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 font-medium italic">
                  No USB printer detected. Connect USB cable to generate live physical preview.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Printer Removal */}
      <RemovePrinterModal
        isOpen={removeModalState.isOpen}
        printerName={removeModalState.name}
        isDefault={removeModalState.isDefault}
        onClose={() => setRemoveModalState({ isOpen: false, id: '', name: '', isDefault: false })}
        onConfirm={handleConfirmRemove}
      />

      {/* Bluetooth Pairing Modal */}
      <ConnectBluetoothModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
      />
    </div>
  );
};
