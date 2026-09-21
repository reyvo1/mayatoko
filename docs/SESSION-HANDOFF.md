# Session / Developer Handoff

Gunakan format ini ketika pekerjaan dipindahkan ke sesi chat, akun, komputer, atau developer lain.

## 1. Baseline resmi

- Checkpoint:
- Version:
- Commit SHA/tag:
- Repository/ZIP checksum:

## 2. Work item aktif

- ID:
- Phase:
- Risk:
- Module/wave:
- Feature flag:

## 3. Yang sudah selesai

Tuliskan perubahan nyata dan file utama. Jangan menulis “sudah selesai” bila quality gate belum lulus.

## 4. Yang belum selesai

Tuliskan pekerjaan tersisa, dependency, dan blocker.

## 5. Database

- Profile yang digunakan:
- Migration terakhir:
- Seed/test data:
- Backup/restore point:
- Larangan atau data immutable:

## 6. Hasil validasi terakhir

```text
workflow:validate =
validate:repo =
test =
lint =
build =
db smoke =
PostgreSQL CI =
performance =
UAT =
```

## 7. Known issues

Cantumkan error lengkap, cara reproduksi, log yang sudah disensor, dan dampak bisnis.

## 8. Langkah pertama sesi berikutnya

Tuliskan satu langkah aman berikutnya. Sesi baru wajib membaca work item dan file terdampak sebelum membuat perubahan.

## 9. File yang harus dibawa

- Source ZIP/repository checkpoint resmi.
- `.env` yang sudah disensor atau `.env.example`.
- Backup database TEST/STAGING yang sedang dipakai.
- Backup production sebagai referensi immutable bila diperlukan.
- Migration terbaru.
- Log/diagnostik.
- Work item aktif dan handoff ini.
