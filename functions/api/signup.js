const ORIGIN = 'https://aleeshaloos.com';
const CONSENT_VERSION = '2026-10-24';
const json = (value, status = 200) => Response.json(value, {status, headers:{'Cache-Control':'no-store'}});
export function ready(env, source) {
  return ['wobble','halloween'].includes(source) && env.SIGNUPS_ENABLED === 'true' &&
    !!(env.SIGNUP_DB && env.SIGNUP_RESEND_API_KEY && env.CONTACT_FROM_EMAIL &&
      env.RESEND_WOBBLE_SEGMENT && env.RESEND_GENERAL_SEGMENT &&
      env.RESEND_WOBBLE_TOPIC && env.RESEND_GENERAL_TOPIC &&
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
async function api(env, path, method = 'GET', body, idempotency) {
  const response = await fetch('https://api.resend.com' + path, {
    method, headers:{Authorization:'Bearer '+env.SIGNUP_RESEND_API_KEY,'Content-Type':'application/json',...(idempotency?{'Idempotency-Key':idempotency}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new Error('email_provider_' + response.status);
  return response.json();
}
async function subscribe(env, email, name, source, updates) {
  if(source !== 'wobble' && !updates) return;
  const key = encodeURIComponent(email);
  let contact = await api(env, '/contacts/'+key);
  if (contact?.unsubscribed) {
    const err = new Error('unsubscribed'); err.publicMessage = 'This address previously unsubscribed. Please email hello@aleeshaloos.com to rejoin.'; throw err;
  }
  const topics = [];
  if(source === 'wobble') topics.push({id:env.RESEND_WOBBLE_TOPIC,subscription:'opt_in'});
  if(updates) topics.push({id:env.RESEND_GENERAL_TOPIC,subscription:'opt_in'});
  if (!contact) {
    contact = await api(env, '/contacts','POST',{email,first_name:name,unsubscribed:false});
  }
  await api(env, '/contacts/'+key+'/topics','PATCH',topics);
  if(source === 'wobble') await api(env,'/contacts/'+key+'/segments/'+env.RESEND_WOBBLE_SEGMENT,'POST');
  if(updates) await api(env,'/contacts/'+key+'/segments/'+env.RESEND_GENERAL_SEGMENT,'POST');
}
export async function onRequestPost({request, env}) {
  if (request.headers.get('Origin') !== ORIGIN && request.headers.get('Origin') !== 'https://www.aleeshaloos.com') return json({error:'Please use the form on aleeshaloos.com.'},403);
  if (!request.headers.get('Content-Type')?.includes('application/json')) return json({error:'Please use the signup form.'},415);
  const body = await request.text();
  if(body.length > 4096) return json({error:'Please shorten your details.'},413);
  let input;
  try { input = JSON.parse(body); } catch { return json({error:'Please complete the form.'},400); }
  const source = input.source;
  if(!ready(env,source)) return json({error:'Signups are opening soon. Please email hello@aleeshaloos.com for now.'},503);
  if(input.website) return json({ok:true});
  const email = String(input.email || '').trim().toLowerCase();
  const name = String(input.name || '').trim().slice(0,80);
  const updates = input.updates === true;
  if(email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'Please enter a valid email address.'},400);
  const now = new Date().toISOString();
  const id = await hash(email+'|'+source+'|'+updates+'|'+now.slice(0,10));
  const ip = await hash((request.headers.get('CF-Connecting-IP') || '')+'|'+env.SIGNUP_RESEND_API_KEY+'|'+now.slice(0,10));
  try {
    const prior = await env.SIGNUP_DB.prepare('SELECT status FROM signup_requests WHERE id = ?').bind(id).first();
    if(prior?.status === 'sent') return json({ok:true,...(source === 'halloween'?{download:downloadURL(env)}:{})});
    const rate = await env.SIGNUP_DB.prepare("SELECT COUNT(*) AS n FROM signup_requests WHERE ip_hash = ? AND created_at > ?").bind(ip,new Date(Date.now()-3600000).toISOString()).first();
    if(rate.n >= 20) return json({error:'Please try again a little later.'},429);
    await env.SIGNUP_DB.prepare("INSERT OR IGNORE INTO signup_requests (id,email,name,source,updates,consent_version,created_at,ip_hash,status) VALUES (?,?,?,?,?,?,?,?,'pending')").bind(id,email,name,source,updates?1:0,CONSENT_VERSION,now,ip).run();
    await subscribe(env,email,name,source,updates);
    const greeting = name ? 'Hi '+name+',' : 'Hello,';
    const text = source === 'halloween'
      ? greeting+'\n\nHere’s your little Halloween treat!\n\nDownload your colouring sheet: '+downloadURL(env)+'\n\nThank you for making a little time to create.\n\nAleesha\nhttps://aleeshaloos.com'
      : greeting+'\n\nYou’re on Wobble’s waitlist! Thank you for making room for this little friend. I’ll email you when Wobble and the Big Feeling is ready.\n\nThere’s nothing to pay or reserve right now.\n\nAleesha\nhttps://aleeshaloos.com/wobble/';
    await api(env,'/emails','POST',{from:env.CONTACT_FROM_EMAIL,to:[email],reply_to:'hello@aleeshaloos.com',subject:source === 'halloween'?'Your little Halloween colouring treat':'You’re on Wobble’s list!',text},'signup-'+id);
    await env.SIGNUP_DB.prepare("UPDATE signup_requests SET status='sent' WHERE id=?").bind(id).run();
    return json({ok:true,...(source === 'halloween'?{download:downloadURL(env)}:{})});
  } catch(error) {
    console.error('Signup processing failed',error.publicMessage?'subscription_status':error.message);
    return json({error:error.publicMessage || 'We couldn’t finish sending your welcome. Please try again shortly, or email hello@aleeshaloos.com.'},502);
  }
}
