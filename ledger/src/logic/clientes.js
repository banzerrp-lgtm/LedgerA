export function normalizarTelefono(telefono) {
  return String(telefono).replace(/\D/g, '');
}

export function normalizarCodigoPais(codigoPais) {
  const digits = normalizarTelefono(codigoPais);
  return digits ? `+${digits}` : '';
}

export function buscarClienteDuplicado(clientes, candidate, exceptId = null) {
  const countryCode = normalizarCodigoPais(candidate.codigo_pais);
  const phone = normalizarTelefono(candidate.telefono);

  return clientes.find((client) =>
    client.id !== exceptId
    && normalizarCodigoPais(client.codigo_pais) === countryCode
    && normalizarTelefono(client.telefono) === phone,
  );
}
