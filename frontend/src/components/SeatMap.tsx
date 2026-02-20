'use client';

import { Skull } from 'lucide-react';

interface Player {
  id: string;
  pseudo: string;
  seatNumber?: number;
  isAlive?: boolean;
  roleName?: string;
  roleType?: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger';
}

interface SeatMapProps {
  players: Player[];
  totalSeats?: number;
  showRoles?: boolean;
  onSeatClick?: (seatNumber: number, player?: Player) => void;
  selectedSeat?: number;
}

const typeColors = {
  'Citadin': 'border-role-citadin',
  'Sbire': 'border-role-sbire',
  'Démon': 'border-role-demon',
  'Étranger': 'border-role-etranger',
};

export function SeatMap({
  players,
  totalSeats,
  showRoles = false,
  onSeatClick,
  selectedSeat,
}: SeatMapProps) {
  const seats = totalSeats || Math.max(players.length, 5);
  const playersBySeat = new Map<number, Player>();

  players.forEach((p) => {
    if (p.seatNumber) {
      playersBySeat.set(p.seatNumber, p);
    }
  });

  // Calculate positions in a circle
  const radius = 42; // percentage of container
  const centerX = 50;
  const centerY = 50;

  const getSeatPosition = (index: number) => {
    const angle = (index / seats) * 2 * Math.PI - Math.PI / 2; // Start from top
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { x, y };
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square">
      {/* Center decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-bg-card border border-border-color flex items-center justify-center">
        <span className="text-text-secondary text-sm font-display">Table</span>
      </div>

      {/* Seats */}
      {Array.from({ length: seats }, (_, i) => i + 1).map((seatNum) => {
        const player = playersBySeat.get(seatNum);
        const pos = getSeatPosition(seatNum - 1);
        const isSelected = selectedSeat === seatNum;
        const isDead = player?.isAlive === false;

        return (
          <button
            key={seatNum}
            onClick={() => onSeatClick?.(seatNum, player)}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
              onSeatClick ? 'cursor-pointer hover:scale-110' : ''
            }`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
          >
            <div
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex flex-col items-center justify-center text-xs transition-all ${
                player
                  ? `bg-bg-card border-2 ${
                      showRoles && player.roleType
                        ? typeColors[player.roleType]
                        : 'border-accent-gold'
                    } ${isDead ? 'opacity-50 grayscale' : ''}`
                  : 'bg-bg-secondary border-2 border-dashed border-border-color'
              } ${isSelected ? 'ring-2 ring-accent-gold scale-110' : ''}`}
            >
              {player ? (
                <>
                  <span className="font-bold text-xs truncate max-w-full px-1">
                    {player.pseudo.slice(0, 3)}
                  </span>
                  {isDead && <Skull className="w-3 h-3 text-text-secondary" />}
                </>
              ) : (
                <span className="text-text-secondary font-bold">{seatNum}</span>
              )}
            </div>
            {/* Seat number badge */}
            {player && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-bg-primary border border-border-color flex items-center justify-center text-xs font-bold">
                {seatNum}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
