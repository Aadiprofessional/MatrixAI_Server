import { Hono } from 'hono';
import { cors } from 'hono/cors';
import audioRoutes from './routes/audioRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://your-frontend-domain.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'MatrixAI Server',
    version: '1.0.0'
  });
});

// API info endpoint
app.get('/api', (c) => {
  return c.json({
    service: 'MatrixAI Server API',
    version: '1.0.0',
    endpoints: {
      audio: '/api/audio/*',
      user: '/api/user/*',
      health: '/health'
    },
    documentation: 'https://github.com/your-username/MatrixAI_Server'
  });
});

// Register route modules
app.route('/api/audio', audioRoutes);
app.route('/api/user', userRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ 
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: ['/health', '/api', '/api/audio/*', '/api/user/*']
  }, 404);
});

export default app; 