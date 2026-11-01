import { describe, expect, it } from 'vitest';
import {
  buildTypeTree,
  canAddTypeAtLevel,
  formatSuggestedPrice,
  getActiveTypeChildren,
  getDeactivationCascadeIds,
  getTypeDepth,
  isSelectableWorkType,
  parseSuggestedPrice,
} from '../src/logic/tipos-trabajo.js';

const types = [
  { id: 'doc', nombre: 'Documento', padre_id: null, activo: true, eliminado: false },
  { id: 'other', nombre: 'Otro', padre_id: null, activo: true, eliminado: false },
  { id: 'report', nombre: 'Informe', padre_id: 'doc', activo: true, eliminado: false },
  { id: 'tech', nombre: 'Informe técnico', padre_id: 'report', activo: true, eliminado: false },
  { id: 'old', nombre: 'Archivado', padre_id: 'doc', activo: false, eliminado: false },
  { id: 'deleted', nombre: 'Eliminado', padre_id: null, activo: true, eliminado: true },
];

describe('lógica de tipos de trabajo', () => {
  it('construye el árbol jerárquico y excluye elementos en papelera', () => {
    const tree = buildTypeTree(types);

    expect(tree.map(({ id }) => id)).toEqual(['doc', 'other']);
    expect(tree[0].children.map(({ id }) => id)).toEqual(['old', 'report']);
    expect(tree[0].children[1].children[0].id).toBe('tech');
    expect(JSON.stringify(tree)).not.toContain('deleted');
  });

  it('calcula profundidad y respeta el máximo configurado', () => {
    expect(getTypeDepth(types, null)).toBe(0);
    expect(getTypeDepth(types, 'doc')).toBe(1);
    expect(getTypeDepth(types, 'report')).toBe(2);
    expect(canAddTypeAtLevel(types, 'report', 4)).toBe(true);
    expect(canAddTypeAtLevel(types, 'report', 2)).toBe(false);
    expect(canAddTypeAtLevel(types, 'report', 5)).toBe(false);
    expect(canAddTypeAtLevel(types, 'old', 4)).toBe(false);
    expect(canAddTypeAtLevel(types, 'missing', 4)).toBe(false);
  });

  it('incluye todos los descendientes al desactivar un tipo', () => {
    expect(getDeactivationCascadeIds(types, 'doc')).toEqual([
      'doc',
      'old',
      'report',
      'tech',
    ]);
  });

  it('solo permite elegir tipos activos sin hijos activos', () => {
    expect(isSelectableWorkType(types, 'doc')).toBe(false);
    expect(isSelectableWorkType(types, 'report')).toBe(false);
    expect(isSelectableWorkType(types, 'tech')).toBe(true);
    expect(isSelectableWorkType(types, 'old')).toBe(false);
    expect(getActiveTypeChildren(types, 'doc').map(({ id }) => id)).toEqual(['report']);
    expect(isSelectableWorkType(types, 'deleted')).toBe(false);
  });

  it('convierte precios a centavos sin aritmética decimal flotante', () => {
    expect(parseSuggestedPrice('1200,5')).toBe(120050);
    expect(parseSuggestedPrice('0.09')).toBe(9);
    expect(parseSuggestedPrice('')).toBeNull();
    expect(formatSuggestedPrice(120050)).toBe('Bs 1.200,50');
    expect(() => parseSuggestedPrice('1.234,50')).toThrow('precio válido');
    expect(() => parseSuggestedPrice('-2')).toThrow('precio válido');
  });
});
