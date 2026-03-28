function getDefaultApiUrl(): string {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:3001`;
  }

  return 'http://localhost:3001';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || getDefaultApiUrl();

interface CreateGamePayload {
  name: string;
  hostPseudo: string;
  password?: string;
  scriptId?: string;
}

interface JoinGamePayload {
  pseudo: string;
  password?: string;
}

interface CreateGameResponse {
  gameCode: string;
  gameId: string;
  hostToken: string;
  qrCodeUrl: string;
  name: string;
}

interface JoinGameResponse {
  playerId: string;
  playerToken: string;
  gameCode: string;
  gameName: string;
}

interface GameInfo {
  code: string;
  name: string;
  hostPseudo: string;
  status: 'lobby' | 'playing' | 'finished';
  hasPassword: boolean;
  playerCount: number;
  scriptName: string;
  createdAt: string;
}

interface Role {
  id: string;
  scriptId: string;
  name: string;
  type: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger';
  description: string;
  icon: string | null;
}

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

interface GameState {
  phase: 'day' | 'night';
  dayNumber: number;
  timerSeconds: number;
  lastMeetingAt: number;
  hostNotes: string | null;
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}/api${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (err) {
    throw new Error('Impossible de contacter le serveur. Vérifiez que le backend est lancé.');
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Erreur serveur (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(data.error || 'Une erreur est survenue');
  }

  return data;
}

function getAuthHeaders(gameCode: string): HeadersInit {
  const hostToken = localStorage.getItem(`host_token_${gameCode}`);
  const playerToken = localStorage.getItem(`player_token_${gameCode}`);
  const token = hostToken || playerToken;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // Games
  createGame: (payload: CreateGamePayload): Promise<CreateGameResponse> =>
    fetchAPI('/games', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getGame: (code: string): Promise<GameInfo> => fetchAPI(`/games/${code}`),

  joinGame: (code: string, payload: JoinGamePayload): Promise<JoinGameResponse> =>
    fetchAPI(`/games/${code}/join`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPlayers: (code: string): Promise<{ players: Player[] }> =>
    fetchAPI(`/games/${code}/players`, {
      headers: getAuthHeaders(code),
    }),

  assignRole: (code: string, playerId: string, roleId: string): Promise<{ success: boolean }> =>
    fetchAPI(`/games/${code}/players/${playerId}/role`, {
      method: 'PUT',
      headers: getAuthHeaders(code),
      body: JSON.stringify({ roleId }),
    }),

  assignSeat: (code: string, playerId: string, seatNumber: number): Promise<{ success: boolean }> =>
    fetchAPI(`/games/${code}/players/${playerId}/seat`, {
      method: 'PUT',
      headers: getAuthHeaders(code),
      body: JSON.stringify({ seatNumber }),
    }),

  assignRandom: (code: string, roles = true, seats = true): Promise<{ success: boolean }> =>
    fetchAPI(`/games/${code}/assign-random`, {
      method: 'POST',
      headers: getAuthHeaders(code),
      body: JSON.stringify({ roles, seats }),
    }),

  startGame: (code: string): Promise<{ success: boolean; startedAt: string }> =>
    fetchAPI(`/games/${code}/start`, {
      method: 'POST',
      headers: getAuthHeaders(code),
    }),

  getMyRole: (code: string): Promise<{ role: Role | null; seatNumber: number | null; isAlive: boolean }> =>
    fetchAPI(`/games/${code}/my-role`, {
      headers: getAuthHeaders(code),
    }),

  getRoles: (code: string): Promise<{ script: { id: string; name: string }; roles: Role[] }> =>
    fetchAPI(`/games/${code}/roles`, {
      headers: getAuthHeaders(code),
    }),

  changePhase: (code: string, phase: 'day' | 'night', dayNumber?: number): Promise<{ success: boolean }> =>
    fetchAPI(`/games/${code}/phase`, {
      method: 'PUT',
      headers: getAuthHeaders(code),
      body: JSON.stringify({ phase, dayNumber }),
    }),

  setPlayerAlive: (code: string, playerId: string, isAlive: boolean): Promise<{ success: boolean }> =>
    fetchAPI(`/games/${code}/players/${playerId}/alive`, {
      method: 'PUT',
      headers: getAuthHeaders(code),
      body: JSON.stringify({ isAlive }),
    }),

  updateNotes: (code: string, notes: string): Promise<{ success: boolean }> =>
    fetchAPI(`/games/${code}/notes`, {
      method: 'PUT',
      headers: getAuthHeaders(code),
      body: JSON.stringify({ notes }),
    }),

  getGameState: (code: string): Promise<{ game: any; state: GameState; players: Player[] }> =>
    fetchAPI(`/games/${code}/state`, {
      headers: getAuthHeaders(code),
    }),

  // Scripts
  getScripts: (): Promise<{ scripts: Array<{ id: string; name: string; description: string }> }> =>
    fetchAPI('/scripts'),

  getScript: (id: string): Promise<{ script: any; roles: Role[]; counts: Record<string, number> }> =>
    fetchAPI(`/scripts/${id}`),
};

export type { 
  CreateGamePayload, 
  JoinGamePayload, 
  CreateGameResponse, 
  JoinGameResponse, 
  GameInfo, 
  Role, 
  Player, 
  GameState 
};
