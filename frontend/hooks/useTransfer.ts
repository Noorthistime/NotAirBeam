'use client';
import { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useWebRTC } from './useWebRTC';
import { useTransferStore, IncomingRequest } from '../store/transferStore';
import { useDeviceStore } from '../store/deviceStore';
import { WSMessage, Transfer, FileInfo, MessageType } from '../../shared/types';
import {
  chunkFile,
  encodeChunk,
  decodeChunk,
  assembleChunks,
  downloadBlob,
  totalChunks,
  CHUNK_SIZE,
} from '../lib/chunker';

interface UseTransferOptions {
  sendSignal: (msg: WSMessage) => void;
  onWsMessage: (type: MessageType, handler: (msg: WSMessage) => void) => () => void;
}

export function useTransfer({ sendSignal, onWsMessage }: UseTransferOptions) {
  const clientId = useDeviceStore((s) => s.clientId);
  const deviceName = useDeviceStore((s) => s.name);
  const addTransfer = useTransferStore((s) => s.addTransfer);
  const updateTransfer = useTransferStore((s) => s.updateTransfer);
  const setIncoming = useTransferStore((s) => s.setIncoming);

  // Receive state: transferId → { chunks, meta }
  const receiveState = useRef<Map<string, {
    chunks: Map<number, ArrayBuffer>;
    meta: { name: string; size: number; type: string; total: number }[];
    currentFileIndex: number;
    receivedChunks: number;
    totalChunks: number;
    startTime: number;
  }>>(new Map());

  const pendingCompletes = useRef<Map<string, () => void>>(new Map());

  // Stable callback ref pattern to avoid recreation on every render
  const onDataRef = useRef<(data: ArrayBuffer | string, peerId: string) => void>(() => {});
  const handleData = useCallback((data: ArrayBuffer | string, peerId: string) => {
    onDataRef.current(data, peerId);
  }, []);

  const { initiateConnection, handleOffer, handleAnswer, handleIceCandidate, sendData, closeConnection, getSession } =
    useWebRTC(
      clientId,
      sendSignal,
      handleData
    );

  // Update the latest implementation on every render without triggering dependency changes
  onDataRef.current = (data: ArrayBuffer | string, peerId: string) => {
    if (typeof data === 'string') {
      // Control message
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'TRANSFER_META') {
          const { transferId, files } = msg;
          const total = files.reduce((sum: number, f: any) => sum + totalChunks(f.size), 0);
          receiveState.current.set(transferId, {
            chunks: new Map(),
            meta: files,
            currentFileIndex: 0,
            receivedChunks: 0,
            totalChunks: total,
            startTime: Date.now(),
          });
        } else if (msg.type === 'TRANSFER_COMPLETE_ACK') {
          const resolveComplete = pendingCompletes.current.get(msg.transferId);
          if (resolveComplete) {
            resolveComplete();
            pendingCompletes.current.delete(msg.transferId);
          }
        }
      } catch {}
      return;
    }
    // Binary chunk
    const chunk = decodeChunk(data as ArrayBuffer);
    const state = receiveState.current.get(chunk.transferId);
    if (!state) {
      console.warn('[Transfer] Received chunk for unknown transferId:', chunk.transferId);
      return;
    }

    state.chunks.set(chunk.index + (chunk.fileIndex * 1_000_000), chunk.data);
    state.receivedChunks++;

    const progress = Math.round((state.receivedChunks / state.totalChunks) * 100);
    const elapsed = Math.max(0.001, (Date.now() - state.startTime) / 1000);
    const received = state.receivedChunks * CHUNK_SIZE;
    const speed = received / elapsed;

    updateTransfer(chunk.transferId, { progress, speed });

    // Check if all chunks received
    if (state.receivedChunks >= state.totalChunks) {
      console.log('[Transfer] All chunks received for', chunk.transferId, '— sending ACK and assembling files...');

      // Send confirmation back to sender BEFORE download/assembly
      const session = getSession(peerId);
      if (session?.dc && session.dc.readyState === 'open') {
        try {
          session.dc.send(JSON.stringify({ type: 'TRANSFER_COMPLETE_ACK', transferId: chunk.transferId }));
        } catch (err) {
          console.error('[Transfer] Failed to send completion ACK:', err);
        }
      }

      // Assemble and download each file
      const blobUrls: string[] = [];
      state.meta.forEach((fileMeta, fi) => {
        const fileChunkCount = totalChunks(fileMeta.size);
        const fileChunks: ArrayBuffer[] = [];
        for (let i = 0; i < fileChunkCount; i++) {
          const c = state.chunks.get(i + fi * 1_000_000);
          if (c) fileChunks.push(c);
        }
        console.log(`[Transfer] Assembling file ${fi + 1}/${state.meta.length}: ${fileMeta.name} (${fileChunks.length} chunks)`);
        // Use application/octet-stream as MIME fallback if empty
        const mimeType = fileMeta.type || 'application/octet-stream';
        const blob = assembleChunks(fileChunks, mimeType);
        const blobUrl = URL.createObjectURL(blob);
        blobUrls.push(blobUrl);

        // Auto-download attempt
        downloadBlob(blob, fileMeta.name);
      });

      updateTransfer(chunk.transferId, {
        status: 'complete',
        progress: 100,
        completedAt: new Date().toISOString(),
        blobUrls,
      });

      receiveState.current.delete(chunk.transferId);
      // Wait a short delay before closing to ensure the ACK has been flushed
      setTimeout(() => {
        closeConnection(peerId);
      }, 1000);
    }
  };

  // ── Send Files ───────────────────────────────────────────────────────────────
  const sendFiles = useCallback(
    async (peerId: string, peerName: string, files: File[]) => {
      const transferId = uuidv4();
      const fileInfos: FileInfo[] = files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
        totalChunks: totalChunks(f.size),
      }));

      const transfer: Transfer = {
        id: transferId,
        peerId,
        peerName,
        direction: 'send',
        files: fileInfos,
        status: 'requesting',
        progress: 0,
        speed: 0,
        startedAt: new Date().toISOString(),
      };
      addTransfer(transfer);

      // Signal transfer request via WebSocket
      sendSignal({
        type: 'TRANSFER_REQUEST',
        from: clientId,
        to: peerId,
        payload: {
          transferId,
          files: fileInfos,
          senderName: deviceName,
        },
      });

      // Wait for acceptance via WebSocket
      return new Promise<void>((resolve, reject) => {
        const unsubAccept = onWsMessage('TRANSFER_ACCEPT', async (msg) => {
          const p = msg.payload as { transferId: string };
          if (p.transferId !== transferId || msg.from !== peerId) return;
          unsubAccept();
          unsubReject();

          updateTransfer(transferId, { status: 'active' });

          try {
            const session = await initiateConnection(peerId);

            // Wait for data channel to open
            console.log('[Transfer] Waiting for DataChannel to open...');
            await new Promise<void>((res, rej) => {
              const checkOpen = setInterval(() => {
                if (session.dc?.readyState === 'open') {
                  clearInterval(checkOpen);
                  console.log('[Transfer] DataChannel opened successfully!');
                  res();
                }
              }, 100);
              setTimeout(() => {
                clearInterval(checkOpen);
                console.error('[Transfer] DataChannel timeout (30s)!');
                rej(new Error('DC timeout'));
              }, 30_000);
            });

            // Send metadata
            console.log('[Transfer] Sending metadata...');
            session.dc!.send(JSON.stringify({ type: 'TRANSFER_META', transferId, files: fileInfos }));

            // Send all chunks
            console.log('[Transfer] Starting chunk transfer...');
            let sentChunks = 0;
            const totalChunkCount = fileInfos.reduce((s, f) => s + f.totalChunks, 0);
            const startTime = Date.now();

            for (let fi = 0; fi < files.length; fi++) {
              for await (const chunk of chunkFile(files[fi], transferId, fi)) {
                await sendData(peerId, encodeChunk(chunk));
                sentChunks++;
                const progress = Math.round((sentChunks / totalChunkCount) * 100);
                const elapsed = (Date.now() - startTime) / 1000;
                const speed = (sentChunks * CHUNK_SIZE) / elapsed;
                updateTransfer(transferId, { progress, speed });
              }
            }

            // Instead of closing immediately, wait for the receiver's acknowledgment!
            console.log('[Transfer] Finished sending all chunks. Waiting for receiver ACK...');
            await new Promise<void>((resolveComplete) => {
              const timeout = setTimeout(() => {
                console.warn('[Transfer] Timeout waiting for receiver ACK');
                resolveComplete();
              }, 15000); // 15 seconds fallback timeout

              pendingCompletes.current.set(transferId, () => {
                clearTimeout(timeout);
                console.log('[Transfer] Receiver ACK received!');
                resolveComplete();
              });
            });

            updateTransfer(transferId, { status: 'complete', progress: 100, completedAt: new Date().toISOString() });
            closeConnection(peerId);
            resolve();
          } catch (err: any) {
            updateTransfer(transferId, { status: 'failed', error: err.message });
            reject(err);
          }
        });

        const unsubReject = onWsMessage('TRANSFER_REJECT', (msg) => {
          const p = msg.payload as { transferId: string };
          if (p.transferId !== transferId || msg.from !== peerId) return;
          unsubAccept();
          unsubReject();
          updateTransfer(transferId, { status: 'rejected' });
          reject(new Error('Transfer rejected'));
        });

        // Timeout if no response in 60s
        setTimeout(() => {
          unsubAccept();
          unsubReject();
          updateTransfer(transferId, { status: 'failed', error: 'Request timed out' });
          reject(new Error('Transfer request timed out'));
        }, 60_000);
      });
    },
    [clientId, deviceName, sendSignal, onWsMessage, addTransfer, updateTransfer, initiateConnection, sendData, closeConnection]
  );

  // ── Handle incoming request ──────────────────────────────────────────────────
  const acceptTransfer = useCallback(
    async (req: IncomingRequest) => {
      const { transferId, peerId, peerName, files } = req;

      addTransfer({
        id: transferId,
        peerId,
        peerName,
        direction: 'receive',
        files: files.map((f) => ({ ...f, totalChunks: totalChunks(f.size) })),
        status: 'active',
        progress: 0,
        speed: 0,
        startedAt: new Date().toISOString(),
      });

      sendSignal({
        type: 'TRANSFER_ACCEPT',
        from: clientId,
        to: peerId,
        payload: { transferId },
      });

      setIncoming(null);

      // WebRTC offer will come from sender — handled in handleOffer
    },
    [clientId, sendSignal, addTransfer, setIncoming]
  );

  const rejectTransfer = useCallback(
    (req: IncomingRequest) => {
      sendSignal({
        type: 'TRANSFER_REJECT',
        from: clientId,
        to: req.peerId,
        payload: { transferId: req.transferId },
      });
      setIncoming(null);
    },
    [clientId, sendSignal, setIncoming]
  );

  // ── Wire up incoming WS signals ──────────────────────────────────────────────
  const wireSignals = useCallback(() => {
    const u1 = onWsMessage('TRANSFER_REQUEST', (msg) => {
      const p = msg.payload as { transferId: string; files: any[]; senderName: string };
      const totalSize = p.files.reduce((s: number, f: any) => s + f.size, 0);
      const req: IncomingRequest = {
        transferId: p.transferId,
        peerId: msg.from,
        peerName: p.senderName,
        files: p.files,
        totalSize,
      };
      setIncoming(req);
    });

    const u2 = onWsMessage('OFFER', (msg) => {
      const p = msg.payload as { sdp: RTCSessionDescriptionInit };
      handleOffer(msg.from, p.sdp);
    });

    const u3 = onWsMessage('ANSWER', (msg) => {
      const p = msg.payload as { sdp: RTCSessionDescriptionInit };
      handleAnswer(msg.from, p.sdp);
    });

    const u4 = onWsMessage('ICE_CANDIDATE', (msg) => {
      const p = msg.payload as { candidate: RTCIceCandidateInit };
      handleIceCandidate(msg.from, p.candidate);
    });

    return () => { u1(); u2(); u3(); u4(); };
  }, [onWsMessage, setIncoming, handleOffer, handleAnswer, handleIceCandidate]);

  return { sendFiles, acceptTransfer, rejectTransfer, wireSignals };
}
