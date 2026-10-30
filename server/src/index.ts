import path from "node:path";
import { createServer } from "node:http";
import express, { type Request } from "express";
import cors from "cors";
import { config } from "./config";
import { prisma } from "./prisma";
import { requireRole, roleOf } from "./rbac";
import { initRealtime, emitResponse, emitVisit } from "./realtime";

const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "16kb" }));

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

const ua = (req: Request) => req.get("user-agent")?.slice(0, 300) ?? null;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Lets the client know whether the supplied key grants the admin role.
app.get("/api/session", (req, res) => {
  res.json({ role: roleOf(req) });
});

// The invitation content — the client renders whatever this returns.
app.get("/api/config", (_req, res) => {
  res.json(config.invite);
});

// Log that someone opened the link.
app.post("/api/visit", async (req, res, next) => {
  try {
    const visit = await prisma.visit.create({
      data: {
        visitorId: str(req.body?.visitorId, 100),
        userAgent: ua(req),
        referrer: str(req.get("referer"), 300),
      },
    });
    emitVisit(visit);
    res.json({ id: visit.id });
  } catch (err) {
    next(err);
  }
});

// Record (or update) an answer. One row per visitorId, updated in place.
app.post("/api/response", async (req, res, next) => {
  try {
    const answer = req.body?.answer;
    if (answer !== "yes" && answer !== "no") {
      return res.status(400).json({ error: "answer must be 'yes' or 'no'" });
    }

    const rawDodges = Number(req.body?.dodgeCount);
    const visitorId = str(req.body?.visitorId, 100);
    const data = {
      answer,
      message: str(req.body?.message, 1000),
      chosenSlot: str(req.body?.chosenSlot, 200),
      dodgeCount: Number.isFinite(rawDodges) ? Math.max(0, Math.trunc(rawDodges)) : 0,
      visitorId,
      userAgent: ua(req),
    };

    const existing = visitorId
      ? await prisma.response.findFirst({
          where: { visitorId },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const saved = existing
      ? await prisma.response.update({ where: { id: existing.id }, data })
      : await prisma.response.create({ data });

    emitResponse(saved);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// Dashboard data — admin role only.
app.get("/api/responses", requireRole("admin"), async (_req, res, next) => {
  try {
    const responses = await prisma.response.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    res.json(responses);
  } catch (err) {
    next(err);
  }
});

app.get("/api/visits", requireRole("admin"), async (_req, res, next) => {
  try {
    const visits = await prisma.visit.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(visits);
  } catch (err) {
    next(err);
  }
});

app.get("/api/stats", requireRole("admin"), async (_req, res, next) => {
  try {
    const [visits, yes, no, agg, latest] = await Promise.all([
      prisma.visit.count(),
      prisma.response.count({ where: { answer: "yes" } }),
      prisma.response.count({ where: { answer: "no" } }),
      prisma.response.aggregate({ _max: { dodgeCount: true } }),
      prisma.response.findFirst({ orderBy: { updatedAt: "desc" } }),
    ]);
    res.json({
      visits,
      yes,
      no,
      maxDodges: agg._max.dodgeCount ?? 0,
      latestAt: latest?.updatedAt ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// In production the server also serves the built client (single "monolith" deploy).
if (config.isProd) {
  const clientDir = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  },
);

const httpServer = createServer(app);
initRealtime(httpServer);

httpServer.listen(config.port, () => {
  console.log(`API + realtime on http://localhost:${config.port}`);
});
