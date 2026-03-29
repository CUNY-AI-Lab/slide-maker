export const NAVIGATION_JS = `
(function() {
  'use strict';

  var slides = Array.from(document.querySelectorAll('#deck > .slide'));
  var currentSlide = 0;
  var currentStep = 0;
  var overviewMode = false;

  var counter = document.getElementById('slide-counter');
  var prevBtn = document.getElementById('prev-btn');
  var nextBtn = document.getElementById('next-btn');
  var scrubber = document.getElementById('scrubber');
  var announcer = document.getElementById('announcer');

  function announce(msg) {
    if (announcer) announcer.textContent = msg;
  }

  function getSteps(slide) {
    return Array.from(slide.querySelectorAll('[data-step]')).sort(function(a, b) {
      return parseInt(a.dataset.step) - parseInt(b.dataset.step);
    });
  }

  function showSlide(index, opts) {
    if (index < 0 || index >= slides.length) return;
    slides.forEach(function(s, i) {
      s.classList.toggle('active', i === index);
      s.setAttribute('aria-hidden', i !== index ? 'true' : 'false');
    });
    currentSlide = index;

    // Reset steps
    var steps = getSteps(slides[index]);
    if (opts && opts.revealAll) {
      steps.forEach(function(el) { el.classList.remove('step-hidden'); el.classList.add('step-visible'); });
      currentStep = steps.length;
    } else if (opts && opts.step !== undefined) {
      currentStep = opts.step;
      steps.forEach(function(el, i) {
        if (i < currentStep) { el.classList.remove('step-hidden'); el.classList.add('step-visible'); }
        else { el.classList.add('step-hidden'); el.classList.remove('step-visible'); }
      });
    } else {
      steps.forEach(function(el) { el.classList.add('step-hidden'); el.classList.remove('step-visible'); });
      currentStep = 0;
    }

    syncCarousels();
    updateUI();
    window.location.hash = '#/' + index;
    announce('Slide ' + (index + 1) + ' of ' + slides.length);
  }

  function updateUI() {
    if (counter) counter.textContent = (currentSlide + 1) + ' / ' + slides.length;
    if (scrubber) scrubber.value = currentSlide;
  }

  function syncCarousels() {
    var slide = slides[currentSlide];
    if (!slide) return;
    var synced = slide.querySelectorAll('.carousel[data-sync-steps]');
    synced.forEach(function(c) {
      if (typeof c._goTo === 'function') c._goTo(currentStep);
    });
  }

  function next() {
    if (overviewMode) return;
    var slide = slides[currentSlide];
    var steps = getSteps(slide);

    if (currentStep < steps.length) {
      var el = steps[currentStep];
      el.classList.remove('step-hidden');
      el.classList.add('step-visible');
      currentStep++;
      syncCarousels();
      announce('Step ' + currentStep + ' revealed');
      return;
    }

    if (currentSlide < slides.length - 1) {
      showSlide(currentSlide + 1);
    }
  }

  function prev() {
    if (overviewMode) return;

    if (currentStep > 0) {
      currentStep--;
      var steps = getSteps(slides[currentSlide]);
      var el = steps[currentStep];
      el.classList.add('step-hidden');
      el.classList.remove('step-visible');
      syncCarousels();
      announce('Step ' + (currentStep + 1) + ' hidden');
      return;
    }

    if (currentSlide > 0) {
      showSlide(currentSlide - 1, { revealAll: true });
    }
  }

  function toggleOverview() {
    overviewMode = !overviewMode;
    document.body.classList.toggle('overview-mode', overviewMode);
    if (overviewMode) {
      slides.forEach(function(s) { s.classList.add('active'); s.setAttribute('aria-hidden', 'false'); });
    } else {
      showSlide(currentSlide);
    }
  }

  // ── Keyboard ──
  document.addEventListener('keydown', function(e) {
    if (overviewMode && e.key !== 'Escape') {
      if (e.key === 'Enter' || e.key === ' ') {
        var idx = slides.findIndex(function(s) { return s.matches(':hover'); });
        if (idx >= 0) { currentSlide = idx; toggleOverview(); }
      }
      return;
    }
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case ' ':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp':
        e.preventDefault(); prev(); break;
      case 'Escape':
        e.preventDefault(); toggleOverview(); break;
    }
  });

  // ── Touch Swipe ──
  var touchStartX = 0;
  document.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; });
  document.addEventListener('touchend', function(e) {
    var diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 50) { diff > 0 ? prev() : next(); }
  });

  // ── Nav Buttons ──
  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);

  // ── Scrubber ──
  if (scrubber) {
    scrubber.addEventListener('input', function() {
      showSlide(parseInt(scrubber.value, 10));
    });
  }

  // ── Hash Navigation ──
  function handleHash() {
    var match = window.location.hash.match(/#\\/(\\d+)/);
    if (match) showSlide(parseInt(match[1], 10));
  }
  window.addEventListener('hashchange', handleHash);
  handleHash();
  if (currentSlide === 0) showSlide(0);
})();
`
