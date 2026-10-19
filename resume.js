(function () {
  // «Скачать PDF»: файл assets/Viskunova_Anastasia_CV.pdf (собирается
  // скриптом execution/build_resume_pdf.ps1). Пока файл грузится, стрелка
  // в кнопке сменяется крутящимся лоадером — видно, что система работает,
  // а не зависла. Файл качаем через fetch и отдаём браузеру как blob, чтобы
  // знать момент окончания загрузки. Если fetch недоступен (например,
  // страница открыта прямо с диска), браузер просто переходит по ссылке.
  var link = document.querySelector('[data-pdf-download]');
  if (link) {
    var busy = false;
    link.addEventListener('click', function (e) {
      if (busy) { e.preventDefault(); return; }
      if (!window.fetch || !window.URL || location.protocol === 'file:') return;
      e.preventDefault();
      busy = true;
      link.classList.add('is-loading');
      link.setAttribute('aria-busy', 'true');
      fetch(link.href)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = link.getAttribute('download') || 'CV.pdf';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        })
        .catch(function () {
          window.location.href = link.href;
        })
        .then(function () {
          busy = false;
          link.classList.remove('is-loading');
          link.removeAttribute('aria-busy');
        });
    });
  }

  // Крестик: закрывает резюме — возвращает на ту страницу сайта, с которой
  // пришли (кнопка CV в шапке открывает резюме в этой же вкладке). Если
  // пришли не с сайта (по прямой ссылке, из письма), ведёт на главную —
  // это обычный href у ссылки.
  var close = document.querySelector('[data-resume-close]');
  if (close) {
    close.addEventListener('click', function (e) {
      var ref = document.referrer;
      var sameSite = ref && ref.indexOf(location.origin) === 0 && location.origin !== 'null';
      if (sameSite && window.history.length > 1) {
        e.preventDefault();
        window.history.back();
      }
    });
  }
})();
