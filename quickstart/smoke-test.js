async function fetchJson(url, options={}){
  const r = await fetch(url, options);
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok:r.ok, status:r.status, data, text };
}

async function waitUrl(url, attempts=20){
  for(let i=0;i<attempts;i++){
    try { const r = await fetch(url); if(r.ok) return true; } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  return false;
}

(async()=>{
  const results=[];
  const add=(test,pass,details)=>results.push({test,pass,details});

  const okApi = await waitUrl('http://localhost:8081/health');
  const okFe = await waitUrl('http://localhost:3000');
  add('health_api_8081', okApi, 'GET /health');
  add('health_frontend_3000', okFe, 'GET /');

  if(!okApi){
    console.log(JSON.stringify({allPass:false, reason:'API not running on 8081', results}, null, 2));
    process.exit(2);
  }

  let r;
  r = await fetchJson('http://localhost:8081/api/dev/reset?me=4', {method:'POST'});
  add('dev_reset', r.ok && r.data?.ok===true, `status=${r.status}`);

  r = await fetchJson('http://localhost:8081/api/dev/seed?me=4', {method:'POST'});
  add('dev_seed', r.ok && r.data?.ok===true, `status=${r.status}`);

  const loginMilica = await fetchJson('http://localhost:8081/api/auth/login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({login:'milica@example.com',password:'123456'})});
  add('login_milica', loginMilica.ok && loginMilica.data?.user?.id===4, `status=${loginMilica.status}`);

  const loginMarija = await fetchJson('http://localhost:8081/api/auth/login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({login:'marija@example.com',password:'123456'})});
  add('login_marija', loginMarija.ok && loginMarija.data?.user?.id===8, `status=${loginMarija.status}`);

  const state = await fetchJson('http://localhost:8081/api/export/state?me=4');
  const expectNames = {
    milica:'Milica Kostic', tamara:'Tamara Majdak', aleksandra:'Aleksandra Acimovic', natalija:'Natalija Ristovic', marija:'Marija Stevic'
  };
  let namesOk = state.ok;
  for(const [u,n] of Object.entries(expectNames)){
    const found = state.data?.users?.find(x=>x.username===u);
    if(!found || found.full_name!==n){ namesOk=false; }
  }
  add('names_surnames', namesOk, 'custom full_name values');

  const before = await fetchJson('http://localhost:8081/api/social/stats/4?me=4');
  const follow = await fetchJson('http://localhost:8081/api/social/follow/8?me=4',{method:'POST'});
  const after = await fetchJson('http://localhost:8081/api/social/stats/4?me=4');
  const beforeFollowing = Number(before.data?.followingCount ?? -1);
  const afterFollowing = Number(after.data?.followingCount ?? -1);
  add('follow_updates_stats', follow.ok && ['accepted','pending'].includes(follow.data?.status) && afterFollowing >= beforeFollowing, `${beforeFollowing}->${afterFollowing}`);

  const post = await fetchJson('http://localhost:8081/api/posts?me=4',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({caption:'Test objava', media:[{type:'image',url:'https://picsum.photos/seed/test/600/800',sizeMb:1.2}]})});
  add('create_post', post.ok && Number(post.data?.id) > 0, `status=${post.status}`);

  const feed = await fetchJson('http://localhost:8081/api/feed?me=4');
  add('feed_load', feed.ok && Array.isArray(feed.data?.items) && feed.data.items.length>0, `items=${feed.data?.items?.length||0}`);

  const postId = post.data?.id;
  const like = await fetchJson(`http://localhost:8081/api/engagement/posts/${postId}/like?me=8`,{method:'POST'});
  add('like_post', like.ok, `status=${like.status}`);

  const comment = await fetchJson(`http://localhost:8081/api/engagement/posts/${postId}/comments?me=8`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'top'})});
  add('comment_post', comment.ok && Number(comment.data?.id)>0, `status=${comment.status}`);

  const reqStart = await fetchJson('http://localhost:8081/api/social/follow/5?me=8',{method:'POST'});
  const reqList = await fetchJson('http://localhost:8081/api/social/requests?me=5');
  const pending = reqList.data?.items?.find(x=>x.follower_id===8);
  let accepted = false;
  if(pending){
    const acc = await fetchJson(`http://localhost:8081/api/social/requests/${pending.follower_id}/accept?me=5`,{method:'POST'});
    accepted = acc.ok;
  }
  add('follow_request_accept', reqStart.data?.status==='pending' && accepted, `status=${reqStart.data?.status}`);

  const notif = await fetchJson('http://localhost:8081/api/notifications?me=4');
  add('notifications_load', notif.ok && Array.isArray(notif.data?.items), `count=${notif.data?.items?.length||0}`);

  const allPass = results.every(x=>x.pass);
  console.log(JSON.stringify({allPass, results}, null, 2));
  process.exit(allPass ? 0 : 2);
})();
