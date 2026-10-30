import type { Server as HttpServer } from "node:http";
import { Server as IOServer } from "socket.io";
import { config } from "./config";

let io: IOServer | null = null;

/**
 * Real-time channel for the dashboard. A message queue (RabbitMQ, etc.) would be
 * overkill for a single-instance app and needs a broker running — Socket.IO on
 * the same HTTP server gives us live pushes with reconnection for free. Swap in
 * a queue later if this ever needs to fan out across instances.
 */
export function initRealtime(httpServer: HttpServer): IOServer {
  io = new IOServer(httpServer, {
    path: "/socket.io",
    cors: { origin: config.clientOrigin },
  });

  // Only the admin role may listen (same key as the dashboard REST routes).
  io.use((socket, next) => {
    const key = socket.handshake.auth?.key;
    if (key && key === config.adminKey) return next();
    next(new Error("admin role required"));
  });

  io.on("connection", (socket) => {
    socket.emit("ready", { at: new Date().toISOString() });
  });

  return io;
}

export function emitResponse(payload: unknown): void {
  io?.emit("response:new", payload);
}

export function emitVisit(payload: unknown): void {
  io?.emit("visit:new", payload);
}
