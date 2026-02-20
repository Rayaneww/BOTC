'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Crown,
  Users,
  Play,
  Shuffle,
  Sun,
  Moon,
  Copy,
  Check,
  Settings,
  Scroll,
  X,
  ChevronDown,
  ChevronUp,
  Bell,
  Clock,
  StopCircle,
  AlertTriangle,
  Hand,
  Vote,
  UserMinus,
  XCircle,
  Phone,
  PhoneOff,
} from 'lucide-react';
import { api, type Role, type Player } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { QRCode } from '@/components/QRCode';
import { Timer } from '@/components/Timer';
import { PlayerList } from '@/components/PlayerList';
import { SeatMap } from '@/components/SeatMap';
import { RoleCard } from '@/components/RoleCard';
import { MeetingAlert } from '@/components/MeetingAlert';

type HostPlayer = Player & {
  roleId?: string;
  roleName?: string;
  roleType?: 'Citadin' | 'Sbire' | 'Démon' | 'Étranger';
  fakeRoleName?: string | null;
};

export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const gameCode = params.code as string;

  const [gameName, setGameName] = useState('');
  const [gameStatus, setGameStatus] = useState<'lobby' | 'playing' | 'finished'>('lobby');
  const [players, setPlayers] = useState<HostPlayer[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [timer, setTimer] = useState({ seconds: 0, formatted: '00:00' });
  const [phase, setPhase] = useState<'day' | 'night'>('day');
  const [dayNumber, setDayNumber] = useState(1);
  const [meetingAlert, setMeetingAlert] = useState<{ number: number; time: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state
  const [selectedPlayer, setSelectedPlayer] = useState<HostPlayer | null>(null);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showSeatSelector, setShowSeatSelector] = useState(false);
  const [showRolesPanel, setShowRolesPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'players' | 'table' | 'roles'>('players');
  
  // Game settings
  const [meetingInterval, setMeetingInterval] = useState(10); // minutes
  const [meetingsEnabled, setMeetingsEnabled] = useState(true);
  
  // Meeting/Voting state
  const [meetingStatus, setMeetingStatus] = useState<'none' | 'nomination' | 'voting' | 'results'>('none');
  const [nominatedPlayers, setNominatedPlayers] = useState<{ playerId: string; pseudo: string; seatNumber: number | null }[]>([]);
  const [voteCount, setVoteCount] = useState({ total: 0, voted: 0, remaining: 0 });
  const [votingResults, setVotingResults] = useState<{
    votes: { playerId: string; pseudo: string; roleType: string | null; voteCount: number }[];
    individualVotes: { voterId: string; voterPseudo: string; voterRoleType: string | null; votedForId: string; votedForPseudo: string }[];
    eliminated: { playerId: string; pseudo: string; roleType: string | null } | null;
  } | null>(null);
  const [showKickConfirm, setShowKickConfirm] = useState<{ playerId: string; pseudo: string } | null>(null);
  
  // Night calling state
  const [calledPlayerId, setCalledPlayerId] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = `${baseUrl}/join/${gameCode}`;

  // Socket handlers
  const handleHostLobbyUpdate = useCallback((data: any) => {
    setPlayers(data.players);
  }, []);

  const handleGameStarted = useCallback((data: any) => {
    setGameStatus('playing');
    setPhase(data.phase);
  }, []);

  const handleTimerTick = useCallback((data: any) => {
    setTimer(data);
  }, []);

  const handleMeetingAlert = useCallback((data: any) => {
    setMeetingAlert({ number: data.meetingNumber, time: data.timeElapsed });
  }, []);

  const handlePhaseChanged = useCallback((data: any) => {
    setPhase(data.phase);
    setDayNumber(data.dayNumber);
  }, []);

  const handlePlayerStatusChanged = useCallback((data: any) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === data.playerId ? { ...p, isAlive: data.isAlive } : p))
    );
  }, []);

  const handleError = useCallback((data: any) => {
    setError(data.message);
    setTimeout(() => setError(''), 3000);
  }, []);
  
  // Meeting handlers
  const handleMeetingStarted = useCallback((data: any) => {
    setMeetingStatus('nomination');
    setNominatedPlayers([]);
    setVotingResults(null);
    setMeetingAlert(null); // Clear the alert if any
  }, []);
  
  const handleNominationsUpdated = useCallback((data: any) => {
    setNominatedPlayers(data.nominated);
  }, []);
  
  const handleVotingStarted = useCallback((data: any) => {
    setMeetingStatus('voting');
    setNominatedPlayers(data.nominated);
    setVoteCount(data.voteCount);
  }, []);
  
  const handleVoteCast = useCallback((data: any) => {
    setVoteCount(data.voteCount);
  }, []);
  
  const handleVotingResults = useCallback((data: any) => {
    setMeetingStatus('results');
    setVotingResults(data);
  }, []);
  
  const handleMeetingEnded = useCallback((data: any) => {
    setMeetingStatus('none');
    setNominatedPlayers([]);
    setVotingResults(null);
    setVoteCount({ total: 0, voted: 0, remaining: 0 });
  }, []);
  
  const handlePlayerEliminated = useCallback((data: any) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === data.playerId ? { ...p, isAlive: false } : p))
    );
  }, []);

  const {
    isConnected,
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
    startMeeting,
    nominatePlayer,
    removeNomination,
    startVoting,
    endVoting,
    confirmElimination,
    endMeetingNoVote,
    callPlayer,
    endCallPlayer,
  } = useSocket({
    gameCode,
    onHostLobbyUpdate: handleHostLobbyUpdate,
    onLobbyUpdate: handleHostLobbyUpdate,
    onGameStarted: handleGameStarted,
    onTimerTick: handleTimerTick,
    onMeetingAlert: handleMeetingAlert,
    onPhaseChanged: handlePhaseChanged,
    onPlayerStatusChanged: handlePlayerStatusChanged,
    onMeetingStarted: handleMeetingStarted,
    onNominationsUpdated: handleNominationsUpdated,
    onVotingStarted: handleVotingStarted,
    onVoteCast: handleVoteCast,
    onVotingResults: handleVotingResults,
    onMeetingEnded: handleMeetingEnded,
    onPlayerEliminated: handlePlayerEliminated,
    onError: handleError,
  });

  // Load initial data
  useEffect(() => {
    const token = localStorage.getItem(`host_token_${gameCode}`);
    if (!token) {
      router.push('/');
      return;
    }

    Promise.all([api.getGame(gameCode), api.getGameState(gameCode), api.getRoles(gameCode)])
      .then(([gameData, stateData, rolesData]) => {
        setGameName(gameData.name);
        setGameStatus(gameData.status);
        setPlayers(stateData.players);
        setRoles(rolesData.roles);
        if (stateData.state) {
          setPhase(stateData.state.phase);
          setDayNumber(stateData.state.dayNumber);
          setTimer({
            seconds: stateData.state.timerSeconds,
            formatted: formatTime(stateData.state.timerSeconds),
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Erreur de chargement');
        setLoading(false);
      });
  }, [gameCode, router]);

  const formatTime = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyCode = () => {
    navigator.clipboard.writeText(gameCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canStart = players.length >= 2 && players.every((p) => p.hasSeat && p.hasRole);

  const handleSelectRole = (roleId: string) => {
    if (selectedPlayer) {
      assignRole(selectedPlayer.id, roleId);
      setShowRoleSelector(false);
      setSelectedPlayer(null);
    }
  };

  const handleSelectSeat = (seatNumber: number) => {
    if (selectedPlayer) {
      assignSeat(selectedPlayer.id, seatNumber);
      setShowSeatSelector(false);
      setSelectedPlayer(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-h-screen">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-color p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-accent-gold" />
              <h1 className="font-display text-lg font-bold">{gameName}</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={copyCode}
                className="flex items-center gap-1 text-sm text-accent-gold hover:text-accent-gold/80"
              >
                <span className="font-mono tracking-wider">{gameCode}</span>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <span className={`text-xs ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                {isConnected ? '● Connecté' : '○ Déconnecté'}
              </span>
            </div>
          </div>

          {gameStatus === 'playing' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Paramètres"
              >
                <Settings className="w-5 h-5 text-text-secondary" />
              </button>
              <div className="text-right">
                <Timer {...timer} size="md" />
                <div className="flex items-center gap-2 mt-1 justify-end">
                  {phase === 'day' ? (
                    <Sun className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="text-sm text-text-secondary">
                    {phase === 'day' ? 'Jour' : 'Nuit'} {dayNumber}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-accent-red text-white px-4 py-2 rounded-lg z-50">
          {error}
        </div>
      )}

      {/* Meeting alert */}
      {meetingAlert && meetingStatus === 'none' && (
        <MeetingAlert
          meetingNumber={meetingAlert.number}
          timeElapsed={meetingAlert.time}
          onAcknowledge={() => {
            acknowledgeMeeting();
            setMeetingAlert(null);
            startMeeting(); // Start the meeting ceremony
          }}
          onPostpone={() => {
            postponeMeeting();
            setMeetingAlert(null);
          }}
        />
      )}
      
      {/* Meeting Panel - Nomination/Voting/Results */}
      {meetingStatus !== 'none' && gameStatus === 'playing' && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4">
            {/* Meeting Header */}
            <div className="text-center mb-6">
              <Hand className="w-12 h-12 text-accent-gold mx-auto mb-2" />
              <h2 className="font-display text-2xl">
                {meetingStatus === 'nomination' && 'Phase de Nomination'}
                {meetingStatus === 'voting' && 'Phase de Vote'}
                {meetingStatus === 'results' && 'Résultats'}
              </h2>
              <p className="text-text-secondary">
                {meetingStatus === 'nomination' && 'Désignez jusqu\'à 3 joueurs'}
                {meetingStatus === 'voting' && `${voteCount.voted}/${voteCount.total} votes`}
                {meetingStatus === 'results' && 'Le village a parlé'}
              </p>
            </div>
            
            {/* Nomination Phase */}
            {meetingStatus === 'nomination' && (
              <div className="flex-1 overflow-auto">
                <div className="mb-4">
                  <h3 className="text-sm text-text-secondary mb-2">
                    Nominés ({nominatedPlayers.length}/3)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {nominatedPlayers.map((p) => (
                      <div
                        key={p.playerId}
                        className="bg-accent-red/20 text-accent-red px-3 py-1.5 rounded-full flex items-center gap-2"
                      >
                        <span>{p.pseudo}</span>
                        <button
                          onClick={() => removeNomination(p.playerId)}
                          className="hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {nominatedPlayers.length === 0 && (
                      <span className="text-text-secondary text-sm">Aucun nominé</span>
                    )}
                  </div>
                </div>
                
                <h3 className="text-sm text-text-secondary mb-2">
                  Joueurs vivants
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {players
                    .filter((p) => p.isAlive)
                    .map((player) => {
                      const isNominated = nominatedPlayers.some(
                        (n) => n.playerId === player.id
                      );
                      return (
                        <button
                          key={player.id}
                          onClick={() => {
                            if (isNominated) {
                              removeNomination(player.id);
                            } else if (nominatedPlayers.length < 3) {
                              nominatePlayer(player.id);
                            }
                          }}
                          disabled={!isNominated && nominatedPlayers.length >= 3}
                          className={`p-3 rounded-lg text-left transition-colors ${
                            isNominated
                              ? 'bg-accent-red/30 border-2 border-accent-red'
                              : 'bg-bg-card hover:bg-bg-secondary border-2 border-transparent'
                          } ${!isNominated && nominatedPlayers.length >= 3 ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{player.pseudo}</span>
                            {player.seatNumber && (
                              <span className="text-xs text-text-secondary">
                                #{player.seatNumber}
                              </span>
                            )}
                          </div>
                          {player.roleName && (
                            <span className="text-xs text-text-secondary">
                              {player.roleName}
                              {player.fakeRoleName && (
                                <span className="text-role-etranger ml-1">(pense être {player.fakeRoleName})</span>
                              )}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
            
            {/* Voting Phase */}
            {meetingStatus === 'voting' && (
              <div className="flex-1 overflow-auto">
                <div className="mb-4 p-4 bg-bg-secondary rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-text-secondary">Progression des votes</span>
                    <span className="font-bold text-accent-gold">
                      {voteCount.voted}/{voteCount.total}
                    </span>
                  </div>
                  <div className="w-full bg-bg-card rounded-full h-3">
                    <div
                      className="bg-accent-gold h-3 rounded-full transition-all"
                      style={{
                        width: `${voteCount.total > 0 ? (voteCount.voted / voteCount.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                
                <h3 className="text-sm text-text-secondary mb-2">Nominés</h3>
                <div className="space-y-2">
                  {nominatedPlayers.map((p) => (
                    <div
                      key={p.playerId}
                      className="p-4 bg-bg-card rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium">{p.pseudo}</span>
                        {p.seatNumber && (
                          <span className="text-xs text-text-secondary ml-2">
                            Siège #{p.seatNumber}
                          </span>
                        )}
                      </div>
                      <Vote className="w-5 h-5 text-text-secondary" />
                    </div>
                  ))}
                </div>
                
                <p className="text-center text-text-secondary text-sm mt-4">
                  En attente des votes des joueurs...
                </p>
              </div>
            )}
            
            {/* Results Phase */}
            {meetingStatus === 'results' && votingResults && (
              <div className="flex-1 overflow-auto">
                {/* Vote counts by nominee */}
                <h3 className="text-sm text-text-secondary mb-2">Résultats des votes</h3>
                <div className="space-y-3 mb-6">
                  {votingResults.votes.map((v, index) => {
                    const isEliminated =
                      votingResults.eliminated?.playerId === v.playerId;
                    const roleColor = v.roleType === 'Démon' ? 'text-role-demon' :
                      v.roleType === 'Sbire' ? 'text-role-sbire' :
                      v.roleType === 'Citadin' ? 'text-role-citadin' :
                      v.roleType === 'Étranger' ? 'text-role-etranger' : 'text-text-secondary';
                    return (
                      <div
                        key={v.playerId}
                        className={`p-4 rounded-lg ${
                          isEliminated
                            ? 'bg-accent-red/30 border-2 border-accent-red'
                            : 'bg-bg-card'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-2xl font-bold ${
                                isEliminated ? 'text-accent-red' : 'text-text-secondary'
                              }`}
                            >
                              #{index + 1}
                            </span>
                            <div>
                              <span className="font-medium">{v.pseudo}</span>
                              {v.roleType && (
                                <span className={`text-xs ml-2 ${roleColor}`}>
                                  ({v.roleType})
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-xl font-bold ${
                              isEliminated ? 'text-accent-red' : 'text-accent-gold'
                            }`}
                          >
                            {v.voteCount} vote{v.voteCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Individual votes */}
                <h3 className="text-sm text-text-secondary mb-2">Détail des votes</h3>
                <div className="space-y-2 mb-6 max-h-48 overflow-auto">
                  {votingResults.individualVotes.map((v) => {
                    const voterColor = v.voterRoleType === 'Démon' ? 'text-role-demon' :
                      v.voterRoleType === 'Sbire' ? 'text-role-sbire' :
                      v.voterRoleType === 'Citadin' ? 'text-role-citadin' :
                      v.voterRoleType === 'Étranger' ? 'text-role-etranger' : 'text-text-secondary';
                    return (
                      <div
                        key={v.voterId}
                        className="p-2 bg-bg-card rounded-lg text-sm flex items-center justify-between"
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{v.voterPseudo}</span>
                          {v.voterRoleType && (
                            <span className={`text-xs ${voterColor}`}>
                              ({v.voterRoleType})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-text-secondary">
                          <span>→</span>
                          <span className={v.votedForId === '' ? 'italic' : ''}>
                            {v.votedForPseudo}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {votingResults.eliminated ? (
                  <div className="text-center p-4 bg-accent-red/20 rounded-lg">
                    <p className="text-accent-red font-bold text-lg">
                      {votingResults.eliminated.pseudo} sera éliminé
                      {votingResults.eliminated.roleType && (
                        <span className="block text-sm opacity-80">
                          ({votingResults.eliminated.roleType})
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-bg-secondary rounded-lg">
                    <p className="text-text-secondary">
                      Pas d'élimination (égalité ou aucun vote)
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Action buttons */}
            <div className="mt-4 space-y-2">
              {meetingStatus === 'nomination' && (
                <>
                  <button
                    onClick={startVoting}
                    disabled={nominatedPlayers.length === 0}
                    className="btn btn-primary w-full"
                  >
                    <Vote className="w-4 h-4" />
                    Commencer le vote ({nominatedPlayers.length} nominé{nominatedPlayers.length !== 1 ? 's' : ''})
                  </button>
                  <button
                    onClick={endMeetingNoVote}
                    className="btn btn-ghost w-full"
                  >
                    Terminer sans vote
                  </button>
                </>
              )}
              
              {meetingStatus === 'voting' && (
                <button
                  onClick={endVoting}
                  className="btn btn-primary w-full"
                >
                  Terminer le vote
                </button>
              )}
              
              {meetingStatus === 'results' && (
                <button
                  onClick={confirmElimination}
                  className="btn btn-primary w-full"
                >
                  {votingResults?.eliminated ? 'Confirmer l\'élimination' : 'Fermer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {gameStatus === 'lobby' ? (
        <div className="flex-1 overflow-auto p-4">
          {/* QR Code section */}
          <div className="card mb-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <QRCode value={joinUrl} size={150} />
              <div className="text-center sm:text-left">
                <p className="text-text-secondary mb-2">Rejoindre la partie :</p>
                <code className="text-2xl font-mono font-bold text-accent-gold tracking-widest">
                  {gameCode}
                </code>
                <p className="text-sm text-text-secondary mt-2 break-all">{joinUrl}</p>
              </div>
            </div>
          </div>

          {/* Players list */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Joueurs ({players.length})
              </h2>
              <button onClick={() => assignRandom(true, true)} className="btn btn-secondary text-sm">
                <Shuffle className="w-4 h-4" />
                Aléatoire
              </button>
            </div>

            <PlayerList
              players={players}
              isHost
              showRoles
              onPlayerClick={(player) => {
                setSelectedPlayer(player as HostPlayer);
                setShowRoleSelector(true);
              }}
              onKick={(player) => {
                setShowKickConfirm({ playerId: player.id, pseudo: player.pseudo });
              }}
              selectedPlayerId={selectedPlayer?.id}
            />
          </div>

          {/* Start button */}
          <button
            onClick={startGame}
            disabled={!canStart}
            className={`btn btn-primary w-full py-4 text-lg ${!canStart ? 'btn-disabled' : ''}`}
          >
            <Play className="w-5 h-5" />
            Lancer la partie
          </button>
          {!canStart && (
            <p className="text-center text-text-secondary text-sm mt-2">
              Chaque joueur doit avoir un rôle et un siège
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Tabs */}
          <div className="flex border-b border-border-color">
            {(['players', 'table', 'roles'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-accent-gold border-b-2 border-accent-gold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab === 'players' && 'Joueurs'}
                {tab === 'table' && 'Table'}
                {tab === 'roles' && 'Rôles'}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === 'players' && (
              <div>
                {/* Phase controls */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => {
                      changePhase('day', phase === 'night' ? dayNumber + 1 : dayNumber);
                      // Clear any active call when switching to day
                      if (calledPlayerId) {
                        endCallPlayer(calledPlayerId);
                        setCalledPlayerId(null);
                      }
                    }}
                    className={`btn flex-1 ${phase === 'day' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    <Sun className="w-4 h-4" />
                    Jour
                  </button>
                  <button
                    onClick={() => changePhase('night', dayNumber)}
                    className={`btn flex-1 ${phase === 'night' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    <Moon className="w-4 h-4" />
                    Nuit
                  </button>
                </div>
                
                {/* Night Calling Panel */}
                {phase === 'night' && (
                  <div className="mb-4 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
                    <h3 className="font-display text-sm mb-3 flex items-center gap-2 text-blue-300">
                      <Phone className="w-4 h-4" />
                      Appeler un joueur
                    </h3>
                    <p className="text-xs text-text-secondary mb-3">
                      Appuyez sur un joueur pour l'appeler silencieusement et utiliser sa capacité.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {players
                        .filter(p => p.isAlive !== false)
                        .sort((a, b) => (a.seatNumber || 99) - (b.seatNumber || 99))
                        .map(player => {
                          const isCalling = calledPlayerId === player.id;
                          return (
                            <button
                              key={player.id}
                              onClick={() => {
                                if (isCalling) {
                                  // End current call
                                  endCallPlayer(player.id);
                                  setCalledPlayerId(null);
                                } else {
                                  // End previous call if any
                                  if (calledPlayerId) {
                                    endCallPlayer(calledPlayerId);
                                  }
                                  // Start new call
                                  callPlayer(player.id);
                                  setCalledPlayerId(player.id);
                                }
                              }}
                              className={`p-3 rounded-lg text-left transition-all ${
                                isCalling 
                                  ? 'bg-accent-gold/30 border-2 border-accent-gold ring-2 ring-accent-gold/30' 
                                  : 'bg-bg-card hover:bg-bg-secondary border border-border-color'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {player.seatNumber && (
                                  <span className="text-xs bg-bg-secondary px-1.5 py-0.5 rounded">
                                    {player.seatNumber}
                                  </span>
                                )}
                                <span className="font-medium text-sm truncate flex-1">{player.pseudo}</span>
                                {isCalling ? (
                                  <PhoneOff className="w-4 h-4 text-accent-gold shrink-0" />
                                ) : (
                                  <Phone className="w-4 h-4 text-text-secondary shrink-0" />
                                )}
                              </div>
                              {player.roleName && (
                                <span className={`text-xs mt-1 block ${
                                  player.roleType === 'Démon' ? 'text-role-demon' :
                                  player.roleType === 'Sbire' ? 'text-role-sbire' :
                                  player.roleType === 'Citadin' ? 'text-role-citadin' :
                                  'text-role-etranger'
                                }`}>
                                  {player.roleName}
                                  {player.fakeRoleName && (
                                    <span className="text-role-etranger ml-1">(pense être {player.fakeRoleName})</span>
                                  )}
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                    {calledPlayerId && (
                      <div className="mt-3 p-2 bg-accent-gold/20 rounded text-center">
                        <p className="text-sm text-accent-gold">
                          En appel : <strong>{players.find(p => p.id === calledPlayerId)?.pseudo}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <PlayerList
                  players={players}
                  isHost
                  showRoles
                  gameStarted
                  onPlayerClick={(player) => {
                    setPlayerAlive(player.id, !player.isAlive);
                  }}
                />
              </div>
            )}

            {activeTab === 'table' && (
              <SeatMap
                players={players}
                totalSeats={players.length}
                showRoles
                onSeatClick={(_, player) => {
                  if (player) {
                    setPlayerAlive(player.id, !player.isAlive);
                  }
                }}
              />
            )}

            {activeTab === 'roles' && (
              <div className="space-y-3">
                {roles.map((role) => (
                  <RoleCard key={role.id} role={role} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role selector modal */}
      {showRoleSelector && selectedPlayer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-bg-card w-full sm:max-w-lg sm:rounded-xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border-color flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg">Attribuer un rôle</h3>
                <p className="text-sm text-text-secondary">{selectedPlayer.pseudo}</p>
              </div>
              <button
                onClick={() => {
                  setShowRoleSelector(false);
                  setSelectedPlayer(null);
                }}
                className="btn btn-ghost p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  compact
                  selected={selectedPlayer.roleId === role.id}
                  onClick={() => handleSelectRole(role.id)}
                />
              ))}
            </div>
            <div className="p-4 border-t border-border-color">
              <button
                onClick={() => setShowSeatSelector(true)}
                className="btn btn-secondary w-full"
              >
                Attribuer un siège ({selectedPlayer.seatNumber || '-'})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seat selector modal */}
      {showSeatSelector && selectedPlayer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-card rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-display text-lg mb-4">
              Siège pour {selectedPlayer.pseudo}
            </h3>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {Array.from({ length: Math.max(players.length, 12) }, (_, i) => i + 1).map(
                (seat) => {
                  const taken = players.find(
                    (p) => p.seatNumber === seat && p.id !== selectedPlayer.id
                  );
                  return (
                    <button
                      key={seat}
                      onClick={() => !taken && handleSelectSeat(seat)}
                      disabled={!!taken}
                      className={`p-3 rounded-lg font-bold ${
                        selectedPlayer.seatNumber === seat
                          ? 'bg-accent-gold text-black'
                          : taken
                          ? 'bg-bg-secondary/50 text-text-secondary cursor-not-allowed'
                          : 'bg-bg-secondary hover:bg-bg-secondary/80'
                      }`}
                    >
                      {seat}
                    </button>
                  );
                }
              )}
            </div>
            <button
              onClick={() => setShowSeatSelector(false)}
              className="btn btn-ghost w-full"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-bg-card w-full sm:max-w-md sm:rounded-xl max-h-[80vh] overflow-hidden flex flex-col rounded-t-xl">
            <div className="p-4 border-b border-border-color flex items-center justify-between">
              <h3 className="font-display text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Paramètres de la partie
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="btn btn-ghost p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* Meeting settings */}
              <div className="card bg-bg-secondary">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-accent-gold" />
                  Réunions automatiques
                </h4>
                
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Activer les réunions</span>
                    <button
                      onClick={() => {
                        const newValue = !meetingsEnabled;
                        setMeetingsEnabled(newValue);
                        updateSettings({ meetingsEnabled: newValue });
                      }}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        meetingsEnabled ? 'bg-accent-gold' : 'bg-bg-card'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                          meetingsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                  
                  <div>
                    <label className="text-sm text-text-secondary block mb-2">
                      Intervalle entre réunions
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="30"
                        value={meetingInterval}
                        onChange={(e) => setMeetingInterval(Number(e.target.value))}
                        onMouseUp={() => updateSettings({ meetingInterval })}
                        onTouchEnd={() => updateSettings({ meetingInterval })}
                        className="flex-1 accent-accent-gold"
                        disabled={!meetingsEnabled}
                      />
                      <span className="text-accent-gold font-bold w-16 text-right">
                        {meetingInterval} min
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Quick actions */}
              <div className="card bg-bg-secondary">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent-gold" />
                  Actions rapides
                </h4>
                
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      startMeeting();
                      setShowSettings(false);
                    }}
                    className="btn btn-secondary w-full justify-start"
                  >
                    <Hand className="w-4 h-4" />
                    Lancer une réunion
                  </button>
                </div>
              </div>
              
              {/* Player management */}
              <div className="card bg-bg-secondary">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent-gold" />
                  Gestion des joueurs
                </h4>
                
                <div className="space-y-2 max-h-48 overflow-auto">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-2 bg-bg-card rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className={player.isAlive ? '' : 'text-text-secondary line-through'}>
                          {player.pseudo}
                        </span>
                        {!player.isAlive && (
                          <span className="text-xs text-accent-red">mort</span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowKickConfirm({ playerId: player.id, pseudo: player.pseudo })}
                        className="p-1.5 hover:bg-accent-red/20 rounded text-text-secondary hover:text-accent-red transition-colors"
                        title="Exclure"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Danger zone */}
              <div className="card bg-accent-red/10 border-accent-red/30">
                <h4 className="font-medium mb-4 flex items-center gap-2 text-accent-red">
                  <AlertTriangle className="w-4 h-4" />
                  Zone dangereuse
                </h4>
                
                <button
                  onClick={() => {
                    setShowSettings(false);
                    setShowEndGameConfirm(true);
                  }}
                  className="btn bg-accent-red/20 text-accent-red hover:bg-accent-red/30 w-full justify-start"
                >
                  <StopCircle className="w-4 h-4" />
                  Terminer la partie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End game confirmation */}
      {showEndGameConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-card rounded-xl p-6 w-full max-w-sm text-center">
            <AlertTriangle className="w-12 h-12 text-accent-red mx-auto mb-4" />
            <h3 className="font-display text-xl mb-2">Terminer la partie ?</h3>
            <p className="text-text-secondary text-sm mb-6">
              Cette action est irréversible. Tous les joueurs seront informés.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndGameConfirm(false)}
                className="btn btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  endGame('host', 'Partie terminée par le maître du jeu');
                  setShowEndGameConfirm(false);
                }}
                className="btn bg-accent-red text-white flex-1"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Kick player confirmation */}
      {showKickConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-card rounded-xl p-6 w-full max-w-sm text-center">
            <UserMinus className="w-12 h-12 text-accent-red mx-auto mb-4" />
            <h3 className="font-display text-xl mb-2">Exclure {showKickConfirm.pseudo} ?</h3>
            <p className="text-text-secondary text-sm mb-6">
              Ce joueur sera retiré de la partie.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowKickConfirm(null)}
                className="btn btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  kickPlayer(showKickConfirm.playerId);
                  setShowKickConfirm(null);
                }}
                className="btn bg-accent-red text-white flex-1"
              >
                Exclure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
