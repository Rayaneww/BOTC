import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../models/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'botct-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

export function generateToken(payload: Omit<JWTPayload, 'exp' | 'iat'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
