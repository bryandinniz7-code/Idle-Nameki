import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Coins,
  Crown,
  Flame,
  MessageSquare,
  Send,
  Shield,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { RACES } from '../../game/data.ts';
import { formatDuration, formatNumber, getMapById, getTransformationById } from '../../game/engine.ts';
import type {
  ChatMessage,
  DerivedStats,
  GuildChatMessage,
  GuildInfo,
  GuildMember,
  OnlinePlayer,
  PartyInfo,
  PartyMember,
  PlayerSaveState,
  PublicProfile,
} from '../../game/types.ts';
import { WarriorPixelSprite } from '../PixelSprites.tsx';

/* 1. STATS PANEL */
interface StatsPanelProps {
  player: PlayerSaveState;
  derived: DerivedStats;
  afkHistory: {
    id: string;
    mapId: string;
    offlineSeconds: number;
    xpGained: number;
    zeniGained: number;
    monstersKilled: number;
    levelsGained: number;
  }[];
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ player, derived, afkHistory }) => {
  const raceInfo = RACES.find((r) => r.id === player.race) ?? RACES[0];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4">
        <h2 className="font-pixel text-base sm:text-lg text-white">Estatísticas do Guerreiro</h2>
        <p className="text-xs text-slate-400 mt-1">
          {player.name} · {raceInfo.name} · {player.title}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          ['Poder de Luta', formatNumber(derived.powerLevel), 'text-amber-300'],
          ['Dano por Segundo (DPS)', formatNumber(derived.dps), 'text-orange-400'],
          ['HP Máximo', formatNumber(derived.maxHp), 'text-emerald-400'],
          ['Ki Máximo / Energia', formatNumber(derived.maxKi), 'text-sky-400'],
          ['Força Total', formatNumber(derived.strength), 'text-white'],
          ['Defesa Total', formatNumber(derived.defense), 'text-white'],
          ['Velocidade', formatNumber(derived.speed), 'text-white'],
          ['Chance de Crítico', `${derived.critChance}%`, 'text-yellow-300'],
          ['Multiplicador de Dano', `${derived.damageMultiplier}x`, 'text-purple-300'],
          ['Monstros Derrotados', formatNumber(player.stats.monstersDefeated), 'text-white'],
          ['Chefes Derrotados', formatNumber(player.stats.bossesDefeated), 'text-amber-300'],
          ['Tempo de Treino', formatDuration(player.stats.trainingSeconds), 'text-sky-300'],
        ].map(([label, val, color]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-[#131A26] p-3.5">
            <p className="text-[11px] text-slate-400">{label}</p>
            <p className={`mt-1 text-base font-bold font-mono-num ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-sky-400" />
          <span>Histórico Recente de Recompensas AFK</span>
        </h3>
        {afkHistory.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhum retorno AFK registrado ainda. Feche o jogo e retorne mais tarde para registrar seus ganhos offline.
          </p>
        ) : (
          <div className="space-y-2">
            {afkHistory.map((h) => (
              <div
                key={h.id}
                className="rounded-lg border border-slate-800 bg-[#0B0F17] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span className="text-slate-200 font-medium">
                  {getMapById(h.mapId).name} · {formatDuration(h.offlineSeconds)} offline
                </span>
                <span className="font-mono-num text-slate-300">
                  +{formatNumber(h.xpGained)} XP · +{formatNumber(h.zeniGained)} Zeni ·{' '}
                  {formatNumber(h.monstersKilled)} abates
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* 2. GLOBAL RANKING PANEL + PUBLIC PROFILE MODAL */
type RankingCategory =
  | 'level'
  | 'powerLevel'
  | 'maxKi'
  | 'monstersDefeated'
  | 'bossesDefeated'
  | 'trainingSeconds';

interface RankingPanelProps {
  profiles: PublicProfile[];
  currentUid: string;
  onRefreshRankings: () => void;
}

export const RankingPanel: React.FC<RankingPanelProps> = ({
  profiles,
  currentUid,
  onRefreshRankings,
}) => {
  const [category, setCategory] = useState<RankingCategory>('powerLevel');
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    onRefreshRankings();
  }, [onRefreshRankings]);

  const sorted = [...profiles].sort((a, b) => b[category] - a[category]).slice(0, 50);

  const labels: Record<RankingCategory, string> = {
    level: 'Maior Level',
    powerLevel: 'Maior Poder de Luta',
    maxKi: 'Maior Ki',
    monstersDefeated: 'Mais Monstros',
    bossesDefeated: 'Mais Chefes',
    trainingSeconds: 'Maior Tempo de Treino',
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white">Ranking Global</h2>
          <p className="text-xs text-slate-400 mt-1">
            Clique em qualquer guerreiro para visualizar seu perfil público.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefreshRankings}
          className="px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-500 bg-[#0B0F17] text-xs font-medium text-slate-200 transition-colors cursor-pointer"
        >
          Atualizar Ranking
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[#131A26] border border-slate-800">
        {(Object.keys(labels) as RankingCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              category === cat
                ? 'bg-orange-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {labels[cat]}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#131A26] overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhum guerreiro encontrado no ranking ainda.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {sorted.map((p, idx) => {
              const isMe = p.uid === currentUid;
              const valFormatted =
                category === 'trainingSeconds'
                  ? formatDuration(p.trainingSeconds)
                  : formatNumber(p[category]);
              return (
                <button
                  key={p.uid}
                  type="button"
                  onClick={() => setSelectedProfile(p)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors cursor-pointer ${
                    isMe ? 'bg-orange-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 text-center font-pixel text-xs shrink-0 ${
                        idx === 0
                          ? 'text-yellow-300'
                          : idx === 1
                          ? 'text-slate-200'
                          : idx === 2
                          ? 'text-orange-400'
                          : 'text-slate-500'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <WarriorPixelSprite
                      race={p.race}
                      transformationId={p.transformationId}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {p.name} {isMe && <span className="text-orange-400 text-xs">(Você)</span>}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {p.title} · Nv.{p.level} · {getMapById(p.currentMapId).name}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-mono-num text-amber-300">{valFormatted}</p>
                    <p className="text-[10px] text-slate-400">{labels[category]}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Public Profile Modal */}
      {selectedProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-[#131A26] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <WarriorPixelSprite
                  race={selectedProfile.race}
                  transformationId={selectedProfile.transformationId}
                  size={64}
                />
                <div>
                  <p className="text-xs text-sky-400">{selectedProfile.title}</p>
                  <h3 className="font-pixel text-base text-white">{selectedProfile.name}</h3>
                  <p className="text-xs text-slate-400">
                    {getTransformationById(selectedProfile.transformationId).name} ·{' '}
                    {getMapById(selectedProfile.currentMapId).name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Fechar perfil público"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-lg bg-[#0B0F17] border border-slate-800 p-3">
                <span className="text-slate-400">Level</span>
                <p className="font-mono-num font-bold text-white text-sm mt-0.5">
                  {selectedProfile.level}
                </p>
              </div>
              <div className="rounded-lg bg-[#0B0F17] border border-slate-800 p-3">
                <span className="text-slate-400">Poder de Luta</span>
                <p className="font-mono-num font-bold text-amber-300 text-sm mt-0.5">
                  {formatNumber(selectedProfile.powerLevel)}
                </p>
              </div>
              <div className="rounded-lg bg-[#0B0F17] border border-slate-800 p-3">
                <span className="text-slate-400">Ki Máximo</span>
                <p className="font-mono-num font-bold text-sky-300 text-sm mt-0.5">
                  {formatNumber(selectedProfile.maxKi)}
                </p>
              </div>
              <div className="rounded-lg bg-[#0B0F17] border border-slate-800 p-3">
                <span className="text-slate-400">Chefes Derrotados</span>
                <p className="font-mono-num font-bold text-orange-300 text-sm mt-0.5">
                  {formatNumber(selectedProfile.bossesDefeated)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* 3. MULTIPLAYER SOCIAL PANEL (ONLINE PLAYERS, GLOBAL CHAT, PARTIES, FUSION, GUILDS) */
interface SocialPanelProps {
  player: PlayerSaveState;
  onlinePlayers: OnlinePlayer[];
  chatMessages: ChatMessage[];
  parties: PartyInfo[];
  currentPartyMembers: PartyMember[];
  guilds: GuildInfo[];
  currentGuild: GuildInfo | null;
  guildMembers: GuildMember[];
  guildChat: GuildChatMessage[];
  nowMs: number;
  onSendChat: (text: string) => void;
  onCreateParty: (name: string) => void;
  onJoinParty: (partyId: string) => void;
  onLeaveParty: () => void;
  onFuseWithAlly: (ally: { name: string; powerLevel: number }) => void;
  onCreateGuild: (name: string, tag: string, description: string) => void;
  onJoinGuild: (guildId: string) => void;
  onLeaveGuild: () => void;
  onDonateGuildZeni: (amount: number) => void;
  onSendGuildChat: (text: string) => void;
  onGoToPlayerMap?: (mapId: string) => void;
}

export const SocialPanel: React.FC<SocialPanelProps> = ({
  player,
  onlinePlayers,
  chatMessages,
  parties,
  currentPartyMembers,
  guilds,
  currentGuild,
  guildMembers,
  guildChat,
  nowMs,
  onSendChat,
  onCreateParty,
  onJoinParty,
  onLeaveParty,
  onFuseWithAlly,
  onCreateGuild,
  onJoinGuild,
  onLeaveGuild,
  onDonateGuildZeni,
  onSendGuildChat,
  onGoToPlayerMap,
}) => {
  const [socialTab, setSocialTab] = useState<'chat_party' | 'guilds'>('chat_party');
  const [chatInput, setChatInput] = useState('');
  const [partyNameInput, setPartyNameInput] = useState('');

  // Guild Form State
  const [guildName, setGuildName] = useState('');
  const [guildTag, setGuildTag] = useState('');
  const [guildDesc, setGuildDesc] = useState('');
  const [guildChatInput, setGuildChatInput] = useState('');

  const activeParty = parties.find((p) => p.id === player.partyId) ?? null;
  const fusionActive = (player.fusionUntilMs ?? 0) > nowMs;
  const fusionLeftSec = fusionActive
    ? Math.max(1, Math.ceil(((player.fusionUntilMs ?? 0) - nowMs) / 1000))
    : 0;

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  const handlePartySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (partyNameInput.trim().length < 2) return;
    onCreateParty(partyNameInput.trim());
    setPartyNameInput('');
  };

  const handleGuildSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = guildName.trim();
    const cleanTag = guildTag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanName.length < 2 || cleanTag.length < 2) return;
    onCreateGuild(cleanName, cleanTag.slice(0, 5), guildDesc.trim() || 'Guerreiros Unidos');
    setGuildName('');
    setGuildTag('');
    setGuildDesc('');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-base sm:text-lg text-white">
            Multiplayer, Grupos, Fusão & Clãs
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Converse no chat, forme grupos (+10% dano/aliado), realize Fusão Metamoru ou evolua sua Guilda!
          </p>
        </div>
        <span className="text-xs font-mono-num text-emerald-300">
          {onlinePlayers.length} {onlinePlayers.length === 1 ? 'jogador online' : 'jogadores online'}
        </span>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSocialTab('chat_party')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            socialTab === 'chat_party'
              ? 'bg-sky-500 text-slate-950'
              : 'border border-slate-700 bg-[#131A26] text-slate-300'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Chat, Grupos & Fusão</span>
        </button>
        <button
          type="button"
          onClick={() => setSocialTab('guilds')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
            socialTab === 'guilds'
              ? 'bg-amber-400 text-slate-950'
              : 'border border-slate-700 bg-[#131A26] text-slate-300'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Guildas / Clãs {currentGuild ? `[${currentGuild.tag}]` : ''}</span>
        </button>
      </div>

      {socialTab === 'chat_party' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Global Chat */}
          <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-col h-[390px]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-sky-400" />
              <span>Chat Global</span>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Nenhuma mensagem ainda. Diga olá aos outros guerreiros!
                </p>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-lg border border-slate-800/90 bg-[#0B0F17] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-orange-300">
                        {msg.senderName}{' '}
                        <span className="text-[10px] text-slate-400 font-mono-num">
                          Nv.{msg.senderLevel}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-500">{msg.senderTitle}</span>
                    </div>
                    <p className="text-slate-200 mt-1 break-words">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={240}
                placeholder="Enviar mensagem no chat global..."
                className="flex-1 rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </form>
          </div>

          {/* Parties, Fusion & Online Players */}
          <div className="space-y-4">
            {/* Party & Metamoru Fusion Box */}
            <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Grupos & Fusão Metamoru</span>
                </h3>
                {fusionActive && (
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-[10px] font-bold text-sky-200 animate-pulse">
                    Fusão c/ {player.fusionPartnerName} ({fusionLeftSec}s)
                  </span>
                )}
              </div>

              {player.partyId && activeParty ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-amber-300">{activeParty.name}</p>
                      <p className="text-[11px] text-slate-300">
                        Líder: {activeParty.leaderName} · {currentPartyMembers.length}/4 membros
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onLeaveParty}
                      className="px-3 py-1.5 rounded-lg border border-red-500/50 text-red-300 hover:bg-red-950/50 text-xs font-medium cursor-pointer"
                    >
                      Sair do Grupo
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {currentPartyMembers.map((m) => (
                      <div
                        key={m.uid}
                        className="rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-medium text-white flex items-center gap-1.5 truncate">
                          {m.uid === activeParty.leaderUid && (
                            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                          <span className="truncate">{m.name}</span>
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono-num text-slate-400">
                            Nv.{m.level} · PL {formatNumber(m.powerLevel)}
                          </span>
                          {m.uid !== player.uid && (
                            <button
                              type="button"
                              onClick={() => onFuseWithAlly({ name: m.name, powerLevel: m.powerLevel })}
                              className="px-2 py-1 rounded bg-gradient-to-r from-amber-400 to-sky-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                              title="Fusão Metamoru (5 min: +45% Dano +40% PL do aliado)"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Fundir</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <form onSubmit={handlePartySubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={partyNameInput}
                      onChange={(e) => setPartyNameInput(e.target.value)}
                      maxLength={32}
                      placeholder="Nome do novo grupo..."
                      className="flex-1 rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Criar</span>
                    </button>
                  </form>

                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {parties.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Nenhum grupo aberto. Crie um para ganhar +10% dano/aliado e liberar Fusão Metamoru!
                      </p>
                    ) : (
                      parties.map((party) => (
                        <div
                          key={party.id}
                          className="rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">{party.name}</p>
                            <p className="text-[11px] text-slate-400">
                              Líder {party.leaderName} · {party.memberCount}/4
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={party.memberCount >= 4}
                            onClick={() => onJoinParty(party.id)}
                            className="px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-[11px] cursor-pointer shrink-0"
                          >
                            Entrar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Online Players List */}
            <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Jogadores Conectados ({onlinePlayers.length})</span>
              </h3>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {onlinePlayers.map((op) => {
                  const sameMap = op.currentMapId === player.currentMapId;
                  const opMap = getMapById(op.currentMapId);
                  const canVisit = player.level >= opMap.requiredLevel;
                  return (
                    <div
                      key={op.uid}
                      className="rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <WarriorPixelSprite
                          race={op.race}
                          transformationId={op.transformationId}
                          isFused={Boolean(op.isFused)}
                          size={28}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">
                            {op.guildTag ? `[${op.guildTag}] ` : ''}
                            {op.name}{' '}
                            {op.uid === player.uid && (
                              <span className="text-[10px] text-orange-400">(Você)</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {opMap.name} · Nv.{op.level} · PL {formatNumber(op.powerLevel)}
                          </p>
                        </div>
                      </div>
                      {op.uid !== player.uid && onGoToPlayerMap && (
                        sameMap ? (
                          <span className="px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-semibold text-emerald-300 shrink-0">
                            No seu mapa
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!canVisit}
                            onClick={() => onGoToPlayerMap(op.currentMapId)}
                            className="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[10px] cursor-pointer shrink-0"
                          >
                            {canVisit ? 'Ir até lá' : `Nv.${opMap.requiredLevel}+`}
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* GUILDS / CLANS TAB */
        <div className="space-y-4">
          {currentGuild ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-amber-500/40 bg-[#131A26] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-amber-300">
                      [{currentGuild.tag}] · Guilda Nível {currentGuild.level}/50
                    </p>
                    <h3 className="font-pixel text-base text-white mt-0.5">{currentGuild.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{currentGuild.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onLeaveGuild}
                    className="px-2.5 py-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-950/40 text-xs font-medium cursor-pointer shrink-0"
                  >
                    Sair da Guilda
                  </button>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="text-emerald-300 font-bold">
                      Buff Coletivo Ativo: +{currentGuild.level * 3}% Dano e +{currentGuild.level * 3}% XP
                    </p>
                    <p className="text-slate-400 text-[11px] font-mono-num">
                      Tesouro: {formatNumber(currentGuild.treasuryZeni)} /{' '}
                      {formatNumber(currentGuild.level * 5000)} Zeni p/ Nível {currentGuild.level + 1}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {[1000, 10000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={player.zeni < amt}
                        onClick={() => onDonateGuildZeni(amt)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Coins className="w-3 h-3" />
                        <span>Doar {formatNumber(amt)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  <p className="text-xs font-bold text-slate-300">
                    Membros ({guildMembers.length}/30)
                  </p>
                  {guildMembers.map((gm) => (
                    <div
                      key={gm.uid}
                      className="rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        {gm.uid === currentGuild.leaderUid && (
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        {gm.name}
                      </span>
                      <span className="font-mono-num text-slate-400">
                        Nv.{gm.level} · Doou {formatNumber(gm.donatedZeni)} Z
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Private Guild Chat */}
              <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 flex flex-col h-[360px]">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Chat Privado da Guilda [{currentGuild.tag}]</span>
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
                  {guildChat.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">
                      Nenhuma mensagem no chat da guilda ainda.
                    </p>
                  ) : (
                    guildChat.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs"
                      >
                        <span className="font-bold text-amber-300">{m.senderName}: </span>
                        <span className="text-slate-200 break-words">{m.text}</span>
                      </div>
                    ))
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!guildChatInput.trim()) return;
                    onSendGuildChat(guildChatInput.trim());
                    setGuildChatInput('');
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={guildChatInput}
                    onChange={(e) => setGuildChatInput(e.target.value)}
                    maxLength={240}
                    placeholder="Mensagem para sua guilda..."
                    className="flex-1 rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <form
                onSubmit={handleGuildSubmit}
                className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-3"
              >
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Fundar Nova Guilda (Clã)</span>
                </h3>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <input
                    type="text"
                    value={guildName}
                    onChange={(e) => setGuildName(e.target.value)}
                    maxLength={28}
                    placeholder="Nome da Guilda..."
                    className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={guildTag}
                    onChange={(e) => setGuildTag(e.target.value.toUpperCase())}
                    maxLength={5}
                    placeholder="TAG (2-5)"
                    className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs text-amber-300 font-mono-num uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
                <input
                  type="text"
                  value={guildDesc}
                  onChange={(e) => setGuildDesc(e.target.value)}
                  maxLength={120}
                  placeholder="Lema ou descrição do clã..."
                  className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Fundar Guilda (+3% XP e Dano por Nível!)
                </button>
              </form>

              <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-2.5">
                <h3 className="text-sm font-bold text-white">Guildas Abertas</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {guilds.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      Nenhuma guilda criada ainda. Funde a primeira!
                    </p>
                  ) : (
                    guilds.map((g) => (
                      <div
                        key={g.id}
                        className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            <span className="text-amber-300">[{g.tag}]</span> {g.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            Nv.{g.level} · {g.memberCount}/30 membros · Líder {g.leaderName}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={g.memberCount >= 30}
                          onClick={() => onJoinGuild(g.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer shrink-0"
                        >
                          Entrar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

