import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from './utils/jwt.js';
import { gameService } from './services/GameService.js';
import { timerService } from './services/TimerService.js';
import type { JWTPayload } from './models/types.js';
import { validateNightAction } from './utils/nightAction.js';

interface AuthenticatedSocket extends Socket {
  auth?: JWTPayload;
}

export function setupSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });
  
  // Passer le serveur Socket.IO au TimerService
  timerService.setSocketServer(io);
  
  // Middleware d'authentification
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Token requis'));
    }
    
    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error('Token invalide'));
    }
    
    socket.auth = payload;
    next();
  });
  
  io.on('connection', (socket: AuthenticatedSocket) => {
    const auth = socket.auth!;
    console.log(`🔌 Client connected: ${auth.type} - ${auth.gameCode}`);
    
    // Rejoindre la room de la partie
    const roomName = `game-${auth.gameCode}`;
    socket.join(roomName);
    
    // Si c'est l'hôte, rejoindre aussi la room host
    if (auth.type === 'host') {
      socket.join(`host-${auth.gameCode}`);
      handleHostConnection(socket, io, auth);
    } else {
      handlePlayerConnection(socket, io, auth);
    }
    
    // Gestion de la déconnexion
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${auth.type} - ${auth.gameCode}`);
      
      if (auth.type === 'player' && auth.playerId) {
        gameService.setPlayerConnected(auth.playerId, false);
        
        // Notifier la room
        const game = gameService.getGameByCode(auth.gameCode);
        if (game) {
          broadcastLobbyUpdate(io, game.id, auth.gameCode);
          
          io.to(roomName).emit('player_left', {
            playerId: auth.playerId,
          });
        }
      }
    });
    
    // Demander l'état actuel (reconnexion)
    socket.on('request_state', () => {
      const game = gameService.getGameByCode(auth.gameCode);
      if (!game) return;
      
      const state = gameService.getGameState(game.id);
      const players = auth.type === 'host' 
        ? gameService.getPlayersForHost(game.id)
        : gameService.getPlayersPublic(game.id);
      
      socket.emit('reconnected', {
        game: {
          code: game.code,
          name: game.name,
          status: game.status,
          startedAt: game.startedAt,
        },
        state,
        players,
        timer: timerService.getCurrentTime(game.id),
      });
    });
  });
  
  return io;
}

function handleHostConnection(socket: AuthenticatedSocket, io: SocketServer, auth: JWTPayload) {
  const roomName = `game-${auth.gameCode}`;
  
  // Actions hôte
  socket.on('host_action', async (data: { action: string; payload?: any }) => {
    const game = gameService.getGameByCode(auth.gameCode);
    if (!game) {
      socket.emit('error', { code: 'GAME_NOT_FOUND', message: 'Partie non trouvée' });
      return;
    }
    
    try {
      switch (data.action) {
        case 'assign_role': {
          const { playerId, roleId } = data.payload;
          gameService.assignRole(playerId, roleId);
          broadcastLobbyUpdate(io, game.id, auth.gameCode);
          
          // Notifier le joueur de son rôle
          const player = gameService.getPlayerById(playerId);
          if (player) {
            const role = gameService.getPlayerRole(playerId);
            io.to(roomName).emit('assignment_update', {
              playerId,
              hasSeat: player.seatNumber !== null,
              hasRole: true,
            });
          }
          break;
        }
        
        case 'assign_seat': {
          const { playerId, seatNumber } = data.payload;
          gameService.assignSeat(game.id, playerId, seatNumber);
          broadcastLobbyUpdate(io, game.id, auth.gameCode);
          
          io.to(roomName).emit('assignment_update', {
            playerId,
            hasSeat: true,
            hasRole: gameService.getPlayerById(playerId)?.roleId !== null,
            seatNumber,
          });
          break;
        }
        
        case 'assign_random': {
          const { roles = true, seats = true } = data.payload || {};
          if (roles) gameService.assignRolesRandomly(game.id, game.scriptId);
          if (seats) gameService.assignSeatsRandomly(game.id);
          broadcastLobbyUpdate(io, game.id, auth.gameCode);
          break;
        }
        
        case 'start_game': {
          const { canStart, error } = gameService.canStartGame(game.id);
          if (!canStart) {
            socket.emit('error', { code: 'CANNOT_START', message: error });
            return;
          }
          
          gameService.startGame(game.id);
          timerService.startTimer(game.id);
          
          const players = gameService.getPlayersForHost(game.id);
          
          io.to(roomName).emit('game_started', {
            startTime: new Date().toISOString(),
            phase: 'day',
          });
          
          // Révéler le rôle à chaque joueur individuellement
          // Get bluff roles for demons
          const bluffRoles = gameService.getBluffRoles(game.id);
          // Get all player roles for Espion
          const allPlayerRoles = gameService.getAllPlayerRoles(game.id);
          
          for (const player of players) {
            if (player.roleId) {
              // Use perceived role (Ivrogne sees fake Citadin role)
              const role = gameService.getPlayerPerceivedRole(player.id);
              // Trouver la socket du joueur
              const sockets = await io.in(roomName).fetchSockets();
              for (const s of sockets) {
                const sAuth = (s as any).auth as JWTPayload;
                if (sAuth.type === 'player' && sAuth.playerId === player.id) {
                  const payload: any = {
                    role,
                    seatNumber: player.seatNumber,
                  };
                  
                  // If player is Démon, also send bluff roles
                  if (player.roleType === 'Démon') {
                    payload.bluffRoles = bluffRoles;
                  }
                  
                  // If player is Espion, send all player roles
                  if (player.roleId === 'espion') {
                    payload.allPlayerRoles = allPlayerRoles;
                  }
                  
                  s.emit('role_revealed', payload);
                  break;
                }
              }
            }
          }
          break;
        }
        
        case 'change_phase': {
          const { phase, dayNumber } = data.payload;
          gameService.updateGameState(game.id, { phase, dayNumber });
          io.to(roomName).emit('phase_changed', { phase, dayNumber });
          break;
        }
        
        case 'set_alive': {
          const { playerId, isAlive } = data.payload;
          gameService.setPlayerAlive(playerId, isAlive);
          
          io.to(roomName).emit('player_status_changed', {
            playerId,
            isAlive,
          });
          break;
        }
        
        case 'meeting_ack': {
          timerService.acknowledgeMeeting(game.id);
          break;
        }
        
        case 'meeting_postpone': {
          timerService.postponeMeeting(game.id);
          break;
        }
        
        case 'end_game': {
          gameService.endGame(game.id);
          timerService.stopTimer(game.id);
          
          io.to(roomName).emit('game_ended', {
            winner: data.payload?.winner || 'unknown',
            reason: data.payload?.reason || '',
          });
          break;
        }
        
        case 'kick_player': {
          const { playerId } = data.payload;
          const player = gameService.getPlayerById(playerId);
          if (player) {
            gameService.removePlayer(playerId);
            io.to(roomName).emit('player_left', {
              playerId,
              pseudo: player.pseudo,
              kicked: true,
            });
            broadcastLobbyUpdate(io, game.id, auth.gameCode);
          }
          break;
        }
        
        case 'update_settings': {
          const { meetingInterval, meetingsEnabled } = data.payload;
          timerService.setGameSettings(game.id, { 
            meetingInterval: meetingInterval !== undefined ? meetingInterval * 60 : undefined, // Convert minutes to seconds
            meetingsEnabled 
          });
          
          // Broadcast settings update
          const settings = timerService.getGameSettings(game.id);
          io.to(`host-${auth.gameCode}`).emit('settings_updated', {
            meetingInterval: Math.floor(settings.meetingInterval / 60),
            meetingsEnabled: settings.meetingsEnabled,
          });
          break;
        }
        
        case 'trigger_meeting': {
          timerService.triggerManualMeeting(game.id);
          break;
        }
        
        case 'night_call': {
          // Host calls a player during night
          const { playerId } = data.payload;
          const player = gameService.getPlayerById(playerId);
          if (player) {
            io.to(roomName).emit('night_call', { playerId });
          }
          break;
        }
        
        case 'night_call_end': {
          // Host ends a player's night call
          const { playerId } = data.payload;
          io.to(roomName).emit('night_call_end', { playerId });
          break;
        }

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

        default:
          socket.emit('error', { code: 'UNKNOWN_ACTION', message: 'Action inconnue' });
      }
    } catch (error: any) {
      console.error('Host action error:', error);
      socket.emit('error', { code: 'ACTION_ERROR', message: error.message });
    }
  });
}

function handlePlayerConnection(socket: AuthenticatedSocket, io: SocketServer, auth: JWTPayload) {
  if (!auth.playerId) return;
  
  const roomName = `game-${auth.gameCode}`;
  
  // Marquer le joueur comme connecté
  gameService.setPlayerConnected(auth.playerId, true);
  
  // Notifier la room
  const game = gameService.getGameByCode(auth.gameCode);
  if (game) {
    const player = gameService.getPlayerById(auth.playerId);
    if (player) {
      broadcastLobbyUpdate(io, game.id, auth.gameCode);
      
      io.to(roomName).emit('player_joined', {
        playerId: auth.playerId,
        pseudo: player.pseudo,
      });
    }
  }
  
  // Marquer prêt
  socket.on('set_ready', (data: { ready: boolean }) => {
    if (!auth.playerId) return;
    
    gameService.setPlayerReady(auth.playerId, data.ready);
    
    const game = gameService.getGameByCode(auth.gameCode);
    if (game) {
      broadcastLobbyUpdate(io, game.id, auth.gameCode);
    }
  });
  
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
}

function broadcastLobbyUpdate(io: SocketServer, gameId: string, gameCode: string) {
  const players = gameService.getPlayersPublic(gameId);
  const readyCount = players.filter(p => p.isReady).length;
  
  io.to(`game-${gameCode}`).emit('lobby_update', {
    players,
    readyCount,
    totalCount: players.length,
  });
  
  // Envoyer la vue hôte aussi
  const hostPlayers = gameService.getPlayersForHost(gameId);
  io.to(`host-${gameCode}`).emit('host_lobby_update', {
    players: hostPlayers,
    readyCount,
    totalCount: hostPlayers.length,
  });
}
