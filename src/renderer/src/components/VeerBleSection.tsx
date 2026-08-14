import React, { useEffect } from 'react';
import { Bluetooth, RefreshCw, Printer, CheckCircle, AlertTriangle, Radio, Unplug, Zap } from 'lucide-react';
import { useVeerBleStore } from '../store/useVeerBleStore';

export const VeerBleSection: React.FC = () => {
  const {
    status,
    scannedDevices,
    isScanning,
    isConnecting,
    isPrinting,
    lastPrintResult,
    statusMessage,
    scanBle,
    connectBle,
    disconnectBle,
    fetchStatus,
    testPrintBle,
    printBle,
    subscribeToUpdates,
  } = useVeerBleStore();

  useEffect(() => {
    fetchStatus();
    subscribeToUpdates();
  }, []);

  const isReady = status.state === 'READY' || status.state === 'CONNECTED';
  const veerDevices = scannedDevices.filter(d => d.isVeer);

  const getStatusColor = () => {
    switch (status.state) {
      case 'READY':
      case 'CONNECTED':
      case 'PRINT_SUCCESS':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'PRINTING':
      case 'CONNECTING':
      case 'DISCOVERING_SERVICES':
      case 'SCANNING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'ERROR':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600/50';
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800 p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
            <Bluetooth className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              VEER Wireless BLE Setup
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                BLE GATT
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Bluetooth Low Energy 58mm Thermal Printing Workflow
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => scanBle()}
            disabled={isScanning || isConnecting || isPrinting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-md shadow-blue-900/30"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan BLE Devices'}
          </button>

          {isReady && (
            <button
              onClick={() => disconnectBle()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all"
            >
              <Unplug className="w-3.5 h-3.5" />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* USB -> BLE Transition Notice */}
      <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 rounded-lg p-4 border border-blue-800/40 flex items-start gap-3">
        <Zap className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-blue-300">USB Setup Completed?</span> You may now safely remove the USB cable! Scan and connect via <strong className="text-white">VEER BLE</strong> for 100% wireless thermal receipt printing.
        </div>
      </div>

      {/* Live Connection Status & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Badge */}
        <div className="bg-slate-950/60 rounded-lg p-4 border border-slate-800/80 space-y-2">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
            BLE State Machine
          </div>
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-md text-xs font-mono font-bold border ${getStatusColor()}`}>
              {status.state}
            </span>
            {status.deviceName && (
              <span className="text-xs font-medium text-slate-200 truncate max-w-[160px]">
                {status.deviceName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 italic truncate pt-1">
            {statusMessage}
          </p>
        </div>

        {/* GATT Parameters */}
        <div className="bg-slate-950/60 rounded-lg p-4 border border-slate-800/80 space-y-2 text-xs">
          <div className="text-slate-400 uppercase tracking-wider font-semibold">
            SDK GATT Profile
          </div>
          <div className="space-y-1 font-mono text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">Service UUID:</span>
              <span className="text-blue-400 truncate max-w-[170px]" title={status.serviceUuid || 'Not Discovered'}>
                {status.serviceUuid || 'E7810A71-73AE... (SDK)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Char UUID:</span>
              <span className="text-indigo-400 truncate max-w-[170px]" title={status.characteristicUuid || 'Not Discovered'}>
                {status.characteristicUuid || 'BEF8D6C9-9C21... (SDK)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">BLE Chunk MTU:</span>
              <span className="text-emerald-400">{status.mtu} bytes/chunk</span>
            </div>
          </div>
        </div>
      </div>

      {/* Discovered BLE Devices List */}
      {scannedDevices.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Discovered BLE Peripherals ({scannedDevices.length})</span>
            <span className="text-emerald-400 text-[11px]">{veerDevices.length} Verified VEER</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {scannedDevices.map((dev) => (
              <div
                key={dev.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  dev.isVeer
                    ? 'bg-slate-950 border-blue-500/40 hover:border-blue-500/80'
                    : 'bg-slate-950/40 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Radio className={`w-4 h-4 ${dev.isVeer ? 'text-blue-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="text-xs font-medium text-slate-200 flex items-center gap-2">
                      {dev.name}
                      {dev.isVeer ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          VEER / Thermal Printer
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400">
                          Bluetooth Device
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      ID: {dev.id} {dev.rssi ? `| RSSI: ${dev.rssi} dBm` : ''}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => connectBle(dev.id)}
                  disabled={isConnecting || isPrinting}
                  className="px-3 py-1 rounded text-xs font-medium transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-sm disabled:opacity-50"
                >
                  {status.deviceId === dev.id && isReady ? 'Connected' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real Physical BLE Printing Controls */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Printer className="w-4 h-4 text-blue-400" />
          <span>Real physical receipt print over BLE GATT</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => testPrintBle()}
            disabled={isPrinting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 transition-all"
          >
            <Printer className={`w-4 h-4 ${isPrinting ? 'animate-bounce' : ''}`} />
            {isPrinting ? 'Transmitting Chunks...' : 'Test Print BLE Receipt'}
          </button>

          <button
            onClick={() => printBle()}
            disabled={isPrinting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-950/40 transition-all"
          >
            <Zap className="w-4 h-4" />
            Print Custom Receipt
          </button>
        </div>
      </div>

      {/* Test Print Result Banner */}
      {lastPrintResult && (
        <div
          className={`p-3 rounded-lg text-xs flex items-start gap-2.5 border ${
            lastPrintResult.success
              ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
              : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
          }`}
        >
          {lastPrintResult.success ? (
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          )}
          <div>
            <div className="font-semibold">
              {lastPrintResult.success ? 'BLE Transmission Successful ✓' : `BLE Print Error [${lastPrintResult.errorCode || 'ERROR'}]`}
            </div>
            <div className="text-[11px] opacity-90 mt-0.5">
              {lastPrintResult.message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
