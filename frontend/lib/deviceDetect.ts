import { DeviceOS, DeviceType } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export function detectOS(): DeviceOS {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/win/.test(platform) || /windows/.test(ua)) return 'windows';
  if (/mac/.test(platform) || /macintosh/.test(ua)) return 'macos';
  if (/linux/.test(platform) || /linux/.test(ua)) return 'linux';
  return 'unknown';
}

export function detectDeviceType(): DeviceType {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua) || /iphone|ipod/.test(ua)) return 'mobile';
  if (/ipad/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return 'tablet';
  return 'desktop';
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return uuidv4();
  let id = localStorage.getItem('offlinedrop_device_id');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('offlinedrop_device_id', id);
  }
  return id;
}

export function getOrCreateDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device';
  let name = localStorage.getItem('offlinedrop_device_name');
  if (!name) {
    const os = detectOS();
    const type = detectDeviceType();
    const osNames: Record<DeviceOS, string> = {
      android: 'Android', windows: 'Windows', linux: 'Linux',
      macos: 'Mac', ios: 'iPhone', unknown: 'Device',
    };
    name = `${osNames[os]} ${type === 'mobile' ? 'Phone' : type === 'tablet' ? 'Tablet' : 'PC'}`;
    localStorage.setItem('offlinedrop_device_name', name);
  }
  return name;
}

export function setDeviceName(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('offlinedrop_device_name', name);
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function getDeviceIcon(os: DeviceOS, type: DeviceType): string {
  if (type === 'mobile') return '📱';
  if (type === 'tablet') return '📱';
  if (os === 'windows') return '🖥️';
  if (os === 'macos') return '💻';
  if (os === 'linux') return '🐧';
  return '💻';
}

// Generate deterministic avatar color from device ID
export function getAvatarColor(id: string): string {
  const colors = [
    '#FF6B35', '#FF4500', '#FF6347', '#FF7F50',
    '#FF8C00', '#FFA500', '#FFD700', '#FF69B4',
    '#DA70D6', '#BA55D3', '#9370DB', '#7B68EE',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
