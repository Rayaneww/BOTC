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
  UserMinus,
  Phone,
  PhoneOff,
} from 'lucide-react';
import { api, type Role, type Player } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { NIGHT_ACTION_CONFIG, getNightActionType } from '@/components/NightActionUI';
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
  
  const [showKickConfirm, setShowKickConfirm] = useState<{ playerId: string; pseudo: string } | null>(null);

  // Night calling state
  const [calledPlayerId, setCalledPlayerId] = useState<string | null>(null);

  // Night action state
  const [nightActions, setNightActions] = useState<Array<{
    playerId: string;
    playerPseudo: string;
    roleName: string;
    actionType: string;
    targetPseudo?: string;
    targetPseudos?: string[];
  }>>([]);
  const [nightInfoInputs, setNightInfoInputs] = useState<Record<string, string>>({});

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
  
  const handleNightActionReceived = useCallback((data: any) => {
    setNightActions((prev) => {
      const exists = prev.find((a) => a.playerId === data.playerId);
      if (exists) {
        return prev.map((a) => (a.playerId === data.playerId ? data : a));
      }
      return [...prev, data];
    });
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
    callPlayer,
    endCallPlayer,
    sendNightInfo,
  } = useSocket({
    gameCode,
    onHostLobbyUpdate: handleHostLobbyUpdate,
    onLobbyUpdate: handleHostLobbyUpdate,
    onGameStarted: handleGameStarted,
    onTimerTick: handleTimerTick,
    onMeetingAlert: handleMeetingAlert,
    onPhaseChanged: handlePhaseChanged,
    onPlayerStatusChanged: handlePlayerStatusChanged,
    onPlayerEliminated: handlePlayerEliminated,
    onNightActionReceived: handleNightActionReceived,
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
      {meetingAlert && (
        <MeetingAlert
          meetingNumber={meetingAlert.number}
          timeElapsed={meetingAlert.time}
          onAcknowledge={() => {
            acknowledgeMeeting();
            setMeetingAlert(null);
          }}
          onPostpone={() => {
            postponeMeeting();
            setMeetingAlert(null);
          }}
        />
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
                    onClick={() => {
                      setNightActions([]);
                      setNightInfoInputs({});
                      changePhase('night', dayNumber);
                    }}
                    className={`btn flex-1 ${phase === 'night' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    <Moon className="w-4 h-4" />
                    Nuit
                  </button>
                </div>
                
                <PlayerList
                  players={players}
                  isHost
                  showRoles
                  gameStarted
                  onPlayerClick={(player) => {
                    setPlayerAlive(player.id, !player.isAlive);
                  }}
                />

                {/* Night dashboard */}
                {phase === 'night' && gameStatus === 'playing' && (
                  <div className="card mt-4">
                    <h3 className="font-display text-base font-bold mb-4 flex items-center gap-2">
                      <Moon className="w-4 h-4 text-blue-300" />
                      Gestion de la nuit
                    </h3>

                    {/* Night actions received */}
                    {nightActions.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
                          Actions reçues
                        </p>
                        <div className="space-y-1">
                          {nightActions.map((a, i) => (
                            <div key={i} className="text-sm bg-bg-secondary rounded-lg p-3">
                              <span className="font-medium">{a.playerPseudo}</span>
                              <span className="text-text-secondary"> ({a.roleName}) → </span>
                              {a.targetPseudo && (
                                <span className="text-accent-gold font-medium">{a.targetPseudo}</span>
                              )}
                              {a.targetPseudos && (
                                <span className="text-accent-gold font-medium">
                                  {a.targetPseudos.join(' & ')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Players to call */}
                    <p className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
                      Joueurs à appeler
                    </p>
                    <div className="space-y-2">
                      {players
                        .filter(
                          (p) =>
                            p.isAlive &&
                            p.roleName &&
                            getNightActionType(p.roleName) !== 'none'
                        )
                        .map((p) => {
                          const isInfoReceiver =
                            NIGHT_ACTION_CONFIG[p.roleName!] === 'info_receiver';
                          const isCalled = calledPlayerId === p.id;
                          return (
                            <div key={p.id} className="bg-bg-secondary rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium text-sm">{p.pseudo}</span>
                                  <span className="text-xs text-text-secondary ml-2">
                                    ({p.roleName})
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    if (isCalled) {
                                      endCallPlayer(p.id);
                                      setCalledPlayerId(null);
                                    } else {
                                      callPlayer(p.id);
                                      setCalledPlayerId(p.id);
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    isCalled
                                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                      : 'bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30'
                                  }`}
                                >
                                  {isCalled ? 'Terminer' : 'Appeler'}
                                </button>
                              </div>

                              {isInfoReceiver && isCalled && (
                                <div className="mt-2 flex gap-2">
                                  <input
                                    value={nightInfoInputs[p.id] || ''}
                                    onChange={(e) =>
                                      setNightInfoInputs((prev) => ({
                                        ...prev,
                                        [p.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Information à envoyer…"
                                    className="flex-1 bg-bg-primary rounded-lg px-3 py-2 text-sm border border-border-color focus:outline-none focus:border-accent-gold"
                                  />
                                  <button
                                    onClick={() => {
                                      sendNightInfo(p.id, nightInfoInputs[p.id] || '');
                                      setNightInfoInputs((prev) => ({ ...prev, [p.id]: '' }));
                                    }}
                                    className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30"
                                  >
                                    Envoyer
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      {players.filter(
                        (p) => p.isAlive && p.roleName && getNightActionType(p.roleName) !== 'none'
                      ).length === 0 && (
                        <p className="text-text-secondary text-sm text-center py-2">
                          Aucun joueur avec action nocturne
                        </p>
                      )}
                    </div>
                  </div>
                )}
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
