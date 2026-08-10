"use client";

import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

export default function UserPage() {
  const [authState, setAuthState] = useState('LOADING'); // LOADING, LOGIN, DASHBOARD
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState('DASHBOARD');

  // Messages state
  const [messagesData, setMessagesData] = useState([]);
  const [messagesTotalPages, setMessagesTotalPages] = useState(1);
  const [messagesCurrentPage, setMessagesCurrentPage] = useState(1);
  const [messagesStartDate, setMessagesStartDate] = useState('');
  const [messagesEndDate, setMessagesEndDate] = useState('');
  
  // Tes Pesan state
  const [testNoHp, setTestNoHp] = useState('');
  const [testIsiPesan, setTestIsiPesan] = useState('');

  const [testJid, setTestJid] = useState('');
  const [testIsiPesanJid, setTestIsiPesanJid] = useState('');
  
  const [showJidModal, setShowJidModal] = useState(false);
  const [groupJids, setGroupJids] = useState([]);
  
  const checkAuth = async () => {
    try {
      const res = await fetch('/auth/user/status');
      const data = await res.json();
      if (data.isAuthenticated) {
        setAuthState('DASHBOARD');
        fetchUser();
      } else {
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Failed to check auth', err);
      window.location.href = '/';
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch('/user/me');
      const data = await res.json();
      if (res.ok) {
        setUser(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/user/stats');
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (page = 1, start = '', end = '', silent = false) => {
    try {
      const res = await fetch(`/user/messages?page=${page}&limit=10&startDate=${start}&endDate=${end}`);
      const data = await res.json();
      if (res.ok) {
        setMessagesData(data.messages || []);
        setMessagesTotalPages(data.totalPages || 1);
        setMessagesCurrentPage(data.currentPage || 1);
        setMessagesStartDate(start);
        setMessagesEndDate(end);
        if (!silent) setCurrentTab('MESSAGES');
      } else {
        if (!silent) Swal.fire('Error', data.error || 'Gagal memuat pesan', 'error');
      }
    } catch (err) {
      if (!silent) Swal.fire('Error', 'Gagal menghubungi server', 'error');
    }
  };

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authState === 'DASHBOARD') {
      fetchStats();
    }
  }, [authState]);

  useEffect(() => {
    let interval;
    if (currentTab === 'MESSAGES') {
      const hasPending = messagesData.some(m => m.status === 'PENDING');
      if (hasPending) {
        interval = setInterval(() => {
          fetchMessages(messagesCurrentPage, messagesStartDate, messagesEndDate, true);
        }, 3000); // Poll every 3 seconds ONLY if there's pending messages
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTab, messagesCurrentPage, messagesStartDate, messagesEndDate, messagesData]);

  useEffect(() => {
    let eventSource;
    if (showJidModal) {
      eventSource = new EventSource('/user/group-events');
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setGroupJids(prev => {
          if (prev.find(g => g.jid === data.jid)) return prev;
          return [...prev, data];
        });
      };
    }
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [showJidModal]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) return Swal.fire('Error', 'Username dan Password wajib diisi', 'error');

    try {
      const res = await fetch('/auth/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      
      if (res.ok) {
        Swal.fire('Sukses', 'Berhasil masuk!', 'success');
        checkAuth();
      } else {
        Swal.fire('Error', data.error, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal login', 'error');
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Konfirmasi Logout',
      text: 'Apakah Anda yakin ingin keluar?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Keluar',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      await fetch('/auth/user/logout', { method: 'POST' });
      window.location.href = '/';
    }
  };

  const handleTestMessage = async (e) => {
    e.preventDefault();
    if (!testNoHp || !testIsiPesan) {
      return Swal.fire('Error', 'No HP dan Isi Pesan wajib diisi', 'error');
    }
    
    if (user?.waStatus !== 'CONNECTED') {
      return Swal.fire('Error', 'WhatsApp belum terkoneksi', 'error');
    }

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          no_hp: testNoHp,
          isi: testIsiPesan,
          token: user.token,
          secret: user.secret
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        Swal.fire('Sukses', 'Pesan berhasil dikirim', 'success');
        setTestNoHp('');
        setTestIsiPesan('');
        fetchStats();
      } else {
        Swal.fire('Error', data.error || 'Gagal mengirim pesan', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Terjadi kesalahan sistem', 'error');
    }
  };

  const handleTestMessageJid = async (e) => {
    e.preventDefault();
    if (!testJid || !testIsiPesanJid) {
      return Swal.fire('Error', 'JID dan Isi Pesan wajib diisi', 'error');
    }
    
    if (user?.waStatus !== 'CONNECTED') {
      return Swal.fire('Error', 'WhatsApp belum terkoneksi', 'error');
    }

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          jid: testJid,
          isi: testIsiPesanJid,
          token: user.token,
          secret: user.secret
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        Swal.fire('Sukses', 'Pesan via JID berhasil dikirim', 'success');
        setTestJid('');
        setTestIsiPesanJid('');
        fetchStats();
      } else {
        Swal.fire('Error', data.error || 'Gagal mengirim pesan', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Terjadi kesalahan sistem', 'error');
    }
  };

  const handleActivateWA = async () => {
    try {
      const res = await fetch('/user/activate', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        Swal.fire('Sukses', 'WA berhasil diaktifkan! Silakan klik Scan QR.', 'success');
        fetchUser();
      } else {
        Swal.fire('Error', data.error, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal mengaktifkan WA', 'error');
    }
  };

  const handleDisconnectWA = async () => {
    const result = await Swal.fire({
      title: 'Hapus Akses WA?',
      text: "Koneksi WA akan terputus dan dihapus!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Ya, Putuskan!'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch('/user/wa', { method: 'DELETE' });
      if (res.ok) {
        Swal.fire('Sukses', 'Koneksi WA telah diputus.', 'success');
        fetchUser();
      }
    } catch (err) {}
  };

  const handleScanQR = async () => {
    Swal.fire({
      title: 'Memuat QR Code...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const res = await fetch(`/client/${user?.username}/qr/json`);
      const data = await res.json();
      
      if (data.connected) {
        Swal.fire('Info', 'WhatsApp sudah terhubung.', 'info');
        fetchUser();
      } else if (data.qr) {
        Swal.fire({
          title: `Scan QR Code`,
          html: `<img src="${data.qr}" alt="QR Code" style="width: 250px; height: 250px; margin: 0 auto; display: block;" /><p style="margin-top: 15px; font-size: 14px; color: #64748b;">Buka WhatsApp di HP Anda > Perangkat Tautkan.<br/>Tutup dan klik tombol Scan QR lagi jika expired.</p>`,
          showConfirmButton: true,
          confirmButtonText: 'Tutup'
        });
      } else {
        Swal.fire('Info', 'QR Code sedang disiapkan, silakan coba lagi dalam beberapa detik.', 'warning');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal memuat QR Code', 'error');
    }
  };

  const handleResetAPI = async () => {
    const result = await Swal.fire({
      title: 'Reset Kredensial API?',
      text: "Token dan Secret lama akan tidak berlaku lagi. Yakin ingin mereset?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      confirmButtonText: 'Ya, Reset'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch('/user/reset-api', { method: 'PUT' });
        const data = await res.json();
        if (res.ok) {
          Swal.fire('Sukses', 'Kredensial berhasil di-reset.', 'success');
          fetchUser();
        } else {
          Swal.fire('Error', data.error || 'Gagal reset', 'error');
        }
      } catch (err) {
        Swal.fire('Error', 'Gagal menghubungi server', 'error');
      }
    }
  };

  if (authState === 'LOADING') {
    return <div style={{textAlign: 'center', marginTop: '50px'}}><h2>Loading...</h2></div>;
  }

  const isActive = user?.waStatus && user.waStatus !== 'DISCONNECTED';

  return (
    <div className="app-container">
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      
      {/* SIDEBAR */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>User Panel</h2>
        </div>
        
        <nav style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => { setCurrentTab('DASHBOARD'); setIsSidebarOpen(false); }} 
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: currentTab === 'DASHBOARD' ? '#2563eb' : 'transparent', color: currentTab === 'DASHBOARD' ? '#fff' : '#cbd5e1', fontWeight: '500', transition: 'all 0.2s' }}
          >
            Dashboard
          </button>
          <button 
            onClick={() => { fetchMessages(1, messagesStartDate, messagesEndDate); setIsSidebarOpen(false); }} 
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: currentTab === 'MESSAGES' ? '#2563eb' : 'transparent', color: currentTab === 'MESSAGES' ? '#fff' : '#cbd5e1', fontWeight: '500', transition: 'all 0.2s' }}
          >
            Pesan
          </button>
          <button 
            onClick={() => { setCurrentTab('TES'); setIsSidebarOpen(false); }} 
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: currentTab === 'TES' ? '#2563eb' : 'transparent', color: currentTab === 'TES' ? '#fff' : '#cbd5e1', fontWeight: '500', transition: 'all 0.2s' }}
          >
            Tes Pesan
          </button>
          <button 
            onClick={() => { setCurrentTab('TES_JID'); setIsSidebarOpen(false); }} 
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: currentTab === 'TES_JID' ? '#2563eb' : 'transparent', color: currentTab === 'TES_JID' ? '#fff' : '#cbd5e1', fontWeight: '500', transition: 'all 0.2s' }}
          >
            Tes Pesan JID
          </button>
          <button 
            onClick={() => { setCurrentTab('PETUNJUK'); setIsSidebarOpen(false); }} 
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: currentTab === 'PETUNJUK' ? '#2563eb' : 'transparent', color: currentTab === 'PETUNJUK' ? '#fff' : '#cbd5e1', fontWeight: '500', transition: 'all 0.2s' }}
          >
            Petunjuk API
          </button>
          <button 
            onClick={() => { setShowJidModal(true); setIsSidebarOpen(false); }} 
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: showJidModal ? '#2563eb' : 'transparent', color: showJidModal ? '#fff' : '#cbd5e1', fontWeight: '500', transition: 'all 0.2s' }}
          >
            JID GROUP
          </button>
        </nav>

        <div style={{ padding: '24px 16px', borderTop: '1px solid #1e293b' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header style={{ backgroundColor: '#fff', padding: '20px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center' }}>
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>☰</button>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: '500' }}>
            <span style={{ color: '#94a3b8' }}>{currentTab === 'DASHBOARD' ? 'Dashboard' : currentTab === 'MESSAGES' ? 'Pesan' : currentTab === 'TES' ? 'Tes Pesan' : currentTab === 'TES_JID' ? 'Tes Pesan JID' : 'Petunjuk API'} / </span> {user?.name || 'User'}
          </h2>
        </header>

        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          {currentTab === 'DASHBOARD' && (
            <>
              {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                  <div className="card" style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534' }}>Pesan Terproses</h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#15803d' }}>{stats.processed}</div>
                  </div>
                  <div className="card" style={{ padding: '24px', textAlign: 'center', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#92400e' }}>Belum Diproses</h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#b45309' }}>{stats.pending}</div>
                  </div>
                </div>
              )}

              <div className="card">
                <h2>Kredensial API Anda</h2>
                <p style={{ color: '#64748b', marginBottom: '16px' }}>Simpan Token dan Secret Anda untuk digunakan saat mengirim pesan via API.</p>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#334155', display: 'inline-block', width: '80px' }}>Token:</strong> 
                    <code style={{ background: '#e2e8f0', padding: '6px 10px', borderRadius: '4px', fontSize: '14px' }}>{user?.token}</code>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <strong style={{ color: '#334155', display: 'inline-block', width: '80px' }}>Secret:</strong> 
                    <code style={{ background: '#e2e8f0', padding: '6px 10px', borderRadius: '4px', fontSize: '14px', flex: 1, wordBreak: 'break-all', marginRight: '12px' }}>
                      {showSecret ? user?.secret : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                    </code>
                    <button 
                      onClick={() => setShowSecret(!showSecret)}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      {showSecret ? 'Sembunyikan' : 'Tampilkan'}
                    </button>
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    <button 
                      onClick={handleResetAPI}
                      className="btn btn-danger"
                      style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: '#f59e0b', border: 'none', color: '#fff', borderRadius: '4px' }}
                    >
                      Reset Token & Secret
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>Status Koneksi WhatsApp</h2>
                {!isActive ? (
                  <div>
                    <p style={{ color: '#64748b' }}>Anda belum menghubungkan WhatsApp ke sistem.</p>
                    <button className="btn btn-success" onClick={handleActivateWA} style={{ marginTop: '16px' }}>+ Aktifkan WhatsApp</button>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: '#64748b' }}>Status koneksi bot WhatsApp Anda saat ini:</p>
                    <div style={{ margin: '16px 0', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: '600', marginRight: '16px' }}>Status Bot:</span>
                        <span style={{ 
                          fontSize: '15px', fontWeight: '500',
                          color: user.waStatus === 'CONNECTED' ? '#166534' : '#991b1b'
                        }}>
                          {user.waStatus === 'CONNECTED' ? 'Terhubung' : (user.waStatus === 'CONNECTING' ? 'Menghubungkan...' : 'Tidak Terhubung')}
                        </span>
                      </div>
                      
                      <div>
                        {user.waStatus !== 'CONNECTED' && (
                          <button className="btn btn-primary" onClick={handleScanQR} style={{marginRight: '8px'}}>Scan QR</button>
                        )}
                        <button className="btn btn-danger" onClick={handleDisconnectWA}>Putuskan WA</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {currentTab === 'MESSAGES' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                <h2 style={{ margin: 0 }}>Daftar Pesan Anda</h2>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'flex-end', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: '#64748b', fontWeight: 'bold'}}>Mulai Tanggal</label>
                  <input type="date" value={messagesStartDate} onChange={e => setMessagesStartDate(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: '#64748b', fontWeight: 'bold'}}>Sampai Tanggal</label>
                  <input type="date" value={messagesEndDate} onChange={e => setMessagesEndDate(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
                <button className="btn btn-primary" onClick={() => fetchMessages(1, messagesStartDate, messagesEndDate)}>Terapkan Filter</button>
                <button 
                  onClick={() => fetchMessages(messagesCurrentPage, messagesStartDate, messagesEndDate, true)} 
                  style={{ padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#cbd5e1'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#e2e8f0'}
                >
                  🔄 Refresh
                </button>
              </div>

              <div className="table-responsive" style={{ marginBottom: '16px' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>No. Tujuan</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Isi Pesan</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Tanggal Input</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messagesData.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px', fontWeight: '500' }}>{m.target_no}</td>
                        <td style={{ padding: '12px', maxWidth: '300px', wordWrap: 'break-word', fontSize: '14px' }}>{m.message}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                            backgroundColor: m.status === 'SENT' ? '#dcfce7' : m.status === 'FAILED' ? '#fee2e2' : '#fef9c3',
                            color: m.status === 'SENT' ? '#166534' : m.status === 'FAILED' ? '#991b1b' : '#854d0e'
                          }}>
                            {m.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {new Date(m.createdAt).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                    {messagesData.length === 0 && (
                      <tr><td colSpan={4} style={{textAlign: 'center', padding: '24px', color: '#64748b'}}>Tidak ada pesan ditemukan.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {messagesTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', marginTop: 'auto', paddingTop: '16px' }}>
                  <button 
                    className="btn btn-primary" 
                    disabled={messagesCurrentPage === 1}
                    onClick={() => fetchMessages(messagesCurrentPage - 1, messagesStartDate, messagesEndDate)}
                    style={{ padding: '6px 12px', backgroundColor: messagesCurrentPage === 1 ? '#cbd5e1' : undefined }}
                  >
                    &laquo; Prev
                  </button>
                  <span style={{ fontSize: '14px', color: '#475569', fontWeight: '500' }}>
                    Halaman {messagesCurrentPage} dari {messagesTotalPages}
                  </span>
                  <button 
                    className="btn btn-primary" 
                    disabled={messagesCurrentPage === messagesTotalPages}
                    onClick={() => fetchMessages(messagesCurrentPage + 1, messagesStartDate, messagesEndDate)}
                    style={{ padding: '6px 12px', backgroundColor: messagesCurrentPage === messagesTotalPages ? '#cbd5e1' : undefined }}
                  >
                    Next &raquo;
                  </button>
                </div>
              )}
            </div>
          )}

          {currentTab === 'TES' && (
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>Pengujian Kirim Pesan</h2>
              <form onSubmit={handleTestMessage} style={{ maxWidth: '500px' }}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '14px' }}>No. WA Tujuan</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 6281234567890" 
                    value={testNoHp} 
                    onChange={e => setTestNoHp(e.target.value)} 
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <small style={{ color: '#94a3b8', fontSize: '12px' }}>Gunakan kode negara, contoh 62 untuk Indonesia</small>
                </div>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '14px' }}>Isi Pesan</label>
                  <textarea 
                    placeholder="Tulis pesan pengujian Anda di sini..." 
                    value={testIsiPesan} 
                    onChange={e => setTestIsiPesan(e.target.value)} 
                    rows="5"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                  ></textarea>
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: '600', backgroundColor: '#10b981', border: 'none' }}
                  disabled={user?.waStatus !== 'CONNECTED'}
                >
                  {user?.waStatus === 'CONNECTED' ? 'Kirim Pesan Sekarang' : 'WhatsApp Belum Terkoneksi'}
                </button>
              </form>
            </div>
          )}

          {currentTab === 'TES_JID' && (
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>Pengujian Kirim Pesan via JID</h2>
              <form onSubmit={handleTestMessageJid} style={{ maxWidth: '500px' }}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '14px' }}>Target JID</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 123456789@g.us atau 62812...@s.whatsapp.net" 
                    value={testJid} 
                    onChange={e => setTestJid(e.target.value)} 
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <small style={{ color: '#94a3b8', fontSize: '12px' }}>Dapatkan JID dari menu JID GROUP</small>
                </div>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '14px' }}>Isi Pesan</label>
                  <textarea 
                    placeholder="Tulis pesan pengujian Anda di sini..." 
                    value={testIsiPesanJid} 
                    onChange={e => setTestIsiPesanJid(e.target.value)} 
                    rows="5"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                  ></textarea>
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: '600', backgroundColor: '#10b981', border: 'none' }}
                  disabled={user?.waStatus !== 'CONNECTED'}
                >
                  {user?.waStatus === 'CONNECTED' ? 'Kirim Pesan via JID' : 'WhatsApp Belum Terkoneksi'}
                </button>
              </form>
            </div>
          )}

          {currentTab === 'PETUNJUK' && (
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>Petunjuk Penggunaan API</h2>
              <div style={{ color: '#475569', lineHeight: '1.6' }}>
                <p>Anda dapat mengintegrasikan pengiriman pesan WhatsApp ke dalam aplikasi Anda dengan melakukan HTTP POST request ke endpoint API kami.</p>
                
                <h3 style={{ marginTop: '24px', fontSize: '16px', color: '#0f172a' }}>1. Endpoint URL</h3>
                <code style={{ display: 'block', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '6px', color: '#334155', marginBottom: '8px' }}>
                  POST {window.location.origin}/api/send
                </code>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Atau gunakan endpoint khusus untuk JID/Grup:</p>
                <code style={{ display: 'block', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '6px', color: '#334155', marginBottom: '16px' }}>
                  POST {window.location.origin}/api/send-group
                </code>
                
                <h3 style={{ marginTop: '24px', fontSize: '16px', color: '#0f172a' }}>2. Parameter (Format JSON)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '12px' }}>Parameter</th>
                      <th style={{ padding: '12px' }}>Tipe</th>
                      <th style={{ padding: '12px' }}>Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}><code>username</code></td>
                      <td style={{ padding: '12px' }}>String</td>
                      <td style={{ padding: '12px' }}>Username akun Anda.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}><code>token</code></td>
                      <td style={{ padding: '12px' }}>String</td>
                      <td style={{ padding: '12px' }}>Token API unik Anda (terdapat di menu Dashboard).</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}><code>secret</code></td>
                      <td style={{ padding: '12px' }}>String</td>
                      <td style={{ padding: '12px' }}>Secret API unik Anda (terdapat di menu Dashboard).</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}><code>no_hp</code></td>
                      <td style={{ padding: '12px' }}>String</td>
                      <td style={{ padding: '12px' }}>Nomor WhatsApp tujuan (gunakan format kode negara misal: 62812xxx). Dipakai untuk <code>/api/send</code>.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}><code>jid</code></td>
                      <td style={{ padding: '12px' }}>String</td>
                      <td style={{ padding: '12px' }}>JID tujuan atau Grup (misal: 123456789@g.us). Opsional untuk <code>/api/send</code>, Wajib untuk <code>/api/send-group</code>.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}><code>isi</code></td>
                      <td style={{ padding: '12px' }}>String</td>
                      <td style={{ padding: '12px' }}>Isi teks pesan yang akan dikirim.</td>
                    </tr>
                  </tbody>
                </table>
                
                <h3 style={{ marginTop: '32px', fontSize: '16px', color: '#0f172a' }}>3. Contoh Implementasi</h3>
                <h4 style={{ fontSize: '14px', color: '#475569', marginBottom: '8px' }}>cURL (Kirim ke Nomor)</h4>
                <pre style={{ backgroundColor: '#1e293b', color: '#f8fafc', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
{`curl -X POST ${window.location.origin}/api/send \\
-H "Content-Type: application/json" \\
-d '{
  "username": "${user?.username || 'USERNAME_ANDA'}",
  "token": "${user?.token || 'TOKEN_ANDA'}",
  "secret": "${user?.secret || 'SECRET_ANDA'}",
  "no_hp": "6281234567890",
  "isi": "Halo, ini pesan percobaan dari API!"
}'`}
                </pre>
                
                <h4 style={{ fontSize: '14px', color: '#475569', marginBottom: '8px' }}>cURL (Kirim ke Grup / JID)</h4>
                <pre style={{ backgroundColor: '#1e293b', color: '#f8fafc', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
{`curl -X POST ${window.location.origin}/api/send-group \\
-H "Content-Type: application/json" \\
-d '{
  "username": "${user?.username || 'USERNAME_ANDA'}",
  "token": "${user?.token || 'TOKEN_ANDA'}",
  "secret": "${user?.secret || 'SECRET_ANDA'}",
  "jid": "12345678912345@g.us",
  "isi": "Halo, ini pesan percobaan untuk Grup dari API!"
}'`}
                </pre>
                
                <h4 style={{ fontSize: '14px', color: '#475569', marginBottom: '8px' }}>PHP (cURL)</h4>
                <pre style={{ backgroundColor: '#1e293b', color: '#f8fafc', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
{`<?php
// === CONTOH MENGIRIM KE NOMOR HP ===
$curl = curl_init();
$payload = json_encode(array(
  "username" => "${user?.username || 'USERNAME_ANDA'}",
  "token" => "${user?.token || 'TOKEN_ANDA'}",
  "secret" => "${user?.secret || 'SECRET_ANDA'}",
  "no_hp" => "6281234567890",
  "isi" => "Halo, ini pesan percobaan dari API!"
));

curl_setopt_array($curl, array(
  CURLOPT_URL => '${window.location.origin}/api/send',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => '',
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 0,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_HTTPHEADER => array('Content-Type: application/json'),
));
$response = curl_exec($curl);
curl_close($curl);
echo $response;

// === CONTOH MENGIRIM KE GRUP (JID) ===
$curlGroup = curl_init();
$payloadGroup = json_encode(array(
  "username" => "${user?.username || 'USERNAME_ANDA'}",
  "token" => "${user?.token || 'TOKEN_ANDA'}",
  "secret" => "${user?.secret || 'SECRET_ANDA'}",
  "jid" => "12345678912345@g.us",
  "isi" => "Halo, ini pesan percobaan untuk Grup dari API!"
));

curl_setopt_array($curlGroup, array(
  CURLOPT_URL => '${window.location.origin}/api/send-group',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => '',
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 0,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS => $payloadGroup,
  CURLOPT_HTTPHEADER => array('Content-Type: application/json'),
));
$responseGroup = curl_exec($curlGroup);
curl_close($curlGroup);
echo $responseGroup;
?>`}
                </pre>

                <h3 style={{ marginTop: '32px', fontSize: '16px', color: '#0f172a' }}>4. Contoh Respons (Response)</h3>
                <h4 style={{ fontSize: '14px', color: '#475569', marginBottom: '8px' }}>Jika Sukses (HTTP 200 OK)</h4>
                <pre style={{ backgroundColor: '#1e293b', color: '#a7f3d0', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
{`{
  "message": "Message queued successfully",
  "scheduled_for": "2026-08-02T10:00:00.000Z",
  "data": {
    "id": 125,
    "target": "6281234567890",
    "status": "PENDING"
  }
}`}
                </pre>
                
                <h4 style={{ fontSize: '14px', color: '#475569', marginBottom: '8px' }}>Jika Gagal (HTTP 401 / 403)</h4>
                <pre style={{ backgroundColor: '#1e293b', color: '#fca5a5', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
{`{
  "error": "Kombinasi username, token, dan secret salah" 
  // Atau "Akun user dinonaktifkan"
}`}
                </pre>

              </div>
            </div>
          )}
        </div>
      </main>
      
      {showJidModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '8px', padding: '24px', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Dapatkan JID Group</h2>
              <button onClick={() => setShowJidModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
              Kirim pesan apa saja ke grup WhatsApp dari HP Anda. JID grup akan otomatis muncul di sini. (WhatsApp harus dalam status Terhubung).
            </p>
            
            {groupJids.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <p style={{ color: '#94a3b8', margin: 0 }}>Menunggu pesan grup masuk...</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {groupJids.map((g, i) => (
                  <li key={i} style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px' }}>{g.name}</strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{g.jid}</span>
                    </div>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(g.jid); Swal.fire('Sukses', 'JID disalin!', 'success'); }}
                      style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Salin
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
