// Deploy as a separate Cloudflare Worker, bound to the same SIGNUP_DB.
// Trigger hourly at minute 5. Send once after 6pm Australia/Sydney, including DST.
export default {
  async scheduled(event, env) {
    if(env.SIGNUPS_ENABLED !== 'true') return;
    const now = new Date(event.scheduledTime);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
    if(Number(parts.hour)<18) return;
    const id = parts.year+'-'+parts.month+'-'+parts.day;
    const db=env.SIGNUP_DB;
    const sent=await db.prepare('SELECT status FROM signup_digests WHERE id=?').bind(id).first();
    if(sent?.status === 'sent') return;
    await db.prepare("INSERT OR IGNORE INTO signup_digests (id,created_at,status) VALUES (?,?,'pending')").bind(id,now.toISOString()).run();
    // Claim today's rows before sending; a retry uses the same rows and email key.
    if(!sent) await db.prepare("UPDATE signup_requests SET digest_id=? WHERE status='sent' AND digest_id IS NULL").bind(id).run();
    const rows=await db.prepare('SELECT source,updates,COUNT(*) AS n FROM signup_requests WHERE digest_id=? GROUP BY source,updates').bind(id).all();
    let halloween=0,wobble=0,updates=0;
    for(const row of rows.results){ if(row.source==='wobble')wobble+=row.n;else halloween+=row.n;if(row.updates)updates+=row.n; }
    if(halloween+wobble>0){
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.SIGNUP_RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'signup-digest-'+id},body:JSON.stringify({
        from:env.CONTACT_FROM_EMAIL,to:['hello@aleeshaloos.com'],subject:'A little signup summary — '+id,
        text:'Hi Aleesha,\n\nHere’s your daily website roundup:\n\nHalloween requests: '+halloween+'\nWobble waitlist signups: '+wobble+'\nGeneral updates opt-ins: '+updates+'\n\nThese are successful signup requests, not unique lifetime subscribers.\nManage subscribers and preferences in Resend: https://resend.com/audiences\n\nA little colour, a little connection.'
      })});
      if(!response.ok)throw new Error('Summary delivery failed: '+response.status);
    }
    await db.prepare("UPDATE signup_digests SET status='sent' WHERE id=?").bind(id).run();
    await db.prepare("DELETE FROM signup_requests WHERE source='halloween' AND updates=0 AND created_at < ?").bind(new Date(now.getTime()-30*86400000).toISOString()).run();
    await db.prepare('UPDATE signup_requests SET ip_hash=NULL WHERE created_at < ?').bind(new Date(now.getTime()-2*86400000).toISOString()).run();
  }
};

