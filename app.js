
const localVideo = document.getElementById('localVideo');
const remoteVideos = document.getElementById('remoteVideos');
const startCallBtn = document.getElementById('startCallBtn');
const shareScreenBtn = document.getElementById('shareScreenBtn');
const toggleWhiteboardBtn = document.getElementById('toggleWhiteboardBtn');
const shareFileBtn = document.getElementById('shareFileBtn');
const endCallBtn = document.getElementById('endCallBtn');
const whiteboardSection = document.getElementById('whiteboardSection');
const whiteboard = document.getElementById('whiteboard');

let localStream = null;
let peerConnections = {};
let dataChannels = {};
let isWhiteboardVisible = false;
let username = null;
let connectedUsers = [];

const signalingServerUrl = 'ws://localhost:3001';
let signalingSocket = null;

// Prompt user for username
function promptUsername() {
  username = prompt('Enter your username:');
  if (!username) {
    alert('Username is required');
    promptUsername();
  }
}

// Connect to signaling server
function connectSignalingServer() {
  signalingSocket = new WebSocket(signalingServerUrl);

  signalingSocket.onopen = () => {
    console.log('Connected to signaling server');
    signalingSocket.send(JSON.stringify({ type: 'login', name: username }));
  };

  signalingSocket.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    switch (data.type) {
      case 'login':
        if (data.success) {
          console.log('Login successful');
          startCallBtn.disabled = false;
        } else {
          alert('Login failed, try another username');
          promptUsername();
          connectSignalingServer();
        }
        break;

      case 'userlist':
        connectedUsers = data.users.filter(user => user !== username);
        updateUserListUI();
        break;

      case 'offer':
        await handleOffer(data.offer, data.name);
        break;

      case 'answer':
        await handleAnswer(data.answer, data.name);
        break;

      case 'candidate':
        await handleCandidate(data.candidate, data.name);
        break;

      case 'leave':
        handleLeave(data.name);
        break;

      default:
        console.log('Unknown message type:', data.type);
        break;
    }
  };

  signalingSocket.onerror = (err) => {
    console.error('Signaling socket error:', err);
  };

  signalingSocket.onclose = () => {
    console.log('Signaling socket closed');
  };
}

// Send message to signaling server
function sendToServer(message) {
  signalingSocket.send(JSON.stringify(message));
}

// Update UI for connected users (for demo, just log)
function updateUserListUI() {
  console.log('Connected users:', connectedUsers);
}

// Get user media (video and audio)
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error('Error accessing media devices.', err);
  }
}

// Create peer connection and setup handlers
function createPeerConnection(peerName) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  // Add local stream tracks to peer connection
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // Handle remote stream
  pc.ontrack = (event) => {
    let remoteVideo = document.getElementById('remoteVideo_' + peerName);
    if (!remoteVideo) {
      remoteVideo = document.createElement('video');
      remoteVideo.id = 'remoteVideo_' + peerName;
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      remoteVideo.className = 'remoteVideo';
      remoteVideos.appendChild(remoteVideo);
    }
    remoteVideo.srcObject = event.streams[0];
  };

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendToServer({
        type: 'candidate',
        candidate: event.candidate,
        target: peerName,
        name: username
      });
    }
  };

  // Setup data channel for file sharing and whiteboard sync
  const dataChannel = pc.createDataChannel('dataChannel');
  dataChannels[peerName] = dataChannel;

  dataChannel.onopen = () => {
    console.log('Data channel open with', peerName);
  };

  dataChannel.onmessage = (event) => {
    handleDataChannelMessage(event.data, peerName);
  };

  pc.ondatachannel = (event) => {
    const receiveChannel = event.channel;
    receiveChannel.onmessage = (event) => {
      handleDataChannelMessage(event.data, peerName);
    };
  };

  return pc;
}

// Handle offer from remote peer
async function handleOffer(offer, peerName) {
  const pc = createPeerConnection(peerName);
  peerConnections[peerName] = pc;

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  sendToServer({
    type: 'answer',
    answer: answer,
    target: peerName,
    name: username
  });
}

// Handle answer from remote peer
async function handleAnswer(answer, peerName) {
  const pc = peerConnections[peerName];
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

// Handle ICE candidate from remote peer
async function handleCandidate(candidate, peerName) {
  const pc = peerConnections[peerName];
  if (!pc) return;
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

// Handle peer leaving
function handleLeave(peerName) {
  const pc = peerConnections[peerName];
  if (pc) {
    pc.close();
    delete peerConnections[peerName];
  }
  const video = document.getElementById('remoteVideo_' + peerName);
  if (video) {
    video.remove();
  }
  delete dataChannels[peerName];
}

// Start call and create offers to all connected users
async function startCall() {
  if (!localStream) {
    await startLocalStream();
  }
  for (const peerName of connectedUsers) {
    const pc = createPeerConnection(peerName);
    peerConnections[peerName] = pc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendToServer({
      type: 'offer',
      offer: offer,
      target: peerName,
      name: username
    });
  }
}

// Share screen
async function shareScreen() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    localVideo.srcObject = screenStream;

    // Replace video track in each peer connection
    for (const pc of Object.values(peerConnections)) {
      const senders = pc.getSenders();
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = senders.find(s => s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(screenTrack);
      }
    }

    screenStream.getVideoTracks()[0].addEventListener('ended', () => {
      localVideo.srcObject = localStream;
      for (const pc of Object.values(peerConnections)) {
        const senders = pc.getSenders();
        const videoTrack = localStream.getVideoTracks()[0];
        const sender = senders.find(s => s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
    });
  } catch (err) {
    console.error('Error sharing screen:', err);
  }
}

// Toggle whiteboard visibility
function toggleWhiteboard() {
  isWhiteboardVisible = !isWhiteboardVisible;
  whiteboardSection.hidden = !isWhiteboardVisible;
  if (isWhiteboardVisible) {
    initWhiteboard();
  }
}

// Initialize whiteboard canvas for drawing and sync
function initWhiteboard() {
  const ctx = whiteboard.getContext('2d');
  let drawing = false;

  whiteboard.width = whiteboard.clientWidth;
  whiteboard.height = whiteboard.clientHeight;

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  whiteboard.onmousedown = (e) => {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
    sendDrawingData({ type: 'begin', x: e.offsetX, y: e.offsetY });
  };

  whiteboard.onmousemove = (e) => {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    sendDrawingData({ type: 'draw', x: e.offsetX, y: e.offsetY });
  };

  whiteboard.onmouseup = () => {
    drawing = false;
  };

  whiteboard.onmouseleave = () => {
    drawing = false;
  };
}

// Send drawing data to all peers via data channels
function sendDrawingData(data) {
  const message = JSON.stringify({ type: 'whiteboard', data });
  for (const dc of Object.values(dataChannels)) {
    if (dc.readyState === 'open') {
      dc.send(message);
    }
  }
}

// Handle incoming data channel messages
function handleDataChannelMessage(message, peerName) {
  const data = JSON.parse(message);
  if (data.type === 'whiteboard') {
    drawOnWhiteboard(data.data);
  } else if (data.type === 'file') {
    receiveFileData(data.data, peerName);
  }
}

// Draw on whiteboard based on received data
function drawOnWhiteboard(data) {
  const ctx = whiteboard.getContext('2d');
  if (data.type === 'begin') {
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
  } else if (data.type === 'draw') {
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
  }
}

// Placeholder for file sharing
function shareFile() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (file) {
      sendFile(file);
    }
  };
  fileInput.click();
}

// Send file data in chunks over data channels
function sendFile(file) {
  const chunkSize = 16384;
  const reader = new FileReader();
  let offset = 0;

  reader.onload = () => {
    sendChunk(reader.result);
  };

  function sendChunk(chunk) {
    for (const dc of Object.values(dataChannels)) {
      if (dc.readyState === 'open') {
        dc.send(JSON.stringify({ type: 'file', data: chunk }));
      }
    }
    offset += chunkSize;
    if (offset < file.size) {
      readSlice(offset);
    }
  }

  function readSlice(o) {
    const slice = file.slice(o, o + chunkSize);
    reader.readAsArrayBuffer(slice);
  }

  readSlice(0);
}

// Receive file data (placeholder)
function receiveFileData(data, peerName) {
  console.log('Received file data from', peerName);
  // For demo, just log. Can implement file reconstruction and download.
}

// End call (stop all streams and reset UI)
function endCall() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
  }
  for (const pc of Object.values(peerConnections)) {
    pc.close();
  }
  peerConnections = {};
  dataChannels = {};
  remoteVideos.innerHTML = '';
  alert('Call ended.');
}

// Event listeners
startCallBtn.addEventListener('click', startCall);
shareScreenBtn.addEventListener('click', shareScreen);
toggleWhiteboardBtn.addEventListener('click', toggleWhiteboard);
shareFileBtn.addEventListener('click', shareFile);
endCallBtn.addEventListener('click', endCall);

// Prompt username and connect to signaling server on page load
promptUsername();
connectSignalingServer();
