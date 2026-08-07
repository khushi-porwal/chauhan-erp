import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Search, X, CheckCircle, Barcode, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { productApi } from '../api/index.js';

export default function BarcodeScannerModal({ isOpen, onClose, onScanSuccess, title = "Barcode Scanner" }) {
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setManualCode('');
      setLastScanned(null);
    }
  }, [isOpen]);

  const handleLookup = async (codeToLookup) => {
    const queryCode = (codeToLookup || manualCode).trim();
    if (!queryCode) {
      toast.error("Please enter or scan a barcode");
      return;
    }

    setLoading(true);
    try {
      const res = await productApi.lookupByBarcode(queryCode);
      const product = res.data.data;
      setLastScanned({ product, scannedAt: new Date().toLocaleTimeString() });
      toast.success(`Found: ${product.name}`);
      
      // Audio beep feedback
      playBeep();

      if (onScanSuccess) {
        onScanSuccess(product);
      }
      setManualCode('');
    } catch (err) {
      toast.error(err.response?.data?.message || `No product found for barcode '${queryCode}'`);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      /* Audio Context may be blocked before interaction */
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLookup();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Barcode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400">Scan with USB Scanner or enter barcode/SKU manually</p>
          </div>
        </div>

        {/* Scanner Input box */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Barcode / SKU Code Input
          </label>
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Click here & scan with USB scanner..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-24 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              autoFocus
            />
            <QrCode className="w-5 h-5 text-slate-400 absolute left-3" />
            <button
              onClick={() => handleLookup()}
              disabled={loading}
              className="absolute right-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Scan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tip */}
        <div className="mb-6">
          <p className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Scanning Tip: Point USB scanner or press Enter key</span>
          </p>
        </div>

        {/* Last Scanned Result */}
        {lastScanned && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs">
              <div className="font-semibold text-emerald-300 text-sm">{lastScanned.product.name}</div>
              <div className="text-slate-300 mt-1">
                <span>SKU: {lastScanned.product.sku || 'N/A'}</span>
                <span className="mx-2">•</span>
                <span>Barcode: {lastScanned.product.barcode || 'N/A'}</span>
              </div>
              <div className="text-slate-400 mt-1 flex justify-between">
                <span>Price: ₹{lastScanned.product.salesPrice}</span>
                <span>Stock: {lastScanned.product.currentStock}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
