/* ── Auth ───────────────────────────────────────────────────────────────────── */

async function checkAuth() {
  const res  = await fetch('/admin/api/check');
  const data = await res.json();
  return data.authenticated;
}

async function init() {
  const authed = await checkAuth();
  if (authed) {
    showApp();
  } else {
    document.getElementById('login-screen').style.display = '';
  }
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const password = document.getElementById('login-password').value;
  const error    = document.getElementById('login-error');

  const res = await fetch('/admin/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ password })
  });

  if (res.ok) {
    showApp();
  } else {
    error.textContent = 'Incorrect password.';
  }
});

document.getElementById('forgot-link').addEventListener('click', async e => {
  e.preventDefault();
  const link = e.target;
  link.textContent = 'Sending…';

  const res = await fetch('/admin/api/reset-request', { method: 'POST' });
  link.textContent = res.ok
    ? 'Reset link sent to hello@jameswhitingstudio.com'
    : 'Failed to send — check server email config.';
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/admin/logout', { method: 'POST' });
  location.reload();
});

/* ── App shell ──────────────────────────────────────────────────────────────── */

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').hidden = false;
  loadContent();
}

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

/* ── Content ────────────────────────────────────────────────────────────────── */

let content = {};

async function loadContent() {
  const res = await fetch('/admin/api/content');
  content   = await res.json();
  renderGallery();
  populateInfo();
  populateSettings();
}

/* ── Gallery ────────────────────────────────────────────────────────────────── */

let sortable = null;

function renderGallery() {
  const grid   = document.getElementById('image-grid');
  const images = [...content.gallery.images].sort((a, b) => a.order - b.order);

  grid.innerHTML = '';

  images.forEach(image => {
    const card = document.createElement('div');
    card.className    = 'image-card';
    card.dataset.id   = image.id;

    const img = document.createElement('img');
    img.src = '/uploads/' + image.filename;
    img.alt = '';

    const del = document.createElement('button');
    del.className   = 'delete-btn';
    del.textContent = '×';
    del.title       = 'Delete';
    del.addEventListener('click', () => deleteImage(image.id));

    card.append(img, del);
    grid.appendChild(card);
  });

  // Drag-to-reorder
  if (sortable) sortable.destroy();
  sortable = Sortable.create(grid, {
    animation:    150,
    ghostClass:   'sortable-ghost',
    onEnd: saveOrder
  });
}

async function saveOrder() {
  const order = [...document.querySelectorAll('.image-card')].map(c => c.dataset.id);
  await fetch('/admin/api/images/reorder', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ order })
  });
}

async function deleteImage(id) {
  if (!confirm('Delete this image?')) return;
  await fetch('/admin/api/images/' + id, { method: 'DELETE' });
  content.gallery.images = content.gallery.images.filter(i => i.id !== id);
  renderGallery();
}

// Upload
document.getElementById('upload-btn').addEventListener('click', () =>
  document.getElementById('file-input').click());

document.getElementById('file-input').addEventListener('change', async e => {
  const files = e.target.files;
  if (!files.length) return;

  const btn  = document.getElementById('upload-btn');
  btn.disabled    = true;
  btn.textContent = 'Uploading…';

  const form = new FormData();
  Array.from(files).forEach(f => form.append('images', f));

  const res  = await fetch('/admin/api/images', { method: 'POST', body: form });
  const data = await res.json();

  content.gallery.images.push(...data.images);
  renderGallery();

  btn.disabled    = false;
  btn.textContent = '+ Upload images';
  e.target.value  = '';
});

/* ── Information ────────────────────────────────────────────────────────────── */

function populateInfo() {
  document.getElementById('info-bio').value              = content.info.bio;
  document.getElementById('info-clients').value          = content.info.clients;
  document.getElementById('info-instagram').value        = content.info.instagram;
  document.getElementById('info-instagram-url').value    = content.info.instagramUrl;
  document.getElementById('info-email').value            = content.info.email;

  const t = content.typography;
  document.getElementById('typo-size').value        = parseFloat(t.fontSize);
  document.getElementById('typo-weight').value      = t.fontWeight;
  document.getElementById('typo-kerning').value     = parseFloat(t.letterSpacing);
  document.getElementById('typo-line-height').value = parseFloat(t.lineHeight);
}

document.getElementById('save-info').addEventListener('click', async () => {
  const btn    = document.getElementById('save-info');
  const status = document.getElementById('save-info-status');

  btn.disabled    = true;
  status.textContent = 'Saving…';

  const payload = {
    info: {
      bio:          document.getElementById('info-bio').value.trim(),
      clients:      document.getElementById('info-clients').value.trim(),
      instagram:    document.getElementById('info-instagram').value.trim(),
      instagramUrl: document.getElementById('info-instagram-url').value.trim(),
      email:        document.getElementById('info-email').value.trim()
    },
    typography: {
      fontSize:      document.getElementById('typo-size').value + 'rem',
      fontWeight:    document.getElementById('typo-weight').value,
      letterSpacing: document.getElementById('typo-kerning').value + 'em',
      lineHeight:    document.getElementById('typo-line-height').value
    }
  };

  const res = await fetch('/admin/api/content', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });

  status.textContent = res.ok ? 'Saved.' : 'Error saving — please try again.';
  btn.disabled = false;
  setTimeout(() => { status.textContent = ''; }, 3000);
});

/* ── Settings ───────────────────────────────────────────────────────────────── */

function populateSettings() {
  document.getElementById('setting-auto').checked   = content.gallery.autoAdvance;
  document.getElementById('setting-interval').value = (content.gallery.interval || 5000) / 1000;
  document.getElementById('interval-label').style.display =
    content.gallery.autoAdvance ? '' : 'none';
}

document.getElementById('setting-auto').addEventListener('change', e => {
  document.getElementById('interval-label').style.display = e.target.checked ? '' : 'none';
});

document.getElementById('save-settings').addEventListener('click', async () => {
  const btn    = document.getElementById('save-settings');
  const status = document.getElementById('save-settings-status');

  btn.disabled    = true;
  status.textContent = 'Saving…';

  // Gallery settings
  const galleryPayload = {
    gallery: {
      autoAdvance: document.getElementById('setting-auto').checked,
      interval:    parseInt(document.getElementById('setting-interval').value, 10) * 1000
    }
  };

  const res1 = await fetch('/admin/api/content', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(galleryPayload)
  });

  // Password change (only if fields filled)
  const pwCurrent = document.getElementById('pw-current').value;
  const pwNew     = document.getElementById('pw-new').value;
  const pwConfirm = document.getElementById('pw-confirm').value;

  let pwResult = true;
  if (pwCurrent || pwNew || pwConfirm) {
    if (pwNew !== pwConfirm) {
      status.textContent = 'New passwords do not match.';
      btn.disabled = false;
      return;
    }
    if (pwNew.length < 8) {
      status.textContent = 'New password must be at least 8 characters.';
      btn.disabled = false;
      return;
    }

    const res2 = await fetch('/admin/api/content/password', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ current: pwCurrent, next: pwNew })
    });

    pwResult = res2.ok;
    if (!res2.ok) {
      const data = await res2.json();
      status.textContent = data.error || 'Password update failed.';
      btn.disabled = false;
      return;
    }

    ['pw-current', 'pw-new', 'pw-confirm'].forEach(id =>
      document.getElementById(id).value = '');
  }

  status.textContent = (res1.ok && pwResult) ? 'Saved.' : 'Error saving — please try again.';
  btn.disabled = false;
  setTimeout(() => { status.textContent = ''; }, 3000);
});

/* ── Start ──────────────────────────────────────────────────────────────────── */

init();
