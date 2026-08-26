'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { classifyMood } = require('../src/mood');

test('neutral for plain requests', () => {
  assert.equal(classifyMood('버튼 컴포넌트 만들어줘'), 'neutral');
  assert.equal(classifyMood('refactor the auth module'), 'neutral');
  assert.equal(classifyMood(''), 'neutral');
  assert.equal(classifyMood(null), 'neutral');
});

test('angry tone', () => {
  assert.equal(classifyMood('아니 왜 안 되는데?? 아까 말했잖아'), 'angry');
  assert.equal(classifyMood('짜증나네 다시 해봐'), 'angry');
  assert.equal(classifyMood('wrong again... are you kidding me'), 'angry');
  assert.equal(classifyMood('테스트 좀 똑바로 돌려!!'), 'angry');
});

test('happy tone', () => {
  assert.equal(classifyMood('오 완벽해 고마워!'), 'happy');
  assert.equal(classifyMood('ㅋㅋㅋ 좋네 이대로 가자'), 'happy');
  assert.equal(classifyMood('perfect, thanks! ship it'), 'happy');
});

test('sad tone', () => {
  assert.equal(classifyMood('하... 오늘따라 왜이러지 힘들다 ㅠㅠ'), 'sad');
  assert.equal(classifyMood('버그 원인을 모르겠다 에휴'), 'sad');
});

test('urgent tone', () => {
  assert.equal(classifyMood('빨리 고쳐줘 배포 시간 없어'), 'urgent');
  assert.equal(classifyMood('fix this asap please'), 'urgent');
});

test('negative beats positive on ties', () => {
  assert.equal(classifyMood('좋긴 한데 왜 안 되는데 짜증나'), 'angry');
});

test('bare punctuation does not outvote a positive word', () => {
  assert.equal(classifyMood('오 최고!!! 완벽해'), 'happy');
  assert.equal(classifyMood('잘했어 👍👍'), 'happy');
});

test('punctuation still tips an already-angry prompt', () => {
  assert.equal(classifyMood('테스트 좀 똑바로 돌려!!'), 'angry');
});

test('punctuation alone stays below a real signal', () => {
  assert.equal(classifyMood('그냥 그래요!!'), 'neutral');
});
