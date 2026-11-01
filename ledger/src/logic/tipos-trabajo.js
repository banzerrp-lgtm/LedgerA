function activeTypes(types) {
  return types.filter((type) => !type.eliminado);
}

function compareNames(left, right) {
  return left.nombre.localeCompare(right.nombre, 'es', { sensitivity: 'base' });
}

export function buildTypeTree(types) {
  const nodes = new Map(
    activeTypes(types).map((type) => [type.id, { ...type, children: [] }]),
  );
  const roots = [];

  for (const node of nodes.values()) {
    const parent = nodes.get(node.padre_id);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  function sortNodes(nodesToSort) {
    nodesToSort.sort(compareNames);
    nodesToSort.forEach((node) => sortNodes(node.children));
  }

  sortNodes(roots);
  return roots;
}

export function getTypeDepth(types, parentId = null) {
  if (parentId === null) return 0;

  const byId = new Map(activeTypes(types).map((type) => [type.id, type]));
  const visited = new Set();
  let current = byId.get(parentId);
  if (!current) throw new Error('El tipo superior no existe o está en la papelera.');

  let depth = 0;
  while (current) {
    if (visited.has(current.id)) throw new Error('La jerarquía de tipos contiene un ciclo.');
    visited.add(current.id);
    depth += 1;
    current = current.padre_id === null ? null : byId.get(current.padre_id);
    if (current === undefined) throw new Error('La jerarquía de tipos está incompleta.');
  }
  return depth;
}

export function canAddTypeAtLevel(types, parentId, maxLevels = 4) {
  if (!Number.isInteger(maxLevels) || maxLevels < 1 || maxLevels > 4) return false;
  try {
    return getTypeDepth(types, parentId) < maxLevels
      && (parentId === null || Boolean(types.find(
        (type) => type.id === parentId && type.activo && !type.eliminado,
      )));
  } catch {
    return false;
  }
}

export function getActiveTypeChildren(types, parentId = null) {
  return types
    .filter((type) => type.activo && !type.eliminado && type.padre_id === parentId)
    .sort(compareNames);
}

export function getDeactivationCascadeIds(types, typeId) {
  const byParent = new Map();
  for (const type of activeTypes(types)) {
    const siblings = byParent.get(type.padre_id) ?? [];
    siblings.push(type.id);
    byParent.set(type.padre_id, siblings);
  }

  const type = types.find((candidate) =>
    candidate.id === typeId && !candidate.eliminado,
  );
  if (!type) throw new Error('El tipo de trabajo no existe.');

  const ids = [];
  const pending = [typeId];
  const visited = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (visited.has(id)) throw new Error('La jerarquía de tipos contiene un ciclo.');
    visited.add(id);
    ids.push(id);
    pending.push(...(byParent.get(id) ?? []));
  }
  return ids;
}

export function isSelectableWorkType(types, typeId) {
  const selected = types.find((type) =>
    type.id === typeId && type.activo && !type.eliminado,
  );
  return Boolean(selected && getActiveTypeChildren(types, typeId).length === 0);
}

export function parseSuggestedPrice(value) {
  const normalized = String(value).trim().replace(',', '.');
  if (!normalized) return null;
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error('Escribe un precio válido con hasta dos decimales.');

  const whole = Number(match[1]);
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  const amount = whole * 100 + cents;
  if (!Number.isSafeInteger(amount)) throw new Error('El precio es demasiado grande.');
  return amount;
}

export function formatSuggestedPrice(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) return '';
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fraction = String(cents % 100).padStart(2, '0');
  return `Bs ${whole},${fraction}`;
}
