# CLAUDE.md


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BOTC is a full-stack web companion app for **Blood on the Clocktower** (specifically the French Fukano script variant). Hosts manage player roles and game state; players see only their own role. The architecture is a real-time app with REST + WebSocket communication.

## Commands

### Backend (`cd backend`)
```bash
npm run dev      # Dev server with hot reload (http://localhost:3001)
npm run build    # Compile TypeScript to dist/
npm start        # Production (requires build first)
npm run seed     # Initialize SQLite DB with Fukano roles
npm test         # Run vitest
```

### Frontend (`cd frontend`)
```bash
npm run dev      # Next.js dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

### Docker (full stack)
```bash
docker-compose up --build   # Start all services
docker-compose down
```

## Architecture

### Backend (`backend/src/`)
- **`index.ts`** — Entry point: creates HTTP server, initializes SQLite DB, attaches Socket.IO
- **`app.ts`** — Express setup: CORS, rate limiting (5/min create, 10/min join, 100/min API), error handling
- **`socket.ts`** — All WebSocket event handlers (game lobby, role assignment, phase changes, timers)
- **`services/`** — Business logic: `GameService`, `RoleService`, `TimerService`, `MeetingService`
- **`routes/`** — REST routes: `games.ts`, `scripts.ts`
- **`middleware/auth.ts`** — JWT verification middleware
- **`config/database.ts`** — SQLite schema (scripts, roles, games, players, game_states, game_events)
- **`seeds/fukano.ts`** — 22 roles (1 Demon, 4 Minions, 13 Citizens, 4 Outsiders)

Database uses `better-sqlite3` (synchronous API). JWT tokens expire in 24h and encode both role (`host`/`player`) and game code.

### Frontend (`frontend/src/`)
- **`app/`** — Next.js App Router pages:
  - `/` — Landing (create/join)
  - `/host/[code]` — Game master dashboard
  - `/join/[code]` — Player join flow
  - `/play/[code]` — Player view (shows only their role)
- **`components/`** — `SeatMap`, `PlayerList`, `RoleCard`, `RoleReveal`, `Timer`, `QRCode`, `MeetingAlert`
- **`hooks/useSocket.ts`** — Socket.IO connection management
- **`lib/api.ts`** — HTTP client for REST endpoints
- **`lib/socket.ts`** — Socket.IO client initialization

### Real-time Flow
REST is used for game creation/joining and initial state. Socket.IO handles all subsequent live updates (player connections, role reveals, phase timers, meeting alerts). Roles are stored server-side only — the client receives only its own role.

### Styling
Tailwind CSS with a custom dark fantasy theme defined in `tailwind.config.js`:
- Background: `#0d0d14` (`bg-primary`)
- Accent red: `#c41e3a`
- Role type colors: Citizens (blue), Sbires (purple), Demon (red), Etrangers (green)

### Environment Variables
See `.env.example`:
- `JWT_SECRET` — signing key for tokens
- `SERVER_IP` — used for QR code generation
- `API_URL` / `FRONTEND_URL` — service URLs
