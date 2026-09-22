(function () {
  var trigger = document.getElementById('avatarTrigger');
  var modal = document.getElementById('avatarModal');
  if (!trigger || !modal) return;

  var lastFocused = null;

  function openModal() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = modal.querySelector('.avatar-modal__close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  trigger.addEventListener('click', openModal);
  trigger.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal();
    }
  });

  modal.addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-close')) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
})();

(function () {
  var REVERSE = true; // true — блок снова размывается, если уходит за порог обратно

  var revealEls = document.querySelectorAll('.reveal:not(.hero), .reveal-up');

  // .process-steps и .hero показываются один раз и обратно не прячутся
  // (не наблюдаются hideObserver'ом). У .process-steps это просто триггер
  // для поочерёдного появления карточек-детей (transition-delay в
  // styles.css) — обратимость мешала: перетаскивание ряда мышью иногда
  // задевало границу срабатывания hideObserver, и карточки гасли прямо во
  // время драга. У .hero (первый блок страницы, виден сразу при загрузке)
  // обратимость не нужна по смыслу — а гистерезис на такой большой секции
  // не всегда чисто отрабатывал при быстром скролле обратно наверх,
  // оставляя блок размытым.
  var staggerEls = document.querySelectorAll('.process-steps, .hero');

  if (!revealEls.length && !staggerEls.length) return;

  if (!('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    staggerEls.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  // Две отдельные границы (гистерезис), а не одна общая — иначе блок,
  // застывший ровно на пороге, дёргается туда-обратно (transform у него
  // же и меняет геометрию, которую тот же порог заново оценивает).
  // showObserver сужает область наблюдения почти до всего экрана: блок
  // начинает расфокусировываться сразу, как только его верх появляется
  // снизу, — и уже стоит чётким к моменту, когда скролл останавливается.
  var showObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0
  });

  // hideObserver скрывает блок обратно, только когда он целиком покинул
  // видимую область — причём с запасом на ОБЕИХ границах (не только
  // снизу, как у showObserver, но и сверху: -10% сверху означает, что
  // при скролле вниз блок считается ушедшим, только когда он поднялся
  // выше этой линии, а не сразу у самого края экрана). Без этого запаса
  // сверху граница показа и скрытия совпадали бы в одной точке (y=0) —
  // это и вызывало мигание при остановке рядом с верхним краем экрана.
  var hideObserver = REVERSE && new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) entry.target.classList.remove('is-visible');
    });
  }, {
    root: null,
    rootMargin: '-10% 0px 0px 0px',
    threshold: 0
  });

  revealEls.forEach(function (el) {
    showObserver.observe(el);
    if (hideObserver) hideObserver.observe(el);
  });

  staggerEls.forEach(function (el) {
    showObserver.observe(el);
  });
})();

(function () {
  // Ряд карточек "Как я работаю" тянется мышью за ручку — как перетаскивание
  // картинки в лайтбоксе (case-study.js). Тач и колесо уже скроллят ряд сами
  // за счёт overflow-x:auto нативно, поэтому здесь ловим только мышь.
  var track = document.querySelector('.process-steps');
  var title = document.querySelector('.process-title');
  if (!track) return;

  // .process-steps растянута на всю сетку (обе резиновые колонки-отступа,
  // см. components.css) — карточки при скролле уходят за реальный край
  // экрана, а не упираются в невидимую границу на месте края контентной
  // колонки. Но по умолчанию (и в конце скролла) первая/последняя
  // карточка должны вставать вровень с краями верхнего 800px-блока
  // (.process-title растянут grid'ом ровно на всю контентную колонку) —
  // меряем реальный зазор с обеих сторон и отдаём его как padding.
  // scrollLeft трогать не нужно: он не двигает окно на экране (оно и так
  // всегда стоит на месте .process-steps), а лишь выбирает, какой кусок
  // контента показан — при scrollLeft:0 (значение по умолчанию) первым
  // виден как раз padding-left, а сразу за ним, вровень с заголовком,
  // начинается карточка 01.
  function syncEdgePadding() {
    if (!title) return;
    var trackRect = track.getBoundingClientRect();
    var titleRect = title.getBoundingClientRect();
    var leftGap = Math.max(0, titleRect.left - trackRect.left);
    var rightGap = Math.max(0, trackRect.right - titleRect.right);
    track.style.paddingLeft = leftGap + 'px';
    track.style.paddingRight = rightGap + 'px';
  }

  syncEdgePadding();
  window.addEventListener('resize', syncEdgePadding);

  var dragging = false;
  var dragPointerId = null;
  var dragStartX = 0;
  var dragStartScrollLeft = 0;

  track.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') return;
    dragging = true;
    dragPointerId = e.pointerId;
    dragStartX = e.clientX;
    dragStartScrollLeft = track.scrollLeft;
    track.classList.add('is-dragging');
    track.setPointerCapture(e.pointerId);
  });

  // Лёгкое пружинение на краях: если тянуть дальше начала/конца скролла,
  // ряд поддаётся лишь на часть жеста (RESISTANCE) через transform, а не
  // просто упирается в стену — и плавно возвращается на место при
  // отпускании (transition ниже, снимается сразу после, чтобы не мешать
  // следующему перетаскиванию, которое должно идти без задержки за курсором).
  var RESISTANCE = 0.35;
  var MAX_OVERSHOOT = 60;
  var SPRING_TRANSITION = 'transform 0.45s cubic-bezier(0.34, 2.2, 0.64, 1)';

  function springBack() {
    track.style.transition = SPRING_TRANSITION;
    track.style.transform = '';
    track.addEventListener('transitionend', function handler() {
      track.style.transition = '';
      track.removeEventListener('transitionend', handler);
    });
  }

  track.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    var target = dragStartScrollLeft - (e.clientX - dragStartX);
    var min = 0;
    var max = track.scrollWidth - track.clientWidth;
    var overshoot = 0;
    if (target < min) {
      overshoot = target - min;
      target = min;
    } else if (target > max) {
      overshoot = target - max;
      target = max;
    }
    track.scrollLeft = target;
    if (overshoot) {
      var shift = Math.max(-MAX_OVERSHOOT, Math.min(MAX_OVERSHOOT, -overshoot * RESISTANCE));
      track.style.transform = 'translateX(' + shift.toFixed(2) + 'px)';
    } else {
      track.style.transform = '';
    }
  });

  function endDrag(e) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = null;
    track.classList.remove('is-dragging');
    // Пружинка не только на краю: если тянули дальше границы, transform
    // уже выставлен движением выше и просто едет обратно в 0. Если
    // отпустили посреди обычного скролла — толчок фиксированной величины
    // в сторону всего жеста целиком (а не последнего кадра движения: перед
    // отпусканием курсор обычно уже почти остановлен, и скорость в
    // последний момент около нуля — толчка почти не было видно).
    var totalDrag = e.clientX - dragStartX;
    if (!track.style.transform && totalDrag) {
      var nudge = totalDrag > 0 ? 16 : -16;
      track.style.transition = 'none';
      track.style.transform = 'translateX(' + nudge + 'px)';
      // Форсируем reflow — иначе постановка толчка и запуск обратного
      // перехода в 0 (springBack ниже) происходят в одном и том же
      // синхронном вызове, и браузер может схлопнуть оба изменения в один
      // кадр, ни разу не отрисовав сам толчок — тогда пружинки не видно.
      void track.offsetWidth;
    }
    if (track.style.transform) springBack();
  }

  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
})();

(function () {
  // Влёт-анимации (декор, аватарка, заголовок, статистика, текст) заданы с
  // animation-fill-mode:both — он держит transform даже после завершения и
  // перебивает :hover-переходы (например, зум аватарки). Снимаем анимацию
  // сразу по её окончании, чтобы элемент вернулся к обычному поведению.
  document.addEventListener('animationend', function (e) {
    e.target.style.animation = 'none';
  });
})();
