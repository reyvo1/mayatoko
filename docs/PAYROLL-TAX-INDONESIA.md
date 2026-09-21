# Konfigurasi Payroll dan Pajak Indonesia

Toko360 menyediakan rule engine berversi dan tidak mengunci tarif pajak/iuran di source code. Untuk Indonesia, konfigurasi biasanya mencakup PPh Pasal 21, BPJS Kesehatan, dan program BPJS Ketenagakerjaan yang relevan.

Rule set seed berstatus `DRAFT` dan mencantumkan referensi PP 58/2023 serta PMK 168/2023 untuk pola TER PPh Pasal 21. Tabel tarif dan parameter resmi harus diimpor dari sumber resmi, diverifikasi, diuji, disetujui, lalu diaktifkan berdasarkan effective date.

Jangan mengubah rule set yang pernah dipakai payroll. Buat versi baru dan simpan hasil, input, calculation trace, approver, checksum, dan legal reference. Pembaruan peraturan setelah rilis harus diperlakukan sebagai migrasi konfigurasi, bukan perubahan diam-diam terhadap slip lama.

Checklist sebelum production:

- Status PTKP/tax category setiap pegawai lengkap.
- NPWP/NIK disimpan sebagai secret reference.
- Metode gross/net/gross-up disepakati.
- THR/bonus dan masa pajak terakhir diuji.
- Tarif/batas upah BPJS telah diperbarui dan disetujui.
- Hasil sistem dibandingkan dengan perhitungan tenaga pajak/payroll yang kompeten.
- Bukti potong, file pelaporan, dan integrasi resmi dibuat sebagai adapter terpisah.

## Guard aktivasi rule — 2026-09-11

Engine tidak mengaktifkan tarif PPh/BPJS dari asumsi aplikasi. Rule set baru tetap `DRAFT` sampai parameter resmi dimasukkan dan diverifikasi oleh operator yang berwenang. Approval server akan menolak rule apabila `requiresOfficialRateImport=true`, rate berada di luar 0..1, lookup/progressive band kosong atau tidak valid, program jaminan sosial tidak memiliki kode, atau terdapat versi APPROVED untuk kode yang sama dengan effective-date range yang overlap.

Perhitungan payroll selalu menyimpan calculation trace dan rule version. Jika profile/rule tidak tersedia atau tidak efektif pada periode yang dihitung, hasil menjadi `REQUIRES_REVIEW`; approval payroll kemudian diblokir. Dengan demikian sistem lebih memilih menghentikan payroll daripada menganggap pajak atau iuran bernilai nol tanpa dasar rule yang sah.

## Effective-dated profile safety

Employee tax and social-security profiles are versioned by `(employeeId, effectiveFrom)`. The payroll engine deliberately requires one profile/rule version to cover the **entire** payroll period. A profile or statutory rule that starts/ends mid-period is not silently stretched across the month; the result must remain `REQUIRES_REVIEW` until a split-period/proration workflow is explicitly implemented.

## Koreksi payroll setelah posting

Payroll yang sudah `POSTED` atau `PAID` tidak diubah. Koreksi dibuat sebagai differential adjustment run terhadap payroll sumber. Adjustment mewarisi rule set sumber kecuali operator memilih versi replacement yang sudah `APPROVED` dan valid; engine tetap tidak mengarang tarif PPh/BPJS.

Untuk kewajiban eksternal, koreksi negatif hanya dapat mengurangi bagian PPh/BPJS/potongan yang belum dibayar dan belum dicadangkan oleh settlement aktif. Draft/approval pembayaran yang akan menjadi terlalu besar setelah koreksi harus dibatalkan atau disesuaikan terlebih dahulu. Jika pembayaran ke otoritas/provider sudah terjadi, sistem fail-closed dan meminta rekonsiliasi refund/offset melalui workflow terpisah. Dengan cara ini perubahan payroll tidak dapat menghasilkan saldo kewajiban negatif atau settlement ganda secara diam-diam.
