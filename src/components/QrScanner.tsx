import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface QrScannerProps {
  onDetected: (code: string) => void;
  onCancel: () => void;
}

export default function QrScanner({ onDetected, onCancel }: QrScannerProps) {
  // Store callbacks in refs so the useEffect never re-runs due to new
  // function references (parent re-renders create inline lambdas each time).
  const onDetectedRef = useRef(onDetected);
  const onCancelRef   = useRef(onCancel);
  onDetectedRef.current = onDetected;
  onCancelRef.current   = onCancel;

  // Store scanner instance outside the effect promise chain so the cleanup
  // function always has access to it, even if the effect is torn down early.
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null>(null);
  const detectedRef = useRef(false);

  const divId = 'qr-reader-container';

  useEffect(() => {
    let cancelled = false;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return; // component unmounted before import resolved

      const scanner = new Html5Qrcode(divId, { verbose: false });
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          // No qrbox → library does NOT render its own white overlay.
          // Detection works across the full video frame.
          { fps: 15 },
          (decodedText) => {
            if (detectedRef.current) return;
            detectedRef.current = true;
            // DO NOT call scanner.stop() here.
            // The parent will call setTapeState('empty') which unmounts this
            // component, and the cleanup below will stop the scanner exactly once.
            onDetectedRef.current(decodedText);
          },
          () => { /* per-frame failures are normal, ignore */ }
        )
        .catch((err) => {
          console.error('QR scanner failed to start:', err);
          if (!cancelled) onCancelRef.current();
        });
    });

    // Cleanup: stop camera exactly once when component unmounts.
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        scannerRef.current = null;
        s.stop().catch(() => {}); // single, clean stop call
      }
    };
  }, []); // intentionally empty — camera starts once and runs until unmount

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: '8px', background: '#000' }}>

      {/* Tame html5-qrcode injected elements */}
      <style>{`
        #qr-reader-container {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
        }
        #qr-reader-container video {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block !important;
          /* ── CAMERA FRAMING ──────────────────────────────────────
             Ajuste object-position para enquadrar a câmera.
             Exemplos: center center | top center | 50% 30%
             ─────────────────────────────────────────────────── */
          object-position: center center;
        }
        #qr-reader-container img         { display: none !important; }
        #qr-reader-container__dashboard  { display: none !important; }
      `}</style>

      {/* Camera feed — populated by html5-qrcode */}
      <div id={divId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Scan-frame overlay — sits on top of the camera */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ position: 'relative', width: '136px', height: '136px' }}>
          {/* Corner brackets */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', borderTop: '2px solid #f97316', borderLeft: '2px solid #f97316' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: '20px', height: '20px', borderTop: '2px solid #f97316', borderRight: '2px solid #f97316' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '20px', height: '20px', borderBottom: '2px solid #f97316', borderLeft: '2px solid #f97316' }} />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderBottom: '2px solid #f97316', borderRight: '2px solid #f97316' }} />

          {/* Scanning line */}
          <motion.div
            animate={{ y: [-56, 56, -56] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
            style={{
              position: 'absolute', left: 0, right: 0,
              height: '2px',
              background: '#f97316',
              boxShadow: '0 0 10px rgba(249,115,22,0.9)',
              top: '50%',
            }}
          />
        </div>

        <p className="animate-pulse" style={{ marginTop: '10px', color: '#f97316', fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          AGUARDANDO QR CODE...
        </p>
      </div>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        style={{
          position: 'absolute', bottom: '8px', right: '8px',
          padding: '6px', background: 'rgba(239,68,68,0.2)',
          border: 'none', borderRadius: '50%', cursor: 'pointer',
          zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={14} style={{ color: '#ef4444' }} />
      </button>
    </div>
  );
}
