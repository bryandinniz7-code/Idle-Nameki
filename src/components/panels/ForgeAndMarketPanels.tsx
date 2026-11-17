import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Coins,
  Flame,
  Hammer,
  Package,
  Recycle,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
} from 'lucide-react';
import { CATEGORY_LABELS, RARITY_CONFIG, SLOT_LABELS } from '../../game/data.ts';
import {
  MAX_FORGE_LEVEL,
  formatNumber,
  getEffectiveItemStats,
  getSalvageFragments,
  getUpgradeCost,
} from '../../game/engine.ts';
import type {
  EquipSlot,
  InventoryItem,
  MarketListing,
  PlayerSaveState,
  Rarity,
} from '../../game/types.ts';
import { ItemPixelIcon } from '../PixelSprites.tsx';

/* ============================================================================
 * 1. FORGE, SALVAGE & RARITY FUSION PANEL
 * ============================================================================ */
interface ForgePanelProps {
  player: PlayerSaveState;
  onUpgradeItem: (target: { kind: 'equipped'; slot: EquipSlot } | { kind: 'inventory'; uid: string }) => void;
  onSalvageItem: (itemUid: string) => void;
  onBulkSalvageCommonUncommon: () => void;
  onFuseRarity: (itemUids: string[]) => void;
}

const EQUIP_SLOTS: EquipSlot[] = [
  'sword',
  'armor',
  'helmet',
  'boots',
  'gloves',
  'accessory',
  'necklace',
  'earring',
];

const NEXT_RARITY_MAP: Partial<Record<Rarity, Rarity>> = {
  Common: 'Uncommon',
  Uncommon: 'Rare',
  Rare: 'Epic',
  Epic: 'Legendary',
  Legendary: 'Mythical',
};

export const ForgePanel: React.FC<ForgePanelProps> = ({
  player,
  onUpgradeItem,
  onSalvageItem,
  onBulkSalvageCommonUncommon,
  onFuseRarity,
}) => {
  const [subTab, setSubTab] = useState<'upgrade' | 'salvage' | 'fusion'>('upgrade');
  const [selectedTarget, setSelectedTarget] = useState<
    { kind: 'equipped'; slot: EquipSlot } | { kind: 'inventory'; uid: string } | null
  >(null);
  const [fusionRarity, setFusionRarity] = useState<Rarity>('Common');
  const [fusionPicked, setFusionPicked] = useState<string[]>([]);

  const upgradeCandidates = useMemo(() => {
    const list: {
      key: string;
      target: { kind: 'equipped'; slot: EquipSlot } | { kind: 'inventory'; uid: string };
      labelPrefix: string;
      item: InventoryItem;
    }[] = [];

    for (const slot of EQUIP_SLOTS) {
      const it = player.equipped[slot];
      if (it) {
        list.push({
          key: `eq_${slot}`,
          target: { kind: 'equipped', slot },
          labelPrefix: `Equipado (${SLOT_LABELS[slot]})`,
          item: it,
        });
      }
    }

    for (const it of player.inventory) {
      if (it.category !== 'special') {
        list.push({
          key: `inv_${it.uid}`,
          target: { kind: 'inventory', uid: it.uid },
          labelPrefix: 'Mochila',
          item: it,
        });
      }
    }
    return list;
  }, [player.equipped, player.inventory]);

  const activeEntry = useMemo(() => {
    if (!selectedTarget) return upgradeCandidates[0] ?? null;
    if (selectedTarget.kind === 'equipped') {
      return (
        upgradeCandidates.find(
          (e) => e.target.kind === 'equipped' && e.target.slot === selectedTarget.slot
        ) ?? upgradeCandidates[0] ?? null
      );
    }
    return (
      upgradeCandidates.find(
        (e) => e.target.kind === 'inventory' && e.target.uid === selectedTarget.uid
      ) ?? upgradeCandidates[0] ?? null
    );
  }, [selectedTarget, upgradeCandidates]);

  const salvageableItems = useMemo(
    () => player.inventory.filter((i) => i.category !== 'special'),
    [player.inventory]
  );

  const bulkSalvageCount = salvageableItems.filter(
    (i) => i.rarity === 'Common' || i.rarity === 'Uncommon'
  ).length;

  const fusionCandidates = useMemo(
    () =>
      player.inventory.filter(
        (i) => i.category !== 'special' && i.rarity === fusionRarity
      ),
    [player.inventory, fusionRarity]
  );

  const toggleFusionPick = (uid: string) => {
    setFusionPicked((prev) => {
      if (prev.includes(uid)) return prev.filter((id) => id !== uid);
      if (prev.length >= 3) return [...prev.slice(1), uid];
      return [...prev, uid];
    });
  };

  const validFusionPicked = fusionPicked.filter((uid) =>
    fusionCandidates.some((i) => i.uid === uid)
  );
  const nextRarity = NEXT_RARITY_MAP[fusionRarity];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white flex items-center gap-2">
            <Hammer className="w-5 h-5 text-orange-400" />
            <span>Forja Galáctica do Dr. Brief</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Aprimore equipamentos até +{MAX_FORGE_LEVEL}, recicle sobras ou funda 3 itens na próxima raridade.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono-num">
          <div className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 font-bold">
            {formatNumber(player.zeni)} Zeni
          </div>
          <div className="px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-bold">
            {formatNumber(player.kiFragments ?? 0)} Fragmentos de Ki
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'upgrade', label: 'Aprimorar (+1 a +15)', icon: <Flame className="w-3.5 h-3.5" /> },
          { id: 'salvage', label: 'Reciclar Fragmentos', icon: <Recycle className="w-3.5 h-3.5" /> },
          { id: 'fusion', label: 'Fusão de Raridade (3→1)', icon: <Sparkles className="w-3.5 h-3.5" /> },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              subTab === t.id
                ? 'bg-orange-500 text-slate-950'
                : 'border border-slate-700 bg-[#131A26] text-slate-300 hover:text-white'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {subTab === 'upgrade' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="rounded-xl border border-slate-800 bg-[#131A26] p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto">
            {upgradeCandidates.length === 0 ? (
              <p className="col-span-full text-center text-xs text-slate-400 py-10">
                Nenhum equipamento disponível para forjar.
              </p>
            ) : (
              upgradeCandidates.map((entry) => {
                const cfg = RARITY_CONFIG[entry.item.rarity];
                const upg = entry.item.upgradeLevel ?? 0;
                const isSel = activeEntry?.key === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setSelectedTarget(entry.target)}
                    className={`text-left rounded-lg border p-3 flex items-center gap-3 cursor-pointer ${
                      isSel
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-800 bg-[#0B0F17] hover:border-slate-700'
                    }`}
                  >
                    <ItemPixelIcon
                      iconType={entry.item.iconType}
                      rarity={entry.item.rarity}
                      upgradeLevel={upg}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-sky-400 font-semibold">{entry.labelPrefix}</p>
                      <p className={`text-xs font-bold truncate ${cfg.textClass}`}>
                        {entry.item.name} {upg > 0 ? `+${upg}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {cfg.label} · Nv.{entry.item.requiredLevel}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-4">
            {activeEntry ? (
              (() => {
                const it = activeEntry.item;
                const curUpg = it.upgradeLevel ?? 0;
                const atMax = curUpg >= MAX_FORGE_LEVEL;
                const cost = getUpgradeCost(it);
                const curStats = getEffectiveItemStats(it);
                const nextStats = getEffectiveItemStats({
                  ...it,
                  upgradeLevel: Math.min(MAX_FORGE_LEVEL, curUpg + 1),
                });
                const canAfford =
                  !atMax &&
                  player.zeni >= cost.zeni &&
                  (player.kiFragments ?? 0) >= cost.fragments;

                return (
                  <>
                    <div className="flex items-center gap-3">
                      <ItemPixelIcon
                        iconType={it.iconType}
                        rarity={it.rarity}
                        upgradeLevel={curUpg}
                        size={48}
                      />
                      <div className="min-w-0">
                        <p className={`text-sm font-bold ${RARITY_CONFIG[it.rarity].textClass}`}>
                          {it.name} {curUpg > 0 ? `+${curUpg}` : ''}
                        </p>
                        <p className="text-xs text-slate-400">
                          {activeEntry.labelPrefix} · {RARITY_CONFIG[it.rarity].label}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 space-y-1.5 text-xs font-mono-num">
                      <p className="text-[11px] font-sans font-semibold text-slate-300">
                        {atMax ? 'Nível Máximo Alcançado (+15)' : `Prévia: +${curUpg} → +${curUpg + 1}`}
                      </p>
                      {(
                        [
                          ['strength', 'Força'],
                          ['defense', 'Defesa'],
                          ['speed', 'Velocidade'],
                          ['maxHp', 'HP'],
                          ['maxKi', 'Ki'],
                        ] as const
                      ).map(([k, lbl]) => {
                        const c = curStats[k] ?? 0;
                        const n = nextStats[k] ?? 0;
                        if (c === 0 && n === 0) return null;
                        return (
                          <p key={k} className="text-slate-200 flex justify-between">
                            <span>{lbl}:</span>
                            <span>
                              {formatNumber(c)}{' '}
                              {!atMax && <span className="text-emerald-400">→ {formatNumber(n)}</span>}
                            </span>
                          </p>
                        );
                      })}
                    </div>

                    {!atMax && (
                      <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 space-y-1 text-xs">
                        <p className="flex justify-between">
                          <span className="text-slate-400">Custo em Zeni:</span>
                          <span
                            className={`font-mono-num font-bold ${
                              player.zeni >= cost.zeni ? 'text-amber-300' : 'text-red-400'
                            }`}
                          >
                            {formatNumber(cost.zeni)}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-slate-400">Fragmentos de Ki:</span>
                          <span
                            className={`font-mono-num font-bold ${
                              (player.kiFragments ?? 0) >= cost.fragments
                                ? 'text-cyan-300'
                                : 'text-red-400'
                            }`}
                          >
                            {cost.fragments}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-slate-400">Taxa de Sucesso:</span>
                          <span className="font-mono-num font-bold text-emerald-300">
                            {cost.successChance}%
                          </span>
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!canAfford || atMax}
                      onClick={() => onUpgradeItem(activeEntry.target)}
                      className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Hammer className="w-4 h-4" />
                      <span>{atMax ? 'Forja Máxima (+15)' : `Forjar para +${curUpg + 1}`}</span>
                    </button>
                  </>
                );
              })()
            ) : (
              <p className="text-xs text-slate-500 text-center py-8">
                Selecione um equipamento ao lado.
              </p>
            )}
          </div>
        </div>
      )}

      {subTab === 'salvage' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-[#131A26] p-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-300">
              Transforme equipamentos sobressalentes em <strong className="text-cyan-300">Fragmentos de Ki</strong> para forjar seus melhores itens.
            </p>
            <button
              type="button"
              disabled={bulkSalvageCount === 0}
              onClick={onBulkSalvageCommonUncommon}
              className="px-3.5 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-40 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Recycle className="w-3.5 h-3.5" />
              <span>Reciclar Comuns/Incomuns ({bulkSalvageCount})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto">
            {salvageableItems.map((it) => {
              const frags = getSalvageFragments(it);
              const cfg = RARITY_CONFIG[it.rarity];
              return (
                <div
                  key={it.uid}
                  className="rounded-lg border border-slate-800 bg-[#131A26] p-3 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ItemPixelIcon
                      iconType={it.iconType}
                      rarity={it.rarity}
                      upgradeLevel={it.upgradeLevel ?? 0}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${cfg.textClass}`}>
                        {it.name} {(it.upgradeLevel ?? 0) > 0 ? `+${it.upgradeLevel}` : ''}
                      </p>
                      <p className="text-[10px] text-cyan-300 font-mono-num">
                        +{frags} Fragmentos
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSalvageItem(it.uid)}
                    className="px-2.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] cursor-pointer shrink-0"
                  >
                    Reciclar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'fusion' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-300 font-semibold">Raridade Base:</span>
              {(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as Rarity[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setFusionRarity(r);
                    setFusionPicked([]);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold border cursor-pointer ${
                    fusionRarity === r
                      ? 'border-orange-400 bg-orange-500/20 text-orange-300'
                      : 'border-slate-700 bg-[#0B0F17] text-slate-400'
                  }`}
                >
                  {RARITY_CONFIG[r].label}
                </button>
              ))}
            </div>

            {nextRarity && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Resultado:</span>
                <span className={`font-bold ${RARITY_CONFIG[nextRarity].textClass}`}>
                  1x {RARITY_CONFIG[nextRarity].label} (Nv.{player.level})
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto">
            {fusionCandidates.length === 0 ? (
              <p className="col-span-full text-center text-xs text-slate-500 py-8">
                Nenhum item de raridade {RARITY_CONFIG[fusionRarity].label} na mochila.
              </p>
            ) : (
              fusionCandidates.map((it) => {
                const picked = validFusionPicked.includes(it.uid);
                return (
                  <button
                    key={it.uid}
                    type="button"
                    onClick={() => toggleFusionPick(it.uid)}
                    className={`text-left rounded-lg border p-3 flex items-center gap-2.5 cursor-pointer ${
                      picked
                        ? 'border-emerald-400 bg-emerald-500/15'
                        : 'border-slate-800 bg-[#131A26] hover:border-slate-700'
                    }`}
                  >
                    <ItemPixelIcon
                      iconType={it.iconType}
                      rarity={it.rarity}
                      upgradeLevel={it.upgradeLevel ?? 0}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${RARITY_CONFIG[it.rarity].textClass}`}>
                        {it.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {picked ? 'Selecionado para Fusão' : CATEGORY_LABELS[it.category]}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={validFusionPicked.length !== 3 || !nextRarity}
              onClick={() => {
                onFuseRarity(validFusionPicked);
                setFusionPicked([]);
              }}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Fundir 3 Itens ({validFusionPicked.length}/3)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 2. GLOBAL MARKETPLACE PANEL
 * ============================================================================ */
interface MarketPanelProps {
  player: PlayerSaveState;
  openListings: MarketListing[];
  myListings: MarketListing[];
  onBuyListing: (listing: MarketListing) => void;
  onCreateListing: (itemUid: string, price: number) => void;
  onCancelListing: (listingId: string) => void;
  onClaimSoldListing: (listing: MarketListing) => void;
}

export const MarketPanel: React.FC<MarketPanelProps> = ({
  player,
  openListings,
  myListings,
  onBuyListing,
  onCreateListing,
  onCancelListing,
  onClaimSoldListing,
}) => {
  const [tab, setTab] = useState<'browse' | 'sell' | 'mine'>('browse');
  const [selectedSellUid, setSelectedSellUid] = useState<string>('');
  const [sellPrice, setSellPrice] = useState<string>('1000');

  const sellable = useMemo(
    () => player.inventory.filter((i) => i.category !== 'special'),
    [player.inventory]
  );
  const chosenSellItem = sellable.find((i) => i.uid === selectedSellUid) ?? sellable[0] ?? null;

  const soldCount = myListings.filter((l) => l.status === 'sold').length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-400" />
            <span>Mercado Global Galáctico</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Compre equipamentos de outros guerreiros online ou anuncie seus drops raros por Zeni.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-mono-num font-bold">
          {formatNumber(player.zeni)} Zeni
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('browse')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            tab === 'browse'
              ? 'bg-emerald-500 text-slate-950'
              : 'border border-slate-700 bg-[#131A26] text-slate-300'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Ofertas ({openListings.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('sell')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            tab === 'sell'
              ? 'bg-orange-500 text-slate-950'
              : 'border border-slate-700 bg-[#131A26] text-slate-300'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Anunciar Item</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            tab === 'mine'
              ? 'bg-amber-400 text-slate-950'
              : 'border border-slate-700 bg-[#131A26] text-slate-300'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Minhas Vendas ({myListings.length}){soldCount > 0 ? ` · ${soldCount} p/ Resgatar!` : ''}</span>
        </button>
      </div>

      {tab === 'browse' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
          {openListings.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-slate-400">
              <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              Nenhuma oferta ativa no momento. Seja o primeiro a anunciar um item!
            </div>
          ) : (
            openListings.map((l) => {
              const cfg = RARITY_CONFIG[l.item.rarity];
              const isMine = l.sellerUid === player.uid;
              const canBuy = !isMine && player.zeni >= l.price;
              const eff = getEffectiveItemStats(l.item);
              const statPreview = [
                eff.strength ? `+${formatNumber(eff.strength)} For` : null,
                eff.defense ? `+${formatNumber(eff.defense)} Def` : null,
                eff.maxHp ? `+${formatNumber(eff.maxHp)} HP` : null,
                eff.maxKi ? `+${formatNumber(eff.maxKi)} Ki` : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={l.id}
                  className="rounded-xl border border-slate-800 bg-[#131A26] p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ItemPixelIcon
                      iconType={l.item.iconType}
                      rarity={l.item.rarity}
                      upgradeLevel={l.item.upgradeLevel ?? 0}
                      size={42}
                    />
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${cfg.textClass}`}>
                        {l.item.name} {(l.item.upgradeLevel ?? 0) > 0 ? `+${l.item.upgradeLevel}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        Vendedor: <span className="text-slate-200">{l.sellerName}</span> · Nv.{l.item.requiredLevel}
                      </p>
                      <p className="text-[10px] text-emerald-300 font-mono-num truncate">
                        {statPreview || cfg.label}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-xs font-mono-num font-bold text-amber-300">
                      {formatNumber(l.price)} Zeni
                    </p>
                    {isMine ? (
                      <span className="inline-block px-2 py-1 rounded bg-slate-800 text-[10px] text-slate-400">
                        Seu Anúncio
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canBuy}
                        onClick={() => onBuyListing(l)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Comprar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'sell' && (
        <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-4">
          {sellable.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Você não tem equipamentos na mochila para anunciar.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto">
                {sellable.map((it) => (
                  <button
                    key={it.uid}
                    type="button"
                    onClick={() => setSelectedSellUid(it.uid)}
                    className={`text-left rounded-lg border p-2.5 flex items-center gap-2.5 cursor-pointer ${
                      chosenSellItem?.uid === it.uid
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-800 bg-[#0B0F17]'
                    }`}
                  >
                    <ItemPixelIcon
                      iconType={it.iconType}
                      rarity={it.rarity}
                      upgradeLevel={it.upgradeLevel ?? 0}
                      size={34}
                    />
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${RARITY_CONFIG[it.rarity].textClass}`}>
                        {it.name} {(it.upgradeLevel ?? 0) > 0 ? `+${it.upgradeLevel}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400">{RARITY_CONFIG[it.rarity].label}</p>
                    </div>
                  </button>
                ))}
              </div>

              {chosenSellItem && (
                <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-800">
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Preço em Zeni para {chosenSellItem.name}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={999999999}
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs text-white font-mono-num focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const num = Math.max(1, Math.min(999999999, Math.floor(Number(sellPrice) || 0)));
                      onCreateListing(chosenSellItem.uid, num);
                      setTab('mine');
                    }}
                    className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Publicar no Mercado
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
          {myListings.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              Você ainda não possui anúncios no Mercado Global.
            </p>
          ) : (
            myListings.map((l) => (
              <div
                key={l.id}
                className="rounded-xl border border-slate-800 bg-[#131A26] p-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ItemPixelIcon
                    iconType={l.item.iconType}
                    rarity={l.item.rarity}
                    upgradeLevel={l.item.upgradeLevel ?? 0}
                    size={38}
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${RARITY_CONFIG[l.item.rarity].textClass}`}>
                      {l.item.name} {(l.item.upgradeLevel ?? 0) > 0 ? `+${l.item.upgradeLevel}` : ''}
                    </p>
                    <p className="text-[11px] font-mono-num text-amber-300">
                      {formatNumber(l.price)} Zeni ·{' '}
                      <span className={l.status === 'sold' ? 'text-emerald-400' : 'text-sky-400'}>
                        {l.status === 'sold' ? 'VENDIDO!' : 'À Venda'}
                      </span>
                    </p>
                  </div>
                </div>

                {l.status === 'sold' ? (
                  <button
                    type="button"
                    onClick={() => onClaimSoldListing(l)}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shrink-0"
                  >
                    Resgatar {formatNumber(l.price)} Zeni
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCancelListing(l.id)}
                    className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-950/40 text-xs font-medium cursor-pointer shrink-0"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
