import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DeviceOS, DeviceType } from '../../shared/types';
import {
  getOrCreateDeviceId,
  getOrCreateDeviceName,
  detectOS,
  detectDeviceType,
} from '../lib/deviceDetect';

interface DeviceState {
  id: string;
  clientId: string;
  name: string;
  os: DeviceOS;
  type: DeviceType;
  isReady: boolean;
  init: () => void;
  setName: (name: string) => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      id: '',
      clientId: '',
      name: '',
      os: 'unknown',
      type: 'desktop',
      isReady: false,
      init: () => {
        if (get().isReady) return;
        const id = getOrCreateDeviceId();
        const name = getOrCreateDeviceName();
        const os = detectOS();
        const type = detectDeviceType();

        let tabId = '';
        if (typeof window !== 'undefined') {
          tabId = sessionStorage.getItem('offlinedrop_tab_id') || '';
          if (!tabId) {
            tabId = Math.random().toString(36).slice(2, 6);
            sessionStorage.setItem('offlinedrop_tab_id', tabId);
          }
        }
        const clientId = id + (tabId ? `-${tabId}` : '');

        set({ id, clientId, name, os, type, isReady: true });
      },
      setName: (name: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('offlinedrop_device_name', name);
        }
        set({ name });
      },
    }),
    {
      name: 'offlinedrop_device',
      partialize: (s) => ({ id: s.id, name: s.name, os: s.os, type: s.type }),
    }
  )
);
