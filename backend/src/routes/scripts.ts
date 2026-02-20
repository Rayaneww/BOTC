import { Router, Request, Response } from 'express';
import { roleService } from '../services/RoleService.js';

const router = Router();

// Obtenir tous les scripts disponibles
router.get('/', async (_req: Request, res: Response) => {
  try {
    const scripts = roleService.getAllScripts();
    res.json({ scripts });
  } catch (error: any) {
    console.error('Get scripts error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir un script par ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const script = roleService.getScriptById(req.params.id);
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trouvé' });
    }
    
    const roles = roleService.getRolesByScript(script.id);
    const counts = roleService.countRolesByType(script.id);
    
    res.json({
      script,
      roles,
      counts,
    });
  } catch (error: any) {
    console.error('Get script error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les rôles d'un script
router.get('/:id/roles', async (req: Request, res: Response) => {
  try {
    const script = roleService.getScriptById(req.params.id);
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trouvé' });
    }
    
    const roles = roleService.getRolesByScript(script.id);
    
    res.json({ roles });
  } catch (error: any) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Importer un nouveau script (admin - simplifié pour MVP)
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { id, name, description, roles } = req.body;
    
    if (!id || !name || !roles || !Array.isArray(roles)) {
      return res.status(400).json({ 
        error: 'Format invalide. Requis: id, name, roles[]' 
      });
    }
    
    // Valider les rôles
    for (const role of roles) {
      if (!role.id || !role.name || !role.type || !role.description) {
        return res.status(400).json({ 
          error: 'Chaque rôle doit avoir: id, name, type, description' 
        });
      }
      if (!['Citadin', 'Sbire', 'Démon', 'Étranger'].includes(role.type)) {
        return res.status(400).json({ 
          error: `Type de rôle invalide: ${role.type}` 
        });
      }
    }
    
    roleService.importScript({ id, name, description, roles });
    
    res.status(201).json({ 
      success: true, 
      message: `Script "${name}" importé avec ${roles.length} rôles` 
    });
  } catch (error: any) {
    console.error('Import script error:', error);
    if (error.message.includes('existe déjà')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur lors de l\'import' });
  }
});

export default router;
