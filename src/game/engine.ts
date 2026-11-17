import {
  BOSSES,
  DIVINE_UPGRADES,
  ITEM_TEMPLATES,
  MAPS,
  PETS,
  RARITY_CONFIG,
  TRAINING_DISCIPLINES,
  TRANSFORMATIONS,
} from './data.ts';
import type {
  AfkSummary,
  DerivedStats,
  EquipSlot,
  GameGlobalConfig,
  InventoryItem,
  ItemStatBonuses,
  MapDef,
  MissionDef,
  PlayerSaveState,
  RaceId,
  Rarity,
} from './types.ts';

export const ROOT_ADMIN_EMAIL = 'bryandinniz7@gmail.com';
export const ROOT_ADMIN_EMAILS = ['bryandinniz7@gmail.com', 'bryan8889hh@gmail.com'];
export const ROOT_ADMIN_UIDS = [
  '6BYsNNHc96Qsh6wRRwlYq11Tnu73',
  'rIda6djPp8TYz1KRmqA7woVAbQu2',
];
export const CHEST_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos
export const SPECIAL_TITLES = {
  ADM: 'ADM',
  TESTER: 'Tester',
  CREATOR: 'Criador de Conteúdo',
} as const;

export const DEFAULT_GAME_CONFIG: GameGlobalConfig = {
  betaActive: true,
  adminNames: ['sparkyy'],
  adminUids: [...ROOT_ADMIN_UIDS],
  creatorNames: [],
};

export function isPlayerAdmin(
  email: string | null | undefined,
  uid: string | null | undefined,
  playerName: string | null | undefined,
  config: GameGlobalConfig = DEFAULT_GAME_CONFIG
): boolean {
  const cleanEmail = (email ?? '').trim().toLowerCase();
  if (cleanEmail && ROOT_ADMIN_EMAILS.includes(cleanEmail)) return true;
  if (uid && (ROOT_ADMIN_UIDS.includes(uid) || config.adminUids.includes(uid))) return true;
  const cleanName = (playerName ?? '').trim().toLowerCase();
  if (cleanName && config.adminNames.some((n) => n.trim().toLowerCase() === cleanName)) {
    return true;
  }
  return false;
}

export function isPlayerCreator(
  playerName: string | null | undefined,
  config: GameGlobalConfig = DEFAULT_GAME_CONFIG
): boolean {
  const cleanName = (playerName ?? '').trim().toLowerCase();
  if (!cleanName) return false;
  return config.creatorNames.some((n) => n.trim().toLowerCase() === cleanName);
}

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 60;
  // Smooth fast start, steep rewarding high-level curve
  return Math.floor(45 * Math.pow(level, 1.82) + 35 * level);
}

export function getMapById(mapId: string): MapDef {
  return MAPS.find((m) => m.id === mapId) ?? MAPS[0];
}

export function getTransformationById(id: string) {
  return TRANSFORMATIONS.find((t) => t.id === id) ?? TRANSFORMATIONS[0];
}

export function getBossForMap(mapId: string) {
  return BOSSES.find((b) => b.mapId === mapId) ?? BOSSES[0];
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs < 1000) return Math.floor(value).toLocaleString('pt-BR');
  if (abs < 1_000_000) return `${(value / 1000).toFixed(2).replace(/\.00$/, '')}K`;
  if (abs < 1_000_000_000) return `${(value / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  if (abs < 1_000_000_000_000) return `${(value / 1_000_000_000).toFixed(2).replace(/\.00$/, '')}B`;
  return `${(value / 1_000_000_000_000).toFixed(2).replace(/\.00$/, '')}T`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function getTodayUtcString(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export const MAX_FORGE_LEVEL = 15;
export const PRESTIGE_MIN_LEVEL = 80;

export function getPetById(petId: string | null | undefined) {
  if (!petId) return null;
  return PETS.find((p) => p.id === petId) ?? null;
}

export function getPetLevel(petXp = 0): number {
  return Math.max(1, Math.min(50, Math.floor(Math.sqrt(Math.max(0, petXp) / 80)) + 1));
}

export function xpRequiredForPetLevel(level: number): number {
  return Math.max(80, level * level * 80);
}

export function getEffectiveItemStats(item: InventoryItem): ItemStatBonuses {
  const lvl = Math.max(0, Math.min(MAX_FORGE_LEVEL, item.upgradeLevel ?? 0));
  if (lvl === 0) return item.stats;
  const mult = 1 + lvl * 0.14;
  return {
    strength: item.stats.strength ? Math.round(item.stats.strength * mult) : undefined,
    defense: item.stats.defense ? Math.round(item.stats.defense * mult) : undefined,
    speed: item.stats.speed ? Math.round(item.stats.speed * mult) : undefined,
    maxHp: item.stats.maxHp ? Math.round(item.stats.maxHp * mult) : undefined,
    maxKi: item.stats.maxKi ? Math.round(item.stats.maxKi * mult) : undefined,
    critChance: item.stats.critChance
      ? Number(Math.min(35, item.stats.critChance + lvl * 0.35).toFixed(1))
      : undefined,
    damageMultiplier: item.stats.damageMultiplier
      ? Number((item.stats.damageMultiplier * (1 + lvl * 0.08)).toFixed(2))
      : undefined,
  };
}

export function getUpgradeCost(item: InventoryItem): { zeni: number; fragments: number; successChance: number } {
  const cur = Math.max(0, Math.min(MAX_FORGE_LEVEL, item.upgradeLevel ?? 0));
  const rarityIdx = Math.max(1, ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical'].indexOf(item.rarity) + 1);
  const zeni = Math.round((220 + item.requiredLevel * 28) * Math.pow(1.28, cur) * (0.7 + rarityIdx * 0.25));
  const fragments = Math.max(2, Math.round((2 + cur * 1.5) * (0.6 + rarityIdx * 0.2)));
  const successChance = Math.max(35, 100 - cur * 4);
  return { zeni, fragments, successChance };
}

export function getSalvageFragments(item: InventoryItem): number {
  const rarityMap: Record<Rarity, number> = {
    Common: 1,
    Uncommon: 2,
    Rare: 5,
    Epic: 12,
    Legendary: 28,
    Mythical: 65,
  };
  const base = rarityMap[item.rarity] ?? 1;
  return base + (item.upgradeLevel ?? 0) * 2;
}

export function getBestiaryTierInfo(kills: number): {
  tier: number;
  label: string;
  nextTarget: number | null;
  damageBonusPct: number;
  xpBonusPct: number;
} {
  if (kills >= 1000) return { tier: 5, label: 'Grão-Mestre', nextTarget: null, damageBonusPct: 25, xpBonusPct: 15 };
  if (kills >= 500) return { tier: 4, label: 'Mestre', nextTarget: 1000, damageBonusPct: 18, xpBonusPct: 11 };
  if (kills >= 250) return { tier: 3, label: 'Veterano', nextTarget: 500, damageBonusPct: 12, xpBonusPct: 7 };
  if (kills >= 100) return { tier: 2, label: 'Caçador', nextTarget: 250, damageBonusPct: 7, xpBonusPct: 4 };
  if (kills >= 25) return { tier: 1, label: 'Iniciado', nextTarget: 100, damageBonusPct: 3, xpBonusPct: 2 };
  return { tier: 0, label: 'Desconhecido', nextTarget: 25, damageBonusPct: 0, xpBonusPct: 0 };
}

export function computeDerivedStats(
  player: PlayerSaveState,
  partyMemberCount = 1,
  guildLevel = 0
): DerivedStats {
  const level = Math.max(1, player.level);
  const transform = getTransformationById(player.transformationId);

  let gearStr = 0;
  let gearDef = 0;
  let gearSpd = 0;
  let gearHp = 0;
  let gearKi = 0;
  let gearCrit = 0;
  let gearDmgMult = 0;

  const slots: EquipSlot[] = [
    'sword',
    'armor',
    'helmet',
    'boots',
    'gloves',
    'accessory',
    'necklace',
    'earring',
  ];

  for (const slot of slots) {
    const item = player.equipped?.[slot];
    if (!item || !item.stats) continue;
    const eff = getEffectiveItemStats(item);
    gearStr += eff.strength ?? 0;
    gearDef += eff.defense ?? 0;
    gearSpd += eff.speed ?? 0;
    gearHp += eff.maxHp ?? 0;
    gearKi += eff.maxKi ?? 0;
    gearCrit += eff.critChance ?? 0;
    gearDmgMult += eff.damageMultiplier ?? 0;
  }

  let raceHpMult = 1;
  let raceKiMult = 1;
  let raceStrMult = 1;
  let raceDefMult = 1;
  let raceSpdMult = 1;
  let raceCritBonus = 0;
  let raceDmgBonus = 0;

  switch (player.race) {
    case 'namekian':
      raceHpMult = 1.12;
      raceKiMult = 1.1;
      break;
    case 'saiyan':
      raceStrMult = 1.12;
      raceDmgBonus = 0.05;
      break;
    case 'earthling':
      raceSpdMult = 1.1;
      raceCritBonus = 6;
      break;
    case 'frieza_clan':
      raceDefMult = 1.14;
      raceKiMult = 1.08;
      break;
    case 'android':
      raceSpdMult = 1.14;
      raceDefMult = 1.08;
      break;
  }

  const baseStrength = 10 + level * 4.5 + Math.pow(level, 1.32);
  const baseDefense = 6 + level * 2.8 + Math.pow(level, 1.2);
  const baseSpeed = 10 + level * 1.4;
  const baseHp = 95 + level * 28 + Math.pow(level, 1.45) * 4;
  const baseKi = 100 + level * 22 + Math.pow(level, 1.48) * 5;

  const strength = Math.floor((baseStrength + player.bonusStrength + gearStr) * raceStrMult);
  const defense = Math.floor((baseDefense + player.bonusDefense + gearDef) * raceDefMult);
  const speed = Math.floor((baseSpeed + player.bonusSpeed + gearSpd + transform.speedBonus) * raceSpdMult);
  const maxHp = Math.floor((baseHp + player.bonusStamina * 5 + gearHp) * raceHpMult);
  const maxKi = Math.floor((baseKi + player.bonusKi * 8 + gearKi) * raceKiMult);
  const maxEnergy = maxKi;

  const hasJeffGameMod =
    (player.redeemedCodes?.includes('JEFFGAMEMOD') ?? false) ||
    (player.unlockedTransformations?.includes('yamcha_ui') ?? false);
  const codePowerMultiplier = hasJeffGameMod ? 30 : 1;
  const hasNmdleXp = player.redeemedCodes?.includes('NMDLE') ?? false;
  const codeXpMult = hasNmdleXp ? 10 : 1;

  // Pet Bonuses
  const activePet = getPetById(player.activePetId);
  const petLevel = getPetLevel(player.petXp ?? 0);
  const petScale = 1 + (petLevel - 1) * 0.04;
  const petDmgBonus = activePet ? (activePet.bonuses.damageBonusPct / 100) * petScale : 0;
  const petXpBonus = activePet ? (activePet.bonuses.xpBonusPct / 100) * petScale : 0;
  const petZeniBonus = activePet ? (activePet.bonuses.zeniBonusPct / 100) * petScale : 0;
  const petDropBonus = activePet ? activePet.bonuses.dropBonusPct * petScale : 0;

  // Prestige Divine Upgrades
  const upgrades = player.divineUpgrades ?? {};
  const divineXpLvl = upgrades['xp_boost'] ?? 0;
  const divineDmgLvl = upgrades['dmg_boost'] ?? 0;
  const divineZeniLvl = upgrades['zeni_boost'] ?? 0;
  const divineDropLvl = upgrades['drop_boost'] ?? 0;

  const xpDef = DIVINE_UPGRADES.find((u) => u.id === 'xp_boost')!;
  const dmgDef = DIVINE_UPGRADES.find((u) => u.id === 'dmg_boost')!;
  const zeniDef = DIVINE_UPGRADES.find((u) => u.id === 'zeni_boost')!;
  const dropDef = DIVINE_UPGRADES.find((u) => u.id === 'drop_boost')!;

  const divineXpMult = 1 + (divineXpLvl * xpDef.bonusPerLevelPct) / 100;
  const divineDmgMult = 1 + (divineDmgLvl * dmgDef.bonusPerLevelPct) / 100;
  const divineZeniMult = 1 + (divineZeniLvl * zeniDef.bonusPerLevelPct) / 100;
  const divineDropBonus = divineDropLvl * dropDef.bonusPerLevelPct;

  // Shenlong 2x XP Buff
  const nowMs = Date.now();
  const hasShenlongXp = (player.xpBuffUntilMs ?? 0) > nowMs;
  const shenlongXpMult = hasShenlongXp ? 2 : 1;

  // Guild Bonus
  const effectiveGuildLevel = player.guildId ? Math.max(1, guildLevel) : 0;
  const guildXpMult = 1 + effectiveGuildLevel * 0.03;
  const guildDmgMult = 1 + effectiveGuildLevel * 0.03;

  // Group Fusion Bonus (Metamoru / Potara)
  const isFused = (player.fusionUntilMs ?? 0) > nowMs;
  const fusionDmgMult = isFused ? 1.45 : 1;
  const fusionBonusPower = isFused ? Math.max(0, player.fusionBonusPower ?? 0) : 0;

  const xpMultiplier = Number(
    (codeXpMult * divineXpMult * shenlongXpMult * guildXpMult * (1 + petXpBonus)).toFixed(2)
  );
  const zeniMultiplier = Number((divineZeniMult * (1 + petZeniBonus)).toFixed(2));
  const dropBonusPct = Number((petDropBonus + divineDropBonus).toFixed(1));

  const critChance = Math.min(75, Number((5 + speed * 0.06 + gearCrit + raceCritBonus).toFixed(1)));
  const partyMult = 1 + Math.max(0, partyMemberCount - 1) * 0.1;
  const damageMultiplier = Number(
    (
      transform.damageMultiplier *
      (1 + gearDmgMult + raceDmgBonus + petDmgBonus) *
      partyMult *
      divineDmgMult *
      guildDmgMult *
      fusionDmgMult *
      codePowerMultiplier
    ).toFixed(2)
  );

  const attacksPerSecond = Number(Math.min(4.5, 0.85 + speed / 140).toFixed(2));
  const avgHit = strength * 1.65 * damageMultiplier * (1 + (critChance / 100) * 0.85);
  const dps = Math.max(1, Math.floor(avgHit * attacksPerSecond));

  const basePower =
    (strength * 14 + defense * 9 + speed * 7 + maxHp * 0.8 + maxKi * 1.1 + player.currentKi * 0.45) *
    transform.powerMultiplier *
    divineDmgMult *
    guildDmgMult *
    codePowerMultiplier;
  const powerLevel = Math.floor(basePower * (isFused ? 1.35 : 1) + fusionBonusPower);

  return {
    maxHp,
    maxEnergy,
    maxKi,
    strength,
    defense,
    speed,
    critChance,
    damageMultiplier,
    dps,
    powerLevel,
    attacksPerSecond,
    codePowerMultiplier,
    xpMultiplier,
    zeniMultiplier,
    dropBonusPct,
    petLevel,
    isFused,
  };
}

export function createItemInstance(
  templateId: string,
  rarity: Rarity,
  targetLevel = 1,
  uidSuffix = ''
): InventoryItem {
  const tpl = ITEM_TEMPLATES.find((t) => t.id === templateId) ?? ITEM_TEMPLATES[0];
  const cfg = RARITY_CONFIG[rarity];
  const levelScale = 1 + Math.max(0, targetLevel - tpl.baseLevel) * 0.045;
  const mult = cfg.multiplier * levelScale;

  const scaledStats: ItemStatBonuses = {};
  if (tpl.baseStats.strength) scaledStats.strength = Math.max(1, Math.round(tpl.baseStats.strength * mult));
  if (tpl.baseStats.defense) scaledStats.defense = Math.max(1, Math.round(tpl.baseStats.defense * mult));
  if (tpl.baseStats.speed) scaledStats.speed = Math.max(1, Math.round(tpl.baseStats.speed * mult));
  if (tpl.baseStats.maxHp) scaledStats.maxHp = Math.max(5, Math.round(tpl.baseStats.maxHp * mult));
  if (tpl.baseStats.maxKi) scaledStats.maxKi = Math.max(5, Math.round(tpl.baseStats.maxKi * mult));
  if (tpl.baseStats.critChance) {
    scaledStats.critChance = Number(Math.min(25, tpl.baseStats.critChance * (0.8 + cfg.multiplier * 0.25)).toFixed(1));
  }
  if (tpl.baseStats.damageMultiplier) {
    scaledStats.damageMultiplier = Number((tpl.baseStats.damageMultiplier * (0.7 + cfg.multiplier * 0.25)).toFixed(2));
  }

  return {
    uid: `itm_${tpl.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}${uidSuffix}`,
    templateId: tpl.id,
    name: tpl.name,
    category: tpl.category,
    rarity,
    requiredLevel: tpl.baseLevel,
    stats: scaledStats,
    sellValue: Math.max(10, Math.round(tpl.baseSellValue * cfg.sellMultiplier * (1 + targetLevel * 0.03))),
    quantity: 1,
    description: tpl.description,
    iconType: tpl.iconType,
  };
}

export function rollRarity(rarityBoost = 0, rng = Math.random): Rarity {
  const roll = rng() * 100 - rarityBoost;
  if (roll < 0.7) return 'Mythical';
  if (roll < 3.2) return 'Legendary';
  if (roll < 10.5) return 'Epic';
  if (roll < 26) return 'Rare';
  if (roll < 56) return 'Uncommon';
  return 'Common';
}

export function isRareOrHigher(rarity: Rarity): boolean {
  return rarity === 'Rare' || rarity === 'Epic' || rarity === 'Legendary' || rarity === 'Mythical';
}

export function addItemToInventory(
  inventory: InventoryItem[],
  newItem: InventoryItem
): InventoryItem[] {
  const next = [...inventory];
  if (newItem.category === 'special') {
    const idx = next.findIndex(
      (i) => i.templateId === newItem.templateId && i.rarity === newItem.rarity
    );
    if (idx >= 0) {
      next[idx] = { ...next[idx], quantity: next[idx].quantity + newItem.quantity };
      return next;
    }
  }
  if (next.length >= 115) {
    // Auto-salvage oldest Common item to avoid hitting Firestore 120-item bound
    const commonIdx = next.findIndex((i) => i.rarity === 'Common' && i.category !== 'special');
    if (commonIdx >= 0) {
      next.splice(commonIdx, 1);
    } else {
      return next;
    }
  }
  next.unshift(newItem);
  return next;
}

export function applyXpAndLevelUps(
  player: PlayerSaveState,
  gainedXp: number
): { nextPlayer: PlayerSaveState; levelsGained: number } {
  let level = player.level;
  let xp = player.xp + gainedXp;
  let levelsGained = 0;

  while (xp >= xpRequiredForLevel(level) && level < 99999) {
    xp -= xpRequiredForLevel(level);
    level += 1;
    levelsGained += 1;
  }

  const nextPlayer: PlayerSaveState = {
    ...player,
    level,
    xp,
  };

  if (levelsGained > 0) {
    const derived = computeDerivedStats(nextPlayer);
    nextPlayer.currentHp = derived.maxHp;
  }

  return { nextPlayer, levelsGained };
}

export function getMissionProgressValue(
  player: PlayerSaveState,
  mission: MissionDef
): number {
  switch (mission.metric) {
    case 'kills_total':
      return player.missionProgress['daily_kills'] ?? player.stats.monstersDefeated;
    case 'kills_saibaman':
      return player.missionProgress['daily_saibaman'] ?? 0;
    case 'level_reached':
      return player.level;
    case 'max_ki_reached':
      return Math.max(player.currentKi, computeDerivedStats(player).maxKi);
    case 'bosses_defeated':
      return player.stats.bossesDefeated;
    case 'rare_items_found':
      return player.stats.rareItemsFound;
    case 'training_minutes':
      return Math.floor((player.missionProgress['daily_training_sec'] ?? 0) / 60);
    default:
      return 0;
  }
}

export function createInitialPlayerSave(
  uid: string,
  name: string,
  race: RaceId,
  serverTimeMs: number,
  afkSessionToken = ''
): PlayerSaveState {
  const starterSword = createItemInstance('bastao_magico', 'Common', 1, '_init');
  const starterGi = createItemInstance('dogi_tartaruga', 'Common', 1, '_init2');

  const base: PlayerSaveState = {
    uid,
    name: name.trim().slice(0, 24),
    race,
    title: 'Aprendiz de Artes Marciais',
    level: 1,
    xp: 0,
    zeni: 150,
    currentHp: 130,
    currentKi: 120,
    bonusStrength: 0,
    bonusDefense: 0,
    bonusSpeed: 0,
    bonusKi: 0,
    bonusStamina: 0,
    currentMapId: 'terra',
    activityMode: 'combat',
    trainingStat: 'strength',
    transformationId: 'base',
    unlockedTransformations: ['base'],
    inventory: [createItemInstance('semente_deuses', 'Uncommon', 1, '_init3')],
    equipped: {
      sword: starterSword,
      armor: starterGi,
      helmet: null,
      boots: null,
      gloves: null,
      accessory: null,
      necklace: null,
      earring: null,
    },
    missionProgress: {
      daily_kills: 0,
      daily_saibaman: 0,
      daily_training_sec: 0,
    },
    claimedMissions: [],
    dailyMissionDate: getTodayUtcString(serverTimeMs),
    bossCooldowns: {},
    chestCooldowns: {},
    stats: {
      monstersDefeated: 0,
      bossesDefeated: 0,
      totalDamageDealt: 0,
      criticalHits: 0,
      itemsFound: 0,
      rareItemsFound: 0,
      trainingSeconds: 0,
      offlineSeconds: 0,
      killsByMonsterId: {},
    },
    unlockedTitles: ['Aprendiz de Artes Marciais'],
    partyId: null,
    redeemedCodes: [],
    dragonBalls: [],
    xpBuffUntilMs: 0,
    kiFragments: 0,
    unlockedPets: [],
    activePetId: null,
    petXp: 0,
    prestigeLevel: 0,
    divinePoints: 0,
    divineUpgrades: {},
    tournamentPoints: 0,
    tournamentWins: 0,
    guildId: null,
    guildTag: null,
    fusionUntilMs: 0,
    fusionPartnerName: null,
    fusionBonusPower: 0,
    afkSessionToken,
    lastActiveServerMs: serverTimeMs,
  };

  const derived = computeDerivedStats(base);
  base.currentHp = derived.maxHp;
  base.currentKi = Math.max(base.currentKi, 120);
  return base;
}

export function simulateOfflineProgress(
  player: PlayerSaveState,
  rawOfflineSeconds: number,
  serverNowMs: number
): { updatedPlayer: PlayerSaveState; summary: AfkSummary } {
  // Cap single AFK session at 7 days (604,800s) for healthy progression balance
  const offlineSeconds = Math.max(0, Math.min(604800, Math.floor(rawOfflineSeconds)));
  const map = getMapById(player.currentMapId);

  let working: PlayerSaveState = {
    ...player,
    level: Number.isFinite(player.level) ? Math.max(1, Math.min(99999, Math.floor(player.level))) : 1,
    xp: Number.isFinite(player.xp) ? Math.max(0, Math.floor(player.xp)) : 0,
    zeni: Number.isFinite(player.zeni) ? Math.max(0, Math.floor(player.zeni)) : 0,
    currentHp: Number.isFinite(player.currentHp) ? Math.max(0, Math.floor(player.currentHp)) : 100,
    currentKi: Number.isFinite(player.currentKi) ? Math.max(0, Math.floor(player.currentKi)) : 0,
    bonusStrength: Number.isFinite(player.bonusStrength) ? Math.max(0, Math.floor(player.bonusStrength)) : 0,
    bonusDefense: Number.isFinite(player.bonusDefense) ? Math.max(0, Math.floor(player.bonusDefense)) : 0,
    bonusSpeed: Number.isFinite(player.bonusSpeed) ? Math.max(0, Math.floor(player.bonusSpeed)) : 0,
    bonusKi: Number.isFinite(player.bonusKi) ? Math.max(0, Math.floor(player.bonusKi)) : 0,
    bonusStamina: Number.isFinite(player.bonusStamina) ? Math.max(0, Math.floor(player.bonusStamina)) : 0,
    inventory: [...(player.inventory ?? [])],
    claimedMissions: [...(player.claimedMissions ?? [])],
    missionProgress: { ...(player.missionProgress ?? {}) },
    stats: {
      monstersDefeated: player.stats?.monstersDefeated ?? 0,
      bossesDefeated: player.stats?.bossesDefeated ?? 0,
      totalDamageDealt: player.stats?.totalDamageDealt ?? 0,
      criticalHits: player.stats?.criticalHits ?? 0,
      itemsFound: player.stats?.itemsFound ?? 0,
      rareItemsFound: player.stats?.rareItemsFound ?? 0,
      trainingSeconds: player.stats?.trainingSeconds ?? 0,
      offlineSeconds: player.stats?.offlineSeconds ?? 0,
      killsByMonsterId: { ...(player.stats?.killsByMonsterId ?? {}) },
    },
  };

  const today = getTodayUtcString(serverNowMs);
  if (working.dailyMissionDate !== today) {
    working.dailyMissionDate = today;
    working.missionProgress.daily_kills = 0;
    working.missionProgress.daily_saibaman = 0;
    working.missionProgress.daily_training_sec = 0;
    working.claimedMissions = working.claimedMissions.filter((id) => !id.startsWith('daily_'));
  }

  const derived = computeDerivedStats(working);
  let xpGained = 0;
  let zeniGained = 0;
  let kiGained = 0;
  let monstersKilled = 0;
  let trainingBonusGained = 0;
  const itemsFound: InventoryItem[] = [];
  const rareItemsFound: InventoryItem[] = [];

  if (working.activityMode === 'training') {
    const disc =
      TRAINING_DISCIPLINES.find((d) => d.id === working.trainingStat) ?? TRAINING_DISCIPLINES[0];
    const minutes = offlineSeconds / 60;
    const scale = 1 + working.level * 0.08;
    trainingBonusGained = Math.max(1, Math.floor(disc.gainPerMinute * minutes * scale));
    kiGained = Math.max(1, Math.floor(disc.kiGainPerMinute * minutes * scale));
    xpGained = Math.max(1, Math.floor(offlineSeconds * (4 + working.level * 2.2) * derived.xpMultiplier));
    zeniGained = Math.floor(offlineSeconds * (1.2 + working.level * 0.5));

    if (working.trainingStat === 'strength') working.bonusStrength += trainingBonusGained;
    if (working.trainingStat === 'defense') working.bonusDefense += trainingBonusGained;
    if (working.trainingStat === 'speed') working.bonusSpeed += trainingBonusGained;
    if (working.trainingStat === 'ki') working.bonusKi += trainingBonusGained;
    if (working.trainingStat === 'stamina') working.bonusStamina += trainingBonusGained;

    working.currentKi += kiGained;
    working.stats.trainingSeconds += offlineSeconds;
    working.missionProgress.daily_training_sec =
      (working.missionProgress.daily_training_sec ?? 0) + offlineSeconds;
  } else {
    // Combat AFK simulation using authoritative player DPS vs map monsters
    const avgMonster =
      map.monsters.reduce((acc, m) => acc + m.hp, 0) / Math.max(1, map.monsters.length);
    const effectiveDps = Math.max(5, derived.dps);
    // Include 1.1s travel/spawn cadence between monsters
    const secondsPerKill = Math.max(1.2, avgMonster / effectiveDps + 1.1);
    monstersKilled = Math.min(250000, Math.floor(offlineSeconds / secondsPerKill));

    const avgXp = map.monsters.reduce((acc, m) => acc + m.xpReward, 0) / map.monsters.length;
    const avgZeni = map.monsters.reduce((acc, m) => acc + m.zeniReward, 0) / map.monsters.length;
    const avgKi = map.monsters.reduce((acc, m) => acc + m.kiReward, 0) / map.monsters.length;
    const avgDropChance = map.monsters.reduce((acc, m) => acc + m.dropChance, 0) / map.monsters.length;

    xpGained = Math.floor(monstersKilled * avgXp * derived.xpMultiplier);
    zeniGained = Math.floor(monstersKilled * avgZeni);
    kiGained = Math.floor(monstersKilled * avgKi);

    working.currentKi += kiGained;
    working.zeni += zeniGained;
    working.stats.monstersDefeated += monstersKilled;
    working.missionProgress.daily_kills =
      (working.missionProgress.daily_kills ?? 0) + monstersKilled;

    // Distribute kills across monsters in map
    const perMonster = Math.floor(monstersKilled / map.monsters.length);
    for (const m of map.monsters) {
      working.stats.killsByMonsterId[m.id] =
        (working.stats.killsByMonsterId[m.id] ?? 0) + perMonster;
      if (m.archetype === 'saibaman') {
        working.missionProgress.daily_saibaman =
          (working.missionProgress.daily_saibaman ?? 0) + perMonster;
      }
    }

    // Roll offline drops (capped to keep summary crisp and inventory manageable, auto-selling excess Common/Uncommon)
    const expectedDrops = Math.min(35, Math.floor(monstersKilled * avgDropChance * 0.35));
    for (let i = 0; i < expectedDrops; i++) {
      const m = map.monsters[i % map.monsters.length];
      const tplId = m.possibleDrops[i % m.possibleDrops.length];
      const rarity = rollRarity(Math.min(18, map.order * 1.3));
      const item = createItemInstance(tplId, rarity, m.level, `_afk${i}`);
      itemsFound.push(item);
      if (isRareOrHigher(rarity)) {
        rareItemsFound.push(item);
        working.stats.rareItemsFound += 1;
      }
      working.stats.itemsFound += 1;
      working.inventory = addItemToInventory(working.inventory, item);
    }
  }

  working.zeni += working.activityMode === 'training' ? zeniGained : 0;
  working.stats.offlineSeconds += offlineSeconds;
  working.lastActiveServerMs = serverNowMs;

  const { nextPlayer, levelsGained } = applyXpAndLevelUps(working, xpGained);

  return {
    updatedPlayer: nextPlayer,
    summary: {
      offlineSeconds,
      xpGained,
      zeniGained,
      kiGained,
      monstersKilled,
      levelsGained,
      itemsFound,
      rareItemsFound,
      mode: working.activityMode,
      trainingStat: working.activityMode === 'training' ? working.trainingStat : undefined,
      trainingBonusGained: working.activityMode === 'training' ? trainingBonusGained : undefined,
      mapName: map.name,
    },
  };
}
