/* ===== Motor de tour guiado (estilo Samsara / Navattic) =====
   Uso:
     EcoDriveTour.configurar({ boton: '#btn-tour', pasos: [{sel, titulo, texto}, ...], alIniciar(){} });
   o bien:
     EcoDriveTour.iniciar([...]);  EcoDriveTour.terminar();
*/
(function () {
  'use strict';

  var pasos = [];
  var cfg = {};
  var idx = 0;
  var activo = false;
  var elActual = null;

  var elBack = null;
  var elSpot = null;
  var elCard = null;
  var elEyebrow = null;
  var elTitulo = null;
  var elTexto = null;
  var elProg = null;
  var elPrev = null;
  var elNext = null;

  var PAD = 8;

  function construir() {
    if (elBack) return;

    elBack = document.createElement('div');
    elBack.className = 'tour-clickblock';

    elSpot = document.createElement('div');
    elSpot.className = 'tour-spot';

    elCard = document.createElement('div');
    elCard.className = 'tour-card';
    elCard.setAttribute('role', 'dialog');
    elCard.setAttribute('aria-modal', 'true');
    elCard.innerHTML =
      '<button class="tour-x" type="button" aria-label="Cerrar tour">&times;</button>' +
      '<span class="tour-eyebrow"></span>' +
      '<h3 class="tour-titulo"></h3>' +
      '<p class="tour-texto"></p>' +
      '<div class="tour-pie">' +
      '<span class="tour-prog"></span>' +
      '<div class="tour-botones">' +
      '<button class="tour-btn tour-prev" type="button">Atrás</button>' +
      '<button class="tour-btn tour-next" type="button">Siguiente</button>' +
      '</div>' +
      '</div>' +
      '<button class="tour-skip" type="button">Saltar tour</button>';

    document.body.appendChild(elBack);
    document.body.appendChild(elSpot);
    document.body.appendChild(elCard);

    elEyebrow = elCard.querySelector('.tour-eyebrow');
    elTitulo = elCard.querySelector('.tour-titulo');
    elTexto = elCard.querySelector('.tour-texto');
    elProg = elCard.querySelector('.tour-prog');
    elPrev = elCard.querySelector('.tour-prev');
    elNext = elCard.querySelector('.tour-next');

    elNext.addEventListener('click', siguiente);
    elPrev.addEventListener('click', anterior);
    elCard.querySelector('.tour-x').addEventListener('click', terminar);
    elCard.querySelector('.tour-skip').addEventListener('click', terminar);

    elBack.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    document.addEventListener('keydown', alTeclado, true);
    window.addEventListener('resize', recolocar);
    window.addEventListener('scroll', recolocar, { passive: true });
  }

  function alTeclado(e) {
    if (!activo) return;
    if (e.key === 'Escape') { terminar(); }
    else if (e.key === 'ArrowRight') { siguiente(); }
    else if (e.key === 'ArrowLeft') { anterior(); }
  }

  function recolocar() {
    if (!activo || !elActual) return;
    if (!recolocar.pendiente) {
      recolocar.pendiente = true;
      requestAnimationFrame(function () {
        recolocar.pendiente = false;
        posicionar(elActual);
      });
    }
  }

  function posicionar(el) {
    var r = el.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var top = Math.max(r.top - PAD, 6);
    var left = Math.max(r.left - PAD, 6);
    var width = Math.min(r.width + PAD * 2, vw - 12);
    var height = Math.min(r.height + PAD * 2, vh - 12);

    elSpot.style.top = top + 'px';
    elSpot.style.left = left + 'px';
    elSpot.style.width = width + 'px';
    elSpot.style.height = height + 'px';

    var cw = elCard.offsetWidth;
    var ch = elCard.offsetHeight;
    var espacioAbajo = vh - (top + height);
    var espacioArriba = top;

    var cy;
    if (espacioAbajo >= ch + 14 || espacioAbajo >= espacioArriba) {
      cy = top + height + 12;
    } else {
      cy = top - ch - 12;
    }
    cy = Math.min(Math.max(cy, 12), vh - ch - 12);

    var cx = r.left + r.width / 2 - cw / 2;
    cx = Math.min(Math.max(cx, 12), vw - cw - 12);

    elCard.style.top = cy + 'px';
    elCard.style.left = cx + 'px';
  }

  function pintar(paso) {
    elEyebrow.textContent = paso.etiqueta || 'Paso a paso';
    elTitulo.textContent = paso.titulo || '';
    elTexto.textContent = paso.texto || '';
    elProg.textContent = 'Paso ' + (idx + 1) + ' de ' + pasos.length;
    elPrev.disabled = idx === 0;
    elNext.textContent = idx === pasos.length - 1 ? 'Finalizar' : 'Siguiente';
  }

  function ir(i) {
    if (i < 0) i = 0;
    if (i > pasos.length - 1) i = pasos.length - 1;
    idx = i;
    var paso = pasos[idx];
    var el = document.querySelector(paso.sel);
    if (!el) {
      if (idx < pasos.length - 1) { ir(idx + 1); }
      return;
    }
    elActual = el;
    pintar(paso);

    try {
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    } catch (err) {
      el.scrollIntoView();
    }

    elCard.style.visibility = 'hidden';
    posicionar(el);
    requestAnimationFrame(function () {
      posicionar(el);
      elCard.style.visibility = 'visible';
    });
    setTimeout(function () {
      if (activo && elActual === el) posicionar(el);
    }, 360);
  }

  function siguiente() {
    if (!activo) return;
    if (idx >= pasos.length - 1) { terminar(); return; }
    ir(idx + 1);
  }

  function anterior() {
    if (!activo) return;
    if (idx <= 0) return;
    ir(idx - 1);
  }

  function iniciar(lista) {
    var fuente = lista || cfg.pasos || [];
    pasos = fuente.filter(function (p) {
      return p && p.sel && document.querySelector(p.sel);
    });
    if (!pasos.length) return;

    construir();
    activo = true;
    document.documentElement.classList.add('tour-activo');
    elBack.style.display = 'block';
    elSpot.style.display = 'block';
    elCard.style.display = 'block';
    elCard.style.visibility = 'hidden';
    ir(0);
  }

  function terminar() {
    if (!activo) return;
    activo = false;
    elActual = null;
    document.documentElement.classList.remove('tour-activo');
    document.removeEventListener('keydown', alTeclado, true);
    window.removeEventListener('resize', recolocar);
    window.removeEventListener('scroll', recolocar);
    [elBack, elSpot, elCard].forEach(function (n) {
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
    elBack = elSpot = elCard = elEyebrow = elTitulo = elTexto = elProg = elPrev = elNext = null;
  }

  function configurar(o) {
    cfg = o || {};
    var btn = cfg.boton && document.querySelector(cfg.boton);
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (typeof cfg.alIniciar === 'function') {
        try { cfg.alIniciar(); } catch (e) { /* ignora */ }
      }
      setTimeout(function () { iniciar(cfg.pasos); }, cfg.espera || 160);
    });
  }

  window.EcoDriveTour = {
    configurar: configurar,
    iniciar: iniciar,
    terminar: terminar
  };
})();
