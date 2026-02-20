'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Users, Lock, Shield } from 'lucide-react';
import { api } from '@/lib/api';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const gameCode = (params.code as string).toUpperCase();

  const [gameInfo, setGameInfo] = useState<{
    name: string;
    hostPseudo: string;
    status: string;
    hasPassword: boolean;
    playerCount: number;
    scriptName: string;
  } | null>(null);

  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if already joined
    const token = localStorage.getItem(`player_token_${gameCode}`);
    if (token) {
      router.push(`/play/${gameCode}`);
      return;
    }

    // Load game info
    api
      .getGame(gameCode)
      .then((data) => {
        setGameInfo(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Partie non trouvée');
        setLoading(false);
      });
  }, [gameCode, router]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pseudo.trim()) {
      setError('Veuillez entrer un pseudo');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const data = await api.joinGame(gameCode, {
        pseudo: pseudo.trim(),
        password: password || undefined,
      });

      localStorage.setItem(`player_token_${gameCode}`, data.playerToken);
      localStorage.setItem('current_game', gameCode);
      localStorage.setItem('player_id', data.playerId);
      localStorage.setItem('is_host', 'false');

      router.push(`/play/${gameCode}`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la connexion');
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!gameInfo) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="card text-center max-w-md">
          <Shield className="w-16 h-16 text-accent-red mx-auto mb-4" />
          <h1 className="text-2xl font-display mb-2">Partie non trouvée</h1>
          <p className="text-text-secondary mb-6">
            {error || 'Cette partie n\'existe pas ou a été supprimée.'}
          </p>
          <button onClick={() => router.push('/')} className="btn btn-primary">
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (gameInfo.status !== 'lobby') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="card text-center max-w-md">
          <Shield className="w-16 h-16 text-accent-gold mx-auto mb-4" />
          <h1 className="text-2xl font-display mb-2">Partie en cours</h1>
          <p className="text-text-secondary mb-6">
            Cette partie a déjà commencé. Vous ne pouvez plus la rejoindre.
          </p>
          <button onClick={() => router.push('/')} className="btn btn-primary">
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-accent-gold mx-auto mb-3" />
          <h1 className="text-2xl font-display font-bold">{gameInfo.name}</h1>
          <p className="text-text-secondary">Hébergé par {gameInfo.hostPseudo}</p>
        </div>

        <div className="flex items-center justify-center gap-4 mb-6 text-sm text-text-secondary">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{gameInfo.playerCount} joueur(s)</span>
          </div>
          {gameInfo.hasPassword && (
            <div className="flex items-center gap-1">
              <Lock className="w-4 h-4" />
              <span>Protégé</span>
            </div>
          )}
        </div>

        <div className="bg-bg-secondary rounded-lg p-3 mb-6 text-center">
          <span className="text-sm text-text-secondary">Code de la partie</span>
          <p className="text-2xl font-mono font-bold tracking-widest text-accent-gold">
            {gameCode}
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">
              Votre pseudo *
            </label>
            <input
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              className="input"
              placeholder="Entrez votre pseudo"
              maxLength={20}
              required
              autoFocus
            />
          </div>

          {gameInfo.hasPassword && (
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && (
            <p className="text-accent-red text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={joining}
            className="btn btn-primary w-full py-4"
          >
            {joining ? (
              <span className="loading-dots">Connexion</span>
            ) : (
              'Rejoindre la partie'
            )}
          </button>
        </form>

        <button
          onClick={() => router.push('/')}
          className="btn btn-ghost w-full mt-4"
        >
          Retour
        </button>
      </div>
    </div>
  );
}
