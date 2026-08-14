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
  ListFilter,
  Grid,
  List as ListIcon,
  CheckSquare,
  Square,
  Sliders,
  MoreVertical,
  Layers,
  ArrowUpDown,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrinterStore } from '../store/usePrinterStore';
import { useTranslation } from '../i18n/useTranslation';
import { RemovePrinterModal } from '../components/RemovePrinterModal';
import { ConnectBluetoothModal } from '../components/ConnectBluetoothModal';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
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
    bluetoothState,
    initBluetooth,
    disconnectBluetoothDevice,
  } = usePrinterStore();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null);
  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState(false);

  // Removal Modal State
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
  }, []);

  const handleRunV1TestPrint = async () => {
    setTestPrintStatus(t('testPrintStatus', 'Printing test page...'));
    const res = await triggerV1TestPrint();
    setTestPrintStatus(res.message || 'Test print submitted');
    setTimeout(() => setTestPrintStatus(null), 4000);
  };

  const handleConfirmRemove = async () => {
    const targetId = removeModalState.id;
    const targetName = removeModalState.name || removeModalState.id;
    setRemoveModalState({ isOpen: false, id: '', name: '', isDefault: false });

    if (targetId) {
      await removeSavedPrinter(targetId);
      if (uninstallDriver && targetName) {
        uninstallDriver(targetName).catch(() => {});
      }
      setTestPrintStatus(`Printer "${targetName}" removed successfully ✓`);
      setTimeout(() => setTestPrintStatus(null), 3000);

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
    setTestPrintStatus(res.message || 'Set as default printer');
    setTimeout(() => setTestPrintStatus(null), 3500);
  };

  const isUsbConnected = v1State.usbConnected;
  const isBtConnected = !!bluetoothState?.connectedDeviceId;

  // Build clean display list from savedPrinters / active OS printers
  const displayList = savedPrinters.length > 0
    ? savedPrinters.map(sp => {
        const isThisConnected = isUsbConnected && (
          v1State.queueName?.toLowerCase() === sp.name.toLowerCase() ||
          v1State.detectedHardwareName?.toLowerCase() === sp.name.toLowerCase() ||
          osPrinters.some(op => op.name.toLowerCase() === sp.name.toLowerCase())
        );
        return {
          ...sp,
          isConnected: isThisConnected || (sp.connectionType === 'BLUETOOTH' && isBtConnected),
        };
      })
    : (osPrinters.length > 0
        ? osPrinters.map(p => ({
            id: `os-${p.name}`,
            name: p.name,
            driverName: p.driverName,
            portName: p.portName || 'USB001',
            connectionType: (p.portName?.toLowerCase().includes('com') ? 'BLUETOOTH' : 'USB') as any,
            isDefault: p.isDefault,
            printerType: (p.name.toLowerCase().includes('dp27') || p.name.toLowerCase().includes('josh') ? 'LABEL' : 'RECEIPT') as any,
            savedAt: new Date().toLocaleDateString(),
            isConnected: isUsbConnected,
          }))
        : (v1State.queueName ? [{
            id: `v1-${v1State.queueName}`,
            name: v1State.queueName,
            driverName: v1State.queueName,
            portName: 'USB001',
            connectionType: 'USB' as any,
            isDefault: v1State.isDefault,
            printerType: (v1State.brand === 'JOSH' ? 'LABEL' : 'RECEIPT') as any,
            savedAt: new Date().toLocaleDateString(),
            isConnected: isUsbConnected,
          }] : [])
      );

  return (
    <div className="space-y-6 max-w-6xl mx-auto select-none">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {(toastMessage || testPrintStatus) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 rounded-2xl bg-slate-900 text-white font-medium text-xs border border-slate-800 shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center space-x-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage || testPrintStatus}</span>
            </div>
            <button
              onClick={() => setTestPrintStatus(null)}
              className="text-slate-400 hover:text-white font-semibold text-xs px-2 py-0.5"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP HEADER CONTROLS (Synapse Documents Style) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {t('allPrinters', 'Printers')}
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          {/* List / Grid View Switcher (Synapse Pill Button) */}
          <div className="flex items-center p-0.5 bg-slate-200/70 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>{t('listView', 'List View')}</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>{t('grid', 'Grid')}</span>
            </button>
          </div>

          {/* Quick Action Buttons */}
          <button
            onClick={() => setIsBluetoothModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/90 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-all"
          >
            <Bluetooth className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('pairBluetooth', 'Pair Bluetooth')}</span>
          </button>

          <button
            onClick={() => startV1Pipeline()}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{t('scanUsb', 'Scan USB')}</span>
          </button>
        </div>
      </div>

      {/* HERO SECTION: RECENT / ACTIVE PRINTERS (Synapse Folder Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 tracking-wide">
            {t('recentPrinters', 'Recent')} {displayList.length > 0 ? `• ${displayList.length}` : ''}
          </span>
        </div>

        {displayList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {displayList.map((printer) => {
              const isLabel = printer.printerType === 'LABEL' || printer.name.toLowerCase().includes('josh') || printer.name.toLowerCase().includes('label');
              return (
                <div
                  key={printer.id}
                  className="synapse-card rounded-2xl p-5 relative group flex flex-col justify-between h-48 cursor-pointer"
                >
                  {/* Top Header inside Card */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${printer.isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {printer.connectionType}
                      </span>
                    </div>

                    {printer.isDefault && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-blue-600" /> Default
                      </span>
                    )}
                  </div>

                  {/* Glossy Synapse Folder / Printer Icon */}
                  <div className="flex flex-col items-center justify-center my-auto py-1">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-sky-400 shadow-md flex items-center justify-center text-white transform group-hover:scale-105 transition-transform">
                      <Printer className="w-7 h-7" />
                    </div>
                  </div>

                  {/* Bottom Title & Specs */}
                  <div className="text-center mt-1">
                    <h3 className="font-bold text-sm text-slate-800 tracking-tight truncate" title={printer.name}>
                      {printer.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {isLabel ? 'Thermal Label (50×50mm)' : 'Thermal Receipt (58mm)'} • {printer.portName}
                    </p>
                  </div>

                  {/* Hover Quick Actions */}
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-2xs rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunV1TestPrint();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>{t('testPrint', 'Test Print')}</span>
                    </button>

                    {!printer.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetDefaultPrinter(printer.id);
                        }}
                        className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-600 shadow-xs"
                        title={t('setDefault', 'Set Default')}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRemoveModalState({
                          isOpen: true,
                          id: printer.id,
                          name: printer.name,
                          isDefault: printer.isDefault,
                        });
                      }}
                      className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 shadow-xs"
                      title={t('remove', 'Remove')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="synapse-card rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">{t('noPrintersFound', 'No thermal printers connected.')}</p>
              <p className="text-xs text-slate-400 mt-1 font-medium max-w-sm mx-auto">
                {t('connectUsbPrompt', 'Connect a SEZNIK thermal printer via USB or Bluetooth to begin.')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* DATA TABLE SECTION (Synapse "File name", "Date added", "Added by" List Format) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 tracking-wide">
            {t('allPrinters', 'All Configured Printers')}
          </span>
        </div>

        <div className="synapse-card rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-150 text-slate-400 font-semibold bg-slate-50/50">
                <th className="py-3 px-4 w-8">
                  <div className="w-4 h-4 rounded-md bg-slate-900 flex items-center justify-center text-white">
                    <span className="w-2 h-0.5 bg-white rounded-full"></span>
                  </div>
                </th>
                <th className="py-3 px-4 font-semibold">{t('tableName', 'Printer Name')}</th>
                <th className="py-3 px-4 font-semibold">{t('tableInterface', 'Port / Interface')}</th>
                <th className="py-3 px-4 font-semibold">{t('tableType', 'Media Type')}</th>
                <th className="py-3 px-4 font-semibold">{t('tableStatus', 'Status')}</th>
                <th className="py-3 px-4 font-semibold text-right">{t('tableActions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {displayList.length > 0 ? (
                displayList.map((printer) => {
                  const isLabel = printer.printerType === 'LABEL' || printer.name.toLowerCase().includes('josh') || printer.name.toLowerCase().includes('label');
                  return (
                    <tr key={printer.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="w-4 h-4 rounded-md bg-slate-900 flex items-center justify-center text-white">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center space-x-2.5">
                          <Printer className="w-4 h-4 text-blue-600" />
                          <span>{printer.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {printer.portName} ({printer.connectionType})
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {isLabel ? '50×50mm Label (TSPL)' : '58mm Receipt (ESC/POS)'}
                      </td>
                      <td className="py-3.5 px-4">
                        {printer.isDefault ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Star className="w-2.5 h-2.5 fill-blue-600" /> Default
                          </span>
                        ) : printer.isConnected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            Configured
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleRunV1TestPrint()}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-semibold text-xs transition-all"
                          >
                            {t('testPrint', 'Test Print')}
                          </button>
                          {!printer.isDefault && (
                            <button
                              onClick={() => handleSetDefaultPrinter(printer.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all"
                            >
                              {t('setDefault', 'Set Default')}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setRemoveModalState({
                                isOpen: true,
                                id: printer.id,
                                name: printer.name,
                                isDefault: printer.isDefault,
                              })
                            }
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title={t('remove', 'Remove')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No printers listed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      <ConnectBluetoothModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
      />

      <RemovePrinterModal
        isOpen={removeModalState.isOpen}
        printerName={removeModalState.name}
        isDefault={removeModalState.isDefault}
        onClose={() => setRemoveModalState({ isOpen: false, id: '', name: '', isDefault: false })}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
};
