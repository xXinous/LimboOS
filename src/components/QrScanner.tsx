import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import NimiqQrScanner from 'qr-scanner';
interface QrScannerProps {
  onDetected: (code: string) => void;
  onCancel: () => void;
}
function calculateScanRegion(video: HTMLVideoElement): NimiqQrScanner.ScanRegion {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    return {
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      downScaledWidth: 400,
      downScaledHeight: 400,
    };
  }
  const side = Math.round(0.92 * Math.min(w, h));
  const x = Math.round((w - side) / 2);
  const y = Math.round((h - side) / 2);
  const down = Math.min(900, side);
  return {
    x,
    y,
    width: side,
    height: side,
    downScaledWidth: down,
    downScaledHeight: down,
  };
}
export default function QrScanner({ onDetected, onCancel }: QrScannerProps) {
  const onDetectedRef = useRef(onDetected);
  const onCancelRef = useRef(onCancel);
  onDetectedRef.current = onDetected;
  onCancelRef.current = onCancel;
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<NimiqQrScanner | null>(null);
  const detectedRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scanBoxSize, setScanBoxSize] = useState(200);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr?.width || !cr?.height) return;
      const m = Math.min(cr.width, cr.height);
      setScanBoxSize(Math.max(120, Math.floor(m * 0.82)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    detectedRef.current = false;
    const scanner = new NimiqQrScanner(
      video,
      (result) => {
        if (detectedRef.current) return;
        detectedRef.current = true;
        const code = result.data;
        scannerRef.current?.destroy();
        scannerRef.current = null;
        onDetectedRef.current(code);
      },
      {
        returnDetailedScanResult: true,
        preferredCamera: 'environment',
        maxScansPerSecond: 12,
        calculateScanRegion,
        onDecodeError: () => {
        },
      }
    );
    scannerRef.current = scanner;
    scanner
      .start()
      .then(() => {
        if (cancelled) {
          scanner.destroy();
          scannerRef.current = null;
        }
      })
      .catch((err) => {
        console.error('QR scanner failed to start:', err);
        scannerRef.current = null;
        if (!cancelled) onCancelRef.current();
      });
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        try {
          s.destroy();
        } catch {
        }
      }
    };
  }, []);
  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: '12px',
        background: '#000',
      }}
    >
      <style>{`
        .qr-scanner-video {
          position: absolute !important;
          inset: 0 !important;
          z-index: 2 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>
      <video ref={videoRef} className="qr-scanner-video" />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          background: 'rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: `${scanBoxSize}px`,
            height: `${scanBoxSize}px`,
            boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '30px',
              height: '30px',
              borderTop: '4px solid #f97316',
              borderLeft: '4px solid #f97316',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '30px',
              height: '30px',
              borderTop: '4px solid #f97316',
              borderRight: '4px solid #f97316',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '30px',
              height: '30px',
              borderBottom: '4px solid #f97316',
              borderLeft: '4px solid #f97316',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '30px',
              height: '30px',
              borderBottom: '4px solid #f97316',
              borderRight: '4px solid #f97316',
            }}
          />
          <motion.div
            animate={{ y: [0, scanBoxSize - 2, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              height: '2px',
              background: '#f97316',
              boxShadow: '0 0 12px rgba(249,115,22,0.8)',
              top: 0,
            }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          width: '40px',
          height: '40px',
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '50%',
          cursor: 'pointer',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
        }}
      >
        <X size={24} color="#fff" />
      </button>
    </div>
  );
}
