import {
  canAddTypeAtLevel,
  getDeactivationCascadeIds,
  getTypeDepth,
  parseSuggestedPrice,
} from '../logic/tipos-trabajo.js';
import { createRecord, db, getRecords, updateRecord } from './db.js';

export const DEFAULT_MAX_WORK_TYPE_LEVELS = 4;

export async function getMaxWorkTypeLevels() {
  const setting = await db.table('ajustes').where('clave').equals('max_niveles').first();
  const value = Number(setting?.valor);
  return Number.isInteger(value) && value >= 1 && value <= 4
    ? value
    : DEFAULT_MAX_WORK_TYPE_LEVELS;
}

export async function saveMaxWorkTypeLevels(maxLevels) {
  if (!Number.isInteger(maxLevels) || maxLevels < 1 || maxLevels > 4) {
    throw new Error('El máximo de niveles debe estar entre 1 y 4.');
  }

  const table = db.table('ajustes');
  return db.transaction('rw', table, async () => {
    const setting = await table.where('clave').equals('max_niveles').first();
    if (setting) return updateRecord('ajustes', setting.id, { valor: maxLevels });
    return createRecord('ajustes', { clave: 'max_niveles', valor: maxLevels });
  });
}

export async function saveWorkType({ id, nombre, padre_id = null, precio_sugerido = null }, maxLevels) {
  const cleanName = String(nombre ?? '').trim();
  if (!cleanName) throw new Error('Escribe el nombre del tipo de trabajo.');

  const types = await getRecords('tipos_trabajo');
  if (id) {
    const existing = types.find((type) => type.id === id);
    if (!existing) throw new Error('El tipo de trabajo no existe.');
    return updateRecord('tipos_trabajo', id, {
      nombre: cleanName,
      precio_sugerido,
    });
  }

  if (!canAddTypeAtLevel(types, padre_id, maxLevels)) {
    throw new Error('No se puede agregar el tipo: revisa el nivel máximo y el tipo superior.');
  }

  return createRecord('tipos_trabajo', {
    nombre: cleanName,
    padre_id,
    precio_sugerido,
    activo: true,
  });
}

export async function deactivateWorkType(typeId) {
  return db.transaction('rw', db.table('tipos_trabajo'), async () => {
    const types = await getRecords('tipos_trabajo');
    const ids = getDeactivationCascadeIds(types, typeId);
    const now = new Date().toISOString();
    const rows = ids.map((id) => {
      const type = types.find((candidate) => candidate.id === id);
      return { ...type, activo: false, modificado: now };
    });
    await db.table('tipos_trabajo').bulkPut(rows);
    return ids;
  });
}

export async function activateWorkType(typeId) {
  const type = await db.table('tipos_trabajo').get(typeId);
  if (!type || type.eliminado) throw new Error('El tipo de trabajo no existe.');
  const [types, maxLevels] = await Promise.all([
    getRecords('tipos_trabajo'),
    getMaxWorkTypeLevels(),
  ]);
  if (getTypeDepth(types, type.padre_id) + 1 > maxLevels) {
    throw new Error(`Este tipo supera el máximo configurado de ${maxLevels} niveles.`);
  }
  if (type.padre_id !== null) {
    const parent = await db.table('tipos_trabajo').get(type.padre_id);
    if (!parent || !parent.activo || parent.eliminado) {
      throw new Error('Activa primero el tipo superior.');
    }
  }
  return updateRecord('tipos_trabajo', typeId, { activo: true });
}

export async function saveWorkTypeFromForm(data, maxLevels) {
  const price = parseSuggestedPrice(data.precio_sugerido);
  return saveWorkType({ ...data, precio_sugerido: price }, maxLevels);
}
