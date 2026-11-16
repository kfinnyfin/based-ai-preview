'use strict';
const assert=require('node:assert/strict');
global.window=global;require('../catalog.js');require('../engine.js');
function chat(questions){let state=BasedEngine.initialState();return questions.map(q=>{const result=BasedEngine.applyMessage(state,q,BASED_CATALOG);state=result.state;return result;});}
let flow=chat(['I have straight hair and want a slick back. What do you recommend?','How do I use it?','How often?']);
assert.match(flow[0].reply,/Pomade/i);assert.match(flow[1].reply,/Pomade/i);assert.match(flow[2].reply,/Pomade/i);
flow=chat(['How do I get beachy waves?','When should I use it?','How much?']);
assert.match(flow[0].reply,/Sea Salt Spray/i);assert.match(flow[1].reply,/Sea Salt Spray/i);assert.match(flow[2].reply,/Sea Salt Spray/i);
flow=chat(['I have wavy hair and want volume. Recommend products.','How do I use it?','How do I use sea salt spray?']);
assert.match(flow[1].reply,/Which product/i);assert.match(flow[2].reply,/Sea Salt Spray/i);
flow=chat(['I have curly hair and want defined curls. Recommend products.','How about curl cream?','How often?']);
assert.match(flow[1].reply,/Curl Cream/i);assert.match(flow[2].reply,/Curl Cream/i);
flow=chat(['I have shampoo and conditioner','Build my hair routine','Monday Wednesday Friday']);
assert.match(flow[1].reply,/wash/i);assert.match(flow[2].reply,/routine is ready/i);assert.deepEqual(flow[2].state.washDays,['Monday','Wednesday','Friday']);
console.log('Multi-turn conversation and routine tests passed.');
