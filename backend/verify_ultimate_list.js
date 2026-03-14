const { deepClean } = require('./utils/moderation');

const testCases = [
  "zhavanya message",
  "aizhavadya behavior",
  "m.c",
  "b.c",
  "b.s.d.k",
  "chut1ya",
  "fu*k this",
  "sh*t happens",
  "l0da",
  "l0de",
  "ga@nd",
  "g4ndu",
  "bitch3s",
  "wh0re",
  "m4darchod",
  "bhench0d",
  "lundi",
  "gaandwaale",
  "p0rn",
  "s3x",
  "fu-ck",
  "m-c",
  "b-c",
  "aicha-pucchi",
  "mazya-lavdyavar",
  "toindat-ghe",
  "normal message"
];

console.log("--- ULTIMATE HEURISTIC MODERATION TEST ---");
testCases.forEach(text => {
  const cleaned = deepClean(text);
  console.log(`Original: ${text}`);
  console.log(`Clean:    ${cleaned}`);
  console.log("---------------------------------");
});
