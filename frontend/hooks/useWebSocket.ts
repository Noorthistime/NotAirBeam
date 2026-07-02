'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { WSMessage, MessageType } from '../../shared/types';
import { useDeviceStore } from '../store/deviceStore';
import { usePeerStore } from '../store/peerStore';

const getWsUrl = () => {
  // Use Vercel environment variable in production
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  // Fallback for local development network
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:4000/ws`;
  }
  return 'ws://localhost:4000/ws';
};

const PING_INTERVAL = 25_000;
const RECONNECT_DELAY = 3_000;

type MessageHandler = (msg: WSMessage) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const handlersRef = useRef<Map<MessageType, MessageHandler[]>>(new Map());
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const device = useDeviceStore();
  const { setPeers, addPeer, removePeer, setDiscovering } = usePeerStore();

  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const on = useCallback((type: MessageType, handler: MessageHandler) => {
    const handlers = handlersRef.current.get(type) || [];
    handlersRef.current.set(type, [...handlers, handler]);
    return () => {
      const updated = (handlersRef.current.get(type) || []).filter((h) => h !== handler);
      handlersRef.current.set(type, updated);
    };
  }, []);

  const emit = useCallback((type: MessageType, to: string | undefined, payload: unknown) => {
    send({ type, from: device.id, to, payload });
  }, [send, device.id]);

  const connect = useCallback(() => {
    if (!device.isReady || !device.id) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setReconnecting(false);
      setDiscovering(true);

      // Announce self
      send({
        type: 'PEER_JOIN',
        from: device.id,
        payload: { name: device.name, type: device.type, os: device.os, roomCode: device.roomCode },
      });

      // Start heartbeat
      pingRef.current = setInterval(() => {
        send({ type: 'PING', from: device.id, payload: { ts: Date.now() } });
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        // Built-in peer management
        if (msg.type === 'PEER_LIST') {
          const { peers } = msg.payload as { peers: any[] };
          setPeers(peers.map((p) => ({ ...p, online: true })));
        } else if (msg.type === 'PEER_JOIN') {
          const { peer } = msg.payload as { peer: any };
          addPeer({ ...peer, online: true });
        } else if (msg.type === 'PEER_LEAVE') {
          const { id } = msg.payload as { id: string };
          removePeer(id);
        }

        // Dispatch to registered handlers
        const handlers = handlersRef.current.get(msg.type) || [];
        handlers.forEach((h) => h(msg));
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setDiscovering(false);
      if (pingRef.current) clearInterval(pingRef.current);
      // Auto-reconnect
      setReconnecting(true);
      reconnectRef.current = setTimeout(() => connect(), RECONNECT_DELAY);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      ws.close();
    };
  }, [device, send, setPeers, addPeer, removePeer, setDiscovering]);

  useEffect(() => {
    if (device.isReady) connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [device.isReady, connect]);

  // Handle room changes
  const lastRoomCode = useRef(device.roomCode);
  useEffect(() => {
    if (connected && device.roomCode !== lastRoomCode.current) {
      lastRoomCode.current = device.roomCode;
      send({
        type: 'PEER_JOIN',
        from: device.id,
        payload: { name: device.name, type: device.type, os: device.os, roomCode: device.roomCode },
      });
      // Clear peers since we changed rooms
      setPeers([]);
    }
  }, [device.roomCode, connected, send, device, setPeers]);

  return { connected, reconnecting, send, on, emit };
}
