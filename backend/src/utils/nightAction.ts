// backend/src/utils/nightAction.ts

export type NightActionType =
  | 'choose_target'
  | 'choose_two'
  | 'choose_master'
  | 'info_receiver'
  | 'none'

export const NIGHT_ACTION_CONFIG: Record<string, NightActionType> = {
  'Diablotin': 'choose_target',
  'Empoisonneur': 'choose_target',
  'Moine': 'choose_target',
  'Voyante': 'choose_two',
  'Majordome': 'choose_master',
  'Archiviste': 'info_receiver',
  'Enquêteur': 'info_receiver',
  'Lavandière': 'info_receiver',
  'Cuistot': 'info_receiver',
  'Empathe': 'info_receiver',
  'Fossoyeur': 'info_receiver',
}

export function getNightActionType(roleName: string): NightActionType {
  return NIGHT_ACTION_CONFIG[roleName] ?? 'none'
}

export function validateNightAction(
  actionType: NightActionType,
  targetId: string | undefined,
  targetIds: string[] | undefined,
  alivePlayers: { id: string }[]
): { valid: boolean; error?: string } {
  const aliveIds = new Set(alivePlayers.map((p) => p.id))

  if (actionType === 'choose_target' || actionType === 'choose_master') {
    if (!targetId) return { valid: false, error: 'targetId requis' }
    if (!aliveIds.has(targetId)) return { valid: false, error: 'Joueur invalide ou mort' }
    return { valid: true }
  }

  if (actionType === 'choose_two') {
    if (!targetIds || targetIds.length !== 2) return { valid: false, error: '2 joueurs requis' }
    if (new Set(targetIds).size !== 2)
      return { valid: false, error: 'Les deux joueurs doivent être distincts' }
    return { valid: true }
  }

  return { valid: false, error: "Type d'action non supporté" }
}
