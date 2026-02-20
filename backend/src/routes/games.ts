import { Router, Request, Response } from 'express';
import { gameService } from '../services/GameService.js';
import { roleService } from '../services/RoleService.js';
import { requireAuth, requireHost, requireGameAccess, optionalAuth } from '../middleware/auth.js';
import { createGameLimiter, joinGameLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Créer une partie
router.post('/', createGameLimiter, async (req: Request, res: Response) => {
  try {
    const { name, hostPseudo, password, scriptId } = req.body;
    
    if (!name || !hostPseudo) {
      return res.status(400).json({ error: 'Nom de partie et pseudo requis' });
    }
    
    const { game, hostToken } = gameService.createGame({
      name,
      hostPseudo,
      password,
      scriptId,
    });
    
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrCodeUrl = `${baseUrl}/join/${game.code}`;
    
    res.status(201).json({
      gameCode: game.code,
      gameId: game.id,
      hostToken,
      qrCodeUrl,
      name: game.name,
    });
  } catch (error: any) {
    console.error('Create game error:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la création' });
  }
});

// Obtenir les infos d'une partie (public)
router.get('/:code', optionalAuth, async (req: Request, res: Response) => {
  try {
    const game = gameService.getGameByCode(req.params.code);
    
    if (!game) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }
    
    // Infos publiques
    const players = gameService.getPlayersPublic(game.id);
    const script = roleService.getScriptById(game.scriptId);
    
    res.json({
      code: game.code,
      name: game.name,
      hostPseudo: game.hostPseudo,
      status: game.status,
      hasPassword: !!game.passwordHash,
      playerCount: players.length,
      scriptName: script?.name,
      createdAt: game.createdAt,
    });
  } catch (error: any) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejoindre une partie
router.post('/:code/join', joinGameLimiter, async (req: Request, res: Response) => {
  try {
    const { pseudo, password } = req.body;
    
    if (!pseudo) {
      return res.status(400).json({ error: 'Pseudo requis' });
    }
    
    // Vérifier si la partie est accessible
    const { canJoin, error, game } = gameService.canJoinGame(req.params.code, password);
    
    if (!canJoin || !game) {
      return res.status(400).json({ error });
    }
    
    // Rejoindre
    const { player, playerToken } = gameService.joinGame(game.id, game.code, { pseudo });
    
    res.status(201).json({
      playerId: player.id,
      playerToken,
      gameCode: game.code,
      gameName: game.name,
    });
  } catch (error: any) {
    console.error('Join game error:', error);
    if (error.message === 'Ce pseudo est déjà pris') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// Obtenir la liste des joueurs
router.get('/:code/players', requireAuth, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const game = gameService.getGameByCode(req.params.code);
    if (!game) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }
    
    // Si c'est l'hôte, renvoyer plus d'infos
    if (req.auth?.type === 'host') {
      const players = gameService.getPlayersForHost(game.id);
      return res.json({ players });
    }
    
    // Sinon, vue publique
    const players = gameService.getPlayersPublic(game.id);
    res.json({ players });
  } catch (error: any) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Attribuer un rôle (host only)
router.put('/:code/players/:playerId/role', requireAuth, requireHost, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const { roleId } = req.body;
    
    if (!roleId) {
      return res.status(400).json({ error: 'roleId requis' });
    }
    
    const player = gameService.getPlayerById(req.params.playerId);
    if (!player) {
      return res.status(404).json({ error: 'Joueur non trouvé' });
    }
    
    gameService.assignRole(req.params.playerId, roleId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Assign role error:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Attribuer un siège (host only)
router.put('/:code/players/:playerId/seat', requireAuth, requireHost, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const { seatNumber } = req.body;
    
    if (typeof seatNumber !== 'number' || seatNumber < 1) {
      return res.status(400).json({ error: 'Numéro de siège invalide' });
    }
    
    const game = gameService.getGameByCode(req.params.code);
    if (!game) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }
    
    gameService.assignSeat(game.id, req.params.playerId, seatNumber);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Assign seat error:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Attribution aléatoire (host only)
router.post('/:code/assign-random', requireAuth, requireHost, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const { roles = true, seats = true } = req.body;
    
    const game = gameService.getGameByCode(req.params.code);
    if (!game) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }
    
    if (game.status !== 'lobby') {
      return res.status(400).json({ error: 'La partie a déjà commencé' });
    }
    
    if (roles) {
      gameService.assignRolesRandomly(game.id, game.scriptId);
    }
    
    if (seats) {
      gameService.assignSeatsRandomly(game.id);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Assign random error:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Lancer la partie (host only)
router.post('/:code/start', requireAuth, requireHost, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const game = gameService.getGameByCode(req.params.code);
    if (!game) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }
    
    if (game.status !== 'lobby') {
      return res.status(400).json({ error: 'La partie a déjà commencé' });
    }
    
    // Vérifier si on peut lancer
    const { canStart, error } = gameService.canStartGame(game.id);
    if (!canStart) {
      return res.status(400).json({ error });
    }
    
    gameService.startGame(game.id);
    
    res.json({ success: true, startedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir mon rôle (player only)
router.get('/:code/my-role', requireAuth, requireGameAccess, async (req: Request, res: Response) => {
  try {
    if (req.auth?.type !== 'player' || !req.auth.playerId) {
      return res.status(403).json({ error: 'Accès réservé aux joueurs' });
    }
    
    const player = gameService.getPlayerById(req.auth.playerId);
    if (!player) {
      return res.status(404).json({ error: 'Joueur non trouvé' });
    }
    
    // Use perceived role (Ivrogne sees fake Citadin)
    const role = player.roleId ? gameService.getPlayerPerceivedRole(player.id) : null;
    
    res.json({
      role,
      seatNumber: player.seatNumber,
      isAlive: player.isAlive,
    });
  } catch (error: any) {
    console.error('Get my role error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir tous les rôles du script (player/host)
router.get('/:code/roles', requireAuth, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const game = gameService.getGameByCode(req.params.code);
    if (!game) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }
    
    const roles = roleService.getRolesByScript(game.scriptId);
    const script = roleService.getScriptById(game.scriptId);
    
    res.json({
      script,
      roles,
    });
  } catch (error: any) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Changer la phase jour/nuit (host only)
router.put('/:code/phase', requireAuth, requireHost, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const { phase, dayNumber } = req.body;
    
    const game = gameService.getGameByCode(req.params.code);
    if (!game) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }
    
    const updates: any = {};
    if (phase) updates.phase = phase;
    if (dayNumber) updates.dayNumber = dayNumber;
    
    gameService.updateGameState(game.id, updates);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Change phase error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Marquer un joueur mort/vivant (host only)
router.put('/:code/players/:playerId/alive', requireAuth, requireHost, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const { isAlive } = req.body;
    
    if (typeof isAlive !== 'boolean') {
      return res.status(400).json({ error: 'isAlive requis (boolean)' });
    }
    
    gameService.setPlayerAlive(req.params.playerId, isAlive);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Set alive error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Acquitter l'alerte de réunion (host only)
router.post('/:code/meeting-ack', requireAuth, requireHost, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const { postpone } = req.body;
    const game = gameService.getGameByCode(req.params.code);
    
    if (!game) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }
    
    // L'action sera gérée via WebSocket dans le TimerService
    res.json({ success: true, postponed: !!postpone });
  } catch (error: any) {
    console.error('Meeting ack error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Notes de l'hôte
router.put('/:code/notes', requireAuth, requireHost, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const { notes } = req.body;
    const game = gameService.getGameByCode(req.params.code);
    
    if (!game) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }
    
    gameService.updateGameState(game.id, { hostNotes: notes });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update notes error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// État de la partie (host only)
router.get('/:code/state', requireAuth, requireHost, requireGameAccess, async (req: Request, res: Response) => {
  try {
    const game = gameService.getGameByCode(req.params.code);
    if (!game) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }
    
    const state = gameService.getGameState(game.id);
    const players = gameService.getPlayersForHost(game.id);
    
    res.json({
      game: {
        code: game.code,
        name: game.name,
        status: game.status,
        startedAt: game.startedAt,
      },
      state,
      players,
    });
  } catch (error: any) {
    console.error('Get state error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
