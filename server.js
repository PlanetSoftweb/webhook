import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Configure CORS for both REST and WebSocket
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://webhook-receiver.netlify.app', 'http://localhost:5173']
  : ['http://localhost:5173'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Enable CORS for REST endpoints
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Store last 10 webhook requests
const webhookHistory = [];
const MAX_HISTORY = 10;

// Root endpoint for testing
app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    endpoints: {
      webhook: 'POST /webhook - Send webhook data here',
      history: 'GET /webhook-history - Get webhook history'
    }
  });
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
  const webhookData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query
  };

  console.log('Received webhook:', webhookData);

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

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});