import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface QrScannerProps {
  onDetected: (code: string) => void;
  onCancel: () => void;
}

export default function QrScanner({ onDetected, onCancel }: QrScannerProps) {
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null>(null);
  const divId = 'qr-reader-container';
  const detectedRef = useRef(false);

  useEffect(() => {
    let scanner: InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null = null;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode(divId, { verbose: false });
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 180, height: 180 } },
          (decodedText) => {
            if (detectedRef.current) return;
            detectedRef.current = true;
            scanner?.stop().catch(() => {});
            onDetected(decodedText);
          },
          () => { /* ignore scan failures */ }
        )
        .catch((err) => {
          console.error('QR scanner failed to start:', err);
          // Fallback: show camera-unavailable state
          onCancel();
        });
    });

    return () => {
      scanner?.stop().catch(() => {});
    };
  }, [onDetected, onCancel]);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-lg bg-black flex flex-col items-center justify-center">
      {/* live camera feed rendered here by html5-qrcode */}
      <div
        id={divId}
        className="absolute inset-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&>*:last-child]:hidden"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Scan frame overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full pointer-events-none">
        <div className="relative w-36 h-36">
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-orange-500" />
          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-orange-500" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-orange-500" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-orange-500" />

          {/* Scanning line */}
          <motion.div
            animate={{ y: [-60, 60, -60] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
            className="absolute left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.9)] top-1/2"
          />
        </div>
        <p className="mt-3 text-orange-500 text-[9px] font-bold tracking-widest animate-pulse">
          AGUARDANDO QR CODE...
        </p>
      </div>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="absolute bottom-2 right-2 p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-colors z-20 pointer-events-auto"
      >
        <X size={14} className="text-red-500" />
      </button>
    </div>
  );
}
