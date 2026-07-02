import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { handleMessage, handleDisconnect } from './handlers';
import { removeStalePeers, getPeerCount } from './rooms';

// Map ws instance → deviceId for cleanup
const wsDeviceMap = new Map<WebSocket, string>();

export function createWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract real IP (handle proxies)
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])
      || req.socket.remoteAddress
      || '127.0.0.1';

    const cleanIp = clientIp.replace('::ffff:', '');
    let deviceId: string | null = null;

    console.log(`[WS] New connection from ${cleanIp}`);

    ws.on('message', (data) => {
      try {
        const raw = data.toString();
        const parsed = JSON.parse(raw);

        // Track deviceId on first message
        if (!deviceId && parsed.from) {
          deviceId = parsed.from;
          wsDeviceMap.set(ws, deviceId!);
        }

        handleMessage(ws, raw, cleanIp);
      } catch (err) {
        console.error('[WS] Message error:', err);
      }
    });

    ws.on('close', () => {
      const id = wsDeviceMap.get(ws) || deviceId;
      if (id) {
        handleDisconnect(id);
        wsDeviceMap.delete(ws);
      }
      console.log(`[WS] Connection closed from ${cleanIp}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Socket error from ${cleanIp}:`, err.message);
    });

    // Send welcome ping
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PONG', from: 'server', payload: { ts: Date.now() } }));
    }
  });

  // Cleanup stale peers every 30 seconds
  setInterval(() => {
    const removed = removeStalePeers();
    if (removed > 0) {
      console.log(`[WS] Cleaned up ${removed} stale peers. Active: ${getPeerCount()}`);
    }
  }, 30_000);

  wss.on('error', (err) => {
    console.error('[WSS] Server error:', err);
  });

  console.log('[WS] WebSocket server ready on /ws');
  return wss;
}
