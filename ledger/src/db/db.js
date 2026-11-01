import Dexie from 'dexie';

export const TABLE_NAMES = [
  'clientes',
  'tipos_trabajo',
  'pedidos',
  'lineas',
  'pagos',
  'ubicaciones',
  'cambios',
  'ajustes',
];

const stores = {
  clientes: 'id, creado, modificado, eliminado, nombre, codigo_pais, telefono, [codigo_pais+telefono]',
  tipos_trabajo: 'id, creado, modificado, eliminado, nombre, padre_id, activo',
  pedidos: 'id, creado, modificado, eliminado, cliente_id, fecha_pedido, fecha_entrega_general, modalidad_pago',
  lineas: 'id, creado, modificado, eliminado, pedido_id, tipo_id, fecha_entrega, estado, prioridad',
  pagos: 'id, creado, modificado, eliminado, pedido_id, linea_id, tipo, metodo, fecha',
  ubicaciones: 'id, creado, modificado, eliminado, linea_id, tipo',
  cambios: 'id, creado, modificado, eliminado, linea_id, fecha',
  ajustes: 'id, creado, modificado, eliminado, &clave',
};

const initialWorkTypes = ['Documento', 'Presentación', 'Otro'];
const reservedFields = new Set([
  'id',
  'creado',
  'modificado',
  'eliminado',
  'fecha_eliminado',
]);

export const db = new Dexie('ledgerDb');

db.version(1).stores(stores);

function getTable(tableName) {
  if (!TABLE_NAMES.includes(tableName)) {
    throw new TypeError(`Tabla no válida: ${tableName}`);
  }

  return db.table(tableName);
}

function validateData(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Los datos del registro deben ser un objeto.');
  }
}

function makeRecord(data, now = new Date().toISOString()) {
  return {
    ...data,
    id: crypto.randomUUID(),
    creado: now,
    modificado: now,
    eliminado: false,
    fecha_eliminado: null,
  };
}

function editableFields(changes) {
  validateData(changes);
  return Object.fromEntries(
    Object.entries(changes).filter(([field]) => !reservedFields.has(field)),
  );
}

export async function createRecord(tableName, data) {
  validateData(data);
  const record = makeRecord(data);
  await getTable(tableName).add(record);
  return record;
}

export async function getRecord(tableName, id, { includeDeleted = false } = {}) {
  const record = await getTable(tableName).get(id);
  if (!record || (!includeDeleted && record.eliminado)) return undefined;
  return record;
}

export async function getRecords(tableName, { includeDeleted = false } = {}) {
  const table = getTable(tableName);
  if (includeDeleted) return table.toArray();
  return table.filter((record) => !record.eliminado).toArray();
}

export async function updateRecord(tableName, id, changes) {
  const table = getTable(tableName);
  const record = await table.get(id);
  if (!record) throw new Error(`No existe el registro ${id} en ${tableName}.`);

  const updated = {
    ...record,
    ...editableFields(changes),
    modificado: new Date().toISOString(),
  };
  await table.put(updated);
  return updated;
}

export async function softDeleteRecord(tableName, id) {
  const record = await getRecord(tableName, id, { includeDeleted: true });
  if (!record) throw new Error(`No existe el registro ${id} en ${tableName}.`);
  if (record.eliminado) throw new Error(`El registro ${id} ya está en la papelera.`);

  const now = new Date().toISOString();
  const updated = {
    ...record,
    eliminado: true,
    fecha_eliminado: now,
    modificado: now,
  };
  await getTable(tableName).put(updated);
  return updated;
}

export async function restoreRecord(tableName, id) {
  const record = await getRecord(tableName, id, { includeDeleted: true });
  if (!record) throw new Error(`No existe el registro ${id} en ${tableName}.`);
  if (!record.eliminado) throw new Error(`El registro ${id} no está en la papelera.`);

  const updated = {
    ...record,
    eliminado: false,
    fecha_eliminado: null,
    modificado: new Date().toISOString(),
  };
  await getTable(tableName).put(updated);
  return updated;
}

export async function permanentlyDeleteRecord(tableName, id) {
  const record = await getRecord(tableName, id, { includeDeleted: true });
  if (!record) throw new Error(`No existe el registro ${id} en ${tableName}.`);
  if (!record.eliminado) throw new Error('Solo se pueden borrar definitivamente elementos de la papelera.');
  await getTable(tableName).delete(id);
}

export async function ensureInitialWorkTypes() {
  const table = getTable('tipos_trabajo');
  if (await table.count()) return [];

  const records = initialWorkTypes.map((nombre) =>
    makeRecord({ nombre, padre_id: null, precio_sugerido: null, activo: true }),
  );
  await table.bulkAdd(records);
  return records;
}

export async function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function initializeDatabase() {
  await db.open();
  await ensureInitialWorkTypes();
  return requestPersistentStorage();
}

export default db;
