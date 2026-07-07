'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { usePeerStore } from '../store/peerStore';
import { useTransferStore } from '../store/transferStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useTransfer } from '../hooks/useTransfer';
import { Peer } from '../../shared/types';
import { formatBytes, formatSpeed, getAvatarColor } from '../lib/deviceDetect';

// ─── Minimalist Outline Device Icon (Nothing-inspired) ───────────────────────
function getMinimalistDeviceIcon(os: string, type: string) {
  const strokeColor = 'currentColor';
  if (type === 'mobile') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
        <rect x="6" y="2" width="12" height="20" rx="3" />
        <path d="M12 18h.01" />
      </svg>
    );
  }
  if (type === 'tablet') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M12 16h.01" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  );
}

// ─── DeviceAvatar ──────────────────────────────────────────────────────────────
function DeviceAvatar({ peer, size = 56 }: { peer: Peer; size?: number }) {
  const color = getAvatarColor(peer.id);
  const icon = getMinimalistDeviceIcon(peer.os, peer.type);
  return (
    <div
      style={{
        width: size, height: size,
        background: `radial-gradient(circle at 35% 35%, ${color}25, ${color}08)`,
        border: `1.5px solid ${color}35`,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, position: 'relative', flexShrink: 0,
        boxShadow: `0 0 ${size * 0.25}px ${color}15`,
      }}
    >
      <span style={{ color: 'var(--text-primary)', opacity: 0.95 }}>{icon}</span>
      <span
        style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.22, height: size * 0.22,
          background: peer.online ? 'var(--success)' : 'var(--text-muted)',
          borderRadius: '50%',
          border: '2px solid var(--bg-base)',
          boxShadow: peer.online ? '0 0 8px var(--success)' : 'none',
        }}
      />
    </div>
  );
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────
function ProgressRing({ progress, size = 44, color = 'var(--text-primary)' }: { progress: number; size?: number; color?: string }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="2" />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="2"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-primary)', zIndex: 1 }}>
        {progress}
      </span>
    </div>
  );
}

// ─── TransferCard ─────────────────────────────────────────────────────────────
function TransferCard({ transfer }: { transfer: any }) {
  const statusColors: Record<string, string> = {
    active: 'var(--accent)', complete: 'var(--success)', failed: 'var(--danger)',
    rejected: 'var(--danger)', requesting: 'var(--warning)', cancelled: 'var(--text-secondary)',
  };
  const color = statusColors[transfer.status] || 'var(--text-secondary)';
  const totalSize = transfer.files.reduce((s: number, f: any) => s + f.size, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass"
      style={{ padding: '14px 18px', marginBottom: 10, border: '1px solid var(--border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {transfer.status === 'active' ? (
            <ProgressRing progress={transfer.progress} size={42} color={color} />
          ) : (
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `var(--bg-overlay)`, border: `1px solid var(--border-bright)`,
              fontSize: 16, color: 'var(--text-primary)',
            }}>
              {transfer.status === 'complete' ? '✓' : transfer.direction === 'send' ? '↑' : '↓'}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {transfer.files.length === 1 ? transfer.files[0].name : `${transfer.files.length} files`}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
              padding: '2px 6px', borderRadius: 4, background: `rgba(100, 100, 100, 0.08)`
            }}>
              {transfer.status}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: transfer.status === 'active' ? 8 : 0 }}>
            {transfer.direction === 'send' ? 'To' : 'From'} <span style={{ color: 'var(--text-primary)' }}>{transfer.peerName}</span> · {formatBytes(totalSize)}
            {transfer.status === 'active' && transfer.speed > 0 && ` · ${formatSpeed(transfer.speed)}`}
          </div>
          {transfer.status === 'active' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="progress-bar" style={{ flex: 1 }}>
                <div className="progress-fill" style={{ width: `${transfer.progress}%`, background: 'var(--text-primary)' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>
                {transfer.progress}%
              </span>
            </div>
          )}
          {transfer.status === 'complete' && transfer.direction === 'receive' && transfer.blobUrls && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {transfer.files.map((file: any, index: number) => {
                const url = transfer.blobUrls?.[index];
                if (!url) return null;
                return (
                  <a
                    key={index}
                    href={url}
                    download={file.name}
                    className="btn-ghost"
                    style={{
                      padding: '5px 12px',
                      fontSize: 12,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      borderRadius: 8,
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--bg-overlay)',
                    }}
                  >
                    💾 Download {transfer.files.length > 1 ? file.name : ''}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── PeerCard (radial item) ───────────────────────────────────────────────────
function PeerCard({ peer, onClick }: { peer: Peer; onClick: () => void }) {
  const color = getAvatarColor(peer.id);
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: 10,
      }}
    >
      <div style={{ position: 'relative' }}>
        <motion.div
          animate={{ boxShadow: [`0 0 0px ${color}00`, `0 0 24px ${color}35`, `0 0 0px ${color}00`] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ borderRadius: '50%' }}
        >
          <DeviceAvatar peer={peer} size={64} />
        </motion.div>
      </div>
      <span style={{
        fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, maxWidth: 90, textAlign: 'center', lineHeight: 1.3,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4
      }}>
        {peer.name}
      </span>
      <span className="nothing-badge" style={{ fontSize: 9, padding: '1px 6px', opacity: 0.8 }}>
        {peer.os}
      </span>
    </motion.button>
  );
}

// ─── Radar Background ─────────────────────────────────────────────────────────
function RadarRings() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', overflow: 'visible' }}>
      {/* Premium ambient background glow behind radar */}
      <div style={{
        position: 'absolute',
        width: 380,
        height: 380,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-subtle) 0%, transparent 70%)',
        filter: 'blur(36px)',
        opacity: 0.65,
        zIndex: 0
      }} />
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            width: i * 180, height: i * 180,
            borderRadius: '50%',
            border: '1.5px solid var(--border-bright)',
            boxShadow: '0 0 15px rgba(255, 59, 48, 0.02)',
            zIndex: 1
          }}
          animate={{
            scale: [1, 1.015, 1],
            opacity: [0.15, 0.35, 0.15],
            borderColor: ['var(--border-bright)', 'var(--border)', 'var(--border-bright)'],
          }}
          transition={{ duration: 5, delay: i * 0.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Scanning sweep rotation - Nothing Tech inspired precision sweep */}
      <motion.div
        style={{
          position: 'absolute',
          width: 560, height: 560,
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, var(--border-bright) 0deg, transparent 55deg, transparent 360deg)',
          zIndex: 1
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ─── Incoming Request Modal ───────────────────────────────────────────────────
function IncomingModal({
  request, onAccept, onReject,
}: { request: any; onAccept: () => void; onReject: () => void }) {
  const totalSize = request.files.reduce((s: number, f: any) => s + f.size, 0);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 15 }}
        className="glass-bright"
        style={{ maxWidth: 400, width: '100%', padding: '30px 24px', textAlign: 'center' }}
      >
        <div style={{ fontSize: 44, marginBottom: 14, filter: 'drop-shadow(0 0 12px var(--border-bright))' }}>📨</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
          Incoming Transfer
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{request.peerName}</span> wants to send you
        </p>
        <div style={{
          background: 'var(--bg-overlay)', borderRadius: 12, border: '1px solid var(--border)', padding: '12px 16px',
          marginBottom: 24, textAlign: 'left',
        }}>
          {request.files.slice(0, 3).map((f: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: i < Math.min(request.files.length, 3) - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{f.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatBytes(f.size)}</span>
            </div>
          ))}
          {request.files.length > 3 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 6, fontFamily: 'var(--font-mono)' }}>+{request.files.length - 3} more files</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total size</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{formatBytes(totalSize)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-danger" onClick={onReject} style={{ flex: 1 }}>Decline</button>
          <button className="btn-primary" onClick={onAccept} style={{ flex: 1 }}>Accept</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'info', onClose }: { message: string; type?: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const colors: Record<string, string> = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--text-primary)' };
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      onClick={onClose}
      className="glass"
      style={{
        background: 'var(--bg-elevated)', border: `1px solid var(--border-bright)`,
        borderRadius: 12, padding: '12px 18px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: `0 8px 32px rgba(0,0,0,0.12), 0 0 8px ${colors[type]}15`,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[type], flexShrink: 0, boxShadow: `0 0 8px ${colors[type]}` }} />
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{message}</span>
    </motion.div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────
function DropZone({ onFiles, targetPeer }: { onFiles: (files: File[]) => void; targetPeer?: Peer }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }, [onFiles]);

  return (
    <motion.div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      animate={{
        borderColor: dragging ? 'var(--text-primary)' : 'var(--border-bright)',
        backgroundColor: dragging ? 'var(--bg-overlay)' : 'rgba(0,0,0,0.01)',
      }}
      style={{
        border: '1.5px dashed var(--border-bright)', borderRadius: 20,
        padding: '48px 32px', textAlign: 'center', cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: dragging ? '0 0 24px var(--border)' : 'none',
      }}
    >
      <input ref={inputRef} type="file" multiple style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); }} />
      <motion.div animate={{ scale: dragging ? 1.08 : 1, y: dragging ? -4 : 0 }} style={{ fontSize: 44, marginBottom: 14 }}>
        {dragging ? '📂' : '📁'}
      </motion.div>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        {targetPeer ? `Drop files to send to ${targetPeer.name}` : 'Select a device first'}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Drag & drop here or click to browse · Any file size supported
      </p>
    </motion.div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const device = useDeviceStore();
  const [name, setName] = useState(device.name);

  const save = () => { 
    device.setName(name.trim() || device.name); 
    onClose(); 
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <motion.div initial={{ scale: 0.9, y: 15 }} animate={{ scale: 1, y: 0 }}
        className="glass-bright" style={{ maxWidth: 380, width: '100%', padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, letterSpacing: '-0.01em' }}>Device Settings</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>Device Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="e.g. Noor's Laptop" maxLength={40} />
        </div>

        <div style={{ marginBottom: 24, padding: '12px 16px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Device ID</span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{device.id.slice(0, 12)}…</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Platform</span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', textTransform: 'capitalize', fontWeight: 500 }}>{device.os} · {device.type}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn-primary" onClick={save} style={{ flex: 1 }}>Save</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const device = useDeviceStore();
  const { peers, isDiscovering } = usePeerStore();
  const { transfers, incoming } = useTransferStore();
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [showTransfers, setShowTransfers] = useState(false);

  // Theme Management
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  useEffect(() => {
    const t = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' || 'dark';
    setTheme(t);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // Init device identity
  useEffect(() => { device.init(); }, []);

  // Prevent default browser behavior on file drag/drop outside target areas
  useEffect(() => {
    const preventDefault = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  const { connected, reconnecting, send, on, emit } = useWebSocket();
  const { sendFiles, acceptTransfer, rejectTransfer, wireSignals } = useTransfer({
    sendSignal: send,
    onWsMessage: on,
  });

  // Wire WebRTC signals once
  useEffect(() => { if (device.isReady) return wireSignals(); }, [device.isReady, wireSignals]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!selectedPeer) { addToast('Select a device first', 'error'); return; }
    try {
      await sendFiles(selectedPeer.id, selectedPeer.name, files);
      addToast(`Sent ${files.length === 1 ? files[0].name : `${files.length} files`} to ${selectedPeer.name}`, 'success');
    } catch (err: any) {
      if (!err.message.includes('rejected') && !err.message.includes('timed out')) {
        addToast(`Transfer failed: ${err.message}`, 'error');
      }
    }
  }, [selectedPeer, sendFiles, addToast]);

  const activeTransfers = transfers.filter((t) => t.status === 'active' || t.status === 'requesting');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', transition: 'background-color 0.3s ease, color 0.3s ease' }}>
      {/* ── Header ── */}
      <header style={{
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)', backdropFilter: 'blur(24px) saturate(180%)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 5px var(--accent-glow))', flexShrink: 0 }}>
            <path d="M5 12a7 7 0 0 1 14 0" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M1.34 10a12 12 0 0 1 21.32 0" />
          </svg>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>
            Not<span style={{ color: 'var(--accent)' }}>AirBeam</span>
          </span>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

          {/* Connection status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.div
              animate={{ opacity: connected ? 1 : [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: reconnecting ? Infinity : 0 }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--success)' : 'var(--warning)',
                boxShadow: connected ? '0 0 8px var(--success)' : 'none' }}
            />
            <span className="nothing-badge header-badge-text" style={{ fontSize: 10, padding: '1.5px 8px', letterSpacing: '0.08em' }}>
              {connected ? (peers.length === 1 ? '1 NEARBY DEVICE' : `${peers.length} NEARBY DEVICES`) : reconnecting ? 'WAITING' : 'OFFLINE'}
            </span>
          </div>

          {/* Active transfers badge */}
          {activeTransfers.length > 0 && (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={() => setShowTransfers((v) => !v)}
              style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', borderRadius: 20,
                padding: '4px 12px', fontSize: 11, color: 'var(--accent)', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)' }}>
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-block', fontSize: 10 }}>↻</motion.span>
              {activeTransfers.length} ACTIVE
            </motion.button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            style={{
              background: 'var(--bg-overlay)', border: '1px solid var(--border-bright)', cursor: 'pointer',
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-primary)', transition: 'all 0.2s',
            }}
            title="Toggle Light/Dark Theme"
          >
            <AnimatePresence mode="wait">
              {theme === 'dark' ? (
                <motion.svg key="sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ scale: 0.5, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.5, rotate: 45 }}>
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </motion.svg>
              ) : (
                <motion.svg key="moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ scale: 0.5, rotate: 45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.5, rotate: -45 }}>
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </motion.svg>
              )}
            </AnimatePresence>
          </button>

          {/* Device Settings Trigger */}
          <button onClick={() => setShowSettings(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-overlay)',
              border: '1px solid var(--border-bright)', borderRadius: '99px', padding: '4px 12px 4px 6px', cursor: 'pointer' }}>
            <DeviceAvatar peer={{ id: device.clientId, name: device.name, type: device.type, os: device.os, online: true, joinedAt: '' }} size={24} />
            <span className="header-device-name" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{device.name || 'My Device'}</span>
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 24px 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

        <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 30 }}>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>
            {peers.length === 0 ? (
              <>Searching for <span style={{ color: 'var(--accent)' }}>nearby</span> devices…</>
            ) : (
              <>Found <span style={{ color: 'var(--accent)' }}>{peers.length}</span> device{peers.length > 1 ? 's' : ''} nearby</>
            )}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
            All transfers happen directly on your local network · Zero internet required
          </motion.p>
        </div>


        <div className="dashboard-grid">
          {/* Column Left: Radar Orb System */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {/* Radar orbit visual system */}
            <div className="radar-container" style={{ position: 'relative', minHeight: 440, height: 440, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible', flexShrink: 0 }}>
              <RadarRings />

              {/* Center: Current user identity */}
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 2 }}>
                <motion.div
                  animate={{
                    scale: [1, 1.03, 1],
                    boxShadow: [
                      '0 0 10px 2px rgba(255, 59, 48, 0.1)',
                      '0 0 28px 8px rgba(255, 59, 48, 0.25)',
                      '0 0 10px 2px rgba(255, 59, 48, 0.1)'
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ borderRadius: '50%' }}
                >
                  <div style={{
                    padding: 4, borderRadius: '50%', border: '2px solid var(--text-primary)',
                    background: 'var(--bg-base)', boxShadow: '0 0 20px var(--border-bright)'
                  }}>
                    <DeviceAvatar peer={{ id: device.clientId, name: device.name, type: device.type, os: device.os, online: true, joinedAt: '' }} size={76} />
                  </div>
                </motion.div>
                <span className="nothing-badge" style={{ fontSize: 9, padding: '1px 6px', fontWeight: 'bold' }}>YOU</span>
              </div>

              {/* Orbit peers */}
              <AnimatePresence>
                {peers.map((peer, i) => {
                  const totalPeers = peers.length;
                  const angle = (i / totalPeers) * 2 * Math.PI - Math.PI / 2;
                  const r = Math.max(150, Math.min(200, 150 + totalPeers * 10));
                  const x = Math.cos(angle) * r;
                  const y = Math.sin(angle) * r;
                  return (
                    <motion.div
                      key={peer.id}
                      style={{ position: 'absolute', zIndex: 3 }}
                      initial={{ opacity: 0, scale: 0.8, x: 0, y: 0 }}
                      animate={{ opacity: 1, scale: 1, x, y }}
                      exit={{ opacity: 0, scale: 0.8, x: 0, y: 0 }}
                      transition={{ type: 'spring', stiffness: 80, damping: 15 }}
                    >
                      <PeerCard peer={peer} onClick={() => setSelectedPeer(selectedPeer?.id === peer.id ? null : peer)} />
                      {selectedPeer?.id === peer.id && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                            width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                            boxShadow: '0 0 10px var(--accent)' }} />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Empty state instruction */}
              {peers.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                  style={{ position: 'absolute', bottom: -10, left: 0, right: 0, textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    Open NotAirBeam on another device on the same local network
                  </p>
                </motion.div>
              )}
            </div>
          </div>

          {/* Column Right: Controls & Transfers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
            {/* ── Selected Peer + File Drop Zone ── */}
            <AnimatePresence>
              {selectedPeer && (
                <motion.section
                  key="dropzone"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                  style={{ width: '100%' }}
                >
                  <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', marginBottom: 16 }}>
                    <DeviceAvatar peer={selectedPeer} size={40} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedPeer.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}><span style={{ textTransform: 'capitalize' }}>{selectedPeer.os}</span> · {selectedPeer.type}</p>
                    </div>
                    <button onClick={() => setSelectedPeer(null)} className="btn-ghost"
                      style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 12 }}>✕ Deselect</button>
                  </div>
                  <DropZone onFiles={handleFiles} targetPeer={selectedPeer} />
                </motion.section>
              )}
            </AnimatePresence>

            {/* ── File Transfer Activity Monitor ── */}
            <AnimatePresence>
              {(showTransfers || transfers.length > 0) && transfers.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  style={{ width: '100%' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h2 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                      Transfers
                    </h2>
                    <button onClick={() => useTransferStore.getState().clearCompleted()}
                      style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Clear completed
                    </button>
                  </div>
                  <AnimatePresence>
                    {transfers.map((t) => <TransferCard key={t.id} transfer={t} />)}
                  </AnimatePresence>
                </motion.section>
              )}
            </AnimatePresence>

            {/* ── Help Prompt ── */}
            {!selectedPeer && peers.length > 0 && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 12, fontFamily: 'var(--font-mono)' }}>
                SELECT A DEVICE ABOVE TO SHARE FILES
              </motion.p>
            )}
          </div>
        </div>
      </main>

      {/* ── Modal overlay managers ── */}
      <AnimatePresence>
        {incoming && (
          <IncomingModal key="incoming"
            request={incoming}
            onAccept={() => acceptTransfer(incoming)}
            onReject={() => rejectTransfer(incoming)}
          />
        )}
        {showSettings && <SettingsPanel key="settings" onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      {/* ── Toast messaging notifier ── */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
