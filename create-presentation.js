const PptxGenJS = require("pptxgenjs");
const fs = require("fs");

// === Design Tokens ===
const C = {
  primary: "2563EB",      // blue-600
  primaryDark: "1D4ED8",  // blue-700
  accent: "3B82F6",       // blue-500
  dark: "0F172A",         // slate-900
  text: "1E293B",         // slate-800
  muted: "64748B",        // slate-500
  light: "F1F5F9",        // slate-100
  white: "FFFFFF",
  green: "22C55E",
  amber: "F59E0B",
  red: "EF4444",
  teal: "14B8A6",
};

const F = {
  title: { fontFace: "Arial", fontSize: 44, bold: true, color: C.white },
  subtitle: { fontFace: "Arial", fontSize: 24, color: C.white },
  heading: { fontFace: "Arial", fontSize: 32, bold: true, color: C.text },
  body: { fontFace: "Arial", fontSize: 18, color: C.text },
  bodyLg: { fontFace: "Arial", fontSize: 22, color: C.text },
  caption: { fontFace: "Arial", fontSize: 14, color: C.muted },
  stat: { fontFace: "Arial", fontSize: 56, bold: true, color: C.primary },
  statLabel: { fontFace: "Arial", fontSize: 16, color: C.muted },
  featureTitle: { fontFace: "Arial", fontSize: 20, bold: true, color: C.text },
  featureBody: { fontFace: "Arial", fontSize: 15, color: C.muted },
  badge: { fontFace: "Arial", fontSize: 13, bold: true, color: C.primary },
  tech: { fontFace: "Arial", fontSize: 16, bold: true, color: C.text },
  footer: { fontFace: "Arial", fontSize: 12, color: C.muted },
};

function makeShadow() {
  return { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.12 };
}

function makeShadowLight() {
  return { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.08 };
}

const pres = new PptxGenJS();
pres.layout = "LAYOUT_16x9";
pres.author = "Aqlli Omborxona";
pres.title = "Aqlli Omborxona - Prezentatsiya";
pres.subject = "Smart Warehouse Management System";

// ============================================================
// SLIDE 1: Title
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.dark };

  // Decorative accent bar at top
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.08,
    fill: { color: C.primary },
  });

  // Large background circle
  slide.addShape(pres.shapes.OVAL, {
    x: 6.5, y: 1.5, w: 4, h: 4,
    fill: { color: C.primary, transparency: 85 },
  });
  slide.addShape(pres.shapes.OVAL, {
    x: -1, y: 3.5, w: 3, h: 3,
    fill: { color: C.accent, transparency: 90 },
  });

  // Title
  slide.addText("Aqlli Omborxona", {
    x: 0.8, y: 1.6, w: 8, h: 1,
    ...F.title,
    fontSize: 52,
  });

  // Subtitle
  slide.addText("Zamonaviy ombor boshqaruv tizimi", {
    x: 0.8, y: 2.55, w: 8, h: 0.6,
    ...F.subtitle,
    color: C.accent,
  });

  // Description
  slide.addText(
    "Mahsulotlarni 3D xaritada kuzatish, QR/Barcode va NFC skanerlash, avtomatlashtirilgan kirim-chiqim va real vaqt analitikasi — barchasi bitta platformada.",
    {
      x: 0.8, y: 3.3, w: 7, h: 1.2,
      fontFace: "Arial", fontSize: 18, color: "94A3B8",
      lineSpacing: 28,
    }
  );

  // Bottom tag
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 4.6, w: 2.8, h: 0.5,
    fill: { color: C.primary },
  });
  slide.addText("Web + PWA ilova", {
    x: 0.8, y: 4.6, w: 2.8, h: 0.5,
    fontFace: "Arial", fontSize: 14, bold: true, color: C.white,
    align: "center", valign: "middle",
  });

  slide.addText("2026", {
    x: 8.5, y: 5.1, w: 1, h: 0.3,
    fontFace: "Arial", fontSize: 14, color: "64748B",
    align: "right",
  });
}

// ============================================================
// SLIDE 2: Muammo (Problem)
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };

  // Section kicker
  slide.addText("MUAMMO", {
    x: 0.7, y: 0.4, w: 3, h: 0.35,
    fontFace: "Arial", fontSize: 13, bold: true, color: C.primary,
    charSpacing: 4,
  });

  // Heading
  slide.addText("An'anaviy omborlarda nima noto'g'ri?", {
    x: 0.7, y: 0.75, w: 8.5, h: 0.7,
    ...F.heading,
  });

  // Problem cards
  const problems = [
    { icon: "01", title: "Qo'lda yozish", desc: "Mahsulot kirim-chiqimini qog'ozda yoki Excel-da kuzatish xatolarga olib keladi." },
    { icon: "02", title: "Joylashuvni bilmaslik", desc: "Mahsulot qayerda joylashganini tez topa olmaslik operatsiyalarni sekillashtiradi." },
    { icon: "03", title: "Hisobot yetishmovchiligi", desc: "Real vaqt statistikasidan mahrum bo'lish boshqaruv qarorlarini qiyinlashtiradi." },
    { icon: "04", title: "Ruxsatnoma muammolari", desc: "Ishchilar va adminlar orasidagi vazifalar aniq ajratilmagan bo'ladi." },
  ];

  problems.forEach((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.7 + col * 4.6;
    const y = 1.7 + row * 1.7;

    // Card bg
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.3, h: 1.45,
      fill: { color: C.light },
    });

    // Accent left bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h: 1.45,
      fill: { color: C.red },
    });

    // Number circle
    slide.addShape(pres.shapes.OVAL, {
      x: x + 0.3, y: y + 0.35, w: 0.55, h: 0.55,
      fill: { color: "FEE2E2" },
    });
    slide.addText(p.icon, {
      x: x + 0.3, y: y + 0.35, w: 0.55, h: 0.55,
      fontFace: "Arial", fontSize: 16, bold: true, color: C.red,
      align: "center", valign: "middle",
    });

    slide.addText(p.title, {
      x: x + 1.0, y: y + 0.3, w: 3.1, h: 0.4,
      ...F.featureTitle,
    });
    slide.addText(p.desc, {
      x: x + 1.0, y: y + 0.7, w: 3.1, h: 0.6,
      ...F.featureBody,
      fontSize: 14,
    });
  });
}

// ============================================================
// SLIDE 3: Yechim (Solution)
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };

  // Left dark panel
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 4.2, h: 5.625,
    fill: { color: C.dark },
  });

  slide.addText("YECHIM", {
    x: 0.7, y: 0.4, w: 3, h: 0.35,
    fontFace: "Arial", fontSize: 13, bold: true, color: C.accent,
    charSpacing: 4,
  });

  slide.addText("Aqlli Omborxona — barcha jarayonlarni raqamlashtiradi", {
    x: 0.7, y: 0.9, w: 3, h: 1.2,
    fontFace: "Arial", fontSize: 26, bold: true, color: C.white,
    lineSpacing: 32,
  });

  slide.addText(
    "Ushbu platforma ombor operatsiyalarini avtomatlashtirish, xatolarni kamaytirish va samaradorlikni oshirish uchun yaratilgan.",
    {
      x: 0.7, y: 2.3, w: 3, h: 1.2,
      fontFace: "Arial", fontSize: 15, color: "94A3B8",
      lineSpacing: 24,
    }
  );

  // Right side bullets
  const bullets = [
    "Mahsulotlarni 3D stelaj xaritasida ko'rish",
    "QR, Barcode va NFC orqali skanerlash",
    "Ishchilar uchun sodda kirim/chiqim interfeysi",
    "Real vaqt hisobotlari va analitika",
    "Rollar bo'yicha kirish huquqlari",
    "PWA sifatida telefonda ishlatish",
  ];

  bullets.forEach((b, i) => {
    const y = 0.8 + i * 0.7;
    // Check circle
    slide.addShape(pres.shapes.OVAL, {
      x: 4.8, y: y + 0.05, w: 0.35, h: 0.35,
      fill: { color: "DBEAFE" },
    });
    slide.addText("✓", {
      x: 4.8, y: y + 0.05, w: 0.35, h: 0.35,
      fontFace: "Arial", fontSize: 14, bold: true, color: C.primary,
      align: "center", valign: "middle",
    });
    slide.addText(b, {
      x: 5.35, y: y, w: 4.2, h: 0.5,
      fontFace: "Arial", fontSize: 18, color: C.text,
      valign: "middle",
    });
  });
}

// ============================================================
// SLIDE 4: Asosiy xususiyatlar (Key Features)
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };

  slide.addText("ASOSIY XUSUSIYATLAR", {
    x: 0.7, y: 0.4, w: 5, h: 0.35,
    fontFace: "Arial", fontSize: 13, bold: true, color: C.primary,
    charSpacing: 4,
  });

  slide.addText("Platformaning imkoniyatlari", {
    x: 0.7, y: 0.75, w: 8, h: 0.6,
    ...F.heading,
  });

  const features = [
    { color: "DBEAFE", iconColor: C.primary, icon: "📦", title: "Mahsulotlar", desc: "Nomi, kodi, NFC ID va miqdori bilan to'liq boshqaruv." },
    { color: "D1FAE5", iconColor: C.green, icon: "🏗", title: "3D Sektorlar", desc: "Stelajlarni 3D ko'rinishda joylashtirish va kuzatish." },
    { color: "FEF3C7", iconColor: C.amber, icon: "↔", title: "Kirim/Chiqim", desc: "Ishchilar uchun skanerlash orqali tez operatsiyalar." },
    { color: "E0E7FF", iconColor: "6366F1", icon: "👤", title: "Ishchilar", desc: "PIN-kod orqali kirish va rollar bo'yicha ajratish." },
    { color: "CCFBF1", iconColor: C.teal, icon: "📊", title: "Analitika", desc: "Dashboard, graflar va operatsiya loglari." },
    { color: "FCE7F3", iconColor: "EC4899", icon: "🔖", title: "Yorliqlar", desc: "QR/Barcode yorliqlarni chop etish va A4 formatda chiqarish." },
  ];

  features.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.7 + col * 3.05;
    const y = 1.6 + row * 1.85;

    // Card
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.8, h: 1.65,
      fill: { color: C.white },
      shadow: makeShadowLight(),
    });

    // Icon circle
    slide.addShape(pres.shapes.OVAL, {
      x: x + 0.2, y: y + 0.2, w: 0.55, h: 0.55,
      fill: { color: f.color },
    });
    slide.addText(f.icon, {
      x: x + 0.2, y: y + 0.2, w: 0.55, h: 0.55,
      fontFace: "Arial", fontSize: 20,
      align: "center", valign: "middle",
    });

    slide.addText(f.title, {
      x: x + 0.2, y: y + 0.85, w: 2.4, h: 0.35,
      ...F.featureTitle,
    });
    slide.addText(f.desc, {
      x: x + 0.2, y: y + 1.15, w: 2.4, h: 0.45,
      ...F.featureBody,
      fontSize: 13,
    });
  });
}

// ============================================================
// SLIDE 5: Mahsulotlar boshqaruvi
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.light };

  slide.addText("MAHSULOTLAR BOSHQARUVI", {
    x: 0.7, y: 0.4, w: 5, h: 0.35,
    fontFace: "Arial", fontSize: 13, bold: true, color: C.primary,
    charSpacing: 4,
  });

  slide.addText("Har bir mahsulot kuzatib boriladi", {
    x: 0.7, y: 0.75, w: 8, h: 0.6,
    ...F.heading,
  });

  // Three highlight blocks
  const blocks = [
    { title: "QR / Barcode", desc: "Har bir mahsulot o'ziga xos shtrix-kodga ega. Skanerlash orqali bir zumda topish." },
    { title: "NFC Nakleyka", desc: "RFID texnologiyasi yordamida mahsulotlarni sensor orqali avtomatik aniqlash." },
    { title: "A4 Chop Etish", desc: "20 ta mahsulot uchun birdaniga QR yorliq chop etish — barchasi bitta sahifada." },
  ];

  blocks.forEach((b, i) => {
    const x = 0.7 + i * 3.05;
    const y = 1.6;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.8, h: 2.2,
      fill: { color: C.white },
      shadow: makeShadowLight(),
    });

    // Top accent
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.8, h: 0.06,
      fill: { color: C.primary },
    });

    slide.addText(b.title, {
      x: x + 0.2, y: y + 0.35, w: 2.4, h: 0.4,
      fontFace: "Arial", fontSize: 20, bold: true, color: C.text,
    });
    slide.addText(b.desc, {
      x: x + 0.2, y: y + 0.85, w: 2.4, h: 1.2,
      fontFace: "Arial", fontSize: 15, color: C.muted,
      lineSpacing: 22,
    });
  });

  // Bottom note
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 4.2, w: 8.6, h: 0.9,
    fill: { color: C.white },
    shadow: makeShadowLight(),
  });
  slide.addText("💡 Mahsulot qo'shishda NFC skaner avtomatik ID ni maydonga kiritadi — qo'lda yozish shart emas.", {
    x: 1.0, y: 4.2, w: 8, h: 0.9,
    fontFace: "Arial", fontSize: 16, color: C.text,
    valign: "middle",
  });
}

// ============================================================
// SLIDE 6: 3D Ombor Xaritasi
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.dark };

  slide.addText("3D OMBOR XARITASI", {
    x: 0.7, y: 0.4, w: 5, h: 0.35,
    fontFace: "Arial", fontSize: 13, bold: true, color: C.accent,
    charSpacing: 4,
  });

  slide.addText("Stelajlarni real vaqt rejimida kuzating", {
    x: 0.7, y: 0.75, w: 8, h: 0.6,
    fontFace: "Arial", fontSize: 32, bold: true, color: C.white,
  });

  // 3D visual representation
  // Rack 1
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.7, w: 2.5, h: 3.0,
    fill: { color: "1E293B" },
    line: { color: "334155", width: 1 },
  });
  // Shelf lines
  [2.3, 2.9, 3.5, 4.1].forEach(y => {
    slide.addShape(pres.shapes.LINE, {
      x: 0.7, y, w: 2.5, h: 0,
      line: { color: "475569", width: 1 },
    });
  });
  // Boxes on shelves
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: 2.0, w: 0.6, h: 0.25, fill: { color: C.primary } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 1.7, y: 2.0, w: 0.4, h: 0.25, fill: { color: C.green } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: 2.6, w: 0.4, h: 0.25, fill: { color: C.amber } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 1.5, y: 3.2, w: 0.6, h: 0.25, fill: { color: C.primary } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: 3.8, w: 0.5, h: 0.25, fill: { color: C.teal } });

  // Rack 2
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 3.5, y: 1.7, w: 2.5, h: 3.0,
    fill: { color: "1E293B" },
    line: { color: "334155", width: 1 },
  });
  [2.3, 2.9, 3.5, 4.1].forEach(y => {
    slide.addShape(pres.shapes.LINE, {
      x: 3.5, y, w: 2.5, h: 0,
      line: { color: "475569", width: 1 },
    });
  });
  slide.addShape(pres.shapes.RECTANGLE, { x: 3.7, y: 2.0, w: 0.5, h: 0.25, fill: { color: C.green } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 4.5, y: 2.6, w: 0.4, h: 0.25, fill: { color: C.primary } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 3.7, y: 3.8, w: 0.6, h: 0.25, fill: { color: C.amber } });

  // Right side info
  slide.addText("L · R · C koordinatalari", {
    x: 6.5, y: 1.8, w: 3, h: 0.4,
    fontFace: "Arial", fontSize: 20, bold: true, color: C.white,
  });
  slide.addText("Level, Row, Column bo'yicha har bir joy aniq belgilangan.", {
    x: 6.5, y: 2.2, w: 3, h: 0.5,
    fontFace: "Arial", fontSize: 15, color: "94A3B8",
  });

  slide.addText("Mahsulot qidirish", {
    x: 6.5, y: 3.0, w: 3, h: 0.4,
    fontFace: "Arial", fontSize: 20, bold: true, color: C.white,
  });
  slide.addText("Nomi, kodi yoki NFC ID bo'yicha qidiring — slot avtomatik yoritiladi.", {
    x: 6.5, y: 3.4, w: 3, h: 0.5,
    fontFace: "Arial", fontSize: 15, color: "94A3B8",
  });

  slide.addText("Ishchilar uchun ko'rinish", {
    x: 6.5, y: 4.1, w: 3, h: 0.4,
    fontFace: "Arial", fontSize: 20, bold: true, color: C.white,
  });
  slide.addText("3D xarita ishchilar uchun faqat o'qish rejimida ko'rsatiladi.", {
    x: 6.5, y: 4.5, w: 3, h: 0.5,
    fontFace: "Arial", fontSize: 15, color: "94A3B8",
  });
}

// ============================================================
// SLIDE 7: Kirim/Chiqim jarayoni
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };

  slide.addText("KIRIM / CHIQIM JARAYONI", {
    x: 0.7, y: 0.4, w: 5, h: 0.35,
    fontFace: "Arial", fontSize: 13, bold: true, color: C.primary,
    charSpacing: 4,
  });

  slide.addText("Ishchi uchun 3 qadamli sodda jarayon", {
    x: 0.7, y: 0.75, w: 8, h: 0.6,
    ...F.heading,
  });

  const steps = [
    { num: "1", title: "Ishchini aniqlash", desc: "PIN yoki belgi ID sini skanerlash", color: C.primary },
    { num: "2", title: "Mahsulotni skanerlash", desc: "QR, Barcode yoki NFC orqali", color: C.teal },
    { num: "3", title: "Miqdorni kiritish", desc: "Kirim yoki chiqimni tasdiqlash", color: C.green },
  ];

  steps.forEach((s, i) => {
    const x = 0.7 + i * 3.1;
    const y = 1.7;

    // Connector line
    if (i < steps.length - 1) {
      slide.addShape(pres.shapes.LINE, {
        x: x + 1.2, y: y + 0.4, w: 1.4, h: 0,
        line: { color: "CBD5E1", width: 2, dashType: "dash" },
      });
    }

    // Circle
    slide.addShape(pres.shapes.OVAL, {
      x: x + 0.35, y: y, w: 0.9, h: 0.9,
      fill: { color: s.color },
    });
    slide.addText(s.num, {
      x: x + 0.35, y: y, w: 0.9, h: 0.9,
      fontFace: "Arial", fontSize: 28, bold: true, color: C.white,
      align: "center", valign: "middle",
    });

    slide.addText(s.title, {
      x: x, y: y + 1.1, w: 1.6, h: 0.4,
      fontFace: "Arial", fontSize: 18, bold: true, color: C.text,
      align: "center",
    });
    slide.addText(s.desc, {
      x: x, y: y + 1.5, w: 1.6, h: 0.6,
      fontFace: "Arial", fontSize: 14, color: C.muted,
      align: "center",
    });
  });

  // Bottom cards
  const extras = [
    { title: "To'plamli loglar", desc: "Bir sessiyada barcha operatsiyalar to'plam sifatida saqlanadi." },
    { title: "Tezkor yorliqlar", desc: "Operatsiyadan so'ng mahsulot yorlig'i chop etish mumkin." },
  ];

  extras.forEach((e, i) => {
    const x = 0.7 + i * 4.7;
    const y = 3.9;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.4, h: 1.3,
      fill: { color: C.light },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.06, h: 1.3,
      fill: { color: C.primary },
    });
    slide.addText(e.title, {
      x: x + 0.25, y: y + 0.2, w: 4, h: 0.35,
      fontFace: "Arial", fontSize: 18, bold: true, color: C.text,
    });
    slide.addText(e.desc, {
      x: x + 0.25, y: y + 0.6, w: 4, h: 0.55,
      fontFace: "Arial", fontSize: 14, color: C.muted,
    });
  });
}

// ============================================================
// SLIDE 8: Rollar va huquqlar
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.light };

  slide.addText("ROLLAR VA HUQUQLAR", {
    x: 0.7, y: 0.4, w: 5, h: 0.35,
    fontFace: "Arial", fontSize: 13, bold: true, color: C.primary,
    charSpacing: 4,
  });

  slide.addText("Ikki tur foydalanuvchi — ikki xil vazifa", {
    x: 0.7, y: 0.75, w: 8, h: 0.6,
    ...F.heading,
  });

  // Admin card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.6, w: 4.2, h: 3.5,
    fill: { color: C.white },
    shadow: makeShadowLight(),
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.6, w: 4.2, h: 0.08,
    fill: { color: C.primary },
  });
  slide.addText("ADMIN", {
    x: 0.7, y: 1.85, w: 4.2, h: 0.5,
    fontFace: "Arial", fontSize: 24, bold: true, color: C.text,
    align: "center",
  });

  const adminItems = [
    "Mahsulotlarni qo'shish/tahrirlash/o'chirish",
    "Sektorlar va stelajlarni 3D xaritada boshqarish",
    "Ishchilar ro'yxatini boshqarish",
    "Barcha loglar va hisobotlarni ko'rish",
    "Sozlamalarni o'zgartirish",
  ];
  adminItems.forEach((item, i) => {
    slide.addText("✓", {
      x: 1.0, y: 2.5 + i * 0.45, w: 0.3, h: 0.35,
      fontFace: "Arial", fontSize: 14, bold: true, color: C.green,
      align: "center", valign: "middle",
    });
    slide.addText(item, {
      x: 1.4, y: 2.5 + i * 0.45, w: 3.2, h: 0.35,
      fontFace: "Arial", fontSize: 15, color: C.text,
      valign: "middle",
    });
  });

  // Worker card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 5.3, y: 1.6, w: 4.2, h: 3.5,
    fill: { color: C.white },
    shadow: makeShadowLight(),
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 5.3, y: 1.6, w: 4.2, h: 0.08,
    fill: { color: C.teal },
  });
  slide.addText("ISHCHI", {
    x: 5.3, y: 1.85, w: 4.2, h: 0.5,
    fontFace: "Arial", fontSize: 24, bold: true, color: C.text,
    align: "center",
  });

  const workerItems = [
    "PIN kod orqali tez kirish",
    "Kirim/Chiqim operatsiyalari",
    "QR/Barcode/NFC skanerlash",
    "3D ombor xaritasini ko'rish (faqat o'qish)",
    "O'z operatsiyalar tarixini ko'rish",
  ];
  workerItems.forEach((item, i) => {
    slide.addText("✓", {
      x: 5.6, y: 2.5 + i * 0.45, w: 0.3, h: 0.35,
      fontFace: "Arial", fontSize: 14, bold: true, color: C.teal,
      align: "center", valign: "middle",
    });
    slide.addText(item, {
      x: 6.0, y: 2.5 + i * 0.45, w: 3.2, h: 0.35,
      fontFace: "Arial", fontSize: 15, color: C.text,
      valign: "middle",
    });
  });
}

// ============================================================
// SLIDE 9: Analitika va Dashboard
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };

  slide.addText("ANALITIKA VA DASHBOARD", {
    x: 0.7, y: 0.4, w: 5, h: 0.35,
    fontFace: "Arial", fontSize: 13, bold: true, color: C.primary,
    charSpacing: 4,
  });

  slide.addText("Har narsadan xabardor bo'ling", {
    x: 0.7, y: 0.75, w: 8, h: 0.6,
    ...F.heading,
  });

  // Stat boxes
  const stats = [
    { value: "Real vaqt", label: "Operatsiyalar darhol ko'rinadi", color: C.primary },
    { value: "7/30 kun", label: "Haftalik va oylik graflar", color: C.teal },
    { value: "Ogohlantirish", label: "Kam qolgan mahsulotlar", color: C.amber },
  ];

  stats.forEach((s, i) => {
    const x = 0.7 + i * 3.05;
    const y = 1.6;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.8, h: 1.3,
      fill: { color: C.white },
      shadow: makeShadowLight(),
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.8, h: 0.06,
      fill: { color: s.color },
    });

    slide.addText(s.value, {
      x: x + 0.2, y: y + 0.2, w: 2.4, h: 0.45,
      fontFace: "Arial", fontSize: 22, bold: true, color: C.text,
    });
    slide.addText(s.label, {
      x: x + 0.2, y: y + 0.65, w: 2.4, h: 0.5,
      fontFace: "Arial", fontSize: 14, color: C.muted,
    });
  });

  // Chart area (visual representation)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 3.2, w: 8.6, h: 2.0,
    fill: { color: C.light },
  });

  // Simulated bar chart
  const barData = [35, 55, 40, 70, 45, 60, 50];
  const barColors = [C.primary, C.primary, C.primary, C.teal, C.primary, C.primary, C.primary];
  barData.forEach((h, i) => {
    const barH = h / 70 * 1.2;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 1.2 + i * 1.15, y: 4.9 - barH, w: 0.7, h: barH,
      fill: { color: barColors[i] },
    });
  });

  slide.addText("Kirim va Chiqim dinamikasi", {
    x: 0.9, y: 3.3, w: 4, h: 0.35,
    fontFace: "Arial", fontSize: 16, bold: true, color: C.text,
  });

  // Legend
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 6.5, y: 3.35, w: 0.2, h: 0.15,
    fill: { color: C.primary },
  });
  slide.addText("Kirim", {
    x: 6.8, y: 3.3, w: 1, h: 0.25,
    fontFace: "Arial", fontSize: 12, color: C.muted,
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 7.6, y: 3.35, w: 0.2, h: 0.15,
    fill: { color: C.teal },
  });
  slide.addText("Chiqim", {
    x: 7.9, y: 3.3, w: 1, h: 0.25,
    fontFace: "Arial", fontSize: 12, color: C.muted,
  });
}

// ============================================================
// SLIDE 10: Texnologiyalar
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.dark };

  slide.addText("TEXNOLOGIYALAR", {
    x: 0.7, y: 0.4, w: 5, h: 0.35,
    fontFace: "Arial", fontSize: 13, bold: true, color: C.accent,
    charSpacing: 4,
  });

  slide.addText("Zamonaviy stack", {
    x: 0.7, y: 0.75, w: 8, h: 0.6,
    fontFace: "Arial", fontSize: 32, bold: true, color: C.white,
  });

  const techs = [
    { name: "React 18", desc: "UI komponentlari", color: "61DAFB" },
    { name: "TypeScript", desc: "Xavfsiz tipizatsiya", color: "3178C6" },
    { name: "Tailwind CSS", desc: "Stilizatsiya", color: "38BDF8" },
    { name: "Vite", desc: "Tez build", color: "646CFF" },
    { name: "Supabase", desc: "Backend va DB", color: "3ECF8E" },
    { name: "Three.js", desc: "3D vizualizatsiya", color: "000000" },
  ];

  techs.forEach((t, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.7 + col * 3.05;
    const y = 1.6 + row * 1.7;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.8, h: 1.4,
      fill: { color: "1E293B" },
    });

    // Color dot
    slide.addShape(pres.shapes.OVAL, {
      x: x + 0.2, y: y + 0.25, w: 0.35, h: 0.35,
      fill: { color: t.color },
    });

    slide.addText(t.name, {
      x: x + 0.65, y: y + 0.2, w: 2, h: 0.4,
      fontFace: "Arial", fontSize: 20, bold: true, color: C.white,
      valign: "middle",
    });
    slide.addText(t.desc, {
      x: x + 0.2, y: y + 0.7, w: 2.4, h: 0.5,
      fontFace: "Arial", fontSize: 14, color: "94A3B8",
    });
  });
}

// ============================================================
// SLIDE 11: Afzalliklar
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.primary };

  slide.addText("AFZALLIKLAR", {
    x: 0.7, y: 0.4, w: 5, h: 0.35,
    fontFace: "Arial", fontSize: 13, bold: true, color: "BFDBFE",
    charSpacing: 4,
  });

  slide.addText("Nima uchun Aqlli Omborxona?", {
    x: 0.7, y: 0.75, w: 8, h: 0.6,
    fontFace: "Arial", fontSize: 32, bold: true, color: C.white,
  });

  const benefits = [
    { num: "5x", label: "Tezroq operatsiyalar skanerlash orqali" },
    { num: "0", label: "Qo'lda yozish xatolari avtomatlashtirish bilan" },
    { num: "100%", label: "Mahsulot kuzatuvi har bir joyda" },
    { num: "24/7", label: "Real vaqt monitoring va xabarnomalar" },
  ];

  benefits.forEach((b, i) => {
    const x = 0.7 + (i % 2) * 4.5;
    const y = 1.7 + Math.floor(i / 2) * 1.6;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.2, h: 1.35,
      fill: { color: "1D4ED8" },
    });

    slide.addText(b.num, {
      x: x + 0.2, y: y + 0.15, w: 1.5, h: 0.6,
      fontFace: "Arial", fontSize: 40, bold: true, color: C.white,
    });
    slide.addText(b.label, {
      x: x + 0.2, y: y + 0.75, w: 3.8, h: 0.5,
      fontFace: "Arial", fontSize: 15, color: "BFDBFE",
    });
  });
}

// ============================================================
// SLIDE 12: Rahmat
// ============================================================
{
  const slide = pres.addSlide();
  slide.background = { color: C.dark };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.08,
    fill: { color: C.primary },
  });

  // Decorative circles
  slide.addShape(pres.shapes.OVAL, {
    x: 7, y: -1, w: 4, h: 4,
    fill: { color: C.primary, transparency: 90 },
  });
  slide.addShape(pres.shapes.OVAL, {
    x: -1.5, y: 3, w: 3.5, h: 3.5,
    fill: { color: C.accent, transparency: 92 },
  });

  slide.addText("Rahmat!", {
    x: 0.7, y: 1.8, w: 8, h: 1,
    fontFace: "Arial", fontSize: 56, bold: true, color: C.white,
  });

  slide.addText("Savollar bormi?", {
    x: 0.7, y: 2.8, w: 8, h: 0.5,
    fontFace: "Arial", fontSize: 22, color: "94A3B8",
  });

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 3.6, w: 3.5, h: 0.6,
    fill: { color: C.primary },
  });
  slide.addText("Aqlli Omborxona — Demo", {
    x: 0.7, y: 3.6, w: 3.5, h: 0.6,
    fontFace: "Arial", fontSize: 16, bold: true, color: C.white,
    align: "center", valign: "middle",
  });

  slide.addText("aqlli-omborxona.lovable.app", {
    x: 0.7, y: 4.5, w: 5, h: 0.35,
    fontFace: "Arial", fontSize: 14, color: "64748B",
  });
}

// ============================================================
// SAVE
// ============================================================
const outputPath = "/mnt/documents/Aqlli_Omborxona_Prezentatsiya.pptx";
pres.writeFile({ fileName: outputPath })
  .then(() => {
    console.log("✅ Presentation saved to:", outputPath);
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
