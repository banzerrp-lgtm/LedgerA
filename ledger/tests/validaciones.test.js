import { describe, expect, it } from 'vitest';
import { validarPedido } from '../src/logic/validaciones.js';
import { parseSuggestedPrice } from '../src/logic/tipos-trabajo.js';

const types = [
  { id: 'documento', nombre: 'Documento', padre_id: null, activo: true, eliminado: false },
  { id: 'proyecto', nombre: 'Proyecto', padre_id: 'documento', activo: true, eliminado: false },
  { id: 'presentacion', nombre: 'Presentación', padre_id: null, activo: true, eliminado: false },
];

const validOrder = {
  cliente_id: 'cliente-1',
  modalidad_pago: 'contra_entrega',
  adelanto: '',
  fecha_entrega_general: '',
};

function validLine(overrides = {}) {
  return {
    tipo_id: 'proyecto',
    titulo: 'Informe mensual',
    precio: '120,50',
    fecha_entrega: '2026-11-02',
    hora_entrega: '',
    ...overrides,
  };
}

function validate(lineas, pedido = validOrder, tiposTrabajo = types) {
  return validarPedido({ pedido, lineas, tiposTrabajo });
}

describe('validación de pedidos', () => {
  it('acepta un pedido completo con una línea', () => {
    expect(validate([validLine()])).toEqual([]);
  });

  it('acepta tres líneas completas', () => {
    expect(validate([
      validLine(),
      validLine({ tipo_id: 'presentacion', titulo: 'Diapositivas' }),
      validLine({ titulo: 'Resumen ejecutivo' }),
    ])).toEqual([]);
  });

  it('indica el título vacío de la segunda línea', () => {
    expect(validate([
      validLine(),
      validLine({ titulo: '  ' }),
      validLine(),
    ])).toContainEqual({
      linea: 2,
      campo: 'titulo',
      mensaje: 'Línea 2: escribe el título del trabajo',
    });
  });

  it('indica cuando falta elegir un tipo de trabajo', () => {
    expect(validate([validLine({ tipo_id: null })])).toContainEqual({
      linea: 1,
      campo: 'tipo_id',
      mensaje: 'Línea 1: elige el tipo de trabajo',
    });
  });

  it('pide el siguiente nivel cuando solo se eligió el tipo padre', () => {
    expect(validate([validLine({ tipo_id: 'documento' })])).toContainEqual({
      linea: 1,
      campo: 'tipo_id',
      mensaje: 'Línea 1: elige el siguiente nivel',
    });
  });

  it('rechaza títulos formados solo por espacios', () => {
    expect(validate([validLine({ titulo: '   ' })])).toContainEqual({
      linea: 1,
      campo: 'titulo',
      mensaje: 'Línea 1: escribe el título del trabajo',
    });
  });

  it('convierte coma decimal a centavos y avisa por precio vacío o inválido', () => {
    const line = validLine();
    expect(parseSuggestedPrice(line.precio)).toBe(12050);
    expect(validate([line])).toEqual([]);
    expect(validate([validLine({ precio: '' })])).toContainEqual({
      linea: 1,
      campo: 'precio',
      mensaje: 'Línea 1: escribe el precio del trabajo',
    });
    expect(validate([validLine({ precio: '12,345' })])).toContainEqual(expect.objectContaining({
      linea: 1,
      campo: 'precio',
      mensaje: expect.stringContaining('precio válido'),
    }));
  });

  it('indica cuando falta seleccionar cliente', () => {
    expect(validate([validLine()], { ...validOrder, cliente_id: '' })).toContainEqual({
      linea: null,
      campo: 'cliente_id',
      mensaje: 'Elige un cliente',
    });
  });
});
