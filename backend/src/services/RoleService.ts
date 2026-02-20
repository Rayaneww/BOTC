import db from '../config/database.js';
import type { Script, Role, RoleType } from '../models/types.js';

class RoleService {
  // Obtenir tous les scripts
  getAllScripts(): Script[] {
    const rows = db.prepare(`
      SELECT id, name, description, created_at
      FROM scripts
      ORDER BY name ASC
    `).all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
    }));
  }
  
  // Obtenir un script par ID
  getScriptById(id: string): Script | null {
    const row = db.prepare(`
      SELECT id, name, description, created_at
      FROM scripts WHERE id = ?
    `).get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
    };
  }
  
  // Obtenir tous les rôles d'un script
  getRolesByScript(scriptId: string): Role[] {
    const rows = db.prepare(`
      SELECT id, script_id, name, type, description, icon
      FROM roles
      WHERE script_id = ?
      ORDER BY 
        CASE type
          WHEN 'Démon' THEN 1
          WHEN 'Sbire' THEN 2
          WHEN 'Citadin' THEN 3
          WHEN 'Étranger' THEN 4
        END,
        name ASC
    `).all(scriptId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      scriptId: row.script_id,
      name: row.name,
      type: row.type,
      description: row.description,
      icon: row.icon,
    }));
  }
  
  // Obtenir un rôle par ID
  getRoleById(id: string): Role | null {
    const row = db.prepare(`
      SELECT id, script_id, name, type, description, icon
      FROM roles WHERE id = ?
    `).get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      scriptId: row.script_id,
      name: row.name,
      type: row.type,
      description: row.description,
      icon: row.icon,
    };
  }
  
  // Obtenir les rôles par type
  getRolesByType(scriptId: string, type: RoleType): Role[] {
    const rows = db.prepare(`
      SELECT id, script_id, name, type, description, icon
      FROM roles
      WHERE script_id = ? AND type = ?
      ORDER BY name ASC
    `).all(scriptId, type) as any[];
    
    return rows.map(row => ({
      id: row.id,
      scriptId: row.script_id,
      name: row.name,
      type: row.type,
      description: row.description,
      icon: row.icon,
    }));
  }
  
  // Importer un nouveau script avec ses rôles (JSON)
  importScript(data: { id: string; name: string; description?: string; roles: Omit<Role, 'scriptId'>[] }): void {
    const { id, name, description, roles } = data;
    
    // Vérifier si le script existe déjà
    const existing = this.getScriptById(id);
    if (existing) {
      throw new Error('Un script avec cet ID existe déjà');
    }
    
    // Transaction pour insérer le script et ses rôles
    const insertScript = db.prepare(`
      INSERT INTO scripts (id, name, description)
      VALUES (?, ?, ?)
    `);
    
    const insertRole = db.prepare(`
      INSERT INTO roles (id, script_id, name, type, description, icon)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = db.transaction(() => {
      insertScript.run(id, name, description || null);
      
      for (const role of roles) {
        insertRole.run(
          role.id,
          id,
          role.name,
          role.type,
          role.description,
          role.icon || null
        );
      }
    });
    
    transaction();
  }
  
  // Compter les rôles par type dans un script
  countRolesByType(scriptId: string): Record<RoleType, number> {
    const rows = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM roles
      WHERE script_id = ?
      GROUP BY type
    `).all(scriptId) as any[];
    
    const counts: Record<RoleType, number> = {
      'Citadin': 0,
      'Sbire': 0,
      'Démon': 0,
      'Étranger': 0,
    };
    
    for (const row of rows) {
      counts[row.type as RoleType] = row.count;
    }
    
    return counts;
  }
}

export const roleService = new RoleService();
