export interface WarehouseSector { id: string; name: string; code: string; position_x: number; position_y: number; orientation: number }
export interface WarehouseShelf extends WarehouseSector { sector_id: string; rows: number; columns: number; levels: number; width_cm: number; depth_cm: number; height_cm: number; capacity: number }
export interface WarehouseProduct { id: string; name: string; quantity: number; product_code?: string | null; sector_id?: string | null }
export interface WarehousePlacement { shelf_id: string; product_id: string; level: number; column_idx: number; row_idx: number; quantity: number }
export interface RackLayout { shelf: WarehouseShelf; x: number; z: number; angle: number; width: number; depth: number; height: number }
export interface WarehouseSlot { rack: RackLayout; level: number; column: number; row: number; product: WarehouseProduct | null; quantity: number }

/** Keep saved positions when non-overlapping; separate coincident legacy positions for inspection only. */
export function layoutWarehouse(sectors: WarehouseSector[], shelves: WarehouseShelf[]): RackLayout[] {
  const racks: RackLayout[] = [];
  for (const shelf of shelves) {
    const room = sectors.find(s => s.id === shelf.sector_id);
    const roomAngle = (room?.orientation ?? 0) * Math.PI / 180;
    const angle = roomAngle + shelf.orientation * Math.PI / 180;
    const width = Math.max(.5, shelf.width_cm / 100), depth = Math.max(.3, shelf.depth_cm / 100);
    const localX = shelf.position_x / 100 + width / 2, localZ = shelf.position_y / 100 + depth / 2;
    let x = (room?.position_x ?? 0) / 100 + localX * Math.cos(roomAngle) + localZ * Math.sin(roomAngle);
    let z = (room?.position_y ?? 0) / 100 - localX * Math.sin(roomAngle) + localZ * Math.cos(roomAngle);
    const extent = (w: number, d: number, a: number) => [Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * d, Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * d];
    const [ex, ez] = extent(width, depth, angle);
    let tries = 0;
    while (racks.some(r => { const [rx, rz] = extent(r.width, r.depth, r.angle); return Math.abs(r.x - x) < (rx + ex) / 2 + .5 && Math.abs(r.z - z) < (rz + ez) / 2 + .5; }) && tries < 200) {
      z += ez + 1.5; tries++;
    }
    racks.push({ shelf, x, z, angle, width, depth, height: Math.max(.5, shelf.height_cm / 100) });
  }
  return racks;
}

/** Only explicit placements represent known physical locations. Unplaced stock stays unplaced. */
export function warehouseSlots(racks: RackLayout[], products: WarehouseProduct[], placements: WarehousePlacement[]): WarehouseSlot[] {
  const productMap = new Map(products.map(p => [p.id, p]));
  const placementMap = new Map(placements.map(p => [`${p.shelf_id}:${p.level}:${p.column_idx}:${p.row_idx}`, p]));
  return racks.flatMap(rack => {
    const slots: WarehouseSlot[] = [];
    for (let level = 1; level <= rack.shelf.levels; level++) for (let row = 1; row <= rack.shelf.rows; row++) for (let column = 1; column <= rack.shelf.columns; column++) {
      const pl = placementMap.get(`${rack.shelf.id}:${level}:${column}:${row}`);
      slots.push({ rack, level, row, column, product: pl ? productMap.get(pl.product_id) ?? null : null, quantity: pl?.quantity ?? 0 });
    }
    return slots;
  });
}

export function slotPosition(slot: WarehouseSlot): [number, number, number] {
  const { rack, level, column, row } = slot;
  const x = -rack.width / 2 + (column - .5) * rack.width / rack.shelf.columns;
  const z = -rack.depth / 2 + (row - .5) * rack.depth / rack.shelf.rows;
  return [rack.x + x * Math.cos(rack.angle) + z * Math.sin(rack.angle), (level - 1) * rack.height / rack.shelf.levels + .08, rack.z - x * Math.sin(rack.angle) + z * Math.cos(rack.angle)];
}