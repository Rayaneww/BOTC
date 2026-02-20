# 🏰 BOTCT - Blood on the Clocktower Companion

Application web mobile "client léger" pour gérer des parties de Blood on the Clocktower. Inspirée de Kahoot avec la mécanique "maître du jeu" de BotC.

![PWA](https://img.shields.io/badge/PWA-Ready-purple)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-yellow)

## 🎮 Fonctionnalités

### Hôte / Maître du jeu
- ✅ Création de partie avec code unique + QR code
- ✅ Gestion du lobby avec vue temps réel des joueurs
- ✅ Attribution manuelle ou aléatoire des rôles et sièges
- ✅ Vue table circulaire des joueurs
- ✅ Timer global avec alertes de réunion (10 min)
- ✅ Basculement jour/nuit
- ✅ Gestion des joueurs morts/vivants

### Joueur
- ✅ Rejoindre via QR code ou code de salle
- ✅ Vue de son rôle (privée et sécurisée)
- ✅ Consultation de tous les rôles du script
- ✅ Notes personnelles
- ✅ Statut "Prêt" en lobby

### Technique
- ✅ PWA installable sur mobile
- ✅ Communication temps réel (WebSocket)
- ✅ Sécurité anti-triche (rôles côté serveur)
- ✅ Authentification JWT
- ✅ Rate limiting

## 📦 Stack technique

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, SQLite (better-sqlite3)
- **Auth**: JWT
- **Containerisation**: Docker & Docker Compose

## 🚀 Installation

### Prérequis
- Node.js 20+
- npm ou yarn
- Docker (optionnel)

### Développement local

1. **Cloner le projet**
```bash
cd BOTCT
```

2. **Backend**
```bash
cd backend
npm install
npm run seed  # Initialise la DB avec les rôles Fukano
npm run dev   # Démarre sur http://localhost:3001
```

3. **Frontend** (dans un autre terminal)
```bash
cd frontend
npm install
npm run dev   # Démarre sur http://localhost:3000
```

4. **Ouvrir l'application**
- Accueil: http://localhost:3000
- API Health: http://localhost:3001/api/health

### Docker

```bash
# Copier le fichier d'environnement
cp .env.example .env

# Éditer les variables (notamment JWT_SECRET)
nano .env

# Construire et lancer
docker-compose up --build

# L'app sera disponible sur:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:3001
```

## 🎲 Script de rôles inclus

### Fukano (script par défaut)
22 rôles au total:

| Type | Rôles |
|------|-------|
| **Démon** (1) | Diablotin |
| **Sbires** (4) | Baron, Empoisonneur, Espion, Femme Écarlate |
| **Citadins** (13) | Archiviste, Croque-mort, Cuistot, Empathe, Enquêteur, Fossoyeur, Lavandière, Maire, Moine, Pourfendeur, Soldat, Vierge, Voyante |
| **Étrangers** (4) | Ivrogne, Majordome, Reclus, Saint |

### Ajouter un nouveau script

```bash
# POST /api/scripts/import
curl -X POST http://localhost:3001/api/scripts/import \
  -H "Content-Type: application/json" \
  -d '{
    "id": "mon-script",
    "name": "Mon Script",
    "description": "Description...",
    "roles": [
      {
        "id": "role1",
        "name": "Rôle 1",
        "type": "Citadin",
        "description": "Description du rôle..."
      }
    ]
  }'
```

## 📡 API

### REST Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/games` | Créer une partie |
| GET | `/api/games/:code` | Info partie |
| POST | `/api/games/:code/join` | Rejoindre |
| GET | `/api/games/:code/players` | Liste joueurs |
| PUT | `/api/games/:code/players/:id/role` | Attribuer rôle |
| PUT | `/api/games/:code/players/:id/seat` | Attribuer siège |
| POST | `/api/games/:code/assign-random` | Attribution aléatoire |
| POST | `/api/games/:code/start` | Lancer la partie |
| GET | `/api/games/:code/my-role` | Mon rôle (joueur) |
| GET | `/api/games/:code/roles` | Tous les rôles |
| GET | `/api/scripts` | Liste des scripts |

### WebSocket Events

**Server → Client**
- `lobby_update` - Mise à jour du lobby
- `game_started` - Partie lancée
- `timer_tick` - Tick du chrono (hôte)
- `meeting_alert` - Alerte réunion (hôte)
- `phase_changed` - Changement jour/nuit
- `role_revealed` - Révélation du rôle (joueur)
- `player_status_changed` - Mort/vivant

**Client → Server**
- `set_ready` - Marquer prêt
- `host_action` - Actions hôte

## 🎨 Thème visuel

Palette dark fantasy sobre:
- Background: `#0d0d14` (noir profond)
- Cards: `#16213e` (bleu nuit)
- Accent: `#c41e3a` (rouge sang)
- Gold: `#d4af37` (or ancien)

Types de rôles:
- Citadin: `#4a90d9` (bleu)
- Sbire: `#9b59b6` (violet)
- Démon: `#c41e3a` (rouge)
- Étranger: `#27ae60` (vert)

## 🔒 Sécurité

- Les rôles sont stockés côté serveur uniquement
- Chaque joueur ne peut voir que SON rôle
- Tokens JWT avec expiration 24h
- Rate limiting sur les endpoints sensibles
- Codes de partie avec entropie suffisante

## 📱 PWA

L'application peut être installée sur mobile:
1. Ouvrir dans Chrome/Safari
2. "Ajouter à l'écran d'accueil"
3. L'app s'ouvre en mode standalone

## 📁 Structure du projet

```
BOTCT/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration DB
│   │   ├── middleware/     # Auth, rate limiting
│   │   ├── models/         # Types TypeScript
│   │   ├── routes/         # Endpoints REST
│   │   ├── services/       # Logique métier
│   │   ├── seeds/          # Données initiales
│   │   └── utils/          # Helpers
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/            # Pages Next.js
│   │   ├── components/     # Composants React
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # API client, socket
│   │   └── styles/         # CSS global
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🧪 Tests

```bash
# Backend
cd backend
npm test

# Frontend (à venir)
cd frontend
npm test
```

## 📝 License

MIT

---

Développé avec ❤️ pour les fans de Blood on the Clocktower
