document.querySelectorAll('[data-signup]').forEach(async card => {
  const source = card.dataset.signup;
  const form = card.querySelector('form');
  const availability = card.querySelector('.signup-availability');
  try {
    const response = await fetch('/api/signup?source=' + source);
    const state = await response.json();
    if (!response.ok || !state.ready) return;
    availability.hidden = true;
    form.hidden = false;
  } catch { return; }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('button');
    const error = form.querySelector('.signup-error');
    const label = button.textContent;
    button.disabled = true; button.textContent = 'Sending a little hello…'; error.hidden = true;
    const values = new FormData(form);
    try {
      const response = await fetch('/api/signup', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({source, name: values.get('name'), email: values.get('email'), updates: values.get('updates') === 'on', website: values.get('website')})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
      form.hidden = true; card.querySelector('.signup-intro').hidden = true;
      const thanks = card.querySelector('.signup-thanks');
      if (result.download) {
        const link = thanks.querySelector('.download-link');
        link.href = result.download; link.hidden = false;
      }
      thanks.hidden = false; thanks.focus();
    } catch (reason) {
      error.textContent = reason.message || 'Please try again in a moment.';
      error.hidden = false;
    } finally { button.disabled = false; button.textContent = label; }
  });
});
