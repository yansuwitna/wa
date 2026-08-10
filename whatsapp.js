const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { prisma } = require('./db');
const { EventEmitter } = require('events');

const waEvents = new EventEmitter();

const sessions = new Map();
const qrCodes = new Map();

const initializeSession = async (username) => {
  const sessionDir = path.join(__dirname, 'sessions', username);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }), // Hide baileys noisy logs
    browser: ['WA Sender API', 'Chrome', '1.0.0']
  });

  sessions.set(username, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`QR Code received for user ${username}`);
      try {
        const qrImage = await qrcode.toDataURL(qr);
        qrCodes.set(username, qrImage);
      } catch (err) {
        console.error('Failed to generate QR code', err);
      }
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log(`User ${username} connection closed due to error, reconnecting: ${shouldReconnect}`);
      
      if (shouldReconnect) {
        initializeSession(username);
      } else {
        console.log(`User ${username} was logged out`);
        sessions.delete(username);
        qrCodes.delete(username);
        await prisma.user.update({
          where: { username },
          data: { waStatus: 'DISCONNECTED' }
        });
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } else if (connection === 'open') {
      console.log(`User ${username} is ready!`);
      qrCodes.delete(username);
      await prisma.user.update({
        where: { username },
        data: { waStatus: 'CONNECTED' }
      });
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (m.type === 'notify' && msg.key.remoteJid && msg.key.remoteJid.endsWith('@g.us')) {
        let groupName = 'Unknown Group';
        try {
          const metadata = await sock.groupMetadata(msg.key.remoteJid);
          groupName = metadata.subject;
        } catch(e) {}
        
        waEvents.emit(`group-message-${username}`, {
          jid: msg.key.remoteJid,
          name: groupName
        });
      }
    } catch (err) {
      console.error('Error handling messages.upsert', err);
    }
  });
};

const getSession = (username) => {
  return sessions.get(username);
};

const disconnectSession = (username) => {
  const sock = sessions.get(username);
  if (sock) {
    try { sock.logout(); } catch (e) {}
  }
  sessions.delete(username);
  qrCodes.delete(username);
  const sessionDir = path.join(__dirname, 'sessions', username);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
};

const getQrCode = (username) => {
  return qrCodes.get(username);
};

const initAllSessions = async () => {
  if (!fs.existsSync(path.join(__dirname, 'sessions'))) {
    fs.mkdirSync(path.join(__dirname, 'sessions'));
  }

  const users = await prisma.user.findMany({
    where: { waStatus: { not: 'DISCONNECTED' } }
  });
  
  for (const user of users) {
    await initializeSession(user.username);
  }
};

module.exports = {
  initializeSession,
  getSession,
  disconnectSession,
  getQrCode,
  initAllSessions,
  waEvents
};
