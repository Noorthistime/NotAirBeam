// ─── Peer Room Manager ────────────────────────────────────────────────────────
// Tracks all connected peers grouped by subnet/room

import WebSocket from 'ws';
import os from 'os';

export interface PeerInfo {
  id: string;          // Stable device UUID from localStorage
  name: string;        // User-set device name
  type: 'mobile' | 'desktop' | 'tablet';
  os: 'android' | 'windows' | 'linux' | 'macos' | 'ios' | 'unknown';
  ip: string;
  joinedAt: string;
  ws: WebSocket;
}

// Map: deviceId → PeerInfo
const peers = new Map<string, PeerInfo>();

// Map: deviceId → subnet (e.g. "192.168.1")
const subnets = new Map<string, string>();

export function addPeer(peer: PeerInfo): void {
  peers.set(peer.id, peer);
  const subnet = getSubnet(peer.ip);
  subnets.set(peer.id, subnet);
}

export function removePeer(deviceId: string): PeerInfo | undefined {
  const peer = peers.get(deviceId);
  peers.delete(deviceId);
  subnets.delete(deviceId);
  return peer;
}

export function getPeer(deviceId: string): PeerInfo | undefined {
  return peers.get(deviceId);
}

export function getPeersInSubnet(deviceId: string): PeerInfo[] {
  const mySubnet = subnets.get(deviceId);
  if (!mySubnet) return [];

  return Array.from(peers.values()).filter((p) => {
    return p.id !== deviceId && subnets.get(p.id) === mySubnet;
  });
}

export function getAllPeers(): PeerInfo[] {
  return Array.from(peers.values());
}

export function getPeerCount(): number {
  return peers.size;
}

export function removeStalePeers(): number {
  let removed = 0;
  for (const [id, peer] of peers.entries()) {
    if (peer.ws.readyState !== WebSocket.OPEN) {
      peers.delete(id);
      subnets.delete(id);
      removed++;
    }
  }
  return removed;
}

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127')) return true;
  const cleanIp = ip.replace('::ffff:', '');
  const parts = cleanIp.split('.');
  if (parts.length === 4) {
    const num = parseInt(parts[0], 10);
    if (num === 10 || num === 192) return true;
    if (num === 172) {
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
  }
  return false;
}

function getLocalSubnets(): string[] {
  const subnetsList: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const details of iface) {
      if (details.family === 'IPv4' && !details.internal) {
        const parts = details.address.split('.');
        if (parts.length === 4) {
          subnetsList.push(parts.slice(0, 3).join('.'));
        }
      }
    }
  }
  return subnetsList;
}

function getSubnet(ip: string): string {
  const cleanIp = ip.replace('::ffff:', '');
  
  if (isPrivateIp(cleanIp)) {
    // Local / Private Network
    if (cleanIp === '::1' || cleanIp === '127.0.0.1') {
      const locals = getLocalSubnets();
      if (locals.length > 0) return locals[0];
      return 'localhost';
    }
    // Group local devices by first 3 octets
    const parts = cleanIp.split('.');
    if (parts.length === 4) {
      return parts.slice(0, 3).join('.');
    }
  } else {
    // Public Network (Hosted on Render)
    const parts = cleanIp.split('.');
    if (parts.length === 4) {
      // For Public IPv4, all devices on a router share the EXACT SAME IP
      return cleanIp;
    }
    
    // For Public IPv6, devices on the same Wi-Fi share the first 4 blocks (/64 prefix)
    if (cleanIp.includes(':')) {
      const v6parts = cleanIp.split(':');
      if (v6parts.length >= 4) {
        return v6parts.slice(0, 4).join(':');
      }
    }
  }
  
  return cleanIp;
}
