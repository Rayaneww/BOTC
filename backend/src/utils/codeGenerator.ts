import { customAlphabet } from 'nanoid';

// Alphabet sans caractères ambigus (0,O,I,1,l)
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Générateur de code de partie (6 caractères)
const generateCode = customAlphabet(alphabet, 6);

// Générateur d'ID court pour les événements
const generateShortId = customAlphabet(alphabet, 8);

export function generateGameCode(): string {
  return generateCode();
}

export function generateShortEventId(): string {
  return generateShortId();
}

// Formater le temps en MM:SS ou HH:MM:SS
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
