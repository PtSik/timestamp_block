// src/server.ts
import { Hono } from 'hono';
import { handleApiRoute } from './routes/api';

const app = new Hono();

// Set up the /api route
app.get('/api', handleApiRoute);

// Start the server using Bun.serve with a valid idleTimeout
const server = Bun.serve({
  port: 3000,
  fetch: app.fetch,
  idleTimeout: 255, // This is the max allowed by Bun
});

// Set up a keep-alive to prevent idle timeout
setInterval(async () => {
  try {
    await fetch(`http://localhost:${server.port}/api`);
  } catch (error) {
    console.error('Keep-alive request failed:', error);
  }
}, 20000); // Adjust the interval as needed (e.g., every 20 seconds)

console.log(`Server is running on http://localhost:${server.port}`);
