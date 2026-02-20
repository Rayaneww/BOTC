'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Shield,
  Users,
  Scroll,
  Sun,
  Moon,
  CheckCircle,
  Clock,
  Skull,
  Eye,
  User,
  Bell,
  Hand,
  Vote,
  Check,
  Phone,
  AlertCircle,
} from 'lucide-react';
import { api, type Role, type Player } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { RoleCard, RoleBadge } from '@/components/RoleCard';
import { RoleReveal, RoleDisplay } from '@/components/RoleReveal';
import { MeetingAlert } from '@/components/MeetingAlert';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const gameCode = params.code as string;

  const [gameStatus, setGameStatus] = useState<'lobby' | 'playing' | 'finished'>('lobby');
  const [gameName, setGameName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [mySeat, setMySeat] = useState<number | null>(null);
  const [isAlive, setIsAlive] = useState(true);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [phase, setPhase] = useState<'day' | 'night'>('day');
  const [dayNumber, setDayNumber] = useState(1);
  const [isReady, setIsReadyState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'role' | 'players' | 'roles'>('role');
  const [notes, setNotes] = useState('');
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const [meetingAlert, setMeetingAlert] = useState<{ number: number; time: string } | null>(null);
  const [bluffRoles, setBluffRoles] = useState<Role[]>([]);
  const [nightCallActive, setNightCallActive] = useState(false); // Being called by host at night
  const [espionRoles, setEspionRoles] = useState<{ playerId: string; pseudo: string; seatNumber: number | null; roleName: string; roleType: string }[]>([]);
  
  // Meeting/Voting state
  const [meetingStatus, setMeetingStatus] = useState<'none' | 'nomination' | 'voting' | 'results'>('none');
  const [nominatedPlayers, setNominatedPlayers] = useState<{ playerId: string; pseudo: string; seatNumber: number | null }[]>([]);
  const [voteCount, setVoteCount] = useState({ total: 0, voted: 0, remaining: 0 });
  const [hasVoted, setHasVoted] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [votingResults, setVotingResults] = useState<{
    votes: { playerId: string; pseudo: string; roleType: string | null; voteCount: number }[];
    individualVotes: { voterId: string; voterPseudo: string; voterRoleType: string | null; votedForId: string; votedForPseudo: string }[];
    eliminated: { playerId: string; pseudo: string; roleType: string | null } | null;
  } | null>(null);

  // Socket handlers
  const handleLobbyUpdate = useCallback((data: any) => {
    setPlayers(data.players);
    const playerId = localStorage.getItem('player_id');
    const me = data.players.find((p: Player) => p.id === playerId);
    if (me) {
      setIsReadyState(me.isReady);
    }
  }, []);

  const handleGameStarted = useCallback((data: any) => {
    setGameStatus('playing');
    setPhase(data.phase);
  }, []);

  const handleRoleRevealed = useCallback((data: any) => {
    setMyRole(data.role);
    setMySeat(data.seatNumber);
    // Store bluff roles for Demons
    if (data.bluffRoles) {
      setBluffRoles(data.bluffRoles);
    }
    // Store all player roles for Espion
    if (data.allPlayerRoles) {
      setEspionRoles(data.allPlayerRoles);
    }
    // Trigger the reveal animation
    setShowRoleReveal(true);
  }, []);

  const handlePhaseChanged = useCallback((data: any) => {
    setPhase(data.phase);
    setDayNumber(data.dayNumber);
    // Clear night call when phase changes
    if (data.phase === 'day') {
      setNightCallActive(false);
    }
  }, []);

  const handlePlayerStatusChanged = useCallback((data: any) => {
    const playerId = localStorage.getItem('player_id');
    if (data.playerId === playerId) {
      setIsAlive(data.isAlive);
    }
    setPlayers((prev) =>
      prev.map((p) => (p.id === data.playerId ? { ...p, isAlive: data.isAlive } : p))
    );
  }, []);

  const handleGameEnded = useCallback((data: any) => {
    setGameStatus('finished');
  }, []);
  
  const handlePlayerLeft = useCallback((data: { playerId: string; pseudo?: string; kicked?: boolean }) => {
    const myPlayerId = localStorage.getItem('player_id');
    if (data.kicked && data.playerId === myPlayerId) {
      // Player was kicked, redirect to home
      localStorage.removeItem(`player_token_${gameCode}`);
      localStorage.removeItem('player_id');
      router.push('/');
    }
  }, [gameCode, router]);

  // Night call handlers
  const handleNightCall = useCallback((data: { playerId: string }) => {
    const myPlayerId = localStorage.getItem('player_id');
    if (data.playerId === myPlayerId) {
      setNightCallActive(true);
    }
  }, []);

  const handleNightCallEnd = useCallback((data: { playerId: string }) => {
    const myPlayerId = localStorage.getItem('player_id');
    if (data.playerId === myPlayerId) {
      setNightCallActive(false);
    }
  }, []);

  const handleReconnected = useCallback((data: any) => {
    setGameStatus(data.game.status);
    if (data.state) {
      setPhase(data.state.phase);
      setDayNumber(data.state.dayNumber);
    }
    setPlayers(data.players);
  }, []);

  const handleMeetingAlert = useCallback((data: { meetingNumber: number; timeElapsed: string }) => {
    setMeetingAlert({ number: data.meetingNumber, time: data.timeElapsed });
  }, []);
  
  // Meeting handlers
  const handleMeetingStarted = useCallback(() => {
    setMeetingStatus('nomination');
    setNominatedPlayers([]);
    setVotingResults(null);
    setHasVoted(false);
    setMyVote(null);
    setMeetingAlert(null);
  }, []);
  
  const handleNominationsUpdated = useCallback((data: any) => {
    setNominatedPlayers(data.nominated);
  }, []);
  
  const handleVotingStarted = useCallback((data: any) => {
    setMeetingStatus('voting');
    setNominatedPlayers(data.nominated);
    setVoteCount(data.voteCount);
    setHasVoted(false);
    setMyVote(null);
  }, []);
  
  const handleVoteCast = useCallback((data: any) => {
    setVoteCount(data.voteCount);
  }, []);
  
  const handleVoteConfirmed = useCallback((data: any) => {
    setHasVoted(true);
    setMyVote(data.nomineeId);
  }, []);
  
  const handleVotingResults = useCallback((data: any) => {
    setMeetingStatus('results');
    setVotingResults(data);
  }, []);
  
  const handleMeetingEnded = useCallback(() => {
    setMeetingStatus('none');
    setNominatedPlayers([]);
    setVotingResults(null);
    setHasVoted(false);
    setMyVote(null);
    setVoteCount({ total: 0, voted: 0, remaining: 0 });
  }, []);

  const { isConnected, setReady, castVote } = useSocket({
    gameCode,
    onLobbyUpdate: handleLobbyUpdate,
    onGameStarted: handleGameStarted,
    onRoleRevealed: handleRoleRevealed,
    onPhaseChanged: handlePhaseChanged,
    onPlayerStatusChanged: handlePlayerStatusChanged,
    onGameEnded: handleGameEnded,
    onPlayerLeft: handlePlayerLeft,
    onReconnected: handleReconnected,
    onMeetingAlert: handleMeetingAlert,
    onMeetingStarted: handleMeetingStarted,
    onNominationsUpdated: handleNominationsUpdated,
    onVotingStarted: handleVotingStarted,
    onVoteCast: handleVoteCast,
    onVoteConfirmed: handleVoteConfirmed,
    onVotingResults: handleVotingResults,
    onMeetingEnded: handleMeetingEnded,
    onNightCall: handleNightCall,
    onNightCallEnd: handleNightCallEnd,
  });

  // Load initial data
  useEffect(() => {
    const token = localStorage.getItem(`player_token_${gameCode}`);
    if (!token) {
      router.push(`/join/${gameCode}`);
      return;
    }

    // Load saved notes
    const savedNotes = localStorage.getItem(`notes_${gameCode}`);
    if (savedNotes) setNotes(savedNotes);

    Promise.all([api.getGame(gameCode), api.getMyRole(gameCode), api.getRoles(gameCode)])
      .then(([gameData, roleData, rolesData]) => {
        setGameName(gameData.name);
        setGameStatus(gameData.status);
        if (roleData.role) {
          setMyRole(roleData.role);
          setMySeat(roleData.seatNumber);
          setIsAlive(roleData.isAlive);
        }
        setAllRoles(rolesData.roles);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [gameCode, router]);

  // Save notes
  useEffect(() => {
    localStorage.setItem(`notes_${gameCode}`, notes);
  }, [notes, gameCode]);

  const toggleReady = () => {
    const newReady = !isReady;
    setIsReadyState(newReady);
    setReady(newReady);
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
    <div className="flex-1 flex flex-col max-h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-color p-3 sm:p-4 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base sm:text-lg font-bold truncate">{gameName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs sm:text-sm text-text-secondary font-mono">{gameCode}</span>
              <span className={`text-xs ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                {isConnected ? '●' : '○'}
              </span>
            </div>
          </div>

          {gameStatus === 'playing' && (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-bg-card/50 px-2 sm:px-3 py-1.5 rounded-lg shrink-0">
              {phase === 'day' ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              )}
              <span className="text-xs sm:text-sm font-medium">
                {phase === 'day' ? 'J' : 'N'}{dayNumber}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Lobby view */}
      {gameStatus === 'lobby' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="card text-center mb-6">
            <Clock className="w-12 h-12 text-accent-gold mx-auto mb-4" />
            <h2 className="text-xl font-display mb-2">En attente du lancement</h2>
            <p className="text-text-secondary">
              Le maître du jeu prépare la partie...
            </p>
          </div>

          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display flex items-center gap-2">
                <Users className="w-5 h-5" />
                Joueurs ({players.length})
              </h3>
            </div>
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg"
                >
                  <span className="flex-1 font-medium">{player.pseudo}</span>
                  {player.isReady ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-text-secondary" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={toggleReady}
            className={`btn w-full py-4 ${isReady ? 'btn-secondary' : 'btn-primary'}`}
          >
            <CheckCircle className="w-5 h-5" />
            {isReady ? 'Annuler (Prêt ✓)' : 'Je suis prêt'}
          </button>
        </div>
      )}

      {/* Playing view */}
      {gameStatus === 'playing' && (
        <>
          {/* Phase Banner */}
          <div className={`shrink-0 p-3 text-center ${
            phase === 'day' 
              ? 'bg-yellow-500/20 border-b border-yellow-500/30' 
              : 'bg-blue-900/40 border-b border-blue-500/30'
          }`}>
            <div className="flex items-center justify-center gap-2">
              {phase === 'day' ? (
                <>
                  <Sun className="w-5 h-5 text-yellow-400" />
                  <span className="font-medium text-yellow-200">Jour {dayNumber}</span>
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5 text-blue-300" />
                  <span className="font-medium text-blue-200">Nuit {dayNumber}</span>
                </>
              )}
            </div>
            <p className="text-xs mt-1 text-text-secondary">
              {phase === 'day' 
                ? 'Vous pouvez parler et vous déplacer librement' 
                : 'Restez silencieux et attendez que le Conteur vous appelle'
              }
            </p>
          </div>
          
          {/* Night Call Notification */}
          {phase === 'night' && nightCallActive && (
            <div className="shrink-0 p-4 bg-accent-gold/30 border-b border-accent-gold animate-pulse">
              <div className="flex items-center justify-center gap-3">
                <Phone className="w-6 h-6 text-accent-gold" />
                <div className="text-center">
                  <p className="font-bold text-accent-gold">Le Conteur vous appelle !</p>
                  <p className="text-sm text-text-secondary">Rejoignez le Conteur pour utiliser votre capacité</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Tabs */}
          <div className="flex border-b border-border-color shrink-0">
            {(['role', 'players', 'roles'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-accent-gold border-b-2 border-accent-gold bg-accent-gold/5'
                    : 'text-text-secondary hover:text-text-primary active:bg-white/5'
                }`}
              >
                {tab === 'role' && '🎭 Rôle'}
                {tab === 'players' && '👥 Joueurs'}
                {tab === 'roles' && '📜 Scripts'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-4 mobile-scroll">
            {/* My Role tab */}
            {activeTab === 'role' && (
              <div className="space-y-4">
                {!isAlive && (
                  <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-4 flex items-center gap-3">
                    <Skull className="w-6 h-6 text-accent-red shrink-0" />
                    <div>
                      <p className="font-bold text-accent-red">Vous êtes mort</p>
                      <p className="text-sm text-text-secondary">
                        Vous pouvez toujours observer la partie
                      </p>
                    </div>
                  </div>
                )}

                {myRole ? (
                  <RoleDisplay role={myRole} seatNumber={mySeat} />
                ) : (
                  <div className="card text-center py-8">
                    <Shield className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                    <p className="text-text-secondary">
                      Votre rôle n'a pas encore été attribué
                    </p>
                  </div>
                )}
                
                {/* Bluff roles for Demons */}
                {myRole?.type === 'Démon' && bluffRoles.length > 0 && (
                  <div className="card border-2 border-role-demon/30 bg-role-demon/5">
                    <h3 className="font-display text-lg mb-3 flex items-center gap-2 text-role-demon">
                      <Eye className="w-5 h-5" />
                      Rôles pour Bluffer
                    </h3>
                    <p className="text-sm text-text-secondary mb-3">
                      Ces 3 rôles ne sont PAS dans la partie. Vous pouvez prétendre être l'un d'eux.
                    </p>
                    <div className="space-y-2">
                      {bluffRoles.map((role) => (
                        <div
                          key={role.id}
                          className="p-3 bg-bg-card rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{role.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              role.type === 'Citadin' ? 'bg-role-citadin/20 text-role-citadin' :
                              'bg-role-etranger/20 text-role-etranger'
                            }`}>
                              {role.type}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary">{role.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Espion - voir tous les rôles */}
                {espionRoles.length > 0 && (
                  <div className="card border-2 border-role-sbire/30 bg-role-sbire/5">
                    <h3 className="font-display text-lg mb-3 flex items-center gap-2 text-role-sbire">
                      <Eye className="w-5 h-5" />
                      Rôles de tous les joueurs
                    </h3>
                    <p className="text-sm text-text-secondary mb-3">
                      En tant qu'Espion, vous connaissez le rôle de chaque joueur.
                    </p>
                    <div className="space-y-2">
                      {espionRoles.map((p) => (
                        <div
                          key={p.playerId}
                          className="p-3 bg-bg-card rounded-lg flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary">#{p.seatNumber}</span>
                            <span className="font-medium">{p.pseudo}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{p.roleName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              p.roleType === 'Citadin' ? 'bg-role-citadin/20 text-role-citadin' :
                              p.roleType === 'Étranger' ? 'bg-role-etranger/20 text-role-etranger' :
                              p.roleType === 'Sbire' ? 'bg-role-sbire/20 text-role-sbire' :
                              'bg-role-demon/20 text-role-demon'
                            }`}>
                              {p.roleType}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes section */}
                <div className="card">
                  <h3 className="font-display text-lg mb-3 flex items-center gap-2">
                    <Scroll className="w-5 h-5" />
                    Mes Notes
                  </h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notez vos observations, suspicions..."
                    className="input min-h-[100px] sm:min-h-[120px] resize-none"
                  />
                </div>
              </div>
            )}

            {/* Players tab */}
            {activeTab === 'players' && (
              <div className="space-y-2">
                {players
                  .sort((a, b) => (a.seatNumber || 99) - (b.seatNumber || 99))
                  .map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 p-3 bg-bg-secondary rounded-lg ${
                        player.isAlive === false ? 'opacity-50' : ''
                      }`}
                    >
                      {player.seatNumber && (
                        <div className="w-8 h-8 rounded-full bg-bg-card flex items-center justify-center text-sm font-bold border border-border-color">
                          {player.seatNumber}
                        </div>
                      )}
                      <span className="flex-1 font-medium">{player.pseudo}</span>
                      {player.isAlive === false && (
                        <Skull className="w-5 h-5 text-text-secondary" />
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* All Roles tab */}
            {activeTab === 'roles' && (
              <div className="space-y-3">
                {['Démon', 'Sbire', 'Citadin', 'Étranger'].map((type) => {
                  const typeRoles = allRoles.filter((r) => r.type === type);
                  if (typeRoles.length === 0) return null;

                  return (
                    <div key={type}>
                      <h3 className={`text-sm font-bold mb-2 ${
                        type === 'Démon' ? 'text-role-demon' :
                        type === 'Sbire' ? 'text-role-sbire' :
                        type === 'Citadin' ? 'text-role-citadin' :
                        'text-role-etranger'
                      }`}>
                        {type}s ({typeRoles.length})
                      </h3>
                      <div className="space-y-2">
                        {typeRoles.map((role) => (
                          <RoleCard key={role.id} role={role} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Finished view */}
      {gameStatus === 'finished' && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="card text-center max-w-md">
            <Shield className="w-16 h-16 text-accent-gold mx-auto mb-4" />
            <h2 className="text-2xl font-display mb-2">Partie terminée</h2>
            <p className="text-text-secondary mb-6">
              Merci d'avoir joué !
            </p>
            <button onClick={() => router.push('/')} className="btn btn-primary">
              Retour à l'accueil
            </button>
          </div>
        </div>
      )}

      {/* Role Reveal Animation Modal */}
      {showRoleReveal && myRole && (
        <RoleReveal
          role={myRole}
          seatNumber={mySeat}
          onClose={() => setShowRoleReveal(false)}
          autoShow={true}
        />
      )}

      {/* Meeting Alert Modal */}
      {meetingAlert && meetingStatus === 'none' && (
        <MeetingAlert
          meetingNumber={meetingAlert.number}
          timeElapsed={meetingAlert.time}
          onDismiss={() => setMeetingAlert(null)}
          isHost={false}
        />
      )}
      
      {/* Meeting/Voting Panel */}
      {meetingStatus !== 'none' && gameStatus === 'playing' && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4">
            {/* Meeting Header */}
            <div className="text-center mb-6">
              {meetingStatus === 'nomination' && (
                <>
                  <Hand className="w-12 h-12 text-accent-gold mx-auto mb-2" />
                  <h2 className="font-display text-2xl">Réunion du Village</h2>
                  <p className="text-text-secondary">
                    Le Conteur désigne les nominés...
                  </p>
                </>
              )}
              {meetingStatus === 'voting' && (
                <>
                  <Vote className="w-12 h-12 text-accent-gold mx-auto mb-2" />
                  <h2 className="font-display text-2xl">Phase de Vote</h2>
                  <p className="text-text-secondary">
                    {hasVoted ? 'Votre vote a été enregistré' : 'Choisissez qui éliminer'}
                  </p>
                </>
              )}
              {meetingStatus === 'results' && (
                <>
                  <Skull className="w-12 h-12 text-accent-red mx-auto mb-2" />
                  <h2 className="font-display text-2xl">Résultats</h2>
                  <p className="text-text-secondary">Le village a parlé</p>
                </>
              )}
            </div>
            
            {/* Nomination Phase - Just watching */}
            {meetingStatus === 'nomination' && (
              <div className="flex-1 overflow-auto">
                <div className="mb-4">
                  <h3 className="text-sm text-text-secondary mb-2">
                    Nominés ({nominatedPlayers.length}/3)
                  </h3>
                  {nominatedPlayers.length > 0 ? (
                    <div className="space-y-2">
                      {nominatedPlayers.map((p) => (
                        <div
                          key={p.playerId}
                          className="p-3 bg-accent-red/20 border border-accent-red rounded-lg"
                        >
                          <span className="font-medium">{p.pseudo}</span>
                          {p.seatNumber && (
                            <span className="text-xs text-text-secondary ml-2">
                              Siège #{p.seatNumber}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-bg-card rounded-lg text-center text-text-secondary">
                      En attente des nominations...
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Voting Phase */}
            {meetingStatus === 'voting' && (
              <div className="flex-1 overflow-auto">
                {/* Vote progress */}
                <div className="mb-4 p-4 bg-bg-secondary rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-text-secondary">Progression</span>
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
                
                {/* Voting buttons or confirmation */}
                {!hasVoted && isAlive ? (
                  <div className="space-y-2">
                    <h3 className="text-sm text-text-secondary mb-2">
                      Votez pour éliminer :
                    </h3>
                    {nominatedPlayers.map((p) => (
                      <button
                        key={p.playerId}
                        onClick={() => castVote(p.playerId)}
                        className="w-full p-4 bg-bg-card hover:bg-accent-red/20 border-2 border-transparent hover:border-accent-red rounded-lg transition-colors text-left"
                      >
                        <span className="font-medium">{p.pseudo}</span>
                        {p.seatNumber && (
                          <span className="text-xs text-text-secondary ml-2">
                            Siège #{p.seatNumber}
                          </span>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => castVote('')}
                      className="w-full p-4 bg-bg-card hover:bg-bg-secondary border-2 border-transparent hover:border-text-secondary rounded-lg transition-colors text-center text-text-secondary"
                    >
                      Vote blanc (ne pas éliminer)
                    </button>
                  </div>
                ) : hasVoted ? (
                  <div className="text-center p-6 bg-bg-card rounded-lg">
                    <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="font-medium">Vote enregistré</p>
                    {myVote && myVote !== '' && (
                      <p className="text-sm text-text-secondary mt-1">
                        Vous avez voté pour{' '}
                        {nominatedPlayers.find((p) => p.playerId === myVote)?.pseudo || 'quelqu\'un'}
                      </p>
                    )}
                    {myVote === '' && (
                      <p className="text-sm text-text-secondary mt-1">
                        Vote blanc
                      </p>
                    )}
                    <p className="text-xs text-text-secondary mt-4">
                      En attente des autres votes...
                    </p>
                  </div>
                ) : (
                  <div className="text-center p-6 bg-bg-card rounded-lg">
                    <Skull className="w-12 h-12 text-text-secondary mx-auto mb-2" />
                    <p className="text-text-secondary">
                      Les morts ne votent pas
                    </p>
                  </div>
                )}
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
                            <span className="font-medium">{v.pseudo}</span>
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
                <div className="space-y-2 mb-6">
                  {votingResults.individualVotes.map((v) => {
                    return (
                      <div
                        key={v.voterId}
                        className="p-2 bg-bg-card rounded-lg text-sm flex items-center justify-between"
                      >
                        <span className="font-medium">{v.voterPseudo}</span>
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
                    <Skull className="w-8 h-8 text-accent-red mx-auto mb-2" />
                    <p className="text-accent-red font-bold text-lg">
                      {votingResults.eliminated.pseudo} est éliminé
                    </p>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-bg-secondary rounded-lg">
                    <p className="text-text-secondary">
                      Pas d'élimination
                    </p>
                  </div>
                )}
                
                <p className="text-center text-xs text-text-secondary mt-4">
                  En attente de la confirmation du Conteur...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
