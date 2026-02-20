'use client';

import { CheckCircle, Circle, Crown, Skull, XCircle, UserMinus } from 'lucide-react';

interface Player {
  id: string;
  pseudo: string;
  isReady: boolean;
  hasSeat: boolean;
  hasRole: boolean;
  seatNumber?: number;
  isAlive?: boolean;
  roleId?: string;
  roleName?: string;
  roleType?: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger';
}

interface PlayerListProps {
  players: Player[];
  isHost?: boolean;
  showRoles?: boolean;
  gameStarted?: boolean;
  onPlayerClick?: (player: Player) => void;
  onKick?: (player: Player) => void;
  selectedPlayerId?: string;
}

const typeColors = {
  'Citadin': 'text-role-citadin',
  'Sbire': 'text-role-sbire',
  'Démon': 'text-role-demon',
  'Étranger': 'text-role-etranger',
};

export function PlayerList({
  players,
  isHost = false,
  showRoles = false,
  gameStarted = false,
  onPlayerClick,
  onKick,
  selectedPlayerId,
}: PlayerListProps) {
  // Trier par numéro de siège si disponible
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.seatNumber && b.seatNumber) return a.seatNumber - b.seatNumber;
    if (a.seatNumber) return -1;
    if (b.seatNumber) return 1;
    return 0;
  });

  return (
    <div className="space-y-2">
      {sortedPlayers.map((player) => (
        <div
          key={player.id}
          onClick={() => onPlayerClick?.(player)}
          className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
            onPlayerClick ? 'cursor-pointer' : ''
          } ${
            selectedPlayerId === player.id
              ? 'bg-accent-gold/10 border border-accent-gold/30'
              : 'bg-bg-secondary hover:bg-bg-secondary/80'
          } ${player.isAlive === false ? 'opacity-50' : ''}`}
        >
          {/* Seat number */}
          {player.seatNumber && (
            <div className="w-8 h-8 rounded-full bg-bg-card flex items-center justify-center text-sm font-bold border border-border-color">
              {player.seatNumber}
            </div>
          )}

          {/* Player info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{player.pseudo}</span>
              {player.isAlive === false && <Skull className="w-4 h-4 text-text-secondary" />}
            </div>

            {/* Role info for host */}
            {isHost && showRoles && player.roleName && (
              <span className={`text-sm ${typeColors[player.roleType!] || 'text-text-secondary'}`}>
                {player.roleName}
              </span>
            )}
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {!gameStarted && (
              <>
                {player.isReady ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-text-secondary" />
                )}
              </>
            )}

            {isHost && !gameStarted && (
              <div className="flex gap-1">
                {player.hasSeat ? (
                  <span className="text-xs text-green-500">S✓</span>
                ) : (
                  <span className="text-xs text-text-secondary">S-</span>
                )}
                {player.hasRole ? (
                  <span className="text-xs text-green-500">R✓</span>
                ) : (
                  <span className="text-xs text-text-secondary">R-</span>
                )}
              </div>
            )}
            
            {/* Kick button for host in lobby */}
            {isHost && !gameStarted && onKick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onKick(player);
                }}
                className="p-1.5 hover:bg-accent-red/20 rounded transition-colors group"
                title="Expulser le joueur"
              >
                <UserMinus className="w-4 h-4 text-text-secondary group-hover:text-accent-red" />
              </button>
            )}
          </div>
        </div>
      ))}

      {players.length === 0 && (
        <div className="text-center text-text-secondary py-8">
          Aucun joueur pour le moment
        </div>
      )}
    </div>
  );
}
