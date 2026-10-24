const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

async function hash(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  let input;
  try {
    input = await context.request.json();
  } catch {
    return Response.json({ error: 'Please complete the form and try again.' }, { status: 400 });
  }

  const name = clean(input.name, 120);
  const email = clean(input.email, 254).toLowerCase();
  const message = clean(input.message, 5000);
  const honeypot = clean(input.website, 200);

  if (honeypot) return Response.json({ ok: true });
  if (!name || !emailPattern.test(email) || !message) {
    return Response.json({ error: 'Please include your name, email and message.' }, { status: 400 });
  }
  if (!context.env.SIGNUP_DB || !context.env.RESEND_API_KEY || !context.env.CONTACT_FROM_EMAIL) {
    return Response.json({ error: 'The form is being set up. Please email hello@aleeshaloos.com.' }, { status: 503 });
  }

  const createdAt = new Date().toISOString();
  const id = await hash(email + '|' + message + '|' + createdAt.slice(0, 10));
  try {
    const prior = await context.env.SIGNUP_DB.prepare(
      'SELECT status FROM enquiries WHERE id = ?'
    ).bind(id).first();
    if (prior?.status === 'sent') return Response.json({ ok: true });

    await context.env.SIGNUP_DB.prepare(
      "INSERT OR IGNORE INTO enquiries (id, email, name, message, source, created_at, status) VALUES (?, ?, ?, ?, 'website', ?, 'pending')"
    ).bind(id, email, name, message, createdAt).run();

    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `enquiry-${id}`,
      },
      body: JSON.stringify({
        from: context.env.CONTACT_FROM_EMAIL,
        to: ['hello@aleeshaloos.com'],
        reply_to: email,
        subject: `New illustration enquiry — ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      }),
    });

    if (!sent.ok) {
      console.error('Resend enquiry delivery failed', sent.status);
      return Response.json({ error: 'Your enquiry could not be sent.' }, { status: 502 });
    }

    await context.env.SIGNUP_DB.prepare(
      "UPDATE enquiries SET status = 'sent' WHERE id = ?"
    ).bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Enquiry processing failed', error.message);
    return Response.json({ error: 'Your enquiry could not be sent. Please email hello@aleeshaloos.com.' }, { status: 502 });
  }
}
