import { create } from 'zustand';
import { BleSetupState } from '../../../shared/types';

interface VeerBleSetupStoreState {
  state: BleSetupState;
  isStarting: boolean;
  init: () => void;
  startSetup: () => Promise<void>;
  cancelSetup: () => Promise<void>;
  resetSetup: () => Promise<void>;
}

const initialSetupState: BleSetupState = {
  step: 'IDLE',
  stepMessage: 'Ready to start True BLE Setup.',
  progressPercent: 0,
  detectedPrinterName: null,
  detectedMacAddress: null,
  windowsDeviceId: null,
  isPaired: false,
  serviceUuid: null,
  characteristicUuid: null,
  driverName: null,
  isDriverInstalled: false,
  osPrinterQueueName: null,
  isOsPrinterCreated: false,
  isDefaultPrinter: false,
  isTestPrintSuccess: false,
  errorCode: null,
  errorMessage: null,
  errorDetails: null,
  logs: [],
  startTime: null,
  endTime: null,
};

export const useVeerBleSetupStore = create<VeerBleSetupStoreState>((set) => ({
  state: initialSetupState,
  isStarting: false,

  init: () => {
    if (window.veerBleSetup) {
      window.veerBleSetup.getSetupState().then((state) => {
        if (state) set({ state });
      });

      window.veerBleSetup.onSetupStateChanged((state) => {
        set({ state });
      });
    }
  },

  startSetup: async () => {
    if (window.veerBleSetup) {
      set({ isStarting: true });
      try {
        const state = await window.veerBleSetup.startSetup();
        set({ state, isStarting: false });
      } catch (err: any) {
        set({ isStarting: false });
      }
    }
  },

  cancelSetup: async () => {
    if (window.veerBleSetup) {
      const state = await window.veerBleSetup.cancelSetup();
      set({ state });
    }
  },

  resetSetup: async () => {
    if (window.veerBleSetup) {
      const state = await window.veerBleSetup.resetSetup();
      set({ state });
    }
  },
}));
