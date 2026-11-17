import React from 'react';
import { Award, Clock, Coins, Package, Skull, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { RARITY_CONFIG, TRAINING_DISCIPLINES } from '../game/data.ts';
import { formatDuration, formatNumber } from '../game/engine.ts';
import type { AfkSummary } from '../game/types.ts';
import { ItemPixelIcon } from './PixelSprites.tsx';

interface WelcomeBackModalProps {
  summary: AfkSummary;
  onClose: () => void;
}

export const WelcomeBackModal: React.FC<WelcomeBackModalProps> = ({ summary, onClose }) => {
  const trainingDisc = summary.trainingStat
    ? TRAINING_DISCIPLINES.find((d) => d.id === summary.trainingStat)
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-back-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-orange-500/40 bg-[#131A26] shadow-2xl overflow-hidden">
        <div className="border-b border-slate-800 bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-sky-500/10 px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-orange-400">
              Progresso Offline Validado no Servidor · {summary.mapName}
            </p>
            <h2
              id="welcome-back-title"
              className="font-pixel text-lg sm:text-xl text-white mt-1 tracking-wide"
            >
              BEM-VINDO DE VOLTA!
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono-num bg-[#0B0F17] border border-slate-800 px-3 py-2 rounded-lg shrink-0">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>{formatDuration(summary.offlineSeconds)}</span>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                <span>XP Recebido</span>
              </div>
              <p className="mt-1.5 text-lg font-bold font-mono-num text-sky-300">
                +{formatNumber(summary.xpGained)}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Zeni Coletado</span>
              </div>
              <p className="mt-1.5 text-lg font-bold font-mono-num text-amber-300">
                +{formatNumber(summary.zeniGained)}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                <span>Níveis Conquistados</span>
              </div>
              <p className="mt-1.5 text-lg font-bold font-mono-num text-emerald-300">
                +{summary.levelsGained}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Skull className="w-3.5 h-3.5 text-orange-400" />
                <span>Monstros Derrotados</span>
              </div>
              <p className="mt-1.5 text-lg font-bold font-mono-num text-orange-300">
                {formatNumber(summary.monstersKilled)}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Package className="w-3.5 h-3.5 text-slate-300" />
                <span>Itens Encontrados</span>
              </div>
              <p className="mt-1.5 text-lg font-bold font-mono-num text-slate-100">
                {summary.itemsFound.length}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Equipamentos Raros</span>
              </div>
              <p className="mt-1.5 text-lg font-bold font-mono-num text-purple-300">
                {summary.rareItemsFound.length}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0B0F17] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" />
              Ki Acumulado: <strong className="font-mono-num text-sky-300">+{formatNumber(summary.kiGained)}</strong>
            </span>
            {summary.mode === 'training' && trainingDisc && summary.trainingBonusGained ? (
              <span className="text-emerald-300 font-medium">
                {trainingDisc.name}: +{formatNumber(summary.trainingBonusGained)} ({trainingDisc.statLabel})
              </span>
            ) : (
              <span className="text-slate-400">Modo: Combate Automático AFK</span>
            )}
          </div>

          {summary.rareItemsFound.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300">
                Equipamentos Raros Descobertos ({summary.rareItemsFound.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {summary.rareItemsFound.map((item) => {
                  const cfg = RARITY_CONFIG[item.rarity];
                  return (
                    <div
                      key={item.uid}
                      className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#0B0F17] p-2.5"
                    >
                      <ItemPixelIcon iconType={item.iconType} rarity={item.rarity} size={34} />
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${cfg.textClass}`}>
                          {item.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {cfg.label} · Nível {item.requiredLevel}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 bg-[#0B0F17]/70 px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            Coletar e Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
