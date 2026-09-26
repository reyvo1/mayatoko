# UI DESIGN SYSTEM — Standar Wajib Semua Projek Rey

> Referensi riset internet (Agustus 2026): tren dashboard SaaS terbaik — Linear, Vercel, Stripe, Supabase, Raycast, Mercury.
> Berlaku untuk SEMUA pekerjaan UI baru. Jika projek punya design system sendiri yang sudah matang → itu menang; ini standar minimum.

## Prinsip Inti (2026 trends)
1. **Progressive disclosure** — tampilkan 1 metrik utama dulu ("apakah semua aman?"), detail menyusul via drill-down. Jangan dinding data di first paint (gaya Stripe/Linear).
2. **Dark-mode-first** — desain dark theme DULU sebagai tema utama (token-based, bukan invert asal), light mode menyusul. Satu warna aksen saja, kontras ketat (gaya Raycast/Supabase).
3. **Warna = status, bukan dekorasi** — merah berarti rusak, kuning perhatian, hijau sehat. Maksimal 1 aksen + netral.
4. **Cap KPI** — maksimal 1 metrik primer + beberapa sekunder per view.
5. **AI-native surface** — ringkasan/saran AI sebagai elemen kelas satu, bukan chat widget nempel di pojok.

## Token Visual
- Font: Inter / Geist / system-ui. Ukuran: 13-14px body, 24px+ heading.
- Radius: 8-12px kartu, 6px input/button. Shadow halus ATAU border 1px (pilih satu gaya, konsisten).
- Spacing kelipatan 4px (4/8/12/16/24/32). Padding kartu 16-24px.
- Grid: max-width konten 1200-1440px, sidebar 240px collapsible.
- Dark palette dasar: bg #0B0E14, surface #131722, border rgba(255,255,255,.08), text #E6E9F0 / muted #8B93A7.
- Aksen: pilih 1 (indigo #6366F1 atau biru #3B82F6), success #22C55E, warning #F59E0B, danger #EF4444.

## Komponen Wajib Rapi
- Tabel: header sticky, zebra halus, row hover, empty state berilustrasi teks jelas.
- Form: label di atas, validasi inline, disabled state jelas.
- Loading: skeleton screen (bukan spinner polos).
- Toast untuk feedback aksi; konfirmasi modal untuk aksi destruktif.
- Chart: gunakan library konsisten (Recharts/Tremor), tooltip interaktif.

## Anti-Pattern (DILARANG)
- ❌ Gradient ungu-biru norak, glow berlebihan, emoji sebagai ikon UI
- ❌ Bootstrap default look, font Times/Arial, tabel polos tanpa style
- ❌ Alert browser native (alert()/confirm())
- ❌ Warna acak tiap halaman, spacing tidak konsisten
- ❌ Menampilkan semua data sekaligus tanpa hierarki

## Proses
Sebelum bikin UI baru: cek dulu apakah projek punya design system sendiri → ikuti itu.
Kalau tidak ada → terapkan standar file ini. Ragu referensi? cari contoh dashboard
SaaS terkini di internet sebelum coding.

## UI-P2 — Domain workspace navigation
- Domain besar memakai satu secondary navigation yang sticky dan deep-linkable.
- Secondary navigation tidak boleh digandakan dengan workspace rail/deck/context strip tambahan.
- Breadcrumb hanya dipakai bila benar-benar membantu orientasi dan tidak menggandakan judul/subnav.
- Nested route tidak boleh mengubah security boundary atau menggandakan business logic di client.

## UI-P3 POS operator workspaces
POS menggunakan flat workspace navigation: Penjualan, Shift & Kas, Retur, dan Sinkronisasi. Desktop mempertahankan cart sticky dan katalog luas; mobile menurunkan workspace menjadi grid dua kolom dan single-column transaction flow. Presentation shell tidak boleh mengubah payment/offline/security gate.


## UI-P4 Storefront

Storefront memakai sticky global header, desktop/mobile primary navigation, view context, customer-focused progressive disclosure, catalog controls, product-detail surface, dan pemisahan cart/checkout dari account/order tracking. Mobile memakai bottom navigation dan seluruh action tetap mempunyai focus/disabled semantics native.

## Employee Portal productization
Employee self-service memakai desktop sidebar + mobile grid navigation yang wrap ke viewport, page heading per workspace, progressive disclosure, status pills, responsive forms/tables, dan flat dark surfaces. Browser contract `TOKO360 HR` / `Portal Karyawan` tetap dipertahankan.

## UI-P6 — server-driven Admin surfaces
Nested Admin tabs/cards mengikuti resolved runtime surface: module aktif, identity visibility, dan UiSchema admin. Runtime override tidak boleh menciptakan action atau route baru.

## UI-P7 accessibility baseline
- Semua shell utama menyediakan `.skipLink` ke primary content.
- Semua interactive controls harus mempunyai `:focus-visible` yang jelas.
- Motion wajib menghormati `prefers-reduced-motion: reduce`.
- Untuk coarse pointer, interactive control minimum 44px.
- Navigation state aktif memakai `aria-current="page"` jika semantiknya sesuai.
- Connection/runtime status yang berubah tanpa page navigation memakai `role="status"` + `aria-live="polite"` jika relevan.

## F12R3 — Tailwind CSS v4 canonical presentation layer
- Admin, POS, Storefront, dan Employee Portal wajib memakai Tailwind CSS v4 melalui `@tailwindcss/postcss` dan `@import "tailwindcss"`.
- `globals.css` hanya boleh menjadi Tailwind theme/component layer yang terstruktur; dilarang menumpuk patch/override generasi lama di bagian bawah file.
- Canonical accent Toko360 adalah biru `#3B82F6`; status colors hanya success/warning/danger.
- Primary navigation tidak boleh membutuhkan horizontal scroll. Mobile navigation harus wrap/grid ke viewport.
- Admin hanya boleh memiliki satu primary sidebar/top navigation dan satu secondary domain navigation. Workspace rail/deck/context dekoratif yang menggandakan navigasi dilarang.
- Tabel desktop harus berada di viewport; narrow viewport mengubah row menjadi stacked labeled cells bila kolom tidak muat.
- Lucide React adalah canonical icon set untuk empat operator surfaces. Emoji/simbol teks tidak boleh dipakai sebagai ikon aksi.
- Visual acceptance harus dibuktikan oleh Browser UAT geometry matrix + screenshot artifact, bukan static CSS test saja.


## F12R4 — Full UI rebuild after operator visual rejection
- F12R3 automated green evidence tidak dianggap visual acceptance; operator review membuka kembali F12 karena struktur informasi dan usability masih gagal.
- Admin canonical information architecture adalah **satu primary sidebar + satu contextual secondary navigation + satu content surface**. `workspaceRail`, `domainDeck`, `domainContext`, statusbar dekoratif, atau layer navigasi paralel dilarang dirender.
- Top-level Admin wajib mengekspos secara eksplisit: Dashboard, Penjualan & Order, Pembelian, Persediaan, Kontrol Operasional, Produk & Master Data, Keuangan, Laporan & Analitik, HRIS & Payroll, Aset & Armada, AI & Otomasi, Integrasi & Notifikasi, Tenant & Organisasi, serta Pengaturan & Akses.
- Telegram/WhatsApp/provider configuration, notification history, AI/forecast/automation, tenant/company/branch/warehouse, user/security/API key tidak boleh tersembunyi di domain yang tidak relevan.
- Kontrol visual yang terlihat interaktif wajib mempunyai aksi nyata atau semantik non-button; tombol dekoratif/inert dilarang.
- Empat surface tetap memakai Tailwind CSS v4 + Lucide, tetapi P5 V2 mengganti flat all-dark treatment dengan layered product-specific art direction: translucent solid glass surfaces, backdrop blur, elevation/shadow, dan warna produk yang berbeda. Decorative gradient tetap dilarang, primary horizontal navigation tetap dilarang, dan accumulated override CSS lama tidak boleh kembali.
- GitHub Browser UAT wajib mengunjungi route/workspace yang tersedia pada desktop/tablet/mobile, memeriksa geometry/no-overflow, menyimpan screenshot sukses/gagal, dan tetap menjadi companion bagi source/API/provider/worker/runtime gates.
- Human Stage-20 tetap BLOCKED sampai operator menerima visual/usability hasil rebuild.


## P5 V2 — human visual rework
- Exact-source P5 V1 automated evidence passed, but human runtime video review rejected the flat, stacked, mostly-black result.
- Admin uses deep-indigo layered enterprise surfaces; POS uses teal operations; Storefront uses light premium retail; Employee Portal uses light violet self-service.
- Human acceptance evaluates hierarchy, product identity, depth, readability, responsive geometry, and whether the four products are visibly distinct.
- P6 remains blocked until V2 automation and explicit human visual acceptance both pass.
