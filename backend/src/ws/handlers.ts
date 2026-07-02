import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  addPeer,
  removePeer,
  getPeer,
  getPeersInSubnet,
  PeerInfo,
} from './rooms';

// ─── Message Types ─────────────────────────────────────────────────────────────
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

function send(ws: WebSocket, msg: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastToPeers(peers: PeerInfo[], msg: WSMessage, excludeId?: string) {
  for (const peer of peers) {
    if (peer.id !== excludeId) {
      send(peer.ws, msg);
    }
  }
}

function serializePeer(p: PeerInfo) {
  return { id: p.id, name: p.name, type: p.type, os: p.os, ip: p.ip, joinedAt: p.joinedAt };
}

// ─── Main Message Handler ──────────────────────────────────────────────────────
export function handleMessage(ws: WebSocket, raw: string, clientIp: string) {
  let msg: WSMessage;
  try {
    msg = JSON.parse(raw) as WSMessage;
  } catch {
    send(ws, { type: 'ERROR', from: 'server', payload: { error: 'Invalid JSON' } });
    return;
  }

  const { type, from, to, payload } = msg;

  switch (type) {
    // ── Device joins the network ────────────────────────────────────────────
    case 'PEER_JOIN': {
      const p = payload as { name: string; type: PeerInfo['type']; os: PeerInfo['os'] };
      if (!from || !p.name) {
        send(ws, { type: 'ERROR', from: 'server', payload: { error: 'PEER_JOIN requires id, name' } });
        return;
      }

      const peer: PeerInfo = {
        id: from,
        name: p.name,
        type: p.type || 'desktop',
        os: p.os || 'unknown',
        ip: clientIp,
        joinedAt: new Date().toISOString(),
        ws,
      };

      addPeer(peer);
      const nearbyPeers = getPeersInSubnet(from);

      // Send current peer list to new joiner
      send(ws, {
        type: 'PEER_LIST',
        from: 'server',
        payload: { peers: nearbyPeers.map(serializePeer) },
      });

      // Broadcast new peer to existing peers
      broadcastToPeers(nearbyPeers, {
        type: 'PEER_JOIN',
        from: 'server',
        payload: { peer: serializePeer(peer) },
      }, from);

      console.log(`[WS] PEER_JOIN: ${p.name} (${from}) from ${clientIp}`);
      break;
    }

    // ── WebRTC Offer (sender → receiver) ───────────────────────────────────
    case 'OFFER': {
      if (!to) return;
      const target = getPeer(to);
      if (!target) {
        send(ws, { type: 'ERROR', from: 'server', payload: { error: 'Target peer not found' } });
        return;
      }
      send(target.ws, { type: 'OFFER', from, to, payload });
      break;
    }

    // ── WebRTC Answer (receiver → sender) ──────────────────────────────────
    case 'ANSWER': {
      if (!to) return;
      const target = getPeer(to);
      if (target) send(target.ws, { type: 'ANSWER', from, to, payload });
      break;
    }

    // ── ICE Candidate relay ────────────────────────────────────────────────
    case 'ICE_CANDIDATE': {
      if (!to) return;
      const target = getPeer(to);
      if (target) send(target.ws, { type: 'ICE_CANDIDATE', from, to, payload });
      break;
    }

    // ── Transfer signals (relay to target peer) ────────────────────────────
    case 'TRANSFER_REQUEST':
    case 'TRANSFER_ACCEPT':
    case 'TRANSFER_REJECT':
    case 'TRANSFER_PROGRESS':
    case 'TRANSFER_COMPLETE':
    case 'TRANSFER_ERROR': {
      if (!to) return;
      const target = getPeer(to);
      if (target) send(target.ws, { type, from, to, payload });
      break;
    }

    // ── Heartbeat ──────────────────────────────────────────────────────────
    case 'PING': {
      send(ws, { type: 'PONG', from: 'server', payload: { ts: Date.now() } });
      break;
    }

    default:
      break;
  }
}

// ─── Peer Disconnect Handler ───────────────────────────────────────────────────
export function handleDisconnect(deviceId: string) {
  const peer = removePeer(deviceId);
  if (!peer) return;

  // Notify remaining peers in the same subnet
  const remaining = getPeersInSubnet(deviceId);
  broadcastToPeers(remaining, {
    type: 'PEER_LEAVE',
    from: 'server',
    payload: { id: deviceId },
  });

  console.log(`[WS] PEER_LEAVE: ${peer.name} (${deviceId})`);
}
