import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useSettingsStore } from '../../store/useSettingsStore';

export const AppLayout: React.FC = () => {
  const fetchSettings = useSettingsStore((state) => state.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F8FAFC] text-slate-800 overflow-hidden select-none font-sans">
      {/* Top Application Titlebar & Header */}
      <Header />

      {/* Main Window Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Desktop Viewport Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
