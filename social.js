async function api(path){const r=await fetch('/api/social'+path);if(!r.ok)throw new Error(await r.text());return r.json()}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function networkCard(n){const ready=n.clientIdConfigured&&n.clientSecretConfigured;return '<article class="card"><div class="eyebrow">'+esc(n.network.toUpperCase())+'</div><strong>'+ (ready?'OAUTH READY':'NEEDS APP KEYS') +'</strong><span class="pill '+(ready?'ready':'blocked')+'">'+(ready?'CONFIGURED':'BLOCKED')+'</span></article>'}
function metric(label,value){return '<div class="metric"><span class="muted">'+esc(label)+'</span><b>'+esc(value)+'</b></div>'}
async function load(){
  const [status,accounts,posts]=await Promise.all([api('/status'),api('/accounts'),api('/posts')]);
  document.getElementById('network-grid').innerHTML=status.networks.map(networkCard).join('');
  document.getElementById('metrics').innerHTML=[
    metric('Accounts',status.counts.accounts),metric('Queued',status.counts.queued),metric('Scheduled',status.counts.scheduled),metric('Published',status.counts.published),metric('Failed',status.counts.failed)
  ].join('');
  document.getElementById('accounts').innerHTML=accounts.length?accounts.map(a=>'<div class="row"><b>'+esc(a.network.toUpperCase())+'</b><span>'+esc(a.label)+'</span><span>'+esc(a.handle||'handle pending')+'</span><span class="pill blocked">'+esc(a.connectionStatus)+'</span></div>').join(''):'<p class="muted">No social accounts registered yet.</p>';
  document.getElementById('queue').innerHTML=posts.length?posts.slice(0,50).map(p=>'<div class="row"><b>'+esc(p.networks.join(', ').toUpperCase())+'</b><span>'+esc(p.title)+'</span><span>'+esc(p.scheduledFor||'unscheduled')+'</span><span class="pill">'+esc(p.status)+'</span></div>').join(''):'<p class="muted">Queue empty. Import the Video Studio first wave.</p>';
}
document.getElementById('refresh-btn').addEventListener('click',load);load().catch(e=>{document.body.insertAdjacentHTML('beforeend','<pre>'+esc(e.message)+'</pre>')});
