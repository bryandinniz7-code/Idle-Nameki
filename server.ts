import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { type DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { WebSocket, WebSocketServer } from 'ws';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { simulateOfflineProgress } from './src/game/engine.ts';
import type { OnlinePlayer, PlayerSaveState } from './src/game/types.ts';

const PORT = 3000;
const SIGNING_SECRET =
  process.env.AFK_SIGNING_SECRET ||
  crypto
    .createHash('sha256')
    .update(`idle-nameki:${firebaseConfig.projectId}:${firebaseConfig.appId}`)
    .digest('hex');

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const adminAuth = getAuth();

interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

interface AfkTokenPayload {
  uid: string;
  serverTimeMs: number;
  nonce: string;
}

function signAfkToken(payload: AfkTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyAfkToken(token: string, expectedUid: string): AfkTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AfkTokenPayload;
    if (
      parsed &&
      parsed.uid === expectedUid &&
      typeof parsed.serverTimeMs === 'number' &&
      Number.isFinite(parsed.serverTimeMs)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Erro ao verificar Firebase ID Token:', err);
    res.status(401).json({ error: 'Token de autenticação inválido.' });
  }
}

// Authoritative server-side AFK session registry & online players
const serverSessionClockByUid = new Map<string, number>();

interface ConnectedClient {
  ws: WebSocket;
  uid: string;
  player: OnlinePlayer;
  lastSeenMs: number;
}

const connectedClients = new Map<string, ConnectedClient>();

function broadcastToAll(payload: unknown) {
  const msg = JSON.stringify(payload);
  for (const client of connectedClients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

function broadcastToMap(mapId: string, payload: unknown, excludeUid?: string) {
  const msg = JSON.stringify(payload);
  for (const client of connectedClients.values()) {
    if (
      client.ws.readyState === WebSocket.OPEN &&
      client.player.currentMapId === mapId &&
      (!excludeUid || client.uid !== excludeUid)
    ) {
      client.ws.send(msg);
    }
  }
}

function broadcastPresence() {
  const players = Array.from(connectedClients.values()).map((c) => c.player);
  broadcastToAll({ type: 'presence:list', players });
}

// Prune stale sockets and send WS ping keep-alives every 15s
setInterval(() => {
  const cutoff = Date.now() - 45000;
  let removed = false;
  for (const [uid, client] of connectedClients.entries()) {
    if (client.ws.readyState !== WebSocket.OPEN || client.lastSeenMs < cutoff) {
      connectedClients.delete(uid);
      removed = true;
    } else {
      try {
        client.ws.ping();
      } catch {
        // Ignore ping errors
      }
    }
  }
  if (removed) broadcastPresence();
}, 15000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, serverTimeMs: Date.now() });
  });

  app.get('/api/server-time', (_req, res) => {
    res.json({ serverTimeMs: Date.now() });
  });

  // Issues an authoritative HMAC-signed server timestamp token so device clock tampering cannot fake AFK time
  app.post('/api/afk/heartbeat', requireAuth, (req: AuthRequest, res: Response) => {
    const uid = req.user!.uid;
    const serverTimeMs = Date.now();
    serverSessionClockByUid.set(uid, serverTimeMs);
    const afkSessionToken = signAfkToken({
      uid,
      serverTimeMs,
      nonce: crypto.randomBytes(6).toString('hex'),
    });
    res.json({ serverTimeMs, afkSessionToken });
  });

  // Validates the signed AFK token against server UTC clock and computes offline rewards deterministically
  app.post('/api/afk/claim', requireAuth, (req: AuthRequest, res: Response) => {
    const uid = req.user!.uid;
    const body = req.body as { playerState?: PlayerSaveState };
    const playerState = body?.playerState;

    if (!playerState || playerState.uid !== uid) {
      res.status(400).json({ error: 'Dados do personagem inválidos.' });
      return;
    }

    const serverNowMs = Date.now();
    let authoritativeLastMs = serverNowMs;

    const verifiedToken = verifyAfkToken(playerState.afkSessionToken, uid);
    if (verifiedToken) {
      authoritativeLastMs = verifiedToken.serverTimeMs;
    } else if (serverSessionClockByUid.has(uid)) {
      authoritativeLastMs = serverSessionClockByUid.get(uid)!;
    } else if (
      typeof playerState.lastActiveServerMs === 'number' &&
      playerState.lastActiveServerMs > 0 &&
      playerState.lastActiveServerMs <= serverNowMs
    ) {
      // Initial migration fallback only if timestamp is not in the future
      authoritativeLastMs = playerState.lastActiveServerMs;
    }

    // Never trust future timestamps or negative deltas
    const rawElapsedSeconds = Math.max(0, Math.floor((serverNowMs - authoritativeLastMs) / 1000));

    const { updatedPlayer, summary } = simulateOfflineProgress(
      playerState,
      rawElapsedSeconds,
      serverNowMs
    );

    serverSessionClockByUid.set(uid, serverNowMs);
    const nextToken = signAfkToken({
      uid,
      serverTimeMs: serverNowMs,
      nonce: crypto.randomBytes(6).toString('hex'),
    });
    updatedPlayer.afkSessionToken = nextToken;
    updatedPlayer.lastActiveServerMs = serverNowMs;

    res.json({
      serverTimeMs: serverNowMs,
      afkSessionToken: nextToken,
      summary,
      updatedPlayer,
    });
  });

  // Exports an HMAC-signed account progression bundle for moving progress between accounts owned by the player
  app.post('/api/account/export-transfer', requireAuth, (req: AuthRequest, res: Response) => {
    const uid = req.user!.uid;
    const body = req.body as { playerState?: PlayerSaveState };
    const p = body?.playerState;
    if (!p || p.uid !== uid) {
      res.status(400).json({ error: 'Dados do personagem inválidos para transferência.' });
      return;
    }

    const bundle = {
      sourceUid: uid,
      sourceName: p.name,
      exportedAtMs: Date.now(),
      level: p.level,
      xp: p.xp,
      zeni: p.zeni,
      bonusStrength: p.bonusStrength,
      bonusDefense: p.bonusDefense,
      bonusSpeed: p.bonusSpeed,
      bonusKi: p.bonusKi,
      bonusStamina: p.bonusStamina,
      currentMapId: p.currentMapId,
      transformationId: p.transformationId,
      unlockedTransformations: p.unlockedTransformations ?? ['base'],
      inventory: (p.inventory ?? []).slice(0, 120),
      equipped: p.equipped,
      missionProgress: p.missionProgress ?? {},
      claimedMissions: (p.claimedMissions ?? []).slice(0, 150),
      dailyMissionDate: p.dailyMissionDate,
      bossCooldowns: p.bossCooldowns ?? {},
      chestCooldowns: p.chestCooldowns ?? {},
      stats: p.stats,
      title: p.title,
      unlockedTitles: (p.unlockedTitles ?? ['Aprendiz de Artes Marciais']).slice(0, 60),
      redeemedCodes: (p.redeemedCodes ?? []).slice(0, 20),
      dragonBalls: (p.dragonBalls ?? []).slice(0, 7),
      xpBuffUntilMs: p.xpBuffUntilMs ?? 0,
      kiFragments: p.kiFragments ?? 0,
      unlockedPets: (p.unlockedPets ?? []).slice(0, 20),
      activePetId: p.activePetId ?? null,
      petXp: p.petXp ?? 0,
      prestigeLevel: p.prestigeLevel ?? 0,
      divinePoints: p.divinePoints ?? 0,
      divineUpgrades: p.divineUpgrades ?? {},
      tournamentPoints: p.tournamentPoints ?? 0,
      tournamentWins: p.tournamentWins ?? 0,
    };

    const encoded = Buffer.from(JSON.stringify(bundle), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(encoded).digest('base64url');
    const transferCode = `IDLENK1.${encoded}.${sig}`;

    res.json({
      transferCode,
      summary: {
        sourceName: p.name,
        level: p.level,
        itemsCount: bundle.inventory.length,
        zeni: p.zeni,
      },
    });
  });

  app.post('/api/account/import-transfer', requireAuth, (req: AuthRequest, res: Response) => {
    const body = req.body as { transferCode?: string };
    const raw = (body?.transferCode ?? '').trim();
    const parts = raw.split('.');
    if (parts.length !== 3 || parts[0] !== 'IDLENK1') {
      res.status(400).json({ error: 'Código de transferência inválido.' });
      return;
    }
    const [, encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SIGNING_SECRET)
      .update(encoded)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(403).json({ error: 'Assinatura do código de transferência inválida.' });
      return;
    }

    try {
      const bundle = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
      res.json({ bundle });
    } catch {
      res.status(400).json({ error: 'Não foi possível decodificar o pacote de transferência.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    let authedUid: string | null = null;

    ws.on('pong', () => {
      if (authedUid) {
        const existing = connectedClients.get(authedUid);
        if (existing) existing.lastSeenMs = Date.now();
      }
    });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          idToken?: string;
          player?: OnlinePlayer;
          text?: string;
          vfx?: {
            kind: 'projectile' | 'beam' | 'aoe' | 'heal';
            fromX: number;
            fromY: number;
            toX: number;
            toY: number;
            colorPrimary: string;
            colorSecondary: string;
            radiusTiles: number;
            durationMs: number;
          };
        };

        if (msg.type === 'auth' && msg.idToken && msg.player) {
          let decoded: DecodedIdToken;
          try {
            decoded = await adminAuth.verifyIdToken(msg.idToken);
          } catch (authErr) {
            console.error('WS verifyIdToken falhou:', authErr);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'auth:error' }));
            }
            return;
          }
          authedUid = decoded.uid;
          const safePlayer: OnlinePlayer = {
            ...msg.player,
            uid: decoded.uid,
            guildTag: typeof msg.player.guildTag === 'string' ? msg.player.guildTag.slice(0, 8) : null,
            petId: typeof msg.player.petId === 'string' ? msg.player.petId.slice(0, 64) : null,
            isFused: Boolean(msg.player.isFused),
            moving: Boolean(msg.player.moving),
            isFlying: Boolean(msg.player.isFlying),
            updatedAtMs: Date.now(),
          };
          connectedClients.set(decoded.uid, {
            ws,
            uid: decoded.uid,
            player: safePlayer,
            lastSeenMs: Date.now(),
          });
          ws.send(JSON.stringify({ type: 'auth:ok', uid: decoded.uid }));
          broadcastPresence();
          return;
        }

        if (!authedUid) return;

        const existing = connectedClients.get(authedUid);
        if (!existing) return;
        existing.lastSeenMs = Date.now();

        if (msg.type === 'presence:update' && msg.player) {
          existing.player = {
            ...msg.player,
            uid: authedUid,
            guildTag: typeof msg.player.guildTag === 'string' ? msg.player.guildTag.slice(0, 8) : null,
            petId: typeof msg.player.petId === 'string' ? msg.player.petId.slice(0, 64) : null,
            isFused: Boolean(msg.player.isFused),
            x: typeof msg.player.x === 'number' ? msg.player.x : existing.player.x,
            y: typeof msg.player.y === 'number' ? msg.player.y : existing.player.y,
            facing: msg.player.facing ?? existing.player.facing,
            moving: Boolean(msg.player.moving),
            isFlying: Boolean(msg.player.isFlying),
            activityMode: msg.player.activityMode ?? existing.player.activityMode,
            updatedAtMs: Date.now(),
          };
          broadcastPresence();
          return;
        }

        if (msg.type === 'skill:vfx' && msg.vfx) {
          const v = msg.vfx;
          if (
            typeof v.fromX === 'number' &&
            typeof v.fromY === 'number' &&
            typeof v.toX === 'number' &&
            typeof v.toY === 'number'
          ) {
            broadcastToMap(
              existing.player.currentMapId,
              {
                type: 'skill:vfx',
                fromUid: authedUid,
                vfx: {
                  kind: v.kind,
                  fromX: v.fromX,
                  fromY: v.fromY,
                  toX: v.toX,
                  toY: v.toY,
                  colorPrimary: String(v.colorPrimary).slice(0, 24),
                  colorSecondary: String(v.colorSecondary).slice(0, 24),
                  radiusTiles: Math.min(8, Math.max(0.5, Number(v.radiusTiles) || 1)),
                  durationMs: Math.min(1000, Math.max(120, Number(v.durationMs) || 260)),
                },
              },
              authedUid
            );
          }
          return;
        }

        if (msg.type === 'player:emote' && typeof msg.text === 'string') {
          const cleanText = msg.text.trim().slice(0, 48);
          if (!cleanText) return;
          broadcastToMap(existing.player.currentMapId, {
            type: 'player:emote',
            uid: authedUid,
            text: cleanText,
            createdAtMs: Date.now(),
          });
          return;
        }

        if (msg.type === 'chat:send' && typeof msg.text === 'string') {
          const cleanText = msg.text.trim().slice(0, 240);
          if (!cleanText) return;
          broadcastToAll({
            type: 'chat:message',
            message: {
              id: `ws_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
              uid: authedUid,
              senderName: existing.player.name,
              senderTitle: existing.player.title,
              senderLevel: existing.player.level,
              channel: 'global',
              text: cleanText,
              createdAtMs: Date.now(),
            },
          });
          return;
        }

        if (msg.type === 'party:notify') {
          broadcastToAll({ type: 'party:refresh' });
        }
      } catch (err) {
        console.error('Erro WebSocket:', err);
      }
    });

    ws.on('close', () => {
      if (authedUid) {
        const existing = connectedClients.get(authedUid);
        if (existing && existing.ws === ws) {
          connectedClients.delete(authedUid);
          broadcastPresence();
        }
      }
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Idle Nameki server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
