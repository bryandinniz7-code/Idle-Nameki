import React, { useEffect, useRef } from 'react';
import { getTransformationById } from '../game/engine.ts';
import {
  getMonsterSpriteCanvas,
  getNpcSpriteCanvas,
  getNuvemVoadoraCanvas,
  getPetSpriteCanvas,
  getWarriorSpriteCanvas,
  type FacingDir,
} from '../game/pixelArtSprites.ts';
import {
  getWorldMapGrid,
  isTileFlyable,
  isTileWalkable,
  TILE_SIZE,
  type TileType,
  type WorldMapGrid,
  type WorldNpcPlacement,
  type WorldPalette,
} from '../game/worldMap.ts';
import type {
  BossDef,
  DerivedStats,
  MonsterDef,
  OnlinePlayer,
  PlayerSaveState,
  RaceId,
  WorldBossState,
} from '../game/types.ts';

export interface WorldMonsterEntity {
  instanceId: string;
  def: MonsterDef | BossDef;
  isBoss: boolean;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  hp: number;
  maxHp: number;
  hitFlashUntil: number;
  respawnAt: number;
  patrolPhase: number;
}

export interface WorldProjectileVfx {
  id: number;
  kind: 'projectile' | 'beam' | 'aoe' | 'heal';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  colorPrimary: string;
  colorSecondary: string;
  radiusTiles: number;
  startedAt: number;
  durationMs: number;
}

export interface WorldFloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  isCrit?: boolean;
  startedAt: number;
}

export interface WorldLootSparkle {
  id: number;
  x: number;
  y: number;
  color: string;
  label: string;
  startedAt: number;
}

export interface WorldEmoteBubble {
  uid: string;
  text: string;
  startedAt: number;
}

interface TibiaWorldCanvasProps {
  player: PlayerSaveState;
  derived: DerivedStats;
  playerPosRef: React.MutableRefObject<{
    x: number;
    y: number;
    facing: 'down' | 'up' | 'left' | 'right';
    moving: boolean;
  }>;
  joystickVecRef: React.MutableRefObject<{ dx: number; dy: number }>;
  keysPressedRef: React.MutableRefObject<Set<string>>;
  clickTargetRef: React.MutableRefObject<{ x: number; y: number } | null>;
  monstersRef: React.MutableRefObject<WorldMonsterEntity[]>;
  selectedTargetIdRef: React.MutableRefObject<string | null>;
  projectilesRef: React.MutableRefObject<WorldProjectileVfx[]>;
  floatingTextsRef: React.MutableRefObject<WorldFloatingText[]>;
  lootSparklesRef: React.MutableRefObject<WorldLootSparkle[]>;
  emotesRef: React.MutableRefObject<WorldEmoteBubble[]>;
  nearbyPlayers: OnlinePlayer[];
  highlightedPlayerUid?: string | null;
  worldBoss?: WorldBossState | null;
  selectedWorldBoss?: boolean;
  showFloatingDamage?: boolean;
  isFlying: boolean;
  botEnabled: boolean;
  chestCooldowns?: Record<string, number>;
  lastAttackAtRef?: React.MutableRefObject<number>;
  onSelectMonster: (instanceId: string) => void;
  onSelectWorldBoss?: () => void;
  onSelectPlayer?: (player: OnlinePlayer) => void;
  onOpenChest?: (chest: { id: string; x: number; y: number }) => void;
  onInteractNpc?: (kind: WorldNpcPlacement['kind']) => void;
}

// ============================================================================
// CACHED HIGH-DETAIL 44x44 BIOME TILESET RENDERER
// ============================================================================
const tileCache = new Map<string, HTMLCanvasElement>();

function shadeHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function getBiomeTileCanvas(
  mapId: string,
  tile: TileType,
  alt: boolean,
  variant: number,
  p: WorldPalette
): HTMLCanvasElement {
  const key = `${mapId}:${tile}:${alt ? 1 : 0}:${variant}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = TILE_SIZE;
  c.height = TILE_SIZE;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const isBrickFloor = tile === 'brick' || tile === 'stairs' || tile === 'chest' || tile === 'pillar';

  if (tile === 'water') {
    ctx.fillStyle = p.water;
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = shadeHex(p.water, -24);
    ctx.fillRect(0, 0, TILE_SIZE, 3);
    ctx.fillRect(0, 0, 3, TILE_SIZE);
    ctx.fillStyle = shadeHex(p.water, 28);
    ctx.fillRect(6, 10, 14, 2);
    ctx.fillRect(22, 28, 13, 2);
    tileCache.set(key, c);
    return c;
  }

  if (isBrickFloor) {
    const base = alt ? p.brickA : p.brickB;
    const hi = shadeHex(base, 18);
    const sh = shadeHex(base, -18);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Subtle stone grain + beveled highlight per sub-brick
    ctx.fillStyle = hi;
    ctx.fillRect(1, 1, 20, 2);
    ctx.fillRect(23, 1, 20, 2);
    ctx.fillRect(1, 23, 10, 2);
    ctx.fillRect(13, 23, 20, 2);
    ctx.fillRect(35, 23, 8, 2);

    ctx.fillStyle = sh;
    ctx.fillRect(1, 19, 20, 2);
    ctx.fillRect(23, 19, 20, 2);
    ctx.fillRect(1, 41, 42, 2);

    // Mortar seams
    ctx.fillStyle = p.brickMortar;
    ctx.fillRect(0, 21, TILE_SIZE, 2);
    ctx.fillRect(0, TILE_SIZE - 2, TILE_SIZE, 2);
    ctx.fillRect(21, 0, 2, 21);
    ctx.fillRect(11, 23, 2, 19);
    ctx.fillRect(33, 23, 2, 19);

    if (variant === 0) {
      ctx.fillStyle = sh;
      ctx.fillRect(8, 10, 3, 2);
      ctx.fillRect(28, 31, 4, 2);
    } else if (variant === 1) {
      ctx.fillStyle = hi;
      ctx.fillRect(30, 8, 3, 2);
    }
  } else {
    // Natural biome terrain
    const base = alt ? p.floorA : p.floorB;
    const hi = shadeHex(base, 20);
    const sh = shadeHex(base, -20);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Ground patches
    if (variant === 0) {
      ctx.fillStyle = sh;
      ctx.fillRect(6, 12, 6, 3);
      ctx.fillRect(26, 30, 8, 3);
      ctx.fillStyle = hi;
      ctx.fillRect(8, 10, 2, 3);
      ctx.fillRect(11, 9, 2, 4);
      ctx.fillRect(28, 27, 2, 4);
    } else if (variant === 1) {
      ctx.fillStyle = hi;
      ctx.fillRect(14, 18, 4, 2);
      ctx.fillRect(32, 10, 3, 2);
      // Small biome accent (flower / pebble / alien crystal)
      const isNamek = mapId === 'namekusei' || mapId === 'planeta_kaioh';
      const isCosmic =
        mapId === 'planeta_vegeta' ||
        mapId === 'planeta_freeza' ||
        mapId === 'outro_mundo' ||
        mapId === 'planeta_beerus';
      ctx.fillStyle = isNamek ? '#38bdf8' : isCosmic ? '#c084fc' : '#facc15';
      ctx.fillRect(16, 16, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(17, 15, 1, 1);
    } else if (variant === 2) {
      ctx.fillStyle = sh;
      ctx.fillRect(20, 8, 5, 3);
      ctx.fillStyle = hi;
      ctx.fillRect(10, 32, 5, 2);
      ctx.fillRect(12, 30, 2, 3);
    }
  }

  // Props & Obstacles layered over base tile
  const isNamek = mapId === 'namekusei' || mapId === 'planeta_kaioh';
  const isDesert = mapId === 'deserto_yamcha';
  const isCosmic =
    mapId === 'planeta_vegeta' ||
    mapId === 'planeta_freeza' ||
    mapId === 'outro_mundo' ||
    mapId === 'planeta_beerus';

  if (tile === 'wall') {
    const wHi = shadeHex(p.wallTop, 32);
    const wSh = shadeHex(p.wallFront, -22);
    // Cast ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.fillRect(0, TILE_SIZE - 5, TILE_SIZE, 5);
    // Textured rocky cliff / stone masonry face
    ctx.fillStyle = p.wallFront;
    ctx.fillRect(0, 16, TILE_SIZE, TILE_SIZE - 19);
    ctx.fillStyle = wSh;
    ctx.fillRect(0, 26, TILE_SIZE, 2);
    ctx.fillRect(0, 36, TILE_SIZE, 2);
    ctx.fillRect(14, 17, 2, 9);
    ctx.fillRect(32, 17, 2, 9);
    ctx.fillRect(22, 28, 2, 8);
    // Subtle weathering cracks
    ctx.fillStyle = shadeHex(p.wallFront, 16);
    ctx.fillRect(4, 20, 7, 2);
    ctx.fillRect(26, 30, 8, 2);
    // Top beveled stone cap
    ctx.fillStyle = p.wallTop;
    ctx.fillRect(0, 0, TILE_SIZE, 18);
    ctx.fillStyle = wHi;
    ctx.fillRect(0, 0, TILE_SIZE, 3);
    ctx.fillRect(3, 4, 12, 2);
    ctx.fillStyle = shadeHex(p.wallTop, -24);
    ctx.fillRect(0, 15, TILE_SIZE, 3);
    ctx.fillRect(21, 3, 2, 12);
  } else if (tile === 'tree') {
    const trunkHi = shadeHex(p.treeTrunk, 26);
    const leafHi = shadeHex(p.treeTop, 36);
    const leafSh = shadeHex(p.treeTop, -28);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(22, 39, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isCosmic) {
      // Alien Crystalline Spire
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(22, 2);
      ctx.lineTo(35, 22);
      ctx.lineTo(31, 40);
      ctx.lineTo(13, 40);
      ctx.lineTo(9, 22);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = p.treeTop;
      ctx.beginPath();
      ctx.moveTo(22, 4);
      ctx.lineTo(33, 22);
      ctx.lineTo(29, 38);
      ctx.lineTo(15, 38);
      ctx.lineTo(11, 22);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = leafHi;
      ctx.beginPath();
      ctx.moveTo(22, 5);
      ctx.lineTo(22, 37);
      ctx.lineTo(15, 37);
      ctx.lineTo(12, 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(19, 11, 2, 10);
    } else if (isNamek) {
      // Namekian Bulbous Blue-Green Ajissa Tree
      ctx.fillStyle = '#090d16';
      ctx.fillRect(18, 22, 8, 17);
      ctx.fillStyle = p.treeTrunk;
      ctx.fillRect(19, 23, 6, 15);
      ctx.fillStyle = trunkHi;
      ctx.fillRect(20, 23, 2, 14);

      const blobs = [
        [22, 11, 10],
        [13, 17, 7],
        [31, 17, 7],
        [22, 20, 8],
      ];
      for (const [bx, by, br] of blobs) {
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(bx, by, br + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const [bx, by, br] of blobs) {
        ctx.fillStyle = leafSh;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.treeTop;
        ctx.beginPath();
        ctx.arc(bx - 1, by - 1, br - 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = leafHi;
        ctx.beginPath();
        ctx.arc(bx - 2, by - 2.5, Math.max(2, br * 0.42), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isDesert) {
      // Desert Canyon Palm
      ctx.fillStyle = '#090d16';
      ctx.fillRect(19, 17, 6, 22);
      ctx.fillStyle = p.treeTrunk;
      ctx.fillRect(20, 18, 4, 20);
      ctx.fillStyle = leafSh;
      ctx.beginPath();
      ctx.ellipse(22, 15, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.treeTop;
      ctx.beginPath();
      ctx.ellipse(22, 13, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = leafHi;
      ctx.fillRect(14, 10, 14, 3);
    } else {
      // Lush Layered Pixel Oak Tree
      ctx.fillStyle = '#090d16';
      ctx.fillRect(16, 23, 12, 16);
      ctx.fillRect(14, 35, 16, 4);
      ctx.fillStyle = p.treeTrunk;
      ctx.fillRect(18, 24, 8, 14);
      ctx.fillStyle = trunkHi;
      ctx.fillRect(19, 24, 3, 13);

      const canopy: [number, number, number][] = [
        [22, 14, 13],
        [12, 18, 8],
        [32, 18, 8],
        [22, 9, 9],
      ];
      for (const [cx, cy, cr] of canopy) {
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(cx, cy, cr + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const [cx, cy, cr] of canopy) {
        ctx.fillStyle = leafSh;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const [cx, cy, cr] of canopy) {
        ctx.fillStyle = p.treeTop;
        ctx.beginPath();
        ctx.arc(cx - 1, cy - 1, cr - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = leafHi;
        ctx.beginPath();
        ctx.arc(cx - 2.5, cy - 3, Math.max(2.5, cr * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (tile === 'pillar') {
    const pilHi = shadeHex(p.pillar, 32);
    const pilSh = shadeHex(p.pillar, -38);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(22, 39, 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.fillRect(11, 2, 22, 38);
    ctx.fillStyle = pilSh;
    ctx.fillRect(13, 4, 18, 34);
    ctx.fillStyle = p.pillar;
    ctx.fillRect(14, 4, 13, 34);
    ctx.fillStyle = pilHi;
    ctx.fillRect(15, 6, 4, 28);
    // Fluted column grooves + golden temple cap
    ctx.fillStyle = pilSh;
    ctx.fillRect(21, 9, 2, 22);
    ctx.fillRect(26, 9, 2, 22);
    ctx.fillStyle = pilHi;
    ctx.fillRect(10, 3, 24, 5);
    ctx.fillRect(10, 34, 24, 5);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(12, 8, 20, 2);
  } else if (tile === 'stairs') {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(3, 3, TILE_SIZE - 6, TILE_SIZE - 6);
    ctx.fillStyle = '#5c2d0c';
    ctx.fillRect(5, 5, TILE_SIZE - 10, TILE_SIZE - 10);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#b45309' : '#9a4408';
      ctx.fillRect(7, 7 + i * 6, TILE_SIZE - 14, 4);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(7, 7 + i * 6, TILE_SIZE - 14, 1);
    }
    ctx.fillStyle = '#d97706';
    ctx.fillRect(5, 5, 3, TILE_SIZE - 10);
    ctx.fillRect(TILE_SIZE - 8, 5, 3, TILE_SIZE - 10);
  } else if (tile === 'chest') {
    // Ornate Domed RPG Treasure Chest with Brass Corner Straps & Ruby Lock
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(22, 35, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.fillRect(7, 10, 30, 25);
    ctx.fillRect(9, 8, 26, 4);
    // Wood planks
    ctx.fillStyle = '#78350f';
    ctx.fillRect(9, 12, 26, 21);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(10, 10, 24, 9);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(11, 11, 22, 3);
    // Brass bands & rivets
    ctx.fillStyle = '#facc15';
    ctx.fillRect(9, 19, 26, 3);
    ctx.fillRect(12, 10, 3, 23);
    ctx.fillRect(29, 10, 3, 23);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(12, 11, 2, 2);
    ctx.fillRect(30, 11, 2, 2);
    // Ornate clasp & ruby gem
    ctx.fillStyle = '#fde047';
    ctx.fillRect(19, 18, 6, 7);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(21, 20, 2, 3);
  }

  tileCache.set(key, c);
  return c;
}

// ============================================================================
// ENTITY & NPC RENDERERS
// ============================================================================
function drawPixelWarrior(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  race: RaceId,
  transformationId: string,
  facing: FacingDir,
  walkTick: number,
  moving: boolean,
  isTraining: boolean,
  isFlying = false,
  isFused = false,
  attackProgress = 0
) {
  const tf = getTransformationById(transformationId);
  const transformed = tf.id !== 'base';
  const flyLift = isFlying ? 24 + Math.sin(walkTick * 0.14) * 3.0 : 0;
  const bob = moving
    ? Math.sin(walkTick * 0.45) * 1.8
    : Math.sin(walkTick * 0.11) * 0.9;
  const walkPhase = Math.floor(walkTick / 5) % 4;
  const walkFrame: 0 | 1 | 2 | 3 = isFlying
    ? 0
    : !moving
    ? 0
    : (walkPhase as 0 | 1 | 2 | 3);

  // Attack dash offset toward facing direction
  const atkCurve = attackProgress > 0 ? Math.sin(attackProgress * Math.PI) : 0;
  const atkDirX = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const atkDirY = facing === 'up' ? -1 : facing === 'down' ? 1 : 0;

  const px = Math.round(sx + atkDirX * 7 * atkCurve);
  const py = Math.round(sy + bob - flyLift + atkDirY * 5 * atkCurve);

  // Ground drop shadow (wider soft shadow when riding Nuvem Voadora)
  ctx.fillStyle = isFlying ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.48)';
  ctx.beginPath();
  ctx.ellipse(
    Math.round(sx),
    Math.round(sy) + 18,
    isFlying ? 14 : 15,
    isFlying ? 5 : 6,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Ground dust puffs when running on foot
  if (moving && !isFlying) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const pPhase = (walkTick * 0.18 + i * 0.33) % 1;
      const trailX = px - atkDirX * (6 + pPhase * 12) + (i - 1) * 4;
      const trailY = Math.round(sy) + 15 - pPhase * 5;
      ctx.globalAlpha = (1 - pPhase) * 0.45;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(Math.round(trailX), Math.round(trailY), 3, 2);
    }
    ctx.restore();
  }

  // Nuvem Voadora (Golden Kinto-un) mount & trailing cloud wisps when flying
  if (isFlying) {
    const cloudFrame = (Math.floor(walkTick / 6) % 3) as 0 | 1 | 2;
    const nimbus = getNuvemVoadoraCanvas(cloudFrame);
    // Warm golden glow under the Nuvem Voadora
    ctx.save();
    ctx.globalAlpha = 0.34 + Math.sin(walkTick * 0.2) * 0.1;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(px, py + 23, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trailing Nimbus golden puffs when moving
    if (moving) {
      for (let i = 0; i < 4; i++) {
        const tPhase = (walkTick * 0.14 + i * 0.25) % 1;
        const cx = px - (facing === 'left' ? -1 : 1) * (10 + tPhase * 22);
        const cy = py + 21 + Math.sin(i + walkTick * 0.2) * 2;
        ctx.globalAlpha = (1 - tPhase) * 0.65;
        ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#fef08a';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1.5, 4.5 * (1 - tPhase)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(nimbus, Math.round(px - 28), Math.round(py + 6), 56, 32);
  }

  // Fusion Aura (Gold & Cyan Potara/Metamoru swirl)
  if (isFused) {
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(walkTick * 0.28) * 0.15;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(px, py + 2, 24, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(px, py + 2, 20, 24, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Layered Ki Aura + Rising Energy Sparks + SSJ Lightning Crackles
  if (transformed || isTraining) {
    const pulse = 0.28 + Math.sin(walkTick * 0.22) * 0.12;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = tf.auraColor;
    ctx.beginPath();
    ctx.ellipse(px, py + 2, 24, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = Math.min(0.9, pulse + 0.3);
    for (let i = 0; i < 5; i++) {
      const phase = (walkTick * 0.08 + i * 1.3) % 1;
      const ox = Math.sin(i * 2.4 + walkTick * 0.15) * 17;
      const oy = 14 - phase * 36;
      ctx.fillStyle = i % 2 === 0 ? tf.auraColor : '#ffffff';
      ctx.fillRect(Math.round(px + ox), Math.round(py + oy), 2, 3);
    }

    // Electric arcs for high transformations (SSJ2+)
    if (tf.powerMultiplier >= 4 && Math.floor(walkTick / 3) % 2 === 0) {
      ctx.strokeStyle = tf.id === 'ultra_instinct' || tf.id === 'yamcha_ui' ? '#e0f2fe' : '#fef08a';
      ctx.lineWidth = 1.4;
      const arcSide = Math.floor(walkTick / 3) % 4 < 2 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(px + arcSide * 14, py - 18);
      ctx.lineTo(px + arcSide * 21, py - 6);
      ctx.lineTo(px + arcSide * 16, py + 3);
      ctx.lineTo(px + arcSide * 22, py + 14);
      ctx.stroke();
    }
    ctx.restore();
  }

  const sprite = getWarriorSpriteCanvas(race, transformationId, facing, walkFrame, isFused);
  const drawSize = sprite.width; // 72px 1:1 pixel parity for LOG sprites!
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Subtle squash/stretch + stride tilt around feet pivot for lively 2D animation
  const breathScaleY = !moving && !isFlying ? 1 + Math.sin(walkTick * 0.11) * 0.024 : 1;
  const strideTilt = isFlying && moving
    ? (facing === 'left' ? -0.08 : facing === 'right' ? 0.08 : 0)
    : moving
    ? Math.sin(walkTick * 0.45) * 0.045
    : 0;
  const footAnchorY = py + Math.round(drawSize * 0.36);
  ctx.translate(px, footAnchorY);
  if (strideTilt !== 0) ctx.rotate(strideTilt);
  ctx.scale(1 + atkCurve * 0.08, breathScaleY - atkCurve * 0.05);
  ctx.drawImage(
    sprite,
    Math.round(-drawSize / 2),
    Math.round(-drawSize * 0.86) - 4,
    drawSize,
    drawSize
  );
  ctx.restore();

  // Melee / Ki Strike Crescent Burst during Attack Animation
  if (atkCurve > 0.12) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.95, atkCurve);
    const hitX = px + atkDirX * 22;
    const hitY = py + atkDirY * 14 - 4;
    ctx.strokeStyle = transformed ? tf.auraColor : '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hitX, hitY, 13 * atkCurve + 4, -0.9, 0.9);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hitX, hitY, 10 * atkCurve + 2, -0.7, 0.7);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPixelMonster(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  m: WorldMonsterEntity,
  now: number,
  isTarget: boolean
) {
  const sizeScale = m.isBoss ? 1.38 : 1.0;
  const flash = now < m.hitFlashUntil;
  const bob = Math.sin(now * 0.005 + m.patrolPhase) * 1.8;
  const px = Math.round(sx);
  const py = Math.round(sy + bob);

  const sprite = getMonsterSpriteCanvas(
    m.def.archetype,
    m.def.colorPrimary,
    m.def.colorSecondary,
    m.isBoss,
    flash
  );
  const drawSize = m.isBoss ? Math.round(sprite.width * 1.32) : sprite.width;

  if (isTarget) {
    const box = Math.round(drawSize * 0.44);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(px - box, py - box, box * 2, box * 2);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.beginPath();
  ctx.ellipse(
    px,
    Math.round(sy) + Math.round(16 * sizeScale),
    14 * sizeScale,
    5.5 * sizeScale,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  if (m.isBoss) {
    ctx.save();
    ctx.globalAlpha = 0.28 + Math.sin(now * 0.006) * 0.1;
    ctx.fillStyle = m.def.colorPrimary;
    ctx.beginPath();
    ctx.ellipse(px, py, 30, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sprite,
    Math.round(px - drawSize / 2),
    Math.round(py - drawSize / 2) - 4,
    drawSize,
    drawSize
  );

  const barW = Math.round(50 * (m.isBoss ? 1.3 : 1));
  const barY = py - Math.round(drawSize / 2) - 10;
  ctx.font = m.isBoss ? 'bold 11px Outfit, sans-serif' : '600 10px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(11, 15, 23, 0.85)';
  ctx.fillRect(px - barW / 2 - 8, barY - 14, barW + 16, 13);
  ctx.fillStyle = m.isBoss ? '#facc15' : '#f1f5f9';
  ctx.fillText(m.def.name, px, barY - 4);

  ctx.fillStyle = '#090d16';
  ctx.fillRect(px - barW / 2 - 1, barY - 1, barW + 2, 6);
  const pct = Math.max(0, Math.min(1, m.hp / Math.max(1, m.maxHp)));
  ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#facc15' : '#ef4444';
  ctx.fillRect(px - barW / 2, barY, Math.round(barW * pct), 4);
}

// ============================================================================
// MAIN 2D WORLD CANVAS COMPONENT
// ============================================================================
export const TibiaWorldCanvas: React.FC<TibiaWorldCanvasProps> = ({
  player,
  derived,
  playerPosRef,
  joystickVecRef,
  keysPressedRef,
  clickTargetRef,
  monstersRef,
  selectedTargetIdRef,
  projectilesRef,
  floatingTextsRef,
  lootSparklesRef,
  emotesRef,
  nearbyPlayers,
  highlightedPlayerUid = null,
  worldBoss = null,
  selectedWorldBoss = false,
  showFloatingDamage = true,
  isFlying,
  botEnabled,
  chestCooldowns = {},
  lastAttackAtRef,
  onSelectMonster,
  onSelectWorldBoss,
  onSelectPlayer,
  onOpenChest,
  onInteractNpc,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const remoteInterpRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const petPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const propsRef = useRef({
    player,
    derived,
    nearbyPlayers,
    highlightedPlayerUid,
    worldBoss,
    selectedWorldBoss,
    showFloatingDamage,
    isFlying,
    botEnabled,
    chestCooldowns,
  });
  propsRef.current = {
    player,
    derived,
    nearbyPlayers,
    highlightedPlayerUid,
    worldBoss,
    selectedWorldBoss,
    showFloatingDamage,
    isFlying,
    botEnabled,
    chestCooldowns,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();
    let walkTick = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const {
        player: p,
        derived: d,
        nearbyPlayers: others,
        highlightedPlayerUid: hlUid,
        worldBoss: wb,
        selectedWorldBoss: selWb,
        showFloatingDamage: showDmg,
        isFlying: rawFlying,
        botEnabled: isBot,
        chestCooldowns: chestCds,
      } = propsRef.current;
      const flying = Boolean(rawFlying && p.level >= 200);
      const grid = getWorldMapGrid(p.currentMapId);
      const pos = playerPosRef.current;

      // Safety snap on landing
      if (!flying && !isTileWalkable(grid, Math.floor(pos.x), Math.floor(pos.y))) {
        let bestX = grid.spawnTile.x + 0.5;
        let bestY = grid.spawnTile.y + 0.5;
        let bestDist = Infinity;
        for (let r = 1; r <= 6; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const tx = Math.floor(pos.x) + dx;
              const ty = Math.floor(pos.y) + dy;
              if (isTileWalkable(grid, tx, ty)) {
                const dist = Math.hypot(dx, dy);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestX = tx + 0.5;
                  bestY = ty + 0.5;
                }
              }
            }
          }
          if (bestDist < Infinity) break;
        }
        pos.x = bestX;
        pos.y = bestY;
      }

      // 1. Movement Input
      let vx = joystickVecRef.current.dx;
      let vy = joystickVecRef.current.dy;

      const keys = keysPressedRef.current;
      if (keys.has('KeyW') || keys.has('ArrowUp')) vy -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) vy += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) vx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) vx += 1;

      if (Math.abs(vx) > 0.08 || Math.abs(vy) > 0.08) {
        clickTargetRef.current = null;
      } else if (clickTargetRef.current) {
        const dx = clickTargetRef.current.x - pos.x;
        const dy = clickTargetRef.current.y - pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.15) {
          clickTargetRef.current = null;
        } else {
          vx = dx / dist;
          vy = dy / dist;
        }
      } else if (isBot && p.activityMode === 'combat') {
        const alive = monstersRef.current.filter((m) => m.hp > 0);
        const target = alive.find((m) => m.instanceId === selectedTargetIdRef.current) ?? alive[0];
        if (target) {
          const dx = target.x - pos.x;
          const dy = target.y - pos.y;
          const dist = Math.hypot(dx, dy);
          const desiredRange = flying ? 4.2 : 1.35;
          if (dist > desiredRange) {
            vx = dx / dist;
            vy = dy / dist;
          }
        }
      }

      const len = Math.hypot(vx, vy);
      if (len > 0.05) {
        const baseSpeed = Math.min(6.4, 3.3 + d.speed / 120);
        const moveSpeed = flying ? baseSpeed * 1.35 : baseSpeed;
        const nx = (vx / Math.max(1, len)) * moveSpeed * dt;
        const ny = (vy / Math.max(1, len)) * moveSpeed * dt;

        const tryX = pos.x + nx;
        const tryY = pos.y + ny;

        const canMove = flying ? isTileFlyable : isTileWalkable;
        if (canMove(grid, Math.floor(tryX), Math.floor(pos.y))) pos.x = tryX;
        if (canMove(grid, Math.floor(pos.x), Math.floor(tryY))) pos.y = tryY;

        if (Math.abs(vx) >= Math.abs(vy)) pos.facing = vx >= 0 ? 'right' : 'left';
        else pos.facing = vy >= 0 ? 'down' : 'up';
        pos.moving = true;
        walkTick += 1;
      } else {
        pos.moving = false;
        walkTick += 0.3;
      }

      // 2. Monster Patrol / Chase Update
      const realNow = Date.now();
      for (const m of monstersRef.current) {
        if (m.hp <= 0) {
          if (realNow >= m.respawnAt && !m.isBoss) {
            m.hp = m.maxHp;
            m.x = m.spawnX;
            m.y = m.spawnY;
          }
          continue;
        }
        const distToPlayer = Math.hypot(pos.x - m.x, pos.y - m.y);
        if (distToPlayer < 6.5 && distToPlayer > 1.15) {
          const chaseSpeed = m.isBoss ? 1.85 : 1.45;
          const cx = ((pos.x - m.x) / distToPlayer) * chaseSpeed * dt;
          const cy = ((pos.y - m.y) / distToPlayer) * chaseSpeed * dt;
          if (isTileWalkable(grid, Math.floor(m.x + cx), Math.floor(m.y))) m.x += cx;
          if (isTileWalkable(grid, Math.floor(m.x), Math.floor(m.y + cy))) m.y += cy;
        } else if (distToPlayer >= 6.5) {
          const tx = m.spawnX + Math.cos(realNow * 0.0008 + m.patrolPhase) * 1.6;
          const ty = m.spawnY + Math.sin(realNow * 0.0008 + m.patrolPhase) * 1.6;
          const pdx = tx - m.x;
          const pdy = ty - m.y;
          const pdist = Math.hypot(pdx, pdy);
          if (pdist > 0.2) {
            const mx = (pdx / pdist) * 0.8 * dt;
            const my = (pdy / pdist) * 0.8 * dt;
            if (isTileWalkable(grid, Math.floor(m.x + mx), Math.floor(m.y))) m.x += mx;
            if (isTileWalkable(grid, Math.floor(m.x), Math.floor(m.y + my))) m.y += my;
          }
        }
      }

      // 3. Render World Biome Tiles
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.fillStyle = '#070a10';
      ctx.fillRect(0, 0, cw, ch);

      const camX = pos.x * TILE_SIZE - cw / 2;
      const camY = pos.y * TILE_SIZE - ch / 2;

      const startTX = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
      const endTX = Math.min(grid.width - 1, Math.ceil((camX + cw) / TILE_SIZE) + 1);
      const startTY = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
      const endTY = Math.min(grid.height - 1, Math.ceil((camY + ch) / TILE_SIZE) + 1);

      ctx.imageSmoothingEnabled = false;
      for (let ty = startTY; ty <= endTY; ty++) {
        for (let tx = startTX; tx <= endTX; tx++) {
          const tile = grid.tiles[ty][tx];
          const sx = Math.round(tx * TILE_SIZE - camX);
          const sy = Math.round(ty * TILE_SIZE - camY);
          const variant = (tx * 7 + ty * 13) % 4;
          const tileCanvas = getBiomeTileCanvas(grid.mapId, tile, (tx + ty) % 2 === 0, variant, grid.palette);
          ctx.drawImage(tileCanvas, sx, sy);

          if (tile === 'water') {
            const waveShift = Math.sin(realNow * 0.004 + tx + ty) * 4;
            ctx.fillStyle = 'rgba(255,255,255,0.28)';
            ctx.fillRect(Math.round(sx + 10 + waveShift), sy + 16, 12, 2);
            ctx.fillRect(Math.round(sx + 18 - waveShift), sy + 30, 10, 2);
          }
        }
      }

      // 3B. Interactive Plaza NPCs
      for (const npc of grid.npcs) {
        const nsx = Math.round((npc.x + 0.5) * TILE_SIZE - camX);
        const nsy = Math.round((npc.y + 0.5) * TILE_SIZE - camY);
        if (nsx < -60 || nsx > cw + 60 || nsy < -60 || nsy > ch + 60) continue;

        const npcBob = Math.sin(realNow * 0.004 + npc.x) * 1.4;
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.beginPath();
        ctx.ellipse(nsx, nsy + 18, 13, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        const npcSprite = getNpcSpriteCanvas(npc.kind);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(npcSprite, nsx - 27, Math.round(nsy - 31 + npcBob), 54, 54);

        ctx.font = 'bold 10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        const label = npc.name;
        const tw = ctx.measureText(label).width + 12;
        ctx.fillStyle = 'rgba(11,15,23,0.88)';
        ctx.fillRect(nsx - tw / 2, nsy - 42, tw, 13);
        ctx.fillStyle = '#fde047';
        ctx.fillText(label, nsx, nsy - 32);

        ctx.font = '600 8px Outfit, sans-serif';
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(npc.subtitle, nsx, nsy + 29);
      }

      // 3C. Interactive Treasure Chest Overlays
      for (const chest of grid.chests) {
        const csx = Math.round((chest.x + 0.5) * TILE_SIZE - camX);
        const csy = Math.round((chest.y + 0.5) * TILE_SIZE - camY);
        if (csx < -50 || csx > cw + 50 || csy < -50 || csy > ch + 50) continue;

        const readyAt = chestCds[chest.id] ?? 0;
        const remainingMs = Math.max(0, readyAt - realNow);
        const distChest = Math.hypot(chest.x + 0.5 - pos.x, chest.y + 0.5 - pos.y);
        const inReach = distChest <= (flying ? 4.2 : 2.35);

        if (remainingMs <= 0) {
          ctx.save();
          ctx.strokeStyle = '#facc15';
          ctx.globalAlpha = 0.45 + Math.sin(realNow * 0.007) * 0.25;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(csx, csy, 19 + Math.sin(realNow * 0.006) * 2.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          ctx.font = 'bold 9px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(11,15,23,0.88)';
          const label = inReach ? '[E] ABRIR BAÚ' : 'BAÚ';
          const tw = ctx.measureText(label).width + 10;
          ctx.fillRect(csx - tw / 2, csy - 30, tw, 13);
          ctx.fillStyle = '#fde047';
          ctx.fillText(label, csx, csy - 20);
        } else {
          const totalSec = Math.ceil(remainingMs / 1000);
          const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
          const ss = String(totalSec % 60).padStart(2, '0');
          ctx.fillStyle = 'rgba(9,13,22,0.45)';
          ctx.fillRect(csx - 14, csy - 10, 28, 22);
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(11,15,23,0.84)';
          ctx.fillRect(csx - 19, csy - 29, 38, 12);
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`${mm}:${ss}`, csx, csy - 20);
        }
      }

      // 4. Loot Sparkles on Map
      lootSparklesRef.current = lootSparklesRef.current.filter((l) => realNow - l.startedAt < 2400);
      for (const loot of lootSparklesRef.current) {
        const age = (realNow - loot.startedAt) / 2400;
        const lx = Math.round(loot.x * TILE_SIZE - camX);
        const ly = Math.round(loot.y * TILE_SIZE - camY - age * 14);
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age);
        ctx.fillStyle = loot.color;
        ctx.fillRect(lx - 4, ly - 4, 8, 8);
        ctx.font = 'bold 10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(loot.label, lx, ly - 8);
        ctx.restore();
      }

      // 5. Other Online Players + Their Follower Pets
      const activeRemoteUids = new Set<string>();
      for (const other of others) {
        activeRemoteUids.add(other.uid);
        const targetX = typeof other.x === 'number' ? other.x : grid.spawnTile.x + 2;
        const targetY = typeof other.y === 'number' ? other.y : grid.spawnTile.y;

        let cur = remoteInterpRef.current.get(other.uid);
        if (!cur || Math.hypot(targetX - cur.x, targetY - cur.y) > 14) {
          cur = { x: targetX, y: targetY };
        } else {
          const lerpAlpha = Math.min(1, dt * 8);
          cur.x += (targetX - cur.x) * lerpAlpha;
          cur.y += (targetY - cur.y) * lerpAlpha;
        }
        remoteInterpRef.current.set(other.uid, cur);

        const osx = Math.round(cur.x * TILE_SIZE - camX);
        const osy = Math.round(cur.y * TILE_SIZE - camY);

        if (osx < 16 || osx > cw - 16 || osy < 60 || osy > ch - 20) {
          const cxScreen = cw / 2;
          const cyScreen = ch / 2;
          const angle = Math.atan2(osy - cyScreen, osx - cxScreen);
          const margin = 44;
          const edgeX = Math.max(margin, Math.min(cw - margin, cxScreen + Math.cos(angle) * (cw * 0.42)));
          const edgeY = Math.max(115, Math.min(ch - 95, cyScreen + Math.sin(angle) * (ch * 0.36)));

          ctx.save();
          ctx.translate(edgeX, edgeY);
          ctx.rotate(angle);
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(-7, -6);
          ctx.lineTo(-4, 0);
          ctx.lineTo(-7, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          ctx.font = 'bold 10px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(11,15,23,0.85)';
          ctx.fillRect(edgeX - 38, edgeY + 10, 76, 14);
          ctx.fillStyle = '#7dd3fc';
          ctx.fillText(other.name.slice(0, 12), edgeX, edgeY + 20);
          continue;
        }

        // Draw remote pet companion
        if (other.petId) {
          const pKey = other.uid;
          let rPet = petPosRef.current.get(pKey);
          const pTargetX = cur.x - 0.85;
          const pTargetY = cur.y + 0.55;
          if (!rPet || Math.hypot(pTargetX - rPet.x, pTargetY - rPet.y) > 8) {
            rPet = { x: pTargetX, y: pTargetY };
          } else {
            rPet.x += (pTargetX - rPet.x) * Math.min(1, dt * 4.5);
            rPet.y += (pTargetY - rPet.y) * Math.min(1, dt * 4.5);
          }
          petPosRef.current.set(pKey, rPet);
          const rpsx = Math.round(rPet.x * TILE_SIZE - camX);
          const rpsy = Math.round(rPet.y * TILE_SIZE - camY + Math.sin(realNow * 0.007) * 2.5);
          ctx.drawImage(getPetSpriteCanvas(other.petId), rpsx - 16, rpsy - 16, 32, 32);
        }

        if (hlUid === other.uid) {
          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(osx, osy, 26 + Math.sin(realNow * 0.01) * 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        const remoteFlying = Boolean(other.isFlying && other.level >= 200);
        const remoteLift = remoteFlying ? 24 : 0;
        const remoteFused = Boolean(other.isFused);

        drawPixelWarrior(
          ctx,
          osx,
          osy,
          other.race,
          other.transformationId,
          other.facing ?? 'down',
          walkTick,
          Boolean(other.moving),
          other.activityMode === 'training',
          remoteFlying,
          remoteFused
        );

        const tagPrefix = other.guildTag ? `[${other.guildTag}] ` : '';
        const nameLabel = `${remoteFlying ? '☁ ' : ''}${tagPrefix}${other.name} · Nv.${other.level}`;
        ctx.font = '600 10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        const nw = Math.max(94, ctx.measureText(nameLabel).width + 14);
        ctx.fillStyle = 'rgba(11,15,23,0.86)';
        ctx.fillRect(osx - nw / 2, osy - 44 - remoteLift, nw, 14);
        ctx.fillStyle = remoteFused
          ? '#fde047'
          : other.partyId && p.partyId && other.partyId === p.partyId
          ? '#4ade80'
          : '#38bdf8';
        ctx.fillText(nameLabel, osx, osy - 33 - remoteLift);
      }
      for (const cachedUid of remoteInterpRef.current.keys()) {
        if (!activeRemoteUids.has(cachedUid)) {
          remoteInterpRef.current.delete(cachedUid);
          petPosRef.current.delete(cachedUid);
        }
      }

      // 6. Monsters & Map Boss
      for (const m of monstersRef.current) {
        if (m.hp <= 0) continue;
        const msx = Math.round(m.x * TILE_SIZE - camX);
        const msy = Math.round(m.y * TILE_SIZE - camY);
        if (msx < -60 || msx > cw + 60 || msy < -60 || msy > ch + 60) continue;
        drawPixelMonster(
          ctx,
          msx,
          msy,
          m,
          realNow,
          selectedTargetIdRef.current === m.instanceId
        );
      }

      // 6B. Global World Boss Entity (Shared Multiplayer Raid Boss)
      if (wb && wb.status === 'active' && wb.mapId === p.currentMapId && wb.hp > 0) {
        const wbx = (grid.bossAltar.x + 2.2) * TILE_SIZE - camX;
        const wby = (grid.bossAltar.y + 1.5) * TILE_SIZE - camY + Math.sin(realNow * 0.004) * 3;
        const wbPx = Math.round(wbx);
        const wbPy = Math.round(wby);
        if (wbPx > -90 && wbPx < cw + 90 && wbPy > -90 && wbPy < ch + 90) {
          ctx.save();
          ctx.globalAlpha = 0.34 + Math.sin(realNow * 0.007) * 0.14;
          ctx.fillStyle = wb.colorPrimary;
          ctx.beginPath();
          ctx.ellipse(wbPx, wbPy, 42, 46, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          if (selWb) {
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 3;
            ctx.strokeRect(wbPx - 42, wbPy - 42, 84, 84);
          }

          const wbSprite = getMonsterSpriteCanvas(
            wb.archetype,
            wb.colorPrimary,
            wb.colorSecondary,
            true,
            false
          );
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(wbSprite, wbPx - 46, wbPy - 48, 92, 92);

          ctx.font = 'bold 11px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(11,15,23,0.9)';
          ctx.fillRect(wbPx - 76, wbPy - 68, 152, 16);
          ctx.fillStyle = '#f472b6';
          ctx.fillText(`WORLD BOSS · ${wb.name}`, wbPx, wbPy - 56);

          const pct = Math.max(0, Math.min(1, wb.hp / Math.max(1, wb.maxHp)));
          ctx.fillStyle = '#090d16';
          ctx.fillRect(wbPx - 58, wbPy - 50, 116, 7);
          ctx.fillStyle = '#ec4899';
          ctx.fillRect(wbPx - 57, wbPy - 49, Math.round(114 * pct), 5);
        }
      }

      // 7. Local Player Companion Pet (trailing smoothly behind warrior)
      if (p.activePetId) {
        let myPet = petPosRef.current.get('__local__');
        const offsetX = pos.facing === 'right' ? -0.95 : pos.facing === 'left' ? 0.95 : -0.8;
        const offsetY = pos.facing === 'down' ? -0.75 : pos.facing === 'up' ? 0.9 : 0.45;
        const targetPX = pos.x + offsetX;
        const targetPY = pos.y + offsetY;
        if (!myPet || Math.hypot(targetPX - myPet.x, targetPY - myPet.y) > 8) {
          myPet = { x: targetPX, y: targetPY };
        } else {
          myPet.x += (targetPX - myPet.x) * Math.min(1, dt * 5);
          myPet.y += (targetPY - myPet.y) * Math.min(1, dt * 5);
        }
        petPosRef.current.set('__local__', myPet);
        const petSx = Math.round(myPet.x * TILE_SIZE - camX);
        const petSy = Math.round(myPet.y * TILE_SIZE - camY + Math.sin(realNow * 0.008) * 3);
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(petSx, petSy + 14, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(getPetSpriteCanvas(p.activePetId), petSx - 17, petSy - 19, 34, 34);
      }

      // 8. Main Player Sprite + Tibia Curved HP/Ki Arcs
      const psx = Math.round(pos.x * TILE_SIZE - camX);
      const psy = Math.round(pos.y * TILE_SIZE - camY);
      const hudLift = flying ? 24 : 0;
      const atkElapsed = lastAttackAtRef ? realNow - lastAttackAtRef.current : 9999;
      const attackProgress = atkElapsed >= 0 && atkElapsed < 240 ? atkElapsed / 240 : 0;

      drawPixelWarrior(
        ctx,
        psx,
        psy,
        p.race,
        p.transformationId,
        pos.facing,
        walkTick,
        pos.moving,
        p.activityMode === 'training',
        flying,
        d.isFused,
        attackProgress
      );

      const hpRatio = Math.max(0, Math.min(1, p.currentHp / Math.max(1, d.maxHp)));
      const kiRatio = Math.max(0, Math.min(1, p.currentKi / Math.max(1, d.maxKi)));
      const arcY = psy - hudLift;

      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.arc(psx, arcY, 34, Math.PI * 0.7, Math.PI * 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(psx, arcY, 34, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();

      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(psx, arcY, 34, Math.PI * 1.3 - Math.PI * 0.6 * hpRatio, Math.PI * 1.3);
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(psx, arcY, 34, Math.PI * 0.3 - Math.PI * 0.6 * kiRatio, Math.PI * 0.3);
      ctx.stroke();

      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillStyle = '#fca5a5';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(hpRatio * 100)}%`, psx - 39, arcY + 3);
      ctx.fillStyle = '#7dd3fc';
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(kiRatio * 100)}%`, psx + 39, arcY + 3);

      const myTag = p.guildTag ? `[${p.guildTag}] ` : '';
      const myTitle = (d.isFused ? '⚡ FUSÃO · ' : flying ? '☁ ' : '') + p.title.slice(0, 18);
      ctx.textAlign = 'center';
      const titleW = Math.max(88, ctx.measureText(myTitle).width + 12);
      ctx.fillStyle = 'rgba(11, 15, 23, 0.8)';
      ctx.fillRect(psx - titleW / 2, arcY - 50, titleW, 13);
      ctx.font = '600 9px Outfit, sans-serif';
      ctx.fillStyle = d.isFused ? '#fde047' : flying ? '#fde047' : '#e2e8f0';
      ctx.fillText(myTitle, psx, arcY - 40);

      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${myTag}${p.name}`, psx, arcY - 26);

      // 9. Projectiles, Beams & AoE Shockwaves
      projectilesRef.current = projectilesRef.current.filter(
        (v) => realNow - v.startedAt < v.durationMs
      );
      for (const vfx of projectilesRef.current) {
        const t = Math.min(1, (realNow - vfx.startedAt) / vfx.durationMs);
        const fx = vfx.fromX * TILE_SIZE - camX;
        const fy = vfx.fromY * TILE_SIZE - camY;
        const tx = vfx.toX * TILE_SIZE - camX;
        const ty = vfx.toY * TILE_SIZE - camY;

        if (vfx.kind === 'projectile') {
          const cx = fx + (tx - fx) * t;
          const cy = fy + (ty - fy) * t;
          ctx.fillStyle = vfx.colorPrimary;
          ctx.beginPath();
          ctx.arc(cx, cy, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = vfx.colorSecondary;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (vfx.kind === 'beam') {
          ctx.save();
          ctx.globalAlpha = 1 - t * 0.75;
          ctx.strokeStyle = vfx.colorPrimary;
          ctx.lineWidth = 10 * (1 - t * 0.4);
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.strokeStyle = vfx.colorSecondary;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.restore();
        } else if (vfx.kind === 'aoe' || vfx.kind === 'heal') {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = vfx.colorPrimary;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(fx, fy, Math.max(12, vfx.radiusTiles * TILE_SIZE * t), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 10. Floating Damage Popups
      floatingTextsRef.current = floatingTextsRef.current.filter(
        (ft) => realNow - ft.startedAt < 900
      );
      if (showDmg) {
        for (const ft of floatingTextsRef.current) {
          const age = (realNow - ft.startedAt) / 900;
          const fx = Math.round(ft.x * TILE_SIZE - camX);
          const fy = Math.round(ft.y * TILE_SIZE - camY - 26 - age * 28);
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - age);
          ctx.font = ft.isCrit
            ? 'bold 14px Silkscreen, monospace'
            : 'bold 11px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#090d16';
          ctx.fillText(ft.text, fx + 1, fy + 1);
          ctx.fillStyle = ft.color;
          ctx.fillText(ft.text, fx, fy);
          ctx.restore();
        }
      }

      // 11. Emote / Speech Bubbles
      emotesRef.current = emotesRef.current.filter((em) => realNow - em.startedAt < 3400);
      for (const em of emotesRef.current) {
        let ex = psx;
        let ey = psy - 60 - hudLift;
        if (em.uid !== p.uid) {
          const interp = remoteInterpRef.current.get(em.uid);
          if (!interp) continue;
          ex = Math.round(interp.x * TILE_SIZE - camX);
          ey = Math.round(interp.y * TILE_SIZE - camY - 58);
        }
        ctx.save();
        ctx.font = 'bold 10px Outfit, sans-serif';
        const tw = Math.min(140, ctx.measureText(em.text).width + 14);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(ex - tw / 2, ey - 14, tw, 17);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ex - tw / 2, ey - 14, tw, 17);
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(em.text, ex, ey - 2);
        ctx.restore();
      }

      // 12. Subtle Ambient Ki / Biome Motes
      ctx.save();
      for (let i = 0; i < 8; i++) {
        const mx = ((i * 197 + realNow * 0.014) % cw);
        const my = ((i * 149 + Math.sin(realNow * 0.001 + i) * 30 + realNow * 0.009) % ch);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = grid.palette.pillar;
        ctx.fillRect(Math.round(mx), Math.round(my), 2, 2);
      }
      ctx.restore();

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const pos = playerPosRef.current;
    const camX = pos.x * TILE_SIZE - canvas.width / 2;
    const camY = pos.y * TILE_SIZE - canvas.height / 2;

    const worldX = (cx + camX) / TILE_SIZE;
    const worldY = (cy + camY) / TILE_SIZE;

    const grid = getWorldMapGrid(propsRef.current.player.currentMapId);

    // 1. Check World Boss click
    const wb = propsRef.current.worldBoss;
    if (
      onSelectWorldBoss &&
      wb &&
      wb.status === 'active' &&
      wb.mapId === propsRef.current.player.currentMapId &&
      wb.hp > 0
    ) {
      const wbDist = Math.hypot(grid.bossAltar.x + 2.2 - worldX, grid.bossAltar.y + 1.5 - worldY);
      if (wbDist < 1.6) {
        onSelectWorldBoss();
        return;
      }
    }

    // 2. Check Plaza NPC click
    if (onInteractNpc) {
      const clickedNpc = grid.npcs.find(
        (n) => Math.hypot(n.x + 0.5 - worldX, n.y + 0.5 - worldY) < 0.95
      );
      if (clickedNpc) {
        onInteractNpc(clickedNpc.kind);
        return;
      }
    }

    // 3. Check Online Player click
    if (onSelectPlayer) {
      let clickedPlayer: OnlinePlayer | null = null;
      let bestPlayerDist = 1.1;
      for (const op of propsRef.current.nearbyPlayers) {
        const interp = remoteInterpRef.current.get(op.uid);
        const px = interp?.x ?? op.x ?? 0;
        const py = interp?.y ?? op.y ?? 0;
        const dist = Math.hypot(px - worldX, py - worldY);
        if (dist < bestPlayerDist) {
          bestPlayerDist = dist;
          clickedPlayer = op;
        }
      }
      if (clickedPlayer) {
        onSelectPlayer(clickedPlayer);
        return;
      }
    }

    // 4. Check Monster click
    let clickedMonster: WorldMonsterEntity | null = null;
    let bestDist = 1.25;
    for (const m of monstersRef.current) {
      if (m.hp <= 0) continue;
      const dist = Math.hypot(m.x - worldX, m.y - worldY);
      if (dist < bestDist) {
        bestDist = dist;
        clickedMonster = m;
      }
    }

    if (clickedMonster) {
      onSelectMonster(clickedMonster.instanceId);
    } else {
      if (onOpenChest) {
        const clickedChest = grid.chests.find(
          (ch) => Math.hypot(ch.x + 0.5 - worldX, ch.y + 0.5 - worldY) < 0.9
        );
        if (clickedChest) {
          onOpenChest(clickedChest);
          return;
        }
      }
      const canGo =
        propsRef.current.isFlying && propsRef.current.player.level >= 200
          ? isTileFlyable
          : isTileWalkable;
      if (canGo(grid, Math.floor(worldX), Math.floor(worldY))) {
        clickTargetRef.current = { x: worldX, y: worldY };
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      className="w-full h-full block cursor-crosshair pixelated"
    />
  );
};

// ============================================================================
// NON-OVERLAPPING HUD-DOCKED MINIMAP COMPONENT
// ============================================================================
interface WorldMinimapCanvasProps {
  mapId: string;
  playerPosRef: React.MutableRefObject<{ x: number; y: number }>;
  monstersRef: React.MutableRefObject<WorldMonsterEntity[]>;
  nearbyPlayers: OnlinePlayer[];
  chestCooldowns: Record<string, number>;
  worldBoss?: WorldBossState | null;
}

export const WorldMinimapCanvas: React.FC<WorldMinimapCanvasProps> = ({
  mapId,
  playerPosRef,
  monstersRef,
  nearbyPlayers,
  chestCooldowns,
  worldBoss,
}) => {
  const mmRef = useRef<HTMLCanvasElement | null>(null);
  const latestRef = useRef({ mapId, nearbyPlayers, chestCooldowns, worldBoss });
  latestRef.current = { mapId, nearbyPlayers, chestCooldowns, worldBoss };

  useEffect(() => {
    const canvas = mmRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { mapId: curMap, nearbyPlayers: others, chestCooldowns: cds, worldBoss: wb } =
        latestRef.current;
      const grid = getWorldMapGrid(curMap);
      const scale = 3;
      const w = grid.width * scale;
      const h = grid.height * scale;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const now = Date.now();
      for (let ty = 0; ty < grid.height; ty++) {
        for (let tx = 0; tx < grid.width; tx++) {
          const tile = grid.tiles[ty][tx];
          ctx.fillStyle =
            tile === 'wall' || tile === 'tree'
              ? '#334155'
              : tile === 'water'
              ? grid.palette.water
              : tile === 'brick'
              ? '#785f47'
              : grid.palette.floorA;
          ctx.fillRect(tx * scale, ty * scale, scale, scale);
        }
      }

      for (const npc of grid.npcs) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(npc.x * scale, npc.y * scale, 3, 3);
      }

      for (const chst of grid.chests) {
        if ((cds[chst.id] ?? 0) <= now) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(chst.x * scale, chst.y * scale, 3, 3);
        }
      }

      for (const m of monstersRef.current) {
        if (m.hp <= 0) continue;
        ctx.fillStyle = m.isBoss ? '#facc15' : '#ef4444';
        ctx.fillRect(m.x * scale - 1, m.y * scale - 1, m.isBoss ? 4 : 3, m.isBoss ? 4 : 3);
      }

      if (wb && wb.status === 'active' && wb.mapId === curMap && wb.hp > 0) {
        ctx.fillStyle = '#ec4899';
        ctx.fillRect((grid.bossAltar.x + 2) * scale - 2, (grid.bossAltar.y + 1) * scale - 2, 5, 5);
      }

      for (const op of others) {
        const ox = typeof op.x === 'number' ? op.x : grid.spawnTile.x;
        const oy = typeof op.y === 'number' ? op.y : grid.spawnTile.y;
        ctx.fillStyle = '#7dd3fc';
        ctx.fillRect(ox * scale - 1.5, oy * scale - 1.5, 4, 4);
      }

      const pos = playerPosRef.current;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pos.x * scale - 2, pos.y * scale - 2, 4, 4);
    };

    draw();
    const id = setInterval(draw, 180);
    return () => clearInterval(id);
  }, []);

  return <canvas ref={mmRef} className="w-full h-auto block rounded pixelated" />;
};
