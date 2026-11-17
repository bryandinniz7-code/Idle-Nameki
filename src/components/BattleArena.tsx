import React from 'react';
import { Dumbbell, Flame, ShieldAlert, Skull, Sparkles, Swords, Users } from 'lucide-react';
import { RARITY_CONFIG, TRAINING_DISCIPLINES, TRANSFORMATIONS } from '../game/data.ts';
import { formatNumber, getBossForMap, getMapById, getTransformationById } from '../game/engine.ts';
import type {
  ActivityMode,
  BossDef,
  DerivedStats,
  InventoryItem,
  MonsterDef,
  OnlinePlayer,
  PlayerSaveState,
} from '../game/types.ts';
import { MonsterPixelSprite, WarriorPixelSprite } from './PixelSprites.tsx';

export interface FloatingDamage {
  id: number;
  amount: number;
  isCrit: boolean;
  isPlayerHit?: boolean;
}

interface BattleArenaProps {
  player: PlayerSaveState;
  derived: DerivedStats;
  currentEnemy: MonsterDef | BossDef;
  isBossBattle: boolean;
  enemyHp: number;
  enemyMaxHp: number;
  playerAttackTick: number;
  enemyHitTick: number;
  floatingDamages: FloatingDamage[];
  recentDrop: InventoryItem | null;
  nearbyPlayers: OnlinePlayer[];
  partyCount: number;
  bossCooldownSec: number;
  onSetActivityMode: (mode: ActivityMode) => void;
  onChallengeBoss: () => void;
  onCancelBoss: () => void;
  onSelectTransformation: (tfId: string) => void;
  onOpenMaps: () => void;
}

const BACKDROP_URLS: Record<'earth' | 'space' | 'divine', string> = {
  earth: '/src/assets/images/pixel_arena_earth_namek_1794876900814.jpg',
  space: '/src/assets/images/pixel_arena_space_planet_1794876901321.jpg',
  divine: '/src/assets/images/pixel_arena_divine_realm_1794876902193.jpg',
};

export const BattleArena: React.FC<BattleArenaProps> = ({
  player,
  derived,
  currentEnemy,
  isBossBattle,
  enemyHp,
  enemyMaxHp,
  playerAttackTick,
  enemyHitTick,
  floatingDamages,
  recentDrop,
  nearbyPlayers,
  partyCount,
  bossCooldownSec,
  onSetActivityMode,
  onChallengeBoss,
  onCancelBoss,
  onSelectTransformation,
  onOpenMaps,
}) => {
  const map = getMapById(player.currentMapId);
  const mapBoss = getBossForMap(map.id);
  const currentTf = getTransformationById(player.transformationId);
  const trainingDisc =
    TRAINING_DISCIPLINES.find((d) => d.id === player.trainingStat) ?? TRAINING_DISCIPLINES[0];

  const enemyHpPct = Math.max(0, Math.min(100, (enemyHp / Math.max(1, enemyMaxHp)) * 100));
  const playerHpPct = Math.max(0, Math.min(100, (player.currentHp / Math.max(1, derived.maxHp)) * 100));

  return (
    <div className="space-y-4">
      {/* Arena Header Controls */}
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Mapa {map.order}/12</span>
            <span aria-hidden="true">·</span>
            <span className="text-sky-400">{map.difficulty}</span>
            <span aria-hidden="true">·</span>
            <span>PL Rec: {formatNumber(map.recommendedPower)}</span>
          </div>
          <h2 className="font-pixel text-base sm:text-lg text-white mt-0.5">{map.name}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Combat / Training toggle */}
          <div className="flex items-center p-1 rounded-lg bg-[#0B0F17] border border-slate-800">
            <button
              type="button"
              onClick={() => onSetActivityMode('combat')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                player.activityMode === 'combat'
                  ? 'bg-orange-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Combate</span>
            </button>
            <button
              type="button"
              onClick={() => onSetActivityMode('training')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                player.activityMode === 'training'
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5" />
              <span>Treino AFK</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenMaps}
            className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 bg-[#0B0F17] text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Trocar Mapa
          </button>

          {!isBossBattle ? (
            <button
              type="button"
              onClick={onChallengeBoss}
              disabled={bossCooldownSec > 0 || player.level < mapBoss.requiredLevel}
              className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Skull className="w-3.5 h-3.5" />
              <span>
                {bossCooldownSec > 0
                  ? `Chefe (${bossCooldownSec}s)`
                  : player.level < mapBoss.requiredLevel
                  ? `Chefe Nv.${mapBoss.requiredLevel}`
                  : `Desafiar ${mapBoss.name}`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancelBoss}
              className="px-3.5 py-2 rounded-lg border border-red-500/60 bg-red-950/50 hover:bg-red-900/60 text-red-200 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              Recuar do Chefe
            </button>
          )}
        </div>
      </div>

      {/* Main 2D Pixel Art Battle Stage */}
      <div className="relative rounded-xl border border-slate-800 overflow-hidden bg-[#0B0F17] min-h-[340px] sm:min-h-[380px] flex flex-col justify-between">
        {/* Map Pixel Backdrop */}
        <img
          src={BACKDROP_URLS[map.backdropKey]}
          alt={map.name}
          className="absolute inset-0 w-full h-full object-cover pixelated opacity-80"
          referrerPolicy="no-referrer"
        />
        <div className={`absolute inset-0 bg-gradient-to-b ${map.ambientClass}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17]/95 via-[#0B0F17]/20 to-[#0B0F17]/60" />

        {/* Top HUD Strip inside Arena */}
        <div className="relative z-10 p-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-medium text-slate-200 bg-[#0B0F17]/80 border border-slate-700/80 rounded-lg px-3 py-1.5 flex items-center gap-2">
            {player.activityMode === 'combat' ? (
              <>
                <Swords className="w-3.5 h-3.5 text-orange-400" />
                <span>
                  {isBossBattle
                    ? `Batalha de Chefe: ${currentEnemy.name}`
                    : `Caçando em ${map.name}`}
                </span>
              </>
            ) : (
              <>
                <Dumbbell className="w-3.5 h-3.5 text-sky-400" />
                <span>Treinamento Ativo: {trainingDisc.name}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {partyCount > 1 && (
              <div className="text-xs text-emerald-300 bg-[#0B0F17]/80 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Grupo +{((partyCount - 1) * 10)}% Dano</span>
              </div>
            )}
            {nearbyPlayers.length > 0 && (
              <div className="text-xs text-sky-300 bg-[#0B0F17]/80 border border-sky-500/40 rounded-lg px-2.5 py-1.5">
                {nearbyPlayers.length} {nearbyPlayers.length === 1 ? 'guerreiro aqui' : 'guerreiros aqui'}
              </div>
            )}
          </div>
        </div>

        {/* Combatants Stage */}
        <div className="relative z-10 px-4 sm:px-10 py-6 flex items-end justify-between gap-4">
          {/* Left Side: Player + Other Map Players */}
          <div className="flex items-end gap-3">
            {/* Nearby online players visible on the same map */}
            {nearbyPlayers.slice(0, 2).map((other) => (
              <div
                key={other.uid}
                className="hidden sm:flex flex-col items-center opacity-85"
                title={`${other.name} (Nv. ${other.level})`}
              >
                <span className="text-[10px] font-medium text-sky-300 bg-[#0B0F17]/80 px-2 py-0.5 rounded mb-1 whitespace-nowrap">
                  {other.name} · Nv.{other.level}
                </span>
                <WarriorPixelSprite
                  race={other.race}
                  transformationId={other.transformationId}
                  size={64}
                />
              </div>
            ))}

            {/* Main Player Character */}
            <div className="flex flex-col items-center relative">
              <div className="bg-[#0B0F17]/85 border border-slate-700/80 rounded-lg px-2.5 py-1 mb-2 text-center">
                <p className="text-xs font-bold text-white whitespace-nowrap">
                  {player.name}{' '}
                  <span className="text-orange-400 font-mono-num">Nv.{player.level}</span>
                </p>
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-150"
                    style={{ width: `${playerHpPct}%` }}
                  />
                </div>
              </div>

              <div key={playerAttackTick} className="relative">
                <WarriorPixelSprite
                  race={player.race}
                  transformationId={player.transformationId}
                  size={104}
                  isAttacking={playerAttackTick > 0 && player.activityMode === 'combat'}
                  isTraining={player.activityMode === 'training'}
                />

                {/* Ki Blast Beam Animation on Attack */}
                {player.activityMode === 'combat' && playerAttackTick > 0 && (
                  <div
                    key={`beam-${playerAttackTick}`}
                    className="absolute top-1/2 left-20 w-16 h-2 rounded-full animate-ki-beam pointer-events-none"
                    style={{
                      backgroundColor: currentTf.auraColor,
                      boxShadow: `0 0 12px ${currentTf.auraColor}`,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Monster / Boss OR Training Focus */}
          {player.activityMode === 'combat' ? (
            <div className="flex flex-col items-center relative">
              {/* Floating Damage Popups */}
              <div className="absolute -top-6 inset-x-0 flex flex-col items-center pointer-events-none z-20">
                {floatingDamages.map((dmg) => (
                  <span
                    key={dmg.id}
                    className={`font-pixel text-sm sm:text-base animate-damage-float whitespace-nowrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)] ${
                      dmg.isCrit ? 'text-yellow-300 scale-110' : 'text-white'
                    }`}
                  >
                    {dmg.isCrit ? `CRIT -${formatNumber(dmg.amount)}!` : `-${formatNumber(dmg.amount)}`}
                  </span>
                ))}
              </div>

              {/* Enemy Nameplate & HP */}
              <div className="bg-[#0B0F17]/90 border border-slate-700/90 rounded-lg px-3 py-1.5 mb-2 min-w-[148px]">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span
                    className={`font-bold truncate ${
                      isBossBattle ? 'text-amber-300' : 'text-slate-100'
                    }`}
                  >
                    {isBossBattle && <ShieldAlert className="w-3 h-3 inline mr-1 text-amber-400" />}
                    {currentEnemy.name}
                  </span>
                  <span className="font-mono-num text-[11px] text-slate-400 shrink-0">
                    Nv.{'level' in currentEnemy ? currentEnemy.level : currentEnemy.requiredLevel}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full transition-all duration-150 ${
                      isBossBattle ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${enemyHpPct}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono-num text-slate-300 mt-1 text-right">
                  {formatNumber(enemyHp)} / {formatNumber(enemyMaxHp)} HP
                </p>
              </div>

              <div key={enemyHitTick}>
                <MonsterPixelSprite
                  archetype={currentEnemy.archetype}
                  colorPrimary={currentEnemy.colorPrimary}
                  colorSecondary={currentEnemy.colorSecondary}
                  size={isBossBattle ? 116 : 96}
                  isHit={enemyHitTick > 0}
                  isBoss={isBossBattle}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-sky-500/40 bg-[#0B0F17]/85 p-4 max-w-xs text-right">
              <p className="text-xs font-semibold text-sky-400">{trainingDisc.name}</p>
              <p className="text-sm font-bold text-white mt-1">{trainingDisc.statLabel}</p>
              <p className="text-xs text-slate-300 mt-1">{trainingDisc.description}</p>
              <p className="text-[11px] font-mono-num text-emerald-300 mt-2">
                +{trainingDisc.kiGainPerMinute}/min Ki · Progresso contínuo AFK
              </p>
            </div>
          )}
        </div>

        {/* Recent Drop Toast Bar inside Arena Bottom */}
        <div className="relative z-10 px-4 py-2.5 bg-[#0B0F17]/90 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-4 font-mono-num text-slate-300">
            <span>
              DPS: <strong className="text-orange-400">{formatNumber(derived.dps)}</strong>
            </span>
            <span>
              Crítico: <strong className="text-yellow-300">{derived.critChance}%</strong>
            </span>
            <span>
              Mult: <strong className="text-sky-300">{derived.damageMultiplier}x</strong>
            </span>
          </div>

          {recentDrop ? (
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-400">Último drop:</span>
              <span className={`font-semibold ${RARITY_CONFIG[recentDrop.rarity].textClass}`}>
                {recentDrop.name} ({RARITY_CONFIG[recentDrop.rarity].label})
              </span>
            </div>
          ) : (
            <span className="text-slate-500 text-xs">
              Derrote inimigos para obter equipamentos e Sementes dos Deuses
            </span>
          )}
        </div>
      </div>

      {/* Quick Transformation Bar */}
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            Transformação Ativa ({currentTf.name} · {currentTf.damageMultiplier}x Dano)
          </span>
          <span className="text-xs font-mono-num text-sky-400">
            Ki Atual: {formatNumber(player.currentKi)}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {TRANSFORMATIONS.map((tf) => {
            const unlocked =
              player.level >= tf.requiredLevel && player.currentKi >= tf.requiredKi;
            const active = player.transformationId === tf.id;
            return (
              <button
                key={tf.id}
                type="button"
                disabled={!unlocked}
                onClick={() => onSelectTransformation(tf.id)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-amber-400 bg-amber-500/15 text-amber-300 font-semibold'
                    : unlocked
                    ? 'border-slate-700 bg-[#0B0F17] text-slate-200 hover:border-slate-500'
                    : 'border-slate-800/80 bg-[#0B0F17]/50 text-slate-600 cursor-not-allowed'
                }`}
              >
                {tf.name}
                {!unlocked && ` (Nv.${tf.requiredLevel})`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
