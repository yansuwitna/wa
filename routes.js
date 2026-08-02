const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');
const { prisma } = require('./db');
const { initializeSession, getQrCode, disconnectSession, getSession } = require('./whatsapp');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Middleware to check authentication for admin routes
const checkAuth = (req, res, next) => {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', code: 'NO_TOKEN' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
};

// Middleware to check authentication for user routes
const checkUserAuth = (req, res, next) => {
  const token = req.cookies.user_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', code: 'NO_TOKEN' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userAuth = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
};

// Helper to verify CAPTCHA
const verifyCaptcha = (req) => {
  const token = req.cookies.captcha_token;
  const userCaptcha = req.body.captcha;
  if (!token || !userCaptcha) return false;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.text === userCaptcha.toLowerCase();
  } catch (e) {
    return false;
  }
};

// --- AUTHENTICATION ROUTES ---

router.get('/auth/status', async (req, res) => {
  const adminCount = await prisma.admin.count();
  const token = req.cookies.admin_token;
  let isAuthenticated = false;

  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      isAuthenticated = true;
    } catch (err) {}
  }

  res.json({
    hasAdmin: adminCount > 0,
    isAuthenticated
  });
});

router.get('/auth/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 5,
    ignoreChars: '0o1il',
    noise: 2,
    color: true,
    background: '#f8fafc'
  });

  const captchaToken = jwt.sign({ text: captcha.text.toLowerCase() }, JWT_SECRET, { expiresIn: '5m' });
  
  res.cookie('captcha_token', captchaToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 5 * 60 * 1000 // 5 mins
  });

  res.type('svg');
  res.status(200).send(captcha.data);
});

router.post('/auth/register', async (req, res) => {
  try {
    if (!verifyCaptcha(req)) {
      return res.status(400).json({ error: 'CAPTCHA tidak valid atau sudah kadaluarsa.' });
    }

    // Only allow registration if no admin exists
    const adminCount = await prisma.admin.count();
    if (adminCount > 0) {
      return res.status(403).json({ error: 'Admin already exists. Please login.' });
    }

    const { name, username, password } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Name, username, and password required' });
    }

    const isStrong = password.length >= 8 &&
                     /[A-Z]/.test(password) &&
                     /[a-z]/.test(password) &&
                     /[0-9]/.test(password) &&
                     /[^A-Za-z0-9]/.test(password);

    if (!isStrong) {
      return res.status(400).json({ error: 'Password tidak memenuhi kriteria keamanan.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.admin.create({
      data: { name, username, password: hashedPassword }
    });

    res.clearCookie('captcha_token');
    res.json({ message: 'Admin registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    if (!verifyCaptcha(req)) {
      return res.status(400).json({ error: 'CAPTCHA tidak valid atau sudah kadaluarsa.' });
    }

    const { username, password } = req.body;
    
    // Coba sebagai Admin
    const admin = await prisma.admin.findUnique({ where: { username } });
    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Username atau password salah' });
      }
      const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '1d' });
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });
      res.clearCookie('captcha_token');
      return res.json({ message: 'Logged in successfully', role: 'admin' });
    }

    // Coba sebagai User
    const user = await prisma.user.findUnique({ where: { username } });
    if (user) {
      if (user.aktif === 0) {
        return res.status(401).json({ error: 'Akun Anda dinonaktifkan' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Username atau password salah' });
      }
      const jwtToken = jwt.sign({ username: user.username, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('user_token', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      res.clearCookie('captcha_token');
      return res.json({ message: 'Logged in successfully', role: 'user' });
    }

    // Tidak ditemukan di mana-mana
    return res.status(401).json({ error: 'Username atau password salah' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ message: 'Logged out' });
});

// --- USER AUTHENTICATION ROUTES ---

router.get('/auth/user/status', (req, res) => {
  const token = req.cookies.user_token;
  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      return res.json({ isAuthenticated: true });
    } catch (err) {}
  }
  res.json({ isAuthenticated: false });
});

router.post('/auth/user/logout', (req, res) => {
  res.clearCookie('user_token');
  res.json({ message: 'Logged out' });
});

router.get('/user/me', checkUserAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.userAuth.username }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/user/stats', checkUserAuth, async (req, res) => {
  try {
    const username = req.userAuth.username;
    
    const pending = await prisma.message.count({ where: { userUsername: username, status: 'PENDING' } });
    const sent = await prisma.message.count({ where: { userUsername: username, status: 'SENT' } });
    const failed = await prisma.message.count({ where: { userUsername: username, status: 'FAILED' } });

    res.json({
      pending,
      sent,
      failed,
      processed: sent + failed
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Activate WA route
router.post('/user/activate', checkUserAuth, async (req, res) => {
  try {
    const username = req.userAuth.username;
    const user = await prisma.user.findUnique({ where: { username } });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.waStatus === 'CONNECTED' || user.waStatus === 'CONNECTING') {
      return res.status(400).json({ error: 'WhatsApp is already active' });
    }

    await prisma.user.update({
      where: { username },
      data: { waStatus: 'CONNECTING' }
    });
    
    await initializeSession(username);

    res.json({ message: 'WA berhasil diaktifkan' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/user/client', checkUserAuth, async (req, res) => {
  try {
    const username = req.userAuth.username;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.waStatus === 'DISCONNECTED') return res.status(404).json({ error: 'No active WA connection found' });

    await prisma.user.update({ where: { username }, data: { waStatus: 'DISCONNECTED' } });
    disconnectSession(username);
    res.json({ message: 'Koneksi WA telah diputus' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/user/reset-api', checkUserAuth, async (req, res) => {
  try {
    const username = req.userAuth.username;
    const newToken = require('crypto').randomBytes(16).toString('hex');
    const newSecret = require('crypto').randomBytes(32).toString('hex');
    
    await prisma.user.update({
      where: { username },
      data: { token: newToken, secret: newSecret }
    });
    
    res.json({ message: 'Kredensial API berhasil di-reset', token: newToken, secret: newSecret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/user/messages', checkUserAuth, async (req, res) => {
  try {
    const username = req.userAuth.username;
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let whereClause = {
      userUsername: username
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const total = await prisma.message.count({ where: whereClause });
    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum
    });

    res.json({
      messages,
      total,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN ROUTES (Protected) ---

router.get('/admin/stats', checkAuth, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { waStatus: 'CONNECTED' } });
    const pendingMessages = await prisma.message.count({ where: { status: 'PENDING' } });
    const sentMessages = await prisma.message.count({ where: { status: 'SENT' } });
    const failedMessages = await prisma.message.count({ where: { status: 'FAILED' } });

    res.json({
      totalUsers,
      activeUsers,
      pendingMessages,
      sentMessages,
      failedMessages
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// USERS
router.post('/admin/users', checkAuth, async (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Nama, Username, dan Password wajib diisi' });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(16).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({ 
      data: { name, username, password: hashedPassword, token, secret }
    });
    res.json({ message: 'User berhasil ditambahkan', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/admin/users/:username', checkAuth, async (req, res) => {
  try {
    const targetUsername = req.params.username;
    const { name, username: newUsername, password, aktif } = req.body;
    
    const currentUser = await prisma.user.findUnique({ where: { username: targetUsername } });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const updateData = {};
    if (name) updateData.name = name;
    if (newUsername) {
      if (newUsername !== targetUsername) {
        const existing = await prisma.user.findUnique({ where: { username: newUsername } });
        if (existing) {
          return res.status(400).json({ error: 'Username sudah digunakan oleh user lain.' });
        }
        updateData.username = newUsername;
      }
    }
    if (password) updateData.password = await bcrypt.hash(password, 10);
    
    if (aktif !== undefined) {
      const aktifVal = parseInt(aktif);
      updateData.aktif = aktifVal;
      
      if (aktifVal === 0) {
        updateData.token = null;
        updateData.secret = null;
        updateData.waStatus = 'DISCONNECTED';
        disconnectSession(targetUsername);
      } else if (aktifVal === 1) {
        if (!currentUser.token || !currentUser.secret) {
          const crypto = require('crypto');
          updateData.token = crypto.randomBytes(16).toString('hex');
          updateData.secret = crypto.randomBytes(32).toString('hex');
        }
      }
    }

    const user = await prisma.user.update({
      where: { username: targetUsername },
      data: updateData
    });

    res.json({ message: 'User berhasil diubah', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/users/:username/reset', checkAuth, async (req, res) => {
  try {
    const targetUsername = req.params.username;
    
    const crypto = require('crypto');
    const token = crypto.randomBytes(16).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.update({
      where: { username: targetUsername },
      data: { token, secret }
    });

    res.json({ message: 'Token & Secret berhasil direset', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/users', checkAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { messages: true } } }
  });
  res.json(users);
});

router.post('/admin/users/:username/activate', checkAuth, async (req, res) => {
  try {
    const targetUsername = req.params.username;
    const user = await prisma.user.findUnique({ where: { username: targetUsername } });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.waStatus === 'CONNECTED' || user.waStatus === 'CONNECTING') return res.status(400).json({ error: 'User already has an active WA' });

    await prisma.user.update({
      where: { username: targetUsername },
      data: { waStatus: 'CONNECTING' }
    });
    
    await initializeSession(targetUsername);

    res.json({ message: 'WA berhasil diaktifkan' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/users/:username', checkAuth, async (req, res) => {
  try {
    const username = req.params.username;
    disconnectSession(username);
    await prisma.user.delete({ where: { username } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// USERS MESSAGES (Pagination & Date Filter)
router.get('/admin/users/:username/messages', checkAuth, async (req, res) => {
  try {
    const targetUsername = req.params.username;
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = { userUsername: targetUsername };
    
    // Add date filtering if provided
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const [messages, totalData] = await Promise.all([
      prisma.message.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.message.count({ where: whereClause })
    ]);

    res.json({
      messages,
      totalData,
      totalPages: Math.ceil(totalData / limit),
      currentPage: parseInt(page)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/users/:username/wa', checkAuth, async (req, res) => {
    try {
        const targetUsername = req.params.username;
        await prisma.user.update({ where: { username: targetUsername }, data: { waStatus: 'DISCONNECTED' } });
        disconnectSession(targetUsername);
        res.json({ message: 'Client deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/client/:username/qr', async (req, res) => {
  const { username } = req.params;
  const user = await prisma.user.findUnique({ where: { username } });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  if (user.waStatus === 'CONNECTED') {
    return res.send('<h3>Client is already connected.</h3>');
  }

  const qr = getQrCode(username);
  if (qr) {
    res.send(`
        <h3>Scan QR Code for ${user.name}</h3>
        <img src="${qr}" alt="QR Code" />
        <p>Refresh page if QR expires or doesn't appear immediately.</p>
        <script>
            setTimeout(() => location.reload(), 10000); // refresh every 10s
        </script>
    `);
  } else {
    res.send('QR Code not ready or client already connected. Refresh in a few seconds.');
  }
});

router.get('/client/:username/qr/json', async (req, res) => {
  const { username } = req.params;
  const user = await prisma.user.findUnique({ where: { username } });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  if (user.waStatus === 'CONNECTED') {
    return res.json({ connected: true });
  }

  const qr = getQrCode(username);
  if (qr) {
    return res.json({ qr });
  } else {
    return res.json({ pending: true });
  }
});

// --- PUBLIC API ROUTES ---

router.post('/api/send', async (req, res) => {
  try {
    const { username, no_hp, isi, token, secret } = req.body;

    if (!username || !token || !secret) {
      return res.status(401).json({ error: 'Kombinasi username, token, dan secret salah' });
    }

    // Cari user berdasarkan username
    const user = await prisma.user.findUnique({ 
        where: { username }
    });
    
    if (!user || user.token !== token || user.secret !== secret) {
      return res.status(401).json({ error: 'Kombinasi username, token, dan secret salah' });
    }

    if (user.aktif === 0) {
      return res.status(403).json({ error: 'Akun user dinonaktifkan' });
    }

    // Normalisasi Nomor Handphone
    let target_no = no_hp.replace(/\D/g, ''); // Hapus semua karakter non-angka
    if (target_no.startsWith('0')) {
        target_no = '62' + target_no.substring(1);
    } else if (target_no.startsWith('8')) {
        target_no = '62' + target_no;
    } else if (target_no.startsWith('620')) {
        target_no = '62' + target_no.substring(3);
    }

    const sendAt = new Date();

    const message = await prisma.message.create({
      data: {
        userUsername: user.username,
        target_no: target_no,
        message: isi,
        send_at: sendAt,
        status: 'PENDING'
      }
    });

    res.json({ 
        message: 'Message queued successfully', 
        scheduled_for: sendAt,
        data: {
            id: message.id,
            target: message.target_no,
            status: message.status
        }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
