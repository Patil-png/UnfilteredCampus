const Filter = require('bad-words');

// Advanced Heuristic Dictionary (English + Hindi + Marathi + Hinglish)
const BLACKLIST = [
// 1. English Profanity (The Basics)
  'fuck', 'fucker', 'fucking', 'f*ck', 'fu*k', 'fck', 'fux', 'phuck', 'fu-ck', 'shit', 'shoty', 'shat', 'sh*t', 'shity', 
  'ass', 'asshole', 'arshole', 'bitch', 'b*tch', 'btch', 'bitchy', 'bitches', 'bitch3s', 'bastard', 'cunt', 'c*nt', 'dick', 
  'dickhead', 'dildo', 'pussy', 'p*ssy', 'slut', 'sl*ut', 'whore', 'wh0re', 'wh0r3', 'whorish', 'motherfucker', 'mofo', 
  'muthafucka', 'cocksucker', 'jerk', 'douche', 'douchebag', 'prick', 'wanker', 'twat', 'punani', 
  'faggot', 'fag', 'nigger', 'nigga', 'retard', 'skank', 'cum', 'cumshot', 'ejaculate', 'clit', 
  'clitoris', 'orgasm', 'porn', 'p0rn', 'xxx', 'sex', 's3x', 'sexting', 'stfu', 'wtf', 'poda',

  // 2. Hindi & Hinglish
  'madarchod', 'maderchod', 'madarchot', 'mc', 'm.c.', 'm-c', 'm_c', 'madarchoot', 'madarchut', 'm*darchod', 'm4darchod',
  'behenchod', 'bhenchod', 'bc', 'b.c.', 'b-c', 'b_c', 'bhanchod', 'benchod', 'bhencho', 'bancho', 'b*henchod', 'bhench0d',
  'bhosdike', 'bsdk', 'bhosadike', 'bhosadi', 'bhosade', 'bhosdika', 'bhosadiwaale', 'bhosdik', 'b*sdk', 'b.s.d.k',
  'bkl', 'behenkelund', 'behenkelode', 'bhenkelun', 'madarkelund',
  'chutiya', 'cht1ya', 'chut1ya', 'chutiyapa', 'chtiya', 'chootiya', 'chutye', 'chuttya', 'chutiy@',
  'gaand', 'ga@nd', 'gandu', 'g4ndu', 'gaandwaale', 'gandfatya', 'gandmasti', 'gandmare', 'gandmarika', 'gandmari',
  'lund', 'lundi', 'l0da', 'l0de', 'lode', 'loda', 'lauda', 'lowda', 'lundfakir', 'lodwa', 'lodu', 'loduchya',
  'choot', 'chut', 'haraami', 'haraamzada', 'kamine', 'kaminay', 'kutta', 'kuttiya', 'saala', 'saali',
  'muthal', 'muthmare', 'mandi', 'randi', 'randwa', 'raand', 'chinaal', 'hijra', 'chakka', 'tatte',
  'jhaat', 'jhattu', 'jhaat-ke-baal', 'jhaantu', 'ml', 'mq',

  // 3. Marathi & Maringlish
  'zhavadya', 'zhavnya', 'zhavanya', 'zhavli', 'aizhavadya', 'aizhavnya', 'aizhavli', 'ayizhavdya', 'ayighalya', 'lavadya', 
  'lavde', 'lavda', 'lavad-khau', 'gandya', 'gandit', 'gandfatya', 'bhadvya', 'bhadve', 'bhadvat', 
  'raand', 'randichya', 'randecha', 'aicha-gho', 'aicha-pucchi', 'tuzya-aichi', 'aichi-gand', 'aichi-pucchi', 
  'bevadya', 'chinal', 'thokyade', 'shembadya', 'haptya', 'bhikarchot', 'bhikarchand', 'foknichya', 
  'fodarichya', 'boka', 'bocha', 'bochyat', 'zavnya', 'zhavad', 'zavli', 'toindat-ghe', 'chokh-maza', 
  'aighalya', 'mazya-lavdyavar', 'gand-maru', 'shivya', 'ghalat', 'phodarichya', 'pucchichya', 
  'maichi-gand', 'baapachya', 'shembud', 'gaandat', 'gaandichya'
].sort((a, b) => b.length - a.length); // Sort longest words first to avoid partial matches

// Normalized blacklist (Consonant Skeleton) for ultra-permissive guard
const NORMALIZED_BLACKLIST = BLACKLIST.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/[aeiou]/g, ''));

// Character mapping for bypass detection (Homoglyphs)
const HOMOGLYPHS = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '*': 'a', '.': 'a', // Map * and . to 'a' as a generic vowel for homoglyph cleaning
  'i': 'i', 'l': 'l', 'v': 'v', 'y': 'y', '|': 'l', '+': 't', '-': '', '_': ''
};

const filter = new Filter();
filter.addWords(...BLACKLIST);

/**
 * Normalizes text for the initial guard check (Consonant Skeleton)
 */
function normalizeText(text) {
  let normalized = text.toLowerCase();
  
  // 1. Replace homoglyphs
  let homoglyphCleaned = '';
  for (let char of normalized) {
    homoglyphCleaned += HOMOGLYPHS[char] || char;
  }
  
  // 2. Remove all non-alphanumeric AND remove vowels
  return homoglyphCleaned.replace(/[^a-z0-9]/g, '').replace(/[aeiou]/g, '');
}

// Helper to get regex pattern for a character including homoglyphs
function getHomoglyphPattern(char) {
  const charLower = char.toLowerCase();
  const variations = new Set([charLower]);
  
  for (const [glyph, mapped] of Object.entries(HOMOGLYPHS)) {
    if (mapped === charLower) {
      variations.add(glyph);
    }
  }
  
  // Escape only truly necessary characters for a regex character class []
  const escaped = Array.from(variations).map(v => {
    if (['[', ']', '\\', '^', '-', '$'].includes(v)) {
      return '\\' + v;
    }
    return v;
  });
  
  return `[${escaped.join('')}]`;
}

/**
 * Advanced Heuristic Deep Cleaning
 */
function deepClean(text) {
  if (!text) return text;

  // Protect URLs from being cleaned
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = [];
  let placeholderText = text.replace(urlRegex, (match) => {
    const placeholder = `__URL_PLACEHOLDER_${urls.length}__`;
    urls.push(match);
    return placeholder;
  });

  // We work on a copy to accumulate stars, then pass to bad-words filter
  let cleanedOutput = placeholderText;

  // Step 1: Heuristic Bypass Detection (Power up)
  const normalizedMessage = normalizeText(placeholderText);

  BLACKLIST.forEach((word, index) => {
    const normalizedWord = NORMALIZED_BLACKLIST[index];
    
    // Check if the word exists in the normalized message
    if (normalizedWord && normalizedMessage.includes(normalizedWord)) {
      const pattern = word.replace(/[^a-z0-9]/gi, '')
        .split('')
        .map(char => getHomoglyphPattern(char))
        .join('[^a-z]*?');
        
      const regex = new RegExp(pattern, 'gi');
      cleanedOutput = cleanedOutput.replace(regex, (match) => '*'.repeat(match.length));
    }
  });

  // Step 2: Standard dictionary cleaning as fallback
  try {
    if (/[a-z0-9]/i.test(cleanedOutput)) {
      cleanedOutput = filter.clean(cleanedOutput);
    }
  } catch (e) {
    // Keep cleanedOutput as is
  }

  // Restore URLs
  urls.forEach((url, i) => {
    cleanedOutput = cleanedOutput.replace(`__URL_PLACEHOLDER_${i}__`, url);
  });

  return cleanedOutput;
}

module.exports = { deepClean };
