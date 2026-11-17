import React, { useEffect, useRef, useState } from 'react';
import { getTransformationById } from '../game/engine.ts';
import {
  getMonsterSpriteCanvas,
  getNpcSpriteCanvas,
  getPetSpriteCanvas,
  getWarriorSpriteCanvas,
  onSpriteSheetLoaded,
  type MapNpcKind,
  SPRITE_SIZE,
} from '../game/pixelArtSprites.ts';
import type { RaceId, Rarity } from '../game/types.ts';
import { RARITY_CONFIG } from '../game/data.ts';

interface WarriorSpriteProps {
  race: RaceId;
  transformationId: string;
  size?: number;
  facing?: 'right' | 'left';
  isAttacking?: boolean;
  isTraining?: boolean;
  isFused?: boolean;
}

export const WarriorPixelSprite: React.FC<WarriorSpriteProps> = ({
  race,
  transformationId,
  size = 96,
  facing = 'right',
  isAttacking = false,
  isTraining = false,
  isFused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sheetVersion, setSheetVersion] = useState(0);
  const tf = getTransformationById(transformationId);
  const isTransformed = tf.id !== 'base';

  useEffect(() => {
    return onSpriteSheetLoaded(() => setSheetVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const src = getWarriorSpriteCanvas(race, transformationId, 'down', 0, isFused);
    if (canvas.width !== src.width) canvas.width = src.width;
    if (canvas.height !== src.height) canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
  }, [race, transformationId, isFused, sheetVersion]);

  const motionClass = isAttacking
    ? 'animate-attack-lunge'
    : isTraining || isTransformed || isFused
    ? 'animate-power-charge'
    : 'animate-float-idle';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${motionClass}`}
      style={{
        width: size,
        height: size,
        transform: facing === 'left' ? 'scaleX(-1)' : undefined,
      }}
    >
      {(isTransformed || isTraining || isFused) && (
        <div
          className="absolute inset-0 rounded-full blur-md animate-aura-pulse pointer-events-none"
          style={{
            background: isFused
              ? `radial-gradient(circle, #facc1577 0%, #38bdf833 55%, transparent 75%)`
              : `radial-gradient(circle, ${tf.auraColor}66 0%, ${tf.auraColor}18 55%, transparent 75%)`,
          }}
        />
      )}

      <canvas
        ref={canvasRef}
        width={SPRITE_SIZE}
        height={SPRITE_SIZE}
        className="relative z-10 sprite-vivid"
        style={{ width: size, height: size }}
      />
    </div>
  );
};

interface MonsterSpriteProps {
  archetype: string;
  colorPrimary: string;
  colorSecondary: string;
  size?: number;
  isHit?: boolean;
  isBoss?: boolean;
}

export const MonsterPixelSprite: React.FC<MonsterSpriteProps> = ({
  archetype,
  colorPrimary,
  colorSecondary,
  size = 96,
  isHit = false,
  isBoss = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sheetVersion, setSheetVersion] = useState(0);

  useEffect(() => {
    return onSpriteSheetLoaded(() => setSheetVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const src = getMonsterSpriteCanvas(
      archetype,
      colorPrimary,
      colorSecondary,
      isBoss,
      isHit
    );
    if (canvas.width !== src.width) canvas.width = src.width;
    if (canvas.height !== src.height) canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
  }, [archetype, colorPrimary, colorSecondary, isBoss, isHit, sheetVersion]);

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${
        isHit ? 'animate-enemy-hit' : 'animate-float-idle'
      }`}
      style={{ width: size, height: size }}
    >
      {isBoss && (
        <div
          className="absolute inset-0 rounded-full blur-md animate-aura-pulse pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${colorPrimary}55 0%, transparent 70%)`,
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        width={SPRITE_SIZE}
        height={SPRITE_SIZE}
        className="relative z-10 sprite-vivid"
        style={{ width: size, height: size }}
      />
    </div>
  );
};

export const PetPixelSprite: React.FC<{ petId: string; size?: number }> = ({
  petId,
  size = 56,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const src = getPetSpriteCanvas(petId);
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
  }, [petId]);

  return (
    <canvas
      ref={canvasRef}
      width={SPRITE_SIZE}
      height={SPRITE_SIZE}
      className="pixelated drop-shadow-[0_4px_6px_rgba(0,0,0,0.65)] animate-float-idle"
      style={{ width: size, height: size }}
    />
  );
};

export const NpcPixelSprite: React.FC<{ kind: MapNpcKind; size?: number }> = ({
  kind,
  size = 56,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const src = getNpcSpriteCanvas(kind);
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
  }, [kind]);

  return (
    <canvas
      ref={canvasRef}
      width={SPRITE_SIZE}
      height={SPRITE_SIZE}
      className="pixelated drop-shadow-[0_4px_6px_rgba(0,0,0,0.65)]"
      style={{ width: size, height: size }}
    />
  );
};

export const DragonBallIcon: React.FC<{
  stars: number;
  collected?: boolean;
  size?: number;
}> = ({ stars, collected = true, size = 44 }) => {
  const starOffsets: [number, number][] = (() => {
    switch (stars) {
      case 1:
        return [[16, 16]];
      case 2:
        return [
          [12, 14],
          [20, 18],
        ];
      case 3:
        return [
          [16, 11],
          [11, 20],
          [21, 20],
        ];
      case 4:
        return [
          [12, 12],
          [20, 12],
          [12, 20],
          [20, 20],
        ];
      case 5:
        return [
          [12, 11],
          [20, 11],
          [16, 16],
          [12, 21],
          [20, 21],
        ];
      case 6:
        return [
          [11, 11],
          [16, 10],
          [21, 11],
          [11, 20],
          [16, 22],
          [21, 20],
        ];
      default:
        return [
          [16, 16],
          [16, 10],
          [16, 22],
          [10, 13],
          [22, 13],
          [10, 19],
          [22, 19],
        ];
    }
  })();

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`shrink-0 ${collected ? 'drop-shadow-[0_0_8px_rgba(245,158,11,0.75)]' : 'opacity-30 grayscale'}`}
    >
      <defs>
        <radialGradient id={`db_grad_${stars}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
      </defs>
      <circle
        cx="16"
        cy="16"
        r="13.5"
        fill={`url(#db_grad_${stars})`}
        stroke="#78350f"
        strokeWidth="1.5"
      />
      <ellipse cx="11.5" cy="10" rx="4" ry="2.4" fill="#ffffff" opacity="0.55" transform="rotate(-25 11.5 10)" />
      {starOffsets.map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r="1.9" fill="#dc2626" />
      ))}
    </svg>
  );
};

interface ItemIconProps {
  iconType: string;
  rarity: Rarity;
  size?: number;
  upgradeLevel?: number;
}

export const ItemPixelIcon: React.FC<ItemIconProps> = ({
  iconType,
  rarity,
  size = 36,
  upgradeLevel = 0,
}) => {
  const cfg = RARITY_CONFIG[rarity];

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-md border ${cfg.borderClass} ${cfg.bgClass} shrink-0`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.78)}
        height={Math.round(size * 0.78)}
        shapeRendering="crispEdges"
        className="pixelated"
      >
        {(iconType === 'staff' ||
          iconType === 'katana' ||
          iconType === 'z_sword' ||
          iconType === 'ki_blade') && (
          <g>
            {/* Diagonal cel-shaded blade / Power Pole with dark outline */}
            <path d="M18 2h4v4l-9 9-4-4 9-9z" fill="#090d16" />
            <path d="M18 3h3v3l-8 8-3-3 8-8z" fill={cfg.color} />
            <path d="M18 3h2v2l-7 7-1-1 6-8z" fill="#ffffff" opacity="0.65" />
            <rect x="7" y="12" width="5" height="2" fill="#facc15" transform="rotate(-45 9.5 13)" />
            <path d="M4 17l3-3 3 3-3 3-3-3z" fill="#78350f" stroke="#090d16" strokeWidth="1" />
            <rect x="2" y="19" width="3" height="3" fill="#facc15" />
          </g>
        )}

        {(iconType === 'gi' ||
          iconType === 'namek_robe' ||
          iconType === 'saiyan_armor' ||
          iconType === 'frieza_armor') && (
          <g>
            <path d="M4 4h16v6h-2v10H6V10H4V4z" fill="#090d16" />
            <path d="M5 5h14v4h-2v10H7V9H5V5z" fill={cfg.color} />
            <path d="M9 5h6l-3 5-3-5z" fill="#0f172a" />
            <rect x="7" y="13" width="10" height="3" fill="#facc15" />
            <rect x="5" y="5" width="3" height="3" fill="#ffffff" opacity="0.45" />
            <rect x="16" y="5" width="3" height="3" fill="#090d16" opacity="0.25" />
          </g>
        )}

        {(iconType === 'scouter' || iconType === 'turban' || iconType === 'crown') && (
          <g>
            <rect x="3" y="7" width="18" height="10" rx="2" fill="#090d16" />
            <rect x="4" y="8" width="16" height="8" rx="1" fill="#1e293b" />
            <rect x="5" y="9" width="9" height="6" fill={cfg.color} />
            <rect x="6" y="10" width="3" height="2" fill="#ffffff" opacity="0.7" />
            <rect x="15" y="9" width="4" height="6" fill="#94a3b8" />
            <rect x="16" y="11" width="2" height="2" fill="#facc15" />
          </g>
        )}

        {(iconType === 'boots' || iconType === 'heavy_boots') && (
          <g>
            <path d="M6 3h7v10h5v7H6V3z" fill="#090d16" />
            <path d="M7 4h5v10h5v5H7V4z" fill={cfg.color} />
            <rect x="7" y="4" width="5" height="2" fill="#facc15" />
            <rect x="7" y="17" width="10" height="2" fill="#e2e8f0" />
            <rect x="8" y="7" width="2" height="6" fill="#ffffff" opacity="0.4" />
          </g>
        )}

        {(iconType === 'gloves' || iconType === 'gauntlets') && (
          <g>
            <rect x="5" y="5" width="14" height="14" rx="2" fill="#090d16" />
            <rect x="6" y="6" width="12" height="9" fill={cfg.color} />
            <rect x="4" y="9" width="3" height="5" fill={cfg.color} />
            <rect x="6" y="15" width="12" height="3" fill="#facc15" />
            <rect x="7" y="7" width="4" height="3" fill="#ffffff" opacity="0.45" />
          </g>
        )}

        {(iconType === 'radar' || iconType === 'cloud') && (
          <g>
            <rect x="10" y="2" width="4" height="3" fill="#cbd5e1" stroke="#090d16" strokeWidth="1" />
            <circle cx="12" cy="13" r="8" fill="#e2e8f0" stroke="#090d16" strokeWidth="1.5" />
            <circle cx="12" cy="13" r="5.5" fill="#064e3b" />
            <line x1="7" y1="13" x2="17" y2="13" stroke="#10b981" strokeWidth="0.8" />
            <line x1="12" y1="8" x2="12" y2="18" stroke="#10b981" strokeWidth="0.8" />
            <rect x="13" y="10" width="2" height="2" fill="#facc15" />
            <rect x="10" y="14" width="2" height="2" fill="#facc15" />
          </g>
        )}

        {(iconType === 'necklace' || iconType === 'divine_necklace') && (
          <g>
            <circle cx="12" cy="10" r="6" fill="none" stroke="#facc15" strokeWidth="2.5" />
            <path d="M8 14h8l-4 7-4-7z" fill="#090d16" />
            <path d="M9 14h6l-3 5.5L9 14z" fill={cfg.color} />
            <rect x="11" y="15" width="2" height="2" fill="#ffffff" opacity="0.7" />
          </g>
        )}

        {(iconType === 'potara' || iconType === 'hakaisin_earring') && (
          <g>
            <circle cx="7" cy="7" r="2.2" fill="none" stroke="#facc15" strokeWidth="1.8" />
            <circle cx="7" cy="14" r="4" fill={cfg.color} stroke="#090d16" strokeWidth="1.2" />
            <circle cx="6" cy="13" r="1.2" fill="#ffffff" opacity="0.7" />
            <circle cx="17" cy="7" r="2.2" fill="none" stroke="#facc15" strokeWidth="1.8" />
            <circle cx="17" cy="14" r="4" fill={cfg.color} stroke="#090d16" strokeWidth="1.2" />
            <circle cx="16" cy="13" r="1.2" fill="#ffffff" opacity="0.7" />
          </g>
        )}

        {(iconType === 'senzu' || iconType === 'capsule') && (
          <g>
            {iconType === 'senzu' ? (
              <>
                <ellipse cx="12" cy="13" rx="6" ry="7.5" fill="#16a34a" stroke="#090d16" strokeWidth="1.5" />
                <ellipse cx="10" cy="10" rx="2.2" ry="3" fill="#86efac" />
                <path d="M12 5c2-2 5-2 5 0-2 1-4 1-5 0z" fill="#4ade80" />
              </>
            ) : (
              <>
                <rect x="7" y="4" width="10" height="16" rx="5" fill="#f8fafc" stroke="#090d16" strokeWidth="1.5" />
                <rect x="7" y="4" width="10" height="8" rx="4" fill="#0ea5e9" />
                <rect x="7" y="11" width="10" height="2" fill="#090d16" />
                <rect x="9" y="6" width="2" height="3" fill="#bae6fd" />
              </>
            )}
          </g>
        )}
      </svg>

      {upgradeLevel > 0 && (
        <span className="absolute -top-1 -right-1 px-1 rounded bg-orange-500 text-slate-950 font-mono-num text-[8px] font-extrabold leading-tight shadow">
          +{upgradeLevel}
        </span>
      )}
    </div>
  );
};
