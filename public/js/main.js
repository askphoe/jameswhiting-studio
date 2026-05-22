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

  applyTypography(data.typography);

  autoInterval = data.gallery.interval || 5000;
  autoEnabled  = !!data.gallery.autoAdvance;

  const sorted = [...data.gallery.images].sort((a, b) => a.order - b.order);
  buildSlides(sorted);
  startAuto();

  document.getElementById('info-bio').innerHTML     = parseLinks(data.info.bio);
  document.getElementById('info-clients').innerHTML = parseLinks(data.info.clients);

  const instagram = document.getElementById('info-instagram');
  instagram.textContent = data.info.instagram;
  instagram.href        = data.info.instagramUrl;

  const email = document.getElementById('info-email');
  email.textContent = data.info.email;
  email.href        = 'mailto:' + data.info.email;

  if (data.nav) {
    document.getElementById('nav-info').textContent    = data.nav.information || 'Information';
    document.getElementById('nav-contact').textContent = data.nav.contact     || 'Contact';
  }
}

/* ── Admin panel ────────────────────────────────────────────────────────────── */

let apContent  = {};
let apSortable = null;
let apSelected = new Set();

function apPopulateStyle(typo) {
  const size = parseFloat(typo.fontSize);
  document.getElementById('ap-size').value       = size;
  document.getElementById('ap-size-val').textContent = size.toFixed(1) + 'rem';

  document.getElementById('ap-weight').value = typo.fontWeight;

  const kern = parseFloat(typo.letterSpacing);
  document.getElementById('ap-kerning').value            = kern;
  document.getElementById('ap-kerning-val').textContent  = kern.toFixed(3) + 'em';

  const lh = parseFloat(typo.lineHeight);
  document.getElementById('ap-lh').value           = lh;
  document.getElementById('ap-lh-val').textContent  = lh.toFixed(3);
}

function apPopulateContent(info, nav) {
  document.getElementById('ap-nav-info').value      = nav ? (nav.information || 'Information') : 'Information';
  document.getElementById('ap-nav-contact').value   = nav ? (nav.contact     || 'Contact')     : 'Contact';
  document.getElementById('ap-bio').value           = info.bio;
  document.getElementById('ap-clients').value       = info.clients;
  document.getElementById('ap-instagram').value     = info.instagram;
  document.getElementById('ap-instagram-url').value = info.instagramUrl;
  document.getElementById('ap-email').value         = info.email;
}

function apPopulateSettings(gallery) {
  document.getElementById('ap-auto').checked   = !!gallery.autoAdvance;
  document.getElementById('ap-interval').value = (gallery.interval || 5000) / 1000;
  document.getElementById('ap-interval-label').style.display = gallery.autoAdvance ? '' : 'none';
}

function apUpdateDeleteBtn() {
  const btn = document.getElementById('ap-delete-selected');
  if (apSelected.size > 0) {
    btn.textContent = `Delete selected (${apSelected.size})`;
    btn.removeAttribute('hidden');
  } else {
    btn.setAttribute('hidden', '');
  }
}

function apRenderGallery(images) {
  const grid   = document.getElementById('ap-image-grid');
  const sorted = [...images].sort((a, b) => a.order - b.order);

  apSelected.clear();
  apUpdateDeleteBtn();
  grid.innerHTML = '';

  sorted.forEach(image => {
    const card = document.createElement('div');
    card.className  = 'ap-image-card';
    card.dataset.id = image.id;

    const img = document.createElement('img');
    img.src = '/uploads/' + image.filename;
    img.alt = '';

    const del = document.createElement('button');
    del.className   = 'ap-del';
    del.textContent = '×';
    del.addEventListener('click', e => {
      e.stopPropagation();
      apDeleteImage(image.id);
    });

    card.addEventListener('click', () => {
      if (apSelected.has(image.id)) {
        apSelected.delete(image.id);
        card.classList.remove('selected');
      } else {
        apSelected.add(image.id);
        card.classList.add('selected');
      }
      apUpdateDeleteBtn();
    });

    card.append(img, del);
    grid.appendChild(card);
  });

  if (apSortable) apSortable.destroy();
  apSortable = Sortable.create(grid, {
    animation:  150,
    ghostClass: 'sortable-ghost',
    onEnd:      apSaveOrder
  });
}

async function apSaveOrder() {
  const order = [...document.querySelectorAll('.ap-image-card')].map(c => c.dataset.id);
  await fetch('/admin/api/images/reorder', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ order })
  });
  const map = Object.fromEntries(apContent.gallery.images.map(img => [img.id, img]));
  apContent.gallery.images = order.map((id, idx) => ({ ...map[id], order: idx }));
  buildSlides(apContent.gallery.images);
}

async function apDeleteImage(id) {
  if (!confirm('Delete this image?')) return;
  await fetch('/admin/api/images/' + id, { method: 'DELETE' });
  apContent.gallery.images = apContent.gallery.images.filter(i => i.id !== id);
  apRenderGallery(apContent.gallery.images);
  buildSlides([...apContent.gallery.images].sort((a, b) => a.order - b.order));
}

function apInitAdmin() {
  const trigger = document.getElementById('ap-trigger');
  const panel   = document.getElementById('ap-panel');
  const status  = document.getElementById('ap-status');

  trigger.removeAttribute('hidden');

  fetch('/admin/api/content').then(r => r.json()).then(data => {
    apContent = data;
    apPopulateStyle(data.typography);
    apPopulateContent(data.info, data.nav);
    apPopulateSettings(data.gallery);
    apRenderGallery(data.gallery.images);
  });

  // Open / close
  trigger.addEventListener('click', () => {
    panel.removeAttribute('hidden');
    document.body.classList.add('ap-open');
  });
  document.getElementById('ap-close').addEventListener('click', () => {
    panel.setAttribute('hidden', '');
    document.body.classList.remove('ap-open');
  });

  // Tabs
  document.querySelectorAll('.ap-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ap-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ap-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('ap-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Style: live updates
  document.getElementById('ap-size').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('ap-size-val').textContent = v.toFixed(1) + 'rem';
    document.documentElement.style.setProperty('--info-font-size', v + 'rem');
    document.documentElement.style.setProperty('--info-links-font-size', (v * 0.67).toFixed(2) + 'rem');
  });

  document.getElementById('ap-weight').addEventListener('change', e => {
    document.documentElement.style.setProperty('--info-font-weight', e.target.value);
  });

  document.getElementById('ap-kerning').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('ap-kerning-val').textContent = v.toFixed(3) + 'em';
    document.documentElement.style.setProperty('--info-letter-spacing', v + 'em');
  });

  document.getElementById('ap-lh').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('ap-lh-val').textContent = v.toFixed(3);
    document.documentElement.style.setProperty('--info-line-height', v);
  });

  // Settings: interval visibility
  document.getElementById('ap-auto').addEventListener('change', e => {
    document.getElementById('ap-interval-label').style.display = e.target.checked ? '' : 'none';
  });

  // Delete selected
  document.getElementById('ap-delete-selected').addEventListener('click', async () => {
    if (!apSelected.size || !confirm(`Delete ${apSelected.size} image(s)?`)) return;
    await Promise.all([...apSelected].map(id =>
      fetch('/admin/api/images/' + id, { method: 'DELETE' })
    ));
    apContent.gallery.images = apContent.gallery.images.filter(i => !apSelected.has(i.id));
    apRenderGallery(apContent.gallery.images);
    buildSlides([...apContent.gallery.images].sort((a, b) => a.order - b.order));
  });

  // Upload
  document.getElementById('ap-upload-btn').addEventListener('click', () =>
    document.getElementById('ap-file-input').click());

  document.getElementById('ap-file-input').addEventListener('change', async e => {
    const files = e.target.files;
    if (!files.length) return;

    const btn = document.getElementById('ap-upload-btn');
    btn.disabled    = true;
    btn.textContent = 'Uploading…';

    const form = new FormData();
    Array.from(files).forEach(f => form.append('images', f));

    const res  = await fetch('/admin/api/images', { method: 'POST', body: form });
    const data = await res.json();

    apContent.gallery.images.push(...data.images);
    apRenderGallery(apContent.gallery.images);
    buildSlides([...apContent.gallery.images].sort((a, b) => a.order - b.order));

    btn.disabled    = false;
    btn.textContent = '+ Upload';
    e.target.value  = '';
  });

  // Save
  document.getElementById('ap-save').addEventListener('click', async () => {
    const saveBtn = document.getElementById('ap-save');
    saveBtn.disabled = true;
    status.textContent = 'Saving…';

    const sizeVal    = parseFloat(document.getElementById('ap-size').value);
    const kerningVal = parseFloat(document.getElementById('ap-kerning').value);
    const lhVal      = parseFloat(document.getElementById('ap-lh').value);

    // Password change (only if fields filled)
    const pwCurrent = document.getElementById('ap-pw-current').value;
    const pwNew     = document.getElementById('ap-pw-new').value;
    const pwConfirm = document.getElementById('ap-pw-confirm').value;

    if (pwCurrent || pwNew || pwConfirm) {
      if (pwNew !== pwConfirm) {
        status.textContent = 'Passwords do not match.';
        saveBtn.disabled = false;
        return;
      }
      if (pwNew.length < 8) {
        status.textContent = 'Password must be ≥8 characters.';
        saveBtn.disabled = false;
        return;
      }
      const pwRes = await fetch('/admin/api/content/password', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ current: pwCurrent, next: pwNew })
      });
      if (!pwRes.ok) {
        const d = await pwRes.json();
        status.textContent = d.error || 'Password update failed.';
        saveBtn.disabled = false;
        return;
      }
      ['ap-pw-current', 'ap-pw-new', 'ap-pw-confirm'].forEach(id =>
        document.getElementById(id).value = '');
    }

    const payload = {
      nav: {
        information: document.getElementById('ap-nav-info').value.trim()    || 'Information',
        contact:     document.getElementById('ap-nav-contact').value.trim() || 'Contact'
      },
      info: {
        bio:          document.getElementById('ap-bio').value.trim(),
        clients:      document.getElementById('ap-clients').value.trim(),
        instagram:    document.getElementById('ap-instagram').value.trim(),
        instagramUrl: document.getElementById('ap-instagram-url').value.trim(),
        email:        document.getElementById('ap-email').value.trim()
      },
      typography: {
        fontSize:      sizeVal + 'rem',
        fontWeight:    document.getElementById('ap-weight').value,
        letterSpacing: kerningVal + 'em',
        lineHeight:    lhVal.toString()
      },
      gallery: {
        autoAdvance: document.getElementById('ap-auto').checked,
        interval:    parseInt(document.getElementById('ap-interval').value, 10) * 1000
      }
    };

    const res = await fetch('/admin/api/content', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    if (res.ok) {
      // Update nav live
      document.getElementById('nav-info').textContent    = payload.nav.information;
      document.getElementById('nav-contact').textContent = payload.nav.contact;

      // Update info overlay live
      document.getElementById('info-bio').innerHTML     = parseLinks(payload.info.bio);
      document.getElementById('info-clients').innerHTML = parseLinks(payload.info.clients);
      const igEl = document.getElementById('info-instagram');
      igEl.textContent = payload.info.instagram;
      igEl.href        = payload.info.instagramUrl;
      const emailEl = document.getElementById('info-email');
      emailEl.textContent = payload.info.email;
      emailEl.href        = 'mailto:' + payload.info.email;

      autoEnabled  = payload.gallery.autoAdvance;
      autoInterval = payload.gallery.interval;
      startAuto();

      status.textContent = 'Saved.';
    } else {
      status.textContent = 'Error saving.';
    }

    saveBtn.disabled = false;
    setTimeout(() => { status.textContent = ''; }, 3000);
  });

  // Logout
  document.getElementById('ap-logout').addEventListener('click', async () => {
    await fetch('/admin/logout', { method: 'POST' });
    panel.setAttribute('hidden', '');
    trigger.setAttribute('hidden', '');
    document.body.classList.remove('ap-open');
  });

  // Open panel if redirected from /admin login
  if (new URLSearchParams(location.search).get('adminopen') === '1') {
    panel.removeAttribute('hidden');
    document.body.classList.add('ap-open');
    history.replaceState({}, '', '/');
  }
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

    send.disabled      = true;
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

  // Check admin auth
  fetch('/admin/api/check').then(r => r.json()).then(data => {
    if (data.authenticated) apInitAdmin();
  });
});
