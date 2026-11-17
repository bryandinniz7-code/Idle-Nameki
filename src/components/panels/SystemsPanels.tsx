import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Compass,
  Crown,
  Flame,
  Heart,
  Skull,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  BOSSES,
  DIVINE_UPGRADES,
  MAPS,
  PETS,
  RARITY_CONFIG,
  SHENLONG_WISHES,
  TOURNAMENT_SHOP_ITEMS,
} from '../../game/data.ts';
import {
  PRESTIGE_MIN_LEVEL,
  formatNumber,
  getBestiaryTierInfo,
  getMapById,
  getPetLevel,
  xpRequiredForPetLevel,
} from '../../game/engine.ts';
import type {
  PlayerSaveState,
  PublicProfile,
  WorldBossState,
} from '../../game/types.ts';
import {
  DragonBallIcon,
  MonsterPixelSprite,
  PetPixelSprite,
  WarriorPixelSprite,
} from '../PixelSprites.tsx';

/* ============================================================================
 * 1. ESFERAS DO DRAGÃO & SHENLONG
 * ============================================================================ */
interface DragonBallsPanelProps {
  player: PlayerSaveState;
  onSummonShenlong: (wishId: string) => void;
}

export const DragonBallsPanel: React.FC<DragonBallsPanelProps> = ({
  player,
  onSummonShenlong,
}) => {
  const owned = new Set(player.dragonBalls ?? []);
  const allSeven = [1, 2, 3, 4, 5, 6, 7].every((s) => owned.has(s));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-[#131A26] to-[#1e1b10] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-amber-300 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <span>Esferas do Dragão & Shenlong</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Derrote monstros, chefes e abra baús pelos mapas para reunir as 7 Esferas e invocar Shenlong!
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-lg border border-amber-400/50 bg-amber-500/15 font-mono-num text-xs font-bold text-amber-200">
          {owned.size} / 7 Esferas
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2 rounded-xl border border-slate-800 bg-[#131A26] p-4 justify-items-center">
        {[1, 2, 3, 4, 5, 6, 7].map((stars) => (
          <div key={stars} className="flex flex-col items-center gap-1.5">
            <DragonBallIcon stars={stars} collected={owned.has(stars)} size={48} />
            <span
              className={`text-[10px] font-bold ${
                owned.has(stars) ? 'text-amber-300' : 'text-slate-500'
              }`}
            >
              {stars}★
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
          Desejos de Shenlong {allSeven ? '(Pronto para Invocar!)' : '(Reúna as 7 Esferas)'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SHENLONG_WISHES.map((w) => (
            <div
              key={w.id}
              className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <h4 className="text-sm font-bold text-amber-300">{w.title}</h4>
                <p className="text-xs text-slate-300 mt-1">{w.description}</p>
              </div>
              <button
                type="button"
                disabled={!allSeven}
                onClick={() => onSummonShenlong(w.id)}
                className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer"
              >
                {allSeven ? 'Invocar Shenlong & Realizar Desejo' : 'Reúna 7 Esferas'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. COMPANHEIROS / MASCOTES NO MAPA
 * ============================================================================ */
interface PetsPanelProps {
  player: PlayerSaveState;
  onUnlockPet: (petId: string) => void;
  onEquipPet: (petId: string | null) => void;
}

export const PetsPanel: React.FC<PetsPanelProps> = ({
  player,
  onUnlockPet,
  onEquipPet,
}) => {
  const petLvl = getPetLevel(player.petXp ?? 0);
  const nextXp = xpRequiredForPetLevel(petLvl);
  const unlocked = player.unlockedPets ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400" />
            <span>Mascotes & Companheiros</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Seu mascote segue você pelo mapa 2D, ganha XP nos abates e multiplica seus bônus!
          </p>
        </div>
        <div className="text-right font-mono-num text-xs">
          <p className="text-pink-300 font-bold">Vínculo Nível {petLvl}/50</p>
          <p className="text-slate-400 text-[10px]">
            XP de Mascote: {formatNumber(player.petXp ?? 0)} / {formatNumber(nextXp)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PETS.map((pet) => {
          const isOwned = unlocked.includes(pet.id);
          const isEquipped = player.activePetId === pet.id;
          const canUnlock =
            player.level >= pet.requiredLevel &&
            player.zeni >= pet.unlockCostZeni;
          const scale = 1 + (petLvl - 1) * 0.04;

          return (
            <div
              key={pet.id}
              className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
                isEquipped
                  ? 'border-pink-400/70 bg-pink-500/10'
                  : 'border-slate-800 bg-[#131A26]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-xl border border-slate-700 bg-[#0B0F17] p-1.5 shrink-0">
                  <PetPixelSprite petId={pet.id} size={46} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{pet.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{pet.description}</p>
                  <p className="text-[10px] font-mono-num text-emerald-300 mt-1">
                    {pet.bonuses.damageBonusPct > 0 &&
                      `+${Math.round(pet.bonuses.damageBonusPct * scale)}% Dano `}
                    {pet.bonuses.xpBonusPct > 0 &&
                      `+${Math.round(pet.bonuses.xpBonusPct * scale)}% XP `}
                    {pet.bonuses.zeniBonusPct > 0 &&
                      `+${Math.round(pet.bonuses.zeniBonusPct * scale)}% Zeni `}
                    {pet.bonuses.dropBonusPct > 0 &&
                      `+${(pet.bonuses.dropBonusPct * scale).toFixed(1)}% Sorte Drop`}
                  </p>
                </div>
              </div>

              {isOwned ? (
                <button
                  type="button"
                  onClick={() => onEquipPet(isEquipped ? null : pet.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0 ${
                    isEquipped
                      ? 'border border-pink-400/50 text-pink-200 bg-pink-500/20'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {isEquipped ? 'Guardar' : 'Equipar'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canUnlock}
                  onClick={() => onUnlockPet(pet.id)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] cursor-pointer shrink-0 text-right"
                >
                  <div>Desbloquear</div>
                  <div className="text-[9px] font-mono-num">
                    {formatNumber(pet.unlockCostZeni)} Z · Nv.{pet.requiredLevel}
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. BESTIÁRIO & MAESTRIA DE MONSTROS
 * ============================================================================ */
interface BestiaryPanelProps {
  player: PlayerSaveState;
}

export const BestiaryPanel: React.FC<BestiaryPanelProps> = ({ player }) => {
  const entries = useMemo(() => {
    const list: {
      id: string;
      name: string;
      mapName: string;
      archetype: string;
      colorPrimary: string;
      colorSecondary: string;
      isBoss: boolean;
      level: number;
      xpReward: number;
      zeniReward: number;
      drops: string[];
    }[] = [];

    for (const map of MAPS) {
      for (const m of map.monsters) {
        list.push({
          id: m.id,
          name: m.name,
          mapName: map.name,
          archetype: m.archetype,
          colorPrimary: m.colorPrimary,
          colorSecondary: m.colorSecondary,
          isBoss: false,
          level: m.level,
          xpReward: m.xpReward,
          zeniReward: m.zeniReward,
          drops: m.possibleDrops,
        });
      }
      const b = BOSSES.find((boss) => boss.mapId === map.id);
      if (b) {
        list.push({
          id: b.id,
          name: b.name,
          mapName: map.name,
          archetype: b.archetype,
          colorPrimary: b.colorPrimary,
          colorSecondary: b.colorSecondary,
          isBoss: true,
          level: b.requiredLevel,
          xpReward: b.xpReward,
          zeniReward: b.zeniReward,
          drops: b.exclusiveDrops,
        });
      }
    }
    return list;
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4">
        <h2 className="font-pixel text-base sm:text-lg text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-400" />
          <span>Bestiário & Maestria de Monstros</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Quanto mais você derrota cada inimigo, maior o bônus permanente de Dano e XP contra ele (até +25% Dano e +15% XP!).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[450px] overflow-y-auto pr-1">
        {entries.map((e) => {
          const kills = player.stats.killsByMonsterId?.[e.id] ?? 0;
          const info = getBestiaryTierInfo(kills);
          const pct = info.nextTarget
            ? Math.min(100, Math.round((kills / info.nextTarget) * 100))
            : 100;

          return (
            <div
              key={e.id}
              className={`rounded-xl border p-3.5 flex items-center gap-3 ${
                e.isBoss ? 'border-amber-500/40 bg-[#191520]' : 'border-slate-800 bg-[#131A26]'
              }`}
            >
              <div className="rounded-lg bg-[#0B0F17] border border-slate-800 p-1.5 shrink-0">
                <MonsterPixelSprite
                  archetype={e.archetype}
                  colorPrimary={e.colorPrimary}
                  colorSecondary={e.colorSecondary}
                  isBoss={e.isBoss}
                  size={44}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-white truncate">
                    {e.name} {e.isBoss ? '👑' : ''}
                  </p>
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-[9px] font-bold text-sky-300 shrink-0">
                    {info.label} (T{info.tier})
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {e.mapName} · Nv.{e.level} · {formatNumber(e.xpReward)} XP / {formatNumber(e.zeniReward)} Zeni
                </p>
                <div className="relative h-2 rounded bg-slate-900 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono-num">
                  <span className="text-slate-300">
                    Abates: {formatNumber(kills)}
                    {info.nextTarget ? ` / ${formatNumber(info.nextTarget)}` : ' (MÁX)'}
                  </span>
                  <span className="text-emerald-300">
                    +{info.damageBonusPct}% Dano · +{info.xpBonusPct}% XP
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. TORNEIO DE ARTES MARCIAIS (ARENA PVP + LOJA)
 * ============================================================================ */
interface TournamentPanelProps {
  player: PlayerSaveState;
  myPowerLevel: number;
  opponents: PublicProfile[];
  onFightOpponent: (opp: { name: string; level: number; powerLevel: number; race: string; transformationId: string }) => {
    won: boolean;
    pointsEarned: number;
    zeniEarned: number;
    summary: string;
  };
  onBuyTournamentReward: (itemId: string) => void;
}

export const TournamentPanel: React.FC<TournamentPanelProps> = ({
  player,
  myPowerLevel,
  opponents,
  onFightOpponent,
  onBuyTournamentReward,
}) => {
  const [subTab, setSubTab] = useState<'arena' | 'shop'>('arena');
  const [lastResult, setLastResult] = useState<{
    won: boolean;
    pointsEarned: number;
    zeniEarned: number;
    summary: string;
  } | null>(null);

  const arenaList = useMemo(() => {
    const others = opponents.filter((o) => o.uid !== player.uid);
    if (others.length > 0) return others.slice(0, 12);
    return [
      {
        uid: 'npc_tien',
        name: 'Tenshinhan (Arena)',
        race: 'earthling' as const,
        level: Math.max(5, player.level),
        powerLevel: Math.max(500, Math.floor(myPowerLevel * 0.82)),
        transformationId: 'base',
        title: 'Mestre Garça',
      },
      {
        uid: 'npc_piccolo',
        name: 'Piccolo Jr. (Arena)',
        race: 'namekian' as const,
        level: Math.max(10, player.level + 2),
        powerLevel: Math.max(800, Math.floor(myPowerLevel * 1.05)),
        transformationId: 'potential_unleashed',
        title: 'Guerreiro Namek',
      },
      {
        uid: 'npc_vegeta',
        name: 'Vegeta (Arena)',
        race: 'saiyan' as const,
        level: Math.max(15, player.level + 5),
        powerLevel: Math.max(1200, Math.floor(myPowerLevel * 1.25)),
        transformationId: 'ssj',
        title: 'Príncipe Saiyajin',
      },
    ];
  }, [opponents, player.uid, player.level, myPowerLevel]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/40 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-amber-300 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            <span>Torneio de Artes Marciais (Tenkaichi)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Duele 1v1 contra guerreiros do ranking para ganhar Pontos de Torneio e o título &ldquo;Campeão Mundial&rdquo; (5 vitórias)!
          </p>
        </div>
        <div className="text-right font-mono-num text-xs">
          <p className="text-amber-300 font-bold">{formatNumber(player.tournamentPoints ?? 0)} Pontos</p>
          <p className="text-slate-400 text-[10px]">Vitórias: {player.tournamentWins ?? 0}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSubTab('arena')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${
            subTab === 'arena'
              ? 'bg-amber-400 text-slate-950'
              : 'border border-slate-700 bg-[#131A26] text-slate-300'
          }`}
        >
          Arena de Duelos
        </button>
        <button
          type="button"
          onClick={() => setSubTab('shop')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${
            subTab === 'shop'
              ? 'bg-orange-500 text-slate-950'
              : 'border border-slate-700 bg-[#131A26] text-slate-300'
          }`}
        >
          Loja do Torneio
        </button>
      </div>

      {lastResult && (
        <div
          className={`rounded-xl border p-3.5 text-xs ${
            lastResult.won
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/50 bg-red-500/10 text-red-200'
          }`}
        >
          <p className="font-bold">
            {lastResult.won ? 'VITÓRIA NA ARENA!' : 'DERROTA NA ARENA'} · +{lastResult.pointsEarned} Pts · +{formatNumber(lastResult.zeniEarned)} Zeni
          </p>
          <p className="text-slate-300 mt-0.5">{lastResult.summary}</p>
        </div>
      )}

      {subTab === 'arena' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[370px] overflow-y-auto pr-1">
          {arenaList.map((opp) => (
            <div
              key={opp.uid}
              className="rounded-xl border border-slate-800 bg-[#131A26] p-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <WarriorPixelSprite
                  race={opp.race}
                  transformationId={opp.transformationId}
                  size={40}
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{opp.name}</p>
                  <p className="text-[10px] text-slate-400">
                    Nv.{opp.level} · PL {formatNumber(opp.powerLevel)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLastResult(onFightOpponent(opp))}
                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Duelar</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TOURNAMENT_SHOP_ITEMS.map((item) => {
            const canBuy = (player.tournamentPoints ?? 0) >= item.costPoints;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-bold text-white">{item.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                </div>
                <button
                  type="button"
                  disabled={!canBuy}
                  onClick={() => onBuyTournamentReward(item.id)}
                  className="px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer shrink-0"
                >
                  {item.costPoints} Pts
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 5. PRESTIGE / DESPERTAR DO VELHO KAIOSHIN
 * ============================================================================ */
interface PrestigePanelProps {
  player: PlayerSaveState;
  onPerformPrestige: () => void;
  onBuyDivineUpgrade: (upgradeId: string) => void;
}

export const PrestigePanel: React.FC<PrestigePanelProps> = ({
  player,
  onPerformPrestige,
  onBuyDivineUpgrade,
}) => {
  const canPrestige = player.level >= PRESTIGE_MIN_LEVEL;
  const previewPoints = canPrestige
    ? Math.max(1, Math.floor((player.level - PRESTIGE_MIN_LEVEL) / 10) + 2)
    : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-500/40 bg-gradient-to-br from-[#161224] to-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-purple-300 flex items-center gap-2">
            <Crown className="w-5 h-5" />
            <span>Despertar do Velho Kaioshin (Prestige)</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Alcance o Nível {PRESTIGE_MIN_LEVEL}+ para renascer no Nível 1 mantendo equipamentos, transformações, títulos, mascotes, guilda e Esferas!
          </p>
        </div>
        <div className="text-right font-mono-num text-xs">
          <p className="text-purple-300 font-bold">Prestige {player.prestigeLevel ?? 0}</p>
          <p className="text-amber-300 font-bold">{player.divinePoints ?? 0} Pontos Divinos</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs space-y-1">
          <p className="text-white font-bold">
            {canPrestige
              ? `Você pode renascer agora e ganhar +${previewPoints} Pontos Divinos!`
              : `Continue treinando! Falta atingir o Nível ${PRESTIGE_MIN_LEVEL} (Atual: ${player.level}).`}
          </p>
          <p className="text-slate-400">
            Reinicia: Nível, XP e Treinos base · Mantém todo o resto!
          </p>
        </div>
        <button
          type="button"
          disabled={!canPrestige}
          onClick={onPerformPrestige}
          className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-400 hover:to-fuchsia-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-xs cursor-pointer"
        >
          Despertar Poder Divino
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DIVINE_UPGRADES.map((u) => {
          const curLvl = player.divineUpgrades?.[u.id] ?? 0;
          const atMax = curLvl >= u.maxLevel;
          const cost = u.costPerLevel + curLvl;
          const canBuy = !atMax && (player.divinePoints ?? 0) >= cost;
          return (
            <div
              key={u.id}
              className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-bold text-white">
                  {u.name} <span className="text-purple-300 font-mono-num">Nv.{curLvl}/{u.maxLevel}</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{u.description}</p>
                <p className="text-[11px] text-emerald-300 font-mono-num mt-1">
                  Bônus Atual: +{curLvl * u.bonusPerLevelPct}%
                </p>
              </div>
              <button
                type="button"
                disabled={!canBuy}
                onClick={() => onBuyDivineUpgrade(u.id)}
                className="px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs cursor-pointer shrink-0"
              >
                {atMax ? 'MÁX' : `${cost} PD`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
 * 6. INVASÕES DE WORLD BOSS MULTIPLAYER
 * ============================================================================ */
interface WorldBossPanelProps {
  player: PlayerSaveState;
  worldBoss: WorldBossState | null;
  nowMs: number;
  onGoToBossMap: (mapId: string) => void;
  onAttackWorldBoss: () => void;
  onSpawnNextWorldBoss: () => void;
}

export const WorldBossPanel: React.FC<WorldBossPanelProps> = ({
  player,
  worldBoss,
  nowMs,
  onGoToBossMap,
  onAttackWorldBoss,
  onSpawnNextWorldBoss,
}) => {
  const sameMap = worldBoss && worldBoss.mapId === player.currentMapId;
  const pct = worldBoss
    ? Math.max(0, Math.min(100, (worldBoss.hp / Math.max(1, worldBoss.maxHp)) * 100))
    : 0;
  const respawnLeftSec = worldBoss
    ? Math.max(0, Math.ceil((worldBoss.respawnAtMs - nowMs) / 1000))
    : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-pink-500/40 bg-gradient-to-br from-[#1b1124] to-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-pink-300 flex items-center gap-2">
            <Flame className="w-5 h-5" />
            <span>Invasão Global de World Boss</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Todos os jogadores atacam o mesmo World Boss em tempo real! Quem causar dano ganha Zeni, Fragmentos e chance de item Mítico.
          </p>
        </div>
      </div>

      {!worldBoss ? (
        <div className="rounded-xl border border-slate-800 bg-[#131A26] p-6 text-center space-y-3">
          <p className="text-xs text-slate-300">
            Nenhum World Boss invocado no servidor ainda.
          </p>
          <button
            type="button"
            onClick={onSpawnNextWorldBoss}
            className="px-4 py-2.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold text-xs cursor-pointer"
          >
            Invocar Invasão Global Agora
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-pink-500/40 bg-[#0B0F17] p-2">
                <MonsterPixelSprite
                  archetype={worldBoss.archetype}
                  colorPrimary={worldBoss.colorPrimary}
                  colorSecondary={worldBoss.colorSecondary}
                  isBoss
                  size={60}
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-pink-400">
                  {worldBoss.status === 'active' ? 'INVASÃO ATIVA' : 'DERROTADO'}
                </p>
                <h3 className="font-pixel text-base text-white">{worldBoss.name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  <span>Local: {getMapById(worldBoss.mapId).name}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {worldBoss.status === 'active' ? (
                <>
                  {!sameMap && (
                    <button
                      type="button"
                      onClick={() => onGoToBossMap(worldBoss.mapId)}
                      className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Ir para {getMapById(worldBoss.mapId).name}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onAttackWorldBoss}
                    className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Golpear World Boss</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={respawnLeftSec > 0}
                  onClick={onSpawnNextWorldBoss}
                  className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {respawnLeftSec > 0
                    ? `Próxima Invasão em ${respawnLeftSec}s`
                    : 'Invocar Novo World Boss'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono-num">
              <span className="text-slate-400">HP Global Compartilhado</span>
              <span className="text-pink-300 font-bold">
                {formatNumber(worldBoss.hp)} / {formatNumber(worldBoss.maxHp)} ({pct.toFixed(1)}%)
              </span>
            </div>
            <div className="h-4 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-600 to-rose-400 transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 space-y-2">
            <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Skull className="w-3.5 h-3.5" />
              <span>Ranking de Dano da Invasão</span>
            </p>
            {worldBoss.topDamagers.length === 0 ? (
              <p className="text-xs text-slate-500">Ninguém causou dano ainda.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {worldBoss.topDamagers.map((d, i) => (
                  <div
                    key={d.uid}
                    className="flex items-center justify-between text-xs font-mono-num"
                  >
                    <span className="text-slate-200">
                      #{i + 1} {d.name}
                    </span>
                    <span className="text-pink-300 font-bold">{formatNumber(d.damage)} dano</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
