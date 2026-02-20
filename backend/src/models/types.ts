// Types pour l'application BOTCT

export type RoleType = 'Citadin' | 'Sbire' | 'Démon' | 'Étranger';
export type GameStatus = 'lobby' | 'playing' | 'finished';
export type GamePhase = 'day' | 'night';

export interface Script {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Role {
  id: string;
  scriptId: string;
  name: string;
  type: RoleType;
  description: string;
  icon: string | null;
}

export interface Game {
  id: string;
  code: string;
  name: string;
  hostPseudo: string;
  hostToken: string;
  passwordHash: string | null;
  scriptId: string;
  status: GameStatus;
  startedAt: string | null;
  createdAt: string;
}

export interface Player {
  id: string;
  gameId: string;
  pseudo: string;
  token: string;
  seatNumber: number | null;
  roleId: string | null;
  isReady: boolean;
  isAlive: boolean;
  connected: boolean;
  joinedAt: string;
}

export interface GameState {
  gameId: string;
  phase: GamePhase;
  dayNumber: number;
  timerSeconds: number;
  lastMeetingAt: number;
  hostNotes: string | null;
}

export interface GameEvent {
  id: number;
  gameId: string;
  eventType: string;
  data: string | null;
  createdAt: string;
}

// DTOs pour les requêtes/réponses API

export interface CreateGameDTO {
  name: string;
  hostPseudo: string;
  password?: string;
  scriptId?: string;
}

export interface JoinGameDTO {
  pseudo: string;
  password?: string;
}

export interface AssignRoleDTO {
  roleId: string;
}

export interface AssignSeatDTO {
  seatNumber: number;
}

// Payloads WebSocket

export interface LobbyUpdatePayload {
  players: PlayerPublicInfo[];
  readyCount: number;
  totalCount: number;
}

export interface PlayerPublicInfo {
  id: string;
  pseudo: string;
  isReady: boolean;
  hasSeat: boolean;
  hasRole: boolean;
  seatNumber?: number;
  isAlive?: boolean;
}

export interface PlayerHostInfo extends PlayerPublicInfo {
  roleId: string | null;
  roleName: string | null;
  roleType: RoleType | null;
  fakeRoleName?: string | null;
}

export interface GameStartedPayload {
  startTime: string;
  phase: GamePhase;
}

export interface TimerTickPayload {
  seconds: number;
  formatted: string;
}

export interface MeetingAlertPayload {
  meetingNumber: number;
  canPostpone: boolean;
}

export interface PhaseChangedPayload {
  phase: GamePhase;
  dayNumber: number;
}

export interface RoleRevealedPayload {
  role: Role;
  seatNumber: number | null;
}

// JWT Payload
export interface JWTPayload {
  type: 'host' | 'player';
  gameCode: string;
  playerId?: string;
  gameId: string;
  exp?: number;
  iat?: number;
}
