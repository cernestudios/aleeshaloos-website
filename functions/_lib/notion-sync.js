// A one-way mirror from Cloudflare D1 to Aleesha's limited-access Notion databases.
// D1 remains the source of truth for signup events and consent evidence.
const VERSION = '2026-03-11';
const SOURCES = {
  audience: 'ee728dee-d699-48ee-afd7-f0411fa28e39',
  contacts: '32e6ab02-41ac-4663-bd8c-3a44608897fc',
  opportunities: '431486cc-677f-4c89-ae5a-54a31bb2e976',
  tasks: 'd34ba93b-587f-4644-9313-d6b05dfc863c',
};
const richText = (value) => String(value || '').match(/[\s\S]{1,1900}/g)?.map(content => ({text:{content}})) || [];
const title = (value) => ({title:richText(value)});
const text = (value) => ({rich_text:richText(value)});
const date = (value) => ({date:{start:value}});
const relation = (id) => ({relation:[{id}]});

async function notion(env, path, body, method = 'POST') {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch('https://api.notion.com/v1/' + path, {
      method,
      headers:{
        Authorization:'Bearer ' + env.NOTION_API_KEY,
        'Notion-Version':VERSION,
        'Content-Type':'application/json',
      },
      body:JSON.stringify(body),
    });
    if (response.status === 429 && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw new Error('notion_' + response.status + '_' + path.split('/')[0]);
    return response.json();
  }
}

async function find(env, source, property, kind, value) {
  const result = await notion(env, 'data_sources/' + source + '/query', {
    filter:{property,[kind]:{equals:value}},
    page_size:2,
  });
  return result.results?.[0] || null;
}

async function create(env, source, properties) {
  return notion(env, 'pages', {
    parent:{type:'data_source_id',data_source_id:source},
    properties,
  });
}

async function update(env, id, properties) {
  return notion(env, 'pages/' + id, {properties}, 'PATCH');
}

export async function syncAudience(env, email) {
  if (!env.NOTION_API_KEY || !env.SIGNUP_DB) return;
  const rows = (await env.SIGNUP_DB.prepare(
    "SELECT id, email, name, source, updates, consent_version, created_at FROM signup_requests WHERE email=? AND status='sent' ORDER BY created_at"
  ).bind(email).all()).results || [];
  if (!rows.length) return;
  const first = rows[0], last = rows[rows.length-1];
  const optedIn = rows.filter(row => row.updates === 1).at(-1);
  const latestName = [...rows].reverse().find(row => row.name)?.name;
  const properties = {
    Name:title(latestName || email),
    Email:{email},
    Status:{status:{name:'Active'}},
    'Halloween interest':{checkbox:rows.some(row => row.source === 'halloween')},
    'Wobble interest':{checkbox:rows.some(row => row.source === 'wobble')},
    'General updates consent':{checkbox:Boolean(optedIn)},
    'Consent version':text(optedIn?.consent_version || ''),
    'D1 key':text(first.id),
    'First signup':date(first.created_at),
    'Last signup':date(last.created_at),
    'Last synced':date(new Date().toISOString()),
    'Source notes':text('Cloudflare D1 signup_requests; individual source and consent events remain in D1.'),
  };
  if (optedIn) properties['Consent recorded'] = date(optedIn.created_at);
  const existing = await find(env, SOURCES.audience, 'Email', 'email', email);
  if (existing) await update(env, existing.id, properties);
  else await create(env, SOURCES.audience, properties);
}

export async function syncEnquiry(env, id) {
  if (!env.NOTION_API_KEY || !env.SIGNUP_DB) return;
  const enquiry = await env.SIGNUP_DB.prepare(
    "SELECT id,email,name,message,created_at,status,notion_contact_id,notion_opportunity_id,notion_task_id FROM enquiries WHERE id=?"
  ).bind(id).first();
  if (!enquiry || enquiry.status !== 'sent' || enquiry.notion_task_id) return;
  try {
    let contactId = enquiry.notion_contact_id;
    if (!contactId) {
      const existing = await find(env, SOURCES.contacts, 'Email', 'email', enquiry.email);
      const contact = existing || await create(env, SOURCES.contacts, {
        Name:title(enquiry.name), Email:{email:enquiry.email},
        Type:{select:{name:'Person'}}, Source:{select:{name:'Website'}},
        Relationship:{status:{name:'New'}},
        'Last contact':date(enquiry.created_at),
      });
      contactId = contact.id;
      await env.SIGNUP_DB.prepare('UPDATE enquiries SET notion_contact_id=? WHERE id=?').bind(contactId,id).run();
    }
    let opportunityId = enquiry.notion_opportunity_id;
    if (!opportunityId) {
      const existing = await find(env, SOURCES.opportunities, 'D1 enquiry ID', 'rich_text', id);
      const opportunity = existing || await create(env, SOURCES.opportunities, {
        Name:title('Website enquiry — ' + enquiry.name),
        Contact:relation(contactId), Stage:{status:{name:'New'}},
        Source:{select:{name:'Website'}},
        Brief:text(enquiry.message),
        'D1 enquiry ID':text(id),
        'Enquiry date':date(enquiry.created_at),
        'Next action':text('Reply to the enquiry and qualify the opportunity.'),
      });
      opportunityId = opportunity.id;
      await env.SIGNUP_DB.prepare('UPDATE enquiries SET notion_opportunity_id=? WHERE id=?').bind(opportunityId,id).run();
    }
    let taskId = enquiry.notion_task_id;
    if (!taskId) {
      const source = 'enquiry:' + id;
      const existing = await find(env, SOURCES.tasks, 'Source', 'rich_text', source);
      const task = existing || await create(env, SOURCES.tasks, {
        Name:title('Reply to ' + enquiry.name + ' about website enquiry'),
        Status:{status:{name:'Next'}},
        Priority:{select:{name:'High'}},
        Area:{select:{name:'Client work'}},
        Source:text(source),
        Opportunity:relation(opportunityId),
        'Next step':text('Read the enquiry, reply by email, and update the Opportunity stage.'),
      });
      taskId = task.id;
    }
    await env.SIGNUP_DB.prepare(
      'UPDATE enquiries SET notion_task_id=?,synced_at=?,sync_error=NULL WHERE id=?'
    ).bind(taskId,new Date().toISOString(),id).run();
  } catch (error) {
    await env.SIGNUP_DB.prepare('UPDATE enquiries SET sync_error=? WHERE id=?')
      .bind(String(error.message).slice(0,180),id).run();
    throw error;
  }
}
