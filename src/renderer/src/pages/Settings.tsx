import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Moon, Globe, HardDrive, Bell, Bluetooth, RefreshCw, CheckCircle2, Unlink, Trash2, Languages, Laptop, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useThemeStore } from '../store/useThemeStore';
import { usePrinterStore } from '../store/usePrinterStore';
import { useTranslation } from '../i18n/useTranslation';
import { ConnectBluetoothModal } from '../components/ConnectBluetoothModal';

export const Settings: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();
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
    <div className="space-y-6 max-w-4xl mx-auto select-none">
      {/* Header Section */}
      <div className="pb-2 border-b border-slate-200/60">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t('settingsTitle', 'Preferences & Configuration')}
        </h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          {t('settingsSub', 'Manage application language, printer connections, and system preferences')}
        </p>
      </div>

      <div className="space-y-4">
        {/* Interface Language Card (Synapse Card) */}
        <div className="synapse-card rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Languages className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {t('languageSetting', 'Interface Language')}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {t('languageSettingSub', 'Choose preferred language for the desktop app')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-sm pt-1">
            <button
              onClick={() => setLanguage('en')}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all ${
                language === 'en'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🇺🇸</span>
                <span>English</span>
              </div>
              {language === 'en' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
            </button>

            <button
              onClick={() => setLanguage('hi')}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all ${
                language === 'hi'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🇮🇳</span>
                <span>हिंदी (Hindi)</span>
              </div>
              {language === 'hi' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
            </button>
          </div>
        </div>

        {/* Bluetooth Devices Card */}
        <div className="synapse-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Bluetooth className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  {t('bluetoothTitle', 'Bluetooth Thermal Printers')}
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  {t('bluetoothSub', 'Scan and pair wireless thermal printers')}
                </p>
              </div>
            </div>

            <button
              onClick={() => scanBluetoothDevices()}
              disabled={bluetoothState.isScanning}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-200 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${bluetoothState.isScanning ? 'animate-spin' : ''}`} />
              <span>{t('rescanPaired', 'Rescan Devices')}</span>
            </button>
          </div>

          {bluetoothState.connectedQueueName ? (
            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-900">{bluetoothState.connectedQueueName}</p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Port: <span className="font-mono font-semibold">{bluetoothState.connectedComPort}</span> • Ready for printing
                  </p>
                </div>
              </div>
              <button
                onClick={() => disconnectBluetoothDevice()}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200 transition-all"
              >
                {t('deselect', 'Deselect')}
              </button>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>{t('noBtConnected', 'No Bluetooth printer paired.')}</span>
              <button
                onClick={() => setIsBluetoothModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>{t('pairBluetooth', 'Pair Bluetooth')}</span>
              </button>
            </div>
          )}

          {bluetoothPrinters.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paired Bluetooth Printers</span>
              {bluetoothPrinters.map((p) => (
                <div key={p.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{p.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{p.portName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {bluetoothState.connectedQueueName !== p.name && (
                      <button
                        onClick={() => connectBluetoothDevice(p.macAddress || p.id.replace('seznik-bt-', ''))}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
                      >
                        {t('reconnect', 'Reconnect')}
                      </button>
                    )}
                    <button
                      onClick={() => forgetBluetoothDevice(p.macAddress || p.id.replace('seznik-bt-', ''))}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title={t('forget', 'Forget')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Supported Media Profiles */}
        <div className="synapse-card rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {t('mediaProfiles', 'Supported Media Profiles')}
              </h2>
              <p className="text-xs text-slate-400 font-medium">Standard thermal printing specifications</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <span className="font-bold text-blue-700">{t('joshLabelTitle', 'Thermal Label (50×50mm)')}</span>
              <p className="text-slate-500 font-medium">{t('joshLabelDesc', 'Width: 50mm • Height: 50mm • TSPL Protocol • 203 DPI')}</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <span className="font-bold text-emerald-700">{t('veerReceiptTitle', 'Thermal Receipt (58mm)')}</span>
              <p className="text-slate-500 font-medium">{t('veerReceiptDesc', 'Width: 58mm • Continuous Roll • ESC/POS Protocol • 203 DPI')}</p>
            </div>
          </div>
        </div>

        {/* Desktop Preferences */}
        <div className="synapse-card rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {t('appBehavior', 'Application Behavior')}
              </h2>
              <p className="text-xs text-slate-400 font-medium">Background sync and update preferences</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs py-2 border-b border-slate-100">
            <div>
              <p className="font-bold text-slate-800">{t('autoUpdate', 'Automatic Updates')}</p>
              <p className="text-slate-400 text-[11px]">{t('autoUpdateSub', 'Check and download application updates automatically')}</p>
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
              <p className="font-bold text-slate-800">{t('themeMode', 'Appearance Theme')}</p>
              <p className="text-slate-400 text-[11px]">{t('themeModeSub', 'Switch between light and dark interface')}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-xs border border-slate-200 transition-all"
            >
              {isDark ? t('darkMode', 'Dark Theme') : t('lightMode', 'Light Theme')}
            </button>
          </div>
        </div>
      </div>

      <ConnectBluetoothModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
      />
    </div>
  );
};
