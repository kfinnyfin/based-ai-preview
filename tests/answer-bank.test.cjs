'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
global.window=global;require('../catalog.js');require('../engine.js');
const hair=BASED_CATALOG.filter(p=>p.category==='hair');
const other=BASED_CATALOG.filter(p=>p.category!=='hair');
const hairQuestions=[
 ['purpose',n=>`What does ${n} do?`,/./],
 ['application',n=>`How do I apply ${n}?`,/apply|spray|scrunch|pump|rub|massage|shampoo|rinse|directions|check|distribute|warm|conditioner/i],
 ['frequency',n=>`How often should I use ${n}?`,/daily|day|desired|need|frequen|check|verified/i],
 ['suitability',n=>`What hair types is ${n} for?`,/hair|curly|coily|wavy|curl|straight|check|verified/i],
 ['hair state',n=>`Should I apply ${n} on wet or dry hair?`,/wet|dry|damp|verified|check/i],
 ['pairing',n=>`Can I use ${n} with other products?`,/pair|combin|with|after|before|follow|layer|use|check|verified/i],
 ['ingredients',n=>`What ingredients are in ${n}?`,/ingredient|formula|label|reviewed|lists/i],
 ['scent',n=>`What does ${n} smell like?`,/scent|smell|aroma|fragrance|check|verified/i]
];
const otherQuestions=[
 ['purpose',n=>`What does ${n} do?`,/./],
 ['application',n=>`How do I apply ${n}?`,/apply|spray|dab|pump|massage|wash|moistur|directions|check|use/i],
 ['frequency',n=>`How often should I use ${n}?`,/daily|day|night|need|frequen|check|verified/i],
 ['ingredients',n=>`What ingredients are in ${n}?`,/ingredient|formula|label|reviewed|lists/i],
 ['scent',n=>`What does ${n} smell like?`,/scent|smell|aroma|fragrance|check|verified/i],
 ['pairing',n=>`Can I use ${n} with other products?`,/pair|combin|with|after|before|follow|layer|use|check|verified/i]
];
let cases=[];for(const [group,templates] of [[hair,hairQuestions],[other,otherQuestions]])for(const p of group)for(const [intent,question,expected] of templates)cases.push({product:p,intent,question:question(p.name),expected});
assert.equal(cases.length,150);
const bank=[];for(const c of cases){const result=BasedEngine.applyMessage(BasedEngine.initialState(),c.question,BASED_CATALOG);assert.ok(result.reply.startsWith(c.product.name+':'),c.question+' → '+result.reply);assert.match(result.reply,c.expected,c.question);assert.doesNotMatch(result.reply,/Tell me your hair type, the look you want/i,c.question);bank.push({question:c.question,answer:result.reply,product:c.product.name,intent:c.intent,source:c.product.source});}
const varied=[
 ['What should I use to clear my skin?',/Cleanser.*Moisturizer/i],
 ['What should I use for clear skin?',/Cleanser.*Moisturizer/i],
 ['What helps with breakouts?',/Cleanser.*Moisturizer/i],
 ['I have curly hair and want defined curls. What do you recommend?',/Curl Cream/i],
 ['I have straight hair and want a slick back. What should I use?',/Pomade/i],
 ['I have wavy hair and want a fluffy look. What should I use?',/Sea Salt Spray/i],
 ['How can I reduce frizz in my wavy hair?',/Leave-In Conditioner/i],
 ['What should I use for dry body skin?',/Body Lotion/i],
 ['Which products for shiny slick back hair?',/Pomade/i],
 ['What helps with body odor?',/Deodorant/i],
 ['How do I get beachy waves?',/Sea Salt Spray/i],
 ['Can I use sea salt spray and hair clay together?',/Sea Salt Spray.*before Hair Clay/i],
 ['Which product gives curls a strong hold?',/Curl Gel/i],
 ['How do I get more volume for curly hair?',/Curl Mousse/i],
 ['What do I use for dry ends?',/Hair Elixir/i],
 ['What should I use for wavy frizzy hair?',/Leave-In Conditioner/i],
 ['What works for straight hair?',/what look/i],
 ['I have curly hair and want definition. Recommend products.',/Curl Cream/i],
 ['Help me build a skin routine',/products do you own/i],
 ['Can I use curl mousse with curl gel?',/roots.*gel/i]
];
for(const [question,expected] of varied){const result=BasedEngine.applyMessage(BasedEngine.initialState(),question,BASED_CATALOG);assert.match(result.reply,expected,question);assert.doesNotMatch(result.reply,/Tell me your hair type, the look you want/i,question);bank.push({question,answer:result.reply,intent:'goal or routine'});}
const clear=BasedEngine.applyMessage(BasedEngine.initialState(),'What should I use to clear my skin?',BASED_CATALOG);assert.match(clear.reply,/Cleanser.*Moisturizer/i);assert.doesNotMatch(clear.reply,/cure|guarantee/i);
let follow=BasedEngine.applyMessage(clear.state,'I have the daily facial cleanser',BASED_CATALOG);assert.ok(follow.state.ownedIds.includes('daily-facial-cleanser'));assert.match(follow.reply,/Daily Facial Cleanser.*Daily Facial Moisturizer/i);
if(process.argv.includes('--write-bank'))fs.writeFileSync('demo-question-bank.json',JSON.stringify(bank,null,2)+'\n');
console.log(`${bank.length} product and goal questions passed, plus clear-skin regression.`);
