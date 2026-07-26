document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('visitorForm');
  const messageBox = document.getElementById('formMessage');

  if (form) {
    // Prevent attaching multiple handlers if script is included twice
    if (form.dataset.listenerAttached === 'true') return;
    form.dataset.listenerAttached = 'true';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.dataset.submitting === 'true') return;
      form.dataset.submitting = 'true';
      // disable submit buttons to avoid double clicks
      const submitButtons = form.querySelectorAll('button[type="submit"]');
      submitButtons.forEach((btn) => {
        btn.disabled = true;
        btn.dataset.origText = btn.innerHTML;
        btn.innerHTML = 'Envoi...';
      });
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/visitor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-Token': payload._csrf || ''
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success) {
          messageBox.innerHTML = `<div class="alert alert-success">${data.message}</div>`;
          form.reset();
        } else {
          const errors = data.errors || ['Erreur de validation.'];
          messageBox.innerHTML = `<div class="alert alert-danger">${errors.join('<br>')}</div>`;
        }
      } catch (error) {
        messageBox.innerHTML = '<div class="alert alert-danger">Une erreur est survenue lors de l’envoi.</div>';
      }
      finally {
        form.dataset.submitting = 'false';
        const submitButtons = form.querySelectorAll('button[type="submit"]');
        submitButtons.forEach((btn) => {
          btn.disabled = false;
          if (btn.dataset.origText) btn.innerHTML = btn.dataset.origText;
        });
      }
    });
  }
});
