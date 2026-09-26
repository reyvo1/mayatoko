'use client';

import { useEffect, useRef, useState } from 'react';
import { Inbox, Plus, AlertTriangle, Loader2 } from 'lucide-react';

export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <>{format ? format(display) : Math.round(display).toLocaleString('id-ID')}</>;
}

export function Panel({ eyebrow, title, badge, children }: { eyebrow: string; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="panel panelHover group rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(15,23,42,0.09)] sm:p-6">
      <div className="panelTitle mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div><span className="eyebrow text-[9px] font-bold uppercase tracking-[0.16em] text-sky-600">{eyebrow}</span><h2 className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-900">{title}</h2></div>
        {badge && <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-600">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

export function Skeleton({ rows = 4, style }: { rows?: number; style?: React.CSSProperties }) {
  return (
    <div className="skeletonStack space-y-2.5" style={style} aria-busy="true" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`skeletonRow h-10 animate-pulse rounded-xl bg-slate-100 ${i % 3 === 0 ? 'wide w-full' : i % 3 === 1 ? 'mid w-4/5' : 'short w-3/5'}`} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="tr grid min-w-0 grid-cols-[2fr_1fr_1fr] gap-3 border-b border-slate-100 px-4 py-3 last:border-0" key={i}>
          <div className="skeletonBar h-3 w-[70%] animate-pulse rounded-full bg-slate-100" />
          <div className="skeletonBar h-3 w-[45%] animate-pulse rounded-full bg-slate-100" />
          <div className="skeletonBar h-3 w-[30%] animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function SpinnerLine({ text }: { text?: string }) {
  return <div className="spinnerLine flex items-center gap-2 text-xs font-medium text-slate-500"><Loader2 size={16} className="spinIcon animate-spin text-sky-500" /> {text ?? 'Memuat...'}</div>;
}

export function EmptyState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void; }) {
  return (
    <div className="emptyState fadeSlideIn grid min-h-48 place-items-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
      <div>
        <div className="emptyIcon mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm"><Inbox size={24} strokeWidth={1.6} /></div>
        <h4 className="mt-4 text-sm font-semibold text-slate-800">{title}</h4>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-500">{description}</p>
        {actionLabel && onAction && <button type="button" className="emptyCta mx-auto mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800" onClick={onAction}><Plus size={15} /> {actionLabel}</button>}
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="emptyState errorState fadeSlideIn grid min-h-48 place-items-center rounded-[22px] border border-rose-200 bg-rose-50/70 px-6 py-10 text-center">
      <div><div className="emptyIcon err mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-rose-200 bg-white text-rose-500 shadow-sm"><AlertTriangle size={24} strokeWidth={1.6} /></div><h4 className="mt-4 text-sm font-semibold text-rose-900">Terjadi kendala</h4><p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-rose-700">{message}</p></div>
    </div>
  );
}

export function Table({ head, rows, empty, title, loading }: { head: string[]; rows: React.ReactNode[][]; empty?: string; title?: string; loading?: boolean; }) {
  if (loading) return <TableSkeleton rows={5} />;
  if (!rows.length) return <EmptyState title={empty ?? 'Belum ada data.'} description={title ? `Data untuk "${title}" akan muncul di sini begitu tersedia.` : 'Tambahkan data baru untuk mulai menggunakan bagian ini.'} />;
  return (
    <div className="table overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      <div className="tr th grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500" style={{ gridTemplateColumns: `repeat(${head.length}, minmax(0, 1fr))` }}>{head.map((h) => <span key={h}>{h}</span>)}</div>
      {rows.map((row, i) => <div className="tr rowFade grid gap-3 border-b border-slate-100 px-4 py-3 text-xs text-slate-600 transition-colors last:border-0 hover:bg-sky-50/40" key={i} style={{ gridTemplateColumns: `repeat(${head.length}, minmax(0, 1fr))`, animationDelay: `${Math.min(i * 40, 320)}ms` }}>{row.map((cell, j) => <span className="min-w-0" key={j}>{cell}</span>)}</div>)}
    </div>
  );
}

const STATUS_MAP: Record<string, { tone: 'ok' | 'warn' | 'err' | 'info'; label?: string }> = {
  AKTIF: { tone: 'ok' }, ACTIVE: { tone: 'ok' }, ON: { tone: 'ok' }, SENT: { tone: 'ok' }, COMPLETED: { tone: 'ok' }, APPROVED: { tone: 'ok' }, PAID: { tone: 'ok' },
  NONAKTIF: { tone: 'warn' }, INACTIVE: { tone: 'warn' }, OFF: { tone: 'warn' }, PENDING: { tone: 'warn' }, DRAFT: { tone: 'warn' }, PROCESSING: { tone: 'warn' },
  CANCELLED: { tone: 'err' }, REJECTED: { tone: 'err' }, FAILED: { tone: 'err' }, CORE: { tone: 'info' },
};

export function StatusChip({ status }: { status: string }) {
  const meta = STATUS_MAP[status.toUpperCase()] ?? { tone: 'info' as const };
  const tone = meta.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : meta.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-700' : meta.tone === 'err' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-sky-200 bg-sky-50 text-sky-700';
  return <span className={`statusChip ${meta.tone} inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}><span className="statusDot h-1.5 w-1.5 rounded-full bg-current opacity-70" />{meta.label ?? status}</span>;
}

export function rupiah(v: number | string) {
  const n = Number(v);
  if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2)} M`;
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export function tanggal(v: string | Date) {
  return new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
