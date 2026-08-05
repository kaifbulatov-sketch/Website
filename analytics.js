/* Рекламные пиксели TikTok и Meta (Instagram/Facebook).
   ------------------------------------------------------------------
   Зачем. Без пикселя рекламный кабинет не знает, какое объявление привело
   человека к заявке: оптимизировать открутку и настроить ретаргетинг не на чем,
   бюджет тратится вслепую. Пиксель отправляет площадке события — «зашёл»,
   «посмотрел тарифы», «начал оформление», «зарегистрировался», — и дальше
   площадка сама учится показывать рекламу тем, кто похож на купивших.

   ID пикселя — не секрет: он в любом случае виден в коде страницы у любого
   посетителя, поэтому хранится прямо здесь, а не в переменных окружения.
   Секретов тут нет и быть не должно.

   Пока ID пустые — не грузится ничего: ни запросов, ни куки, ни замедления.
   Это важно юридически: до появления ID сайт не передаёт данные посетителей
   третьим лицам, и политика конфиденциальности остаётся точной.

   Где взять ID:
     TikTok — ads.tiktok.com → Инструменты → События → Веб-события,
              создать пиксель, скопировать ID вида CXXXXXXXXXXXXXXXXXXX.
     Meta   — business.facebook.com → Event Manager → Источники данных,
              создать пиксель, скопировать числовой ID.
   Вставить ниже, закоммитить, задеплоить — и события пойдут. */

/* --- Google: нужен для рекламы на YouTube ---------------------------------
   YouTube крутится через Google Ads, и конверсии считает он же, а не TikTok
   и не Meta. Нужны две вещи, и обе берутся в кабинете Google Ads:

   GOOGLE_ADS_ID — идентификатор аккаунта вида AW-123456789.
       Где: Google Ads → Цели → Конверсии → Сводка → выбрать действие-конверсию,
       в блоке «Настройка тега» будет строка AW-…

   GOOGLE_ADS_LABEL — метка конкретного действия-конверсии, вида AbC-D_efGh12.
       Там же, рядом с AW-. Без метки Google засчитает переход, но не поймёт,
       КАКОЕ действие произошло, и оптимизировать открутку будет не по чему.

   GA4_ID — необязательно, вида G-XXXXXXXXXX. Нужен, если хотите ещё и
       аналитику по поведению на сайте, а не только конверсии для рекламы. */
const GOOGLE_ADS_ID = 'AW-18351773114';
const GOOGLE_ADS_LABEL = 'h5dVCOHg19wcELqr565E';
const GA4_ID = '';

/* --- TikTok и Meta: пригодятся, если реклама пойдёт и туда ---------------- */
const TIKTOK_PIXEL_ID = '';
const META_PIXEL_ID = '';

(() => {
  'use strict';

  const hasTikTok = /^[A-Za-z0-9]{10,}$/.test(TIKTOK_PIXEL_ID);
  const hasMeta = /^\d{10,}$/.test(META_PIXEL_ID);
  const hasAds = /^AW-\d{6,}$/.test(GOOGLE_ADS_ID);
  const hasGa4 = /^G-[A-Z0-9]{6,}$/.test(GA4_ID);
  const hasGoogle = hasAds || hasGa4;
  if (!hasTikTok && !hasMeta && !hasGoogle) return;   // ничего не настроено — выходим молча

  /* --- Google tag: один скрипт обслуживает и Google Ads, и GA4 ------------
     gtag.js подключается один раз, а config вызывается для каждого
     идентификатора отдельно. Порядок важен: dataLayer и сама функция gtag
     должны существовать до того, как приедет внешний скрипт, иначе первые
     вызовы потеряются. */
  if (hasGoogle) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    if (hasAds) window.gtag('config', GOOGLE_ADS_ID);
    if (hasGa4) window.gtag('config', GA4_ID);
    const gs = document.createElement('script');
    gs.async = true;
    gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + (hasAds ? GOOGLE_ADS_ID : GA4_ID);
    document.head.appendChild(gs);
  }

  /* --- загрузка пикселя TikTok (официальный сниппет, сокращён до сути) --- */
  if (hasTikTok) {
    (function (w, d, t) {
      w.TiktokAnalyticsObject = t;
      const ttq = w[t] = w[t] || [];
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off',
        'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
      ttq.setAndDefer = function (obj, method) {
        obj[method] = function () { obj.push([method].concat([].slice.call(arguments, 0))); };
      };
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (id) {
        const inst = ttq._i[id] || [];
        for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(inst, ttq.methods[i]);
        return inst;
      };
      ttq.load = function (id, opts) {
        const url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {}; ttq._i[id] = []; ttq._i[id]._u = url;
        ttq._t = ttq._t || {}; ttq._t[id] = +new Date();
        ttq._o = ttq._o || {}; ttq._o[id] = opts || {};
        const s = d.createElement('script');
        s.type = 'text/javascript'; s.async = true; s.src = url + '?sdkid=' + id + '&lib=' + t;
        const first = d.getElementsByTagName('script')[0];
        first.parentNode.insertBefore(s, first);
      };
      ttq.load(TIKTOK_PIXEL_ID);
      ttq.page();
    })(window, document, 'ttq');
  }

  /* --- загрузка пикселя Meta (официальный сниппет) --- */
  if (hasMeta) {
    (function (f, b, e, v) {
      if (f.fbq) return;
      const n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      const t = b.createElement(e); t.async = true; t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  /* ------------------------------------------------------------------
     Единая точка отправки события в обе площадки. Названия событий взяты
     стандартные (ViewContent / InitiateCheckout / CompleteRegistration) —
     на них обучаются алгоритмы оптимизации, самописные названия площадка
     использовать для оптимизации не умеет.
  ------------------------------------------------------------------ */
  /* Google называет события иначе, чем TikTok и Meta, а Google Ads вдобавок
     ждёт не имя события, а пару «идентификатор/метка». Поэтому одно наше
     событие раскладывается на три разных вызова. */
  const GA4_NAMES = {
    ViewContent: 'view_item_list',
    InitiateCheckout: 'begin_checkout',
    CompleteRegistration: 'sign_up'
  };
  // За какие события Google Ads должен засчитывать конверсию. Просмотр тарифов
  // сюда не входит намеренно: если конверсией считать каждый просмотр, алгоритм
  // начнёт искать зрителей, а не покупателей.
  const ADS_CONVERSIONS = ['InitiateCheckout', 'CompleteRegistration'];

  function track(event, params) {
    try { if (hasTikTok && window.ttq) window.ttq.track(event, params || {}); } catch (e) {}
    try { if (hasMeta && window.fbq) window.fbq('track', event, params || {}); } catch (e) {}
    try {
      if (hasGa4 && window.gtag) {
        window.gtag('event', GA4_NAMES[event] || event, params || {});
      }
      if (hasAds && window.gtag && GOOGLE_ADS_LABEL && ADS_CONVERSIONS.indexOf(event) !== -1) {
        const p = { send_to: GOOGLE_ADS_ID + '/' + GOOGLE_ADS_LABEL };
        if (params && params.value) { p.value = params.value; p.currency = 'KZT'; }
        window.gtag('event', 'conversion', p);
      }
    } catch (e) {}
  }
  window.neuraTrack = track;

  /* --- «посмотрел тарифы»: считаем просмотром, когда блок реально попал в
         экран, а не когда просто загрузилась страница. Один раз за визит. --- */
  const pricing = document.getElementById('pricing');
  if (pricing && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        track('ViewContent', { content_type: 'product_group', content_name: 'Тарифы' });
        io.disconnect();
      });
    }, { threshold: 0.35 });
    io.observe(pricing);
  }

  /* --- «начал оформление»: клик по кнопке заказа на странице оплаты.
         Слушаем в фазе перехвата, потому что сам обработчик в payment.js
         уводит человека на wa.me — после ухода со страницы отправлять уже поздно. --- */
  const payBtn = document.getElementById('payBtn');
  if (payBtn) {
    payBtn.addEventListener('click', () => {
      if (payBtn.classList.contains('btn--disabled')) return;
      const priceEl = document.getElementById('payPrice');
      const value = priceEl ? Number(String(priceEl.textContent).replace(/\D/g, '').slice(-6)) : undefined;
      track('InitiateCheckout', { content_type: 'product', currency: 'KZT', value: value || undefined });
    }, true);
  }
})();
