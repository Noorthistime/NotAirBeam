# ⚡ 

NotAirBeam is a **premium, local-network peer-to-peer file sharing platform** designed as a zero-internet, browser-based alternative to AirDrop. It allows you to share files instantly between devices (phones, tablets, laptops) on the same local network (Wi-Fi, mobile hotspot, LAN) without installing native apps or uploading data to the cloud.

Built with a gorgeous glassmorphism user interface inspired by premium minimal designs, OfflineDrop leverages WebSocket signaling and direct WebRTC DataChannels to deliver lightning-fast, secure, and encrypted peer-to-peer transfers.

---

## ✨ Features

- **P2P Direct Transfer:** WebRTC DataChannels allow device-to-device transfers directly over the local network (speeds only limited by your Wi-Fi/LAN hardware).
- **Auto-Discovery:** Instant automatic peer detection on the same local network room.
- **Zero Internet Required:** Once the page is loaded (or installed via PWA), it runs entirely offline on your local network.
- **Multi-File support:** Drag and drop files of any size to any peer.
- **Chunked File Streaming:** Efficient memory usage with 64KB array-buffer chunk streaming.
- **Optional Accounts:** Secure user authentication (registration/login) with sqlite3 sessions to view transfer history.
- **Responsive PWA:** Installable web application with an offline shell, designed to look stunning on both desktop and mobile.

---

## 🛠️ Architecture

OfflineDrop is designed with a decentralized, server-assisted approach:

```
┌─────────────────────────────────────────────────────────────┐
│                       LOCAL NETWORK                         │
│                                                             │
│  ┌────────────────┐     Direct WebRTC DataChannel   ┌───────┴────────┐
│  │   Device A     │◄───────────────────────────────►│    Device B    │
│  │ (Phone/Browser)│                                 │(Laptop/Browser)│
│  └───────┬────────┘                                 └───────┬────────┘
│          │                                                  │
│          │ WebSocket                                        │ WebSocket
│          └────────────────────────┬─────────────────────────┘
│                                   │
│                         ┌─────────▼─────────┐
│                         │ OfflineDrop Server│
│                         │ (Signaling Relay) │
│                         │  Node/Express/WS  │
│                         │  SQLite Database  │
│                         └───────────────────┘
└─────────────────────────────────────────────────────────────┘
```

1. **Signaling Server:** A minimal Node.js Express server acts as a signaling broker to coordinate WebRTC connections (Offers, Answers, and ICE candidates) and discover other peers.
2. **Database:** An embedded SQLite database (`better-sqlite3`) manages user authentication, active sessions, and local transfer history.
3. **WebRTC P2P DataChannel:** All file bytes are transferred directly between devices using DTLS-encrypted WebRTC DataChannels. The signaling server never receives or stores your files.

---

## 🚀 Quick Start (Local Network Deployment)

OfflineDrop is structured as a full-stack project with a root directory orchestrating both `frontend` (Next.js) and `backend` (Express + WebSocket).

### Prerequisites
- Node.js (version 20 or higher)
- npm (installed automatically with Node.js)

### 1. Install Dependencies
Run the install command from the root directory to set up dependencies for both frontend and backend:
```bash
npm run install:all
```

### 2. Configure Environment Variables
Verify configuration inside the environment files:
- **Backend:** `backend/.env` (defaults to port `4000`, database path `./data/offlinedrop.db`)
- **Frontend:** `frontend/.env.local` (sets local WebSocket/API servers pointing to port `4000`)

### 3. Run Development Servers
Start both the Next.js frontend and the Node.js signaling server in development mode:
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

### 4. Build for Production
To build both applications for production run:
```bash
npm run build
```

Then you can start the backend production server:
```bash
npm run start --prefix backend
```

---

## 📶 Accessing on Other Devices

To transfer files between different devices:
1. Ensure both devices are connected to the **same Wi-Fi or local network**.
2. Find the local network IP address of your host machine running OfflineDrop (e.g., `192.168.1.50`).
3. Set `NEXT_PUBLIC_WS_URL=ws://192.168.1.50:4000/ws` and `NEXT_PUBLIC_API_URL=http://192.168.1.50:4000` in `frontend/.env.local` before building the app.
4. Access `http://192.168.1.50:3000` from your phone or other device.
5. Tap on the peer avatar on the screen, drag/select files, and start transferring!

---

## 🔒 Security

- **P2P Encryption:** End-to-end encryption for all transfers using WebRTC's native DTLS.
- **Server Privacy:** Your files are never sent to the signaling server. They stream chunk-by-chunk directly between device browsers.
- **Stateless Auth:** Secure, token-based authentication using HTTP-Only cookie-based JWT sessions.
