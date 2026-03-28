'use client';

import { Moon } from 'lucide-react';

export function NightEyesClosed() {
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center select-none">
      <Moon className="w-16 h-16 text-blue-300 mb-6" />
      <h1 className="text-3xl font-bold text-white mb-3">Fermez les yeux</h1>
      <p className="text-gray-500 text-center px-8">
        Attendez que le Maître du Jeu vous appelle
      </p>
    </div>
  );
}
