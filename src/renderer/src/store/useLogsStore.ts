import { create } from 'zustand';
import { SystemLogEntry } from '@shared/types';

interface LogsStoreState {
  logs: SystemLogEntry[];
  isLoading: boolean;
  fetchLogs: () => Promise<void>;
  addLog: (log: SystemLogEntry) => void;
}

export const useLogsStore = create<LogsStoreState>((set) => ({
  logs: [
    {
      id: 'log-seed-1',
      timestamp: new Date().toISOString(),
      level: 'INFO',
      actionType: 'SYSTEM_BOOT',
      message: 'SEZNIK Printer Manager Phase 1 initialized cleanly.',
    },
    {
      id: 'log-seed-2',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      level: 'INFO',
      actionType: 'USB_DETECTION',
      message: 'Hotplug detected: SEZNIK POS-80 Ultra (VID: 0x0FE6, PID: 0x811E)',
    },
  ],
  isLoading: false,

  fetchLogs: async () => {
    if (window.seznikApi) {
      set({ isLoading: true });
      const logs = await window.seznikApi.getLogs();
      set({ logs, isLoading: false });
    }
  },

  addLog: (log) => set((state) => ({ logs: [log, ...state.logs] })),
}));
