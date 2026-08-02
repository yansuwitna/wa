require('dotenv').config();
const { parse } = require('url');
const next = require('next');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { initDB } = require('./db');
const { initAllSessions } = require('./whatsapp');
const { startCron } = require('./cron');
const apiRoutes = require('./routes');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3000;

app.prepare().then(async () => {
  try {
    // Initialize Database and Background Jobs
    await initDB();
    console.log('Database initialized.');
    
    console.log('Initializing WhatsApp sessions...');
    await initAllSessions();
    
    console.log('Starting Cron job...');
    startCron();

    // Create Express server
    const server = express();
    server.use(cors());
    server.use(express.json());
    server.use(express.urlencoded({ extended: true }));
    server.use(cookieParser());

    // Mount API Routes (Admin / WhatsApp Send / Auth)
    server.use('/', apiRoutes);

    // Let Next.js handle all other routes (Frontend Pages)
    server.all('*', (req, res) => {
      const parsedUrl = parse(req.url, true);
      return handle(req, res, parsedUrl);
    });

    server.listen(PORT, (err) => {
      if (err) throw err;
      console.log(`> Server ready on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
});
