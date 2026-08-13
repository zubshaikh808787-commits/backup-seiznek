import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const AppLayout: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-slate-900 overflow-hidden select-none">
      {/* Top Application Titlebar */}
      <Header />

      {/* Main Window Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Desktop Viewport Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-slate-100/80">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
