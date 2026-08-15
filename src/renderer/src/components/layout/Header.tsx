import React, { useEffect, useState } from 'react';
import { Printer, Globe, RefreshCw, Search, Sparkles } from 'lucide-react';
import { WindowControls } from './WindowControls';
import { usePrinterStore } from '../../store/usePrinterStore';
import { useTranslation } from '../../i18n/useTranslation';

export const Header: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();
  const { v1State, fetchOsPrinters, fetchSavedPrinters } = usePrinterStore();
  const [platform, setPlatform] = useState<string>('win32');

  useEffect(() => {
    if (window.seznikApi) {
      window.seznikApi.getSystemInfo().then(info => setPlatform(info.platform));
    }
  }, []);

  const isUsbConnected = v1State.usbConnected;

  return (
    <header className="h-[44px] bg-[#F8FAFC] border-b border-slate-200/80 px-4 flex items-center justify-between select-none titlebar-drag shrink-0 z-50 text-slate-700">
      {/* Left Breadcrumb (Synapse Style) */}
      <div className="flex items-center space-x-2 text-xs titlebar-no-drag">
        <span className="text-slate-400 font-medium flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5 text-slate-400" />
          {t('docsBreadcrumb', 'Printers')}
        </span>
        <span className="text-slate-300">•</span>
        <span className="font-semibold text-slate-800">
          {t('overviewBreadcrumb', 'Device Overview')}
        </span>
      </div>

      {/* Right Controls: Search / Language / Refresh / Window Controls */}
      <div className="flex items-center space-x-2.5 titlebar-no-drag">
        {/* Language Selector Pill */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 shadow-2xs rounded-lg px-2 py-1">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'hi')}
            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
          </select>
        </div>

        {/* Refresh Hardware Button */}
        <button
          onClick={() => { fetchOsPrinters(); fetchSavedPrinters(); }}
          className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          title="Refresh Connected Devices"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Native-style Window Controls */}
        <WindowControls />
      </div>
    </header>
  );
};
