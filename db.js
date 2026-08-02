const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const initDB = async () => {
  try {
    await prisma.$connect();
    console.log('Prisma Database connected');
  } catch (error) {
    console.error('Error connecting to database', error);
  }
};

module.exports = { prisma, initDB };
