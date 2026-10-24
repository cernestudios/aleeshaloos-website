const ORIGIN = 'https://aleeshaloos.com';
const CONSENT_VERSION = '2026-10-24';
const json = (value, status = 200) => Response.json(value, {status, headers:{'Cache-Control':'no-store'}});
export function ready(env, source) {
  return ['wobble','halloween'].includes(source) && env.SIGNUPS_ENABLED === 'true' &&
    !!(env.SIGNUP_DB && env.RESEND_API_KEY && env.CONTACT_FROM_EMAIL &&
      (source !== 'halloween' || downloadURL(env)));
}
function downloadURL(env) {
  try { const u = new URL(env.HALLOWEEN_PDF_URL); return u.origin === ORIGIN && u.pathname.endsWith('.pdf') ? u.href : null; }
  catch { return null; }
}
export function onRequestGet({request, env}) {
  return json({ready:Boolean(ready(env, new URL(request.url).searchParams.get('source')))});
}
async function hash(text) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function send(env, to, subject, text, idempotency) {
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':idempotency},
    body:JSON.stringify({from:env.CONTACT_FROM_EMAIL,to:[to],reply_to:'hello@aleeshaloos.com',subject,text})
  });
  if (!response.ok) throw new Error('email_provider_' + response.status);
  return response.json();
}
export async function onRequestPost({request, env}) {
  if (request.headers.get('Origin') !== ORIGIN && request.headers.get('Origin') !== 'https://www.aleeshaloos.com') return json({error:'Please use the form on aleeshaloos.com.'},403);
  if (!request.headers.get('Content-Type')?.includes('application/json')) return json({error:'Please use the signup form.'},415);
  const body = await request.text();
  if(body.length > 4096) return json({error:'Please shorten your details.'},413);
  let input;
  try { input = JSON.parse(body); } catch { return json({error:'Please complete the form.'},400); }
  const source = input.source;
  if(!ready(env,source)) return json({error:'Signups are paused while setup is finished. Please download the sheet directly or email hello@aleeshaloos.com.'},503);
  if(input.website) return json({ok:true});
  const email = String(input.email || '').trim().toLowerCase();
  const name = String(input.name || '').trim().slice(0,80);
  const updates = input.updates === true;
  if(email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'Please enter a valid email address.'},400);
  const now = new Date().toISOString();
  const id = await hash(email+'|'+source+'|'+updates+'|'+now.slice(0,10));
  const ip = await hash((request.headers.get('CF-Connecting-IP') || '')+'|'+now.slice(0,10));
  try {
    const prior = await env.SIGNUP_DB.prepare('SELECT status FROM signup_requests WHERE id = ?').bind(id).first();
    if(prior?.status === 'sent') return json({ok:true,...(source === 'halloween'?{download:downloadURL(env)}:{})});
    const rate = await env.SIGNUP_DB.prepare("SELECT COUNT(*) AS n FROM signup_requests WHERE ip_hash = ? AND created_at > ?").bind(ip,new Date(Date.now()-3600000).toISOString()).first();
    if(rate.n >= 20) return json({error:'Please try again a little later.'},429);
    await env.SIGNUP_DB.prepare("INSERT OR IGNORE INTO signup_requests (id,email,name,source,updates,consent_version,created_at,ip_hash,status) VALUES (?,?,?,?,?,?,?,?,'pending')").bind(id,email,name,source,updates?1:0,CONSENT_VERSION,now,ip).run();
    const greeting = name ? 'Hi '+name+',' : 'Hello,';
    const text = source === 'halloween'
      ? greeting+'\n\nHere’s your little Halloween treat!\n\nDownload your colouring sheet: '+downloadURL(env)+'\n\nThank you for making a little time to create.\n\nAleesha\nhttps://aleeshaloos.com'
      : greeting+'\n\nYou’re on Wobble’s pre-release waitlist. I’ll email you when Wobble and the Big Feeling is ready. This isn’t a preorder or reservation.\n\nThank you for making room for this little friend.\n\nAleesha\nhttps://aleeshaloos.com/wobble/';
    await send(env,email,source === 'halloween'?'Your little Halloween colouring treat':'You’re on Wobble’s list!',text,'signup-'+id);
    await send(env,'hello@aleeshaloos.com','New '+(source === 'halloween'?'Halloween sheet request':'Wobble waitlist signup'), 'Name: '+(name || 'Not provided')+'\nEmail: '+email+'\nInterest: '+source+'\nGeneral updates opt-in: '+(updates?'Yes':'No'), 'signup-owner-'+id);
    await env.SIGNUP_DB.prepare("UPDATE signup_requests SET status='sent' WHERE id=?").bind(id).run();
    return json({ok:true,...(source === 'halloween'?{download:downloadURL(env)}:{})});
  } catch(error) {
    console.error('Signup processing failed',error.message);
    return json({error:'We couldn’t finish sending the confirmation. Please try again shortly, or email hello@aleeshaloos.com.'},502);
  }
}
