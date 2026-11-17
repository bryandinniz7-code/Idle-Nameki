import React, { useState } from 'react';
import { LogIn, Shield, Sparkles, Swords, Users } from 'lucide-react';
import { RACES } from '../game/data.ts';
import type { RaceId } from '../game/types.ts';
import { WarriorPixelSprite } from './PixelSprites.tsx';

interface AuthAndCreationProps {
  mode: 'auth' | 'create';
  authLoading: boolean;
  authError: string | null;
  onGoogleLogin: () => void;
  onCreateCharacter: (name: string, race: RaceId) => Promise<void>;
  onSignOut?: () => void;
  userEmail?: string | null;
}

export const AuthAndCreation: React.FC<AuthAndCreationProps> = ({
  mode,
  authLoading,
  authError,
  onGoogleLogin,
  onCreateCharacter,
  onSignOut,
  userEmail,
}) => {
  const [name, setName] = useState('');
  const [selectedRace, setSelectedRace] = useState<RaceId>('namekian');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedRaceInfo = RACES.find((r) => r.id === selectedRace) ?? RACES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 24) {
      setFormError('O nome do guerreiro deve ter entre 2 e 24 caracteres.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await onCreateCharacter(trimmed, selectedRace);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar personagem.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Clean 3-zone top bar */}
      <header className="border-b border-slate-800/80 bg-[#0B0F17]/95 px-6 py-4 flex items-center justify-between gap-8">
        <span className="font-pixel text-base sm:text-lg tracking-wider text-orange-400 whitespace-nowrap shrink-0">
          IDLE NAMEKI
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <span className="whitespace-nowrap shrink-0">MMORPG Idle 2D</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap shrink-0">12 Mapas Galácticos</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap shrink-0">Progresso AFK em Nuvem</span>
        </nav>
        <div className="shrink-0">
          {mode === 'auth' ? (
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={authLoading}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-slate-950 font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              {authLoading ? 'Conectando...' : 'Entrar'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignOut}
              className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              Trocar Conta
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {mode === 'auth' ? (
          <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-stretch">
            <div className="rounded-xl border border-slate-800 bg-[#131A26] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-orange-500/40 bg-[#0B0F17] shrink-0">
                    <img
                      src="/src/assets/images/hero_namek_emblem_1794876902101.jpg"
                      alt="Emblema Idle Nameki"
                      className="w-full h-full object-cover pixelated"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-sky-400 font-medium">
                      RPG Pixel Art · Combate Automático
                    </p>
                    <h1 className="font-pixel text-2xl sm:text-3xl text-white mt-1 text-balance">
                      IDLE NAMEKI
                    </h1>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
                  Crie seu guerreiro, domine 12 mapas icônicos da Terra ao Planeta Beerus, colete
                  equipamentos místicos, libere transformações de Ki até o Instinto Superior e
                  continue evoluindo mesmo com o navegador fechado.
                </p>

                <div className="grid sm:grid-cols-2 gap-3 mb-8 text-xs text-slate-300">
                  <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3.5 flex items-start gap-3">
                    <Swords className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">AFK Real no Servidor</p>
                      <p className="text-slate-400 mt-0.5">
                        XP, Zeni, monstros e drops calculados com segurança ao retornar.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3.5 flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">8 Transformações de Ki</p>
                      <p className="text-slate-400 mt-0.5">
                        Do Kaioken ao Super Saiyajin Blue e Instinto Superior.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3.5 flex items-start gap-3">
                    <Shield className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">Chefes & Equipamentos</p>
                      <p className="text-slate-400 mt-0.5">
                        Espada Z, Brincos Potara e chefes com raridade até Mítico.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3.5 flex items-start gap-3">
                    <Users className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">Multiplayer Online</p>
                      <p className="text-slate-400 mt-0.5">
                        Chat global, grupos, ranking e guerreiros visíveis nos mapas.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {authError && (
                  <p className="text-xs text-red-400 bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-2">
                    {authError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  disabled={authLoading}
                  className="w-full py-3.5 px-6 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                >
                  <LogIn className="w-5 h-5" />
                  <span>{authLoading ? 'Autenticando...' : 'Entrar com Google e Jogar'}</span>
                </button>
                <p className="text-[11px] text-slate-400 text-center">
                  Seu personagem e inventário ficam salvos automaticamente na nuvem.
                </p>
              </div>
            </div>

            <div className="relative rounded-xl border border-slate-800 overflow-hidden bg-[#131A26] min-h-[320px] flex flex-col justify-end">
              <img
                src="/src/assets/images/pixel_arena_earth_namek_1794876900814.jpg"
                alt="Arena Pixel Art Idle Nameki"
                className="absolute inset-0 w-full h-full object-cover pixelated"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/40 to-transparent" />

              <div className="relative z-10 p-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-orange-400 font-medium">Prévia da Arena 2D</p>
                  <h2 className="font-pixel text-lg text-white mt-1">Planeta Namekusei & Terra</h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Combate automático em tempo real com sprites animados e efeitos de Ki.
                  </p>
                </div>
                <div className="shrink-0">
                  <WarriorPixelSprite race="namekian" transformationId="ssj" size={88} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-3xl rounded-xl border border-slate-800 bg-[#131A26] p-6 sm:p-8 space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs text-sky-400">
                  Novo Guerreiro · {userEmail ?? 'Conta Conectada'}
                </p>
                <h1 className="font-pixel text-xl sm:text-2xl text-white mt-1">
                  Criação de Personagem
                </h1>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0B0F17] px-4 py-2 flex items-center gap-3">
                <WarriorPixelSprite race={selectedRace} transformationId="base" size={56} />
                <div>
                  <p className="text-xs text-slate-400">Raça Selecionada</p>
                  <p className="text-sm font-semibold text-orange-400">{selectedRaceInfo.name}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="warrior-name" className="block text-sm font-medium text-slate-200">
                Nome do Guerreiro
              </label>
              <input
                id="warrior-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                required
                placeholder="Ex: Nail, GohanBR, PiccoloZ..."
                className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-2.5">
              <span className="block text-sm font-medium text-slate-200">Escolha sua Linhagem</span>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {RACES.map((race) => {
                  const active = race.id === selectedRace;
                  return (
                    <button
                      key={race.id}
                      type="button"
                      onClick={() => setSelectedRace(race.id)}
                      className={`text-left rounded-lg border p-3.5 transition-colors cursor-pointer ${
                        active
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-slate-800 bg-[#0B0F17] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <WarriorPixelSprite race={race.id} transformationId="base" size={44} />
                        <div>
                          <p className="text-sm font-bold text-white">{race.name}</p>
                          <p className="text-[11px] text-sky-400">{race.innateBonus}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{race.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {(authError || formError) && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-2 break-words">
                {formError ?? authError}
              </p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                {submitting ? 'Criando Guerreiro...' : 'Iniciar Jornada em Namek'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};
