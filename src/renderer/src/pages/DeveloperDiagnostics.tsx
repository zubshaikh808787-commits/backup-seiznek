import React, { useState, useEffect } from 'react';
import {
  Activity,
  Bluetooth,
  RefreshCw,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radio,
  Cpu,
  Layers,
  Terminal,
  Play,
  ShieldCheck,
  Server
} from 'lucide-react';
import { JoshBleDiagnosticReport } from '../../../shared/types';

export const DeveloperDiagnostics: React.FC = () => {
  const [report, setReport] = useState<JoshBleDiagnosticReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [testPrintLog, setTestPrintLog] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'ble' | 'dtpweb' | 'spooler' | 'logs'>('overview');

  const fetchReport = async () => {
    setLoading(true);
    try {
      if (window.seznikApi?.getJoshDiagnosticReport) {
        const res = await window.seznikApi.getJoshDiagnosticReport();
        setReport(res);
      }
    } catch (err: any) {
      console.error('Failed to fetch diagnostic report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleTestPrint = async (queueName: string) => {
    setTestPrintLog('Submitting test print...');
    try {
      if (window.seznikApi?.printDtpWebLabel) {
        const res = await window.seznikApi.printDtpWebLabel(queueName);
        setTestPrintLog(res.message);
      }
    } catch (err: any) {
      setTestPrintLog(`Error: ${err.message}`);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Developer Diagnostics</h1>
          </div>
          <p className="text-sm text-slate-500">
            Real-time Windows Bluetooth BLE stack, GATT characteristics, DTPWeb service, and Spooler inspect.
          </p>
        </div>

        <button
          onClick={fetchReport}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Diagnostics
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {(['overview', 'ble', 'dtpweb', 'spooler'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl capitalize transition-all ${
              activeTab === tab
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab === 'ble' ? 'Bluetooth & GATT' : tab === 'dtpweb' ? 'DTPWeb SDK' : tab === 'spooler' ? 'Windows Spooler' : 'Overview'}
          </button>
        ))}
      </div>

      {/* Overview Cards */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Bluetooth Radio Card */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Windows Bluetooth</span>
                <Radio className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${report?.windowsBluetoothEnabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-lg font-bold text-slate-900">
                  {report?.windowsBluetoothEnabled ? 'Radio Enabled' : 'Disabled / Missing'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {report?.bluetoothRadios.length || 0} Bluetooth Adapter(s) active
              </p>
            </div>

            {/* JOSH BLE Candidates */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">JOSH BLE Devices</span>
                <Bluetooth className="w-4 h-4 text-purple-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-purple-600">
                  {report?.joshCandidates.length || 0}
                </span>
                <span className="text-xs font-semibold text-slate-600">Candidates</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {report?.nearbyBleDevices.length || 0} total nearby Bluetooth devices
              </p>
            </div>

            {/* DTPWeb Print Assistant Service */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">DTPWeb Service</span>
                <Server className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${report?.dtpWebServiceRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-lg font-bold text-slate-900">
                  {report?.dtpWebServiceRunning ? `Port ${report.dtpWebPort}` : 'Offline'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {report?.dtpWebPrinters.length || 0} printer(s) bound to DTPWeb
              </p>
            </div>

            {/* Windows Spooler Queues */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Spooler Queues</span>
                <Printer className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-indigo-600">
                  {report?.windowsSpoolerPrinters.length || 0}
                </span>
                <span className="text-xs font-semibold text-slate-600">Installed</span>
              </div>
              <p className="text-[11px] text-slate-500">
                POS58, DP27, and system printers
              </p>
            </div>
          </div>

          {/* JOSH Identified Hardware Banner */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Verified JOSH Candidates (LD0801 / DP27 / DeTong)
              </h3>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                Multi-Factor Verified
              </span>
            </div>

            {report?.joshCandidates && report.joshCandidates.length > 0 ? (
              <div className="space-y-3">
                {report.joshCandidates.map((cand) => (
                  <div key={cand.deviceId} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{cand.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                          {cand.model}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex gap-4">
                        <span>MAC: <strong className="text-slate-700">{cand.address || 'N/A'}</strong></span>
                        <span>COM Port: <strong className="text-slate-700">{cand.comPort || 'GATT Direct'}</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTestPrint(cand.name)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-xs"
                    >
                      <Play className="w-3 h-3" />
                      Test Print
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-50 text-center text-slate-500 text-xs">
                No JOSH BLE devices detected yet. Ensure your JOSH label printer (LD0801 / DP27) is powered on.
              </div>
            )}

            {testPrintLog && (
              <div className="p-3 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono">
                {testPrintLog}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BLE & GATT Details Tab */}
      {activeTab === 'ble' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bluetooth className="w-4 h-4 text-purple-600" />
              Windows Bluetooth Devices & GATT UUIDs
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5">Device Name</th>
                    <th className="py-2.5">Address (MAC)</th>
                    <th className="py-2.5">PnP Status</th>
                    <th className="py-2.5">Identity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-mono">
                  {report?.nearbyBleDevices.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-slate-900 font-sans">{d.name}</td>
                      <td className="py-2.5">{d.address || 'N/A'}</td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold font-sans">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </span>
                      </td>
                      <td className="py-2.5 font-sans">
                        {d.name.toLowerCase().includes('ld0801') || d.name.toLowerCase().includes('dp27') ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-bold text-[10px]">
                            JOSH LABEL
                          </span>
                        ) : d.name.toLowerCase().includes('mpt') || d.name.toLowerCase().includes('pos') ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-bold text-[10px]">
                            VEER RECEIPT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px]">
                            Other
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DTPWeb SDK Tab */}
      {activeTab === 'dtpweb' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" />
              DTPWeb PC Web SDK 2.1.2022.1230 Status
            </h3>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Service Status:</span>
                <span className="font-bold text-emerald-600">
                  {report?.dtpWebServiceRunning ? `Running on http://127.0.0.1:${report.dtpWebPort}` : 'Not Running'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">LPA_DeviceType Architecture:</span>
                <span className="font-semibold text-slate-700">Local (1) / Net (2) / Wifi (3)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bluetooth Support:</span>
                <span className="font-semibold text-purple-700">Bridged via Windows Spooler Queue</span>
              </div>
            </div>

            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mt-4">
              Registered Printers in DTPWeb
            </h4>
            {report?.dtpWebPrinters && report.dtpWebPrinters.length > 0 ? (
              <div className="space-y-2">
                {report.dtpWebPrinters.map((p, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between text-xs">
                    <span className="font-bold text-slate-900">{p.name || p.printerName}</span>
                    <span className="text-slate-500">Type: {p.type === 1 ? 'Local Spooler' : p.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                No local printers registered in DTPWeb yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Windows Spooler Tab */}
      {activeTab === 'spooler' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-600" />
              Windows Print Spooler Installed Queues
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5">Printer Queue Name</th>
                    <th className="py-2.5">Driver Name</th>
                    <th className="py-2.5">Port Name</th>
                    <th className="py-2.5">Default</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {report?.windowsSpoolerPrinters.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-slate-900">{p.name}</td>
                      <td className="py-2.5">{p.driverName}</td>
                      <td className="py-2.5 font-mono">{p.portName}</td>
                      <td className="py-2.5">
                        {p.isDefault && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                            DEFAULT
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
