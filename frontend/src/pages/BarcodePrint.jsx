import { useState, useEffect, useCallback, useRef } from 'react';
import { Barcode, Printer, Search, Plus, Minus, X, Download, Package } from 'lucide-react';
import { productApi, m1Api } from '../api/index.js';

// EAN-13 checksum calculator
function calcEan13Checksum(code12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

// Simple SVG barcode renderer for EAN-13 & Generic barcodes
function BarcodeDisplay({ barcode, productName, price, showPrice }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (!barcodeRef.current || !barcode) return;
    barcodeRef.current.innerHTML = '';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    const barWidth = 2;
    const height = 60;

    // Check if EAN-13 standard format (13 digits)
    if (barcode.length === 13 && /^\d+$/.test(barcode)) {
      const L_CODE = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
      const G_CODE = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
      const R_CODE = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
      const FIRST_DIGIT_ENCODING = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

      const firstDigit = parseInt(barcode[0]);
      const encoding = FIRST_DIGIT_ENCODING[firstDigit];

      let bars = '101';
      for (let i = 0; i < 6; i++) {
        const digit = parseInt(barcode[i + 1]);
        bars += encoding[i] === 'L' ? L_CODE[digit] : G_CODE[digit];
      }
      bars += '01010';
      for (let i = 7; i < 13; i++) {
        bars += R_CODE[parseInt(barcode[i])];
      }
      bars += '101';

      const totalWidth = bars.length * barWidth;
      svg.setAttribute('width', totalWidth);
      svg.setAttribute('height', height + 20);
      svg.setAttribute('viewBox', `0 0 ${totalWidth} ${height + 20}`);

      for (let i = 0; i < bars.length; i++) {
        if (bars[i] === '1') {
          const rect = document.createElementNS(svgNS, 'rect');
          rect.setAttribute('x', i * barWidth);
          rect.setAttribute('y', 0);
          rect.setAttribute('width', barWidth);
          rect.setAttribute('height', height);
          rect.setAttribute('fill', 'black');
          svg.appendChild(rect);
        }
      }

      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', totalWidth / 2);
      text.setAttribute('y', height + 14);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'monospace');
      text.textContent = barcode;
      svg.appendChild(text);
    } else {
      // Generic Code 128 style fallback for non-EAN13 barcodes
      let binaryStr = '101000';
      for (let i = 0; i < barcode.length; i++) {
        const code = barcode.charCodeAt(i);
        const pattern = (code * 131).toString(2).padStart(7, '0');
        binaryStr += pattern + '0';
      }
      binaryStr += '101';

      const totalWidth = Math.max(140, binaryStr.length * barWidth);
      svg.setAttribute('width', totalWidth);
      svg.setAttribute('height', height + 20);
      svg.setAttribute('viewBox', `0 0 ${totalWidth} ${height + 20}`);

      for (let i = 0; i < binaryStr.length; i++) {
        if (binaryStr[i] === '1') {
          const rect = document.createElementNS(svgNS, 'rect');
          rect.setAttribute('x', i * barWidth);
          rect.setAttribute('y', 0);
          rect.setAttribute('width', barWidth);
          rect.setAttribute('height', height);
          rect.setAttribute('fill', 'black');
          svg.appendChild(rect);
        }
      }

      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', totalWidth / 2);
      text.setAttribute('y', height + 14);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'monospace');
      text.textContent = barcode;
      svg.appendChild(text);
    }

    barcodeRef.current.appendChild(svg);
  }, [barcode]);

  return (
    <div className="flex flex-col items-center p-3 border border-gray-300 rounded-lg bg-white shadow-xs" style={{ minWidth: '160px' }}>
      <p className="text-xs font-semibold text-gray-700 text-center truncate w-full mb-1" title={productName}>
        {productName}
      </p>
      <div ref={barcodeRef} className="flex items-center justify-center" />
      {showPrice && price !== undefined && price !== null && (
        <p className="text-xs font-bold text-gray-800 mt-1">₹{price}</p>
      )}
    </div>
  );
}

export default function BarcodePrint() {
  const [allProducts, setAllProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPrice, setShowPrice] = useState(true);
  const [copies, setCopies] = useState(1);
  const printRef = useRef(null);

  const fetchInitialProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productApi.getAll();
      const list = res.data?.data?.products || res.data?.data || [];
      setAllProducts(list);
      setProducts(list.slice(0, 50));
    } catch {
      setAllProducts([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialProducts();
  }, [fetchInitialProducts]);

  useEffect(() => {
    if (!search.trim()) {
      setProducts(allProducts.slice(0, 50));
    } else {
      const filtered = allProducts.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
      );
      setProducts(filtered.slice(0, 50));
    }
  }, [search, allProducts]);

  const addProduct = (product) => {
    if (!product.barcode) return;
    const exists = selectedProducts.find(p => p.id === product.id);
    if (exists) {
      setSelectedProducts(prev => prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p));
    } else {
      setSelectedProducts(prev => [...prev, { ...product, qty: 1 }]);
    }
  };

  const updateQty = (id, qty) => {
    if (qty < 1) {
      setSelectedProducts(prev => prev.filter(p => p.id !== id));
    } else {
      setSelectedProducts(prev => prev.map(p => p.id === id ? { ...p, qty } : p));
    }
  };

  const removeProduct = (id) => setSelectedProducts(prev => prev.filter(p => p.id !== id));

  const totalLabels = selectedProducts.reduce((sum, p) => sum + p.qty, 0) * copies;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            body { margin: 0; padding: 8px; font-family: sans-serif; }
            .print-grid { display: flex; flex-wrap: wrap; gap: 8px; }
            .label { border: 1px solid #ccc; border-radius: 4px; padding: 8px; text-align: center; min-width: 160px; page-break-inside: avoid; }
            .label p { margin: 0 0 4px; font-size: 11px; font-weight: 600; }
            .price { font-size: 12px; font-weight: bold; }
            @media print { @page { margin: 10mm; } }
          </style>
        </head>
        <body>
          <div class="print-grid">${printContent.innerHTML}</div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
  };

  // Build print items (expanded by qty and copies)
  const printItems = selectedProducts.flatMap(p =>
    Array.from({ length: p.qty * copies }, () => p)
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Barcode className="w-7 h-7 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Barcode Print Engine</h1>
            <p className="text-sm text-gray-500">Generate and print EAN-13 barcodes for products</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Search */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Select Products</h2>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, SKU, or barcode..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>

            {loading && (
              <div className="text-center text-gray-400 py-4 text-sm">Searching...</div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {products.map(product => (
                <div
                  key={product.id}
                  onClick={() => addProduct(product)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    product.barcode
                      ? 'border-gray-100 hover:border-purple-300 hover:bg-purple-50'
                      : 'border-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                  title={!product.barcode ? 'No barcode assigned' : ''}
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    {product.images?.[0]?.url ? (
                      <img src={product.images[0].url} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Package className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                    <p className="text-xs text-gray-400">{product.barcode || 'No barcode'}</p>
                  </div>
                  <Plus className="w-4 h-4 text-purple-500 shrink-0" />
                </div>
              ))}
              {!loading && search.length >= 2 && products.length === 0 && (
                <div className="text-center text-gray-400 py-4 text-sm">No products found</div>
              )}
              {!search && (
                <div className="text-center text-gray-400 py-6 text-sm">
                  Start typing to search for products
                </div>
              )}
            </div>
          </div>

          {/* Print Settings */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Print Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Copies per label</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCopies(c => Math.max(1, c - 1))}
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-bold text-gray-800 min-w-8 text-center">{copies}</span>
                  <button
                    onClick={() => setCopies(c => Math.min(10, c + 1))}
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setShowPrice(v => !v)}
                  className={`w-12 h-6 rounded-full transition-all ${showPrice ? 'bg-purple-600' : 'bg-gray-300'} relative`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${showPrice ? 'left-6' : 'left-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Show price on label</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right: Selected Products + Preview */}
        <div className="lg:col-span-2 space-y-4">
          {/* Selected List */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                Print Queue
                {selectedProducts.length > 0 && (
                  <span className="ml-2 text-sm text-gray-400">({totalLabels} labels total)</span>
                )}
              </h2>
              {selectedProducts.length > 0 && (
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
                >
                  <Printer className="w-4 h-4" />
                  Print Labels
                </button>
              )}
            </div>

            {selectedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                <Barcode className="w-10 h-10 text-gray-300" />
                <p className="text-sm">Search and add products to print queue</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedProducts.map(product => (
                  <div key={product.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{product.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{product.barcode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(product.id, product.qty - 1)}
                        className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-bold text-gray-800">{product.qty}</span>
                      <button
                        onClick={() => updateQty(product.id, product.qty + 1)}
                        className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeProduct(product.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          {selectedProducts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">
                Print Preview
                <span className="text-sm font-normal text-gray-400 ml-2">({printItems.length} labels)</span>
              </h2>
              <div
                ref={printRef}
                className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 max-h-96 overflow-y-auto"
              >
                {printItems.map((product, idx) => (
                  <BarcodeDisplay
                    key={`${product.id}-${idx}`}
                    barcode={product.barcode}
                    productName={product.name}
                    price={product.salesPrice || product.mrp}
                    showPrice={showPrice}
                  />
                ))}
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
                >
                  <Printer className="w-4 h-4" />
                  Print {printItems.length} Labels
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
