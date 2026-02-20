'use client';

import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 200, className = '' }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCodeLib.toDataURL(value, {
      width: size,
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
    })
      .then(setDataUrl)
      .catch(console.error);
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={`bg-white/10 rounded-xl animate-pulse ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div className={`qr-container ${className}`}>
      <img src={dataUrl} alt="QR Code" width={size} height={size} />
    </div>
  );
}
