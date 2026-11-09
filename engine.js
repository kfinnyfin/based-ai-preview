/* Private demo: deterministic, source-grounded conversation and routine builder. */
(function (root) {
  'use strict';
  const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const HAIR_ORDER=['shampoo','conditioner','leave-in-conditioner','curl-cream','curl-mousse','curl-gel','sea-salt-spray','hair-clay','pomade','texturizing-powder','hair-elixir','curl-refresh-spray'];
  const SKIN_ORDER=['daily-facial-cleanser','skin-revival-spray','skin-elixir','under-eye-elixir','daily-facial-moisturizer','tallow-moisturizer'];
  const BODY_ORDER=['bodywash','body-lotion','deodorant'];
  const ALIASES={
    'texturizing-powder':['texture powder','texturizing powder','powder'],
    'sea-salt-spray':['sea salt spray','salt spray'], 'hair-clay':['hair clay','clay'],
    'pomade':['pomade'], 'curl-mousse':['curl mousse','mousse'], 'curl-gel':['curl gel','gel'],
    'curl-refresh-spray':['curl refresh spray','curl refresh','refresh spray'],
    'curl-cream':['curl cream'], 'leave-in-conditioner':['leave-in conditioner','leave in conditioner','leave-in','leave in'],
    'shampoo':['shampoo'], 'conditioner':['conditioner'], 'hair-elixir':['hair elixir','hair oil','elixir'],
    'daily-facial-cleanser':['daily facial cleanser','daily cleanser','facial cleanser','face cleanser','face wash'],
    'daily-facial-moisturizer':['daily facial moisturizer','daily moisturizer','daily moisturiser','facial moisturizer','face moisturizer','face moisturiser'],
    'tallow-moisturizer':['tallow moisturizer','tallow moisturiser','tallow'],
    'skin-elixir':['multi-active skin elixir','multi active skin elixir','skin elixir'],
    'under-eye-elixir':['under eye elixir','under-eye elixir','eye elixir'],
    'skin-revival-spray':['skin revival spray','revival spray'], 'bodywash':['body wash','bodywash'],
    'body-lotion':['body lotion','lotion'], 'deodorant':['deodorant','deo']
  };
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const find=(catalog,id)=>catalog.find(p=>p.id===id);
  const label=(catalog,id)=>find(catalog,id)?.name || id;
  const unique=values=>Array.from(new Set(values));
  const BUNDLE_ALIASES={'complete-curly-kit':['curly kit'],'straight-wavy-kit':['straight wavy kit','straight and wavy kit']};
  function bundleNames(bundle){return [bundle.name,...(BUNDLE_ALIASES[bundle.id]||[])];}
  function bundlePattern(name){return esc(name).replace(/\s+/g,'\\s+');}
  function mentionedBundles(text){
    const bundles=Array.isArray(root.BASED_BUNDLES)?root.BASED_BUNDLES:[];
    return bundles.filter(b=>b&&typeof b.name==='string'&&b.name&&Array.isArray(b.products)&&bundleNames(b).some(name=>new RegExp('(?:^|[^a-z0-9])'+bundlePattern(name)+'(?=$|[^a-z0-9])','i').test(text)));
  }
  function initialState(){return {version:1,category:'hair',hairType:null,hairLength:null,hairThickness:null,goal:null,ownershipKnown:false,ownedIds:[],notOwnedIds:[],washDays:[],washFrequency:null,washDaysProvisional:false,notes:[],useOwnedOnly:true,categoryExplicit:false,safetyHold:false,lastQuestion:null,lastProductId:null,lastProductIds:[],lastBundleId:null};}
  function normalize(state){const s={...initialState(),...(state||{})};for(const key of ['ownedIds','notOwnedIds','washDays','notes','lastProductIds'])if(!Array.isArray(s[key]))s[key]=[];if(!s.lastProductIds.length&&s.lastProductId)s.lastProductIds=[s.lastProductId];return s;}
  function productMentions(text,catalog){
    const lower=text.toLowerCase(), matches=[]; const aliases=[];
    for(const p of catalog){for(const alias of unique([...(ALIASES[p.id]||[]),p.name.toLowerCase()])) aliases.push({id:p.id,alias});}
    aliases.sort((a,b)=>b.alias.length-a.alias.length);const occupied=[];
    for(const {id,alias} of aliases){const re=new RegExp('(^|[^a-z])('+esc(alias)+')(?=$|[^a-z])','ig');let m;
      while((m=re.exec(lower))){const start=m.index+m[1].length,end=start+m[2].length;if(occupied.some(([a,b])=>start<b&&end>a))continue;
        occupied.push([start,end]);matches.push({id,start,end});}}
    return matches.sort((a,b)=>a.start-b.start);
  }
  function extractOwnership(text,mentions,state){
    if((state.lastQuestion==='owned'&&/^\s*(?:none|no|nothing)\s*[.!]?\s*$/i.test(text))||/\b(?:no products|i have none|don'?t have (?:any )?products|don'?t own any|do not own any|own none|have nothing|no based products)\b/i.test(text)){state.ownershipKnown=true;state.ownedIds=[];state.notOwnedIds=[];return;}
    const lower=text.toLowerCase(); if(!mentions.length)return;
    // "Do I use clay on wet hair?" is a question, not a claim that the customer owns it.
    if(/^\s*(?:do|does|can|could|should|would|will|may|when|how|where|why|what)\b/i.test(text))return;
    const ownership=/\b(?:i have|i own|i use|i already|i got|i've got|i bought|my products|products i have|products i own|i don'?t have|i do not have|i don'?t own|i no longer|i stopped using|without|only have|\bno\b)\b/i.test(text);
    if(!ownership&&state.lastQuestion!=='owned')return;
    if(/\b(?:i only have|i only own|i have only|products i own are)\b/i.test(text)){state.ownedIds=[];state.notOwnedIds=[];}
    let previousNeg=false;
    for(let i=0;i<mentions.length;i++){
      const m=mentions[i], prev=i?mentions[i-1].end:0;const between=lower.slice(prev,m.start);const clause=between.split(/[,;.]|\bbut\b|\bexcept\b/).pop();
      let neg=/\b(?:don'?t|do not|no longer|without|not|no|never|except|missing)\b/.test(clause);
      const resets=/\b(?:but|instead|however)\b/.test(between)||/\b(?:i have|i own|i use|i already|i got)\b/.test(clause);
      if(!neg&&!resets&&i>0)neg=previousNeg;previousNeg=neg;
      if(neg){state.ownedIds=state.ownedIds.filter(x=>x!==m.id);state.notOwnedIds=unique([...state.notOwnedIds,m.id]);}
      else{state.ownershipKnown=true;state.notOwnedIds=state.notOwnedIds.filter(x=>x!==m.id);state.ownedIds=unique([...state.ownedIds,m.id]);}
    }
  }
  function updateFacts(s,text,catalog){
    const lower=text.toLowerCase();const mentions=productMentions(text,catalog);
    if(/\b(?:hair|skin|body)\s+(?:care\s+)?(?:routine|schedule|plan)\b/.test(lower)||s.lastQuestion==='category'&&/\b(?:hair|skin|body)\b/.test(lower))s.categoryExplicit=true;
    if(/\b(?:body|deodorant|body wash|body lotion)\b/.test(lower)&&!/\b(?:hair|shampoo|curl)\b/.test(lower))s.category='body';
    if(/\b(?:skin|skincare|skin care|face|facial|under.eye)\b/.test(lower)&&!/\b(?:hair|shampoo|curl)\b/.test(lower))s.category='skin';
    if(/\b(?:hair|shampoo|curl|wavy|straight|coily|scalp)\b/.test(lower))s.category='hair';
    const typeText=mentionedBundles(text).flatMap(bundleNames).sort((a,b)=>b.length-a.length).reduce((value,name)=>value.replace(new RegExp(bundlePattern(name),'ig'),''),lower);
    const typeQuestion=/\?/.test(typeText)||/^\s*(?:is|are|does|do|can|could|would|should|what|which|how)\b/.test(typeText);
    const selfDescription=/\b(?:my hair (?:is|is naturally)|i have|i['’]ve got|my (?:curls|waves))\b/.test(typeText);
    if(!typeQuestion||selfDescription){
      if(/\b(?:straight|wavy|curly|coily)\b/.test(typeText)){const m=[...typeText.matchAll(/\b(straight|wavy|curly|coily)\b/g)];s.hairType=m[m.length-1][1];}
      else if(/\bcurls?\b/.test(typeText))s.hairType='curly';else if(/\bwaves?\b/.test(typeText))s.hairType='wavy';
    }
    const length=lower.match(/\b(short|medium|long)\s*(?:length\s*)?hair\b|\b(?:my hair is|hair is|it is|it'?s)\s+(short|medium|long)\b|\b(\d+(?:\.\d+)?)\s*(?:inches|inch|in\b)/);if(length)s.hairLength=length[1]||length[2]||(length[3]+' inches');
    const goals=[[/\bslick(?:ed)?[ -]?back|slick (?:finish|look)|wet look|pompadour\b/,'slicked-back'],[/\b(?:frizz|frizzy|dry|dryness|moisture|hydration)\b/,'hydration and frizz control'],[/\b(?:curl definition|defined curls?|curlier|curl definition|define (?:my )?curls?)\b/,'curl definition'],[/\b(?:volume|voluminous|flat|fuller|fluffy)\b/,'volume'],[/\b(?:matte|messy|texture|textured)\b/,'matte texture'],[/\b(?:strong hold|maximum hold)\b/,'strong hold']];
    // Describing hair's state during application is not a concern about dryness.
    const applicationState=/\b(?:on|onto|to)\s+(?:(?:wet|damp)\s+or\s+)?dry\s+hair\b|\bwet\b.*\bdry\b|\bdry\b.*\bwet\b/.test(lower)||mentions.length>0&&/\b(?:apply|use|put|style|for)\b/.test(lower)&&/\bdry\b/.test(lower)&&!/\b(?:my hair is|i have|i['’]ve got)\s+dry\s+hair\b/.test(lower);
    const goalText=applicationState?lower.replace(/\bdry\b/g,''):lower;
    for(const [re,g] of goals)if(re.test(goalText)){s.goal=g;break;}
    extractOwnership(text,mentions,s);
    if(/\b(?:only (?:use|using)|use only|use what i (?:have|own)|products i (?:already )?own|what i already have)\b/.test(lower))s.useOwnedOnly=true;
    if(/\b(?:recommend|suggest|open to buying|can buy|other products)\b/.test(lower))s.useOwnedOnly=false;
    const hasWashContext=/\b(?:wash|shampoo|routine|schedule|days?)\b/.test(lower)||s.lastQuestion==='washDays'||s.lastQuestion==='category'||s.washDays.length>0&&/\b(?:actually|instead|change|changed|correction)\b/.test(lower);
    if(hasWashContext){const days=DAYS.filter(day=>new RegExp('\\b'+day.toLowerCase()+'s?\\b').test(lower));if(days.length){s.washDays=days;s.washFrequency=days.length;s.washDaysProvisional=false;}
      else {const count=lower.match(/\b(once|twice|one|two|three|four|five|six|seven|[1-7])\s*(?:times?|x)?\s*(?:a|per|each|every)\s*week\b|\b([1-7])\s*(?:x|times?)\s*(?:weekly|a week|per week)\b/);
        if(count){const num={once:1,twice:2,one:1,two:2,three:3,four:4,five:5,six:6,seven:7}[count[1]]||Number(count[1]||count[2]); const examples={1:['Monday'],2:['Monday','Thursday'],3:['Monday','Wednesday','Saturday'],4:['Monday','Wednesday','Friday','Sunday'],5:['Monday','Tuesday','Thursday','Friday','Sunday'],6:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],7:DAYS};s.washFrequency=num;s.washDays=examples[num].slice();s.washDaysProvisional=true;}}
    }
    return mentions;
  }
  function safeDirection(product){if(!product)return null;const raw=product.directions;return typeof raw==='string'&&raw.trim()?raw.trim():null;}
  function answerProduct(product,question,productCount=1){
    const faq=product.faq||{};
    const condition=typeof product.condition==='string'?product.condition.trim():'';
    const direction=safeDirection(product);
    const suitability=/\b(?:for\s+dry\s+hair|(?:good|suitable|best|helpful)\s+(?:for|on)\s+dry\s+hair)\b/i.test(question);
    const hairTypeQuestion=/\b(?:what|which)\s+(?:hair\s+)?types?\b|\b(?:who|whom)\s+(?:is|does)\b|\b(?:good|suitable|best|ideal|works?|for)\b[^?]*\b(?:straight|wavy|curly|coily|fine|thick)\s+hair\b/i.test(question);
    const pairing=/\b(?:together|combine|combination|mix|mixing|layer|pair|alongside|with other)\b/i.test(question)||(productCount>1&&/\b(?:with|before|after)\b/i.test(question));
    const purpose=/\b(?:what (?:does|is|can)|what(?:’s|'s) (?:the|it))\b.*\b(?:do|does|for|purpose|benefits?)\b|\b(?:benefits?|purpose|what is it for)\b/i.test(question);
    const bottle=/\b(?:how long|lasts?)\b.*\b(?:bottle|container|product|last)\b|\bhow long (?:does|will) (?:it|this) last\b/i.test(question);
    const scent=/\b(?:scent|scented|smell|fragrance|perfume)\b/i.test(question);
    const hold=/\b(?:hold|holding)\b/i.test(question);
    const finish=/\b(?:finish|matte|shiny|shine|glossy)\b/i.test(question)&&!purpose;
    const cast=/\bcast\b/i.test(question);
    const where=/\bwhere\b/i.test(question);
    const amount=/\b(?:how much|how many pumps|amount)\b/i.test(question);
    const wetDry=/\b(?:wet|dry|damp|towel.dried|soaking)\b/i.test(question)&&/\b(?:apply|application|use|put|spray|style|when|before|after|wet|damp|towel.dried|soaking)\b/i.test(question)&&!suitability;
    const frequencyQuestion=unique([product.name,...(ALIASES[product.id]||[])]).sort((a,b)=>b.length-a.length).reduce((q,name)=>q.replace(new RegExp(esc(name),'ig'),''),question);
    const frequency=/\b(?:how often|how frequently|how many times|every day|daily|frequency)\b/i.test(frequencyQuestion);
    const rinsing=/\b(?:rinse|wash)\s+(?:it\s+|this\s+)?(?:out|off)\b|\brins(?:e|ing)\b/i.test(question);
    const use=/\b(?:how|when|where|apply|use|put|application|directions?|wet|damp)\b/i.test(question);
    let body;
    if(bottle){body=faq.bottle||'I don’t have a verified estimate for how long this product lasts.';}
    else if(scent){body=faq.scent||'I don’t have verified scent details for this product or variant. Check the product page.';}
    else if(cast&&faq.cast){body=faq.cast;}
    else if(hold&&faq.hold){body=faq.hold;}
    else if(finish&&faq.finish){body=faq.finish;}
    else if(purpose&&faq.purpose){body=faq.purpose;}
    else if(where&&faq.where){body=faq.where;}
    else if(amount&&faq.amount){body=faq.amount;}
    else if(product.id==='hair-clay'&&/\b(?:wash|rinse)\s+(?:it\s+|this\s+)?(?:out|off)\b/i.test(question)){body='Our Hair Clay product page says it washes out with shampoo.';}
    else if(suitability){body=faq.dryFit||'I don’t have verified guidance on whether this product suits dry hair. '+(product.description||'Check the product label or page.');}
    else if(pairing){body=product.combinations||'I don’t have a verified pairing for this product. Check the product page.';}
    else if(hairTypeQuestion){const fit=product.suitability||condition;body=/\b(?:straight|wavy|curly|coily|all hair types)\b/i.test(fit)?fit:'I don’t have verified hair-type guidance for this product. Check the product page.';}
    else if(rinsing){body=faq.rinse|| (direction&&/\brinse\b/i.test(direction)?direction:'I don’t have verified rinse-out instructions for this product. Check the label or product page.');}
    else if(wetDry){
      const waterCondition=/\b(?:wet|damp|dry)\s+(?:or\s+(?:wet|damp|dry)\s+)?(?:hair|curls|skin|face)\b|\b(?:wet|damp|dry)\s+(?:after|before)\b/i.test(condition)?condition:'';
      const waterDirection=direction&&/\b(?:wet|damp|dry)\s+(?:or\s+(?:wet|damp|dry)\s+)?(?:hair|curls|skin|face)\b|\b(?:wet|damp|dry)\s+(?:after|before)\b/i.test(direction)?direction:'';
      body=waterCondition||waterDirection ? [waterCondition,waterDirection&&waterDirection!==waterCondition?waterDirection:''].filter(Boolean).join('. ') : 'I don’t have verified directions for whether to apply it to wet, damp, or dry hair. '+(direction?direction+' ':'')+'Check the product label or page.';
    } else if(frequency){body=faq.frequency||product.frequency||'I don’t have a verified frequency for this product. Check the label or product page.';}
    else if(use){body=direction?[direction,condition].filter(Boolean).join(' '):'I don’t have verified application directions for this product. Check the label or product page.'+(condition?' Product details: '+condition+'.':'');}
    else body=product.description||'Check the product page for details.';
    const sources=unique([product.source,...(Array.isArray(product.additionalSources)?product.additionalSources:[])].filter(Boolean));
    return `${product.name}: ${body}${sources.length?'\n\nSources: '+sources.join(' · '):''}`;
  }
  function safeCondition(product){return typeof product?.condition==='string'&&product.condition.trim()?product.condition.trim():'Not specified in reviewed source';}
  function addStep(out,day,product,order,note){const direction=safeDirection(product);out.push({id:`${day.toLowerCase().replace(/\s+/g,'-')}-${product.id}-${out.length}`,day,order,productId:product.id,condition:safeCondition(product),instruction:(direction || 'Check the current product page for application directions.')+(note?' '+note:''),source:product.source||null,directionVerified:!!direction});}
  function generateRoutine(inputState,catalog){
    const s=normalize(inputState),result=[];if(!Array.isArray(catalog)||s.safetyHold)return result;
    const known=s.ownershipKnown?s.ownedIds:[];const order=s.category==='skin'?SKIN_ORDER:s.category==='body'?BODY_ORDER:HAIR_ORDER;
    const selected=order.map(id=>find(catalog,id)).filter(p=>p&&known.includes(p.id));
    for(const p of selected){const rank=order.indexOf(p.id)+1;
      if(p.id==='curl-gel'&&(s.hairType==='straight'||s.hairType==='wavy'))continue;
      if(p.id==='pomade'&&s.goal==='slicked-back'){addStep(result,'As needed',{...p,directions:null},rank,'I don’t have verified application steps for a slicked-back look; check the product label.');continue;}
      if(s.category==='hair'&&(p.id==='shampoo'||p.id==='conditioner')){for(const day of s.washDays){const product=p.id==='shampoo'&&!known.includes('conditioner')?{...p,directions:(p.directions||'').replace(/, then follow with conditioner\.?/i,'.')}:p;addStep(result,day,product,rank,s.washDaysProvisional?'This is an editable example day.':'');}}
      else if(s.category==='hair'&&['leave-in-conditioner','hair-elixir'].includes(p.id)&&s.washDays.length&&/damp|wet/i.test(p.condition||'')){for(const day of s.washDays)addStep(result,day,p,rank,s.washDaysProvisional?'This is an editable example day.':null);}
      else if(p.id==='skin-revival-spray'&&known.includes('skin-elixir')) addStep(result,'As needed',p,rank,'If using with our Skin Elixir, use at separate times or let the spray dry completely; see the product instructions.');
      else if(p.id==='skin-elixir'&&known.includes('skin-revival-spray')){for(const day of DAYS)addStep(result,day,p,rank,'Once daily. If using with our Skin Revival Spray, use at separate times or let the spray dry completely; see the product instructions.');}
      else if(p.id==='daily-facial-cleanser'&&/^Daily use is an option according to the product page\.$/i.test(p.frequency||'')){for(const day of DAYS)addStep(result,day,p,rank,'Editable example: daily use is an option according to the product page.');}
      else if(s.category!=='hair'&&/^(?:once daily|morning and night per product page|daily or reapply as needed)$/i.test(p.frequency||'')){for(const day of DAYS)addStep(result,day,p,rank,p.frequency+'.');}
      else addStep(result,'As needed',p,rank,s.category==='hair'&&['curl-cream','curl-mousse','curl-gel','sea-salt-spray','hair-clay','pomade','texturizing-powder','curl-refresh-spray'].includes(p.id)?'Consider this a separate styling option; use according to your goal rather than assuming all styling products must be layered.':null);
    }
    return result.sort((a,b)=>{const da=DAYS.indexOf(a.day),db=DAYS.indexOf(b.day);return (da<0?7:da)-(db<0?7:db)||a.order-b.order;});
  }
  function recommendations(s,catalog){let ids=[];if(s.category==='body')ids=['bodywash','body-lotion','deodorant'];else if(s.category==='skin')ids=['daily-facial-cleanser','daily-facial-moisturizer'];else if(s.goal==='slicked-back')ids=['pomade'];else if(s.goal==='matte texture'||s.goal==='strong hold')ids=s.hairType==='curly'||s.hairType==='coily'?['curl-gel']:['hair-clay'];else if(s.goal==='hydration and frizz control')ids=s.hairType==='straight'?['conditioner','hair-elixir']:['conditioner','leave-in-conditioner','hair-elixir'];else if(s.goal==='volume')ids=s.hairType==='curly'||s.hairType==='coily'?['curl-mousse']:['texturizing-powder','sea-salt-spray'];else if(s.goal==='curl definition'||s.hairType==='curly'||s.hairType==='coily')ids=s.hairType==='wavy'?['curl-cream','curl-mousse']:['curl-cream','curl-gel','curl-mousse'];else if(s.hairType==='wavy')ids=['sea-salt-spray','curl-mousse'];
    if(s.hairLength==='0–2 inches'||s.hairLength==='2–4 inches')ids=ids.filter(id=>id!=='curl-gel');
    if(s.hairLength==='0–2 inches')ids=ids.filter(id=>id!=='curl-refresh-spray');
    return ids.filter(id=>find(catalog,id)&&!s.ownedIds.includes(id)&&(!s.useOwnedOnly||!s.notOwnedIds.includes(id)));}
  function applyMessage(inputState,text,catalog){
    const s=normalize(inputState),message=String(text||'').trim();if(!message)return {state:s,reply:'Tell me what you’d like help with.'};const lower=message.toLowerCase();const mentions=updateFacts(s,message,catalog);
    const symptom=/\b(?:rash|itch|irritat|burn|swell|pain|bleed|sore|allerg|hair loss|losing hair|reaction|dandruff|flakes?|flaking)\w*/i.test(lower);
    const symptomHypothetical=/^\s*(?:can|could|would|will|does|do|is|are|may)\b/i.test(message)&&!/\b(?:my|me|i have|i['’]m|i am|i get|i got|i feel|i noticed|gave me|caused me)\b/i.test(message);
    const symptomNegated=/\b(?:no|not|never|don['’]t have|do not have)\s+(?:any\s+|a\s+)?(?:rash|itch|irritat|burn|swell|pain|bleed|sore|allerg|hair loss|reaction|dandruff|flakes?|flaking)\w*/i.test(message);
    if(symptom&&!symptomHypothetical&&!symptomNegated){s.safetyHold=true;s.lastQuestion=null;return {state:s,localOnly:true,reply:'I can’t assess symptoms or diagnose a condition. Stop using a product that seems to cause a reaction and contact a healthcare professional. Seek urgent care for severe or urgent symptoms.'};}
    if(s.safetyHold){if(/\b(?:clear safety concern|clear safety hold|i have resolved the concern)\b/i.test(lower)){s.safetyHold=false;return {state:s,reply:'I’ve cleared the pause at your request. I can’t determine whether a product is safe for you. Tell me if you’d like to rebuild the routine.'};}return {state:s,reply:'I’ve paused routine creation because you mentioned a possible reaction. Stop using a product that seems to cause it and contact a healthcare professional. When the concern has been resolved, you can say “clear safety concern” to remove the pause.'};}
    if(symptom&&!symptomNegated){s.lastQuestion=null;return {state:s,localOnly:true,reply:'I can’t predict whether a product will cause a reaction for you. Check the full ingredient list and ask a healthcare professional about your concerns.'};}
    if(/\b(?:treat|treatment|cure|diagnos)\w*/i.test(lower)){s.lastQuestion=null;return {state:s,localOnly:true,reply:'I can’t diagnose or recommend a treatment for a medical condition. Please ask a healthcare professional about your symptoms.'};}
    if(/\b(?:allergen|allerg|pregnan|safe for me)\w*/i.test(lower)){s.lastQuestion=null;return {state:s,localOnly:true,reply:'I can’t determine personal safety. Please check the current full ingredient list on the product label and ask a qualified professional about your individual situation.'};}
    const ingredientQuestion=(mentions.length>0||s.lastProductIds.length>0&&/\b(?:it|its|them|these|those)\b/i.test(message))&&!mentionedBundles(message).length&&(/\b(?:ingredients?|contain(?:s|ed)?|made\s+(?:with|from)|free\s+(?:of|from))\b/i.test(message)||(/\b(?:does|do|is|are)\b[^?]*\b(?:have|has)\b/i.test(message)&&!/\b(?:hold|finish|scent|smell|fragrance|texture|volume|shine|benefits?|directions?|instructions?)\b/i.test(message)));
    if(ingredientQuestion){
      const ids=unique(mentions.length?mentions.map(m=>m.id):s.lastProductIds).slice(0,3);const products=ids.map(id=>find(catalog,id)).filter(Boolean);
      const explicit=message.match(/\b(?:contain(?:s|ed)?|made\s+(?:with|from)|free\s+(?:of|from))\s+(?:any\s+)?([a-z][a-z\s-]*?)(?:\s+(?:in\s+(?:it|them)|and\s+|or\s+)|[?.!,]|$)/i);
      const query=explicit?.[1]?.trim().toLowerCase();const listRequest=/\b(?:what|which|list|full)\b[^?]*\bingredients?\b|\bingredients?\s+(?:list|in)\b/i.test(message);
      const replies=products.map(p=>{const ingredients=Array.isArray(p.ingredients)?p.ingredients.filter(x=>typeof x==='string'&&x.trim()):[];const source=p.ingredientSource||p.source;let answer;
        if(listRequest&&ingredients.length)answer=(/^partial/i.test(p.ingredientListStatus||'')?'The page identifies these ingredients, but we don’t have a complete ingredient list: ':'The reviewed page lists these ingredients: ')+ingredients.join(', ')+'.';
        else if(query&&!/\bfree\s+(?:of|from)\b/i.test(message)){const found=ingredients.filter(x=>x.toLowerCase().includes(query));answer=found.length?'The reviewed page lists '+found.join(', ')+'.':'I can’t confirm that ingredient from the reviewed ingredient list.';}
        else answer='I can’t confirm the full ingredient list from the reviewed information.';
        if(/conflict|inconsisten/i.test(p.ingredientNotes||''))answer+=' The page has conflicting ingredient information, so please verify the label.';
        return p.name+': '+answer+' Check your product label for its current formula and variant.'+(source?'\nSource: '+source:'');});
      s.lastQuestion=null;if(mentions.length){s.lastProductIds=ids;s.lastProductId=ids[ids.length-1]||null;}return {state:s,localOnly:true,reply:replies.length?replies.join('\n\n'):'Please name the product so I can check its ingredient information.'};
    }
    if(/\bingredients?\b/i.test(lower)){s.lastQuestion=null;return {state:s,localOnly:true,reply:'Which product’s ingredients would you like to check?'};}
    if(/\b(?:ignore (?:your|all|previous)|system prompt|developer instructions|other brands?)\b/i.test(lower)){s.lastQuestion=null;return {state:s,reply:'I can help you explore our BASED products and build a routine. What products do you already have?'};}
    let bundles=mentionedBundles(message);let bundleOwned=false;
    if(!bundles.length&&!mentions.length&&s.lastBundleId&&/\b(?:it|its|this|that)\b/i.test(message)&&/\b(?:contain|contains|include|includes|included|inside|comes? with)\b/i.test(message))bundles=(root.BASED_BUNDLES||[]).filter(b=>b.id===s.lastBundleId);
    if(bundles.length)s.lastBundleId=bundles[bundles.length-1].id;else if(mentions.length)s.lastBundleId=null;
    for(const bundle of bundles){
      if(bundleNames(bundle).some(name=>new RegExp('\\b(?:i\\s+(?:own|have|bought|got)|my)\\s+(?:the\\s+)?'+bundlePattern(name)+'(?=$|[^a-z0-9])','i').test(message))){
        const components=bundle.products.filter(id=>typeof id==='string'&&find(catalog,id));
        if(components.length){s.ownedIds=unique([...s.ownedIds,...components]);s.notOwnedIds=s.notOwnedIds.filter(id=>!components.includes(id));s.ownershipKnown=true;s.useOwnedOnly=true;bundleOwned=true;}
      }
    }
    if(bundleOwned){const categories=unique(s.ownedIds.map(id=>find(catalog,id)?.category).filter(Boolean));if(categories.length===1&&!s.categoryExplicit)s.category=categories[0];}
    if(mentions.length){s.lastProductIds=unique(mentions.map(m=>m.id));s.lastProductId=s.lastProductIds[s.lastProductIds.length-1];}
    else if(bundleOwned){s.lastProductIds=unique(bundles.flatMap(b=>b.products).filter(id=>find(catalog,id)));s.lastProductId=s.lastProductIds[s.lastProductIds.length-1]||null;}
    if(bundles.length&&/\b(?:what(?:'s| is| are)?|which|contents?|contain|included?|comes? with|inside)\b/i.test(message)&&!/\b(?:routine|schedule|steps)\b/i.test(message)){
      s.lastQuestion=null;return {state:s,localOnly:true,reply:bundles.map(b=>{const names=b.products.map(id=>find(catalog,id)).filter(Boolean).map(p=>p.name);return b.name+': '+(names.length?'Includes '+names.join(', ')+'.'+(names.length<b.products.length?' Some set contents still need verification.':''):'I don’t have a verified component list for this set.')+(b.source?'\nSource: '+b.source:'');}).join('\n\n')};
    }
    const styleRequest=/\b(?:how|style|styling|achieve|make|get|create)\b/i.test(message)&&!/\b(?:routine|schedule|plan)\b/i.test(message);
    const guideId=/\b(?:messy|textured|beachy)\b/i.test(message)?'textured-messy':/\b(?:defined?\s+(?:my\s+)?(?:waves?|curls?)|(?:waves?|curls?)\s+(?:more\s+)?defined|(?:more|fuller)\s+defined\s+(?:waves?|curls?))\b/i.test(message)?'defined-waves':/\b(?:volume|voluminous|flat hair)\b/i.test(message)?'maximum-volume':null;
    const guide=(root.BASED_STYLE_GUIDES||[]).find(item=>item.id===guideId);
    if(styleRequest&&guide&&s.ownershipKnown&&s.useOwnedOnly&&!mentions.length){
      s.lastQuestion=null;
      if(s.hairType&&Array.isArray(guide.hairTypes)&&!guide.hairTypes.includes(s.hairType))return {state:s,localOnly:true,reply:`Our ${guide.name} guide is for ${guide.hairTypes.join(' or ')} hair. I don’t have a verified version for ${s.hairType} hair using your selected products.\n\nSource: ${guide.source}`};
      const available=guide.productSteps.filter(step=>s.ownedIds.includes(step.productId));
      if(!available.length)return {state:s,localOnly:true,reply:`I don’t have a verified ${guide.name} guide using the products you selected. Ask for BASED recommendations if you’d like other options.`};
      const lines=[`For a ${guide.name}, here’s an option using what you have:`,guide.intro||'',...available.map(step=>label(catalog,step.productId)+': '+step.text)].filter(Boolean);
      if(available.length<guide.productSteps.length)lines.push('This is the part of our guide that uses your selected products.');
      lines.push('Source: '+guide.source);return {state:s,localOnly:true,reply:lines.join('\n\n')};
    }
    const answeringPending=(s.lastQuestion==='washDays'&&s.washDays.length>0)||(s.lastQuestion==='owned'&&(s.ownershipKnown||mentions.length>0))||(s.lastQuestion==='category'&&/\b(?:hair|skin|body)\b/.test(lower));
    const routineIntent=/\b(?:routine|schedule|plan|steps|regenerate|what should i do|what do i do|make me|create|build)\b/.test(lower)||answeringPending;
    if(!routineIntent&&s.lastQuestion)s.lastQuestion=null;
    const question=/\?|\b(?:what|how|when|where|explain|does|tell me|difference|should|can|could|do i|is it|wet|dry|damp)\b/.test(lower);
    let followIds=[];let ambiguous=false;
    if(!mentions.length&&question){
      const candidates=ids=>ids.filter(id=>find(catalog,id));
      const context=candidates(s.lastProductIds),owned=candidates(s.ownedIds);
      const generic=lower.match(/\b(?:the|my|that|this)\s+(spray|cream|gel|powder|elixir|oil|mousse)\b/);
      if(generic){const match=ids=>ids.filter(id=>new RegExp('\\b'+generic[1]+'\\b','i').test(find(catalog,id).name));followIds=match(context);if(!followIds.length)followIds=match(owned);if(followIds.length!==1){ambiguous=true;followIds=[];}}
      else if(/\b(?:them|both|these|those)\b/.test(lower)){followIds=context;if(followIds.length<2){ambiguous=true;followIds=[];}}
      else if(/\b(?:it|its|this|that)\b/.test(lower)){if(context.length===1)followIds=context;else ambiguous=true;}
    }
    if(!routineIntent&&question&&ambiguous)return {state:s,reply:'Which product do you mean? Please name it so I can give you the right directions.',localOnly:true};
    if (!routineIntent && question && /\b(?:different|difference|compare|versus|vs\.?|better)\b/i.test(message)) {
      const previous=normalize(inputState).lastProductIds;
      const current=unique(mentions.map(m=>m.id));
      if(current.length===1&&previous.length>1&&!previous.includes(current[0]))return {state:s,localOnly:true,reply:`Which product would you like to compare with ${label(catalog,current[0])}?`};
      const ids=unique([...current,...previous]).filter(id=>find(catalog,id)).slice(0,2);
      if(ids.length===2){const products=ids.map(id=>find(catalog,id));s.lastProductIds=ids;s.lastProductId=ids[ids.length-1];s.lastQuestion=null;
        return {state:s,localOnly:true,reply:products.map(p=>`${p.name}: ${p.description||'Check the product page for details.'}`).join('\n')+'\n\nSources: '+products.map(p=>p.source).filter(Boolean).join(' · ')};}
    }
    if(!routineIntent&&question&&(mentions.length||followIds.length)){
      const ids=unique(mentions.length?mentions.map(m=>m.id):followIds).slice(0,3);
      const products=ids.map(id=>find(catalog,id)).filter(Boolean);
      if(products.length){s.lastProductIds=products.map(p=>p.id);s.lastProductId=products[products.length-1].id;s.lastQuestion=null;let reply=products.map(p=>p.id==='pomade'&&s.goal==='slicked-back'&&/\b(?:how|apply|use|put|directions?)\b/i.test(message)?'Pomade: Our Pomade is for slick, shiny looks. I don’t have verified application steps for that look yet; check the product label.\n\nSource: '+p.source:answerProduct(p,message,products.length)).join('\n\n');
        const ids=products.map(p=>p.id);if(ids.includes('sea-salt-spray')&&ids.includes('hair-clay')&&/\b(?:together|combine|combined|mix|layer|with|before|after|both)\b/.test(lower))reply='Yes. Our Sea Salt Spray can be used before Hair Clay. For our maximum-volume look, apply Hair Clay to dry hair; use on damp or wet hair has not been verified.\n\nSources: https://based.com/products/sea-salt-spray · https://based.com/blogs/guide/flat-to-maximum-volume-and-texture';
        return {state:s,reply,localOnly:true};}
    }
    if(routineIntent){
      if(!s.ownershipKnown){s.lastQuestion='owned';return {state:s,reply:'Which products do you own? Tap “Choose products I own” or say “none.”'};}
      const ownedCategories=unique(s.ownedIds.map(id=>find(catalog,id)?.category).filter(Boolean));
      if(ownedCategories.length>1&&!s.categoryExplicit){s.lastQuestion='category';return {state:s,reply:`You have products for ${ownedCategories.join(', ')}. Which routine should we build first: ${ownedCategories.join(', ')}?`};}
      const ownedCategory=s.ownedIds.filter(id=>{const p=find(catalog,id);return p&&p.category===s.category;});
      if(!ownedCategory.length){s.lastQuestion=null;const rec=recommendations(s,catalog);return {state:s,reply:rec.length?`You haven’t listed any of our ${s.category} products yet. Based on your goal, you could explore ${rec.map(id=>label(catalog,id)).join(', ')}. Tell me what you choose and I’ll build around it.`:`You haven’t listed any of our ${s.category} products yet. Tell me what you own, or what you’re looking for, and we’ll explore options.`};}
      if(s.category==='hair'&&ownedCategory.some(id=>id==='shampoo'||id==='conditioner')&&!s.washDays.length){s.lastQuestion='washDays';return {state:s,reply:`I’ve noted ${ownedCategory.map(id=>label(catalog,id)).join(', ')}. Which days do you wash your hair, or how many times a week?`};}
      const steps=generateRoutine(s,catalog);s.lastQuestion=null;if(!steps.length)return {state:s,reply:'I have your preferences, but I need a supported product to build these steps. Tell me which products you have.'};
      const example=s.washDaysProvisional?' I’ve chosen example wash days that you can change.':'';
      const unknown=steps.some(step=>!step.directionVerified)?' Some directions need a check on the product page.':'';
      const included=unique(steps.map(step=>step.productId));const excluded=ownedCategory.filter(id=>!included.includes(id));const omitted=excluded.length?` I left out ${excluded.map(id=>label(catalog,id)).join(', ')} pending a fit check.`:'';
      return {state:s,reply:`Your ${s.category} routine is ready with ${included.map(id=>label(catalog,id)).join(', ')}.${example}${unknown}${omitted} Review or edit it in My routine below.`};
    }
    if((/\b(?:i\s+(?:wash|shampoo)|my\s+wash\s+days\s+(?:are|include))\b/i.test(message)||/\b(?:actually|instead|change|changed|correction)\b/i.test(message)&&DAYS.some(day=>new RegExp('\\b'+day+'s?\\b','i').test(message)))&&!/[?]/.test(message)&&s.washDays.length){s.lastQuestion=null;return {state:s,localOnly:true,reply:s.washDaysProvisional?`Got it. I’ll use ${s.washFrequency} wash ${s.washFrequency===1?'day':'days'} per week. I’ve chosen editable example days: ${s.washDays.join(', ')}.`:`Got it. Your wash days are ${s.washDays.join(', ')}.`};}
    if(bundleOwned&&!routineIntent){s.lastQuestion=null;return {state:s,localOnly:true,reply:`Got it. I’ve added ${bundles.filter(b=>b.products.some(id=>s.ownedIds.includes(id))).map(b=>b.name).join(', ')} to your products. Say “build my routine” when you’re ready.`};}
    if(s.ownershipKnown&&mentions.length){s.lastQuestion=null;return {state:s,localOnly:true,reply:`Got it. I’ll remember the products you’ve told me about${s.ownedIds.length?': '+s.ownedIds.map(id=>label(catalog,id)).join(', '):''}. Tell me “build my routine” whenever you’re ready.`};}
    if(s.ownershipKnown&&/\b(?:actually|instead|changed|change|correction)\b/i.test(lower)){s.lastQuestion=null;return {state:s,reply:'Got it — I’ve updated your preferences. Say “regenerate my routine” to reflect the change.'};}
    if (/^[\d\s+*/().%−–—-]+$/.test(message)) { s.lastQuestion=null; return {state:s,localOnly:true,reply:'I can help with BASED products and routines. What would you like to know?'}; }
    const recommendationIntent=/\b(?:hair|skin|body|curl\w*|wav\w*|straight|coil\w*|dry|frizz\w*|hydrat\w*|moistur\w*|volume|voluminous|fluffy|texture\w*|matte|hold|slick\w*|recommend\w*|suggest\w*|products?|look|style|styling)\b/i.test(message);
    const requestedType=message.match(/\b(straight|wavy|curly|coily)\s+hair\b/i);
    const asksProducts=/\b(?:what|which)\b.*\b(?:get|use|buy|recommend|suggest|product)/i.test(message);
    const currentGoal=/\b(?:slick\w*|wet look|pompadour|frizz\w*|dry\w*|moistur\w*|hydrat\w*|defin\w*|volume|voluminous|flat|fuller|fluffy|matte|messy|textur\w*|hold)\b/i.test(message);
    if(requestedType&&asksProducts&&!currentGoal&&!mentions.length){s.hairType=requestedType[1].toLowerCase();s.category='hair';s.useOwnedOnly=false;s.lastQuestion=null;return {state:s,localOnly:true,reply:`For ${requestedType[1].toLowerCase()} hair, what look are you going for: more volume, matte texture, or a slick finish? I’ll suggest products that fit.`};}
    const rec=recommendationIntent&&!(s.ownershipKnown&&s.useOwnedOnly)?recommendations(s,catalog):[];if(rec.length){s.lastQuestion=null;return {state:s,localOnly:true,reply:`For ${s.goal||s.hairType||'your goal'}, you could explore ${rec.map(id=>label(catalog,id)).join(', ')}. Which of our products do you already own? I can build a routine around them.`};}
    s.lastQuestion=null;return {state:s,reply:'Tell me your hair type, the look you want, and which products you already own. For skin or body, tell me your goal and what products you have.'};
  }
  root.BasedEngine={initialState,applyMessage,generateRoutine};
})(typeof window!=='undefined'?window:globalThis);
