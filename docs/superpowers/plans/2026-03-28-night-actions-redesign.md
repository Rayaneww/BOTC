# Night Actions & UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer le vote, ajouter des actions nocturnes privées sur le téléphone du joueur, afficher le rôle une seule fois, et ajouter la table ronde à la vue joueur.

**Architecture:** Option A (socket direct, sans persistance) — le joueur émet `submit_night_action`, le serveur valide et relaye au host. L'écran "yeux fermés" est un overlay fixed qui se lève quand le conteur appelle le joueur (`nightCallActive` déjà existant). Le vote est supprimé entièrement côté backend et frontend.

**Tech Stack:** Node.js + Socket.IO (backend), Next.js 14 + React + Tailwind (frontend), TypeScript, vitest (tests backend).

---

## File Map

**Supprimer :**
- `backend/src/services/MeetingService.ts`

**Créer :**
- `backend/src/utils/nightAction.ts` — Mapping rôle→action + validation pure
- `backend/src/tests/nightAction.test.ts` — Tests vitest
- `frontend/src/components/NightEyesClosed.tsx` — Overlay "Fermez les yeux"
- `frontend/src/components/NightActionUI.tsx` — UI d'action nocturne par rôle

**Modifier :**
- `backend/src/socket.ts` — Supprimer vote/meeting, ajouter `submit_night_action` + `send_night_info`
- `frontend/src/lib/socket.ts` — Supprimer types meeting, ajouter types nuit
- `frontend/src/hooks/useSocket.ts` — Supprimer fonctions meeting/vote, ajouter fonctions nuit
- `frontend/src/components/RoleReveal.tsx` — Supprimer animations, ajouter bouton confirmation
- `frontend/src/app/play/[code]/page.tsx` — Rôle une fois, yeux fermés, actions nuit, onglet Table
- `frontend/src/app/host/[code]/page.tsx` — Supprimer UI vote, ajouter dashboard nuit

---

## Task 1 : Écrire les tests échouants pour nightAction

**Files:**
- Create: `backend/src/tests/nightAction.test.ts`

- [ ] **Créer le fichier de test**

```typescript
// backend/src/tests/nightAction.test.ts
import { describe, it, expect } from 'vitest'
import { NIGHT_ACTION_CONFIG, getNightActionType, validateNightAction } from '../utils/nightAction.js'

describe('NIGHT_ACTION_CONFIG', () => {
  it('maps Diablotin to choose_target', () => {
    expect(NIGHT_ACTION_CONFIG['Diablotin']).toBe('choose_target')
  })
  it('maps Empoisonneur to choose_target', () => {
    expect(NIGHT_ACTION_CONFIG['Empoisonneur']).toBe('choose_target')
  })
  it('maps Moine to choose_target', () => {
    expect(NIGHT_ACTION_CONFIG['Moine']).toBe('choose_target')
  })
  it('maps Voyante to choose_two', () => {
    expect(NIGHT_ACTION_CONFIG['Voyante']).toBe('choose_two')
  })
  it('maps Majordome to choose_master', () => {
    expect(NIGHT_ACTION_CONFIG['Majordome']).toBe('choose_master')
  })
  it('maps all info-receiver roles', () => {
    for (const role of ['Archiviste', 'Enquêteur', 'Lavandière', 'Cuistot', 'Empathe', 'Fossoyeur']) {
      expect(NIGHT_ACTION_CONFIG[role]).toBe('info_receiver')
    }
  })
})

describe('getNightActionType', () => {
  it('returns none for unknown roles', () => {
    expect(getNightActionType('Baron')).toBe('none')
    expect(getNightActionType('Soldat')).toBe('none')
    expect(getNightActionType('')).toBe('none')
  })
  it('returns the correct type for known roles', () => {
    expect(getNightActionType('Diablotin')).toBe('choose_target')
    expect(getNightActionType('Voyante')).toBe('choose_two')
  })
})

describe('validateNightAction', () => {
  const alive = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]

  describe('choose_target', () => {
    it('rejects missing targetId', () => {
      expect(validateNightAction('choose_target', undefined, undefined, alive)).toEqual({
        valid: false, error: 'targetId requis',
      })
    })
    it('rejects a dead/unknown player', () => {
      expect(validateNightAction('choose_target', 'dead-id', undefined, alive)).toEqual({
        valid: false, error: 'Joueur invalide ou mort',
      })
    })
    it('accepts a valid alive player', () => {
      expect(validateNightAction('choose_target', 'p1', undefined, alive)).toEqual({ valid: true })
    })
  })

  describe('choose_master', () => {
    it('accepts an alive player', () => {
      expect(validateNightAction('choose_master', 'p2', undefined, alive)).toEqual({ valid: true })
    })
    it('rejects a dead player', () => {
      expect(validateNightAction('choose_master', 'nobody', undefined, alive)).toEqual({
        valid: false, error: 'Joueur invalide ou mort',
      })
    })
  })

  describe('choose_two', () => {
    it('rejects fewer than 2 ids', () => {
      expect(validateNightAction('choose_two', undefined, ['p1'], alive)).toEqual({
        valid: false, error: '2 joueurs requis',
      })
    })
    it('rejects duplicate ids', () => {
      expect(validateNightAction('choose_two', undefined, ['p1', 'p1'], alive)).toEqual({
        valid: false, error: 'Les deux joueurs doivent être distincts',
      })
    })
    it('accepts 2 distinct players (dead players allowed for Voyante)', () => {
      expect(validateNightAction('choose_two', undefined, ['p1', 'dead-player'], alive)).toEqual({
        valid: true,
      })
    })
  })
})
```

- [ ] **Lancer les tests — s'assurer qu'ils échouent (module introuvable)**

```bash
cd backend && npx vitest run src/tests/nightAction.test.ts
```

Résultat attendu : `FAIL` avec `Cannot find module '../utils/nightAction.js'`

---

## Task 2 : Implémenter nightAction.ts (faire passer les tests)

**Files:**
- Create: `backend/src/utils/nightAction.ts`

- [ ] **Créer le fichier utilitaire**

```typescript
// backend/src/utils/nightAction.ts

export type NightActionType =
  | 'choose_target'
  | 'choose_two'
  | 'choose_master'
  | 'info_receiver'
  | 'none'

export const NIGHT_ACTION_CONFIG: Record<string, NightActionType> = {
  'Diablotin': 'choose_target',
  'Empoisonneur': 'choose_target',
  'Moine': 'choose_target',
  'Voyante': 'choose_two',
  'Majordome': 'choose_master',
  'Archiviste': 'info_receiver',
  'Enquêteur': 'info_receiver',
  'Lavandière': 'info_receiver',
  'Cuistot': 'info_receiver',
  'Empathe': 'info_receiver',
  'Fossoyeur': 'info_receiver',
}

export function getNightActionType(roleName: string): NightActionType {
  return NIGHT_ACTION_CONFIG[roleName] ?? 'none'
}

export function validateNightAction(
  actionType: NightActionType,
  targetId: string | undefined,
  targetIds: string[] | undefined,
  alivePlayers: { id: string }[]
): { valid: boolean; error?: string } {
  const aliveIds = new Set(alivePlayers.map((p) => p.id))

  if (actionType === 'choose_target' || actionType === 'choose_master') {
    if (!targetId) return { valid: false, error: 'targetId requis' }
    if (!aliveIds.has(targetId)) return { valid: false, error: 'Joueur invalide ou mort' }
    return { valid: true }
  }

  if (actionType === 'choose_two') {
    if (!targetIds || targetIds.length !== 2) return { valid: false, error: '2 joueurs requis' }
    if (new Set(targetIds).size !== 2)
      return { valid: false, error: 'Les deux joueurs doivent être distincts' }
    return { valid: true }
  }

  return { valid: false, error: "Type d'action non supporté" }
}
```

- [ ] **Lancer les tests — s'assurer qu'ils passent**

```bash
cd backend && npx vitest run src/tests/nightAction.test.ts
```

Résultat attendu : `PASS` — tous les tests verts.

- [ ] **Commit**

```bash
cd backend && git add src/utils/nightAction.ts src/tests/nightAction.test.ts
git commit -m "feat(backend): add night action validation utility with tests"
```

---

## Task 3 : Supprimer le système de vote du backend

**Files:**
- Modify: `backend/src/socket.ts`
- Delete: `backend/src/services/MeetingService.ts`

- [ ] **Supprimer l'import MeetingService (ligne 6 de socket.ts)**

Remplacer :
```typescript
import { meetingService } from './services/MeetingService.js';
```
Par : *(supprimer cette ligne)*

- [ ] **Ajouter l'import de validateNightAction et getNightActionType (juste après les autres imports)**

```typescript
import { validateNightAction, getNightActionType } from './utils/nightAction.js';
```

- [ ] **Dans le case `change_phase`, supprimer le bloc auto-meeting**

Remplacer :
```typescript
        case 'change_phase': {
          const { phase, dayNumber } = data.payload;
          gameService.updateGameState(game.id, { phase, dayNumber });

          io.to(roomName).emit('phase_changed', { phase, dayNumber });

          if (phase === 'night') {
            const meeting = meetingService.startMeeting(game.id);
            io.to(roomName).emit('meeting_started', {
              meetingNumber: meeting.meetingNumber,
              status: 'nomination',
            });
          }
          break;
        }
```

Par :
```typescript
        case 'change_phase': {
          const { phase, dayNumber } = data.payload;
          gameService.updateGameState(game.id, { phase, dayNumber });
          io.to(roomName).emit('phase_changed', { phase, dayNumber });
          break;
        }
```

- [ ] **Supprimer les 7 cases de vote/meeting dans le switch de handleHostConnection**

Supprimer en entier les cases suivants (trouver chaque `case '...' :` et supprimer jusqu'au `break;`) :
- `case 'start_meeting':`
- `case 'nominate_player':`
- `case 'remove_nomination':`
- `case 'start_voting':`
- `case 'end_voting':`
- `case 'confirm_elimination':`
- `case 'end_meeting_no_vote':`

- [ ] **Dans `handlePlayerConnection`, supprimer le listener `cast_vote`**

Supprimer en entier :
```typescript
  socket.on('cast_vote', (data: { nomineeId: string }) => {
    if (!auth.playerId) return;

    const game = gameService.getGameByCode(auth.gameCode);
    if (!game) return;

    const result = meetingService.castVote(game.id, auth.playerId, data.nomineeId);

    if (!result.success) {
      socket.emit('error', { code: 'VOTE_ERROR', message: result.error });
      return;
    }

    const voteCount = meetingService.getVoteCount(game.id);
    const player = gameService.getPlayerById(auth.playerId);

    io.to(roomName).emit('vote_cast', {
      voterId: auth.playerId,
      voterPseudo: player?.pseudo || 'Inconnu',
      voteCount,
    });

    socket.emit('vote_confirmed', { nomineeId: data.nomineeId });
  });
```

- [ ] **Supprimer MeetingService.ts**

```bash
rm backend/src/services/MeetingService.ts
```

- [ ] **Vérifier que le build TypeScript passe sans erreur**

```bash
cd backend && npm run build
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Commit**

```bash
git add backend/src/socket.ts
git rm backend/src/services/MeetingService.ts
git commit -m "feat(backend): remove vote/meeting system and MeetingService"
```

---

## Task 4 : Ajouter les handlers d'actions nocturnes (backend)

**Files:**
- Modify: `backend/src/socket.ts`

- [ ] **Ajouter le case `send_night_info` dans le switch de handleHostConnection** (après le case `night_call_end`)

```typescript
        case 'send_night_info': {
          const { playerId, info } = data.payload;
          const sockets = await io.in(roomName).fetchSockets();
          for (const s of sockets) {
            const sAuth = (s as any).auth as JWTPayload;
            if (sAuth.type === 'player' && sAuth.playerId === playerId) {
              s.emit('night_info_received', { info });
              break;
            }
          }
          break;
        }
```

- [ ] **Ajouter le listener `submit_night_action` dans handlePlayerConnection** (après le listener `set_ready`)

```typescript
  socket.on('submit_night_action', (data: {
    actionType: 'choose_target' | 'choose_two' | 'choose_master';
    targetId?: string;
    targetIds?: string[];
  }) => {
    if (!auth.playerId) return;

    const game = gameService.getGameByCode(auth.gameCode);
    if (!game) return;

    const player = gameService.getPlayerById(auth.playerId);
    if (!player) return;

    const role = gameService.getPlayerPerceivedRole(auth.playerId);
    if (!role) return;

    const alivePlayers = gameService.getPlayersPublic(game.id).filter((p) => p.isAlive);
    const validation = validateNightAction(data.actionType, data.targetId, data.targetIds, alivePlayers);

    if (!validation.valid) {
      socket.emit('error', { code: 'NIGHT_ACTION_ERROR', message: validation.error });
      return;
    }

    let targetPseudo: string | undefined;
    let targetPseudos: string[] | undefined;

    if (data.targetId) {
      const target = gameService.getPlayerById(data.targetId);
      targetPseudo = target?.pseudo;
    }

    if (data.targetIds) {
      targetPseudos = data.targetIds.map((id) => {
        const t = gameService.getPlayerById(id);
        return t?.pseudo || id;
      });
    }

    socket.emit('night_action_confirmed', {
      actionType: data.actionType,
      targetId: data.targetId,
      targetIds: data.targetIds,
    });

    io.to(`host-${auth.gameCode}`).emit('night_action_received', {
      playerId: auth.playerId,
      playerPseudo: player.pseudo,
      roleName: role.name,
      actionType: data.actionType,
      targetId: data.targetId,
      targetIds: data.targetIds,
      targetPseudo,
      targetPseudos,
    });
  });
```

- [ ] **Vérifier le build**

```bash
cd backend && npm run build
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Commit**

```bash
git add backend/src/socket.ts
git commit -m "feat(backend): add submit_night_action and send_night_info socket handlers"
```

---

## Task 5 : Mettre à jour frontend/src/lib/socket.ts

**Files:**
- Modify: `frontend/src/lib/socket.ts`

- [ ] **Supprimer les exports de types meeting** (lignes 120–181 environ)

Supprimer en entier les interfaces et types suivants :
- `MeetingStartedEvent`
- `NominatedPlayer`
- `NominationsUpdatedEvent`
- `VotingStartedEvent`
- `VoteCastEvent`
- `VoteConfirmedEvent`
- `IndividualVote`
- `NomineeResult`
- `VotingResultsEvent`
- `PlayerEliminatedEvent`
- `MeetingEndedEvent`

- [ ] **Ajouter les nouveaux types d'événements nuit** (à la fin du fichier, avant la dernière ligne)

```typescript
export interface NightActionConfirmedEvent {
  actionType: 'choose_target' | 'choose_two' | 'choose_master';
  targetId?: string;
  targetIds?: string[];
}

export interface NightInfoReceivedEvent {
  info: string;
}

export interface NightActionReceivedEvent {
  playerId: string;
  playerPseudo: string;
  roleName: string;
  actionType: 'choose_target' | 'choose_two' | 'choose_master';
  targetId?: string;
  targetIds?: string[];
  targetPseudo?: string;
  targetPseudos?: string[];
}
```

- [ ] **Commit**

```bash
git add frontend/src/lib/socket.ts
git commit -m "feat(frontend): update socket event types — remove meeting, add night action"
```

---

## Task 6 : Mettre à jour useSocket.ts

**Files:**
- Modify: `frontend/src/hooks/useSocket.ts`

- [ ] **Remplacer les imports depuis `@/lib/socket`**

Remplacer :
```typescript
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  type LobbyUpdateEvent,
  type HostLobbyUpdateEvent,
  type PlayerJoinedEvent,
  type PlayerLeftEvent,
  type AssignmentUpdateEvent,
  type GameStartedEvent,
  type TimerTickEvent,
  type MeetingAlertEvent,
  type MeetingStartedEvent,
  type NominationsUpdatedEvent,
  type VotingStartedEvent,
  type VoteCastEvent,
  type VoteConfirmedEvent,
  type VotingResultsEvent,
  type PlayerEliminatedEvent,
  type MeetingEndedEvent,
  type PhaseChangedEvent,
  type PlayerStatusChangedEvent,
  type RoleRevealedEvent,
  type GameEndedEvent,
  type ReconnectedEvent,
  type ErrorEvent,
} from '@/lib/socket';
```

Par :
```typescript
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  type LobbyUpdateEvent,
  type HostLobbyUpdateEvent,
  type PlayerJoinedEvent,
  type PlayerLeftEvent,
  type AssignmentUpdateEvent,
  type GameStartedEvent,
  type TimerTickEvent,
  type MeetingAlertEvent,
  type PhaseChangedEvent,
  type PlayerStatusChangedEvent,
  type RoleRevealedEvent,
  type GameEndedEvent,
  type ReconnectedEvent,
  type ErrorEvent,
  type NightActionConfirmedEvent,
  type NightInfoReceivedEvent,
  type NightActionReceivedEvent,
} from '@/lib/socket';
```

- [ ] **Remplacer l'interface `UseSocketOptions`**

Remplacer l'interface entière par :
```typescript
interface UseSocketOptions {
  gameCode: string;
  onLobbyUpdate?: (data: LobbyUpdateEvent) => void;
  onHostLobbyUpdate?: (data: HostLobbyUpdateEvent) => void;
  onPlayerJoined?: (data: PlayerJoinedEvent) => void;
  onPlayerLeft?: (data: PlayerLeftEvent) => void;
  onAssignmentUpdate?: (data: AssignmentUpdateEvent) => void;
  onGameStarted?: (data: GameStartedEvent) => void;
  onTimerTick?: (data: TimerTickEvent) => void;
  onMeetingAlert?: (data: MeetingAlertEvent) => void;
  onPhaseChanged?: (data: PhaseChangedEvent) => void;
  onPlayerStatusChanged?: (data: PlayerStatusChangedEvent) => void;
  onRoleRevealed?: (data: RoleRevealedEvent) => void;
  onGameEnded?: (data: GameEndedEvent) => void;
  onReconnected?: (data: ReconnectedEvent) => void;
  onNightCall?: (data: { playerId: string }) => void;
  onNightCallEnd?: (data: { playerId: string }) => void;
  onNightActionConfirmed?: (data: NightActionConfirmedEvent) => void;
  onNightInfoReceived?: (data: NightInfoReceivedEvent) => void;
  onNightActionReceived?: (data: NightActionReceivedEvent) => void;
  onError?: (data: ErrorEvent) => void;
}
```

- [ ] **Mettre à jour la destructuration des options dans `useSocket`**

Remplacer les lignes de destructuration (du `const { gameCode, onLobbyUpdate, ...` jusqu'à `} = options;`) par :
```typescript
  const {
    gameCode,
    onLobbyUpdate,
    onHostLobbyUpdate,
    onPlayerJoined,
    onPlayerLeft,
    onAssignmentUpdate,
    onGameStarted,
    onTimerTick,
    onMeetingAlert,
    onPhaseChanged,
    onPlayerStatusChanged,
    onRoleRevealed,
    onGameEnded,
    onReconnected,
    onNightCall,
    onNightCallEnd,
    onNightActionConfirmed,
    onNightInfoReceived,
    onNightActionReceived,
    onError,
  } = options;
```

- [ ] **Mettre à jour le bloc `socket.on` dans useEffect**

Remplacer le bloc `// Game events` (toutes les lignes `if (onXxx) socket.on(...)`) par :
```typescript
    // Game events
    if (onLobbyUpdate) socket.on('lobby_update', onLobbyUpdate);
    if (onHostLobbyUpdate) socket.on('host_lobby_update', onHostLobbyUpdate);
    if (onPlayerJoined) socket.on('player_joined', onPlayerJoined);
    if (onPlayerLeft) socket.on('player_left', onPlayerLeft);
    if (onAssignmentUpdate) socket.on('assignment_update', onAssignmentUpdate);
    if (onGameStarted) socket.on('game_started', onGameStarted);
    if (onTimerTick) socket.on('timer_tick', onTimerTick);
    if (onMeetingAlert) socket.on('meeting_alert', onMeetingAlert);
    if (onPhaseChanged) socket.on('phase_changed', onPhaseChanged);
    if (onPlayerStatusChanged) socket.on('player_status_changed', onPlayerStatusChanged);
    if (onRoleRevealed) socket.on('role_revealed', onRoleRevealed);
    if (onGameEnded) socket.on('game_ended', onGameEnded);
    if (onReconnected) socket.on('reconnected', onReconnected);
    if (onNightCall) socket.on('night_call', onNightCall);
    if (onNightCallEnd) socket.on('night_call_end', onNightCallEnd);
    if (onNightActionConfirmed) socket.on('night_action_confirmed', onNightActionConfirmed);
    if (onNightInfoReceived) socket.on('night_info_received', onNightInfoReceived);
    if (onNightActionReceived) socket.on('night_action_received', onNightActionReceived);
    if (onError) socket.on('error', onError);
```

- [ ] **Mettre à jour le bloc `socket.off` dans le cleanup (return de useEffect)**

Remplacer le bloc `socket.off(...)` par :
```typescript
      socket.off('connect');
      socket.off('disconnect');
      socket.off('lobby_update');
      socket.off('host_lobby_update');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('assignment_update');
      socket.off('game_started');
      socket.off('timer_tick');
      socket.off('meeting_alert');
      socket.off('phase_changed');
      socket.off('player_status_changed');
      socket.off('role_revealed');
      socket.off('game_ended');
      socket.off('reconnected');
      socket.off('night_call');
      socket.off('night_call_end');
      socket.off('night_action_confirmed');
      socket.off('night_info_received');
      socket.off('night_action_received');
      socket.off('error');
      disconnectSocket();
```

- [ ] **Supprimer les fonctions meeting/vote**

Supprimer en entier :
- `const startMeeting = ...`
- `const nominatePlayer = ...`
- `const removeNomination = ...`
- `const startVoting = ...`
- `const endVoting = ...`
- `const confirmElimination = ...`
- `const endMeetingNoVote = ...`
- `const castVote = ...`

- [ ] **Ajouter les fonctions nuit** (après `endCallPlayer`, avant `// Player actions`)

```typescript
  const sendNightInfo = useCallback(
    (playerId: string, info: string) => {
      emitHostAction('send_night_info', { playerId, info });
    },
    [emitHostAction]
  );

  // Player actions
```

Et juste avant `setReady`, ajouter :
```typescript
  const submitNightAction = useCallback(
    (data: {
      actionType: 'choose_target' | 'choose_two' | 'choose_master';
      targetId?: string;
      targetIds?: string[];
    }) => {
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('submit_night_action', data);
      }
    },
    []
  );
```

- [ ] **Mettre à jour le `return` de useSocket**

Remplacer le return entier par :
```typescript
  return {
    isConnected,
    // Host actions
    assignRole,
    assignSeat,
    assignRandom,
    startGame,
    changePhase,
    setPlayerAlive,
    acknowledgeMeeting,
    postponeMeeting,
    endGame,
    kickPlayer,
    updateSettings,
    triggerMeeting,
    // Night actions (host)
    callPlayer,
    endCallPlayer,
    sendNightInfo,
    // Player actions
    setReady,
    submitNightAction,
  };
```

- [ ] **Vérifier le build frontend**

```bash
cd frontend && npm run build 2>&1 | head -50
```

Résultat attendu : erreurs TypeScript sur les fichiers qui utilisent encore les anciennes fonctions — normal à cette étape, sera résolu dans les tâches suivantes.

- [ ] **Commit**

```bash
git add frontend/src/hooks/useSocket.ts
git commit -m "feat(frontend): remove meeting/vote from useSocket, add night action functions"
```

---

## Task 7 : Simplifier RoleReveal.tsx (rôle affiché une seule fois)

**Files:**
- Modify: `frontend/src/components/RoleReveal.tsx`

- [ ] **Remplacer le composant `RoleReveal` entier** (lignes 63–225 environ, garder `RoleDisplay` intact)

Remplacer depuis `export function RoleReveal(` jusqu'à la ligne juste avant `export function RoleDisplay(` par :

```typescript
interface RoleRevealProps {
  role: Role;
  seatNumber?: number | null;
  onConfirm: () => void;
}

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
```

- [ ] **Mettre à jour les imports** (supprimer `Sparkles, X` qui ne sont plus utilisés)

Remplacer :
```typescript
import { Skull, Shield, Eye, User, Sparkles, X } from 'lucide-react';
```
Par :
```typescript
import { Skull, Shield, Eye, User } from 'lucide-react';
```

- [ ] **Vérifier que le build frontend passe sur ce fichier** (les autres erreurs sont attendues)

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep RoleReveal
```

Résultat attendu : aucune erreur concernant RoleReveal.tsx.

- [ ] **Commit**

```bash
git add frontend/src/components/RoleReveal.tsx
git commit -m "feat(frontend): simplify RoleReveal to one-time static display with confirm button"
```

---

## Task 8 : Créer NightEyesClosed.tsx

**Files:**
- Create: `frontend/src/components/NightEyesClosed.tsx`

- [ ] **Créer le composant**

```typescript
// frontend/src/components/NightEyesClosed.tsx
'use client';

import { Moon } from 'lucide-react';

export function NightEyesClosed() {
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center select-none">
      <Moon className="w-16 h-16 text-blue-300 mb-6" />
      <h1 className="text-3xl font-bold text-white mb-3">Fermez les yeux</h1>
      <p className="text-gray-500 text-center px-8">
        Attendez que le Maître du Jeu vous appelle
      </p>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add frontend/src/components/NightEyesClosed.tsx
git commit -m "feat(frontend): add NightEyesClosed full-screen overlay component"
```

---

## Task 9 : Créer NightActionUI.tsx

**Files:**
- Create: `frontend/src/components/NightActionUI.tsx`

- [ ] **Créer le composant**

```typescript
// frontend/src/components/NightActionUI.tsx
'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

export type NightActionType =
  | 'choose_target'
  | 'choose_two'
  | 'choose_master'
  | 'info_receiver'
  | 'none';

export const NIGHT_ACTION_CONFIG: Record<string, NightActionType> = {
  'Diablotin': 'choose_target',
  'Empoisonneur': 'choose_target',
  'Moine': 'choose_target',
  'Voyante': 'choose_two',
  'Majordome': 'choose_master',
  'Archiviste': 'info_receiver',
  'Enquêteur': 'info_receiver',
  'Lavandière': 'info_receiver',
  'Cuistot': 'info_receiver',
  'Empathe': 'info_receiver',
  'Fossoyeur': 'info_receiver',
};

export function getNightActionType(roleName: string): NightActionType {
  return NIGHT_ACTION_CONFIG[roleName] ?? 'none';
}

interface NightPlayer {
  id: string;
  pseudo: string;
  isAlive: boolean;
  seatNumber?: number | null;
}

interface NightActionUIProps {
  roleName: string;
  players: NightPlayer[];
  myPlayerId: string;
  nightInfo: string | null;
  onSubmitTarget: (targetId: string) => void;
  onSubmitTwo: (targetIds: string[]) => void;
}

export function NightActionUI({
  roleName,
  players,
  myPlayerId,
  nightInfo,
  onSubmitTarget,
  onSubmitTwo,
}: NightActionUIProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedTwo, setSelectedTwo] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const actionType = getNightActionType(roleName);
  const alivePlayers = players.filter((p) => p.isAlive);
  const othersAlive = alivePlayers.filter((p) => p.id !== myPlayerId);

  const handleSubmitTarget = () => {
    if (!selected) return;
    setSubmitted(true);
    onSubmitTarget(selected);
  };

  const handleToggleTwo = (id: string) => {
    setSelectedTwo((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 2
        ? [...prev, id]
        : prev
    );
  };

  const handleSubmitTwo = () => {
    if (selectedTwo.length !== 2) return;
    setSubmitted(true);
    onSubmitTwo(selectedTwo);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto">
      <div className="min-h-full flex flex-col justify-center p-4">
        <p className="text-gray-500 text-sm text-center mb-2">{roleName}</p>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Check className="w-12 h-12 text-green-400 mb-4" />
            <p className="text-white font-bold text-lg">Action envoyée</p>
            <p className="text-gray-400 text-sm mt-2">
              Attendez que le Maître du Jeu termine votre tour
            </p>
          </div>
        ) : actionType === 'info_receiver' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {nightInfo ? (
              <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm">
                <p className="text-gray-400 text-sm mb-3">Information du MJ :</p>
                <p className="text-white text-xl font-bold">{nightInfo}</p>
              </div>
            ) : (
              <>
                <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400">En attente d'information du MJ…</p>
              </>
            )}
          </div>
        ) : actionType === 'choose_target' || actionType === 'choose_master' ? (
          <div>
            <h2 className="text-white font-bold text-xl text-center mb-6">
              Choisissez votre cible
            </h2>
            <div className="space-y-2 mb-6">
              {othersAlive.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${
                    selected === p.id
                      ? 'bg-accent-gold text-black font-bold'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  {p.seatNumber != null && (
                    <span className="text-sm opacity-60 mr-2">#{p.seatNumber}</span>
                  )}
                  {p.pseudo}
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmitTarget}
              disabled={!selected}
              className="w-full py-4 rounded-xl bg-accent-gold text-black font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmer
            </button>
          </div>
        ) : actionType === 'choose_two' ? (
          <div>
            <h2 className="text-white font-bold text-xl text-center mb-2">
              Choisissez deux joueurs
            </h2>
            <p className="text-gray-400 text-sm text-center mb-6">
              {selectedTwo.length}/2 sélectionnés
            </p>
            <div className="space-y-2 mb-6">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleToggleTwo(p.id)}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${
                    selectedTwo.includes(p.id)
                      ? 'bg-accent-gold text-black font-bold'
                      : p.isAlive
                      ? 'bg-gray-800 text-white hover:bg-gray-700'
                      : 'bg-gray-900 text-gray-500'
                  }`}
                >
                  {p.seatNumber != null && (
                    <span className="text-sm opacity-60 mr-2">#{p.seatNumber}</span>
                  )}
                  {p.pseudo}
                  {!p.isAlive && <span className="ml-2 text-xs">☠️</span>}
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmitTwo}
              disabled={selectedTwo.length !== 2}
              className="w-full py-4 rounded-xl bg-accent-gold text-black font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmer
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-400">Votre rôle n'a pas d'action cette nuit.</p>
            <p className="text-gray-500 text-sm mt-2">
              Attendez que le Maître du Jeu termine votre tour
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add frontend/src/components/NightActionUI.tsx
git commit -m "feat(frontend): add NightActionUI component for per-role night actions"
```

---

## Task 10 : Mettre à jour play/[code]/page.tsx

**Files:**
- Modify: `frontend/src/app/play/[code]/page.tsx`

- [ ] **Mettre à jour les imports** en haut du fichier

Remplacer les imports existants par :
```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Shield,
  Users,
  Scroll,
  Sun,
  Moon,
  Clock,
  Skull,
  Eye,
  User,
  Bell,
  Lock,
} from 'lucide-react';
import { api, type Role, type Player } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { RoleCard, RoleBadge } from '@/components/RoleCard';
import { RoleReveal, RoleDisplay } from '@/components/RoleReveal';
import { MeetingAlert } from '@/components/MeetingAlert';
import { SeatMap } from '@/components/SeatMap';
import { NightEyesClosed } from '@/components/NightEyesClosed';
import { NightActionUI, getNightActionType } from '@/components/NightActionUI';
```

- [ ] **Remplacer les déclarations de state** (section `useState`)

Supprimer les states meeting/vote : `meetingStatus`, `nominatedPlayers`, `voteCount`, `hasVoted`, `myVote`, `votingResults`.

Remplacer `showRoleReveal` et ses voisins par :
```typescript
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  const [nightActionConfirmed, setNightActionConfirmed] = useState(false);
  const [nightInfo, setNightInfo] = useState<string | null>(null);
```

Changer le type de `activeTab` :
```typescript
  const [activeTab, setActiveTab] = useState<'role' | 'players' | 'table' | 'roles'>('role');
```

- [ ] **Supprimer les handlers meeting/vote**

Supprimer en entier : `handleMeetingStarted`, `handleNominationsUpdated`, `handleVotingStarted`, `handleVoteCast`, `handleVoteConfirmed`, `handleVotingResults`, `handleMeetingEnded`.

- [ ] **Mettre à jour `handleNightCall` et `handleNightCallEnd`**

Remplacer :
```typescript
  const handleNightCall = useCallback((data: { playerId: string }) => {
    const myPlayerId = localStorage.getItem('player_id');
    if (data.playerId === myPlayerId) {
      setNightCallActive(true);
    }
  }, []);

  const handleNightCallEnd = useCallback((data: { playerId: string }) => {
    const myPlayerId = localStorage.getItem('player_id');
    if (data.playerId === myPlayerId) {
      setNightCallActive(false);
    }
  }, []);
```

Par :
```typescript
  const handleNightCall = useCallback((data: { playerId: string }) => {
    const myPlayerId = localStorage.getItem('player_id');
    if (data.playerId === myPlayerId) {
      setNightCallActive(true);
      setNightActionConfirmed(false);
      setNightInfo(null);
    }
  }, []);

  const handleNightCallEnd = useCallback((data: { playerId: string }) => {
    const myPlayerId = localStorage.getItem('player_id');
    if (data.playerId === myPlayerId) {
      setNightCallActive(false);
    }
  }, []);
```

- [ ] **Ajouter les handlers d'actions nocturnes** (après `handleNightCallEnd`)

```typescript
  const handleNightActionConfirmed = useCallback(() => {
    setNightActionConfirmed(true);
  }, []);

  const handleNightInfoReceived = useCallback((data: { info: string }) => {
    setNightInfo(data.info);
  }, []);
```

- [ ] **Mettre à jour l'appel à `useSocket`**

Remplacer l'appel entier par :
```typescript
  const { isConnected, setReady, submitNightAction } = useSocket({
    gameCode,
    onLobbyUpdate: handleLobbyUpdate,
    onGameStarted: handleGameStarted,
    onRoleRevealed: handleRoleRevealed,
    onPhaseChanged: handlePhaseChanged,
    onPlayerStatusChanged: handlePlayerStatusChanged,
    onGameEnded: handleGameEnded,
    onPlayerLeft: handlePlayerLeft,
    onReconnected: handleReconnected,
    onMeetingAlert: handleMeetingAlert,
    onNightCall: handleNightCall,
    onNightCallEnd: handleNightCallEnd,
    onNightActionConfirmed: handleNightActionConfirmed,
    onNightInfoReceived: handleNightInfoReceived,
  });
```

- [ ] **Mettre à jour la navigation par onglets** — trouver le bloc `<div className="flex border-b ...">` et remplacer par :

```tsx
          {/* Tabs */}
          <div className="flex border-b border-border-color shrink-0">
            {(['role', 'players', 'table', 'roles'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-accent-gold border-b-2 border-accent-gold bg-accent-gold/5'
                    : 'text-text-secondary hover:text-text-primary active:bg-white/5'
                }`}
              >
                {tab === 'role' && '🎭 Rôle'}
                {tab === 'players' && '👥 Joueurs'}
                {tab === 'table' && '🪑 Table'}
                {tab === 'roles' && '📜 Scripts'}
              </button>
            ))}
          </div>
```

- [ ] **Dans le contenu de l'onglet `role`**, remplacer le bloc qui affiche le rôle par :

```tsx
          {activeTab === 'role' && (
            <div className="p-4">
              {roleConfirmed ? (
                <div className="card text-center py-10">
                  <Lock className="w-10 h-10 text-text-secondary mx-auto mb-4" />
                  <p className="font-medium text-text-primary mb-1">Rôle mémorisé</p>
                  <p className="text-sm text-text-secondary">
                    Si vous l'avez oublié, demandez au Maître du Jeu.
                  </p>
                </div>
              ) : myRole ? (
                <RoleDisplay role={myRole} seatNumber={mySeat} />
              ) : (
                <p className="text-text-secondary text-center">Rôle non attribué</p>
              )}
            </div>
          )}
```

- [ ] **Ajouter le contenu de l'onglet `table`** (après le bloc de l'onglet `players`)

```tsx
          {activeTab === 'table' && (
            <div className="p-4">
              <SeatMap
                players={players}
                totalSeats={players.length || 5}
                showRoles={false}
              />
            </div>
          )}
```

- [ ] **Supprimer le bloc "Night Call Notification"** (l'ancien banner `nightCallActive`)

Supprimer les lignes :
```tsx
          {/* Night Call Notification */}
          {phase === 'night' && nightCallActive && (
            <div className="shrink-0 p-4 bg-accent-gold/30 border-b border-accent-gold animate-pulse">
              ...
            </div>
          )}
```

- [ ] **Ajouter les overlays nuit et le RoleReveal** juste avant le `return` final (ou en début du JSX retourné, avant la div principale)

Trouver le `return (` principal et ajouter juste après la première div ouverte :

```tsx
      {/* Role reveal — shown once */}
      {showRoleReveal && !roleConfirmed && myRole && (
        <RoleReveal
          role={myRole}
          seatNumber={mySeat}
          onConfirm={() => {
            setRoleConfirmed(true);
            setShowRoleReveal(false);
          }}
        />
      )}

      {/* Night overlays */}
      {phase === 'night' && !nightCallActive && <NightEyesClosed />}
      {phase === 'night' && nightCallActive && myRole && (
        <NightActionUI
          roleName={myRole.name}
          players={players}
          myPlayerId={localStorage.getItem('player_id') || ''}
          nightInfo={nightInfo}
          onSubmitTarget={(targetId) =>
            submitNightAction({ actionType: 'choose_target', targetId })
          }
          onSubmitTwo={(targetIds) =>
            submitNightAction({ actionType: 'choose_two', targetIds })
          }
        />
      )}
```

- [ ] **Supprimer tout le bloc de meeting/vote** dans le JSX

Chercher et supprimer tous les blocs JSX conditionnels contenant `meetingStatus`. Cela inclut typiquement :
- Le modal/section `{meetingStatus !== 'none' && (` (la "Réunion du Village")
- Les blocs `{meetingStatus === 'nomination' && (` avec les boutons de nomination
- Les blocs `{meetingStatus === 'voting' && (` avec les boutons de vote et la barre de progression
- Les blocs `{meetingStatus === 'results' && (` avec les résultats et l'éliminé
- Tout usage de `castVote`, `hasVoted`, `myVote`, `nominatedPlayers`, `voteCount`, `votingResults` dans le JSX

- [ ] **Vérifier le build**

```bash
cd frontend && npm run build 2>&1 | grep -i "play"
```

Résultat attendu : aucune erreur dans play/[code]/page.tsx.

- [ ] **Commit**

```bash
git add frontend/src/app/play/[code]/page.tsx
git commit -m "feat(frontend): play page — role once, eyes closed, night actions, table tab"
```

---

## Task 11 : Mettre à jour host/[code]/page.tsx

**Files:**
- Modify: `frontend/src/app/host/[code]/page.tsx`

- [ ] **Ajouter les imports manquants** en haut du fichier

Ajouter dans la liste des imports lucide-react : `Moon` (si absent).

Ajouter dans les imports de composants :
```typescript
import { NIGHT_ACTION_CONFIG, getNightActionType } from '@/components/NightActionUI';
```

- [ ] **Supprimer les states meeting/vote**

Supprimer : `meetingStatus`, `nominatedPlayers`, `voteCount`, `votingResults`.

- [ ] **Ajouter les states nuit**

```typescript
  const [nightActions, setNightActions] = useState<Array<{
    playerId: string;
    playerPseudo: string;
    roleName: string;
    actionType: string;
    targetPseudo?: string;
    targetPseudos?: string[];
  }>>([]);
  const [nightInfoInputs, setNightInfoInputs] = useState<Record<string, string>>({});
```

- [ ] **Supprimer les handlers meeting/vote**

Supprimer en entier : `handleMeetingStarted`, `handleNominationsUpdated`, `handleVotingStarted`, `handleVoteCast`, `handleVotingResults`, `handleMeetingEnded`.

- [ ] **Ajouter le handler `handleNightActionReceived`** (après `handleMeetingAlert`)

```typescript
  const handleNightActionReceived = useCallback((data: any) => {
    setNightActions((prev) => {
      const exists = prev.find((a) => a.playerId === data.playerId);
      if (exists) {
        return prev.map((a) => (a.playerId === data.playerId ? data : a));
      }
      return [...prev, data];
    });
  }, []);
```

- [ ] **Ajouter la remise à zéro de `nightActions` lors du changement de phase**

Dans `handleGameStarted` et dans la logique de changement de phase `changePhase('night', ...)`, ajouter :
```typescript
setNightActions([]);
setNightInfoInputs({});
```

Trouver tous les endroits où `changePhase` est appelé avec `'night'` et ajouter ces resets juste avant l'appel.

- [ ] **Mettre à jour l'appel à `useSocket`**

Supprimer les props meeting : `onMeetingStarted`, `onNominationsUpdated`, `onVotingStarted`, `onVoteCast`, `onVotingResults`, `onMeetingEnded`.

Ajouter : `onNightActionReceived: handleNightActionReceived`.

Mettre à jour la destructuration :
```typescript
  const {
    isConnected,
    assignRole,
    assignSeat,
    assignRandom,
    startGame,
    changePhase,
    setPlayerAlive,
    acknowledgeMeeting,
    postponeMeeting,
    endGame,
    kickPlayer,
    updateSettings,
    triggerMeeting,
    callPlayer,
    endCallPlayer,
    sendNightInfo,
  } = useSocket({ ... });
```

- [ ] **Supprimer toute l'UI meeting/vote** dans le JSX

Chercher et supprimer les blocs conditionnels sur `meetingStatus` (`=== 'nomination'`, `=== 'voting'`, `=== 'results'`), les boutons `startMeeting`, `nominatePlayer`, etc.

- [ ] **Ajouter le dashboard nuit** dans le JSX, dans l'onglet `players` ou comme section séparée après la liste des joueurs, conditionnelle sur `phase === 'night' && gameStatus === 'playing'`

```tsx
              {/* Night dashboard */}
              {phase === 'night' && gameStatus === 'playing' && (
                <div className="card mt-4">
                  <h3 className="font-display text-base font-bold mb-4 flex items-center gap-2">
                    <Moon className="w-4 h-4 text-blue-300" />
                    Gestion de la nuit
                  </h3>

                  {/* Night actions received */}
                  {nightActions.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
                        Actions reçues
                      </p>
                      <div className="space-y-1">
                        {nightActions.map((a, i) => (
                          <div key={i} className="text-sm bg-bg-secondary rounded-lg p-3">
                            <span className="font-medium">{a.playerPseudo}</span>
                            <span className="text-text-secondary"> ({a.roleName}) → </span>
                            {a.targetPseudo && (
                              <span className="text-accent-gold font-medium">{a.targetPseudo}</span>
                            )}
                            {a.targetPseudos && (
                              <span className="text-accent-gold font-medium">
                                {a.targetPseudos.join(' & ')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Players to call */}
                  <p className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
                    Joueurs à appeler
                  </p>
                  <div className="space-y-2">
                    {players
                      .filter(
                        (p) =>
                          p.isAlive &&
                          p.roleName &&
                          getNightActionType(p.roleName) !== 'none'
                      )
                      .map((p) => {
                        const isInfoReceiver =
                          NIGHT_ACTION_CONFIG[p.roleName!] === 'info_receiver';
                        const isCalled = calledPlayerId === p.id;
                        return (
                          <div key={p.id} className="bg-bg-secondary rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium text-sm">{p.pseudo}</span>
                                <span className="text-xs text-text-secondary ml-2">
                                  ({p.roleName})
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  if (isCalled) {
                                    endCallPlayer(p.id);
                                    setCalledPlayerId(null);
                                  } else {
                                    callPlayer(p.id);
                                    setCalledPlayerId(p.id);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  isCalled
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                    : 'bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30'
                                }`}
                              >
                                {isCalled ? 'Terminer' : 'Appeler'}
                              </button>
                            </div>

                            {isInfoReceiver && isCalled && (
                              <div className="mt-2 flex gap-2">
                                <input
                                  value={nightInfoInputs[p.id] || ''}
                                  onChange={(e) =>
                                    setNightInfoInputs((prev) => ({
                                      ...prev,
                                      [p.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Information à envoyer…"
                                  className="flex-1 bg-bg-primary rounded-lg px-3 py-2 text-sm border border-border-color focus:outline-none focus:border-accent-gold"
                                />
                                <button
                                  onClick={() => {
                                    sendNightInfo(p.id, nightInfoInputs[p.id] || '');
                                    setNightInfoInputs((prev) => ({ ...prev, [p.id]: '' }));
                                  }}
                                  className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30"
                                >
                                  Envoyer
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
```

- [ ] **Vérifier le build complet**

```bash
cd frontend && npm run build
```

Résultat attendu : build réussi, aucune erreur TypeScript.

- [ ] **Commit**

```bash
git add frontend/src/app/host/[code]/page.tsx
git commit -m "feat(frontend): host page — remove vote UI, add night dashboard"
```

---

## Task 12 : Vérification finale

- [ ] **Lancer tous les tests backend**

```bash
cd backend && npm test
```

Résultat attendu : tous les tests passent.

- [ ] **Vérifier le build backend**

```bash
cd backend && npm run build
```

- [ ] **Vérifier le build frontend**

```bash
cd frontend && npm run build
```

- [ ] **Test manuel : flux nuit complet**

1. Créer une partie, assigner les rôles et les sièges
2. Démarrer la partie → vérifier que le modal de rôle s'affiche une seule fois (bouton "J'ai mémorisé")
3. Passer en nuit → vérifier que tous les joueurs voient l'écran "Fermez les yeux"
4. Appeler un joueur (ex: Empoisonneur) → vérifier que son écran affiche la liste des cibles
5. Joueur sélectionne une cible → vérifier que le host voit l'action dans le dashboard
6. Terminer l'appel → vérifier que l'écran "Fermez les yeux" revient
7. Appeler un joueur info-receiver → vérifier l'écran "En attente"
8. Host envoie une info → vérifier que le joueur la reçoit
9. Passer en jour → vérifier que les overlays disparaissent
10. Vérifier l'onglet "Table" côté joueur (SeatMap sans couleurs de rôle)
11. Vérifier qu'il n'y a plus de boutons de vote nulle part

- [ ] **Commit final si ajustements**

```bash
git add -p
git commit -m "fix: post-review adjustments"
```
