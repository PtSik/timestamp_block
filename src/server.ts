// src/server.ts
import { Hono } from 'hono';
import { handleApiRoute } from './routes/api';

const app = new Hono();

// Set up the /api route
app.get('/api', handleApiRoute);

// Start the server using Bun.serve
const server = Bun.serve({
  port: 3000,
  fetch: app.fetch, // Hono's request handler
});

console.log(`Server is running on http://localhost:${server.port}`);
