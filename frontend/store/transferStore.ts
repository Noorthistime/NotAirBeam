import { create } from 'zustand';
import { Transfer, TransferStatus } from '../../shared/types';

interface TransferState {
  transfers: Transfer[];
  incoming: IncomingRequest | null;
  addTransfer: (t: Transfer) => void;
  updateTransfer: (id: string, updates: Partial<Transfer>) => void;
  removeTransfer: (id: string) => void;
  setIncoming: (req: IncomingRequest | null) => void;
  clearCompleted: () => void;
}

export interface IncomingRequest {
  transferId: string;
  peerId: string;
  peerName: string;
  files: { name: string; size: number; type: string }[];
  totalSize: number;
}

export const useTransferStore = create<TransferState>((set) => ({
  transfers: [],
  incoming: null,
  addTransfer: (t) => set((s) => ({ transfers: [t, ...s.transfers] })),
  updateTransfer: (id, updates) =>
    set((s) => ({
      transfers: s.transfers.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTransfer: (id) =>
    set((s) => {
      const target = s.transfers.find((t) => t.id === id);
      if (target?.blobUrls) {
        target.blobUrls.forEach((url) => {
          try { URL.revokeObjectURL(url); } catch {}
        });
      }
      return { transfers: s.transfers.filter((t) => t.id !== id) };
    }),
  setIncoming: (incoming) => set({ incoming }),
  clearCompleted: () =>
    set((s) => {
      s.transfers.forEach((t) => {
        if ((t.status === 'complete' || t.status === 'failed' || t.status === 'rejected') && t.blobUrls) {
          t.blobUrls.forEach((url) => {
            try { URL.revokeObjectURL(url); } catch {}
          });
        }
      });
      return {
        transfers: s.transfers.filter(
          (t) => t.status !== 'complete' && t.status !== 'failed' && t.status !== 'rejected'
        ),
      };
    }),
}));
