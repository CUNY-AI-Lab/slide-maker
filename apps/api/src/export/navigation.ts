export const NAVIGATION_JS = `
(function() {
  'use strict';
  const slides = Array.from(document.querySelectorAll('.slide-section'));
  let currentIndex = 0;
  let overviewMode = false;
  const counter = document.getElementById('slide-counter');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  function showSlide(index) {
    if (index < 0 || index >= slides.length) return;
    slides.forEach(function(s, i) {
      s.classList.toggle('active', i === index);
      s.setAttribute('aria-hidden', i !== index ? 'true' : 'false');
    });
    currentIndex = index;
    if (counter) counter.textContent = (index + 1) + ' / ' + slides.length;
    window.location.hash = '#/' + index;
  }

  function next() {
    var active = slides[currentIndex];
    var hidden = active.querySelector('.fragment:not(.visible)');
    if (hidden) { hidden.classList.add('visible'); return; }
    showSlide(currentIndex + 1);
  }

  function prev() { showSlide(currentIndex - 1); }

  function toggleOverview() {
    overviewMode = !overviewMode;
    document.body.classList.toggle('overview-mode', overviewMode);
    if (overviewMode) {
      slides.forEach(function(s) { s.classList.add('active'); s.setAttribute('aria-hidden', 'false'); });
    } else { showSlide(currentIndex); }
  }

  document.addEventListener('keydown', function(e) {
    if (overviewMode && e.key !== 'Escape') {
      if (e.key === 'Enter' || e.key === ' ') {
        var idx = slides.findIndex(function(s) { return s.matches(':hover'); });
        if (idx >= 0) { currentIndex = idx; toggleOverview(); }
      }
      return;
    }
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case ' ': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); prev(); break;
      case 'Escape': e.preventDefault(); toggleOverview(); break;
    }
  });

  var touchStartX = 0;
  document.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; });
  document.addEventListener('touchend', function(e) {
    var diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 50) { diff > 0 ? prev() : next(); }
  });

  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);

  function handleHash() {
    var match = window.location.hash.match(/#\\/(\\d+)/);
    if (match) showSlide(parseInt(match[1], 10));
  }
  window.addEventListener('hashchange', handleHash);
  handleHash();
  if (currentIndex === 0) showSlide(0);
})();
`
