import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Coins, Hammer, Package, Shield, Sparkles, Trash2 } from 'lucide-react';
import { CATEGORY_LABELS, RARITY_CONFIG, SLOT_LABELS } from '../../game/data.ts';
import { formatNumber, getEffectiveItemStats } from '../../game/engine.ts';
import type {
  EquipSlot,
  InventoryItem,
  ItemCategory,
  ItemStatBonuses,
  PlayerSaveState,
  Rarity,
} from '../../game/types.ts';
import { ItemPixelIcon } from '../PixelSprites.tsx';

interface EquipmentPanelProps {
  player: PlayerSaveState;
  onUnequip: (slot: EquipSlot) => void;
  onOpenForge?: () => void;
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

function renderStatLines(stats: ItemStatBonuses): string[] {
  const lines: string[] = [];
  if (stats.strength) lines.push(`+${formatNumber(stats.strength)} Força`);
  if (stats.defense) lines.push(`+${formatNumber(stats.defense)} Defesa`);
  if (stats.speed) lines.push(`+${formatNumber(stats.speed)} Velocidade`);
  if (stats.maxHp) lines.push(`+${formatNumber(stats.maxHp)} HP`);
  if (stats.maxKi) lines.push(`+${formatNumber(stats.maxKi)} Ki`);
  if (stats.critChance) lines.push(`+${stats.critChance}% Crítico`);
  if (stats.damageMultiplier) lines.push(`+${Math.round(stats.damageMultiplier * 100)}% Dano`);
  return lines;
}

export const EquipmentPanel: React.FC<EquipmentPanelProps> = ({
  player,
  onUnequip,
  onOpenForge,
}) => {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white">Equipamentos Ativos</h2>
          <p className="text-xs text-slate-400 mt-1">
            Os 8 espaços de equipamento aumentam seus atributos de combate e Poder de Luta.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono-num text-sky-400">
            {EQUIP_SLOTS.filter((s) => Boolean(player.equipped[s])).length} / 8 Equipados
          </span>
          {onOpenForge && (
            <button
              type="button"
              onClick={onOpenForge}
              className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>Forjar (+15)</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {EQUIP_SLOTS.map((slot) => {
          const item = player.equipped[slot];
          const cfg = item ? RARITY_CONFIG[item.rarity] : null;
          const upg = item?.upgradeLevel ?? 0;
          const effStats = item ? getEffectiveItemStats(item) : null;
          return (
            <div
              key={slot}
              className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {item ? (
                  <ItemPixelIcon
                    iconType={item.iconType}
                    rarity={item.rarity}
                    upgradeLevel={upg}
                    size={44}
                  />
                ) : (
                  <div className="w-11 h-11 rounded-md border border-dashed border-slate-700 bg-[#0B0F17] flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-slate-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400">{SLOT_LABELS[slot]}</p>
                  {item && cfg && effStats ? (
                    <>
                      <p className={`text-sm font-bold truncate ${cfg.textClass}`}>
                        {item.name} {upg > 0 ? `+${upg}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-300 mt-0.5 truncate">
                        {cfg.label} · {renderStatLines(effStats).join(' · ') || 'Sem bônus'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 mt-0.5">Espaço vazio</p>
                  )}
                </div>
              </div>

              {item && (
                <button
                  type="button"
                  onClick={() => onUnequip(slot)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 bg-[#0B0F17] text-xs font-medium text-slate-200 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Desequipar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface InventoryPanelProps {
  player: PlayerSaveState;
  onEquip: (itemUid: string) => void;
  onUseSpecial: (itemUid: string) => void;
  onSellItem: (itemUid: string) => void;
  onBulkSellCommonUncommon: () => void;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
  player,
  onEquip,
  onUseSpecial,
  onSellItem,
  onBulkSellCommonUncommon,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | ItemCategory>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | Rarity>('all');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return player.inventory.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (rarityFilter !== 'all' && item.rarity !== rarityFilter) return false;
      return true;
    });
  }, [player.inventory, categoryFilter, rarityFilter]);

  const selectedItem =
    filteredItems.find((i) => i.uid === selectedUid) ??
    player.inventory.find((i) => i.uid === selectedUid) ??
    filteredItems[0] ??
    null;

  const equippedComparison =
    selectedItem && selectedItem.category !== 'special'
      ? player.equipped[selectedItem.category as EquipSlot]
      : null;

  const bulkSellCount = player.inventory.filter(
    (i) => (i.rarity === 'Common' || i.rarity === 'Uncommon') && i.category !== 'special'
  ).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white">Inventário</h2>
          <p className="text-xs text-slate-400 mt-1">
            {player.inventory.length}/120 itens · Zeni: <strong className="text-amber-300 font-mono-num">{formatNumber(player.zeni)}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={onBulkSellCommonUncommon}
          disabled={bulkSellCount === 0}
          className="px-3.5 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Vender Comuns/Incomuns ({bulkSellCount})</span>
        </button>
      </div>

      {/* Category & Rarity Filters */}
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filtrar por categoria"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | ItemCategory)}
          className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
        >
          <option value="all">Todas Categorias</option>
          {(Object.keys(CATEGORY_LABELS) as ItemCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por raridade"
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value as 'all' | Rarity)}
          className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
        >
          <option value="all">Todas Raridades</option>
          {(Object.keys(RARITY_CONFIG) as Rarity[]).map((r) => (
            <option key={r} value={r}>
              {RARITY_CONFIG[r].label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Item Grid */}
        <div className="rounded-xl border border-slate-800 bg-[#131A26] p-3">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              Nenhum item encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const cfg = RARITY_CONFIG[item.rarity];
                const isSelected = selectedItem?.uid === item.uid;
                const canEquipLevel = player.level >= item.requiredLevel;
                const upg = item.upgradeLevel ?? 0;
                return (
                  <button
                    key={item.uid}
                    type="button"
                    onClick={() => setSelectedUid(item.uid)}
                    className={`text-left rounded-lg border p-3 flex items-center gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-800 bg-[#0B0F17] hover:border-slate-700'
                    }`}
                  >
                    <ItemPixelIcon
                      iconType={item.iconType}
                      rarity={item.rarity}
                      upgradeLevel={upg}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-bold truncate ${cfg.textClass}`}>
                          {item.name} {upg > 0 ? `+${upg}` : ''}
                        </p>
                        {item.quantity > 1 && (
                          <span className="text-[11px] font-mono-num text-slate-300 shrink-0">
                            x{item.quantity}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {cfg.label} · {CATEGORY_LABELS[item.category]}
                      </p>
                      <p
                        className={`text-[10px] font-mono-num mt-0.5 ${
                          canEquipLevel ? 'text-slate-400' : 'text-red-400'
                        }`}
                      >
                        Req. Nv.{item.requiredLevel} · Venda {formatNumber(item.sellValue)} Zeni
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Inspector & Comparison Panel */}
        <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-col justify-between gap-4">
          {selectedItem ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ItemPixelIcon
                    iconType={selectedItem.iconType}
                    rarity={selectedItem.rarity}
                    upgradeLevel={selectedItem.upgradeLevel ?? 0}
                    size={48}
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-bold ${RARITY_CONFIG[selectedItem.rarity].textClass}`}
                    >
                      {selectedItem.name}{' '}
                      {(selectedItem.upgradeLevel ?? 0) > 0 ? `+${selectedItem.upgradeLevel}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">
                      {RARITY_CONFIG[selectedItem.rarity].label} ·{' '}
                      {CATEGORY_LABELS[selectedItem.category]}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{selectedItem.description}</p>

                {selectedItem.category !== 'special' && (
                  <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-300">Atributos do Item</p>
                    {renderStatLines(getEffectiveItemStats(selectedItem)).map((line) => (
                      <p key={line} className="text-xs font-mono-num text-emerald-300">
                        {line}
                      </p>
                    ))}
                  </div>
                )}

                {selectedItem.category !== 'special' && (
                  <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-sky-400 flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Comparação com Equipado</span>
                    </p>
                    {equippedComparison ? (
                      <div className="space-y-1 text-xs font-mono-num">
                        <p className="text-slate-400 text-[11px]">
                          Atual: {equippedComparison.name}{' '}
                          {(equippedComparison.upgradeLevel ?? 0) > 0
                            ? `+${equippedComparison.upgradeLevel}`
                            : ''}
                        </p>
                        {(
                          [
                            ['strength', 'Força'],
                            ['defense', 'Defesa'],
                            ['speed', 'Vel'],
                            ['maxHp', 'HP'],
                            ['maxKi', 'Ki'],
                          ] as const
                        ).map(([key, label]) => {
                          const nextVal = getEffectiveItemStats(selectedItem)[key] ?? 0;
                          const curVal = getEffectiveItemStats(equippedComparison)[key] ?? 0;
                          const diff = nextVal - curVal;
                          if (diff === 0 && nextVal === 0) return null;
                          return (
                            <p
                              key={key}
                              className={
                                diff > 0
                                  ? 'text-emerald-400'
                                  : diff < 0
                                  ? 'text-red-400'
                                  : 'text-slate-400'
                              }
                            >
                              {label}: {diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff)}
                            </p>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-300">
                        Espaço vazio — melhoria direta ao equipar!
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                {selectedItem.category === 'special' ? (
                  <button
                    type="button"
                    onClick={() => onUseSpecial(selectedItem.uid)}
                    className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Usar Item Especial</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={player.level < selectedItem.requiredLevel}
                    onClick={() => onEquip(selectedItem.uid)}
                    className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    {player.level < selectedItem.requiredLevel
                      ? `Requer Nível ${selectedItem.requiredLevel}`
                      : 'Equipar Item'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onSellItem(selectedItem.uid)}
                  className="w-full py-2 px-4 rounded-lg border border-slate-700 hover:border-red-500/50 bg-[#0B0F17] text-slate-300 hover:text-red-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vender por {formatNumber(selectedItem.sellValue)} Zeni</span>
                </button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Selecione um item para inspecionar, comparar, equipar ou vender.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
