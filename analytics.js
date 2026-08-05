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

const TIKTOK_PIXEL_ID = '';
const META_PIXEL_ID = '';

(() => {
  'use strict';

  const hasTikTok = /^[A-Za-z0-9]{10,}$/.test(TIKTOK_PIXEL_ID);
  const hasMeta = /^\d{10,}$/.test(META_PIXEL_ID);
  if (!hasTikTok && !hasMeta) return;   // ничего не настроено — выходим молча

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
  function track(event, params) {
    try { if (hasTikTok && window.ttq) window.ttq.track(event, params || {}); } catch (e) {}
    try { if (hasMeta && window.fbq) window.fbq('track', event, params || {}); } catch (e) {}
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
