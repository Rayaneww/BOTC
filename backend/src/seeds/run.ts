import { db, initDatabase } from '../config/database.js';
import { fukanoScript, fukanoRoles } from './fukano.js';

async function seed() {
  console.log('🌱 Running database seed...');

  // Initialiser la base
  await initDatabase();

  // Insérer le script Fukano
  const insertScript = db.prepare(`
    INSERT OR REPLACE INTO scripts (id, name, description)
    VALUES (?, ?, ?)
  `);

  insertScript.run(fukanoScript.id, fukanoScript.name, fukanoScript.description);
  console.log(`✅ Script "${fukanoScript.name}" inserted`);

  // Insérer les rôles
  const insertRole = db.prepare(`
    INSERT OR REPLACE INTO roles (id, script_id, name, type, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const role of fukanoRoles) {
    insertRole.run(role.id, fukanoScript.id, role.name, role.type, role.description);
  }

  console.log(`✅ ${fukanoRoles.length} roles inserted`);

  console.log('🎉 Seed completed successfully!');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
