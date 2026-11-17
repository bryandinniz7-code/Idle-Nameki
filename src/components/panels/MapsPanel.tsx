import React from 'react';
import { Check, Lock, MapPin, Skull, Sparkles } from 'lucide-react';
import { BOSSES, ITEM_TEMPLATES, MAPS } from '../../game/data.ts';
import { formatNumber } from '../../game/engine.ts';
import type { PlayerSaveState } from '../../game/types.ts';
import { MonsterPixelSprite } from '../PixelSprites.tsx';

interface MapsPanelProps {
  player: PlayerSaveState;
  onSelectMap: (mapId: string) => void;
}

const BACKDROP_THUMBS: Record<'earth' | 'space' | 'divine', string> = {
  earth: '/src/assets/images/pixel_arena_earth_namek_1794876900814.jpg',
  space: '/src/assets/images/pixel_arena_space_planet_1794876901321.jpg',
  divine: '/src/assets/images/pixel_arena_divine_realm_1794876902193.jpg',
};

export const MapsPanel: React.FC<MapsPanelProps> = ({ player, onSelectMap }) => {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white">Mapas & Regiões</h2>
          <p className="text-xs text-slate-400 mt-1">
            Explore 12 locais icônicos. Alcance o nível exigido para desbloquear áreas mais fortes.
          </p>
        </div>
        <span className="text-xs font-mono-num text-orange-400">
          Seu Nível: {player.level}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MAPS.map((map) => {
          const unlocked = player.level >= map.requiredLevel;
          const isCurrent = player.currentMapId === map.id;
          const boss = BOSSES.find((b) => b.id === map.bossId);
          const rareNames = map.rareDropIds
            .map((id) => ITEM_TEMPLATES.find((t) => t.id === id)?.name)
            .filter(Boolean)
            .join(', ');

          return (
            <div
              key={map.id}
              className={`rounded-xl border overflow-hidden bg-[#131A26] flex flex-col justify-between transition-colors ${
                isCurrent
                  ? 'border-orange-500'
                  : unlocked
                  ? 'border-slate-800 hover:border-slate-700'
                  : 'border-slate-800/60 opacity-75'
              }`}
            >
              <div>
                <div className="relative h-28 overflow-hidden bg-[#0B0F17]">
                  <img
                    src={BACKDROP_THUMBS[map.backdropKey]}
                    alt={map.name}
                    className={`w-full h-full object-cover pixelated ${
                      unlocked ? 'opacity-80' : 'opacity-30 grayscale'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#131A26] via-[#131A26]/30 to-transparent" />
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono-num bg-[#0B0F17]/85 border border-slate-700 px-2.5 py-1 rounded text-slate-200">
                      Nv. {map.requiredLevel}+ · {map.difficulty}
                    </span>
                    <span className="font-mono-num bg-[#0B0F17]/85 border border-slate-700 px-2.5 py-1 rounded text-sky-300">
                      PL {formatNumber(map.recommendedPower)}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-pixel text-sm text-white">{map.order}. {map.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{map.subtitle}</p>
                  </div>

                  {/* Monsters preview */}
                  <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#0B0F17] p-2.5">
                    {map.monsters.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 min-w-0">
                        <MonsterPixelSprite
                          archetype={m.archetype}
                          colorPrimary={m.colorPrimary}
                          colorSecondary={m.colorSecondary}
                          size={34}
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-200 truncate">{m.name}</p>
                          <p className="text-[10px] font-mono-num text-slate-400">
                            Nv.{m.level} · +{formatNumber(m.xpReward)} XP
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-300">
                    {boss && (
                      <p className="flex items-center gap-1.5 text-amber-300">
                        <Skull className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Chefe Especial: <strong>{boss.name}</strong> (Nv.{boss.requiredLevel})
                        </span>
                      </p>
                    )}
                    <p className="flex items-start gap-1.5 text-slate-400">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-sky-400 mt-0.5" />
                      <span>Drops: {rareNames}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4">
                <button
                  type="button"
                  disabled={!unlocked || isCurrent}
                  onClick={() => onSelectMap(map.id)}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 cursor-default'
                      : unlocked
                      ? 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Mapa Atual</span>
                    </>
                  ) : unlocked ? (
                    <>
                      <MapPin className="w-4 h-4" />
                      <span>Viajar para {map.name}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Requer Nível {map.requiredLevel}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
