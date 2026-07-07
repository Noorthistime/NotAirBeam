'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Use a secure way to check auth: make a real request.
  const checkAuth = async (pass: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/stats', {
        headers: {
          'x-admin-secret': pass,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminStats(data);
        setIsAuthenticated(true);
        sessionStorage.setItem('admin_pass', pass);
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    checkAuth(password);
  };

  const fetchAdminStats = useCallback(async (pass: string) => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: {
          'x-admin-secret': pass,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminStats(data);
      } else {
        // If auth fails during polling, log out
        setIsAuthenticated(false);
        sessionStorage.removeItem('admin_pass');
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    }
  }, []);

  useEffect(() => {
    const savedPass = sessionStorage.getItem('admin_pass');
    if (savedPass) {
      checkAuth(savedPass);
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAuthenticated) {
      const savedPass = sessionStorage.getItem('admin_pass');
      if (savedPass) {
        interval = setInterval(() => fetchAdminStats(savedPass), 5000);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, fetchAdminStats]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminStats(null);
    setPassword('');
    sessionStorage.removeItem('admin_pass');
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-base)', padding: 24 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-bright"
          style={{ maxWidth: 400, width: '100%', padding: '40px 32px', textAlign: 'center' }}
        >
          <div style={{ marginBottom: 24 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto', filter: 'drop-shadow(0 0 10px var(--accent-glow))' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, fontFamily: 'var(--font-mono)' }}>Admin Portal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>Enter the admin password to access live analytics.</p>
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 24, textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                style={{ width: '100%', padding: '12px 16px', fontSize: 16 }}
                autoFocus
              />
              {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{error}</p>}
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !password}
              style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, letterSpacing: '0.05em' }}
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', transition: 'background-color 0.3s ease, color 0.3s ease' }}>
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
            Not<span style={{ color: 'var(--accent)' }}>AirBeam</span> <span style={{ opacity: 0.5 }}>/ Admin</span>
          </span>
        </div>
        <button onClick={handleLogout} className="btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }}>
          Logout
        </button>
      </header>

      {/* ── Main content ── */}
      <main style={{ padding: '40px 24px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        
        {adminStats ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="nothing-glass"
            style={{ padding: '24px 32px', border: '1.5px dashed var(--accent)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="status-dot online" style={{ width: 10, height: 10, background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Live System Analytics
                </span>
              </div>
              <span className="nothing-badge" style={{ fontSize: 12, padding: '4px 10px' }}>
                Uptime: {Math.round(adminStats.uptime)}s
              </span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
              <div style={{ padding: 20, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>Active Devices</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', marginTop: 8, lineHeight: 1 }}>{adminStats.activePeerCount}</div>
              </div>
              <div style={{ padding: 20, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>Database Users</div>
                <div style={{ fontSize: 36, fontWeight: 800, marginTop: 8, lineHeight: 1 }}>{adminStats.totalUsers}</div>
              </div>
              <div style={{ padding: 20, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>Total Transfers</div>
                <div style={{ fontSize: 36, fontWeight: 800, marginTop: 8, lineHeight: 1 }}>{adminStats.totalTransfers}</div>
              </div>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
              Connected Devices
            </h3>

            {adminStats.activePeers && adminStats.activePeers.length > 0 ? (
              <div style={{ overflowX: 'auto', background: 'var(--bg-overlay)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-bright)', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Device Name</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>OS</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>IP Address</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Network</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminStats.activePeers.map((p: any) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{p.os} ({p.type})</td>
                        <td style={{ padding: '12px 16px', color: 'var(--accent)' }}>{p.ip}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Local Network</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: 32, fontFamily: 'var(--font-mono)', background: 'var(--bg-overlay)', borderRadius: 12, border: '1px solid var(--border)' }}>
                No active peers currently online.
              </div>
            )}
          </motion.div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            Loading analytics...
          </div>
        )}
      </main>
    </div>
  );
}
