import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  format?: 'CODE128' | 'CODE39' | 'EAN13';
  width?: number;        // bar width (px) — JsBarcode default 2
  height?: number;       // bar height (px)
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
  background?: string;
  lineColor?: string;
  className?: string;
}

/**
 * Code 128 (va boshqa) barkod renderer.
 * forwardRef orqali canvas elementga tashqaridan murojaat qilish mumkin
 * (masalan toDataURL() yordamida PNG yuklab olish uchun).
 */
const Barcode = forwardRef<HTMLCanvasElement, BarcodeProps>(({
  value,
  format = 'CODE128',
  width = 2,
  height = 80,
  displayValue = true,
  fontSize = 16,
  margin = 8,
  background = '#ffffff',
  lineColor = '#000000',
  className,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement, []);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    try {
      JsBarcode(canvasRef.current, value, {
        format,
        width,
        height,
        displayValue,
        fontSize,
        margin,
        background,
        lineColor,
      });
    } catch {
      // qiymat noto'g'ri formatda bo'lsa (masalan EAN13 uchun raqam emas)
    }
  }, [value, format, width, height, displayValue, fontSize, margin, background, lineColor]);

  return <canvas ref={canvasRef} className={className} />;
});

Barcode.displayName = 'Barcode';

export default Barcode;
