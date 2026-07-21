'use strict';

/**
 * Classify the user's tone from a prompt string.
 * Heuristic keyword/pattern scoring — no network, no LLM call.
 * Returns one of: 'angry' | 'urgent' | 'sad' | 'happy' | 'neutral'
 */

const PATTERNS = {
  angry: [
    /짜증/, /화나/, /빡치/, /하지\s*마/, /왜\s*안\s*(돼|되|해)/, /안\s*되잖아/,
    /안\s*된다니까/, /똑바로/, /장난\s*(해|하냐)/, /미쳤/, /아\s*진짜/, /어이가?\s*없/,
    /틀렸잖아/, /또\s*틀/, /말했잖아/, /몇\s*번을?\s*말/, /제대로\s*좀/,
    /\bwtf\b/i, /\bffs\b/i, /wrong\s+again/i, /\bstop\s+it\b/i, /are\s+you\s+kidding/i,
    /!{2,}/, /ㅡㅡ/, /-_-/, /😡/, /🤬/, /💢/,
  ],
  urgent: [
    /빨리/, /급해/, /급함/, /서둘러/, /지금\s*당장/, /얼른/, /시간\s*없/,
    /\basap\b/i, /\bhurry\b/i, /\bquick(ly)?\b/i, /right\s+now/i, /\burgent\b/i,
    /🔥/, /⏰/,
  ],
  sad: [
    /ㅠ+/, /ㅜ+/, /힘들/, /지쳤/, /지친다/, /슬프/, /우울/, /모르겠[다어]/, /에휴/, /하\.{2,}/,
    /포기하고\s*싶/, /\bsigh\b/i, /\btired\b/i, /\bexhausted\b/i, /i\s+give\s+up/i,
    /😢/, /😭/, /😔/,
  ],
  happy: [
    /좋아[요!.\s]|좋아$/, /좋네/, /좋다/, /고마워/, /고맙/, /감사/, /완벽/, /멋지/, /멋있/,
    /잘했/, /잘한다/, /최고/, /대박/, /사랑/, /굿\b/, /나이스/, /역시/, /깔끔하/,
    /ㅋㅋ+/, /ㅎㅎ+/, /\bthanks?\b/i, /thank\s+you/i, /\bgreat\b/i, /\bperfect\b/i,
    /\bawesome\b/i, /\bnice\b/i, /\blove\s+it\b/i, /well\s+done/i, /\bgood\s+job\b/i,
    /👍/, /🎉/, /❤️/, /😊/, /🙏/,
  ],
};

// Ties break in this order: strong negative signals win over positive ones.
const PRIORITY = ['angry', 'urgent', 'sad', 'happy'];

function classifyMood(text) {
  if (!text || typeof text !== 'string') return 'neutral';

  const scores = {};
  for (const [mood, patterns] of Object.entries(PATTERNS)) {
    scores[mood] = patterns.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
  }

  let best = 'neutral';
  let bestScore = 0;
  for (const mood of PRIORITY) {
    if (scores[mood] > bestScore) {
      best = mood;
      bestScore = scores[mood];
    }
  }
  return best;
}

module.exports = { classifyMood };
