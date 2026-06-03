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

interface Sector3DProps {
  rows: number;       // depth slots
  columns: number;    // width
  levels: number;     // height (qavat)
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  products: Product[];
  highlight?: HighlightSlot | null;
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
}

interface BoxProps {
  position: [number, number, number];
  size: [number, number, number];
  product: Product | null;
  slotLabel: string;
  highlighted?: boolean;
}

function PalletBox({ position, size, product, slotLabel, highlighted = false }: BoxProps) {
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

  if (!product) {
    return (
      <group position={position}>
        <mesh
          position={[0, -size[1] / 2 + 0.02, 0]}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={() => setHovered(false)}
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
              Bo'sh · {slotLabel}
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
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
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
      {/* Tape strip */}
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

function Rack({ rows, columns, levels, width_cm, depth_cm, height_cm, products, highlight }: Omit<Sector3DProps, 'className' | 'height'>) {
  // Convert cm -> meters
  const W = Math.max(0.5, width_cm / 100);
  const D = Math.max(0.3, depth_cm / 100);
  const H = Math.max(0.5, height_cm / 100);

  const cols = Math.max(1, columns);
  const lvls = Math.max(1, levels);
  const depthRows = Math.max(1, rows);

  // Each slot
  const slotW = W / cols;
  const slotD = D / depthRows;
  const slotH = H / lvls;

  const boxSize: [number, number, number] = [slotW * 0.82, slotH * 0.7, slotD * 0.82];

  // Distribute products across slots (front-row first, level-by-level from bottom)
  const totalSlots = cols * lvls * depthRows;
  const slotMap = useMemo(() => {
    const arr: Array<Product | null> = Array(totalSlots).fill(null);
    let i = 0;
    for (const p of products) {
      const q = Math.max(1, Math.min(p.quantity || 1, totalSlots - i));
      for (let k = 0; k < q && i < totalSlots; k++, i++) arr[i] = p;
    }
    return arr;
  }, [products, totalSlots]);

  const beamH = 0.04;
  const uprightW = 0.06;

  return (
    <group position={[0, 0, 0]}>
      {/* Floor reference */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[W * 2.5, D * 3.5]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      {/* Uprights — 4 corners */}
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

      {/* Horizontal beams at each level (front + back) */}
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
            {/* Shelf deck (thin) — not for top */}
            {l < lvls && (
              <mesh position={[0, y + 0.01, 0]} receiveShadow>
                <boxGeometry args={[W - uprightW, 0.015, D - uprightW]} />
                <meshStandardMaterial color="#cbd5e1" />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Pallet boxes */}
      {Array.from({ length: lvls }).map((_, l) =>
        Array.from({ length: depthRows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const idx = l * (cols * depthRows) + r * cols + c;
            const product = slotMap[idx];
            const x = -W / 2 + slotW / 2 + c * slotW;
            const y = l * slotH + boxSize[1] / 2 + 0.02;
            const z = -D / 2 + slotD / 2 + r * slotD;
            const isHi = !!highlight && highlight.level === l + 1 && highlight.row === r + 1 && highlight.column === c + 1;
            return (
              <PalletBox
                key={`${l}-${r}-${c}`}
                position={[x, y, z]}
                size={boxSize}
                product={product}
                slotLabel={`L${l + 1}·R${r + 1}·C${c + 1}`}
                highlighted={isHi}
              />
            );
          })
        )
      )}

      {/* Level labels on left upright */}
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

function AutoRotate({ enabled }: { enabled: boolean }) {
  const ref = useRef<any>(null);
  useFrame(() => {
    if (enabled && ref.current) ref.current.update();
  });
  return null;
}

export default function SectorRack3D({
  rows, columns, levels, width_cm, depth_cm, height_cm, products,
  highlight = null,
  className = '', height = 420,
}: Sector3DProps) {
  // Camera target based on rack size
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
            highlight={highlight}
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
        Sichqoncha: aylantirish · g'ildirak: zoom · o'ng tugma: surish
      </div>
    </div>
  );
}
