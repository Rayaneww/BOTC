'use client';

import { useState } from 'react';
import { Skull, Shield, Eye, User } from 'lucide-react';
import { RoleBadge } from './RoleCard';

interface Role {
  id: string;
  name: string;
  type: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger';
  description: string;
}

interface RoleRevealProps {
  role: Role;
  seatNumber?: number | null;
  onConfirm: () => void;
}

const typeConfig = {
  'Démon': {
    gradient: 'from-red-900 via-red-800 to-red-950',
    glow: 'shadow-red-500/50',
    icon: Skull,
    iconColor: 'text-red-400',
    bgPattern: 'bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.3)_0%,transparent_70%)]',
    borderColor: 'border-red-500/50',
    title: 'Vous êtes un Démon',
    subtitle: 'Répandez le chaos et la destruction',
  },
  'Sbire': {
    gradient: 'from-purple-900 via-purple-800 to-purple-950',
    glow: 'shadow-purple-500/50',
    icon: Eye,
    iconColor: 'text-purple-400',
    bgPattern: 'bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.3)_0%,transparent_70%)]',
    borderColor: 'border-purple-500/50',
    title: 'Vous êtes un Sbire',
    subtitle: 'Servez votre maître démoniaque',
  },
  'Citadin': {
    gradient: 'from-blue-900 via-blue-800 to-blue-950',
    glow: 'shadow-blue-500/50',
    icon: Shield,
    iconColor: 'text-blue-400',
    bgPattern: 'bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.3)_0%,transparent_70%)]',
    borderColor: 'border-blue-500/50',
    title: 'Vous êtes un Citadin',
    subtitle: 'Protégez le village du mal',
  },
  'Étranger': {
    gradient: 'from-emerald-900 via-emerald-800 to-emerald-950',
    glow: 'shadow-emerald-500/50',
    icon: User,
    iconColor: 'text-emerald-400',
    bgPattern: 'bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.3)_0%,transparent_70%)]',
    borderColor: 'border-emerald-500/50',
    title: 'Vous êtes un Étranger',
    subtitle: 'Votre présence est un mystère',
  },
};

export function RoleReveal({ role, seatNumber, onConfirm }: RoleRevealProps) {
  const config = typeConfig[role.type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95">
      <div className={`w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl ${config.glow}`}>
        <div className={`bg-gradient-to-b ${config.gradient} p-6 sm:p-8`}>
          <div className="mb-6 flex justify-center">
            <div className={`w-24 h-24 rounded-full bg-black/30 flex items-center justify-center border-2 ${config.borderColor}`}>
              <Icon className={`w-12 h-12 ${config.iconColor}`} />
            </div>
          </div>

          <p className="text-white/60 text-sm uppercase tracking-widest text-center mb-1">
            {config.title}
          </p>

          <h2 className="font-display text-3xl font-bold text-white text-center mb-3">
            {role.name}
          </h2>

          <div className="flex justify-center mb-4">
            <RoleBadge type={role.type} />
          </div>

          {seatNumber && (
            <div className="bg-black/30 rounded-lg p-3 mb-4 text-center">
              <span className="text-white/60 text-sm">Votre siège :</span>
              <span className="ml-2 font-bold text-accent-gold text-lg">{seatNumber}</span>
            </div>
          )}

          <div className="bg-black/40 rounded-xl p-4 mb-6">
            <p className="text-white/90 text-sm leading-relaxed">{role.description}</p>
          </div>

          <button
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-accent-gold text-black font-bold text-base hover:bg-accent-gold/90 transition-colors"
          >
            J'ai mémorisé mon rôle
          </button>
        </div>
      </div>
    </div>
  );
}

// Compact version for the play page
export function RoleDisplay({ role, seatNumber }: { role: Role; seatNumber?: number | null }) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[role.type];
  const Icon = config.icon;

  return (
    <div className="card overflow-hidden">
      {/* Header with gradient */}
      <div className={`-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 p-4 sm:p-6 bg-gradient-to-r ${config.gradient}`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-black/30 backdrop-blur flex items-center justify-center border ${config.borderColor}`}>
            <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white truncate">
              {role.name}
            </h2>
            <RoleBadge type={role.type} />
          </div>
        </div>
      </div>

      {/* Seat number */}
      {seatNumber && (
        <div className="bg-bg-secondary rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-text-secondary">Votre siège</span>
          <span className="font-bold text-accent-gold text-lg">{seatNumber}</span>
        </div>
      )}

      {/* Description */}
      <div onClick={() => setExpanded(!expanded)} className="cursor-pointer">
        <p className={`text-text-secondary leading-relaxed transition-all ${
          expanded ? '' : 'line-clamp-3'
        }`}>
          {role.description}
        </p>
        {role.description.length > 150 && (
          <button className="text-primary text-sm mt-2 hover:underline">
            {expanded ? 'Voir moins ▲' : 'Voir plus ▼'}
          </button>
        )}
      </div>
    </div>
  );
}
