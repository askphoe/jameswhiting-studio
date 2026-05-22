// If already authenticated, redirect straight to the site with panel open
fetch('/admin/api/check').then(r => r.json()).then(data => {
  if (data.authenticated) location.replace('/?adminopen=1');
});

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
    location.replace('/?adminopen=1');
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
