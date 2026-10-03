const dialog = document.querySelector('.art-dialog');
const dialogArt = document.querySelector('.dialog-art');
const dialogCopy = document.querySelector('.dialog-copy');
const dialogTitle = document.querySelector('.dialog-title');
const dialogCount = document.querySelector('.dialog-count');
const artButtons = Array.from(document.querySelectorAll('.art-button'));
let openedFrom;
let activeIndex = 0;

function showArtwork(index) {
  activeIndex = (index + artButtons.length) % artButtons.length;
  const button = artButtons[activeIndex];
  const artwork = button.querySelector('.art-window').cloneNode(true);
  artwork.querySelector('img').loading = 'eager';
  dialogArt.replaceChildren(artwork);
  dialogCount.textContent = `${activeIndex + 1} / ${artButtons.length}`;

  const title = button.dataset.artTitle;
  dialogCopy.hidden = !title;
  dialogTitle.textContent = title || '';
}

artButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    openedFrom = button;
    showArtwork(index);
    dialog.showModal();
    document.body.classList.add('dialog-open');
  });
});

document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('.dialog-previous').addEventListener('click', () => showArtwork(activeIndex - 1));
document.querySelector('.dialog-next').addEventListener('click', () => showArtwork(activeIndex + 1));
dialog.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') showArtwork(activeIndex - 1);
  if (event.key === 'ArrowRight') showArtwork(activeIndex + 1);
});
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  openedFrom?.focus({ preventScroll: true });
});

const contactForm = document.querySelector('#contact-form');

if (contactForm) {
  const formStatus = contactForm.querySelector('.contact-form-status');
  const submitButton = contactForm.querySelector('button[type="submit"]');

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;

    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());
    submitButton.disabled = true;
    formStatus.classList.remove('is-success');
    formStatus.textContent = 'Sending…';

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Something went wrong.');
      contactForm.reset();
      formStatus.classList.add('is-success');
      formStatus.textContent = 'Thank you — Aleesha will be in touch soon.';
    } catch (error) {
      formStatus.textContent = `${error.message} You can also email hello@aleeshaloos.com.`;
    } finally {
      submitButton.disabled = false;
    }
  });
}
