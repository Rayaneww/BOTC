import { createServer } from 'http';
import { createApp } from './app.js';
import { setupSocket } from './socket.js';
import { initDatabase } from './config/database.js';

const PORT = process.env.PORT || 3002;

async function main() {
  // Initialiser la base de données
  await initDatabase();
  
  // Créer l'application Express
  const app = createApp();
  
  // Créer le serveur HTTP
  const httpServer = createServer(app);
  
  // Configurer Socket.IO
  const io = setupSocket(httpServer);
  
  // Démarrer le serveur
  httpServer.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🏰 BOTCT Backend Server                                  ║
║                                                            ║
║   REST API:    http://localhost:${PORT}/api                  ║
║   WebSocket:   ws://localhost:${PORT}                        ║
║   Health:      http://localhost:${PORT}/api/health           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
  
  // Gestion de l'arrêt propre
  process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    io.close();
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
