import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  Usb,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  HardDriveDownload,
  Play,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  Terminal
} from 'lucide-react';
import { JoshSetupState, JoshBleCandidate } from '../../../shared/types';

export const JoshBluetoothSetup: React.FC = () => {
  const [state, setState] = useState<JoshSetupState>({
    stage: 'IDLE',
    stageMessage: 'Ready to configure JOSH printer.',
    progressPercent: 0,
    usbDetected: false,
    driverInstalled: false,
    usbTestPrintSuccess: false,
    usbDisconnectedPrompt: false,
    bleScanning: false,
    bleCandidates: [],
    selectedBleDevice: null,
    bleConnected: false,
    bleServiceFound: false,
    bleCharacteristicFound: false,
    bleReady: false,
    bleTestPrintSuccess: false,
    setupCompleted: false,
    diagnosticsLog: [],
  });

  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Fetch initial state
    window.seznikApi?.getJoshSetupState().then(setState);

    // Subscribe to real-time orchestrator updates
    window.seznikApi?.onJoshSetupStateChanged((newState) => {
      setState(newState);
      setLoading(false);
    });
  }, []);

  const handleStartSetup = async () => {
    setLoading(true);
    try {
      await window.seznikApi?.startJoshSetupFlow();
    } catch (err: any) {
      console.error('Error starting JOSH setup:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUsbDisconnected = async () => {
    setLoading(true);
    try {
      await window.seznikApi?.confirmJoshUsbDisconnected();
    } catch (err: any) {
      console.error('Error confirming USB disconnect:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCandidate = async (deviceId: string) => {
    setLoading(true);
    try {
      await window.seznikApi?.selectJoshBleDevice(deviceId);
    } catch (err: any) {
      console.error('Error selecting JOSH candidate:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    window.seznikApi?.resetJoshSetupFlow().then(setState);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-tr from-purple-900 via-indigo-900 to-slate-900 text-white shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
              <Bluetooth className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">JOSH Thermal Label Setup</h1>
              <p className="text-xs text-purple-200">50x50mm USB $\to$ Bluetooth BLE Automated Pairing Pipeline</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/30 border border-purple-400/40">
            {state.progressPercent}% Completed
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-purple-950/60 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-emerald-400 transition-all duration-500 rounded-full"
            style={{ width: `${Math.max(state.progressPercent, 4)}%` }}
          />
        </div>
      </div>

      {/* Main Interaction Card */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
        {/* Stage Message */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 shrink-0">
            {state.stage === 'SETUP_COMPLETED' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            ) : state.stage === 'ERROR' ? (
              <AlertCircle className="w-6 h-6 text-rose-600" />
            ) : (
              <Zap className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              {state.stage === 'SETUP_COMPLETED'
                ? 'JOSH Bluetooth Setup Complete!'
                : state.stage === 'ERROR'
                ? 'Setup Attention Required'
                : state.stageMessage}
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Current Stage: <strong className="text-purple-700">{state.stage}</strong>
            </p>
          </div>
        </div>

        {/* IDLE Screen */}
        {state.stage === 'IDLE' && (
          <div className="space-y-6 pt-4 text-center">
            <div className="max-w-md mx-auto space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-left space-y-2">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-purple-600" /> Before You Begin:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Connect your <strong>JOSH Label Printer</strong> using the USB cable.</li>
                  <li>Turn on the printer power switch.</li>
                  <li>Ensure 50x50mm thermal sticker roll is loaded.</li>
                </ol>
              </div>

              <button
                onClick={handleStartSetup}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Begin JOSH USB $\to$ BLE Setup
              </button>
            </div>
          </div>
        )}

        {/* USB Disconnect Prompt (Stage 9) */}
        {state.stage === 'USB_REMOVED' && (
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-4">
            <div className="flex items-center gap-3">
              <Usb className="w-6 h-6 text-amber-600" />
              <div>
                <h3 className="font-bold text-sm">Step 6: Disconnect USB Cable</h3>
                <p className="text-xs text-amber-700">
                  Please unplug the USB cable from your computer so the JOSH printer switches to Bluetooth mode.
                </p>
              </div>
            </div>

            <button
              onClick={handleConfirmUsbDisconnected}
              disabled={loading}
              className="flex items-center gap-2 py-2.5 px-5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-xs"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              I Have Disconnected the USB Cable
            </button>
          </div>
        )}

        {/* BLE Candidates List (Stage 11) */}
        {state.bleCandidates && state.bleCandidates.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Discovered JOSH Bluetooth Devices:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {state.bleCandidates.map((cand) => (
                <div
                  key={cand.deviceId}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-purple-300 bg-slate-50 flex items-center justify-between transition-all"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900">{cand.name}</div>
                    <div className="text-[11px] text-slate-500">MAC: {cand.address}</div>
                  </div>
                  <button
                    onClick={() => handleSelectCandidate(cand.deviceId)}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-xs"
                  >
                    Connect <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ERROR Display */}
        {state.stage === 'ERROR' && (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                {state.errorMessage}
              </h3>
              {state.suggestedAction && (
                <p className="text-xs text-rose-700">{state.suggestedAction}</p>
              )}
            </div>

            <button
              onClick={handleRetry}
              className="flex items-center gap-2 py-2 px-4 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Setup
            </button>
          </div>
        )}

        {/* SUCCESS Screen */}
        {state.stage === 'SETUP_COMPLETED' && (
          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h3 className="text-lg font-bold">JOSH Bluetooth Setup Complete!</h3>
            <p className="text-xs text-emerald-700 max-w-md mx-auto">
              Your JOSH 50x50mm Label Printer is paired and ready. You can print directly inside SEZNIK or from any desktop application (<kbd className="px-1 py-0.5 bg-emerald-100 rounded">Ctrl+P</kbd>).
            </p>
          </div>
        )}

        {/* Live Diagnostics Log Drawer */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" /> Setup Execution Log
            </span>
            <span>{state.diagnosticsLog.length} events</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 text-[11px] font-mono max-h-36 overflow-y-auto space-y-1">
            {state.diagnosticsLog.length > 0 ? (
              state.diagnosticsLog.map((log, i) => (
                <div key={i} className="text-slate-300">{log}</div>
              ))
            ) : (
              <div className="text-slate-500">Waiting for setup start...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
