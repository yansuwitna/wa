"use client";

import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

export default function AdminPage() {
  const [authState, setAuthState] = useState('LOADING'); // LOADING, LOGIN, REGISTER, DASHBOARD
  const [currentTab, setCurrentTab] = useState('DASHBOARD'); // DASHBOARD, USER, CLIENT, API
  const [adminName, setAdminName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaKey, setCaptchaKey] = useState(Date.now()); // to force refresh captcha
  
  // Dashboard states
  const [stats, setStats] = useState({ totalClients: 0, pendingMessages: 0, sentMessages: 0, failedMessages: 0 });
  const [loadingStats, setLoadingStats] = useState(false);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Forms
  const [userName, setUserName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');

  // Edit User State
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editUserUsername, setEditUserUsername] = useState(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserAktif, setEditUserAktif] = useState(1);

  // User Messages State
  const [isMessagesModalOpen, setIsMessagesModalOpen] = useState(false);
  const [messagesData, setMessagesData] = useState([]);
  const [messagesTotalPages, setMessagesTotalPages] = useState(1);
  const [messagesCurrentPage, setMessagesCurrentPage] = useState(1);
  const [messagesStartDate, setMessagesStartDate] = useState('');
  const [messagesEndDate, setMessagesEndDate] = useState('');
  const [messagesUserUsername, setMessagesUserUsername] = useState(null);
  const [messagesUserName, setMessagesUserName] = useState('');

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [sysLogs, setSysLogs] = useState([]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/auth/status');
      const data = await res.json();
      if (data.isAuthenticated) {
        setAuthState('DASHBOARD');
        fetchClients();
      } else if (!data.hasAdmin) {
        setAuthState('REGISTER');
      } else {
        setAuthState('LOGIN');
      }
    } catch (err) {
      console.error('Failed to check auth', err);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAuth = async (e, type) => {
    e.preventDefault();
    if (type === 'REGISTER' && !adminName) return Swal.fire('Error', 'Nama wajib diisi', 'error');
    if (!username || !password || !captcha) return Swal.fire('Error', 'Semua field termasuk Captcha wajib diisi!', 'error');

    if (type === 'REGISTER') {
      const isStrong = password.length >= 8 &&
                       /[A-Z]/.test(password) &&
                       /[a-z]/.test(password) &&
                       /[0-9]/.test(password) &&
                       /[^A-Za-z0-9]/.test(password);
      if (!isStrong) {
        return Swal.fire('Warning', 'Password belum memenuhi semua syarat keamanan!', 'warning');
      }
    }
    
    try {
      const url = type === 'LOGIN' ? '/auth/login' : '/auth/register';
      const bodyParams = type === 'REGISTER' ? { name: adminName, username, password, captcha } : { username, password, captcha };
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyParams)
      });
      const data = await res.json();
      
      if (res.ok) {
        Swal.fire('Sukses', data.message, 'success');
        if (type === 'REGISTER') {
          checkAuth();
        } else {
          if (data.role === 'user') {
            window.location.href = '/user';
          } else {
            setAuthState('DASHBOARD');
            setCurrentTab('DASHBOARD');
            fetchClients();
            fetchUsers();
            fetchStats();
          }
        }
      } else {
        Swal.fire('Error', data.error, 'error');
        setCaptchaKey(Date.now()); // refresh captcha on error
        setCaptcha('');
      }
    } catch (err) {
      Swal.fire('Error', 'Authentication failed', 'error');
      setCaptchaKey(Date.now());
      setCaptcha('');
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Konfirmasi Logout',
      text: 'Apakah Anda yakin ingin keluar dari dasbor admin?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Keluar',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      await fetch('/auth/logout', { method: 'POST' });
      setAuthState('LOGIN');
      setUsername('');
      setPassword('');
      setCurrentTab('DASHBOARD');
    }
  };

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const res = await fetch('/admin/clients');
      const data = await res.json();
      setClients(data);
    } catch (err) {
      console.error(err);
    }
    setLoadingClients(false);
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/admin/logs');
      if (res.ok) {
        const data = await res.json();
        setSysLogs(data.logs);
      }
    } catch (err) {}
  };

  useEffect(() => {
    let interval;
    if (authState === 'DASHBOARD') {
      fetchLogs();
      interval = setInterval(fetchLogs, 5000);
    }
    return () => clearInterval(interval);
  }, [authState]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/admin/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
    setLoadingUsers(false);
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/admin/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
    setLoadingStats(false);
  };

  useEffect(() => {
    if (authState === 'DASHBOARD') {
      fetchClients();
      fetchUsers();
      fetchStats();
    }
  }, [authState]);

  const handleRegisterUser = async (e) => {
    e.preventDefault();
    if (!userName || !userUsername || !userPassword) return Swal.fire('Warning', 'Nama, Username, dan Password wajib diisi!', 'warning');
    
    try {
      const res = await fetch('/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, username: userUsername, password: userPassword })
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire('Sukses', `User berhasil ditambahkan!\nToken: ${data.user.token}\nSecret: ${data.user.secret}`, 'success');
        setUserName('');
        setUserUsername('');
        setUserPassword('');
        setIsAddUserModalOpen(false);
        fetchUsers();
      } else {
        Swal.fire('Error', data.error, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal mendaftarkan user', 'error');
    }
  };

  const openEditUser = (user) => {
    setEditUserUsername(user.username);
    setEditUserName(user.name);
    setEditUserPassword('');
    setEditUserAktif(user.aktif !== undefined ? user.aktif : 1);
    setIsEditUserModalOpen(true);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!editUserName) return Swal.fire('Warning', 'Nama wajib diisi!', 'warning');
    
    try {
      const res = await fetch(`/admin/users/${editUserUsername}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editUserName, password: editUserPassword || undefined, aktif: editUserAktif })
      });
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Respons server tidak valid (apakah server sudah di-restart?).');
      }

      if (res.ok) {
        Swal.fire('Sukses', 'Data User berhasil diubah!', 'success');
        setIsEditUserModalOpen(false);
        fetchUsers();
      } else {
        Swal.fire('Error', data.error || 'Gagal mengubah user', 'error');
      }
    } catch (err) {
      Swal.fire('Error', err.message || 'Terjadi kesalahan sistem', 'error');
    }
  };

  const fetchUserMessages = async (userUsername, userName, page = 1, start = '', end = '') => {
    try {
      const url = `/admin/users/${userUsername}/messages?page=${page}&limit=10&startDate=${start}&endDate=${end}`;
      const res = await fetch(url);
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Respons server tidak valid (kemungkinan besar server belum di-restart).');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengambil pesan dari server');
      }
      
      setMessagesData(data.messages || []);
      setMessagesTotalPages(data.totalPages || 1);
      setMessagesCurrentPage(data.currentPage || 1);
      setMessagesUserUsername(userUsername);
      setMessagesUserName(userName);
      setMessagesStartDate(start);
      setMessagesEndDate(end);
      setCurrentTab('USER_MESSAGES');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'Gagal memuat pesan', 'error');
    }
  };

  const handleResetAPI = async (userUsername) => {
    const result = await Swal.fire({
      title: 'Reset API Kredensial?',
      text: "Token dan Secret lama tidak akan bisa digunakan lagi!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Reset!'
    });
    
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/admin/users/${userUsername}/reset`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        Swal.fire('Sukses', 'Kredensial API berhasil direset.', 'success');
        fetchUsers();
      } else {
        Swal.fire('Error', data.error, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal mereset API', 'error');
    }
  };

  const handleActivateWA = async (userUsername) => {
    try {
      const res = await fetch(`/admin/users/${userUsername}/activate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        Swal.fire('Sukses', 'WA berhasil diaktifkan! Silakan Scan QR untuk menghubungkan.', 'success');
        fetchUsers();
        fetchStats();
      } else {
        Swal.fire('Error', data.error, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal mengaktifkan WA', 'error');
    }
  };

  const handleDeleteUser = async (username) => {
    const result = await Swal.fire({
      title: 'Hapus User?',
      text: "User beserta seluruh client WA miliknya akan ikut terhapus!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!'
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/admin/users/${username}`, { method: 'DELETE' });
      if (res.ok) {
         fetchUsers();
         fetchStats();
      }
    } catch (err) {}
  };

  const handleDisconnectWA = async (username) => {
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
      const res = await fetch(`/admin/users/${username}/wa`, { method: 'DELETE' });
      if (res.ok) {
         Swal.fire('Terhapus!', 'Koneksi WA telah diputus.', 'success');
         fetchUsers();
         fetchStats();
      }
    } catch (err) {}
  };

  const handleScanQR = async (username) => {
    Swal.fire({
      title: 'Memuat QR Code...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const res = await fetch(`/client/${username}/qr/json`);
      const data = await res.json();
      
      if (data.connected) {
        Swal.fire('Info', 'WhatsApp sudah terhubung.', 'info');
        fetchUsers();
      } else if (data.qr) {
        Swal.fire({
          title: `Scan QR Code (${username})`,
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

  if (authState === 'LOADING') {
    return <div style={{textAlign: 'center', marginTop: '50px'}}><h2>Loading...</h2></div>;
  }

  if (authState === 'LOGIN' || authState === 'REGISTER') {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto' }}>
        <div className="card">
          <h2 style={{textAlign: 'center', marginBottom: '20px'}}>
            {authState === 'REGISTER' ? 'Daftar Admin Baru' : 'Login Sistem'}
          </h2>
          {authState === 'REGISTER' && (
            <p style={{color: '#64748b', fontSize: '14px', marginBottom: '15px'}}>
              Belum ada admin terdaftar. Silakan buat akun admin pertama Anda.
            </p>
          )}
          <form onSubmit={(e) => handleAuth(e, authState)}>
            {authState === 'REGISTER' && (
              <div className="form-group">
                <input type="text" placeholder="Nama Lengkap" value={adminName} onChange={e => setAdminName(e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="form-group">
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              {authState === 'REGISTER' && (
                <ul style={{ fontSize: '12px', listStyleType: 'none', paddingLeft: 0, marginTop: '8px', color: '#64748b' }}>
                  <li style={{ color: password.length >= 8 ? 'var(--success)' : 'inherit' }}>
                    {password.length >= 8 ? '✓' : '○'} Minimal 8 karakter
                  </li>
                  <li style={{ color: /[A-Z]/.test(password) ? 'var(--success)' : 'inherit' }}>
                    {/[A-Z]/.test(password) ? '✓' : '○'} Minimal 1 huruf kapital
                  </li>
                  <li style={{ color: /[a-z]/.test(password) ? 'var(--success)' : 'inherit' }}>
                    {/[a-z]/.test(password) ? '✓' : '○'} Minimal 1 huruf kecil
                  </li>
                  <li style={{ color: /[0-9]/.test(password) ? 'var(--success)' : 'inherit' }}>
                    {/[0-9]/.test(password) ? '✓' : '○'} Minimal 1 angka
                  </li>
                  <li style={{ color: /[^A-Za-z0-9]/.test(password) ? 'var(--success)' : 'inherit' }}>
                    {/[^A-Za-z0-9]/.test(password) ? '✓' : '○'} Minimal 1 karakter spesial (@, #, $, dll)
                  </li>
                </ul>
              )}
            </div>
            
            <div className="form-group" style={{ textAlign: 'center' }}>
              <img src={`/auth/captcha?v=${captchaKey}`} alt="captcha" onClick={() => setCaptchaKey(Date.now())} style={{ cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: '4px' }} title="Klik untuk refresh" />
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Klik gambar untuk me-refresh captcha</div>
              <input type="text" placeholder="Masukkan Captcha" value={captcha} onChange={e => setCaptcha(e.target.value)} />
            </div>

            <button type="submit" className="btn btn-success" style={{width: '100%'}}>
              {authState === 'REGISTER' ? 'Daftar & Buat Akun' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Helper for Breadcrumb title
  const getTabTitle = () => {
    switch (currentTab) {
      case 'DASHBOARD': return 'Ringkasan Dashboard';
      case 'USER': return 'Manajemen User & WA';
      case 'API': return 'Panduan Penggunaan API';
      case 'LOGS': return 'Sistem Log';
      default: return '';
    }
  };

  // Dashboard View
  return (
    <div className="app-container">
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      {/* SIDEBAR */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>WA Admin</h2>
        </div>
        
        <nav style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => { setCurrentTab('DASHBOARD'); fetchStats(); setIsSidebarOpen(false); }} 
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: currentTab === 'DASHBOARD' ? '#2563eb' : 'transparent', color: currentTab === 'DASHBOARD' ? '#fff' : '#cbd5e1', fontWeight: '500', transition: 'all 0.2s' }}
          >
            Dashboard
          </button>
          <button 
            onClick={() => { setCurrentTab('USER'); setIsSidebarOpen(false); }} 
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: currentTab === 'USER' ? '#2563eb' : 'transparent', color: currentTab === 'USER' ? '#fff' : '#cbd5e1', fontWeight: '500', transition: 'all 0.2s' }}
          >
            User
          </button>

          <button 
            onClick={() => { setCurrentTab('API'); setIsSidebarOpen(false); }} 
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: currentTab === 'API' ? '#2563eb' : 'transparent', color: currentTab === 'API' ? '#fff' : '#cbd5e1', fontWeight: '500', transition: 'all 0.2s' }}
          >
            Panduan API
          </button>

          <button 
            onClick={() => { setCurrentTab('LOGS'); fetchLogs(); setIsSidebarOpen(false); }} 
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: currentTab === 'LOGS' ? '#2563eb' : 'transparent', color: currentTab === 'LOGS' ? '#fff' : '#cbd5e1', fontWeight: '500', transition: 'all 0.2s' }}
          >
            Log Sistem
          </button>
        </nav>

        <div style={{ padding: '24px 16px', borderTop: '1px solid #1e293b' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {/* TOP NAVBAR (Breadcrumb) */}
        <header style={{ backgroundColor: '#fff', padding: '20px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center' }}>
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>☰</button>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: '500' }}>
            <span style={{ color: '#94a3b8' }}>Halaman / </span> {getTabTitle()}
          </h2>
        </header>

        {/* CONTENT AREA */}
        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          {currentTab === 'DASHBOARD' && (
            <div>
              <div className="stats-grid">
                <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderLeft: '4px solid #3b82f6' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jumlah User</h3>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#0f172a' }}>
                    {loadingUsers ? '...' : users.length}
                  </div>
                </div>
                
                <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderLeft: '4px solid #f59e0b' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pesan Belum Terkirim</h3>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#0f172a' }}>{loadingStats ? '...' : stats.pendingMessages}</div>
                </div>

                <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderLeft: '4px solid #10b981' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pesan Terkirim</h3>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#0f172a' }}>{loadingStats ? '...' : stats.sentMessages}</div>
                </div>

                <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', borderLeft: '4px solid #ef4444' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pesan Gagal</h3>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#0f172a' }}>{loadingStats ? '...' : stats.failedMessages}</div>
                </div>
              </div>

              <div className="card" style={{ padding: '32px' }}>
                <h2>Selamat Datang di WhatsApp Sender Admin!</h2>
                <p style={{ color: '#475569', lineHeight: '1.6' }}>Sistem ini memantau pengiriman pesan massal API Anda. Panduan penggunaan:<br/>
                  1. Masuk ke menu <strong>Manajemen User</strong> dan buat akun pelanggan baru.<br/>
                  2. Berikan <strong>Username</strong> dan <strong>Password</strong> tersebut kepada pelanggan Anda.<br/>
                  3. Pelanggan dapat <strong>Login</strong> menggunakan akun tersebut untuk memindai <strong>QR Code WA</strong> mereka sendiri di dashboard khusus User.<br/>
                  4. Pelanggan akan mendapatkan <strong>Token</strong>, <strong>Secret</strong>, dan panduan API secara otomatis di dashboard mereka.
                </p>
              </div>
            </div>
          )}

          {currentTab === 'LOGS' && (
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0 }}>Terminal Log Sistem</h2>
                <button className="btn btn-primary" onClick={fetchLogs}>Refresh Log</button>
              </div>
              <div style={{ backgroundColor: '#0f172a', color: '#10b981', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', flex: 1, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {sysLogs.length === 0 ? 'Menunggu log...' : sysLogs.map((l, i) => (
                  <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '2px 0' }}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTab === 'USER' && (
            <>
              {isAddUserModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                  <div className="card" style={{ width: '100%', maxWidth: '400px', margin: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ margin: 0 }}>Tambah User Baru</h2>
                      <button onClick={() => setIsAddUserModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
                    </div>
                    <p style={{ color: '#64748b', marginBottom: '16px', fontSize: '14px' }}>Token API dan Secret akan digenerate otomatis.</p>
                    <form onSubmit={handleRegisterUser}>
                      <div className="form-group">
                        <input type="text" placeholder="Nama Lengkap User" value={userName} onChange={e => setUserName(e.target.value)} autoFocus />
                      </div>
                      <div className="form-group">
                        <input type="text" placeholder="Username (Untuk Login User)" value={userUsername} onChange={e => setUserUsername(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <input type="password" placeholder="Password User" value={userPassword} onChange={e => setUserPassword(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="btn btn-danger" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>Batal</button>
                        <button type="submit" className="btn btn-primary">Simpan User</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {isEditUserModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                  <div className="card" style={{ width: '100%', maxWidth: '400px', margin: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ margin: 0 }}>Ubah Data User</h2>
                      <button onClick={() => setIsEditUserModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
                    </div>
                    <form onSubmit={handleEditUser}>
                      <div className="form-group">
                        <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: '#64748b'}}>Nama Lengkap</label>
                        <input type="text" placeholder="Nama Lengkap User" value={editUserName} onChange={e => setEditUserName(e.target.value)} autoFocus />
                      </div>
                      <div className="form-group">
                        <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: '#64748b'}}>Ganti Password (Opsional)</label>
                        <input type="password" placeholder="Kosongkan jika tidak ingin mengubah password" value={editUserPassword} onChange={e => setEditUserPassword(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: '#64748b'}}>Status Akun</label>
                        <select 
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          value={editUserAktif} 
                          onChange={e => setEditUserAktif(parseInt(e.target.value))}
                        >
                          <option value={1}>Aktif</option>
                          <option value={0}>Tidak Aktif</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setIsEditUserModalOpen(false)} className="btn btn-danger" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>Batal</button>
                        <button type="submit" className="btn btn-primary">Simpan Perubahan</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <h2 style={{ margin: 0 }}>Daftar User & Akses WA</h2>
                  <button onClick={() => setIsAddUserModalOpen(true)} className="btn btn-success">+ Tambah User Baru</button>
                </div>
                {loadingUsers ? <p>Loading users...</p> : (
                  <div className="table-responsive">
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Nama User</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Username</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Kredensial API</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Status WA</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Aksi User</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => {
                          const isActive = u.waStatus && u.waStatus !== 'DISCONNECTED';
                          return (
                            <tr key={u.username} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '12px' }}>
                                <div style={{ fontWeight: '600', color: '#0f172a' }}>{u.name}</div>
                                <div style={{ marginTop: '4px' }}>
                                  {u.aktif === 0 ? (
                                    <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>Tidak Aktif</span>
                                  ) : (
                                    <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>Aktif</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px', color: '#475569' }}>
                                {u.username ? u.username : '-'}
                              </td>
                              <td style={{ padding: '12px' }}>
                                <div style={{ marginBottom: '4px' }}>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>Token: </span>
                                  <code style={{background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#334155'}}>{u.token || '-'}</code>
                                </div>
                                <div>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>Secret: </span>
                                  <code style={{background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#334155'}}>{u.secret || '-'}</code>
                                </div>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <div>
                                  <span style={{ 
                                    fontSize: '14px', fontWeight: '500',
                                    color: u.waStatus === 'CONNECTED' ? '#166534' : '#991b1b'
                                  }}>
                                    {u.waStatus === 'CONNECTED' ? 'Terkoneksi' : (u.waStatus === 'CONNECTING' ? 'Menghubungkan...' : 'Tidak Terhubung')}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px', verticalAlign: 'top' }}>
                                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                  <button className="btn btn-success" onClick={() => fetchUserMessages(u.username, u.name, 1, '', '')} style={{padding: '6px 12px', fontSize: '12px', backgroundColor: '#10b981', border: 'none'}}>Lihat Pesan</button>
                                  <button className="btn btn-primary" onClick={() => openEditUser(u)} style={{padding: '6px 12px', fontSize: '12px'}}>Ubah Data</button>
                                  <button className="btn btn-primary" onClick={() => handleResetAPI(u.username)} style={{padding: '6px 12px', fontSize: '12px', backgroundColor: '#f59e0b', border: 'none'}}>Reset Token & Secret</button>
                                  {(!u._count || u._count.messages === 0) && (
                                    <button className="btn btn-danger" onClick={() => handleDeleteUser(u.username)} style={{padding: '6px 12px', fontSize: '12px', backgroundColor: '#ef4444', border: 'none', color: '#fff'}}>Hapus User</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {users.length === 0 && (
                          <tr><td colSpan={4} style={{textAlign: 'center', padding: '24px', color: '#64748b'}}>Belum ada User terdaftar.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}


          {currentTab === 'API' && (
            <div className="card">
              <h2 style={{ marginBottom: '16px' }}>Panduan Penggunaan API</h2>
              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <p style={{ marginBottom: '8px' }}>Gunakan endpoint berikut untuk mengirim pesan via API ke nomor HP:</p>
                <code style={{ display: 'block', backgroundColor: '#1e293b', color: '#e2e8f0', padding: '12px', borderRadius: '4px', marginBottom: '8px', wordWrap: 'break-word' }}>
                  POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/send
                </code>
                <p style={{ marginBottom: '8px' }}>Atau gunakan endpoint khusus untuk mengirim ke Grup (JID):</p>
                <code style={{ display: 'block', backgroundColor: '#1e293b', color: '#e2e8f0', padding: '12px', borderRadius: '4px', marginBottom: '16px', wordWrap: 'break-word' }}>
                  POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/send-group
                </code>
                <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Headers:</p>
                <pre style={{ backgroundColor: '#1e293b', color: '#e2e8f0', padding: '12px', borderRadius: '4px', marginBottom: '16px', overflowX: 'auto' }}>
{`Content-Type: application/json`}
                </pre>
                <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Body (JSON):</p>
                <pre style={{ backgroundColor: '#1e293b', color: '#e2e8f0', padding: '12px', borderRadius: '4px', overflowX: 'auto' }}>
{`// Untuk /api/send
{
  "username": "USERNAME_MILIK_USER",
  "token": "TOKEN_MILIK_USER",
  "secret": "SECRET_MILIK_USER",
  "no_hp": "6281234567890",
  "isi": "Halo, ini pesan dari API!"
}

// Untuk /api/send-group
{
  "username": "USERNAME_MILIK_USER",
  "token": "TOKEN_MILIK_USER",
  "secret": "SECRET_MILIK_USER",
  "jid": "123456789@g.us",
  "isi": "Halo, ini pesan dari API untuk Grup!"
}`}
                </pre>
                
                <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Contoh Penggunaan dengan cURL:</p>
                <pre style={{ backgroundColor: '#1e293b', color: '#60a5fa', padding: '12px', borderRadius: '4px', marginBottom: '16px', overflowX: 'auto' }}>
{`# Mengirim ke Nomor HP
curl -X POST ${typeof window !== 'undefined' ? window.location.origin : ''}/api/send \\
-H "Content-Type: application/json" \\
-d '{
  "username": "USERNAME_MILIK_USER",
  "token": "TOKEN_MILIK_USER",
  "secret": "SECRET_MILIK_USER",
  "no_hp": "6281234567890",
  "isi": "Halo, ini pesan dari API!"
}'

# Mengirim ke Grup (JID)
curl -X POST ${typeof window !== 'undefined' ? window.location.origin : ''}/api/send-group \\
-H "Content-Type: application/json" \\
-d '{
  "username": "USERNAME_MILIK_USER",
  "token": "TOKEN_MILIK_USER",
  "secret": "SECRET_MILIK_USER",
  "jid": "12345678912@g.us",
  "isi": "Halo, ini pesan untuk Grup!"
}'`}
                </pre>

                <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Contoh Penggunaan dengan PHP:</p>
                <pre style={{ backgroundColor: '#1e293b', color: '#a78bfa', padding: '12px', borderRadius: '4px', overflowX: 'auto' }}>
{`<?php
// === CONTOH MENGIRIM KE NOMOR HP ===
$curl = curl_init();
$payload = json_encode(array(
  "username" => "USERNAME_MILIK_USER",
  "token" => "TOKEN_MILIK_USER",
  "secret" => "SECRET_MILIK_USER",
  "no_hp" => "6281234567890",
  "isi" => "Halo, ini pesan percobaan dari API!"
));

curl_setopt_array($curl, array(
  CURLOPT_URL => '${typeof window !== 'undefined' ? window.location.origin : ''}/api/send',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_HTTPHEADER => array('Content-Type: application/json'),
));
$response = curl_exec($curl);
curl_close($curl);
echo $response;

// === CONTOH MENGIRIM KE GRUP (JID) ===
$curlGroup = curl_init();
$payloadGroup = json_encode(array(
  "username" => "USERNAME_MILIK_USER",
  "token" => "TOKEN_MILIK_USER",
  "secret": "SECRET_MILIK_USER",
  "jid" => "12345678912@g.us",
  "isi" => "Halo, ini pesan untuk Grup!"
));

curl_setopt_array($curlGroup, array(
  CURLOPT_URL => '${typeof window !== 'undefined' ? window.location.origin : ''}/api/send-group',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $payloadGroup,
  CURLOPT_HTTPHEADER => array('Content-Type: application/json'),
));
$responseGroup = curl_exec($curlGroup);
curl_close($curlGroup);
echo $responseGroup;
?>`}
                </pre>

                <h3 style={{ marginTop: '24px', marginBottom: '16px', fontSize: '18px' }}>Contoh Respons</h3>
                
                <h4 style={{ fontSize: '14px', color: '#475569', marginBottom: '8px' }}>Jika Sukses (HTTP 200)</h4>
                <pre style={{ backgroundColor: '#1e293b', color: '#86efac', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
{`{
  "message": "Message queued successfully",
  "scheduled_for": "2024-05-20T10:30:00.000Z",
  "data": {
    "id": 1234,
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

          {currentTab === 'USER_MESSAGES' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setCurrentTab('USER')} className="btn btn-danger" style={{ backgroundColor: '#64748b', padding: '8px 16px' }}>
                    &laquo; Kembali
                  </button>
                  <h2 style={{ margin: 0 }}>Pesan WA - {messagesUserName}</h2>
                </div>
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
                <button className="btn btn-primary" onClick={() => fetchUserMessages(messagesUserUsername, messagesUserName, 1, messagesStartDate, messagesEndDate)}>Terapkan Filter</button>
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
                      <tr><td colSpan={4} style={{textAlign: 'center', padding: '24px', color: '#64748b'}}>Tidak ada pesan ditemukan pada filter ini.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {messagesTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', marginTop: 'auto', paddingTop: '16px' }}>
                  <button 
                    className="btn btn-primary" 
                    disabled={messagesCurrentPage === 1}
                    onClick={() => fetchUserMessages(messagesUserUsername, messagesUserName, messagesCurrentPage - 1, messagesStartDate, messagesEndDate)}
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
                    onClick={() => fetchUserMessages(messagesUserUsername, messagesUserName, messagesCurrentPage + 1, messagesStartDate, messagesEndDate)}
                    style={{ padding: '6px 12px', backgroundColor: messagesCurrentPage === messagesTotalPages ? '#cbd5e1' : undefined }}
                  >
                    Next &raquo;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
