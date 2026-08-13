import React from 'react';
import { Settings as SettingsIcon, Moon, Globe, HardDrive, Bell } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useThemeStore } from '../store/useThemeStore';

export const Settings: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();
  const { isDark, toggleTheme } = useThemeStore();

  return (
    <div className="space-y-4 max-w-6xl mx-auto select-none text-slate-800">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-black uppercase text-slate-900 tracking-wider">Application Settings & Configuration</h1>
        <p className="text-xs text-slate-500 font-medium">Configure printer profiles, media dimensions, startup behavior, and logs</p>
      </div>

      <div className="space-y-3">
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
