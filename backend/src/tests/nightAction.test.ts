// backend/src/tests/nightAction.test.ts
import { describe, it, expect } from 'vitest'
import { NIGHT_ACTION_CONFIG, getNightActionType, validateNightAction } from '../utils/nightAction.js'

describe('NIGHT_ACTION_CONFIG', () => {
  it('maps Diablotin to choose_target', () => {
    expect(NIGHT_ACTION_CONFIG['Diablotin']).toBe('choose_target')
  })
  it('maps Empoisonneur to choose_target', () => {
    expect(NIGHT_ACTION_CONFIG['Empoisonneur']).toBe('choose_target')
  })
  it('maps Moine to choose_target', () => {
    expect(NIGHT_ACTION_CONFIG['Moine']).toBe('choose_target')
  })
  it('maps Voyante to choose_two', () => {
    expect(NIGHT_ACTION_CONFIG['Voyante']).toBe('choose_two')
  })
  it('maps Majordome to choose_master', () => {
    expect(NIGHT_ACTION_CONFIG['Majordome']).toBe('choose_master')
  })
  it('maps all info-receiver roles', () => {
    for (const role of ['Archiviste', 'Enquêteur', 'Lavandière', 'Cuistot', 'Empathe', 'Fossoyeur']) {
      expect(NIGHT_ACTION_CONFIG[role]).toBe('info_receiver')
    }
  })
})

describe('getNightActionType', () => {
  it('returns none for unknown roles', () => {
    expect(getNightActionType('Baron')).toBe('none')
    expect(getNightActionType('Soldat')).toBe('none')
    expect(getNightActionType('')).toBe('none')
  })
  it('returns the correct type for known roles', () => {
    expect(getNightActionType('Diablotin')).toBe('choose_target')
    expect(getNightActionType('Voyante')).toBe('choose_two')
  })
})

describe('validateNightAction', () => {
  const alive = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]

  describe('choose_target', () => {
    it('rejects missing targetId', () => {
      expect(validateNightAction('choose_target', undefined, undefined, alive)).toEqual({
        valid: false, error: 'targetId requis',
      })
    })
    it('rejects a dead/unknown player', () => {
      expect(validateNightAction('choose_target', 'dead-id', undefined, alive)).toEqual({
        valid: false, error: 'Joueur invalide ou mort',
      })
    })
    it('accepts a valid alive player', () => {
      expect(validateNightAction('choose_target', 'p1', undefined, alive)).toEqual({ valid: true })
    })
  })

  describe('choose_master', () => {
    it('accepts an alive player', () => {
      expect(validateNightAction('choose_master', 'p2', undefined, alive)).toEqual({ valid: true })
    })
    it('rejects a dead player', () => {
      expect(validateNightAction('choose_master', 'nobody', undefined, alive)).toEqual({
        valid: false, error: 'Joueur invalide ou mort',
      })
    })
  })

  describe('choose_two', () => {
    it('rejects fewer than 2 ids', () => {
      expect(validateNightAction('choose_two', undefined, ['p1'], alive)).toEqual({
        valid: false, error: '2 joueurs requis',
      })
    })
    it('rejects duplicate ids', () => {
      expect(validateNightAction('choose_two', undefined, ['p1', 'p1'], alive)).toEqual({
        valid: false, error: 'Les deux joueurs doivent être distincts',
      })
    })
    it('accepts 2 distinct players (dead players allowed for Voyante)', () => {
      expect(validateNightAction('choose_two', undefined, ['p1', 'dead-player'], alive)).toEqual({
        valid: true,
      })
    })
  })
})
