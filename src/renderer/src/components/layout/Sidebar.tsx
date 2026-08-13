import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Printer,
  HardDriveDownload,
  Settings as SettingsIcon,
  Terminal,
  Info,
} from 'lucide-react';
import { usePrinterStore } from '../../store/usePrinterStore';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC = () => {
  const { osPrinters, savedPrinters } = usePrinterStore();
  const totalCount = savedPrinters.length > 0 ? savedPrinters.length : osPrinters.length;

  const primaryItems: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { path: '/detection', label: 'USB Printers', icon: <Printer className="w-4 h-4" /> },
    { path: '/drivers', label: 'Driver Setup', icon: <HardDriveDownload className="w-4 h-4" /> },
  ];

  const systemItems: NavItem[] = [
    { path: '/settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> },
    { path: '/logs', label: 'System Logs', icon: <Terminal className="w-4 h-4" /> },
    { path: '/about', label: 'About', icon: <Info className="w-4 h-4" /> },
  ];

  const renderNavGroup = (title: string, items: NavItem[]) => (
    <div className="mb-4">
      <div className="px-3 mb-1 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
        {title}
      </div>
      <nav className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:text-blue-600 hover:bg-slate-100'
              }`
            }
          >
            <div className="flex items-center space-x-2.5">
              {item.icon}
              <span>{item.label}</span>
            </div>
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <aside className="w-52 bg-white border-r border-slate-200/90 flex flex-col justify-between p-3 select-none overflow-y-auto shrink-0">
      <div>
        {renderNavGroup('Management', primaryItems)}
        {renderNavGroup('System', systemItems)}
      </div>

      {/* Footer Status Card */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
        <div className="flex items-center justify-between font-extrabold text-slate-800">
          <span>OS Spooler</span>
          <span className={`w-2 h-2 rounded-full ${totalCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
        </div>
        <p className="text-[10px] text-slate-500 font-medium">
          {totalCount > 0 ? `${totalCount} Active Queue(s)` : 'No Devices Connected'}
        </p>
      </div>
    </aside>
  );
};

