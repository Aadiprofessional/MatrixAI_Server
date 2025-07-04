import app from '../../src/app.js';

// Cloudflare Pages Functions expects named exports for HTTP methods
export const onRequest = async (context) => {
  // Pass the execution context properly to make waitUntil available
  return app.fetch(context.request, context.env, context.executionCtx || context);
}; 