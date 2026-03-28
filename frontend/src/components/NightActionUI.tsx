'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

export type NightActionType =
  | 'choose_target'
  | 'choose_two'
  | 'choose_master'
  | 'info_receiver'
  | 'none';

export const NIGHT_ACTION_CONFIG: Record<string, NightActionType> = {
  'Diablotin': 'choose_target',
  'Empoisonneur': 'choose_target',
  'Moine': 'choose_target',
  'Voyante': 'choose_two',
  'Majordome': 'choose_master',
  'Archiviste': 'info_receiver',
  'Enquêteur': 'info_receiver',
  'Lavandière': 'info_receiver',
  'Cuistot': 'info_receiver',
  'Empathe': 'info_receiver',
  'Fossoyeur': 'info_receiver',
};

export function getNightActionType(roleName: string): NightActionType {
  return NIGHT_ACTION_CONFIG[roleName] ?? 'none';
}

interface NightPlayer {
  id: string;
  pseudo: string;
  isAlive: boolean;
  seatNumber?: number | null;
}

interface NightActionUIProps {
  roleName: string;
  players: NightPlayer[];
  myPlayerId: string;
  nightInfo: string | null;
  onSubmitTarget: (targetId: string, actionType: 'choose_target' | 'choose_master') => void;
  onSubmitTwo: (targetIds: string[]) => void;
}

export function NightActionUI({
  roleName,
  players,
  myPlayerId,
  nightInfo,
  onSubmitTarget,
  onSubmitTwo,
}: NightActionUIProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedTwo, setSelectedTwo] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const actionType = getNightActionType(roleName);
  const alivePlayers = players.filter((p) => p.isAlive);
  const othersAlive = alivePlayers.filter((p) => p.id !== myPlayerId);

  const handleSubmitTarget = () => {
    if (!selected) return;
    setSubmitted(true);
    onSubmitTarget(selected, actionType as 'choose_target' | 'choose_master');
  };

  const handleToggleTwo = (id: string) => {
    setSelectedTwo((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 2
        ? [...prev, id]
        : prev
    );
  };

  const handleSubmitTwo = () => {
    if (selectedTwo.length !== 2) return;
    setSubmitted(true);
    onSubmitTwo(selectedTwo);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto">
      <div className="min-h-full flex flex-col justify-center p-4">
        <p className="text-gray-500 text-sm text-center mb-2">{roleName}</p>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Check className="w-12 h-12 text-green-400 mb-4" />
            <p className="text-white font-bold text-lg">Action envoyée</p>
            <p className="text-gray-400 text-sm mt-2">
              Attendez que le Maître du Jeu termine votre tour
            </p>
          </div>
        ) : actionType === 'info_receiver' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {nightInfo ? (
              <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm">
                <p className="text-gray-400 text-sm mb-3">Information du MJ :</p>
                <p className="text-white text-xl font-bold">{nightInfo}</p>
              </div>
            ) : (
              <>
                <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400">En attente d'information du MJ…</p>
              </>
            )}
          </div>
        ) : actionType === 'choose_target' || actionType === 'choose_master' ? (
          <div>
            <h2 className="text-white font-bold text-xl text-center mb-6">
              Choisissez votre cible
            </h2>
            <div className="space-y-2 mb-6">
              {othersAlive.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${
                    selected === p.id
                      ? 'bg-accent-gold text-black font-bold'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  {p.seatNumber != null && (
                    <span className="text-sm opacity-60 mr-2">#{p.seatNumber}</span>
                  )}
                  {p.pseudo}
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmitTarget}
              disabled={!selected}
              className="w-full py-4 rounded-xl bg-accent-gold text-black font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmer
            </button>
          </div>
        ) : actionType === 'choose_two' ? (
          <div>
            <h2 className="text-white font-bold text-xl text-center mb-2">
              Choisissez deux joueurs
            </h2>
            <p className="text-gray-400 text-sm text-center mb-6">
              {selectedTwo.length}/2 sélectionnés
            </p>
            <div className="space-y-2 mb-6">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleToggleTwo(p.id)}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${
                    selectedTwo.includes(p.id)
                      ? 'bg-accent-gold text-black font-bold'
                      : p.isAlive
                      ? 'bg-gray-800 text-white hover:bg-gray-700'
                      : 'bg-gray-900 text-gray-500'
                  }`}
                >
                  {p.seatNumber != null && (
                    <span className="text-sm opacity-60 mr-2">#{p.seatNumber}</span>
                  )}
                  {p.pseudo}
                  {!p.isAlive && <span className="ml-2 text-xs">☠️</span>}
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmitTwo}
              disabled={selectedTwo.length !== 2}
              className="w-full py-4 rounded-xl bg-accent-gold text-black font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmer
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-400">Votre rôle n'a pas d'action cette nuit.</p>
            <p className="text-gray-500 text-sm mt-2">
              Attendez que le Maître du Jeu termine votre tour
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
