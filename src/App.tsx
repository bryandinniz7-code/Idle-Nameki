import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Award,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Compass,
  Crosshair,
  Crown,
  Dumbbell,
  Flame,
  Gift,
  Hammer,
  Heart,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Radio,
  Save,
  Settings,
  Shield,
  Skull,
  SlidersHorizontal,
  Sparkles,
  Store,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { AuthAndCreation } from './components/AuthAndCreation.tsx';
import { AutoSkillsModal, MAX_AUTO_SKILLS } from './components/AutoSkillsModal.tsx';
import { MonsterPixelSprite, WarriorPixelSprite } from './components/PixelSprites.tsx';
import { SettingsModal, type GameUiSettings } from './components/SettingsModal.tsx';
import {
  TibiaWorldCanvas,
  WorldMinimapCanvas,
  type WorldEmoteBubble,
  type WorldFloatingText,
  type WorldLootSparkle,
  type WorldMonsterEntity,
  type WorldProjectileVfx,
} from './components/TibiaWorldCanvas.tsx';
import { VirtualJoystick } from './components/VirtualJoystick.tsx';
import { WelcomeBackModal } from './components/WelcomeBackModal.tsx';
import { ForgePanel, MarketPanel } from './components/panels/ForgeAndMarketPanels.tsx';
import {
  EquipmentPanel,
  InventoryPanel,
} from './components/panels/InventoryAndEquipmentPanels.tsx';
import { MapsPanel } from './components/panels/MapsPanel.tsx';
import {
  RankingPanel,
  SocialPanel,
  StatsPanel,
} from './components/panels/MultiplayerAndRankingPanels.tsx';
import {
  BossesPanel,
  MissionsPanel,
  TrainingPanel,
  TransformationsPanel,
} from './components/panels/ProgressionPanels.tsx';
import { SkillsPanel } from './components/panels/SkillsPanel.tsx';
import {
  BestiaryPanel,
  DragonBallsPanel,
  PetsPanel,
  PrestigePanel,
  TournamentPanel,
  WorldBossPanel,
} from './components/panels/SystemsPanels.tsx';
import {
  DIVINE_UPGRADES,
  ITEM_TEMPLATES,
  MISSIONS,
  PETS,
  RARITY_CONFIG,
  SHENLONG_WISHES,
  TOURNAMENT_SHOP_ITEMS,
  TRAINING_DISCIPLINES,
  TRANSFORMATIONS,
  WORLD_BOSS_TEMPLATES,
} from './game/data.ts';
import {
  CHEST_COOLDOWN_MS,
  DEFAULT_GAME_CONFIG,
  MAX_FORGE_LEVEL,
  PRESTIGE_MIN_LEVEL,
  ROOT_ADMIN_EMAIL,
  ROOT_ADMIN_EMAILS,
  ROOT_ADMIN_UIDS,
  SPECIAL_TITLES,
  addItemToInventory,
  applyXpAndLevelUps,
  computeDerivedStats,
  createInitialPlayerSave,
  createItemInstance,
  formatNumber,
  getBestiaryTierInfo,
  getBossForMap,
  getMapById,
  getMissionProgressValue,
  getPetById,
  getSalvageFragments,
  getTodayUtcString,
  getTransformationById,
  getUpgradeCost,
  isPlayerAdmin,
  isPlayerCreator,
  isRareOrHigher,
  rollRarity,
  xpRequiredForLevel,
} from './game/engine.ts';
import { COMBAT_SKILLS, type CombatSkillDef } from './game/skills.ts';
import type {
  AfkSummary,
  BossDef,
  ChatMessage,
  EquipSlot,
  GameGlobalConfig,
  GuildChatMessage,
  GuildInfo,
  GuildMember,
  InventoryItem,
  MarketListing,
  MonsterDef,
  OnlinePlayer,
  PartyInfo,
  PartyMember,
  PlayerSaveState,
  PublicProfile,
  RaceId,
  Rarity,
  TrainingStat,
  WorldBossState,
} from './game/types.ts';
import { getWorldMapGrid, isTileWalkable, type WorldNpcPlacement } from './game/worldMap.ts';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase.ts';
import { soundFx } from './lib/sound.ts';

type DrawerTab =
  | null
  | 'maps'
  | 'equipment'
  | 'inventory'
  | 'skills'
  | 'training'
  | 'transformations'
  | 'bosses'
  | 'missions'
  | 'ranking'
  | 'social'
  | 'stats'
  | 'chat'
  | 'forge'
  | 'market'
  | 'dragon_balls'
  | 'pets'
  | 'bestiary'
  | 'tournament'
  | 'prestige'
  | 'world_boss';

class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-red-500/40 bg-[#131A26] p-6 space-y-4">
            <h1 className="font-pixel text-lg text-red-400">Erro Inesperado</h1>
            <p className="text-xs text-slate-300 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-orange-500 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              Recarregar Jogo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface BattleLogEntry {
  id: number;
  text: string;
  tone: 'normal' | 'crit' | 'drop' | 'level' | 'boss';
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function safeInt(val: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(val)));
}

const ALLOWED_RACES = new Set(['namekian', 'saiyan', 'earthling', 'frieza_clan', 'android']);
const ALLOWED_TRAINING_STATS = new Set(['strength', 'ki', 'defense', 'speed', 'stamina']);

function asPlainMap<T extends Record<string, unknown>>(val: unknown, fallback: T): T {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as T) : fallback;
}

function sanitizeNumberMap(val: unknown): Record<string, number> {
  const plain = asPlainMap(val, {});
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(plain)) {
    if (typeof k === 'string' && k.length > 0 && typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return out;
}

function sanitizeEquippedMap(val: unknown): PlayerSaveState['equipped'] {
  const plain = asPlainMap(val, {}) as Partial<PlayerSaveState['equipped']>;
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
  const out = {} as PlayerSaveState['equipped'];
  for (const slot of slots) {
    const item = plain[slot];
    out[slot] = item && typeof item === 'object' && !Array.isArray(item) ? item : null;
  }
  return out;
}

function buildSanitizedPlayerPayload(player: PlayerSaveState) {
  const rawName = typeof player.name === 'string' ? player.name : '';
  const safeName = rawName.length >= 2 && rawName.length <= 24 ? rawName : rawName.trim().slice(0, 24);
  const safeTransforms = Array.isArray(player.unlockedTransformations)
    ? player.unlockedTransformations.filter((t): t is string => typeof t === 'string' && t.length > 0).slice(0, 20)
    : [];
  const safeTitles = Array.isArray(player.unlockedTitles)
    ? player.unlockedTitles.filter((t): t is string => typeof t === 'string' && t.length > 0).slice(0, 60)
    : [];
  const rawStats = asPlainMap(player.stats, {}) as Partial<PlayerSaveState['stats']>;

  return {
    uid: player.uid,
    name: safeName.length >= 2 ? safeName : 'Guerreiro',
    race: (ALLOWED_RACES.has(player.race) ? player.race : 'namekian') as RaceId,
    title: (typeof player.title === 'string' ? player.title : 'Aprendiz de Artes Marciais').slice(0, 64),
    level: safeInt(player.level, 1, 1, 99999),
    xp: safeInt(player.xp, 0),
    zeni: safeInt(player.zeni, 0),
    currentHp: safeInt(player.currentHp, 100),
    currentKi: safeInt(player.currentKi, 0),
    bonusStrength: safeInt(player.bonusStrength, 0),
    bonusDefense: safeInt(player.bonusDefense, 0),
    bonusSpeed: safeInt(player.bonusSpeed, 0),
    bonusKi: safeInt(player.bonusKi, 0),
    bonusStamina: safeInt(player.bonusStamina, 0),
    currentMapId: (typeof player.currentMapId === 'string' && player.currentMapId ? player.currentMapId : 'terra').slice(0, 64),
    activityMode: (player.activityMode === 'training' ? 'training' : 'combat') as PlayerSaveState['activityMode'],
    trainingStat: (ALLOWED_TRAINING_STATS.has(player.trainingStat) ? player.trainingStat : 'strength') as TrainingStat,
    transformationId: (typeof player.transformationId === 'string' && player.transformationId ? player.transformationId : 'base').slice(0, 64),
    unlockedTransformations: safeTransforms.length > 0 ? safeTransforms : ['base'],
    inventory: Array.isArray(player.inventory)
      ? player.inventory.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).slice(0, 120)
      : [],
    equipped: sanitizeEquippedMap(player.equipped),
    missionProgress: sanitizeNumberMap(player.missionProgress),
    claimedMissions: Array.isArray(player.claimedMissions)
      ? player.claimedMissions.filter((m): m is string => typeof m === 'string').slice(0, 150)
      : [],
    dailyMissionDate: (typeof player.dailyMissionDate === 'string' ? player.dailyMissionDate : getTodayUtcString()).slice(0, 16),
    bossCooldowns: sanitizeNumberMap(player.bossCooldowns),
    chestCooldowns: sanitizeNumberMap(player.chestCooldowns),
    stats: {
      monstersDefeated: safeInt(rawStats.monstersDefeated, 0),
      bossesDefeated: safeInt(rawStats.bossesDefeated, 0),
      totalDamageDealt: safeInt(rawStats.totalDamageDealt, 0),
      criticalHits: safeInt(rawStats.criticalHits, 0),
      itemsFound: safeInt(rawStats.itemsFound, 0),
      rareItemsFound: safeInt(rawStats.rareItemsFound, 0),
      trainingSeconds: safeInt(rawStats.trainingSeconds, 0),
      offlineSeconds: safeInt(rawStats.offlineSeconds, 0),
      killsByMonsterId: sanitizeNumberMap(rawStats.killsByMonsterId),
    },
    unlockedTitles: safeTitles.length > 0 ? safeTitles : ['Aprendiz de Artes Marciais'],
    redeemedCodes: (player.redeemedCodes ?? []).filter((c): c is string => typeof c === 'string').slice(0, 20),
    partyId: player.partyId && VALID_ID_RE.test(player.partyId) ? player.partyId : null,
    dragonBalls: (player.dragonBalls ?? []).filter((n): n is number => typeof n === 'number' && Number.isFinite(n)).slice(0, 7),
    xpBuffUntilMs: safeInt(player.xpBuffUntilMs, 0),
    kiFragments: safeInt(player.kiFragments, 0),
    unlockedPets: (player.unlockedPets ?? []).filter((p): p is string => typeof p === 'string').slice(0, 20),
    activePetId: player.activePetId ? String(player.activePetId).slice(0, 64) : null,
    petXp: safeInt(player.petXp, 0),
    prestigeLevel: safeInt(player.prestigeLevel, 0),
    divinePoints: safeInt(player.divinePoints, 0),
    divineUpgrades: sanitizeNumberMap(player.divineUpgrades),
    tournamentPoints: safeInt(player.tournamentPoints, 0),
    tournamentWins: safeInt(player.tournamentWins, 0),
    guildId: player.guildId && VALID_ID_RE.test(player.guildId) ? player.guildId : null,
    guildTag: player.guildTag ? String(player.guildTag).slice(0, 8) : null,
    fusionUntilMs: safeInt(player.fusionUntilMs, 0),
    fusionPartnerName: player.fusionPartnerName ? String(player.fusionPartnerName).slice(0, 24) : null,
    fusionBonusPower: safeInt(player.fusionBonusPower, 0),
    afkSessionToken: (typeof player.afkSessionToken === 'string' ? player.afkSessionToken : '').slice(0, 2048),
    lastActiveServerMs: safeInt(player.lastActiveServerMs, Date.now()),
  };
}

function spawnMapMonsters(mapId: string): WorldMonsterEntity[] {
  const map = getMapById(mapId);
  const grid = getWorldMapGrid(mapId);
  const entities: WorldMonsterEntity[] = [];

  grid.monsterZones.forEach((zone, idx) => {
    const def = map.monsters[idx % map.monsters.length];
    let sx = zone.x;
    let sy = zone.y;
    if (!isTileWalkable(grid, sx, sy)) {
      sx = grid.spawnTile.x + ((idx % 3) - 1) * 2;
      sy = grid.spawnTile.y + ((idx % 2) === 0 ? 3 : -3);
    }
    entities.push({
      instanceId: `mob_${mapId}_${idx}`,
      def,
      isBoss: false,
      x: sx + 0.5,
      y: sy + 0.5,
      spawnX: sx + 0.5,
      spawnY: sy + 0.5,
      hp: def.hp,
      maxHp: def.hp,
      hitFlashUntil: 0,
      respawnAt: 0,
      patrolPhase: idx * 1.1,
    });
  });

  return entities;
}

function IdleNamekiGame() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [player, setPlayer] = useState<PlayerSaveState | null>(null);
  const [loadingSave, setLoadingSave] = useState(false);
  const [needsCreation, setNeedsCreation] = useState(false);
  const [loadRetryKey, setLoadRetryKey] = useState(0);
  const [welcomeSummary, setWelcomeSummary] = useState<AfkSummary | null>(null);

  // Floating HUD & Drawers
  const [activeDrawer, setActiveDrawer] = useState<DrawerTab>(null);
  const [topBarExpanded, setTopBarExpanded] = useState(true);
  const [skillsBarExpanded, setSkillsBarExpanded] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uiSettings, setUiSettings] = useState<GameUiSettings>(() => {
    try {
      const saved = localStorage.getItem('idle_nameki_ui_settings');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<GameUiSettings>;
        return {
          showMultiplayerRadar: parsed.showMultiplayerRadar ?? true,
          showFloatingDamage: parsed.showFloatingDamage ?? true,
          showRemoteVfx: parsed.showRemoteVfx ?? true,
        };
      }
    } catch {
      // Ignore storage errors
    }
    return {
      showMultiplayerRadar: true,
      showFloatingDamage: true,
      showRemoteVfx: true,
    };
  });
  const uiSettingsRef = useRef<GameUiSettings>(uiSettings);
  uiSettingsRef.current = uiSettings;
  const [radarExpanded, setRadarExpanded] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [inspectedPlayer, setInspectedPlayer] = useState<OnlinePlayer | null>(null);
  const [highlightedPlayerUid, setHighlightedPlayerUid] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // BOT / Auto-Hunt & Nuvem Voadora (Flight unlocked at Lv. 200)
  const FLIGHT_UNLOCK_LEVEL = 200;
  const [isFlying, setIsFlying] = useState(false);
  const isFlyingRef = useRef(false);
  isFlyingRef.current = isFlying;
  const lastAttackAtRef = useRef<number>(0);

  useEffect(() => {
    if (player && player.level < FLIGHT_UNLOCK_LEVEL && isFlying) {
      setIsFlying(false);
    }
  }, [player?.level, isFlying]);

  const DEFAULT_AUTO_SKILLS = ['kamehameha', 'makankosappo', 'masenko', 'ki_blast', 'explosive_wave'];
  const [autoSkillsConfigOpen, setAutoSkillsConfigOpen] = useState(false);
  const [autoSkillIds, setAutoSkillIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('idle_nameki_auto_skills');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_AUTO_SKILLS);
        }
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_AUTO_SKILLS;
  });
  const autoSkillIdsRef = useRef<string[]>(autoSkillIds);
  autoSkillIdsRef.current = autoSkillIds;

  const [botEnabled, setBotEnabled] = useState(true);
  const [autoSkills, setAutoSkills] = useState(true);
  const [autoHeal, setAutoHeal] = useState(true);
  const [autoTransform, setAutoTransform] = useState(true);

  // Combat Skill Cooldowns & Target State
  const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});
  const skillCooldownsRef = useRef<Record<string, number>>({});
  skillCooldownsRef.current = skillCooldowns;

  const [selectedTargetName, setSelectedTargetName] = useState<string | null>(null);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);

  // World Refs for 60fps Canvas
  const playerPosRef = useRef<{
    x: number;
    y: number;
    facing: 'down' | 'up' | 'left' | 'right';
    moving: boolean;
  }>({ x: 21.5, y: 16.5, facing: 'down', moving: false });
  const joystickVecRef = useRef({ dx: 0, dy: 0 });
  const keysPressedRef = useRef<Set<string>>(new Set());
  const clickTargetRef = useRef<{ x: number; y: number } | null>(null);
  const monstersRef = useRef<WorldMonsterEntity[]>([]);
  const selectedTargetIdRef = useRef<string | null>(null);
  const projectilesRef = useRef<WorldProjectileVfx[]>([]);
  const floatingTextsRef = useRef<WorldFloatingText[]>([]);
  const lootSparklesRef = useRef<WorldLootSparkle[]>([]);
  const emotesRef = useRef<WorldEmoteBubble[]>([]);

  // Multiplayer & Rankings State (Hybrid WebSocket + Firestore Cross-Instance Presence)
  const [wsPlayers, setWsPlayers] = useState<OnlinePlayer[]>([]);
  const [fsPlayers, setFsPlayers] = useState<OnlinePlayer[]>([]);
  const [fsPresenceConnected, setFsPresenceConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [parties, setParties] = useState<PartyInfo[]>([]);
  const [currentPartyMembers, setCurrentPartyMembers] = useState<PartyMember[]>([]);
  const [rankingProfiles, setRankingProfiles] = useState<PublicProfile[]>([]);
  const [afkHistory, setAfkHistory] = useState<
    {
      id: string;
      mapId: string;
      offlineSeconds: number;
      xpGained: number;
      zeniGained: number;
      monstersKilled: number;
      levelsGained: number;
    }[]
  >([]);

  // New 10 Systems State (Guilds, Global Market, World Boss)
  const [guilds, setGuilds] = useState<GuildInfo[]>([]);
  const [currentGuild, setCurrentGuild] = useState<GuildInfo | null>(null);
  const [guildMembers, setGuildMembers] = useState<GuildMember[]>([]);
  const [guildChat, setGuildChat] = useState<GuildChatMessage[]>([]);
  const [marketOpenListings, setMarketOpenListings] = useState<MarketListing[]>([]);
  const [myMarketListings, setMyMarketListings] = useState<MarketListing[]>([]);
  const [worldBoss, setWorldBoss] = useState<WorldBossState | null>(null);
  const [selectedWorldBoss, setSelectedWorldBoss] = useState(false);
  const worldBossRef = useRef<WorldBossState | null>(null);
  worldBossRef.current = worldBoss;
  const selectedWorldBossRef = useRef(false);
  selectedWorldBossRef.current = selectedWorldBoss;

  // Global Game Config (Beta Tester Flag, ADMs, Content Creators)
  const [gameConfig, setGameConfig] = useState<GameGlobalConfig>(DEFAULT_GAME_CONFIG);
  const gameConfigRef = useRef<GameGlobalConfig>(DEFAULT_GAME_CONFIG);
  gameConfigRef.current = gameConfig;
  const pendingChestRef = useRef<{ id: string; x: number; y: number } | null>(null);

  const playerRef = useRef<PlayerSaveState | null>(null);
  playerRef.current = player;
  const wsRef = useRef<WebSocket | null>(null);
  const partyCountRef = useRef(1);
  const guildLevelRef = useRef(0);
  const serverClockOffsetRef = useRef(0);
  const seenRemoteEmotesRef = useRef<Map<string, number>>(new Map());
  const lastEmoteSentRef = useRef<{ text: string; atMs: number }>({ text: '', atMs: 0 });
  const syncPresenceNowRef = useRef<((isOnlineFlag?: boolean) => void) | null>(null);

  const partyMemberCount = Math.max(1, currentPartyMembers.length || (player?.partyId ? 1 : 1));
  partyCountRef.current = partyMemberCount;
  const activeGuildLevel = player?.guildId ? Math.max(1, currentGuild?.level ?? 1) : 0;
  guildLevelRef.current = activeGuildLevel;

  const onlinePlayers = useMemo(() => {
    const merged = new Map<string, OnlinePlayer>();
    for (const fp of fsPlayers) {
      merged.set(fp.uid, fp);
    }
    for (const wp of wsPlayers) {
      const existing = merged.get(wp.uid);
      if (!existing || (wp.updatedAtMs ?? 0) >= (existing.updatedAtMs ?? 0) - 2500) {
        merged.set(wp.uid, wp);
      }
    }
    if (player) {
      const selfStats = computeDerivedStats(player, partyMemberCount, activeGuildLevel);
      merged.set(player.uid, {
        uid: player.uid,
        name: player.name,
        race: player.race,
        title: player.title,
        level: player.level,
        powerLevel: selfStats.powerLevel,
        currentMapId: player.currentMapId,
        transformationId: player.transformationId,
        partyId: player.partyId,
        guildTag: player.guildTag ?? null,
        petId: player.activePetId ?? null,
        isFused: selfStats.isFused,
        x: Number(playerPosRef.current.x.toFixed(2)),
        y: Number(playerPosRef.current.y.toFixed(2)),
        facing: playerPosRef.current.facing,
        moving: playerPosRef.current.moving,
        isFlying,
        activityMode: player.activityMode,
        updatedAtMs: Date.now() + serverClockOffsetRef.current,
      });
    }
    return Array.from(merged.values()).sort((a, b) => b.powerLevel - a.powerLevel);
  }, [fsPlayers, wsPlayers, player, partyMemberCount, activeGuildLevel, isFlying]);

  const derived = useMemo(() => {
    if (!player) return null;
    return computeDerivedStats(player, partyMemberCount, activeGuildLevel);
  }, [player, partyMemberCount, activeGuildLevel]);

  const currentMap = useMemo(
    () => getMapById(player?.currentMapId ?? 'terra'),
    [player?.currentMapId]
  );

  const pushLog = useCallback((text: string, tone: BattleLogEntry['tone'] = 'normal') => {
    setBattleLog((prev) => [{ id: Date.now() + Math.random(), text, tone }, ...prev].slice(0, 45));
  }, []);

  const addFloatingText = useCallback(
    (x: number, y: number, text: string, color: string, isCrit = false) => {
      floatingTextsRef.current.push({
        id: Date.now() + Math.random(),
        x,
        y,
        text,
        color,
        isCrit,
        startedAt: Date.now(),
      });
    },
    []
  );

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setPlayer(null);
        setNeedsCreation(false);
        wsRef.current?.close();
        wsRef.current = null;
      }
    });
    return () => unsub();
  }, []);

  // Clock ticker
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Global Config Listener (Beta Tester toggle, ADMs, Criadores de Conteúdo)
  useEffect(() => {
    if (!authReady || !user) return;
    const cfgRef = doc(db, 'gameConfig', 'global');
    const unsub = onSnapshot(
      cfgRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setGameConfig({
            betaActive: typeof data.betaActive === 'boolean' ? data.betaActive : true,
            adminNames: Array.isArray(data.adminNames)
              ? data.adminNames.filter((n): n is string => typeof n === 'string')
              : DEFAULT_GAME_CONFIG.adminNames,
            adminUids: Array.isArray(data.adminUids)
              ? data.adminUids.filter((u): u is string => typeof u === 'string')
              : [],
            creatorNames: Array.isArray(data.creatorNames)
              ? data.creatorNames.filter((n): n is string => typeof n === 'string')
              : [],
          });
        } else if (
          !snap.metadata.fromCache &&
          user.emailVerified &&
          (ROOT_ADMIN_EMAILS.includes(user.email?.trim().toLowerCase() ?? '') ||
            ROOT_ADMIN_UIDS.includes(user.uid))
        ) {
          void setDoc(cfgRef, {
            ...DEFAULT_GAME_CONFIG,
            updatedAt: serverTimestamp(),
          }).catch((err) => console.warn('Aviso ao inicializar gameConfig/global:', err));
        }
      },
      (err) => console.warn('Aviso ao escutar gameConfig/global:', err)
    );
    return () => unsub();
  }, [authReady, user]);

  const isAdmin = useMemo(
    () => isPlayerAdmin(user?.email, user?.uid, player?.name, gameConfig),
    [user?.email, user?.uid, player?.name, gameConfig]
  );

  const isCreator = useMemo(
    () => isPlayerCreator(player?.name, gameConfig),
    [player?.name, gameConfig]
  );

  const canEditGlobalConfig = useMemo(() => {
    if (!user?.emailVerified) return false;
    const cleanEmail = user.email?.trim().toLowerCase() ?? '';
    if (ROOT_ADMIN_EMAILS.includes(cleanEmail) || ROOT_ADMIN_UIDS.includes(user.uid)) {
      return true;
    }
    return gameConfig.adminUids.includes(user.uid);
  }, [user?.email, user?.emailVerified, user?.uid, gameConfig.adminUids]);

  // Auto-grant special titles (ADM, Tester while Beta is active or for ADMs, Criador de Conteúdo)
  useEffect(() => {
    if (!player) return;
    const needed: string[] = [];
    if (isAdmin && !player.unlockedTitles.includes(SPECIAL_TITLES.ADM)) {
      needed.push(SPECIAL_TITLES.ADM);
    }
    if ((gameConfig.betaActive || isAdmin) && !player.unlockedTitles.includes(SPECIAL_TITLES.TESTER)) {
      needed.push(SPECIAL_TITLES.TESTER);
    }
    if (isCreator && !player.unlockedTitles.includes(SPECIAL_TITLES.CREATOR)) {
      needed.push(SPECIAL_TITLES.CREATOR);
    }
    if (needed.length === 0) return;

    setPlayer((prev) => {
      if (!prev) return prev;
      const merged = [...prev.unlockedTitles];
      for (const t of needed) {
        if (!merged.includes(t)) merged.push(t);
      }
      let nextTitle = prev.title;
      if (prev.title === 'Aprendiz de Artes Marciais' || prev.title === 'Aprendiz') {
        if (merged.includes(SPECIAL_TITLES.ADM)) nextTitle = SPECIAL_TITLES.ADM;
        else if (merged.includes(SPECIAL_TITLES.CREATOR)) nextTitle = SPECIAL_TITLES.CREATOR;
        else if (merged.includes(SPECIAL_TITLES.TESTER)) nextTitle = SPECIAL_TITLES.TESTER;
      }
      return { ...prev, unlockedTitles: merged, title: nextTitle };
    });

    for (const t of needed) {
      pushLog(`Título especial desbloqueado: ${t}!`, 'level');
    }
  }, [player?.uid, player?.name, player?.unlockedTitles, isAdmin, isCreator, gameConfig.betaActive, pushLog]);

  // Initialize monsters when map changes
  const initWorldForMap = useCallback((mapId: string, spawnBoss = false) => {
    const grid = getWorldMapGrid(mapId);
    playerPosRef.current = {
      x: grid.spawnTile.x + 0.5,
      y: grid.spawnTile.y + 0.5,
      facing: 'down',
      moving: false,
    };
    clickTargetRef.current = null;
    pendingChestRef.current = null;
    const list = spawnMapMonsters(mapId);
    if (spawnBoss) {
      const boss = getBossForMap(mapId);
      list.unshift({
        instanceId: `boss_${boss.id}_${Date.now()}`,
        def: boss,
        isBoss: true,
        x: grid.bossAltar.x + 0.5,
        y: grid.bossAltar.y + 0.5,
        spawnX: grid.bossAltar.x + 0.5,
        spawnY: grid.bossAltar.y + 0.5,
        hp: boss.hp,
        maxHp: boss.hp,
        hitFlashUntil: 0,
        respawnAt: 0,
        patrolPhase: 0,
      });
    }
    monstersRef.current = list;
    selectedTargetIdRef.current = list[0]?.instanceId ?? null;
    setSelectedTargetName(list[0]?.def.name ?? null);
  }, []);

  const syncToCloud = useCallback(async (stateToSave: PlayerSaveState, showFeedback = false) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    try {
      let nextToken = stateToSave.afkSessionToken;
      let serverTimeMs = stateToSave.lastActiveServerMs;

      try {
        const idToken = await auth.currentUser.getIdToken();
        const hbRes = await fetch('/api/afk/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });
        if (hbRes.ok) {
          const hb = (await hbRes.json()) as { serverTimeMs: number; afkSessionToken: string };
          nextToken = hb.afkSessionToken;
          serverTimeMs = hb.serverTimeMs;
          serverClockOffsetRef.current = hb.serverTimeMs - Date.now();
        }
      } catch {
        // Ignore transient heartbeat errors during server restarts; still persist player save
      }

      const updatedState: PlayerSaveState = {
        ...stateToSave,
        afkSessionToken: nextToken,
        lastActiveServerMs: serverTimeMs,
      };

      const payload = buildSanitizedPlayerPayload(updatedState);
      await updateDoc(doc(db, 'players', uid), {
        ...payload,
        updatedAt: serverTimestamp(),
      });

      const stats = computeDerivedStats(updatedState, partyCountRef.current, guildLevelRef.current);
      await setDoc(
        doc(db, 'publicProfiles', uid),
        {
          uid,
          isPublic: true,
          name: payload.name,
          race: payload.race,
          title: payload.title,
          level: payload.level,
          powerLevel: stats.powerLevel,
          maxKi: Math.max(payload.currentKi, stats.maxKi),
          monstersDefeated: payload.stats.monstersDefeated,
          bossesDefeated: payload.stats.bossesDefeated,
          trainingSeconds: payload.stats.trainingSeconds,
          currentMapId: payload.currentMapId,
          transformationId: payload.transformationId,
          partyId: payload.partyId ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) => console.warn('Aviso ao sincronizar perfil público:', err));

      if (showFeedback) {
        setSaveNotice(true);
        setTimeout(() => setSaveNotice(false), 2200);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar na nuvem:', err);
    }
  }, []);

  // Load save + Claim Server-Validated AFK Rewards
  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;

    async function loadCharacter() {
      setLoadingSave(true);
      setAuthError(null);
      try {
        const playerRefDoc = doc(db, 'players', user!.uid);
        let snap;
        try {
          snap = await getDocFromServer(playerRefDoc).catch(() => getDoc(playerRefDoc));
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `players/${user!.uid}`);
        }

        if (cancelled) return;

        if (!snap) {
          setAuthError('Não foi possível acessar seu save na nuvem. Tente reconectar.');
          setLoadingSave(false);
          return;
        }

        if (!snap.exists()) {
          if (snap.metadata.fromCache) {
            setAuthError('Sem conexão com o servidor para verificar seu save. Tente reconectar.');
            setLoadingSave(false);
            return;
          }
          setNeedsCreation(true);
          setPlayer(null);
          setLoadingSave(false);
          return;
        }

        const data = snap.data() as PlayerSaveState;
        const isServerSnap = !snap.metadata.fromCache;
        setNeedsCreation(false);

        let finalPlayer = data;
        let afkServerRestarted = false;
        try {
          const idToken = await user!.getIdToken();
          const claimRes = await fetch('/api/afk/claim', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ playerState: data }),
          });

          if (claimRes.ok) {
            const claimed = (await claimRes.json()) as {
              serverTimeMs?: number;
              updatedPlayer: PlayerSaveState;
              summary: AfkSummary;
            };
            if (typeof claimed.serverTimeMs === 'number') {
              serverClockOffsetRef.current = claimed.serverTimeMs - Date.now();
            }
            finalPlayer = claimed.updatedPlayer;

            if (claimed.summary.offlineSeconds >= 15) {
              setWelcomeSummary(claimed.summary);
              const histId = `afk_${user!.uid}_${Date.now().toString(36)}`;
              void setDoc(doc(db, 'afkHistory', histId), {
                uid: user!.uid,
                mapId: finalPlayer.currentMapId,
                offlineSeconds: claimed.summary.offlineSeconds,
                xpGained: claimed.summary.xpGained,
                zeniGained: claimed.summary.zeniGained,
                monstersKilled: claimed.summary.monstersKilled,
                itemsFoundCount: claimed.summary.itemsFound.length,
                rareItemsFoundCount: claimed.summary.rareItemsFound.length,
                levelsGained: claimed.summary.levelsGained,
                claimedAt: serverTimestamp(),
              }).catch((err) => console.warn('Aviso ao registrar histórico AFK:', err));
            }
          } else {
            afkServerRestarted = true;
          }
        } catch (claimErr) {
          afkServerRestarted = true;
          console.warn('Aviso ao validar progresso AFK no servidor (entrando com save local/nuvem):', claimErr);
        }

        if (cancelled) return;

        const sanitized = buildSanitizedPlayerPayload(finalPlayer);
        finalPlayer = {
          ...finalPlayer,
          ...sanitized,
          uid: user!.uid,
          createdAt: data.createdAt,
        };

        // Best-effort initial cloud write — never lock the player out of their loaded character if a transient update/rule hiccup happens
        try {
          const allowedKeys = new Set(Object.keys(sanitized));
          const hasLegacyExtraKeys = Object.keys(data).some(
            (k) => k !== 'createdAt' && k !== 'updatedAt' && !allowedKeys.has(k)
          );
          const hasValidCreatedAt =
            Boolean(data.createdAt) &&
            typeof (data.createdAt as { toMillis?: unknown })?.toMillis === 'function';

          if (isServerSnap && (!hasValidCreatedAt || hasLegacyExtraKeys)) {
            await setDoc(playerRefDoc, {
              ...sanitized,
              createdAt: hasValidCreatedAt ? data.createdAt : serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(playerRefDoc, {
              ...sanitized,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (syncErr) {
          console.warn('Aviso ao atualizar save após carregamento (seguindo com sessão ativa):', syncErr);
        }

        if (cancelled) return;

        initWorldForMap(finalPlayer.currentMapId);
        setPlayer(finalPlayer);
        pushLog(`Conectado em ${getMapById(finalPlayer.currentMapId).name}.`, 'level');
      } catch (err) {
        console.error(err);
        setAuthError(err instanceof Error ? err.message : 'Erro ao carregar personagem.');
      } finally {
        if (!cancelled) setLoadingSave(false);
      }
    }

    void loadCharacter();
    return () => {
      cancelled = true;
    };
  }, [authReady, user, loadRetryKey, initWorldForMap, pushLog]);

  // Periodic Cloud Save every 15s
  useEffect(() => {
    if (!player || !user) return;
    const id = setInterval(() => {
      if (playerRef.current) {
        void syncToCloud(playerRef.current, false);
      }
    }, 15000);
    return () => clearInterval(id);
  }, [player?.uid, user, syncToCloud]);

  // WebSocket Real-Time Multiplayer Connection (low-latency coordinates, combat VFX & emotes)
  useEffect(() => {
    if (!user || !player) return;
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let posSyncTimer: ReturnType<typeof setInterval> | null = null;
    let lastSentHash = '';
    let lastSentAt = 0;
    let forceTokenRefresh = false;

    async function connectSocket() {
      if (!active || !user || !playerRef.current) return;
      try {
        const idToken = await user.getIdToken(forceTokenRefresh);
        forceTokenRefresh = false;
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          const p = playerRef.current;
          if (!p) return;
          const stats = computeDerivedStats(p, partyCountRef.current, guildLevelRef.current);
          ws.send(
            JSON.stringify({
              type: 'auth',
              idToken,
              player: {
                uid: p.uid,
                name: p.name,
                race: p.race,
                title: p.title,
                level: p.level,
                powerLevel: stats.powerLevel,
                currentMapId: p.currentMapId,
                transformationId: p.transformationId,
                partyId: p.partyId,
                guildTag: p.guildTag ?? null,
                petId: p.activePetId ?? null,
                isFused: stats.isFused,
                x: Number(playerPosRef.current.x.toFixed(2)),
                y: Number(playerPosRef.current.y.toFixed(2)),
                facing: playerPosRef.current.facing,
                moving: playerPosRef.current.moving,
                isFlying: Boolean(isFlyingRef.current && p.level >= FLIGHT_UNLOCK_LEVEL),
                activityMode: p.activityMode,
              },
            })
          );
        };

        ws.onmessage = (ev) => {
          try {
            const payload = JSON.parse(ev.data as string) as {
              type: string;
              players?: OnlinePlayer[];
              message?: ChatMessage;
              uid?: string;
              text?: string;
              vfx?: Omit<WorldProjectileVfx, 'id' | 'startedAt'>;
            };
            if (payload.type === 'auth:ok') {
              setWsConnected(true);
            }
            if (payload.type === 'auth:error') {
              forceTokenRefresh = true;
              ws.close();
            }
            if (payload.type === 'presence:list' && payload.players) {
              const now = Date.now() + serverClockOffsetRef.current;
              setWsPlayers(
                payload.players.map((pl) => ({
                  ...pl,
                  updatedAtMs: pl.updatedAtMs ?? now,
                }))
              );
            }
            if (payload.type === 'chat:message' && payload.message) {
              setChatMessages((prev) => {
                if (prev.some((m) => m.id === payload.message!.id)) return prev;
                return [...prev, payload.message!].slice(-60);
              });
              setUnreadChat((c) => c + 1);
            }
            if (payload.type === 'skill:vfx' && payload.vfx && uiSettingsRef.current.showRemoteVfx) {
              projectilesRef.current.push({
                id: Date.now() + Math.random(),
                ...payload.vfx,
                startedAt: Date.now(),
              });
            }
            if (payload.type === 'player:emote' && payload.uid && payload.text) {
              const now = Date.now();
              emotesRef.current = [
                ...emotesRef.current.filter((e) => e.uid !== payload.uid && now - e.startedAt < 3500),
                { uid: payload.uid, text: payload.text, startedAt: now },
              ];
            }
          } catch {
            // Ignore malformed socket message
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          setWsPlayers([]);
          if (active) {
            reconnectTimer = setTimeout(() => void connectSocket(), 4000);
          }
        };
      } catch {
        setWsConnected(false);
      }
    }

    void connectSocket();
    posSyncTimer = setInterval(() => {
      const p = playerRef.current;
      if (!p || wsRef.current?.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      const stats = computeDerivedStats(p, partyCountRef.current, guildLevelRef.current);
      const rx = Number(playerPosRef.current.x.toFixed(2));
      const ry = Number(playerPosRef.current.y.toFixed(2));
      const flyingNow = Boolean(isFlyingRef.current && p.level >= FLIGHT_UNLOCK_LEVEL);
      const hash = `${p.currentMapId}|${p.transformationId}|${p.level}|${stats.powerLevel}|${p.activityMode}|${p.guildTag ?? ''}|${p.activePetId ?? ''}|${stats.isFused}|${rx}|${ry}|${playerPosRef.current.facing}|${playerPosRef.current.moving}|${flyingNow}`;

      if (hash === lastSentHash && now - lastSentAt < 1500) return;
      lastSentHash = hash;
      lastSentAt = now;

      wsRef.current.send(
        JSON.stringify({
          type: 'presence:update',
          player: {
            uid: p.uid,
            name: p.name,
            race: p.race,
            title: p.title,
            level: p.level,
            powerLevel: stats.powerLevel,
            currentMapId: p.currentMapId,
            transformationId: p.transformationId,
            partyId: p.partyId,
            guildTag: p.guildTag ?? null,
            petId: p.activePetId ?? null,
            isFused: stats.isFused,
            x: rx,
            y: ry,
            facing: playerPosRef.current.facing,
            moving: playerPosRef.current.moving,
            isFlying: flyingNow,
            activityMode: p.activityMode,
          },
        })
      );
    }, 200);

    return () => {
      active = false;
      setWsConnected(false);
      setWsPlayers([]);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (posSyncTimer) clearInterval(posSyncTimer);
      wsRef.current?.close();
    };
  }, [user, player?.uid]);

  // Firestore Real-Time Cross-Instance Map Presence (ensures Dev & Shared URLs see all players on the map)
  useEffect(() => {
    if (!user || !player) return;
    let active = true;
    let lastPos = { x: -1, y: -1 };
    let lastStateKey = '';
    let lastWriteAt = 0;

    const writePresence = (isOnlineFlag = true) => {
      const p = playerRef.current;
      if (!p || !auth.currentUser) return;
      const stats = computeDerivedStats(p, partyCountRef.current, guildLevelRef.current);
      const px = Math.max(0, Math.min(200, Number(playerPosRef.current.x.toFixed(2))));
      const py = Math.max(0, Math.min(200, Number(playerPosRef.current.y.toFixed(2))));
      const safeName = p.name.trim().slice(0, 24);
      if (safeName.length < 2) return;

      lastPos = { x: px, y: py };
      lastStateKey = `${isOnlineFlag}|${p.currentMapId}|${p.transformationId}|${p.level}|${p.partyId ?? ''}|${p.guildTag ?? ''}|${p.activePetId ?? ''}|${stats.isFused}|${p.activityMode}|${isFlyingRef.current}|${lastEmoteSentRef.current.atMs}`;
      lastWriteAt = Date.now();

      void setDoc(doc(db, 'worldPresence', user.uid), {
        uid: user.uid,
        isOnline: isOnlineFlag,
        name: safeName,
        race: p.race,
        title: (p.title || 'Aprendiz').slice(0, 64),
        level: Math.max(1, Math.min(99999, Math.floor(p.level))),
        powerLevel: Math.max(0, Math.floor(stats.powerLevel)),
        currentMapId: p.currentMapId.slice(0, 64),
        transformationId: p.transformationId.slice(0, 64),
        partyId: p.partyId ?? null,
        guildTag: p.guildTag ? p.guildTag.slice(0, 8) : null,
        petId: p.activePetId ?? null,
        isFused: Boolean(stats.isFused),
        x: px,
        y: py,
        facing: playerPosRef.current.facing,
        moving: Boolean(playerPosRef.current.moving),
        isFlying: Boolean(isFlyingRef.current && p.level >= FLIGHT_UNLOCK_LEVEL),
        activityMode: p.activityMode,
        emoteText: (lastEmoteSentRef.current.text || '').slice(0, 48),
        emoteAtMs: Math.max(0, Math.floor(lastEmoteSentRef.current.atMs || 0)),
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        if (active) {
          console.warn('Aviso ao atualizar presença no mapa:', err);
        }
      });
    };

    syncPresenceNowRef.current = writePresence;
    writePresence(true);

    const presenceQ = query(
      collection(db, 'worldPresence'),
      where('isOnline', '==', true),
      limit(80)
    );
    const unsubPresence = onSnapshot(
      presenceQ,
      (snap) => {
        if (!active) return;
        let nowServerMs = Date.now() + serverClockOffsetRef.current;

        for (const d of snap.docs) {
          if (d.id === user.uid) {
            const rawTs = d.data().updatedAt as { toMillis?: () => number } | undefined;
            if (rawTs && typeof rawTs.toMillis === 'function') {
              const ms = rawTs.toMillis();
              serverClockOffsetRef.current = ms - Date.now();
              nowServerMs = ms;
            }
            break;
          }
        }

        const loaded: OnlinePlayer[] = [];
        for (const d of snap.docs) {
          const data = d.data();
          const rawTs = data.updatedAt as { toMillis?: () => number } | undefined;
          const updatedAtMs =
            rawTs && typeof rawTs.toMillis === 'function' ? rawTs.toMillis() : nowServerMs;
          const ageMs = nowServerMs - updatedAtMs;

          if (d.id !== user.uid && ageMs > 90_000) continue;

          const emoteText = String(data.emoteText ?? '');
          const emoteAtMs = Number(data.emoteAtMs ?? 0);
          if (
            d.id !== user.uid &&
            emoteText &&
            emoteAtMs > 0 &&
            nowServerMs - emoteAtMs < 5000 &&
            seenRemoteEmotesRef.current.get(d.id) !== emoteAtMs
          ) {
            seenRemoteEmotesRef.current.set(d.id, emoteAtMs);
            const nowLocal = Date.now();
            emotesRef.current = [
              ...emotesRef.current.filter((e) => e.uid !== d.id && nowLocal - e.startedAt < 3500),
              { uid: d.id, text: emoteText, startedAt: nowLocal },
            ];
          }

          loaded.push({
            uid: String(data.uid ?? d.id),
            name: String(data.name ?? 'Guerreiro'),
            race: (data.race as RaceId) ?? 'namekian',
            title: String(data.title ?? 'Aprendiz'),
            level: Number(data.level ?? 1),
            powerLevel: Number(data.powerLevel ?? 0),
            currentMapId: String(data.currentMapId ?? 'terra'),
            transformationId: String(data.transformationId ?? 'base'),
            partyId: (data.partyId as string | null) ?? null,
            guildTag: (data.guildTag as string | null) ?? null,
            petId: (data.petId as string | null) ?? null,
            isFused: Boolean(data.isFused),
            x: typeof data.x === 'number' ? data.x : undefined,
            y: typeof data.y === 'number' ? data.y : undefined,
            facing: (data.facing as OnlinePlayer['facing']) ?? 'down',
            moving: Boolean(data.moving),
            isFlying: Boolean(data.isFlying),
            activityMode: (data.activityMode as OnlinePlayer['activityMode']) ?? 'combat',
            updatedAtMs,
          });
        }

        setFsPlayers(loaded);
        setFsPresenceConnected(true);
      },
      (err) => {
        setFsPresenceConnected(false);
        handleFirestoreError(err, OperationType.LIST, 'worldPresence');
      }
    );

    const fsSyncTimer = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const stats = computeDerivedStats(p, partyCountRef.current, guildLevelRef.current);
      const px = Number(playerPosRef.current.x.toFixed(2));
      const py = Number(playerPosRef.current.y.toFixed(2));
      const movedDist = Math.hypot(px - lastPos.x, py - lastPos.y);
      const stateKey = `true|${p.currentMapId}|${p.transformationId}|${p.level}|${p.partyId ?? ''}|${p.guildTag ?? ''}|${p.activePetId ?? ''}|${stats.isFused}|${p.activityMode}|${isFlyingRef.current}|${lastEmoteSentRef.current.atMs}`;
      const elapsed = Date.now() - lastWriteAt;

      if (stateKey !== lastStateKey || movedDist >= 0.45 || elapsed >= 20000) {
        writePresence(true);
      }
    }, 1200);

    const handlePageHide = () => writePresence(false);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      active = false;
      syncPresenceNowRef.current = null;
      setFsPresenceConnected(false);
      clearInterval(fsSyncTimer);
      window.removeEventListener('pagehide', handlePageHide);
      unsubPresence();
    };
  }, [user, player?.uid]);

  // Firestore Real-Time Listeners for Chat, Parties & AFK History
  useEffect(() => {
    if (!user || !player) return;

    const chatQ = query(
      collection(db, 'chatMessages'),
      where('channel', '==', 'global'),
      orderBy('createdAt', 'desc'),
      limit(35)
    );
    const unsubChat = onSnapshot(
      chatQ,
      (snap) => {
        const loaded: ChatMessage[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              uid: String(data.uid ?? ''),
              senderName: String(data.senderName ?? 'Guerreiro'),
              senderTitle: String(data.senderTitle ?? ''),
              senderLevel: Number(data.senderLevel ?? 1),
              channel: 'global' as const,
              text: String(data.text ?? ''),
              createdAtMs: Date.now(),
            };
          })
          .reverse();
        setChatMessages((prev) => {
          const map = new Map<string, ChatMessage>();
          for (const m of loaded) map.set(m.id, m);
          for (const m of prev) {
            if (m.id.startsWith('ws_') && !map.has(m.id)) map.set(m.id, m);
          }
          return Array.from(map.values()).slice(-60);
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'chatMessages')
    );

    const partiesQ = query(collection(db, 'parties'), where('isOpen', '==', true), limit(20));
    const unsubParties = onSnapshot(
      partiesQ,
      (snap) => {
        setParties(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name ?? 'Grupo'),
              leaderUid: String(data.leaderUid ?? ''),
              leaderName: String(data.leaderName ?? ''),
              mapId: String(data.mapId ?? 'terra'),
              isOpen: Boolean(data.isOpen),
              memberCount: Number(data.memberCount ?? 1),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'parties')
    );

    const afkQ = query(
      collection(db, 'afkHistory'),
      where('uid', '==', user.uid),
      orderBy('claimedAt', 'desc'),
      limit(10)
    );
    const unsubAfk = onSnapshot(
      afkQ,
      (snap) => {
        setAfkHistory(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              mapId: String(data.mapId ?? 'terra'),
              offlineSeconds: Number(data.offlineSeconds ?? 0),
              xpGained: Number(data.xpGained ?? 0),
              zeniGained: Number(data.zeniGained ?? 0),
              monstersKilled: Number(data.monstersKilled ?? 0),
              levelsGained: Number(data.levelsGained ?? 0),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'afkHistory')
    );

    return () => {
      unsubChat();
      unsubParties();
      unsubAfk();
    };
  }, [user, player?.uid]);

  useEffect(() => {
    if (!user || !player?.partyId) {
      setCurrentPartyMembers([]);
      return;
    }
    const membersPath = `parties/${player.partyId}/members`;
    const unsub = onSnapshot(
      collection(db, membersPath),
      (snap) => {
        setCurrentPartyMembers(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              uid: String(data.uid ?? d.id),
              name: String(data.name ?? 'Aliado'),
              level: Number(data.level ?? 1),
              powerLevel: Number(data.powerLevel ?? 0),
              transformationId: String(data.transformationId ?? 'base'),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, membersPath)
    );
    return () => unsub();
  }, [user, player?.partyId]);

  // Firestore Real-Time Listeners for Guilds, Global Market & World Boss
  useEffect(() => {
    if (!user || !player) return;

    const guildsQ = query(collection(db, 'guilds'), where('isOpen', '==', true), limit(30));
    const unsubGuilds = onSnapshot(
      guildsQ,
      (snap) => {
        setGuilds(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name ?? 'Clã'),
              tag: String(data.tag ?? 'CLAN'),
              leaderUid: String(data.leaderUid ?? ''),
              leaderName: String(data.leaderName ?? ''),
              description: String(data.description ?? ''),
              level: Number(data.level ?? 1),
              treasuryZeni: Number(data.treasuryZeni ?? 0),
              isOpen: Boolean(data.isOpen),
              memberCount: Number(data.memberCount ?? 1),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'guilds')
    );

    const openMarketQ = query(
      collection(db, 'marketListings'),
      where('status', '==', 'open'),
      limit(50)
    );
    const unsubOpenMarket = onSnapshot(
      openMarketQ,
      (snap) => {
        setMarketOpenListings(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              sellerUid: String(data.sellerUid ?? ''),
              sellerName: String(data.sellerName ?? 'Vendedor'),
              item: data.item as InventoryItem,
              price: Number(data.price ?? 1),
              status: (data.status as 'open' | 'sold') ?? 'open',
              buyerUid: (data.buyerUid as string | null) ?? null,
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'marketListings')
    );

    const myMarketQ = query(
      collection(db, 'marketListings'),
      where('sellerUid', '==', user.uid),
      limit(25)
    );
    const unsubMyMarket = onSnapshot(
      myMarketQ,
      (snap) => {
        setMyMarketListings(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              sellerUid: String(data.sellerUid ?? ''),
              sellerName: String(data.sellerName ?? 'Vendedor'),
              item: data.item as InventoryItem,
              price: Number(data.price ?? 1),
              status: (data.status as 'open' | 'sold') ?? 'open',
              buyerUid: (data.buyerUid as string | null) ?? null,
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'marketListings/mine')
    );

    const wbRef = doc(db, 'worldBosses', 'active');
    const unsubWb = onSnapshot(
      wbRef,
      (snap) => {
        if (!snap.exists()) {
          setWorldBoss(null);
          return;
        }
        const data = snap.data();
        setWorldBoss({
          bossId: String(data.bossId ?? ''),
          name: String(data.name ?? 'World Boss'),
          archetype: String(data.archetype ?? 'broly_boss'),
          mapId: String(data.mapId ?? 'terra'),
          colorPrimary: String(data.colorPrimary ?? '#ec4899'),
          colorSecondary: String(data.colorSecondary ?? '#facc15'),
          hp: Number(data.hp ?? 0),
          maxHp: Number(data.maxHp ?? 1),
          status: (data.status as 'active' | 'defeated') ?? 'defeated',
          spawnedAtMs: Number(data.spawnedAtMs ?? 0),
          respawnAtMs: Number(data.respawnAtMs ?? 0),
          topDamagers: Array.isArray(data.topDamagers)
            ? data.topDamagers.map((item) => ({
                uid: String(item.uid ?? ''),
                name: String(item.name ?? 'Guerreiro'),
                damage: Number(item.damage ?? 0),
              }))
            : [],
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'worldBosses/active')
    );

    return () => {
      unsubGuilds();
      unsubOpenMarket();
      unsubMyMarket();
      unsubWb();
    };
  }, [user, player?.uid]);

  // Active Guild Document, Members & Private Guild Chat Listeners
  useEffect(() => {
    if (!user || !player?.guildId) {
      setCurrentGuild(null);
      setGuildMembers([]);
      setGuildChat([]);
      return;
    }

    const gId = player.guildId;
    const unsubGuildDoc = onSnapshot(
      doc(db, 'guilds', gId),
      (snap) => {
        if (!snap.exists()) {
          setCurrentGuild(null);
          setPlayer((prev) => (prev ? { ...prev, guildId: null, guildTag: null } : prev));
          return;
        }
        const data = snap.data();
        setCurrentGuild({
          id: snap.id,
          name: String(data.name ?? 'Clã'),
          tag: String(data.tag ?? 'CLAN'),
          leaderUid: String(data.leaderUid ?? ''),
          leaderName: String(data.leaderName ?? ''),
          description: String(data.description ?? ''),
          level: Number(data.level ?? 1),
          treasuryZeni: Number(data.treasuryZeni ?? 0),
          isOpen: Boolean(data.isOpen),
          memberCount: Number(data.memberCount ?? 1),
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, `guilds/${gId}`)
    );

    const unsubMembers = onSnapshot(
      collection(db, `guilds/${gId}/members`),
      (snap) => {
        setGuildMembers(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              uid: String(data.uid ?? d.id),
              name: String(data.name ?? 'Membro'),
              level: Number(data.level ?? 1),
              powerLevel: Number(data.powerLevel ?? 0),
              donatedZeni: Number(data.donatedZeni ?? 0),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `guilds/${gId}/members`)
    );

    const guildChatQ = query(
      collection(db, `guilds/${gId}/chat`),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsubGuildChat = onSnapshot(
      guildChatQ,
      (snap) => {
        setGuildChat(
          snap.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                uid: String(data.uid ?? ''),
                senderName: String(data.senderName ?? 'Membro'),
                text: String(data.text ?? ''),
                createdAtMs: Date.now(),
              };
            })
            .reverse()
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `guilds/${gId}/chat`)
    );

    return () => {
      unsubGuildDoc();
      unsubMembers();
      unsubGuildChat();
    };
  }, [user, player?.guildId]);

  const refreshRankings = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'publicProfiles'), where('isPublic', '==', true), limit(100));
      const snap = await getDocs(q);
      setRankingProfiles(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid ?? d.id),
            isPublic: true,
            name: String(data.name ?? 'Guerreiro'),
            race: (data.race as RaceId) ?? 'namekian',
            title: String(data.title ?? 'Aprendiz'),
            level: Number(data.level ?? 1),
            powerLevel: Number(data.powerLevel ?? 0),
            maxKi: Number(data.maxKi ?? 0),
            monstersDefeated: Number(data.monstersDefeated ?? 0),
            bossesDefeated: Number(data.bossesDefeated ?? 0),
            trainingSeconds: Number(data.trainingSeconds ?? 0),
            currentMapId: String(data.currentMapId ?? 'terra'),
            transformationId: String(data.transformationId ?? 'base'),
            partyId: (data.partyId as string | null) ?? null,
          };
        })
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'publicProfiles');
    }
  }, []);

  useEffect(() => {
    if (user && player?.uid) {
      void refreshRankings();
    }
  }, [user, player?.uid, refreshRankings]);

  // Apply damage to a specific world monster entity
  const applyDamageToMonster = useCallback(
    (target: WorldMonsterEntity, mult: number, isSkill: boolean, skillColor?: string) => {
      const p = playerRef.current;
      if (!p || target.hp <= 0) return;
      const d = computeDerivedStats(p, partyCountRef.current, guildLevelRef.current);
      const bestiaryInfo = getBestiaryTierInfo(p.stats.killsByMonsterId?.[target.def.id] ?? 0);
      const bestiaryDmgMult = 1 + bestiaryInfo.damageBonusPct / 100;
      const bestiaryXpMult = 1 + bestiaryInfo.xpBonusPct / 100;

      const isCrit = Math.random() * 100 < d.critChance;
      const rawHit =
        d.strength * 1.65 * d.damageMultiplier * bestiaryDmgMult * mult * (0.92 + Math.random() * 0.16);
      const mitigated = Math.max(1, rawHit - target.def.defense * 0.35);
      const dmg = Math.max(1, Math.floor(isCrit ? mitigated * 1.85 : mitigated));

      target.hp -= dmg;
      target.hitFlashUntil = Date.now() + 140;

      addFloatingText(
        target.x,
        target.y,
        isCrit ? `CRIT -${formatNumber(dmg)}!` : `-${formatNumber(dmg)}`,
        isCrit ? '#fde047' : skillColor ?? '#ffffff',
        isCrit
      );

      if (isCrit) soundFx.playCrit();
      else if (!isSkill) soundFx.playHit();

      const distToTarget = Math.hypot(
        target.x - playerPosRef.current.x,
        target.y - playerPosRef.current.y
      );
      const aerialEvade = isFlyingRef.current && distToTarget > 2.2;
      const enemyDmg = aerialEvade
        ? 0
        : Math.max(0, Math.floor(target.def.damage - d.defense * 0.55));

      if (target.hp > 0) {
        setPlayer((prev) => {
          if (!prev) return prev;
          const regen = Math.max(1, Math.floor(d.maxHp * 0.015));
          return {
            ...prev,
            currentHp: Math.max(1, Math.min(d.maxHp, prev.currentHp - enemyDmg + regen)),
            stats: {
              ...prev.stats,
              totalDamageDealt: prev.stats.totalDamageDealt + dmg,
              criticalHits: prev.stats.criticalHits + (isCrit ? 1 : 0),
            },
          };
        });
        return;
      }

      // Monster defeated!
      target.hp = 0;
      target.respawnAt = Date.now() + 3600;
      const map = getMapById(p.currentMapId);

      // Loot roll (boosted by Pet & Divine Drop Bonus)
      let droppedItem: InventoryItem | null = null;
      if (target.isBoss) {
        const b = target.def as BossDef;
        const tplId = b.exclusiveDrops[Math.floor(Math.random() * b.exclusiveDrops.length)];
        const rarity = rollRarity(22 + map.order * 1.5 + d.dropBonusPct * 0.35);
        droppedItem = createItemInstance(tplId, rarity, b.requiredLevel);
      } else {
        const m = target.def as MonsterDef;
        if (Math.random() <= Math.min(0.65, m.dropChance + d.dropBonusPct * 0.002)) {
          const tplId = m.possibleDrops[Math.floor(Math.random() * m.possibleDrops.length)];
          const rarity = rollRarity(Math.min(28, map.order * 1.3 + d.dropBonusPct * 0.35));
          droppedItem = createItemInstance(tplId, rarity, m.level);
        }
      }

      const gainedXp = Math.max(1, Math.floor(target.def.xpReward * d.xpMultiplier * bestiaryXpMult));
      const gainedZeni = Math.max(1, Math.floor(target.def.zeniReward * d.zeniMultiplier));
      const gainedFrags = target.isBoss
        ? 6 + Math.floor(Math.random() * 10)
        : 1 + Math.floor(Math.random() * 3);

      // Rare Dragon Ball Drop (1..7)
      const ownedBalls = p.dragonBalls ?? [];
      const missingBalls = [1, 2, 3, 4, 5, 6, 7].filter((n) => !ownedBalls.includes(n));
      const ballDropChance = (target.isBoss ? 0.14 : 0.03) + d.dropBonusPct * 0.001;
      const foundBall =
        missingBalls.length > 0 && Math.random() < ballDropChance
          ? missingBalls[Math.floor(Math.random() * missingBalls.length)]
          : null;

      addFloatingText(
        target.x,
        target.y + 0.35,
        `+${formatNumber(gainedXp)} XP`,
        d.xpMultiplier > 1 ? '#fde047' : '#38bdf8'
      );

      if (foundBall !== null) {
        addFloatingText(target.x, target.y - 0.35, `ESFERA ${foundBall}★!`, '#facc15', true);
        soundFx.playRareDrop();
        pushLog(`Você encontrou a Esfera do Dragão de ${foundBall} Estrela(s)!`, 'boss');
      }

      if (droppedItem) {
        lootSparklesRef.current.push({
          id: Date.now() + Math.random(),
          x: target.x,
          y: target.y,
          color: RARITY_CONFIG[droppedItem.rarity].color,
          label: droppedItem.name,
          startedAt: Date.now(),
        });
        if (isRareOrHigher(droppedItem.rarity)) soundFx.playRareDrop();
        pushLog(
          `Drop: ${droppedItem.name} (${RARITY_CONFIG[droppedItem.rarity].label})`,
          'drop'
        );
      }

      if (target.isBoss) {
        pushLog(
          `Chefe ${target.def.name} derrotado! (+${formatNumber(gainedXp)} XP · +${gainedFrags} Frag)`,
          'boss'
        );
        soundFx.playLevelUp();
        monstersRef.current = monstersRef.current.filter((m) => m.instanceId !== target.instanceId);
      } else {
        pushLog(
          `${target.def.name} derrotado (+${formatNumber(gainedXp)} XP · +${formatNumber(
            gainedZeni
          )} Zeni · +${gainedFrags} Frag)`,
          isCrit ? 'crit' : 'normal'
        );
      }

      setPlayer((prev) => {
        if (!prev) return prev;
        const today = getTodayUtcString();
        const resetDaily = prev.dailyMissionDate !== today;
        const missionProgress = resetDaily
          ? { daily_kills: 0, daily_saibaman: 0, daily_training_sec: 0 }
          : { ...prev.missionProgress };

        let workingInv = prev.inventory;
        let rareInc = 0;
        let itemInc = 0;
        if (droppedItem) {
          workingInv = addItemToInventory(workingInv, droppedItem);
          itemInc = 1;
          if (isRareOrHigher(droppedItem.rarity)) rareInc = 1;
        }

        const nextCooldowns = { ...prev.bossCooldowns };
        if (target.isBoss) {
          const b = target.def as BossDef;
          nextCooldowns[b.id] = Date.now() + b.respawnSeconds * 1000;
        } else {
          missionProgress.daily_kills = (missionProgress.daily_kills ?? 0) + 1;
          if (target.def.archetype === 'saibaman') {
            missionProgress.daily_saibaman = (missionProgress.daily_saibaman ?? 0) + 1;
          }
        }

        const prevBalls = prev.dragonBalls ?? [];
        const nextBalls =
          foundBall !== null && !prevBalls.includes(foundBall)
            ? [...prevBalls, foundBall].slice(0, 7)
            : prevBalls;

        const updated: PlayerSaveState = {
          ...prev,
          zeni: prev.zeni + gainedZeni,
          kiFragments: (prev.kiFragments ?? 0) + gainedFrags,
          dragonBalls: nextBalls,
          petXp: prev.activePetId ? (prev.petXp ?? 0) + (target.isBoss ? 60 : 12) : prev.petXp ?? 0,
          currentKi: prev.currentKi + target.def.kiReward,
          currentHp: Math.min(d.maxHp, prev.currentHp + Math.floor(d.maxHp * 0.08)),
          inventory: workingInv,
          missionProgress,
          dailyMissionDate: today,
          claimedMissions: resetDaily
            ? prev.claimedMissions.filter((id) => !id.startsWith('daily_'))
            : prev.claimedMissions,
          bossCooldowns: nextCooldowns,
          stats: {
            ...prev.stats,
            monstersDefeated: prev.stats.monstersDefeated + (target.isBoss ? 0 : 1),
            bossesDefeated: prev.stats.bossesDefeated + (target.isBoss ? 1 : 0),
            totalDamageDealt: prev.stats.totalDamageDealt + dmg,
            criticalHits: prev.stats.criticalHits + (isCrit ? 1 : 0),
            itemsFound: prev.stats.itemsFound + itemInc,
            rareItemsFound: prev.stats.rareItemsFound + rareInc,
            killsByMonsterId: {
              ...prev.stats.killsByMonsterId,
              [target.def.id]: (prev.stats.killsByMonsterId[target.def.id] ?? 0) + 1,
            },
          },
        };

        const { nextPlayer, levelsGained } = applyXpAndLevelUps(updated, gainedXp);
        if (levelsGained > 0) {
          soundFx.playLevelUp();
          pushLog(`Level Up! Você alcançou o Nível ${nextPlayer.level}!`, 'level');
        }
        return nextPlayer;
      });

      // Pick next alive target automatically if BOT is on
      const aliveNext = monstersRef.current.find((m) => m.hp > 0);
      selectedTargetIdRef.current = aliveNext?.instanceId ?? null;
      setSelectedTargetName(aliveNext?.def.name ?? null);
    },
    [addFloatingText, pushLog]
  );

  // Cast an active Dragon Ball combat skill
  const castSkill = useCallback(
    (skill: CombatSkillDef) => {
      const p = playerRef.current;
      if (!p || p.level < skill.requiredLevel) return false;
      const now = Date.now();
      if ((skillCooldownsRef.current[skill.id] ?? 0) > now) return false;
      if (p.currentKi < skill.kiCost) return false;

      const d = computeDerivedStats(p, partyCountRef.current);
      const pos = playerPosRef.current;
      const flyingNow = isFlyingRef.current;
      const originY = pos.y - (flyingNow ? 0.5 : 0);
      const broadcastVfx = (vfx: Omit<WorldProjectileVfx, 'id' | 'startedAt'>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'skill:vfx', vfx }));
        }
      };

      if (skill.kind === 'heal') {
        const healAmt = Math.max(30, Math.floor(d.maxHp * 0.4));
        setPlayer((prev) =>
          prev
            ? {
                ...prev,
                currentHp: Math.min(d.maxHp, prev.currentHp + healAmt),
                currentKi: Math.max(0, prev.currentKi - skill.kiCost),
              }
            : prev
        );
        const vfx: Omit<WorldProjectileVfx, 'id' | 'startedAt'> = {
          kind: 'heal',
          fromX: pos.x,
          fromY: originY,
          toX: pos.x,
          toY: originY,
          colorPrimary: skill.colorPrimary,
          colorSecondary: skill.colorSecondary,
          radiusTiles: 2.2,
          durationMs: 420,
        };
        projectilesRef.current.push({ id: now + Math.random(), ...vfx, startedAt: now });
        broadcastVfx(vfx);
        addFloatingText(pos.x, originY, `+${formatNumber(healAmt)} HP`, '#4ade80', true);
        soundFx.playTransform();
      } else if (skill.kind === 'buff') {
        const kiRestore = Math.max(120, Math.floor(d.maxKi * 0.25));
        setPlayer((prev) => (prev ? { ...prev, currentKi: prev.currentKi + kiRestore } : prev));
        const vfx: Omit<WorldProjectileVfx, 'id' | 'startedAt'> = {
          kind: 'aoe',
          fromX: pos.x,
          fromY: originY,
          toX: pos.x,
          toY: originY,
          colorPrimary: skill.colorPrimary,
          colorSecondary: skill.colorSecondary,
          radiusTiles: 2.5,
          durationMs: 420,
        };
        projectilesRef.current.push({ id: now + Math.random(), ...vfx, startedAt: now });
        broadcastVfx(vfx);
        addFloatingText(pos.x, originY, `+${formatNumber(kiRestore)} Ki`, '#38bdf8', true);
        soundFx.playTransform();
      } else {
        // Combat attack skill (extended aerial range when flying above!)
        const alive = monstersRef.current.filter((m) => m.hp > 0);
        if (alive.length === 0) return false;
        lastAttackAtRef.current = now;

        if (skill.kind === 'aoe') {
          const aoeReach = skill.aoeRadiusTiles + (flyingNow ? 3.2 : 1.5);
          const hits = alive.filter(
            (m) => Math.hypot(m.x - pos.x, m.y - pos.y) <= aoeReach
          );
          if (hits.length === 0) return false;
          const vfx: Omit<WorldProjectileVfx, 'id' | 'startedAt'> = {
            kind: 'aoe',
            fromX: pos.x,
            fromY: pos.y,
            toX: pos.x,
            toY: pos.y,
            colorPrimary: skill.colorPrimary,
            colorSecondary: skill.colorSecondary,
            radiusTiles: skill.aoeRadiusTiles + (flyingNow ? 1.5 : 0),
            durationMs: 380,
          };
          projectilesRef.current.push({ id: now + Math.random(), ...vfx, startedAt: now });
          broadcastVfx(vfx);
          setPlayer((prev) =>
            prev ? { ...prev, currentKi: Math.max(0, prev.currentKi - skill.kiCost) } : prev
          );
          soundFx.playCrit();
          for (const target of hits) {
            applyDamageToMonster(target, skill.damageMultiplier, true, skill.colorPrimary);
          }
        } else {
          // Projectile or beam toward selected or nearest monster (long range from sky)
          let target =
            alive.find((m) => m.instanceId === selectedTargetIdRef.current) ??
            alive.sort(
              (a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y)
            )[0];
          if (!target) return false;
          const maxSkillRange = flyingNow ? 12.5 : 8.5;
          if (Math.hypot(target.x - pos.x, target.y - pos.y) > maxSkillRange) return false;

          selectedTargetIdRef.current = target.instanceId;
          setSelectedTargetName(target.def.name);
          setPlayer((prev) =>
            prev ? { ...prev, currentKi: Math.max(0, prev.currentKi - skill.kiCost) } : prev
          );
          const vfx: Omit<WorldProjectileVfx, 'id' | 'startedAt'> = {
            kind: skill.kind,
            fromX: pos.x,
            fromY: originY,
            toX: target.x,
            toY: target.y,
            colorPrimary: skill.colorPrimary,
            colorSecondary: skill.colorSecondary,
            radiusTiles: 1,
            durationMs: skill.kind === 'beam' ? 280 : 220,
          };
          projectilesRef.current.push({ id: now + Math.random(), ...vfx, startedAt: now });
          broadcastVfx(vfx);
          soundFx.playCrit();
          applyDamageToMonster(target, skill.damageMultiplier, true, skill.colorPrimary);
        }
      }

      const nextCd = {
        ...skillCooldownsRef.current,
        [skill.id]: now + skill.cooldownSec * 1000,
      };
      skillCooldownsRef.current = nextCd;
      setSkillCooldowns(nextCd);
      return true;
    },
    [addFloatingText, applyDamageToMonster]
  );

  // Chest Opening (10-minute per-chest cooldown, random item + Zeni + Ki Fragments + Dragon Ball chance)
  const openChestImmediate = useCallback(
    (chest: { id: string; x: number; y: number }) => {
      const p = playerRef.current;
      if (!p) return;
      const now = Date.now();
      const readyAt = p.chestCooldowns?.[chest.id] ?? 0;
      if (readyAt > now) {
        const remSec = Math.max(1, Math.ceil((readyAt - now) / 1000));
        const mm = Math.floor(remSec / 60);
        const ss = String(remSec % 60).padStart(2, '0');
        addFloatingText(chest.x + 0.5, chest.y, `Baú: ${mm}:${ss}`, '#94a3b8');
        pushLog(`Este baú ainda está em recarga (${mm}m ${ss}s).`, 'normal');
        return;
      }

      const d = computeDerivedStats(p, partyCountRef.current, guildLevelRef.current);
      const map = getMapById(p.currentMapId);
      const rarity = rollRarity(10 + map.order * 1.6 + d.dropBonusPct * 0.4);
      const tpl = ITEM_TEMPLATES[Math.floor(Math.random() * ITEM_TEMPLATES.length)];
      const itemLevel = Math.max(map.requiredLevel, p.level);
      const chestItem = createItemInstance(tpl.id, rarity, itemLevel);
      const bonusZeni = Math.max(
        50,
        Math.round((45 + map.order * 35) * (1 + p.level * 0.12) * d.zeniMultiplier)
      );
      const bonusFrags = 3 + Math.floor(Math.random() * 6);

      const ownedBalls = p.dragonBalls ?? [];
      const missingBalls = [1, 2, 3, 4, 5, 6, 7].filter((n) => !ownedBalls.includes(n));
      const foundBall =
        missingBalls.length > 0 && Math.random() < 0.18 + d.dropBonusPct * 0.002
          ? missingBalls[Math.floor(Math.random() * missingBalls.length)]
          : null;

      setPlayer((prev) => {
        if (!prev) return prev;
        if ((prev.chestCooldowns?.[chest.id] ?? 0) > Date.now()) return prev;
        const nextInv = addItemToInventory(prev.inventory, chestItem);
        const rareInc = isRareOrHigher(chestItem.rarity) ? 1 : 0;
        const prevBalls = prev.dragonBalls ?? [];
        const nextBalls =
          foundBall !== null && !prevBalls.includes(foundBall)
            ? [...prevBalls, foundBall].slice(0, 7)
            : prevBalls;
        return {
          ...prev,
          zeni: prev.zeni + bonusZeni,
          kiFragments: (prev.kiFragments ?? 0) + bonusFrags,
          dragonBalls: nextBalls,
          inventory: nextInv,
          chestCooldowns: {
            ...(prev.chestCooldowns ?? {}),
            [chest.id]: Date.now() + CHEST_COOLDOWN_MS,
          },
          stats: {
            ...prev.stats,
            itemsFound: prev.stats.itemsFound + 1,
            rareItemsFound: prev.stats.rareItemsFound + rareInc,
          },
        };
      });

      const rarityColor = RARITY_CONFIG[chestItem.rarity].color;
      lootSparklesRef.current.push({
        id: now + Math.random(),
        x: chest.x + 0.5,
        y: chest.y + 0.4,
        color: rarityColor,
        label: chestItem.name,
        startedAt: now,
      });
      addFloatingText(chest.x + 0.5, chest.y - 0.15, `${chestItem.name}!`, rarityColor, true);
      addFloatingText(chest.x + 0.5, chest.y + 0.25, `+${formatNumber(bonusZeni)} Zeni`, '#fde047');
      if (foundBall !== null) {
        addFloatingText(chest.x + 0.5, chest.y - 0.5, `ESFERA ${foundBall}★!`, '#facc15', true);
        pushLog(`Baú continha a Esfera do Dragão de ${foundBall} Estrela(s)!`, 'boss');
      }
      soundFx.playRareDrop();
      pushLog(
        `Baú aberto! ${chestItem.name} (${RARITY_CONFIG[chestItem.rarity].label}) + ${formatNumber(bonusZeni)} Zeni + ${bonusFrags} Frag!`,
        'drop'
      );
    },
    [addFloatingText, pushLog]
  );

  const handleOpenChest = useCallback(
    (chest: { id: string; x: number; y: number }) => {
      const p = playerRef.current;
      if (!p) return;
      const pos = playerPosRef.current;
      const dist = Math.hypot(chest.x + 0.5 - pos.x, chest.y + 0.5 - pos.y);
      const reach = isFlyingRef.current ? 4.2 : 2.35;

      if (dist <= reach) {
        pendingChestRef.current = null;
        openChestImmediate(chest);
      } else {
        pendingChestRef.current = chest;
        clickTargetRef.current = { x: chest.x + 0.5, y: chest.y + 0.5 };
        pushLog('Indo até o baú no mapa...', 'normal');
      }
    },
    [openChestImmediate, pushLog]
  );

  // Auto-open pending chest on arrival
  useEffect(() => {
    if (!player) return;
    const id = setInterval(() => {
      const pending = pendingChestRef.current;
      if (!pending) return;
      const pos = playerPosRef.current;
      const dist = Math.hypot(pending.x + 0.5 - pos.x, pending.y + 0.5 - pos.y);
      const reach = isFlyingRef.current ? 4.2 : 2.35;
      if (dist <= reach) {
        pendingChestRef.current = null;
        openChestImmediate(pending);
      } else if (!clickTargetRef.current) {
        pendingChestRef.current = null;
      }
    }, 160);
    return () => clearInterval(id);
  }, [player?.uid, openChestImmediate]);

  // Target Nearest Monster
  const handleTargetNearest = useCallback(() => {
    const pos = playerPosRef.current;
    const alive = monstersRef.current.filter((m) => m.hp > 0);
    if (alive.length === 0) return;
    alive.sort(
      (a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y)
    );
    selectedTargetIdRef.current = alive[0].instanceId;
    setSelectedTargetName(alive[0].def.name);
  }, []);

  const handleToggleFlight = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.level < FLIGHT_UNLOCK_LEVEL) {
      setIsFlying(false);
      soundFx.playHit();
      pushLog(
        `Nuvem Voadora (Sistema de Voo) só é desbloqueada no Nível ${FLIGHT_UNLOCK_LEVEL}! (Atual: Nv. ${p.level}/${FLIGHT_UNLOCK_LEVEL})`,
        'normal'
      );
      return;
    }
    setIsFlying((prev) => {
      const next = !prev;
      soundFx.playTransform();
      pushLog(
        next
          ? 'Nuvem Voadora invocada! Sobrevoe obstáculos e acerte inimigos lá do alto.'
          : 'Desceu da Nuvem Voadora.',
        'level'
      );
      return next;
    });
  }, [pushLog]);

  // Keyboard Controls (WASD/Arrows, Tab to target, V to summon Nuvem Voadora, E to open chest, 1-8 to cast Habilidades, Esc to close drawers)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Escape') {
        setActiveDrawer(null);
        setAutoSkillsConfigOpen(false);
        setSettingsOpen(false);
        setInspectedPlayer(null);
        return;
      }
      if (e.code === 'KeyV') {
        handleToggleFlight();
        return;
      }
      if (e.code === 'KeyE') {
        const p = playerRef.current;
        if (!p) return;
        const grid = getWorldMapGrid(p.currentMapId);
        const pos = playerPosRef.current;
        const reach = isFlyingRef.current && p.level >= FLIGHT_UNLOCK_LEVEL ? 4.2 : 2.6;
        const now = Date.now();
        const readyChests = grid.chests
          .filter((ch) => (p.chestCooldowns?.[ch.id] ?? 0) <= now)
          .map((ch) => ({ ch, dist: Math.hypot(ch.x + 0.5 - pos.x, ch.y + 0.5 - pos.y) }))
          .filter((item) => item.dist <= reach)
          .sort((a, b) => a.dist - b.dist);
        if (readyChests[0]) {
          handleOpenChest(readyChests[0].ch);
        }
        return;
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        handleTargetNearest();
        return;
      }
      if (e.key >= '1' && e.key <= '8') {
        const slot = Number(e.key);
        const skill = COMBAT_SKILLS.find((s) => s.slot === slot);
        if (skill) void castSkill(skill);
        return;
      }
      pendingChestRef.current = null;
      keysPressedRef.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [castSkill, handleOpenChest, handleTargetNearest, handleToggleFlight]);

  // World Boss Attacks & Spawning
  const handleSpawnNextWorldBoss = useCallback(async () => {
    if (!auth.currentUser) return;
    const cur = worldBossRef.current;
    if (cur && cur.status === 'active' && cur.hp > 0) return;
    if (cur && cur.status === 'defeated' && cur.respawnAtMs > Date.now()) return;

    const currentIdx = cur
      ? WORLD_BOSS_TEMPLATES.findIndex((t) => t.bossId === cur.bossId)
      : -1;
    const tpl = WORLD_BOSS_TEMPLATES[(currentIdx + 1) % WORLD_BOSS_TEMPLATES.length];
    const now = Date.now();
    try {
      await setDoc(doc(db, 'worldBosses', 'active'), {
        bossId: tpl.bossId,
        name: tpl.name,
        archetype: tpl.archetype,
        mapId: tpl.mapId,
        colorPrimary: tpl.colorPrimary,
        colorSecondary: tpl.colorSecondary,
        hp: tpl.maxHp,
        maxHp: tpl.maxHp,
        status: 'active',
        spawnedAtMs: now,
        respawnAtMs: 0,
        topDamagers: [],
        updatedAt: serverTimestamp(),
      });
      pushLog(`INVASÃO GLOBAL! ${tpl.name} surgiu em ${getMapById(tpl.mapId).name}!`, 'boss');
      soundFx.playLevelUp();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'worldBosses/active');
    }
  }, [pushLog]);

  const handleAttackWorldBoss = useCallback(async () => {
    const p = playerRef.current;
    const wb = worldBossRef.current;
    if (!p || !wb || wb.status !== 'active' || wb.hp <= 0 || !auth.currentUser) return;

    const d = computeDerivedStats(p, partyCountRef.current, guildLevelRef.current);
    const isCrit = Math.random() * 100 < d.critChance;
    const rawDmg = Math.max(25, Math.floor(d.strength * 2.1 * d.damageMultiplier * (isCrit ? 1.75 : 1)));
    const dmg = Math.min(wb.hp, rawDmg);
    const newHp = Math.max(0, wb.hp - dmg);
    const defeated = newHp === 0;

    const map = getWorldMapGrid(wb.mapId);
    const wbX = map.bossAltar.x + 2.5;
    const wbY = map.bossAltar.y + 1.5;
    if (p.currentMapId === wb.mapId) {
      lastAttackAtRef.current = Date.now();
      projectilesRef.current.push({
        id: Date.now() + Math.random(),
        kind: 'beam',
        fromX: playerPosRef.current.x,
        fromY: playerPosRef.current.y - (isFlyingRef.current ? 0.5 : 0),
        toX: wbX,
        toY: wbY,
        colorPrimary: '#ec4899',
        colorSecondary: '#fef08a',
        radiusTiles: 1,
        durationMs: 260,
        startedAt: Date.now(),
      });
      addFloatingText(wbX, wbY - 0.3, `-${formatNumber(dmg)}`, isCrit ? '#fde047' : '#f472b6', isCrit);
    }

    const updatedDamagers = [...wb.topDamagers];
    const existingIdx = updatedDamagers.findIndex((entry) => entry.uid === p.uid);
    if (existingIdx >= 0) {
      updatedDamagers[existingIdx] = {
        uid: p.uid,
        name: p.name,
        damage: updatedDamagers[existingIdx].damage + dmg,
      };
    } else {
      updatedDamagers.push({ uid: p.uid, name: p.name, damage: dmg });
    }
    updatedDamagers.sort((a, b) => b.damage - a.damage);
    const clampedDamagers = updatedDamagers.slice(0, 20);

    try {
      await setDoc(doc(db, 'worldBosses', 'active'), {
        bossId: wb.bossId,
        name: wb.name,
        archetype: wb.archetype,
        mapId: wb.mapId,
        colorPrimary: wb.colorPrimary,
        colorSecondary: wb.colorSecondary,
        hp: newHp,
        maxHp: wb.maxHp,
        status: defeated ? 'defeated' : 'active',
        spawnedAtMs: wb.spawnedAtMs,
        respawnAtMs: defeated ? Date.now() + 45000 : 0,
        topDamagers: clampedDamagers,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'worldBosses/active');
    }

    const tpl =
      WORLD_BOSS_TEMPLATES.find((t) => t.bossId === wb.bossId) ?? WORLD_BOSS_TEMPLATES[0];
    const hitZeni = Math.max(40, Math.floor((80 + p.level * 12) * d.zeniMultiplier));
    const hitXp = Math.max(30, Math.floor((60 + p.level * 18) * d.xpMultiplier));

    setPlayer((prev) => {
      if (!prev) return prev;
      let nextInv = prev.inventory;
      let bonusZeni = hitZeni;
      let bonusFrags = defeated ? tpl.rewardFragments : 1;
      let rareInc = 0;

      if (defeated) {
        bonusZeni += Math.floor(tpl.rewardZeni * d.zeniMultiplier);
        const dropTpl = ITEM_TEMPLATES[Math.floor(Math.random() * ITEM_TEMPLATES.length)];
        const rewardRarity = rollRarity(35 + d.dropBonusPct);
        const rewardItem = createItemInstance(dropTpl.id, rewardRarity, Math.max(25, prev.level));
        nextInv = addItemToInventory(nextInv, rewardItem);
        if (isRareOrHigher(rewardItem.rarity)) rareInc = 1;
        pushLog(
          `WORLD BOSS ${wb.name} DERROTADO! +${formatNumber(bonusZeni)} Zeni, +${bonusFrags} Fragmentos e ${rewardItem.name}!`,
          'boss'
        );
        soundFx.playLevelUp();
      } else {
        soundFx.playCrit();
      }

      const nextState: PlayerSaveState = {
        ...prev,
        zeni: prev.zeni + bonusZeni,
        kiFragments: (prev.kiFragments ?? 0) + bonusFrags,
        inventory: nextInv,
        stats: {
          ...prev.stats,
          totalDamageDealt: prev.stats.totalDamageDealt + dmg,
          rareItemsFound: prev.stats.rareItemsFound + rareInc,
          bossesDefeated: prev.stats.bossesDefeated + (defeated ? 1 : 0),
        },
      };
      return applyXpAndLevelUps(nextState, hitXp).nextPlayer;
    });
  }, [addFloatingText, pushLog]);

  // Core Auto-Combat / BOT / Training Tick Loop
  useEffect(() => {
    if (!player || !derived) return;

    const tickMs =
      player.activityMode === 'training'
        ? 1000
        : Math.max(280, Math.round(1000 / Math.max(0.8, derived.attacksPerSecond)));

    const interval = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const d = computeDerivedStats(p, partyCountRef.current, guildLevelRef.current);

      if (p.activityMode === 'training') {
        const disc =
          TRAINING_DISCIPLINES.find((t) => t.id === p.trainingStat) ?? TRAINING_DISCIPLINES[0];
        const scale = 1 + p.level * 0.08;
        const statPerSec = Math.max(1, Math.round((disc.gainPerMinute / 60) * scale));
        const kiPerSec = Math.max(2, Math.round((disc.kiGainPerMinute / 60) * scale));
        const xpPerSec = Math.max(2, Math.floor((4 + p.level * 2.2) * d.xpMultiplier));

        setPlayer((prev) => {
          if (!prev) return prev;
          const next: PlayerSaveState = {
            ...prev,
            currentKi: prev.currentKi + kiPerSec,
            currentHp: Math.min(d.maxHp, prev.currentHp + Math.max(2, Math.floor(d.maxHp * 0.04))),
            bonusStrength:
              prev.trainingStat === 'strength' ? prev.bonusStrength + statPerSec : prev.bonusStrength,
            bonusDefense:
              prev.trainingStat === 'defense' ? prev.bonusDefense + statPerSec : prev.bonusDefense,
            bonusSpeed:
              prev.trainingStat === 'speed' ? prev.bonusSpeed + statPerSec : prev.bonusSpeed,
            bonusKi: prev.trainingStat === 'ki' ? prev.bonusKi + statPerSec : prev.bonusKi,
            bonusStamina:
              prev.trainingStat === 'stamina' ? prev.bonusStamina + statPerSec : prev.bonusStamina,
            missionProgress: {
              ...prev.missionProgress,
              daily_training_sec: (prev.missionProgress.daily_training_sec ?? 0) + 1,
            },
            stats: {
              ...prev.stats,
              trainingSeconds: prev.stats.trainingSeconds + 1,
            },
          };
          const { nextPlayer, levelsGained } = applyXpAndLevelUps(next, xpPerSec);
          if (levelsGained > 0) {
            soundFx.playLevelUp();
            pushLog(`Nível ${nextPlayer.level} alcançado treinando!`, 'level');
          }
          return nextPlayer;
        });
        return;
      }

      // BOT Auto-Transform to highest unlocked form (respecting secret codes!)
      if (botEnabled && autoTransform) {
        const bestForm = [...TRANSFORMATIONS]
          .reverse()
          .find(
            (tf) =>
              (!tf.secretOnly || p.unlockedTransformations.includes(tf.id)) &&
              p.level >= tf.requiredLevel &&
              p.currentKi >= tf.requiredKi
          );
        if (bestForm && bestForm.id !== p.transformationId) {
          setPlayer((prev) =>
            prev
              ? {
                  ...prev,
                  transformationId: bestForm.id,
                  unlockedTransformations: prev.unlockedTransformations.includes(bestForm.id)
                    ? prev.unlockedTransformations
                    : [...prev.unlockedTransformations, bestForm.id],
                }
              : prev
          );
        }
      }

      // BOT Auto-Heal if HP < 45%
      if (botEnabled && autoHeal && p.currentHp < d.maxHp * 0.45) {
        const healSkill = COMBAT_SKILLS.find((s) => s.id === 'namek_regen');
        if (healSkill) castSkill(healSkill);
      }

      const pos = playerPosRef.current;
      const flyingNow = isFlyingRef.current;

      // If player targeted the active World Boss on this map, strike it
      const wb = worldBossRef.current;
      if (
        selectedWorldBossRef.current &&
        wb &&
        wb.status === 'active' &&
        wb.hp > 0 &&
        wb.mapId === p.currentMapId
      ) {
        const grid = getWorldMapGrid(wb.mapId);
        const wbDist = Math.hypot(grid.bossAltar.x + 2.5 - pos.x, grid.bossAltar.y + 1.5 - pos.y);
        if (wbDist <= (flyingNow ? 8.5 : 5.0)) {
          void handleAttackWorldBoss();
          return;
        }
      }

      const alive = monstersRef.current.filter((m) => m.hp > 0);
      if (alive.length === 0) return;

      let target = alive.find((m) => m.instanceId === selectedTargetIdRef.current) ?? null;
      if (!target && botEnabled) {
        alive.sort(
          (a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y)
        );
        target = alive[0];
        selectedTargetIdRef.current = target.instanceId;
        setSelectedTargetName(target.def.name);
      }
      if (!target) return;

      const dist = Math.hypot(target.x - pos.x, target.y - pos.y);

      // BOT Auto-Skill using player's configured rotation (up to 5 skills!)
      if (botEnabled && autoSkills) {
        const autoSkillMaxRange = flyingNow ? 11.5 : 6.0;
        for (const skillId of autoSkillIdsRef.current) {
          const s = COMBAT_SKILLS.find((item) => item.id === skillId);
          if (!s) continue;
          if (s.kind === 'heal' && p.currentHp >= d.maxHp * 0.8) continue;
          if (s.kind === 'buff' && p.currentKi >= d.maxKi * 0.75) continue;
          if (s.kind !== 'heal' && s.kind !== 'buff' && dist > autoSkillMaxRange) continue;
          if (
            p.level >= s.requiredLevel &&
            p.currentKi >= s.kiCost &&
            (skillCooldownsRef.current[s.id] ?? 0) <= Date.now()
          ) {
            if (castSkill(s)) return;
          }
        }
      }

      // Standard Basic Attack (extended aerial Ki blast range from Nuvem Voadora!)
      const basicRange = flyingNow ? 6.0 : 3.2;
      if (dist <= basicRange) {
        lastAttackAtRef.current = Date.now();
        const basicVfx: Omit<WorldProjectileVfx, 'id' | 'startedAt'> = {
          kind: 'projectile',
          fromX: pos.x,
          fromY: pos.y - (flyingNow ? 0.5 : 0),
          toX: target.x,
          toY: target.y,
          colorPrimary: p.transformationId === 'yamcha_ui' ? '#bae6fd' : '#f97316',
          colorSecondary: p.transformationId === 'yamcha_ui' ? '#ffffff' : '#fef08a',
          radiusTiles: 1,
          durationMs: 180,
        };
        projectilesRef.current.push({
          id: Date.now() + Math.random(),
          ...basicVfx,
          startedAt: Date.now(),
        });
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'skill:vfx', vfx: basicVfx }));
        }
        applyDamageToMonster(target, 1.0, false);
      }
    }, tickMs);

    return () => clearInterval(interval);
  }, [
    player?.uid,
    player?.activityMode,
    derived?.attacksPerSecond,
    botEnabled,
    autoSkills,
    autoHeal,
    autoTransform,
    castSkill,
    applyDamageToMonster,
    handleAttackWorldBoss,
    pushLog,
  ]);

  // Handlers
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Falha ao autenticar com Google.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateCharacter = async (name: string, race: RaceId) => {
    if (!user) return;
    const existingSnap = await getDoc(doc(db, 'players', user.uid));
    if (existingSnap.exists()) {
      setNeedsCreation(false);
      setLoadRetryKey((k) => k + 1);
      return;
    }
    const idToken = await user.getIdToken();
    const hbRes = await fetch('/api/afk/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });
    const hb = hbRes.ok
      ? ((await hbRes.json()) as { serverTimeMs: number; afkSessionToken: string })
      : { serverTimeMs: Date.now(), afkSessionToken: '' };

    const fresh = createInitialPlayerSave(user.uid, name, race, hb.serverTimeMs, hb.afkSessionToken);
    await setDoc(doc(db, 'players', user.uid), {
      ...buildSanitizedPlayerPayload(fresh),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((err) => handleFirestoreError(err, OperationType.CREATE, `players/${user.uid}`));

    const stats = computeDerivedStats(fresh);
    await setDoc(doc(db, 'publicProfiles', user.uid), {
      uid: user.uid,
      isPublic: true,
      name: fresh.name,
      race: fresh.race,
      title: fresh.title,
      level: fresh.level,
      powerLevel: stats.powerLevel,
      maxKi: Math.max(fresh.currentKi, stats.maxKi),
      monstersDefeated: 0,
      bossesDefeated: 0,
      trainingSeconds: 0,
      currentMapId: fresh.currentMapId,
      transformationId: fresh.transformationId,
      partyId: null,
      updatedAt: serverTimestamp(),
    }).catch((err) => handleFirestoreError(err, OperationType.CREATE, `publicProfiles/${user.uid}`));

    setNeedsCreation(false);
    initWorldForMap(fresh.currentMapId);
    setPlayer(fresh);
  };

  const handleSelectMap = (mapId: string) => {
    const map = getMapById(mapId);
    setPlayer((prev) => {
      if (!prev || prev.level < map.requiredLevel) return prev;
      return { ...prev, currentMapId: map.id, activityMode: 'combat' };
    });
    setSelectedWorldBoss(false);
    initWorldForMap(map.id);
    setActiveDrawer(null);
    setTimeout(() => syncPresenceNowRef.current?.(true), 60);
    pushLog(`Teleportado para Hunt: ${map.name}.`, 'normal');
  };

  const handleChallengeBoss = (targetMapId: string) => {
    if (!player) return;
    const map = getMapById(targetMapId);
    const boss = getBossForMap(map.id);
    if (player.level < boss.requiredLevel) return;
    if ((player.bossCooldowns[boss.id] ?? 0) > Date.now()) return;

    setPlayer((prev) => (prev ? { ...prev, currentMapId: map.id, activityMode: 'combat' } : prev));
    initWorldForMap(map.id, true);
    setActiveDrawer(null);
    pushLog(`CHEFE INVOCADO: ${boss.name} apareceu no altar!`, 'boss');
  };

  const handleSelectTransformation = (tfId: string) => {
    const tf = TRANSFORMATIONS.find((t) => t.id === tfId);
    if (!tf || !player || player.level < tf.requiredLevel || player.currentKi < tf.requiredKi) return;
    if (tf.secretOnly && !player.unlockedTransformations.includes(tf.id)) return;
    soundFx.playTransform();
    setPlayer((prev) => {
      if (!prev) return prev;
      const unlocked = prev.unlockedTransformations.includes(tf.id)
        ? prev.unlockedTransformations
        : [...prev.unlockedTransformations, tf.id];
      return { ...prev, transformationId: tf.id, unlockedTransformations: unlocked };
    });
    pushLog(`Transformação ativada: ${tf.name}!`, 'level');
  };

  const handleUpdateUiSettings = (next: GameUiSettings) => {
    setUiSettings(next);
    try {
      localStorage.setItem('idle_nameki_ui_settings', JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const handleUpdateGameConfig = async (next: GameGlobalConfig) => {
    if (!canEditGlobalConfig) {
      pushLog('Apenas ADMs autorizados podem alterar configurações globais.', 'normal');
      return;
    }
    try {
      await setDoc(doc(db, 'gameConfig', 'global'), {
        betaActive: Boolean(next.betaActive),
        adminNames: next.adminNames.slice(0, 20),
        adminUids: next.adminUids.slice(0, 20),
        creatorNames: next.creatorNames.slice(0, 50),
        updatedAt: serverTimestamp(),
      });
      pushLog('Configurações globais de Beta, ADMs e Criadores atualizadas.', 'level');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'gameConfig/global');
    }
  };

  const handleRedeemCode = (rawCode: string): { ok: boolean; message: string } => {
    const code = rawCode.trim().toUpperCase();
    const current = playerRef.current;
    if (!current) {
      return { ok: false, message: 'Carregue seu personagem primeiro.' };
    }

    if (code === 'JEFFGAMEMOD') {
      const existingCodes = current.redeemedCodes ?? [];
      const alreadyRedeemed =
        existingCodes.includes('JEFFGAMEMOD') &&
        current.unlockedTransformations.includes('yamcha_ui');

      const nextRedeemed = existingCodes.includes('JEFFGAMEMOD')
        ? existingCodes
        : [...existingCodes, 'JEFFGAMEMOD'];
      const nextTransforms = current.unlockedTransformations.includes('yamcha_ui')
        ? current.unlockedTransformations
        : [...current.unlockedTransformations, 'yamcha_ui'];
      const secretTitle = 'Lobo do Instinto Superior';
      const nextTitles = current.unlockedTitles.includes(secretTitle)
        ? current.unlockedTitles
        : [...current.unlockedTitles, secretTitle];

      const nextPlayer: PlayerSaveState = {
        ...current,
        redeemedCodes: nextRedeemed,
        unlockedTransformations: nextTransforms,
        transformationId: 'yamcha_ui',
        unlockedTitles: nextTitles,
        title: secretTitle,
      };

      setPlayer(nextPlayer);
      soundFx.playTransform();
      const pos = playerPosRef.current;
      projectilesRef.current.push({
        id: Date.now() + Math.random(),
        kind: 'aoe',
        fromX: pos.x,
        fromY: pos.y,
        toX: pos.x,
        toY: pos.y,
        colorPrimary: '#e0f2fe',
        colorSecondary: '#ffffff',
        radiusTiles: 4.5,
        startedAt: Date.now(),
        durationMs: 650,
      });
      addFloatingText(pos.x, pos.y - 0.5, 'YAMCHA INSTINTO SUPERIOR (30x)!', '#bae6fd', true);
      void syncToCloud(nextPlayer, true);

      if (alreadyRedeemed) {
        return {
          ok: true,
          message:
            'Código JEFFGAMEMOD já estava ativo! Yamcha Instinto Superior equipado com Poder x30.',
        };
      }

      pushLog(
        'CÓDIGO JEFFGAMEMOD ATIVADO! Yamcha Instinto Superior desbloqueado e Poder multiplicado em 30x!',
        'boss'
      );
      return {
        ok: true,
        message:
          'Sucesso! Modo Yamcha Instinto Superior desbloqueado e Poder multiplicado em 30x!',
      };
    }

    if (code === 'NMDLE') {
      const admAllowed = isPlayerAdmin(
        auth.currentUser?.email,
        auth.currentUser?.uid,
        current.name,
        gameConfigRef.current
      );
      if (!admAllowed) {
        return {
          ok: false,
          message: 'Código NMDLE exclusivo para ADMs autorizados.',
        };
      }

      const existingCodes = current.redeemedCodes ?? [];
      const alreadyRedeemed = existingCodes.includes('NMDLE');
      const nextRedeemed = alreadyRedeemed ? existingCodes : [...existingCodes, 'NMDLE'];
      const nextTitles = current.unlockedTitles.includes(SPECIAL_TITLES.ADM)
        ? current.unlockedTitles
        : [...current.unlockedTitles, SPECIAL_TITLES.ADM];

      const nextPlayer: PlayerSaveState = {
        ...current,
        redeemedCodes: nextRedeemed,
        unlockedTitles: nextTitles,
      };

      setPlayer(nextPlayer);
      soundFx.playLevelUp();
      const pos = playerPosRef.current;
      projectilesRef.current.push({
        id: Date.now() + Math.random(),
        kind: 'aoe',
        fromX: pos.x,
        fromY: pos.y,
        toX: pos.x,
        toY: pos.y,
        colorPrimary: '#facc15',
        colorSecondary: '#fef08a',
        radiusTiles: 4.0,
        startedAt: Date.now(),
        durationMs: 600,
      });
      addFloatingText(pos.x, pos.y - 0.5, 'NMDLE ATIVADO: 10x XP ADM!', '#fde047', true);
      void syncToCloud(nextPlayer, true);

      if (alreadyRedeemed) {
        return {
          ok: true,
          message: 'Código NMDLE já está ativo! Seu ganho de XP é 10x (ADM).',
        };
      }

      pushLog('CÓDIGO NMDLE ATIVADO! Bônus de 10x XP para ADM habilitado!', 'boss');
      return {
        ok: true,
        message: 'Sucesso! Código NMDLE ativado: você agora ganha 10x XP como ADM!',
      };
    }

    return {
      ok: false,
      message: 'Código inválido ou não reconhecido. Verifique e tente novamente.',
    };
  };

  const handleExportTransfer = async (): Promise<{ ok: boolean; code?: string; message: string }> => {
    const p = playerRef.current;
    if (!user || !p) {
      return { ok: false, message: 'Você precisa estar conectado em um personagem.' };
    }
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/account/export-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ playerState: p }),
      });
      const json = (await res.json()) as { transferCode?: string; error?: string };
      if (!res.ok || !json.transferCode) {
        return { ok: false, message: json.error ?? 'Erro ao gerar código de transferência.' };
      }
      return {
        ok: true,
        code: json.transferCode,
        message: 'Código gerado e copiado! Agora entre na nova conta, abra Configurações e cole o código.',
      };
    } catch {
      return { ok: false, message: 'Falha de conexão ao exportar conta.' };
    }
  };

  const handleImportTransfer = async (
    rawCode: string
  ): Promise<{ ok: boolean; message: string }> => {
    const cur = playerRef.current;
    if (!user || !cur) {
      return { ok: false, message: 'Você precisa estar conectado em um personagem.' };
    }
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/account/import-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ transferCode: rawCode.trim() }),
      });
      const json = (await res.json()) as {
        bundle?: Partial<PlayerSaveState> & { sourceName?: string; sourceUid?: string };
        error?: string;
      };
      if (!res.ok || !json.bundle) {
        return { ok: false, message: json.error ?? 'Código de transferência inválido.' };
      }
      const b = json.bundle;

      const mergedInvMap = new Map<string, InventoryItem>();
      for (const it of [...(b.inventory ?? []), ...cur.inventory]) {
        if (it && typeof it.uid === 'string' && !mergedInvMap.has(it.uid)) {
          mergedInvMap.set(it.uid, it);
        }
      }
      const nextEquipped: Record<EquipSlot, InventoryItem | null> = { ...cur.equipped };
      if (b.equipped) {
        (Object.keys(nextEquipped) as EquipSlot[]).forEach((slot) => {
          const incomingItem = b.equipped?.[slot];
          if (!incomingItem) return;
          const existingItem = nextEquipped[slot];
          if (!existingItem) {
            nextEquipped[slot] = incomingItem;
          } else {
            // Keep imported item equipped and keep current item in inventory
            if (!mergedInvMap.has(existingItem.uid)) {
              mergedInvMap.set(existingItem.uid, existingItem);
            }
            nextEquipped[slot] = incomingItem;
          }
        });
      }

      const mergeArr = <T,>(a: T[] | undefined, c: T[] | undefined, max: number) =>
        Array.from(new Set([...(a ?? []), ...(c ?? [])])).slice(0, max);

      const nextDivine: Record<string, number> = { ...(cur.divineUpgrades ?? {}) };
      if (b.divineUpgrades) {
        for (const [k, v] of Object.entries(b.divineUpgrades)) {
          nextDivine[k] = Math.max(nextDivine[k] ?? 0, Number(v) || 0);
        }
      }

      const nextKills: Record<string, number> = { ...(cur.stats.killsByMonsterId ?? {}) };
      if (b.stats?.killsByMonsterId) {
        for (const [k, v] of Object.entries(b.stats.killsByMonsterId)) {
          nextKills[k] = Math.max(nextKills[k] ?? 0, Number(v) || 0);
        }
      }

      const merged: PlayerSaveState = {
        ...cur,
        level: Math.max(cur.level, b.level ?? 1),
        xp: (b.level ?? 1) >= cur.level ? (b.xp ?? cur.xp) : cur.xp,
        zeni: cur.zeni + Math.max(0, b.zeni ?? 0),
        bonusStrength: Math.max(cur.bonusStrength, b.bonusStrength ?? 0),
        bonusDefense: Math.max(cur.bonusDefense, b.bonusDefense ?? 0),
        bonusSpeed: Math.max(cur.bonusSpeed, b.bonusSpeed ?? 0),
        bonusKi: Math.max(cur.bonusKi, b.bonusKi ?? 0),
        bonusStamina: Math.max(cur.bonusStamina, b.bonusStamina ?? 0),
        currentMapId: b.currentMapId ?? cur.currentMapId,
        transformationId: b.transformationId ?? cur.transformationId,
        unlockedTransformations: mergeArr(b.unlockedTransformations, cur.unlockedTransformations, 20),
        inventory: Array.from(mergedInvMap.values()).slice(0, 120),
        equipped: nextEquipped,
        claimedMissions: mergeArr(b.claimedMissions, cur.claimedMissions, 150),
        title: b.title ?? cur.title,
        unlockedTitles: mergeArr(b.unlockedTitles, cur.unlockedTitles, 60),
        redeemedCodes: mergeArr(b.redeemedCodes, cur.redeemedCodes, 20),
        dragonBalls: mergeArr(b.dragonBalls, cur.dragonBalls, 7),
        xpBuffUntilMs: Math.max(cur.xpBuffUntilMs ?? 0, b.xpBuffUntilMs ?? 0),
        kiFragments: (cur.kiFragments ?? 0) + Math.max(0, b.kiFragments ?? 0),
        unlockedPets: mergeArr(b.unlockedPets, cur.unlockedPets, 20),
        activePetId: b.activePetId ?? cur.activePetId ?? null,
        petXp: Math.max(cur.petXp ?? 0, b.petXp ?? 0),
        prestigeLevel: Math.max(cur.prestigeLevel ?? 0, b.prestigeLevel ?? 0),
        divinePoints: (cur.divinePoints ?? 0) + Math.max(0, b.divinePoints ?? 0),
        divineUpgrades: nextDivine,
        tournamentPoints: (cur.tournamentPoints ?? 0) + Math.max(0, b.tournamentPoints ?? 0),
        tournamentWins: Math.max(cur.tournamentWins ?? 0, b.tournamentWins ?? 0),
        stats: {
          monstersDefeated: Math.max(cur.stats.monstersDefeated, b.stats?.monstersDefeated ?? 0),
          bossesDefeated: Math.max(cur.stats.bossesDefeated, b.stats?.bossesDefeated ?? 0),
          totalDamageDealt: Math.max(cur.stats.totalDamageDealt, b.stats?.totalDamageDealt ?? 0),
          criticalHits: Math.max(cur.stats.criticalHits, b.stats?.criticalHits ?? 0),
          itemsFound: Math.max(cur.stats.itemsFound, b.stats?.itemsFound ?? 0),
          rareItemsFound: Math.max(cur.stats.rareItemsFound, b.stats?.rareItemsFound ?? 0),
          trainingSeconds: Math.max(cur.stats.trainingSeconds, b.stats?.trainingSeconds ?? 0),
          offlineSeconds: Math.max(cur.stats.offlineSeconds, b.stats?.offlineSeconds ?? 0),
          killsByMonsterId: nextKills,
        },
      };

      setPlayer(merged);
      initWorldForMap(merged.currentMapId);
      await syncToCloud(merged, true);
      soundFx.playLevelUp();
      pushLog(`Progresso transferido de ${b.sourceName ?? 'conta anterior'} com sucesso!`, 'boss');
      return {
        ok: true,
        message: `Tudo transferido de "${b.sourceName ?? 'conta antiga'}"! Nível ${merged.level}, itens, equipamentos e Zeni salvos na nuvem.`,
      };
    } catch {
      return { ok: false, message: 'Erro ao importar código de transferência.' };
    }
  };

  const handleSendEmote = (text: string) => {
    if (!player) return;
    const now = Date.now();
    emotesRef.current = [
      ...emotesRef.current.filter((e) => e.uid !== player.uid && now - e.startedAt < 3500),
      { uid: player.uid, text, startedAt: now },
    ];
    lastEmoteSentRef.current = {
      text: text.slice(0, 48),
      atMs: now + serverClockOffsetRef.current,
    };
    syncPresenceNowRef.current?.(true);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'player:emote', text }));
    }
  };

  const handleLocatePlayer = (target: OnlinePlayer) => {
    if (!player) return;
    if (target.currentMapId !== player.currentMapId) {
      const targetMap = getMapById(target.currentMapId);
      if (player.level < targetMap.requiredLevel) {
        pushLog(
          `${target.name} está em ${targetMap.name} (requer Lv.${targetMap.requiredLevel}).`,
          'normal'
        );
        return;
      }
      handleSelectMap(target.currentMapId);
      setHighlightedPlayerUid(target.uid);
      return;
    }

    setHighlightedPlayerUid(target.uid);
    if (typeof target.x === 'number' && typeof target.y === 'number') {
      clickTargetRef.current = { x: target.x, y: target.y };
      pushLog(`Caminhando até ${target.name} no mapa.`, 'normal');
    }
  };

  const handleGoToPlayerMap = (targetMapId: string) => {
    if (!player) return;
    const targetMap = getMapById(targetMapId);
    if (player.level < targetMap.requiredLevel) {
      pushLog(`Mapa ${targetMap.name} requer Nível ${targetMap.requiredLevel}.`, 'normal');
      return;
    }
    handleSelectMap(targetMapId);
  };

  const handleEquipItem = (itemUid: string) => {
    setPlayer((prev) => {
      if (!prev) return prev;
      const idx = prev.inventory.findIndex((i) => i.uid === itemUid);
      if (idx < 0) return prev;
      const item = prev.inventory[idx];
      if (item.category === 'special' || prev.level < item.requiredLevel) return prev;
      const slot = item.category as EquipSlot;
      const previouslyEquipped = prev.equipped[slot];
      const nextInv = [...prev.inventory];
      nextInv.splice(idx, 1);
      if (previouslyEquipped) nextInv.unshift(previouslyEquipped);
      return { ...prev, inventory: nextInv, equipped: { ...prev.equipped, [slot]: item } };
    });
  };

  const handleUnequipSlot = (slot: EquipSlot) => {
    setPlayer((prev) => {
      if (!prev) return prev;
      const item = prev.equipped[slot];
      if (!item) return prev;
      return {
        ...prev,
        equipped: { ...prev.equipped, [slot]: null },
        inventory: addItemToInventory(prev.inventory, item),
      };
    });
  };

  const handleUseSpecialItem = (itemUid: string) => {
    setPlayer((prev) => {
      if (!prev) return prev;
      const idx = prev.inventory.findIndex((i) => i.uid === itemUid);
      if (idx < 0) return prev;
      const item = prev.inventory[idx];
      if (item.category !== 'special') return prev;
      const nextInv = [...prev.inventory];
      if (item.quantity > 1) nextInv[idx] = { ...item, quantity: item.quantity - 1 };
      else nextInv.splice(idx, 1);

      const d = computeDerivedStats(prev);
      if (item.templateId === 'semente_deuses') {
        soundFx.playTransform();
        return { ...prev, inventory: nextInv, currentHp: d.maxHp, currentKi: prev.currentKi + 250 };
      }
      soundFx.playLevelUp();
      return applyXpAndLevelUps({ ...prev, inventory: nextInv, currentKi: prev.currentKi + 400 }, 1200)
        .nextPlayer;
    });
  };

  const handleSellItem = (itemUid: string) => {
    setPlayer((prev) => {
      if (!prev) return prev;
      const idx = prev.inventory.findIndex((i) => i.uid === itemUid);
      if (idx < 0) return prev;
      const item = prev.inventory[idx];
      const nextInv = [...prev.inventory];
      if (item.quantity > 1) nextInv[idx] = { ...item, quantity: item.quantity - 1 };
      else nextInv.splice(idx, 1);
      return { ...prev, zeni: prev.zeni + item.sellValue, inventory: nextInv };
    });
  };

  const handleBulkSell = () => {
    setPlayer((prev) => {
      if (!prev) return prev;
      let earned = 0;
      const kept = prev.inventory.filter((item) => {
        if (item.category !== 'special' && (item.rarity === 'Common' || item.rarity === 'Uncommon')) {
          earned += item.sellValue * item.quantity;
          return false;
        }
        return true;
      });
      if (earned === 0) return prev;
      return { ...prev, zeni: prev.zeni + earned, inventory: kept };
    });
  };

  const handleStartTraining = (stat: TrainingStat) => {
    setPlayer((prev) => (prev ? { ...prev, activityMode: 'training', trainingStat: stat } : prev));
    setActiveDrawer(null);
  };

  const handleClaimMission = (missionId: string) => {
    const mission = MISSIONS.find((m) => m.id === missionId);
    if (!mission) return;
    setPlayer((prev) => {
      if (!prev || prev.claimedMissions.includes(mission.id)) return prev;
      if (getMissionProgressValue(prev, mission) < mission.target) return prev;

      let nextInv = prev.inventory;
      let rareInc = 0;
      if (mission.rewards.itemTemplateId) {
        const rewardItem = createItemInstance(
          mission.rewards.itemTemplateId,
          mission.rewards.itemRarity ?? 'Rare',
          prev.level
        );
        nextInv = addItemToInventory(nextInv, rewardItem);
        if (isRareOrHigher(rewardItem.rarity)) rareInc = 1;
      }

      const unlockedTitles =
        mission.rewards.title && !prev.unlockedTitles.includes(mission.rewards.title)
          ? [...prev.unlockedTitles, mission.rewards.title]
          : prev.unlockedTitles;

      const updated: PlayerSaveState = {
        ...prev,
        zeni: prev.zeni + mission.rewards.zeni,
        inventory: nextInv,
        claimedMissions: [...prev.claimedMissions, mission.id],
        unlockedTitles,
        stats: { ...prev.stats, rareItemsFound: prev.stats.rareItemsFound + rareInc },
      };
      soundFx.playLevelUp();
      return applyXpAndLevelUps(updated, mission.rewards.xp).nextPlayer;
    });
  };

  const handleSendChat = async (text: string) => {
    if (!user || !player) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat:send', text }));
    }
    const msgId = `msg_${user.uid}_${Date.now().toString(36)}`;
    await setDoc(doc(db, 'chatMessages', msgId), {
      uid: user.uid,
      senderName: player.name,
      senderTitle: player.title,
      senderLevel: player.level,
      channel: 'global',
      text: text.slice(0, 240),
      createdAt: serverTimestamp(),
    }).catch((err) => handleFirestoreError(err, OperationType.CREATE, `chatMessages/${msgId}`));
  };

  const handleCreateParty = async (partyName: string) => {
    if (!user || !player || !derived) return;
    const partyId = `pty_${user.uid}_${Date.now().toString(36)}`;
    await setDoc(doc(db, 'parties', partyId), {
      id: partyId,
      name: partyName.slice(0, 32),
      leaderUid: user.uid,
      leaderName: player.name,
      mapId: player.currentMapId,
      isOpen: true,
      memberCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((err) => handleFirestoreError(err, OperationType.CREATE, `parties/${partyId}`));

    await setDoc(doc(db, `parties/${partyId}/members`, user.uid), {
      uid: user.uid,
      name: player.name,
      level: player.level,
      powerLevel: derived.powerLevel,
      transformationId: player.transformationId,
      joinedAt: serverTimestamp(),
    }).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `parties/${partyId}/members/${user.uid}`)
    );

    const updated = { ...player, partyId };
    setPlayer(updated);
    void syncToCloud(updated, false);
  };

  const handleJoinParty = async (partyId: string) => {
    if (!user || !player || !derived || player.partyId) return;
    const party = parties.find((p) => p.id === partyId);
    if (!party || party.memberCount >= 4) return;

    await setDoc(doc(db, `parties/${partyId}/members`, user.uid), {
      uid: user.uid,
      name: player.name,
      level: player.level,
      powerLevel: derived.powerLevel,
      transformationId: player.transformationId,
      joinedAt: serverTimestamp(),
    }).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `parties/${partyId}/members/${user.uid}`)
    );

    await updateDoc(doc(db, 'parties', partyId), {
      memberCount: party.memberCount + 1,
      updatedAt: serverTimestamp(),
    }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `parties/${partyId}`));

    const updated = { ...player, partyId };
    setPlayer(updated);
    void syncToCloud(updated, false);
  };

  const handleLeaveParty = async () => {
    if (!user || !player?.partyId) return;
    const partyId = player.partyId;
    const party = parties.find((p) => p.id === partyId);

    await deleteDoc(doc(db, `parties/${partyId}/members`, user.uid)).catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, `parties/${partyId}/members/${user.uid}`)
    );

    if (party) {
      if (party.leaderUid === user.uid || party.memberCount <= 1) {
        await deleteDoc(doc(db, 'parties', partyId)).catch(() => {});
      } else {
        await updateDoc(doc(db, 'parties', partyId), {
          memberCount: Math.max(1, party.memberCount - 1),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    }

    const updated = { ...player, partyId: null };
    setPlayer(updated);
    void syncToCloud(updated, false);
  };

  // ============================================================================
  // 10 NEW SYSTEMS HANDLERS (NPCs, Forge, Market, Dragon Balls, Pets, Arena, Prestige, Guilds, Fusion)
  // ============================================================================
  const handleInteractNpc = useCallback(
    (kind: WorldNpcPlacement['kind']) => {
      switch (kind) {
        case 'kame':
          setActiveDrawer('training');
          pushLog('Mestre Kame: Hora de treinar seu Ki e atributos!', 'normal');
          break;
        case 'forja':
          setActiveDrawer('forge');
          pushLog('Dr. Brief: Bem-vindo à Forja Galáctica (+15)!', 'normal');
          break;
        case 'shenlong':
          setActiveDrawer('dragon_balls');
          pushLog('Altar de Shenlong: Verifique suas Esferas do Dragão!', 'normal');
          break;
        case 'mercado':
          setActiveDrawer('market');
          pushLog('Mercador Galáctico: Veja ofertas ou anuncie equipamentos!', 'normal');
          break;
        case 'torneio':
          setActiveDrawer('tournament');
          pushLog('Locutor Tenkaichi: Desafie guerreiros na Arena PvP!', 'normal');
          break;
      }
    },
    [pushLog]
  );

  const handleUpgradeItem = (
    target: { kind: 'equipped'; slot: EquipSlot } | { kind: 'inventory'; uid: string }
  ) => {
    setPlayer((prev) => {
      if (!prev) return prev;
      let item: InventoryItem | null = null;
      if (target.kind === 'equipped') {
        item = prev.equipped[target.slot];
      } else {
        item = prev.inventory.find((i) => i.uid === target.uid) ?? null;
      }
      if (!item || item.category === 'special') return prev;
      const curUpg = item.upgradeLevel ?? 0;
      if (curUpg >= MAX_FORGE_LEVEL) return prev;

      const cost = getUpgradeCost(item);
      if (prev.zeni < cost.zeni || (prev.kiFragments ?? 0) < cost.fragments) return prev;

      const succeeded = Math.random() * 100 <= cost.successChance;
      const nextItem: InventoryItem = succeeded ? { ...item, upgradeLevel: curUpg + 1 } : item;

      if (succeeded) {
        soundFx.playLevelUp();
        pushLog(`Forja bem-sucedida! ${item.name} agora é +${curUpg + 1}!`, 'level');
      } else {
        soundFx.playHit();
        pushLog(`A forja de ${item.name} falhou (o item não foi perdido).`, 'normal');
      }

      if (target.kind === 'equipped') {
        return {
          ...prev,
          zeni: prev.zeni - cost.zeni,
          kiFragments: (prev.kiFragments ?? 0) - cost.fragments,
          equipped: { ...prev.equipped, [target.slot]: nextItem },
        };
      }
      return {
        ...prev,
        zeni: prev.zeni - cost.zeni,
        kiFragments: (prev.kiFragments ?? 0) - cost.fragments,
        inventory: prev.inventory.map((i) => (i.uid === item!.uid ? nextItem : i)),
      };
    });
  };

  const handleSalvageItem = (itemUid: string) => {
    setPlayer((prev) => {
      if (!prev) return prev;
      const idx = prev.inventory.findIndex((i) => i.uid === itemUid);
      if (idx < 0) return prev;
      const item = prev.inventory[idx];
      if (item.category === 'special') return prev;
      const frags = getSalvageFragments(item) * item.quantity;
      const nextInv = [...prev.inventory];
      nextInv.splice(idx, 1);
      soundFx.playHit();
      pushLog(`Reciclado: ${item.name} (+${frags} Fragmentos de Ki).`, 'drop');
      return {
        ...prev,
        kiFragments: (prev.kiFragments ?? 0) + frags,
        inventory: nextInv,
      };
    });
  };

  const handleBulkSalvageCommonUncommon = () => {
    setPlayer((prev) => {
      if (!prev) return prev;
      let gained = 0;
      const kept = prev.inventory.filter((item) => {
        if (item.category !== 'special' && (item.rarity === 'Common' || item.rarity === 'Uncommon')) {
          gained += getSalvageFragments(item) * item.quantity;
          return false;
        }
        return true;
      });
      if (gained === 0) return prev;
      soundFx.playHit();
      pushLog(`Reciclagem em massa concluída: +${gained} Fragmentos de Ki!`, 'drop');
      return {
        ...prev,
        kiFragments: (prev.kiFragments ?? 0) + gained,
        inventory: kept,
      };
    });
  };

  const handleFuseRarity = (itemUids: string[]) => {
    if (itemUids.length !== 3) return;
    const nextMap: Partial<Record<Rarity, Rarity>> = {
      Common: 'Uncommon',
      Uncommon: 'Rare',
      Rare: 'Epic',
      Epic: 'Legendary',
      Legendary: 'Mythical',
    };
    setPlayer((prev) => {
      if (!prev) return prev;
      const picked = itemUids
        .map((id) => prev.inventory.find((i) => i.uid === id))
        .filter((x): x is InventoryItem => Boolean(x));
      if (picked.length !== 3) return prev;
      const baseRarity = picked[0].rarity;
      if (!picked.every((p) => p.rarity === baseRarity && p.category !== 'special')) return prev;
      const nextRarity = nextMap[baseRarity];
      if (!nextRarity) return prev;

      const tpl = ITEM_TEMPLATES[Math.floor(Math.random() * ITEM_TEMPLATES.length)];
      const fusedItem = createItemInstance(tpl.id, nextRarity, prev.level, '_fus');
      const remainingInv = prev.inventory.filter((i) => !itemUids.includes(i.uid));
      soundFx.playRareDrop();
      pushLog(
        `Fusão de Raridade! 3x ${RARITY_CONFIG[baseRarity].label} → ${fusedItem.name} (${RARITY_CONFIG[nextRarity].label})!`,
        'boss'
      );
      return {
        ...prev,
        inventory: addItemToInventory(remainingInv, fusedItem),
        stats: {
          ...prev.stats,
          itemsFound: prev.stats.itemsFound + 1,
          rareItemsFound: prev.stats.rareItemsFound + (isRareOrHigher(nextRarity) ? 1 : 0),
        },
      };
    });
  };

  const handleCreateListing = async (itemUid: string, price: number) => {
    if (!user || !player) return;
    const cleanPrice = Math.max(1, Math.min(999_999_999, Math.floor(price)));
    const targetItem = player.inventory.find((i) => i.uid === itemUid && i.category !== 'special');
    if (!targetItem) return;

    const listingId = `mkt_${user.uid}_${Date.now().toString(36)}`;
    try {
      await setDoc(doc(db, 'marketListings', listingId), {
        id: listingId,
        sellerUid: user.uid,
        sellerName: player.name.slice(0, 24),
        item: targetItem,
        price: cleanPrice,
        status: 'open',
        buyerUid: null,
        createdAt: serverTimestamp(),
        soldAt: null,
      });
      const nextState: PlayerSaveState = {
        ...player,
        inventory: player.inventory.filter((i) => i.uid !== itemUid),
      };
      setPlayer(nextState);
      void syncToCloud(nextState, false);
      pushLog(`Anunciado no Mercado: ${targetItem.name} por ${formatNumber(cleanPrice)} Zeni.`, 'normal');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `marketListings/${listingId}`);
    }
  };

  const handleBuyListing = async (listing: MarketListing) => {
    if (!user || !player) return;
    if (listing.sellerUid === user.uid || listing.status !== 'open') return;
    if (player.zeni < listing.price) return;

    try {
      await updateDoc(doc(db, 'marketListings', listing.id), {
        status: 'sold',
        buyerUid: user.uid,
        soldAt: serverTimestamp(),
      });
      const nextState: PlayerSaveState = {
        ...player,
        zeni: player.zeni - listing.price,
        inventory: addItemToInventory(player.inventory, listing.item),
      };
      setPlayer(nextState);
      void syncToCloud(nextState, false);
      soundFx.playRareDrop();
      pushLog(`Compra no Mercado: ${listing.item.name} por ${formatNumber(listing.price)} Zeni!`, 'drop');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `marketListings/${listing.id}`);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    if (!user || !player) return;
    const target = myMarketListings.find((l) => l.id === listingId && l.status === 'open');
    if (!target) return;
    try {
      await deleteDoc(doc(db, 'marketListings', listingId));
      const nextState: PlayerSaveState = {
        ...player,
        inventory: addItemToInventory(player.inventory, target.item),
      };
      setPlayer(nextState);
      void syncToCloud(nextState, false);
      pushLog(`Anúncio cancelado: ${target.item.name} devolvido à mochila.`, 'normal');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `marketListings/${listingId}`);
    }
  };

  const handleClaimSoldListing = async (listing: MarketListing) => {
    if (!user || !player || listing.status !== 'sold') return;
    try {
      await deleteDoc(doc(db, 'marketListings', listing.id));
      const nextState: PlayerSaveState = {
        ...player,
        zeni: player.zeni + listing.price,
      };
      setPlayer(nextState);
      void syncToCloud(nextState, false);
      soundFx.playLevelUp();
      pushLog(`Venda resgatada: +${formatNumber(listing.price)} Zeni de ${listing.item.name}!`, 'level');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `marketListings/${listing.id}`);
    }
  };

  const handleSummonShenlong = (wishId: string) => {
    setPlayer((prev) => {
      if (!prev) return prev;
      const owned = new Set(prev.dragonBalls ?? []);
      if (![1, 2, 3, 4, 5, 6, 7].every((s) => owned.has(s))) return prev;

      soundFx.playLevelUp();
      let updated: PlayerSaveState = { ...prev, dragonBalls: [] };

      if (wishId === 'zeni') {
        const zeniGain = Math.max(50000, prev.level * 2500);
        updated = {
          ...updated,
          zeni: prev.zeni + zeniGain,
          kiFragments: (prev.kiFragments ?? 0) + 30,
        };
        pushLog(`SHENLONG: Riqueza Suprema concedida (+${formatNumber(zeniGain)} Zeni e +30 Frag)!`, 'boss');
      } else if (wishId === 'mythic_gear') {
        const gearPool = ITEM_TEMPLATES.filter((t) => t.category !== 'special');
        const tpl = gearPool[Math.floor(Math.random() * gearPool.length)];
        const mythic = createItemInstance(tpl.id, 'Mythical', prev.level, '_shen');
        updated = {
          ...updated,
          inventory: addItemToInventory(prev.inventory, mythic),
          stats: {
            ...prev.stats,
            itemsFound: prev.stats.itemsFound + 1,
            rareItemsFound: prev.stats.rareItemsFound + 1,
          },
        };
        pushLog(`SHENLONG: Relíquia Mítica concedida (${mythic.name})!`, 'boss');
      } else if (wishId === 'xp_buff') {
        updated = {
          ...updated,
          xpBuffUntilMs: Date.now() + 30 * 60 * 1000,
        };
        pushLog('SHENLONG: Iluminação de 2x XP Global ativada por 30 minutos!', 'boss');
      } else if (wishId === 'eternal_power') {
        const title = 'Escolhido de Shenlong';
        const titles = prev.unlockedTitles.includes(title)
          ? prev.unlockedTitles
          : [...prev.unlockedTitles, title];
        updated = {
          ...updated,
          bonusStrength: prev.bonusStrength + 150,
          bonusDefense: prev.bonusDefense + 150,
          bonusKi: prev.bonusKi + 150,
          unlockedTitles: titles,
          title,
        };
        pushLog('SHENLONG: +150 Força/Defesa/Ki permanentes + título "Escolhido de Shenlong"!', 'boss');
      }

      void syncToCloud(updated, true);
      return updated;
    });
  };

  const handleUnlockPet = (petId: string) => {
    const pet = getPetById(petId);
    if (!pet) return;
    setPlayer((prev) => {
      if (!prev) return prev;
      if ((prev.unlockedPets ?? []).includes(pet.id)) return prev;
      if (prev.level < pet.requiredLevel || prev.zeni < pet.unlockCostZeni) return prev;
      soundFx.playLevelUp();
      pushLog(`Mascote desbloqueado e equipado: ${pet.name}!`, 'level');
      return {
        ...prev,
        zeni: prev.zeni - pet.unlockCostZeni,
        unlockedPets: [...(prev.unlockedPets ?? []), pet.id],
        activePetId: pet.id,
      };
    });
  };

  const handleEquipPet = (petId: string | null) => {
    setPlayer((prev) => {
      if (!prev) return prev;
      if (petId !== null && !(prev.unlockedPets ?? []).includes(petId)) return prev;
      return { ...prev, activePetId: petId };
    });
  };

  const handleFightTournamentOpponent = (opp: {
    name: string;
    level: number;
    powerLevel: number;
    race: string;
    transformationId: string;
  }) => {
    const p = playerRef.current;
    const myPl = derived?.powerLevel ?? 100;
    const ratio = myPl / Math.max(1, opp.powerLevel);
    const winProb = Math.max(0.15, Math.min(0.92, 0.5 + (ratio - 1) * 0.45));
    const won = Math.random() < winProb;

    const pointsEarned = won ? 18 + Math.floor(Math.random() * 8) : 5;
    const zeniEarned = won ? Math.max(250, (p?.level ?? 1) * 140) : Math.max(80, (p?.level ?? 1) * 35);

    setPlayer((prev) => {
      if (!prev) return prev;
      const nextWins = (prev.tournamentWins ?? 0) + (won ? 1 : 0);
      const champTitle = 'Campeão Mundial';
      const unlockedTitles =
        nextWins >= 5 && !prev.unlockedTitles.includes(champTitle)
          ? [...prev.unlockedTitles, champTitle]
          : prev.unlockedTitles;
      return {
        ...prev,
        zeni: prev.zeni + zeniEarned,
        tournamentPoints: (prev.tournamentPoints ?? 0) + pointsEarned,
        tournamentWins: nextWins,
        unlockedTitles,
      };
    });

    if (won) soundFx.playLevelUp();
    else soundFx.playHit();

    const summary = won
      ? `Você superou ${opp.name} (PL ${formatNumber(opp.powerLevel)}) no ringue do Tenkaichi!`
      : `${opp.name} (PL ${formatNumber(opp.powerLevel)}) resistiu ao seu ataque final. Continue treinando!`;
    pushLog(`Torneio: ${won ? 'Vitória' : 'Derrota'} contra ${opp.name} (+${pointsEarned} Pts).`, won ? 'level' : 'normal');
    return { won, pointsEarned, zeniEarned, summary };
  };

  const handleBuyTournamentReward = (itemId: string) => {
    const shopItem = TOURNAMENT_SHOP_ITEMS.find((i) => i.id === itemId);
    if (!shopItem) return;
    setPlayer((prev) => {
      if (!prev || (prev.tournamentPoints ?? 0) < shopItem.costPoints) return prev;
      let nextInv = prev.inventory;
      let nextFrags = prev.kiFragments ?? 0;
      if (shopItem.kind === 'fragments' && shopItem.fragmentsAmount) {
        nextFrags += shopItem.fragmentsAmount;
      } else if (shopItem.kind === 'item' && shopItem.templateId) {
        const inst = createItemInstance(
          shopItem.templateId,
          shopItem.rarity ?? 'Rare',
          prev.level,
          '_tourn'
        );
        nextInv = addItemToInventory(nextInv, inst);
      }
      soundFx.playRareDrop();
      pushLog(`Loja do Torneio: Adquirido ${shopItem.name}!`, 'drop');
      return {
        ...prev,
        tournamentPoints: (prev.tournamentPoints ?? 0) - shopItem.costPoints,
        kiFragments: nextFrags,
        inventory: nextInv,
      };
    });
  };

  const handlePerformPrestige = () => {
    setPlayer((prev) => {
      if (!prev || prev.level < PRESTIGE_MIN_LEVEL) return prev;
      const earnedPoints = Math.max(1, Math.floor((prev.level - PRESTIGE_MIN_LEVEL) / 10) + 2);
      const nextPrestige = (prev.prestigeLevel ?? 0) + 1;
      const resetState: PlayerSaveState = {
        ...prev,
        level: 1,
        xp: 0,
        bonusStrength: 0,
        bonusDefense: 0,
        bonusSpeed: 0,
        bonusKi: 0,
        bonusStamina: 0,
        currentMapId: 'terra',
        transformationId: 'base',
        prestigeLevel: nextPrestige,
        divinePoints: (prev.divinePoints ?? 0) + earnedPoints,
      };
      const nextDerived = computeDerivedStats(resetState, partyCountRef.current, guildLevelRef.current);
      resetState.currentHp = nextDerived.maxHp;
      resetState.currentKi = Math.max(120, nextDerived.maxKi);
      initWorldForMap('terra');
      soundFx.playLevelUp();
      pushLog(
        `PRESTIGE ${nextPrestige}! Você renasceu com +${earnedPoints} Pontos Divinos!`,
        'boss'
      );
      void syncToCloud(resetState, true);
      return resetState;
    });
  };

  const handleBuyDivineUpgrade = (upgradeId: string) => {
    const def = DIVINE_UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return;
    setPlayer((prev) => {
      if (!prev) return prev;
      const curLvl = prev.divineUpgrades?.[def.id] ?? 0;
      if (curLvl >= def.maxLevel) return prev;
      const cost = def.costPerLevel + curLvl;
      if ((prev.divinePoints ?? 0) < cost) return prev;
      soundFx.playLevelUp();
      pushLog(`Despertar Divino: ${def.name} Nv.${curLvl + 1}!`, 'level');
      return {
        ...prev,
        divinePoints: (prev.divinePoints ?? 0) - cost,
        divineUpgrades: {
          ...(prev.divineUpgrades ?? {}),
          [def.id]: curLvl + 1,
        },
      };
    });
  };

  const handleFuseWithAlly = (ally: { name: string; powerLevel: number }) => {
    setPlayer((prev) => {
      if (!prev) return prev;
      const bonus = Math.max(500, Math.floor(ally.powerLevel * 0.65));
      const next: PlayerSaveState = {
        ...prev,
        fusionUntilMs: Date.now() + 5 * 60 * 1000,
        fusionPartnerName: ally.name.slice(0, 24),
        fusionBonusPower: bonus,
      };
      soundFx.playTransform();
      const pos = playerPosRef.current;
      projectilesRef.current.push({
        id: Date.now() + Math.random(),
        kind: 'aoe',
        fromX: pos.x,
        fromY: pos.y,
        toX: pos.x,
        toY: pos.y,
        colorPrimary: '#facc15',
        colorSecondary: '#38bdf8',
        radiusTiles: 4,
        durationMs: 600,
        startedAt: performance.now(),
      });
      addFloatingText(pos.x, pos.y - 0.5, `FUSÃO METAMORU c/ ${ally.name}!`, '#facc15', true);
      pushLog(`FUSÃO METAMORU ATIVA por 5 min com ${ally.name} (+${formatNumber(bonus)} PL)!`, 'boss');
      void syncToCloud(next, false);
      setTimeout(() => syncPresenceNowRef.current?.(true), 60);
      return next;
    });
  };

  const handleCreateGuild = async (name: string, tag: string, description: string) => {
    if (!user || !player || !derived || player.guildId) return;
    const cleanName = name.trim().slice(0, 28);
    const cleanTag = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    const cleanDesc = description.trim().slice(0, 120) || 'Guerreiros Unidos';
    if (cleanName.length < 2 || cleanTag.length < 2) return;

    const guildId = `gld_${user.uid}_${Date.now().toString(36)}`;
    try {
      await setDoc(doc(db, 'guilds', guildId), {
        id: guildId,
        name: cleanName,
        tag: cleanTag,
        leaderUid: user.uid,
        leaderName: player.name.slice(0, 24),
        description: cleanDesc,
        level: 1,
        treasuryZeni: 0,
        isOpen: true,
        memberCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, `guilds/${guildId}/members`, user.uid), {
        uid: user.uid,
        name: player.name.slice(0, 24),
        level: player.level,
        powerLevel: derived.powerLevel,
        donatedZeni: 0,
        joinedAt: serverTimestamp(),
      });
      const updated: PlayerSaveState = { ...player, guildId, guildTag: cleanTag };
      setPlayer(updated);
      void syncToCloud(updated, false);
      pushLog(`Guilda [${cleanTag}] ${cleanName} fundada com sucesso!`, 'level');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `guilds/${guildId}`);
    }
  };

  const handleJoinGuild = async (guildId: string) => {
    if (!user || !player || !derived || player.guildId) return;
    const g = guilds.find((item) => item.id === guildId);
    if (!g || g.memberCount >= 30) return;
    try {
      await setDoc(doc(db, `guilds/${guildId}/members`, user.uid), {
        uid: user.uid,
        name: player.name.slice(0, 24),
        level: player.level,
        powerLevel: derived.powerLevel,
        donatedZeni: 0,
        joinedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'guilds', guildId), {
        memberCount: Math.min(30, g.memberCount + 1),
        updatedAt: serverTimestamp(),
      });
      const updated: PlayerSaveState = { ...player, guildId, guildTag: g.tag };
      setPlayer(updated);
      void syncToCloud(updated, false);
      pushLog(`Você entrou para a Guilda [${g.tag}] ${g.name}!`, 'level');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `guilds/${guildId}`);
    }
  };

  const handleLeaveGuild = async () => {
    if (!user || !player?.guildId) return;
    const gId = player.guildId;
    const g = currentGuild;
    try {
      await deleteDoc(doc(db, `guilds/${gId}/members`, user.uid));
      if (g) {
        if (g.leaderUid === user.uid || g.memberCount <= 1) {
          await deleteDoc(doc(db, 'guilds', gId)).catch(() => {});
        } else {
          await updateDoc(doc(db, 'guilds', gId), {
            memberCount: Math.max(1, g.memberCount - 1),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
      const updated: PlayerSaveState = { ...player, guildId: null, guildTag: null };
      setPlayer(updated);
      void syncToCloud(updated, false);
      pushLog('Você saiu da Guilda.', 'normal');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `guilds/${gId}/members/${user.uid}`);
    }
  };

  const handleDonateGuildZeni = async (amount: number) => {
    if (!user || !player?.guildId || !currentGuild || !derived) return;
    const cleanAmt = Math.max(100, Math.floor(amount));
    if (player.zeni < cleanAmt) return;

    const gId = player.guildId;
    const newTreasury = currentGuild.treasuryZeni + cleanAmt;
    const newLevel = Math.min(50, Math.floor(newTreasury / 15000) + 1);
    const myMember = guildMembers.find((m) => m.uid === user.uid);
    const newDonated = (myMember?.donatedZeni ?? 0) + cleanAmt;

    try {
      await updateDoc(doc(db, 'guilds', gId), {
        treasuryZeni: newTreasury,
        level: Math.max(currentGuild.level, newLevel),
        memberCount: currentGuild.memberCount,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, `guilds/${gId}/members`, user.uid), {
        name: player.name.slice(0, 24),
        level: player.level,
        powerLevel: derived.powerLevel,
        donatedZeni: newDonated,
      });
      const updated: PlayerSaveState = { ...player, zeni: player.zeni - cleanAmt };
      setPlayer(updated);
      void syncToCloud(updated, false);
      soundFx.playLevelUp();
      pushLog(`Doado ${formatNumber(cleanAmt)} Zeni para o cofre da Guilda [${currentGuild.tag}]!`, 'level');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `guilds/${gId}`);
    }
  };

  const handleSendGuildChat = async (text: string) => {
    if (!user || !player?.guildId || !text.trim()) return;
    const gId = player.guildId;
    const msgId = `gmsg_${user.uid}_${Date.now().toString(36)}`;
    try {
      await setDoc(doc(db, `guilds/${gId}/chat`, msgId), {
        uid: user.uid,
        senderName: player.name.slice(0, 24),
        text: text.trim().slice(0, 240),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `guilds/${gId}/chat/${msgId}`);
    }
  };

  if (!authReady || loadingSave) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-slate-200 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-16 h-16 rounded-xl overflow-hidden border border-orange-500/40">
          <img
            src="/src/assets/images/hero_namek_emblem_1794876902101.jpg"
            alt="Idle Nameki"
            className="w-full h-full object-cover pixelated"
          />
        </div>
        <p className="font-pixel text-sm text-orange-400">Carregando Mundo 2D...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthAndCreation
        mode="auth"
        authLoading={authLoading}
        authError={authError}
        onGoogleLogin={handleGoogleLogin}
        onCreateCharacter={handleCreateCharacter}
      />
    );
  }

  if (needsCreation) {
    return (
      <AuthAndCreation
        mode="create"
        authLoading={authLoading}
        authError={authError}
        onGoogleLogin={handleGoogleLogin}
        onCreateCharacter={handleCreateCharacter}
        onSignOut={() => void signOut(auth)}
        userEmail={user.email}
      />
    );
  }

  if (!player || !derived) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-[#131A26] p-6 space-y-4 shadow-2xl">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
              Sessão Conectada · {user.email ?? user.uid}
            </p>
            <h1 className="font-pixel text-base text-orange-400">Reconectar Guerreiro</h1>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Não foi possível concluir o carregamento automático do seu personagem agora. Seu progresso
            continua salvo na nuvem — clique abaixo para reconectar ou trocar de conta Google.
          </p>
          {authError && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-[11px] text-red-300 break-words max-h-32 overflow-y-auto">
              {authError}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setLoadRetryKey((k) => k + 1)}
              className="flex-1 py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs cursor-pointer"
            >
              Reconectar Minha Conta
            </button>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="py-2.5 px-4 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-200 text-xs cursor-pointer"
            >
              Trocar Conta Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  const xpNeeded = xpRequiredForLevel(player.level);
  const xpPct = Math.min(100, Math.round((player.xp / Math.max(1, xpNeeded)) * 100));
  const hpPct = Math.min(100, (player.currentHp / Math.max(1, derived.maxHp)) * 100);
  const kiPct = Math.min(100, (player.currentKi / Math.max(1, derived.maxKi)) * 100);
  const activeTf = getTransformationById(player.transformationId);

  const nearbyPlayers = onlinePlayers.filter(
    (op) => op.uid !== player.uid && op.currentMapId === player.currentMapId
  );
  const otherMapPlayers = onlinePlayers.filter(
    (op) => op.uid !== player.uid && op.currentMapId !== player.currentMapId
  );

  const currentTargetEntity =
    monstersRef.current.find((m) => m.instanceId === selectedTargetIdRef.current && m.hp > 0) ??
    null;

  const nearbyReadyChest = (() => {
    const grid = getWorldMapGrid(player.currentMapId);
    const pos = playerPosRef.current;
    const reach = isFlying && player.level >= FLIGHT_UNLOCK_LEVEL ? 4.2 : 2.6;
    const ready = grid.chests
      .filter((ch) => (player.chestCooldowns?.[ch.id] ?? 0) <= nowMs)
      .map((ch) => ({ ch, dist: Math.hypot(ch.x + 0.5 - pos.x, ch.y + 0.5 - pos.y) }))
      .filter((item) => item.dist <= reach)
      .sort((a, b) => a.dist - b.dist);
    return ready[0]?.ch ?? null;
  })();

  const topMenuButtons: {
    id: Exclude<DrawerTab, null | 'chat'>;
    label: string;
    icon: React.ReactNode;
    accent?: string;
  }[] = [
    { id: 'maps', label: 'HUNTS', icon: <Compass className="w-3.5 h-3.5" />, accent: 'text-sky-300' },
    { id: 'equipment', label: 'EQUIP', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'inventory', label: 'MOCHILA', icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'forge', label: 'FORJA', icon: <Hammer className="w-3.5 h-3.5" />, accent: 'text-orange-400' },
    { id: 'market', label: 'MERCADO', icon: <Store className="w-3.5 h-3.5" />, accent: 'text-emerald-300' },
    { id: 'skills', label: 'TÉCNICAS', icon: <Sparkles className="w-3.5 h-3.5" />, accent: 'text-amber-300' },
    { id: 'training', label: 'TREINO', icon: <Dumbbell className="w-3.5 h-3.5" /> },
    { id: 'transformations', label: 'TRANSF.', icon: <Flame className="w-3.5 h-3.5" />, accent: 'text-orange-400' },
    { id: 'dragon_balls', label: 'ESFERAS', icon: <Sparkles className="w-3.5 h-3.5" />, accent: 'text-yellow-300' },
    { id: 'pets', label: 'MASCOTES', icon: <Heart className="w-3.5 h-3.5" />, accent: 'text-pink-300' },
    { id: 'bestiary', label: 'BESTIÁRIO', icon: <BookOpen className="w-3.5 h-3.5" />, accent: 'text-sky-300' },
    { id: 'tournament', label: 'TORNEIO', icon: <Swords className="w-3.5 h-3.5" />, accent: 'text-amber-300' },
    { id: 'world_boss', label: 'W.BOSS', icon: <Flame className="w-3.5 h-3.5" />, accent: 'text-pink-400' },
    { id: 'bosses', label: 'CHEFES', icon: <Skull className="w-3.5 h-3.5" />, accent: 'text-red-400' },
    { id: 'missions', label: 'MISSÕES', icon: <Award className="w-3.5 h-3.5" /> },
    { id: 'prestige', label: 'PRESTIGE', icon: <Crown className="w-3.5 h-3.5" />, accent: 'text-purple-300' },
    { id: 'ranking', label: 'RANKING', icon: <Trophy className="w-3.5 h-3.5" />, accent: 'text-yellow-300' },
    { id: 'social', label: 'CLÃ/ONLINE', icon: <Users className="w-3.5 h-3.5" />, accent: 'text-emerald-300' },
    { id: 'stats', label: 'STATS', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];

  const fusionActive = (player.fusionUntilMs ?? 0) > nowMs;
  const shenlongBuffActive = (player.xpBuffUntilMs ?? 0) > nowMs;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070a10] text-slate-100 select-none">
      {/* 1. FULL-VIEWPORT 2D TIBIA-STYLE TOP-DOWN WORLD CANVAS */}
      <TibiaWorldCanvas
        player={player}
        derived={derived}
        playerPosRef={playerPosRef}
        joystickVecRef={joystickVecRef}
        keysPressedRef={keysPressedRef}
        clickTargetRef={clickTargetRef}
        monstersRef={monstersRef}
        selectedTargetIdRef={selectedTargetIdRef}
        projectilesRef={projectilesRef}
        floatingTextsRef={floatingTextsRef}
        lootSparklesRef={lootSparklesRef}
        emotesRef={emotesRef}
        nearbyPlayers={nearbyPlayers}
        highlightedPlayerUid={highlightedPlayerUid}
        worldBoss={worldBoss}
        selectedWorldBoss={selectedWorldBoss}
        showFloatingDamage={uiSettings.showFloatingDamage}
        isFlying={isFlying && player.level >= FLIGHT_UNLOCK_LEVEL}
        botEnabled={botEnabled}
        chestCooldowns={player.chestCooldowns ?? {}}
        lastAttackAtRef={lastAttackAtRef}
        onSelectMonster={(id) => {
          setSelectedWorldBoss(false);
          selectedTargetIdRef.current = id;
          const found = monstersRef.current.find((m) => m.instanceId === id);
          setSelectedTargetName(found?.def.name ?? null);
        }}
        onSelectWorldBoss={() => {
          setSelectedWorldBoss(true);
          selectedTargetIdRef.current = null;
          setSelectedTargetName(worldBoss?.name ?? null);
        }}
        onSelectPlayer={(op) => setInspectedPlayer(op)}
        onOpenChest={handleOpenChest}
        onInteractNpc={handleInteractNpc}
      />

      {/* 2. ZERO-OVERLAP FLEXBOX HUD SHELL */}
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
        {/* 2A. TOP COLLAPSIBLE RPG ICON MENU BAR */}
        <header className="pointer-events-auto w-full shrink-0 bg-gradient-to-b from-[#090f1d]/95 via-[#0f172a]/92 to-[#0f172a]/82 border-b border-slate-700/80 backdrop-blur-md px-2.5 py-1.5 shadow-xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setActiveDrawer(activeDrawer === 'maps' ? null : 'maps')}
                className="px-3 py-1 rounded-lg bg-gradient-to-b from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-pixel text-[10px] sm:text-[11px] shadow-md whitespace-nowrap shrink-0 cursor-pointer border border-sky-300/30 truncate max-w-[200px] sm:max-w-none"
              >
                EXPLORAR · {currentMap.name}
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawer(activeDrawer === 'social' ? null : 'social')}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-700 bg-[#0B0F17]/80 hover:border-emerald-400/60 text-[10px] font-bold text-slate-200 cursor-pointer shrink-0"
                title="Jogadores Online & Clãs"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsConnected || fsPresenceConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span>ONLINE · {Math.max(1, onlinePlayers.length)}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void syncToCloud(player, true)}
                className="px-2.5 py-1 rounded-md bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-sm"
              >
                {saveNotice ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saveNotice ? 'Salvo' : 'Salvar'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Configurações e Barra de Código"
                title="Configurações & Barra de Código"
                className={`px-2.5 py-1 rounded-md border font-bold text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors ${
                  derived.codePowerMultiplier > 1
                    ? 'bg-sky-500/20 border-sky-400/70 text-sky-200 hover:bg-sky-500/30'
                    : 'bg-slate-800/90 border-slate-700 hover:border-slate-500 text-slate-100'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CONFIG</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !muted;
                  soundFx.muted = next;
                  setMuted(next);
                }}
                aria-label="Alternar som"
                className="p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setTopBarExpanded((v) => !v)}
                aria-label="Minimizar barra superior"
                className="p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                {topBarExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {topBarExpanded && (
            <div className="max-w-7xl mx-auto mt-1.5 flex items-center gap-1 overflow-x-auto pb-0.5">
              {topMenuButtons.map((btn) => {
                const active = activeDrawer === btn.id;
                const ballCount = (player.dragonBalls ?? []).length;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setActiveDrawer(active ? null : btn.id)}
                    className={`relative flex flex-col items-center justify-center min-w-[54px] px-1.5 py-1 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                      active
                        ? 'bg-orange-500/20 border-orange-400 text-orange-300 shadow-inner'
                        : 'bg-[#0B0F17]/75 border-slate-700/70 hover:border-slate-500 text-slate-200'
                    }`}
                  >
                    <span className={btn.accent ?? 'text-slate-200'}>{btn.icon}</span>
                    <span className="text-[8.5px] font-bold tracking-wide mt-0.5 whitespace-nowrap">
                      {btn.label}
                    </span>
                    {btn.id === 'social' && onlinePlayers.length > 1 && (
                      <span className="absolute -top-1 -right-1 px-1 min-w-[15px] h-3.5 rounded-full bg-emerald-500 text-slate-950 font-mono-num text-[8px] font-bold flex items-center justify-center">
                        {onlinePlayers.length}
                      </span>
                    )}
                    {btn.id === 'dragon_balls' && ballCount > 0 && (
                      <span className="absolute -top-1 -right-1 px-1 min-w-[15px] h-3.5 rounded-full bg-amber-400 text-slate-950 font-mono-num text-[8px] font-bold flex items-center justify-center">
                        {ballCount}
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  syncPresenceNowRef.current?.(false);
                  void signOut(auth);
                }}
                className="flex flex-col items-center justify-center min-w-[48px] px-1.5 py-1 rounded-lg border border-slate-700/70 bg-[#0B0F17]/75 hover:border-red-500/50 text-slate-300 hover:text-red-300 cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-bold mt-0.5">SAIR</span>
              </button>
            </div>
          )}
        </header>

        {/* 2B. MIDDLE WORKSPACE ROW: LEFT UNIT COLUMN | CENTER TARGET | RIGHT MINIMAP + RADAR */}
        <div className="flex-1 min-h-0 flex items-start justify-between gap-2 p-2 sm:p-2.5 overflow-hidden">
          {/* LEFT COLUMN: VOO + HUNTS + CHARACTER UNIT FRAME + WORLD BOSS MINI BANNER */}
          <div className="pointer-events-auto flex flex-col items-start gap-1.5 min-w-0 w-[238px] sm:w-[272px] shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleFlight}
                title={
                  player.level >= FLIGHT_UNLOCK_LEVEL
                    ? 'Invocar / Guardar Nuvem Voadora (Tecla V)'
                    : `Nuvem Voadora desbloqueada no Nível ${FLIGHT_UNLOCK_LEVEL}`
                }
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-wider flex items-center gap-1 shadow-lg transition-all cursor-pointer ${
                  player.level < FLIGHT_UNLOCK_LEVEL
                    ? 'bg-[#0B0F17]/90 border-slate-700/80 text-slate-400 hover:border-amber-500/50 hover:text-amber-300'
                    : isFlying
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 border-yellow-200 text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.55)]'
                    : 'bg-[#0B0F17]/90 border-amber-500/50 hover:border-yellow-400 text-amber-300'
                }`}
              >
                {player.level < FLIGHT_UNLOCK_LEVEL ? (
                  <>
                    <Lock className="w-3 h-3 text-amber-400/80" />
                    <span>NUVEM · NV.{FLIGHT_UNLOCK_LEVEL}</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{isFlying ? 'NUVEM ATIVA' : 'NUVEM VOADORA'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawer(activeDrawer === 'maps' ? null : 'maps')}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 border border-sky-300/50 text-white font-bold text-[10px] shadow-lg cursor-pointer flex items-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>HUNTS</span>
              </button>
            </div>

            {/* CHARACTER UNIT FRAME */}
            <div
              className={`w-full rounded-xl border bg-[#0B0F17]/92 backdrop-blur-md p-2.5 shadow-2xl space-y-1.5 ${
                player.transformationId === 'yamcha_ui'
                  ? 'border-sky-400/80 shadow-[0_0_20px_rgba(56,189,248,0.28)]'
                  : 'border-slate-700/90'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="relative shrink-0 rounded-full border-2 bg-[#131A26] p-0.5"
                  style={{ borderColor: activeTf.id === 'base' ? '#fbbf24' : activeTf.auraColor }}
                >
                  <WarriorPixelSprite
                    race={player.race}
                    transformationId={player.transformationId}
                    isFused={fusionActive}
                    size={34}
                  />
                  <span className="absolute -bottom-1 -right-1 px-1.5 rounded bg-slate-950 border border-amber-400 font-mono-num text-[9px] font-bold text-amber-300">
                    {player.level}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white truncate">
                      {player.guildTag ? `[${player.guildTag}] ` : ''}
                      {player.name}
                    </span>
                    <span className="text-[10px] font-mono-num font-bold text-amber-300 shrink-0">
                      PL {formatNumber(derived.powerLevel)}
                    </span>
                  </div>
                  <p className="text-[10px] text-sky-400 truncate">
                    {player.title} · {formatNumber(player.zeni)} Z
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    <span
                      className="px-1.5 py-0.2 rounded text-[9px] font-bold border truncate max-w-[115px]"
                      style={{
                        borderColor: `${activeTf.auraColor}66`,
                        backgroundColor: `${activeTf.auraColor}18`,
                        color: activeTf.id === 'base' ? '#cbd5e1' : activeTf.auraColor,
                      }}
                    >
                      {activeTf.name}
                    </span>
                    {derived.codePowerMultiplier > 1 && (
                      <span className="px-1 rounded bg-sky-500/25 border border-sky-300/60 text-[8.5px] font-bold text-sky-200">
                        30x PODER
                      </span>
                    )}
                    {derived.xpMultiplier > 1 && (
                      <span className="px-1 rounded bg-amber-500/25 border border-amber-300/60 text-[8.5px] font-bold text-amber-200 flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" />
                        <span>{derived.xpMultiplier}x XP</span>
                      </span>
                    )}
                    {fusionActive && (
                      <span className="px-1 rounded bg-cyan-500/25 border border-cyan-300/60 text-[8.5px] font-bold text-cyan-200">
                        FUSÃO
                      </span>
                    )}
                    {shenlongBuffActive && (
                      <span className="px-1 rounded bg-emerald-500/25 border border-emerald-300/60 text-[8.5px] font-bold text-emerald-200">
                        SHENLONG
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* HP Bar */}
              <div className="relative h-3.5 rounded bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-150"
                  style={{ width: `${hpPct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[9.5px] font-bold text-white drop-shadow">
                  {formatNumber(player.currentHp)} / {formatNumber(derived.maxHp)}
                </span>
              </div>

              {/* Ki Bar */}
              <div className="relative h-3.5 rounded bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-150"
                  style={{ width: `${kiPct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[9.5px] font-bold text-white drop-shadow">
                  {formatNumber(player.currentKi)} / {formatNumber(derived.maxKi)} Ki
                </span>
              </div>

              {/* XP Bar */}
              <div className="relative h-3 rounded bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-violet-400 transition-all duration-200"
                  style={{ width: `${xpPct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[8.5px] font-bold text-white drop-shadow">
                  XP {xpPct}% · {formatNumber(player.kiFragments ?? 0)} Frag
                </span>
              </div>
            </div>

            {/* WORLD BOSS INVASION QUICK BANNER */}
            {worldBoss && worldBoss.status === 'active' && worldBoss.hp > 0 && (
              <button
                type="button"
                onClick={() => setActiveDrawer('world_boss')}
                className="w-full rounded-lg border border-pink-500/60 bg-[#1a0f1e]/90 hover:bg-[#24132b] px-2.5 py-1.5 text-left shadow-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-[9.5px] font-bold text-pink-300">
                  <span className="truncate flex items-center gap-1">
                    <Flame className="w-3 h-3 shrink-0" />
                    <span>{worldBoss.name}</span>
                  </span>
                  <span className="font-mono-num shrink-0">
                    {Math.max(1, Math.round((worldBoss.hp / Math.max(1, worldBoss.maxHp)) * 100))}%
                  </span>
                </div>
                <p className="text-[8.5px] text-slate-400 truncate mt-0.5">
                  Em {getMapById(worldBoss.mapId).name} · Clique para participar
                </p>
              </button>
            )}
          </div>

          {/* CENTER COLUMN: FLOATING TARGET FRAME (MONSTER / BOSS / WORLD BOSS) */}
          <div className="hidden md:flex flex-col items-center pointer-events-auto">
            {selectedWorldBoss && worldBoss && worldBoss.status === 'active' && worldBoss.hp > 0 ? (
              <div className="w-[260px] rounded-xl border border-pink-400/80 bg-[#0B0F17]/92 backdrop-blur-md px-3 py-2 shadow-2xl flex items-center gap-2.5">
                <div className="shrink-0 rounded-lg bg-[#131A26] border border-pink-500/50 p-1">
                  <MonsterPixelSprite
                    archetype={worldBoss.archetype}
                    colorPrimary={worldBoss.colorPrimary}
                    colorSecondary={worldBoss.colorSecondary}
                    isBoss
                    size={32}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-pink-200 truncate">
                      {worldBoss.name}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 rounded bg-pink-500/20 text-pink-300 border border-pink-400/50 shrink-0">
                      GLOBAL
                    </span>
                  </div>
                  <div className="relative h-3 rounded bg-slate-900 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-600 to-rose-400 transition-all duration-100"
                      style={{
                        width: `${Math.max(0, Math.min(100, (worldBoss.hp / Math.max(1, worldBoss.maxHp)) * 100))}%`,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[9px] font-bold text-white drop-shadow">
                      {formatNumber(worldBoss.hp)} / {formatNumber(worldBoss.maxHp)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAttackWorldBoss()}
                  title="Golpear World Boss"
                  className="p-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-slate-950 cursor-pointer shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : currentTargetEntity ? (
              <div
                className={`w-[248px] rounded-xl border bg-[#0B0F17]/92 backdrop-blur-md px-3 py-2 shadow-2xl flex items-center gap-2.5 ${
                  currentTargetEntity.isBoss ? 'border-amber-400/80' : 'border-red-500/60'
                }`}
              >
                <div className="shrink-0 rounded-lg bg-[#131A26] border border-slate-700 p-1">
                  <MonsterPixelSprite
                    archetype={currentTargetEntity.def.archetype}
                    colorPrimary={currentTargetEntity.def.colorPrimary}
                    colorSecondary={currentTargetEntity.def.colorSecondary}
                    isBoss={currentTargetEntity.isBoss}
                    size={32}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-white truncate">
                      {currentTargetEntity.def.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 rounded shrink-0 ${
                        currentTargetEntity.isBoss
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {currentTargetEntity.isBoss
                        ? 'CHEFE'
                        : `Lv.${(currentTargetEntity.def as MonsterDef).level}`}
                    </span>
                  </div>
                  <div className="relative h-3 rounded bg-slate-900 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-100"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, (currentTargetEntity.hp / Math.max(1, currentTargetEntity.maxHp)) * 100)
                        )}%`,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[9px] font-bold text-white drop-shadow">
                      {formatNumber(Math.max(0, currentTargetEntity.hp))} /{' '}
                      {formatNumber(currentTargetEntity.maxHp)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWorldBoss(false);
                    handleTargetNearest();
                  }}
                  title="Trocar Alvo (Tab)"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer shrink-0"
                >
                  <Crosshair className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            ) : null}
          </div>

          {/* RIGHT COLUMN: DOCKED MINIMAP + RADAR ONLINE */}
          <div className="pointer-events-auto flex flex-col items-end gap-1.5 shrink-0">
            {/* MOBILE QUICK RADAR PILL */}
            {uiSettings.showMultiplayerRadar && (nearbyPlayers.length > 0 || otherMapPlayers.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  const first = nearbyPlayers[0] ?? otherMapPlayers[0];
                  if (first) setInspectedPlayer(first);
                  else setActiveDrawer('social');
                }}
                className="sm:hidden px-2.5 py-1 rounded-lg border border-sky-400/50 bg-[#0B0F17]/92 backdrop-blur-md shadow-lg flex items-center gap-1.5 text-[10px] font-bold text-sky-200 cursor-pointer"
              >
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span className="max-w-[96px] truncate">
                  {nearbyPlayers.length > 0
                    ? `${nearbyPlayers[0].name} aqui`
                    : `${otherMapPlayers[0].name}`}
                </span>
              </button>
            )}

            {/* DESKTOP MINIMAP CARD */}
            <div className="hidden sm:block w-[184px] rounded-xl border border-slate-700/90 bg-[#0B0F17]/90 backdrop-blur-md p-1.5 shadow-2xl">
              <div className="flex items-center justify-between text-[9px] font-bold text-slate-300 px-1 pb-1">
                <span className="truncate">{currentMap.name}</span>
                <span className="text-sky-400 font-mono-num">
                  {Math.floor(playerPosRef.current.x)},{Math.floor(playerPosRef.current.y)}
                </span>
              </div>
              <WorldMinimapCanvas
                mapId={player.currentMapId}
                playerPosRef={playerPosRef}
                monstersRef={monstersRef}
                nearbyPlayers={nearbyPlayers}
                chestCooldowns={player.chestCooldowns ?? {}}
                worldBoss={worldBoss}
              />
            </div>

            {/* DESKTOP RADAR ONLINE STACKED CLEANLY BELOW MINIMAP */}
            {uiSettings.showMultiplayerRadar && (
              <div className="hidden sm:block w-[204px] rounded-xl border border-slate-700/90 bg-[#0B0F17]/90 backdrop-blur-md shadow-2xl overflow-hidden">
                <div className="px-2.5 py-1.5 border-b border-slate-800 bg-[#131A26]/90 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Radio
                      className={`w-3.5 h-3.5 shrink-0 ${
                        wsConnected || fsPresenceConnected ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    />
                    <span className="text-[10px] font-bold text-slate-100 truncate">
                      RADAR ONLINE ({onlinePlayers.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRadarExpanded((v) => !v)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                    aria-label="Minimizar radar online"
                  >
                    {radarExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {radarExpanded && (
                  <div className="p-2 space-y-2 max-h-[168px] overflow-y-auto">
                    <div className="flex items-center gap-1">
                      {['Oi!', 'Grupo?', 'Boss!'].map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => handleSendEmote(em)}
                          className="flex-1 px-1.5 py-0.5 rounded bg-slate-800/90 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-400/50 text-[9px] font-bold text-slate-200 cursor-pointer"
                        >
                          {em}
                        </button>
                      ))}
                    </div>

                    {nearbyPlayers.length === 0 && otherMapPlayers.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-1">
                        Você é o único online agora.
                      </p>
                    ) : (
                      <>
                        {nearbyPlayers.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                              Neste Mapa ({nearbyPlayers.length})
                            </p>
                            {nearbyPlayers.map((op) => (
                              <div
                                key={op.uid}
                                className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-800 bg-[#131A26]/80 px-2 py-1"
                              >
                                <button
                                  type="button"
                                  onClick={() => setInspectedPlayer(op)}
                                  className="min-w-0 flex-1 text-left cursor-pointer"
                                >
                                  <p className="text-[10px] font-bold text-white truncate">
                                    {op.name}
                                  </p>
                                  <p className="text-[9px] text-slate-400 font-mono-num">
                                    Lv.{op.level} · PL {formatNumber(op.powerLevel)}
                                  </p>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLocatePlayer(op)}
                                  title="Caminhar até jogador"
                                  className="p-1 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-300 cursor-pointer shrink-0"
                                >
                                  <Navigation className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {otherMapPlayers.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-sky-400 uppercase tracking-wider">
                              Outros Mapas ({otherMapPlayers.length})
                            </p>
                            {otherMapPlayers.slice(0, 5).map((op) => {
                              const mapInfo = getMapById(op.currentMapId);
                              const canGo = player.level >= mapInfo.requiredLevel;
                              return (
                                <div
                                  key={op.uid}
                                  className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-800 bg-[#131A26]/70 px-2 py-1"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setInspectedPlayer(op)}
                                    className="min-w-0 flex-1 text-left cursor-pointer"
                                  >
                                    <p className="text-[10px] font-bold text-slate-200 truncate">
                                      {op.name}
                                    </p>
                                    <p className="text-[9px] text-slate-400 truncate">
                                      {mapInfo.name} · Lv.{op.level}
                                    </p>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canGo}
                                    onClick={() => handleGoToPlayerMap(op.currentMapId)}
                                    title={
                                      canGo
                                        ? `Ir para ${mapInfo.name}`
                                        : `Requer Nível ${mapInfo.requiredLevel}`
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                      canGo
                                        ? 'bg-orange-500/20 hover:bg-orange-500/35 border border-orange-400/50 text-orange-300 cursor-pointer'
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    }`}
                                  >
                                    Ir
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2C. BOTTOM STACK: BOT + JOYSTICK ROW, FOLLOWED BY CHAT + HOTBAR + STATS DOCK */}
        <div className="shrink-0 flex flex-col gap-1.5 px-2 sm:px-2.5 pb-2 sm:pb-2.5">
          {/* ABOVE HOTBAR: LEFT BOT BAR + RIGHT JOYSTICK */}
          <div className="flex items-end justify-between gap-2">
            <div className="pointer-events-auto rounded-xl border border-slate-700/80 bg-[#0B0F17]/90 backdrop-blur-md px-2 py-1.5 shadow-xl flex flex-wrap items-center gap-1 max-w-[260px] sm:max-w-[360px]">
              <button
                type="button"
                onClick={() => setBotEnabled((v) => !v)}
                className={`px-2 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  botEnabled
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>BOT {botEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoSkills((v) => !v)}
                title="Usar Habilidades Automaticamente"
                className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                  autoSkills
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                    : 'bg-slate-900 border-slate-700 text-slate-500'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setAutoHeal((v) => !v)}
                title="Cura Automática abaixo de 45% HP"
                className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                  autoHeal
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-500'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setAutoTransform((v) => !v)}
                title="Transformação Automática"
                className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                  autoTransform
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-700 text-slate-500'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setPlayer((prev) =>
                    prev
                      ? {
                          ...prev,
                          activityMode: prev.activityMode === 'training' ? 'combat' : 'training',
                        }
                      : prev
                  )
                }
                title="Alternar Combate / Treino AFK"
                className={`px-2 py-1 rounded-lg border text-[10px] font-semibold cursor-pointer ${
                  player.activityMode === 'training'
                    ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                {player.activityMode === 'training' ? 'TREINANDO' : 'CAÇANDO'}
              </button>

              {selectedTargetName && (
                <span className="md:hidden text-[9.5px] text-red-300 font-medium pl-1 truncate max-w-[110px]">
                  Alvo: {selectedTargetName}
                </span>
              )}
            </div>

            <div className="pointer-events-auto shrink-0">
              <VirtualJoystick
                onVectorChange={(vec) => {
                  joystickVecRef.current = vec;
                }}
                onTargetNearest={() => {
                  setSelectedWorldBoss(false);
                  handleTargetNearest();
                }}
                hasTarget={Boolean(selectedTargetName)}
              />
            </div>
          </div>

          {/* BOTTOM DOCK ROW: CHAT BUTTON | HABILIDADES HOTBAR | STATS BUTTON */}
          <div className="flex items-end justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setUnreadChat(0);
                setActiveDrawer(activeDrawer === 'social' ? null : 'social');
              }}
              className="pointer-events-auto relative shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#0B0F17]/90 border-2 border-slate-600 hover:border-sky-400 text-slate-100 flex items-center justify-center shadow-xl cursor-pointer"
              aria-label="Abrir Chat Global e Jogadores Online"
            >
              <MessageCircle className="w-5 h-5" />
              {unreadChat > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 min-w-[20px] h-5 rounded-full bg-sky-500 text-slate-950 font-mono-num text-[10px] font-bold flex items-center justify-center">
                  {unreadChat > 99 ? '99+' : unreadChat}
                </span>
              )}
            </button>

            <div className="pointer-events-auto flex-1 min-w-0 flex flex-col items-center gap-1 max-w-[560px] mx-auto">
              {nearbyReadyChest && (
                <button
                  type="button"
                  onClick={() => handleOpenChest(nearbyReadyChest)}
                  className="px-3 py-1 rounded-full border border-amber-300/80 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold text-[10.5px] flex items-center gap-1.5 shadow-[0_0_18px_rgba(250,204,21,0.55)] cursor-pointer animate-bounce"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>[E] Abrir Baú (Item Aleatório)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setAutoSkillsConfigOpen(true)}
                className="px-2.5 py-0.5 rounded-full border border-sky-400/50 bg-[#0B0F17]/92 hover:bg-sky-500/20 text-[9.5px] font-bold text-sky-200 flex items-center gap-1 shadow-lg cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-3 h-3 text-sky-300" />
                <span>
                  Config. Habilidades ({autoSkillIds.length}/{MAX_AUTO_SKILLS})
                </span>
              </button>

              <div className="w-full rounded-xl border border-slate-700/90 bg-[#0B0F17]/92 backdrop-blur-md px-2 py-1.5 shadow-2xl">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[9px] font-bold tracking-widest text-slate-400">
                    HABILIDADES · DPS {formatNumber(derived.dps)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSkillsBarExpanded((v) => !v)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                    aria-label="Minimizar habilidades"
                  >
                    {skillsBarExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {skillsBarExpanded && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    {COMBAT_SKILLS.map((skill) => {
                      const unlocked = player.level >= skill.requiredLevel;
                      const cdUntil = skillCooldowns[skill.id] ?? 0;
                      const cdSec = Math.max(0, Math.ceil((cdUntil - nowMs) / 1000));
                      const enoughKi = player.currentKi >= skill.kiCost;
                      const autoIdx = autoSkillIds.indexOf(skill.id);

                      return (
                        <button
                          key={skill.id}
                          type="button"
                          disabled={!unlocked || cdSec > 0 || !enoughKi}
                          onClick={() => void castSkill(skill)}
                          title={`${skill.name} (${skill.kiCost} Ki)${
                            autoIdx >= 0 ? ` · Auto #${autoIdx + 1}` : ''
                          }`}
                          className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-lg border flex flex-col items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
                            !unlocked
                              ? 'bg-slate-900/80 border-slate-800 text-slate-600 cursor-not-allowed'
                              : cdSec > 0
                              ? 'bg-slate-900 border-slate-700 text-amber-300 cursor-not-allowed'
                              : enoughKi
                              ? 'bg-[#131A26] border-slate-600 hover:border-orange-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <span className="absolute top-0.5 left-1 font-mono-num text-[8.5px] text-slate-400">
                            {skill.slot}
                          </span>
                          {autoIdx >= 0 && (
                            <span
                              className="absolute top-0.5 right-0.5 px-1 rounded bg-sky-500/90 text-slate-950 font-mono-num text-[7.5px] font-extrabold leading-tight"
                              title="Habilidade Automática Ativa"
                            >
                              A{autoIdx + 1}
                            </span>
                          )}
                          <Swords
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                            style={{ color: unlocked ? skill.colorPrimary : '#475569' }}
                          />
                          <span className="text-[8px] font-semibold truncate max-w-[38px] mt-0.5">
                            {skill.shortName}
                          </span>

                          {cdSec > 0 && (
                            <div className="absolute inset-0 rounded-lg bg-black/70 flex items-center justify-center font-mono-num text-xs font-bold text-amber-300">
                              {cdSec}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveDrawer(activeDrawer === 'stats' ? null : 'stats')}
              className="pointer-events-auto shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#0B0F17]/90 border-2 border-slate-600 hover:border-orange-400 text-emerald-400 flex items-center justify-center shadow-xl cursor-pointer"
              aria-label="Abrir Estatísticas e Log"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 9. MODAL / DRAWER OVERLAY FOR ALL GAME SYSTEMS */}
      {activeDrawer && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl max-h-[88vh] rounded-2xl border border-slate-700 bg-[#0B0F17] shadow-2xl flex flex-col overflow-hidden">
            <div className="border-b border-slate-800 bg-[#131A26] px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-pixel text-sm text-orange-400">IDLE NAMEKI</span>
                <span className="text-xs text-slate-400">· {currentMap.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                aria-label="Fechar janela"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {activeDrawer === 'maps' && (
                <MapsPanel player={player} onSelectMap={handleSelectMap} />
              )}
              {activeDrawer === 'equipment' && (
                <EquipmentPanel
                  player={player}
                  onUnequip={handleUnequipSlot}
                  onOpenForge={() => setActiveDrawer('forge')}
                />
              )}
              {activeDrawer === 'inventory' && (
                <InventoryPanel
                  player={player}
                  onEquip={handleEquipItem}
                  onUseSpecial={handleUseSpecialItem}
                  onSellItem={handleSellItem}
                  onBulkSellCommonUncommon={handleBulkSell}
                />
              )}
              {activeDrawer === 'forge' && (
                <ForgePanel
                  player={player}
                  onUpgradeItem={handleUpgradeItem}
                  onSalvageItem={handleSalvageItem}
                  onBulkSalvageCommonUncommon={handleBulkSalvageCommonUncommon}
                  onFuseRarity={handleFuseRarity}
                />
              )}
              {activeDrawer === 'market' && (
                <MarketPanel
                  player={player}
                  openListings={marketOpenListings}
                  myListings={myMarketListings}
                  onBuyListing={(l) => void handleBuyListing(l)}
                  onCreateListing={(uid, price) => void handleCreateListing(uid, price)}
                  onCancelListing={(id) => void handleCancelListing(id)}
                  onClaimSoldListing={(l) => void handleClaimSoldListing(l)}
                />
              )}
              {activeDrawer === 'dragon_balls' && (
                <DragonBallsPanel player={player} onSummonShenlong={handleSummonShenlong} />
              )}
              {activeDrawer === 'pets' && (
                <PetsPanel
                  player={player}
                  onUnlockPet={handleUnlockPet}
                  onEquipPet={handleEquipPet}
                />
              )}
              {activeDrawer === 'bestiary' && <BestiaryPanel player={player} />}
              {activeDrawer === 'tournament' && (
                <TournamentPanel
                  player={player}
                  myPowerLevel={derived.powerLevel}
                  opponents={rankingProfiles}
                  onFightOpponent={handleFightTournamentOpponent}
                  onBuyTournamentReward={handleBuyTournamentReward}
                />
              )}
              {activeDrawer === 'prestige' && (
                <PrestigePanel
                  player={player}
                  onPerformPrestige={handlePerformPrestige}
                  onBuyDivineUpgrade={handleBuyDivineUpgrade}
                />
              )}
              {activeDrawer === 'world_boss' && (
                <WorldBossPanel
                  player={player}
                  worldBoss={worldBoss}
                  nowMs={nowMs}
                  onGoToBossMap={(mapId) => handleSelectMap(mapId)}
                  onAttackWorldBoss={() => void handleAttackWorldBoss()}
                  onSpawnNextWorldBoss={() => void handleSpawnNextWorldBoss()}
                />
              )}
              {activeDrawer === 'skills' && (
                <SkillsPanel
                  player={player}
                  cooldowns={skillCooldowns}
                  nowMs={nowMs}
                  onCastSkill={(s) => {
                    void castSkill(s);
                    setActiveDrawer(null);
                  }}
                />
              )}
              {activeDrawer === 'training' && (
                <TrainingPanel
                  player={player}
                  onStartTraining={handleStartTraining}
                  onSetActivityMode={(mode) =>
                    setPlayer((prev) => (prev ? { ...prev, activityMode: mode } : prev))
                  }
                />
              )}
              {activeDrawer === 'transformations' && (
                <TransformationsPanel
                  player={player}
                  onSelectTransformation={handleSelectTransformation}
                />
              )}
              {activeDrawer === 'missions' && (
                <MissionsPanel
                  player={player}
                  onClaimMission={handleClaimMission}
                  onSelectTitle={(title) =>
                    setPlayer((prev) => (prev ? { ...prev, title } : prev))
                  }
                />
              )}
              {activeDrawer === 'bosses' && (
                <BossesPanel
                  player={player}
                  nowMs={nowMs}
                  onChallengeBossById={(mapId) => handleChallengeBoss(mapId)}
                />
              )}
              {activeDrawer === 'ranking' && (
                <RankingPanel
                  profiles={rankingProfiles}
                  currentUid={player.uid}
                  onRefreshRankings={refreshRankings}
                />
              )}
              {activeDrawer === 'social' && (
                <SocialPanel
                  player={player}
                  onlinePlayers={onlinePlayers}
                  chatMessages={chatMessages}
                  parties={parties}
                  currentPartyMembers={currentPartyMembers}
                  guilds={guilds}
                  currentGuild={currentGuild}
                  guildMembers={guildMembers}
                  guildChat={guildChat}
                  nowMs={nowMs}
                  onSendChat={handleSendChat}
                  onCreateParty={handleCreateParty}
                  onJoinParty={handleJoinParty}
                  onLeaveParty={handleLeaveParty}
                  onFuseWithAlly={handleFuseWithAlly}
                  onCreateGuild={(n, t, d) => void handleCreateGuild(n, t, d)}
                  onJoinGuild={(id) => void handleJoinGuild(id)}
                  onLeaveGuild={() => void handleLeaveGuild()}
                  onDonateGuildZeni={(amt) => void handleDonateGuildZeni(amt)}
                  onSendGuildChat={(txt) => void handleSendGuildChat(txt)}
                  onGoToPlayerMap={handleGoToPlayerMap}
                />
              )}
              {activeDrawer === 'stats' && (
                <div className="space-y-4">
                  <StatsPanel player={player} derived={derived} afkHistory={afkHistory} />
                  <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-2">
                    <h3 className="text-xs font-semibold text-slate-300">Log de Batalha Recente</h3>
                    <div className="max-h-44 overflow-y-auto space-y-1 font-mono text-[11px]">
                      {battleLog.map((entry) => (
                        <p
                          key={entry.id}
                          className={
                            entry.tone === 'boss'
                              ? 'text-amber-300'
                              : entry.tone === 'level'
                              ? 'text-emerald-300'
                              : entry.tone === 'drop'
                              ? 'text-sky-300'
                              : entry.tone === 'crit'
                              ? 'text-orange-300'
                              : 'text-slate-400'
                          }
                        >
                          {entry.text}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 10. REMOTE PLAYER INSPECTOR MODAL */}
      {inspectedPlayer && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-sky-500/40 bg-[#0B0F17] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-slate-700 bg-[#131A26] p-2">
                  <WarriorPixelSprite
                    race={inspectedPlayer.race}
                    transformationId={inspectedPlayer.transformationId}
                    isFused={inspectedPlayer.isFused}
                    size={54}
                  />
                </div>
                <div>
                  <h3 className="font-pixel text-sm text-white">
                    {inspectedPlayer.guildTag ? `[${inspectedPlayer.guildTag}] ` : ''}
                    {inspectedPlayer.name}
                  </h3>
                  <p className="text-xs text-sky-400">{inspectedPlayer.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {getTransformationById(inspectedPlayer.transformationId).name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedPlayer(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-800 bg-[#131A26] p-2.5">
                <span className="text-slate-400 text-[10px]">Nível</span>
                <p className="font-mono-num font-bold text-white">{inspectedPlayer.level}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#131A26] p-2.5">
                <span className="text-slate-400 text-[10px]">Poder de Luta</span>
                <p className="font-mono-num font-bold text-amber-300">
                  {formatNumber(inspectedPlayer.powerLevel)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#131A26] p-2.5 col-span-2 flex items-center justify-between">
                <span className="text-slate-400 text-[10px]">Localização</span>
                <span className="font-semibold text-sky-300">
                  {getMapById(inspectedPlayer.currentMapId).name}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  handleLocatePlayer(inspectedPlayer);
                  setInspectedPlayer(null);
                }}
                className="py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>
                  {inspectedPlayer.currentMapId === player.currentMapId
                    ? 'Caminhar até lá'
                    : 'Ir ao Mapa'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleFuseWithAlly({
                    name: inspectedPlayer.name,
                    powerLevel: inspectedPlayer.powerLevel,
                  });
                  setInspectedPlayer(null);
                }}
                className="py-2 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fundir (Grupo)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleFightTournamentOpponent({
                    name: inspectedPlayer.name,
                    level: inspectedPlayer.level,
                    powerLevel: inspectedPlayer.powerLevel,
                    race: inspectedPlayer.race,
                    transformationId: inspectedPlayer.transformationId,
                  });
                  setInspectedPlayer(null);
                  setActiveDrawer('tournament');
                }}
                className="py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Duelar Arena</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInspectedPlayer(null);
                  setActiveDrawer('social');
                }}
                className="py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
              >
                Clãs & Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. SETTINGS & SECRET CODE MODAL */}
      {settingsOpen && (
        <SettingsModal
          player={player}
          muted={muted}
          uiSettings={uiSettings}
          isAdmin={isAdmin}
          canEditGlobalConfig={canEditGlobalConfig}
          gameConfig={gameConfig}
          onlinePlayers={onlinePlayers}
          onToggleMute={() => {
            const next = !muted;
            soundFx.muted = next;
            setMuted(next);
          }}
          onUpdateUiSettings={handleUpdateUiSettings}
          onRedeemCode={handleRedeemCode}
          onEquipTitle={(title) => {
            setPlayer((prev) => (prev ? { ...prev, title } : prev));
            pushLog(`Título equipado: ${title}.`, 'normal');
          }}
          onUpdateGameConfig={handleUpdateGameConfig}
          onExportTransfer={handleExportTransfer}
          onImportTransfer={handleImportTransfer}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* 12. AUTO-SKILLS CONFIG MODAL (UP TO 5 SKILLS) */}
      {autoSkillsConfigOpen && (
        <AutoSkillsModal
          playerLevel={player.level}
          autoSkillIds={autoSkillIds}
          onChangeAutoSkillIds={(nextIds) => {
            const clamped = nextIds.slice(0, MAX_AUTO_SKILLS);
            setAutoSkillIds(clamped);
            try {
              localStorage.setItem('idle_nameki_auto_skills', JSON.stringify(clamped));
            } catch {
              // Ignore
            }
          }}
          onResetDefault={() => {
            setAutoSkillIds(DEFAULT_AUTO_SKILLS);
            try {
              localStorage.setItem('idle_nameki_auto_skills', JSON.stringify(DEFAULT_AUTO_SKILLS));
            } catch {
              // Ignore
            }
          }}
          onClose={() => setAutoSkillsConfigOpen(false)}
        />
      )}

      {welcomeSummary && (
        <WelcomeBackModal summary={welcomeSummary} onClose={() => setWelcomeSummary(null)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <IdleNamekiGame />
    </AppErrorBoundary>
  );
}
