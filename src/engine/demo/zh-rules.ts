/**
 * Demo-mode checks for common Mandarin learner errors (simplified characters).
 * Deliberately conservative: only frequent, unambiguous patterns. Not a full grammar checker.
 */
import type { RuleItem, RuleResult } from "./en-rules";

const SUBJ = "(我们|你们|他们|她们|我|你|他|她|您)";
const NUM = "(一|两|三|四|五|六|七|八|九|十|几|这|那|每)";

interface ZhRule {
  re: RegExp;
  fix: (m: RegExpExecArray) => string;
  explain: (m: RegExpExecArray) => string;
  tag: string;
}

const RULES: ZhRule[] = [
  {
    re: /是(很|非常|太)/g,
    fix: (m) => m[1]!,
    explain: () => "หน้าคำคุณศัพท์ไม่ต้องใช้ 是 เช่น 我很好 ไม่ใช่ 我是很好",
    tag: "zh.word_order",
  },
  {
    re: /二(个|本|杯|张|辆|件|口|天|位)/g,
    fix: (m) => `两${m[1]}`,
    explain: () => "หน้าลักษณนามใช้ 两 ไม่ใช่ 二 เช่น 两个人",
    tag: "zh.measure_words",
  },
  {
    re: new RegExp(`${NUM}个(书|杂志|词典|本子)`, "g"),
    fix: (m) => `${m[1]}本${m[2]}`,
    explain: (m) => `หนังสือใช้ลักษณนาม 本: ${m[1]}本${m[2]}`,
    tag: "zh.measure_words",
  },
  {
    re: new RegExp(`${NUM}个(车|汽车|自行车|出租车)`, "g"),
    fix: (m) => `${m[1]}辆${m[2]}`,
    explain: (m) => `ยานพาหนะใช้ลักษณนาม 辆: ${m[1]}辆${m[2]}`,
    tag: "zh.measure_words",
  },
  {
    re: new RegExp(`${NUM}个(票|纸|桌子|床|照片|机票|地图)`, "g"),
    fix: (m) => `${m[1]}张${m[2]}`,
    explain: (m) => `ของแบน ๆ เช่น ตั๋ว กระดาษ ใช้ลักษณนาม 张: ${m[1]}张${m[2]}`,
    tag: "zh.measure_words",
  },
  {
    re: new RegExp(`${NUM}个(衣服|毛衣|衬衫)`, "g"),
    fix: (m) => `${m[1]}件${m[2]}`,
    explain: (m) => `เสื้อผ้าใช้ลักษณนาม 件: ${m[1]}件${m[2]}`,
    tag: "zh.measure_words",
  },
  {
    re: /没([^，。！？了]{1,6})了/g,
    fix: (m) => `没${m[1]}`,
    explain: () => "ประโยคปฏิเสธด้วย 没 ไม่ใช้ 了 ต่อท้าย เช่น 我没去 ไม่ใช่ 我没去了",
    tag: "zh.le_aspect",
  },
  {
    re: /([^。！？]*(什么|哪儿|哪里|哪个|谁|几|多少|怎么|为什么)[^。！？]*?)吗([？?])/g,
    fix: (m) => `${m[1]}${m[3]}`,
    explain: () => "ประโยคที่มีคำแสดงคำถาม (什么 哪儿 谁 …) แล้ว ไม่ต้องเติม 吗",
    tag: "zh.question_forms",
  },
  {
    re: /比([^，。！？]{1,8})(很|非常)/g,
    fix: (m) => `比${m[1]}`,
    explain: () => "ประโยคเปรียบเทียบด้วย 比 ไม่ใช้ 很/非常 หน้าคุณศัพท์ (ใช้ 更 หรือ …多了 แทนได้)",
    tag: "zh.comparison",
  },
  {
    re: /(说|跑|写|做|唱|学|睡|来|走|吃)的(很|非常|不|太|真)/g,
    fix: (m) => `${m[1]}得${m[2]}`,
    explain: () => "หลังกริยาที่บอกว่าทำได้ดีแค่ไหน ใช้ 得 เช่น 说得很好",
    tag: "zh.de_particles",
  },
  {
    re: new RegExp(`${SUBJ}(工作|学习|吃饭|上班|上课|等你)在([^，。！？]{1,8})`, "g"),
    fix: (m) => `${m[1]}在${m[3]}${m[2]}`,
    explain: () => "สถานที่ (在 + สถานที่) วางหน้ากริยา เช่น 我在曼谷工作",
    tag: "zh.word_order",
  },
  {
    re: new RegExp(`^${SUBJ}(去|来|回|到)([^，。！？]{1,8}?)(明天|今天|昨天|后天|晚上|早上|下午|上午)([。！]?)$`, "gm"),
    fix: (m) => `${m[1]}${m[4]}${m[2]}${m[3]}${m[5]}`,
    explain: () => "คำบอกเวลาวางหน้ากริยา (หรือต้นประโยค) เช่น 我明天去北京",
    tag: "zh.time_place_order",
  },
  {
    re: /非常很|很非常/g,
    fix: () => "非常",
    explain: () => "ใช้ 很 หรือ 非常 อย่างใดอย่างหนึ่ง",
    tag: "zh.word_order",
  },
];

export function applyZhRules(text: string): RuleResult {
  let corrected = text;
  const items: RuleItem[] = [];
  for (const rule of RULES) {
    corrected = corrected.replace(new RegExp(rule.re.source, rule.re.flags), (...args) => {
      const groups = args.slice(0, -2) as string[];
      const m = Object.assign([...groups], { index: 0, input: corrected }) as unknown as RegExpExecArray;
      const replacement = rule.fix(m);
      if (replacement !== groups[0] && items.length < 12) {
        items.push({ original: groups[0]!, corrected: replacement, explanation: rule.explain(m), tag: rule.tag });
      }
      return replacement;
    });
  }
  return { corrected, natural: corrected, items };
}
