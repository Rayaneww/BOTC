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
  type MeetingStartedEvent,
  type NominationsUpdatedEvent,
  type VotingStartedEvent,
  type VoteCastEvent,
  type VoteConfirmedEvent,
  type VotingResultsEvent,
  type PlayerEliminatedEvent,
  type MeetingEndedEvent,
  type PhaseChangedEvent,
  type PlayerStatusChangedEvent,
  type RoleRevealedEvent,
  type GameEndedEvent,
  type ReconnectedEvent,
  type ErrorEvent,
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
  onMeetingStarted?: (data: MeetingStartedEvent) => void;
  onNominationsUpdated?: (data: NominationsUpdatedEvent) => void;
  onVotingStarted?: (data: VotingStartedEvent) => void;
  onVoteCast?: (data: VoteCastEvent) => void;
  onVoteConfirmed?: (data: VoteConfirmedEvent) => void;
  onVotingResults?: (data: VotingResultsEvent) => void;
  onPlayerEliminated?: (data: PlayerEliminatedEvent) => void;
  onMeetingEnded?: (data: MeetingEndedEvent) => void;
  onPhaseChanged?: (data: PhaseChangedEvent) => void;
  onPlayerStatusChanged?: (data: PlayerStatusChangedEvent) => void;
  onRoleRevealed?: (data: RoleRevealedEvent) => void;
  onGameEnded?: (data: GameEndedEvent) => void;
  onReconnected?: (data: ReconnectedEvent) => void;
  onNightCall?: (data: { playerId: string }) => void;
  onNightCallEnd?: (data: { playerId: string }) => void;
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
    onMeetingStarted,
    onNominationsUpdated,
    onVotingStarted,
    onVoteCast,
    onVoteConfirmed,
    onVotingResults,
    onPlayerEliminated,
    onMeetingEnded,
    onPhaseChanged,
    onPlayerStatusChanged,
    onRoleRevealed,
    onGameEnded,
    onReconnected,
    onNightCall,
    onNightCallEnd,
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
    if (onMeetingStarted) socket.on('meeting_started', onMeetingStarted);
    if (onNominationsUpdated) socket.on('nominations_updated', onNominationsUpdated);
    if (onVotingStarted) socket.on('voting_started', onVotingStarted);
    if (onVoteCast) socket.on('vote_cast', onVoteCast);
    if (onVoteConfirmed) socket.on('vote_confirmed', onVoteConfirmed);
    if (onVotingResults) socket.on('voting_results', onVotingResults);
    if (onPlayerEliminated) socket.on('player_eliminated', onPlayerEliminated);
    if (onMeetingEnded) socket.on('meeting_ended', onMeetingEnded);
    if (onPhaseChanged) socket.on('phase_changed', onPhaseChanged);
    if (onPlayerStatusChanged) socket.on('player_status_changed', onPlayerStatusChanged);
    if (onRoleRevealed) socket.on('role_revealed', onRoleRevealed);
    if (onGameEnded) socket.on('game_ended', onGameEnded);
    if (onReconnected) socket.on('reconnected', onReconnected);
    if (onNightCall) socket.on('night_call', onNightCall);
    if (onNightCallEnd) socket.on('night_call_end', onNightCallEnd);
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
      socket.off('meeting_started');
      socket.off('nominations_updated');
      socket.off('voting_started');
      socket.off('vote_cast');
      socket.off('vote_confirmed');
      socket.off('voting_results');
      socket.off('player_eliminated');
      socket.off('meeting_ended');
      socket.off('phase_changed');
      socket.off('player_status_changed');
      socket.off('role_revealed');
      socket.off('game_ended');
      socket.off('reconnected');
      socket.off('night_call');
      socket.off('night_call_end');
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
  
  // Meeting/Voting host actions
  const startMeeting = useCallback(() => {
    emitHostAction('start_meeting');
  }, [emitHostAction]);
  
  const nominatePlayer = useCallback(
    (playerId: string) => {
      emitHostAction('nominate_player', { playerId });
    },
    [emitHostAction]
  );
  
  const removeNomination = useCallback(
    (playerId: string) => {
      emitHostAction('remove_nomination', { playerId });
    },
    [emitHostAction]
  );
  
  const startVoting = useCallback(() => {
    emitHostAction('start_voting');
  }, [emitHostAction]);
  
  const endVoting = useCallback(() => {
    emitHostAction('end_voting');
  }, [emitHostAction]);
  
  const confirmElimination = useCallback(() => {
    emitHostAction('confirm_elimination');
  }, [emitHostAction]);
  
  const endMeetingNoVote = useCallback(() => {
    emitHostAction('end_meeting_no_vote');
  }, [emitHostAction]);
  
  // Night calling actions
  const callPlayer = useCallback((playerId: string) => {
    emitHostAction('night_call', { playerId });
  }, [emitHostAction]);
  
  const endCallPlayer = useCallback((playerId: string) => {
    emitHostAction('night_call_end', { playerId });
  }, [emitHostAction]);

  // Player actions
  const setReady = useCallback((ready: boolean) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('set_ready', { ready });
    }
  }, []);
  
  const castVote = useCallback((nomineeId: string) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('cast_vote', { nomineeId });
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
    // Meeting/Voting host actions
    startMeeting,
    nominatePlayer,
    removeNomination,
    startVoting,
    endVoting,
    confirmElimination,
    endMeetingNoVote,
    // Night calling
    callPlayer,
    endCallPlayer,
    // Player actions
    setReady,
    castVote,
  };
}
