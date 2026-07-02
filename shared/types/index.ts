// Shared types between frontend and backend

// ─── Peer / Device ────────────────────────────────────────────────────────────
export type DeviceType = 'mobile' | 'desktop' | 'tablet';
export type DeviceOS = 'android' | 'windows' | 'linux' | 'macos' | 'ios' | 'unknown';

export interface Peer {
  id: string;
  name: string;
  type: DeviceType;
  os: DeviceOS;
  ip?: string;
  joinedAt: string;
  online: boolean;
}

// ─── Transfer ─────────────────────────────────────────────────────────────────
export type TransferStatus =
  | 'pending'
  | 'requesting'
  | 'accepted'
  | 'active'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'rejected'
  | 'cancelled';

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  hash?: string;
}

export interface Transfer {
  id: string;
  peerId: string;
  peerName: string;
  direction: 'send' | 'receive';
  files: FileInfo[];
  status: TransferStatus;
  progress: number;       // 0–100
  speed: number;          // bytes/sec
  startedAt: string;
  completedAt?: string;
  error?: string;
  blobUrls?: string[];
}

// ─── WebSocket Messages ───────────────────────────────────────────────────────
export type MessageType =
  | 'PEER_JOIN'
  | 'PEER_LEAVE'
  | 'PEER_LIST'
  | 'OFFER'
  | 'ANSWER'
  | 'ICE_CANDIDATE'
  | 'TRANSFER_REQUEST'
  | 'TRANSFER_ACCEPT'
  | 'TRANSFER_REJECT'
  | 'TRANSFER_PROGRESS'
  | 'TRANSFER_COMPLETE'
  | 'TRANSFER_ERROR'
  | 'PING'
  | 'PONG'
  | 'ERROR';

export interface WSMessage {
  type: MessageType;
  from: string;
  to?: string;
  payload: unknown;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
}
