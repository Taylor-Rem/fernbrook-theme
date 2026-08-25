/**
 * Fernbrook motion — sitewide scroll reveals + hero parallax.
 *
 * - Reveal: elements marked with [data-fb-reveal] (or auto-tagged sections and
 *   product cards) fade/slide in when they enter the viewport.
 * - Parallax: elements marked with [data-fb-parallax="<speed>"] drift on
 *   scroll. Transform/opacity only; one rAF-throttled scroll listener.
 *
 * The whole system is off when the visitor prefers reduced motion or when the
 * page is open in the Shopify theme editor (content must never be hidden from
 * the merchant while editing).
 */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var designMode = document.documentElement.classList.contains('shopify-design-mode');

  if (reducedMotion.matches || designMode || !('IntersectionObserver' in window)) return;

  // Added before first paint (this script is deferred) so reveal targets start
  // hidden without a flash. fernbrook-motion.css only hides elements under
  // this class.
  document.documentElement.classList.add('fb-motion');

  function init() {
    setupReveals();
    setupParallax();
  }

  /* ---------------------------------------------------------------- reveals */

  function setupReveals() {
    // Auto-tag top-level sections in the main content area so every page gets
    // a gentle entrance without per-section markup. The custom Fernbrook
    // sections opt out (data-fb-no-auto) because they stagger their own
    // children instead.
    var sections = document.querySelectorAll('#MainContent > .shopify-section');
    sections.forEach(function (section) {
      if (section.querySelector('[data-fb-no-auto], [data-fb-reveal]')) return;
      section.classList.add('fb-reveal');
    });

    // Stagger product cards within each grid (capped so deep grids don't lag).
    var cardGroups = new Map();
    document.querySelectorAll('.product-card').forEach(function (card) {
      if (card.hasAttribute('data-fb-reveal')) return;
      var parent = card.closest('ul, ol, [class*="grid"]') || card.parentElement;
      var index = cardGroups.get(parent) || 0;
      cardGroups.set(parent, index + 1);
      card.setAttribute('data-fb-reveal', '');
      card.style.setProperty('--fb-delay', Math.min(index, 5) * 80 + 'ms');
    });

    var targets = document.querySelectorAll('[data-fb-reveal], .fb-reveal');
    if (!targets.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('fb-in');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );

    targets.forEach(function (target) {
      // Anything already in view (above the fold) reveals immediately with its
      // own stagger delay; the observer still fires for it on first tick.
      observer.observe(target);
    });
  }

  /* --------------------------------------------------------------- parallax */

  function setupParallax() {
    var layers = Array.prototype.slice.call(document.querySelectorAll('[data-fb-parallax]'));
    if (!layers.length) return;

    var items = layers.map(function (el) {
      return { el: el, speed: parseFloat(el.getAttribute('data-fb-parallax')) || 0.1, visible: false };
    });

    var visibility = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var item = items.find(function (candidate) {
          return candidate.el === entry.target;
        });
        if (item) item.visible = entry.isIntersecting;
      });
    });
    items.forEach(function (item) {
      visibility.observe(item.el);
    });

    var ticking = false;

    function update() {
      ticking = false;
      var viewportHeight = window.innerHeight;
      items.forEach(function (item) {
        if (!item.visible) return;
        var host = item.el.closest('[data-fb-parallax-scope]') || item.el;
        var rect = host.getBoundingClientRect();
        // Progress of the host through the viewport: 0 entering, 1 leaving.
        var progress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
        var shift = (progress - 0.5) * item.speed * viewportHeight;
        item.el.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  // If the visitor flips on reduced motion mid-session, show everything and stop.
  reducedMotion.addEventListener('change', function (event) {
    if (event.matches) document.documentElement.classList.remove('fb-motion');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
