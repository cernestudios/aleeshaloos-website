const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

export async function onRequestPost(context) {
  let input;
  try {
    input = await context.request.json();
  } catch {
    return Response.json({ error: 'Please complete the form and try again.' }, { status: 400 });
  }

  const name = clean(input.name, 120);
  const email = clean(input.email, 254);
  const message = clean(input.message, 5000);
  const honeypot = clean(input.website, 200);

  if (honeypot) return Response.json({ ok: true });
  if (!name || !emailPattern.test(email) || !message) {
    return Response.json({ error: 'Please include your name, email and message.' }, { status: 400 });
  }
  if (!context.env.RESEND_API_KEY || !context.env.CONTACT_FROM_EMAIL) {
    return Response.json({ error: 'Email is being set up. Please email hello@aleeshaloos.com.' }, { status: 503 });
  }

  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
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
    console.error('Resend delivery failed', await sent.text());
    return Response.json({ error: 'Your enquiry could not be sent.' }, { status: 502 });
  }
  return Response.json({ ok: true });
}
