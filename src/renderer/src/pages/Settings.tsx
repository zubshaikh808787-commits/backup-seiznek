import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Moon, Globe, HardDrive, Bell, Bluetooth, RefreshCw, CheckCircle2, Unlink, Trash2 } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useThemeStore } from '../store/useThemeStore';
import { usePrinterStore } from '../store/usePrinterStore';
import { ConnectBluetoothModal } from '../components/ConnectBluetoothModal';

export const Settings: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();
  const { isDark, toggleTheme } = useThemeStore();
  const {
    bluetoothState,
    savedPrinters,
    initBluetooth,
    scanBluetoothDevices,
    connectBluetoothDevice,
    disconnectBluetoothDevice,
    forgetBluetoothDevice,
  } = usePrinterStore();

  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState(false);
  const bluetoothPrinters = savedPrinters.filter(p => p.connectionType === 'BLUETOOTH');

  useEffect(() => {
    initBluetooth();
  }, []);

  return (
    <div className="space-y-4 max-w-6xl mx-auto select-none text-slate-800">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-black uppercase text-slate-900 tracking-wider">Application Settings & Configuration</h1>
        <p className="text-xs text-slate-500 font-medium">Configure printer profiles, media dimensions, startup behavior, and logs</p>
      </div>

      <div className="space-y-3">
        {/* Bluetooth Printer Pairing */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
              <Bluetooth className="w-4 h-4 text-blue-600" /> Bluetooth Printer
            </h2>
            <button
              onClick={() => scanBluetoothDevices()}
              disabled={bluetoothState.isScanning}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all border border-slate-200"
            >
              <RefreshCw className={`w-3 h-3 text-blue-600 ${bluetoothState.isScanning ? 'animate-spin' : ''}`} />
              <span>Rescan Paired Devices</span>
            </button>
          </div>

          {bluetoothState.connectedQueueName ? (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-extrabold text-slate-900">{bluetoothState.connectedQueueName}</p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    On <span className="font-mono">{bluetoothState.connectedComPort}</span> — installed in Windows, visible in any app's Print dialog (Ctrl+P)
                    {bluetoothState.testPrintSuccess ? ' — test receipt verified ✓' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => disconnectBluetoothDevice()}
                title="Clears SEZNIK's selection only — the printer stays installed in Windows"
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-600 hover:text-white text-rose-700 text-[11px] font-bold border border-rose-200 transition-all flex items-center gap-1"
              >
                <Unlink className="w-3 h-3" />
                <span>Deselect</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium flex items-center justify-between">
              <span>No Bluetooth printer connected.</span>
              <button
                onClick={() => setIsBluetoothModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>Connect via Bluetooth</span>
              </button>
            </div>
          )}

          {bluetoothPrinters.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Windows Printers Installed via Bluetooth</span>
              {bluetoothPrinters.map((p) => (
                <div key={p.id} className="p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{p.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{p.portName}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {bluetoothState.connectedQueueName !== p.name && (
                      <button
                        onClick={() => connectBluetoothDevice(p.macAddress || p.id.replace('seznik-bt-', ''))}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-[10px] font-bold transition-all border border-slate-200"
                      >
                        Reconnect
                      </button>
                    )}
                    <button
                      onClick={() => forgetBluetoothDevice(p.macAddress || p.id.replace('seznik-bt-', ''))}
                      title="Removes this printer from Windows completely (Ctrl+P too), not just from SEZNIK"
                      className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-[10px] font-bold transition-all border border-rose-200 flex items-center gap-1"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>Forget</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Media Profile Configurations */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-600" /> Media Profiles & Specifications
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="font-extrabold text-blue-700">JOSH Label Profile</span>
              <p className="text-slate-500 font-medium">Printable Width: 50mm | Height: 50mm | Protocol: TSPL 203 DPI</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="font-extrabold text-emerald-700">VEER Receipt Profile</span>
              <p className="text-slate-500 font-medium">Printable Width: 58mm | Continuous Roll | Protocol: ESC/POS 203 DPI</p>
            </div>
          </div>
        </div>

        {/* Startup & Application Settings */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
            <Bell className="w-4 h-4 text-purple-600" /> Desktop Application Behavior
          </h2>
          <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
            <div>
              <p className="font-bold text-slate-800">Auto Updater</p>
              <p className="text-slate-500 text-[11px]">Automatically check and apply application background releases</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoUpdate}
              onChange={(e) => updateSettings({ autoUpdate: e.target.checked })}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <div>
              <p className="font-bold text-slate-800">Theme Mode</p>
              <p className="text-slate-500 text-[11px]">Toggle application accent interface</p>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-xs border border-slate-300"
            >
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </button>
          </div>
        </div>

        {/* Cache Path */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-600" /> Cache & Download Path
          </h2>
          <input
            type="text"
            value={settings.downloadPath}
            onChange={(e) => updateSettings({ downloadPath: e.target.value })}
            className="w-full p-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>
    </div>
  );
};
