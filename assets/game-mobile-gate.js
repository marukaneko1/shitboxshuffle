/**
 * Mobile phone: block navigation to The Room (shitboxshuffle.html) and show desktop/iPad message.
 * Tablets/desktop (viewport width >= 768px): unchanged.
 */
(function () {
  'use strict';

  var BP = 768;

  function needsDesktopForPlay() {
    return window.innerWidth < BP;
  }

  function isGameRoomTarget(href) {
    if (!href || /^#|^javascript:/i.test(String(href).trim())) return false;
    try {
      var u = new URL(href, window.location.href);
      return /shitboxshuffle\.html$/i.test(u.pathname);
    } catch (e) {
      return /shitboxshuffle\.html/i.test(href);
    }
  }

  function injectStyles() {
    if (document.getElementById('sbox-game-gate-styles')) return;
    var s = document.createElement('style');
    s.id = 'sbox-game-gate-styles';
    s.textContent =
      '#sbox-game-gate-modal.sbox-gate-overlay,#sbox-room-block.sbox-gate-fullpage{' +
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}' +
      '.sbox-gate-overlay{position:fixed;inset:0;z-index:200000;background:rgba(3,3,3,0.92);' +
      'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;align-items:center;' +
      'justify-content:center;padding:max(20px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));' +
      'opacity:0;visibility:hidden;transition:opacity 0.35s ease,visibility 0.35s;}' +
      '.sbox-gate-overlay.sbox-gate-open{opacity:1;visibility:visible;}' +
      '.sbox-gate-card{max-width:22rem;width:100%;background:#141210;border:1px solid rgba(201,162,39,0.25);' +
      'border-radius:12px;padding:28px 24px 24px;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.6);}' +
      '.sbox-gate-card h2{font-size:1.15rem;font-weight:700;color:#f5f0e6;margin:0 0 12px;line-height:1.35;letter-spacing:0.02em;}' +
      '.sbox-gate-card p{font-size:0.9rem;color:rgba(232,224,208,0.72);line-height:1.55;margin:0 0 22px;}' +
      '.sbox-gate-card .sbox-gate-actions{display:flex;flex-direction:column;gap:10px;}' +
      '.sbox-gate-btn{display:block;width:100%;padding:14px 18px;border-radius:8px;font-size:0.8rem;font-weight:600;' +
      'letter-spacing:0.12em;text-transform:uppercase;border:none;cursor:pointer;touch-action:manipulation;}' +
      '.sbox-gate-btn-primary{background:#c9a227;color:#0a0908;}' +
      '.sbox-gate-btn-ghost{background:transparent;color:rgba(232,224,208,0.55);border:1px solid rgba(232,224,208,0.12);}' +
      '.sbox-gate-fullpage{position:fixed;inset:0;z-index:200000;background:#030303;color:#e8e0d0;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;' +
      'padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));}' +
      '.sbox-gate-fullpage h1{font-size:clamp(1.1rem,4.5vw,1.35rem);font-weight:700;margin:0 0 14px;max-width:18em;line-height:1.4;}' +
      '.sbox-gate-fullpage p{font-size:0.95rem;opacity:0.75;margin:0 0 28px;max-width:22em;line-height:1.55;}' +
      '.sbox-gate-fullpage .sbox-gate-btn{max-width:280px;}';
    document.head.appendChild(s);
  }

  function showModal() {
    injectStyles();
    var existing = document.getElementById('sbox-game-gate-modal');
    if (existing) {
      existing.classList.add('sbox-gate-open');
      document.body.style.overflow = 'hidden';
      return;
    }
    var overlay = document.createElement('div');
    overlay.id = 'sbox-game-gate-modal';
    overlay.className = 'sbox-gate-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'sbox-gate-title');
    overlay.innerHTML =
      '<div class="sbox-gate-card">' +
      '<h2 id="sbox-gate-title">Play on a computer or iPad</h2>' +
      '<p>The Room needs a larger screen for video, games, and controls. Open Shitbox Shuffle on a desktop browser or iPad to play.</p>' +
      '<div class="sbox-gate-actions">' +
      '<button type="button" class="sbox-gate-btn sbox-gate-btn-primary" data-sbox-gate-close>OK</button>' +
      '</div></div>';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector('[data-sbox-gate-close]').addEventListener('click', closeModal);
    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add('sbox-gate-open');
      document.body.style.overflow = 'hidden';
    });
  }

  function closeModal() {
    var m = document.getElementById('sbox-game-gate-modal');
    if (m) {
      m.classList.remove('sbox-gate-open');
      document.body.style.overflow = '';
    }
  }

  function blockDirectRoomVisit() {
    injectStyles();
    if (document.getElementById('sbox-room-block')) return;
    var home = location.pathname.indexOf('/blog/') !== -1 ? '../index.html' : 'index.html';
    var block = document.createElement('div');
    block.id = 'sbox-room-block';
    block.className = 'sbox-gate-fullpage';
    block.innerHTML =
      '<h1>This game needs a computer or iPad</h1>' +
      '<p>Shuffle Live and the table are built for larger screens. Please visit us from a desktop browser or iPad.</p>' +
      '<a class="sbox-gate-btn sbox-gate-btn-primary" href="' +
      home +
      '" style="text-decoration:none;display:inline-block;">Back to site</a>';
    document.body.appendChild(block);
    document.body.style.overflow = 'hidden';
  }

  function onDocClickCapture(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (!isGameRoomTarget(href)) return;
    if (!needsDesktopForPlay()) return;
    e.preventDefault();
    e.stopPropagation();
    showModal();
  }

  function wrapTransitionTo() {
    var fn = window.transitionTo;
    if (typeof fn !== 'function' || fn._sboxGateWrapped) return;
    function wrapped(url) {
      if (isGameRoomTarget(String(url)) && needsDesktopForPlay()) {
        showModal();
        return;
      }
      return fn.apply(this, arguments);
    }
    wrapped._sboxGateWrapped = true;
    window.transitionTo = wrapped;
  }

  function init() {
    injectStyles();
    var path = location.pathname || '';
    if (/\/shitboxshuffle\.html$/i.test(path) && needsDesktopForPlay()) {
      blockDirectRoomVisit();
      return;
    }
    wrapTransitionTo();
    document.addEventListener('click', onDocClickCapture, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.GameMobileGate = {
    needsDesktopForPlay: needsDesktopForPlay,
    isGameRoomTarget: isGameRoomTarget,
    showModal: showModal,
    closeModal: closeModal,
    tryGoToGame: function (url) {
      url = url || 'shitboxshuffle.html';
      if (isGameRoomTarget(url) && needsDesktopForPlay()) {
        showModal();
        return false;
      }
      window.location.href = url;
      return true;
    }
  };
})();
