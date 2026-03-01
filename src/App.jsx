import { useState, useCallback, useRef, useEffect } from "react";
import { storage } from "./lib/supabase.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const DIFFICULTY_LABELS = ["Starter", "Building", "Challenging"];
const TOPIC_COLOR_MAP = { positive_negative: "#60a5fa", graphing: "#c084fc", order_of_operations: "#34d399" };
const TOPIC_LABEL_MAP = { positive_negative: "Pos / Neg", graphing: "Graphing", order_of_operations: "Order of Ops" };
// Gracefully handle any topic string (e.g. "fractions", "equivalent_fractions")
function topicColor(t) { return TOPIC_COLOR_MAP[t] || "#f0a050"; }
function topicLabel(t) {
  if (TOPIC_LABEL_MAP[t]) return TOPIC_LABEL_MAP[t];
  // Convert snake_case to Title Case for unknown topics
  return t.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
const TOPICS = ["positive_negative", "graphing", "order_of_operations"];
const TIMER_OPTIONS = [
  { label: "3 min", seconds: 180 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "Untimed", seconds: 0 },
];
// ─── Subject Config ──────────────────────────────────────────────────────────
const SUBJECTS = [
  {
    id: "math",
    name: "Math",
    emoji: "📐",
    accent: "#E8FF45",
    accentDim: "#3a4a00",
    bg: "#0d1400",
    border: "#2a3a00",
    tagline: "Numbers · Fractions · Graphs",
    generalLabel: "Pos/Neg · Graphing · PEMDAS",
    generalPrompt: `Generate exactly 8 math problems covering: positive & negative numbers, graphing on the coordinate plane, order of operations (PEMDAS). Mix all three topics (at least 2 of each).`,
    insightContext: "6th grade math",
    hasMathVisuals: true,
  },
  {
    id: "science",
    name: "Science",
    emoji: "🔬",
    accent: "#34d399",
    accentDim: "#003a22",
    bg: "#001a10",
    border: "#00402a",
    tagline: "Biology · Earth Science · Physics",
    supportsTextTopic: true,
    generalLabel: "Life · Earth · Physical Science",
    generalPrompt: `Generate exactly 8 science questions for a 6th grader covering: life science (cells, ecosystems, adaptations), earth science (rocks, weather, solar system), and physical science (forces, energy, matter). Mix all three areas.`,
    insightContext: "6th grade science",
    hasMathVisuals: false,
  },
  {
    id: "social_studies",
    name: "Social Studies",
    emoji: "🌍",
    accent: "#fb923c",
    accentDim: "#3a1800",
    bg: "#150800",
    border: "#3a1800",
    tagline: "History · Geography · Civics",
    supportsTextTopic: true,
    generalLabel: "History · Geography · Civics",
    generalPrompt: `Generate exactly 8 social studies questions for a 6th grader covering: world history (ancient civilizations, key events), geography (continents, countries, landforms), and civics (government, rights, citizenship). Mix all three areas.`,
    insightContext: "6th grade social studies",
    hasMathVisuals: false,
  },
  {
    id: "grammar",
    name: "Grammar",
    emoji: "✏️",
    accent: "#60a5fa",
    accentDim: "#001a3a",
    bg: "#00080f",
    border: "#00204a",
    tagline: "Parts of Speech · Punctuation · Writing",
    generalLabel: "Grammar · Punctuation · Style",
    generalPrompt: `Generate exactly 8 grammar and language arts questions for a 6th grader covering: parts of speech (nouns, verbs, adjectives, adverbs), sentence structure (complete sentences, fragments, run-ons), and punctuation/capitalization. Mix all three areas. Write SHORT, clear questions.`,
    insightContext: "6th grade grammar and ELA",
    hasMathVisuals: false,
  },
  {
    id: "latin",
    name: "Latin",
    emoji: "🏛️",
    accent: "#f472b6",
    accentDim: "#3a0020",
    bg: "#150010",
    border: "#3a0030",
    tagline: "Vocabulary · Grammar · Translation",
    generalLabel: "Vocab · Grammar · Translation",
    generalPrompt: `Generate exactly 8 Latin language questions for a 6th grader covering: common Latin vocabulary (nouns, verbs, adjectives from typical beginner/LLPSI curriculum), basic grammar (noun cases: nominative/accusative/genitive, present tense verb conjugation), and simple translation (Latin to English short phrases). Mix all three areas. Always include the Latin word or phrase clearly in the question.`,
    insightContext: "6th grade Latin",
    hasMathVisuals: false,
  },
  {
    id: "english",
    name: "English",
    emoji: "📖",
    accent: "#a78bfa",
    accentDim: "#2a1060",
    bg: "#0d0820",
    border: "#2a1a50",
    tagline: "Literature · Comprehension · Analysis",
    generalLabel: "The Silver Chair · CS Lewis · Narnia",
    generalPrompt: `Generate exactly 8 English literature questions for a 6th grader about "The Silver Chair" by C.S. Lewis (The Chronicles of Narnia). Cover: plot comprehension (key events, chapter sequence, cause and effect), character analysis (Jill, Eustace, Puddleglum, Prince Rilian, the Lady of the Green Kirtle, Aslan), and themes/literary devices (obedience, signs, hope, temptation, symbolism, foreshadowing). Mix all three areas. Keep questions clear and specific to the book.`,
    insightContext: "6th grade English literature — The Silver Chair",
    hasMathVisuals: false,
    supportsBookInput: true,
    supportsTextTopic: false,
  },
  {
    id: "religion",
    name: "Religion",
    emoji: "✝️",
    accent: "#fbbf24",
    accentDim: "#3a2800",
    bg: "#140e00",
    border: "#3a2a00",
    tagline: "Catechism · Faith · Sacraments",
    supportsTextTopic: true,
    generalLabel: "Creed · Sacraments · Commandments",
    generalPrompt: `Generate exactly 8 religion questions for a Catholic 6th grader based on the Catechism of the Catholic Church. Cover: the Creed and core beliefs (Trinity, Incarnation, Resurrection, the Church), the Sacraments (names, purpose, matter and form of each, especially Baptism, Eucharist, Reconciliation, Confirmation), and the Commandments and moral life (Ten Commandments, Beatitudes, Works of Mercy). Mix all three areas. Keep questions age-appropriate, clear, and faithful to Catholic teaching.`,
    insightContext: "6th grade Catholic religion and Catechism",
    hasMathVisuals: false,
  },
];

const NEG_COLOR = "#ff6b6b";   // negative sign color
const POS_COLOR = "#4ade80";   // positive sign color
const NEU_COLOR = "#f0f0f0";   // neutral number color

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s) { const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; }
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    "  " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function pct(ok, total) { return total === 0 ? 0 : Math.round((ok / total) * 100); }

// ─── Color-coded math text ────────────────────────────────────────────────────
// Splits a string and colors every + green and every − red, digits remain neutral
// Vertical fraction rendering (numerator over denominator)
function VerticalFraction({ num, den, size = 22, weight = 700 }) {
  const fSize = Math.round(size * 0.72);
  return (
    <span style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center",
      verticalAlign: "middle", margin: "0 3px", lineHeight: 1.1,
    }}>
      <span style={{ fontSize: fSize, fontWeight: weight, color: NEU_COLOR, borderBottom: "1.5px solid #aaa", paddingBottom: 1, minWidth: fSize * 0.9, textAlign: "center" }}>
        {num}
      </span>
      <span style={{ fontSize: fSize, fontWeight: weight, color: NEU_COLOR, paddingTop: 1, textAlign: "center" }}>
        {den}
      </span>
    </span>
  );
}

function ColorizedMath({ text, size = 22, weight = 700 }) {
  if (!text) return null;
  const str = String(text);

  // First split on fraction patterns like "3/4", "10/15", "-2/3"
  // Capture negative sign as part of numerator if present
  const parts = str.split(/([-]?\d+\/\d+)/g);

  return (
    <span style={{ fontSize: size, fontWeight: weight, lineHeight: 1.8, letterSpacing: "0.03em", display: "inline" }}>
      {parts.map((part, pi) => {
        // Check if this part is a fraction
        const fracMatch = part.match(/^([-]?\d+)\/(\d+)$/);
        if (fracMatch) {
          return <VerticalFraction key={pi} num={fracMatch[1]} den={fracMatch[2]} size={size} weight={weight} />;
        }
        // Otherwise tokenize for sign coloring
        const tokens = part.split(/([+\-×÷=()²³])/g);
        return tokens.map((tok, i) => {
          if (tok === "-") return <span key={`${pi}-${i}`} style={{ color: NEG_COLOR, fontWeight: 900 }}>{tok}</span>;
          if (tok === "+") return <span key={`${pi}-${i}`} style={{ color: POS_COLOR, fontWeight: 900 }}>{tok}</span>;
          if (tok === "×" || tok === "÷") return <span key={`${pi}-${i}`} style={{ color: "#E8FF45", fontWeight: 900 }}>{tok}</span>;
          if (tok === "(" || tok === ")") return <span key={`${pi}-${i}`} style={{ color: "#c084fc", fontWeight: 900 }}>{tok}</span>;
          return <span key={`${pi}-${i}`} style={{ color: NEU_COLOR }}>{tok}</span>;
        });
      })}
    </span>
  );
}

// ─── Number Line ─────────────────────────────────────────────────────────────
function NumberLine({ nld, submitted, isCorrect }) {
  const [animPct, setAnimPct] = useState(0); // 0–1, drives dot animation
  const hasData = nld && typeof nld.start === "number" && typeof nld.result === "number";

  const allNums = hasData ? [nld.start, nld.result, nld.start + (nld.move || 0)] : [];
  const rawMin = hasData ? Math.min(...allNums) - 2 : -8;
  const rawMax = hasData ? Math.max(...allNums) + 2 : 8;
  const min = Math.min(rawMin, -5);
  const max = Math.max(rawMax, 5);
  const range = max - min;

  const W = 340, H = 64, PAD = 24;
  const toX = (v) => PAD + ((v - min) / range) * (W - PAD * 2);

  // animate dot after correct answer
  useEffect(() => {
    if (submitted && isCorrect && hasData) {
      setAnimPct(0);
      let start = null;
      const dur = 700;
      const step = (ts) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        setAnimPct(p);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else {
      setAnimPct(0);
    }
  }, [submitted, isCorrect]);

  const animX = hasData ? toX(nld.start) + animPct * (toX(nld.result) - toX(nld.start)) : null;
  const ticks = Array.from({ length: range + 1 }, (_, i) => min + i);

  return (
    <div style={{ margin: "0 0 20px", background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 0 6px" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        {/* Axis line */}
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="#2a2a2a" strokeWidth={2} />

        {/* Tick marks + labels */}
        {ticks.map((v) => {
          const x = toX(v);
          const isZero = v === 0;
          const labelColor = v < 0 ? "#ff6b6b" : v > 0 ? "#4ade80" : "#888";
          return (
            <g key={v}>
              <line x1={x} y1={H / 2 - (isZero ? 10 : 5)} x2={x} y2={H / 2 + (isZero ? 10 : 5)}
                stroke={isZero ? "#444" : "#222"} strokeWidth={isZero ? 2 : 1} />
              {(isZero || v % 2 === 0 || range <= 12) && (
                <text x={x} y={H / 2 + 22} textAnchor="middle" fill={labelColor}
                  fontSize={isZero ? 11 : 10} fontWeight={isZero ? 800 : 400} fontFamily="monospace">{v}</text>
              )}
            </g>
          );
        })}

        {/* Start dot */}
        {hasData && (
          <g>
            <circle cx={toX(nld.start)} cy={H / 2} r={7} fill={nld.start < 0 ? NEG_COLOR : POS_COLOR} stroke="#000" strokeWidth={1.5} opacity={0.85} />
            <text x={toX(nld.start)} y={H / 2 - 14} textAnchor="middle" fill={nld.start < 0 ? NEG_COLOR : POS_COLOR} fontSize={10} fontWeight={700} fontFamily="monospace">{nld.start}</text>
          </g>
        )}

        {/* Animated result dot */}
        {hasData && submitted && isCorrect && animX !== null && (
          <g style={{ transition: "opacity 0.3s" }}>
            <circle cx={animX} cy={H / 2} r={9}
              fill={nld.result < 0 ? NEG_COLOR : POS_COLOR} stroke="#fff" strokeWidth={2}
              opacity={animPct} />
            {animPct > 0.9 && (
              <text x={toX(nld.result)} y={H / 2 - 16} textAnchor="middle"
                fill={nld.result < 0 ? NEG_COLOR : POS_COLOR} fontSize={11} fontWeight={800} fontFamily="monospace">
                {nld.result}
              </text>
            )}
          </g>
        )}


      </svg>
    </div>
  );
}

// ─── Step Reveal (PEMDAS) ─────────────────────────────────────────────────────
function StepReveal({ steps, submitted }) {
  const [revealed, setRevealed] = useState(0);
  const all = revealed >= (steps?.length || 0);

  if (!steps || steps.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      {steps.slice(0, revealed + 1).map((step, i) => {
        const done = i < revealed;
        return (
          <div key={i} style={{ background: done ? "#0b1f0b" : "#0f1800", border: `1px solid ${done ? "#1a4a1a" : "#2a3a00"}`, borderRadius: 8, padding: "12px 16px", marginBottom: 8, animation: "fade-in .25s ease" }}>
            <div style={{ fontSize: 11, color: done ? "#4ade8088" : "#E8FF4588", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>
              {done ? "✓ Done" : `Step ${i + 1}`}
            </div>
            <div style={{ marginBottom: 6 }}>
              <ColorizedMath text={step.focus} size={20} weight={800} />
              {done && <span style={{ marginLeft: 12, color: POS_COLOR, fontWeight: 800, fontSize: 20 }}>= <ColorizedMath text={String(step.result)} size={20} weight={800} /></span>}
            </div>
            <div style={{ fontSize: 13, color: done ? "#3a6a3a" : "#7a8a00", lineHeight: 1.5 }}>{step.hint}</div>
          </div>
        );
      })}
      {!submitted && !all && (
        <button onClick={() => setRevealed((r) => r + 1)}
          style={{ width: "100%", padding: "11px", background: "#0f1800", border: "1.5px solid #2a3a00", borderRadius: 8, color: "#E8FF45", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 4 }}>
          Next Step →
        </button>
      )}
    </div>
  );
}

// ─── Coord Grid ───────────────────────────────────────────────────────────────
// Supports both single point (legacy) and multi-point labeled mode
const POINT_COLORS = ["#E8FF45", "#c084fc", "#60a5fa", "#fb923c"]; // A=yellow, B=purple, C=blue, D=orange

function CoordGrid({ point, graphPoints, submitted, correct }) {
  const size = 260, cx = size / 2, step = size / 10, toPx = (v) => cx + v * step;

  // Normalise: if graphPoints array provided use it, else wrap single point
  const points = graphPoints && graphPoints.length
    ? graphPoints
    : point ? [{ label: null, x: point.x, y: point.y }] : [];

  return (
    <svg width={size} height={size} style={{ display: "block", background: "#0d0d0d", border: "1.5px solid #2a2a2a", borderRadius: 8 }}>
      {/* Grid lines + tick labels */}
      {[-4,-3,-2,-1,0,1,2,3,4].map((i) => (
        <g key={i}>
          <line x1={toPx(i)} y1={4} x2={toPx(i)} y2={size-4} stroke={i===0?"#3a3a3a":"#1e1e1e"} strokeWidth={i===0?1.5:1}/>
          <line x1={4} y1={toPx(i)} x2={size-4} y2={toPx(i)} stroke={i===0?"#3a3a3a":"#1e1e1e"} strokeWidth={i===0?1.5:1}/>
          {i!==0 && (<>
            <text x={toPx(i)} y={cx+16} textAnchor="middle" fill={i<0?NEG_COLOR+"99":POS_COLOR+"99"} fontSize={10} fontWeight={700}>{i}</text>
            <text x={cx+5} y={toPx(i)+4} fill={i<0?POS_COLOR+"99":NEG_COLOR+"99"} fontSize={10} fontWeight={700}>{-i}</text>
          </>)}
        </g>
      ))}
      {/* Axis labels */}
      <text x={size-18} y={cx-8} fill="#555" fontSize={11} fontWeight={800}>+x</text>
      <text x={cx+6} y={16} fill="#555" fontSize={11} fontWeight={800}>+y</text>

      {/* Plot each point */}
      {points.map((pt, idx) => {
        const color = POINT_COLORS[idx % POINT_COLORS.length];
        const px = toPx(pt.x), py = toPx(-pt.y);
        return (
          <g key={idx}>
            <circle cx={px} cy={py} r={9} fill={color} stroke="#000" strokeWidth={2}/>
            {pt.label && (
              <>
                {/* White halo behind label for readability */}
                <circle cx={px} cy={py - 18} r={9} fill="#111" stroke={color} strokeWidth={1.5}/>
                <text x={px} y={py - 14} textAnchor="middle" fill={color} fontSize={11} fontWeight={900}>{pt.label}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Answer Option Tile ───────────────────────────────────────────────────────
function OptionTile({ opt, selected, submitted, correct, onClick }) {
  const isSelected = opt === selected;
  const isCorrect = opt === correct;
  let bg = "#0e0e0e", border = "#1e1e1e", glow = "none";
  if (!submitted) {
    if (isSelected) { bg = "#141800"; border = "#E8FF45"; glow = "0 0 0 2px #E8FF4530"; }
  } else {
    if (isCorrect) { bg = "#0b1f0b"; border = POS_COLOR; glow = `0 0 0 2px ${POS_COLOR}30`; }
    else if (isSelected) { bg = "#1f0b0b"; border = NEG_COLOR; glow = `0 0 0 2px ${NEG_COLOR}30`; }
    else { bg = "#090909"; border = "#111"; }
  }
  return (
    <button
      onClick={() => !submitted && onClick(opt)}
      style={{
        display: "block", width: "100%", padding: "18px 20px", marginBottom: 10,
        background: bg, border: `2px solid ${border}`, borderRadius: 10,
        boxShadow: glow, cursor: submitted ? "default" : "pointer",
        textAlign: "center", transition: "border .12s, background .12s, box-shadow .12s",
        animation: "fade-in .2s ease"
      }}
    >
      <ColorizedMath text={opt} size={22} weight={800} />
      {submitted && isCorrect && <span style={{ marginLeft: 10, color: POS_COLOR, fontSize: 18 }}>✓</span>}
      {submitted && isSelected && !isCorrect && <span style={{ marginLeft: 10, color: NEG_COLOR, fontSize: 18 }}>✗</span>}
    </button>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────
function InsightCard({ insight }) {
  const color = topicColor(insight.topic);
  return (
    <div style={{ background: "#0c0c0c", border: `1.5px solid ${color}22`, borderRadius: 12, padding: "24px 24px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ display:"inline-block", padding:"4px 12px", background:color+"18", border:`1px solid ${color}33`, borderRadius:20, color, fontSize:11, fontWeight:800, letterSpacing:2, textTransform:"uppercase", whiteSpace:"nowrap" }}>
          {topicLabel(insight.topic)}
        </span>
        <span style={{ fontSize:16, fontWeight:800, color:"#fff", lineHeight:1.4 }}>{insight.headline}</span>
      </div>
      {insight.mnemonic && (
        <div style={{ background:color+"0d", border:`1px solid ${color}25`, borderRadius:8, padding:"12px 14px", marginBottom:12 }}>
          <div style={{ fontSize:10, color:color+"aa", letterSpacing:3, textTransform:"uppercase", fontWeight:800, marginBottom:5 }}>Mnemonic</div>
          <div style={{ fontSize:15, color, fontWeight:700, lineHeight:1.5 }}>{insight.mnemonic}</div>
        </div>
      )}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:10, color:"#3a3a3a", letterSpacing:3, textTransform:"uppercase", fontWeight:800, marginBottom:6 }}>The Trick</div>
        <div style={{ fontSize:14, color:"#aaa", lineHeight:1.75 }}>{insight.trick}</div>
      </div>
      {insight.visual && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, color:"#3a3a3a", letterSpacing:3, textTransform:"uppercase", fontWeight:800, marginBottom:6 }}>Picture This</div>
          <div style={{ fontSize:14, color:"#666", lineHeight:1.7, fontStyle:"italic" }}>"{insight.visual}"</div>
        </div>
      )}
      {insight.encouragement && (
        <div style={{ borderTop:"1px solid #1a1a1a", paddingTop:12, fontSize:13, color:"#4a4a4a", lineHeight:1.6 }}>{insight.encouragement}</div>
      )}
    </div>
  );
}

// ─── History helpers ──────────────────────────────────────────────────────────
function TrendBadge({ trend }) {
  if (trend === "improving") return <span style={{ fontSize:11, fontWeight:800, color:POS_COLOR, background:"#0b1f0b", border:`1px solid ${POS_COLOR}44`, borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>↑ IMPROVING</span>;
  if (trend === "needs-work") return <span style={{ fontSize:11, fontWeight:800, color:NEG_COLOR, background:"#1f0b0b", border:`1px solid ${NEG_COLOR}44`, borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>↓ NEEDS WORK</span>;
  return <span style={{ fontSize:11, fontWeight:800, color:"#555", background:"#111", border:"1px solid #222", borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>→ STEADY</span>;
}
function MiniBar({ value }) {
  const color = value >= 70 ? POS_COLOR : value >= 40 ? "#E8FF45" : NEG_COLOR;
  return (
    <div style={{ background:"#141414", borderRadius:3, height:6, overflow:"hidden", flex:1 }}>
      <div style={{ height:"100%", width:`${value}%`, background:color, borderRadius:3, transition:"width .5s ease" }}/>
    </div>
  );
}

// ─── Auth (reads/writes Supabase users table directly) ───────────────────────

// Simple deterministic hash — good enough for a school app
function hashPassword(username, password) {
  let h = 0;
  const str = username.toLowerCase() + "|" + password;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

async function registerUser(username, password, displayName, isAdmin = false) {
  const { supabase } = await import("./lib/supabase.js");
  const uname = username.trim().toLowerCase();
  // Check if username taken
  const { data: existing } = await supabase.from("users").select("username").eq("username", uname).maybeSingle();
  if (existing) return { ok: false, error: "Username already taken" };
  const newUser = {
    username: uname,
    password_hash: hashPassword(uname, password),
    display_name: displayName.trim() || username.trim(),
    is_admin: isAdmin,
    is_approved: isAdmin, // admins auto-approved; regular users need approval
  };
  const { error } = await supabase.from("users").insert(newUser);
  if (error) return { ok: false, error: "Could not create account: " + error.message };
  return { ok: true, user: { username: uname, displayName: newUser.display_name, isAdmin }, pendingApproval: !isAdmin };
}

async function loginUser(username, password) {
  const { supabase } = await import("./lib/supabase.js");
  const uname = username.trim().toLowerCase();
  const { data: user, error } = await supabase.from("users").select("*").eq("username", uname).maybeSingle();
  if (error || !user) return { ok: false, error: "Username not found" };
  if (user.password_hash !== hashPassword(uname, password)) return { ok: false, error: "Wrong password" };
  if (!user.is_approved && !user.is_admin) return { ok: false, error: "PENDING_APPROVAL" };
  return { ok: true, user: { username: user.username, displayName: user.display_name, isAdmin: user.is_admin } };
}

// ─── Storage (user-scoped) ────────────────────────────────────────────────────
function userPrefix(username) { return `u-${username || "guest"}-`; }
function sessionsKey(subjectId, username) { return `${userPrefix(username)}sessions-${subjectId || "math"}`; }
async function loadSessions(subjectId, username) {
  try { const r = await storage.get(sessionsKey(subjectId, username)); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function saveSession(session, subjectId, username) {
  try { const e = await loadSessions(subjectId, username); await storage.set(sessionsKey(subjectId, username), JSON.stringify([session,...e].slice(0,100))); } catch {}
}
async function clearSessions(subjectId, username) { try { await storage.delete(sessionsKey(subjectId, username)); } catch {} }

// ─── Stats storage (streak, sessions this week) ───────────────────────────────
function statsKey(username) { return `${userPrefix(username)}stats`; }
async function loadStats(username) {
  try { const r = await storage.get(statsKey(username)); return r ? JSON.parse(r.value) : { bestStreak: 0, currentStreak: 0, lastSessionDate: null, weekSessions: [] }; }
  catch { return { bestStreak: 0, currentStreak: 0, lastSessionDate: null, weekSessions: [] }; }
}
async function updateStats(sessionPct, username) {
  const s = await loadStats(username);
  const today = new Date().toISOString().slice(0,10);
  // Current streak: consecutive days with score >= 70%
  const lastDate = s.lastSessionDate;
  const daysSinceLast = lastDate ? Math.floor((Date.now() - new Date(lastDate)) / 86400000) : 999;
  let cur = s.currentStreak || 0;
  if (sessionPct >= 70) {
    cur = daysSinceLast <= 1 ? cur + 1 : 1;
  } else {
    cur = 0;
  }
  // Sessions this week (last 7 days)
  const week = [...(s.weekSessions || []).filter(d => {
    const diff = (Date.now() - new Date(d)) / 86400000;
    return diff < 7;
  }), today];
  const updated = { bestStreak: Math.max(s.bestStreak || 0, cur), currentStreak: cur, lastSessionDate: today, weekSessions: week };
  try { await storage.set(statsKey(username), JSON.stringify(updated)); } catch {}
  return updated;
}

// ─── Topic Bank storage ──────────────────────────────────────────────────────
function topicBankKey(subjectId, username) { return `${userPrefix(username)}topicbank-${subjectId || "math"}`; }
async function loadTopicBank(subjectId, username) {
  try { const r = await storage.get(topicBankKey(subjectId, username)); return r ? JSON.parse(r.value) : []; }
  catch { return []; }
}
async function saveTopicToBank(topic, subjectId, username) {
  if (!topic?.topicName) return;
  // Generate a fallback topicKey from the name if missing or unknown
  if (!topic.topicKey || topic.topicKey === "unknown") {
    topic = { ...topic, topicKey: topic.topicName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") };
  }
  try {
    const bank = await loadTopicBank(subjectId, username);
    const existing = bank.findIndex(t => t.topicKey === topic.topicKey);
    if (existing >= 0) {
      bank[existing].lastUsed = new Date().toISOString();
      bank[existing].sessionCount = (bank[existing].sessionCount || 0) + 1;
      // Update name/description in case detection improved
      bank[existing].topicName = topic.topicName;
      bank[existing].description = topic.description;
    } else {
      bank.unshift({ ...topic, lastUsed: new Date().toISOString(), sessionCount: 1 });
    }
    await storage.set(topicBankKey(subjectId, username), JSON.stringify(bank.slice(0, 30)));
  } catch {}
}

function computeTrends(sessions) {
  return TOPICS.map((topic) => {
    const relevant = sessions.map((s) => {
      const rows = s.log.filter((l) => l.topic === topic);
      return rows.length ? { pct: pct(rows.filter((r) => r.ok).length, rows.length) } : null;
    }).filter(Boolean);
    if (!relevant.length) return { topic, status: "no-data" };
    const avg = Math.round(relevant.reduce((a, b) => a + b.pct, 0) / relevant.length);
    const rec = relevant.slice(0, 3), old = relevant.slice(3, 6);
    let trend = "steady";
    const rAvg = rec.reduce((a,b)=>a+b.pct,0)/rec.length;
    const oAvg = old.length ? old.reduce((a,b)=>a+b.pct,0)/old.length : rAvg;
    if (rAvg - oAvg >= 10) trend = "improving";
    else if (oAvg - rAvg >= 10) trend = "needs-work";
    return { topic, status:"ok", avg, trend };
  });
}

// ─── API ──────────────────────────────────────────────────────────────────────
function callAPI(messages, maxTokens = 2000) {
  return fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages }),
  });
}

// Shared JSON schema instructions
const SCHEMA_INSTRUCTIONS = `
Return ONLY a valid JSON array — no markdown, no explanation, nothing before [ or after ].
Each object must have: id, topic, question, options (4 items), correct (must exactly match one option), tip, explanation.

IMPORTANT — equation field:
If the question involves a formula, function, or expression that the student needs to look at
(e.g. "f(x) = 3x + 2", "y = 2x − 1", "2 + 3 × 4", "3/4 + 1/2"),
put ONLY the plain prose question text in "question" and put the formula/expression in a separate "equation" field.
Example: {"question": "Find f(x) when x = 3", "equation": "f(x) = 2x + 1", ...}
If there is no formula (e.g. "What is −3 + 5?"), omit "equation" entirely.
Keep "question" text SHORT — it should be a clear instruction, not contain the math itself.

For topic "positive_negative", also include:
  "numberLineData": {"start": -4, "move": 7, "result": 3}

For topic "order_of_operations", also include:
  "steps": [
    {"focus": "3 × 4", "result": "12", "hint": "Multiply first (PEMDAS)"},
    {"focus": "2 + 12", "result": "14", "hint": "Now add left to right"}
  ]

For topic "graphing", choose ONE format:
  FORMAT 1 — 4 labeled points (use for "Which point is at...?" questions):
    "graphPoints": [{"label":"A","x":3,"y":-2},{"label":"B","x":-1,"y":4},{"label":"C","x":-3,"y":-1},{"label":"D","x":2,"y":3}]
    No two points share the same x or y value. Spread across all four quadrants.
    correct = the label letter "A" or coordinate string "(3, −2)" — must match one option exactly.
  FORMAT 2 — single point (use for quadrant / coordinate questions):
    "graphPoint": {"x": 3, "y": -2}

For all other topics (fractions, decimals, etc.) omit the visual fields.
Keep questions SHORT. Use × for multiply, ÷ for divide.`;

// Quick topic detection — lightweight call, returns {topicKey, topicName, description}
async function detectHomeworkTopic(base64, mediaType) {
  const imageBlock = mediaType === "application/pdf"
    ? { type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64 } }
    : { type:"image", source:{ type:"base64", media_type:mediaType, data:base64 } };

  const res = await callAPI([{ role:"user", content:[
    imageBlock,
    { type:"text", text:`Look at this homework page. In one JSON object, identify what it's about.
Return ONLY a JSON object — no markdown, no explanation.
Format: {"topicKey":"equivalent_fractions","topicName":"Equivalent Fractions","description":"Finding and writing equivalent fractions, and simplifying fractions to lowest terms."}
topicKey: short snake_case identifier. topicName: 2-4 word friendly name. description: one plain sentence for a 6th grader.` }
  ]}], 300);

  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = JSON.parse(text);
  const raw = data.content?.find(b => b.type === "text")?.text || "";
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error("Could not detect topic");
  return JSON.parse(match[0]);
}

async function generateProblems(base64, mediaType, difficulty, hwTopic, subject) {
  const blocks = [];

  if (base64 && mediaType) {
    // ── HOMEWORK MODE: difficulty is relative to the homework baseline ────
    const diffDesc = [
      "15–20% EASIER than the homework shown — use simpler numbers, fewer steps, same concept. Do NOT go off-topic.",
      "THE SAME difficulty as the homework shown — match the complexity and number types exactly.",
      "30–50% HARDER than the homework shown — more steps, harder numbers, mixed sub-types of the same concept.",
    ][difficulty];

    blocks.push(
      mediaType === "application/pdf"
        ? { type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64 } }
        : { type:"image", source:{ type:"base64", media_type:mediaType, data:base64 } }
    );
    blocks.push({ type:"text", text:`You are a math tutor for a 6th grader with dyslexia.

The homework page covers: ${hwTopic ? `"${hwTopic.topicName}" — ${hwTopic.description}` : "the topic shown in the image"}.

Generate exactly 8 practice problems on THIS TOPIC ONLY — not on other topics.
Difficulty level: ${diffDesc}
Dyslexia rules: SHORT question text, no clutter, unambiguous numbers.
Use topic string: "${hwTopic ? hwTopic.topicKey : "fractions"}"

Mix sub-types within the topic where appropriate.
${SCHEMA_INSTRUCTIONS}` });
  } else if (hwTopic?._isMix && hwTopic.mixTopics?.length) {
    // ── MIX MODE: blend 2-3 saved topics ─────────────────────────────────
    const diffDesc = ["easy — single-step","medium — some two-step","harder — multi-step"][difficulty];
    const topicList = hwTopic.mixTopics.map(t => `"${t.topicName}" (${t.description})`).join("; ");
    blocks.push({ type:"text", text:`You are a math tutor for a 6th grader with dyslexia.
Generate exactly 8 practice problems that MIX these topics: ${topicList}
Distribute questions roughly evenly across all topics listed.
Difficulty: ${diffDesc}.
Dyslexia rules: SHORT question text, no clutter, unambiguous numbers.
Use the most specific topic string for each problem (e.g. "${hwTopic.mixTopics[0]?.topicKey}").
${SCHEMA_INSTRUCTIONS}` });
  } else if (hwTopic?._isBook) {
    // ── BOOK MODE: English literature questions about a specific book ─────
    const diffDesc = [
      "straightforward comprehension — direct recall, simple plot and character questions",
      "standard analysis — mix of comprehension and basic literary analysis",
      "deeper analysis — themes, symbolism, character motivation, literary devices",
    ][difficulty];
    blocks.push({ type:"text", text:`You are an English literature tutor for a 6th grader with dyslexia.
Generate exactly 8 multiple-choice questions about the book: "${hwTopic.bookTitle}"${hwTopic.bookAuthor ? ` by ${hwTopic.bookAuthor}` : ""}.
Cover a mix of: plot comprehension (key events, sequence, cause and effect), character analysis (motivations, relationships, development), and themes/literary devices (symbolism, foreshadowing, author's message).
Difficulty: ${diffDesc}.
Dyslexia rules: SHORT clear question text, unambiguous wording. All questions must be specific to this book.
Use topic string: "${hwTopic.topicKey}"
${SCHEMA_INSTRUCTIONS}` });
  } else if (hwTopic?._isTextTopic) {
    // ── TEXT TOPIC MODE: user-entered theme for Science/History/Religion ──
    const diffDesc = [
      "introductory — basic recall and simple facts",
      "standard 6th-grade difficulty — mix of recall and understanding",
      "challenging — application, comparison, deeper understanding",
    ][difficulty];
    blocks.push({ type:"text", text:`You are a ${subject?.name || "subject"} tutor for a 6th grader with dyslexia.
Generate exactly 8 multiple-choice questions specifically about: "${hwTopic.topicName}"
Subject area: ${subject?.name || "General"}
Difficulty: ${diffDesc}.
Dyslexia rules: SHORT clear question text, no clutter, unambiguous wording. Multiple choice only.
Use topic string: "${hwTopic.topicKey}"
Mix different aspects and sub-topics within "${hwTopic.topicName}" where appropriate.
${SCHEMA_INSTRUCTIONS}` });
  } else if (hwTopic && !base64) {
    // ── TOPIC BANK MODE: no image, use stored topic name/description ──────
    const diffDesc = [
      "15–20% EASIER than typical homework — simpler numbers, fewer steps, same concept.",
      "standard 6th-grade difficulty for this topic.",
      "30–50% HARDER — more steps, harder numbers, mixed sub-types.",
    ][difficulty];
    blocks.push({ type:"text", text:`You are a tutor for a 6th grader with dyslexia.
Subject: ${subject?.name || "Math"}.
Generate exactly 8 practice problems on this topic: "${hwTopic.topicName}" — ${hwTopic.description}
Difficulty: ${diffDesc}
Dyslexia rules: SHORT question text, no clutter, unambiguous wording. Multiple choice only.
Use topic string: "${hwTopic.topicKey}"
Mix sub-types within the topic where appropriate.
${SCHEMA_INSTRUCTIONS}` });
  } else {
    // ── GENERAL MODE: standard three 6th-grade topics ─────────────────────
    const diffDesc = [
      "easy and accessible — single-step, simple numbers, foundational concepts only",
      "standard difficulty — typical for this grade level, some two-step problems",
      "challenging — multi-step, harder concepts, requires deeper thinking",
    ][difficulty];
    const subjectConfig = SUBJECTS.find(s => s.id === (subject?.id || "math")) || SUBJECTS[0];
    blocks.push({ type:"text", text:`You are a tutor for a 6th grader with dyslexia.
${subjectConfig.generalPrompt}
Difficulty: ${diffDesc}.
Dyslexia rules: SHORT question text, no clutter, unambiguous wording. Multiple choice only.
${SCHEMA_INSTRUCTIONS}` });
  }

  const res = await callAPI([{ role:"user", content:blocks }]);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0,400)}`);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Not JSON: ${text.slice(0,400)}`); }
  const raw = data.content?.find((b) => b.type==="text")?.text || "";
  if (!raw) throw new Error(`No text block. stop_reason: ${data.stop_reason}`);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON array: ${raw.slice(0,400)}`);
  return JSON.parse(match[0]);
}

async function generateInsights(sessionLog) {
  // Group wrong answers by topic, capturing full detail
  const wrongByTopic = {};
  sessionLog.forEach(({ topic, ok, question, selected, correct }) => {
    if (!ok) {
      if (!wrongByTopic[topic]) wrongByTopic[topic] = [];
      wrongByTopic[topic].push({ question, selected, correct });
    }
  });
  const struggling = Object.keys(wrongByTopic);
  if (!struggling.length) return [];

  const summaries = struggling.map((t) => {
    const ex = wrongByTopic[t].map(({ question, selected, correct }) =>
      `  Q: "${question}"\n     Wrong: "${selected}"  Correct: "${correct}"`
    ).join("\n");
    return `TOPIC: ${topicLabel(t)}\n${ex}`;
  }).join("\n\n");

  const prompt = `You are a specialist math tutor for a 6th grader with dyslexia. Analyze these specific mistakes and return learning tips.

MISTAKES THIS SESSION:
${summaries}

CRITICAL RULES:
1. Start your response with [ and end with ] — output ONLY the JSON array, nothing else before or after.
2. No markdown, no backticks, no explanation text outside the array.
3. Each tip must address the EXACT mistake pattern shown — not generic advice.
4. Focus heavily on DIRECTIONALITY: left vs right on number line, positive vs negative direction, axis direction, operation order (left-to-right).
5. Short sentences. Simple words. No jargon. Written for a 6th grader.
6. Give HOOKS and TRICKS the student can use in the moment — not re-explanations.

Return exactly ${struggling.length} JSON object(s) in this format:
[
  {
    "topic": "positive_negative",
    "headline": "Max 8 words — the core trick",
    "mnemonic": "A memorable phrase, rhyme, or acronym they can repeat to themselves",
    "trick": "2-3 short sentences. A concrete step-by-step method that prevents this exact mistake. Include directional language (left/right, up/down, bigger/smaller).",
    "visual": "One vivid mental image or physical gesture — e.g. walk a number line with your feet, use your hands to show direction.",
    "encouragement": "One warm sentence that names the specific thing they struggled with and affirms they are building the skill."
  }
]`;

  const res = await callAPI([
    {
      role: "user",
      content: prompt
    }
  ], 2000);

  const responseText = await res.text();
  if (!res.ok) throw new Error(`API error ${res.status}: ${responseText.slice(0, 300)}`);

  let apiData;
  try {
    apiData = JSON.parse(responseText);
  } catch {
    throw new Error(`API response not JSON. Got: ${responseText.slice(0, 200)}`);
  }

  const modelText = apiData.content?.find((b) => b.type === "text")?.text || "";
  if (!modelText) throw new Error(`No text in API response. stop_reason: ${apiData.stop_reason}`);

  // Robustly extract JSON array — handle any surrounding text the model might add
  const match = modelText.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Model did not return a JSON array. Got: ${modelText.slice(0, 200)}`);

  try {
    return JSON.parse(match[0]);
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}. Raw: ${match[0].slice(0, 200)}`);
  }
}


// ─── Reference Card ───────────────────────────────────────────────────────────
function ReferenceCard({ open, onClose }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"#000000cc", zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 12px 12px" }}
      onClick={onClose}>
      <div style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:16, padding:"24px 20px", maxWidth:520, width:"100%", animation:"fade-in .2s ease" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:800, color:"#E8FF45", letterSpacing:2, textTransform:"uppercase" }}>Quick Reference</div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#444", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>

        {/* Number line */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10, color:"#333", letterSpacing:2, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>Number Line</div>
          <div style={{ background:"#0a0a0a", borderRadius:8, padding:"12px 10px" }}>
            <svg width="100%" viewBox="0 0 300 36" style={{ display:"block", overflow:"visible" }}>
              <line x1="10" y1="18" x2="290" y2="18" stroke="#2a2a2a" strokeWidth="2"/>
              {[-5,-4,-3,-2,-1,0,1,2,3,4,5].map((v,i) => {
                const x = 10 + ((v+5)/10)*280;
                const isZero = v===0;
                return (
                  <g key={v}>
                    <line x1={x} y1={isZero?10:13} x2={x} y2={isZero?26:23} stroke={isZero?"#555":"#2a2a2a"} strokeWidth={isZero?2:1}/>
                    <text x={x} y={35} textAnchor="middle" fill={v<0?"#ff6b6b":v>0?"#4ade80":"#888"} fontSize={isZero?10:9} fontWeight={isZero?800:400}>{v}</text>
                  </g>
                );
              })}
              <text x="10" y="10" fill="#ff6b6b" fontSize="9" fontWeight="700">← NEGATIVE</text>
              <text x="170" y="10" fill="#4ade80" fontSize="9" fontWeight="700">POSITIVE →</text>
            </svg>
          </div>
        </div>

        {/* PEMDAS */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10, color:"#333", letterSpacing:2, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>Order of Operations</div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {[
              {l:"P", name:"Parentheses", color:"#c084fc"},
              {l:"E", name:"Exponents", color:"#60a5fa"},
              {l:"M", name:"Multiply", color:"#E8FF45"},
              {l:"D", name:"Divide", color:"#E8FF45"},
              {l:"A", name:"Add", color:"#4ade80"},
              {l:"S", name:"Subtract", color:"#ff6b6b"},
            ].map(({l,name,color},i,arr) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ background:color+"18", border:`1px solid ${color}44`, borderRadius:6, padding:"6px 9px", textAlign:"center" }}>
                  <div style={{ fontSize:16, fontWeight:900, color, lineHeight:1 }}>{l}</div>
                  <div style={{ fontSize:8, color:color+"88", marginTop:2 }}>{name}</div>
                </div>
                {i < arr.length-1 && <span style={{ color:"#2a2a2a", fontSize:12 }}>→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Coordinate plane quadrants */}
        <div>
          <div style={{ fontSize:10, color:"#333", letterSpacing:2, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>Coordinate Plane</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
            {[
              {q:"II", x:"−, +", desc:"Left, Up", color:"#c084fc"},
              {q:"I",  x:"+, +", desc:"Right, Up", color:"#4ade80"},
              {q:"III",x:"−, −", desc:"Left, Down", color:"#ff6b6b"},
              {q:"IV", x:"+, −", desc:"Right, Down", color:"#60a5fa"},
            ].map(({q,x,desc,color}) => (
              <div key={q} style={{ background:color+"0d", border:`1px solid ${color}25`, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:14, fontWeight:900, color, marginBottom:2 }}>Quadrant {q}</div>
                <div style={{ fontSize:12, fontFamily:"monospace", color:"#888" }}>({x})</div>
                <div style={{ fontSize:10, color:"#444", marginTop:2 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:8, fontSize:11, color:"#2a2a2a", textAlign:"center" }}>
            <span style={{ color:"#4ade80" }}>x right = positive</span>
            {"  ·  "}
            <span style={{ color:"#ff6b6b" }}>x left = negative</span>
            {"  ·  "}
            <span style={{ color:"#4ade80" }}>y up = positive</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);  // {username, displayName}
  const [subject, setSubject] = useState(null);  // active SUBJECTS entry
  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginDisplayName, setLoginDisplayName] = useState("");
  const [loginMode, setLoginMode] = useState("login");  // "login" | "register"
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [problems, setProblems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const [timerIdx, setTimerIdx] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeTotal, setTimeTotal] = useState(0);
  const [timeUsed, setTimeUsed] = useState(0);
  const timerRef = useRef(null);

  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);

  // Homework confirmation flow
  const [hwFile, setHwFile] = useState(null);      // {base64, mediaType}
  const [hwTopic, setHwTopic] = useState(null);    // {topicKey, topicName, description}
  const [hwDetecting, setHwDetecting] = useState(false);
  const [textTopicInput, setTextTopicInput] = useState("");   // theme text input
  const [bookTitle, setBookTitle] = useState("");             // book title for English
  const [bookAuthor, setBookAuthor] = useState("");           // book author for English
  const [showTextInput, setShowTextInput] = useState(false);  // expand text input panel

  const [sessions, setSessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Home screen stats
  const [homeStats, setHomeStats] = useState(null);

  // In-session reference card
  const [refCardOpen, setRefCardOpen] = useState(false);

  // Weak spots mode
  const [weakSpotsCount, setWeakSpotsCount] = useState(0);

  // Topic bank
  const [topicBank, setTopicBank] = useState([]);
  const [topicDropOpen, setTopicDropOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminTab, setAdminTab] = useState("pending"); // "pending" | "all" | "add"
  const [adminNewUsername, setAdminNewUsername] = useState("");
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminNewDisplay, setAdminNewDisplay] = useState("");
  const [adminNewIsAdmin, setAdminNewIsAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  useEffect(() => () => clearTimer(), []);


  // Load subject-specific data when subject changes OR when returning to upload screen
  useEffect(() => {
    if (!subject || !currentUser) return;
    loadStats(currentUser.username).then(setHomeStats);
    loadTopicBank(subject.id, currentUser.username).then(setTopicBank);
    loadSessions(subject.id, currentUser.username).then(sessions => {
      const recent = sessions.slice(0, 10);
      const missed = new Set();
      recent.forEach(s => s.log?.forEach(l => { if (!l.ok) missed.add(l.question); }));
      setWeakSpotsCount(missed.size);
    });
  }, [subject, screen === "upload" ? "upload" : "other"]);

  const prob = problems[idx];
  const isCorrect = submitted && selected === prob?.correct;
  const isLowTime = timeLeft > 0 && timeLeft <= 30;
  const timerPct = timeTotal > 0 ? (timeLeft / timeTotal) * 100 : 100;

  useEffect(() => {
    if (timeLeft===0 && screen==="problem" && timeTotal>0) { clearTimer(); setScreen("complete"); }
  }, [timeLeft, screen, timeTotal]);

  // Delayed option reveal when new question shows
  useEffect(() => {
    if (screen === "problem") {
      setShowOptions(false);
      setShowHint(false);
      const t = setTimeout(() => setShowOptions(true), 350);
      return () => clearTimeout(t);
    }
  }, [idx, screen]);

  const startTimer = (secs) => {
    clearTimer();
    if (secs===0) { setTimeLeft(0); setTimeTotal(0); return; }
    setTimeLeft(secs); setTimeTotal(secs); setTimeUsed(0);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => { if (t<=1){clearTimer();return 0;} return t-1; });
      setTimeUsed((u) => u+1);
    }, 1000);
  };

  const startSession = useCallback(async (base64, mediaType, topic) => {
    setError(null); setScreen("loading");
    try {
      const probs = await generateProblems(base64, mediaType, difficulty, topic, subject);
      if (!Array.isArray(probs)||!probs.length) throw new Error("Got empty problem list");
      setProblems(probs); setIdx(0); setScore(0); setStreak(0); setWrongStreak(0);
      setLog([]); setSelected(null); setSubmitted(false);
      setInsights(null); setInsightsError(null);
      startTimer(TIMER_OPTIONS[timerIdx].seconds);
      setScreen("problem");
    } catch(err) { setError(err.message||"Unknown error"); setScreen("upload"); }
  }, [difficulty, timerIdx]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);

    const name = (file.name || "").toLowerCase();
    const mime = (file.type || "").toLowerCase();
    const isHeic = mime.includes("heic") || mime.includes("heif") ||
                   name.endsWith(".heic") || name.endsWith(".heif");

    let finalFile = file;

    if (isHeic) {
      // Show a brief converting message, then silently convert to JPEG
      setError("HEIC_CONVERTING");
      try {
        // Dynamically load heic2any from CDN
        if (!window._heic2any) {
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js";
            s.onload = resolve;
            s.onerror = () => reject(new Error("Could not load HEIC converter"));
            document.head.appendChild(s);
          });
          window._heic2any = window.heic2any;
        }
        const blob = await window._heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
        finalFile = new File([blob], name.replace(/\.heic?$/, ".jpg"), { type: "image/jpeg" });
        setError(null);
      } catch (err) {
        setError("HEIC_FAILED");
        return;
      }
    } else if (mime && !mime.startsWith("image/") && mime !== "application/pdf") {
      setError(`Unsupported file type (${file.type || "unknown"}). Please use JPG, PNG, or PDF.`);
      return;
    }

    setError(null);
    // Read file, then detect topic and show confirm screen
    const r = new FileReader();
    r.onload = async (e) => {
      let base64 = e.target.result.split(",")[1];
      let mediaType = finalFile.type || "image/jpeg";

      // ── Compress image aggressively to stay under Vercel's 4.5MB limit ─
      try {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = e.target.result; });
        const MAX = 800;
        let w = img.width, h = img.height;
        const scale = Math.min(MAX/w, MAX/h, 1);
        w = Math.round(w * scale); h = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.70);
        base64 = compressed.split(",")[1];
        mediaType = "image/jpeg";
        console.log("Compressed to " + w + "x" + h + ", ~" + Math.round(base64.length/1024) + "KB base64");
      } catch (compressErr) {
        console.warn("Compression skipped:", compressErr);
      }

      setHwFile({ base64, mediaType });
      setHwDetecting(true);
      setScreen("confirm");
      try {
        const topic = await detectHomeworkTopic(base64, mediaType);
        setHwTopic(topic);
        // Default to Building (1) as baseline for homework
        setDifficulty(1);
      } catch {
        setHwTopic({ topicKey: "unknown", topicName: "Homework", description: "Problems based on your uploaded page." });
      } finally {
        setHwDetecting(false);
      }
    };
    r.readAsDataURL(finalFile);
  }, [startSession]);

  const handleSubmit = () => {
    if (!selected) return;
    setSubmitted(true);
    const ok = selected === prob.correct;
    const entry = { topic:prob.topic, ok, question:prob.question, selected, correct:prob.correct };
    if (ok) { const ns=streak+1; setStreak(ns); setWrongStreak(0); setScore((s)=>s+1); if(ns>=3&&difficulty<2) setDifficulty((d)=>d+1); }
    else { const nw=wrongStreak+1; setWrongStreak(nw); setStreak(0); if(nw>=2&&difficulty>0) setDifficulty((d)=>d-1); }
    setLog((l) => [...l, entry]);
  };

  const handleNext = () => {
    if (idx+1>=problems.length) { clearTimer(); setScreen("complete"); return; }
    setIdx((i)=>i+1); setSelected(null); setSubmitted(false);
  };

  const sessionSavedRef = useRef(false);
  useEffect(() => {
    if (screen==="complete"&&log.length>0&&!sessionSavedRef.current) {
      sessionSavedRef.current = true;
      const sessionPct = Math.round((log.filter(l=>l.ok).length / log.length) * 100);
      saveSession({ id:Date.now().toString(), date:new Date().toISOString(), subject:subject?.id||"math", subjectName:subject?.name||"Math", timeSpent:timeTotal>0?Math.min(timeUsed,timeTotal):timeUsed, timed:timeTotal>0, difficulty, total:log.length, correct:log.filter((l)=>l.ok).length, log:log.map(({topic,ok,question,selected,correct})=>({topic,ok,question,selected,correct})) }, subject?.id, currentUser?.username);
      updateStats(sessionPct, currentUser?.username).then(stats => {
        setHomeStats(stats);
        // Refresh weak spots count
        loadSessions(subject?.id, currentUser?.username).then(sessions => {
          const recent = sessions.slice(0, 10);
          const missed = new Set();
          recent.forEach(s => s.log?.forEach(l => { if (!l.ok) missed.add(l.question); }));
          setWeakSpotsCount(missed.size);
        });
      });
    }
    if (screen!=="complete") sessionSavedRef.current = false;
  }, [screen]);

  const handleViewInsights = async (currentLog) => {
    setInsightsLoading(true); setInsightsError(null); setScreen("insights");
    try { setInsights(await generateInsights(currentLog)); }
    catch(err) { setInsightsError(err.message||"Could not generate insights."); }
    finally { setInsightsLoading(false); }
  };

  const startMix = () => {
    if (topicBank.length < 2) { setError("Add at least 2 topics to use Mix mode."); return; }
    // Pick 2-3 random topics from bank
    const shuffled = [...topicBank].sort(() => Math.random() - 0.5);
    const pick = shuffled.slice(0, Math.min(3, topicBank.length));
    const mixTopic = { topicKey: "mix", topicName: "Mixed Topics", description: pick.map(t => t.topicName).join(", "), _isMix: true, mixTopics: pick };
    setHwTopic(mixTopic);
    setHwFile(null);
    setDifficulty(1);
    setScreen("confirm");
  };

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) { setLoginError("Please enter username and password."); return; }
    setLoginLoading(true); setLoginError("");
    try {
      let result;
      if (loginMode === "register") {
        if (loginPassword.length < 4) { setLoginError("Password must be at least 4 characters."); return; }
        result = await registerUser(loginUsername, loginPassword, loginDisplayName);
      } else {
        result = await loginUser(loginUsername, loginPassword);
      }
      if (!result.ok) {
        if (result.error === "PENDING_APPROVAL") { setScreen("pending"); return; }
        setLoginError(result.error); return;
      }
      if (result.pendingApproval) { setScreen("pending"); return; }
      setCurrentUser(result.user);
      setLoginUsername(""); setLoginPassword(""); setLoginDisplayName(""); setLoginError("");
      setScreen("subjects");
    } finally {
      setLoginLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    setAdminLoading(true);
    const { supabase } = await import("./lib/supabase.js");
    const { data } = await supabase.from("users").select("*").order("created_at", { ascending: false });
    setAdminUsers(data || []);
    setAdminLoading(false);
  };

  const handleApproveUser = async (username, approve) => {
    const { supabase } = await import("./lib/supabase.js");
    await supabase.from("users").update({ is_approved: approve }).eq("username", username);
    setAdminUsers(prev => prev.map(u => u.username === username ? { ...u, is_approved: approve } : u));
    setAdminMsg(approve ? `✅ ${username} approved` : `❌ ${username} revoked`);
    setTimeout(() => setAdminMsg(""), 3000);
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    const { supabase } = await import("./lib/supabase.js");
    await supabase.from("users").delete().eq("username", username);
    setAdminUsers(prev => prev.filter(u => u.username !== username));
    setAdminMsg(`🗑 ${username} deleted`);
    setTimeout(() => setAdminMsg(""), 3000);
  };

  const handleAdminAddUser = async () => {
    if (!adminNewUsername.trim() || !adminNewPassword.trim()) { setAdminMsg("Username and password required"); return; }
    const result = await registerUser(adminNewUsername, adminNewPassword, adminNewDisplay, adminNewIsAdmin);
    if (!result.ok) { setAdminMsg("❌ " + result.error); return; }
    // Auto-approve users added by admin
    const { supabase } = await import("./lib/supabase.js");
    await supabase.from("users").update({ is_approved: true }).eq("username", adminNewUsername.trim().toLowerCase());
    setAdminMsg(`✅ ${adminNewUsername} created and approved`);
    setAdminNewUsername(""); setAdminNewPassword(""); setAdminNewDisplay(""); setAdminNewIsAdmin(false);
    loadAdminUsers();
    setTimeout(() => setAdminMsg(""), 4000);
  };

  const handleTextTopicSubmit = () => {
    if (subject?.supportsBookInput) {
      if (!bookTitle.trim()) return;
      const topicName = bookTitle.trim();
      const author = bookAuthor.trim();
      const topic = {
        topicKey: topicName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40),
        topicName,
        description: author ? `By ${author}` : "Literature study",
        _isBook: true,
        bookTitle: topicName,
        bookAuthor: author,
      };
      setHwTopic(topic); setHwFile(null); setDifficulty(1);
      setShowTextInput(false); setBookTitle(""); setBookAuthor("");
      setScreen("confirm");
    } else if (subject?.supportsTextTopic) {
      if (!textTopicInput.trim()) return;
      const topicName = textTopicInput.trim();
      const topic = {
        topicKey: topicName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40),
        topicName,
        description: `${subject.name} study: ${topicName}`,
        _isTextTopic: true,
      };
      setHwTopic(topic); setHwFile(null); setDifficulty(1);
      setShowTextInput(false); setTextTopicInput("");
      setScreen("confirm");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSubject(null);
    setScreen("login");
    setTopicBank([]); setHomeStats(null); setSessions([]);
  };

  const handleOpenHistory = async () => {
    setHistoryLoading(true); setScreen("history"); setExpandedSession(null); setConfirmClear(false);
    setSessions(await loadSessions(subject?.id || undefined, currentUser?.username)); setHistoryLoading(false);
  };

  const handleWeakSpots = async () => {
    setError(null); setScreen("loading");
    try {
      const sessions = await loadSessions(subject?.id, currentUser?.username);
      const recent = sessions.slice(0, 10);
      // Collect all unique missed questions with their topic
      const seen = new Set();
      const missed = [];
      recent.forEach(s => s.log?.forEach(l => {
        if (!l.ok && !seen.has(l.question)) {
          seen.add(l.question);
          missed.push({ id: missed.length + 1, topic: l.topic, question: l.question,
            // We don't have the original options/correct stored, so generate fresh similar q
            _needsGeneration: true, _originalQuestion: l.question, _originalCorrect: l.correct });
        }
      }));
      if (missed.length === 0) { setError("No weak spots yet — complete a session first!"); setScreen("upload"); return; }
      // Shuffle and cap at 8
      const shuffled = missed.sort(() => Math.random() - 0.5).slice(0, 8);
      // Generate fresh versions of these specific questions via API
      const prompt = `You are a math tutor for a 6th grader with dyslexia.
The student previously got these questions WRONG. Generate 8 fresh practice problems targeting the SAME concepts — similar difficulty, different numbers.

Previously missed:
${shuffled.map((q,i) => `${i+1}. [${q.topic}] "${q._originalQuestion}" (correct was "${q._originalCorrect}")`).join("\n")}

Generate one fresh problem per missed question, in the same topic and concept.
${SCHEMA_INSTRUCTIONS}`;
      const res = await callAPI([{ role:"user", content: prompt }], 2500);
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = JSON.parse(text);
      const raw = data.content?.find(b => b.type==="text")?.text || "";
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No problem array returned");
      const probs = JSON.parse(match[0]);
      if (!probs.length) throw new Error("Empty problem list");
      setProblems(probs); setIdx(0); setScore(0); setStreak(0); setWrongStreak(0);
      setLog([]); setSelected(null); setSubmitted(false);
      setInsights(null); setInsightsError(null);
      startTimer(TIMER_OPTIONS[timerIdx].seconds);
      setScreen("problem");
    } catch(err) { setError(err.message||"Unknown error"); setScreen("upload"); }
  };

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    page: { minHeight:"100vh", background:"#070707", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 16px", fontFamily:"'Atkinson Hyperlegible', 'Lexend', sans-serif" },
    card: { background:"#0f0f0f", border:"1px solid #1f1f1f", borderRadius:14, padding:"36px 32px", maxWidth:560, width:"100%" },
    wideCard: { background:"#0f0f0f", border:"1px solid #1f1f1f", borderRadius:14, padding:"36px 32px", maxWidth:680, width:"100%" },
    logo: { fontSize:11, letterSpacing:6, color:"#333", textTransform:"uppercase", marginBottom:8 },
    h1: { fontSize:32, fontWeight:800, color:"#E8FF45", letterSpacing:-1, marginBottom:4 },
    sub: { fontSize:12, color:"#3a3a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:28 },
    sectionLabel: { fontSize:11, color:"#2f2f2f", letterSpacing:2, textTransform:"uppercase", marginBottom:10 },
    row: { display:"flex", gap:8, marginBottom:24 },
    segBtn: (active) => ({ flex:1, padding:"10px 8px", background:active?"#E8FF4510":"transparent", border:active?"1.5px solid #E8FF45":"1.5px solid #1f1f1f", borderRadius:7, color:active?"#E8FF45":"#333", fontSize:13, fontWeight:700, cursor:"pointer", letterSpacing:1, textTransform:"uppercase" }),
    dropzone: (over) => ({ border:over?"2px solid #E8FF4566":"2px dashed #1f1f1f", borderRadius:10, padding:"40px 20px", textAlign:"center", cursor:"pointer", background:over?"#E8FF450a":"transparent", transition:"all .2s", marginBottom:12 }),
    dropTitle: { fontSize:16, fontWeight:700, color:"#ccc", marginBottom:5 },
    dropSub: { fontSize:13, color:"#333" },
    divider: { textAlign:"center", color:"#1a1a1a", fontSize:13, margin:"10px 0" },
    ghostBtn: { width:"100%", padding:"13px", background:"transparent", border:"1.5px solid #1f1f1f", borderRadius:8, color:"#3a3a3a", fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:1, textTransform:"uppercase", marginBottom:0 },
    err: { background:"#1f0808", border:"1px solid #4a1414", borderRadius:7, padding:14, marginTop:14, color:"#f87171", fontSize:12, fontFamily:"monospace", wordBreak:"break-all", lineHeight:1.6 },
    timerBar: { background:"#141414", borderRadius:4, height:4, marginBottom:6, overflow:"hidden" },
    timerFill: (p,low) => ({ height:"100%", width:`${p}%`, background:low?NEG_COLOR:"#E8FF45", borderRadius:4, transition:"width 1s linear, background .5s" }),
    timerText: (low) => ({ fontSize:20, fontWeight:800, fontFamily:"monospace", color:low?NEG_COLOR:"#E8FF45", letterSpacing:2, textAlign:"right", marginBottom:12 }),
    topicMeta: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 },
    pill: (topic) => ({ display:"inline-block", padding:"4px 12px", background:topicColor(topic)+"18", border:`1px solid ${topicColor(topic)}33`, borderRadius:20, color:topicColor(topic)||"#888", fontSize:11, fontWeight:800, letterSpacing:2, textTransform:"uppercase" }),
    numMeta: { fontSize:12, color:"#2a2a2a", fontFamily:"monospace" },
    prog: { background:"#141414", borderRadius:4, height:3, marginBottom:18, overflow:"hidden" },
    progFill: (p) => ({ height:"100%", width:`${p}%`, background:"#2a2a2a", borderRadius:4, transition:"width .4s ease" }),
    statsRow: { display:"flex", gap:16, marginBottom:18, alignItems:"center" },
    scoreLabel: { fontSize:13, color:"#2f2f2f" },
    scoreVal: { color:"#E8FF45", fontWeight:800 },
    streakBadge: { fontSize:13, color:"#E8FF45", fontWeight:700 },
    diffBadge: { marginLeft:"auto", fontSize:10, color:"#1f1f1f", letterSpacing:2, textTransform:"uppercase", fontFamily:"monospace" },
    questionBox: { marginBottom:24, padding:"20px 0 4px" },
    gridWrap: { display:"flex", justifyContent:"center", marginBottom:18 },
    tipBox: { background:"#141000", border:"1px solid #3a3000", borderRadius:8, padding:"14px 16px", marginTop:12 },
    tipTitle: { fontSize:10, color:"#7a6a00", letterSpacing:3, textTransform:"uppercase", marginBottom:5, fontWeight:800 },
    tipText: { fontSize:15, color:"#ffd44d", lineHeight:1.75, fontWeight:600 },
    expl: { fontSize:13, color:"#6a5a00", marginTop:6, lineHeight:1.6 },
    correctBox: { background:"#0b1a0b", border:`1px solid ${POS_COLOR}44`, borderRadius:8, padding:14, marginTop:12, color:POS_COLOR, fontSize:15, fontWeight:700 },
    btnRow: { display:"flex", gap:10, marginTop:18 },
    primaryBtn: (dis) => ({ flex:1, padding:"16px", background:dis?"#141400":"#E8FF45", border:"none", borderRadius:8, color:dis?"#333300":"#000", fontSize:16, fontWeight:800, cursor:dis?"default":"pointer" }),
    accentBtn: { flex:1, padding:"16px", background:"transparent", border:`1.5px solid #E8FF45`, borderRadius:8, color:"#E8FF45", fontSize:16, fontWeight:800, cursor:"pointer" },
    bigScore: { fontSize:60, fontWeight:800, color:"#E8FF45", fontFamily:"monospace", marginBottom:4 },
    bigDenom: { fontSize:20, color:"#333", fontFamily:"monospace", marginBottom:6 },
    timeStat: { fontSize:12, color:"#2a2a2a", fontFamily:"monospace", marginBottom:20 },
    topicRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #141414" },
    topicCount: (ok,tot) => ({ fontFamily:"monospace", color:ok===tot?POS_COLOR:NEG_COLOR, fontSize:17, fontWeight:800 }),
    msg: { color:"#333", fontSize:14, lineHeight:1.9, marginBottom:24, marginTop:14 },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Lexend:wght@400;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070707; }
        button { font-family: 'Atkinson Hyperlegible', 'Lexend', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-red { 0%,100%{opacity:1} 50%{opacity:0.55} }
        @keyframes fade-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pop { 0%{transform:scale(1)} 40%{transform:scale(1.07)} 100%{transform:scale(1)} }
        .ghost-hover:hover { border-color: #2a2a2a !important; color: #555 !important; }
        .session-row:hover { background: #141414 !important; }
        input:focus { border-color: #E8FF4588 !important; }
        input::placeholder { color: #333; }
      `}</style>
      <div style={S.page}>

        {/* ── PENDING APPROVAL ── */}
        {screen === "pending" && (
          <div style={{ ...S.card, animation:"fade-in .3s ease", maxWidth:400, textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⏳</div>
            <div style={S.logo}>Study Hall</div>
            <div style={S.h1}>ALMOST THERE</div>
            <div style={{ fontSize:15, color:"#555", lineHeight:1.8, marginBottom:28, marginTop:8 }}>
              Your account has been created and is waiting for approval.<br/>
              An admin will activate your account shortly.
            </div>
            <button onClick={() => setScreen("login")} style={{ width:"100%", padding:"14px", background:"transparent", border:"1.5px solid #2a2a2a", borderRadius:8, color:"#444", fontSize:14, fontWeight:800, cursor:"pointer" }}>
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* ── LOGIN ── */}
        {screen === "login" && (
          <div style={{ ...S.card, animation:"fade-in .3s ease", maxWidth:400 }}>
            <div style={{ textAlign:"center", marginBottom:8 }}>
              <div style={{ fontSize:40, marginBottom:4 }}>🎓</div>
              <div style={S.logo}>Study Hall</div>
              <div style={S.h1}>SIGN IN</div>
            </div>

            {/* Mode toggle */}
            <div style={{ display:"flex", background:"#111", borderRadius:8, padding:3, marginBottom:24 }}>
              {["login","register"].map(mode => (
                <button key={mode} onClick={() => { setLoginMode(mode); setLoginError(""); }}
                  style={{ flex:1, padding:"9px", background:loginMode===mode?"#E8FF45":"transparent", border:"none", borderRadius:6, color:loginMode===mode?"#000":"#444", fontSize:12, fontWeight:800, cursor:"pointer", letterSpacing:1, textTransform:"uppercase", transition:"all .15s" }}>
                  {mode === "login" ? "Sign In" : "New Student"}
                </button>
              ))}
            </div>

            {loginMode === "register" && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:6, fontWeight:700 }}>DISPLAY NAME</div>
                <input value={loginDisplayName} onChange={e=>setLoginDisplayName(e.target.value)}
                  placeholder="e.g. Emma"
                  style={{ width:"100%", background:"#111", border:"1.5px solid #2a2a2a", borderRadius:8, padding:"12px 14px", color:"#fff", fontSize:15, fontFamily:"inherit", outline:"none" }}
                  onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
              </div>
            )}

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:6, fontWeight:700 }}>USERNAME</div>
              <input value={loginUsername} onChange={e=>setLoginUsername(e.target.value)}
                placeholder="your username"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                style={{ width:"100%", background:"#111", border:"1.5px solid #2a2a2a", borderRadius:8, padding:"12px 14px", color:"#fff", fontSize:15, fontFamily:"inherit", outline:"none" }}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:6, fontWeight:700 }}>PASSWORD</div>
              <input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)}
                placeholder="••••••"
                style={{ width:"100%", background:"#111", border:"1.5px solid #2a2a2a", borderRadius:8, padding:"12px 14px", color:"#fff", fontSize:15, fontFamily:"inherit", outline:"none" }}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
            </div>

            {loginError && <div style={{ background:"#1f0808", border:"1px solid #4a1414", borderRadius:7, padding:"10px 14px", marginBottom:14, color:"#f87171", fontSize:13 }}>{loginError}</div>}

            <button onClick={handleLogin} disabled={loginLoading}
              style={{ width:"100%", padding:"15px", background:loginLoading?"#333":"#E8FF45", border:"none", borderRadius:8, color:loginLoading?"#555":"#000", fontSize:16, fontWeight:800, cursor:loginLoading?"default":"pointer", marginBottom:10 }}>
              {loginLoading ? "…" : loginMode === "login" ? "Sign In →" : "Create Account →"}
            </button>

            <div style={{ textAlign:"center", fontSize:11, color:"#2a2a2a", marginTop:8 }}>
              Passwords are stored locally on this device
            </div>
          </div>
        )}

        {/* ── SUBJECTS ── */}
        {screen === "subjects" && (
          <div style={{ ...S.card, animation:"fade-in .3s ease" }}>
            {/* Header with user info */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <div>
                <div style={S.logo}>Study Hall</div>
                <div style={S.h1}>CHOOSE SUBJECT</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:"#E8FF45" }}>{currentUser?.displayName}</div>
                  {currentUser?.isAdmin && <span style={{ fontSize:9, background:"#E8FF4520", border:"1px solid #E8FF4544", borderRadius:4, padding:"2px 6px", color:"#E8FF45", fontWeight:800, letterSpacing:1 }}>ADMIN</span>}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {currentUser?.isAdmin && (
                    <button onClick={() => { setScreen("admin"); loadAdminUsers(); }}
                      style={{ background:"#E8FF4515", border:"1px solid #E8FF4444", borderRadius:6, color:"#E8FF45", fontSize:11, padding:"4px 10px", cursor:"pointer", letterSpacing:1, fontWeight:800 }}>
                      ⚙ ADMIN
                    </button>
                  )}
                  <button onClick={handleLogout} style={{ background:"transparent", border:"1px solid #2a2a2a", borderRadius:6, color:"#444", fontSize:11, padding:"4px 10px", cursor:"pointer", letterSpacing:1 }}>
                    LOG OUT
                  </button>
                </div>
              </div>
            </div>
            <div style={{ ...S.sub, marginBottom:20 }}>What are we practicing today?</div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:24 }}>
              {SUBJECTS.map(sub => (
                <button key={sub.id}
                  onClick={() => {
                    setSubject(sub);
                    setTopicBank([]);
                    setError(null);
                    setHwFile(null);
                    setHwTopic(null);
                    setShowTextInput(false);
                    setTextTopicInput("");
                    setBookTitle("");
                    setBookAuthor("");
                    setScreen("upload");
                  }}
                  style={{ background:sub.bg, border:`1.5px solid ${sub.border}`, borderRadius:12, padding:"18px 16px", cursor:"pointer", textAlign:"left", transition:"border-color .15s, transform .1s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=sub.accent+"88";e.currentTarget.style.transform="translateY(-1px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=sub.border;e.currentTarget.style.transform="none";}}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{sub.emoji}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:sub.accent, marginBottom:4 }}>{sub.name}</div>
                  <div style={{ fontSize:10, color:sub.accentDim, lineHeight:1.5 }}>{sub.tagline}</div>
                </button>
              ))}
            </div>

            <button className="ghost-hover" style={S.ghostBtn} onClick={handleOpenHistory}>
              View Session History →
            </button>
          </div>
        )}

        {/* ── ADMIN PANEL ── */}
        {screen === "admin" && (
          <div style={{ ...S.card, animation:"fade-in .3s ease" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              <button onClick={() => setScreen("subjects")} style={{ background:"transparent", border:"none", color:"#444", fontSize:18, cursor:"pointer", padding:"0 4px" }}>←</button>
              <div style={{ ...S.logo, marginBottom:0 }}>⚙ Admin Panel</div>
            </div>
            <div style={S.h1}>USER MANAGEMENT</div>

            {/* Tab bar */}
            <div style={{ display:"flex", background:"#111", borderRadius:8, padding:3, marginBottom:20 }}>
              {[["pending","⏳ Pending"],["all","👥 All Users"],["add","➕ Add User"]].map(([tab, label]) => (
                <button key={tab} onClick={() => setAdminTab(tab)}
                  style={{ flex:1, padding:"8px 4px", background:adminTab===tab?"#E8FF45":"transparent", border:"none", borderRadius:6, color:adminTab===tab?"#000":"#444", fontSize:11, fontWeight:800, cursor:"pointer", letterSpacing:1, transition:"all .15s" }}>
                  {label}
                </button>
              ))}
            </div>

            {adminMsg && <div style={{ background:"#0f1400", border:"1px solid #2a3000", borderRadius:7, padding:"10px 14px", marginBottom:14, color:"#E8FF45", fontSize:13, textAlign:"center" }}>{adminMsg}</div>}

            {adminLoading && <div style={{ textAlign:"center", padding:24, color:"#444" }}>Loading…</div>}

            {/* Pending tab */}
            {adminTab === "pending" && !adminLoading && (
              <div>
                {adminUsers.filter(u => !u.is_approved && !u.is_admin).length === 0
                  ? <div style={{ textAlign:"center", padding:24, color:"#333", fontSize:14 }}>No pending users 🎉</div>
                  : adminUsers.filter(u => !u.is_approved && !u.is_admin).map(u => (
                    <div key={u.username} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderBottom:"1px solid #141414" }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>{u.display_name}</div>
                        <div style={{ fontSize:11, color:"#444", fontFamily:"monospace" }}>@{u.username}</div>
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => handleApproveUser(u.username, true)}
                          style={{ background:"#0b1f0b", border:"1px solid #4ade8044", borderRadius:6, color:"#4ade80", fontSize:12, padding:"6px 12px", cursor:"pointer", fontWeight:800 }}>✓ Approve</button>
                        <button onClick={() => handleDeleteUser(u.username)}
                          style={{ background:"#1f0b0b", border:"1px solid #ff6b6b44", borderRadius:6, color:"#ff6b6b", fontSize:12, padding:"6px 12px", cursor:"pointer", fontWeight:800 }}>✗ Delete</button>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* All users tab */}
            {adminTab === "all" && !adminLoading && (
              <div>
                {adminUsers.map(u => (
                  <div key={u.username} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderBottom:"1px solid #141414" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>{u.display_name}</div>
                        {u.is_admin && <span style={{ fontSize:9, background:"#E8FF4520", border:"1px solid #E8FF4444", borderRadius:4, padding:"2px 6px", color:"#E8FF45", fontWeight:800 }}>ADMIN</span>}
                        {!u.is_approved && !u.is_admin && <span style={{ fontSize:9, background:"#ff6b6b20", border:"1px solid #ff6b6b44", borderRadius:4, padding:"2px 6px", color:"#ff6b6b", fontWeight:800 }}>PENDING</span>}
                      </div>
                      <div style={{ fontSize:11, color:"#444", fontFamily:"monospace" }}>@{u.username}</div>
                    </div>
                    {!u.is_admin && (
                      <div style={{ display:"flex", gap:8 }}>
                        {!u.is_approved
                          ? <button onClick={() => handleApproveUser(u.username, true)} style={{ background:"#0b1f0b", border:"1px solid #4ade8044", borderRadius:6, color:"#4ade80", fontSize:11, padding:"5px 10px", cursor:"pointer", fontWeight:800 }}>Approve</button>
                          : <button onClick={() => handleApproveUser(u.username, false)} style={{ background:"#1a1400", border:"1px solid #E8FF4433", borderRadius:6, color:"#E8FF45", fontSize:11, padding:"5px 10px", cursor:"pointer", fontWeight:800 }}>Revoke</button>
                        }
                        <button onClick={() => handleDeleteUser(u.username)} style={{ background:"#1f0b0b", border:"1px solid #ff6b6b44", borderRadius:6, color:"#ff6b6b", fontSize:11, padding:"5px 10px", cursor:"pointer", fontWeight:800 }}>Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add user tab */}
            {adminTab === "add" && (
              <div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:5, fontWeight:700 }}>DISPLAY NAME</div>
                  <input value={adminNewDisplay} onChange={e=>setAdminNewDisplay(e.target.value)} placeholder="e.g. Emma"
                    style={{ width:"100%", background:"#111", border:"1.5px solid #2a2a2a", borderRadius:8, padding:"10px 14px", color:"#fff", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:5, fontWeight:700 }}>USERNAME</div>
                  <input value={adminNewUsername} onChange={e=>setAdminNewUsername(e.target.value)} placeholder="username" autoCapitalize="none"
                    style={{ width:"100%", background:"#111", border:"1.5px solid #2a2a2a", borderRadius:8, padding:"10px 14px", color:"#fff", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:5, fontWeight:700 }}>PASSWORD</div>
                  <input value={adminNewPassword} onChange={e=>setAdminNewPassword(e.target.value)} placeholder="••••••"
                    style={{ width:"100%", background:"#111", border:"1.5px solid #2a2a2a", borderRadius:8, padding:"10px 14px", color:"#fff", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
                  <input type="checkbox" checked={adminNewIsAdmin} onChange={e=>setAdminNewIsAdmin(e.target.checked)} id="isAdminChk" style={{ width:16, height:16, cursor:"pointer" }} />
                  <label htmlFor="isAdminChk" style={{ fontSize:13, color:"#666", cursor:"pointer" }}>Make this user an admin</label>
                </div>
                <button onClick={handleAdminAddUser}
                  style={{ width:"100%", padding:"14px", background:"#E8FF45", border:"none", borderRadius:8, color:"#000", fontSize:15, fontWeight:800, cursor:"pointer" }}>
                  Create & Approve User →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── UPLOAD ── */}
        {screen === "upload" && (
          <div style={S.card}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              <button onClick={() => setScreen("subjects")} style={{ background:"transparent", border:"none", color:"#444", fontSize:18, cursor:"pointer", padding:"0 4px", lineHeight:1 }}>←</button>
              <div style={{ ...S.logo, marginBottom:0 }}>{subject?.emoji} {subject?.name || "Practice"}</div>
            </div>
            <div style={S.h1}>{(subject?.name || "MATH").toUpperCase()} TUTOR</div>

            {/* ── Topic grid: General, Mix, then all saved topics ── */}
            <div style={{ marginBottom:16 }}>
              <div style={S.sectionLabel}>Topics</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>

                {/* General */}
                <button onClick={() => { setHwTopic({ _isGeneral:true, topicName:"General Practice", description:subject?.generalLabel||"Mixed topics" }); setHwFile(null); setDifficulty(1); setScreen("confirm"); }}
                  style={{ background:"#0f0f0f", border:`1.5px solid ${subject?.border||"#2a2a2a"}`, borderRadius:10, padding:"14px", cursor:"pointer", textAlign:"left", transition:"border-color .15s, background .15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=subject?.accent+"66"||"#E8FF4566";e.currentTarget.style.background=subject?.bg||"#111";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=subject?.border||"#2a2a2a";e.currentTarget.style.background="#0f0f0f";}}>
                  <div style={{ fontSize:18, marginBottom:5 }}>{subject?.emoji||"📐"}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:subject?.accent||"#E8FF45", lineHeight:1.2 }}>General</div>
                  <div style={{ fontSize:10, color:"#3a3a3a", marginTop:3, lineHeight:1.4 }}>{subject?.generalLabel||"Mixed topics"}</div>
                </button>

                {/* Mix */}
                {topicBank.length >= 2
                  ? <button onClick={startMix}
                      style={{ background:"#0a0010", border:"1.5px solid #c084fc33", borderRadius:10, padding:"14px", cursor:"pointer", textAlign:"left", transition:"border-color .15s, background .15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="#c084fc88";e.currentTarget.style.background="#c084fc0a";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="#c084fc33";e.currentTarget.style.background="#0a0010";}}>
                      <div style={{ fontSize:18, marginBottom:5 }}>🔀</div>
                      <div style={{ fontSize:13, fontWeight:800, color:"#c084fc", lineHeight:1.2 }}>Mix</div>
                      <div style={{ fontSize:10, color:"#3a2a4a", marginTop:3, lineHeight:1.4 }}>Blend {Math.min(3,topicBank.length)} random topics</div>
                    </button>
                  : <div style={{ background:"#0a0a0a", border:"1.5px dashed #1a1a1a", borderRadius:10, padding:"14px", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", gap:4 }}>
                      <div style={{ fontSize:18, opacity:0.3 }}>🔀</div>
                      <div style={{ fontSize:11, color:"#2a2a2a", textAlign:"center", lineHeight:1.4 }}>Mix unlocks with 2+ topics</div>
                    </div>
                }

                {/* All saved topics — flowing grid, same size as General/Mix */}
                {topicBank.map(t => {
                  const color = topicColor(t.topicKey);
                  return (
                    <button key={t.topicKey}
                      onClick={() => { setHwTopic(t); setHwFile(null); setDifficulty(1); setScreen("confirm"); }}
                      style={{ background:"#0f0f0f", border:`1.5px solid ${color}33`, borderRadius:10, padding:"14px", cursor:"pointer", textAlign:"left", transition:"border-color .15s, background .15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=color+"88";e.currentTarget.style.background=color+"0a";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=color+"33";e.currentTarget.style.background="#0f0f0f";}}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
                        <div style={{ fontSize:18 }}>📚</div>
                        <div style={{ fontSize:9, color:color+"66", fontFamily:"monospace" }}>×{t.sessionCount}</div>
                      </div>
                      <div style={{ fontSize:13, fontWeight:800, color, lineHeight:1.2 }}>{t.topicName}</div>
                      <div style={{ fontSize:10, color:"#3a3a3a", marginTop:3, lineHeight:1.4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{t.description}</div>
                    </button>
                  );
                })}

              </div>
            </div>

            {/* ── Add New Topic — upload or text input ── */}
            <div style={{ marginBottom:16 }}>

              {/* Upload button — always shown */}
              <button
                onClick={() => fileRef.current.click()}
                onDragOver={(e)=>{e.preventDefault();setDragging(true);}}
                onDragLeave={()=>setDragging(false)}
                onDrop={(e)=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
                style={{ width:"100%", marginBottom:8, background:dragging?"#E8FF450a":"transparent", border:`2px dashed ${dragging?"#E8FF45":"#2a2a2a"}`, borderRadius:12, padding:"18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:14, transition:"all .15s" }}>
                <div style={{ fontSize:24, color:dragging?"#E8FF45":"#2a2a2a", lineHeight:1 }}>+</div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:13, fontWeight:800, color:dragging?"#E8FF45":"#2a2a2a", letterSpacing:1 }}>UPLOAD HOMEWORK</div>
                  <div style={{ fontSize:11, color:dragging?"#E8FF4488":"#222", marginTop:2 }}>JPG, PNG, PDF, HEIC</div>
                </div>
              </button>

              {/* Book input — English only */}
              {subject?.supportsBookInput && (
                <div style={{ border:"1.5px solid #2a1a50", borderRadius:12, overflow:"hidden" }}>
                  <button onClick={() => setShowTextInput(v=>!v)}
                    style={{ width:"100%", background:"#0d0820", border:"none", padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"background .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#150d30"}
                    onMouseLeave={e=>e.currentTarget.style.background="#0d0820"}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:16 }}>📖</span>
                      <div style={{ textAlign:"left" }}>
                        <div style={{ fontSize:13, fontWeight:800, color:"#a78bfa", letterSpacing:1 }}>ADD A BOOK</div>
                        <div style={{ fontSize:10, color:"#2a1a50", marginTop:1 }}>Enter title & author to study</div>
                      </div>
                    </div>
                    <span style={{ color:"#444", fontSize:12, transform:showTextInput?"rotate(180deg)":"none", transition:"transform .2s" }}>▼</span>
                  </button>
                  {showTextInput && (
                    <div style={{ background:"#0a0515", padding:"14px 16px", borderTop:"1px solid #1a0a30", animation:"fade-in .15s ease" }}>
                      <input value={bookTitle} onChange={e=>setBookTitle(e.target.value)}
                        placeholder="Book title (e.g. The Hobbit)"
                        style={{ width:"100%", background:"#111", border:"1.5px solid #2a1a50", borderRadius:8, padding:"10px 12px", color:"#fff", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:8, boxSizing:"border-box" }}
                        onKeyDown={e=>e.key==="Enter"&&handleTextTopicSubmit()} />
                      <input value={bookAuthor} onChange={e=>setBookAuthor(e.target.value)}
                        placeholder="Author (optional)"
                        style={{ width:"100%", background:"#111", border:"1.5px solid #2a1a50", borderRadius:8, padding:"10px 12px", color:"#fff", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:10, boxSizing:"border-box" }}
                        onKeyDown={e=>e.key==="Enter"&&handleTextTopicSubmit()} />
                      <button onClick={handleTextTopicSubmit} disabled={!bookTitle.trim()}
                        style={{ width:"100%", padding:"10px", background:bookTitle.trim()?"#a78bfa":"#1a0a30", border:"none", borderRadius:8, color:bookTitle.trim()?"#000":"#333", fontSize:13, fontWeight:800, cursor:bookTitle.trim()?"pointer":"default" }}>
                        Study This Book →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Theme input — Science, Social Studies, Religion */}
              {subject?.supportsTextTopic && (
                <div style={{ border:`1.5px solid ${subject.border}`, borderRadius:12, overflow:"hidden", marginTop:8 }}>
                  <button onClick={() => setShowTextInput(v=>!v)}
                    style={{ width:"100%", background:subject.bg, border:"none", padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"background .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
                    onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:16 }}>✏️</span>
                      <div style={{ textAlign:"left" }}>
                        <div style={{ fontSize:13, fontWeight:800, color:subject.accent, letterSpacing:1 }}>ENTER A THEME</div>
                        <div style={{ fontSize:10, color:subject.accentDim, marginTop:1 }}>e.g. "Roman History" or "Clouds"</div>
                      </div>
                    </div>
                    <span style={{ color:"#444", fontSize:12, transform:showTextInput?"rotate(180deg)":"none", transition:"transform .2s" }}>▼</span>
                  </button>
                  {showTextInput && (
                    <div style={{ background:"#0a0a0a", padding:"14px 16px", borderTop:`1px solid ${subject.border}`, animation:"fade-in .15s ease" }}>
                      <input value={textTopicInput} onChange={e=>setTextTopicInput(e.target.value)}
                        placeholder={`e.g. "${subject.id === "religion" ? "The Seven Sacraments" : subject.id === "social_studies" ? "Ancient Rome" : "Photosynthesis"}"`}
                        style={{ width:"100%", background:"#111", border:`1.5px solid ${subject.border}`, borderRadius:8, padding:"10px 12px", color:"#fff", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:10, boxSizing:"border-box" }}
                        onKeyDown={e=>e.key==="Enter"&&handleTextTopicSubmit()} />
                      <button onClick={handleTextTopicSubmit} disabled={!textTopicInput.trim()}
                        style={{ width:"100%", padding:"10px", background:textTopicInput.trim()?subject.accent:"#1a1a1a", border:"none", borderRadius:8, color:textTopicInput.trim()?"#000":"#333", fontSize:13, fontWeight:800, cursor:textTopicInput.trim()?"pointer":"default" }}>
                        Study This Theme →
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>

            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,.pdf" style={{ display:"none" }}
              onChange={(e)=>{if(e.target.files[0])handleFile(e.target.files[0]);}} />

            <div style={{ borderTop:"1px solid #141414", paddingTop:14, display:"flex", flexDirection:"column", gap:8 }}>
              {weakSpotsCount > 0 && (
                <button className="ghost-hover" style={{ ...S.ghostBtn, borderColor:"#3a1a00", color:"#7a3a00" }}
                  onClick={handleWeakSpots}>
                  🎯 Review Weak Spots ({weakSpotsCount} question{weakSpotsCount!==1?"s":""})
                </button>
              )}
              <button className="ghost-hover" style={S.ghostBtn} onClick={handleOpenHistory}>View Session History →</button>
            </div>
            {error && error !== "HEIC_CONVERTING" && error !== "HEIC_FAILED" && <div style={S.err}>{error}</div>}
            {error === "HEIC_CONVERTING" && (
              <div style={{ background:"#0a0f00", border:"1px solid #3a5a00", borderRadius:8, padding:"12px 16px", marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18, display:"inline-block", animation:"spin 1s linear infinite" }}>⚙</span>
                <span style={{ fontSize:13, color:"#a0c040", fontWeight:700 }}>Converting iPhone photo…</span>
              </div>
            )}
            {error === "HEIC_FAILED" && (
              <div style={{ background:"#0f0a00", border:"1px solid #5a3a00", borderRadius:8, padding:"14px 16px", marginTop:12 }}>
                <div style={{ fontSize:13, fontWeight:800, color:"#ffd44d", marginBottom:8 }}>📱 Couldn't convert HEIC automatically</div>
                <div style={{ fontSize:13, color:"#9a8a00", lineHeight:1.9 }}>
                  <div>• Take a <strong style={{color:"#ffd44d"}}>screenshot</strong> of the homework instead</div>
                  <div>• Or email it — Gmail/iCloud convert to JPG automatically</div>
                  <div>• Or: iPhone Settings → Camera → Formats → <strong style={{color:"#ffd44d"}}>Most Compatible</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONFIRM (homework topic detected) ── */}
        {screen === "confirm" && (
          <div style={{ ...S.card, animation:"fade-in .3s ease" }}>
            <div style={S.logo}>{hwTopic?._isGeneral ? "Ready to Practice" : hwTopic?._isMix ? "Mix Session" : hwTopic?._isBook ? "Book Study" : hwTopic?._isTextTopic ? "Custom Topic" : "Homework Uploaded"}</div>

            {hwDetecting ? (
              <div style={{ textAlign:"center", padding:"32px 0" }}>
                <div style={{ fontSize:34, display:"inline-block", animation:"spin 1.2s linear infinite", marginBottom:14 }}>⚙</div>
                <div style={{ fontSize:15, color:"#555" }}>Reading your homework…</div>
              </div>
            ) : (
              <>
                {/* Topic / mode banner */}
                {(() => {
                  const isGeneral = hwTopic?._isGeneral;
                  const isMix = hwTopic?._isMix;
                  const isBook = hwTopic?._isBook;
                  const isTextTopic = hwTopic?._isTextTopic;
                  const accent = subject?.accent || "#E8FF45";
                  const accentDim = subject?.accentDim || "#3a4a00";
                  const bg = subject?.bg || "#0d1800";
                  const border = accent + "30";
                  const modeLabel = isGeneral ? "General Practice" : isMix ? "Mixed Topics" : isBook ? "Book Study" : isTextTopic ? "Custom Topic" : "Topic Detected";
                  const modeTitle = isGeneral ? (subject?.name || "General") : isMix ? "🔀 Mix" : hwTopic?.topicName || "Homework";
                  const modeDesc = isGeneral ? subject?.generalLabel : isMix ? hwTopic.mixTopics?.map(t=>t.topicName).join(", ") : isBook ? (hwTopic.bookAuthor ? `by ${hwTopic.bookAuthor}` : "Literature study") : hwTopic?.description;
                  return (
                    <div style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:12, padding:"20px 22px", marginBottom:24 }}>
                      <div style={{ fontSize:11, color:accentDim, letterSpacing:3, textTransform:"uppercase", marginBottom:8, fontWeight:800 }}>
                        {modeLabel}
                      </div>
                      <div style={{ fontSize:24, fontWeight:800, color:accent, marginBottom:6, lineHeight:1.3 }}>
                        {modeTitle}
                      </div>
                      <div style={{ fontSize:13, color:accentDim, lineHeight:1.6 }}>
                        {modeDesc}
                      </div>
                    </div>
                  );
                })()}

                {/* Difficulty */}
                <div style={S.sectionLabel}>Difficulty</div>
                <div style={{ ...S.row, marginBottom:24 }}>
                  {(hwTopic?._isGeneral
                    ? [{ label:"Starter", sub:"Simple, single-step" }, { label:"Building", sub:"Standard level" }, { label:"Challenging", sub:"Multi-step, harder" }]
                    : [{ label:"Starter", sub:"15–20% easier" }, { label:"Building", sub:"Matches homework" }, { label:"Challenging", sub:"30–50% harder" }]
                  ).map((d, i) => (
                    <button key={i}
                      style={{ ...S.segBtn(difficulty===i), display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"10px 6px" }}
                      onClick={() => setDifficulty(i)}>
                      <span>{d.label}</span>
                      <span style={{ fontSize:9, opacity:0.6, textTransform:"none", letterSpacing:0, fontWeight:400 }}>{d.sub}</span>
                    </button>
                  ))}
                </div>

                {/* Session length */}
                <div style={S.sectionLabel}>Session Length</div>
                <div style={{ ...S.row, marginBottom:28 }}>
                  {TIMER_OPTIONS.map((t,i) => <button key={i} style={S.segBtn(timerIdx===i)} onClick={()=>setTimerIdx(i)}>{t.label}</button>)}
                </div>

                <div style={S.btnRow}>
                  <button style={S.primaryBtn(false)}
                    onClick={() => {
                      if (hwTopic?._isGeneral || hwTopic?._isMix) {
                        // General / Mix: no topic to save, just start
                        startSession(null, null, hwTopic?._isMix ? hwTopic : null);
                      } else if (hwTopic?._isBook || hwTopic?._isTextTopic) {
                        // Book/text topic: save to bank, no image needed
                        saveTopicToBank(hwTopic, subject?.id, currentUser?.username);
                        startSession(null, null, hwTopic);
                      } else {
                        // Homework upload topic: save to bank then start with image
                        saveTopicToBank(hwTopic, subject?.id, currentUser?.username);
                        startSession(hwFile?.base64 || null, hwFile?.mediaType || null, hwTopic);
                      }
                    }}>
                    Let's Practice →
                  </button>
                  <button className="ghost-hover"
                    style={{ ...S.primaryBtn(false), background:"transparent", border:"1.5px solid #1f1f1f", color:"#444" }}
                    onClick={() => { setScreen("upload"); setHwFile(null); setHwTopic(null); }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── LOADING ── */}
        {screen === "loading" && (
          <div style={{ ...S.card, textAlign:"center" }}>
            <div style={{ fontSize:38, display:"inline-block", animation:"spin 1.2s linear infinite", marginBottom:18 }}>⚙</div>
            <div style={{ fontSize:20, fontWeight:800, color:"#E8FF45", marginBottom:8 }}>Building your session…</div>
            <div style={{ fontSize:13, color:"#333", letterSpacing:1 }}>Generating problems</div>
          </div>
        )}

        {/* ── PROBLEM ── */}
        {screen === "problem" && prob && (
          <div style={S.card}>
            {timeTotal > 0 && (<>
              <div style={S.timerBar}><div style={S.timerFill(timerPct, isLowTime)} /></div>
              <div style={{ ...S.timerText(isLowTime), animation:isLowTime?"pulse-red 1s ease-in-out infinite":"none" }}>{fmt(timeLeft)}</div>
            </>)}

            <ReferenceCard open={refCardOpen} onClose={() => setRefCardOpen(false)} />
            <div style={S.topicMeta}>
              <span style={S.pill(prob.topic)}>{topicLabel(prob.topic)}</span>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <button onClick={() => setRefCardOpen(true)}
                  style={{ background:"transparent", border:"1px solid #1e1e1e", borderRadius:6, color:"#333", fontSize:11, padding:"4px 10px", cursor:"pointer", letterSpacing:1, fontWeight:700 }}>
                  📖 HELP
                </button>
                <span style={S.numMeta}>{idx+1} / {problems.length}</span>
              </div>
            </div>
            <div style={S.prog}><div style={S.progFill((idx/problems.length)*100)} /></div>

            <div style={S.statsRow}>
              <span style={S.scoreLabel}>Score: <span style={S.scoreVal}>{score}</span></span>
              {streak>=2 && <span style={S.streakBadge}>🔥 {streak}</span>}
              <span style={S.diffBadge}>{DIFFICULTY_LABELS[difficulty]}</span>
            </div>

            {/* QUESTION — prose instruction + optional equation on its own line */}
            <div style={S.questionBox}>
              <div style={{ fontSize:18, fontWeight:700, color:"#aaa", lineHeight:1.6, marginBottom: prob.equation ? 16 : 0 }}>
                {prob.question}
              </div>
              {prob.equation && (
                <div style={{ background:"#0a0a0a", border:"1px solid #222", borderRadius:10, padding:"16px 20px", display:"inline-block", minWidth:"60%" }}>
                  <ColorizedMath text={prob.equation} size={28} weight={800} />
                </div>
              )}
              {!prob.equation && (
                <div style={{ marginTop:8 }}>
                  <ColorizedMath text={prob.question} size={26} weight={800} />
                </div>
              )}
            </div>

            {/* Number line for pos/neg — math only */}
            {subject?.hasMathVisuals && prob.topic?.includes("positive_negative") && prob.numberLineData && (
              <NumberLine nld={prob.numberLineData} submitted={submitted} isCorrect={isCorrect} />
            )}

            {/* Step reveal for PEMDAS — math only */}
            {subject?.hasMathVisuals && (prob.topic?.includes("order_of_operations") || prob.topic?.includes("pemdas")) && prob.steps && (
              <StepReveal steps={prob.steps} submitted={submitted} />
            )}

            {/* Coord grid for graphing — math only */}
            {subject?.hasMathVisuals && prob.topic?.toLowerCase().includes("graph") && (prob.graphPoints || prob.graphPoint) && (
              <div style={S.gridWrap}>
                <CoordGrid
                  point={prob.graphPoints ? null : prob.graphPoint}
                  graphPoints={prob.graphPoints || null}
                  submitted={submitted}
                  correct={isCorrect}
                />
              </div>
            )}

            {/* Options — with progressive reveal */}
            {showOptions && prob.options?.map((opt, i) => (
              <OptionTile key={i} opt={opt} selected={selected} submitted={submitted}
                correct={prob.correct} onClick={setSelected} />
            ))}

            {/* Feedback */}
            {submitted && isCorrect && (
              <div style={{ ...S.correctBox, animation:"pop .3s ease" }}>
                ✓ Correct!
                {prob.topic === "positive_negative" && <span style={{ fontSize:13, color:POS_COLOR+"99", marginLeft:8 }}>Watch the number line ↑</span>}
              </div>
            )}
            {submitted && !isCorrect && (
              <div>
                {/* Challenging: no hint at all */}
                {difficulty === 2 && (
                  <div style={{ background:"#120808", border:`1px solid ${NEG_COLOR}33`, borderRadius:8, padding:"12px 16px", marginTop:12, color:NEG_COLOR+"88", fontSize:13, fontWeight:700 }}>
                    ✗ Not quite. Keep thinking — hints are off in Challenging mode.
                  </div>
                )}
                {/* Starter / Building: show hint button then reveal */}
                {difficulty < 2 && (
                  <div style={{ marginTop:12 }}>
                    {!showHint && (
                      <button
                        onClick={() => setShowHint(true)}
                        style={{ width:"100%", padding:"11px", background:"#141000", border:"1px solid #3a3000", borderRadius:8, color:"#7a6a00", fontSize:13, fontWeight:700, cursor:"pointer", letterSpacing:1 }}>
                        💡 Show Hint
                      </button>
                    )}
                    {showHint && (
                      <div style={{ ...S.tipBox, animation:"fade-in .2s ease" }}>
                        <div style={S.tipTitle}>💡 Tip</div>
                        <div style={S.tipText}><ColorizedMath text={prob.tip} size={15} weight={600} /></div>
                        <div style={S.expl}>{prob.explanation}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={S.btnRow}>
              {!submitted
                ? <button style={S.primaryBtn(!selected)} onClick={handleSubmit} disabled={!selected}>Check Answer</button>
                : <button style={S.primaryBtn(false)} onClick={handleNext}>{idx+1>=problems.length?"See Results →":"Next →"}</button>}
            </div>
          </div>
        )}

        {/* ── COMPLETE ── */}
        {screen === "complete" && (
          <div style={S.card}>
            <div style={S.logo}>Session Complete</div>
            <div style={S.h1}>RESULTS</div>
            <div style={S.bigScore}>{score}</div>
            <div style={S.bigDenom}>out of {log.length}</div>
            {timeTotal>0
              ? <div style={S.timeStat}>⏱ {fmt(Math.min(timeUsed,timeTotal))} of {fmt(timeTotal)}</div>
              : timeUsed>0 ? <div style={S.timeStat}>⏱ {fmt(timeUsed)} elapsed</div> : null}
            {[...new Set(log.map(l=>l.topic))].map((topic) => {
              const rows = log.filter((l)=>l.topic===topic);
              const ok = rows.filter((r)=>r.ok).length;
              return (<div key={topic} style={S.topicRow}><span style={S.pill(topic)}>{topicLabel(topic)}</span><span style={S.topicCount(ok,rows.length)}>{ok} / {rows.length}</span></div>);
            })}
            <div style={S.msg}>
              {score===log.length?"Perfect score! Outstanding work. 🏆"
                :score>=log.length*.75?"Really solid. A couple of things to tighten up."
                :score>=log.length*.5?"Good effort — check the tips below."
                :"Every session builds the skill. Keep going!"}
            </div>
            <div style={S.btnRow}>
              {log.some((l)=>!l.ok) && <button style={S.accentBtn} onClick={()=>handleViewInsights(log)}>Learning Opportunities →</button>}
              <button style={S.primaryBtn(false)} onClick={()=>startSession(null,null)}>Go Again</button>
            </div>
            <div style={{ marginTop:10 }}>
              <button className="ghost-hover" style={S.ghostBtn} onClick={()=>{clearTimer();setScreen("subjects");}}>Home</button>
            </div>
          </div>
        )}

        {/* ── INSIGHTS ── */}
        {screen === "insights" && (
          <div style={{ ...S.card, maxWidth:600 }}>
            <div style={S.logo}>After Session</div>
            <div style={S.h1}>LEARNING OPS</div>
            <div style={{ fontSize:12, color:"#3a3a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:24 }}>Tricks · Mnemonics · Anchors</div>
            {insightsLoading && (<div style={{ textAlign:"center", padding:"40px 0" }}><div style={{ fontSize:34, display:"inline-block", animation:"spin 1.2s linear infinite", marginBottom:14 }}>⚙</div><div style={{ fontSize:14, color:"#333" }}>Analysing your session…</div></div>)}
            {insightsError && <div style={S.err}>{insightsError}</div>}
            {!insightsLoading&&insights&&insights.length>0&&(<div style={{ animation:"fade-in .4s ease" }}>{insights.map((ins,i)=><InsightCard key={i} insight={ins}/>)}</div>)}
            {!insightsLoading&&insights&&insights.length===0&&(<div style={{ color:POS_COLOR, fontSize:18, fontWeight:700, textAlign:"center", padding:"32px 0" }}>🏆 Perfect session — no weak spots!</div>)}
            <div style={{ ...S.btnRow, marginTop:24 }}>
              <button style={S.primaryBtn(false)} onClick={()=>startSession(null,null)}>Practice Again</button>
              <button className="ghost-hover" style={{ ...S.primaryBtn(false), background:"transparent", border:"1.5px solid #1f1f1f", color:"#444" }} onClick={()=>{clearTimer();setScreen("subjects");}}>Home</button>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {screen === "history" && (
          <div style={{ ...S.wideCard, animation:"fade-in .3s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
              <div><div style={S.logo}>Progress Log</div><div style={S.h1}>HISTORY</div></div>
              <button style={{ background:"transparent", border:"none", color:"#333", fontSize:22, cursor:"pointer", paddingTop:4 }} onClick={()=>setScreen("subjects")}>✕</button>
            </div>
            <div style={{ fontSize:12, color:"#3a3a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:28 }}>{sessions.length} session{sessions.length!==1?"s":""} recorded</div>
            {historyLoading && <div style={{ textAlign:"center", padding:"40px 0", color:"#333" }}>Loading…</div>}
            {!historyLoading && sessions.length===0 && (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <div style={{ fontSize:30, marginBottom:10 }}>📊</div>
                <div style={{ color:"#333", fontSize:14 }}>No sessions yet. Complete a session to see your history.</div>
              </div>
            )}
            {!historyLoading && sessions.length>0 && (() => {
              const trends = computeTrends(sessions);
              return (<>
                <div style={{ marginBottom:28 }}>
                  <div style={S.sectionLabel}>Thematic Trends</div>
                  {trends.map(({topic,status,avg,trend}) => status==="no-data"?null:(
                    <div key={topic} style={{ background:"#0c0c0c", border:`1px solid ${topicColor(topic)}18`, borderRadius:10, padding:"14px 16px", marginBottom:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                        <span style={S.pill(topic)}>{topicLabel(topic)}</span>
                        <TrendBadge trend={trend}/>
                        <span style={{ marginLeft:"auto", fontFamily:"monospace", fontSize:12, color:"#3a3a3a" }}>avg {avg}%</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <MiniBar value={avg}/>
                        <span style={{ fontFamily:"monospace", fontSize:11, color:avg>=70?POS_COLOR:avg>=40?"#E8FF45":NEG_COLOR, minWidth:34, textAlign:"right" }}>{avg}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={S.sectionLabel}>All Sessions</div>
                {sessions.map((s) => {
                  const isEx = expandedSession===s.id;
                  const sp = pct(s.correct, s.total);
                  return (
                    <div key={s.id}>
                      <div className="session-row" style={{ background:"#0c0c0c", borderRadius:isEx?"10px 10px 0 0":10, border:"1px solid #1a1a1a", padding:"12px 16px", marginBottom:isEx?0:6, cursor:"pointer", transition:"background .15s" }}
                        onClick={()=>setExpandedSession(isEx?null:s.id)}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                          <span style={{ fontFamily:"monospace", fontSize:11, color:"#333", minWidth:155 }}>{fmtDate(s.date)}</span>
                          <span style={{ fontFamily:"monospace", fontSize:14, fontWeight:800, color:sp>=70?POS_COLOR:sp>=40?"#E8FF45":NEG_COLOR }}>{s.correct}/{s.total}</span>
                          {s.timeSpent>0&&<span style={{ fontSize:11, color:"#2a2a2a", fontFamily:"monospace" }}>⏱ {fmt(s.timeSpent)}</span>}
                          <span style={{ fontSize:10, color:"#2a2a2a", letterSpacing:1, textTransform:"uppercase" }}>{DIFFICULTY_LABELS[s.difficulty]}</span>
                          <span style={{ marginLeft:"auto", fontSize:12, color:"#2a2a2a" }}>{isEx?"▲":"▼"}</span>
                        </div>
                      </div>
                      {isEx && (
                        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderTop:"none", borderRadius:"0 0 10px 10px", padding:"14px 16px", marginBottom:6, animation:"fade-in .2s ease" }}>
                          {TOPICS.map((topic) => {
                            const rows = s.log.filter((l)=>l.topic===topic);
                            if (!rows.length) return null;
                            const ok = rows.filter((r)=>r.ok).length;
                            const p = pct(ok,rows.length);
                            return (<div key={topic} style={{ marginBottom:8 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                                <span style={S.pill(topic)}>{topicLabel(topic)}</span>
                                <span style={{ fontFamily:"monospace", fontSize:12, color:p>=70?POS_COLOR:p>=40?"#E8FF45":NEG_COLOR }}>{ok}/{rows.length} ({p}%)</span>
                              </div>
                              <MiniBar value={p}/>
                            </div>);
                          })}
                          {s.log.filter((l)=>!l.ok).length>0&&(
                            <div style={{ marginTop:12, borderTop:"1px solid #141414", paddingTop:12 }}>
                              <div style={{ fontSize:10, color:"#2a2a2a", letterSpacing:3, textTransform:"uppercase", marginBottom:8 }}>Missed</div>
                              {s.log.filter((l)=>!l.ok).map((l,i)=>(
                                <div key={i} style={{ marginBottom:6, fontSize:13, lineHeight:1.7 }}>
                                  <span style={{ color:"#3a3a3a" }}>{l.question}</span>
                                  <span style={{ color:NEG_COLOR, fontFamily:"monospace", marginLeft:8 }}>✗ {l.selected}</span>
                                  <span style={{ color:POS_COLOR, fontFamily:"monospace", marginLeft:8 }}>✓ {l.correct}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ marginTop:20, textAlign:"center" }}>
                  {!confirmClear
                    ? <button style={{ background:"transparent", border:"none", color:"#2a2a2a", fontSize:11, cursor:"pointer", letterSpacing:1, textTransform:"uppercase" }} onClick={()=>setConfirmClear(true)}>Clear all history</button>
                    : <div style={{ display:"flex", gap:8, justifyContent:"center", alignItems:"center" }}>
                        <span style={{ fontSize:12, color:"#555" }}>Are you sure?</span>
                        <button style={{ background:"#1f0808", border:`1px solid ${NEG_COLOR}44`, borderRadius:6, color:NEG_COLOR, fontSize:12, padding:"5px 12px", cursor:"pointer", fontWeight:700 }} onClick={async()=>{await clearSessions();setSessions([]);setConfirmClear(false);}}>Yes, clear</button>
                        <button style={{ background:"transparent", border:"1px solid #1f1f1f", borderRadius:6, color:"#444", fontSize:12, padding:"5px 12px", cursor:"pointer" }} onClick={()=>setConfirmClear(false)}>Cancel</button>
                      </div>}
                </div>
              </>);
            })()}
            <div style={{ ...S.btnRow, marginTop:24 }}>
              <button style={S.primaryBtn(false)} onClick={()=>startSession(null,null)}>Start Session</button>
              <button className="ghost-hover" style={{ ...S.primaryBtn(false), background:"transparent", border:"1.5px solid #1f1f1f", color:"#444" }} onClick={()=>setScreen("upload")}>Home</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
