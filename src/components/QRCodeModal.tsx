'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, ExternalLink, QrCode as QrIcon } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyTitle: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, partyTitle }) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined' && isOpen) {
      const url = `${window.location.origin}/`;
      QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: '#00F0FF',
          light: '#07090E',
        },
      })
        .then((dataUri) => {
          if (isMounted) {
            setCurrentUrl(url);
            setQrUrl(dataUri);
          }
        })
        .catch(console.error);
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-[#0B0D13] border border-cyan-500/40 p-6 shadow-[0_0_50px_rgba(0,240,255,0.25)] text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-3">
          <QrIcon className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold tracking-tight text-white font-mono">SCAN TO REQUEST</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-6">{partyTitle}</p>

        {qrUrl ? (
          <div className="mx-auto inline-block p-3 rounded-xl bg-[#07090E] border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
            <img src={qrUrl} alt="Party QR Code" className="w-64 h-64 mx-auto rounded-lg" />
          </div>
        ) : (
          <div className="w-64 h-64 mx-auto flex items-center justify-center bg-zinc-900 rounded-lg text-zinc-500 font-mono text-xs">
            GENERATING QR CODE...
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={copyToClipboard}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-xs font-mono text-zinc-200 flex items-center justify-center gap-2 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'LINK COPIED!' : 'COPY PARTY LINK'}
          </button>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-mono text-cyan-300 flex items-center justify-center gap-2 transition"
          >
            <ExternalLink className="w-4 h-4" />
            OPEN AUDIENCE APP
          </a>
        </div>
      </div>
    </div>
  );
};
