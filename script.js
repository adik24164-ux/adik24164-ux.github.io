(function () {
  var triggers = document.querySelectorAll('.avatar-trigger');
  var modal = document.getElementById('avatarModal');
  if (!triggers.length || !modal) return;

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

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', openModal);
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal();
      }
    });
  });

  modal.addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-close')) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
})();

(function () {
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('siteMenu');
  if (!toggle || !menu) return;

  // Полоски бургера на пиксельной сетке экрана: толщина 2px и зазор 4px
  // (как в макете) округляются до целых точек при текущем devicePixelRatio,
  // иначе на масштабе 125%/150% зазоры выходят разными. Пересчёт на resize —
  // смена масштаба/зума браузера тоже его вызывает.
  var icon = toggle.querySelector('.menu-toggle__icon');
  function snapBars() {
    if (!icon) return;
    var dpr = window.devicePixelRatio || 1;
    var h = Math.max(1, Math.round(2 * dpr));
    var gap = Math.round(4 * dpr);
    icon.style.setProperty('--bar-h', h / dpr + 'px');
    icon.style.setProperty('--bar-step', (h + gap) / dpr + 'px');
  }
  snapBars();
  window.addEventListener('resize', snapBars);

  function closeMenu() {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Открыть меню');
  }

  function openMenu() {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Закрыть меню');
  }

  toggle.addEventListener('click', function () {
    if (menu.hidden) openMenu(); else closeMenu();
  });

  document.addEventListener('click', function (e) {
    if (!menu.hidden && !menu.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) {
      closeMenu();
      toggle.focus();
    }
  });

  menu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
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
  //
  // Обратный вход тоже обрабатываем здесь: у двух наблюдателей разные
  // области, и блок, нижний край которого застрял в верхней полосе 10%
  // (там hideObserver уже убрал is-visible, а showObserver всё ещё считает
  // блок видимым и повторно не срабатывает), при скролле обратно вверх
  // навсегда оставался прозрачным — на странице появлялась пустая дыра.
  // Поэтому, когда блок возвращается в область hideObserver'а и его верх
  // выше нижней границы показа (той же 90%-линии showObserver'а), снова
  // включаем is-visible.
  //
  // REVEAL_SETTLE — короткая пауза после ЛЮБОГО переключения class'а:
  // сам переход opacity/transform на 0.6s (styles.css) двигает блок ровно
  // настолько, что может тут же вытолкнуть его через ту же границу
  // hideObserver'а обратно — тот получает новое срабатывание, снова
  // переключает класс, снова двигает блок, и так по кругу (видимое
  // мигание). Пока блок ещё "оседает" после своего же переключения, новое
  // срабатывание hideObserver'а не применяем сразу, а откладываем на конец
  // паузы (а не просто игнорируем — иначе при быстрой прокрутке настоящий
  // повторный вход блока в кадр мог потеряться совсем, и блок навсегда
  // оставался невидимым, снова та же пустая дыра). К концу паузы transform
  // уже осел, и решение по свежей геометрии принимается один раз, без
  // дёрганья.
  var REVEAL_SETTLE = 700; // мс, больше длительности transition (0.6s)
  var settleUntil = new WeakMap();
  var pendingRecheck = new WeakMap();

  function isSettling(el) {
    var until = settleUntil.get(el);
    return until !== undefined && performance.now() < until;
  }

  function scheduleSettle(el) {
    settleUntil.set(el, performance.now() + REVEAL_SETTLE);
  }

  function applyHideDecision(el, isIntersecting, top) {
    if (!isIntersecting) {
      el.classList.remove('is-visible');
      scheduleSettle(el);
    } else if (top < window.innerHeight * 0.9) {
      el.classList.add('is-visible');
      scheduleSettle(el);
    }
  }

  function recheckAfterSettle(el) {
    // Та же граница, что и у hideObserver'а (rootMargin '-10% 0px 0px 0px'):
    // пересекает её, если хоть часть блока ниже верхних 10% экрана.
    var rect = el.getBoundingClientRect();
    var isIntersecting = rect.bottom > window.innerHeight * 0.1 && rect.top < window.innerHeight;
    applyHideDecision(el, isIntersecting, rect.top);
  }

  var hideObserver = REVERSE && new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var el = entry.target;
      if (isSettling(el)) {
        clearTimeout(pendingRecheck.get(el));
        var until = settleUntil.get(el);
        pendingRecheck.set(el, setTimeout(function () {
          recheckAfterSettle(el);
        }, Math.max(0, until - performance.now())));
        return;
      }
      applyHideDecision(el, entry.isIntersecting, entry.boundingClientRect.top);
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
  // картинки в лайтбоксе (case-study.js), с инерцией и пружинкой на краях.
  // Пальцем ряд листает сам браузер (нативная прокрутка), поэтому тач-события
  // ниже игнорируются — свой драг на телефоне срывался и почти не двигал ряд.
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
  // Скорость отпускания считаем по окну последних ~100мс движения, а не по
  // двум последним событиям: pointermove у пальца приходит пачками с почти
  // нулевым dt между событиями, и мгновенная скорость по паре точек давала
  // случайные всплески — ряд после отпускания то замирал, то срывался в
  // бег. Если палец перед отпусканием постоял на месте, инерции нет.
  var VELOCITY_WINDOW = 100;   // мс — по какому окну считаем скорость
  var VELOCITY_STALE = 60;     // мс — дольше стоял на месте → не бросаем
  var MAX_VELOCITY = 3;        // px/мс — потолок, чтобы не улетало за край сразу
  var samples = [];            // { t, pos } — pos это scrollLeft без ограничений

  // Пружинка — только лёгкая отдача на краях (как было изначально):
  // ряд поддаётся лишь на часть жеста (RESISTANCE) через transform, а не
  // просто упирается в стену — и плавно возвращается на место при
  // отпускании (transition ниже, снимается сразу после, чтобы не мешать
  // следующему перетаскиванию, которое должно идти без задержки за курсором).
  var RESISTANCE = 0.35;
  var MAX_OVERSHOOT = 60;
  var SPRING_TRANSITION = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

  // Инерция ("ускорение"): чем резче толчок, тем быстрее и дальше едет
  // ряд после отпускания, с постепенным замедлением — а не резкая
  // остановка ровно там, где разжали пальцы/кнопку.
  var MOMENTUM_DECAY = 0.998; // затухание скорости за 1мс
  var MOMENTUM_MIN_VELOCITY = 0.02; // px/мс — ниже него считаем, что остановились
  var momentumFrame = null;

  function stopMomentum() {
    if (momentumFrame) {
      cancelAnimationFrame(momentumFrame);
      momentumFrame = null;
    }
  }

  function springBack() {
    track.style.transition = SPRING_TRANSITION;
    track.style.transform = '';
    track.addEventListener('transitionend', function handler() {
      track.style.transition = '';
      track.removeEventListener('transitionend', handler);
    });
  }

  // Толчок фиксированной небольшой величины при ударе о край во время
  // инерционного докатывания — та же лёгкая отдача, что и при обычном
  // перетаскивании за край, просто без ручного жеста в моменте.
  function bounceEdge(hitMin) {
    var pulse = hitMin ? 14 : -14;
    track.style.transition = 'none';
    track.style.transform = 'translateX(' + pulse + 'px)';
    void track.offsetWidth;
    springBack();
  }

  function startMomentum(velocity) {
    stopMomentum();
    var lastT = performance.now();
    function step(t) {
      var dt = t - lastT;
      lastT = t;
      velocity *= Math.pow(MOMENTUM_DECAY, dt);
      if (Math.abs(velocity) < MOMENTUM_MIN_VELOCITY) {
        momentumFrame = null;
        return;
      }
      var min = 0;
      var max = track.scrollWidth - track.clientWidth;
      var next = track.scrollLeft + velocity * dt;
      if (next < min || next > max) {
        track.scrollLeft = Math.max(min, Math.min(max, next));
        momentumFrame = null;
        bounceEdge(next < min);
        return;
      }
      track.scrollLeft = next;
      momentumFrame = requestAnimationFrame(step);
    }
    momentumFrame = requestAnimationFrame(step);
  }

  track.addEventListener('pointerdown', function (e) {
    // Палец и стилус листают нативно (см. touch-action в components.css) —
    // кастомный драг только для мыши.
    if (e.pointerType !== 'mouse') return;
    stopMomentum();
    dragging = true;
    dragPointerId = e.pointerId;
    dragStartX = e.clientX;
    dragStartScrollLeft = track.scrollLeft;
    samples = [{ t: e.timeStamp, pos: dragStartScrollLeft }];
    track.classList.add('is-dragging');
    track.setPointerCapture(e.pointerId);
  });

  track.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    var rawTarget = dragStartScrollLeft - (e.clientX - dragStartX);
    samples.push({ t: e.timeStamp, pos: rawTarget });
    while (samples.length > 2 && e.timeStamp - samples[0].t > VELOCITY_WINDOW) samples.shift();

    var target = rawTarget;
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
    } else if (track.style.transform) {
      track.style.transform = '';
    }
  });

  function releaseVelocity(now) {
    var last = samples[samples.length - 1];
    var first = samples[0];
    if (!last || now - last.t > VELOCITY_STALE) return 0;
    var dt = last.t - first.t;
    if (dt < 16) return 0;
    var v = (last.pos - first.pos) / dt;
    return Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, v));
  }

  function endDrag(e) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = null;
    track.classList.remove('is-dragging');
    if (track.style.transform) {
      springBack();
    } else {
      var velocity = releaseVelocity(e.timeStamp);
      if (Math.abs(velocity) > MOMENTUM_MIN_VELOCITY) startMomentum(velocity);
    }
  }

  track.addEventListener('pointerup', endDrag);
  // pointercancel — браузер забрал жест себе (палец пошёл вертикально и
  // началась прокрутка страницы): инерцию по горизонтали не запускаем.
  track.addEventListener('pointercancel', function (e) {
    samples = [];
    endDrag(e);
  });
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

(function () {
  // Шапка: в начале страницы просторная (node 66314:718), после прокрутки —
  // компактная (node 66338:506). Два порога (гистерезис): сжимаемся после
  // 24px прокрутки, разжимаемся только выше 8px — иначе на границе шапка
  // дёргалась бы туда-обратно.
  var header = document.querySelector('.site-header');
  if (!header) return;
  var root = document.documentElement;

  // На страницах кейсов шапка всегда компактная (.site-header--compact,
  // node 285:638): не разворачиваем её у верха страницы, а отступ под ней
  // меряем прямо в компактном состоянии.
  if (header.classList.contains('site-header--compact')) {
    header.classList.add('is-scrolled');
    var measureCompact = function () {
      root.style.setProperty('--header-h', header.offsetHeight + 'px');
    };
    measureCompact();
    window.addEventListener('resize', measureCompact);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureCompact);
    return;
  }

  var SHRINK_AT = 24;
  var EXPAND_AT = 8;

  // Отступ под fixed-шапку = её высота в НАЧАЛЬНОМ состоянии (на телефоне
  // кнопки уходят на вторую строку, поэтому высоту не зашиваем в CSS, а
  // меряем). Если шапка уже сжата, на время замера снимаем .is-scrolled
  // без анимации.
  function measure() {
    var scrolled = header.classList.contains('is-scrolled');
    header.classList.add('is-measuring');
    if (scrolled) header.classList.remove('is-scrolled');
    root.style.setProperty('--header-h', header.offsetHeight + 'px');
    if (scrolled) header.classList.add('is-scrolled');
    void header.offsetHeight;
    header.classList.remove('is-measuring');
  }

  function update() {
    var y = window.scrollY || window.pageYOffset;
    if (y > SHRINK_AT) header.classList.add('is-scrolled');
    else if (y < EXPAND_AT) header.classList.remove('is-scrolled');
  }

  measure();
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', measure);
  // Шрифты кнопок догружаются позже и могут поменять высоту шапки.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();

(function () {
  // Подпись «пишется» при каждой загрузке главной: линия прорисовывается
  // вдоль пути (stroke-dashoffset), как рука ведёт ручку. Путь собран из
  // кусочков Figma в одну линию по ходу письма. Темп ease-in: начало
  // медленное, к концу росчерк ускоряется. Флаг sig-intro ставит скрипт в
  // <head> только на главной (и если не включено уменьшение движения) — до
  // этого момента линия скрыта через CSS.
  var root = document.documentElement;
  if (!root.classList.contains('sig-intro')) return;
  var path = document.querySelector('.brand-signature path');
  if (!path || typeof path.getTotalLength !== 'function' || typeof path.animate !== 'function') {
    root.classList.remove('sig-intro');
    return;
  }

  var length = Math.ceil(path.getTotalLength());
  path.style.strokeDasharray = length;
  path.style.strokeDashoffset = length;
  root.classList.remove('sig-intro');

  var animation = path.animate(
    [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
    { duration: 2200, delay: 200, easing: 'cubic-bezier(0.6, 0, 0.9, 0.55)', fill: 'forwards' }
  );
  animation.finished.then(function () {
    path.style.strokeDasharray = '';
    path.style.strokeDashoffset = '';
    animation.cancel();
  }, function () {});
})();

(function () {
  // Карточки «Опыт в проектах» на телефоне складываются колодой — порт
  // React-паттерна StackedSections: карточки sticky со сдвигом, накрытая
  // карточка уменьшается, пока следующая поднимается на своё место, и
  // замирает в уменьшенном виде, когда та встала. Масштаб — через свойство
  // scale (не transform), чтобы не спорить с влёт-анимацией карточек.
  var deck = document.querySelector('.hero-experience');
  if (!deck) return;
  var cards = Array.prototype.slice.call(deck.querySelectorAll('.hero-experience__card'));
  var header = document.querySelector('.site-header');
  var mobile = window.matchMedia('(max-width: 640px)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var GAP_UNDER_HEADER = 16;
  var SCALE_STEP = 0.05; // каждая карточка глубже в колоде — на 5% меньше
  var WHITEN_STEP = 25; // каждый слой поверх карточки — фон на 25% ближе к белому
  var total = cards.length;
  var frame = 0;
  var active = false;

  function stackOffset() {
    return parseFloat(getComputedStyle(deck).getPropertyValue('--stack-offset')) || 16;
  }

  // Конечный масштаб накрытой карточки: чем глубже, тем меньше; последняя — 1.
  function scaleAtDepth(index) {
    return 1 - SCALE_STEP * (total - 1 - index);
  }

  function update() {
    frame = 0;
    if (!active) return;
    var stackTop = (header ? header.getBoundingClientRect().bottom : 0) + GAP_UNDER_HEADER;
    deck.style.setProperty('--stack-top', stackTop + 'px');
    var offset = stackOffset();
    // При уменьшении движения колода остаётся (это раскладка), но без
    // уменьшения накрытых карточек.
    var animate = !reduced.matches;

    // progress[i] — насколько карточку i уже накрыла следующая (0…1).
    var progress = [];
    for (var i = 0; i < total; i++) {
      var next = cards[i + 1];
      if (!next) { progress.push(0); continue; }
      var pinnedTop = stackTop + (i + 1) * offset;
      var dist = next.getBoundingClientRect().top - pinnedTop;
      var travel = Math.max(cards[i].offsetHeight - offset, 1);
      progress.push(dist <= 1 ? 1 : Math.min(1, Math.max(0, 1 - dist / travel)));
    }

    // Глубина карточки в колоде — сколько слоёв уже лежит поверх неё
    // (сумма progress её и всех следующих: карточки накрываются по
    // очереди). Каждый слой сверху осветляет голубой фон карточки на 25% в
    // сторону белого (--stack-whiten → color-mix в styles.css): чем ниже
    // карточка, тем она светлее, и слои читаются без тени и прозрачности.
    var depth = 0;
    for (var j = total - 1; j >= 0; j--) {
      depth += progress[j];
      var card = cards[j];
      if (depth <= 0.001) card.style.removeProperty('--stack-whiten');
      else card.style.setProperty('--stack-whiten', Math.min(100, WHITEN_STEP * depth) + '%');
      if (progress[j] >= 1) card.dataset.stackedCovered = '';
      else delete card.dataset.stackedCovered;
      if (!animate || progress[j] <= 0.001) {
        card.style.scale = '';
      } else {
        card.style.scale = String(1 + (scaleAtDepth(j) - 1) * progress[j]);
      }
    }
  }

  function onScroll() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function setMode() {
    var on = mobile.matches;
    if (on === active) { onScroll(); return; }
    active = on;
    if (on) {
      deck.setAttribute('data-stacked-deck', '');
      deck.style.setProperty('--stack-count', total);
      cards.forEach(function (card, i) {
        card.setAttribute('data-stacked-content', '');
        card.style.setProperty('--stack-index', i);
      });
      window.addEventListener('scroll', onScroll, { passive: true });
      update();
    } else {
      deck.removeAttribute('data-stacked-deck');
      window.removeEventListener('scroll', onScroll);
      cards.forEach(function (card) {
        card.removeAttribute('data-stacked-content');
        delete card.dataset.stackedCovered;
        card.style.scale = '';
        card.style.removeProperty('--stack-whiten');
      });
    }
  }

  setMode();
  window.addEventListener('resize', setMode);
})();

// Safari на iPhone не применяет :active (состояние нажатия кнопок), пока
// на странице нет ни одного обработчика касаний. Пустой пассивный
// обработчик включает :active и ничего не меняет в прокрутке.
document.addEventListener('touchstart', function () {}, { passive: true });
