import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { generateGameCode } from '../utils/codeGenerator.js';
import { generateToken } from '../utils/jwt.js';
import type { 
  Game, 
  Player, 
  GameState, 
  CreateGameDTO, 
  JoinGameDTO,
  PlayerPublicInfo,
  PlayerHostInfo,
  Role
} from '../models/types.js';
import crypto from 'crypto';

class GameService {
  // Créer une nouvelle partie
  createGame(data: CreateGameDTO): { game: Game; hostToken: string } {
    const gameId = uuidv4();
    const code = generateGameCode();
    const scriptId = data.scriptId || 'fukano';
    
    // Générer le token hôte
    const hostToken = generateToken({
      type: 'host',
      gameCode: code,
      gameId: gameId,
    });
    
    // Hash du mot de passe si fourni
    const passwordHash = data.password 
      ? crypto.createHash('sha256').update(data.password).digest('hex')
      : null;
    
    // Vérifier que le script existe
    const script = db.prepare('SELECT id FROM scripts WHERE id = ?').get(scriptId);
    if (!script) {
      throw new Error('Script non trouvé');
    }
    
    // Insérer la partie
    db.prepare(`
      INSERT INTO games (id, code, name, host_pseudo, host_token, password_hash, script_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(gameId, code, data.name, data.hostPseudo, hostToken, passwordHash, scriptId);
    
    // Créer l'état de jeu initial
    db.prepare(`
      INSERT INTO game_states (game_id, phase, day_number, timer_seconds, last_meeting_at)
      VALUES (?, 'day', 1, 0, 0)
    `).run(gameId);
    
    const game = this.getGameById(gameId)!;
    return { game, hostToken };
  }
  
  // Obtenir une partie par code
  getGameByCode(code: string): Game | null {
    const row = db.prepare(`
      SELECT id, code, name, host_pseudo, host_token, password_hash, script_id, status, started_at, created_at
      FROM games WHERE code = ?
    `).get(code) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      hostPseudo: row.host_pseudo,
      hostToken: row.host_token,
      passwordHash: row.password_hash,
      scriptId: row.script_id,
      status: row.status,
      startedAt: row.started_at,
      createdAt: row.created_at,
    };
  }
  
  // Obtenir une partie par ID
  getGameById(id: string): Game | null {
    const row = db.prepare(`
      SELECT id, code, name, host_pseudo, host_token, password_hash, script_id, status, started_at, created_at
      FROM games WHERE id = ?
    `).get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      hostPseudo: row.host_pseudo,
      hostToken: row.host_token,
      passwordHash: row.password_hash,
      scriptId: row.script_id,
      status: row.status,
      startedAt: row.started_at,
      createdAt: row.created_at,
    };
  }
  
  // Vérifier si une partie existe et est accessible
  canJoinGame(code: string, password?: string): { canJoin: boolean; error?: string; game?: Game } {
    const game = this.getGameByCode(code);
    
    if (!game) {
      return { canJoin: false, error: 'Partie non trouvée' };
    }
    
    if (game.status !== 'lobby') {
      return { canJoin: false, error: 'La partie a déjà commencé' };
    }
    
    if (game.passwordHash) {
      if (!password) {
        return { canJoin: false, error: 'Mot de passe requis' };
      }
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      if (hash !== game.passwordHash) {
        return { canJoin: false, error: 'Mot de passe incorrect' };
      }
    }
    
    return { canJoin: true, game };
  }
  
  // Rejoindre une partie
  joinGame(gameId: string, code: string, data: JoinGameDTO): { player: Player; playerToken: string } {
    const playerId = uuidv4();
    
    // Vérifier si le pseudo est déjà pris
    const existingPlayer = db.prepare(`
      SELECT id FROM players WHERE game_id = ? AND pseudo = ?
    `).get(gameId, data.pseudo);
    
    if (existingPlayer) {
      throw new Error('Ce pseudo est déjà pris');
    }
    
    // Générer le token joueur
    const playerToken = generateToken({
      type: 'player',
      gameCode: code,
      gameId: gameId,
      playerId: playerId,
    });
    
    // Insérer le joueur
    db.prepare(`
      INSERT INTO players (id, game_id, pseudo, token)
      VALUES (?, ?, ?, ?)
    `).run(playerId, gameId, data.pseudo, playerToken);
    
    const player = this.getPlayerById(playerId)!;
    return { player, playerToken };
  }
  
  // Obtenir un joueur par ID
  getPlayerById(id: string): Player | null {
    const row = db.prepare(`
      SELECT id, game_id, pseudo, token, seat_number, role_id, is_ready, is_alive, connected, joined_at
      FROM players WHERE id = ?
    `).get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      gameId: row.game_id,
      pseudo: row.pseudo,
      token: row.token,
      seatNumber: row.seat_number,
      roleId: row.role_id,
      isReady: Boolean(row.is_ready),
      isAlive: Boolean(row.is_alive),
      connected: Boolean(row.connected),
      joinedAt: row.joined_at,
    };
  }
  
  // Obtenir un joueur par token
  getPlayerByToken(token: string): Player | null {
    const row = db.prepare(`
      SELECT id, game_id, pseudo, token, seat_number, role_id, is_ready, is_alive, connected, joined_at
      FROM players WHERE token = ?
    `).get(token) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      gameId: row.game_id,
      pseudo: row.pseudo,
      token: row.token,
      seatNumber: row.seat_number,
      roleId: row.role_id,
      isReady: Boolean(row.is_ready),
      isAlive: Boolean(row.is_alive),
      connected: Boolean(row.connected),
      joinedAt: row.joined_at,
    };
  }
  
  // Obtenir tous les joueurs d'une partie (vue publique)
  getPlayersPublic(gameId: string): PlayerPublicInfo[] {
    const rows = db.prepare(`
      SELECT id, pseudo, is_ready, seat_number, role_id, is_alive
      FROM players WHERE game_id = ?
      ORDER BY seat_number ASC, joined_at ASC
    `).all(gameId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      pseudo: row.pseudo,
      isReady: Boolean(row.is_ready),
      hasSeat: row.seat_number !== null,
      hasRole: row.role_id !== null,
      seatNumber: row.seat_number ?? undefined,
      isAlive: Boolean(row.is_alive),
    }));
  }
  
  // Obtenir tous les joueurs d'une partie (vue hôte)
  getPlayersForHost(gameId: string): PlayerHostInfo[] {
    const rows = db.prepare(`
      SELECT p.id, p.pseudo, p.is_ready, p.seat_number, p.role_id, p.is_alive,
             r.name as role_name, r.type as role_type,
             fr.name as fake_role_name
      FROM players p
      LEFT JOIN roles r ON p.role_id = r.id
      LEFT JOIN roles fr ON p.fake_role_id = fr.id
      WHERE p.game_id = ?
      ORDER BY p.seat_number ASC, p.joined_at ASC
    `).all(gameId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      pseudo: row.pseudo,
      isReady: Boolean(row.is_ready),
      hasSeat: row.seat_number !== null,
      hasRole: row.role_id !== null,
      seatNumber: row.seat_number ?? undefined,
      isAlive: Boolean(row.is_alive),
      roleId: row.role_id,
      roleName: row.role_name,
      roleType: row.role_type,
      fakeRoleName: row.fake_role_name ?? null,
    }));
  }
  
  // Attribuer un rôle à un joueur
  assignRole(playerId: string, roleId: string): void {
    // Vérifier que le rôle existe
    const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(roleId);
    if (!role) {
      throw new Error('Rôle non trouvé');
    }
    
    db.prepare('UPDATE players SET role_id = ? WHERE id = ?').run(roleId, playerId);
  }
  
  // Attribuer un siège à un joueur
  assignSeat(gameId: string, playerId: string, seatNumber: number): void {
    // Vérifier que le siège n'est pas déjà pris
    const existingSeat = db.prepare(`
      SELECT id FROM players WHERE game_id = ? AND seat_number = ? AND id != ?
    `).get(gameId, seatNumber, playerId);
    
    if (existingSeat) {
      throw new Error('Ce siège est déjà pris');
    }
    
    db.prepare('UPDATE players SET seat_number = ? WHERE id = ?').run(seatNumber, playerId);
  }
  
  // Attribution aléatoire des rôles
  assignRolesRandomly(gameId: string, scriptId: string): void {
    const players = db.prepare('SELECT id FROM players WHERE game_id = ?').all(gameId) as any[];
    const roles = db.prepare('SELECT id FROM roles WHERE script_id = ?').all(scriptId) as any[];
    
    if (players.length > roles.length) {
      throw new Error('Pas assez de rôles pour tous les joueurs');
    }
    
    // Mélanger les rôles
    const shuffledRoles = [...roles].sort(() => Math.random() - 0.5);
    
    // Attribuer
    const stmt = db.prepare('UPDATE players SET role_id = ? WHERE id = ?');
    players.forEach((player, index) => {
      stmt.run(shuffledRoles[index].id, player.id);
    });
  }
  
  // Attribution aléatoire des sièges
  assignSeatsRandomly(gameId: string): void {
    const players = db.prepare('SELECT id FROM players WHERE game_id = ?').all(gameId) as any[];
    
    // Générer les numéros de siège et mélanger
    const seats = Array.from({ length: players.length }, (_, i) => i + 1);
    const shuffledSeats = seats.sort(() => Math.random() - 0.5);
    
    // Attribuer
    const stmt = db.prepare('UPDATE players SET seat_number = ? WHERE id = ?');
    players.forEach((player, index) => {
      stmt.run(shuffledSeats[index], player.id);
    });
  }
  
  // Vérifier si la partie peut être lancée
  canStartGame(gameId: string): { canStart: boolean; error?: string } {
    const players = db.prepare(`
      SELECT p.id, p.seat_number, p.role_id, p.is_ready, r.type as role_type
      FROM players p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.game_id = ?
    `).all(gameId) as any[];
    
    if (players.length < 2) {
      return { canStart: false, error: 'Il faut au moins 2 joueurs' };
    }
    
    // Check all players are ready
    const notReady = players.find(p => !p.is_ready);
    if (notReady) {
      return { canStart: false, error: 'Tous les joueurs doivent être prêts' };
    }
    
    const missingRole = players.find(p => !p.role_id);
    if (missingRole) {
      return { canStart: false, error: 'Tous les joueurs doivent avoir un rôle' };
    }
    
    const missingSeat = players.find(p => p.seat_number === null);
    if (missingSeat) {
      return { canStart: false, error: 'Tous les joueurs doivent avoir un siège' };
    }
    
    // Check there's a Demon
    const hasDemon = players.some(p => p.role_type === 'Démon');
    if (!hasDemon) {
      return { canStart: false, error: 'Il faut un Démon pour lancer la partie' };
    }
    
    return { canStart: true };
  }
  
  // Obtenir 3 rôles qui ne sont pas dans la partie (pour le bluff du Démon)
  getBluffRoles(gameId: string): Role[] {
    // Get game's script and used roles
    const game = this.getGameById(gameId);
    if (!game) return [];
    
    const usedRoleIds = db.prepare(`
      SELECT DISTINCT role_id FROM players WHERE game_id = ? AND role_id IS NOT NULL
    `).all(gameId).map((r: any) => r.role_id);
    
    // Get all roles from the script that are NOT used and are Citadin or Étranger
    const availableRoles = db.prepare(`
      SELECT id, script_id, name, type, description, icon
      FROM roles
      WHERE script_id = ?
        AND type IN ('Citadin', 'Étranger')
        AND id NOT IN (${usedRoleIds.length > 0 ? usedRoleIds.map(() => '?').join(',') : "'none'"})
      ORDER BY RANDOM()
      LIMIT 3
    `).all(game.scriptId, ...(usedRoleIds.length > 0 ? usedRoleIds : [])) as any[];
    
    return availableRoles.map(row => ({
      id: row.id,
      scriptId: row.script_id,
      name: row.name,
      type: row.type,
      description: row.description,
      icon: row.icon,
    }));
  }
  
  // Lancer la partie
  startGame(gameId: string): void {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE games SET status = 'playing', started_at = ? WHERE id = ?
    `).run(now, gameId);
    
    // Assign fake role to Ivrogne players
    this.assignIvrogneFakeRole(gameId);
  }
  
  // Assigner un faux rôle Citadin à l'Ivrogne
  assignIvrogneFakeRole(gameId: string): void {
    const game = this.getGameById(gameId);
    if (!game) return;
    
    // Find players with Ivrogne role
    const ivrognes = db.prepare(`
      SELECT p.id FROM players p
      JOIN roles r ON p.role_id = r.id
      WHERE p.game_id = ? AND r.id = 'ivrogne'
    `).all(gameId) as any[];
    
    if (ivrognes.length === 0) return;
    
    // Get used role IDs in this game
    const usedRoleIds = db.prepare(`
      SELECT DISTINCT role_id FROM players WHERE game_id = ? AND role_id IS NOT NULL
    `).all(gameId).map((r: any) => r.role_id);
    
    // Get available Citadin roles NOT in the game
    const availableCitadins = db.prepare(`
      SELECT id FROM roles
      WHERE script_id = ? AND type = 'Citadin'
        AND id NOT IN (${usedRoleIds.length > 0 ? usedRoleIds.map(() => '?').join(',') : "'none'"})
      ORDER BY RANDOM()
    `).all(game.scriptId, ...(usedRoleIds.length > 0 ? usedRoleIds : [])) as any[];
    
    for (let i = 0; i < ivrognes.length; i++) {
      if (i < availableCitadins.length) {
        db.prepare('UPDATE players SET fake_role_id = ? WHERE id = ?')
          .run(availableCitadins[i].id, ivrognes[i].id);
      }
    }
  }
  
  // Get the role as the PLAYER perceives it (Ivrogne sees fake role)
  getPlayerPerceivedRole(playerId: string): Role | null {
    // Check if player has a fake_role_id (Ivrogne)
    const player = db.prepare(`
      SELECT fake_role_id, role_id FROM players WHERE id = ?
    `).get(playerId) as any;
    
    if (!player) return null;
    
    if (player.fake_role_id) {
      // Return the fake role - the Ivrogne thinks they are this Citadin
      const row = db.prepare(`
        SELECT id, script_id, name, type, description, icon
        FROM roles WHERE id = ?
      `).get(player.fake_role_id) as any;
      
      if (row) {
        return {
          id: row.id,
          scriptId: row.script_id,
          name: row.name,
          type: row.type,
          description: row.description,
          icon: row.icon,
        };
      }
    }
    
    // Normal player - return actual role
    return this.getPlayerRole(playerId);
  }
  
  // Get all player roles for Espion
  getAllPlayerRoles(gameId: string): { playerId: string; pseudo: string; seatNumber: number | null; roleName: string; roleType: string }[] {
    const rows = db.prepare(`
      SELECT p.id, p.pseudo, p.seat_number, r.name as role_name, r.type as role_type
      FROM players p
      JOIN roles r ON p.role_id = r.id
      WHERE p.game_id = ?
      ORDER BY p.seat_number ASC
    `).all(gameId) as any[];
    
    return rows.map((row: any) => ({
      playerId: row.id,
      pseudo: row.pseudo,
      seatNumber: row.seat_number,
      roleName: row.role_name,
      roleType: row.role_type,
    }));
  }
  
  // Obtenir l'état de la partie
  getGameState(gameId: string): GameState | null {
    const row = db.prepare(`
      SELECT game_id, phase, day_number, timer_seconds, last_meeting_at, host_notes
      FROM game_states WHERE game_id = ?
    `).get(gameId) as any;
    
    if (!row) return null;
    
    return {
      gameId: row.game_id,
      phase: row.phase,
      dayNumber: row.day_number,
      timerSeconds: row.timer_seconds,
      lastMeetingAt: row.last_meeting_at,
      hostNotes: row.host_notes,
    };
  }
  
  // Mettre à jour l'état de la partie
  updateGameState(gameId: string, updates: Partial<GameState>): void {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.phase !== undefined) {
      fields.push('phase = ?');
      values.push(updates.phase);
    }
    if (updates.dayNumber !== undefined) {
      fields.push('day_number = ?');
      values.push(updates.dayNumber);
    }
    if (updates.timerSeconds !== undefined) {
      fields.push('timer_seconds = ?');
      values.push(updates.timerSeconds);
    }
    if (updates.lastMeetingAt !== undefined) {
      fields.push('last_meeting_at = ?');
      values.push(updates.lastMeetingAt);
    }
    if (updates.hostNotes !== undefined) {
      fields.push('host_notes = ?');
      values.push(updates.hostNotes);
    }
    
    if (fields.length > 0) {
      values.push(gameId);
      db.prepare(`UPDATE game_states SET ${fields.join(', ')} WHERE game_id = ?`).run(...values);
    }
  }
  
  // Marquer un joueur comme prêt/pas prêt
  setPlayerReady(playerId: string, ready: boolean): void {
    db.prepare('UPDATE players SET is_ready = ? WHERE id = ?').run(ready ? 1 : 0, playerId);
  }
  
  // Marquer un joueur comme connecté/déconnecté
  setPlayerConnected(playerId: string, connected: boolean): void {
    db.prepare('UPDATE players SET connected = ? WHERE id = ?').run(connected ? 1 : 0, playerId);
  }
  
  // Marquer un joueur comme mort/vivant
  setPlayerAlive(playerId: string, alive: boolean): void {
    db.prepare('UPDATE players SET is_alive = ? WHERE id = ?').run(alive ? 1 : 0, playerId);
  }
  
  // Obtenir le rôle d'un joueur
  getPlayerRole(playerId: string): Role | null {
    const row = db.prepare(`
      SELECT r.id, r.script_id, r.name, r.type, r.description, r.icon
      FROM players p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = ?
    `).get(playerId) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      scriptId: row.script_id,
      name: row.name,
      type: row.type,
      description: row.description,
      icon: row.icon,
    };
  }
  
  // Terminer la partie
  endGame(gameId: string): void {
    db.prepare('UPDATE games SET status = ? WHERE id = ?').run('finished', gameId);
  }
  
  // Supprimer un joueur
  removePlayer(playerId: string): void {
    db.prepare('DELETE FROM players WHERE id = ?').run(playerId);
  }
}

export const gameService = new GameService();
