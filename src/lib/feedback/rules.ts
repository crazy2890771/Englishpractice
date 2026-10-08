import type { FeedbackCategory, FeedbackItem } from "../ai/schemas";

/**
 * Rule-based corrector used in demo mode (no AI credentials).
 * It only flags common, unambiguous B1–B2 errors so it does not over-correct
 * acceptable expressions. It is NOT a full grammar checker — the UI says so.
 */

interface Rule {
  id: string;
  category: FeedbackCategory;
  pattern: RegExp;
  fix: (m: RegExpExecArray) => string;
  explain: (m: RegExpExecArray) => string;
}

const IRREGULAR_BASE: Record<string, string> = {
  went: "go", saw: "see", came: "come", ate: "eat", bought: "buy", took: "take", made: "make",
  had: "have", said: "say", got: "get", wrote: "write", gave: "give", found: "find", thought: "think",
  told: "tell", left: "leave", felt: "feel", brought: "bring", began: "begin", knew: "know", met: "meet",
  ran: "run", spoke: "speak", flew: "fly", slept: "sleep", drove: "drive", wanted: "want", liked: "like",
  visited: "visit", worked: "work", played: "play", watched: "watch", stayed: "stay", tried: "try",
};

const PAST_OF: Record<string, string> = {
  been: "went", gone: "went", visited: "visited", seen: "saw", done: "did", eaten: "ate", met: "met",
  bought: "bought", taken: "took", flown: "flew", travelled: "travelled", traveled: "traveled", finished: "finished",
  started: "started", worked: "worked", lived: "lived", made: "made", had: "had", written: "wrote",
};

const ING: Record<string, string> = {
  meet: "meeting", see: "seeing", hear: "hearing", work: "working", visit: "visiting", talk: "talking",
  receive: "receiving", get: "getting", go: "going", start: "starting", have: "having", join: "joining",
  speak: "speaking", travel: "travelling", fly: "flying",
};

const THIRD: Record<string, string> = {
  go: "goes", work: "works", like: "likes", want: "wants", live: "lives", have: "has", need: "needs",
  think: "thinks", know: "knows", love: "loves", say: "says", make: "makes", play: "plays", study: "studies",
};

const UNCOUNTABLE: Record<string, string> = {
  informations: "information", advices: "advice", furnitures: "furniture", luggages: "luggage",
  baggages: "baggage", equipments: "equipment", homeworks: "homework", knowledges: "knowledge",
  researches: "research", feedbacks: "feedback", traffics: "traffic", newses: "news",
};

const COMPARATIVE: Record<string, string> = {
  better: "better", easier: "easier", bigger: "bigger", cheaper: "cheaper", faster: "faster",
  worse: "worse", happier: "happier", busier: "busier", longer: "longer", smaller: "smaller",
};

/** Words starting with a vowel letter but a consonant sound (take "a"). */
const A_EXCEPTIONS = /^(uni|use|usu|uro|eu|one|once|ufo|ukr|uk\b|us\b|u\.)/i;
/** Words starting with a silent h (take "an"). */
const AN_H_EXCEPTIONS = /^(hour|honest|honou?r|heir)/i;

function keepCase(source: string, replacement: string) {
  if (source[0] && source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()) {
    return replacement[0]!.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const MODAL_BEFORE = "(?<!\\b(?:can|could|will|would|should|must|might|may|does|did|do|to|let|lets|make|help|doesn't|didn't|don't|won't|can't|and|or)\\s)";

const RULES: Rule[] = [
  {
    id: "lowercase-i",
    category: "grammar",
    pattern: /(?<![\w'])i(?=(?:'m|'ve|'ll|'d)?\b)(?![\w-]*\.\w)/g,
    fix: () => "I",
    explain: () => "The pronoun “I” is always written with a capital letter.",
  },
  {
    id: "a-an-vowel",
    category: "grammar",
    pattern: /\b([Aa]) ([aeiouAEIOU][\w-]*)/g,
    fix: (m) => (A_EXCEPTIONS.test(m[2]!) || /^[A-Z]{2,}/.test(m[2]!) ? m[0] : `${keepCase(m[1]!, "an")} ${m[2]}`),
    explain: (m) => `Use “an” before a vowel sound: “an ${m[2]}”.`,
  },
  {
    id: "an-consonant",
    category: "grammar",
    pattern: /\b([Aa]n) ([b-df-hj-np-tv-zB-DF-HJ-NP-TV-Z][\w-]*)/g,
    fix: (m) => (AN_H_EXCEPTIONS.test(m[2]!) || /^[A-Z]{2,}/.test(m[2]!) ? m[0] : `${keepCase(m[1]!, "a")} ${m[2]}`),
    explain: (m) => `Use “a” before a consonant sound: “a ${m[2]}”.`,
  },
  {
    id: "an-consonant-sound",
    category: "grammar",
    pattern: /\b([Aa]n) ((?:uni|use|usu|eu|one)[\w-]*)/g,
    fix: (m) => `${keepCase(m[1]!, "a")} ${m[2]}`,
    explain: (m) => `“${m[2]}” starts with a consonant sound (/j/ or /w/), so use “a”.`,
  },
  {
    id: "am-agree",
    category: "grammar",
    pattern: /\b(I|i) ?(?:am|'m) (agree|disagree)\b/g,
    fix: (m) => `I ${m[2]}`,
    explain: (m) => `“${m[2]}” is a verb, so we don't use “am” with it: “I ${m[2]}”.`,
  },
  {
    id: "third-dont",
    category: "grammar",
    pattern: /\b(he|she|it|He|She|It) don't\b/g,
    fix: (m) => `${m[1]} doesn't`,
    explain: () => "With he/she/it, use “doesn't”, not “don't”.",
  },
  {
    id: "third-person-s",
    category: "grammar",
    pattern: new RegExp(`${MODAL_BEFORE}\\b(he|she|my (?:wife|husband|mother|father|friend|boss|sister|brother)) (${Object.keys(THIRD).join("|")})\\b(?! to\\b)`, "gi"),
    fix: (m) => `${m[1]} ${THIRD[m[2]!.toLowerCase()] ?? m[2]}`,
    explain: (m) => `In the present simple, add -s after he/she: “${m[1]} ${THIRD[m[2]!.toLowerCase()]}”.`,
  },
  {
    id: "people-is",
    category: "grammar",
    pattern: /\b(people|People) (is|was)\b/g,
    fix: (m) => `${m[1]} ${m[2] === "is" ? "are" : "were"}`,
    explain: () => "“People” is plural, so it takes “are/were”.",
  },
  {
    id: "there-is-many",
    category: "grammar",
    pattern: /\b(There|there) (is|was) (many|a lot of|lots of|several|some) (\w+s|people|children|men|women)\b/g,
    fix: (m) => `${m[1]} ${m[2] === "is" ? "are" : "were"} ${m[3]} ${m[4]}`,
    explain: () => "Use “there are/were” with plural nouns.",
  },
  {
    id: "did-past",
    category: "grammar",
    pattern: new RegExp(`\\b(didn't|did not|Did|did) (\\w+ )?(${Object.keys(IRREGULAR_BASE).join("|")})\\b`, "g"),
    fix: (m) => `${m[1]} ${m[2] ?? ""}${IRREGULAR_BASE[m[3]!]}`,
    explain: (m) => `After “did/didn't”, use the base form: “${IRREGULAR_BASE[m[3]!]}”, not “${m[3]}”.`,
  },
  {
    id: "present-perfect-finished-time",
    category: "grammar",
    pattern: new RegExp(`\\b(I|We|They|You|we|they|you) (have|'ve) (${Object.keys(PAST_OF).join("|")})\\b([^.!?]{0,40}?\\b(?:yesterday|last (?:week|month|year|night|weekend|summer|winter)|ago|in (?:19|20)\\d\\d)\\b)`, "g"),
    fix: (m) => `${m[1]} ${PAST_OF[m[3]!]}${m[4]}`,
    explain: () => "With a finished time (yesterday, last year, ago), use the past simple, not the present perfect.",
  },
  {
    id: "since-duration",
    category: "grammar",
    pattern: /\b(since|Since) (\d+|two|three|four|five|six|seven|eight|nine|ten|many|several) (years?|months?|weeks?|days?|hours?)\b/g,
    fix: (m) => `${keepCase(m[1]!, "for")} ${m[2]} ${m[3]}`,
    explain: () => "Use “for” with a length of time (for five years) and “since” with a starting point (since 2019).",
  },
  {
    id: "more-comparative",
    category: "grammar",
    pattern: new RegExp(`\\bmore (${Object.keys(COMPARATIVE).join("|")})\\b`, "g"),
    fix: (m) => COMPARATIVE[m[1]!]!,
    explain: (m) => `“${m[1]}” is already a comparative, so we don't add “more”.`,
  },
  {
    id: "uncountable",
    category: "grammar",
    pattern: new RegExp(`\\b(${Object.keys(UNCOUNTABLE).join("|")})\\b`, "gi"),
    fix: (m) => keepCase(m[1]!, UNCOUNTABLE[m[1]!.toLowerCase()]!),
    explain: (m) => `“${UNCOUNTABLE[m[1]!.toLowerCase()]}” is uncountable, so it has no plural -s.`,
  },
  {
    id: "peoples",
    category: "grammar",
    pattern: /\b(a lot of|many|some|the|lots of|most) peoples\b/gi,
    fix: (m) => `${m[1]} people`,
    explain: () => "“People” is already plural.",
  },
  {
    id: "age-have",
    category: "grammar",
    pattern: /\bI have (\d{1,2}) years\b(?! old)?/g,
    fix: (m) => `I'm ${m[1]} years old`,
    explain: () => "In English we use “be” for age: “I'm 30 (years old)”.",
  },
  {
    id: "look-forward-ing",
    category: "grammar",
    pattern: new RegExp(`\\b(look|looking|looks) forward to (${Object.keys(ING).join("|")})\\b`, "g"),
    fix: (m) => `${m[1]} forward to ${ING[m[2]!]}`,
    explain: () => "In “look forward to”, “to” is a preposition, so it is followed by -ing.",
  },
  {
    id: "discuss-about",
    category: "vocabulary",
    pattern: /\b(discuss|discussed|discussing) about\b/g,
    fix: (m) => m[1]!,
    explain: () => "“Discuss” doesn't need “about”: discuss the plan.",
  },
  {
    id: "explain-me",
    category: "grammar",
    pattern: /\b(explain|explained|describe|described) me\b/g,
    fix: (m) => `${m[1]} to me`,
    explain: (m) => `We say “${m[1]} something to me”, not “${m[1]} me”.`,
  },
  {
    id: "make-photo",
    category: "vocabulary",
    pattern: /\b(make|made|making|makes) (a |some |many )?(photo|photos|picture|pictures)\b/g,
    fix: (m) => `${({ make: "take", made: "took", making: "taking", makes: "takes" } as Record<string, string>)[m[1]!]} ${m[2] ?? ""}${m[3]}`,
    explain: () => "The natural collocation is “take a photo”.",
  },
  {
    id: "do-mistake",
    category: "vocabulary",
    pattern: /\b(do|did|doing|does) (a |many |some |a lot of )?(mistake|mistakes)\b/g,
    fix: (m) => `${({ do: "make", did: "made", doing: "making", does: "makes" } as Record<string, string>)[m[1]!]} ${m[2] ?? ""}${m[3]}`,
    explain: () => "The natural collocation is “make a mistake”.",
  },
  {
    id: "married-with",
    category: "vocabulary",
    pattern: /\bmarried with\b/g,
    fix: () => "married to",
    explain: () => "We say “married to someone”.",
  },
  {
    id: "depend-of",
    category: "vocabulary",
    pattern: /\b(depend|depends|depending) of\b/g,
    fix: (m) => `${m[1]} on`,
    explain: () => "The preposition after “depend” is “on”.",
  },
  {
    id: "interested-for",
    category: "vocabulary",
    pattern: /\binterested (for|on|about)\b/g,
    fix: () => "interested in",
    explain: () => "The preposition after “interested” is “in”.",
  },
  {
    id: "in-weekend",
    category: "vocabulary",
    pattern: /\bin the weekend\b/g,
    fix: () => "at the weekend",
    explain: () => "We say “at the weekend” (UK) or “on the weekend” (US).",
  },
  {
    id: "everyday-adverb",
    category: "vocabulary",
    pattern: /\beveryday\b(?= *(?:[.,!?]|$|and\b|but\b|at\b|in\b|before\b|after\b))/g,
    fix: () => "every day",
    explain: () => "“Everyday” (one word) is an adjective (everyday life). For “each day”, write “every day”.",
  },
  {
    id: "double-word",
    category: "grammar",
    pattern: /\b(the|a|an|to|is|and|of|in) \1\b/gi,
    fix: (m) => m[1]!,
    explain: (m) => `The word “${m[1]}” is repeated.`,
  },
];

/** Naturalness tweaks for spoken English — shown in the natural version only, never counted as errors. */
const NATURAL_RULES: Array<[RegExp, string]> = [
  [/\bI am\b(?! (?:not )?sure\b)/g, "I'm"],
  [/\bI will\b/g, "I'll"],
  [/\bI have (been|got|never|already|just)\b/g, "I've $1"],
  [/\bdo not\b/g, "don't"],
  [/\bdoes not\b/g, "doesn't"],
  [/\bcan not\b|\bcannot\b/g, "can't"],
  [/\bit is\b/g, "it's"],
  [/\bIt is\b/g, "It's"],
  [/\bthat is\b/g, "that's"],
  [/^Can you\b/gm, "Could you"],
  [/([.!?] )Can you\b/g, "$1Could you"],
  [/\bI want to\b(?= (?:book|order|ask|reserve|change|cancel))/g, "I'd like to"],
  [/\bvery very\b/g, "really"],
];

export interface RuleResult {
  corrected: string;
  natural: string;
  items: FeedbackItem[];
}

function sentenceAround(text: string, index: number) {
  const start = Math.max(text.lastIndexOf(".", index - 1), text.lastIndexOf("!", index - 1), text.lastIndexOf("?", index - 1), text.lastIndexOf("\n", index - 1)) + 1;
  const ends = [".", "!", "?", "\n"].map((c) => text.indexOf(c, index)).filter((x) => x >= 0);
  const end = ends.length ? Math.min(...ends) + 1 : text.length;
  return text.slice(start, end).trim();
}

/** Rules that only matter in writing (they're fixed silently for speech). */
const WRITTEN_ONLY = new Set(["lowercase-i"]);

export function applyRules(text: string, opts: { spoken?: boolean } = {}): RuleResult {
  let corrected = text;
  const items: FeedbackItem[] = [];
  for (const rule of RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    const snapshot = corrected;
    let out = "";
    let last = 0;
    while ((m = pattern.exec(snapshot)) !== null) {
      if (m[0].length === 0) {
        pattern.lastIndex++;
        continue;
      }
      const replacement = rule.fix(m);
      if (replacement !== m[0]) {
        const before = sentenceAround(snapshot, m.index);
        out += snapshot.slice(last, m.index) + replacement;
        last = m.index + m[0].length;
        const silent = opts.spoken && WRITTEN_ONLY.has(rule.id);
        if (!silent && items.length < 12 && !items.some((i) => i.original === m![0] && i.explanation === rule.explain(m!))) {
          items.push({
            original: m[0],
            corrected: replacement,
            natural: "",
            category: rule.category,
            explanation: rule.explain(m),
          });
        }
        void before;
      }
    }
    corrected = out + snapshot.slice(last);
  }
  // Sentence-initial capital letter (only when the text starts lowercase).
  if (/^[a-z]/.test(corrected) && !/^i\b/.test(text)) corrected = corrected[0]!.toUpperCase() + corrected.slice(1);

  let natural = corrected;
  for (const [re, rep] of NATURAL_RULES) natural = natural.replace(re, rep);
  return { corrected, natural, items };
}

export const RULE_COUNT = RULES.length;
