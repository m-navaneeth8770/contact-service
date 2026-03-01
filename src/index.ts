import express, { Application, Request, Response } from 'express';
import morgan from 'morgan';
import prisma from './lib/prisma';
import contactRoutes from './routes/contact';
import { errorHandler } from './middleware/errorHandler';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json());

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Routes
app.use('/api', contactRoutes);

// Global error handler — must be last
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
  console.log(`[ENV] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.message);
  process.exit(1);
});

export default app;