import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { PrinterDetection } from './pages/PrinterDetection';
import { DriverInstallation } from './pages/DriverInstallation';
import { SDKInstallation } from './pages/SDKInstallation';
import { FirmwareManager } from './pages/FirmwareManager';
import { Settings } from './pages/Settings';
import { Logs } from './pages/Logs';
import { Downloads } from './pages/Downloads';
import { About } from './pages/About';

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="detection" element={<PrinterDetection />} />
          <Route path="drivers" element={<DriverInstallation />} />
          <Route path="sdk" element={<SDKInstallation />} />
          <Route path="firmware" element={<FirmwareManager />} />
          <Route path="usb" element={<PrinterDetection />} />
          <Route path="network" element={<PrinterDetection />} />
          <Route path="settings" element={<Settings />} />
          <Route path="logs" element={<Logs />} />
          <Route path="downloads" element={<Downloads />} />
          <Route path="about" element={<About />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
