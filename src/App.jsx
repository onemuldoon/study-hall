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
  { label: "3 min",   seconds: 180, questionCount: 8,  infinite: false },
  { label: "5 min",   seconds: 300, questionCount: 8,  infinite: true  },
  { label: "10 min",  seconds: 600, questionCount: 8,  infinite: true  },
  { label: "Untimed", seconds: 0,   questionCount: 15, infinite: false },
];
// ─── Subject Config ──────────────────────────────────────────────────────────
const SUBJECTS = [
  {
    id: "math",
    name: "Math",
    emoji: "📐",
    accent: "#1E3A5F",
    accentDim: "#B8C8D8",
    bg: "#EEF3FA",
    border: "#C8D8E8",
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
    accentDim: "#86efac",
    bg: "#F0FDF4",
    border: "#BBF7D0",
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
    accentDim: "#fed7aa",
    bg: "#FFF7ED",
    border: "#FED7AA",
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
    accentDim: "#bfdbfe",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    tagline: "Parts of Speech · Punctuation · Writing",
    supportsTextTopic: true,
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
    accentDim: "#fbcfe8",
    bg: "#FDF2F8",
    border: "#FBCFE8",
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
    accentDim: "#ddd6fe",
    bg: "#F5F3FF",
    border: "#DDD6FE",
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
    accentDim: "#fde68a",
    bg: "#FFFBEB",
    border: "#FDE68A",
    tagline: "Catechism · Faith · Sacraments",
    supportsTextTopic: true,
    generalLabel: "Creed · Sacraments · Commandments",
    generalPrompt: `Generate exactly 8 religion questions for a Catholic 6th grader based on the Catechism of the Catholic Church. Cover: the Creed and core beliefs (Trinity, Incarnation, Resurrection, the Church), the Sacraments (names, purpose, matter and form of each, especially Baptism, Eucharist, Reconciliation, Confirmation), and the Commandments and moral life (Ten Commandments, Beatitudes, Works of Mercy). Mix all three areas. Keep questions age-appropriate, clear, and faithful to Catholic teaching.`,
    insightContext: "6th grade Catholic religion and Catechism",
    hasMathVisuals: false,
  },
];

const NEG_COLOR = "#dc2626";   // negative sign color
const POS_COLOR = "#16a34a";   // positive sign color
const NEU_COLOR = "#1e3a5f";   // neutral number color

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
          if (tok === "×" || tok === "÷") return <span key={`${pi}-${i}`} style={{ color: "#1E3A5F", fontWeight: 900 }}>{tok}</span>;
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
    <div style={{ margin: "0 0 20px", background: "#F8F6F3", border: "1px solid #E2DDD8", borderRadius: 10, padding: "12px 0 6px" }}>
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
            <circle cx={toX(nld.start)} cy={H / 2} r={7} fill={nld.start < 0 ? NEG_COLOR : POS_COLOR} stroke="#E2DDD8" strokeWidth={1.5} opacity={0.85} />
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
          <div key={i} style={{ background: done ? "#F0FDF4" : "#F8F6F3", border: `1px solid ${done ? "#BBF7D0" : "#E2DDD8"}`, borderRadius: 8, padding: "12px 16px", marginBottom: 8, animation: "fade-in .25s ease" }}>
            <div style={{ fontSize: 11, color: done ? "#16a34a88" : "#1E3A5F88", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>
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
          style={{ width: "100%", padding: "11px", background: "#EEF3FA", border: "1.5px solid #1E3A5F33", borderRadius: 8, color: "#1E3A5F", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 4 }}>
          Next Step →
        </button>
      )}
    </div>
  );
}

// ─── Coord Grid ───────────────────────────────────────────────────────────────
// Supports both single point (legacy) and multi-point labeled mode
const POINT_COLORS = ["#1E3A5F", "#c084fc", "#60a5fa", "#fb923c"]; // A=navy, B=purple, C=blue, D=orange

function CoordGrid({ point, graphPoints, submitted, correct }) {
  const size = 260, cx = size / 2, step = size / 10, toPx = (v) => cx + v * step;

  // Normalise: if graphPoints array provided use it, else wrap single point
  const points = graphPoints && graphPoints.length
    ? graphPoints
    : point ? [{ label: null, x: point.x, y: point.y }] : [];

  return (
    <svg width={size} height={size} style={{ display: "block", background: "#F8F6F3", border: "1.5px solid #E2DDD8", borderRadius: 8 }}>
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
            <circle cx={px} cy={py} r={9} fill={color} stroke="#fff" strokeWidth={2}/>
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
  let bg = "#F8F6F3", border = "#E2DDD8", glow = "none";
  if (!submitted) {
    if (isSelected) { bg = "#EEF3FA"; border = "#1E3A5F"; glow = "0 0 0 2px #1E3A5F20"; }
  } else {
    if (isCorrect) { bg = "#F0FDF4"; border = POS_COLOR; glow = `0 0 0 2px ${POS_COLOR}20`; }
    else if (isSelected) { bg = "#FEF2F2"; border = NEG_COLOR; glow = `0 0 0 2px ${NEG_COLOR}20`; }
    else { bg = "#FAFAF9"; border = "#E2DDD8"; }
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
    <div style={{ background: "#FFFFFF", border: `1.5px solid ${color}22`, borderRadius: 12, padding: "24px 24px 20px", marginBottom: 16 }}>
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
  if (trend === "improving") return <span style={{ fontSize:11, fontWeight:800, color:POS_COLOR, background:"#F0FDF4", border:`1px solid ${POS_COLOR}44`, borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>↑ IMPROVING</span>;
  if (trend === "needs-work") return <span style={{ fontSize:11, fontWeight:800, color:NEG_COLOR, background:"#FEF2F2", border:`1px solid ${NEG_COLOR}44`, borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>↓ NEEDS WORK</span>;
  return <span style={{ fontSize:11, fontWeight:800, color:"#6A6560", background:"#F0EEE9", border:"1px solid #E2DDD8", borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>→ STEADY</span>;
}
function MiniBar({ value }) {
  const color = value >= 70 ? POS_COLOR : value >= 40 ? "#D97706" : NEG_COLOR;
  return (
    <div style={{ background:"#F0EEE9", borderRadius:3, height:6, overflow:"hidden", flex:1 }}>
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

// ─── Dashboard: load all subjects' sessions for one user ─────────────────────
async function loadAllSubjectSessions(username) {
  const results = {};
  await Promise.all(SUBJECTS.map(async (sub) => {
    results[sub.id] = await loadSessions(sub.id, username);
  }));
  return results;
}

// Build rich summary object from all-subject session data
function buildDashboardData(allSessions, srsCards, stats, username, displayName) {
  const subjectSummaries = {};
  let totalSessions = 0, totalQuestions = 0, totalCorrect = 0;
  const allSessionsFlat = [];

  SUBJECTS.forEach(sub => {
    const sessions = allSessions[sub.id] || [];
    if (!sessions.length) {
      subjectSummaries[sub.id] = { sessions: 0, avgScore: 0, trend: "no-data", recentScores: [], weakTopics: [], totalQuestions: 0 };
      return;
    }
    totalSessions += sessions.length;
    const recentScores = sessions.slice(0, 10).map(s => Math.round((s.correct / s.total) * 100));
    const avgScore = Math.round(recentScores.reduce((a,b)=>a+b,0) / recentScores.length);
    
    // Trend: compare last 3 vs previous 3
    const r3 = recentScores.slice(0,3), p3 = recentScores.slice(3,6);
    const rAvg = r3.reduce((a,b)=>a+b,0)/r3.length;
    const pAvg = p3.length ? p3.reduce((a,b)=>a+b,0)/p3.length : rAvg;
    const trend = rAvg - pAvg >= 8 ? "improving" : pAvg - rAvg >= 8 ? "declining" : "steady";

    // Weak topics from recent sessions
    const topicErrors = {};
    sessions.slice(0,8).forEach(s => s.log?.forEach(l => {
      if (!l.ok) topicErrors[l.topic] = (topicErrors[l.topic]||0) + 1;
    }));
    const weakTopics = Object.entries(topicErrors).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,n])=>({topic:t,count:n}));

    const subTotal = sessions.reduce((a,s)=>a+s.total,0);
    const subCorrect = sessions.reduce((a,s)=>a+s.correct,0);
    totalQuestions += subTotal;
    totalCorrect += subCorrect;
    
    sessions.forEach(s => allSessionsFlat.push({ ...s, subjectId: sub.id, subjectName: sub.name }));
    
    subjectSummaries[sub.id] = { sessions: sessions.length, avgScore, trend, recentScores, weakTopics, totalQuestions: subTotal, totalCorrect: subCorrect, accent: sub.accent, bg: sub.bg, border: sub.border, emoji: sub.emoji, name: sub.name };
  });

  // Weekly activity: count sessions per week for last 6 weeks
  const now = Date.now();
  const weeklyActivity = Array.from({length:6}, (_,i) => {
    const wStart = now - (i+1)*7*86400000, wEnd = now - i*7*86400000;
    return allSessionsFlat.filter(s => { const d = new Date(s.date).getTime(); return d >= wStart && d < wEnd; }).length;
  }).reverse();

  // Recent activity feed (last 8 sessions across all subjects)
  allSessionsFlat.sort((a,b) => new Date(b.date) - new Date(a.date));
  const recentActivity = allSessionsFlat.slice(0, 8);

  // SRS health
  const totalCards = srsCards.length;
  const dueCards = srsCards.filter(c => c.dueDate <= new Date().toISOString().slice(0,10)).length;
  const masteredCards = srsCards.filter(c => c.streak >= 5).length;

  return {
    username, displayName,
    totalSessions, totalQuestions, totalCorrect,
    avgScore: totalQuestions > 0 ? Math.round((totalCorrect/totalQuestions)*100) : 0,
    currentStreak: stats?.currentStreak || 0,
    bestStreak: stats?.bestStreak || 0,
    weeklyActivity,
    subjectSummaries,
    recentActivity,
    srsHealth: { totalCards, dueCards, masteredCards },
    activeSince: allSessionsFlat.length > 0 ? allSessionsFlat[allSessionsFlat.length-1].date : null,
  };
}

// AI-generated narrative insight for parent report
async function generateStudentInsightReport(dashData) {
  const subjectLines = SUBJECTS
    .filter(s => dashData.subjectSummaries[s.id]?.sessions > 0)
    .map(s => {
      const d = dashData.subjectSummaries[s.id];
      return `${s.name}: ${d.sessions} sessions, avg ${d.avgScore}%, trend: ${d.trend}, weak areas: ${d.weakTopics.map(w=>w.topic).join(", ")||"none identified"}`;
    }).join("\n");

  const prompt = `You are an educational advisor preparing a thoughtful progress report for a parent about their child's learning.

Student: ${dashData.displayName}
Total practice sessions: ${dashData.totalSessions}
Total questions answered: ${dashData.totalQuestions}
Overall accuracy: ${dashData.avgScore}%
Current streak: ${dashData.currentStreak} days
Spaced review cards mastered: ${dashData.srsHealth.masteredCards} of ${dashData.srsHealth.totalCards}

Performance by subject:
${subjectLines}

Weekly session counts (oldest to newest, last 6 weeks): ${dashData.weeklyActivity.join(", ")}

Write a warm, specific, data-driven parent report. Return ONLY a JSON object — no markdown, no extra text.
Format:
{
  "headline": "One sentence summary of overall trajectory (specific, not generic)",
  "strengths": ["2-3 specific observed strengths with subject/topic evidence"],
  "growth_areas": ["2-3 specific areas needing attention with subject/topic evidence"],
  "patterns": "2-3 sentences on observed learning patterns (e.g. consistency, best subjects, improvement rate)",
  "recommendation": "2-3 sentences of specific, actionable next steps for the parent",
  "encouragement": "One warm, specific sentence directly to the student (name them)"
}`;

  const res = await callAPI([{ role:"user", content: prompt }], 1000);
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = JSON.parse(text);
  const raw = data.content?.find(b => b.type==="text")?.text || "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response");
  return JSON.parse(match[0]);
}

// ─── Spaced Repetition System (SM-2 algorithm) ──────────────────────────────
// Each card: { id, subjectId, topicKey, question, correctAnswer, lastSeen,
//              interval, easeFactor, dueDate, totalReps, streak }
function srsKey(username) { return `${userPrefix(username)}srs-cards`; }
async function loadSrsCards(username) {
  try { const r = await storage.get(srsKey(username)); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function saveSrsCards(cards, username) {
  try { await storage.set(srsKey(username), JSON.stringify(cards)); } catch {}
}

// SM-2 update: quality 0-5 (0-2 = wrong, 3-5 = correct with varying confidence)
function sm2Update(card, quality) {
  const now = new Date().toISOString().slice(0,10);
  let { interval = 1, easeFactor = 2.5, totalReps = 0, streak = 0 } = card;
  if (quality >= 3) {
    // Correct answer
    if (totalReps === 0) interval = 1;
    else if (totalReps === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    streak = (streak || 0) + 1;
    totalReps = (totalReps || 0) + 1;
  } else {
    // Wrong answer — reset
    interval = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    streak = 0;
    totalReps = 0;
  }
  const dueDate = new Date(Date.now() + interval * 86400000).toISOString().slice(0,10);
  return { ...card, interval, easeFactor, dueDate, totalReps, streak, lastSeen: now };
}

// Add new cards from a completed session log
async function ingestSessionToSrs(log, subjectId, topicKey, username) {
  const cards = await loadSrsCards(username);
  const cardMap = Object.fromEntries(cards.map(c => [c.id, c]));
  const updated = [...cards];
  for (const entry of log) {
    const id = `${subjectId}__${btoa(entry.question).slice(0,32).replace(/[^a-z0-9]/gi,'_')}`;
    const quality = entry.ok ? 4 : 1;
    if (cardMap[id]) {
      const idx = updated.findIndex(c => c.id === id);
      updated[idx] = sm2Update(updated[idx], quality);
    } else {
      const newCard = { id, subjectId, topicKey, question: entry.question,
        correctAnswer: entry.correct, interval: 1, easeFactor: 2.5,
        dueDate: new Date(Date.now() + (entry.ok ? 86400000 : 0)).toISOString().slice(0,10),
        totalReps: entry.ok ? 1 : 0, streak: entry.ok ? 1 : 0,
        lastSeen: new Date().toISOString().slice(0,10) };
      updated.push(newCard);
    }
  }
  // Keep max 500 cards
  updated.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
  await saveSrsCards(updated.slice(0, 500), username);
}

function getDueCards(cards, subjectId, limit = 8) {
  const today = new Date().toISOString().slice(0,10);
  return cards
    .filter(c => c.subjectId === subjectId && c.dueDate <= today)
    .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, limit);
}
function getDueCount(cards, subjectId) {
  const today = new Date().toISOString().slice(0,10);
  return cards.filter(c => c.subjectId === subjectId && c.dueDate <= today).length;
}


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

async function generateProblems(base64, mediaType, difficulty, hwTopic, subject, questionCount = 8) {
  const blocks = [];
  const qCount = questionCount;

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
    const chapterScope = hwTopic.bookChapter ? `\nFocus ONLY on: ${hwTopic.bookChapter}. Do not ask about events or characters outside this scope.` : "";
    blocks.push({ type:"text", text:`You are an English literature tutor for a 6th grader.
Generate exactly ${qCount} multiple-choice questions about: "${hwTopic.bookTitle}"${hwTopic.bookAuthor ? ` by ${hwTopic.bookAuthor}` : ""}.${chapterScope}
Cover a mix of: plot comprehension (key events, sequence, cause and effect), character analysis (motivations, relationships, development), and themes/literary devices (symbolism, foreshadowing, author's message).
Difficulty: ${diffDesc}.
Keep questions SHORT and clear. All questions must be specific to this book${hwTopic.bookChapter ? " and chapter scope" : ""}.
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
Generate exactly ${qCount} multiple-choice questions specifically about: "${hwTopic.topicName}"
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
Generate exactly ${qCount} practice problems on this topic: "${hwTopic.topicName}" — ${hwTopic.description}
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
      <div style={{ background:"#FFFFFF", border:"1px solid #E2DDD8", borderRadius:16, padding:"24px 20px", maxWidth:520, width:"100%", animation:"fade-in .2s ease" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:800, color:"#1E3A5F", letterSpacing:2, textTransform:"uppercase" }}>Quick Reference</div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#444", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>

        {/* Number line */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10, color:"#333", letterSpacing:2, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>Number Line</div>
          <div style={{ background:"#F8F6F3", borderRadius:8, padding:"12px 10px" }}>
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
              {l:"M", name:"Multiply", color:"#1E3A5F"},
              {l:"D", name:"Divide", color:"#1E3A5F"},
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
          <div style={{ marginTop:8, fontSize:11, color:"#C0BCB8", textAlign:"center" }}>
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
const BrainWizLogo = ({ size = 48 }) => (
  <svg width={size} height={size * 1.1} viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Wizard hat */}
    <ellipse cx="50" cy="58" rx="30" ry="5" stroke="#1E3A5F" strokeWidth="3.5" fill="#E8F0F8" strokeLinecap="round"/>
    <path d="M50 10 L30 58 Q50 54 70 58 Z" fill="#E8F0F8" stroke="#1E3A5F" strokeWidth="3.5" strokeLinejoin="round"/>
    {/* Brain lobes hanging below brim */}
    <path d="M36 62 Q28 70 32 78 Q36 86 42 82 Q46 88 50 84 Q54 88 58 82 Q64 86 68 78 Q72 70 64 62" stroke="#1E3A5F" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Brain center line */}
    <line x1="50" y1="63" x2="50" y2="83" stroke="#1E3A5F" strokeWidth="2.5" strokeLinecap="round"/>
    {/* Brain bumps left */}
    <path d="M36 68 Q32 64 36 62" stroke="#1E3A5F" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M36 76 Q30 72 34 68" stroke="#1E3A5F" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {/* Brain bumps right */}
    <path d="M64 68 Q68 64 64 62" stroke="#1E3A5F" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M64 76 Q70 72 66 68" stroke="#1E3A5F" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {/* Green sparkle top right of hat */}
    <path d="M68 12 L70 18 L76 16 L70 22 L72 28 L66 22 L60 26 L64 20 L58 16 L64 14 Z" fill="#2BC48A" opacity="0.9"/>
  </svg>
);

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
  const [srsCards, setSrsCards] = useState([]);                // all SRS cards for user
  const [srsMode, setSrsMode] = useState(false);               // currently in SRS review mode
  const [prefetchedProblems, setPrefetchedProblems] = useState([]);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const prefetchedRef = useRef([]);
  const [bookTitle, setBookTitle] = useState("");             // book title for English
  const [bookChapter, setBookChapter] = useState("");         // chapter or chapter range
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
  // Dashboard state
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardInsights, setDashboardInsights] = useState(null);
  const [dashboardInsightsLoading, setDashboardInsightsLoading] = useState(false);
  const [dashboardInsightsError, setDashboardInsightsError] = useState(null);
  const [dashboardTab, setDashboardTab] = useState("overview"); // overview | subjects | insights
  const [dashboardSubject, setDashboardSubject] = useState(null); // subject id filter
  const [dashboardViewUser, setDashboardViewUser] = useState(null); // for admin viewing others
  const [adminStudents, setAdminStudents] = useState([]); // all students for admin dashboard list

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
  useEffect(() => { prefetchedRef.current = prefetchedProblems; }, [prefetchedProblems]);


  // Load subject-specific data when subject changes OR when returning to upload screen
  useEffect(() => {
    if (!subject || !currentUser) return;
    loadStats(currentUser.username).then(setHomeStats);
    loadTopicBank(subject.id, currentUser.username).then(setTopicBank);
    loadSrsCards(currentUser.username).then(setSrsCards);
    loadSessions(subject.id, currentUser.username).then(sessions => {
      const recent = sessions.slice(0, 10);
      const missed = new Set();
      recent.forEach(s => s.log?.forEach(l => { if (!l.ok) missed.add(l.question); }));
      setWeakSpotsCount(missed.size);
    });
  }, [subject, screen, currentUser]);

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
    setPrefetchedProblems([]); prefetchedRef.current = [];
    try {
      const probs = await generateProblems(base64, mediaType, difficulty, topic, subject, TIMER_OPTIONS[timerIdx].questionCount);
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
    const isInfinite = TIMER_OPTIONS[timerIdx].infinite && timeLeft > 0;
    if (isInfinite && idx + 1 >= problems.length) {
      if (prefetchedRef.current.length > 0) {
        setProblems(prev => [...prev, ...prefetchedRef.current]);
        setPrefetchedProblems([]); prefetchedRef.current = [];
      }
      setIdx((i)=>i+1); setSelected(null); setSubmitted(false);
      return;
    }
    if (idx+1>=problems.length) { clearTimer(); setScreen("complete"); return; }
    setIdx((i)=>i+1); setSelected(null); setSubmitted(false);
  };

  // Background prefetch: trigger when 2 questions remain in infinite timed modes
  useEffect(() => {
    const timerOpt = TIMER_OPTIONS[timerIdx];
    if (!timerOpt.infinite || timeLeft <= 0 || problems.length === 0) return;
    const remaining = problems.length - 1 - idx;
    if (remaining <= 2 && !isPrefetching && prefetchedRef.current.length === 0) {
      setIsPrefetching(true);
      generateProblems(null, null, difficulty, hwTopic, subject, timerOpt.questionCount)
        .then(newProbs => {
          if (Array.isArray(newProbs) && newProbs.length > 0) {
            setPrefetchedProblems(newProbs); prefetchedRef.current = newProbs;
          }
        })
        .catch(() => {})
        .finally(() => setIsPrefetching(false));
    }
  }, [idx, problems.length, timerIdx, timeLeft, isPrefetching]);

  const sessionSavedRef = useRef(false);
  useEffect(() => {
    if (screen==="complete"&&log.length>0&&!sessionSavedRef.current) {
      sessionSavedRef.current = true;
      const sessionPct = Math.round((log.filter(l=>l.ok).length / log.length) * 100);
      // Ingest session questions into SRS system
      ingestSessionToSrs(log, subject?.id||"math", hwTopic?.topicKey||"general", currentUser?.username)
        .then(() => loadSrsCards(currentUser?.username).then(setSrsCards));
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

  const startSrsReview = () => {
    const due = getDueCards(srsCards, subject?.id||"math", 8);
    if (due.length === 0) return;
    setSrsMode(true);
    // Build a fake hwTopic for SRS review
    const srsTopic = {
      topicKey: "srs_review",
      topicName: `Review: ${due.length} Due Card${due.length>1?"s":""}`,
      description: "Spaced repetition review",
      _isSrsReview: true,
      dueCards: due,
    };
    setHwTopic(srsTopic);
    setHwFile(null);
    setDifficulty(1);
    setScreen("confirm");
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
      const chapter = bookChapter.trim();
      const chapterSuffix = chapter ? ` — ${chapter}` : "";
      const topic = {
        topicKey: (topicName + (chapter ? "_" + chapter : "")).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40),
        topicName: topicName + chapterSuffix,
        description: author ? `By ${author}${chapter ? " · " + chapter : ""}` : chapter || "Literature study",
        _isBook: true,
        bookTitle: topicName,
        bookAuthor: author,
        bookChapter: chapter,
      };
      setHwTopic(topic); setHwFile(null); setDifficulty(1);
      setShowTextInput(false); setBookTitle(""); setBookChapter(""); setBookAuthor("");
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

  const openDashboard = async (targetUser) => {
    setDashboardLoading(true);
    setDashboardData(null); setDashboardInsights(null);
    setDashboardInsightsError(null); setDashboardTab("overview");
    setDashboardSubject(null); setDashboardViewUser(targetUser);
    setScreen("dashboard");
    try {
      const [allSessions, srsCardsData, statsData] = await Promise.all([
        loadAllSubjectSessions(targetUser.username),
        loadSrsCards(targetUser.username),
        loadStats(targetUser.username),
      ]);
      const data = buildDashboardData(allSessions, srsCardsData, statsData, targetUser.username, targetUser.displayName || targetUser.username);
      setDashboardData(data);
    } catch(e) { console.error("Dashboard load error:", e); }
    finally { setDashboardLoading(false); }
  };

  const loadDashboardInsights = async () => {
    if (!dashboardData) return;
    setDashboardInsightsLoading(true); setDashboardInsightsError(null);
    try {
      const insights = await generateStudentInsightReport(dashboardData);
      setDashboardInsights(insights);
    } catch(e) { setDashboardInsightsError(e.message || "Could not generate insights"); }
    finally { setDashboardInsightsLoading(false); }
  };

  const loadAdminStudentList = async () => {
    const { supabase } = await import("./lib/supabase.js");
    const { data } = await supabase.from("users").select("username, display_name, is_admin, is_approved").eq("is_approved", true).order("display_name");
    if (data) setAdminStudents(data.filter(u => !u.is_admin));
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
    page: { minHeight:"100vh", background:"#F0EEE9", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 16px", fontFamily:"'Atkinson Hyperlegible', 'Lexend', sans-serif" },
    card: { background:"#FFFFFF", border:"1px solid #E2DDD8", borderRadius:14, padding:"36px 32px", maxWidth:560, width:"100%", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" },
    wideCard: { background:"#FFFFFF", border:"1px solid #E2DDD8", borderRadius:14, padding:"36px 32px", maxWidth:680, width:"100%", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" },
    logo: { fontSize:11, letterSpacing:6, color:"#9A9490", textTransform:"uppercase", marginBottom:8 },
    h1: { fontSize:32, fontWeight:800, color:"#1E3A5F", letterSpacing:-1, marginBottom:4 },
    sub: { fontSize:12, color:"#9A9490", letterSpacing:2, textTransform:"uppercase", marginBottom:28 },
    sectionLabel: { fontSize:11, color:"#9A9490", letterSpacing:2, textTransform:"uppercase", marginBottom:10 },
    row: { display:"flex", gap:8, marginBottom:24 },
    segBtn: (active) => ({ flex:1, padding:"10px 8px", background:active?"#1E3A5F":"transparent", border:active?"1.5px solid #1E3A5F":"1.5px solid #E2DDD8", borderRadius:7, color:active?"#FFFFFF":"#9A9490", fontSize:13, fontWeight:700, cursor:"pointer", letterSpacing:1, textTransform:"uppercase" }),
    dropzone: (over) => ({ border:over?"2px solid #1E3A5F":"2px dashed #D0CCC8", borderRadius:10, padding:"40px 20px", textAlign:"center", cursor:"pointer", background:over?"#1E3A5F0a":"transparent", transition:"all .2s", marginBottom:12 }),
    dropTitle: { fontSize:16, fontWeight:700, color:"#3A3530", marginBottom:5 },
    dropSub: { fontSize:13, color:"#9A9490" },
    divider: { textAlign:"center", color:"#D0CCC8", fontSize:13, margin:"10px 0" },
    ghostBtn: { width:"100%", padding:"13px", background:"transparent", border:"1.5px solid #E2DDD8", borderRadius:8, color:"#6A6560", fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:1, textTransform:"uppercase", marginBottom:0 },
    err: { background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:7, padding:14, marginTop:14, color:"#dc2626", fontSize:12, fontFamily:"monospace", wordBreak:"break-all", lineHeight:1.6 },
    timerBar: { background:"#F0EEE9", borderRadius:4, height:4, marginBottom:6, overflow:"hidden" },
    timerFill: (p,low) => ({ height:"100%", width:`${p}%`, background:low?NEG_COLOR:"#1E3A5F", borderRadius:4, transition:"width 1s linear, background .5s" }),
    timerText: (low) => ({ fontSize:20, fontWeight:800, fontFamily:"monospace", color:low?NEG_COLOR:"#1E3A5F", letterSpacing:2, textAlign:"right", marginBottom:12 }),
    topicMeta: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 },
    pill: (topic) => ({ display:"inline-block", padding:"4px 12px", background:topicColor(topic)+"18", border:`1px solid ${topicColor(topic)}33`, borderRadius:20, color:topicColor(topic)||"#888", fontSize:11, fontWeight:800, letterSpacing:2, textTransform:"uppercase" }),
    numMeta: { fontSize:12, color:"#9A9490", fontFamily:"monospace" },
    prog: { background:"#F0EEE9", borderRadius:4, height:3, marginBottom:18, overflow:"hidden" },
    progFill: (p) => ({ height:"100%", width:`${p}%`, background:"#1E3A5F", borderRadius:4, transition:"width .4s ease" }),
    statsRow: { display:"flex", gap:16, marginBottom:18, alignItems:"center" },
    scoreLabel: { fontSize:13, color:"#6A6560" },
    scoreVal: { color:"#1E3A5F", fontWeight:800 },
    streakBadge: { fontSize:13, color:"#1E3A5F", fontWeight:700 },
    diffBadge: { marginLeft:"auto", fontSize:10, color:"#C0BCB8", letterSpacing:2, textTransform:"uppercase", fontFamily:"monospace" },
    questionBox: { marginBottom:24, padding:"20px 0 4px" },
    gridWrap: { display:"flex", justifyContent:"center", marginBottom:18 },
    tipBox: { background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8, padding:"14px 16px", marginTop:12 },
    tipTitle: { fontSize:10, color:"#92400E", letterSpacing:3, textTransform:"uppercase", marginBottom:5, fontWeight:800 },
    tipText: { fontSize:15, color:"#78350F", lineHeight:1.75, fontWeight:600 },
    expl: { fontSize:13, color:"#92400E", marginTop:6, lineHeight:1.6 },
    correctBox: { background:"#F0FDF4", border:`1px solid ${POS_COLOR}66`, borderRadius:8, padding:14, marginTop:12, color:POS_COLOR, fontSize:15, fontWeight:700 },
    btnRow: { display:"flex", gap:10, marginTop:18 },
    primaryBtn: (dis) => ({ flex:1, padding:"16px", background:dis?"#E2DDD8":"#1E3A5F", border:"none", borderRadius:8, color:dis?"#9A9490":"#FFFFFF", fontSize:16, fontWeight:800, cursor:dis?"default":"pointer" }),
    accentBtn: { flex:1, padding:"16px", background:"transparent", border:"1.5px solid #1E3A5F", borderRadius:8, color:"#1E3A5F", fontSize:16, fontWeight:800, cursor:"pointer" },
    bigScore: { fontSize:60, fontWeight:800, color:"#1E3A5F", fontFamily:"monospace", marginBottom:4 },
    bigDenom: { fontSize:20, color:"#9A9490", fontFamily:"monospace", marginBottom:6 },
    timeStat: { fontSize:12, color:"#9A9490", fontFamily:"monospace", marginBottom:20 },
    topicRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #F0EEE9" },
    topicCount: (ok,tot) => ({ fontFamily:"monospace", color:ok===tot?POS_COLOR:NEG_COLOR, fontSize:17, fontWeight:800 }),
    msg: { color:"#6A6560", fontSize:14, lineHeight:1.9, marginBottom:24, marginTop:14 },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Lexend:wght@400;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F0EEE9; }
        button { font-family: 'Atkinson Hyperlegible', 'Lexend', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-red { 0%,100%{opacity:1} 50%{opacity:0.55} }
        @keyframes fade-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pop { 0%{transform:scale(1)} 40%{transform:scale(1.07)} 100%{transform:scale(1)} }
        .ghost-hover:hover { border-color: #D0CCC8 !important; color: #4A4540 !important; }
        .session-row:hover { background: #F8F6F3 !important; }
        input:focus { border-color: #1E3A5F88 !important; outline: none; }
        input::placeholder { color: #B0ACA8; }
        input { background: #F8F6F3; border: 1.5px solid #E2DDD8; color: #1A1714; }
      `}</style>
      <div style={S.page}>

        {/* ── PENDING APPROVAL ── */}
        {screen === "pending" && (
          <div style={{ ...S.card, animation:"fade-in .3s ease", maxWidth:400, textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⏳</div>
            <div style={S.logo}>BrainWiz</div>
            <div style={S.h1}>ALMOST THERE</div>
            <div style={{ fontSize:15, color:"#555", lineHeight:1.8, marginBottom:28, marginTop:8 }}>
              Your account has been created and is waiting for approval.<br/>
              An admin will activate your account shortly.
            </div>
            <button onClick={() => setScreen("login")} style={{ width:"100%", padding:"14px", background:"transparent", border:"1.5px solid #E2DDD8", borderRadius:8, color:"#9A9490", fontSize:14, fontWeight:800, cursor:"pointer" }}>
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* ── LOGIN ── */}
        {screen === "login" && (
          <div style={{ ...S.card, animation:"fade-in .3s ease", maxWidth:400 }}>
            <div style={{ textAlign:"center", marginBottom:8 }}>
              <div style={{ marginBottom:8 }}><BrainWizLogo size={56} /></div>
              <div style={S.logo}>BrainWiz</div>
              <div style={S.h1}>SIGN IN</div>
            </div>

            {/* Mode toggle */}
            <div style={{ display:"flex", background:"#F0EEE9", borderRadius:8, padding:3, marginBottom:24 }}>
              {["login","register"].map(mode => (
                <button key={mode} onClick={() => { setLoginMode(mode); setLoginError(""); }}
                  style={{ flex:1, padding:"9px", background:loginMode===mode?"#1E3A5F":"transparent", border:"none", borderRadius:6, color:loginMode===mode?"#FFFFFF":"#9A9490", fontSize:12, fontWeight:800, cursor:"pointer", letterSpacing:1, textTransform:"uppercase", transition:"all .15s" }}>
                  {mode === "login" ? "Sign In" : "New Student"}
                </button>
              ))}
            </div>

            {loginMode === "register" && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:6, fontWeight:700 }}>DISPLAY NAME</div>
                <input value={loginDisplayName} onChange={e=>setLoginDisplayName(e.target.value)}
                  placeholder="e.g. Emma"
                  style={{ width:"100%", background:"#F8F6F3", border:"1.5px solid #E2DDD8", borderRadius:8, padding:"12px 14px", color:"#1A1714", fontSize:15, fontFamily:"inherit", outline:"none" }}
                  onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
              </div>
            )}

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:6, fontWeight:700 }}>USERNAME</div>
              <input value={loginUsername} onChange={e=>setLoginUsername(e.target.value)}
                placeholder="your username"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                style={{ width:"100%", background:"#F8F6F3", border:"1.5px solid #E2DDD8", borderRadius:8, padding:"12px 14px", color:"#1A1714", fontSize:15, fontFamily:"inherit", outline:"none" }}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:6, fontWeight:700 }}>PASSWORD</div>
              <input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)}
                placeholder="••••••"
                style={{ width:"100%", background:"#F8F6F3", border:"1.5px solid #E2DDD8", borderRadius:8, padding:"12px 14px", color:"#1A1714", fontSize:15, fontFamily:"inherit", outline:"none" }}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
            </div>

            {loginError && <div style={{ background:"#FEF2F2", border:"1px solid #4a1414", borderRadius:7, padding:"10px 14px", marginBottom:14, color:"#f87171", fontSize:13 }}>{loginError}</div>}

            <button onClick={handleLogin} disabled={loginLoading}
              style={{ width:"100%", padding:"15px", background:loginLoading?"#E2DDD8":"#1E3A5F", border:"none", borderRadius:8, color:loginLoading?"#9A9490":"#FFFFFF", fontSize:16, fontWeight:800, cursor:loginLoading?"default":"pointer", marginBottom:10 }}>
              {loginLoading ? "…" : loginMode === "login" ? "Sign In →" : "Create Account →"}
            </button>

            <div style={{ textAlign:"center", fontSize:11, color:"#2a2a2a", marginTop:8 }}>
              Your data is stored securely in the cloud
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
                  <div style={{ fontSize:13, fontWeight:800, color:"#1E3A5F" }}>{currentUser?.displayName}</div>
                  {currentUser?.isAdmin && <span style={{ fontSize:9, background:"#EEF3FA", border:"1px solid #1E3A5F33", borderRadius:4, padding:"2px 6px", color:"#1E3A5F", fontWeight:800, letterSpacing:1 }}>ADMIN</span>}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {currentUser?.isAdmin && (
                    <button onClick={() => { setScreen("admin"); loadAdminUsers(); }}
                      style={{ background:"#EEF3FA", border:"1px solid #1E3A5F33", borderRadius:6, color:"#1E3A5F", fontSize:11, padding:"4px 10px", cursor:"pointer", letterSpacing:1, fontWeight:800 }}>
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
                    setBookChapter("");
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

            <div style={{ display:"flex", gap:8 }}>
              <button className="ghost-hover" style={{ ...S.ghostBtn, flex:1 }} onClick={() => openDashboard(currentUser)}>
                📊 My Progress
              </button>
              <button className="ghost-hover" style={{ ...S.ghostBtn, flex:1 }} onClick={handleOpenHistory}>
                History →
              </button>
            </div>
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
            <div style={{ display:"flex", background:"#F0EEE9", borderRadius:8, padding:3, marginBottom:20 }}>
              {[["pending","⏳ Pending"],["all","👥 All Users"],["students","📊 Dashboards"],["add","➕ Add User"]].map(([tab, label]) => (
                <button key={tab} onClick={() => { setAdminTab(tab); if (tab==="students") loadAdminStudentList(); }}
                  style={{ flex:1, padding:"8px 4px", background:adminTab===tab?"#1E3A5F":"transparent", border:"none", borderRadius:6, color:adminTab===tab?"#FFFFFF":"#9A9490", fontSize:11, fontWeight:800, cursor:"pointer", letterSpacing:1, transition:"all .15s" }}>
                  {label}
                </button>
              ))}
            </div>

            {adminMsg && <div style={{ background:"#EEF3FA", border:"1px solid #1E3A5F33", borderRadius:7, padding:"10px 14px", marginBottom:14, color:"#1E3A5F", fontSize:13, textAlign:"center" }}>{adminMsg}</div>}

            {adminLoading && <div style={{ textAlign:"center", padding:24, color:"#444" }}>Loading…</div>}

            {/* Pending tab */}
            {adminTab === "pending" && !adminLoading && (
              <div>
                {adminUsers.filter(u => !u.is_approved && !u.is_admin).length === 0
                  ? <div style={{ textAlign:"center", padding:24, color:"#333", fontSize:14 }}>No pending users 🎉</div>
                  : adminUsers.filter(u => !u.is_approved && !u.is_admin).map(u => (
                    <div key={u.username} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderBottom:"1px solid #F0EEE9" }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>{u.display_name}</div>
                        <div style={{ fontSize:11, color:"#444", fontFamily:"monospace" }}>@{u.username}</div>
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => handleApproveUser(u.username, true)}
                          style={{ background:"#F0FDF4", border:"1px solid #4ade8044", borderRadius:6, color:"#4ade80", fontSize:12, padding:"6px 12px", cursor:"pointer", fontWeight:800 }}>✓ Approve</button>
                        <button onClick={() => handleDeleteUser(u.username)}
                          style={{ background:"#FEF2F2", border:"1px solid #ff6b6b44", borderRadius:6, color:"#ff6b6b", fontSize:12, padding:"6px 12px", cursor:"pointer", fontWeight:800 }}>✗ Delete</button>
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
                  <div key={u.username} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderBottom:"1px solid #F0EEE9" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>{u.display_name}</div>
                        {u.is_admin && <span style={{ fontSize:9, background:"#EEF3FA", border:"1px solid #1E3A5F33", borderRadius:4, padding:"2px 6px", color:"#1E3A5F", fontWeight:800 }}>ADMIN</span>}
                        {!u.is_approved && !u.is_admin && <span style={{ fontSize:9, background:"#ff6b6b20", border:"1px solid #ff6b6b44", borderRadius:4, padding:"2px 6px", color:"#ff6b6b", fontWeight:800 }}>PENDING</span>}
                      </div>
                      <div style={{ fontSize:11, color:"#444", fontFamily:"monospace" }}>@{u.username}</div>
                    </div>
                    {!u.is_admin && (
                      <div style={{ display:"flex", gap:8 }}>
                        {!u.is_approved
                          ? <button onClick={() => handleApproveUser(u.username, true)} style={{ background:"#F0FDF4", border:"1px solid #4ade8044", borderRadius:6, color:"#4ade80", fontSize:11, padding:"5px 10px", cursor:"pointer", fontWeight:800 }}>Approve</button>
                          : <button onClick={() => handleApproveUser(u.username, false)} style={{ background:"#EEF3FA", border:"1px solid #1E3A5F33", borderRadius:6, color:"#1E3A5F", fontSize:11, padding:"5px 10px", cursor:"pointer", fontWeight:800 }}>Revoke</button>
                        }
                        <button onClick={() => handleDeleteUser(u.username)} style={{ background:"#FEF2F2", border:"1px solid #ff6b6b44", borderRadius:6, color:"#ff6b6b", fontSize:11, padding:"5px 10px", cursor:"pointer", fontWeight:800 }}>Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Student Dashboards tab */}
            {adminTab === "students" && (
              <div>
                {adminStudents.length === 0
                  ? <div style={{ textAlign:"center", padding:32, color:"#555" }}>No approved students yet.</div>
                  : adminStudents.map(u => (
                    <button key={u.username}
                      onClick={() => openDashboard({ username: u.username, displayName: u.display_name })}
                      style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", background:"#F8F6F3", border:"1.5px solid #E2DDD8", borderRadius:10, marginBottom:8, cursor:"pointer", transition:"all .15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="#1E3A5F55";e.currentTarget.style.background="#EEF3FA";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="#E2DDD8";e.currentTarget.style.background="#F8F6F3";}}>
                      <div style={{ textAlign:"left" }}>
                        <div style={{ fontSize:15, fontWeight:800, color:"#1E3A5F" }}>{u.display_name}</div>
                        <div style={{ fontSize:11, color:"#9A9490", fontFamily:"monospace" }}>@{u.username}</div>
                      </div>
                      <span style={{ fontSize:12, color:"#9A9490" }}>View Dashboard →</span>
                    </button>
                  ))
                }
              </div>
            )}

            {/* Add user tab */}
            {adminTab === "add" && (
              <div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:5, fontWeight:700 }}>DISPLAY NAME</div>
                  <input value={adminNewDisplay} onChange={e=>setAdminNewDisplay(e.target.value)} placeholder="e.g. Emma"
                    style={{ width:"100%", background:"#F8F6F3", border:"1.5px solid #E2DDD8", borderRadius:8, padding:"10px 14px", color:"#1A1714", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:5, fontWeight:700 }}>USERNAME</div>
                  <input value={adminNewUsername} onChange={e=>setAdminNewUsername(e.target.value)} placeholder="username" autoCapitalize="none"
                    style={{ width:"100%", background:"#F8F6F3", border:"1.5px solid #E2DDD8", borderRadius:8, padding:"10px 14px", color:"#1A1714", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, color:"#444", letterSpacing:2, marginBottom:5, fontWeight:700 }}>PASSWORD</div>
                  <input value={adminNewPassword} onChange={e=>setAdminNewPassword(e.target.value)} placeholder="••••••"
                    style={{ width:"100%", background:"#F8F6F3", border:"1.5px solid #E2DDD8", borderRadius:8, padding:"10px 14px", color:"#1A1714", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
                  <input type="checkbox" checked={adminNewIsAdmin} onChange={e=>setAdminNewIsAdmin(e.target.checked)} id="isAdminChk" style={{ width:16, height:16, cursor:"pointer" }} />
                  <label htmlFor="isAdminChk" style={{ fontSize:13, color:"#666", cursor:"pointer" }}>Make this user an admin</label>
                </div>
                <button onClick={handleAdminAddUser}
                  style={{ width:"100%", padding:"14px", background:"#1E3A5F", border:"none", borderRadius:8, color:"#FFFFFF", fontSize:15, fontWeight:800, cursor:"pointer" }}>
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
                  style={{ background:"#FFFFFF", border:`1.5px solid ${subject?.border||"#E2DDD8"}`, borderRadius:10, padding:"14px", cursor:"pointer", textAlign:"left", transition:"border-color .15s, background .15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=subject?.accent+"66"||"#1E3A5F66";e.currentTarget.style.background=subject?.bg||"#F8F6F3";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=subject?.border||"#2a2a2a";e.currentTarget.style.background="#FFFFFF";}}>
                  <div style={{ fontSize:18, marginBottom:5 }}>{subject?.emoji||"📐"}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:subject?.accent||"#1E3A5F", lineHeight:1.2 }}>General</div>
                  <div style={{ fontSize:10, color:"#3a3a3a", marginTop:3, lineHeight:1.4 }}>{subject?.generalLabel||"Mixed topics"}</div>
                </button>

                {/* Mix */}
                {topicBank.length >= 2
                  ? <button onClick={startMix}
                      style={{ background:"#F5F3FF", border:"1.5px solid #c084fc44", borderRadius:10, padding:"14px", cursor:"pointer", textAlign:"left", transition:"border-color .15s, background .15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="#c084fc88";e.currentTarget.style.background="#EDE9FE";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="#c084fc33";e.currentTarget.style.background="#0a0010";}}>
                      <div style={{ fontSize:18, marginBottom:5 }}>🔀</div>
                      <div style={{ fontSize:13, fontWeight:800, color:"#c084fc", lineHeight:1.2 }}>Mix</div>
                      <div style={{ fontSize:10, color:"#3a2a4a", marginTop:3, lineHeight:1.4 }}>Blend {Math.min(3,topicBank.length)} random topics</div>
                    </button>
                  : <div style={{ background:"#F8F6F3", border:"1.5px dashed #D0CCC8", borderRadius:10, padding:"14px", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", gap:4 }}>
                      <div style={{ fontSize:18, opacity:0.4 }}>🔀</div>
                      <div style={{ fontSize:11, color:"#2a2a2a", textAlign:"center", lineHeight:1.4 }}>Mix unlocks with 2+ topics</div>
                    </div>
                }

                {/* All saved topics — flowing grid, same size as General/Mix */}
                {topicBank.map(t => {
                  const color = topicColor(t.topicKey);
                  return (
                    <button key={t.topicKey}
                      onClick={() => { setHwTopic(t); setHwFile(null); setDifficulty(1); setScreen("confirm"); }}
                      style={{ background:"#FFFFFF", border:`1.5px solid ${color}33`, borderRadius:10, padding:"14px", cursor:"pointer", textAlign:"left", transition:"border-color .15s, background .15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=color+"88";e.currentTarget.style.background=color+"0a";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=color+"33";e.currentTarget.style.background="#FFFFFF";}}>
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
                style={{ width:"100%", marginBottom:8, background:dragging?"#EEF3FA":"transparent", border:`2px dashed ${dragging?"#1E3A5F":"#D0CCC8"}`, borderRadius:12, padding:"18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:14, transition:"all .15s" }}>
                <div style={{ fontSize:24, color:dragging?"#1E3A5F":"#D0CCC8", lineHeight:1 }}>+</div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:13, fontWeight:800, color:dragging?"#1E3A5F":"#9A9490", letterSpacing:1 }}>UPLOAD HOMEWORK</div>
                  <div style={{ fontSize:11, color:dragging?"#E8FF4488":"#222", marginTop:2 }}>JPG, PNG, PDF, HEIC</div>
                </div>
              </button>

              {/* Book input — English only */}
              {subject?.supportsBookInput && (
                <div style={{ border:"1.5px solid #2a1a50", borderRadius:12, overflow:"hidden" }}>
                  <button onClick={() => setShowTextInput(v=>!v)}
                    style={{ width:"100%", background:"#F5F3FF", border:"none", padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"background .15s" }}
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
                    <div style={{ background:"#F8F6F3", padding:"14px 16px", borderTop:"1px solid #E2DDD8", animation:"fade-in .15s ease" }}>
                      <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, fontWeight:700, marginBottom:5 }}>BOOK TITLE *</div>
                      <input value={bookTitle} onChange={e=>setBookTitle(e.target.value)}
                        placeholder="e.g. The Magician's Nephew"
                        style={{ width:"100%", background:"#F8F6F3", border:"1.5px solid #c4b5fd", borderRadius:8, padding:"10px 12px", color:"#1A1714", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:10, boxSizing:"border-box" }}
                        onKeyDown={e=>e.key==="Enter"&&handleTextTopicSubmit()} />
                      <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, fontWeight:700, marginBottom:5 }}>CHAPTER(S)</div>
                      <input value={bookChapter} onChange={e=>setBookChapter(e.target.value)}
                        placeholder="e.g. Chapter 1, Chapters 1-4, Part 2"
                        style={{ width:"100%", background:"#F8F6F3", border:"1.5px solid #c4b5fd", borderRadius:8, padding:"10px 12px", color:"#1A1714", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:10, boxSizing:"border-box" }}
                        onKeyDown={e=>e.key==="Enter"&&handleTextTopicSubmit()} />
                      <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, fontWeight:700, marginBottom:5 }}>AUTHOR</div>
                      <input value={bookAuthor} onChange={e=>setBookAuthor(e.target.value)}
                        placeholder="e.g. C.S. Lewis (optional)"
                        style={{ width:"100%", background:"#F8F6F3", border:"1.5px solid #c4b5fd", borderRadius:8, padding:"10px 12px", color:"#1A1714", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:12, boxSizing:"border-box" }}
                        onKeyDown={e=>e.key==="Enter"&&handleTextTopicSubmit()} />
                      <button onClick={handleTextTopicSubmit} disabled={!bookTitle.trim()}
                        style={{ width:"100%", padding:"10px", background:bookTitle.trim()?"#a78bfa":"#F0EEE9", border:"none", borderRadius:8, color:bookTitle.trim()?"#fff":"#9A9490", fontSize:13, fontWeight:800, cursor:bookTitle.trim()?"pointer":"default" }}>
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
                    style={{ width:"100%", background:"#F8F6F3", border:"none", padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"background .15s" }}
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
                    <div style={{ background:"#F8F6F3", padding:"14px 16px", borderTop:`1px solid ${subject.border}`, animation:"fade-in .15s ease" }}>
                      <input value={textTopicInput} onChange={e=>setTextTopicInput(e.target.value)}
                        placeholder={`e.g. "${subject.id === "religion" ? "The Seven Sacraments" : subject.id === "social_studies" ? "Ancient Rome" : "Photosynthesis"}"`}
                        style={{ width:"100%", background:"#F8F6F3", border:`1.5px solid ${subject.border}`, borderRadius:8, padding:"10px 12px", color:"#1A1714", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:10, boxSizing:"border-box" }}
                        onKeyDown={e=>e.key==="Enter"&&handleTextTopicSubmit()} />
                      <button onClick={handleTextTopicSubmit} disabled={!textTopicInput.trim()}
                        style={{ width:"100%", padding:"10px", background:textTopicInput.trim()?subject.accent:"#F0EEE9", border:"none", borderRadius:8, color:textTopicInput.trim()?"#fff":"#9A9490", fontSize:13, fontWeight:800, cursor:textTopicInput.trim()?"pointer":"default" }}>
                        Study This Theme →
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>

            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,.pdf" style={{ display:"none" }}
              onChange={(e)=>{if(e.target.files[0])handleFile(e.target.files[0]);}} />

            <div style={{ borderTop:"1px solid #E2DDD8", paddingTop:14, display:"flex", flexDirection:"column", gap:8 }}>
              {(() => { const dueCount = getDueCount(srsCards, subject?.id||"math"); return dueCount > 0 ? (
                <button className="ghost-hover" onClick={startSrsReview}
                  style={{ width:"100%", padding:"13px 16px", background:"#EEF3FA", border:"1.5px solid #1E3A5F", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"all .15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:18 }}>🔁</span>
                    <div style={{ textAlign:"left" }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"#1E3A5F", letterSpacing:1 }}>SPACED REVIEW</div>
                      <div style={{ fontSize:11, color:"#9A9490" }}>Reinforce what you're about to forget</div>
                    </div>
                  </div>
                  <span style={{ background:"#1E3A5F", color:"white", borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:800 }}>{dueCount} due</span>
                </button>
              ) : null; })()}
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
              <div style={{ background:"#F0FDF4", border:"1px solid #3a5a00", borderRadius:8, padding:"12px 16px", marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18, display:"inline-block", animation:"spin 1s linear infinite" }}>⚙</span>
                <span style={{ fontSize:13, color:"#a0c040", fontWeight:700 }}>Converting iPhone photo…</span>
              </div>
            )}
            {error === "HEIC_FAILED" && (
              <div style={{ background:"#FFFBEB", border:"1px solid #5a3a00", borderRadius:8, padding:"14px 16px", marginTop:12 }}>
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
            <div style={S.logo}>{hwTopic?._isGeneral ? "Ready to Practice" : hwTopic?._isMix ? "Mix Session" : hwTopic?._isSrsReview ? "Spaced Review" : hwTopic?._isBook ? "Book Study" : hwTopic?._isTextTopic ? "Custom Topic" : "Homework Uploaded"}</div>

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
                  const accent = subject?.accent || "#1E3A5F";
                  const accentDim = subject?.accentDim || "#B8C8D8";
                  const bg = subject?.bg || "#EEF3FA";
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
                    style={{ ...S.primaryBtn(false), background:"transparent", border:"1.5px solid #E2DDD8", color:"#9A9490" }}
                    onClick={() => { setScreen("upload"); setHwFile(null); setHwTopic(null); }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {screen === "dashboard" && (
          <div style={{ ...S.wideCard, maxWidth:700, animation:"fade-in .3s ease", padding:"28px 24px" }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
              <div>
                <div style={{ fontSize:11, color:"#9A9490", letterSpacing:4, textTransform:"uppercase", marginBottom:4 }}>
                  {currentUser?.isAdmin && dashboardViewUser?.username !== currentUser?.username ? "Admin View" : "Progress Report"}
                </div>
                <div style={{ fontSize:28, fontWeight:800, color:"#1E3A5F", letterSpacing:-0.5 }}>
                  {dashboardData ? dashboardData.displayName : "Loading…"}
                </div>
                {dashboardData?.activeSince && (
                  <div style={{ fontSize:11, color:"#9A9490", marginTop:2 }}>
                    Active since {new Date(dashboardData.activeSince).toLocaleDateString("en-US", {month:"long", year:"numeric"})}
                  </div>
                )}
              </div>
              <button onClick={() => setScreen(currentUser?.isAdmin && dashboardViewUser?.username !== currentUser?.username ? "admin" : "subjects")}
                style={{ background:"transparent", border:"none", color:"#9A9490", fontSize:22, cursor:"pointer", padding:4 }}>✕</button>
            </div>

            {dashboardLoading && (
              <div style={{ textAlign:"center", padding:"60px 0" }}>
                <div style={{ fontSize:36, display:"inline-block", animation:"spin 1.2s linear infinite", marginBottom:12 }}>⚙</div>
                <div style={{ color:"#555", fontSize:14 }}>Loading student data…</div>
              </div>
            )}

            {!dashboardLoading && dashboardData && (() => {
              const d = dashboardData;

              // ── Tab nav ──────────────────────────────────────────────────
              return (<>
                <div style={{ display:"flex", background:"#F0EEE9", borderRadius:8, padding:3, marginBottom:24, gap:3 }}>
                  {[["overview","Overview"],["subjects","By Subject"],["insights","AI Report"]].map(([tab,label]) => (
                    <button key={tab}
                      onClick={() => { setDashboardTab(tab); if (tab==="insights" && !dashboardInsights && !dashboardInsightsLoading) loadDashboardInsights(); }}
                      style={{ flex:1, padding:"9px 6px", background:dashboardTab===tab?"#1E3A5F":"transparent", border:"none", borderRadius:6, color:dashboardTab===tab?"#FFFFFF":"#9A9490", fontSize:12, fontWeight:800, cursor:"pointer", letterSpacing:1, textTransform:"uppercase", transition:"all .15s" }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* ════════ OVERVIEW TAB ════════ */}
                {dashboardTab === "overview" && (<>

                  {/* Stat row */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:24 }}>
                    {[
                      { label:"Sessions", value: d.totalSessions, sub: "total" },
                      { label:"Questions", value: d.totalQuestions, sub: "answered" },
                      { label:"Accuracy", value: d.avgScore + "%", sub: "overall", color: d.avgScore >= 70 ? POS_COLOR : d.avgScore >= 50 ? "#D97706" : NEG_COLOR },
                      { label:"Streak", value: d.currentStreak, sub: d.currentStreak > 0 ? "days 🔥" : "days" },
                    ].map(({ label, value, sub, color }) => (
                      <div key={label} style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:10, padding:"14px 12px", textAlign:"center" }}>
                        <div style={{ fontSize:22, fontWeight:800, color: color || "#1E3A5F", fontFamily:"monospace" }}>{value}</div>
                        <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, textTransform:"uppercase", marginTop:3 }}>{label}</div>
                        <div style={{ fontSize:10, color:"#C0BCB8" }}>{sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Weekly activity bar chart */}
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontSize:11, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>Weekly Activity</div>
                    <div style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:10, padding:"16px 12px 10px" }}>
                      {(() => {
                        const max = Math.max(...d.weeklyActivity, 1);
                        const weeks = ["6w ago","5w ago","4w ago","3w ago","2w ago","This week"];
                        return (
                          <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:72 }}>
                            {d.weeklyActivity.map((v,i) => (
                              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                                <div style={{ fontSize:9, color:"#9A9490", fontFamily:"monospace" }}>{v||""}</div>
                                <div style={{ width:"100%", background: v > 0 ? "#1E3A5F" : "#E2DDD8", borderRadius:"3px 3px 0 0", height: Math.max((v/max)*52, v>0?6:2), transition:"height .4s ease" }} />
                                <div style={{ fontSize:8, color:"#C0BCB8", textAlign:"center", lineHeight:1.2 }}>{weeks[i]}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Subject heatmap grid */}
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontSize:11, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>Subject Health</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                      {SUBJECTS.map(sub => {
                        const s = d.subjectSummaries[sub.id];
                        if (!s?.sessions) return (
                          <div key={sub.id} style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:10, padding:"12px 14px", opacity:0.5 }}>
                            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                              <span style={{ fontSize:16 }}>{sub.emoji}</span>
                              <div style={{ fontSize:12, fontWeight:800, color:"#C0BCB8" }}>{sub.name}</div>
                            </div>
                            <div style={{ fontSize:10, color:"#C0BCB8" }}>No sessions yet</div>
                          </div>
                        );
                        const scoreColor = s.avgScore >= 70 ? POS_COLOR : s.avgScore >= 50 ? "#D97706" : NEG_COLOR;
                        const trendIcon = s.trend === "improving" ? "↑" : s.trend === "declining" ? "↓" : "→";
                        const trendColor = s.trend === "improving" ? POS_COLOR : s.trend === "declining" ? NEG_COLOR : "#9A9490";
                        return (
                          <div key={sub.id} style={{ background:sub.bg, border:`1.5px solid ${sub.border}`, borderRadius:10, padding:"12px 14px", cursor:"pointer" }}
                            onClick={() => { setDashboardTab("subjects"); setDashboardSubject(sub.id); }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                                <span style={{ fontSize:16 }}>{sub.emoji}</span>
                                <div style={{ fontSize:12, fontWeight:800, color:sub.accent }}>{sub.name}</div>
                              </div>
                              <span style={{ fontSize:13, fontWeight:800, color:trendColor }}>{trendIcon}</span>
                            </div>
                            {/* Mini sparkline */}
                            {s.recentScores.length > 1 && (() => {
                              const pts = s.recentScores.slice().reverse();
                              const w = 100, h = 28;
                              const xs = pts.map((_,i) => Math.round((i/(pts.length-1))*w));
                              const ys = pts.map(v => Math.round(h - (v/100)*h));
                              const path = pts.map((v,i) => `${i===0?"M":"L"}${xs[i]},${ys[i]}`).join(" ");
                              return (
                                <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display:"block", marginBottom:6 }} preserveAspectRatio="none">
                                  <path d={path} stroke={sub.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                  <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="3" fill={scoreColor} />
                                </svg>
                              );
                            })()}
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <div style={{ fontSize:11, color:sub.accentDim }}>{s.sessions} session{s.sessions!==1?"s":""}</div>
                              <div style={{ fontSize:16, fontWeight:800, color:scoreColor, fontFamily:"monospace" }}>{s.avgScore}%</div>
                            </div>
                            {/* Score bar */}
                            <div style={{ background:sub.border, borderRadius:3, height:4, marginTop:6, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${s.avgScore}%`, background:scoreColor, borderRadius:3, transition:"width .5s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SRS health */}
                  {d.srsHealth.totalCards > 0 && (
                    <div style={{ marginBottom:24 }}>
                      <div style={{ fontSize:11, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>Spaced Review Health</div>
                      <div style={{ background:"#EEF3FA", border:"1.5px solid #1E3A5F22", borderRadius:10, padding:"14px 16px" }}>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, textAlign:"center" }}>
                          {[
                            { label:"Total Cards", value:d.srsHealth.totalCards, color:"#1E3A5F" },
                            { label:"Due Today", value:d.srsHealth.dueCards, color:d.srsHealth.dueCards>0?"#D97706":POS_COLOR },
                            { label:"Mastered (5+ streak)", value:d.srsHealth.masteredCards, color:POS_COLOR },
                          ].map(({label,value,color}) => (
                            <div key={label}>
                              <div style={{ fontSize:20, fontWeight:800, color, fontFamily:"monospace" }}>{value}</div>
                              <div style={{ fontSize:9, color:"#9A9490", letterSpacing:1, textTransform:"uppercase", marginTop:2 }}>{label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop:10, background:"#1E3A5F22", borderRadius:3, height:5, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${Math.round((d.srsHealth.masteredCards/d.srsHealth.totalCards)*100)}%`, background:POS_COLOR, borderRadius:3, transition:"width .5s ease" }} />
                        </div>
                        <div style={{ fontSize:10, color:"#9A9490", marginTop:4, textAlign:"right" }}>
                          {Math.round((d.srsHealth.masteredCards/d.srsHealth.totalCards)*100)}% mastery rate
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent activity feed */}
                  {d.recentActivity.length > 0 && (
                    <div>
                      <div style={{ fontSize:11, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>Recent Sessions</div>
                      {d.recentActivity.map((s,i) => {
                        const sp = Math.round((s.correct/s.total)*100);
                        const sub = SUBJECTS.find(sb => sb.id === s.subjectId);
                        return (
                          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #F0EEE9" }}>
                            <span style={{ fontSize:18 }}>{sub?.emoji||"📚"}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:"#1E3A5F" }}>{s.subjectName}</div>
                              <div style={{ fontSize:10, color:"#C0BCB8" }}>{new Date(s.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                            </div>
                            <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:800, color:sp>=70?POS_COLOR:sp>=50?"#D97706":NEG_COLOR }}>{s.correct}/{s.total}</div>
                            <div style={{ width:40, background:"#F0EEE9", borderRadius:3, height:5, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${sp}%`, background:sp>=70?POS_COLOR:sp>=50?"#D97706":NEG_COLOR, borderRadius:3 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>)}

                {/* ════════ BY SUBJECT TAB ════════ */}
                {dashboardTab === "subjects" && (<>
                  {/* Subject selector */}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
                    <button onClick={() => setDashboardSubject(null)}
                      style={{ padding:"6px 14px", background:!dashboardSubject?"#1E3A5F":"transparent", border:"1.5px solid " + (!dashboardSubject?"#1E3A5F":"#E2DDD8"), borderRadius:20, color:!dashboardSubject?"#fff":"#9A9490", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                      All
                    </button>
                    {SUBJECTS.map(sub => (
                      <button key={sub.id} onClick={() => setDashboardSubject(sub.id)}
                        style={{ padding:"6px 14px", background:dashboardSubject===sub.id?sub.accent:"transparent", border:`1.5px solid ${dashboardSubject===sub.id?sub.accent:sub.border}`, borderRadius:20, color:dashboardSubject===sub.id?"#fff":sub.accent, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        {sub.emoji} {sub.name}
                      </button>
                    ))}
                  </div>

                  {(dashboardSubject ? SUBJECTS.filter(s=>s.id===dashboardSubject) : SUBJECTS).map(sub => {
                    const s = d.subjectSummaries[sub.id];
                    if (!s?.sessions) return (
                      <div key={sub.id} style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:10, padding:"16px 18px", marginBottom:12, opacity:0.55 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <span style={{ fontSize:18 }}>{sub.emoji}</span>
                          <div style={{ fontSize:14, fontWeight:800, color:"#C0BCB8" }}>{sub.name} — No sessions yet</div>
                        </div>
                      </div>
                    );
                    const scoreColor = s.avgScore >= 70 ? POS_COLOR : s.avgScore >= 50 ? "#D97706" : NEG_COLOR;
                    return (
                      <div key={sub.id} style={{ background:"#FFFFFF", border:`1.5px solid ${sub.border}`, borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                            <span style={{ fontSize:20 }}>{sub.emoji}</span>
                            <div>
                              <div style={{ fontSize:16, fontWeight:800, color:sub.accent }}>{sub.name}</div>
                              <div style={{ fontSize:10, color:sub.accentDim }}>{s.sessions} sessions · {s.totalQuestions} questions</div>
                            </div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:24, fontWeight:800, color:scoreColor, fontFamily:"monospace" }}>{s.avgScore}%</div>
                            <div style={{ fontSize:10, color:s.trend==="improving"?POS_COLOR:s.trend==="declining"?NEG_COLOR:"#9A9490", fontWeight:700 }}>
                              {s.trend==="improving"?"↑ Improving":s.trend==="declining"?"↓ Declining":"→ Steady"}
                            </div>
                          </div>
                        </div>
                        {/* Score history chart */}
                        {s.recentScores.length > 1 && (() => {
                          const pts = s.recentScores.slice().reverse();
                          const w=300, h=60, padL=28, padB=16;
                          const xs = pts.map((_,i) => padL + Math.round((i/(pts.length-1))*(w-padL)));
                          const ys = pts.map(v => Math.round(h - padB - ((v/100)*(h-padB-4))));
                          const path = pts.map((v,i) => `${i===0?"M":"L"}${xs[i]},${ys[i]}`).join(" ");
                          const areaPath = `${path} L${xs[xs.length-1]},${h-padB} L${xs[0]},${h-padB} Z`;
                          return (
                            <div style={{ background:sub.bg, borderRadius:8, padding:"10px 8px 4px", marginBottom:12 }}>
                              <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display:"block", overflow:"visible" }}>
                                {/* Y-axis guides */}
                                {[0,50,70,100].map(v => {
                                  const y = Math.round(h - padB - ((v/100)*(h-padB-4)));
                                  return <g key={v}><line x1={padL} y1={y} x2={w} y2={y} stroke={sub.border} strokeWidth="1" strokeDasharray="3,3"/><text x={padL-4} y={y+4} textAnchor="end" fill={sub.accentDim} fontSize="8">{v}</text></g>;
                                })}
                                {/* Area fill */}
                                <path d={areaPath} fill={sub.accent} opacity="0.08" />
                                {/* Line */}
                                <path d={path} stroke={sub.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                {/* Dots */}
                                {pts.map((v,i) => <circle key={i} cx={xs[i]} cy={ys[i]} r="4" fill={sub.accent} stroke="#fff" strokeWidth="1.5" />)}
                              </svg>
                              <div style={{ display:"flex", justifyContent:"space-between", padding:"0 8px" }}>
                                <div style={{ fontSize:9, color:sub.accentDim }}>← Oldest</div>
                                <div style={{ fontSize:9, color:sub.accentDim }}>Most Recent →</div>
                              </div>
                            </div>
                          );
                        })()}
                        {/* Weak topics */}
                        {s.weakTopics.length > 0 && (
                          <div>
                            <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>Needs Attention</div>
                            {s.weakTopics.map(({topic,count}) => (
                              <div key={topic} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid #F0EEE9" }}>
                                <span style={{ fontSize:12, color:"#555" }}>{topicLabel(topic)}</span>
                                <span style={{ fontSize:11, color:NEG_COLOR, fontFamily:"monospace", fontWeight:700 }}>{count} missed</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {s.weakTopics.length === 0 && s.sessions > 0 && (
                          <div style={{ fontSize:12, color:POS_COLOR, fontWeight:700 }}>✓ No persistent weak spots detected</div>
                        )}
                      </div>
                    );
                  })}
                </>)}

                {/* ════════ AI INSIGHTS TAB ════════ */}
                {dashboardTab === "insights" && (
                  <div>
                    {dashboardInsightsLoading && (
                      <div style={{ textAlign:"center", padding:"48px 0" }}>
                        <div style={{ fontSize:34, display:"inline-block", animation:"spin 1.2s linear infinite", marginBottom:12 }}>⚙</div>
                        <div style={{ color:"#555", fontSize:14 }}>Generating personalized report…</div>
                        <div style={{ color:"#C0BCB8", fontSize:11, marginTop:6 }}>Analyzing all subjects and patterns</div>
                      </div>
                    )}
                    {dashboardInsightsError && <div style={S.err}>{dashboardInsightsError}</div>}
                    {!dashboardInsightsLoading && dashboardInsights && (() => {
                      const ins = dashboardInsights;
                      return (
                        <div style={{ animation:"fade-in .3s ease" }}>
                          {/* Headline */}
                          <div style={{ background:"#EEF3FA", border:"1.5px solid #1E3A5F22", borderRadius:12, padding:"18px 20px", marginBottom:18 }}>
                            <div style={{ fontSize:10, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>Overall Assessment</div>
                            <div style={{ fontSize:16, fontWeight:700, color:"#1E3A5F", lineHeight:1.6 }}>{ins.headline}</div>
                          </div>

                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
                            {/* Strengths */}
                            <div style={{ background:"#F0FDF4", border:"1.5px solid #BBF7D0", borderRadius:12, padding:"16px" }}>
                              <div style={{ fontSize:10, color:POS_COLOR, letterSpacing:3, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>✓ Strengths</div>
                              {(ins.strengths||[]).map((s,i) => (
                                <div key={i} style={{ fontSize:13, color:"#166534", lineHeight:1.7, marginBottom:6, paddingLeft:8, borderLeft:`2px solid ${POS_COLOR}` }}>
                                  {s}
                                </div>
                              ))}
                            </div>
                            {/* Growth areas */}
                            <div style={{ background:"#FFF7ED", border:"1.5px solid #FED7AA", borderRadius:12, padding:"16px" }}>
                              <div style={{ fontSize:10, color:"#D97706", letterSpacing:3, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>↑ Growth Areas</div>
                              {(ins.growth_areas||[]).map((s,i) => (
                                <div key={i} style={{ fontSize:13, color:"#92400E", lineHeight:1.7, marginBottom:6, paddingLeft:8, borderLeft:"2px solid #D97706" }}>
                                  {s}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Patterns */}
                          <div style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:12, padding:"16px 18px", marginBottom:14 }}>
                            <div style={{ fontSize:10, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>Learning Patterns</div>
                            <div style={{ fontSize:14, color:"#444", lineHeight:1.85 }}>{ins.patterns}</div>
                          </div>

                          {/* Recommendation */}
                          <div style={{ background:"#FFFBEB", border:"1.5px solid #FDE68A", borderRadius:12, padding:"16px 18px", marginBottom:14 }}>
                            <div style={{ fontSize:10, color:"#92400E", letterSpacing:3, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>💡 Recommended Next Steps</div>
                            <div style={{ fontSize:14, color:"#78350F", lineHeight:1.85 }}>{ins.recommendation}</div>
                          </div>

                          {/* Encouragement */}
                          <div style={{ background:"linear-gradient(135deg, #EEF3FA 0%, #F5F3FF 100%)", border:"1.5px solid #C8D8E8", borderRadius:12, padding:"16px 18px", marginBottom:20 }}>
                            <div style={{ fontSize:10, color:"#1E3A5F", letterSpacing:3, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>To {d.displayName}</div>
                            <div style={{ fontSize:14, color:"#1E3A5F", lineHeight:1.85, fontStyle:"italic" }}>"{ins.encouragement}"</div>
                          </div>

                          <button onClick={() => { setDashboardInsights(null); loadDashboardInsights(); }}
                            style={{ width:"100%", padding:"12px", background:"transparent", border:"1.5px solid #E2DDD8", borderRadius:8, color:"#9A9490", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                            ↺ Regenerate Report
                          </button>
                        </div>
                      );
                    })()}
                    {!dashboardInsightsLoading && !dashboardInsights && !dashboardInsightsError && (
                      <div style={{ textAlign:"center", padding:"32px 0" }}>
                        <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
                        <div style={{ color:"#555", fontSize:14, marginBottom:6 }}>Click "AI Report" tab to generate</div>
                        <div style={{ color:"#C0BCB8", fontSize:11 }}>Uses all session data to write a personalized parent report</div>
                      </div>
                    )}
                  </div>
                )}

              </>);
            })()}
          </div>
        )}

        {/* ── LOADING ── */}
        {screen === "loading" && (
          <div style={{ ...S.card, textAlign:"center" }}>
            <div style={{ fontSize:38, display:"inline-block", animation:"spin 1.2s linear infinite", marginBottom:18 }}>⚙</div>
            <div style={{ fontSize:20, fontWeight:800, color:"#1E3A5F", marginBottom:8 }}>Building your session…</div>
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
                <span style={S.numMeta}>{TIMER_OPTIONS[timerIdx].infinite && timeLeft > 0 ? `${idx+1} answered` : `${idx+1} / ${problems.length}`}</span>
              </div>
            </div>
            <div style={S.prog}><div style={S.progFill(TIMER_OPTIONS[timerIdx].infinite && timeLeft > 0 ? 100 : (idx/problems.length)*100)} /></div>

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
                <div style={{ background:"#F8F6F3", border:"1px solid #222", borderRadius:10, padding:"16px 20px", display:"inline-block", minWidth:"60%" }}>
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
                  <div style={{ background:"#FEF2F2", border:`1px solid ${NEG_COLOR}33`, borderRadius:8, padding:"12px 16px", marginTop:12, color:NEG_COLOR+"88", fontSize:13, fontWeight:700 }}>
                    ✗ Not quite. Keep thinking — hints are off in Challenging mode.
                  </div>
                )}
                {/* Starter / Building: show hint button then reveal */}
                {difficulty < 2 && (
                  <div style={{ marginTop:12 }}>
                    {!showHint && (
                      <button
                        onClick={() => setShowHint(true)}
                        style={{ width:"100%", padding:"11px", background:"#FFFBEB", border:"1px solid #3a3000", borderRadius:8, color:"#7a6a00", fontSize:13, fontWeight:700, cursor:"pointer", letterSpacing:1 }}>
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
                : <button style={S.primaryBtn(false)} onClick={handleNext}>
                  {TIMER_OPTIONS[timerIdx].infinite && timeLeft > 0 ? "Next →" : (idx+1>=problems.length ? "See Results →" : "Next →")}
                </button>}
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
            <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:8 }}>
              {(() => { const dueCount = getDueCount(srsCards, subject?.id||"math"); return dueCount > 0 ? (
                <button className="ghost-hover" onClick={()=>{clearTimer(); startSrsReview();}}
                  style={{ ...S.ghostBtn, background:"#EEF3FA", borderColor:"#1E3A5F33", color:"#1E3A5F", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  🔁 {dueCount} card{dueCount>1?"s":""} due for review
                </button>
              ) : null; })()}
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
              <button className="ghost-hover" style={{ ...S.primaryBtn(false), background:"transparent", border:"1.5px solid #E2DDD8", color:"#9A9490" }} onClick={()=>{clearTimer();setScreen("subjects");}}>Home</button>
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
                    <div key={topic} style={{ background:"#FFFFFF", border:`1px solid ${topicColor(topic)}18`, borderRadius:10, padding:"14px 16px", marginBottom:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                        <span style={S.pill(topic)}>{topicLabel(topic)}</span>
                        <TrendBadge trend={trend}/>
                        <span style={{ marginLeft:"auto", fontFamily:"monospace", fontSize:12, color:"#3a3a3a" }}>avg {avg}%</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <MiniBar value={avg}/>
                        <span style={{ fontFamily:"monospace", fontSize:11, color:avg>=70?POS_COLOR:avg>=40?"#D97706":NEG_COLOR, minWidth:34, textAlign:"right" }}>{avg}%</span>
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
                      <div className="session-row" style={{ background:"#FFFFFF", borderRadius:isEx?"10px 10px 0 0":10, border:"1px solid #1a1a1a", padding:"12px 16px", marginBottom:isEx?0:6, cursor:"pointer", transition:"background .15s" }}
                        onClick={()=>setExpandedSession(isEx?null:s.id)}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                          <span style={{ fontFamily:"monospace", fontSize:11, color:"#333", minWidth:155 }}>{fmtDate(s.date)}</span>
                          <span style={{ fontFamily:"monospace", fontSize:14, fontWeight:800, color:sp>=70?POS_COLOR:sp>=40?"#D97706":NEG_COLOR }}>{s.correct}/{s.total}</span>
                          {s.timeSpent>0&&<span style={{ fontSize:11, color:"#2a2a2a", fontFamily:"monospace" }}>⏱ {fmt(s.timeSpent)}</span>}
                          <span style={{ fontSize:10, color:"#2a2a2a", letterSpacing:1, textTransform:"uppercase" }}>{DIFFICULTY_LABELS[s.difficulty]}</span>
                          <span style={{ marginLeft:"auto", fontSize:12, color:"#2a2a2a" }}>{isEx?"▲":"▼"}</span>
                        </div>
                      </div>
                      {isEx && (
                        <div style={{ background:"#F8F6F3", border:"1px solid #1a1a1a", borderTop:"none", borderRadius:"0 0 10px 10px", padding:"14px 16px", marginBottom:6, animation:"fade-in .2s ease" }}>
                          {TOPICS.map((topic) => {
                            const rows = s.log.filter((l)=>l.topic===topic);
                            if (!rows.length) return null;
                            const ok = rows.filter((r)=>r.ok).length;
                            const p = pct(ok,rows.length);
                            return (<div key={topic} style={{ marginBottom:8 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                                <span style={S.pill(topic)}>{topicLabel(topic)}</span>
                                <span style={{ fontFamily:"monospace", fontSize:12, color:p>=70?POS_COLOR:p>=40?"#D97706":NEG_COLOR }}>{ok}/{rows.length} ({p}%)</span>
                              </div>
                              <MiniBar value={p}/>
                            </div>);
                          })}
                          {s.log.filter((l)=>!l.ok).length>0&&(
                            <div style={{ marginTop:12, borderTop:"1px solid #F0EEE9", paddingTop:12 }}>
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
                        <button style={{ background:"#FEF2F2", border:`1px solid ${NEG_COLOR}44`, borderRadius:6, color:NEG_COLOR, fontSize:12, padding:"5px 12px", cursor:"pointer", fontWeight:700 }} onClick={async()=>{await clearSessions();setSessions([]);setConfirmClear(false);}}>Yes, clear</button>
                        <button style={{ background:"transparent", border:"1px solid #E2DDD8", borderRadius:6, color:"#444", fontSize:12, padding:"5px 12px", cursor:"pointer" }} onClick={()=>setConfirmClear(false)}>Cancel</button>
                      </div>}
                </div>
              </>);
            })()}
            <div style={{ ...S.btnRow, marginTop:24 }}>
              <button style={S.primaryBtn(false)} onClick={()=>startSession(null,null)}>Start Session</button>
              <button className="ghost-hover" style={{ ...S.primaryBtn(false), background:"transparent", border:"1.5px solid #E2DDD8", color:"#9A9490" }} onClick={()=>setScreen("upload")}>Home</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
