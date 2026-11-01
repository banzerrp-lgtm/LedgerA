import { describe, expect, it } from 'vitest';
import { classifyDelivery, getDeliveryDayDifference, sortUpcomingDeliveries } from '../src/logic/entregas.js';

const today = new Date(2026, 0, 10, 12, 0);

function line(id, fecha_entrega, hora_entrega = null, extra = {}) {
  return {
    id,
    fecha_entrega,
    hora_entrega,
    estado: 'pendiente',
    prioridad: false,
    ...extra,
  };
}

describe('clasificación y orden de entregas', () => {
  it('clasifica vencida, hoy, mañana, pasado mañana y días posteriores', () => {
    expect(classifyDelivery(line('late', '2026-01-09'), today))
      .toMatchObject({ color: 'rojo', label: 'VENCIDO', overdue: true });
    expect(classifyDelivery(line('today', '2026-01-10'), today))
      .toMatchObject({ color: 'rojo', label: 'Hoy', overdue: false });
    expect(classifyDelivery(line('tomorrow', '2026-01-11'), today))
      .toMatchObject({ color: 'rojo', label: 'Mañana', overdue: false });
    expect(classifyDelivery(line('two-days', '2026-01-12'), today))
      .toMatchObject({ color: 'amarillo', label: 'Pasado mañana' });
    expect(classifyDelivery(line('three-days', '2026-01-13'), today))
      .toMatchObject({ color: 'verde', label: 'En 3 días' });
    expect(classifyDelivery(line('five-days', '2026-01-15'), today))
      .toMatchObject({ color: 'verde', label: 'En 5 días' });
  });

  it('considera vencida una hora pasada, pero no una entrega sin hora durante el día', () => {
    const now = new Date(2026, 0, 10, 12, 0);
    expect(classifyDelivery(line('past-time', '2026-01-10', '11:59'), now).overdue).toBe(true);
    expect(classifyDelivery(line('future-time', '2026-01-10', '12:01'), now).overdue).toBe(false);
    expect(classifyDelivery(line('no-time', '2026-01-10'), now).overdue).toBe(false);
  });

  it('ordena prioridad vencida, vencidas, fecha y hora antes de las entregas sin hora', () => {
    const lines = [
      line('tomorrow-day', '2026-01-11'),
      line('today-day', '2026-01-10'),
      line('late', '2026-01-09'),
      line('tomorrow-time', '2026-01-11', '09:00'),
      line('today-time-late', '2026-01-10', '15:00'),
      line('late-priority', '2026-01-08', null, { prioridad: true }),
      line('delivered', '2026-01-10', null, { estado: 'entregado' }),
    ];

    expect(sortUpcomingDeliveries(lines, today).map(({ id }) => id)).toEqual([
      'late-priority',
      'late',
      'today-time-late',
      'today-day',
      'tomorrow-time',
      'tomorrow-day',
    ]);
  });

  it('recalcula la urgencia cuando cambia el día local', () => {
    const delivery = line('tomorrow', '2026-01-11');
    const beforeMidnight = new Date(2026, 0, 10, 23, 59);
    const afterMidnight = new Date(2026, 0, 11, 0, 1);

    expect(classifyDelivery(delivery, beforeMidnight).label).toBe('Mañana');
    expect(classifyDelivery(delivery, afterMidnight).label).toBe('Hoy');
    expect(getDeliveryDayDifference('2026-01-11', afterMidnight)).toBe(0);
    expect(classifyDelivery(line('no-time-yesterday', '2026-01-10'), afterMidnight).label)
      .toBe('VENCIDO');
  });

  it('rechaza fechas u horas inválidas', () => {
    expect(() => classifyDelivery(line('bad-date', '2026-02-30'), today)).toThrow('no es válida');
    expect(() => classifyDelivery(line('bad-time', '2026-01-10', '25:30'), today)).toThrow('hora');
  });
});
