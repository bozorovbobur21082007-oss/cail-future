import React, { useMemo, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface Product {
  id: string;
  name: string;
  quantity: number;
}

export interface HighlightSlot {
  level: number;   // 1-indexed
  column: number;  // 1-indexed
  row: number;     // 1-indexed (depth)
}

export type PlacementMap = Map<string, { product: Product; quantity: number }>;
export const placementKey = (l: number, c: number, r: number) => `${l}-${c}-${r}`;

interface Sector3DProps {
  rows: number;       // depth slots
  columns: number;    // width
  levels: number;     // height (qavat)
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  products: Product[];
  placements?: PlacementMap | null;
  highlight?: HighlightSlot | null;
  onSlotClick?: (slot: HighlightSlot) => void;
  readOnly?: boolean;
  className?: string;
  height?: number;
}

function productColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const col = new THREE.Color();
  col.setHSL(hue / 360, 0.65, 0.55);
  return `#${col.getHexString()}`;
}

interface BoxProps {
  position: [number, number, number];
  size: [number, number, number];
  product: Product | null;
  slotLabel: string;
  highlighted?: boolean;
  onClick?: () => void;
  clickable?: boolean;
  readOnly?: boolean;
}

function PalletBox({ position, size, product, slotLabel, highlighted = false, onClick, clickable = false }: BoxProps) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (highlighted && beaconRef.current) {
      const t = clock.getElapsedTime();
      const s = 1 + Math.sin(t * 4) * 0.15;
      beaconRef.current.scale.set(s, 1, s);
    }
  });

  const ringColor = '#ef4444';

  const handleClick = (e: any) => {
    if (!clickable || !onClick) return;
    e.stopPropagation();
    onClick();
  };

  if (!product) {
    return (
      <group position={position}>
        <mesh
          position={[0, -size[1] / 2 + 0.02, 0]}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = clickable ? 'pointer' : 'default'; }}
          onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
          onClick={handleClick}
        >
          <boxGeometry args={[size[0] * 0.92, 0.04, size[2] * 0.92]} />
          <meshStandardMaterial
            color={highlighted ? ringColor : hovered ? '#22c55e' : '#86efac'}
            emissive={highlighted ? ringColor : '#000000'}
            emissiveIntensity={highlighted ? 0.6 : 0}
            transparent
            opacity={highlighted ? 0.85 : 0.55}
          />
        </mesh>
        {/* Invisible larger click target for empty slots */}
        {clickable && (
          <mesh
            position={[0, size[1] / 2, 0]}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
            onClick={handleClick}
            visible={false}
          >
            <boxGeometry args={size} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        )}
        {highlighted && (
          <>
            <mesh ref={beaconRef} position={[0, size[1] * 1.2, 0]}>
              <cylinderGeometry args={[size[0] * 0.15, size[0] * 0.4, 0.02, 24]} />
              <meshBasicMaterial color={ringColor} transparent opacity={0.5} />
            </mesh>
            <Html position={[0, size[1] * 1.6, 0]} center transform style={{ pointerEvents: 'none' }}>
              <div className="px-1.5 py-0.5 rounded bg-red-500 text-white font-bold whitespace-nowrap shadow-lg" style={{ fontSize: '7px' }}>
                ★ {slotLabel}
              </div>
            </Html>
          </>
        )}
        {hovered && !highlighted && (
          <Html position={[0, size[1] / 2, 0]} center transform occlude style={{ pointerEvents: 'none' }}>
            <div className="px-2 py-1 rounded bg-background border whitespace-nowrap shadow" style={{ fontSize: '6px' }}>
              {clickable ? '+ Joylash' : "Bo'sh"} · {slotLabel}
            </div>
          </Html>
        )}
      </group>
    );
  }

  const color = highlighted ? ringColor : productColor(product.id);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = clickable ? 'pointer' : 'default'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
        onClick={handleClick}
        castShadow
        receiveShadow
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          roughness={0.75}
          metalness={0.05}
          emissive={highlighted ? ringColor : '#000000'}
          emissiveIntensity={highlighted ? 0.5 : 0}
        />
      </mesh>
      <mesh position={[0, size[1] / 2 + 0.001, 0]}>
        <boxGeometry args={[size[0] * 0.95, 0.005, size[2] * 0.2]} />
        <meshStandardMaterial color={highlighted ? '#fff' : '#fde68a'} />
      </mesh>
      {highlighted && (
        <>
          <mesh ref={beaconRef} position={[0, size[1] / 2 + 0.15, 0]}>
            <cylinderGeometry args={[size[0] * 0.15, size[0] * 0.45, 0.02, 24]} />
            <meshBasicMaterial color={ringColor} transparent opacity={0.55} />
          </mesh>
          <Html position={[0, size[1] / 2 + 0.35, 0]} center transform style={{ pointerEvents: 'none' }}>
            <div className="px-1.5 py-0.5 rounded bg-red-500 text-white font-bold whitespace-nowrap shadow-lg" style={{ fontSize: '7px' }}>
              ★ {slotLabel}
            </div>
          </Html>
        </>
      )}
      {hovered && !highlighted && (
        <Html position={[0, size[1] / 2 + 0.15, 0]} center transform occlude style={{ pointerEvents: 'none' }}>
          <div className="px-2 py-1 rounded bg-background border whitespace-nowrap shadow" style={{ fontSize: '6px' }}>
            <div className="font-semibold">{product.name}</div>
            <div className="text-muted-foreground">{slotLabel} · {product.quantity} dona</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function Rack({ rows, columns, levels, width_cm, depth_cm, height_cm, products, placements, highlight, onSlotClick }: Omit<Sector3DProps, 'className' | 'height'>) {
  const W = Math.max(0.5, width_cm / 100);
  const D = Math.max(0.3, depth_cm / 100);
  const H = Math.max(0.5, height_cm / 100);

  const cols = Math.max(1, columns);
  const lvls = Math.max(1, levels);
  const depthRows = Math.max(1, rows);

  const slotW = W / cols;
  const slotD = D / depthRows;
  const slotH = H / lvls;

  const boxSize: [number, number, number] = [slotW * 0.82, slotH * 0.7, slotD * 0.82];

  // If placements provided & non-empty, use them. Otherwise fall back to sequential fill.
  const usePlacements = !!placements && placements.size > 0;

  const totalSlots = cols * lvls * depthRows;
  const slotMap = useMemo(() => {
    const arr: Array<Product | null> = Array(totalSlots).fill(null);
    if (usePlacements) return arr;
    let i = 0;
    for (const p of products) {
      const q = Math.max(1, Math.min(p.quantity || 1, totalSlots - i));
      for (let k = 0; k < q && i < totalSlots; k++, i++) arr[i] = p;
    }
    return arr;
  }, [products, totalSlots, usePlacements]);

  const beamH = 0.04;
  const uprightW = 0.06;

  return (
    <group position={[0, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[W * 2.5, D * 3.5]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      {[
        [-W / 2, 0, -D / 2],
        [W / 2, 0, -D / 2],
        [-W / 2, 0, D / 2],
        [W / 2, 0, D / 2],
      ].map((p, i) => (
        <mesh key={i} position={[p[0], H / 2, p[2]]} castShadow>
          <boxGeometry args={[uprightW, H, uprightW]} />
          <meshStandardMaterial color="#2563eb" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}

      {Array.from({ length: lvls + 1 }).map((_, l) => {
        const y = l * slotH;
        return (
          <group key={l}>
            <mesh position={[0, y, -D / 2]} castShadow>
              <boxGeometry args={[W, beamH, uprightW]} />
              <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.4} />
            </mesh>
            <mesh position={[0, y, D / 2]} castShadow>
              <boxGeometry args={[W, beamH, uprightW]} />
              <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.4} />
            </mesh>
            {l < lvls && (
              <mesh position={[0, y + 0.01, 0]} receiveShadow>
                <boxGeometry args={[W - uprightW, 0.015, D - uprightW]} />
                <meshStandardMaterial color="#cbd5e1" />
              </mesh>
            )}
          </group>
        );
      })}

      {Array.from({ length: lvls }).map((_, l) =>
        Array.from({ length: depthRows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const L = l + 1, C = c + 1, R = r + 1;
            let product: Product | null = null;
            if (usePlacements) {
              const pl = placements!.get(placementKey(L, C, R));
              if (pl) product = { ...pl.product, quantity: pl.quantity };
            } else {
              const idx = l * (cols * depthRows) + r * cols + c;
              product = slotMap[idx];
            }
            const x = -W / 2 + slotW / 2 + c * slotW;
            const y = l * slotH + boxSize[1] / 2 + 0.02;
            const z = -D / 2 + slotD / 2 + r * slotD;
            const isHi = !!highlight && highlight.level === L && highlight.row === R && highlight.column === C;
            return (
              <PalletBox
                key={`${l}-${r}-${c}`}
                position={[x, y, z]}
                size={boxSize}
                product={product}
                slotLabel={`L${L}·R${R}·C${C}`}
                highlighted={isHi}
                clickable={!!onSlotClick}
                onClick={() => onSlotClick?.({ level: L, column: C, row: R })}
              />
            );
          })
        )
      )}

      {Array.from({ length: lvls }).map((_, l) => (
        <Html
          key={`lbl-${l}`}
          position={[-W / 2 - 0.15, l * slotH + slotH / 2, 0]}
          center
          transform
          style={{ pointerEvents: 'none' }}
        >
          <span className="font-bold text-primary font-mono bg-background/80 px-1 rounded" style={{ fontSize: '8px' }}>L{l + 1}</span>
        </Html>
      ))}
    </group>
  );
}

export default function SectorRack3D({
  rows, columns, levels, width_cm, depth_cm, height_cm, products,
  placements = null,
  highlight = null,
  onSlotClick,
  className = '', height = 420,
}: Sector3DProps) {
  const W = Math.max(0.5, width_cm / 100);
  const H = Math.max(0.5, height_cm / 100);
  const D = Math.max(0.3, depth_cm / 100);
  const dist = Math.max(W, H, D) * 2.2 + 1;

  return (
    <div
      className={`relative rounded-lg overflow-hidden border bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 ${className}`}
      style={{ height }}
    >
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[dist, dist * 0.8, dist]} fov={40} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Suspense fallback={null}>
          <Rack
            rows={rows}
            columns={columns}
            levels={levels}
            width_cm={width_cm}
            depth_cm={depth_cm}
            height_cm={height_cm}
            products={products}
            placements={placements}
            highlight={highlight}
            onSlotClick={onSlotClick}
          />
          <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={1.5}
          maxDistance={dist * 3}
          maxPolarAngle={Math.PI / 2 - 0.05}
          target={[0, H / 2, 0]}
        />
      </Canvas>
      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-background/80 backdrop-blur text-[10px] text-muted-foreground font-mono pointer-events-none">
        {onSlotClick ? "Katakni bosing — mahsulot joylash/almashtirish" : "Sichqoncha: aylantirish · g'ildirak: zoom"}
      </div>
    </div>
  );
}
