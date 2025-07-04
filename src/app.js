import { Hono } from 'hono';
import { cors } from 'hono/cors';
import audioRoutes from './routes/audioRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { AudioTranscriptionProcessor } from './durableObjects/AudioTranscriptionProcessor.js';

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
      video: '/api/video/*',
      user: '/api/user/*',
      admin: '/api/admin/*',
      health: '/health'
    },
    documentation: 'https://github.com/your-username/MatrixAI_Server'
  });
});

// Register route modules
app.route('/api/audio', audioRoutes);
app.route('/api/video', videoRoutes);
app.route('/api/user', userRoutes);
app.route('/api/admin', adminRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ 
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: ['/health', '/api', '/api/audio/*', '/api/video/*', '/api/user/*', '/api/admin/*']
  }, 404);
});

// Export Durable Object for background processing
export { AudioTranscriptionProcessor };

export default app; 