'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  type LobbyUpdateEvent,
  type HostLobbyUpdateEvent,
  type PlayerJoinedEvent,
  type PlayerLeftEvent,
  type AssignmentUpdateEvent,
  type GameStartedEvent,
  type TimerTickEvent,
  type MeetingAlertEvent,
  type PhaseChangedEvent,
  type PlayerStatusChangedEvent,
  type RoleRevealedEvent,
  type GameEndedEvent,
  type ReconnectedEvent,
  type ErrorEvent,
  type NightActionConfirmedEvent,
  type NightInfoReceivedEvent,
  type NightActionReceivedEvent,
} from '@/lib/socket';

interface UseSocketOptions {
  gameCode: string;
  onLobbyUpdate?: (data: LobbyUpdateEvent) => void;
  onHostLobbyUpdate?: (data: HostLobbyUpdateEvent) => void;
  onPlayerJoined?: (data: PlayerJoinedEvent) => void;
  onPlayerLeft?: (data: PlayerLeftEvent) => void;
  onAssignmentUpdate?: (data: AssignmentUpdateEvent) => void;
  onGameStarted?: (data: GameStartedEvent) => void;
  onTimerTick?: (data: TimerTickEvent) => void;
  onMeetingAlert?: (data: MeetingAlertEvent) => void;
  onPhaseChanged?: (data: PhaseChangedEvent) => void;
  onPlayerStatusChanged?: (data: PlayerStatusChangedEvent) => void;
  onRoleRevealed?: (data: RoleRevealedEvent) => void;
  onGameEnded?: (data: GameEndedEvent) => void;
  onReconnected?: (data: ReconnectedEvent) => void;
  onNightCall?: (data: { playerId: string }) => void;
  onNightCallEnd?: (data: { playerId: string }) => void;
  onNightActionConfirmed?: (data: NightActionConfirmedEvent) => void;
  onNightInfoReceived?: (data: NightInfoReceivedEvent) => void;
  onNightActionReceived?: (data: NightActionReceivedEvent) => void;
  onError?: (data: ErrorEvent) => void;
}

export function useSocket(options: UseSocketOptions) {
  const {
    gameCode,
    onLobbyUpdate,
    onHostLobbyUpdate,
    onPlayerJoined,
    onPlayerLeft,
    onAssignmentUpdate,
    onGameStarted,
    onTimerTick,
    onMeetingAlert,
    onPhaseChanged,
    onPlayerStatusChanged,
    onRoleRevealed,
    onGameEnded,
    onReconnected,
    onNightCall,
    onNightCallEnd,
    onNightActionConfirmed,
    onNightInfoReceived,
    onNightActionReceived,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Get token
    const hostToken = localStorage.getItem(`host_token_${gameCode}`);
    const playerToken = localStorage.getItem(`player_token_${gameCode}`);
    const token = hostToken || playerToken;

    if (!token) {
      console.error('No token found for game:', gameCode);
      return;
    }

    // Connect
    const socket = connectSocket(token);
    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      setIsConnected(true);
      // Request current state on reconnect
      socket.emit('request_state');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Game events
    if (onLobbyUpdate) socket.on('lobby_update', onLobbyUpdate);
    if (onHostLobbyUpdate) socket.on('host_lobby_update', onHostLobbyUpdate);
    if (onPlayerJoined) socket.on('player_joined', onPlayerJoined);
    if (onPlayerLeft) socket.on('player_left', onPlayerLeft);
    if (onAssignmentUpdate) socket.on('assignment_update', onAssignmentUpdate);
    if (onGameStarted) socket.on('game_started', onGameStarted);
    if (onTimerTick) socket.on('timer_tick', onTimerTick);
    if (onMeetingAlert) socket.on('meeting_alert', onMeetingAlert);
    if (onPhaseChanged) socket.on('phase_changed', onPhaseChanged);
    if (onPlayerStatusChanged) socket.on('player_status_changed', onPlayerStatusChanged);
    if (onRoleRevealed) socket.on('role_revealed', onRoleRevealed);
    if (onGameEnded) socket.on('game_ended', onGameEnded);
    if (onReconnected) socket.on('reconnected', onReconnected);
    if (onNightCall) socket.on('night_call', onNightCall);
    if (onNightCallEnd) socket.on('night_call_end', onNightCallEnd);
    if (onNightActionConfirmed) socket.on('night_action_confirmed', onNightActionConfirmed);
    if (onNightInfoReceived) socket.on('night_info_received', onNightInfoReceived);
    if (onNightActionReceived) socket.on('night_action_received', onNightActionReceived);
    if (onError) socket.on('error', onError);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('lobby_update');
      socket.off('host_lobby_update');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('assignment_update');
      socket.off('game_started');
      socket.off('timer_tick');
      socket.off('meeting_alert');
      socket.off('phase_changed');
      socket.off('player_status_changed');
      socket.off('role_revealed');
      socket.off('game_ended');
      socket.off('reconnected');
      socket.off('night_call');
      socket.off('night_call_end');
      socket.off('night_action_confirmed');
      socket.off('night_info_received');
      socket.off('night_action_received');
      socket.off('error');
      disconnectSocket();
    };
  }, [gameCode]);

  // Host actions
  const emitHostAction = useCallback((action: string, payload?: any) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('host_action', { action, payload });
    }
  }, []);

  const assignRole = useCallback(
    (playerId: string, roleId: string) => {
      emitHostAction('assign_role', { playerId, roleId });
    },
    [emitHostAction]
  );

  const assignSeat = useCallback(
    (playerId: string, seatNumber: number) => {
      emitHostAction('assign_seat', { playerId, seatNumber });
    },
    [emitHostAction]
  );

  const assignRandom = useCallback(
    (roles = true, seats = true) => {
      emitHostAction('assign_random', { roles, seats });
    },
    [emitHostAction]
  );

  const startGame = useCallback(() => {
    emitHostAction('start_game');
  }, [emitHostAction]);

  const changePhase = useCallback(
    (phase: 'day' | 'night', dayNumber?: number) => {
      emitHostAction('change_phase', { phase, dayNumber });
    },
    [emitHostAction]
  );

  const setPlayerAlive = useCallback(
    (playerId: string, isAlive: boolean) => {
      emitHostAction('set_alive', { playerId, isAlive });
    },
    [emitHostAction]
  );

  const acknowledgeMeeting = useCallback(() => {
    emitHostAction('meeting_ack');
  }, [emitHostAction]);

  const postponeMeeting = useCallback(() => {
    emitHostAction('meeting_postpone');
  }, [emitHostAction]);

  const endGame = useCallback(
    (winner?: string, reason?: string) => {
      emitHostAction('end_game', { winner, reason });
    },
    [emitHostAction]
  );

  const kickPlayer = useCallback(
    (playerId: string) => {
      emitHostAction('kick_player', { playerId });
    },
    [emitHostAction]
  );
  
  const updateSettings = useCallback(
    (settings: { meetingInterval?: number; meetingsEnabled?: boolean }) => {
      emitHostAction('update_settings', settings);
    },
    [emitHostAction]
  );
  
  const triggerMeeting = useCallback(() => {
    emitHostAction('trigger_meeting');
  }, [emitHostAction]);
  
  // Night calling actions
  const callPlayer = useCallback((playerId: string) => {
    emitHostAction('night_call', { playerId });
  }, [emitHostAction]);
  
  const endCallPlayer = useCallback((playerId: string) => {
    emitHostAction('night_call_end', { playerId });
  }, [emitHostAction]);

  const sendNightInfo = useCallback(
    (playerId: string, info: string) => {
      emitHostAction('send_night_info', { playerId, info });
    },
    [emitHostAction]
  );

  const submitNightAction = useCallback(
    (data: {
      actionType: 'choose_target' | 'choose_two' | 'choose_master';
      targetId?: string;
      targetIds?: string[];
    }) => {
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('submit_night_action', data);
      }
    },
    []
  );

  // Player actions
  const setReady = useCallback((ready: boolean) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('set_ready', { ready });
    }
  }, []);

  return {
    isConnected,
    // Host actions
    assignRole,
    assignSeat,
    assignRandom,
    startGame,
    changePhase,
    setPlayerAlive,
    acknowledgeMeeting,
    postponeMeeting,
    endGame,
    kickPlayer,
    updateSettings,
    triggerMeeting,
    // Night actions (host)
    callPlayer,
    endCallPlayer,
    sendNightInfo,
    // Player actions
    setReady,
    submitNightAction,
  };
}
