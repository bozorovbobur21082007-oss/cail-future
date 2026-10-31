import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Html, Lightformer, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Box, Camera, ChevronRight, Download, Expand, Layers, LayoutGrid, Minimize, RotateCcw, Search, Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { layoutWarehouse, slotPosition, warehouseSlots, type RackLayout, type WarehouseSector, type WarehouseShelf, type WarehouseProduct, type WarehousePlacement, type WarehouseSlot } from '@/utils/warehouseLayout';

interface Props {
  sectors: WarehouseSector[]; shelves: WarehouseShelf[]; products: WarehouseProduct[]; placements: WarehousePlacement[];
  onOpenShelf?: (shelf: WarehouseShelf) => void;
}
type Palette = Record<string, string>;
const roles = ['backdrop', 'floor', 'floor-line', 'steel', 'beam', 'deck', 'carton', 'tape', 'pallet', 'lane', 'label', 'ink', 'empty', 'found', 'shell'];
function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(roles.map(role => [role, new THREE.Color(`hsl(${css.getPropertyValue(`--warehouse-${role}`).trim().replace(/\s+/g, ', ')})`).getStyle()]));
}
function surfaceTexture(base: string, line: string, carton = false) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = line;
    if (carton) {
      ctx.fillStyle = line; ctx.fillRect(114, 0, 28, 256);
      ctx.lineWidth = 2; ctx.strokeRect(8, 8, 240, 240);
      ctx.fillStyle = base; ctx.fillRect(22, 154, 60, 58);
      ctx.lineWidth = 2; for (let x = 26; x < 78; x += 4) { ctx.beginPath(); ctx.moveTo(x, 162); ctx.lineTo(x, 194); ctx.stroke(); }
    } else {
      ctx.lineWidth = 1; ctx.strokeRect(.5, .5, 255, 255);
      for (let i = 0; i < 1800; i++) { const x = (i * 73) % 256, y = (i * 137) % 256; ctx.globalAlpha = .14; ctx.fillStyle = line; ctx.fillRect(x, y, 1, 1); }
      ctx.globalAlpha = 1;
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (!carton) texture.repeat.set(20, 20);
  return texture;
}
interface Piece { position: [number, number, number]; scale: [number, number, number]; angle?: number; color?: string }
function Instances({ pieces, color, texture, onClick, transparent = false }: { pieces: Piece[]; color: string; texture?: THREE.Texture; onClick?: (index: number) => void; transparent?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!ref.current) return;
    const obj = new THREE.Object3D();
    pieces.forEach((piece, i) => {
      obj.position.set(...piece.position); obj.scale.set(...piece.scale); obj.rotation.set(0, piece.angle ?? 0, 0); obj.updateMatrix();
      ref.current?.setMatrixAt(i, obj.matrix);
      if (piece.color) ref.current?.setColorAt(i, new THREE.Color(piece.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [pieces]);
  if (!pieces.length) return null;
  return <instancedMesh ref={ref} args={[undefined, undefined, pieces.length]} castShadow={!transparent} receiveShadow={!transparent}
    onClick={(e: ThreeEvent<MouseEvent>) => { if (onClick && e.instanceId !== undefined) { e.stopPropagation(); onClick(e.instanceId); } }}
    onPointerOver={() => { if (onClick) document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
    <boxGeometry />
    <meshStandardMaterial color={color} map={texture} roughness={texture ? .85 : .5} metalness={texture ? 0 : .25} transparent={transparent} opacity={transparent ? .015 : 1} depthWrite={!transparent} />
  </instancedMesh>;
}
function world(rack: RackLayout, x: number, y: number, z: number): [number, number, number] {
  return [rack.x + x * Math.cos(rack.angle) + z * Math.sin(rack.angle), y, rack.z - x * Math.sin(rack.angle) + z * Math.cos(rack.angle)];
}
function CameraRig({ center, distance, focus, mode, revision }: { center: [number, number, number]; distance: number; focus: WarehouseSlot | null; mode: string; revision: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate, size } = useThree();
  const destination = useRef(new THREE.Vector3()); const target = useRef(new THREE.Vector3()); const moving = useRef(true);
  useEffect(() => {
    const p = focus ? slotPosition(focus) : center;
    target.current.set(p[0], focus ? p[1] + .3 : .5, p[2]);
    const aspectFit = Math.max(1, size.height / Math.max(1, size.width));
    const d = (focus ? Math.max(3, focus.rack.width * 1.6) : distance) * aspectFit;
    destination.current.set(p[0] + (mode === 'top' ? .01 : mode === 'front' ? 0 : d * .72), (mode === 'top' ? d * 1.35 : mode === 'front' ? d * .3 : d * .7) + p[1], p[2] + (mode === 'top' ? .01 : d * .85));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.position.copy(destination.current); controls.current?.target.copy(target.current); controls.current?.update(); moving.current = false;
    } else moving.current = true;
    invalidate();
  }, [focus, mode, revision, center, distance, invalidate, size.width, size.height, camera]);
  useFrame((_, delta) => {
    if (!moving.current || !controls.current) return;
    const amount = 1 - Math.exp(-6 * Math.min(delta, .25));
    camera.position.lerp(destination.current, amount); controls.current.target.lerp(target.current, amount); controls.current.update();
    if (camera.position.distanceTo(destination.current) < .025) moving.current = false;
    else invalidate();
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.1} minDistance={1} maxDistance={distance * 4} maxPolarAngle={Math.PI / 2 - .01} onStart={() => { moving.current = false; }} />;
}
function WarehouseScene({ racks, slots, palette, selected, onSelect, level, query, mode, revision, ready }: {
  racks: RackLayout[]; slots: WarehouseSlot[]; palette: Palette; selected: WarehouseSlot | null; onSelect: (slot: WarehouseSlot) => void; level: number; query: string; mode: string; revision: number; ready: () => void;
}) {
  const bounds = useMemo(() => {
    const minX = Math.min(-3, ...racks.map(r => r.x - r.width / 2 - r.depth / 2)) - 2;
    const maxX = Math.max(3, ...racks.map(r => r.x + r.width / 2 + r.depth / 2)) + 2;
    const minZ = Math.min(-3, ...racks.map(r => r.z - r.depth / 2 - r.width / 2)) - 2;
    const maxZ = Math.max(3, ...racks.map(r => r.z + r.depth / 2 + r.width / 2)) + 2;
    return { minX, maxX, minZ, maxZ, w: maxX - minX, d: maxZ - minZ };
  }, [racks]);
  const center = useMemo<[number, number, number]>(() => [(bounds.maxX + bounds.minX) / 2, 0, (bounds.maxZ + bounds.minZ) / 2], [bounds]);
  const floorTexture = useMemo(() => surfaceTexture(palette.floor, palette['floor-line']), [palette]);
  const boxTexture = useMemo(() => surfaceTexture(palette.carton, palette.tape, true), [palette]);
  useEffect(() => () => { floorTexture.dispose(); boxTexture.dispose(); }, [floorTexture, boxTexture]);
  const structure = useMemo(() => {
    const steel: Piece[] = [], beams: Piece[] = [], decks: Piece[] = [];
    for (const rack of racks) {
      const h = level ? Math.min(level, rack.shelf.levels) * rack.height / rack.shelf.levels : rack.height;
      for (let c = 0; c <= rack.shelf.columns; c++) for (const z of [-rack.depth / 2, rack.depth / 2]) steel.push({ position: world(rack, -rack.width / 2 + c * rack.width / rack.shelf.columns, h / 2, z), scale: [.045, h + .12, .045], angle: rack.angle });
      for (let l = 0; l <= (level || rack.shelf.levels); l++) {
        if (l > rack.shelf.levels) continue;
        const y = l * rack.height / rack.shelf.levels;
        for (const z of [-rack.depth / 2, rack.depth / 2]) beams.push({ position: world(rack, 0, y + .025, z), scale: [rack.width, .065, .04], angle: rack.angle });
        if (l < rack.shelf.levels && (!level || l < level)) decks.push({ position: world(rack, 0, y, 0), scale: [rack.width, .022, rack.depth], angle: rack.angle });
      }
    }
    return { steel, beams, decks };
  }, [racks, level]);
  const visible = useMemo(() => slots.filter(s => !level || s.level <= level), [slots, level]);
  const occupied = useMemo(() => visible.filter(s => s.product), [visible]);
  const matching = (s: WarehouseSlot) => !!query && !!s.product && `${s.product.name} ${s.product.product_code ?? ''}`.toLowerCase().includes(query.toLowerCase());
  const boxes = useMemo(() => occupied.map(s => {
    const pos = slotPosition(s); const height = s.rack.height / s.rack.shelf.levels * .64;
    const isSelected = selected?.rack.shelf.id === s.rack.shelf.id && selected?.level === s.level && selected?.column === s.column && selected?.row === s.row;
    return { position: [pos[0], pos[1] + height / 2, pos[2]] as [number, number, number], scale: [s.rack.width / s.rack.shelf.columns * .83, height, s.rack.depth / s.rack.shelf.rows * .8] as [number, number, number], angle: s.rack.angle, color: isSelected || matching(s) ? palette.found : palette.label };
  }), [occupied, palette, selected, query]);
  const pallets = useMemo(() => occupied.flatMap(s => {
    const pos = slotPosition(s); const w = s.rack.width / s.rack.shelf.columns * .9, d = s.rack.depth / s.rack.shelf.rows * .88;
    return [-.35, 0, .35].map(offset => ({ position: [pos[0] + offset * w * Math.cos(s.rack.angle), pos[1] - .035, pos[2] - offset * w * Math.sin(s.rack.angle)] as [number, number, number], scale: [w * .24, .055, d] as [number, number, number], angle: s.rack.angle }));
  }), [occupied]);
  const targets = useMemo(() => visible.map(s => { const p = slotPosition(s), h = s.rack.height / s.rack.shelf.levels * .7; return { position: [p[0], p[1] + h / 2, p[2]] as [number, number, number], scale: [s.rack.width / s.rack.shelf.columns * .92, h, s.rack.depth / s.rack.shelf.rows * .92] as [number, number, number], angle: s.rack.angle }; }), [visible]);
  const didDraw = useRef(false);
  useFrame(() => { if (!didDraw.current) { didDraw.current = true; ready(); } });
  return <>
    <color attach="background" args={[palette.backdrop]} />
    <hemisphereLight args={[palette.label, palette.floor, 1.6]} />
    <directionalLight position={[center[0] + 8, 18, center[2] + 5]} intensity={2.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-bounds.w} shadow-camera-right={bounds.w} shadow-camera-top={bounds.d} shadow-camera-bottom={-bounds.d} shadow-camera-far={70} shadow-bias={-.0003} />
    <Suspense fallback={null}><Environment resolution={64}><Lightformer position={[0, 12, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[30, 30, 1]} intensity={2} /><Lightformer position={[-15, 5, 0]} rotation={[0, Math.PI / 2, 0]} scale={[20, 10, 1]} intensity={1} /></Environment></Suspense>
    <mesh position={[center[0], -.055, center[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[bounds.w, bounds.d]} /><meshStandardMaterial map={floorTexture} roughness={.93} /></mesh>
    <Instances color={palette.shell} pieces={[
      { position: [center[0], .2, bounds.minZ], scale: [bounds.w, .4, .12] },
      { position: [bounds.minX, .2, center[2]], scale: [.12, .4, bounds.d] },
      { position: [bounds.maxX, .2, center[2]], scale: [.12, .4, bounds.d] },
    ]} />
    <Instances color={palette.lane} pieces={[
      { position: [center[0], -.018, bounds.maxZ - 1], scale: [bounds.w - 2, .01, .065] },
      { position: [bounds.minX + 1, -.018, center[2]], scale: [.065, .01, bounds.d - 2] },
      { position: [bounds.maxX - 1, -.018, center[2]], scale: [.065, .01, bounds.d - 2] },
    ]} />
    <Instances pieces={structure.steel} color={palette.steel} />
    <Instances pieces={structure.beams} color={palette.beam} />
    <Instances pieces={structure.decks} color={palette.deck} />
    <Instances pieces={pallets} color={palette.pallet} />
    <Instances pieces={boxes} color={palette.label} texture={boxTexture} onClick={i => onSelect(occupied[i])} />
    <Instances pieces={targets} color={palette.empty} transparent onClick={i => onSelect(visible[i])} />
    {racks.map(rack => <Html key={rack.shelf.id} position={world(rack, -rack.width / 2 - .15, rack.height + .32, 0)} center distanceFactor={14} zIndexRange={[20, 0]}>
      <Button variant="secondary" size="sm" className="warehouse-label h-7 px-2 text-xs font-mono border shadow-sm" onClick={() => { const slot = slots.find(s => s.rack.shelf.id === rack.shelf.id); if (slot) onSelect(slot); }}>{rack.shelf.code}</Button>
    </Html>)}
    {selected && <Html position={slotPosition(selected)} center zIndexRange={[30, 0]}><div className="warehouse-label border border-destructive px-2 py-1 text-xs font-mono whitespace-nowrap shadow pointer-events-none">L{selected.level} · C{selected.column} · R{selected.row}</div></Html>}
    <CameraRig center={center} distance={Math.max(bounds.w, bounds.d) * .86} focus={selected} mode={mode} revision={revision} />
  </>;
}
function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label={label} onClick={onClick}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}
export default function WarehouseDigitalTwin({ sectors, shelves, products, placements, onOpenShelf }: Props) {
  const [palette, setPalette] = useState<Palette | null>(null);
  const [query, setQuery] = useState(''); const [room, setRoom] = useState('all'); const [level, setLevel] = useState(0);
  const [selected, setSelected] = useState<WarehouseSlot | null>(null); const [mode, setMode] = useState('orbit'); const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState(false); const [sceneReady, setReady] = useState(false); const [webglError, setWebglError] = useState(false);
  const root = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => { setPalette(readPalette()); }, []);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  const racks = useMemo(() => layoutWarehouse(sectors, shelves.filter(s => room === 'all' || s.sector_id === room)), [sectors, shelves, room]);
  const slots = useMemo(() => warehouseSlots(racks, products, placements), [racks, products, placements]);
  const results = useMemo(() => query.trim() ? slots.filter(s => s.product && `${s.product.name} ${s.product.product_code ?? ''}`.toLowerCase().includes(query.toLowerCase())) : [], [slots, query]);
  const unplaced = products.filter(p => p.quantity > 0 && !placements.some(pl => pl.product_id === p.id));
  const maxLevel = Math.max(1, ...racks.map(r => r.shelf.levels));
  const choose = (slot: WarehouseSlot) => { setSelected(slot); if (level && slot.level > level) setLevel(slot.level); };
  const reset = () => { setSelected(null); setMode('orbit'); setRevision(v => v + 1); };
  const download = () => { if (!canvas.current) return; const link = document.createElement('a'); link.download = 'ombor-3d.png'; link.href = canvas.current.toDataURL('image/png'); link.click(); };
  return <section ref={root} aria-label="Omborning 3D xaritasi" className={expanded ? 'fixed inset-0 z-[60] bg-background p-3 flex flex-col gap-3' : 'space-y-3'}>
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2"><Box className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold">Ombor · 3D xarita</h2><span className="text-xs text-muted-foreground font-mono">{racks.length} shkaf</span></div>
      <div className="flex gap-1.5"><Tool label="Tasvirni yuklash" onClick={download}><Download /></Tool><Tool label={expanded ? 'Kichraytirish' : 'Kengaytirish'} onClick={() => setExpanded(v => !v)}>{expanded ? <Minimize /> : <Expand />}</Tool></div>
    </div>
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[180px] max-w-md"><Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" /><Input aria-label="3D xaritada mahsulot qidirish" placeholder="Mahsulot nomi yoki barkodi" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && results[0]) choose(results[0]); }} className="pl-9" /></div>
      <select aria-label="Xona" className="h-10 max-w-[180px] rounded-md border bg-background px-2 text-sm" value={room} onChange={e => { setRoom(e.target.value); setSelected(null); setRevision(v => v + 1); }}><option value="all">Barcha xonalar</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <div className="flex items-center gap-1"><Layers className="w-4 h-4 text-muted-foreground mr-1" /><Button size="sm" variant={level === 0 ? 'default' : 'outline'} onClick={() => setLevel(0)}>Hammasi</Button>{Array.from({ length: maxLevel }, (_, i) => <Button key={i} size="sm" variant={level === i + 1 ? 'default' : 'outline'} onClick={() => { setLevel(i + 1); if (selected && selected.level > i + 1) setSelected(null); }}>L{i + 1}</Button>)}</div>
    </div>
    <div className={expanded ? 'flex-1 min-h-0 flex flex-col lg:flex-row gap-0 border overflow-hidden' : 'flex flex-col lg:flex-row border overflow-hidden rounded-md'}>
      <div className={`warehouse-stage relative flex-1 min-w-0 ${expanded ? 'is-expanded' : ''}`} data-scene-ready={sceneReady || undefined}>
        {palette && <Canvas shadows frameloop="demand" dpr={[1, 1.5]} camera={{ position: [12, 12, 16], fov: 42, near: .1, far: 500 }} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }} onCreated={({ gl }) => { canvas.current = gl.domElement; gl.domElement.addEventListener('webglcontextlost', () => setWebglError(true)); }} fallback={<div className="p-8 text-muted-foreground">3D ko‘rinish bu qurilmada mavjud emas.</div>}>
          <WarehouseScene racks={racks} slots={slots} palette={palette} selected={selected} onSelect={choose} level={level} query={query} mode={mode} revision={revision} ready={() => setReady(true)} />
        </Canvas>}
        <div className="absolute left-3 top-3 flex gap-1.5"><Tool label="Umumiy ko‘rinish" onClick={reset}><RotateCcw /></Tool><Tool label="Yuqoridan" onClick={() => { setSelected(null); setMode('top'); setRevision(v => v + 1); }}><LayoutGrid /></Tool><Tool label="Oldindan" onClick={() => { setSelected(null); setMode('front'); setRevision(v => v + 1); }}><Camera /></Tool></div>
        <div className="absolute bottom-3 left-3 flex gap-3 flex-wrap bg-background/90 border px-3 py-2 text-[11px] pointer-events-none"><span className="flex gap-1.5 items-center"><i className="warehouse-dot is-full w-2 h-2 rounded-sm" />Band</span><span className="flex gap-1.5 items-center"><i className="warehouse-dot w-2 h-2 rounded-sm" />Bo‘sh</span><span className="flex gap-1.5 items-center"><i className="warehouse-dot is-found w-2 h-2 rounded-sm" />Topilgan</span></div>
        {!racks.length && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="bg-background/90 p-4 text-sm text-muted-foreground">Bu xonada hali shkaf yo‘q</span></div>}
        {webglError && <div className="absolute inset-0 flex items-center justify-center bg-background/90 text-sm">3D tasvir to‘xtadi. Sahifani qayta oching.</div>}
      </div>
      <aside className="w-full lg:w-72 shrink-0 bg-background border-t lg:border-t-0 lg:border-l p-4 overflow-y-auto max-h-[580px]">
        {selected ? <>
          <div className="flex items-center justify-between"><span className="text-xs uppercase text-muted-foreground">Katak kartochkasi</span><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Tanlovni yopish" onClick={reset}><X /></Button></div>
          <h3 className="font-semibold text-lg mt-3 break-words">{selected.product?.name ?? 'Bo‘sh katak'}</h3>
          <p className="font-mono text-xs text-muted-foreground mt-1 break-all">{selected.product?.product_code ?? '—'}</p>
          <div className="grid grid-cols-3 gap-2 mt-5">{[['Qavat', selected.level], ['Ustun', selected.column], ['Qator', selected.row]].map(([label, value]) => <div key={label} className="border-b pb-2"><span className="text-[11px] text-muted-foreground">{label}</span><div className="font-mono text-xl font-semibold">{value}</div></div>)}</div>
          <dl className="text-sm mt-5 space-y-3"><div><dt className="text-xs text-muted-foreground">Xona</dt><dd>{sectors.find(s => s.id === selected.rack.shelf.sector_id)?.name ?? '—'}</dd></div><div><dt className="text-xs text-muted-foreground">Shkaf</dt><dd>{selected.rack.shelf.name} · {selected.rack.shelf.code}</dd></div><div><dt className="text-xs text-muted-foreground">Katakdagi miqdor</dt><dd className="text-2xl font-semibold">{selected.quantity} <span className="text-xs font-normal">dona</span></dd></div></dl>
          {onOpenShelf && <Button variant="outline" className="w-full mt-6" onClick={() => onOpenShelf(selected.rack.shelf)}>Shkafni ochish<ChevronRight className="w-4 h-4" /></Button>}
        </> : <><h3 className="font-semibold">Ombor holati</h3><div className="grid grid-cols-2 gap-4 py-5 border-b"><div><p className="text-xs text-muted-foreground">Kataklar</p><p className="text-2xl font-semibold">{slots.length}</p></div><div><p className="text-xs text-muted-foreground">Joylashtirilgan</p><p className="text-2xl font-semibold">{slots.filter(s => s.product).length}</p></div></div><div className="mt-4 space-y-3">{racks.map(r => <Button key={r.shelf.id} variant="ghost" className="w-full h-auto px-0 justify-between text-left" onClick={() => { const s = slots.find(s => s.rack.shelf.id === r.shelf.id); if (s) choose(s); }}><span className="min-w-0"><span className="block truncate font-medium">{r.shelf.name}</span><span className="block text-xs font-mono text-muted-foreground">{r.shelf.code} · {r.shelf.columns}C × {r.shelf.rows}R × {r.shelf.levels}L</span></span><Target className="w-4 h-4 shrink-0" /></Button>)}</div></>}
        {query && <div className="mt-5 border-t pt-4"><h4 className="text-xs text-muted-foreground mb-2">Natijalar · {results.length}</h4>{results.length ? results.slice(0, 20).map(s => <Button key={`${s.rack.shelf.id}-${s.level}-${s.column}-${s.row}`} variant="ghost" className="w-full h-auto text-left justify-start px-1 py-2" onClick={() => choose(s)}><span className="min-w-0"><span className="block truncate text-sm">{s.product?.name}</span><span className="block text-xs text-muted-foreground font-mono">{s.rack.shelf.code} / L{s.level} C{s.column} R{s.row}</span></span></Button>) : <p className="text-xs text-muted-foreground">Joylashtirilgan mahsulot topilmadi.</p>}</div>}
        {unplaced.length > 0 && <div className="mt-5 pt-4 border-t"><p className="text-xs text-muted-foreground">Joylashuvi belgilanmagan · {unplaced.length} mahsulot</p></div>}
      </aside>
    </div>
  </section>;
}