import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, SwitchCamera } from 'lucide-react';

interface QrScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState(0);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    const scannerId = 'qr-reader-' + Date.now();

    // Create the element for the scanner
    if (containerRef.current) {
      const div = document.createElement('div');
      div.id = scannerId;
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(div);
    }

    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!devices || devices.length === 0) {
          setError('Kamera topilmadi. Qurilmangizda kamera mavjudligini tekshiring.');
          return;
        }
        setCameras(devices);
        // Prefer back camera
        const backIdx = devices.findIndex(
          (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('orqa')
        );
        const idx = backIdx >= 0 ? backIdx : 0;
        setActiveCameraIdx(idx);
        startScanner(scanner, devices[idx].id);
      })
      .catch(() => {
        setError('Kameraga ruxsat berilmadi. Brauzer sozlamalaridan kameraga kirishga ruxsat bering.');
      });

    return () => {
      scanner.stop().catch(() => {});
      scanner.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScanner = (scanner: Html5Qrcode, cameraId: string) => {
    setError('');
    scanner
      .start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!scannedRef.current) {
            scannedRef.current = true;
            scanner.stop().catch(() => {});
            onScan(decodedText);
          }
        },
        () => {} // ignore errors during scanning
      )
      .catch(() => {
        setError('Kamerani ishga tushirishda xatolik yuz berdi.');
      });
  };

  const switchCamera = async () => {
    if (cameras.length < 2 || !scannerRef.current) return;
    try {
      await scannerRef.current.stop();
    } catch {}
    scannedRef.current = false;
    const nextIdx = (activeCameraIdx + 1) % cameras.length;
    setActiveCameraIdx(nextIdx);
    startScanner(scannerRef.current, cameras[nextIdx].id);
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden bg-muted aspect-square max-h-[300px]"
      />
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg flex items-start gap-2">
          <CameraOff className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex gap-2">
        {cameras.length > 1 && (
          <Button variant="outline" size="sm" onClick={switchCamera} className="gap-2">
            <SwitchCamera className="w-4 h-4" />
            Kamerani almashtirish
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
          Bekor qilish
        </Button>
      </div>
    </div>
  );
}
