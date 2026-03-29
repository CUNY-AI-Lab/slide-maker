export const CAROUSEL_JS = `
(function() {
  'use strict';

  document.querySelectorAll('.carousel').forEach(function(carousel) {
    var track = carousel.querySelector('.carousel-track');
    var items = carousel.querySelectorAll('.carousel-item');
    var dots = carousel.querySelectorAll('.carousel-dot');
    var prevBtn = carousel.querySelector('.carousel-prev');
    var nextBtn = carousel.querySelector('.carousel-next');
    var count = items.length;
    if (count === 0) return;

    var current = 0;
    var interval = carousel.dataset.interval ? parseInt(carousel.dataset.interval, 10) : 0;
    var timer = null;
    var synced = carousel.hasAttribute('data-sync-steps');

    function goTo(idx) {
      if (idx < 0) idx = count - 1;
      if (idx >= count) idx = 0;
      current = idx;
      if (track) track.style.transform = 'translateX(-' + (current * 100) + '%)';
      dots.forEach(function(d, i) { d.classList.toggle('active', i === current); });
    }

    // Expose goTo for deck engine sync
    carousel._goTo = goTo;

    function startAuto() {
      if (interval > 0 && !synced) {
        timer = setInterval(function() { goTo(current + 1); }, interval);
      }
    }

    function stopAuto() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    // Dot navigation
    dots.forEach(function(dot, i) {
      dot.addEventListener('click', function() { stopAuto(); goTo(i); startAuto(); });
    });

    // Prev / Next buttons
    if (prevBtn) prevBtn.addEventListener('click', function() { stopAuto(); goTo(current - 1); startAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', function() { stopAuto(); goTo(current + 1); startAuto(); });

    goTo(0);
    startAuto();
  });
})();
`
