import rateLimit from 'express-rate-limit';

// Rate limiter pour la création de parties
export const createGameLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 créations max par minute
  message: { error: 'Trop de créations de parties. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter pour rejoindre une partie
export const joinGameLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 joins max par minute
  message: { error: 'Trop de tentatives. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter général pour l'API
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requêtes max par minute
  message: { error: 'Trop de requêtes. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
