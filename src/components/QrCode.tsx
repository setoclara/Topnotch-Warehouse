"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrCode({
  value,
  size = 160,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    // Resolve site-relative paths ("/items/…") to a full, scannable URL.
    const resolved = value.startsWith("/")
      ? window.location.origin + value
      : value;
    // Render at higher resolution than displayed so small printed labels stay crisp.
    QRCode.toDataURL(resolved, {
      width: Math.max(size * 3, 320),
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    // QR codes are generated data URLs — next/image can't optimize these.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="QR code"
      width={size}
      height={size}
      className={className}
    />
  );
}
