import { Server as SocketServer } from 'socket.io';
import { gameService } from './GameService.js';
import { formatTime } from '../utils/codeGenerator.js';

const DEFAULT_MEETING_INTERVAL = 10 * 60; // 10 minutes en secondes
const POSTPONE_DURATION = 2 * 60; // 2 minutes en secondes

interface GameTimer {
  gameId: string;
  intervalId: NodeJS.Timeout;
  seconds: number;
  lastMeetingAt: number;
  postponedMeetings: number;
  meetingInterval: number; // Configurable per game
  meetingsEnabled: boolean;
}

interface GameSettings {
  meetingInterval: number;
  meetingsEnabled: boolean;
}

class TimerService {
  private timers: Map<string, GameTimer> = new Map();
  private gameSettings: Map<string, GameSettings> = new Map();
  private io: SocketServer | null = null;
  
  setSocketServer(io: SocketServer) {
    this.io = io;
  }
  
  // Configurer les paramètres d'une partie
  setGameSettings(gameId: string, settings: Partial<GameSettings>): void {
    const current = this.gameSettings.get(gameId) || {
      meetingInterval: DEFAULT_MEETING_INTERVAL,
      meetingsEnabled: true,
    };
    this.gameSettings.set(gameId, { ...current, ...settings });
    
    // Update timer if running
    const timer = this.timers.get(gameId);
    if (timer) {
      if (settings.meetingInterval !== undefined) {
        timer.meetingInterval = settings.meetingInterval;
      }
      if (settings.meetingsEnabled !== undefined) {
        timer.meetingsEnabled = settings.meetingsEnabled;
      }
    }
  }
  
  getGameSettings(gameId: string): GameSettings {
    return this.gameSettings.get(gameId) || {
      meetingInterval: DEFAULT_MEETING_INTERVAL,
      meetingsEnabled: true,
    };
  }
  
  // Démarrer le timer pour une partie
  startTimer(gameId: string): void {
    if (this.timers.has(gameId)) {
      console.log(`Timer already running for game ${gameId}`);
      return;
    }
    
    const state = gameService.getGameState(gameId);
    const settings = this.getGameSettings(gameId);
    const initialSeconds = state?.timerSeconds || 0;
    
    const timer: GameTimer = {
      gameId,
      seconds: initialSeconds,
      lastMeetingAt: state?.lastMeetingAt || 0,
      postponedMeetings: 0,
      meetingInterval: settings.meetingInterval,
      meetingsEnabled: settings.meetingsEnabled,
      intervalId: setInterval(() => this.tick(gameId), 1000),
    };
    
    this.timers.set(gameId, timer);
    console.log(`Timer started for game ${gameId}`);
  }
  
  // Arrêter le timer
  stopTimer(gameId: string): void {
    const timer = this.timers.get(gameId);
    if (timer) {
      clearInterval(timer.intervalId);
      this.timers.delete(gameId);
      console.log(`Timer stopped for game ${gameId}`);
    }
  }
  
  // Tick du timer (chaque seconde)
  private tick(gameId: string): void {
    const timer = this.timers.get(gameId);
    if (!timer || !this.io) return;
    
    timer.seconds++;
    
    // Mettre à jour en base (toutes les 10 secondes pour ne pas surcharger)
    if (timer.seconds % 10 === 0) {
      gameService.updateGameState(gameId, { timerSeconds: timer.seconds });
    }
    
    // Envoyer le tick au host uniquement
    const game = gameService.getGameById(gameId);
    if (game) {
      this.io.to(`host-${game.code}`).emit('timer_tick', {
        seconds: timer.seconds,
        formatted: formatTime(timer.seconds),
      });
    }
    
    // Vérifier si on doit déclencher une alerte de réunion
    if (timer.meetingsEnabled && timer.meetingInterval > 0) {
      const timeSinceLastMeeting = timer.seconds - timer.lastMeetingAt;
      if (timeSinceLastMeeting >= timer.meetingInterval) {
        this.triggerMeetingAlert(gameId);
      }
    }
  }
  
  // Déclencher une alerte de réunion
  private triggerMeetingAlert(gameId: string): void {
    const timer = this.timers.get(gameId);
    if (!timer || !this.io) return;
    
    const game = gameService.getGameById(gameId);
    if (!game) return;
    
    const meetingNumber = Math.floor(timer.seconds / timer.meetingInterval);
    
    const alertData = {
      meetingNumber,
      canPostpone: true,
      timeElapsed: formatTime(timer.seconds),
    };
    
    // Envoyer l'alerte à TOUS les joueurs et à l'hôte
    this.io.to(`game-${game.code}`).emit('meeting_alert', alertData);
    
    // Marquer que l'alerte a été envoyée
    timer.lastMeetingAt = timer.seconds;
    gameService.updateGameState(gameId, { lastMeetingAt: timer.seconds });
  }
  
  // Déclencher une réunion manuellement
  triggerManualMeeting(gameId: string): void {
    const timer = this.timers.get(gameId);
    if (!timer || !this.io) return;
    
    const game = gameService.getGameById(gameId);
    if (!game) return;
    
    const meetingNumber = Math.floor(timer.seconds / (timer.meetingInterval || 600)) + 1;
    
    const alertData = {
      meetingNumber,
      canPostpone: false,
      timeElapsed: formatTime(timer.seconds),
      manual: true,
    };
    
    // Envoyer l'alerte à TOUS
    this.io.to(`game-${game.code}`).emit('meeting_alert', alertData);
    
    // Reset le timer des réunions
    timer.lastMeetingAt = timer.seconds;
    gameService.updateGameState(gameId, { lastMeetingAt: timer.seconds });
  }
  
  // Reporter la réunion de 2 minutes
  postponeMeeting(gameId: string): void {
    const timer = this.timers.get(gameId);
    if (!timer) return;
    
    timer.lastMeetingAt = timer.seconds;
    timer.postponedMeetings++;
    
    gameService.updateGameState(gameId, { lastMeetingAt: timer.seconds });
  }
  
  // Acquitter l'alerte de réunion (sans reporter)
  acknowledgeMeeting(gameId: string): void {
    const timer = this.timers.get(gameId);
    if (!timer) return;
    
    timer.lastMeetingAt = timer.seconds;
    gameService.updateGameState(gameId, { lastMeetingAt: timer.seconds });
  }
  
  // Obtenir le temps actuel
  getCurrentTime(gameId: string): { seconds: number; formatted: string } | null {
    const timer = this.timers.get(gameId);
    if (!timer) {
      const state = gameService.getGameState(gameId);
      if (state) {
        return {
          seconds: state.timerSeconds,
          formatted: formatTime(state.timerSeconds),
        };
      }
      return null;
    }
    
    return {
      seconds: timer.seconds,
      formatted: formatTime(timer.seconds),
    };
  }
  
  // Vérifier si le timer est actif
  isTimerRunning(gameId: string): boolean {
    return this.timers.has(gameId);
  }
}

export const timerService = new TimerService();
