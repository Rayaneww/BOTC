import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.js';

export function createApp() {
  const app = express();
  
  // CORS - permissif en dev
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  
  // Body parsing
  app.use(express.json());
  
  // Rate limiting global
  app.use('/api', apiLimiter);
  
  // Routes API
  app.use('/api', routes);
  
  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
  });
  
  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Erreur serveur interne' });
  });
  
  return app;
}
