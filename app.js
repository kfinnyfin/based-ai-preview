'use strict';
const catalog=window.BASED_CATALOG||[];
const engine=window.BasedEngine;
const stateKey='based-ai-private-demo-state-v2', legacyKey='based-ai-demo-routine-v1';
let state=engine.initialState(), routine=[], filter='all';
const messages=document.querySelector('#messages'),list=document.querySelector('#routine-list'),summary=document.querySelector('#profile-summary'),grid=document.querySelector('#products');
let conversationHistory=[], conversationEpoch=0;
let legacy=[];
try {const old=JSON.parse(localStorage.getItem(legacyKey)||'[]');if(Array.isArray(old))legacy=old.filter(x=>x&&typeof x.day==='string'&&typeof x.step==='string').map((x,i)=>({id:'legacy-'+i,day:x.day,order:i,instruction:x.step,legacy:true}));} catch (_) {}
try {const saved=JSON.parse(localStorage.getItem(stateKey)||'null');if(saved&&saved.state)state={...state,...saved.state};if(saved&&Array.isArray(saved.routine))routine=saved.routine;} catch (_) {}
function save(){try{localStorage.setItem(stateKey,JSON.stringify({state,routine}));return true}catch(_){document.querySelector('.storage-note').textContent='Browser storage is unavailable; changes may not persist and previously saved data may remain.';return false}}
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n}
function appendSafeLinks(target,text){
 let cursor=0;const pattern=/https:\/\/[^\s·]+/g;let match;
 while((match=pattern.exec(text))){const raw=match[0].replace(/[.,;!?)]+$/,'');let url;try{url=new URL(raw)}catch(_){continue}if(!['based.com','www.based.com','www.youtube.com'].includes(url.hostname)||url.username||url.password)continue;
  target.append(document.createTextNode(text.slice(cursor,match.index)));const label=url.hostname==='www.youtube.com'?'BASED tutorial ↗':url.pathname.startsWith('/blogs/')?'BASED guide ↗':'Product page ↗';const link=node('a',label,'chat-source');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';target.append(link);cursor=match.index+raw.length;
 }
 target.append(document.createTextNode(text.slice(cursor)));
}
function bubble(text,who,record=true){
 const n=node('div',undefined,'bubble '+who);
 if(who==='assistant'){
  const lines=text.split('\n'),sources=lines.filter(line=>/^\s*Sources?:\s*/i.test(line)),body=lines.filter(line=>!/^\s*Sources?:\s*/i.test(line)).join('\n').trim();
  appendSafeLinks(n,body);if(sources.length){const details=node('details',undefined,'source-details');details.append(node('summary','View sources'));const content=node('div',undefined,'source-links');appendSafeLinks(content,sources.map(line=>line.replace(/^\s*Sources?:\s*/i,'')).join(' · '));details.append(content);n.append(details);}
 }else n.textContent=text;
 if(who==='user'){const welcome=document.querySelector('#coach-welcome');if(welcome)welcome.remove();document.querySelector('.chat-panel').classList.add('conversation-started');}messages.append(n);if(who==='assistant'&&record&&!/routine is ready/i.test(text))appendProductCards(text);if(record&&(who==='user'||who==='assistant')){conversationHistory.push({role:who,content:text});conversationHistory=conversationHistory.slice(-8)}messages.scrollTop=messages.scrollHeight;requestAnimationFrame(()=>{messages.scrollTop=messages.scrollHeight});return n
}
function appendProductCards(text){
 const occupied=[],matches=[];for(const p of [...catalog].sort((a,b)=>b.name.length-a.name.length)){const name=p.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=new RegExp('(^|[^a-z])('+name+')(?=$|[^a-z])','i').exec(text);if(!m)continue;const start=m.index+m[1].length,end=start+m[2].length;if(occupied.some(([a,b])=>start<b&&end>a))continue;occupied.push([start,end]);matches.push(p);if(matches.length===3)break;}
 if(!matches.length)return;const row=node('div',undefined,'chat-product-cards');row.setAttribute('aria-label','Products mentioned');
 matches.forEach(p=>{const card=node('article',undefined,'chat-product-card');if(p.image){const img=node('img');img.src=p.image;img.alt='';img.loading='lazy';card.append(img)}card.append(node('strong',p.name));const actions=node('div',undefined,'chat-card-actions'),link=node('a','View ↗');link.href=p.source;link.target='_blank';link.rel='noopener noreferrer';const own=node('button',(state.ownedIds||[]).includes(p.id)?'Owned ✓':'I own this');own.type='button';own.setAttribute('aria-label','Mark '+p.name+' as owned');own.disabled=(state.ownedIds||[]).includes(p.id);own.addEventListener('click',()=>{changeOwnership(p.id,true);own.textContent='Owned ✓';own.disabled=true;renderProducts();renderOwned()});actions.append(link,own);card.append(actions);row.append(card)});messages.append(row)
}
function quickReplies(choices, callback){
 const row=node('div',undefined,'quick-replies');row.setAttribute('aria-label','Suggested replies');
 choices.forEach(choice=>{const b=node('button',choice);b.type='button';b.addEventListener('click',()=>{row.remove();callback(choice)});row.append(b)});messages.append(row);messages.scrollTop=messages.scrollHeight;
}
function startMatch(){
 if(gptBusy)return;if(state.safetyHold){respond('Help me find a match');return;}
 bubble('Find my match','user');bubble('Quick one: what’s your hair type?','assistant');
 quickReplies(['Straight','Wavy','Curly','Coily'],type=>{
  bubble(type+' hair','user');state=engine.applyMessage(state,'I have '+type.toLowerCase()+' hair',catalog).state;save();profile();
  bubble(type+' hair, got it. What look are you going for?','assistant');
  quickReplies(type==='Straight'?['Volume','Texture','Hold','Less frizz']:['Volume','Definition','Hold','Less frizz'],goal=>{const desired={Definition:'curl definition',Hold:'strong hold',Texture:'matte texture'}[goal]||goal.toLowerCase();respond('I have '+type.toLowerCase()+' hair and want '+desired+'. Please suggest products.');});
 });
}
function renderWelcome(){
 const wrap=node('div',undefined,'coach-welcome');wrap.id='coach-welcome';
 wrap.append(node('p','YOUR PERSONAL CARE COACH','welcome-eyebrow'),node('h2','What are we working on today?'),node('p','Tell me your goal, or add products you own and I’ll build around it.','welcome-copy'));
 const match=node('button',undefined,'match-card');match.type='button';match.setAttribute('aria-label','Find my match: choose hair type and goal');const text=node('span',undefined,'match-text');text.append(node('strong','Find my match'),node('small','Two taps: hair type, then goal.'));match.append(text,node('span','→','match-arrow'));match.addEventListener('click',startMatch);wrap.append(match);
 const starters=node('div',undefined,'welcome-starters');[['HAIR','Wavy & fluffy','I have wavy hair and want a fluffy look'],['CURLS','Define my curls','I have curly hair and want more definition'],['SKIN','Skin routine','Help me with a skin routine'],['BODY','Body routine','Help me with a body routine']].forEach(([tag,title,prompt])=>{const b=node('button');b.type='button';b.append(node('small',tag),node('span',title));b.addEventListener('click',()=>respond(prompt));starters.append(b)});wrap.append(starters);messages.replaceChildren(wrap);
}
function profile(){summary.replaceChildren();const values=[];if(state.category)values.push(state.category);if(state.hairType)values.push(state.hairType+' hair');if(state.hairLength)values.push(state.hairLength+' hair');if(state.goal)values.push(state.goal);if(state.washDays&&state.washDays.length)values.push('Wash: '+state.washDays.join(', '));if(state.ownershipKnown)values.push((state.ownedIds||[]).length+' products owned');if(!values.length)summary.append(node('span','Tell us your goals and what you own to get started.','profile-empty'));else values.forEach(x=>summary.append(node('span',String(x),'profile-chip')))}
function renderRoutine(){
 list.replaceChildren();const total=routine.length+legacy.length;document.querySelector('.chat-panel').classList.toggle('has-routine',total>0);document.querySelector('#routine-count').textContent=state.safetyHold?'Paused':total?total+' '+(total===1?'step':'steps'):'Not built yet';
 if(state.safetyHold){list.append(node('p','Routine hidden while a possible reaction is being discussed. Please consult a healthcare professional.','routine-warning'));return;}
 const entries=[...routine,...legacy];if(!entries.length){list.append(node('p','Your routine will appear here.','muted'));return;}
 list.append(node('p','YOUR PLAN','routine-overline'));
 entries.forEach((entry,i)=>{
  const product=catalog.find(p=>p.id===entry.productId),row=node('article',undefined,'routine-step'),number=node('span',String(i+1),'step-number'),content=node('div',undefined,'step-content'),header=node('div',undefined,'routine-step-header');
  number.setAttribute('aria-label','Step '+(i+1));header.append(node('small',(entry.day||'As needed')+(entry.legacy?' · saved earlier':''),'step-day'));
  const actions=node('div',undefined,'routine-actions'),edit=node('button','Edit');edit.type='button';edit.setAttribute('aria-label','Edit routine step');edit.addEventListener('click',()=>{const value=prompt('Edit routine step:',entry.instruction||'');if(value===null||!value.trim())return;entry.instruction=value.trim().slice(0,400);if(entry.legacy){const oldIndex=legacy.indexOf(entry);legacy.splice(oldIndex,1);entry.legacy=false;routine.push(entry);saveLegacy()}save();renderRoutine()});
  const remove=node('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove routine step');remove.addEventListener('click',()=>{if(entry.legacy){legacy=legacy.filter(x=>x!==entry);saveLegacy()}else routine=routine.filter(x=>x!==entry);save();renderRoutine()});actions.append(edit,remove);header.append(actions);content.append(header);
  const body=node('div',undefined,'step-body');if(product?.image){const img=node('img');img.src=product.image;img.alt='';img.loading='lazy';body.append(img)}const copy=node('div',undefined,'step-copy');if(product)copy.append(node('strong',product.name));if(entry.condition)copy.append(node('small',entry.condition,'step-condition'));copy.append(node('p',entry.instruction||'Directions need review.'));body.append(copy);content.append(body);
  if(entry.source){const a=node('a','Product details ↗','step-source');a.href=entry.source;a.target='_blank';a.rel='noopener noreferrer';content.append(a)}row.append(number,content);list.append(row);
 });
}
function saveLegacy(){try{localStorage.setItem(legacyKey,JSON.stringify(legacy.map(x=>({day:x.day,step:x.instruction}))));return true}catch(_){document.querySelector('.storage-note').textContent='Browser storage is unavailable; previously saved data may remain.';return false}}
let ownedFilter='all';
function changeOwnership(id,owned){const ids=new Set(state.ownedIds||[]);if(owned)ids.add(id);else ids.delete(id);state.ownedIds=[...ids];state.notOwnedIds=(state.notOwnedIds||[]).filter(x=>x!==id);if(!owned)state.notOwnedIds.push(id);state.ownershipKnown=true;state.useOwnedOnly=true;const categories=[...new Set(catalog.filter(item=>state.ownedIds.includes(item.id)).map(item=>item.category))];if(categories.length===1&&!state.categoryExplicit)state.category=categories[0];save();profile();}
function renderOwned(focusId){
 const target=document.querySelector('#owned-products');target.replaceChildren();
 const query=document.querySelector('#owned-search').value.trim().toLowerCase();
 const items=catalog.filter(p=>(ownedFilter==='all'||p.category===ownedFilter)&&p.name.toLowerCase().includes(query));
 document.querySelector('#owned-count').textContent=state.ownedIds?.length?'('+state.ownedIds.length+')':'';
 if(!items.length){target.append(node('p','No products found.','owned-empty'));return}
 items.forEach(p=>{const selected=(state.ownedIds||[]).includes(p.id);const b=node('button',undefined,'owned-item');b.type='button';b.dataset.productId=p.id;b.setAttribute('aria-pressed',String(selected));b.setAttribute('aria-label',p.name+(selected?', selected':', not selected'));if(p.image){const img=node('img');img.src=p.image;img.alt='';img.loading='lazy';b.append(img)}b.append(node('span',p.name),node('span',selected?'✓':'+','owned-check'));b.addEventListener('click',()=>{changeOwnership(p.id,!selected);renderProducts();renderOwned(p.id)});target.append(b)});

 if(focusId){const focus=[...target.querySelectorAll('button')].find(b=>b.dataset.productId===focusId);if(focus&&!focus.disabled)focus.focus()}
}
function renderProducts(){grid.replaceChildren();const items=catalog.filter(p=>filter==='all'||p.category===filter);items.forEach(p=>{const card=node('article',undefined,'product');if(p.image){const img=node('img');img.className='product-image';img.src=p.image;img.alt=p.name;img.loading='lazy';card.append(img)}card.append(node('span',p.category.toUpperCase(),'product-num'),node('h3',p.name),node('p',p.description||'Explore this product.'));const label=node('label',undefined,'ownership'),check=node('input');check.type='checkbox';check.checked=(state.ownedIds||[]).includes(p.id);check.addEventListener('change',()=>{changeOwnership(p.id,check.checked);renderOwned()});label.append(check,document.createTextNode('I own this'));card.append(label);const link=node('a','Explore product ↗');link.href=p.source;link.target='_blank';link.rel='noopener noreferrer';card.append(link);grid.append(card)})}
function makeRoutine(confirmed=false){
 if(!confirmed){const result=engine.applyMessage(state,'build my routine',catalog);state=result.state;save();profile();renderRoutine();bubble(result.reply,'assistant');if(!/routine is ready/i.test(result.reply)){routineDrawer.open=false;showTab('chat');document.querySelector('#chat-input').focus();return;}}
 if(state.safetyHold){bubble('I can’t build a product routine while you’ve reported a possible reaction. Please consult a healthcare professional.','assistant');return}
 const generated=engine.generateRoutine(state,catalog);if(!Array.isArray(generated)||!generated.length){bubble('Tell me which products you own and the type of routine you want.','assistant');return}
 const affected=new Set(catalog.filter(p=>p.category===state.category).map(p=>p.id));routine=routine.filter(step=>!step.productId||!affected.has(step.productId)).concat(generated);save();renderRoutine();showTab('chat');routineDrawer.open=true;document.querySelector('#routine-drawer summary').focus();
}
let gptConnected=false, gptBusy=false;
async function respond(text){
 if(gptBusy){bubble('Please wait for the current reply.','assistant',false);return}
 messages.querySelectorAll('.quick-replies').forEach(row=>row.remove());bubble(text,'user');try{
  const previousWashDays=JSON.stringify(state.washDays||[]);const result=engine.applyMessage(state,text,catalog);state=result.state;
  if(previousWashDays!==JSON.stringify(state.washDays||[])&&routine.some(step=>['shampoo','conditioner'].includes(step.productId))&&!/routine is ready/i.test(result.reply))result.reply+=' Your saved routine still has the old days. Open My routine below and choose “Build my routine” to update it.';
  save();profile();renderProducts();renderOwned();renderRoutine();
  const routineOrSafety=state.safetyHold||/routine|schedule|plan|symptom|allerg|ingredient|pregnan|reaction|diagnos|treat|cure|clear safety concern/i.test(text)||/routine is ready/i.test(result.reply)||!!state.lastQuestion;
  if(!gptConnected||routineOrSafety||result.localOnly){bubble(result.reply,'assistant');if(/routine is ready/i.test(result.reply))makeRoutine(true);return;}
  if(gptBusy){bubble('One moment — please wait for the current reply.','assistant');return}
  gptBusy=true;const send=document.querySelector('.send');send.disabled=true;const epoch=conversationEpoch;const history=conversationHistory.slice(0,-1).slice(-4);const waiting=bubble('Thinking…','assistant',false);waiting.setAttribute('role','status');
  try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history,allowedProductIds:state.ownershipKnown&&state.useOwnedOnly?state.ownedIds:null,profile:{hairType:state.hairType,hairLength:state.hairLength,goal:state.goal,category:state.category}})});const data=await response.json();waiting.remove();if(epoch!==conversationEpoch)return;if(!response.ok||!data.reply){document.querySelector('.status').textContent='● LOCAL FALLBACK';document.querySelector('.chat-bottom .footnote').textContent='Last GPT request failed · Local answers are available';bubble((data.error||'GPT is unavailable.')+' Using the local demo: '+result.reply,'assistant');return}const concise=data.reply.replace('Here are products from our collection to explore:', 'Here’s what to try:').replaceAll(' Product details: ', '\nDetails: ').replace('Our product information is provisional; check the current label for complete directions.', 'Check the label for complete directions.');bubble(concise,'assistant');document.querySelector('.status').textContent='● GPT REPLY';document.querySelector('.chat-bottom .footnote').textContent='GPT API · '+data.remaining+' requests left · Credit balance not checked';}catch(_){waiting.remove();if(epoch===conversationEpoch){document.querySelector('.status').textContent='● LOCAL FALLBACK';document.querySelector('.chat-bottom .footnote').textContent='Last GPT request failed · Local answers are available';bubble('GPT is unavailable. Using the local demo: '+result.reply,'assistant')}}finally{gptBusy=false;send.disabled=false}
 }catch(_){bubble('I couldn’t interpret that yet. Try sharing your hair or skin goal and the products you own.','assistant')}
}
if(location.protocol==='http:' && location.hostname==='127.0.0.1' && location.port==='8765')fetch('/api/status').then(r=>r.ok?r.json():null).then(s=>{if(s?.connected){gptConnected=true;document.querySelector('.chat-bottom .footnote').textContent='GPT configured · Credit balance not checked · Fictional details only';document.querySelector('.status').textContent='● GPT CONFIGURED';document.querySelector('.demo-notice p').textContent='Private GPT demo · API credit balance is not checked. Product information is provisional. Use fictional details only; not medical advice.'}}).catch(()=>{});
document.querySelector('#chat-form').addEventListener('submit',e=>{e.preventDefault();const input=document.querySelector('#chat-input'),text=input.value.trim();if(text&&!gptBusy){respond(text);input.value=''}});document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>respond(b.dataset.prompt)));document.querySelector('#generate-routine').addEventListener('click',()=>makeRoutine());
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.category;document.querySelectorAll('.filter').forEach(x=>{const selected=x===b;x.classList.toggle('active',selected);x.setAttribute('aria-pressed',String(selected))});renderProducts()}));
document.querySelector('#routine-form').addEventListener('submit',e=>{e.preventDefault();const step=document.querySelector('#step');if(!step.value.trim())return;routine.push({id:'manual-'+Date.now(),day:document.querySelector('#day').value,instruction:step.value.trim(),order:routine.length});step.value='';save();renderRoutine()});
document.querySelector('#reset').addEventListener('click',()=>{if(!confirm('Clear your saved demo routine, profile and chat in this browser?'))return;let ok=true;try{localStorage.removeItem(stateKey);localStorage.removeItem(legacyKey)}catch(_){ok=false}if(!ok){alert('Unable to clear browser storage. Previously saved data may remain.');return}state=engine.initialState();routine=[];legacy=[];conversationEpoch++;conversationHistory=[];messages.replaceChildren();document.querySelector('.chat-panel').classList.remove('conversation-started');renderWelcome();profile();renderRoutine();renderProducts();renderOwned()});
renderWelcome();profile();renderRoutine();renderProducts();renderOwned();
const widget=document.querySelector('#coach-widget'),launcher=document.querySelector('#chat-launcher'),closeChat=document.querySelector('#chat-close'),chatTab=document.querySelector('#chat-tab'),routineDrawer=document.querySelector('#routine-drawer'),ownedTab=document.querySelector('#owned-tab'),ownedView=document.querySelector('#owned-view'),chatView=document.querySelector('#chat-view');
const expandChat=document.querySelector('#expand-chat');
let expanded=false,expandAnimation=null;
function setExpanded(value){
 if(expanded===value)return;
 const before=widget.getBoundingClientRect();
 if(expandAnimation){expandAnimation.cancel();expandAnimation=null;}
 expanded=value;widget.classList.toggle('is-expanded',value);
 expandChat.setAttribute('aria-pressed',String(value));expandChat.setAttribute('aria-label',value?'Return chat to compact size':'Expand chat to full screen');expandChat.title=value?'Return to compact':'Expand chat';
 if(widget.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const after=widget.getBoundingClientRect();if(!before.width||!before.height||!after.width||!after.height)return;
 const x=before.left-after.left,y=before.top-after.top,sx=before.width/after.width,sy=before.height/after.height;
 expandAnimation=widget.animate([{transformOrigin:'top left',transform:`translate(${x}px, ${y}px) scale(${sx}, ${sy})`},{transformOrigin:'top left',transform:'translate(0, 0) scale(1, 1)'}],{duration:340,easing:'cubic-bezier(.2,.75,.2,1)'});
 const running=expandAnimation;running.onfinish=()=>{if(expandAnimation===running)expandAnimation=null;};
}
function showTab(which){chatTab.setAttribute('aria-selected',String(which==='chat'));ownedTab.setAttribute('aria-selected',String(which==='owned'));chatView.hidden=which!=='chat';ownedView.hidden=which!=='owned';if(which==='owned')renderOwned();}
function openCoach(which='chat'){widget.hidden=false;launcher.setAttribute('aria-expanded','true');showTab(which);if(which==='chat')document.querySelector('#chat-input').focus();else document.querySelector('#owned-search').focus()}
function closeCoach(){widget.hidden=true;setExpanded(false);launcher.setAttribute('aria-expanded','false');launcher.focus()}
launcher.addEventListener('click',()=>widget.hidden?openCoach():closeCoach());closeChat.addEventListener('click',closeCoach);expandChat.addEventListener('click',()=>setExpanded(!expanded));chatTab.addEventListener('click',()=>showTab('chat'));ownedTab.addEventListener('click',()=>showTab('owned'));document.querySelector('#open-routine').addEventListener('click',()=>{showTab('chat');routineDrawer.open=!routineDrawer.open;if(routineDrawer.open)document.querySelector('#routine-drawer summary').focus()});routineDrawer.addEventListener('toggle',()=>document.querySelector('#open-routine').setAttribute('aria-expanded',String(routineDrawer.open)));document.querySelector('#choose-owned').addEventListener('click',()=>{showTab('owned');document.querySelector('#owned-search').focus()});document.querySelector('#owned-done').addEventListener('click',()=>{showTab('chat');document.querySelector('#chat-input').focus()});document.querySelector('#owned-search').addEventListener('input',()=>renderOwned());document.querySelectorAll('.owned-filter').forEach(b=>b.addEventListener('click',()=>{ownedFilter=b.dataset.ownedCategory;document.querySelectorAll('.owned-filter').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))});renderOwned()}));document.querySelectorAll('[data-open-chat]').forEach(b=>b.addEventListener('click',()=>openCoach()));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!widget.hidden){if(expanded)setExpanded(false);else closeCoach()}});
document.querySelectorAll('[data-nav-category]').forEach(a=>a.addEventListener('click',()=>{const b=document.querySelector('.filter[data-category="'+a.dataset.navCategory+'"]');if(b)b.click()}));
