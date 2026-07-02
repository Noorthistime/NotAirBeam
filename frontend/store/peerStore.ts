import { create } from 'zustand';
import { Peer } from '../../shared/types';

interface PeerState {
  peers: Peer[];
  isDiscovering: boolean;
  setPeers: (peers: Peer[]) => void;
  addPeer: (peer: Peer) => void;
  removePeer: (id: string) => void;
  updatePeer: (id: string, updates: Partial<Peer>) => void;
  setDiscovering: (v: boolean) => void;
  clearPeers: () => void;
}

export const usePeerStore = create<PeerState>((set) => ({
  peers: [],
  isDiscovering: false,
  setPeers: (peers) => set({ peers }),
  addPeer: (peer) =>
    set((s) => {
      const exists = s.peers.find((p) => p.id === peer.id);
      if (exists) return { peers: s.peers.map((p) => (p.id === peer.id ? { ...p, ...peer } : p)) };
      return { peers: [...s.peers, peer] };
    }),
  removePeer: (id) => set((s) => ({ peers: s.peers.filter((p) => p.id !== id) })),
  updatePeer: (id, updates) =>
    set((s) => ({ peers: s.peers.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
  setDiscovering: (isDiscovering) => set({ isDiscovering }),
  clearPeers: () => set({ peers: [] }),
}));
