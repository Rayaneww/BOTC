import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import type { JWTPayload } from '../models/types.js';

// Extension du type Request pour inclure les infos d'auth
declare global {
  namespace Express {
    interface Request {
      auth?: JWTPayload;
    }
  }
}

// Middleware pour vérifier l'authentification (optionnel)
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      req.auth = payload;
    }
  }
  
  next();
}

// Middleware pour exiger l'authentification
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification requis' });
  }
  
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
  
  req.auth = payload;
  next();
}

// Middleware pour exiger le rôle host
export function requireHost(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || req.auth.type !== 'host') {
    return res.status(403).json({ error: 'Accès réservé au maître du jeu' });
  }
  next();
}

// Middleware pour exiger le rôle player
export function requirePlayer(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || req.auth.type !== 'player') {
    return res.status(403).json({ error: 'Accès réservé aux joueurs' });
  }
  next();
}

// Middleware pour vérifier que le token correspond au code de partie
export function requireGameAccess(req: Request, res: Response, next: NextFunction) {
  const gameCode = req.params.code;
  
  if (!req.auth || req.auth.gameCode !== gameCode) {
    return res.status(403).json({ error: 'Accès non autorisé à cette partie' });
  }
  
  next();
}
