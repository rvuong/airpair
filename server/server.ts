import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { randomBytes } from "crypto";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

interface Message {
  type: string;
  roomId?: string;
  role?: string;
  payload?: unknown;
  message?: string;
  t1?: number;
  t2?: number;
  t_start?: number;
}

interface Room {
  a: WebSocket;
  b?: WebSocket;
}

const rooms = new Map<string, Room>();
const clientToRoom = new Map<WebSocket, { roomId: string; role: "A" | "B" }>();

function generateRoomId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

function send(ws: WebSocket, msg: Message): void {
  ws.send(JSON.stringify(msg));
}

function handleCreate(ws: WebSocket): void {
  const roomId = generateRoomId();
  rooms.set(roomId, { a: ws });
  clientToRoom.set(ws, { roomId, role: "A" });
  send(ws, { type: "created", roomId, role: "A" });
  console.log(`[CREATE] Room ${roomId} created`);
}

function handleJoin(ws: WebSocket, roomId: string): void {
  const room = rooms.get(roomId);

  if (!room) {
    send(ws, { type: "error", message: "room_not_found" });
    return;
  }

  if (room.b) {
    send(ws, { type: "error", message: "room_full" });
    return;
  }

  room.b = ws;
  clientToRoom.set(ws, { roomId, role: "B" });
  send(ws, { type: "joined", role: "B" });
  send(room.a, { type: "peer_joined" });
  console.log(`[JOIN] Client joined room ${roomId}`);
}

function handleServerPing(ws: WebSocket, t1: number): void {
  send(ws, { type: "server_pong", t1, t2: Date.now() });
}

function handleStartCountdown(ws: WebSocket): void {
  const clientInfo = clientToRoom.get(ws);
  if (!clientInfo || clientInfo.role !== "A") return;

  const room = rooms.get(clientInfo.roomId);
  if (!room) return;

  const tStart = Date.now() + 3500;
  send(room.a, { type: "countdown", t_start: tStart });
  if (room.b) send(room.b, { type: "countdown", t_start: tStart });
  console.log(`[COUNTDOWN] Room ${clientInfo.roomId} starts at ${tStart}`);
}

function handleRelay(ws: WebSocket, payload: unknown): void {
  const clientInfo = clientToRoom.get(ws);
  if (!clientInfo) return;

  const room = rooms.get(clientInfo.roomId);
  if (!room) return;

  const peer = clientInfo.role === "A" ? room.b : room.a;
  if (peer) {
    send(peer, { type: "relay", payload });
  }
}

function handleDisconnect(ws: WebSocket): void {
  const clientInfo = clientToRoom.get(ws);
  if (!clientInfo) return;

  const room = rooms.get(clientInfo.roomId);
  if (!room) return;

  const peer = clientInfo.role === "A" ? room.b : room.a;
  if (peer && peer.readyState === WebSocket.OPEN) {
    send(peer, { type: "error", message: "peer_disconnected" });
  }

  rooms.delete(clientInfo.roomId);
  clientToRoom.delete(ws);
  console.log(`[DISCONNECT] Client left room ${clientInfo.roomId}`);
}

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws: WebSocket) => {
  console.log("[CONNECT] Client connected");

  ws.on("message", (data: Buffer) => {
    let msg: Message;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      send(ws, { type: "error", message: "invalid_json" });
      return;
    }

    switch (msg.type) {
      case "create":
        handleCreate(ws);
        break;
      case "join":
        if (msg.roomId) handleJoin(ws, msg.roomId);
        break;
      case "relay":
        if (msg.payload !== undefined) handleRelay(ws, msg.payload);
        break;
      case "server_ping":
        if (msg.t1 !== undefined) handleServerPing(ws, msg.t1);
        break;
      case "start_countdown":
        handleStartCountdown(ws);
        break;
      default:
        send(ws, { type: "error", message: "unknown_type" });
    }
  });

  ws.on("close", () => {
    handleDisconnect(ws);
  });

  ws.on("error", (err: Error) => {
    console.error("[ERROR]", err.message);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[SERVER] Listening on ws://localhost:${PORT}`);
});
