import React, { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Webhook, Clock, Trash2 } from 'lucide-react';

interface WebhookData {
  timestamp: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  query: Record<string, string>;
}

function App() {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [serverUrl, setServerUrl] = useState(`${BACKEND_URL}/webhook`);

  const connectSocket = useCallback(() => {
    if (socket?.connected) {
      console.log('Socket already connected');
      return () => {};
    }

    console.log('Connecting to:', BACKEND_URL);
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setConnectionStatus('Connected');
      fetchWebhookHistory();
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('Connection error');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      setConnectionStatus('Disconnected');
    });

    newSocket.on('webhook', (webhookData: WebhookData) => {
      console.log('Received webhook data:', webhookData);
      setWebhooks(prev => [webhookData, ...prev.slice(0, 9)]);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket.connected) {
        newSocket.disconnect();
      }
    };
  }, [BACKEND_URL, socket]);

  const fetchWebhookHistory = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/webhook-history`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setWebhooks(data);
    } catch (err) {
      console.error('Error fetching webhook history:', err);
      setConnectionStatus('Error loading history');
    }
  };

  useEffect(() => {
    const cleanup = connectSocket();
    return cleanup;
  }, [connectSocket]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const reconnect = () => {
    setConnectionStatus('Reconnecting...');
    if (socket) {
      socket.disconnect();
    }
    connectSocket();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Webhook className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Webhook Receiver</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-sm ${
              connectionStatus === 'Connected' 
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {connectionStatus}
            </div>
            {connectionStatus !== 'Connected' && (
              <button
                onClick={reconnect}
                className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Webhook URL</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={serverUrl}
              readOnly
              className="flex-1 p-2 border rounded-lg bg-gray-50"
            />
            <button
              onClick={() => copyToClipboard(serverUrl)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Send POST requests to this URL to test the webhook
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Recent Webhooks</h2>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {webhooks.map((webhook, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedWebhook(webhook)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedWebhook === webhook ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {formatTime(webhook.timestamp)}
                        </span>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        {webhook.method}
                      </span>
                    </div>
                  </div>
                ))}
                {webhooks.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No webhooks received yet
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Webhook Details</h2>
              </div>
              <div className="p-4">
                {selectedWebhook ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">Headers</h3>
                      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(selectedWebhook.headers, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">Body</h3>
                      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(selectedWebhook.body, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">Query Parameters</h3>
                      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(selectedWebhook.query, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    Select a webhook to view details
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;