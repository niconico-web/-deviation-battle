/* SchoolBattle Job + Skill Collection + AI Fusion */
(() => {
  'use strict';
  const JOBS = {
    vanguard:{name:'蜑｣髣伜｣ｫ',icon:'笞費ｸ・,role:'謾ｻ謦・音蛹・,desc:'謾ｻ謦・鴨縺御ｸ翫′繧翫∵ｭ｣髱｢縺九ｉ謚ｼ縺怜・繧区姶縺・′蠕玲э縲・,bonus:{atk:0.10}},
    guardian:{name:'螳郁ｭｷ鬨主｣ｫ',icon:'孱・・,role:'閠蝉ｹ・音蛹・,desc:'譛螟ｧHP縺ｨ髦ｲ蠕｡蜉帙′荳翫′繧九る聞譛滓姶蜷代￠縲・,bonus:{maxHp:0.12,def:0.10}},
    ranger:{name:'繝ｬ繝ｳ繧ｸ繝｣繝ｼ',icon:'昌',role:'騾溷ｺｦ迚ｹ蛹・,desc:'邏譌ｩ縺輔′荳翫′繧翫∵焔謨ｰ繧呈ｴｻ縺九☆謌ｦ縺・′蠕玲э縲・,bonus:{speed:0.12}},
    arcanist:{name:'鬲泌ｰ主｣ｫ',icon:'醗',role:'迚ｹ谿顔音蛹・,desc:'迚ｹ谿翫せ繝・・繧ｿ繧ｹ縺御ｸ翫′繧翫√せ繧ｭ繝ｫ繧定ｻｸ縺ｫ謌ｦ縺・・,bonus:{special:0.14,atk:0.04}},
    tactician:{name:'霆榊ｸｫ',icon:'祷',role:'荳・・蝙・,desc:'謾ｻ謦・・髦ｲ蠕｡繝ｻ騾溷ｺｦ繧貞ｰ代＠縺壹▽莨ｸ縺ｰ縺吶・,bonus:{atk:0.04,def:0.04,speed:0.04}},
    reaper:{name:'豁ｻ逾・,icon:'倦',role:'鬮倥Μ繧ｹ繧ｯ蝙・,desc:'謾ｻ謦・鴨縺ｨ邏譌ｩ縺輔′荳翫′繧倶ｻ｣繧上ｊ縺ｫ譛螟ｧHP縺悟ｰ代＠荳九′繧九・,bonus:{atk:0.08,speed:0.08,maxHp:-0.05}}
  };
  const STARTERS = [
    {name:'轣ｫ闃ｱ縺ｮ蠑ｾ',rarity:'normal',spec:{form:'projectile',effects:['damage','burn'],augments:[],element:'fire'}},
    {name:'螳医ｊ縺ｮ豕｢邏・,rarity:'normal',spec:{form:'nova',effects:['damage','fortify'],augments:[]}},
    {name:'逍ｾ鬚ｨ譁ｬ繧・,rarity:'magic',spec:{form:'slash',effects:['damage','knockback'],augments:['swift'],element:'wind'}}
  ];
  const $ = id => document.getElementById(id);
  const get = () => typeof getPlayerData==='function' ? getPlayerData() : null;
  const save = p => {
    localStorage.setItem('player',JSON.stringify(p));
    try { if(typeof updateStatus==='function') updateStatus(p); } catch(e){}
    try { if(typeof syncPlayerToServer==='function') syncPlayerToServer(true); } catch(e){}
  };
  const id = () => 'col_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function ensure(p){
    let changed=false;
    if(!p.job || !JOBS[p.job]) {p.job='vanguard';changed=true;}
    if(!Array.isArray(p.skillCollection)) {
      changed=true;
      let existing=[];try{existing=JSON.parse(localStorage.getItem('sb_action_skills')||'[]')}catch(e){}
      p.skillCollection=Array.isArray(existing)&&existing.length?existing.filter(s=>s&&typeof s==='object').map(s=>({id:s.id||id(),name:s.name||'繧ｹ繧ｭ繝ｫ',rarity:s.rarity||'normal',spec:s.spec||{form:s.form,effects:s.effects,augments:s.augments,element:s.element,layout:s.layout},createdAt:Date.now(),source:'workshop'})):STARTERS.map(s=>({id:id(),name:s.name,rarity:s.rarity,spec:s.spec,createdAt:Date.now(),source:'starter'}));
    }
    // 蜷梧悄縺ｧ蛻･遶ｯ譛ｫ縺ｸ貂｡縺｣縺溘さ繝ｬ繧ｯ繧ｷ繝ｧ繝ｳ繧ゅ√せ繧ｭ繝ｫ蟾･謌ｿ縺ｮ荳隕ｧ縺ｸ蜿肴丐縺吶ｋ縲・    let action=[];try{action=JSON.parse(localStorage.getItem('sb_action_skills')||'[]')}catch(e){}
    if(!Array.isArray(action))action=[];
    const known=new Set(action.map(s=>s&&s.id));
    (p.skillCollection||[]).forEach(s=>{if(s&&s.spec&&!known.has(s.id)){action.push({...s.spec,id:s.id,name:s.name});known.add(s.id)}});
    try{localStorage.setItem('sb_action_skills',JSON.stringify(action))}catch(e){}
    if(changed) save(p);
    return p;
  }
  let selected = new Set();
  function render(){
    const p0=get(); if(!p0) return;
    const p=ensure(p0);
    const jobs=$('jobChoices');
    if(jobs) jobs.innerHTML=Object.entries(JOBS).map(([key,j])=>`<article class="job-card ${p.job===key?'selected':''}"><h4>${j.icon} ${j.name} <small>・・{j.role}</small></h4><p>${j.desc}</p><p class="skill-meta">${Object.entries(j.bonus).map(([k,v])=>`${({atk:'謾ｻ謦・,def:'髦ｲ蠕｡',maxHp:'譛螟ｧHP',speed:'邏譌ｩ縺・,special:'迚ｹ谿・})[k]} ${v>0?'+':''}${Math.round(v*100)}%`).join(' 繝ｻ ')}</p><button type="button" class="btn ${p.job===key?'btn-secondary':'btn-primary'}" data-job="${key}">${p.job===key?'驕ｸ謚樔ｸｭ':'縺薙・繧ｸ繝ｧ繝悶↓縺吶ｋ'}</button></article>`).join('');
    jobs.querySelectorAll('[data-job]').forEach(b=>b.addEventListener('click',()=>{const q=get();q.job=b.dataset.job;save(q);render();}));
    const cur=JOBS[p.job]; $('jobCurrent').innerHTML=`迴ｾ蝨ｨ縺ｮ繧ｸ繝ｧ繝厄ｼ・b>${cur.icon} ${cur.name}</b> 窶・${cur.desc}`;
    const list=$('skillCollectionList');
    if(list) list.innerHTML=p.skillCollection.length?p.skillCollection.map(s=>`<article class="collection-skill ${selected.has(s.id)?'selected':''}"><h4>${esc(s.name)}</h4><span class="skill-rarity ${esc(s.rarity)}">${esc(({normal:'繝弱・繝槭Ν',magic:'繝槭ず繝・け',rare:'繝ｬ繧｢',epic:'繧ｨ繝斐ャ繧ｯ',legendary:'繝ｬ繧ｸ繧ｧ繝ｳ繝・}[s.rarity]||s.rarity))}</span><p class="skill-meta">${esc(s.spec?.form||'unknown')} ・・${(s.spec?.effects||[]).map(esc).join('繝ｻ')}</p><button type="button" class="btn ${selected.has(s.id)?'btn-secondary':'btn-primary'}" data-skill="${esc(s.id)}">${selected.has(s.id)?'驕ｸ謚櫁ｧ｣髯､':'蜷域・邏譚舌↓驕ｸ縺ｶ'}</button></article>`).join(''):'<p>繧ｹ繧ｭ繝ｫ縺後≠繧翫∪縺帙ｓ縲・/p>';
    list.querySelectorAll('[data-skill]').forEach(b=>b.addEventListener('click',()=>{const sid=b.dataset.skill;if(selected.has(sid))selected.delete(sid);else if(selected.size<3)selected.add(sid);renderSelection();render();}));
    renderSelection();
  }
  function renderSelection(){
    const p=get();const chosen=(p?.skillCollection||[]).filter(s=>selected.has(s.id));
    $('fusionSelected').textContent=chosen.length?chosen.map(s=>s.name).join(' ・・')+'・・+chosen.length+'/3・・:'蜷域・邏譚舌ｒ2縲・蛟矩∈謚槭＠縺ｦ縺上□縺輔＞縲・;
    $('fuseSkillsBtn').disabled=chosen.length<2||chosen.length>3;
  }
  async function fuse(){
    const p=get();if(!p)return;
    const sources=(p.skillCollection||[]).filter(s=>selected.has(s.id));
    if(sources.length<2||sources.length>3)return;
    if(!window.socket?.connected){$('fusionMessage').textContent='繧ｵ繝ｼ繝舌・縺ｫ謗･邯壹＠縺ｦ縺九ｉ蜷域・縺励※縺上□縺輔＞縲・;$('fusionMessage').className='fusion-message error';return;}
    const btn=$('fuseSkillsBtn');btn.disabled=true;btn.textContent='AI縺後せ繧ｭ繝ｫ繧定ｨｭ險井ｸｭ窶ｦ';
    $('fusionMessage').textContent='邏譚舌せ繧ｭ繝ｫ縺ｮ迚ｹ蠕ｴ繧貞・譫舌＠縺ｦ縺・∪縺吶・;
    const text='谺｡縺ｮ繧ｹ繧ｭ繝ｫ繧定檮蜷医＠縺滓眠縺励＞繧ｪ繝ｪ繧ｸ繝翫Ν繧ｹ繧ｭ繝ｫ繧定ｨｭ險医＠縺ｦ縺上□縺輔＞縲ょ推繧ｹ繧ｭ繝ｫ縺ｮ迚ｹ蠕ｴ繧堤ｵ・∩蜷医ｏ縺帙∝錐蜑阪ｂ譁ｰ縺励￥縺励※縺上□縺輔＞縲・n'+sources.map((s,i)=>`${i+1}. ${s.name} / rarity=${s.rarity} / form=${s.spec?.form} / effects=${(s.spec?.effects||[]).join(',')} / augments=${(s.spec?.augments||[]).join(',')} / element=${s.spec?.element||'none'}`).join('\n')+'\n蠑ｷ縺輔・邏譚舌・蜷郁ｨ医ｈ繧頑･ｵ遶ｯ縺ｫ蠑ｷ縺上○縺壹√ユ繝ｼ繝槭′荳雋ｫ縺励◆繧ｹ繧ｭ繝ｫ縺ｫ縺励※縺上□縺輔＞縲・;
    try{
      const result=await new Promise(resolve=>window.socket.timeout(35000).emit('skillai:generate',{playerId:p.id,text,special:p.special||0},(err,res)=>resolve(err?{ok:false,reason:'timeout'}:res)));
      if(!result?.ok) throw new Error(({invalid:'繝励Ξ繧､繝､繝ｼID繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞',too_short:'邏譚先ュ蝣ｱ縺御ｸ崎ｶｳ縺励※縺・∪縺・,too_fast:'蟆代＠蠕・▲縺ｦ縺九ｉ蜀崎ｩｦ陦後＠縺ｦ縺上□縺輔＞',daily_limit:'譛ｬ譌･縺ｮAI蜷域・蝗樊焚縺ｮ荳企剞縺ｧ縺・,timeout:'AI蠢懃ｭ斐′繧ｿ繧､繝繧｢繧ｦ繝医＠縺ｾ縺励◆',busy:'蛻･縺ｮ繧ｹ繧ｭ繝ｫ逕滓・縺碁ｲ陦御ｸｭ縺ｧ縺・}[result?.reason]||'繧ｹ繧ｭ繝ｫ逕滓・縺ｫ螟ｱ謨励＠縺ｾ縺励◆'));
      const newSkill={id:id(),name:String(result.spec.name||'陞榊粋繧ｹ繧ｭ繝ｫ').slice(0,20),rarity:sources.some(s=>s.rarity==='legendary')?'legendary':sources.some(s=>s.rarity==='epic')?'epic':sources.some(s=>s.rarity==='rare')?'rare':'magic',spec:result.spec,createdAt:Date.now(),source:'fusion',fusionFrom:sources.map(s=>s.id),summary:result.summary||''};
      // 蜷御ｸ縺ｮ繧｢繧ｯ繧ｷ繝ｧ繝ｳ繧ｹ繧ｭ繝ｫ荳隕ｧ縺ｫ繧ゆｿ晏ｭ倥ゅせ繧ｭ繝ｫ蟾･謌ｿ繧帝幕縺・◆髫帙↓邱ｨ髮・・陬・ｙ縺ｧ縺阪ｋ縲・      let actionSkills=[];try{actionSkills=JSON.parse(localStorage.getItem('sb_action_skills')||'[]')}catch(e){}
      if(!Array.isArray(actionSkills))actionSkills=[];
      actionSkills.push({...result.spec,id:newSkill.id,name:newSkill.name});
      localStorage.setItem('sb_action_skills',JSON.stringify(actionSkills));
      p.skillCollection=(p.skillCollection||[]).filter(s=>!selected.has(s.id));
      p.skillCollection.push(newSkill);save(p);selected.clear();
      $('fusionMessage').textContent=`${newSkill.name} 縺悟ｮ梧・・・{result.ai?' AI險ｭ險・:'邁｡譏楢ｨｭ險・}縲らｴ譚・${sources.length} 蛟九ｒ豸郁ｲｻ縺励∪縺励◆縲Ａ;
      $('fusionMessage').className='fusion-message success';render();
    }catch(e){$('fusionMessage').textContent=e.message||'蜷域・縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲らｴ譚舌・豸郁ｲｻ縺輔ｌ縺ｦ縺・∪縺帙ｓ縲・;$('fusionMessage').className='fusion-message error';}
    finally{btn.textContent='驕ｸ謚槭＠縺溘せ繧ｭ繝ｫ繧貞粋謌舌☆繧・;renderSelection();}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('fuseSkillsBtn')?.addEventListener('click',fuse);
    const jobBtn=document.querySelector('[data-section="job"]');
    jobBtn?.addEventListener('click',()=>render());
    window.addEventListener('storage',e=>{if(e.key==='player')render()});
    render();
  });
  window.SBJobSkills={JOBS,render};
})();
