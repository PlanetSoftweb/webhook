import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());

// Store last 10 webhook requests
const webhookHistory = [];
const MAX_HISTORY = 10;

// Webhook endpoint
app.post('/webhook', (req, res) => {
  const webhookData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query
  };

  webhookHistory.unshift(webhookData);
  if (webhookHistory.length > MAX_HISTORY) {
    webhookHistory.pop();
  }

  // Emit the new webhook data to all connected clients
  io.emit('webhook', webhookData);
  
  res.status(200).json({ status: 'success', message: 'Webhook received' });
});

// Endpoint to get webhook history
app.get('/webhook-history', (req, res) => {
  res.json(webhookHistory);
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});