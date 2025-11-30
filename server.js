const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Basic HTTP server
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocket.Server({ server });

// In-memory database (persists as long as server is running)
let appState = {
  spots: [], // ParkingSpot[]
  spotLocations: {}, // Record<string, SpotLocation>
  zones: [], // MapZone[]
  mapImage: null, // Base64 string
  lastUpdated: Date.now()
};

console.log('Smart Park Server starting...');

wss.on('connection', (ws) => {
  console.log('Client connected');

  // 1. Send initial state to the new client
  ws.send(JSON.stringify({
    type: 'INIT',
    payload: appState
  }));

  // 2. Listen for updates from this client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'UPDATE') {
        // Merge updates into server state
        // We handle specific keys to ensure data integrity
        if (data.payload.spots) appState.spots = data.payload.spots;
        if (data.payload.spotLocations) appState.spotLocations = data.payload.spotLocations;
        if (data.payload.zones) appState.zones = data.payload.zones;
        if (data.payload.mapImage) appState.mapImage = data.payload.mapImage;
        
        appState.lastUpdated = Date.now();

        // Broadcast the update to ALL other connected clients
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'UPDATE',
              payload: data.payload
            }));
          }
        });
        
        console.log(`Update broadcasted: ${Object.keys(data.payload).join(', ')}`);
      }
      
      // Handle initial data push from client (if server was empty)
      if (data.type === 'SYNC_INITIAL' && appState.spots.length === 0) {
          console.log('Receiving initial seed data from client');
          appState = { ...appState, ...data.payload };
      }

    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`\n🚗 Smart Park Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
});