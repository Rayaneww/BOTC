import { Server as SocketServer } from 'socket.io';
import { gameService } from './GameService.js';

export interface Meeting {
  gameId: string;
  meetingNumber: number;
  status: 'nomination' | 'voting' | 'results' | 'closed';
  nominatedPlayers: string[]; // max 3 player IDs
  votes: Map<string, string>; // voterId -> nominatedPlayerId
  startedAt: Date;
}

export interface IndividualVote {
  voterId: string;
  voterPseudo: string;
  voterRoleType: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger' | null;
  votedForId: string; // empty string for blank vote
  votedForPseudo: string;
}

export interface NomineeResult {
  playerId: string;
  pseudo: string;
  roleType: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger' | null;
  voteCount: number;
}

export interface MeetingResults {
  votes: NomineeResult[];
  individualVotes: IndividualVote[];
  eliminated: { playerId: string; pseudo: string; roleType: string | null } | null;
  totalVotes: number;
}

class MeetingService {
  private io: SocketServer | null = null;
  private meetings: Map<string, Meeting> = new Map(); // gameId -> Meeting
  private meetingCounts: Map<string, number> = new Map(); // gameId -> count
  
  setSocketServer(io: SocketServer): void {
    this.io = io;
  }
  
  // Start a new meeting (nomination phase)
  startMeeting(gameId: string): Meeting {
    const count = (this.meetingCounts.get(gameId) || 0) + 1;
    this.meetingCounts.set(gameId, count);
    
    const meeting: Meeting = {
      gameId,
      meetingNumber: count,
      status: 'nomination',
      nominatedPlayers: [],
      votes: new Map(),
      startedAt: new Date(),
    };
    
    this.meetings.set(gameId, meeting);
    return meeting;
  }
  
  // Get current meeting for a game
  getMeeting(gameId: string): Meeting | null {
    return this.meetings.get(gameId) || null;
  }
  
  // Check if a meeting is active
  hasMeeting(gameId: string): boolean {
    const meeting = this.meetings.get(gameId);
    return meeting !== null && meeting !== undefined && meeting.status !== 'closed';
  }
  
  // Nominate a player (max 3)
  nominatePlayer(gameId: string, playerId: string): { success: boolean; error?: string } {
    const meeting = this.meetings.get(gameId);
    if (!meeting || meeting.status !== 'nomination') {
      return { success: false, error: 'Pas de phase de nomination en cours' };
    }
    
    if (meeting.nominatedPlayers.length >= 3) {
      return { success: false, error: 'Maximum 3 nominations atteint' };
    }
    
    if (meeting.nominatedPlayers.includes(playerId)) {
      return { success: false, error: 'Joueur déjà nominé' };
    }
    
    // Check player is alive
    const player = gameService.getPlayerById(playerId);
    if (!player || !player.isAlive) {
      return { success: false, error: 'Joueur non valide' };
    }
    
    meeting.nominatedPlayers.push(playerId);
    return { success: true };
  }
  
  // Remove a nomination
  removeNomination(gameId: string, playerId: string): { success: boolean; error?: string } {
    const meeting = this.meetings.get(gameId);
    if (!meeting || meeting.status !== 'nomination') {
      return { success: false, error: 'Pas de phase de nomination en cours' };
    }
    
    const index = meeting.nominatedPlayers.indexOf(playerId);
    if (index === -1) {
      return { success: false, error: 'Joueur non nominé' };
    }
    
    meeting.nominatedPlayers.splice(index, 1);
    return { success: true };
  }
  
  // Start voting phase
  startVoting(gameId: string): { success: boolean; error?: string } {
    const meeting = this.meetings.get(gameId);
    if (!meeting || meeting.status !== 'nomination') {
      return { success: false, error: 'Pas de phase de nomination en cours' };
    }
    
    if (meeting.nominatedPlayers.length === 0) {
      return { success: false, error: 'Au moins une nomination requise pour voter' };
    }
    
    meeting.status = 'voting';
    meeting.votes = new Map();
    return { success: true };
  }
  
  // Cast a vote
  castVote(gameId: string, voterId: string, nomineeId: string): { success: boolean; error?: string } {
    const meeting = this.meetings.get(gameId);
    if (!meeting || meeting.status !== 'voting') {
      return { success: false, error: 'Pas de phase de vote en cours' };
    }
    
    // Check voter is alive
    const voter = gameService.getPlayerById(voterId);
    if (!voter || !voter.isAlive) {
      return { success: false, error: 'Vous ne pouvez pas voter' };
    }
    
    // Check voter hasn't already voted
    if (meeting.votes.has(voterId)) {
      return { success: false, error: 'Vous avez déjà voté' };
    }
    
    // Check nominee is valid (or blank vote with empty string)
    if (nomineeId !== '' && !meeting.nominatedPlayers.includes(nomineeId)) {
      return { success: false, error: 'Ce joueur n\'est pas nominé' };
    }
    
    meeting.votes.set(voterId, nomineeId);
    return { success: true };
  }
  
  // Get vote count
  getVoteCount(gameId: string): { total: number; voted: number; remaining: number } {
    const meeting = this.meetings.get(gameId);
    if (!meeting) {
      return { total: 0, voted: 0, remaining: 0 };
    }
    
    const game = gameService.getGameByCode(
      gameService.getGameById(gameId)?.code || ''
    );
    if (!game) {
      return { total: 0, voted: 0, remaining: 0 };
    }
    
    const players = gameService.getPlayersForHost(gameId);
    const alivePlayers = players.filter(p => p.isAlive);
    const voted = meeting.votes.size;
    
    return {
      total: alivePlayers.length,
      voted,
      remaining: alivePlayers.length - voted,
    };
  }
  
  // End voting and get results
  endVoting(gameId: string): MeetingResults | null {
    const meeting = this.meetings.get(gameId);
    if (!meeting || meeting.status !== 'voting') {
      return null;
    }
    
    meeting.status = 'results';
    
    // Count votes
    const voteCounts = new Map<string, number>();
    for (const playerId of meeting.nominatedPlayers) {
      voteCounts.set(playerId, 0);
    }
    
    // Collect individual votes
    const individualVotes: IndividualVote[] = [];
    let totalVotes = 0;
    
    for (const [voterId, nomineeId] of meeting.votes) {
      const voter = gameService.getPlayerById(voterId);
      const voterRole = voter?.roleId ? gameService.getPlayerRole(voterId) : null;
      
      let votedForPseudo = 'Vote blanc';
      if (nomineeId !== '') {
        const nominee = gameService.getPlayerById(nomineeId);
        votedForPseudo = nominee?.pseudo || 'Inconnu';
        if (voteCounts.has(nomineeId)) {
          voteCounts.set(nomineeId, (voteCounts.get(nomineeId) || 0) + 1);
          totalVotes++;
        }
      }
      
      individualVotes.push({
        voterId,
        voterPseudo: voter?.pseudo || 'Inconnu',
        voterRoleType: voterRole?.type || null,
        votedForId: nomineeId,
        votedForPseudo,
      });
    }
    
    // Build results with role types
    const results: NomineeResult[] = [];
    for (const [playerId, count] of voteCounts) {
      const player = gameService.getPlayerById(playerId);
      const role = player?.roleId ? gameService.getPlayerRole(playerId) : null;
      results.push({
        playerId,
        pseudo: player?.pseudo || 'Inconnu',
        roleType: role?.type || null,
        voteCount: count,
      });
    }
    
    // Sort by vote count descending
    results.sort((a, b) => b.voteCount - a.voteCount);
    
    // Determine eliminated player (highest votes, must be > 0, no tie at top)
    let eliminated: { playerId: string; pseudo: string; roleType: string | null } | null = null;
    if (results.length > 0 && results[0].voteCount > 0) {
      // Check for tie
      if (results.length === 1 || results[0].voteCount > results[1].voteCount) {
        eliminated = {
          playerId: results[0].playerId,
          pseudo: results[0].pseudo,
          roleType: results[0].roleType,
        };
      }
    }
    
    return { votes: results, individualVotes, eliminated, totalVotes };
  }
  
  // End meeting without voting (blank meeting)
  endMeetingWithoutVote(gameId: string): void {
    const meeting = this.meetings.get(gameId);
    if (meeting) {
      meeting.status = 'closed';
    }
  }
  
  // Close meeting after results
  closeMeeting(gameId: string): void {
    const meeting = this.meetings.get(gameId);
    if (meeting) {
      meeting.status = 'closed';
    }
  }
  
  // Get nominated players with details
  getNominatedPlayers(gameId: string): { playerId: string; pseudo: string; seatNumber: number | null }[] {
    const meeting = this.meetings.get(gameId);
    if (!meeting) return [];
    
    return meeting.nominatedPlayers.map(playerId => {
      const player = gameService.getPlayerById(playerId);
      return {
        playerId,
        pseudo: player?.pseudo || 'Inconnu',
        seatNumber: player?.seatNumber || null,
      };
    });
  }
  
  // Check if player has voted
  hasVoted(gameId: string, playerId: string): boolean {
    const meeting = this.meetings.get(gameId);
    return meeting?.votes.has(playerId) || false;
  }
  
  // Clean up meeting data for a game
  cleanupGame(gameId: string): void {
    this.meetings.delete(gameId);
    this.meetingCounts.delete(gameId);
  }
}

export const meetingService = new MeetingService();
