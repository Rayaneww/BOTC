import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/botct.db');

// Créer le dossier data s'il n'existe pas
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Instance globale de la base de données
let _db: SqlJsDatabase | null = null;
let _SQL: SqlJsStatic | null = null;

// Wrapper pour faciliter l'utilisation avec une API similaire à better-sqlite3
class DatabaseWrapper {
  private get db(): SqlJsDatabase {
    if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
    return _db;
  }

  exec(sql: string): void {
    this.db.run(sql);
    this.save();
  }

  run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    this.db.run(sql, params);
    this.save();
    return {
      changes: this.db.getRowsModified(),
      lastInsertRowid: Number(this.db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0)
    };
  }

  prepare(sql: string) {
    const db = this.db;
    const wrapper = this;
    return {
      run(...params: any[]) {
        db.run(sql, params);
        wrapper.save();
        return {
          changes: db.getRowsModified(),
          lastInsertRowid: Number(db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0)
        };
      },
      get(...params: any[]): any {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const values = stmt.get();
          stmt.free();
          const result: any = {};
          cols.forEach((col, i) => result[col] = values[i]);
          return result;
        }
        stmt.free();
        return undefined;
      },
      all(...params: any[]): any[] {
        const results: any[] = [];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const values = stmt.get();
          const row: any = {};
          cols.forEach((col, i) => row[col] = values[i]);
          results.push(row);
        }
        stmt.free();
        return results;
      }
    };
  }

  pragma(sql: string): void {
    this.db.run(`PRAGMA ${sql}`);
  }

  private save(): void {
    if (_db) {
      const data = _db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    }
  }
}

export const db = new DatabaseWrapper();

// Initialiser la base de données (doit être appelée au démarrage de l'app)
export async function initDatabase(): Promise<void> {
  _SQL = await initSqlJs();

  // Charger la base existante ou créer une nouvelle
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    _db = new _SQL.Database(buffer);
  } else {
    _db = new _SQL.Database();
  }

  // Activer les foreign keys
  db.pragma('foreign_keys = ON');

  // Créer les tables
  db.exec(`
    -- Scripts de rôles
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Rôles disponibles
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Citadin', 'Sbire', 'Démon', 'Étranger')),
      description TEXT NOT NULL,
      icon TEXT,
      FOREIGN KEY (script_id) REFERENCES scripts(id)
    );

    -- Parties créées
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      host_pseudo TEXT NOT NULL,
      host_token TEXT NOT NULL,
      password_hash TEXT,
      script_id TEXT NOT NULL,
      status TEXT DEFAULT 'lobby' CHECK(status IN ('lobby', 'playing', 'finished')),
      started_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (script_id) REFERENCES scripts(id)
    );

    -- Joueurs dans une partie
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      pseudo TEXT NOT NULL,
      token TEXT NOT NULL,
      seat_number INTEGER,
      role_id TEXT,
      fake_role_id TEXT,
      is_ready INTEGER DEFAULT 0,
      is_alive INTEGER DEFAULT 1,
      connected INTEGER DEFAULT 1,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (fake_role_id) REFERENCES roles(id),
      UNIQUE(game_id, pseudo),
      UNIQUE(game_id, seat_number)
    );

    -- État de la partie
    CREATE TABLE IF NOT EXISTS game_states (
      game_id TEXT PRIMARY KEY,
      phase TEXT DEFAULT 'day' CHECK(phase IN ('day', 'night')),
      day_number INTEGER DEFAULT 1,
      timer_seconds INTEGER DEFAULT 0,
      last_meeting_at INTEGER DEFAULT 0,
      host_notes TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- Historique des événements
    CREATE TABLE IF NOT EXISTS game_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- Index pour performances
    CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
    CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
    CREATE INDEX IF NOT EXISTS idx_players_token ON players(token);
    CREATE INDEX IF NOT EXISTS idx_roles_script ON roles(script_id);
  `);

  // Migrations : ajouter les colonnes manquantes sur les bases existantes
  try {
    db.exec(`ALTER TABLE players ADD COLUMN fake_role_id TEXT REFERENCES roles(id)`);
  } catch (e: any) {
    // La colonne existe déjà — ignorer
  }

  console.log('✅ Database initialized');
}

export default db;
