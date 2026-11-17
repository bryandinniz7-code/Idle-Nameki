import React, { useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Eye,
  KeyRound,
  Plus,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { GameGlobalConfig, OnlinePlayer, PlayerSaveState } from '../game/types.ts';

export interface GameUiSettings {
  showMultiplayerRadar: boolean;
  showFloatingDamage: boolean;
  showRemoteVfx: boolean;
}

interface SettingsModalProps {
  player: PlayerSaveState;
  muted: boolean;
  uiSettings: GameUiSettings;
  isAdmin: boolean;
  canEditGlobalConfig: boolean;
  gameConfig: GameGlobalConfig;
  onlinePlayers: OnlinePlayer[];
  onToggleMute: () => void;
  onUpdateUiSettings: (next: GameUiSettings) => void;
  onRedeemCode: (rawCode: string) => { ok: boolean; message: string };
  onEquipTitle: (title: string) => void;
  onUpdateGameConfig: (next: GameGlobalConfig) => Promise<void>;
  onExportTransfer: () => Promise<{ ok: boolean; code?: string; message: string }>;
  onImportTransfer: (rawCode: string) => Promise<{ ok: boolean; message: string }>;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  player,
  muted,
  uiSettings,
  isAdmin,
  canEditGlobalConfig,
  gameConfig,
  onlinePlayers,
  onToggleMute,
  onUpdateUiSettings,
  onRedeemCode,
  onEquipTitle,
  onUpdateGameConfig,
  onExportTransfer,
  onImportTransfer,
  onClose,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [creatorInput, setCreatorInput] = useState('');
  const [adminInput, setAdminInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [exportedTransferCode, setExportedTransferCode] = useState('');
  const [importTransferInput, setImportTransferInput] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferFeedback, setTransferFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const redeemed = player.redeemedCodes ?? [];
  const hasJeffMod =
    redeemed.includes('JEFFGAMEMOD') || player.unlockedTransformations.includes('yamcha_ui');
  const hasNmdle = redeemed.includes('NMDLE');

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    const res = onRedeemCode(codeInput);
    setFeedback(res);
    if (res.ok) setCodeInput('');
  };

  const saveConfig = async (next: GameGlobalConfig) => {
    setSavingConfig(true);
    try {
      await onUpdateGameConfig(next);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddCreator = (nick: string) => {
    const clean = nick.trim();
    if (clean.length < 2) return;
    if (gameConfig.creatorNames.some((n) => n.toLowerCase() === clean.toLowerCase())) return;
    void saveConfig({
      ...gameConfig,
      creatorNames: [...gameConfig.creatorNames, clean].slice(0, 50),
    });
    setCreatorInput('');
  };

  const handleRemoveCreator = (nick: string) => {
    void saveConfig({
      ...gameConfig,
      creatorNames: gameConfig.creatorNames.filter((n) => n !== nick),
    });
  };

  const handleAddAdmin = (nick: string, uid?: string) => {
    const clean = nick.trim();
    const nextNames =
      clean.length >= 2 && !gameConfig.adminNames.some((n) => n.toLowerCase() === clean.toLowerCase())
        ? [...gameConfig.adminNames, clean].slice(0, 20)
        : gameConfig.adminNames;
    const nextUids =
      uid && !gameConfig.adminUids.includes(uid)
        ? [...gameConfig.adminUids, uid].slice(0, 20)
        : gameConfig.adminUids;
    void saveConfig({
      ...gameConfig,
      adminNames: nextNames,
      adminUids: nextUids,
    });
    setAdminInput('');
  };

  const handleRemoveAdmin = (nick: string) => {
    void saveConfig({
      ...gameConfig,
      adminNames: gameConfig.adminNames.filter((n) => n !== nick),
    });
  };

  const otherOnline = onlinePlayers.filter((op) => op.uid !== player.uid);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0B0F17] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="border-b border-slate-800 bg-[#131A26] px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-orange-500/15 border border-orange-500/40 text-orange-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-pixel text-sm text-white">CONFIGURAÇÕES</h2>
              <p className="text-[11px] text-slate-400">Áudio, interface e códigos secretos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            aria-label="Fechar configurações"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {/* Barra de Código Secreto */}
          <div className="rounded-xl border border-sky-500/35 bg-gradient-to-br from-[#131A26] to-sky-950/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-sky-300 flex items-center gap-2 uppercase tracking-wider">
                <KeyRound className="w-4 h-4" />
                <span>Barra de Código</span>
              </h3>
              <div className="flex items-center gap-1.5">
                {hasJeffMod && (
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-[10px] font-bold text-sky-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>30x PODER</span>
                  </span>
                )}
                {hasNmdle && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 text-[10px] font-bold text-amber-200 flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    <span>10x XP ADM</span>
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Digite um código secreto ou promocional para desbloquear transformações raras e bônus exclusivos.
            </p>

            <form onSubmit={handleSubmitCode} className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                maxLength={32}
                placeholder="Digite o código aqui..."
                aria-label="Barra de código secreto"
                className="flex-1 rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2.5 text-xs font-mono text-white uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer shrink-0 transition-colors"
              >
                Ativar
              </button>
            </form>

            {feedback && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
                  feedback.ok
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-red-500/50 bg-red-500/15 text-red-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedback.message}</span>
              </div>
            )}

            {redeemed.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-slate-400">Códigos ativados:</span>
                {redeemed.map((code) => (
                  <span
                    key={code}
                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-amber-300"
                  >
                    {code}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Painel ADM (Beta / Criadores / ADMs) */}
          {isAdmin && (
            <div className="rounded-xl border border-amber-500/45 bg-gradient-to-br from-[#131A26] to-amber-950/20 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-amber-300 flex items-center gap-2 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Painel ADM & Tester</span>
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onEquipTitle('ADM')}
                    className={`px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                      player.title === 'ADM'
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/30'
                    }`}
                  >
                    {player.title === 'ADM' ? 'Título ADM (Em uso)' : 'Usar Título ADM'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEquipTitle('Tester')}
                    className={`px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                      player.title === 'Tester'
                        ? 'bg-sky-400 text-slate-950 border-sky-300'
                        : 'bg-sky-500/20 border-sky-400/50 text-sky-200 hover:bg-sky-500/30'
                    }`}
                  >
                    {player.title === 'Tester' ? 'Título Tester (Em uso)' : 'Usar Título Tester'}
                  </button>
                  {!hasNmdle && (
                    <button
                      type="button"
                      onClick={() => {
                        const res = onRedeemCode('NMDLE');
                        setFeedback(res);
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold cursor-pointer"
                    >
                      Ativar 10x XP (NMDLE)
                    </button>
                  )}
                </div>
              </div>

              {!canEditGlobalConfig && (
                <p className="text-[11px] text-amber-200/80 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  Você é ADM pelo nick, mas apenas o dono ou UIDs autorizados no banco podem alterar a configuração global.
                </p>
              )}

              {/* Controle da Fase Beta (Título Tester) */}
              <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-white">Fase Beta (Título Tester)</p>
                    <p className="text-[10px] text-slate-400">
                      {gameConfig.betaActive
                        ? 'Aberta: quem jogar agora recebe o título "Tester".'
                        : 'Encerrada: novos jogadores não conseguem mais o título "Tester".'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canEditGlobalConfig || savingConfig}
                    onClick={() =>
                      void saveConfig({
                        ...gameConfig,
                        betaActive: !gameConfig.betaActive,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer disabled:opacity-50 ${
                      gameConfig.betaActive
                        ? 'bg-red-500/20 border border-red-400/60 text-red-200 hover:bg-red-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    }`}
                  >
                    {gameConfig.betaActive ? 'Encerrar Beta' : 'Reabrir Beta'}
                  </button>
                </div>
              </div>

              {/* Criadores de Conteúdo */}
              <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                  <Video className="w-3.5 h-3.5" />
                  <span>Criadores de Conteúdo (Título Exclusivo)</span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddCreator(creatorInput);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={creatorInput}
                    onChange={(e) => setCreatorInput(e.target.value)}
                    placeholder="Nick do criador de vídeo..."
                    maxLength={24}
                    disabled={!canEditGlobalConfig}
                    className="flex-1 rounded-lg border border-slate-700 bg-[#131A26] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
                  />
                  <button
                    type="submit"
                    disabled={!canEditGlobalConfig || savingConfig || creatorInput.trim().length < 2}
                    className="px-2.5 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </form>

                {otherOnline.length > 0 && canEditGlobalConfig && (
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="text-slate-400">Online agora:</span>
                    {otherOnline.slice(0, 5).map((op) => (
                      <button
                        key={`cr_${op.uid}`}
                        type="button"
                        onClick={() => handleAddCreator(op.name)}
                        className="px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-400/40 text-purple-200 hover:bg-purple-500/30 cursor-pointer"
                      >
                        + {op.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {gameConfig.creatorNames.length === 0 ? (
                    <span className="text-[10px] text-slate-500">
                      Nenhum criador adicionado ainda.
                    </span>
                  ) : (
                    gameConfig.creatorNames.map((nick) => (
                      <span
                        key={nick}
                        className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/50 text-[10px] font-semibold text-purple-200 flex items-center gap-1"
                      >
                        <span>{nick}</span>
                        {canEditGlobalConfig && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCreator(nick)}
                            className="text-purple-300 hover:text-red-300 cursor-pointer"
                            aria-label={`Remover criador ${nick}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Lista de ADMs */}
              <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Crown className="w-3.5 h-3.5" />
                  <span>ADMs (Título ADM + Código NMDLE 10x XP)</span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddAdmin(adminInput);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={adminInput}
                    onChange={(e) => setAdminInput(e.target.value)}
                    placeholder="Nick do ADM (ex: Sparkyy)..."
                    maxLength={24}
                    disabled={!canEditGlobalConfig}
                    className="flex-1 rounded-lg border border-slate-700 bg-[#131A26] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={!canEditGlobalConfig || savingConfig || adminInput.trim().length < 2}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </form>

                {otherOnline.length > 0 && canEditGlobalConfig && (
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="text-slate-400">Promover online:</span>
                    {otherOnline.slice(0, 5).map((op) => (
                      <button
                        key={`adm_${op.uid}`}
                        type="button"
                        onClick={() => handleAddAdmin(op.name, op.uid)}
                        className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                      >
                        + {op.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-semibold text-amber-200">
                    Dono (Root ADM)
                  </span>
                  {gameConfig.adminNames.map((nick) => (
                    <span
                      key={nick}
                      className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-semibold text-amber-200 flex items-center gap-1"
                    >
                      <span>{nick}</span>
                      {canEditGlobalConfig && nick.toLowerCase() !== 'sparkyy' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAdmin(nick)}
                          className="text-amber-300 hover:text-red-300 cursor-pointer"
                          aria-label={`Remover ADM ${nick}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Áudio */}
          <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Áudio</h3>
            <button
              type="button"
              onClick={onToggleMute}
              className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-[#0B0F17] px-3.5 py-2.5 text-xs hover:border-slate-600 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5 text-slate-200 font-medium">
                {muted ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>Efeitos Sonoros (16-bit)</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                  muted
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {muted ? 'DESLIGADO' : 'LIGADO'}
              </span>
            </button>
          </div>

          {/* Interface e Multiplayer */}
          <div className="rounded-xl border border-slate-800 bg-[#131A26] p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              <span>Interface & Multiplayer</span>
            </h3>

            {[
              {
                key: 'showMultiplayerRadar' as const,
                label: 'Radar de Jogadores Online no Mapa',
              },
              {
                key: 'showRemoteVfx' as const,
                label: 'Efeitos de Habilidades de Outros Jogadores',
              },
              {
                key: 'showFloatingDamage' as const,
                label: 'Números de Dano Flutuantes',
              },
            ].map((opt) => {
              const enabled = uiSettings[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    onUpdateUiSettings({
                      ...uiSettings,
                      [opt.key]: !enabled,
                    })
                  }
                  className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-[#0B0F17] px-3.5 py-2.5 text-xs hover:border-slate-600 transition-colors cursor-pointer"
                >
                  <span className="text-slate-200 font-medium">{opt.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      enabled
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {enabled ? 'ATIVO' : 'OCULTO'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Transferência de Progresso entre Contas */}
          <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-br from-[#131A26] to-emerald-950/15 p-4 space-y-3">
            <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              Transferência de Conta
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Exporte todo o progresso desta conta (nível, itens, equipamentos, transformações, títulos, Zeni e esferas) para transferir para outra conta sua.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                disabled={transferBusy}
                onClick={async () => {
                  setTransferBusy(true);
                  setTransferFeedback(null);
                  try {
                    const res = await onExportTransfer();
                    if (res.ok && res.code) {
                      setExportedTransferCode(res.code);
                      try {
                        await navigator.clipboard.writeText(res.code);
                      } catch {
                        // Clipboard optional
                      }
                    }
                    setTransferFeedback({ ok: res.ok, message: res.message });
                  } finally {
                    setTransferBusy(false);
                  }
                }}
                className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer"
              >
                {transferBusy ? 'Processando...' : 'Gerar & Copiar Código de Transferência'}
              </button>

              {exportedTransferCode && (
                <textarea
                  readOnly
                  value={exportedTransferCode}
                  onFocus={(e) => e.currentTarget.select()}
                  rows={2}
                  className="w-full rounded-lg border border-emerald-500/40 bg-[#0B0F17] p-2 text-[10px] font-mono text-emerald-200 select-all"
                />
              )}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!importTransferInput.trim()) return;
                setTransferBusy(true);
                setTransferFeedback(null);
                try {
                  const res = await onImportTransfer(importTransferInput);
                  setTransferFeedback(res);
                  if (res.ok) setImportTransferInput('');
                } finally {
                  setTransferBusy(false);
                }
              }}
              className="space-y-2 pt-1 border-t border-slate-800"
            >
              <input
                type="text"
                value={importTransferInput}
                onChange={(e) => setImportTransferInput(e.target.value)}
                placeholder="Cole aqui o código IDLENK1... da conta antiga"
                className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-[11px] font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={transferBusy || !importTransferInput.trim()}
                className="w-full py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Transferir Progresso para Esta Conta
              </button>
            </form>

            {transferFeedback && (
              <div
                className={`rounded-lg border px-3 py-2 text-[11px] ${
                  transferFeedback.ok
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-red-500/50 bg-red-500/15 text-red-200'
                }`}
              >
                {transferFeedback.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
