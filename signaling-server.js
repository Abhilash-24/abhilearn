const WebSocket = require('ws');

const PORT = 3001;
const wss = new WebSocket.Server({ port: PORT });

let clients = new Map();

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    // Expect message to be JSON string
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('Invalid JSON:', message);
      return;
    }

    switch (data.type) {
      case 'login':
        // Save username and connection
        clients.set(data.name, ws);
        ws.name = data.name;
        ws.send(JSON.stringify({ type: 'login', success: true }));
        broadcastUserList();
        break;

      case 'offer':
      case 'answer':
      case 'candidate':
        // Forward signaling messages to the target user
        const target = clients.get(data.target);
        if (target) {
          target.send(JSON.stringify(data));
        }
        break;

      case 'leave':
        handleLeave(ws);
        break;

      default:
        console.error('Unknown message type:', data.type);
        break;
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    handleLeave(ws);
  });

  function handleLeave(ws) {
    if (ws.name) {
      clients.delete(ws.name);
      broadcastUserList();
    }
  }

  function broadcastUserList() {
    const userList = Array.from(clients.keys());
    const message = JSON.stringify({ type: 'userlist', users: userList });
    clients.forEach(client => {
      client.send(message);
    });
  }
});

console.log(`Signaling server is running on ws://localhost:${PORT}`);
