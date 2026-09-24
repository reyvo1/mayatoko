'use client';

import { BarSeriesChart, LineSeriesChart, ShareBars } from './charts';

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

export default function AnalyticsWidgets({ data }: { data: Analytics | null }) {
  if (!data) return null;
  const trend = data.salesTrend;
  const totalRevenue = trend.reduce((sum, point) => sum + point.revenue, 0);
  const cashFlow = data.cashFlow.slice(-15);

  return (
    <>
      <section className="panel">
        <div className="panelTitle">
          <div><span className="eyebrow">ANALYTICS · 30 HARI</span><h2>Penjualan &amp; laba kotor</h2></div>
          <span>Total {rupiah(totalRevenue)}</span>
        </div>
        <LineSeriesChart
          data={trend.map((point) => ({ label: point.date, primary: point.revenue, secondary: point.profit }))}
          primaryLabel="Penjualan"
          secondaryLabel="Laba kotor"
          valueLabel={rupiah}
        />
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="panelTitle"><div><span className="eyebrow">CHANNEL</span><h2>Penjualan per channel</h2></div></div>
          <ShareBars items={data.channels.map((channel) => ({ label: channel.channel, value: channel.revenue }))} valueLabel={rupiah} />
        </div>
        <div className="panel">
          <div className="panelTitle"><div><span className="eyebrow">ARUS KAS</span><h2>Kas masuk 30 hari</h2></div></div>
          <BarSeriesChart data={cashFlow.map((point) => ({ label: point.date.slice(5), value: point.cashIn }))} totalLabel={`Total kas masuk ${rupiah(data.cashFlow.reduce((sum, point) => sum + point.cashIn, 0))}`} />
        </div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="panelTitle"><div><span className="eyebrow">PRODUK</span><h2>Top produk terlaris</h2></div></div>
          <div className="table">
            <div className="tr th"><span>Produk</span><span>Qty</span><span>Pendapatan</span></div>
            {data.topProducts.map((product) => (
              <div className="tr" key={product.sku}><span><strong>{product.name}</strong><small>{product.sku}</small></span><span>{product.quantity}</span><span>{rupiah(product.revenue)}</span></div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panelTitle"><div><span className="eyebrow">PERHATIAN</span><h2>Stok menipis</h2></div><span>{data.lowStock.filter((row) => row.available <= row.minStock).length} item kritis</span></div>
          <div className="table">
            <div className="tr th"><span>Produk</span><span>Gudang</span><span>Tersedia</span></div>
            {data.lowStock.map((row, index) => (
              <div className="tr" key={`${row.name}-${index}`}><span><strong>{row.name}</strong></span><span>{row.warehouse}</span><span className={row.available <= row.minStock ? 'danger' : ''}>{row.available}</span></div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
