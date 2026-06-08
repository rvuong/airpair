import WebSocket, { WebSocketServer } from "ws";
import { createServer } from "http";

const PORT = 3001;

interface Room {
  clientA: WebSocket | null;
  clientB: WebSocket | null;
}

const rooms = new Map<string, Room>();
const clientToRoom = new Map<WebSocket, string>();

// Generate random 4-letter room code
function generateRoomId(): string {
  return Array.from({ length: 4 })
    .map(() => String.fromCharCode(65 + Math.random() * 26))
    .join("");
}

// Parse message safely
function parseMessage(data: string): Record<string, unknown> | null {
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Send message to client
function sendMessage(ws: WebSocket, msg: Record<string, unknown>): void {
  ws.send(JSON.stringify(msg));
}

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
  console.log("[CONNECT] New client connected");

  ws.on("message", (data: WebSocket.Data) => {
    const msg = parseMessage(String(data));
    if (!msg) return;

    const type = msg.type as string;
    const roomId = clientToRoom.get(ws);

    // Room creation: first client in a new room
    if (type === "create-room") {
      const newRoomId = generateRoomId();
      rooms.set(newRoomId, { clientA: ws, clientB: null });
      clientToRoom.set(ws, newRoomId);
      console.log(`[ROOM] Created room ${newRoomId} (clientA)`);
      sendMessage(ws, { type: "room-created", roomId: newRoomId });
      return;
    }

    // Join room: second client joins
    if (type === "join") {
      const joinRoomId = msg.roomId as string;
      const room = rooms.get(joinRoomId);

      if (!room) {
        console.log(`[JOIN] Room ${joinRoomId} not found`);
        sendMessage(ws, { type: "error", message: "room-not-found" });
        return;
      }

      if (room.clientB !== null) {
        console.log(`[JOIN] Room ${joinRoomId} is full`);
        sendMessage(ws, { type: "error", message: "room-full" });
        return;
      }

      room.clientB = ws;
      clientToRoom.set(ws, joinRoomId);
      console.log(`[ROOM] Client B joined room ${joinRoomId}`);

      sendMessage(ws, { type: "room-joined" });
      if (room.clientA) {
        sendMessage(room.clientA, { type: "peer-connected" });
      }
      return;
    }

    // Handle messages within a room
    if (!roomId) {
      console.log("[MSG] Client not in a room");
      return;
    }

    const room = rooms.get(roomId);
    if (!room) return;

    const peer = ws === room.clientA ? room.clientB : room.clientA;
    if (!peer) return;

    // NTP sync messages: add server timestamps
    if (type === "sync-ping") {
      const t2 = Date.now();
      sendMessage(peer, { ...msg, t2 });
      return;
    }

    if (type === "sync-pong") {
      const t4 = Date.now();
      sendMessage(peer, { ...msg, t4 });
      return;
    }

    // Relay all other messages as-is
    sendMessage(peer, msg);
  });

  ws.on("close", () => {
    const roomId = clientToRoom.get(ws);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const peer = ws === room.clientA ? room.clientB : room.clientA;

    if (peer) {
      sendMessage(peer, { type: "peer-disconnected" });
    }

    rooms.delete(roomId);
    clientToRoom.delete(ws);
    console.log(`[DISCONNECT] Room ${roomId} destroyed`);
  });

  ws.on("error", (err: Error) => {
    console.error("[ERROR]", err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[SERVER] WebSocket server listening on ws://localhost:${PORT}`);
});
