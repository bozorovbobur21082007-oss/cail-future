## Maqsad

Hozir har "sektor" = bitta javon. Yangi mantiq: **Sektor (Xona)** ichida bir nechta **Shkaf** bo'ladi. Shkaf — bu rows×columns×levels o'lchamga ega haqiqiy javon. Mahsulotlar xonaga biriktiriladi, aniq joyi esa shkaf + L/C/R bilan belgilanadi.

## Yangi tuzilma

```text
Sektor (Xona: "Sklad A", "Sovutgich xona"…)
├── Shkaf 1  (rows × columns × levels)
├── Shkaf 2
└── Shkaf N
        └── Slot (level, column, row) ← mahsulot joylashuvi
```

## Bajariladigan ishlar

### 1) Baza (1 ta migratsiya)
- Yangi `shelves` jadvali: `sector_id`, `name`, `code`, `rows`, `columns`, `levels`, `capacity` (avtomatik), `width_cm`, `depth_cm`, `height_cm`, `position_x`, `position_y` (xona ichida), `orientation`.
- Trigger `sync_shelf_capacity` (capacity = rows×cols×levels).
- `product_placements` ga `shelf_id` ustuni qo'shiladi (FK).
- **Avtomatik migratsiya:** Har bir mavjud sektor uchun "Asosiy shkaf" yaratiladi (sektorning hozirgi rows/cols/levels/o'lchamlari bilan). Mavjud placements shu yangi shkafga bog'lanadi.
- `sectors` jadvalidan rows/columns/levels/capacity/dimensions ustunlari olib tashlanadi (xona endi faqat joy/o'lchov konteyneri). `position_x/y`, `orientation` qoladi (omborda xonaning joyi). Eski capacity trigger o'chiriladi.
- RLS/GRANT: `shelves` uchun mavjud sectors qoidalariga mos siyosatlar (admin to'liq, anon SELECT — ishchi xaritasi uchun).

### 2) Yordamchi modullar
- `src/utils/sectorCapacity.ts` → endi xona bo'yicha barcha shkaflar yig'indisini hisoblaydi. Qo'shimcha `checkShelfCapacity(shelfId, delta)` funksiyasi.
- `src/utils/findProductSlot.ts` (mavjud bo'lsa) shelf_id bilan ishlaydi.

### 3) Admin: Sektorlar sahifasi (`SectorsPage.tsx`)
- "Yangi sektor" formasi soddalashadi: nomi, kodi, xona o'lchami (m²), xaritadagi joyi.
- Sektor kartochkasi: shkaflar soni, umumiy sig'im, band/bo'sh.
- Sektor tafsiloti dialogi:
  - **Xona xaritasi**: shkaflarni position_x/y bo'yicha plan ko'rinishida (top-down) ko'rsatadi, bo'sh/band foiziga qarab rang.
  - Shkaf ustiga bossangiz — hozirgi `SectorRack3D` ochiladi (faqat shkaf ma'lumotlari bilan).
  - "Yangi shkaf" tugmasi → shkaf CRUD dialogi (rows/cols/levels/dimensions/pozitsiya).
  - Shkafni tahrirlash/o'chirish (band slotlardan kam qila olmaslik tekshiruvi).

### 4) Ishchi: Ko'ruvchi (`SectorsViewer.tsx`)
- Bir xil xona xaritasi (read-only), shkaf bosilganda 3D ko'rinish.
- Qidiruv (nom/kod/QR/RFID): natija topilsa → tegishli xona + shkaf + L/C/R qizil belgi bilan.

### 5) Mahsulotlar, Ko'chirish, Operatsiyalar
- `ProductsPage`: "Sektor" tanlovi (xona) — o'zgarishsiz. Sig'im tekshiruvi xona darajasida (barcha shkaflar yig'indisi).
- `TransferPage`: manba/maqsad — xona. Yangi xona to'lib qolsa, xato.
- `OperationsPage`: IN sig'imni xona bo'yicha tekshiradi.
- Aniq slot tanlash (joylashtirish dialogi) endi avval shkafni so'raydi, keyin L/C/R.

### 6) Joylashtirish dialogi
- Shkaf tanlash dropdown (xona ichidagi shkaflar ro'yxati) qo'shiladi.
- L/C/R inputlari tanlangan shkafning chegaralariga bo'ysunadi.

## Texnik nuanslar

- `sectors` jadval nomi saqlanadi (kod minimal o'zgaradi). UI da "Xona" deb yoziladi.
- `product_placements.shelf_id` NOT NULL bo'ladi migratsiyadan keyin (eskilari yangi "Asosiy shkaf"ga ko'chiriladi).
- Sig'im va "joy qolmagan" xatolari xona = Σ(shkaflar) bo'yicha hisoblanadi, lekin aniq slot uchun shkaf chegarasi ishlaydi.
- 3D komponenti (`SectorRack3D`) o'zgarmaydi — endi unga sektor o'rniga shkaf ma'lumotlari uzatiladi.
- A4 chop etish va boshqa yordamchi joylar ta'sirlanmaydi.

## Migratsiya xavfsizligi

- Eski sektorlardagi rows/cols/levels yo'qolmaydi — to'g'ridan-to'g'ri "Asosiy shkaf" ga o'tadi.
- Mavjud `product_placements` yo'qolmaydi — shelf_id avtomatik to'ldiriladi.
- Mahsulotlarning sector_id si o'zgarmaydi.
