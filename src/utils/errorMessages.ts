/**
 * Supabase / network xatolarini foydalanuvchiga tushunarli o'zbek tilidagi xabarlarga aylantiradi.
 */

const ERROR_MAP: { pattern: RegExp; message: string }[] = [
  // Auth xatoliklari
  { pattern: /invalid login credentials/i, message: "Login yoki parol noto'g'ri. Qaytadan urinib ko'ring." },
  { pattern: /email not confirmed/i, message: "Email tasdiqlanmagan. Emailingizni tekshiring." },
  { pattern: /user already registered/i, message: "Bu email allaqachon ro'yxatdan o'tgan." },
  { pattern: /signup is disabled/i, message: "Ro'yxatdan o'tish vaqtincha to'xtatilgan." },
  { pattern: /email rate limit exceeded/i, message: "Juda ko'p urinish. Bir ozdan so'ng qaytadan urinib ko'ring." },
  { pattern: /jwt expired/i, message: "Sessiya muddati tugagan. Qaytadan kiring." },
  { pattern: /refresh_token_not_found/i, message: "Sessiya topilmadi. Qaytadan tizimga kiring." },
  
  // RLS / ruxsat xatoliklari
  { pattern: /row-level security/i, message: "Ruxsat yo'q. Bu amalni bajarishga huquqingiz yetarli emas." },
  { pattern: /new row violates row-level security/i, message: "Ruxsat yo'q. Ma'lumot qo'shishga huquqingiz yetarli emas." },
  { pattern: /permission denied/i, message: "Ruxsat berilmadi. Admin bilan bog'laning." },
  
  // Unique constraint
  { pattern: /duplicate key.*badge_id/i, message: "Bu Badge ID allaqachon boshqa ishchiga biriktirilgan." },
  { pattern: /duplicate key.*product_code/i, message: "Bu mahsulot kodi allaqachon mavjud." },
  { pattern: /duplicate key.*code/i, message: "Bu kod allaqachon mavjud. Boshqa kod tanlang." },
  { pattern: /duplicate key.*name/i, message: "Bu nom allaqachon mavjud. Boshqa nom kiriting." },
  { pattern: /duplicate key/i, message: "Bunday ma'lumot allaqachon bazada mavjud." },
  
  // Foreign key
  { pattern: /foreign key.*sector/i, message: "Tanlangan sektor bazada topilmadi." },
  { pattern: /foreign key.*product/i, message: "Tanlangan mahsulot bazada topilmadi." },
  { pattern: /foreign key.*worker/i, message: "Tanlangan ishchi bazada topilmadi." },
  { pattern: /violates foreign key/i, message: "Bog'langan ma'lumot topilmadi. Ma'lumotlar to'g'riligini tekshiring." },
  { pattern: /update or delete.*violates.*constraint/i, message: "Bu elementga boshqa ma'lumotlar bog'langan. Avval bog'langan ma'lumotlarni o'chiring." },
  
  // Not found
  { pattern: /PGRST116/i, message: "Ma'lumot topilmadi. U o'chirilgan yoki mavjud emas bo'lishi mumkin." },
  { pattern: /no rows/i, message: "So'ralgan ma'lumot topilmadi." },
  
  // Network
  { pattern: /fetch|network|aloqa/i, message: "Internet aloqasi uzildi. Tarmoq ulanishini tekshiring va qaytadan urinib ko'ring." },
  { pattern: /timeout/i, message: "Server javob bermayapti. Internet tezligini tekshiring va qaytadan urinib ko'ring." },
  { pattern: /503|service unavailable/i, message: "Server vaqtincha ishlamayapti. Biroz kutib, qaytadan urinib ko'ring." },
  { pattern: /500|internal server/i, message: "Serverda ichki xatolik yuz berdi. Iltimos, keyinroq urinib ko'ring." },
  
  // Validation
  { pattern: /not-null.*name/i, message: "Nom bo'sh bo'lishi mumkin emas." },
  { pattern: /not-null/i, message: "Barcha majburiy maydonlarni to'ldiring." },
  { pattern: /check.*quantity/i, message: "Miqdor noto'g'ri. Musbat son kiriting." },
  { pattern: /value too long/i, message: "Kiritilgan ma'lumot juda uzun. Qisqartiring." },
  { pattern: /invalid input syntax/i, message: "Noto'g'ri format. Kiritilgan ma'lumotni tekshiring." },
];

/**
 * Xato ob'ektini o'zbek tilidagi tushunarli xabar ga aylantiradi.
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  if (!error) return fallback || "Noma'lum xatolik yuz berdi.";

  const msg = typeof error === 'string'
    ? error
    : (error as any)?.message || (error as any)?.error_description || (error as any)?.msg || String(error);

  for (const { pattern, message } of ERROR_MAP) {
    if (pattern.test(msg)) return message;
  }

  // Agar hech qaysi patternga mos kelmasa
  return fallback || "Kutilmagan xatolik yuz berdi. Qaytadan urinib ko'ring.";
}

/**
 * toast.error uchun tayyor wrapper
 */
export function showError(error: unknown, fallback?: string) {
  const { toast } = require('sonner');
  toast.error(getErrorMessage(error, fallback));
}
