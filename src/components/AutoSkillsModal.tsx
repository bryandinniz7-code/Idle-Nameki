import React, { useState } from 'react';
import { Check, Sparkles, Swords, Trash2, X } from 'lucide-react';
import { COMBAT_SKILLS } from '../game/skills.ts';

export const MAX_AUTO_SKILLS = 5;

interface AutoSkillsModalProps {
  playerLevel: number;
  autoSkillIds: string[];
  onChangeAutoSkillIds: (nextIds: string[]) => void;
  onResetDefault: () => void;
  onClose: () => void;
}

export const AutoSkillsModal: React.FC<AutoSkillsModalProps> = ({
  playerLevel,
  autoSkillIds,
  onChangeAutoSkillIds,
  onResetDefault,
  onClose,
}) => {
  const [limitWarning, setLimitWarning] = useState(false);

  const toggleSkill = (skillId: string) => {
    setLimitWarning(false);
    if (autoSkillIds.includes(skillId)) {
      onChangeAutoSkillIds(autoSkillIds.filter((id) => id !== skillId));
      return;
    }
    if (autoSkillIds.length >= MAX_AUTO_SKILLS) {
      setLimitWarning(true);
      return;
    }
    onChangeAutoSkillIds([...autoSkillIds, skillId]);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#0B0F17] shadow-2xl overflow-hidden flex flex-col max-h-[86vh]">
        <div className="border-b border-slate-800 bg-[#131A26] px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-400/40 text-sky-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-pixel text-xs sm:text-sm text-white">
                CONFIGURAÇÃO DE HABILIDADES
              </h2>
              <p className="text-[11px] text-slate-400">
                Escolha até {MAX_AUTO_SKILLS} habilidades para serem usadas automaticamente (
                <span className="text-sky-300 font-bold">
                  {autoSkillIds.length}/{MAX_AUTO_SKILLS}
                </span>
                )
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            aria-label="Fechar configuração de habilidades"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {limitWarning && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs text-amber-200 font-medium">
              Limite de {MAX_AUTO_SKILLS} habilidades automáticas atingido. Desmarque uma antes de
              adicionar outra.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {COMBAT_SKILLS.map((skill) => {
              const orderIdx = autoSkillIds.indexOf(skill.id);
              const selected = orderIdx >= 0;
              const unlocked = playerLevel >= skill.requiredLevel;

              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className={`rounded-xl border p-3 text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    selected
                      ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_12px_rgba(56,189,248,0.18)]'
                      : 'border-slate-800 bg-[#131A26] hover:border-slate-600'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                      selected
                        ? 'border-sky-400 bg-[#0B0F17]'
                        : 'border-slate-700 bg-[#0B0F17]'
                    }`}
                  >
                    <Swords className="w-4 h-4" style={{ color: skill.colorPrimary }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-white truncate">
                        {skill.slot}. {skill.name}
                      </span>
                      {selected ? (
                        <span className="px-1.5 py-0.5 rounded bg-sky-500 text-slate-950 font-mono-num text-[10px] font-bold flex items-center gap-0.5 shrink-0">
                          <Check className="w-3 h-3" />
                          <span>#{orderIdx + 1}</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[9px] font-bold shrink-0">
                          OFF
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
                      {skill.description}
                    </p>

                    <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono-num">
                      <span className={unlocked ? 'text-emerald-400' : 'text-red-400'}>
                        Nv.{skill.requiredLevel}
                      </span>
                      <span className="text-sky-300">{skill.kiCost} Ki</span>
                      <span className="text-slate-400">{skill.cooldownSec}s CD</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-800 bg-[#131A26] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLimitWarning(false);
                onChangeAutoSkillIds([]);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] hover:border-red-400/60 text-xs text-slate-300 hover:text-red-300 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLimitWarning(false);
                onResetDefault();
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] hover:border-slate-500 text-xs text-slate-200 cursor-pointer"
            >
              Padrão (5)
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
          >
            Salvar & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
