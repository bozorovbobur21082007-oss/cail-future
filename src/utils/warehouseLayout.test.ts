import { describe, expect, it } from 'vitest';
import { layoutWarehouse, warehouseSlots, slotPosition, type WarehouseShelf } from './warehouseLayout';
const shelf: WarehouseShelf = { id: 'a', sector_id: 'room', name: 'A', code: 'A', rows: 2, columns: 3, levels: 4, capacity: 24, width_cm: 300, depth_cm: 100, height_cm: 400, position_x: 0, position_y: 0, orientation: 0 };
describe('warehouse digital twin', () => {
  it('draws all 24 locations in a 2 × 3 × 4 rack', () => expect(warehouseSlots(layoutWarehouse([], [shelf]), [], [])).toHaveLength(24));
  it('keeps a placement in its exact shelf and L/C/R without duplicating unplaced stock', () => {
    const slots = warehouseSlots(layoutWarehouse([], [shelf, { ...shelf, id: 'b' }]), [{ id: 'p', name: 'Cotton', quantity: 10 }], [{ shelf_id: 'a', product_id: 'p', level: 3, column_idx: 2, row_idx: 1, quantity: 5 }]);
    const occupied = slots.filter(s => s.product);
    expect(occupied).toHaveLength(1); expect(occupied[0].quantity).toBe(5); expect(slotPosition(occupied[0])[1]).toBe(2.08);
  });
  it('separates coincident racks without changing saved coordinates', () => { const racks = layoutWarehouse([], [shelf, { ...shelf, id: 'b' }]); expect(racks[1].z).toBe(3); expect(shelf.position_y).toBe(0); });
  it('applies room rotation and footprint center to the rack location', () => { const [rack] = layoutWarehouse([{ id: 'room', name: 'Room', code: 'R', position_x: 500, position_y: 200, orientation: 90 }], [{ ...shelf, position_x: 100 }]); expect(rack.x).toBeCloseTo(5.5); expect(rack.z).toBeCloseTo(-.5); });
});