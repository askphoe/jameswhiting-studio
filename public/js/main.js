/* ── State ─────────────────────────────────────────────────────────────────── */

let slides        = [];
let current       = 0;
let autoTimer     = null;
let autoInterval  = 5000;
let autoEnabled   = false;
let overlayOpen   = false;

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function parseLinks(text) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function applyTypography(typo) {
  const r = document.documentElement.style;
  r.setProperty('--info-font-size',       typo.fontSize);
  r.setProperty('--info-font-weight',     typo.fontWeight);
  r.setProperty('--info-letter-spacing',  typo.letterSpacing);
  r.setProperty('--info-line-height',     typo.lineHeight);
  // Links slightly smaller than body
  const base = parseFloat(typo.fontSize);
  r.setProperty('--info-links-font-size', (base * 0.67).toFixed(2) + typo.fontSize.replace(/[\d.]/g, ''));
}

/* ── Gallery ───────────────────────────────────────────────────────────────── */

function buildSlides(images) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  slides = [];

  images.forEach((image, i) => {
    const div = document.createElement('div');
    div.className = 'slide' + (i === 0 ? ' active' : '');

    const img = document.createElement('img');
    img.src = '/uploads/' + image.filename;
    img.alt = '';
    img.draggable = false;

    img.addEventListener('load', () => {
      const portrait = img.naturalHeight > img.naturalWidth;
      div.classList.add(portrait ? 'portrait' : 'landscape');
    });

    div.appendChild(img);
    gallery.appendChild(div);
    slides.push(div);
  });
}

function showSlide(index) {
  slides.forEach((s, i) => s.classList.toggle('active', i === index));
  current = index;
}

function nextSlide() {
  if (!slides.length) return;
  showSlide((current + 1) % slides.length);
}

function startAuto() {
  clearInterval(autoTimer);
  if (autoEnabled && !overlayOpen) {
    autoTimer = setInterval(nextSlide, autoInterval);
  }
}

function stopAuto() {
  clearInterval(autoTimer);
}

/* ── Overlays ──────────────────────────────────────────────────────────────── */

function openOverlay(el) {
  overlayOpen = true;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  stopAuto();
}

function closeOverlay(el) {
  overlayOpen = false;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  startAuto();
}

/* ── Content ───────────────────────────────────────────────────────────────── */

async function loadContent() {
  const res  = await fetch('/api/content');
  const data = await res.json();

  // Typography
  applyTypography(data.typography);

  // Gallery
  autoInterval = data.gallery.interval || 5000;
  autoEnabled  = !!data.gallery.autoAdvance;

  const sorted = [...data.gallery.images].sort((a, b) => a.order - b.order);
  buildSlides(sorted);
  startAuto();

  // Info
  document.getElementById('info-bio').innerHTML     = parseLinks(data.info.bio);
  document.getElementById('info-clients').innerHTML = parseLinks(data.info.clients);

  const instagram = document.getElementById('info-instagram');
  instagram.textContent = data.info.instagram;
  instagram.href        = data.info.instagramUrl;

  const email = document.getElementById('info-email');
  email.textContent = data.info.email;
  email.href        = 'mailto:' + data.info.email;
}

/* ── Event listeners ───────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  loadContent();

  const infoOverlay    = document.getElementById('info-overlay');
  const contactOverlay = document.getElementById('contact-overlay');
  const galleryClick   = document.getElementById('gallery-click');

  // Gallery advance
  galleryClick.addEventListener('click', () => {
    if (!overlayOpen) nextSlide();
  });

  // Pause auto on hover
  galleryClick.addEventListener('mouseenter', stopAuto);
  galleryClick.addEventListener('mouseleave', startAuto);

  // Nav: Information
  document.getElementById('nav-info').addEventListener('click', e => {
    e.preventDefault();
    openOverlay(infoOverlay);
  });

  // Nav: Contact
  document.getElementById('nav-contact').addEventListener('click', e => {
    e.preventDefault();
    openOverlay(contactOverlay);
  });

  // Info: close
  document.getElementById('info-close').addEventListener('click', e => {
    e.preventDefault();
    closeOverlay(infoOverlay);
  });

  // Contact: cancel
  document.getElementById('contact-cancel').addEventListener('click', () => {
    closeOverlay(contactOverlay);
    document.getElementById('contact-form').reset();
    document.getElementById('contact-status').textContent = '';
  });

  // Contact: close on backdrop click
  contactOverlay.addEventListener('click', e => {
    if (e.target === contactOverlay) {
      closeOverlay(contactOverlay);
      document.getElementById('contact-form').reset();
      document.getElementById('contact-status').textContent = '';
    }
  });

  // Contact: submit
  document.getElementById('contact-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form   = e.target;
    const status = document.getElementById('contact-status');
    const send   = document.getElementById('contact-send');

    send.disabled    = true;
    status.textContent = 'Sending...';

    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          from:    form.from.value,
          message: form.message.value
        })
      });

      if (res.ok) {
        status.textContent = 'Message sent.';
        form.reset();
        setTimeout(() => {
          closeOverlay(contactOverlay);
          status.textContent = '';
        }, 1800);
      } else {
        status.textContent = 'Something went wrong — please try again.';
      }
    } catch {
      status.textContent = 'Could not connect — please try again.';
    } finally {
      send.disabled = false;
    }
  });

  // Keyboard: Escape closes overlays
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (infoOverlay.classList.contains('open'))    closeOverlay(infoOverlay);
    if (contactOverlay.classList.contains('open')) closeOverlay(contactOverlay);
  });
});
