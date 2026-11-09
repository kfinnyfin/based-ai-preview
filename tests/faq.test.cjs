'use strict';
const assert=require('node:assert/strict');
global.window=global;
require('../catalog.js');require('../engine.js');
const ask=(s,q)=>BasedEngine.applyMessage(s,q,BASED_CATALOG);
const cases=[
 ['What does sea salt spray do?',/beachy.*texture/i],
 ['What kind of hold does sea salt spray have?',/light.*hold/i],
 ['Does sea salt spray have a matte finish?',/matte/i],
 ['What does hair clay smell like?',/santal/i],
 ['How long does a bottle of texture powder last?',/60–90 days/i],
 ['How do I use leave in conditioner with frizzy hair?',/damp.*mid-lengths/i],
 ['How do I wash out hair clay?',/shampoo/i],
 ['What is the curl gel cast?',/dry completely.*scrunch/i],
 ['How often should I use curl refresh spray?',/day-two.*day-three/i],
 ['Where can I use tallow moisturizer?',/face.*hands/i],
 ['What hair types is curl mousse for?',/wavy.*curly.*coily/i],
 ['Can I use curl mousse with curl gel?',/roots.*gel/i],
 ['Does sea salt spray contain coconut?',/ingredient|lists|confirm/i]
];
for(const product of BASED_CATALOG){const result=ask(BasedEngine.initialState(),'What does '+product.name+' do?');assert.ok(result.reply.startsWith(product.name+':'),product.name+' purpose question');}
for(const [q,pattern] of cases){const result=ask(BasedEngine.initialState(),q);assert.match(result.reply,pattern,q);}
let state=ask(BasedEngine.initialState(),'What does hair clay do?').state;
assert.match(ask(state,'How do I wash it out?').reply,/shampoo/i);
assert.match(ask(BasedEngine.initialState(),'I have coily hair and want volume. Please suggest products.').reply,/Curl Mousse/i);
console.log('FAQ and follow-up tests passed ('+(cases.length+2)+' cases).');
assert.match(ask(BasedEngine.initialState(),'What hair types is conditioner for?').reply,/all hair types/i);
assert.match(ask(BasedEngine.initialState(),'How much curl gel should I use?').reply,/quarter-sized.*medium-length/i);
assert.match(ask(BasedEngine.initialState(),'Does skin elixir have a scent?').reply,/no added fragrance/i);
const short={...BasedEngine.initialState(),hairType:'curly',hairLength:'0–2 inches',ownershipKnown:true,ownedIds:['curl-gel']};
assert.equal(BasedEngine.generateRoutine(short,BASED_CATALOG).some(step=>step.productId==='curl-gel'),false);
const shortHold=ask({...BasedEngine.initialState(),hairType:'coily',hairLength:'0–2 inches'},'I have coily hair and want strong hold. Please suggest products.');
assert.match(shortHold.reply,/Curl Gel.*4 inches.*Curl Mousse/i);
assert.doesNotMatch(shortHold.reply,/Tell me your hair type/i);
let pairing=ask(BasedEngine.initialState(),'How do I apply curl mousse?');pairing=ask(pairing.state,'Can I use it with curl gel?');assert.match(pairing.reply,/Curl Mousse[\s\S]*roots[\s\S]*Curl Gel/i);
assert.match(ask(BasedEngine.initialState(),'Can I use conditioner as a co-wash?').reply,/co-wash.*between full washes/i);
assert.match(ask(BasedEngine.initialState(),'Can I use texture powder after the gym?').reply,/dry.*sweat/i);
assert.match(ask(BasedEngine.initialState(),'What scents does body wash come in?').reply,/Santal.*Guava.*Coconut/i);
