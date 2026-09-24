(function () {
  var lightbox = document.getElementById('imgLightbox');
  if (!lightbox) return;

  var img = document.getElementById('lightboxImg');
  var viewport = document.getElementById('lightboxViewport');
  var zoomInBtn = document.getElementById('lightboxZoomIn');
  var zoomOutBtn = document.getElementById('lightboxZoomOut');
  var zoomValue = document.getElementById('lightboxZoomValue');
  var closeBtn = document.getElementById('lightboxCloseBtn');

  var ZOOM_STEP = 0.25;
  var minScale = 1; // масштаб «по ширине окна» — картинка целиком по ширине, без искажений
  var maxScale = 1; // 100% — натуральный размер картинки
  var scale = 1;
  var naturalWidth = 0;
  var naturalHeight = 0;
  var panX = 0;
  var panY = 0;
  var lastFocused = null;

  var dragging = false;
  var dragPointerId = null;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragStartPanX = 0;
  var dragStartPanY = 0;

  function recomputeScaleRange() {
    var fitWidthScale = viewport.clientWidth / naturalWidth;
    minScale = fitWidthScale;
    maxScale = Math.max(1, fitWidthScale);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function applyTransform() {
    var displayWidth = naturalWidth * scale;
    var displayHeight = naturalHeight * scale;
    img.style.width = displayWidth + 'px';
    img.style.height = displayHeight + 'px';

    var maxPanX = Math.max(0, (displayWidth - viewport.clientWidth) / 2);
    var maxPanY = Math.max(0, (displayHeight - viewport.clientHeight) / 2);
    panX = clamp(panX, -maxPanX, maxPanX);
    panY = clamp(panY, -maxPanY, maxPanY);

    img.style.transform = 'translate(-50%, -50%) translate(' + panX + 'px, ' + panY + 'px)';

    zoomValue.textContent = Math.round(scale * 100) + '%';
    zoomInBtn.disabled = scale >= maxScale - 0.001;
    zoomOutBtn.disabled = scale <= minScale + 0.001;
  }

  function onImgLoad() {
    naturalWidth = img.naturalWidth;
    naturalHeight = img.naturalHeight;
    recomputeScaleRange();
    scale = minScale;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  function openLightbox(src, alt) {
    lastFocused = document.activeElement;
    img.src = src;
    img.alt = alt || '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';

    if (img.complete && img.naturalWidth) {
      onImgLoad();
    } else {
      img.onload = onImgLoad;
    }
    closeBtn.focus();
  }

  function closeLightbox() {
    pointers.clear();
    dragging = false;
    viewport.classList.remove('is-dragging');
    lightbox.hidden = true;
    document.body.style.overflow = '';
    img.removeAttribute('src');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  document.querySelectorAll('[data-lightbox-src]').forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      openLightbox(trigger.getAttribute('data-lightbox-src'), trigger.getAttribute('data-lightbox-alt'));
    });
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(trigger.getAttribute('data-lightbox-src'), trigger.getAttribute('data-lightbox-alt'));
      }
    });
  });

  zoomInBtn.addEventListener('click', function () {
    scale = Math.min(maxScale, scale + ZOOM_STEP);
    applyTransform();
  });

  zoomOutBtn.addEventListener('click', function () {
    scale = Math.max(minScale, scale - ZOOM_STEP);
    applyTransform();
  });

  closeBtn.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });

  window.addEventListener('resize', function () {
    if (lightbox.hidden || !naturalWidth) return;
    recomputeScaleRange();
    scale = clamp(scale, minScale, maxScale);
    applyTransform();
  });

  // Перетаскивание одним пальцем/мышью вместо скролла, когда картинка больше
  // окна, и щипок двумя пальцами для масштаба (в дополнение к кнопкам лупы).
  // Все активные касания хранятся в pointers; два касания — режим щипка.
  var pointers = new Map();
  var pinchStartDist = 0;
  var pinchStartScale = 1;
  // Точка картинки (в её натуральных координатах относительно центра),
  // которая в начале щипка была под серединой между пальцами, — её и
  // удерживаем под пальцами, пока масштаб меняется.
  var pinchAnchorX = 0;
  var pinchAnchorY = 0;

  function pointerDistance() {
    var pts = Array.from(pointers.values());
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function pointerMidpoint() {
    var pts = Array.from(pointers.values());
    var rect = viewport.getBoundingClientRect();
    return {
      x: (pts[0].x + pts[1].x) / 2 - rect.left - viewport.clientWidth / 2,
      y: (pts[0].y + pts[1].y) / 2 - rect.top - viewport.clientHeight / 2
    };
  }

  function startDragFrom(e) {
    dragging = true;
    dragPointerId = e.pointerId;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
    viewport.classList.add('is-dragging');
  }

  function startPinch() {
    dragging = false;
    dragPointerId = null;
    var mid = pointerMidpoint();
    pinchStartDist = pointerDistance() || 1;
    pinchStartScale = scale;
    pinchAnchorX = (mid.x - panX) / scale;
    pinchAnchorY = (mid.y - panY) / scale;
  }

  viewport.addEventListener('pointerdown', function (e) {
    if (!naturalWidth) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    viewport.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      startPinch();
    } else if (pointers.size === 1) {
      startDragFrom(e);
    }
  });

  viewport.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2) {
      scale = clamp(pinchStartScale * pointerDistance() / pinchStartDist, minScale, maxScale);
      var mid = pointerMidpoint();
      panX = mid.x - pinchAnchorX * scale;
      panY = mid.y - pinchAnchorY * scale;
      applyTransform();
      return;
    }

    if (!dragging || e.pointerId !== dragPointerId) return;
    panX = dragStartPanX + (e.clientX - dragStartX);
    panY = dragStartPanY + (e.clientY - dragStartY);
    applyTransform();
  });

  function endDrag(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);

    if (pointers.size === 1) {
      // Один палец отпустили после щипка — оставшимся продолжаем
      // перетаскивание без рывка (стартовая точка — его текущая позиция).
      var id = pointers.keys().next().value;
      var pt = pointers.get(id);
      startDragFrom({ pointerId: id, clientX: pt.x, clientY: pt.y });
    } else if (pointers.size === 0) {
      dragging = false;
      dragPointerId = null;
      viewport.classList.remove('is-dragging');
    }
  }

  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
})();

(function () {
  var modal = document.getElementById('videoModal');
  if (!modal) return;

  var player = document.getElementById('videoModalPlayer');
  var closeBtn = document.getElementById('videoModalCloseBtn');
  var lastFocused = null;

  function openVideoModal(src) {
    lastFocused = document.activeElement;
    player.src = src;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    player.play().catch(function () {});
    closeBtn.focus();
  }

  function closeVideoModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    player.pause();
    player.removeAttribute('src');
    player.load();
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  document.querySelectorAll('[data-video-src]').forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      openVideoModal(trigger.getAttribute('data-video-src'));
    });
  });

  modal.querySelectorAll('[data-video-modal-close]').forEach(function (el) {
    el.addEventListener('click', closeVideoModal);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeVideoModal();
  });
})();
