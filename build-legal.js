// Скрипт сборки для Vercel: подставляет реальные реквизиты ИП в оферту и политику
// конфиденциальности из переменных окружения проекта (Project → Settings → Environment
// Variables на vercel.com). Реальные значения нигде не хранятся в этом репозитории —
// только в настройках Vercel и в изолированном окружении сборки. Публичный репозиторий
// на GitHub видит только токены вида __IP_...__ в oferta.html и privacy.html.
//
// Если переменная не задана (например, локальная сборка или preview-деплой без прод-
// переменных) — подставляется безопасная заглушка "[...]", а не пусто и не ошибка.

const fs = require('fs');

const REPLACEMENTS = {
  '__IP_BIN__': process.env.IP_BIN || '[БИН/ИИН]',
  '__IP_CERT__': process.env.IP_CERT || '[номер свидетельства]',
  '__IP_ADDRESS__': process.env.IP_ADDRESS || '[адрес]',
  '__IP_EMAIL__': process.env.IP_EMAIL || '[email]',
  '__IP_PHONE__': process.env.IP_PHONE || '[телефон]',
  '__IP_BANK__': process.env.IP_BANK || '[банк]',
  '__IP_BIK__': process.env.IP_BIK || '[БИК]',
  '__IP_KBE__': process.env.IP_KBE || '[Кбе]',
  '__IP_IBAN__': process.env.IP_IBAN || '[номер счёта]',
  // Без телефона в формате wa.me (только цифры, код страны, без "+") — временная
  // схема оплаты в payment.js не может собрать ссылку на WhatsApp. Здесь — в
  // отличие от строк выше — заглушка не человекочитаемая, а тот же токен: так
  // WHATSAPP_CONFIGURED в whatsapp-config.js остаётся false, а не «настроено
  // мусорным номером», если переменная окружения не задана.
  '__IP_WHATSAPP__': process.env.IP_WHATSAPP || '__IP_WHATSAPP__',
};

for (const file of ['oferta.html', 'privacy.html', 'whatsapp-config.js']) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [token, value] of Object.entries(REPLACEMENTS)) {
    text = text.split(token).join(value);
  }
  fs.writeFileSync(file, text);
  console.log(file + ': реквизиты подставлены');
}
