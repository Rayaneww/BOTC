# 🏰 BOTCT - Blood on the Clocktower Companion
## Architecture & Spécifications Techniques

---

## 1. Vue d'ensemble de l'architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (PWA)                               │
│                     Next.js + Tailwind CSS                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │ Accueil  │  │  Host    │  │  Join    │  │   Play (Joueur)      │ │
│  │    /     │  │/host/:id │  │/join/:id │  │   /play/:id          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │ HTTP/REST + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVEUR (Node.js)                           │
│                     Express + Socket.IO                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  REST API    │  │  WS Gateway  │  │  Game Logic Engine       │  │
│  │  /api/*      │  │  Socket.IO   │  │  (Timer, State, Events)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                              │                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Services Layer                             │  │
│  │  GameService │ PlayerService │ RoleService │ AuthService     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         STOCKAGE                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   SQLite     │  │  In-Memory   │  │  Session Store           │  │
│  │   (Persist)  │  │  (GameState) │  │  (JWT Tokens)            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Flux de données

### A. Création de partie (Hôte)
```
Hôte -> POST /api/games/create -> Génération code unique (6 chars)
     <- { gameCode, hostToken, qrCodeUrl }
     -> WS connect (room: gameCode, role: host)
```

### B. Rejoindre une partie (Joueur)
```
Joueur -> GET /join/:gameCode -> Page de join
       -> POST /api/games/:code/join { pseudo }
       <- { playerToken, playerId }
       -> WS connect (room: gameCode, role: player)
       <- WS event: lobby_update (broadcast)
```

### C. Lancement de partie
```
Hôte -> POST /api/games/:code/start (avec hostToken)
     -> Validation: tous les joueurs ont rôle + siège
     -> Démarrage timer serveur
     <- WS broadcast: game_started { startTime }
     <- WS interval: timer_tick (chaque seconde)
     <- WS scheduled: meeting_alert (chaque 10 min)
```

---

## 3. Modèle de données (SQLite)

### Tables

```sql
-- Scripts de rôles (ex: "Fukano", "Trouble Brewing", etc.)
CREATE TABLE scripts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rôles disponibles
CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Citadin', 'Sbire', 'Démon', 'Étranger')),
    description TEXT NOT NULL,
    icon TEXT,
    FOREIGN KEY (script_id) REFERENCES scripts(id)
);

-- Parties créées
CREATE TABLE games (
    id TEXT PRIMARY KEY,              -- UUID
    code TEXT UNIQUE NOT NULL,        -- 6 chars alphanum (ABC123)
    name TEXT NOT NULL,               -- Nom de la partie
    host_pseudo TEXT NOT NULL,
    host_token TEXT NOT NULL,         -- JWT pour auth hôte
    password_hash TEXT,               -- Optionnel
    script_id TEXT NOT NULL,
    status TEXT DEFAULT 'lobby' CHECK(status IN ('lobby', 'playing', 'finished')),
    started_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (script_id) REFERENCES scripts(id)
);

-- Joueurs dans une partie
CREATE TABLE players (
    id TEXT PRIMARY KEY,              -- UUID
    game_id TEXT NOT NULL,
    pseudo TEXT NOT NULL,
    token TEXT NOT NULL,              -- JWT pour auth joueur
    seat_number INTEGER,              -- Position autour de la table
    role_id TEXT,                     -- Rôle attribué
    is_ready BOOLEAN DEFAULT FALSE,
    is_alive BOOLEAN DEFAULT TRUE,
    connected BOOLEAN DEFAULT TRUE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    UNIQUE(game_id, pseudo),
    UNIQUE(game_id, seat_number)
);

-- État de la partie (en mémoire, mais persisté périodiquement)
CREATE TABLE game_states (
    game_id TEXT PRIMARY KEY,
    phase TEXT DEFAULT 'day' CHECK(phase IN ('day', 'night')),
    day_number INTEGER DEFAULT 1,
    timer_seconds INTEGER DEFAULT 0,
    last_meeting_at INTEGER DEFAULT 0,
    host_notes TEXT,
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Historique des événements (optionnel, pour logs MJ)
CREATE TABLE game_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    data TEXT,                        -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id)
);
```

---

## 4. API REST

### Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/api/games` | Créer une partie | - |
| `GET` | `/api/games/:code` | Info partie (public) | - |
| `POST` | `/api/games/:code/join` | Rejoindre partie | - |
| `GET` | `/api/games/:code/players` | Liste joueurs | Host/Player |
| `PUT` | `/api/games/:code/players/:id/role` | Attribuer rôle | Host |
| `PUT` | `/api/games/:code/players/:id/seat` | Attribuer siège | Host |
| `POST` | `/api/games/:code/assign-random` | Attribution aléatoire | Host |
| `POST` | `/api/games/:code/start` | Lancer la partie | Host |
| `GET` | `/api/games/:code/my-role` | Mon rôle (joueur) | Player |
| `GET` | `/api/games/:code/roles` | Tous les rôles du script | Player |
| `PUT` | `/api/games/:code/phase` | Changer jour/nuit | Host |
| `PUT` | `/api/games/:code/players/:id/alive` | Marquer mort/vivant | Host |
| `POST` | `/api/games/:code/meeting-ack` | Confirmer alerte réunion | Host |
| `GET` | `/api/scripts` | Liste des scripts | - |
| `GET` | `/api/scripts/:id/roles` | Rôles d'un script | - |
| `POST` | `/api/scripts/import` | Importer script JSON | Admin |

### Payloads

**POST /api/games**
```json
{
  "name": "Partie du soir",
  "hostPseudo": "MaîtreDuJeu",
  "password": "optionnel",
  "scriptId": "fukano"
}
```
Response:
```json
{
  "gameCode": "ABC123",
  "hostToken": "eyJhbG...",
  "qrCodeUrl": "https://app.tld/join/ABC123"
}
```

**POST /api/games/:code/join**
```json
{
  "pseudo": "Joueur1",
  "password": "optionnel"
}
```
Response:
```json
{
  "playerId": "uuid",
  "playerToken": "eyJhbG..."
}
```

**GET /api/games/:code/my-role** (Auth: Player Token)
```json
{
  "role": {
    "id": "diablotin",
    "name": "Diablotin",
    "type": "Démon",
    "description": "Le Diablotin est le chef des Démons..."
  },
  "seatNumber": 3
}
```

---

## 5. Événements WebSocket

### Événements Serveur → Client

| Événement | Payload | Destinataires |
|-----------|---------|---------------|
| `lobby_update` | `{ players: [...], readyCount }` | Room |
| `player_joined` | `{ playerId, pseudo }` | Room |
| `player_left` | `{ playerId, pseudo }` | Room |
| `assignment_update` | `{ playerId, hasSeat, hasRole }` | Room (sans détails) |
| `game_started` | `{ startTime, phase }` | Room |
| `timer_tick` | `{ seconds, formatted }` | Host only |
| `meeting_alert` | `{ meetingNumber, canPostpone }` | Host only |
| `phase_changed` | `{ phase, dayNumber }` | Room |
| `player_status_changed` | `{ playerId, isAlive }` | Room |
| `role_revealed` | `{ role, seatNumber }` | Player only (privé) |
| `game_ended` | `{ winner, reason }` | Room |
| `error` | `{ code, message }` | Sender only |
| `reconnected` | `{ gameState }` | Reconnecting client |

### Événements Client → Serveur

| Événement | Payload | Émetteur |
|-----------|---------|----------|
| `join_room` | `{ gameCode, token }` | All |
| `set_ready` | `{ ready: boolean }` | Player |
| `request_state` | `{}` | All (reconnexion) |
| `host_action` | `{ action, data }` | Host |

---

## 6. Sécurité

### Authentification
- **JWT** avec secret serveur, expiration 24h
- Payload: `{ type: 'host'|'player', gameCode, playerId?, exp }`
- Token transmis via header `Authorization: Bearer <token>`

### Anti-triche
1. **Rôles côté serveur uniquement** : le client ne reçoit que SON rôle
2. **Validation des actions** : chaque action vérifie le token et les permissions
3. **IDs non prévisibles** : UUID v4 pour IDs, nanoid(6) pour codes de partie
4. **Rate limiting** : 
   - Create game: 5/min/IP
   - Join game: 10/min/IP
   - API calls: 100/min/token

### CORS
- Origines autorisées configurables via env

---

## 7. Structure des fichiers

```
BOTCT/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── app.ts                # Express app setup
│   │   ├── socket.ts             # Socket.IO setup
│   │   ├── config/
│   │   │   └── database.ts       # SQLite config
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT verification
│   │   │   └── rateLimit.ts      # Rate limiting
│   │   ├── routes/
│   │   │   ├── games.ts
│   │   │   ├── scripts.ts
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── GameService.ts
│   │   │   ├── PlayerService.ts
│   │   │   ├── RoleService.ts
│   │   │   └── TimerService.ts
│   │   ├── models/
│   │   │   └── types.ts
│   │   ├── seeds/
│   │   │   └── fukano.ts         # Seed initial
│   │   └── utils/
│   │       ├── codeGenerator.ts
│   │       └── jwt.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Accueil
│   │   │   ├── host/[code]/
│   │   │   │   └── page.tsx      # Dashboard hôte
│   │   │   ├── join/[code]/
│   │   │   │   └── page.tsx      # Rejoindre
│   │   │   └── play/[code]/
│   │   │       └── page.tsx      # Vue joueur
│   │   ├── components/
│   │   │   ├── ui/               # Composants réutilisables
│   │   │   ├── QRCode.tsx
│   │   │   ├── PlayerList.tsx
│   │   │   ├── RoleCard.tsx
│   │   │   ├── SeatMap.tsx
│   │   │   └── Timer.tsx
│   │   ├── hooks/
│   │   │   ├── useSocket.ts
│   │   │   └── useGame.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── socket.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── public/
│   │   └── manifest.json         # PWA
│   ├── next.config.js
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 8. Configuration PWA

```json
// manifest.json
{
  "name": "BOTCT - Clocktower Companion",
  "short_name": "BOTCT",
  "description": "Compagnon Blood on the Clocktower",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#c41e3a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 9. Thème visuel (Dark Fantasy)

### Palette de couleurs
```css
:root {
  --bg-primary: #0d0d14;      /* Noir profond */
  --bg-secondary: #1a1a2e;    /* Bleu très sombre */
  --bg-card: #16213e;         /* Bleu nuit */
  --accent-red: #c41e3a;      /* Rouge sang */
  --accent-gold: #d4af37;     /* Or ancien */
  --text-primary: #e8e8e8;    /* Blanc cassé */
  --text-secondary: #a0a0a0;  /* Gris clair */
  --border: #2a2a4a;          /* Bordure subtile */
  
  /* Types de rôles */
  --citadin: #4a90d9;         /* Bleu */
  --sbire: #9b59b6;           /* Violet */
  --demon: #c41e3a;           /* Rouge */
  --etranger: #27ae60;        /* Vert */
}
```

### Typographie
- Titres: `Cinzel` (serif médiéval)
- Corps: `Inter` (lisible, moderne)

---

Ce document sert de référence pour l'implémentation. Passons au code.
