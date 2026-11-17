import React, { useState } from 'react';
import { Award, Check, Clock, Dumbbell, Flame, Lock, Skull, Swords, Trophy } from 'lucide-react';
import {
  BOSSES,
  ITEM_TEMPLATES,
  MAPS,
  MISSIONS,
  RARITY_CONFIG,
  TRAINING_DISCIPLINES,
  TRANSFORMATIONS,
} from '../../game/data.ts';
import { formatDuration, formatNumber, getMissionProgressValue } from '../../game/engine.ts';
import type { ActivityMode, PlayerSaveState, TrainingStat } from '../../game/types.ts';
import { MonsterPixelSprite, WarriorPixelSprite } from '../PixelSprites.tsx';

/* 1. TRAINING PANEL */
interface TrainingPanelProps {
  player: PlayerSaveState;
  onStartTraining: (stat: TrainingStat) => void;
  onSetActivityMode: (mode: ActivityMode) => void;
}

export const TrainingPanel: React.FC<TrainingPanelProps> = ({
  player,
  onStartTraining,
  onSetActivityMode,
}) => {
  const levelScale = 1 + player.level * 0.08;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white">Centro de Treinamento</h2>
          <p className="text-xs text-slate-400 mt-1">
            Escolha qual atributo desenvolver. O treinamento continua automaticamente mesmo offline!
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSetActivityMode(player.activityMode === 'training' ? 'combat' : 'training')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            player.activityMode === 'training'
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
          }`}
        >
          {player.activityMode === 'training' ? 'Treinamento Ativo (Voltar ao Combate)' : 'Ativar Modo Treino'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TRAINING_DISCIPLINES.map((disc) => {
          const isSelected = player.trainingStat === disc.id && player.activityMode === 'training';
          const currentBonus =
            disc.id === 'strength'
              ? player.bonusStrength
              : disc.id === 'defense'
              ? player.bonusDefense
              : disc.id === 'speed'
              ? player.bonusSpeed
              : disc.id === 'ki'
              ? player.bonusKi
              : player.bonusStamina;

          return (
            <div
              key={disc.id}
              className={`rounded-xl border p-4 bg-[#131A26] flex flex-col justify-between gap-4 ${
                isSelected ? 'border-sky-400' : 'border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Dumbbell className="w-4 h-4" style={{ color: disc.accentColor }} />
                    <span>{disc.name}</span>
                  </h3>
                  <span className="text-xs font-mono-num text-sky-300">
                    Bônus: +{formatNumber(currentBonus)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{disc.description}</p>
                <p className="text-[11px] font-mono-num text-emerald-300 mt-2">
                  +{Math.round(disc.gainPerMinute * levelScale)} {disc.statLabel}/min · +
                  {Math.round(disc.kiGainPerMinute * levelScale)} Ki/min
                </p>
              </div>

              <button
                type="button"
                onClick={() => onStartTraining(disc.id)}
                className={`w-full py-2 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/20 border border-sky-400 text-sky-300'
                    : 'bg-[#0B0F17] border border-slate-700 hover:border-sky-500 text-slate-200'
                }`}
              >
                {isSelected ? 'Treinando Agora' : `Iniciar ${disc.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* 2. TRANSFORMATIONS PANEL */
interface TransformationsPanelProps {
  player: PlayerSaveState;
  onSelectTransformation: (id: string) => void;
}

export const TransformationsPanel: React.FC<TransformationsPanelProps> = ({
  player,
  onSelectTransformation,
}) => {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white">Transformações de Ki</h2>
          <p className="text-xs text-slate-400 mt-1">
            Eleve seu nível e Ki acumulado para desbloquear formas lendárias e multiplicar seu poder.
          </p>
        </div>
        <div className="text-xs font-mono-num text-sky-300">
          Nível {player.level} · Ki {formatNumber(player.currentKi)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TRANSFORMATIONS.map((tf) => {
          const hasSecretAccess = !tf.secretOnly || player.unlockedTransformations.includes(tf.id);
          const unlocked =
            hasSecretAccess &&
            player.level >= tf.requiredLevel &&
            player.currentKi >= tf.requiredKi;
          const active = player.transformationId === tf.id;

          return (
            <div
              key={tf.id}
              className={`rounded-xl border p-4 bg-[#131A26] flex flex-col justify-between gap-4 ${
                active
                  ? 'border-amber-400 shadow-[0_0_20px_rgba(250,204,21,0.12)]'
                  : tf.secretOnly && unlocked
                  ? 'border-sky-400/70 bg-gradient-to-br from-[#131A26] to-sky-950/30'
                  : unlocked
                  ? 'border-slate-700'
                  : 'border-slate-800/70 opacity-75'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-2 shrink-0">
                  <WarriorPixelSprite
                    race={player.race}
                    transformationId={tf.id}
                    size={64}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{tf.name}</h3>
                    <span
                      className="text-xs font-mono-num font-bold shrink-0"
                      style={{ color: tf.auraColor }}
                    >
                      {tf.damageMultiplier}x Dano
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{tf.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono-num text-slate-300">
                    {tf.secretOnly ? (
                      <span className={unlocked ? 'text-sky-300 font-semibold' : 'text-amber-400'}>
                        {unlocked ? 'Desbloqueado via JEFFGAMEMOD (30x Poder)' : 'Código Secreto nas Configurações'}
                      </span>
                    ) : (
                      <>
                        <span className={player.level >= tf.requiredLevel ? 'text-emerald-400' : 'text-red-400'}>
                          Nv. {tf.requiredLevel}
                        </span>
                        <span className={player.currentKi >= tf.requiredKi ? 'text-emerald-400' : 'text-red-400'}>
                          Ki {formatNumber(tf.requiredKi)}
                        </span>
                      </>
                    )}
                    <span className="text-amber-300">PL {tf.powerMultiplier}x</span>
                    <span className="text-sky-300">+{tf.speedBonus} Vel</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!unlocked || active}
                onClick={() => onSelectTransformation(tf.id)}
                className={`w-full py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500/20 border border-amber-400 text-amber-300 cursor-default'
                    : unlocked
                    ? 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {active ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Forma Ativa</span>
                  </>
                ) : unlocked ? (
                  <>
                    <Flame className="w-4 h-4" />
                    <span>Ativar Transformação</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>{tf.secretOnly ? 'Código Necessário' : 'Requisitos Pendentes'}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* 3. MISSIONS & TITLES PANEL */
interface MissionsPanelProps {
  player: PlayerSaveState;
  onClaimMission: (missionId: string) => void;
  onSelectTitle: (title: string) => void;
}

export const MissionsPanel: React.FC<MissionsPanelProps> = ({
  player,
  onClaimMission,
  onSelectTitle,
}) => {
  const [filterKind, setFilterKind] = useState<'all' | 'daily' | 'permanent'>('all');

  const list = MISSIONS.filter((m) => filterKind === 'all' || m.kind === filterKind);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white">Missões & Títulos</h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete missões diárias e permanentes para ganhar XP, Zeni, equipamentos e títulos.
          </p>
        </div>

        <div className="flex items-center p-1 rounded-lg bg-[#0B0F17] border border-slate-800">
          {(
            [
              ['all', 'Todas'],
              ['daily', 'Diárias'],
              ['permanent', 'Permanentes'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilterKind(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterKind === val
                  ? 'bg-orange-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Unlocked Titles Selector */}
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Título Equipado:</span>
          <strong className="text-amber-300">{player.title}</strong>
        </div>
        <select
          aria-label="Selecionar título equipado"
          value={player.title}
          onChange={(e) => onSelectTitle(e.target.value)}
          className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
        >
          {player.unlockedTitles.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {list.map((mission) => {
          const progress = getMissionProgressValue(player, mission);
          const pct = Math.min(100, (progress / mission.target) * 100);
          const claimed = player.claimedMissions.includes(mission.id);
          const ready = progress >= mission.target && !claimed;
          const itemTpl = mission.rewards.itemTemplateId
            ? ITEM_TEMPLATES.find((t) => t.id === mission.rewards.itemTemplateId)
            : null;

          return (
            <div
              key={mission.id}
              className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-sky-400 font-medium">
                    {mission.kind === 'daily' ? 'Missão Diária' : 'Permanente'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num text-slate-400">
                    {formatNumber(Math.min(progress, mission.target))} / {formatNumber(mission.target)}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{mission.title}</h3>
                <p className="text-xs text-slate-400">{mission.description}</p>
                <div className="w-full max-w-md h-2 bg-[#0B0F17] rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full transition-all duration-200 ${
                      claimed ? 'bg-emerald-500' : ready ? 'bg-amber-400' : 'bg-sky-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-300 pt-1">
                  Recompensa: +{formatNumber(mission.rewards.xp)} XP · +
                  {formatNumber(mission.rewards.zeni)} Zeni
                  {mission.rewards.title ? ` · Título "${mission.rewards.title}"` : ''}
                  {itemTpl
                    ? ` · ${itemTpl.name} (${
                        RARITY_CONFIG[mission.rewards.itemRarity ?? 'Rare'].label
                      })`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                disabled={!ready}
                onClick={() => onClaimMission(mission.id)}
                className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                  claimed
                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 cursor-default'
                    : ready
                    ? 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {claimed ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Resgatada</span>
                  </>
                ) : ready ? (
                  <>
                    <Award className="w-4 h-4" />
                    <span>Resgatar</span>
                  </>
                ) : (
                  <span>Em Progresso</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* 4. BOSSES PANEL */
interface BossesPanelProps {
  player: PlayerSaveState;
  nowMs: number;
  onChallengeBossById: (mapId: string) => void;
}

export const BossesPanel: React.FC<BossesPanelProps> = ({
  player,
  nowMs,
  onChallengeBossById,
}) => {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4">
        <h2 className="font-pixel text-base sm:text-lg text-white">Chefes Especiais</h2>
        <p className="text-xs text-slate-400 mt-1">
          Chefes possuem muito mais HP e concedem recompensas épicas, lendárias e míticas garantidas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BOSSES.map((boss) => {
          const map = MAPS.find((m) => m.id === boss.mapId);
          const unlocked = player.level >= boss.requiredLevel;
          const cdUntil = player.bossCooldowns[boss.id] ?? 0;
          const cdSec = Math.max(0, Math.ceil((cdUntil - nowMs) / 1000));
          const dropNames = boss.exclusiveDrops
            .map((id) => ITEM_TEMPLATES.find((t) => t.id === id)?.name)
            .filter(Boolean)
            .join(', ');

          return (
            <div
              key={boss.id}
              className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-2 shrink-0">
                  <MonsterPixelSprite
                    archetype={boss.archetype}
                    colorPrimary={boss.colorPrimary}
                    colorSecondary={boss.colorSecondary}
                    size={64}
                    isBoss
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-amber-300 truncate">{boss.name}</h3>
                    <span className="text-xs font-mono-num text-slate-400 shrink-0">
                      Nv. {boss.requiredLevel}+
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{boss.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Local: {map?.name ?? boss.mapId} · HP {formatNumber(boss.hp)}
                  </p>
                  <p className="text-[11px] font-mono-num text-sky-300 mt-1">
                    +{formatNumber(boss.xpReward)} XP · +{formatNumber(boss.zeniReward)} Zeni
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    Drops Exclusivos: {dropNames}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!unlocked || cdSec > 0}
                onClick={() => onChallengeBossById(boss.mapId)}
                className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  !unlocked
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : cdSec > 0
                    ? 'bg-slate-800 text-amber-300 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {!unlocked ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Requer Nível {boss.requiredLevel}</span>
                  </>
                ) : cdSec > 0 ? (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Respawn em {cdSec}s</span>
                  </>
                ) : (
                  <>
                    <Swords className="w-4 h-4" />
                    <span>Desafiar {boss.name}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
