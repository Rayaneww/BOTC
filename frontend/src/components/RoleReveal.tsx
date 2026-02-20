'use client';

import { useState, useEffect } from 'react';
import { Skull, Shield, Eye, User, Sparkles, X } from 'lucide-react';
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
  onClose?: () => void;
  autoShow?: boolean;
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

export function RoleReveal({ role, seatNumber, onClose, autoShow = false }: RoleRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

  const config = typeConfig[role.type];
  const Icon = config.icon;

  useEffect(() => {
    if (autoShow) {
      setIsVisible(true);
      // Animation sequence
      setTimeout(() => setIsRevealed(true), 500);
      setTimeout(() => setShowDescription(true), 1500);
    }
  }, [autoShow]);

  const handleReveal = () => {
    setIsVisible(true);
    setTimeout(() => setIsRevealed(true), 500);
    setTimeout(() => setShowDescription(true), 1500);
  };

  const handleClose = () => {
    setShowDescription(false);
    setTimeout(() => setIsRevealed(false), 200);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 500);
  };

  if (!isVisible && !autoShow) {
    return (
      <button
        onClick={handleReveal}
        className="w-full card card-hover text-center py-8 group"
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-accent-gold/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Sparkles className="w-10 h-10 text-accent-gold animate-pulse" />
        </div>
        <h3 className="font-display text-xl mb-2">Révéler mon rôle</h3>
        <p className="text-sm text-text-secondary">Appuyez pour découvrir votre identité</p>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 role-reveal-overlay">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-white/20 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Close button */}
      {onClose && (
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      {/* Main card */}
      <div
        className={`relative w-full max-w-sm mx-auto perspective-1000 ${
          isRevealed ? 'card-revealed' : ''
        }`}
      >
        {/* Card flip container */}
        <div className={`relative w-full transform-style-3d transition-transform duration-700 ${
          isRevealed ? 'rotate-y-0' : 'rotate-y-180'
        }`}>
          {/* Front of card (hidden initially) */}
          <div className={`w-full rounded-2xl overflow-hidden shadow-2xl ${config.glow} ${
            isRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          } transition-all duration-500`}>
            {/* Gradient background */}
            <div className={`bg-gradient-to-b ${config.gradient} ${config.bgPattern} p-6 sm:p-8`}>
              {/* Icon container with glow */}
              <div className="relative mb-6">
                <div className={`absolute inset-0 blur-3xl ${config.iconColor} opacity-30`} />
                <div className={`relative w-24 h-24 sm:w-32 sm:h-32 mx-auto rounded-full bg-black/30 backdrop-blur flex items-center justify-center border-2 ${config.borderColor} role-icon-container`}>
                  <Icon className={`w-12 h-12 sm:w-16 sm:h-16 ${config.iconColor} role-icon`} />
                </div>
              </div>

              {/* Type badge */}
              <div className="text-center mb-4">
                <p className="text-white/60 text-sm uppercase tracking-widest mb-1">
                  {config.title}
                </p>
              </div>

              {/* Role name */}
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white text-center mb-2 role-name">
                {role.name}
              </h2>

              {/* Role badge */}
              <div className="flex justify-center mb-4">
                <RoleBadge type={role.type} />
              </div>

              {/* Seat number */}
              {seatNumber && (
                <div className="bg-black/30 backdrop-blur rounded-lg p-3 mb-4 text-center">
                  <span className="text-white/60 text-sm">Votre siège :</span>
                  <span className="ml-2 font-bold text-accent-gold text-lg">{seatNumber}</span>
                </div>
              )}

              {/* Description */}
              <div className={`bg-black/40 backdrop-blur rounded-xl p-4 transition-all duration-500 ${
                showDescription ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}>
                <p className="text-white/90 text-sm sm:text-base leading-relaxed">
                  {role.description}
                </p>
              </div>

              {/* Bottom decoration */}
              <div className="mt-6 flex justify-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${config.iconColor} opacity-60`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tap to continue hint */}
        {showDescription && onClose && (
          <p className="text-center text-white/40 text-sm mt-4 animate-pulse">
            Appuyez n'importe où pour continuer
          </p>
        )}
      </div>

      {/* Tap anywhere to close */}
      {showDescription && onClose && (
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={handleClose}
          style={{ zIndex: -1 }}
        />
      )}
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
