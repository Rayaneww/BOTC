import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, initDatabase } from '../src/config/database.js';
import { gameService } from '../src/services/GameService.js';
import { roleService } from '../src/services/RoleService.js';

beforeAll(() => {
  initDatabase();
  
  // Seed test data
  db.exec(`
    INSERT OR REPLACE INTO scripts (id, name, description)
    VALUES ('test-script', 'Test Script', 'For testing');
    
    INSERT OR REPLACE INTO roles (id, script_id, name, type, description)
    VALUES 
      ('test-citadin', 'test-script', 'Test Citadin', 'Citadin', 'A test citadin role'),
      ('test-demon', 'test-script', 'Test Demon', 'Démon', 'A test demon role');
  `);
});

afterAll(() => {
  // Clean up test data
  db.exec(`
    DELETE FROM players WHERE game_id IN (SELECT id FROM games WHERE name LIKE 'Test%');
    DELETE FROM game_states WHERE game_id IN (SELECT id FROM games WHERE name LIKE 'Test%');
    DELETE FROM games WHERE name LIKE 'Test%';
  `);
});

describe('GameService', () => {
  describe('createGame', () => {
    it('should create a game with valid data', () => {
      const { game, hostToken } = gameService.createGame({
        name: 'Test Game 1',
        hostPseudo: 'TestHost',
        scriptId: 'test-script',
      });
      
      expect(game).toBeDefined();
      expect(game.code).toHaveLength(6);
      expect(game.name).toBe('Test Game 1');
      expect(game.hostPseudo).toBe('TestHost');
      expect(game.status).toBe('lobby');
      expect(hostToken).toBeDefined();
    });
    
    it('should generate unique game codes', () => {
      const { game: game1 } = gameService.createGame({
        name: 'Test Game 2',
        hostPseudo: 'Host1',
        scriptId: 'test-script',
      });
      
      const { game: game2 } = gameService.createGame({
        name: 'Test Game 3',
        hostPseudo: 'Host2',
        scriptId: 'test-script',
      });
      
      expect(game1.code).not.toBe(game2.code);
    });
  });
  
  describe('joinGame', () => {
    it('should allow a player to join a game', () => {
      const { game } = gameService.createGame({
        name: 'Test Game Join',
        hostPseudo: 'JoinHost',
        scriptId: 'test-script',
      });
      
      const { player, playerToken } = gameService.joinGame(game.id, game.code, {
        pseudo: 'Player1',
      });
      
      expect(player).toBeDefined();
      expect(player.pseudo).toBe('Player1');
      expect(player.gameId).toBe(game.id);
      expect(playerToken).toBeDefined();
    });
    
    it('should not allow duplicate pseudos in the same game', () => {
      const { game } = gameService.createGame({
        name: 'Test Game Dupe',
        hostPseudo: 'DupeHost',
        scriptId: 'test-script',
      });
      
      gameService.joinGame(game.id, game.code, { pseudo: 'SameName' });
      
      expect(() => {
        gameService.joinGame(game.id, game.code, { pseudo: 'SameName' });
      }).toThrow('Ce pseudo est déjà pris');
    });
  });
  
  describe('assignRole', () => {
    it('should assign a role to a player', () => {
      const { game } = gameService.createGame({
        name: 'Test Game Role',
        hostPseudo: 'RoleHost',
        scriptId: 'test-script',
      });
      
      const { player } = gameService.joinGame(game.id, game.code, {
        pseudo: 'RolePlayer',
      });
      
      gameService.assignRole(player.id, 'test-citadin');
      
      const role = gameService.getPlayerRole(player.id);
      expect(role).toBeDefined();
      expect(role?.id).toBe('test-citadin');
      expect(role?.type).toBe('Citadin');
    });
  });
  
  describe('assignSeat', () => {
    it('should assign a seat to a player', () => {
      const { game } = gameService.createGame({
        name: 'Test Game Seat',
        hostPseudo: 'SeatHost',
        scriptId: 'test-script',
      });
      
      const { player } = gameService.joinGame(game.id, game.code, {
        pseudo: 'SeatPlayer',
      });
      
      gameService.assignSeat(game.id, player.id, 5);
      
      const updated = gameService.getPlayerById(player.id);
      expect(updated?.seatNumber).toBe(5);
    });
    
    it('should not allow duplicate seats', () => {
      const { game } = gameService.createGame({
        name: 'Test Game Dupe Seat',
        hostPseudo: 'DupeSeatHost',
        scriptId: 'test-script',
      });
      
      const { player: p1 } = gameService.joinGame(game.id, game.code, {
        pseudo: 'Player1',
      });
      const { player: p2 } = gameService.joinGame(game.id, game.code, {
        pseudo: 'Player2',
      });
      
      gameService.assignSeat(game.id, p1.id, 1);
      
      expect(() => {
        gameService.assignSeat(game.id, p2.id, 1);
      }).toThrow('Ce siège est déjà pris');
    });
  });
  
  describe('canStartGame', () => {
    it('should not start without enough players', () => {
      const { game } = gameService.createGame({
        name: 'Test Game Start 1',
        hostPseudo: 'StartHost1',
        scriptId: 'test-script',
      });
      
      const result = gameService.canStartGame(game.id);
      expect(result.canStart).toBe(false);
      expect(result.error).toContain('au moins 2 joueurs');
    });
    
    it('should not start without roles assigned', () => {
      const { game } = gameService.createGame({
        name: 'Test Game Start 2',
        hostPseudo: 'StartHost2',
        scriptId: 'test-script',
      });
      
      const { player: p1 } = gameService.joinGame(game.id, game.code, { pseudo: 'P1' });
      const { player: p2 } = gameService.joinGame(game.id, game.code, { pseudo: 'P2' });
      
      gameService.assignSeat(game.id, p1.id, 1);
      gameService.assignSeat(game.id, p2.id, 2);
      
      const result = gameService.canStartGame(game.id);
      expect(result.canStart).toBe(false);
      expect(result.error).toContain('rôle');
    });
    
    it('should start when all conditions are met', () => {
      const { game } = gameService.createGame({
        name: 'Test Game Start 3',
        hostPseudo: 'StartHost3',
        scriptId: 'test-script',
      });
      
      const { player: p1 } = gameService.joinGame(game.id, game.code, { pseudo: 'P1' });
      const { player: p2 } = gameService.joinGame(game.id, game.code, { pseudo: 'P2' });
      
      gameService.assignRole(p1.id, 'test-citadin');
      gameService.assignRole(p2.id, 'test-demon');
      gameService.assignSeat(game.id, p1.id, 1);
      gameService.assignSeat(game.id, p2.id, 2);
      
      const result = gameService.canStartGame(game.id);
      expect(result.canStart).toBe(true);
    });
  });
});

describe('RoleService', () => {
  describe('getRolesByScript', () => {
    it('should return roles for a script', () => {
      const roles = roleService.getRolesByScript('test-script');
      
      expect(roles).toHaveLength(2);
      expect(roles.find(r => r.id === 'test-citadin')).toBeDefined();
      expect(roles.find(r => r.id === 'test-demon')).toBeDefined();
    });
  });
  
  describe('countRolesByType', () => {
    it('should count roles by type', () => {
      const counts = roleService.countRolesByType('test-script');
      
      expect(counts['Citadin']).toBe(1);
      expect(counts['Démon']).toBe(1);
      expect(counts['Sbire']).toBe(0);
      expect(counts['Étranger']).toBe(0);
    });
  });
});
