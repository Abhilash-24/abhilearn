# Video Conferencing Web Application

## Overview
This is a responsive video conferencing web application built with HTML, CSS, and JavaScript. It supports multi-person video calls, screen sharing, file sharing, a collaborative whiteboard, user authentication, and data encryption via WebRTC.

## Features
- User authentication with username input
- Multi-person video conferencing using WebRTC
- Screen sharing
- File sharing via WebRTC data channels
- Collaborative whiteboard synced between participants
- Data encryption via WebRTC (DTLS/SRTP)
- Responsive UI design

## Prerequisites
- Node.js installed on your system
- Modern web browser with WebRTC support (e.g., Chrome, Firefox)

## Setup and Running

### 1. Start the Signaling Server
The signaling server uses WebSocket to coordinate WebRTC connections.

```bash
cd video-conferencing-web
npm install ws
node signaling-server.js
```

The server will start on `ws://localhost:3001`.

### 2. Open the Client Application
Open the `index.html` file in your browser. For best results, serve it via a local HTTP server (e.g., using VSCode Live Server extension or `npx http-server`).

### 3. Usage
- Enter a unique username when prompted.
- Click "Start Call" to join the call.
- Use the buttons to share your screen, toggle the whiteboard, share files, or end the call.

## Notes
- This is a demo application and may require further enhancements for production use.
- File sharing currently sends file data in chunks but does not reconstruct files on the receiver side.
- The whiteboard syncs drawing data between participants in real-time.

## License
MIT License
