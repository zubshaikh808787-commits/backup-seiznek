import { create } from 'zustand';
import { SystemSettings } from '@shared/types';

interface SettingsStoreState {
  settings: SystemSettings;
  fetchSettings: () => Promise<void>;
  updateSettings: (partial: Partial<SystemSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  settings: {
    theme: 'dark',
    language: 'en',
    autoUpdate: true,
    logLevel: 'INFO',
    downloadPath: 'C:\\Users\\Public\\Downloads\\Seznik',
  },

  fetchSettings: async () => {
    if (window.seznikApi) {
      const settings = await window.seznikApi.getSettings();
      set({ settings });
    }
  },

  updateSettings: async (partial) => {
    set((state) => ({ settings: { ...state.settings, ...partial } }));
    if (window.seznikApi) {
      await window.seznikApi.saveSettings(partial);
    }
  },
}));
