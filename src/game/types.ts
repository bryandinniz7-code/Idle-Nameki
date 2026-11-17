export type RaceId = 'namekian' | 'saiyan' | 'earthling' | 'frieza_clan' | 'android';

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythical';

export type EquipSlot =
  | 'sword'
  | 'armor'
  | 'helmet'
  | 'boots'
  | 'gloves'
  | 'accessory'
  | 'necklace'
  | 'earring';

export type ItemCategory = EquipSlot | 'special';

export type TrainingStat = 'strength' | 'ki' | 'defense' | 'speed' | 'stamina';

export type ActivityMode = 'combat' | 'training';

export type GameTab =
  | 'home'
  | 'maps'
  | 'inventory'
  | 'equipment'
  | 'training'
  | 'transformations'
  | 'missions'
  | 'bosses'
  | 'stats'
  | 'ranking'
  | 'social';

export type BackdropKey = 'earth' | 'space' | 'divine';

export interface ItemStatBonuses {
  strength?: number;
  defense?: number;
  speed?: number;
  maxHp?: number;
  maxKi?: number;
  critChance?: number;
  damageMultiplier?: number;
}

export interface InventoryItem {
  uid: string;
  templateId: string;
  name: string;
  category: ItemCategory;
  rarity: Rarity;
  requiredLevel: number;
  stats: ItemStatBonuses;
  sellValue: number;
  quantity: number;
  description: string;
  iconType: string;
  upgradeLevel?: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  archetype: string;
  level: number;
  hp: number;
  damage: number;
  defense: number;
  xpReward: number;
  zeniReward: number;
  kiReward: number;
  dropChance: number;
  possibleDrops: string[];
  colorPrimary: string;
  colorSecondary: string;
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  mapId: string;
  archetype: string;
  requiredLevel: number;
  hp: number;
  damage: number;
  defense: number;
  xpReward: number;
  zeniReward: number;
  kiReward: number;
  respawnSeconds: number;
  exclusiveDrops: string[];
  colorPrimary: string;
  colorSecondary: string;
}

export interface MapDef {
  id: string;
  order: number;
  name: string;
  subtitle: string;
  requiredLevel: number;
  recommendedPower: number;
  difficulty: string;
  backdropKey: BackdropKey;
  themeColor: string;
  ambientClass: string;
  monsters: MonsterDef[];
  bossId: string;
  rareDropIds: string[];
}

export interface TransformationDef {
  id: string;
  name: string;
  order: number;
  requiredLevel: number;
  requiredKi: number;
  damageMultiplier: number;
  powerMultiplier: number;
  speedBonus: number;
  auraColor: string;
  hairColor: string;
  eyeColor: string;
  description: string;
  secretOnly?: boolean;
}

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  kind: 'daily' | 'permanent';
  metric:
    | 'kills_total'
    | 'kills_saibaman'
    | 'level_reached'
    | 'max_ki_reached'
    | 'bosses_defeated'
    | 'rare_items_found'
    | 'training_minutes';
  target: number;
  rewards: {
    xp: number;
    zeni: number;
    title?: string;
    itemTemplateId?: string;
    itemRarity?: Rarity;
  };
}

export interface PetDef {
  id: string;
  name: string;
  title: string;
  description: string;
  unlockCostZeni: number;
  requiredLevel: number;
  colorPrimary: string;
  colorSecondary: string;
  bonuses: {
    xpBonusPct: number;
    zeniBonusPct: number;
    damageBonusPct: number;
    dropBonusPct: number;
  };
}

export interface WorldBossTemplate {
  bossId: string;
  name: string;
  title: string;
  archetype: string;
  mapId: string;
  colorPrimary: string;
  colorSecondary: string;
  maxHp: number;
  rewardZeni: number;
  rewardFragments: number;
}

export interface WorldBossDamager {
  uid: string;
  name: string;
  damage: number;
}

export interface WorldBossState {
  bossId: string;
  name: string;
  archetype: string;
  mapId: string;
  colorPrimary: string;
  colorSecondary: string;
  hp: number;
  maxHp: number;
  status: 'active' | 'defeated';
  spawnedAtMs: number;
  respawnAtMs: number;
  topDamagers: WorldBossDamager[];
}

export interface GuildInfo {
  id: string;
  name: string;
  tag: string;
  leaderUid: string;
  leaderName: string;
  description: string;
  level: number;
  treasuryZeni: number;
  isOpen: boolean;
  memberCount: number;
}

export interface GuildMember {
  uid: string;
  name: string;
  level: number;
  powerLevel: number;
  donatedZeni: number;
}

export interface GuildChatMessage {
  id: string;
  uid: string;
  senderName: string;
  text: string;
  createdAtMs: number;
}

export interface MarketListing {
  id: string;
  sellerUid: string;
  sellerName: string;
  item: InventoryItem;
  price: number;
  status: 'open' | 'sold';
  buyerUid?: string | null;
}

export interface DivineUpgradeDef {
  id: 'xp_boost' | 'dmg_boost' | 'zeni_boost' | 'drop_boost';
  name: string;
  description: string;
  maxLevel: number;
  costPerLevel: number;
  bonusPerLevelPct: number;
}

export interface PlayerStatsCounters {
  monstersDefeated: number;
  bossesDefeated: number;
  totalDamageDealt: number;
  criticalHits: number;
  itemsFound: number;
  rareItemsFound: number;
  trainingSeconds: number;
  offlineSeconds: number;
  killsByMonsterId: Record<string, number>;
}

export interface PlayerSaveState {
  uid: string;
  name: string;
  race: RaceId;
  title: string;
  level: number;
  xp: number;
  zeni: number;
  currentHp: number;
  currentKi: number;
  bonusStrength: number;
  bonusDefense: number;
  bonusSpeed: number;
  bonusKi: number;
  bonusStamina: number;
  currentMapId: string;
  activityMode: ActivityMode;
  trainingStat: TrainingStat;
  transformationId: string;
  unlockedTransformations: string[];
  inventory: InventoryItem[];
  equipped: Record<EquipSlot, InventoryItem | null>;
  missionProgress: Record<string, number>;
  claimedMissions: string[];
  dailyMissionDate: string;
  bossCooldowns: Record<string, number>;
  chestCooldowns?: Record<string, number>;
  stats: PlayerStatsCounters;
  unlockedTitles: string[];
  partyId: string | null;
  redeemedCodes?: string[];
  // 10 New Systems
  dragonBalls?: number[];
  xpBuffUntilMs?: number;
  kiFragments?: number;
  unlockedPets?: string[];
  activePetId?: string | null;
  petXp?: number;
  prestigeLevel?: number;
  divinePoints?: number;
  divineUpgrades?: Record<string, number>;
  tournamentPoints?: number;
  tournamentWins?: number;
  guildId?: string | null;
  guildTag?: string | null;
  fusionUntilMs?: number;
  fusionPartnerName?: string | null;
  fusionBonusPower?: number;
  afkSessionToken: string;
  lastActiveServerMs: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DerivedStats {
  maxHp: number;
  maxEnergy: number;
  maxKi: number;
  strength: number;
  defense: number;
  speed: number;
  critChance: number;
  damageMultiplier: number;
  dps: number;
  powerLevel: number;
  attacksPerSecond: number;
  codePowerMultiplier: number;
  xpMultiplier: number;
  zeniMultiplier: number;
  dropBonusPct: number;
  petLevel: number;
  isFused: boolean;
}

export interface AfkSummary {
  offlineSeconds: number;
  xpGained: number;
  zeniGained: number;
  kiGained: number;
  monstersKilled: number;
  levelsGained: number;
  itemsFound: InventoryItem[];
  rareItemsFound: InventoryItem[];
  mode: ActivityMode;
  trainingStat?: TrainingStat;
  trainingBonusGained?: number;
  mapName: string;
}

export interface PublicProfile {
  uid: string;
  isPublic: boolean;
  name: string;
  race: RaceId;
  title: string;
  level: number;
  powerLevel: number;
  maxKi: number;
  monstersDefeated: number;
  bossesDefeated: number;
  trainingSeconds: number;
  currentMapId: string;
  transformationId: string;
  partyId: string | null;
}

export interface OnlinePlayer {
  uid: string;
  name: string;
  race: RaceId;
  title: string;
  level: number;
  powerLevel: number;
  currentMapId: string;
  transformationId: string;
  partyId: string | null;
  guildTag?: string | null;
  petId?: string | null;
  isFused?: boolean;
  x?: number;
  y?: number;
  facing?: 'down' | 'up' | 'left' | 'right';
  moving?: boolean;
  isFlying?: boolean;
  activityMode?: ActivityMode;
  updatedAtMs?: number;
}

export interface ChatMessage {
  id: string;
  uid: string;
  senderName: string;
  senderTitle: string;
  senderLevel: number;
  channel: 'global';
  text: string;
  createdAtMs: number;
}

export interface PartyInfo {
  id: string;
  name: string;
  leaderUid: string;
  leaderName: string;
  mapId: string;
  isOpen: boolean;
  memberCount: number;
}

export interface PartyMember {
  uid: string;
  name: string;
  level: number;
  powerLevel: number;
  transformationId: string;
}

export interface GameGlobalConfig {
  betaActive: boolean;
  adminNames: string[];
  adminUids: string[];
  creatorNames: string[];
}
