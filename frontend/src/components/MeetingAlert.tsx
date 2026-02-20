'use client';

import { Bell, Clock, X } from 'lucide-react';

interface MeetingAlertProps {
  meetingNumber: number;
  timeElapsed: string;
  onAcknowledge?: () => void;
  onPostpone?: () => void;
  onDismiss?: () => void;
  isHost?: boolean;
}

export function MeetingAlert({
  meetingNumber,
  timeElapsed,
  onAcknowledge,
  onPostpone,
  onDismiss,
  isHost = true,
}: MeetingAlertProps) {
  return (
    <div className="meeting-alert">
      <div className="meeting-alert-card animate-glow">
        {!isHost && onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 text-text-secondary hover:text-text-primary"
          >
            <X className="w-6 h-6" />
          </button>
        )}
        
        <Bell className="w-16 h-16 text-accent-red mx-auto mb-4 animate-bounce" />
        
        <h2 className="text-2xl font-display font-bold mb-2">
          Réunion du Village !
        </h2>
        
        <p className="text-text-secondary mb-4">
          {isHost ? '10 minutes se sont écoulées' : 'Le Conteur appelle une réunion'}
        </p>

        <div className="flex items-center justify-center gap-2 text-accent-gold mb-6">
          <Clock className="w-5 h-5" />
          <span className="font-mono text-xl">{timeElapsed}</span>
        </div>

        {isHost ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={onAcknowledge}
              className="btn btn-primary w-full"
            >
              Commencer la réunion
            </button>
            <button
              onClick={onPostpone}
              className="btn btn-ghost w-full"
            >
              Repousser de 2 minutes
            </button>
          </div>
        ) : (
          <button
            onClick={onDismiss}
            className="btn btn-primary w-full"
          >
            Compris
          </button>
        )}
      </div>
    </div>
  );
}
