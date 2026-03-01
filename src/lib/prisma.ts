import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Log all queries in development
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e) => {
    console.log(`[QUERY] ${e.query} — ${e.duration}ms`);
  });
}

export default prisma;