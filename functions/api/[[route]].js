import app from '../../src/app.js';

// Cloudflare Pages Functions expects named exports for HTTP methods
export const onRequest = app.fetch; 