require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const { initAllSessions } = require('./whatsapp');
const { startCron } = require('./cron');
const routes = require('./routes');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve a simple static admin interface
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);

const startServer = async () => {
  try {
    await initDB();
    console.log('Initializing existing WhatsApp sessions...');
    await initAllSessions();
    startCron();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Admin UI accessible at http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();
