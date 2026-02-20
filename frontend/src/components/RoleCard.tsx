'use client';

import { useState } from 'react';
import { Skull, Shield, Eye, User, ChevronDown, ChevronUp } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  type: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger';
  description: string;
}

interface RoleCardProps {
  role: Role;
  selected?: boolean;
  onClick?: () => void;
  showDescription?: boolean;
  compact?: boolean;
}

const typeConfig = {
  'Démon': {
    color: 'role-demon',
    bgColor: 'bg-role-demon/10',
    borderColor: 'border-role-demon/30',
    icon: Skull,
  },
  'Sbire': {
    color: 'role-sbire',
    bgColor: 'bg-role-sbire/10',
    borderColor: 'border-role-sbire/30',
    icon: Eye,
  },
  'Citadin': {
    color: 'role-citadin',
    bgColor: 'bg-role-citadin/10',
    borderColor: 'border-role-citadin/30',
    icon: Shield,
  },
  'Étranger': {
    color: 'role-etranger',
    bgColor: 'bg-role-etranger/10',
    borderColor: 'border-role-etranger/30',
    icon: User,
  },
};

export function RoleCard({
  role,
  selected = false,
  onClick,
  showDescription = true,
  compact = false,
}: RoleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[role.type];
  const Icon = config.icon;

  const handleToggleDescription = (e: React.MouseEvent) => {
    if (!onClick) {
      e.stopPropagation();
      setExpanded(!expanded);
    }
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
          selected
            ? `${config.bgColor} border-${config.color} ring-2 ring-${config.color}/30`
            : `bg-bg-secondary border-border-color hover:${config.bgColor}`
        }`}
      >
        <Icon className={`w-4 h-4 text-${config.color}`} />
        <span className="text-sm font-medium">{role.name}</span>
      </button>
    );
  }

  return (
    <div
      onClick={onClick || handleToggleDescription}
      className={`card card-hover cursor-pointer transition-all ${
        selected ? `ring-2 ring-${config.color}/50 ${config.bgColor}` : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0`}
        >
          <Icon className={`w-5 h-5 text-${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display text-lg font-semibold truncate">
              {role.name}
            </h3>
            <span className={`badge badge-${role.type.toLowerCase()}`}>
              {role.type}
            </span>
          </div>
          {showDescription && (
            <div>
              <p className={`text-sm text-text-secondary ${expanded ? '' : 'line-clamp-2'}`}>
                {role.description}
              </p>
              {role.description.length > 100 && (
                <button
                  onClick={handleToggleDescription}
                  className="flex items-center gap-1 mt-2 text-xs text-primary hover:text-primary-hover transition-colors"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Réduire
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Voir plus
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RoleBadge({ type }: { type: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger' }) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <span className={`badge ${config.bgColor} text-${config.color} border ${config.borderColor}`}>
      <Icon className="w-3 h-3 mr-1" />
      {type}
    </span>
  );
}
