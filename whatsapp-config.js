// Номер WhatsApp для приёма заявок на оплату — временная ручная схема, пока не
// подключён автоматический приём Kaspi Webpay (см. supabase-setup/README.md).
// Реальный номер подставляется на Vercel из переменной окружения IP_WHATSAPP
// при сборке (см. build-legal.js), тем же способом, что и реквизиты в
// oferta.html/privacy.html. В открытом коде на GitHub всегда остаётся токен,
// а не сам номер.
//
// Формат — только цифры, с кодом страны, без "+" и пробелов (пример: 77081234567).
const WHATSAPP_NUMBER = '__IP_WHATSAPP__';
const WHATSAPP_CONFIGURED = !/^__IP_/.test(WHATSAPP_NUMBER);
