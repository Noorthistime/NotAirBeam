'use client';
import { useRef, useCallback } from 'react';
import { WSMessage } from '../../shared/types';

const getIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnPass = process.env.NEXT_PUBLIC_TURN_PASSWORD;

  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: turnUser || '',
      credential: turnPass || '',
    });
  }

  return servers;
};

export interface RTCSession {
  peerId: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  candidatesQueue: RTCIceCandidateInit[];
}

type OnDataCallback = (data: ArrayBuffer | string, peerId: string) => void;
type OnChannelOpenCallback = (peerId: string) => void;
type OnChannelCloseCallback = (peerId: string) => void;

export function useWebRTC(
  deviceId: string,
  sendSignal: (msg: WSMessage) => void,
  onData: OnDataCallback,
  onChannelOpen?: OnChannelOpenCallback,
  onChannelClose?: OnChannelCloseCallback
) {
  const sessions = useRef<Map<string, RTCSession>>(new Map());

  const createPeerConnection = useCallback(
    (peerId: string, isInitiator: boolean): RTCSession => {
      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      let dc: RTCDataChannel | null = null;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({
            type: 'ICE_CANDIDATE',
            from: deviceId,
            to: peerId,
            payload: { candidate: e.candidate },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          if (sessions.current.get(peerId)?.pc === pc) {
            sessions.current.delete(peerId);
            onChannelClose?.(peerId);
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE Connection state: ${pc.iceConnectionState}`);
      };

      pc.onsignalingstatechange = () => {
        console.log(`[WebRTC] Signaling state: ${pc.signalingState}`);
      };

      if (isInitiator) {
        dc = pc.createDataChannel('fileTransfer', {
          ordered: true,
          maxRetransmits: 30,
        });
        setupDataChannel(dc, peerId);
      } else {
        pc.ondatachannel = (e) => {
          const incoming = e.channel;
          setupDataChannel(incoming, peerId);
          const session = sessions.current.get(peerId);
          if (session) session.dc = incoming;
        };
      }

      const session: RTCSession = { peerId, pc, dc, candidatesQueue: [] };
      sessions.current.set(peerId, session);
      return session;
    },
    [deviceId, sendSignal, onData, onChannelOpen, onChannelClose]
  );

  const setupDataChannel = (dc: RTCDataChannel, peerId: string) => {
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = 256 * 1024; // 256 KB

    dc.onopen = () => onChannelOpen?.(peerId);
    dc.onclose = () => onChannelClose?.(peerId);
    dc.onmessage = (e) => onData(e.data, peerId);
    dc.onerror = (e) => console.error('[WebRTC] DataChannel error:', e);
  };

  // Initiator creates offer
  const initiateConnection = useCallback(
    async (peerId: string): Promise<RTCSession> => {
      const session = createPeerConnection(peerId, true);
      const offer = await session.pc.createOffer();
      await session.pc.setLocalDescription(offer);
      sendSignal({ type: 'OFFER', from: deviceId, to: peerId, payload: { sdp: offer } });
      return session;
    },
    [createPeerConnection, deviceId, sendSignal]
  );

  // Receiver handles offer
  const handleOffer = useCallback(
    async (peerId: string, sdp: RTCSessionDescriptionInit) => {
      const session = createPeerConnection(peerId, false);
      await session.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      
      // Flush queued candidates
      for (const candidate of session.candidatesQueue) {
        try {
          await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Queued ICE candidate error:', e);
        }
      }
      session.candidatesQueue = [];

      const answer = await session.pc.createAnswer();
      await session.pc.setLocalDescription(answer);
      sendSignal({ type: 'ANSWER', from: deviceId, to: peerId, payload: { sdp: answer } });
    },
    [createPeerConnection, deviceId, sendSignal]
  );

  // Handle answer from receiver
  const handleAnswer = useCallback(async (peerId: string, sdp: RTCSessionDescriptionInit) => {
    const session = sessions.current.get(peerId);
    if (session) {
      await session.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      
      // Flush queued candidates
      for (const candidate of session.candidatesQueue) {
        try {
          await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Queued ICE candidate error:', e);
        }
      }
      session.candidatesQueue = [];
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
    const session = sessions.current.get(peerId);
    if (session) {
      if (session.pc.remoteDescription && session.pc.remoteDescription.type) {
        try {
          await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] ICE candidate error:', e);
        }
      } else {
        // Queue the candidate until remote description is set
        session.candidatesQueue.push(candidate);
      }
    }
  }, []);

  // Send binary data to peer via DataChannel
  const sendData = useCallback(async (peerId: string, data: ArrayBuffer | string) => {
    const session = sessions.current.get(peerId);
    const dc = session?.dc;
    if (!dc || dc.readyState !== 'open') return false;

    // Respect buffer threshold to avoid overflow (limit to 1MB buffered data)
    while (dc.bufferedAmount > 1024 * 1024) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (!dc || dc.readyState !== 'open') return false;
    }

    try {
      dc.send(data as any);
      return true;
    } catch (err) {
      console.error('[WebRTC] Error sending chunk:', err);
      return false;
    }
  }, []);

  const closeConnection = useCallback((peerId: string) => {
    const session = sessions.current.get(peerId);
    if (session) {
      session.dc?.close();
      session.pc.close();
      sessions.current.delete(peerId);
    }
  }, []);

  const getSession = useCallback((peerId: string) => sessions.current.get(peerId), []);

  return {
    initiateConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    sendData,
    closeConnection,
    getSession,
  };
}
