const cron = require('node-cron');
const { prisma } = require('./db');
const { getSession } = require('./whatsapp');

let isRunning = false;

// Runs every 10 seconds
const startCron = () => {
  cron.schedule('*/10 * * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    
    try {
      const now = new Date();
      
      const pendingMessages = await prisma.message.findMany({
        where: {
          status: 'PENDING',
          send_at: {
            lte: now
          },
          user: {
            waStatus: 'CONNECTED',
            aktif: 1
          }
        },
        include: {
          user: true
        }
      });

      if (pendingMessages.length === 0) return;

      console.log(`Found ${pendingMessages.length} pending messages to send.`);

      for (const msg of pendingMessages) {
        if (!msg.user) continue;
        
        const waClient = getSession(msg.userUsername);
        
        // Ensure client is ready and connected
        if (waClient && msg.user.waStatus === 'CONNECTED') {
          try {
            const formattedNumber = msg.target_no.includes('@s.whatsapp.net') ? msg.target_no : `${msg.target_no}@s.whatsapp.net`;
            
            await waClient.sendMessage(formattedNumber, { text: msg.message });
            await prisma.message.update({
              where: { id: msg.id },
              data: { status: 'SENT' }
            });
            console.log(`Message sent to ${msg.target_no} via User ${msg.userUsername}`);
            
            // Wait a random amount of time (2-5 seconds) between sending messages
            const delay = Math.floor(Math.random() * 3000) + 2000;
            await new Promise(resolve => setTimeout(resolve, delay));
          } catch (error) {
            console.error(`Failed to send message ID ${msg.id}`, error);
            await prisma.message.update({
              where: { id: msg.id },
              data: { status: 'FAILED' }
            });
          }
        } else {
          console.log(`User ${msg.userUsername} is disconnected or not ready. Skipping message ID ${msg.id}.`);
        }
      }
    } catch (error) {
      console.error('Error in cron job', error);
    } finally {
      isRunning = false;
    }
  });
  console.log('Cron job started');
};

module.exports = { startCron };
