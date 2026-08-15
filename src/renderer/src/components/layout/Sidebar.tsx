import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Printer,
  HardDriveDownload,
  Settings as SettingsIcon,
  Terminal,
  Info,
  Bluetooth,
  Folder,
  Layers,
  Sparkles,
  Usb,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { usePrinterStore } from '../../store/usePrinterStore';
import { useTranslation } from '../../i18n/useTranslation';

interface NavItem {
  path: string;
  labelKey: string;
  defaultLabel: string;
  icon: React.ReactNode;
  badge?: number | string | null;
}

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { osPrinters, savedPrinters, v1State, bluetoothState } = usePrinterStore();

  const totalPrinters = savedPrinters.length > 0 ? savedPrinters.length : osPrinters.length;
  const isUsbConnected = v1State.usbConnected;
  const isBtConnected = !!bluetoothState?.connectedDeviceId;

  const deviceItems: NavItem[] = [
    {
      path: '/',
      labelKey: 'dashboard',
      defaultLabel: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4 text-slate-500" />,
      badge: totalPrinters > 0 ? totalPrinters : undefined,
    },
    {
      path: '/josh-setup',
      labelKey: 'joshSetup',
      defaultLabel: 'JOSH Bluetooth Setup',
      icon: <Bluetooth className="w-4 h-4 text-purple-600" />,
    },
    {
      path: '/detection',
      labelKey: 'printerDetection',
      defaultLabel: 'USB Printers',
      icon: <Usb className="w-4 h-4 text-slate-500" />,
      badge: isUsbConnected ? '1' : '0',
    },
    {
      path: '/drivers',
      labelKey: 'driverInstallation',
      defaultLabel: 'Drivers & Setup',
      icon: <HardDriveDownload className="w-4 h-4 text-slate-500" />,
    },
  ];

  const systemItems: NavItem[] = [
    {
      path: '/diagnostics',
      labelKey: 'diagnostics',
      defaultLabel: 'Developer Diagnostics',
      icon: <Activity className="w-4 h-4 text-purple-500" />,
    },
    {
      path: '/settings',
      labelKey: 'settings',
      defaultLabel: 'Settings',
      icon: <SettingsIcon className="w-4 h-4 text-slate-500" />,
    },
    {
      path: '/logs',
      labelKey: 'logs',
      defaultLabel: 'Activity Logs',
      icon: <Terminal className="w-4 h-4 text-slate-500" />,
    },
    {
      path: '/about',
      labelKey: 'about',
      defaultLabel: 'About',
      icon: <Info className="w-4 h-4 text-slate-500" />,
    },
  ];

  const renderNavGroup = (title: string, items: NavItem[]) => (
    <div className="mb-5">
      <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400">
        {title}
      </div>
      <nav className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all select-none ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs font-semibold border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`
            }
          >
            <div className="flex items-center space-x-2.5">
              {item.icon}
              <span>{t(item.labelKey, item.defaultLabel)}</span>
            </div>
            {item.badge !== undefined && (
              <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded-md bg-slate-100/80">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <aside className="w-56 bg-[#F8FAFC] border-r border-slate-200/80 flex flex-col justify-between p-3 select-none overflow-y-auto shrink-0">
      <div>
        {/* Synapse Style App Branding Header */}
        <div className="flex items-center justify-between px-3 py-2.5 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xs">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">
              SEZNIK
            </span>
          </div>
        </div>

        {renderNavGroup(t('sectionDevices', 'Devices'), deviceItems)}
        {renderNavGroup(t('sectionSystem', 'System'), systemItems)}
      </div>

      {/* Footer Hardware Status Tag */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-700">Hardware Status</span>
          <span className={`w-2 h-2 rounded-full ${isUsbConnected || isBtConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          {isUsbConnected ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 className="w-3 h-3" /> USB Connected
            </span>
          ) : (
            <span className="text-slate-400">USB Disconnected</span>
          )}
        </div>
      </div>
    </aside>
  );
};
