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
  name: string;
  os: DeviceOS;
  type: DeviceType;
  isReady: boolean;
  roomCode?: string;
  init: () => void;
  setName: (name: string) => void;
  setRoomCode: (code: string) => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      id: '',
      name: '',
      os: 'unknown',
      type: 'desktop',
      isReady: false,
      roomCode: '',
      init: () => {
        if (get().isReady) return;
        const id = getOrCreateDeviceId();
        const name = getOrCreateDeviceName();
        const os = detectOS();
        const type = detectDeviceType();
        set({ id, name, os, type, isReady: true });
      },
      setName: (name: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('offlinedrop_device_name', name);
        }
        set({ name });
      },
      setRoomCode: (code: string) => {
        set({ roomCode: code.toUpperCase() });
      },
    }),
    {
      name: 'offlinedrop_device',
      partialize: (s) => ({ id: s.id, name: s.name, os: s.os, type: s.type, roomCode: s.roomCode }),
    }
  )
);
