# Aqlli Omborxona (Smart Warehouse)

Ombor xo'jaligini to'liq raqamlashtirish uchun mo'ljallangan veb-ilova: mahsulotlar hisobi, ishchilar boshqaruvi, kirim/chiqim operatsiyalari, shtrix-kod yorliqlarini chop etish, sektor/javon xaritasi (3D) va avtomatik zaxira nusxalash.

---

## Asosiy imkoniyatlar

| Modul | Tavsif |
|---|---|
| **Dashboard** | Real vaqtdagi statistika: mahsulotlar soni, band sig'im, so'nggi operatsiyalar |
| **Mahsulotlar** | CRUD, rasm yuklash (siqilgan WebP), shtrix-kod generatsiyasi, izlash va filtrlash |
| **Sektorlar** | Xona → javon → joy ierarxiyasi, sig'im hisobi va interaktiv 3D vizualizatsiya |
| **Ko'chirish** | Bir nechta mahsulotni boshqa sektorga sig'im tekshiruvi bilan ko'chirish |
| **Ishchilar** | Xodimlar, ularning badge/PIN identifikatorlari (SHA-256 hash) |
| **Operatsiyalar** | Kirim, chiqim va ko'chirish jurnali, izohli tarix |
| **Loglar** | Barcha harakatlar tarixi, PDF/CSV eksport |
| **Chop etish** | Termal printerlar uchun yorliqlar (asosiy format 58×40 mm, Xprinter) |
| **Skaner rejimi** | USB skaner-qurol va kamera orqali shtrix-kod o'qish |
| **Kiosk rejimi** | Planshetni bitta ilovaga qulflash, chiqish faqat PIN orqali |
| **Zaxira** | Kunlik avtomatik ZIP zaxira va uni elektron pochtaga yuborish, ZIP'dan tiklash |
| **Litsenziya** | Muddatli foydalanish nazorati (server tomonda RLS bilan majburlangan) |

---

## Texnologiyalar

**Frontend**
- React 18 + TypeScript + Vite 5
- Tailwind CSS 3 + shadcn/ui (Radix primitives)
- React Router, TanStack Query
- three.js / @react-three/fiber — 3D sektor xaritasi
- JsBarcode, jsPDF, JSZip

**Backend**
- PostgreSQL (Supabase) — Row Level Security barcha jadvallarda
- Deno Edge Functions — serverless biznes-mantiq
- Cloudflare R2 (S3-mos, SigV4 imzo) — mahsulot rasmlari uchun tashqi obyekt ombori

---

## Loyiha tuzilmasi

```text
src/
  components/        UI komponentlari (layout, skaner, yorliq dialoglari, 3D rack)
  pages/             Sahifalar: Dashboard, Products, Sectors, Transfer, Workers, Operations, Logs, Settings
  contexts/          AuthContext — sessiya va rollar
  hooks/             useKioskMode, useScannerMode, useSoundFeedback
  utils/             printLabel, compressImage, r2, backup, exportLogs, sectorCapacity
  integrations/      ma'lumotlar bazasi klienti va tiplari
supabase/
  functions/         Edge Functions (backup, rasm proxy, ishchi autentifikatsiyasi va h.k.)
```

---

## Xavfsizlik yondashuvi

- **Rollar alohida jadvalda** (`user_roles`) saqlanadi — profil jadvalida emas, shu bois imtiyozni oshirish (privilege escalation) mumkin emas.
- Barcha yozuv amallari `security definer` funksiyalar va RLS siyosatlari orqali tekshiriladi; anonim rolga yozish ruxsati yo'q.
- Ishchi PIN va badge kodlari faqat **SHA-256 hash** ko'rinishida saqlanadi va faqat server tomonda solishtiriladi.
- Ishchi seansi imzolangan **HS256 JWT** token orqali yuritiladi.
- Mahsulot rasmlari public bucketda emas — server proxy orqali beriladi.
- Maxfiy kalitlar (`R2_*`, backup token, SMTP/gateway kalitlari) faqat server muhit o'zgaruvchilarida.

---

## Ishga tushirish

```bash
# 1. Bog'liqliklar
npm install

# 2. Muhit o'zgaruvchilari
cp .env.example .env   # va qiymatlarni to'ldiring

# 3. Dev server
npm run dev            # http://localhost:8080

# 4. Production build
npm run build && npm run preview

# 5. Testlar / lint
npm test
npm run lint
```

### Muhit o'zgaruvchilari (frontend)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

Server tomondagi maxfiy kalitlar (`R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`, `BACKUP_CRON_TOKEN`, ...) `.env` faylida emas, deploy muhitining secret'larida saqlanadi.

---

## PWA

Ilova `manifest.json` bilan PWA sifatida o'rnatiladi: planshet yoki telefon ekraniga qo'shilib, standalone rejimda ishlaydi. Kiosk rejimi bilan birga korxona planshetlarida to'liq ekranli terminal sifatida foydalaniladi.

---

## Litsenziya

Ushbu kod BAHT TEXTILE uchun ishlab chiqilgan bo'lib, mualliflik huquqi egasiga tegishli.
