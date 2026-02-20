'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Users, Scroll, Shield } from 'lucide-react';
import { api } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create game form
  const [gameName, setGameName] = useState('');
  const [hostPseudo, setHostPseudo] = useState('');
  const [password, setPassword] = useState('');

  // Join game form
  const [gameCode, setGameCode] = useState('');
  const [playerPseudo, setPlayerPseudo] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameName.trim() || !hostPseudo.trim()) {
      setError('Tous les champs obligatoires doivent être remplis');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.createGame({
        name: gameName.trim(),
        hostPseudo: hostPseudo.trim(),
        password: password || undefined,
      });

      // Stocker le token
      localStorage.setItem(`host_token_${data.gameCode}`, data.hostToken);
      localStorage.setItem('current_game', data.gameCode);
      localStorage.setItem('is_host', 'true');

      router.push(`/host/${data.gameCode}`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = gameCode.trim().toUpperCase();
    if (!code || !playerPseudo.trim()) {
      setError('Code de partie et pseudo requis');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.joinGame(code, {
        pseudo: playerPseudo.trim(),
        password: joinPassword || undefined,
      });

      // Stocker le token
      localStorage.setItem(`player_token_${code}`, data.playerToken);
      localStorage.setItem('current_game', code);
      localStorage.setItem('player_id', data.playerId);
      localStorage.setItem('is_host', 'false');

      router.push(`/play/${code}`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shield className="w-10 h-10 text-accent-red" />
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient">
            BOTC
          </h1>
        </div>
        <p className="text-text-secondary text-lg">
          Blood on the Clocktower Companion
        </p>
      </div>

      {/* Main content */}
      <div className="w-full max-w-md">
        {mode === 'none' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="btn btn-primary w-full py-4 text-lg"
            >
              <Crown className="w-5 h-5" />
              Créer une partie
            </button>
            <button
              onClick={() => setMode('join')}
              className="btn btn-secondary w-full py-4 text-lg"
            >
              <Users className="w-5 h-5" />
              Rejoindre une partie
            </button>
            <div className="divider" />
            <button
              onClick={() => router.push('/scripts')}
              className="btn btn-ghost w-full"
            >
              <Scroll className="w-5 h-5" />
              Voir les scripts disponibles
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="card">
            <h2 className="text-2xl font-display mb-6 text-center">
              Créer une partie
            </h2>
            <form onSubmit={handleCreateGame} className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Nom de la partie *
                </label>
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  className="input"
                  placeholder="Partie du soir"
                  maxLength={50}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Votre pseudo (MJ) *
                </label>
                <input
                  type="text"
                  value={hostPseudo}
                  onChange={(e) => setHostPseudo(e.target.value)}
                  className="input"
                  placeholder="Maître du jeu"
                  maxLength={20}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Mot de passe (optionnel)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  maxLength={50}
                />
              </div>

              {error && (
                <p className="text-accent-red text-sm text-center">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('none');
                    setError('');
                  }}
                  className="btn btn-ghost flex-1"
                  disabled={loading}
                >
                  Retour
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading-dots">Création</span>
                  ) : (
                    'Créer'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {mode === 'join' && (
          <div className="card">
            <h2 className="text-2xl font-display mb-6 text-center">
              Rejoindre une partie
            </h2>
            <form onSubmit={handleJoinGame} className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Code de la partie *
                </label>
                <input
                  type="text"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  className="input text-center text-2xl tracking-widest font-mono"
                  placeholder="ABC123"
                  maxLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Votre pseudo *
                </label>
                <input
                  type="text"
                  value={playerPseudo}
                  onChange={(e) => setPlayerPseudo(e.target.value)}
                  className="input"
                  placeholder="Votre pseudo"
                  maxLength={20}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Mot de passe (si requis)
                </label>
                <input
                  type="password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  maxLength={50}
                />
              </div>

              {error && (
                <p className="text-accent-red text-sm text-center">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('none');
                    setError('');
                  }}
                  className="btn btn-ghost flex-1"
                  disabled={loading}
                >
                  Retour
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading-dots">Connexion</span>
                  ) : (
                    'Rejoindre'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto pt-8 text-center text-text-secondary text-sm">
        <p>Thème dark fantasy • PWA mobile-first</p>
      </footer>
    </div>
  );
}
