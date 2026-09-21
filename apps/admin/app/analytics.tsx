'use client';
// Widget analytics untuk dashboard admin: trend 30 hari, donut channel, arus kas, top produk, stok menipis.
// Tanpa dependency chart eksternal — SVG murni agar ringan.

type Analytics = {
  salesTrend: Array<{ date: string; revenue: number; profit: number; transactions: number }>;
  channels: Array<{ channel: string; revenue: number }>;
  cashFlow: Array<{ date: string; cashIn: number }>;
  topProducts: Array<{ name: string; sku: string; quantity: number; revenue: number }>;
  lowStock: Array<{ name: string; warehouse: string; available: number; minStock: number }>;
};

function rupiah(value: number) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(2)} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`;
  return `Rp ${value}`;
}

const CHANNEL_COLORS: Record<string, string> = {
  RETAIL: '#2563eb',
  STOREFRONT: '#8b5cf6',
  MARKETPLACE: '#f59e0b',
  WHOLESALE: '#10b981',
};

export default function AnalyticsWidgets({ data }: { data: Analytics | null }) {
  if (!data) return null;
  const trend = data.salesTrend;
  const maxRevenue = Math.max(1, ...trend.map((d) => d.revenue));
  const totalChannel = Math.max(1, data.channels.reduce((sum, c) => sum + c.revenue, 0));
  const maxCash = Math.max(1, ...data.cashFlow.map((d) => d.cashIn));

  // path garis SVG
  const W = 560, H = 160, PAD = 6;
  const point = (i: number, v: number, max: number) => {
    const x = PAD + (i * (W - PAD * 2)) / Math.max(1, trend.length - 1);
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const linePath = (key: 'revenue' | 'profit') =>
    trend.map((d, i) => `${i === 0 ? 'M' : 'L'}${point(i, d[key], maxRevenue)}`).join(' ');
  const areaPath = `${linePath('revenue')} L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;

  // donut
  let angleAcc = -Math.PI / 2;
  const donutSegments = data.channels.map((c) => {
    const frac = c.revenue / totalChannel;
    const start = angleAcc;
    const end = angleAcc + frac * Math.PI * 2;
    angleAcc = end;
    const large = end - start > Math.PI ? 1 : 0;
    const r = 54, cx = 70, cy = 70;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    return { color: CHANNEL_COLORS[c.channel] ?? '#94a3b8', d: `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`, label: c.channel, value: c.revenue, pct: Math.round(frac * 100) };
  });

  return (
    <>
      <section className="panel">
        <div className="panelTitle"><div><span className="eyebrow">ANALYTICS · 30 HARI</span><h2>Grafik Penjualan &amp; Laba Kotor</h2></div>
          <span>Total {rupiah(trend.reduce((s, d) => s + d.revenue, 0))}</span></div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180 }}>
          <path d={areaPath} fill="rgba(37,99,235,0.12)" />
          <path d={linePath('revenue')} fill="none" stroke="#2563eb" strokeWidth="2" />
          <path d={linePath('profit')} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="4 3" />
        </svg>
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <span><span style={{ color: '#2563eb' }}>●</span> Penjualan</span>
          <span><span style={{ color: '#8b5cf6' }}>●</span> Laba kotor</span>
          <span style={{ marginLeft: 'auto', color: '#64748b' }}>{trend[0]?.date} → {trend[trend.length - 1]?.date}</span>
        </div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="panelTitle"><div><span className="eyebrow">CHANNEL</span><h2>Penjualan per Channel</h2></div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <svg viewBox="0 0 140 140" style={{ width: 140, height: 140 }}>
              {donutSegments.map((seg) => <path key={seg.label} d={seg.d} fill={seg.color} />)}
              <circle cx="70" cy="70" r="34" fill="#fff" />
              <text x="70" y="74" textAnchor="middle" fontSize="11" fill="#334155">{rupiah(totalChannel)}</text>
            </svg>
            <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              {donutSegments.map((seg) => (
                <span key={seg.label}><span style={{ color: seg.color }}>■</span> {seg.label}: <strong>{seg.pct}%</strong> ({rupiah(seg.value)})</span>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panelTitle"><div><span className="eyebrow">ARUS KAS</span><h2>Kas Masuk 30 Hari</h2></div></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
            {data.cashFlow.slice(-15).map((d) => (
              <div key={d.date} title={`${d.date}: ${rupiah(d.cashIn)}`} style={{ flex: 1, background: 'linear-gradient(#10b981,#059669)', height: `${(d.cashIn / maxCash) * 100}%`, minHeight: 4, borderRadius: 3 }} />
            ))}
          </div>
          <small style={{ color: '#64748b' }}>Total kas masuk {rupiah(data.cashFlow.reduce((s, d) => s + d.cashIn, 0))}</small>
        </div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="panelTitle"><div><span className="eyebrow">PRODUK</span><h2>Top Produk Terlaris</h2></div></div>
          <div className="table"><div className="tr th"><span>Produk</span><span>Qty</span><span>Pendapatan</span></div>
            {data.topProducts.map((p) => (
              <div className="tr" key={p.sku}><span><strong>{p.name}</strong><small>{p.sku}</small></span><span>{p.quantity}</span><span>{rupiah(p.revenue)}</span></div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panelTitle"><div><span className="eyebrow">PERHATIAN</span><h2>Stok Menipis</h2></div><span>{data.lowStock.filter((r) => r.available <= r.minStock).length} item kritis</span></div>
          <div className="table"><div className="tr th"><span>Produk</span><span>Gudang</span><span>Tersedia</span></div>
            {data.lowStock.map((r, i) => (
              <div className="tr" key={i}><span><strong>{r.name}</strong></span><span>{r.warehouse}</span><span className={r.available <= r.minStock ? 'danger' : ''}>{r.available}</span></div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
