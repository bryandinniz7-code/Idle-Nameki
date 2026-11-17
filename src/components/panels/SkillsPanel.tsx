import React from 'react';
import { Flame, Lock, Sparkles, Zap } from 'lucide-react';
import { COMBAT_SKILLS, type CombatSkillDef } from '../../game/skills.ts';
import type { PlayerSaveState } from '../../game/types.ts';

interface SkillsPanelProps {
  player: PlayerSaveState;
  cooldowns: Record<string, number>;
  nowMs: number;
  onCastSkill: (skill: CombatSkillDef) => void;
}

export const SkillsPanel: React.FC<SkillsPanelProps> = ({
  player,
  cooldowns,
  nowMs,
  onCastSkill,
}) => {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white">Técnicas & Habilidades</h2>
          <p className="text-xs text-slate-400 mt-1">
            Use as teclas 1 a 8, toque na barra inferior ou ative o Auto-Skill no BOT.
          </p>
        </div>
        <span className="text-xs font-mono-num text-sky-400">
          Nível {player.level} · Ki {Math.floor(player.currentKi).toLocaleString('pt-BR')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {COMBAT_SKILLS.map((skill) => {
          const unlocked = player.level >= skill.requiredLevel;
          const cdUntil = cooldowns[skill.id] ?? 0;
          const cdRemaining = Math.max(0, Math.ceil((cdUntil - nowMs) / 1000));
          const enoughKi = player.currentKi >= skill.kiCost;

          return (
            <div
              key={skill.id}
              className={`rounded-xl border p-4 bg-[#131A26] flex flex-col justify-between gap-3 ${
                unlocked ? 'border-slate-700' : 'border-slate-800/70 opacity-70'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 font-pixel text-sm"
                  style={{
                    borderColor: `${skill.colorPrimary}88`,
                    backgroundColor: `${skill.colorPrimary}1a`,
                    color: skill.colorPrimary,
                  }}
                >
                  {skill.slot}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{skill.name}</h3>
                    <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                      Tecla {skill.slot}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{skill.description}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-mono-num text-slate-300">
                    {skill.damageMultiplier > 0 && (
                      <span className="text-orange-300">{skill.damageMultiplier}x Dano</span>
                    )}
                    {skill.aoeRadiusTiles > 0 && (
                      <span className="text-amber-300">Área {skill.aoeRadiusTiles}m</span>
                    )}
                    <span className="text-sky-300">{skill.kiCost} Ki</span>
                    <span className="text-slate-400">{skill.cooldownSec}s Recarga</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!unlocked || cdRemaining > 0 || !enoughKi}
                onClick={() => onCastSkill(skill)}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  !unlocked
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : cdRemaining > 0
                    ? 'bg-slate-800 text-amber-300 cursor-not-allowed'
                    : !enoughKi
                    ? 'bg-slate-800 text-sky-400/60 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                }`}
              >
                {!unlocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Desbloqueia no Nível {skill.requiredLevel}</span>
                  </>
                ) : cdRemaining > 0 ? (
                  <>
                    <Flame className="w-3.5 h-3.5" />
                    <span>Recarregando ({cdRemaining}s)</span>
                  </>
                ) : !enoughKi ? (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Ki Insuficiente</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Usar {skill.shortName}</span>
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
