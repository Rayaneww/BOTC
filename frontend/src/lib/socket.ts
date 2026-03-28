import { io, Socket } from 'socket.io-client';

function getDefaultSocketUrl(): string {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:3001`;
  }

  return 'http://localhost:3001';
}

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || getDefaultSocketUrl();

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔌 Socket connection error:', error.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Event types
export interface LobbyUpdateEvent {
  players: Array<{
    id: string;
    pseudo: string;
    isReady: boolean;
    hasSeat: boolean;
    hasRole: boolean;
    seatNumber?: number;
    isAlive?: boolean;
  }>;
  readyCount: number;
  totalCount: number;
}

export interface HostLobbyUpdateEvent extends LobbyUpdateEvent {
  players: Array<{
    id: string;
    pseudo: string;
    isReady: boolean;
    hasSeat: boolean;
    hasRole: boolean;
    seatNumber?: number;
    isAlive?: boolean;
    roleId: string | null;
    roleName: string | null;
    roleType: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger' | null;
  }>;
}

export interface PlayerJoinedEvent {
  playerId: string;
  pseudo: string;
}

export interface PlayerLeftEvent {
  playerId: string;
  pseudo?: string;
  kicked?: boolean;
}

export interface AssignmentUpdateEvent {
  playerId: string;
  hasSeat: boolean;
  hasRole: boolean;
  seatNumber?: number;
}

export interface GameStartedEvent {
  startTime: string;
  phase: 'day' | 'night';
}

export interface TimerTickEvent {
  seconds: number;
  formatted: string;
}

export interface MeetingAlertEvent {
  meetingNumber: number;
  canPostpone: boolean;
  timeElapsed: string;
}

export interface MeetingStartedEvent {
  meetingNumber: number;
  status: 'nomination' | 'voting' | 'results' | 'closed';
}

export interface NominatedPlayer {
  playerId: string;
  pseudo: string;
  seatNumber: number | null;
}

export interface NominationsUpdatedEvent {
  nominated: NominatedPlayer[];
}

export interface VotingStartedEvent {
  nominated: NominatedPlayer[];
  voteCount: { total: number; voted: number; remaining: number };
}

export interface VoteCastEvent {
  voterId: string;
  voterPseudo: string;
  voteCount: { total: number; voted: number; remaining: number };
}

export interface VoteConfirmedEvent {
  nomineeId: string;
}

export interface IndividualVote {
  voterId: string;
  voterPseudo: string;
  voterRoleType: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger' | null;
  votedForId: string;
  votedForPseudo: string;
}

export interface NomineeResult {
  playerId: string;
  pseudo: string;
  roleType: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger' | null;
  voteCount: number;
}

export interface VotingResultsEvent {
  votes: NomineeResult[];
  individualVotes: IndividualVote[];
  eliminated: { playerId: string; pseudo: string; roleType: string | null } | null;
  totalVotes: number;
}

export interface PlayerEliminatedEvent {
  playerId: string;
  pseudo: string;
  votes: NomineeResult[];
}

export interface MeetingEndedEvent {
  eliminated: { playerId: string; pseudo: string } | null;
  noVote?: boolean;
}

export interface PhaseChangedEvent {
  phase: 'day' | 'night';
  dayNumber: number;
}

export interface PlayerStatusChangedEvent {
  playerId: string;
  isAlive: boolean;
}

export interface RoleRevealedEvent {
  role: {
    id: string;
    name: string;
    type: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger';
    description: string;
  };
  seatNumber: number | null;
  bluffRoles?: {
    id: string;
    name: string;
    type: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger';
    description: string;
  }[];
}

export interface GameEndedEvent {
  winner: string;
  reason: string;
}

export interface ReconnectedEvent {
  game: {
    code: string;
    name: string;
    status: 'lobby' | 'playing' | 'finished';
    startedAt: string | null;
  };
  state: any;
  players: any[];
  timer: { seconds: number; formatted: string } | null;
}

export interface ErrorEvent {
  code: string;
  message: string;
}
