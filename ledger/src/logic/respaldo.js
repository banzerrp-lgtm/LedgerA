export const BACKUP_SCHEMA_VERSION = 2;
export const BACKUP_TABLES = [
  'clientes',
  'tipos_trabajo',
  'pedidos',
  'lineas',
  'pagos',
  'ubicaciones',
  'cambios',
  'ajustes',
];

export const BACKUP_TABLE_LABELS = {
  clientes: 'Clientes',
  tipos_trabajo: 'Tipos de trabajo',
  pedidos: 'Pedidos',
  lineas: 'Trabajos',
  pagos: 'Pagos',
  ubicaciones: 'Ubicaciones',
  cambios: 'Cambios',
  ajustes: 'Ajustes',
};

const COMMON_DEFAULTS = {
  creado: '',
  modificado: '',
  eliminado: false,
  fecha_eliminado: null,
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function migrateVersionOne(backup) {
  const tables = Object.fromEntries(BACKUP_TABLES.map((table) => [
    table,
    (backup.tablas[table] ?? []).map((record) => ({
      ...COMMON_DEFAULTS,
      ...record,
      modificado: record.modificado || record.creado || backup.exportado,
      creado: record.creado || record.modificado || backup.exportado,
    })),
  ]));
  return { ...backup, schema_version: 2, tablas: tables };
}

export function validateAndMigrateBackup(value) {
  if (!isObject(value)) throw new Error('El respaldo debe ser un objeto JSON.');
  if (!Number.isInteger(value.schema_version) || value.schema_version < 1) {
    throw new Error('La versión del respaldo no es válida.');
  }
  if (value.schema_version > BACKUP_SCHEMA_VERSION) {
    throw new Error('Este respaldo fue creado por una versión más reciente de Ledger.');
  }
  if (typeof value.app_version !== 'string' || !value.app_version.trim()) {
    throw new Error('El respaldo no indica la versión de Ledger.');
  }
  if (typeof value.exportado !== 'string' || Number.isNaN(Date.parse(value.exportado))) {
    throw new Error('La fecha de exportación del respaldo no es válida.');
  }
  if (!isObject(value.tablas)) throw new Error('El respaldo no contiene tablas válidas.');

  const unknownTables = Object.keys(value.tablas).filter((table) => !BACKUP_TABLES.includes(table));
  if (unknownTables.length) {
    throw new Error(`El respaldo contiene una tabla desconocida: ${unknownTables[0]}.`);
  }
  for (const table of BACKUP_TABLES) {
    if (value.tablas[table] !== undefined && !Array.isArray(value.tablas[table])) {
      throw new Error(`La tabla ${BACKUP_TABLE_LABELS[table]} debe ser una lista.`);
    }
  }

  let migrated = value.schema_version === 1
    ? migrateVersionOne({ ...value, tablas: value.tablas })
    : { ...value, tablas: Object.fromEntries(BACKUP_TABLES.map((table) => [
      table,
      value.tablas[table] ?? [],
    ])) };

  for (const table of BACKUP_TABLES) {
    const seenIds = new Set();
    const seenUniqueKeys = new Set();
    for (const [index, record] of migrated.tablas[table].entries()) {
      if (!isObject(record) || typeof record.id !== 'string' || !record.id.trim()) {
        throw new Error(`Registro ${index + 1} inválido en ${BACKUP_TABLE_LABELS[table]}.`);
      }
      if (seenIds.has(record.id)) {
        throw new Error(`El respaldo tiene registros repetidos en ${BACKUP_TABLE_LABELS[table]}.`);
      }
      seenIds.add(record.id);
      if (typeof record.eliminado !== 'boolean') {
        throw new Error(`El estado de papelera del registro ${index + 1} no es válido.`);
      }
      if (
        typeof record.creado !== 'string'
        || Number.isNaN(Date.parse(record.creado))
        || typeof record.modificado !== 'string'
        || Number.isNaN(Date.parse(record.modificado))
        || (record.fecha_eliminado !== null
          && (typeof record.fecha_eliminado !== 'string'
            || Number.isNaN(Date.parse(record.fecha_eliminado))))
      ) {
        throw new Error(`Las fechas del registro ${index + 1} no son válidas.`);
      }

      const uniqueKey = table === 'ajustes'
        ? record.clave
        : table === 'clientes' && record.codigo_pais && record.telefono
          ? `${record.codigo_pais}\u0000${record.telefono}`
          : null;
      if (table === 'ajustes' && (typeof uniqueKey !== 'string' || !uniqueKey.trim())) {
        throw new Error(`La clave del ajuste ${index + 1} no es válida.`);
      }
      if (uniqueKey !== null) {
        if (seenUniqueKeys.has(uniqueKey)) {
          throw new Error(`El respaldo tiene claves repetidas en ${BACKUP_TABLE_LABELS[table]}.`);
        }
        seenUniqueKeys.add(uniqueKey);
      }
    }
  }
  if (migrated.schema_version !== BACKUP_SCHEMA_VERSION) {
    migrated = { ...migrated, schema_version: BACKUP_SCHEMA_VERSION };
  }
  return migrated;
}

export function createBackupDocument(tables, {
  appVersion = '1.0.0',
  exportedAt = new Date().toISOString(),
} = {}) {
  const document = {
    schema_version: BACKUP_SCHEMA_VERSION,
    app_version: appVersion,
    exportado: exportedAt,
    tablas: Object.fromEntries(BACKUP_TABLES.map((table) => [table, tables[table] ?? []])),
  };
  return validateAndMigrateBackup(document);
}

export function formatBackupAge(lastBackup, now = new Date()) {
  if (typeof lastBackup !== 'string' || Number.isNaN(Date.parse(lastBackup))) {
    return 'Aún no hay respaldo.';
  }
  const saved = new Date(lastBackup);
  const savedDay = Date.UTC(saved.getFullYear(), saved.getMonth(), saved.getDate());
  const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.floor((currentDay - savedDay) / 86_400_000));
  if (days === 0) return 'Último respaldo: hoy.';
  if (days === 1) return 'Último respaldo: ayer.';
  return `Último respaldo: hace ${days} días.`;
}
