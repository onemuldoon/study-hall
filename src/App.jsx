import { useState, useCallback, useRef, useEffect } from "react";
import { storage } from "./lib/supabase.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const DIFFICULTY_LABELS = ["Starter", "Building", "Challenging"];
const DIFFICULTY_WEIGHTS = [1.0, 1.5, 2.2]; // mastery score multipliers per level
const DIFFICULTY_COLORS = ["#60a5fa", "#f0a050", "#c084fc"];
function masteryScore(correct, total, difficulty) {
  if (!total) return 0;
  const w = DIFFICULTY_WEIGHTS[difficulty] || 1.0;
  return Math.round((correct / total) * 100 * w);
}
function masteryLabel(score) {
  if (score >= 180) return "Elite";
  if (score >= 140) return "Advanced";
  if (score >= 110) return "Proficient";
  if (score >= 80)  return "Developing";
  return "Building";
}
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
// ─── Subject Icons — stroke-based SVG, Scandinavian minimal ─────────────────
function SubjectIcon({ id, size = 24, color, strokeWidth = 1.8 }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  const vb = "0 0 24 24";
  switch (id) {
    case "math": return (
      // Coordinate axes with rising graph line
      <svg width={size} height={size} viewBox={vb}>
        <line x1="3" y1="21" x2="21" y2="21" {...p}/>
        <line x1="3" y1="3" x2="3" y2="21" {...p}/>
        <polyline points="3,17 7,11 11,14 16,7 21,5" {...p}/>
        <polyline points="19,5 21,5 21,7" {...p}/>
      </svg>
    );
    case "science": return (
      // Erlenmeyer flask
      <svg width={size} height={size} viewBox={vb}>
        <path d="M9 3h6M9 3v6L4 19a1 1 0 0 0 .9 1.4h14.2A1 1 0 0 0 20 19L15 9V3" {...p}/>
        <line x1="5.5" y1="15" x2="18.5" y2="15" {...p}/>
      </svg>
    );
    case "social_studies": return (
      // Globe with latitude/longitude lines
      <svg width={size} height={size} viewBox={vb}>
        <circle cx="12" cy="12" r="9" {...p}/>
        <ellipse cx="12" cy="12" rx="4" ry="9" {...p}/>
        <line x1="3" y1="9" x2="21" y2="9" {...p}/>
        <line x1="3" y1="15" x2="21" y2="15" {...p}/>
      </svg>
    );
    case "grammar": return (
      // Pen nib writing a line
      <svg width={size} height={size} viewBox={vb}>
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" {...p}/>
        <line x1="15" y1="5" x2="19" y2="9" {...p}/>
        <line x1="3" y1="21" x2="7" y2="20" {...p}/>
      </svg>
    );
    case "latin": return (
      // Classical column
      <svg width={size} height={size} viewBox={vb}>
        <rect x="5" y="3" width="14" height="2" rx="0.5" {...p}/>
        <rect x="5" y="19" width="14" height="2" rx="0.5" {...p}/>
        <line x1="8" y1="5" x2="8" y2="19" {...p}/>
        <line x1="12" y1="5" x2="12" y2="19" {...p}/>
        <line x1="16" y1="5" x2="16" y2="19" {...p}/>
        <line x1="3" y1="21" x2="21" y2="21" {...p}/>
      </svg>
    );
    case "english": return (
      // Open book
      <svg width={size} height={size} viewBox={vb}>
        <path d="M2 5a2 2 0 0 1 2-2h7v18H4a2 2 0 0 1-2-2V5z" {...p}/>
        <path d="M22 5a2 2 0 0 0-2-2h-7v18h7a2 2 0 0 0 2-2V5z" {...p}/>
        <line x1="12" y1="3" x2="12" y2="21" {...p}/>
        <line x1="6" y1="9" x2="9" y2="9" {...p}/>
        <line x1="6" y1="13" x2="9" y2="13" {...p}/>
        <line x1="15" y1="9" x2="18" y2="9" {...p}/>
        <line x1="15" y1="13" x2="18" y2="13" {...p}/>
      </svg>
    );
    case "religion": return (
      // Simple cross, slightly proportioned like a Latin cross
      <svg width={size} height={size} viewBox={vb}>
        <line x1="12" y1="2" x2="12" y2="22" {...p}/>
        <line x1="4" y1="8" x2="20" y2="8" {...p}/>
      </svg>
    );
    default: return (
      <svg width={size} height={size} viewBox={vb}>
        <circle cx="12" cy="12" r="9" {...p}/>
        <line x1="12" y1="8" x2="12" y2="16" {...p}/>
        <line x1="8" y1="12" x2="16" y2="12" {...p}/>
      </svg>
    );
  }
}


// ─── Admin Starter Packs ──────────────────────────────────────────────────────
// Pre-seeded library topics per subject, based on known curriculum
const STARTER_PACKS = {
  math: [
    {
      topicKey: "positive_negative_numbers",
      topicName: "Positive & Negative Numbers",
      description: "Adding, subtracting, and comparing integers on a number line",
      gradeLevel: "6th Grade · Saxon Math 7/6",
      difficultyNotes: "Students add and subtract integers with values between −20 and +20. They use a number line to visualise movement. Problems involve simple one-step operations: −7 + 4, 5 − 9, −3 − 6. No multiplication or division of negatives yet. No parentheses. Answer always fits on a −20 to +20 number line.",
      exemplarQuestions: [
        { question: "−4 + 7 = ?", answer: "3" },
        { question: "8 − 12 = ?", answer: "−4" },
        { question: "Which is greater: −5 or −2?", answer: "−2" },
      ]
    },
    {
      topicKey: "order_of_operations_pemdas",
      topicName: "Order of Operations (PEMDAS)",
      description: "Evaluating expressions with multiple operations in the correct order",
      gradeLevel: "6th Grade · Saxon Math 7/6",
      difficultyNotes: "Students evaluate expressions with 3–5 operations using whole numbers only (no variables, no negatives inside expressions). Exponents limited to squared numbers up to 5². Parentheses appear in about half the problems. Multiplication and division use simple single-digit multipliers. Example difficulty: 3 + 4 × 2, (6 − 2)² + 1, 18 ÷ 3 + 5 × 2.",
      exemplarQuestions: [
        { question: "3 + 4 × 2 = ?", answer: "11" },
        { question: "(8 − 3) × 2 + 1 = ?", answer: "11" },
        { question: "2² + 3 × 4 − 5 = ?", answer: "11" },
      ]
    },
    {
      topicKey: "fractions_operations",
      topicName: "Fractions: Add, Subtract & Compare",
      description: "Adding and subtracting fractions with unlike denominators; comparing fractions",
      gradeLevel: "6th Grade · Saxon Math 7/6",
      difficultyNotes: "Students add and subtract fractions with unlike denominators up to 12. They find the LCD, convert, and simplify. Mixed numbers appear in some problems but improper fractions should be converted back to mixed numbers in the answer. Comparisons use >, <, or = with fractions and mixed numbers. No complex multi-step word problems — just the operation itself.",
      exemplarQuestions: [
        { question: "1/2 + 3/8 = ?", answer: "7/8" },
        { question: "3/4 − 1/6 = ?", answer: "7/12" },
        { question: "Which is greater: 3/5 or 5/8?", answer: "5/8" },
      ]
    },
    {
      topicKey: "coordinate_graphing",
      topicName: "Graphing on the Coordinate Plane",
      description: "Plotting points, identifying quadrants, and reading coordinates",
      gradeLevel: "6th Grade · Saxon Math 7/6",
      difficultyNotes: "Students plot and identify points on a standard coordinate plane (x and y from −5 to +5). Questions ask which quadrant a point is in, what the coordinates of a plotted point are, or which of four labeled points matches a given coordinate. No lines or slope yet — only individual points. Coordinates use integers only, no fractions.",
      exemplarQuestions: [
        { question: "What quadrant is (−3, 2) in?", answer: "Quadrant II" },
        { question: "Plot A(2, −4). Which quadrant?", answer: "Quadrant IV" },
      ]
    },
    {
      topicKey: "ratios_proportions",
      topicName: "Ratios & Proportions",
      description: "Writing ratios, equivalent ratios, and solving simple proportions",
      gradeLevel: "6th Grade",
      difficultyNotes: "Students write ratios in three forms (a:b, a/b, 'a to b'), find equivalent ratios by multiplying or dividing, and solve one-step proportions using cross-multiplication. Numbers stay manageable (under 50). Word problems describe simple real-life situations: recipes, maps, speed. No percent yet.",
      exemplarQuestions: [
        { question: "3/4 = ?/12", answer: "9" },
        { question: "A recipe uses 2 cups flour for 3 cups sugar. For 9 cups sugar, how much flour?", answer: "6 cups" },
      ]
    },
  ],
  science: [
    {
      topicKey: "cell_structure",
      topicName: "Cell Structure & Function",
      description: "Plant vs animal cells, organelles and their jobs",
      gradeLevel: "6th Grade Life Science",
      difficultyNotes: "Students identify and describe the function of 6–8 key organelles: nucleus (control centre), cell membrane (gatekeeper), mitochondria (energy/ATP), cell wall (plant only, rigid structure), chloroplast (plant only, photosynthesis), vacuole (storage; large central vacuole in plants), ribosomes (protein synthesis), cytoplasm (fluid that fills cell). Questions ask to match organelle to function, or identify what's unique to plant vs animal cells. Vocabulary is at standard 6th-grade level — no biochemistry.",
      exemplarQuestions: [
        { question: "Which organelle is found in plant cells but NOT animal cells?", answer: "Cell wall" },
        { question: "What is the function of the mitochondria?", answer: "Produces energy (ATP) for the cell" },
      ]
    },
    {
      topicKey: "ecosystems_food_webs",
      topicName: "Ecosystems & Food Webs",
      description: "Producers, consumers, decomposers, food chains and food webs",
      gradeLevel: "6th Grade Life Science",
      difficultyNotes: "Students classify organisms as producer/primary consumer/secondary consumer/tertiary consumer/decomposer. They trace energy flow through a food chain (sun → plant → herbivore → carnivore). They understand that energy decreases at each trophic level (~10% rule conceptually, not mathematically). Questions use real organisms from common ecosystems (grassland, forest, ocean). Students must identify what would happen if one species was removed.",
      exemplarQuestions: [
        { question: "Which organism is the producer in: grass → rabbit → fox?", answer: "Grass" },
        { question: "What role does a mushroom play in an ecosystem?", answer: "Decomposer" },
      ]
    },
    {
      topicKey: "earth_layers_plate_tectonics",
      topicName: "Earth's Layers & Plate Tectonics",
      description: "Crust, mantle, outer core, inner core; tectonic plates and landform creation",
      gradeLevel: "6th Grade Earth Science",
      difficultyNotes: "Students name the four layers (crust, mantle, outer core, inner core) and describe each: state of matter, approximate composition, key properties. They understand that tectonic plates move on the mantle (convection currents). They know the three plate boundary types: convergent (mountains, trenches), divergent (rift valleys, mid-ocean ridges), transform (earthquakes). Questions are definitional and classification-based, not quantitative.",
      exemplarQuestions: [
        { question: "Which layer of Earth is liquid and made mostly of iron?", answer: "Outer core" },
        { question: "What type of boundary creates mountains when two continental plates collide?", answer: "Convergent boundary" },
      ]
    },
    {
      topicKey: "forces_motion",
      topicName: "Forces & Motion",
      description: "Newton's three laws, gravity, friction, balanced vs unbalanced forces",
      gradeLevel: "6th Grade Physical Science",
      difficultyNotes: "Students state and apply Newton's Three Laws: 1st (inertia), 2nd (F=ma, conceptually — no algebra required), 3rd (action-reaction). They distinguish balanced forces (no change in motion) from unbalanced forces (change in motion). They identify friction and gravity in everyday situations. No calculations — all conceptual. Questions describe a scenario and ask which law applies, or predict what happens.",
      exemplarQuestions: [
        { question: "A soccer ball rolling on grass slows down. Which force is acting on it?", answer: "Friction" },
        { question: "Newton's First Law says an object at rest stays at rest unless acted on by what?", answer: "An unbalanced (net) force" },
      ]
    },
    {
      topicKey: "weather_water_cycle",
      topicName: "Weather & the Water Cycle",
      description: "Evaporation, condensation, precipitation, the atmosphere, weather patterns",
      gradeLevel: "6th Grade Earth Science",
      difficultyNotes: "Students sequence the water cycle steps (evaporation → condensation → precipitation → runoff/collection) and explain what happens at each stage. They name the layers of the atmosphere (troposphere, stratosphere, mesosphere, thermosphere) and know weather occurs in the troposphere. They distinguish weather from climate. Questions are descriptive and definitional, not quantitative.",
      exemplarQuestions: [
        { question: "Water vapour cools and forms clouds. This process is called what?", answer: "Condensation" },
        { question: "In which layer of the atmosphere does weather occur?", answer: "Troposphere" },
      ]
    },
  ],
  latin: [
    {
      topicKey: "latin_first_declension",
      topicName: "First Declension Nouns",
      description: "Endings for 1st declension nouns (-a, -ae) in all cases",
      gradeLevel: "Latin I · Beginner",
      difficultyNotes: "Students know the six cases (nominative, genitive, dative, accusative, ablative, vocative) and can give the correct ending for a 1st declension noun (e.g. puella, aqua, silva, rosa). Questions ask to identify the case of a noun in a sentence, choose the correct ending, or translate a single noun form. No verb agreement required — just noun recognition. Vocabulary limited to ~20 common 1st declension nouns.",
      exemplarQuestions: [
        { question: "What is the genitive singular of 'puella'?", answer: "puellae" },
        { question: "In 'puellam video', what case is 'puellam'?", answer: "Accusative" },
      ]
    },
    {
      topicKey: "latin_second_declension",
      topicName: "Second Declension Nouns",
      description: "Masculine and neuter 2nd declension endings (-us/-er, -um)",
      gradeLevel: "Latin I · Beginner",
      difficultyNotes: "Students decline 2nd declension masculine nouns (servus, dominus, puer, ager) and neuter nouns (bellum, oppidum). Questions focus on identifying case from ending, choosing correct form, and distinguishing masculine from neuter in the nominative/accusative. Common error: neuter accusative = neuter nominative. Vocabulary limited to ~25 common 2nd declension nouns introduced in standard beginner texts.",
      exemplarQuestions: [
        { question: "What is the accusative plural of 'servus'?", answer: "servos" },
        { question: "How do neuter nouns differ from masculine in the accusative singular?", answer: "They use -um just like the nominative (they are the same form)" },
      ]
    },
    {
      topicKey: "latin_present_tense_verbs",
      topicName: "Present Tense Verb Conjugation",
      description: "1st and 2nd conjugation verbs in present tense (all persons)",
      gradeLevel: "Latin I · Beginner",
      difficultyNotes: "Students conjugate 1st conjugation (-are: amare, portare, vocare) and 2nd conjugation (-ere: videre, habere, tenere) verbs in the present tense for all 6 persons (sing: -o/-m, -s, -t; pl: -mus, -tis, -nt). Questions ask to identify person/number from a conjugated form, supply the correct form, or translate a simple verb form. No compound tenses — present tense only.",
      exemplarQuestions: [
        { question: "What person and number is 'amatis'?", answer: "2nd person plural (you all love)" },
        { question: "Give the 3rd person singular present of 'videre'?", answer: "videt" },
      ]
    },
    {
      topicKey: "latin_vocabulary_core",
      topicName: "Core Latin Vocabulary",
      description: "Essential Latin words — common nouns, verbs, adjectives and their meanings",
      gradeLevel: "Latin I · Beginner",
      difficultyNotes: "Students translate common Latin words to English and vice versa. Vocabulary drawn from standard beginner lists: body parts, family members, common actions (amare, videre, portare, esse, habere), time words (nunc, semper, saepe, numquam), location words (hic, ibi, in, ad), basic adjectives (bonus, malus, magnus, parvus, longus). Questions are direct vocabulary recall — no sentences required.",
      exemplarQuestions: [
        { question: "What does 'semper' mean?", answer: "Always" },
        { question: "What is the Latin word for 'war'?", answer: "bellum" },
      ]
    },
    {
      topicKey: "latin_sentence_translation",
      topicName: "Simple Latin Sentence Translation",
      description: "Translate short Latin sentences using 1st/2nd declension nouns and present tense verbs",
      gradeLevel: "Latin I · Beginner",
      difficultyNotes: "Students translate sentences of 3–6 words using vocabulary and grammar already learned (1st/2nd declension, present tense). Subject-verb-object sentences. No subordinate clauses. No irregular verbs except esse. Adjectives agree with nouns in case, number, and gender but questions focus on meaning, not on explaining the agreement. Difficulty is 'read the sentence and pick the best translation from 4 options'.",
      exemplarQuestions: [
        { question: "Translate: 'Puella aquam portat.'", answer: "The girl carries water." },
        { question: "Translate: 'Servi in villa laborant.'", answer: "The slaves work in the farmhouse." },
      ]
    },
  ],
  english: [
    {
      topicKey: "silver_chair_plot",
      topicName: "The Silver Chair: Plot & Events",
      description: "Key events, chapter sequence, and cause & effect in The Silver Chair",
      gradeLevel: "6th Grade · C.S. Lewis · The Chronicles of Narnia",
      difficultyNotes: "Students recall specific plot events: Jill and Eustace's arrival in Narnia via Aslan's Country, the Four Signs (exact wording matters), the Marsh-wiggle Puddleglum joining their quest, the Lady of the Green Kirtle and the Black Knight (Prince Rilian), the underground kingdom of Underland, the giants at Harfang, and the final freeing of Rilian. Questions ask about sequence ('what happened first'), cause-and-effect ('why did X happen'), and specific details ('where did they sleep at Harfang'). Students have read the book and know it well.",
      exemplarQuestions: [
        { question: "What are the Four Signs Aslan gives Jill at the start of her quest?", answer: "1) Greet the first friend in Narnia, 2) Journey to the ruined city of giants, 3) In the ruined city, write on a stone the words they find there, 4) When the lost prince asks them to do something in Aslan's name, they must do it" },
        { question: "Who is the Black Knight revealed to be?", answer: "Prince Rilian, the lost son of King Caspian" },
      ]
    },
    {
      topicKey: "silver_chair_characters",
      topicName: "The Silver Chair: Characters",
      description: "Analysing Jill, Eustace, Puddleglum, Rilian, the Lady of the Green Kirtle, and Aslan",
      gradeLevel: "6th Grade · C.S. Lewis · The Chronicles of Narnia",
      difficultyNotes: "Questions focus on character traits backed by evidence from the text: Jill's initial cowardice and growth into courage, Eustace's continued transformation from Dragon Dawn Treader, Puddleglum's pessimistic speech masking fierce loyalty and courage (his speech to the Green Witch is important), Prince Rilian's enchantment and the hour of sanity, the Lady of the Green Kirtle as the White Witch parallel. Questions are interpretive, not just factual — 'why does Puddleglum do X' not just 'what is Puddleglum'.",
      exemplarQuestions: [
        { question: "How does Puddleglum break the Green Witch's enchantment?", answer: "He stamps on the fire with his bare foot, using pain to clear his mind and make the defiant speech about believing in Aslan even if Narnia isn't real" },
        { question: "How has Eustace changed since 'The Voyage of the Dawn Treader'?", answer: "He is no longer selfish and bullying; he is braver and kinder, though still imperfect" },
      ]
    },
    {
      topicKey: "silver_chair_themes",
      topicName: "The Silver Chair: Themes & Symbols",
      description: "Obedience, the Four Signs, hope, temptation, and Lewis's symbolism",
      gradeLevel: "6th Grade · C.S. Lewis · The Chronicles of Narnia",
      difficultyNotes: "Questions explore major themes: 1) Obedience — Jill and Eustace repeatedly forget or disobey the Signs, which leads to their failures; 2) Temptation — Harfang represents comfort and pleasure as obstacles to the quest; 3) Hope — Puddleglum's famous speech about choosing to believe in Aslan even without proof; 4) Darkness vs. Light — the underground kingdom vs. Narnia above. Students can discuss these themes and support with examples. Questions ask students to identify a theme or explain what a symbol represents.",
      exemplarQuestions: [
        { question: "What does Harfang represent as a theme in the story?", answer: "The temptation of comfort and ease — it distracts the travellers from their quest" },
        { question: "What is the main lesson Jill learns about the Four Signs?", answer: "That she must learn them perfectly and recite them every day, not relying on memory alone — obedience requires practice" },
      ]
    },
    {
      topicKey: "literary_devices_narnia",
      topicName: "Literary Devices in The Silver Chair",
      description: "Foreshadowing, symbolism, irony, characterisation, and imagery in Lewis's writing",
      gradeLevel: "6th Grade ELA · Literary Analysis",
      difficultyNotes: "Students identify and explain literary devices in passages: foreshadowing (early signs of the Green Witch's evil), symbolism (the silver chair as enchantment/imprisonment), irony (the children looking for Rilian without recognising him as the Black Knight), imagery (descriptions of Underland). Questions give a short passage or describe a scene and ask students to identify which device is used and explain it. Students have a working knowledge of: foreshadowing, symbolism, irony (situational and dramatic), imagery, personification, simile, metaphor.",
      exemplarQuestions: [
        { question: "What literary device is used when the reader knows the Black Knight is Rilian before Jill does?", answer: "Dramatic irony" },
        { question: "What does the Silver Chair symbolise?", answer: "Enchantment, imprisonment, and the power the Green Witch holds over Rilian's mind" },
      ]
    },
  ],
  religion: [
    {
      topicKey: "the_creed_core_beliefs",
      topicName: "The Creed & Core Catholic Beliefs",
      description: "The Apostles' and Nicene Creed: Trinity, Incarnation, Resurrection, the Church",
      gradeLevel: "6th Grade · Catholic Catechism · CCC 185–1065",
      difficultyNotes: "Students can recite and explain the Apostles' Creed. Questions focus on: the Trinity (Father, Son, Holy Spirit — one God, three Persons), the Incarnation (Jesus is fully God and fully man), the Resurrection (bodily resurrection on the third day), the Ascension, the Last Judgement, the communion of saints, forgiveness of sins, and eternal life. Students know the difference between the Apostles' Creed and the Nicene Creed. Questions are at a 6th-grade understanding level — theological precision expected but no Latin terminology required.",
      exemplarQuestions: [
        { question: "What do Catholics mean when they say Jesus is 'fully God and fully man'?", answer: "The Incarnation — the Second Person of the Trinity took on a human nature without losing his divine nature (two natures, one Person)" },
        { question: "What is the Trinity?", answer: "One God in Three Persons: Father, Son (Jesus Christ), and Holy Spirit" },
      ]
    },
    {
      topicKey: "the_seven_sacraments",
      topicName: "The Seven Sacraments",
      description: "Names, purpose, matter and form of each sacrament; sacraments of initiation, healing, and service",
      gradeLevel: "6th Grade · Catholic Catechism · CCC 1210–1666",
      difficultyNotes: "Students know all seven sacraments by name and can categorise them (Initiation: Baptism, Confirmation, Eucharist; Healing: Reconciliation, Anointing of the Sick; Service: Holy Orders, Matrimony). For the three Sacraments of Initiation and Reconciliation they know the matter (physical element: water, chrism, bread/wine, words of absolution) and form (words said). They know the ordinary minister of each. Questions ask for classification, identification of elements, and purpose.",
      exemplarQuestions: [
        { question: "Name the three Sacraments of Initiation.", answer: "Baptism, Confirmation, and the Eucharist" },
        { question: "What is the 'matter' (physical element) of Baptism?", answer: "Water" },
        { question: "What is the purpose of the Sacrament of Reconciliation?", answer: "To forgive sins committed after Baptism and restore the soul to God's grace" },
      ]
    },
    {
      topicKey: "ten_commandments",
      topicName: "The Ten Commandments",
      description: "All ten commandments, their meaning, and how they guide moral life",
      gradeLevel: "6th Grade · Catholic Catechism · CCC 2052–2557",
      difficultyNotes: "Students know all Ten Commandments in order, in their Catholic numbering (differs from Protestant — Catholics combine the 1st and 2nd Protestant commandments and split the last). They can explain what each commandment requires and forbids in practical terms. They understand that the first three relate to love of God, and the last seven to love of neighbour. Questions ask to name a commandment by number, identify which commandment is being violated in a scenario, or explain what the commandment means.",
      exemplarQuestions: [
        { question: "What is the Third Commandment?", answer: "Remember to keep holy the Lord's Day (Keep the Sabbath holy)" },
        { question: "A student copies a friend's homework. Which commandment does this violate?", answer: "The Seventh Commandment — You shall not steal" },
      ]
    },
    {
      topicKey: "beatitudes_sermon_mount",
      topicName: "The Beatitudes",
      description: "All eight Beatitudes, their meaning, and their connection to discipleship",
      gradeLevel: "6th Grade · Catholic Catechism · Matthew 5:3–10",
      difficultyNotes: "Students know all eight Beatitudes from Matthew 5:3–10 (e.g. 'Blessed are the poor in spirit, for theirs is the kingdom of heaven'). They can explain what each Beatitude means in practical terms — who it describes and what reward is promised. They understand the Beatitudes as the heart of Jesus's moral teaching, going beyond the Ten Commandments to interior disposition. Questions ask to complete a Beatitude, identify who is being described, or explain its meaning.",
      exemplarQuestions: [
        { question: "Complete the Beatitude: 'Blessed are the pure in heart...'", answer: "'...for they shall see God'" },
        { question: "What does 'poor in spirit' mean in the First Beatitude?", answer: "Being humble and recognising one's complete dependence on God, not proud or self-reliant" },
      ]
    },
    {
      topicKey: "works_of_mercy",
      topicName: "Works of Mercy",
      description: "Corporal and Spiritual Works of Mercy — what they are and how to practice them",
      gradeLevel: "6th Grade · Catholic Catechism · CCC 2447",
      difficultyNotes: "Students know all seven Corporal Works of Mercy (feed the hungry, give drink to the thirsty, clothe the naked, shelter the homeless, visit the sick, visit the imprisoned, bury the dead) and all seven Spiritual Works of Mercy (counsel the doubtful, instruct the ignorant, admonish the sinner, comfort the sorrowful, forgive offences, bear wrongs patiently, pray for the living and dead). They can classify a described action as a Work of Mercy and identify which one. They understand these flow from Matthew 25.",
      exemplarQuestions: [
        { question: "Name three Corporal Works of Mercy.", answer: "Any three of: feed the hungry, give drink to the thirsty, clothe the naked, shelter the homeless, visit the sick, visit the imprisoned, bury the dead" },
        { question: "A student patiently listens to a classmate who is grieving. Which Spiritual Work of Mercy is this?", answer: "Comfort the sorrowful" },
      ]
    },
  ],
};
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

// ─── Visual Renderers ────────────────────────────────────────────────────────
// Dispatcher: renders the correct visual based on prob.visual.type
function QuestionVisual({ visual, submitted, isCorrect }) {
  if (!visual?.type) return null;
  const V = visual;
  switch (V.type) {
    case "fraction_bar":     return <FractionBar v={V} />;
    case "fraction_compare": return <FractionCompare v={V} />;
    case "geometry":         return <GeometryShape v={V} />;
    case "bar_chart":        return <DataBarChart v={V} />;
    case "line_chart":       return <DataLineChart v={V} />;
    case "labeled_diagram":  return <LabeledDiagram v={V} submitted={submitted} isCorrect={isCorrect} />;
    case "venn":             return <VennDiagram v={V} />;
    case "sentence_diagram": return <SentenceDiagram v={V} />;
    case "timeline":         return <TimelineVisual v={V} />;
    default: return null;
  }
}

// ── Fraction Bar ──────────────────────────────────────────────────────────────
function FractionBar({ v }) {
  const { numerator: n, denominator: d, highlight = [], color = "#1E3A5F" } = v;
  if (!d || d < 1 || d > 20) return null;
  const W = 300, H = 48, segW = W / d;
  const hiSet = new Set(highlight.length ? highlight : Array.from({length:n},(_,i)=>i));
  return (
    <div style={{ margin:"0 0 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {Array.from({length:d},(_,i) => (
          <g key={i}>
            <rect x={i*segW+1} y={1} width={segW-2} height={H-2}
              fill={hiSet.has(i) ? color : "#F0EEE9"}
              stroke={color} strokeWidth={1.5} rx={3} />
            <text x={i*segW+segW/2} y={H/2+5} textAnchor="middle"
              fill={hiSet.has(i)?"#fff":"#9A9490"} fontSize={11} fontWeight={700}>
              {hiSet.has(i) ? "✓" : ""}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ fontFamily:"monospace", fontSize:15, fontWeight:800, color }}>
        {n}/{d} = {Math.round(n/d*100)}%
      </div>
    </div>
  );
}

// ── Fraction Compare ──────────────────────────────────────────────────────────
function FractionCompare({ v }) {
  const { fractions = [] } = v;
  if (!fractions.length) return null;
  const colors = ["#1E3A5F","#c084fc","#60a5fa","#f0a050"];
  const W = 280, H = 36;
  return (
    <div style={{ margin:"0 0 18px", display:"flex", flexDirection:"column", gap:8, alignItems:"center" }}>
      {fractions.map((fr, fi) => {
        const { n, d, label } = fr;
        if (!d) return null;
        const segW = W / d;
        const color = colors[fi % colors.length];
        return (
          <div key={fi} style={{ display:"flex", alignItems:"center", gap:10, width:"100%" }}>
            <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:800, color, minWidth:36, textAlign:"right" }}>{n}/{d}</div>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ flex:1 }}>
              {Array.from({length:d},(_,i) => (
                <rect key={i} x={i*segW+1} y={1} width={segW-2} height={H-2}
                  fill={i < n ? color : "#F0EEE9"} stroke={color} strokeWidth={1.5} rx={3}/>
              ))}
            </svg>
            {label && <div style={{ fontSize:11, color:"#9A9490", minWidth:30 }}>{label}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Geometry Shape ────────────────────────────────────────────────────────────
function GeometryShape({ v }) {
  const { shape = "triangle", sides = [], angles = [], labels = {}, color = "#1E3A5F" } = v;
  const W = 280, H = 200;
  const cx = W/2, cy = H/2;
  let shapeEl = null, labelEls = [];

  if (shape === "triangle") {
    // right-leaning triangle
    const pts = [[cx-80, cy+60],[cx+80, cy+60],[cx-80, cy-60]];
    const d = pts.map((p,i)=>`${i===0?"M":"L"}${p[0]},${p[1]}`).join(" ")+"Z";
    shapeEl = <path d={d} fill={color+"15"} stroke={color} strokeWidth={2.5} strokeLinejoin="round"/>;
    // side labels: midpoints
    const midpoints = [
      [(pts[0][0]+pts[1][0])/2, (pts[0][1]+pts[1][1])/2+14], // bottom
      [(pts[1][0]+pts[2][0])/2+18, (pts[1][1]+pts[2][1])/2],   // right
      [(pts[0][0]+pts[2][0])/2-18, (pts[0][1]+pts[2][1])/2],   // left
    ];
    sides.forEach((s,i) => {
      if (midpoints[i]) labelEls.push(
        <text key={"s"+i} x={midpoints[i][0]} y={midpoints[i][1]} textAnchor="middle"
          fill="#555" fontSize={13} fontWeight={700}>{s}</text>
      );
    });
    // vertex angle labels
    const verts = [
      [pts[0][0]-14, pts[0][1]+6],
      [pts[1][0]+14, pts[1][1]+6],
      [pts[2][0]-14, pts[2][1]-6],
    ];
    angles.forEach((a,i) => {
      if (verts[i]) labelEls.push(
        <text key={"a"+i} x={verts[i][0]} y={verts[i][1]} textAnchor="middle"
          fill={color} fontSize={11} fontWeight={800}>{a}</text>
      );
    });
    // vertex letter labels
    Object.entries(labels).forEach(([letter, pos], i) => {
      const idx = ["A","B","C"].indexOf(letter);
      if (idx >= 0) {
        const offsets = [[-20,8],[22,8],[-20,-8]];
        labelEls.push(
          <text key={"l"+letter} x={pts[idx][0]+offsets[idx][0]} y={pts[idx][1]+offsets[idx][1]}
            fill={color} fontSize={14} fontWeight={900}>{letter}</text>
        );
      }
    });
    // right angle marker
    if (angles.some(a => a === "90°")) {
      labelEls.push(<rect key="ra" x={pts[0][0]} y={pts[0][1]-14} width={12} height={12}
        fill="none" stroke={color} strokeWidth={1.5}/>);
    }
  } else if (shape === "rectangle") {
    const x0=cx-90, y0=cy-45, rw=180, rh=90;
    shapeEl = <rect x={x0} y={y0} width={rw} height={rh} fill={color+"15"} stroke={color} strokeWidth={2.5} rx={4}/>;
    // side labels
    if (sides[0]) labelEls.push(<text key="s0" x={cx} y={y0-8} textAnchor="middle" fill="#555" fontSize={13} fontWeight={700}>{sides[0]}</text>);
    if (sides[1]) labelEls.push(<text key="s1" x={x0+rw+10} y={cy+5} textAnchor="start" fill="#555" fontSize={13} fontWeight={700}>{sides[1]}</text>);
    if (sides[2]) labelEls.push(<text key="s2" x={cx} y={y0+rh+18} textAnchor="middle" fill="#555" fontSize={13} fontWeight={700}>{sides[2]||sides[0]}</text>);
    if (sides[3]) labelEls.push(<text key="s3" x={x0-10} y={cy+5} textAnchor="end" fill="#555" fontSize={13} fontWeight={700}>{sides[3]||sides[1]}</text>);
  } else if (shape === "circle") {
    const r = 65;
    shapeEl = <circle cx={cx} cy={cy} r={r} fill={color+"15"} stroke={color} strokeWidth={2.5}/>;
    if (sides[0]) { // radius label
      shapeEl = <>{shapeEl}<line x1={cx} y1={cy} x2={cx+r} y2={cy} stroke={color} strokeWidth={1.5} strokeDasharray="4,3"/>
        <text x={cx+r/2} y={cy-8} textAnchor="middle" fill="#555" fontSize={13} fontWeight={700}>{sides[0]}</text></>;
    }
  } else if (shape === "trapezoid") {
    // sides: [top_base, bottom_base, left_leg, right_leg]  height: string
    const { height } = v;
    const bW = 176, tW = 108, th = 108;
    const bY = cy + th/2, tY = cy - th/2;
    const bL = cx - bW/2, bR = cx + bW/2;
    const tL = cx - tW/2, tR = cx + tW/2;
    const pts = [[tL,tY],[tR,tY],[bR,bY],[bL,bY]];
    const d = pts.map((p,i)=>`${i===0?"M":"L"}${p[0]},${p[1]}`).join(" ")+"Z";
    shapeEl = <path d={d} fill={color+"15"} stroke={color} strokeWidth={2.5} strokeLinejoin="round"/>;
    // top base label (b1)
    if (sides[0]) labelEls.push(
      <text key="s0" x={cx} y={tY-10} textAnchor="middle" fill="#555" fontSize={13} fontWeight={700}>{sides[0]}</text>
    );
    // bottom base label (b2)
    if (sides[1]) labelEls.push(
      <text key="s1" x={cx} y={bY+18} textAnchor="middle" fill="#555" fontSize={13} fontWeight={700}>{sides[1]}</text>
    );
    // left leg label
    if (sides[2]) labelEls.push(
      <text key="s2" x={(tL+bL)/2-10} y={(tY+bY)/2+5} textAnchor="end" fill="#555" fontSize={12} fontWeight={700}>{sides[2]}</text>
    );
    // right leg label
    if (sides[3]) labelEls.push(
      <text key="s3" x={(tR+bR)/2+10} y={(tY+bY)/2+5} textAnchor="start" fill="#555" fontSize={12} fontWeight={700}>{sides[3]}</text>
    );
    // height: dashed vertical line with end ticks and label
    if (height) {
      const hx = bR + 22;
      labelEls.push(
        <g key="height">
          <line x1={hx} y1={tY} x2={hx} y2={bY} stroke={color} strokeWidth={1.5} strokeDasharray="5,3"/>
          <line x1={hx-5} y1={tY} x2={hx+5} y2={tY} stroke={color} strokeWidth={1.5}/>
          <line x1={hx-5} y1={bY} x2={hx+5} y2={bY} stroke={color} strokeWidth={1.5}/>
          <text x={hx+8} y={(tY+bY)/2+5} textAnchor="start" fill={color} fontSize={12} fontWeight={700}>{height}</text>
        </g>
      );
    }
  }

  return (
    <div style={{ margin:"0 0 18px", display:"flex", justifyContent:"center" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth:300 }}>
        {shapeEl}
        {labelEls}
      </svg>
    </div>
  );
}

// ── Data Bar Chart ────────────────────────────────────────────────────────────
function DataBarChart({ v }) {
  const { bars = [], title = "", xLabel = "", yLabel = "", highlightBar } = v;
  if (!bars.length) return null;
  const W=300, H=160, padL=36, padB=40, padT=24, padR=10;
  const chartW = W-padL-padR, chartH = H-padB-padT;
  const maxVal = Math.max(...bars.map(b=>b.value), 1);
  const barW = Math.min(chartW/bars.length*0.6, 36);
  const gap = chartW/bars.length;
  const toY = v => padT + chartH - (v/maxVal)*chartH;
  const yTicks = [0, Math.round(maxVal*0.5), maxVal];
  return (
    <div style={{ margin:"0 0 18px" }}>
      {title && <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:"#555", marginBottom:4 }}>{title}</div>}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* Y axis */}
        <line x1={padL} y1={padT} x2={padL} y2={padT+chartH} stroke="#C0BCB8" strokeWidth={1.5}/>
        {/* X axis */}
        <line x1={padL} y1={padT+chartH} x2={W-padR} y2={padT+chartH} stroke="#C0BCB8" strokeWidth={1.5}/>
        {/* Y ticks */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={padL-4} y1={toY(t)} x2={padL} y2={toY(t)} stroke="#C0BCB8" strokeWidth={1}/>
            <text x={padL-7} y={toY(t)+4} textAnchor="end" fill="#9A9490" fontSize={9}>{t}</text>
            <line x1={padL} y1={toY(t)} x2={W-padR} y2={toY(t)} stroke="#F0EEE9" strokeWidth={1}/>
          </g>
        ))}
        {/* Bars */}
        {bars.map((b,i) => {
          const bx = padL + gap*i + gap/2 - barW/2;
          const by = toY(b.value);
          const bh = padT+chartH - by;
          const isHi = highlightBar === b.label || highlightBar === i;
          return (
            <g key={i}>
              <rect x={bx} y={by} width={barW} height={bh}
                fill={isHi ? "#c084fc" : "#1E3A5F"} opacity={isHi?1:0.75} rx={3}/>
              <text x={bx+barW/2} y={by-4} textAnchor="middle" fill="#555" fontSize={9} fontWeight={700}>{b.value}</text>
              <text x={bx+barW/2} y={padT+chartH+14} textAnchor="middle" fill="#555" fontSize={9}
                transform={`rotate(-25,${bx+barW/2},${padT+chartH+14})`}>{b.label}</text>
            </g>
          );
        })}
        {yLabel && <text x={10} y={H/2} textAnchor="middle" fill="#9A9490" fontSize={9} transform={`rotate(-90,10,${H/2})`}>{yLabel}</text>}
      </svg>
    </div>
  );
}

// ── Data Line Chart ───────────────────────────────────────────────────────────
function DataLineChart({ v }) {
  const { points = [], title = "", xLabel = "", yLabel = "", color = "#1E3A5F" } = v;
  if (points.length < 2) return null;
  const W=300, H=140, padL=36, padB=32, padT=20, padR=10;
  const chartW=W-padL-padR, chartH=H-padB-padT;
  const yVals = points.map(p=>p.y);
  const yMin = Math.min(...yVals), yMax = Math.max(...yVals,yMin+1);
  const toX = i => padL + (i/(points.length-1))*chartW;
  const toY = y => padT + chartH - ((y-yMin)/(yMax-yMin))*chartH;
  const path = points.map((p,i)=>`${i===0?"M":"L"}${toX(i)},${toY(p.y)}`).join(" ");
  const area = `${path} L${toX(points.length-1)},${padT+chartH} L${padL},${padT+chartH} Z`;
  return (
    <div style={{ margin:"0 0 18px" }}>
      {title && <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:"#555", marginBottom:4 }}>{title}</div>}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <line x1={padL} y1={padT} x2={padL} y2={padT+chartH} stroke="#C0BCB8" strokeWidth={1.5}/>
        <line x1={padL} y1={padT+chartH} x2={W-padR} y2={padT+chartH} stroke="#C0BCB8" strokeWidth={1.5}/>
        {[yMin, Math.round((yMin+yMax)/2), yMax].map(t => (
          <g key={t}>
            <text x={padL-7} y={toY(t)+4} textAnchor="end" fill="#9A9490" fontSize={9}>{t}</text>
            <line x1={padL} y1={toY(t)} x2={W-padR} y2={toY(t)} stroke="#F0EEE9" strokeWidth={1}/>
          </g>
        ))}
        <path d={area} fill={color} opacity={0.08}/>
        <path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        {points.map((p,i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.y)} r={4} fill={color} stroke="#fff" strokeWidth={1.5}/>
            <text x={toX(i)} y={padT+chartH+14} textAnchor="middle" fill="#555" fontSize={9}
              transform={`rotate(-25,${toX(i)},${padT+chartH+14})`}>{p.x}</text>
          </g>
        ))}
        {yLabel && <text x={10} y={H/2} textAnchor="middle" fill="#9A9490" fontSize={9} transform={`rotate(-90,10,${H/2})`}>{yLabel}</text>}
      </svg>
    </div>
  );
}

// ── Labeled Diagram ───────────────────────────────────────────────────────────
function LabeledDiagram({ v, submitted, isCorrect }) {
  const { shape="circle", title="", labels=[], askLabel, layers } = v;
  const W=280, H=200, cx=W/2, cy=H/2;
  const colors = ["#1E3A5F","#c084fc","#60a5fa","#f0a050","#4ade80","#fb7185"];

  // Layers shape (earth layers, atmosphere, etc.)
  if (shape === "layers" && layers?.length) {
    const lH = 140, lW = 220, lx = (W-lW)/2, ly = (H-lH)/2;
    let y = ly;
    return (
      <div style={{ margin:"0 0 18px" }}>
        {title && <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:"#555", marginBottom:4 }}>{title}</div>}
        <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
          {layers.map((layer, i) => {
            const h = Math.round(lH * layer.height);
            const el = (
              <g key={i}>
                <rect x={lx} y={y} width={lW} height={h}
                  fill={layer.color || colors[i % colors.length]}
                  stroke="#fff" strokeWidth={1.5} opacity={askLabel===layer.name?1:0.75}/>
                {askLabel !== layer.name && (
                  <text x={lx+lW/2} y={y+h/2+5} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>{layer.name}</text>
                )}
                {askLabel === layer.name && (
                  <>
                    <rect x={lx} y={y} width={lW} height={h} fill="none" stroke="#FDE68A" strokeWidth={3} rx={2}/>
                    <text x={lx+lW/2} y={y+h/2+5} textAnchor="middle" fill="#FDE68A" fontSize={11} fontWeight={800}>?</text>
                  </>
                )}
              </g>
            );
            y += h;
            return el;
          })}
        </svg>
      </div>
    );
  }

  // Circle/oval with radiating label arrows
  const rx = shape === "oval" ? 90 : 75;
  const ry = shape === "oval" ? 60 : 75;
  return (
    <div style={{ margin:"0 0 18px" }}>
      {title && <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:"#555", marginBottom:4 }}>{title}</div>}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#EEF3FA" stroke="#1E3A5F44" strokeWidth={2}/>
        {labels.map((lbl, i) => {
          const angle = (lbl.angle ?? i * (360/labels.length)) * Math.PI / 180;
          const r = lbl.radius ?? 0.7;
          // Point on ellipse edge
          const ex = cx + Math.cos(angle) * rx * 0.95;
          const ey = cy + Math.sin(angle) * ry * 0.95;
          // Label position further out
          const lx2 = cx + Math.cos(angle) * (rx + 55);
          const ly2 = cy + Math.sin(angle) * (ry + 35);
          const isAsked = askLabel === lbl.id;
          const c = colors[i % colors.length];
          return (
            <g key={lbl.id || i}>
              <line x1={ex} y1={ey} x2={lx2} y2={ly2} stroke={isAsked?"#f0a050":c} strokeWidth={isAsked?2:1.5} strokeDasharray={isAsked?"":""} />
              <circle cx={ex} cy={ey} r={4} fill={isAsked?"#f0a050":c}/>
              <text x={lx2} y={ly2} textAnchor={Math.cos(angle) > 0 ? "start" : "end"}
                fill={isAsked?"#f0a050":c} fontSize={10} fontWeight={700} dominantBaseline="middle">
                {isAsked ? "← ?" : `${lbl.id ? lbl.id+". " : ""}${lbl.name}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Venn Diagram ──────────────────────────────────────────────────────────────
function VennDiagram({ v }) {
  const { leftLabel="", rightLabel="", leftOnly=[], both=[], rightOnly=[] } = v;
  const W=300, H=190;
  const r=75, lCx=105, rCx=195, cY=95;
  return (
    <div style={{ margin:"0 0 18px" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
        <circle cx={lCx} cy={cY} r={r} fill="#1E3A5F" fillOpacity={0.1} stroke="#1E3A5F" strokeWidth={2}/>
        <circle cx={rCx} cy={cY} r={r} fill="#c084fc" fillOpacity={0.1} stroke="#c084fc" strokeWidth={2}/>
        <text x={lCx-r/2} y={22} textAnchor="middle" fill="#1E3A5F" fontSize={11} fontWeight={800}>{leftLabel}</text>
        <text x={rCx+r/2} y={22} textAnchor="middle" fill="#c084fc" fontSize={11} fontWeight={800}>{rightLabel}</text>
        {leftOnly.slice(0,4).map((t,i) => (
          <text key={i} x={lCx-28} y={cY-18+i*18} textAnchor="middle" fill="#1E3A5F" fontSize={9} fontWeight={600}>{t}</text>
        ))}
        {both.slice(0,3).map((t,i) => (
          <text key={i} x={W/2} y={cY-14+i*18} textAnchor="middle" fill="#555" fontSize={9} fontWeight={700}>{t}</text>
        ))}
        {rightOnly.slice(0,4).map((t,i) => (
          <text key={i} x={rCx+28} y={cY-18+i*18} textAnchor="middle" fill="#7c3aed" fontSize={9} fontWeight={600}>{t}</text>
        ))}
      </svg>
    </div>
  );
}

// ── Sentence Diagram (Reed-Kellogg) ───────────────────────────────────────────
function SentenceDiagram({ v }) {
  const { subject="", verb="", object="", subjectModifiers=[], verbModifiers=[], objectModifiers=[], prepPhrase } = v;
  const W=340, H=160;
  // Baseline: subject | verb | object
  const baseY = 80;
  const sX = 70, divX = 130, vX = 190, div2X = 250, oX = 310;

  const hasPP = !!prepPhrase;
  return (
    <div style={{ margin:"0 0 18px", background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:10, padding:"10px 0 6px" }}>
      <div style={{ textAlign:"center", fontSize:10, color:"#9A9490", letterSpacing:2, marginBottom:4, fontWeight:700, textTransform:"uppercase" }}>
        Sentence Diagram
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
        {/* Main baseline */}
        <line x1={20} y1={baseY} x2={object ? oX+30 : verb ? vX+40 : sX+40} y2={baseY} stroke="#2a2a2a" strokeWidth={2}/>
        {/* Subject | verb divider */}
        <line x1={divX} y1={baseY-22} x2={divX} y2={baseY+22} stroke="#2a2a2a" strokeWidth={2}/>
        {/* verb | object divider (diagonal) */}
        {object && <line x1={div2X} y1={baseY-16} x2={div2X+10} y2={baseY+16} stroke="#2a2a2a" strokeWidth={2}/>}

        {/* Subject word */}
        <text x={sX} y={baseY-8} textAnchor="middle" fill="#1E3A5F" fontSize={14} fontWeight={800}>{subject}</text>
        {/* Verb word */}
        {verb && <text x={vX} y={baseY-8} textAnchor="middle" fill="#1E3A5F" fontSize={14} fontWeight={800}>{verb}</text>}
        {/* Object word */}
        {object && <text x={oX} y={baseY-8} textAnchor="middle" fill="#1E3A5F" fontSize={14} fontWeight={800}>{object}</text>}

        {/* Subject modifiers — diagonal lines descending left */}
        {subjectModifiers.map((mod, i) => {
          const startX = sX - 20 + i*22;
          const endX = startX + 28;
          return (
            <g key={i}>
              <line x1={startX} y1={baseY} x2={endX} y2={baseY+32} stroke="#1E3A5F" strokeWidth={1.5}/>
              <text x={(startX+endX)/2-2} y={baseY+30} fill="#555" fontSize={10} fontWeight={600}
                transform={`rotate(35,${(startX+endX)/2},${baseY+24})`}>{mod}</text>
            </g>
          );
        })}

        {/* Verb modifiers — diagonal lines descending */}
        {verbModifiers.map((mod, i) => {
          const startX = vX - 10 + i*20;
          const endX = startX + 28;
          return (
            <g key={i}>
              <line x1={startX} y1={baseY} x2={endX} y2={baseY+32} stroke="#c084fc" strokeWidth={1.5}/>
              <text x={(startX+endX)/2-2} y={baseY+30} fill="#7c3aed" fontSize={10} fontWeight={600}
                transform={`rotate(35,${(startX+endX)/2},${baseY+24})`}>{mod}</text>
            </g>
          );
        })}

        {/* Object modifiers */}
        {objectModifiers.map((mod, i) => {
          const startX = oX - 10 + i*20;
          const endX = startX + 28;
          return (
            <g key={i}>
              <line x1={startX} y1={baseY} x2={endX} y2={baseY+32} stroke="#60a5fa" strokeWidth={1.5}/>
              <text x={(startX+endX)/2-2} y={baseY+30} fill="#2563eb" fontSize={10} fontWeight={600}
                transform={`rotate(35,${(startX+endX)/2},${baseY+24})`}>{mod}</text>
            </g>
          );
        })}

        {/* Prepositional phrase — angled line from verb baseline */}
        {hasPP && (
          <g>
            <line x1={vX+10} y1={baseY} x2={vX+20} y2={baseY+42} stroke="#f0a050" strokeWidth={1.5}/>
            <line x1={vX+10} y1={baseY+42} x2={vX+90} y2={baseY+42} stroke="#f0a050" strokeWidth={1.5}/>
            <text x={vX+24} y={baseY+38} fill="#D97706" fontSize={10} fontWeight={700}>{prepPhrase.prep}</text>
            <line x1={vX+60} y1={baseY+42} x2={vX+60} y2={baseY+56} stroke="#2a2a2a" strokeWidth={1.5}/>
            <text x={vX+75} y={baseY+52} fill="#1E3A5F" fontSize={11} fontWeight={800}>{prepPhrase.object}</text>
            {(prepPhrase.objModifiers||[]).map((mod,i) => {
              const sx = vX+60+i*18;
              return (
                <g key={i}>
                  <line x1={sx} y1={baseY+56} x2={sx+22} y2={baseY+72} stroke="#555" strokeWidth={1}/>
                  <text x={sx+4} y={baseY+70} fill="#555" fontSize={9}
                    transform={`rotate(32,${sx+4},${baseY+66})`}>{mod}</text>
                </g>
              );
            })}
          </g>
        )}

        {/* Legend */}
        <text x={10} y={H-6} fill="#9A9490" fontSize={8}>subject | predicate ⧸ object  — modifiers on diagonals</text>
      </svg>
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function TimelineVisual({ v }) {
  const { events=[], title="", highlightYear } = v;
  if (!events.length) return null;
  const W=320, H=100, padX=30, lineY=52;
  const spacing = (W-padX*2) / Math.max(events.length-1, 1);
  return (
    <div style={{ margin:"0 0 18px" }}>
      {title && <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:"#555", marginBottom:4 }}>{title}</div>}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* Timeline axis */}
        <line x1={padX} y1={lineY} x2={W-padX} y2={lineY} stroke="#C0BCB8" strokeWidth={2.5}/>
        <polygon points={`${W-padX+2},${lineY} ${W-padX-6},${lineY-4} ${W-padX-6},${lineY+4}`} fill="#C0BCB8"/>
        {events.map((e, i) => {
          const x = padX + i * spacing;
          const isHi = highlightYear === e.year || highlightYear === String(e.year);
          const above = i % 2 === 0;
          return (
            <g key={i}>
              <line x1={x} y1={lineY-6} x2={x} y2={lineY+6} stroke={isHi?"#f0a050":"#1E3A5F"} strokeWidth={isHi?3:2}/>
              <circle cx={x} cy={lineY} r={isHi?7:5} fill={isHi?"#f0a050":"#1E3A5F"} stroke="#fff" strokeWidth={1.5}/>
              <text x={x} y={above ? lineY-16 : lineY+22} textAnchor="middle"
                fill={isHi?"#D97706":"#1E3A5F"} fontSize={9} fontWeight={isHi?900:700}>{e.year}</text>
              <text x={x} y={above ? lineY-27 : lineY+32} textAnchor="middle"
                fill={isHi?"#D97706":"#555"} fontSize={8} fontWeight={isHi?700:400}
                style={{ maxWidth:40 }}>{e.label?.slice(0,18)}</text>
            </g>
          );
        })}
      </svg>
    </div>
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
      subjectSummaries[sub.id] = { sessions: 0, avgScore: 0, trend: "no-data", recentScores: [], weakTopics: [], strongTopics: [], totalQuestions: 0, firstScore: null, recentScore: null, improvementDelta: null, difficultyHistory: [], persistentErrors: [] };
      return;
    }
    totalSessions += sessions.length;
    const chronological = [...sessions].reverse(); // oldest first
    const recentScores = sessions.slice(0, 10).map(s => Math.round((s.correct / s.total) * 100));
    const avgScore = Math.round(recentScores.reduce((a,b)=>a+b,0) / recentScores.length);

    // Trend: compare last 3 vs previous 3
    const r3 = recentScores.slice(0,3), p3 = recentScores.slice(3,6);
    const rAvg = r3.reduce((a,b)=>a+b,0)/r3.length;
    const pAvg = p3.length ? p3.reduce((a,b)=>a+b,0)/p3.length : rAvg;
    const trend = rAvg - pAvg >= 8 ? "improving" : pAvg - rAvg >= 8 ? "declining" : "steady";

    // First vs recent score (improvement magnitude)
    const firstScore = chronological.length > 0 ? Math.round((chronological[0].correct/chronological[0].total)*100) : null;
    const recentScore = recentScores[0] || null;
    const improvementDelta = (firstScore !== null && recentScore !== null) ? recentScore - firstScore : null;

    // Per-topic accuracy (attempts + correct) across all sessions
    const topicStats = {};
    sessions.forEach(s => s.log?.forEach(l => {
      if (!topicStats[l.topic]) topicStats[l.topic] = { attempts: 0, correct: 0, errors: [] };
      topicStats[l.topic].attempts++;
      if (l.ok) topicStats[l.topic].correct++;
      else topicStats[l.topic].errors.push(l.question);
    }));

    // Persistent errors: questions wrong in multiple sessions
    const errorCounts = {};
    sessions.slice(0,10).forEach(s => s.log?.forEach(l => {
      if (!l.ok) errorCounts[l.question] = (errorCounts[l.question]||0) + 1;
    }));
    const persistentErrors = Object.entries(errorCounts)
      .filter(([,n]) => n >= 2)
      .sort((a,b) => b[1]-a[1])
      .slice(0,3)
      .map(([q,n]) => ({ question: q.slice(0,60), times: n }));

    // Weak and strong topics by accuracy rate
    const topicAccuracy = Object.entries(topicStats)
      .filter(([,v]) => v.attempts >= 3)
      .map(([t,v]) => ({ topic: t, accuracy: Math.round((v.correct/v.attempts)*100), attempts: v.attempts }));
    const weakTopics = topicAccuracy.filter(t => t.accuracy < 70).sort((a,b) => a.accuracy-b.accuracy).slice(0,3);
    const strongTopics = topicAccuracy.filter(t => t.accuracy >= 80).sort((a,b) => b.accuracy-a.accuracy).slice(0,3);

    // Difficulty history: avg difficulty per recent session
    const difficultyHistory = sessions.slice(0,8).map(s => s.difficulty || 0).reverse();
    const avgDifficulty = difficultyHistory.length ? Math.round(difficultyHistory.reduce((a,b)=>a+b,0)/difficultyHistory.length*10)/10 : 0;

    // Time invested
    const totalTimeSeconds = sessions.reduce((a,s) => a + (s.timeSpent||0), 0);

    const subTotal = sessions.reduce((a,s)=>a+s.total,0);
    const subCorrect = sessions.reduce((a,s)=>a+s.correct,0);
    totalQuestions += subTotal;
    totalCorrect += subCorrect;

    sessions.forEach(s => allSessionsFlat.push({ ...s, subjectId: sub.id, subjectName: sub.name }));

    // Mastery score history (weighted by difficulty)
    const masteryHistory = sessions.slice(0, 10).map(s =>
      s.masteryScore || masteryScore(s.correct, s.total, s.difficulty || 0)
    );
    const avgMastery = masteryHistory.length
      ? Math.round(masteryHistory.reduce((a,b)=>a+b,0) / masteryHistory.length)
      : 0;
    const recentMastery = masteryHistory[0] || 0;
    const firstMastery = masteryHistory.length > 0
      ? (sessions[sessions.length-1].masteryScore || masteryScore(sessions[sessions.length-1].correct, sessions[sessions.length-1].total, sessions[sessions.length-1].difficulty || 0))
      : 0;
    const masteryDelta = firstMastery > 0 ? recentMastery - firstMastery : null;

    // Difficulty progression: how many sessions at each level
    const diffCounts = [0,0,0];
    sessions.forEach(s => { diffCounts[s.difficulty||0]++; });
    const diffProgression = { starter: diffCounts[0], building: diffCounts[1], challenging: diffCounts[2] };

    // Sessions at highest difficulty (Challenging)
    const challengingSessions = sessions.filter(s => (s.difficulty||0) === 2);
    const challengingAvgAccuracy = challengingSessions.length
      ? Math.round(challengingSessions.reduce((a,s)=>a+(s.correct/s.total*100),0)/challengingSessions.length)
      : null;

    // Is difficulty trending up? last 3 sessions avg difficulty vs prior 3
    const recentDiffAvg = sessions.slice(0,3).reduce((a,s)=>a+(s.difficulty||0),0)/Math.min(3,sessions.length);
    const olderDiffAvg = sessions.slice(3,6).length
      ? sessions.slice(3,6).reduce((a,s)=>a+(s.difficulty||0),0)/sessions.slice(3,6).length
      : recentDiffAvg;
    const diffTrend = recentDiffAvg > olderDiffAvg + 0.3 ? "leveling-up"
                    : recentDiffAvg < olderDiffAvg - 0.3 ? "dropping-back"
                    : "holding-steady";

    subjectSummaries[sub.id] = {
      sessions: sessions.length, avgScore, trend, recentScores,
      weakTopics, strongTopics, topicStats,
      totalQuestions: subTotal, totalCorrect: subCorrect,
      firstScore, recentScore, improvementDelta,
      difficultyHistory, avgDifficulty, diffProgression, diffTrend,
      challengingSessions: challengingSessions.length, challengingAvgAccuracy,
      masteryHistory, avgMastery, recentMastery, firstMastery, masteryDelta,
      persistentErrors, totalTimeSeconds,
      accent: sub.accent, bg: sub.bg, border: sub.border, emoji: sub.emoji, name: sub.name
    };
  });

  // Weekly activity
  const now = Date.now();
  const weeklyActivity = Array.from({length:6}, (_,i) => {
    const wStart = now - (i+1)*7*86400000, wEnd = now - i*7*86400000;
    return allSessionsFlat.filter(s => { const d = new Date(s.date).getTime(); return d >= wStart && d < wEnd; }).length;
  }).reverse();

  // Consistency score: sessions in last 14 days / 14
  const recentDays = new Set(allSessionsFlat
    .filter(s => Date.now() - new Date(s.date).getTime() < 14*86400000)
    .map(s => new Date(s.date).toISOString().slice(0,10))
  ).size;
  const consistencyScore = Math.round((recentDays / 14) * 100);

  // Total time across all subjects
  const totalTimeSeconds = Object.values(subjectSummaries).reduce((a,s) => a + (s.totalTimeSeconds||0), 0);

  allSessionsFlat.sort((a,b) => new Date(b.date) - new Date(a.date));
  const recentActivity = allSessionsFlat.slice(0, 8);

  // SRS health — deeper analytics
  const today = new Date().toISOString().slice(0,10);
  const totalCards = srsCards.length;
  const dueCards = srsCards.filter(c => c.dueDate <= today).length;
  const masteredCards = srsCards.filter(c => c.streak >= 5).length;
  const avgEaseFactor = totalCards > 0
    ? Math.round(srsCards.reduce((a,c) => a + (c.easeFactor||2.5), 0) / totalCards * 100) / 100
    : 2.5;
  const avgInterval = totalCards > 0
    ? Math.round(srsCards.reduce((a,c) => a + (c.interval||1), 0) / totalCards)
    : 1;
  // Cards overdue by > 3 days = deeply forgotten
  const overdueCards = srsCards.filter(c => {
    const daysPast = Math.floor((Date.now() - new Date(c.dueDate).getTime()) / 86400000);
    return daysPast > 3;
  }).length;

  // Overall avg mastery across all subjects
  const allMasteryScores = Object.values(subjectSummaries)
    .filter(s => s.masteryHistory?.length > 0)
    .flatMap(s => s.masteryHistory);
  const avgMasteryOverall = allMasteryScores.length
    ? Math.round(allMasteryScores.reduce((a,b)=>a+b,0)/allMasteryScores.length)
    : 0;

  return {
    username, displayName,
    totalSessions, totalQuestions, totalCorrect,
    totalTimeSeconds, avgMasteryOverall,
    avgScore: totalQuestions > 0 ? Math.round((totalCorrect/totalQuestions)*100) : 0,
    currentStreak: stats?.currentStreak || 0,
    bestStreak: stats?.bestStreak || 0,
    weeklyActivity, consistencyScore,
    subjectSummaries,
    recentActivity,
    srsHealth: { totalCards, dueCards, masteredCards, avgEaseFactor, avgInterval, overdueCards },
    activeSince: allSessionsFlat.length > 0 ? allSessionsFlat[allSessionsFlat.length-1].date : null,
  };
}

// AI-generated narrative insight for parent report
async function generateStudentInsightReport(dashData) {
  const fmt = (n) => n !== null && n !== undefined ? String(n) : "N/A";
  const fmtMins = (secs) => secs > 0 ? `${Math.round(secs/60)} min` : "0 min";

  // Build rich per-subject evidence block
  const activeSubjects = SUBJECTS.filter(s => dashData.subjectSummaries[s.id]?.sessions > 0);
  const subjectBlocks = activeSubjects.map(s => {
    const d = dashData.subjectSummaries[s.id];
    const delta = d.improvementDelta !== null ? (d.improvementDelta >= 0 ? `+${d.improvementDelta}%` : `${d.improvementDelta}%`) : "insufficient data";
    const weakList = d.weakTopics.length
      ? d.weakTopics.map(w => `${topicLabel(w.topic)} (${w.accuracy}% accuracy over ${w.attempts} attempts)`).join("; ")
      : "none below threshold";
    const strongList = d.strongTopics.length
      ? d.strongTopics.map(w => `${topicLabel(w.topic)} (${w.accuracy}%)`).join("; ")
      : "none yet above threshold";
    const persErrors = d.persistentErrors.length
      ? d.persistentErrors.map(e => `"${e.question}" missed ${e.times}x`).join("; ")
      : "none";
    const diffLabel = ["Starter","Building","Challenging"][Math.round(d.avgDifficulty)] || "Building";
      const masteryDeltaStr = d.masteryDelta !== null ? (d.masteryDelta >= 0 ? `+${d.masteryDelta}` : `${d.masteryDelta}`) : "N/A";
      const diffDist = `Starter: ${d.diffProgression?.starter||0}, Building: ${d.diffProgression?.building||0}, Challenging: ${d.diffProgression?.challenging||0}`;
    return [
      `SUBJECT: ${s.name}`,
      `  Sessions: ${d.sessions} | Questions: ${d.totalQuestions} | Accuracy: ${d.avgScore}% | Time: ${fmtMins(d.totalTimeSeconds)}`,
      `  First session: raw ${fmt(d.firstScore)}%, mastery ${fmt(d.firstMastery)} → Recent: raw ${fmt(d.recentScore)}%, mastery ${fmt(d.recentMastery)} (mastery change: ${masteryDeltaStr})`,
      `  Raw accuracy trend: ${d.trend} | Difficulty trend: ${d.diffTrend}`,
      `  Session difficulty distribution: ${diffDist}`,
      `  Avg difficulty: ${diffLabel} | Challenging sessions: ${d.challengingSessions||0}${d.challengingAvgAccuracy ? ` at ${d.challengingAvgAccuracy}% accuracy` : ""}`,
      `  Avg mastery score: ${d.avgMastery} (${masteryLabel(d.avgMastery)}) — max possible at Challenging = 220`,
      `  Strong topics: ${strongList}`,
      `  Weak topics: ${weakList}`,
      `  Persistent errors (wrong 2+ times): ${persErrors}`,
      `  Mastery history (recent→oldest): ${(d.masteryHistory||[]).slice(0,6).join(", ")}`,
    ].join("\n");
  }).join("\n\n");

  // SRS retention analytics
  const srs = dashData.srsHealth;
  const retentionStrength = srs.avgEaseFactor >= 2.3 ? "strong" : srs.avgEaseFactor >= 1.8 ? "moderate" : "weak";
  const forgettingRisk = srs.overdueCards > 5 ? "high" : srs.overdueCards > 0 ? "moderate" : "low";
  const srsBlock = srs.totalCards > 0 ? [
    `SPACED REPETITION (Ebbinghaus forgetting curve data):`,
    `  Total flashcard concepts tracked: ${srs.totalCards}`,
    `  Cards mastered (5+ consecutive recalls): ${srs.masteredCards} (${Math.round(srs.masteredCards/srs.totalCards*100)}%)`,
    `  Cards due for review today: ${srs.dueCards}`,
    `  Cards overdue >3 days (high forgetting risk): ${srs.overdueCards}`,
    `  Average ease factor: ${srs.avgEaseFactor} (2.5=ideal; below 1.8=struggling to retain)`,
    `  Average recall interval: ${srs.avgInterval} days — retention strength: ${retentionStrength}`,
    `  Forgetting risk level: ${forgettingRisk}`,
  ].join("\n") : "No spaced repetition data yet.";

  // Engagement/consistency analytics
  const weeklyMax = Math.max(...dashData.weeklyActivity, 1);
  const recentWeeks = dashData.weeklyActivity.slice(-3);
  const olderWeeks = dashData.weeklyActivity.slice(0,3);
  const recentAvg = recentWeeks.reduce((a,b)=>a+b,0)/3;
  const olderAvg = olderWeeks.reduce((a,b)=>a+b,0)/3;
  const engagementTrend = recentAvg > olderAvg + 0.5 ? "increasing" : recentAvg < olderAvg - 0.5 ? "decreasing" : "stable";
  const totalMins = Math.round(dashData.totalTimeSeconds/60);

  const engagementBlock = [
    `ENGAGEMENT & CONSISTENCY:`,
    `  Total study time: ${totalMins} minutes across ${dashData.totalSessions} sessions`,
    `  Active days in last 14 days: ${Math.round(dashData.consistencyScore/100*14)} of 14 (${dashData.consistencyScore}% consistency)`,
    `  Current streak: ${dashData.currentStreak} days | Best streak: ${dashData.bestStreak} days`,
    `  Overall avg mastery score: ${dashData.avgMasteryOverall} (${masteryLabel(dashData.avgMasteryOverall)})`,
    `  Overall raw accuracy: ${dashData.avgScore}%`,
    `  Weekly sessions (oldest→newest): ${dashData.weeklyActivity.join(", ")}`,
    `  Engagement trend (recent 3 weeks vs prior 3): ${engagementTrend}`,
    `  Peak week: ${weeklyMax} sessions`,
  ].join("\n");

  const prompt = `You are an educational psychologist and learning scientist writing a detailed, evidence-based progress report for a parent. Your report must be grounded in cognitive science and cite specific data points from the student's actual performance record.

${engagementBlock}

${srsBlock}

${subjectBlocks}

SCIENTIFIC FRAMEWORKS TO APPLY (use whichever are supported by the data):
- Ebbinghaus Forgetting Curve: declining ease factors and overdue SRS cards indicate rapid forgetting — flag this specifically
- Retrieval Practice Effect (Roediger & Karpicke): high question volume with good accuracy = strong encoding; low accuracy despite repetition = surface processing
- Desirable Difficulties (Bjork): reaching Challenging difficulty level indicates productive struggle; staying at Starter may signal avoidance
- Spaced Practice vs. Massed Practice: session frequency pattern reveals whether student is distributing practice beneficially
- Zone of Proximal Development (Vygotsky): adaptive difficulty data shows whether student is working in their growth zone
- Interleaving Effect: if Mix sessions exist, compare performance to single-topic sessions
- Automaticity and Fluency: persistent errors on the same question indicate the concept has not reached automaticity

KEY CONTEXT — Mastery Score system:
Mastery Score = accuracy% × difficulty multiplier (Starter×1.0, Building×1.5, Challenging×2.2). Max at Challenging = 220.
A mastery score rising while raw accuracy stays flat = POSITIVE (student is tackling harder material).
"leveling-up" difficulty trend = productive challenge zone (Bjork's desirable difficulties in action).
"dropping-back" = may indicate frustration or avoidance — worth flagging diplomatically.

STRICT WRITING RULES — violations will make this report useless:
1. Every observation MUST cite a specific number. Never say "is improving" without "mastery improved from X to Y"
2. Name specific subjects and topics — never say "some subjects" or "certain areas"
3. Persistent errors must be named explicitly if present
4. SRS data must be interpreted through the Ebbinghaus lens
5. Difficulty trajectory must be interpreted through Bjork/ZPD lens
6. Engagement pattern must connect to spaced practice research
7. Recommendations must be specific actions (e.g. "focus 10 min/day on X topic" not "keep practicing")
8. Write at an educated-parent reading level — explain any scientific terms briefly
9. The student message must reference something specific they achieved

Return ONLY a valid JSON object, no markdown, nothing before { or after }.
{
  "headline": "One precise sentence naming the student, their strongest subject with score, and overall trajectory with specific numbers",
  "data_highlights": [
    "3-4 bullet observations, each citing a specific metric. Format: 'OBSERVATION: [what] — EVIDENCE: [exact numbers]'"
  ],
  "strengths": [
    "2-3 strengths, each naming a subject/topic with accuracy %, trend, and what the data suggests about their learning"
  ],
  "growth_areas": [
    "2-3 growth areas, each naming the specific topic, exact accuracy, and how many attempts without mastery"
  ],
  "learning_science_note": "2-3 sentences applying ONE specific research finding to this student's data — name the researcher/theory and explain what the data shows through that lens",
  "patterns": "2-3 sentences on behavioral/engagement patterns with specific numbers: consistency %, session frequency, time invested, difficulty level reached",
  "recommendation": "3 concrete, numbered action steps with specifics (subject, topic, frequency, goal metric)",
  "encouragement": "One sentence to the student by name citing one specific achievement with a real number"
}`;

  const res = await callAPI([{ role:"user", content: prompt }], 1800);
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

// ─── Curriculum Library storage (admin-managed, shared across all students) ───
function curriculumKey(subjectId) { return `curriculum-${subjectId}`; }

// ─── Test Prep storage ────────────────────────────────────────────────────────
function testPrepKey(username) { return `testpreps-${username}`; }

async function loadTestPreps(username) {
  try {
    const r = await storage.get(testPrepKey(username));
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}

async function saveTestPreps(preps, username) {
  try {
    await storage.set(testPrepKey(username), JSON.stringify(preps));
  } catch(e) { console.error("saveTestPreps error", e); }
}

// Admin-assigned test preps — stored in shared storage, keyed by student username
function assignedPrepKey(studentUsername) { return `assigned-preps-${studentUsername}`; }

async function loadAssignedPreps(studentUsername) {
  try {
    const r = await storage.get(assignedPrepKey(studentUsername), true); // shared=true
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}

async function saveAssignedPreps(preps, studentUsername) {
  try {
    await storage.set(assignedPrepKey(studentUsername), JSON.stringify(preps), true); // shared=true
  } catch(e) { console.error("saveAssignedPreps error", e); }
}

async function loadCurriculum(subjectId) {
  try {
    const r = await storage.get(curriculumKey(subjectId), true); // shared=true
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}

async function saveCurriculum(topics, subjectId) {
  try {
    await storage.set(curriculumKey(subjectId), JSON.stringify(topics), true); // shared=true
  } catch(e) { console.error("saveCurriculum error", e); }
}

// ─── Test Prep AI Plan Generator ────────────────────────────────────────────
async function generateTestPrepPlan({ subject, testDate, topics, materialsB64, materialsType, masteryData, username }) {
  const daysUntil = Math.max(1, Math.round((new Date(testDate) - new Date()) / 86400000));
  // Sessions: 1 per day max 7, min 1; scale question count by days available
  const maxSessions = Math.min(daysUntil, 7);
  const qPerSession = daysUntil <= 2 ? 20 : daysUntil <= 4 ? 15 : 10;

  // Build mastery summary for this subject
  const subMastery = masteryData?.subjectSummaries?.[subject.id];
  const masteryBlock = subMastery
    ? `EXISTING MASTERY DATA for ${subject.name}:
- Recent accuracy: ${subMastery.avgScore}%
- Mastery score: ${subMastery.avgMastery || "N/A"}
- Strong topics: ${(subMastery.strongTopics||[]).map(t=>`${t.topic} (${t.accuracy}%)`).join(", ") || "none recorded"}
- Weak topics: ${(subMastery.weakTopics||[]).map(t=>`${t.topic} (${t.accuracy}%)`).join(", ") || "none recorded"}
- Persistent errors: ${(subMastery.persistentErrors||[]).map(t=>t.question).join("; ") || "none"}`
    : `No prior mastery data for ${subject.name} — treat all topics as equally important.`;

  const topicList = topics.length ? topics.join(", ") : "all topics in the uploaded materials";

  const blocks = [];

  // Include uploaded materials if provided
  if (materialsB64 && materialsType) {
    blocks.push(materialsType === "application/pdf"
      ? { type:"document", source:{ type:"base64", media_type:"application/pdf", data:materialsB64 } }
      : { type:"image", source:{ type:"base64", media_type:materialsType, data:materialsB64 } }
    );
  }

  blocks.push({ type:"text", text:`You are an expert study planner for a 6th grader preparing for an upcoming ${subject.name} test.

TEST DETAILS:
- Subject: ${subject.name}
- Test date: ${testDate} (${daysUntil} day${daysUntil!==1?"s":""} away)
- Topics to cover: ${topicList}
- Max sessions available: ${maxSessions}
- Questions per session: ~${qPerSession}

${masteryBlock}

${materialsB64 ? "REVIEW MATERIALS: Analyze the uploaded document to extract the exact topics, vocabulary, problem types, and difficulty level expected on this test. Use these to calibrate every session." : ""}

YOUR TASK: Create an optimal spaced study plan. Apply these principles:
1. Front-load hardest/weakest topics — first sessions tackle the most difficult material
2. Interleave topics across sessions (don't do all of one topic in one session)
3. Final session (day before or day of): shorter, confidence-building — only already-mastered topics, easier difficulty
4. Weight sessions toward documented weak topics from mastery data
5. Each session should feel achievable in 10-20 minutes

Return ONLY valid JSON — no markdown, no explanation:
{
  "planTitle": "short motivating title e.g. '${subject.name} Test Blitz'",
  "planSummary": "2 sentences: what this plan covers and why it's structured this way",
  "testDate": "${testDate}",
  "subjectId": "${subject.id}",
  "sessions": [
    {
      "sessionNumber": 1,
      "title": "short session title e.g. 'Core Concepts'",
      "scheduledDate": "YYYY-MM-DD",
      "focus": "2 sentence description of what this session targets and why",
      "topics": ["topicKey1", "topicKey2"],
      "topicNames": ["Human-readable name 1", "Human-readable name 2"],
      "questionCount": ${qPerSession},
      "difficulty": 1,
      "difficultyNotes": "specific calibration: what complexity, vocabulary, steps to match",
      "isConfidenceBuilder": false
    }
  ],
  "topicsExtracted": ["if materials uploaded: list topics found in review doc"],
  "difficultyCalibration": "overall calibration note: what level this test targets based on materials"
}

DIFFICULTY: 0=Starter, 1=Building, 2=Challenging. Use 1 for most sessions; 2 for early sessions on weak topics; 0 only for the final confidence-builder.` });

  const res = await callAPI(blocks, 2000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = JSON.parse(await res.text());
  const raw = data.content?.find(b=>b.type==="text")?.text || "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in plan response");
  const plan = JSON.parse(match[0]);
  plan.id = `tp_${Date.now()}`;
  plan.createdAt = new Date().toISOString();
  plan.createdBy = username;
  plan.status = "active";
  plan.completedSessions = [];
  return plan;
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
Keep questions SHORT. Use × for multiply, ÷ for divide.

VISUAL FIELD — include whenever a visual would help comprehension:
Add a "visual" field to the question object with type + data. Types and formats:

MATH VISUALS:
"visual": {"type":"fraction_bar","numerator":3,"denominator":8,"highlight":[0,1,2]}
"visual": {"type":"fraction_compare","fractions":[{"n":1,"d":2,"label":"1/2"},{"n":3,"d":8,"label":"3/8"}]}
"visual": {"type":"geometry","shape":"triangle","sides":["5 cm","12 cm","13 cm"],"angles":["90°","67°","23°"],"labels":{"A":"top","B":"bottom-left","C":"bottom-right"}}
"visual": {"type":"geometry","shape":"rectangle","sides":["8 m","3 m","8 m","3 m"]}
"visual": {"type":"geometry","shape":"circle","sides":["6 cm"]}
"visual": {"type":"geometry","shape":"trapezoid","sides":["8 cm","13 cm","5 cm","5 cm"],"height":"6 cm"}
  // sides order: [top_base, bottom_base, left_leg, right_leg]; height is perpendicular height

SCIENCE VISUALS:
"visual": {"type":"bar_chart","title":"Plant Growth","bars":[{"label":"Week 1","value":3},{"label":"Week 2","value":7}],"yLabel":"Height (cm)","highlightBar":"Week 2"}
"visual": {"type":"line_chart","title":"Temperature","points":[{"x":"Mon","y":20},{"x":"Tue","y":23},{"x":"Wed","y":19}],"yLabel":"°C"}
"visual": {"type":"labeled_diagram","shape":"circle","title":"Animal Cell","labels":[{"id":"A","name":"Nucleus","angle":45,"radius":0.4},{"id":"B","name":"Cell Membrane","angle":180,"radius":0.9},{"id":"C","name":"Mitochondria","angle":270,"radius":0.55}],"askLabel":"B"}
"visual": {"type":"labeled_diagram","shape":"layers","title":"Earth Layers","layers":[{"name":"Crust","color":"#8B7355","height":0.12},{"name":"Mantle","color":"#C1440E","height":0.38},{"name":"Outer Core","color":"#E8751A","height":0.3},{"name":"Inner Core","color":"#FFD700","height":0.2}],"askLabel":"Mantle"}
"visual": {"type":"venn","leftLabel":"Mammals","rightLabel":"Fish","leftOnly":["Warm-blooded","Fur/hair"],"both":["Has vertebrae","Can swim"],"rightOnly":["Gills","Cold-blooded"]}

GRAMMAR VISUALS:
"visual": {"type":"sentence_diagram","subject":"fox","verb":"jumped","object":"fence","subjectModifiers":["The","quick","brown"],"verbModifiers":["quickly"],"objectModifiers":["the"],"prepPhrase":{"prep":"over","object":"fence","objModifiers":["the"]}}
Use sentence diagrams for questions about parts of speech, subject/predicate, modifiers, prepositional phrases.

SOCIAL STUDIES VISUALS:
"visual": {"type":"timeline","title":"American Revolution","events":[{"year":"1775","label":"War begins"},{"year":"1776","label":"Declaration"},{"year":"1781","label":"Yorktown"},{"year":"1783","label":"Treaty of Paris"}],"highlightYear":"1776"}
Use timelines for questions about historical sequence, cause and effect, dates.

RULES: Only include a "visual" field when it genuinely aids comprehension. Omit for pure text recall questions.
Each question is independent — only include "visual" if THAT specific question benefits from it.`

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
    const sciVisualHint = subject?.id === "science"
      ? "\n\nFor SCIENCE questions: include a 'visual' field whenever the question involves data, diagrams, cell parts, earth layers, ecosystems, or compare/contrast. Use bar_chart for data questions, labeled_diagram for anatomy/structure questions, venn for compare/contrast, line_chart for change-over-time. See VISUAL FIELD instructions in schema."
      : subject?.id === "social_studies" || subject?.id === "history"
      ? "\n\nFor SOCIAL STUDIES questions: include a 'visual' field for timeline questions (sequence of events, dates, cause/effect). Use the timeline type with 4-5 events, highlighting the relevant one. See VISUAL FIELD instructions in schema."
      : subject?.id === "grammar" || subject?.id === "english"
      ? "\n\nFor GRAMMAR questions: include a 'visual' field with type 'sentence_diagram' for questions about parts of speech, subject/predicate identification, modifiers, or prepositional phrases. Reed-Kellogg diagrams help dyslexic learners see sentence structure visually. See VISUAL FIELD instructions in schema."
      : "";
    blocks.push({ type:"text", text:`You are a ${subject?.name || "subject"} tutor for a 6th grader with dyslexia.
Generate exactly ${qCount} multiple-choice questions specifically about: "${hwTopic.topicName}"
Subject area: ${subject?.name || "General"}
Difficulty: ${diffDesc}.
Dyslexia rules: SHORT clear question text, no clutter, unambiguous wording. Multiple choice only.
Use topic string: "${hwTopic.topicKey}"
Mix different aspects and sub-topics within "${hwTopic.topicName}" where appropriate.${sciVisualHint}
${SCHEMA_INSTRUCTIONS}` });
  } else if (hwTopic && !base64) {
    // ── TOPIC BANK MODE: no image, use stored topic name/description ──────
    const diffDesc = [
      "15–20% EASIER than typical homework — simpler numbers, fewer steps, same concept.",
      "standard 6th-grade difficulty for this topic.",
      "30–50% HARDER — more steps, harder numbers, mixed sub-types.",
    ][difficulty];
    const bankVisualHint = subject?.id === "math"
      ? "\n\nFor MATH: include 'visual' for fraction questions (fraction_bar or fraction_compare), geometry (geometry shape), and data/statistics (bar_chart or line_chart)."
      : subject?.id === "science"
      ? "\n\nFor SCIENCE: include 'visual' for data questions (bar_chart/line_chart), diagrams (labeled_diagram), and comparisons (venn)."
      : subject?.id === "grammar" || subject?.id === "english"
      ? "\n\nFor GRAMMAR: include 'visual' with sentence_diagram for parts-of-speech and sentence-structure questions."
      : subject?.id === "social_studies" || subject?.id === "history"
      ? "\n\nFor SOCIAL STUDIES: include 'visual' with timeline for sequence/date questions."
      : "";
    // If this is a curriculum topic, inject difficulty calibration data
    const calibrationBlock = hwTopic._fromCurriculum && hwTopic.difficultyNotes
      ? `\n\nDIFFICULTY CALIBRATION — this topic comes from a curated school curriculum library. The expected difficulty level is:\n${hwTopic.difficultyNotes}${hwTopic.gradeLevel ? `\nGrade/Level: ${hwTopic.gradeLevel}` : ""}${hwTopic.exemplarQuestions?.length ? `\n\nEXEMPLAR QUESTIONS showing the expected difficulty (match this level exactly):\n${hwTopic.exemplarQuestions.map((q,i)=>`${i+1}. Q: ${q.question}\n   A: ${q.answer}`).join("\n")}` : ""}\n\nIMPORTANT: Generate questions at THIS specific difficulty level — not easier, not harder. Match the vocabulary, complexity, and number of steps shown in the exemplars above.`
      : "";
    blocks.push({ type:"text", text:`You are a tutor for a 6th grader with dyslexia.
Subject: ${subject?.name || "Math"}.
Generate exactly ${qCount} practice problems on this topic: "${hwTopic.topicName}" — ${hwTopic.description}
Difficulty: ${diffDesc}${calibrationBlock}
Dyslexia rules: SHORT question text, no clutter, unambiguous wording. Multiple choice only.
Use topic string: "${hwTopic.topicKey}"
Mix sub-types within the topic where appropriate.${bankVisualHint}
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

  // Token budget: ~300 tokens per question + 400 overhead, min 2000
  const tokenBudget = Math.max(2000, qCount * 300 + 400);
  const res = await callAPI([{ role:"user", content:blocks }], tokenBudget);
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

// ─── Post-session debrief — explains each wrong answer specifically ──────────
async function generateDebrief(sessionLog, subjectName, topicName) {
  const wrong = sessionLog.filter(l => !l.ok);
  // Build the debrief purely from question data if all tips/explanations present
  const allHaveTips = wrong.length > 0 && wrong.every(l => l.tip || l.explanation);

  // Items we can show immediately from question metadata
  const items = wrong.map(l => ({
    question:    l.question,
    selected:    l.selected,
    correct:     l.correct,
    tip:         l.tip || null,
    explanation: l.explanation || null,
    topic:       l.topic,
  }));

  // Ask AI for a brief pattern analysis + fill any missing explanations
  const needsAI = !allHaveTips || wrong.length > 0;
  if (!needsAI || wrong.length === 0) return { summary: null, items };

  const wrongSummary = wrong.map((l, i) =>
    `${i+1}. Q: "${l.question}"
   Student answered: "${l.selected}"
   Correct: "${l.correct}"${l.tip ? `
   Built-in tip: "${l.tip}"` : ""}${l.explanation ? `
   Explanation: "${l.explanation}"` : ""}`
  ).join("

");

  const prompt = `A 6th grader just completed a ${subjectName} session on "${topicName}". They got ${sessionLog.filter(l=>l.ok).length}/${sessionLog.length} correct.

MISSED QUESTIONS:
${wrongSummary}

Write a concise, encouraging debrief for the student (NOT the parent). Use simple language, no jargon.

Return ONLY valid JSON:
{
  "summary": "1-2 sentence overview of what went wrong and the key pattern — specific, not generic. Example: 'You mixed up multiplication and addition when parentheses were involved — that's a classic PEMDAS trap.'",
  "items": [
    {
      "question": "exact question text",
      "selected": "what student picked",
      "correct": "correct answer",
      "explanation": "1 sentence: WHY the correct answer is right, in plain language a 6th grader gets",
      "memory": "1 short memorable hook, tip, or mnemonic to prevent this mistake next time"
    }
  ]
}`;

  const res = await callAPI([{ type:"text", text:prompt }], 900);
  if (!res.ok) return { summary:null, items };
  const data = JSON.parse(await res.text());
  const raw = data.content?.find(b=>b.type==="text")?.text||"";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { summary:null, items };
  try {
    const parsed = JSON.parse(match[0]);
    return parsed;
  } catch { return { summary:null, items }; }
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
  const [diffToast, setDiffToast] = useState(null); // {msg, color} shown briefly when difficulty changes
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
  // Post-session debrief (auto-generated inline on complete screen)
  const [debrief, setDebrief] = useState(null);        // {summary, items:[{question,selected,correct,explanation,tip}]}
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefOpen, setDebriefOpen] = useState(false); // expanded/collapsed
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
  const [waitingForQuestions, setWaitingForQuestions] = useState(false);

  // ── Test Prep state ──────────────────────────────────────────────────────
  const [testPreps, setTestPreps] = useState([]);          // all active preps for user
  const [activeTestPrep, setActiveTestPrep] = useState(null); // prep driving current session
  const [testPrepScreen, setTestPrepScreen] = useState(null); // "setup1"|"setup2"|"setup3"|"plan"|null
  const [tpSetup, setTpSetup] = useState({               // setup wizard state
    subject: null, testDate: "", topics: [], topicInput: "",
    materials: null, materialsB64: null, materialsType: null, generatingPlan: false,
  });
  const [tpPlanLoading, setTpPlanLoading] = useState(false);
  const [tpCurriculumTopics, setTpCurriculumTopics] = useState([]); // curriculum topics for selected subject in wizard
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
  const [curriculumTopics, setCurriculumTopics] = useState([]); // admin library topics for current subject
  // Admin curriculum editor state
  const [adminCurrTab, setAdminCurrTab] = useState("english"); // which subject is open in curriculum editor
  const [adminCurrTopics, setAdminCurrTopics] = useState([]); // topics for current admin subject
  const [adminCurrLoading, setAdminCurrLoading] = useState(false);
  const [adminCurrEditing, setAdminCurrEditing] = useState(null); // topic being edited/added
  const [adminCurrSaving, setAdminCurrSaving] = useState(false);
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
  const [adminAssignPrepStudent, setAdminAssignPrepStudent] = useState(null); // student being assigned a prep
  const [adminAssignPrepBuilding, setAdminAssignPrepBuilding] = useState(false);

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  useEffect(() => () => clearTimer(), []);
  useEffect(() => { prefetchedRef.current = prefetchedProblems; }, [prefetchedProblems]);


  // Load subject-specific data when subject changes OR when returning to upload screen
  useEffect(() => {
    if (!subject || !currentUser) return;
    loadStats(currentUser.username).then(setHomeStats);
    loadTopicBank(subject.id, currentUser.username).then(setTopicBank);
    loadTestPreps(currentUser.username).then(setTestPreps);
    loadCurriculum(subject.id).then(setCurriculumTopics);
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
      setDebrief(null); setDebriefLoading(false); setDebriefOpen(false);
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
    const entry = { topic:prob.topic, ok, question:prob.question, selected, correct:prob.correct, tip:prob.tip||null, explanation:prob.explanation||null, difficulty };
    if (ok) {
      const ns = streak + 1; setStreak(ns); setWrongStreak(0); setScore(s => s+1);
      if (ns >= 3 && difficulty < 2) {
        setDifficulty(d => d+1);
        const nextLabel = DIFFICULTY_LABELS[Math.min(difficulty+1,2)];
        setDiffToast({ msg:`📈 Stepping up to ${nextLabel}`, color:"#16a34a" });
        setTimeout(() => setDiffToast(null), 2800);
      }
    } else {
      const nw = wrongStreak + 1; setWrongStreak(nw); setStreak(0);
      if (nw >= 2 && difficulty > 0) {
        setDifficulty(d => d-1);
        const nextLabel = DIFFICULTY_LABELS[Math.max(difficulty-1,0)];
        setDiffToast({ msg:`📉 Adjusting to ${nextLabel}`, color:"#D97706" });
        setTimeout(() => setDiffToast(null), 2800);
      }
    }
    setLog((l) => [...l, entry]);
  };

  const handleNext = () => {
    const isInfinite = TIMER_OPTIONS[timerIdx].infinite && timeLeft > 0;
    if (isInfinite && idx + 1 >= problems.length) {
      if (prefetchedRef.current.length > 0) {
        // Prefetch ready — append and advance
        setProblems(prev => [...prev, ...prefetchedRef.current]);
        setPrefetchedProblems([]); prefetchedRef.current = [];
        setIdx((i)=>i+1); setSelected(null); setSubmitted(false);
      } else {
        // Prefetch still in flight — wait, don't advance idx
        setWaitingForQuestions(true);
      }
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
            // If student was waiting at the boundary, auto-advance now
            setWaitingForQuestions(w => {
              if (w) {
                setProblems(prev => [...prev, ...newProbs]);
                prefetchedRef.current = [];
                setIdx(i => i + 1);
                setSelected(null);
                setSubmitted(false);
                return false;
              }
              return w;
            });
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

      // Auto-generate debrief for missed questions
      const wrongInSession = log.filter(l => !l.ok);
      if (wrongInSession.length > 0) {
        setDebrief(null); setDebriefOpen(false); setDebriefLoading(true);
        generateDebrief(log, subject?.name||"this subject", hwTopic?.topicName||"this topic")
          .then(d => { setDebrief(d); setDebriefOpen(true); })
          .catch(() => {})
          .finally(() => setDebriefLoading(false));
      } else {
        setDebrief(null); setDebriefLoading(false); setDebriefOpen(false);
      }

      // If this session was part of a test prep, mark it complete
      if (activeTestPrep) {
        const sessionPct2 = Math.round((log.filter(l=>l.ok).length/log.length)*100);
        const updatedPrep = {
          ...activeTestPrep,
          completedSessions: [...(activeTestPrep.completedSessions||[]), {
            sessionNumber: activeTestPrep._launchSessionNumber,
            completedAt: new Date().toISOString(),
            score: sessionPct2,
            questionsAnswered: log.length,
          }]
        };
        loadTestPreps(currentUser?.username).then(preps => {
          const updated = preps.map(p => p.id === updatedPrep.id ? updatedPrep : p);
          saveTestPreps(updated, currentUser?.username);
          setTestPreps(updated);
          setActiveTestPrep(updatedPrep);
        });
      }
      const sessionCorrect = log.filter((l)=>l.ok).length;
      const sessionMastery = masteryScore(sessionCorrect, log.length, difficulty);
      saveSession({ id:Date.now().toString(), date:new Date().toISOString(), subject:subject?.id||"math", subjectName:subject?.name||"Math", timeSpent:timeTotal>0?Math.min(timeUsed,timeTotal):timeUsed, timed:timeTotal>0, difficulty, total:log.length, correct:sessionCorrect, masteryScore:sessionMastery, log:log.map(({topic,ok,question,selected,correct})=>({topic,ok,question,selected,correct})) }, subject?.id, currentUser?.username);
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
      // Load both own preps and any admin-assigned preps
      Promise.all([
        loadTestPreps(result.user.username),
        loadAssignedPreps(result.user.username),
      ]).then(([own, assigned]) => {
        const merged = [...own];
        assigned.forEach(a => { if (!merged.find(p => p.id === a.id)) merged.push({ ...a, _assigned: true }); });
        setTestPreps(merged);
      });
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
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes pulse { from { opacity:0.4; r:3; } to { opacity:1; r:5; } }
        @keyframes progress-bar { 0%{width:0%} 30%{width:35%} 60%{width:62%} 85%{width:82%} 100%{width:94%} }
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
            <div style={{ ...S.sub, marginBottom: testPreps.filter(p=>p.status==="active").length ? 12 : 20 }}>What are we practicing today?</div>

            {/* ── Active Test Prep Banners ── */}
            {testPreps.filter(p => p.status === "active").map(prep => {
              const daysLeft = Math.ceil((new Date(prep.testDate) - new Date()) / 86400000);
              const sub = SUBJECTS.find(s => s.id === prep.subjectId);
              const completedCount = (prep.completedSessions||[]).length;
              const totalSessions = (prep.sessions||[]).length;
              const nextSession = (prep.sessions||[]).find(s =>
                !(prep.completedSessions||[]).some(c => c.sessionNumber === s.sessionNumber)
              );
              const isOverdue = daysLeft < 0;
              const accent = sub?.accent || "#1E3A5F";
              return (
                <div key={prep.id} style={{ background: accent+"12", border:`1.5px solid ${accent}44`, borderRadius:12, padding:"12px 14px", marginBottom:10, cursor:"pointer" }}
                  onClick={() => { setTestPrepScreen("plan"); setActiveTestPrep(prep); }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:11, background:accent, color:"#fff", borderRadius:4, padding:"2px 7px", fontWeight:800, letterSpacing:1 }}>TEST PREP</span>
                        {prep._assigned && <span style={{ fontSize:9, background:"#F0FDF4", border:"1px solid #86efac", borderRadius:4, padding:"2px 6px", color:"#16a34a", fontWeight:800 }}>Assigned by teacher</span>}
                        <span style={{ fontSize:13, fontWeight:800, color:accent }}>{prep.planTitle}</span>
                      </div>
                      <div style={{ fontSize:11, color:"#9A9490" }}>
                        {sub?.name} · {isOverdue ? "Test was " + Math.abs(daysLeft) + " days ago" : daysLeft === 0 ? "Test is TODAY" : `${daysLeft} day${daysLeft!==1?"s":""} until test`}
                        {" · "}{completedCount}/{totalSessions} sessions done
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:22, fontWeight:900, color: daysLeft<=1?"#dc2626":daysLeft<=3?"#D97706":accent, fontFamily:"monospace" }}>{Math.max(0,daysLeft)}</div>
                      <div style={{ fontSize:9, color:"#9A9490", letterSpacing:1 }}>DAYS LEFT</div>
                    </div>
                  </div>
                  {nextSession && (
                    <button onClick={e => {
                      e.stopPropagation();
                      const subj = SUBJECTS.find(s => s.id === prep.subjectId);
                      setSubject(subj);
                      setActiveTestPrep({ ...prep, _launchSessionNumber: nextSession.sessionNumber });
                      setHwTopic({
                        topicName: nextSession.title,
                        topicKey: nextSession.topics?.[0] || "general",
                        description: nextSession.focus,
                        difficultyNotes: nextSession.difficultyNotes,
                        _fromCurriculum: true,
                      });
                      setDifficulty(nextSession.difficulty ?? 1);
                      setHwFile(null);
                      setScreen("confirm");
                    }} style={{ marginTop:8, width:"100%", padding:"8px", background:accent, border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer" }}>
                      ▶ Start Session {nextSession.sessionNumber}: {nextSession.title}
                    </button>
                  )}
                  {!nextSession && completedCount === totalSessions && (
                    <div style={{ marginTop:6, fontSize:11, color:accent, fontWeight:800 }}>✓ All sessions complete — great work!</div>
                  )}
                </div>
              );
            })}

            {/* ── Test Prep button ── */}
            <button onClick={() => { setTpSetup({ subject:null, testDate:"", topics:[], topicInput:"", materials:null, materialsB64:null, materialsType:null, generatingPlan:false }); setTestPrepScreen("setup1"); }}
              style={{ width:"100%", padding:"11px 14px", background:"transparent", border:"1.5px dashed #1E3A5F44", borderRadius:10, color:"#1E3A5F", fontSize:12, fontWeight:800, cursor:"pointer", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"center", gap:8, letterSpacing:1 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="16" y2="14"/>
              </svg>
              CREATE TEST PREP
            </button>

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
                  <div style={{ marginBottom:10, display:"flex", justifyContent:"center" }}><SubjectIcon id={sub.id} size={32} color={sub.accent} strokeWidth={1.6}/></div>
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
              {[["pending","⏳ Pending"],["all","👥 All Users"],["students","📊 Dashboards"],["curriculum","📚 Curriculum"],["add","➕ Add User"]].map(([tab, label]) => (
                <button key={tab} onClick={() => {
                  setAdminTab(tab);
                  if (tab==="students") loadAdminStudentList();
                  if (tab==="curriculum") {
                    setAdminCurrLoading(true);
                    loadCurriculum(adminCurrTab).then(t => { setAdminCurrTopics(t); setAdminCurrLoading(false); });
                  }
                }}
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
                        <button onClick={() => setAdminAssignPrepStudent(u)} style={{ background:"#EEF3FA", border:"1px solid #1E3A5F33", borderRadius:6, color:"#1E3A5F", fontSize:12, padding:"6px 12px", cursor:"pointer", fontWeight:800 }}>📋 Assign Prep</button>
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

            {/* Curriculum Library tab */}
            {adminTab === "curriculum" && (() => {
              const CURR_SUBJECTS = [
                { id:"english",       name:"English",       accent:"#a78bfa" },
                { id:"science",       name:"Science",       accent:"#34d399" },
                { id:"math",          name:"Math",          accent:"#1E3A5F" },
                { id:"latin",         name:"Latin",         accent:"#f472b6" },
                { id:"religion",      name:"Religion",      accent:"#fbbf24" },
                { id:"social_studies",name:"Social Studies",accent:"#fb923c" },
                { id:"grammar",       name:"Grammar",       accent:"#60a5fa" },
              ];
              const currSubj = CURR_SUBJECTS.find(s => s.id === adminCurrTab) || CURR_SUBJECTS[0];

              const saveEditing = async () => {
                if (!adminCurrEditing?.topicName?.trim()) return;
                setAdminCurrSaving(true);
                const topic = {
                  ...adminCurrEditing,
                  topicKey: adminCurrEditing.topicKey || adminCurrEditing.topicName.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""),
                  updatedAt: new Date().toISOString(),
                };
                const existing = adminCurrTopics.findIndex(t => t.topicKey === topic.topicKey);
                const updated = existing >= 0
                  ? adminCurrTopics.map((t,i) => i === existing ? topic : t)
                  : [...adminCurrTopics, topic];
                await saveCurriculum(updated, adminCurrTab);
                setAdminCurrTopics(updated);
                setAdminCurrEditing(null);
                setAdminCurrSaving(false);
              };

              const deleteTopic = async (topicKey) => {
                const updated = adminCurrTopics.filter(t => t.topicKey !== topicKey);
                await saveCurriculum(updated, adminCurrTab);
                setAdminCurrTopics(updated);
              };

              const addExemplar = () => {
                setAdminCurrEditing(e => ({ ...e,
                  exemplarQuestions: [...(e.exemplarQuestions||[]), { question:"", answer:"" }]
                }));
              };

              const updateExemplar = (i, field, val) => {
                setAdminCurrEditing(e => {
                  const eq = [...(e.exemplarQuestions||[])];
                  eq[i] = { ...eq[i], [field]: val };
                  return { ...e, exemplarQuestions: eq };
                });
              };

              const removeExemplar = (i) => {
                setAdminCurrEditing(e => ({
                  ...e, exemplarQuestions: (e.exemplarQuestions||[]).filter((_,j)=>j!==i)
                }));
              };

              return (
                <div>
                  {/* Subject tabs */}
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:16 }}>
                    {CURR_SUBJECTS.map(s => (
                      <button key={s.id}
                        onClick={() => {
                          setAdminCurrTab(s.id);
                          setAdminCurrEditing(null);
                          setAdminCurrLoading(true);
                          loadCurriculum(s.id).then(t => { setAdminCurrTopics(t); setAdminCurrLoading(false); });
                        }}
                        style={{ padding:"5px 10px", background:adminCurrTab===s.id?s.accent:"transparent", border:`1.5px solid ${s.accent}44`, borderRadius:20, color:adminCurrTab===s.id?"#fff":s.accent, fontSize:11, fontWeight:800, cursor:"pointer" }}>
                        {s.name}
                      </button>
                    ))}
                  </div>

                  {/* ── Seed Starter Pack button ── */}
                  {!adminCurrEditing && STARTER_PACKS[adminCurrTab]?.length > 0 && (() => {
                    const packTopics = STARTER_PACKS[adminCurrTab];
                    const existingKeys = new Set(adminCurrTopics.map(t => t.topicKey));
                    const newTopics = packTopics.filter(t => !existingKeys.has(t.topicKey));
                    if (newTopics.length === 0) return (
                      <div style={{ background:"#1a2a1a", border:"1px solid #4ade8033", borderRadius:10, padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ color:"#4ade80", fontSize:13 }}>✓</span>
                        <span style={{ fontSize:12, color:"#4ade80", fontWeight:700 }}>All starter topics already loaded for {currSubj.name}</span>
                      </div>
                    );
                    return (
                      <div style={{ background:"#1a1a2a", border:`1.5px dashed ${currSubj.accent}55`, borderRadius:10, padding:14, marginBottom:16 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:800, color:currSubj.accent, letterSpacing:1, textTransform:"uppercase" }}>
                              📚 Starter Pack — {currSubj.name}
                            </div>
                            <div style={{ fontSize:11, color:"#9A9490", marginTop:3 }}>
                              {newTopics.length} topic{newTopics.length>1?"s":""} ready to load, calibrated to your curriculum
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              setAdminCurrLoading(true);
                              const toAdd = newTopics.map(t => ({ ...t, updatedAt: new Date().toISOString(), _seeded: true }));
                              const updated = [...adminCurrTopics, ...toAdd];
                              await saveCurriculum(updated, adminCurrTab);
                              setAdminCurrTopics(updated);
                              setAdminCurrLoading(false);
                            }}
                            style={{ padding:"8px 14px", background:currSubj.accent, border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                            Load All →
                          </button>
                        </div>
                        {/* Preview of topics to be added */}
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                          {newTopics.map((t,i) => (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ width:5, height:5, borderRadius:"50%", background:currSubj.accent, flexShrink:0 }}/>
                              <div style={{ fontSize:11, color:"#ddd", fontWeight:700 }}>{t.topicName}</div>
                              <div style={{ fontSize:10, color:"#666", flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Editor panel */}
                  {adminCurrEditing ? (
                    <div style={{ background:"#1a1a1a", border:`1.5px solid ${currSubj.accent}44`, borderRadius:12, padding:16, marginBottom:16 }}>
                      <div style={{ fontSize:12, fontWeight:800, color:currSubj.accent, marginBottom:12, letterSpacing:1, textTransform:"uppercase" }}>
                        {adminCurrEditing.topicKey ? "Edit Topic" : "New Topic"} — {currSubj.name}
                      </div>

                      {[
                        { label:"Topic Name *", field:"topicName", placeholder:"e.g. Multiplying Fractions by Whole Numbers" },
                        { label:"Description", field:"description", placeholder:"One sentence a student sees — what this topic covers" },
                        { label:"Grade / Level", field:"gradeLevel", placeholder:"e.g. 6th Grade · Saxon Math 7/6 Ch.4" },
                      ].map(({ label, field, placeholder }) => (
                        <div key={field} style={{ marginBottom:10 }}>
                          <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, marginBottom:4, fontWeight:700, textTransform:"uppercase" }}>{label}</div>
                          <input value={adminCurrEditing[field]||""} onChange={e=>setAdminCurrEditing(ed=>({...ed,[field]:e.target.value}))}
                            placeholder={placeholder}
                            style={{ width:"100%", padding:"8px 10px", background:"#2a2a2a", border:"1px solid #3a3a3a", borderRadius:6, color:"#fff", fontSize:12, boxSizing:"border-box" }}/>
                        </div>
                      ))}

                      {/* Difficulty notes — the critical calibration field */}
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:10, color:"#fbbf24", letterSpacing:2, marginBottom:4, fontWeight:700, textTransform:"uppercase" }}>Difficulty Calibration Notes *</div>
                        <div style={{ fontSize:10, color:"#9A9490", marginBottom:6, lineHeight:1.5 }}>
                          Describe the expected difficulty precisely: vocabulary, number complexity, number of steps, what concepts students already know. This is injected into the AI prompt to calibrate every generated question.
                        </div>
                        <textarea value={adminCurrEditing.difficultyNotes||""} rows={4}
                          onChange={e=>setAdminCurrEditing(ed=>({...ed,difficultyNotes:e.target.value}))}
                          placeholder={"e.g. Students multiply a simple fraction (denominator ≤ 12) by a 1-digit whole number. They should simplify the result. Problems use unit fractions and familiar fractions like 1/2, 2/3, 3/4. No mixed numbers yet. Answer is always less than 5. Matches Saxon Math 7/6 Lesson 64."}
                          style={{ width:"100%", padding:"8px 10px", background:"#2a2a2a", border:"1.5px solid #fbbf2444", borderRadius:6, color:"#fff", fontSize:11, lineHeight:1.6, resize:"vertical", boxSizing:"border-box" }}/>
                      </div>

                      {/* Exemplar questions */}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                          <div>
                            <div style={{ fontSize:10, color:"#60a5fa", letterSpacing:2, fontWeight:700, textTransform:"uppercase" }}>Exemplar Questions</div>
                            <div style={{ fontSize:10, color:"#9A9490", marginTop:2 }}>2–3 real examples from homework/class. The AI will match this exact difficulty.</div>
                          </div>
                          <button onClick={addExemplar}
                            style={{ background:"#60a5fa22", border:"1px solid #60a5fa44", borderRadius:6, color:"#60a5fa", fontSize:11, padding:"4px 10px", cursor:"pointer", fontWeight:700 }}>
                            + Add
                          </button>
                        </div>
                        {(adminCurrEditing.exemplarQuestions||[]).map((ex,i) => (
                          <div key={i} style={{ background:"#222", border:"1px solid #333", borderRadius:8, padding:10, marginBottom:8 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                              <div style={{ fontSize:10, color:"#9A9490", fontWeight:700 }}>Example {i+1}</div>
                              <button onClick={()=>removeExemplar(i)} style={{ background:"none", border:"none", color:"#ff6b6b", cursor:"pointer", fontSize:11 }}>✕</button>
                            </div>
                            <input value={ex.question||""} onChange={e=>updateExemplar(i,"question",e.target.value)}
                              placeholder="Question (as it would appear on homework)"
                              style={{ width:"100%", padding:"6px 8px", background:"#2a2a2a", border:"1px solid #3a3a3a", borderRadius:4, color:"#fff", fontSize:11, marginBottom:6, boxSizing:"border-box" }}/>
                            <input value={ex.answer||""} onChange={e=>updateExemplar(i,"answer",e.target.value)}
                              placeholder="Correct answer"
                              style={{ width:"100%", padding:"6px 8px", background:"#2a2a2a", border:"1px solid #3a3a3a", borderRadius:4, color:"#fff", fontSize:11, boxSizing:"border-box" }}/>
                          </div>
                        ))}
                      </div>

                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={saveEditing} disabled={adminCurrSaving||!adminCurrEditing.topicName?.trim()}
                          style={{ flex:1, padding:"10px", background:currSubj.accent, border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", opacity:adminCurrSaving||!adminCurrEditing.topicName?.trim()?0.5:1 }}>
                          {adminCurrSaving ? "Saving…" : "Save Topic"}
                        </button>
                        <button onClick={()=>setAdminCurrEditing(null)}
                          style={{ padding:"10px 16px", background:"transparent", border:"1px solid #3a3a3a", borderRadius:8, color:"#9A9490", fontSize:13, cursor:"pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={()=>setAdminCurrEditing({ topicName:"", description:"", gradeLevel:"", difficultyNotes:"", exemplarQuestions:[] })}
                      style={{ width:"100%", padding:"11px", background:"transparent", border:`1.5px dashed ${currSubj.accent}55`, borderRadius:10, color:currSubj.accent, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:16 }}>
                      + Add Topic to {currSubj.name} Library
                    </button>
                  )}

                  {/* Topic list */}
                  {adminCurrLoading
                    ? <div style={{ textAlign:"center", color:"#9A9490", padding:24 }}>Loading…</div>
                    : adminCurrTopics.length === 0 && !adminCurrEditing
                      ? <div style={{ textAlign:"center", color:"#9A9490", padding:24, fontSize:13 }}>
                          No topics yet for {currSubj.name}.<br/>
                          <span style={{ fontSize:11 }}>Add topics above — students will see them immediately.</span>
                        </div>
                      : adminCurrTopics.map(t => (
                        <div key={t.topicKey} style={{ background:"#1a1a1a", border:`1px solid ${currSubj.accent}33`, borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:14, fontWeight:800, color:currSubj.accent, marginBottom:2 }}>{t.topicName}</div>
                              {t.gradeLevel && <div style={{ fontSize:10, color:"#9A9490", marginBottom:4, fontWeight:600 }}>{t.gradeLevel}</div>}
                              {t.description && <div style={{ fontSize:11, color:"#888", lineHeight:1.5, marginBottom:4 }}>{t.description}</div>}
                              {t.difficultyNotes && (
                                <div style={{ background:"#2a2a2a", borderRadius:6, padding:"6px 8px", marginTop:6 }}>
                                  <div style={{ fontSize:9, color:"#fbbf24", letterSpacing:2, fontWeight:700, marginBottom:3, textTransform:"uppercase" }}>Difficulty Calibration</div>
                                  <div style={{ fontSize:10, color:"#888", lineHeight:1.5 }}>{t.difficultyNotes.slice(0,180)}{t.difficultyNotes.length>180?"…":""}</div>
                                </div>
                              )}
                              {(t.exemplarQuestions||[]).length > 0 && (
                                <div style={{ fontSize:9, color:"#60a5fa", marginTop:6, fontWeight:700 }}>
                                  {t.exemplarQuestions.length} exemplar question{t.exemplarQuestions.length!==1?"s":""} attached
                                </div>
                              )}
                            </div>
                            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                              <button onClick={()=>setAdminCurrEditing({...t})}
                                style={{ background:"#2a2a2a", border:"1px solid #3a3a3a", borderRadius:6, color:"#9A9490", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                                Edit
                              </button>
                              <button onClick={()=>deleteTopic(t.topicKey)}
                                style={{ background:"#ff6b6b11", border:"1px solid #ff6b6b33", borderRadius:6, color:"#ff6b6b", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                  }
                </div>
              );
            })()}

            {/* ── Admin: Assign Test Prep Modal ── */}
            {adminAssignPrepStudent && (() => {
              const student = adminAssignPrepStudent;
              const handleAssign = async (subjectId) => {
                setAdminAssignPrepBuilding(true);
                try {
                  const sub = SUBJECTS.find(s => s.id === subjectId);
                  // Load student's mastery data for calibration
                  const studentSessions = await loadSessions(subjectId, student.username);
                  const plan = await generateTestPrepPlan({
                    subject: sub,
                    testDate: tpSetup.testDate || new Date(Date.now() + 5*86400000).toISOString().split("T")[0],
                    topics: tpSetup.topics || [],
                    materialsB64: tpSetup.materialsB64 || null,
                    materialsType: tpSetup.materialsType || null,
                    masteryData: null,
                    username: currentUser?.username,
                  });
                  plan._assignedBy = currentUser?.username;
                  plan._assignedTo = student.username;
                  // Save to student's assigned preps (shared storage)
                  const existing = await loadAssignedPreps(student.username);
                  await saveAssignedPreps([...existing, plan], student.username);
                  setAdminMsg(`✓ Test prep plan assigned to ${student.display_name}`);
                  setAdminAssignPrepStudent(null);
                  setTpSetup(s => ({...s, testDate:"", topics:[], materialsB64:null, materialsType:null}));
                } catch(e) {
                  setAdminMsg("Error: " + e.message);
                } finally {
                  setAdminAssignPrepBuilding(false);
                }
              };

              return (
                <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"#000a", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
                  onClick={() => setAdminAssignPrepStudent(null)}>
                  <div style={{ background:"#1a1a1a", border:"1px solid #333", borderRadius:16, padding:20, maxWidth:420, width:"100%", animation:"fade-in .25s ease" }}
                    onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize:14, fontWeight:800, color:"#fff", marginBottom:4 }}>Assign Test Prep</div>
                    <div style={{ fontSize:11, color:"#9A9490", marginBottom:16 }}>For: {student.display_name} (@{student.username})</div>

                    {/* Test date */}
                    <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Test Date</div>
                    <input type="date" value={tpSetup.testDate}
                      min={new Date().toISOString().split("T")[0]}
                      max={new Date(Date.now()+14*86400000).toISOString().split("T")[0]}
                      onChange={e => setTpSetup(s=>({...s, testDate:e.target.value}))}
                      style={{ width:"100%", padding:"8px 10px", background:"#2a2a2a", border:"1px solid #3a3a3a", borderRadius:6, color:"#fff", fontSize:13, marginBottom:14, boxSizing:"border-box" }}/>

                    {/* Topics */}
                    <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Topics (optional)</div>
                    <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                      <input value={tpSetup.topicInput||""} onChange={e => setTpSetup(s=>({...s, topicInput:e.target.value}))}
                        onKeyDown={e => { if (e.key==="Enter" && (tpSetup.topicInput||"").trim()) setTpSetup(s=>({...s, topics:[...s.topics, s.topicInput.trim()], topicInput:""})); }}
                        placeholder="Type topic + Enter"
                        style={{ flex:1, padding:"8px 10px", background:"#2a2a2a", border:"1px solid #3a3a3a", borderRadius:6, color:"#fff", fontSize:12 }}/>
                      <button onClick={() => { if ((tpSetup.topicInput||"").trim()) setTpSetup(s=>({...s, topics:[...s.topics, s.topicInput.trim()], topicInput:""})); }}
                        style={{ padding:"8px 12px", background:"#1E3A5F", border:"none", borderRadius:6, color:"#fff", fontWeight:800, cursor:"pointer" }}>+</button>
                    </div>
                    {tpSetup.topics?.length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:14 }}>
                        {tpSetup.topics.map((t,i) => (
                          <span key={i} style={{ background:"#1E3A5F22", border:"1px solid #1E3A5F44", borderRadius:20, padding:"3px 8px", fontSize:11, color:"#60a5fa", display:"flex", alignItems:"center", gap:4 }}>
                            {t} <button onClick={() => setTpSetup(s=>({...s, topics:s.topics.filter((_,j)=>j!==i)}))} style={{ background:"none", border:"none", color:"#60a5fa", cursor:"pointer", fontSize:12, padding:0 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Subject selection + generate */}
                    <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Select Subject to Generate Plan</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                      {SUBJECTS.map(sub => (
                        <button key={sub.id}
                          disabled={!tpSetup.testDate || adminAssignPrepBuilding}
                          onClick={() => handleAssign(sub.id)}
                          style={{ padding:"8px 10px", background:sub.accent+"18", border:`1px solid ${sub.accent}44`, borderRadius:8, cursor:!tpSetup.testDate||adminAssignPrepBuilding?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:6, opacity:!tpSetup.testDate?0.4:1 }}>
                          <SubjectIcon id={sub.id} size={14} color={sub.accent} strokeWidth={1.8}/>
                          <span style={{ fontSize:12, fontWeight:800, color:sub.accent }}>{sub.name}</span>
                        </button>
                      ))}
                    </div>

                    {adminAssignPrepBuilding && (
                      <div style={{ textAlign:"center", padding:"12px 0 0", fontSize:12, color:"#9A9490" }}>🧠 Generating plan…</div>
                    )}

                    <button onClick={() => setAdminAssignPrepStudent(null)}
                      style={{ width:"100%", marginTop:14, padding:"9px", background:"transparent", border:"1px solid #3a3a3a", borderRadius:8, color:"#9A9490", fontSize:12, cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })()}

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
              <div style={{ ...S.logo, marginBottom:0 }}><SubjectIcon id={subject?.id} size={16} color={subject?.accent||"#1E3A5F"} strokeWidth={1.8}/> {subject?.name || "Practice"}</div>
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
                  <div style={{ fontSize:18, marginBottom:5 }}><SubjectIcon id={subject?.id||"math"} size={32} color={subject?.accent||"#1E3A5F"} strokeWidth={1.5}/></div>
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

                {/* ── Curriculum Library Topics (admin-curated) ── */}
                {curriculumTopics.length > 0 && (
                  <>
                    <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:8, marginTop:8, marginBottom:-2 }}>
                      <SubjectIcon id={subject?.id} size={12} color={subject?.accent||"#1E3A5F"} strokeWidth={2}/>
                      <span style={{ fontSize:9, color:subject?.accent||"#1E3A5F", letterSpacing:3, textTransform:"uppercase", fontWeight:800 }}>Course Library</span>
                      <div style={{ flex:1, height:1, background:(subject?.accent||"#1E3A5F")+"22" }}/>
                    </div>
                    {curriculumTopics.map(t => {
                      const color = subject?.accent || "#1E3A5F";
                      return (
                        <button key={"curr_"+t.topicKey}
                          onClick={() => { setHwTopic({ ...t, _fromCurriculum: true }); setHwFile(null); setDifficulty(1); setScreen("confirm"); }}
                          style={{ background:"#FAFAF8", border:`1.5px solid ${color}33`, borderRadius:10, padding:"12px 14px", cursor:"pointer", textAlign:"left", transition:"border-color .2s, box-shadow .2s", position:"relative", boxShadow:"none" }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=color+"77";e.currentTarget.style.boxShadow=`0 2px 10px ${color}18`;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=color+"33";e.currentTarget.style.boxShadow="none";}}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:6, marginBottom:4 }}>
                            <div style={{ fontSize:13, fontWeight:800, color, lineHeight:1.25, flex:1 }}>{t.topicName}</div>
                            <div style={{ fontSize:8, background:color+"18", border:`1px solid ${color}33`, color, borderRadius:4, padding:"2px 6px", fontWeight:800, letterSpacing:1, whiteSpace:"nowrap", flexShrink:0 }}>LIBRARY</div>
                          </div>
                          <div style={{ fontSize:10, color:"#9A9490", lineHeight:1.45, marginBottom: t.gradeLevel ? 5 : 0 }}>{t.description}</div>
                          {t.gradeLevel && (
                            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                              <div style={{ width:3, height:3, borderRadius:"50%", background:color+"66" }}/>
                              <div style={{ fontSize:9, color:color+"77", fontWeight:700 }}>{t.gradeLevel}</div>
                            </div>
                          )}
                          {(t.exemplarQuestions||[]).length > 0 && (
                            <div style={{ fontSize:9, color:color+"55", marginTop:4, fontWeight:600 }}>
                              {t.exemplarQuestions.length} calibration example{t.exemplarQuestions.length>1?"s":""}
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {topicBank.length > 0 && (
                      <div style={{ gridColumn:"1/-1", fontSize:9, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", fontWeight:700, marginTop:4, marginBottom:-4 }}>
                        Your Topics
                      </div>
                    )}
                  </>
                )}

                {/* ── My Topics — personal homework uploads ── */}
                {topicBank.length > 0 && (
                  <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:8, marginTop:4, marginBottom:-2 }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" stroke="#9A9490" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span style={{ fontSize:9, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", fontWeight:800 }}>My Uploads</span>
                    <div style={{ flex:1, height:1, background:"#9A9490"+"22" }}/>
                  </div>
                )}
                {topicBank.map(t => {
                  const color = topicColor(t.topicKey);
                  return (
                    <button key={t.topicKey}
                      onClick={() => { setHwTopic(t); setHwFile(null); setDifficulty(1); setScreen("confirm"); }}
                      style={{ background:"#FFFFFF", border:`1.5px solid ${color}22`, borderRadius:10, padding:"12px 14px", cursor:"pointer", textAlign:"left", transition:"border-color .15s, background .15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=color+"77";e.currentTarget.style.background=color+"08";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=color+"22";e.currentTarget.style.background="#FFFFFF";}}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                        <div style={{ fontSize:11, fontWeight:800, color, lineHeight:1.25, flex:1 }}>{t.topicName}</div>
                        <div style={{ fontSize:9, color:color+"66", fontFamily:"monospace", flexShrink:0, marginLeft:6 }}>×{t.sessionCount}</div>
                      </div>
                      <div style={{ fontSize:10, color:"#9A9490", lineHeight:1.4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{t.description}</div>
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
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
                    {[
                      { label:"Sessions", value: d.totalSessions, sub: "total", color:"#1E3A5F" },
                      { label:"Streak", value: d.currentStreak, sub: d.currentStreak > 0 ? "days 🔥" : "days", color: d.currentStreak >= 3 ? POS_COLOR : "#1E3A5F" },
                    ].map(({ label, value, sub, color }) => (
                      <div key={label} style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:10, padding:"14px 12px", textAlign:"center" }}>
                        <div style={{ fontSize:22, fontWeight:800, color, fontFamily:"monospace" }}>{value}</div>
                        <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, textTransform:"uppercase", marginTop:3 }}>{label}</div>
                        <div style={{ fontSize:10, color:"#C0BCB8" }}>{sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Mastery vs Raw Accuracy comparison card */}
                  <div style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:12, padding:"16px 18px", marginBottom:16 }}>
                    <div style={{ fontSize:10, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", marginBottom:12, fontWeight:700 }}>Score vs Mastery</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:8, alignItems:"center" }}>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:11, color:"#9A9490", marginBottom:4 }}>Raw Accuracy</div>
                        <div style={{ fontSize:28, fontWeight:800, fontFamily:"monospace", color: d.avgScore >= 70 ? POS_COLOR : d.avgScore >= 50 ? "#D97706" : NEG_COLOR }}>{d.avgScore}%</div>
                        <div style={{ fontSize:10, color:"#C0BCB8" }}>{d.totalCorrect}/{d.totalQuestions} correct</div>
                      </div>
                      <div style={{ textAlign:"center", color:"#C0BCB8", fontSize:18 }}>→</div>
                      <div style={{ textAlign:"center", background:"#1E3A5F08", borderRadius:10, padding:"10px 8px" }}>
                        <div style={{ fontSize:11, color:"#1E3A5F", marginBottom:4, fontWeight:700 }}>Mastery Score</div>
                        <div style={{ fontSize:28, fontWeight:800, fontFamily:"monospace", color:"#1E3A5F" }}>{d.avgMasteryOverall}</div>
                        <div style={{ fontSize:10, color:"#9A9490" }}>{masteryLabel(d.avgMasteryOverall)}</div>
                      </div>
                    </div>
                    <div style={{ marginTop:12, background:"#E2DDD8", borderRadius:3, height:4, overflow:"hidden", position:"relative" }}>
                      <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${Math.min(d.avgScore,100)}%`, background: d.avgScore >= 70 ? POS_COLOR : "#D97706", borderRadius:3, opacity:0.4 }}/>
                      <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${Math.min(d.avgMasteryOverall/2.2,100)}%`, background:"#1E3A5F", borderRadius:3 }}/>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
                      <div style={{ fontSize:9, color:"#C0BCB8" }}>■ Mastery (difficulty-weighted)</div>
                      <div style={{ fontSize:9, color:"#C0BCB8", opacity:0.5 }}>■ Raw accuracy</div>
                    </div>
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
                              <SubjectIcon id={sub.id} size={18} color="#C0BCB8" strokeWidth={1.6}/>
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
                                <SubjectIcon id={sub.id} size={18} color={sub.accent} strokeWidth={1.6}/>
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
                            {/* Difficulty distribution pills */}
                            <div style={{ display:"flex", gap:3, marginTop:6, marginBottom:4 }}>
                              {[["S", s.diffProgression?.starter||0, "#60a5fa"], ["B", s.diffProgression?.building||0, "#f0a050"], ["C", s.diffProgression?.challenging||0, "#c084fc"]].map(([lbl,cnt,clr]) =>
                                cnt > 0 ? (
                                  <span key={lbl} style={{ fontSize:9, background:clr+"22", border:`1px solid ${clr}44`, borderRadius:4, padding:"1px 5px", color:clr, fontWeight:800 }}>
                                    {lbl}{cnt}
                                  </span>
                                ) : null
                              )}
                              {s.diffTrend === "leveling-up" && <span style={{ fontSize:9, color:POS_COLOR, fontWeight:800, marginLeft:2 }}>↑ leveling up</span>}
                            </div>
                            {/* Dual bar: mastery vs raw */}
                            <div style={{ position:"relative", background:sub.border, borderRadius:3, height:5, overflow:"hidden" }}>
                              <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${Math.min(s.avgScore,100)}%`, background:scoreColor, opacity:0.35, borderRadius:3 }}/>
                              <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${Math.min((s.avgMastery||s.avgScore)/2.2,100)}%`, background:sub.accent, borderRadius:3, transition:"width .5s ease" }}/>
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                              <div style={{ fontSize:9, color:sub.accentDim }}>mastery: {s.avgMastery||"–"}</div>
                              <div style={{ fontSize:9, color:sub.accentDim, opacity:0.6 }}>{s.avgScore}% raw</div>
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
                            <span style={{ fontSize:18 }}><SubjectIcon id={s.subjectId} size={20} color={sub?.accent||"#1E3A5F"} strokeWidth={1.7}/></span>
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
                        <SubjectIcon id={sub.id} size={14} color={dashboardSubject===sub.id?"#fff":sub.accent} strokeWidth={1.8}/> {sub.name}
                      </button>
                    ))}
                  </div>

                  {(dashboardSubject ? SUBJECTS.filter(s=>s.id===dashboardSubject) : SUBJECTS).map(sub => {
                    const s = d.subjectSummaries[sub.id];
                    if (!s?.sessions) return (
                      <div key={sub.id} style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:10, padding:"16px 18px", marginBottom:12, opacity:0.55 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <SubjectIcon id={sub.id} size={20} color="#C0BCB8" strokeWidth={1.6}/>
                          <div style={{ fontSize:14, fontWeight:800, color:"#C0BCB8" }}>{sub.name} — No sessions yet</div>
                        </div>
                      </div>
                    );
                    const scoreColor = s.avgScore >= 70 ? POS_COLOR : s.avgScore >= 50 ? "#D97706" : NEG_COLOR;
                    return (
                      <div key={sub.id} style={{ background:"#FFFFFF", border:`1.5px solid ${sub.border}`, borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                            <SubjectIcon id={sub.id} size={22} color={sub.accent} strokeWidth={1.6}/>
                            <div>
                              <div style={{ fontSize:16, fontWeight:800, color:sub.accent }}>{sub.name}</div>
                              <div style={{ fontSize:10, color:sub.accentDim }}>{s.sessions} sessions · {s.totalQuestions} questions · {Math.round((s.totalTimeSeconds||0)/60)} min</div>
                            </div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:11, color:"#9A9490", marginBottom:2 }}>Raw: {s.avgScore}%</div>
                            <div style={{ fontSize:24, fontWeight:800, color:sub.accent, fontFamily:"monospace" }}>{s.avgMastery||s.avgScore}</div>
                            <div style={{ fontSize:10, color:"#9A9490" }}>mastery · {masteryLabel(s.avgMastery||s.avgScore)}</div>
                          </div>
                        </div>

                        {/* Difficulty breakdown bar */}
                        {s.diffProgression && (
                          <div style={{ marginBottom:14 }}>
                            <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>
                              Difficulty Reached
                              {s.diffTrend === "leveling-up" && <span style={{ color:POS_COLOR, marginLeft:8 }}>↑ Leveling Up</span>}
                              {s.diffTrend === "dropping-back" && <span style={{ color:NEG_COLOR, marginLeft:8 }}>↓ Dropping Back</span>}
                            </div>
                            <div style={{ display:"flex", borderRadius:6, overflow:"hidden", height:20 }}>
                              {[
                                { label:"Starter", count:s.diffProgression.starter, color:"#60a5fa" },
                                { label:"Building", count:s.diffProgression.building, color:"#f0a050" },
                                { label:"Challenging", count:s.diffProgression.challenging, color:"#c084fc" },
                              ].filter(d => d.count > 0).map(d => (
                                <div key={d.label} style={{ flex:d.count, background:d.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff", fontWeight:800, gap:2, minWidth:d.count > 0 ? 24 : 0 }}>
                                  {d.count > 1 && d.label[0]}{d.count}
                                </div>
                              ))}
                            </div>
                            <div style={{ display:"flex", gap:10, marginTop:4 }}>
                              {[["Starter","#60a5fa"],["Building","#f0a050"],["Challenging","#c084fc"]].map(([lbl,clr]) => (
                                <span key={lbl} style={{ fontSize:9, color:clr, fontWeight:700 }}>■ {lbl}</span>
                              ))}
                              {s.challengingSessions > 0 && (
                                <span style={{ fontSize:9, color:"#c084fc", marginLeft:"auto" }}>
                                  Challenging avg: {s.challengingAvgAccuracy}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Score + mastery history chart */}
                        {s.recentScores.length > 1 && (() => {
                          const rawPts = s.recentScores.slice().reverse();
                          const masteryPts = (s.masteryHistory||[]).slice().reverse();
                          const w=300, h=72, padL=28, padB=16;
                          const maxVal = Math.max(...masteryPts, 110);
                          const toY = v => Math.round(h - padB - ((v/maxVal)*(h-padB-4)));
                          const rawXs = rawPts.map((_,i) => padL + Math.round((i/(rawPts.length-1))*(w-padL)));
                          const rawYs = rawPts.map(v => toY(v));
                          const rawPath = rawPts.map((v,i) => `${i===0?"M":"L"}${rawXs[i]},${rawYs[i]}`).join(" ");
                          const masteryXs = masteryPts.map((_,i) => padL + Math.round((i/(Math.max(masteryPts.length-1,1)))*(w-padL)));
                          const masteryYs = masteryPts.map(v => toY(v));
                          const masteryPath = masteryPts.length > 1 ? masteryPts.map((v,i) => `${i===0?"M":"L"}${masteryXs[i]},${masteryYs[i]}`).join(" ") : "";
                          const areaPath = `${rawPath} L${rawXs[rawXs.length-1]},${h-padB} L${rawXs[0]},${h-padB} Z`;
                          const diffColors = ["#60a5fa","#f0a050","#c084fc"];
                          // Get difficulty per session (reversed to oldest-first for chart)
                          const diffHistory = (s.difficultyHistory||[]).slice().reverse();
                          return (
                            <div style={{ background:sub.bg, borderRadius:8, padding:"10px 8px 4px", marginBottom:12 }}>
                              <div style={{ display:"flex", gap:12, marginBottom:6 }}>
                                <span style={{ fontSize:9, color:sub.accent, fontWeight:700 }}>── Raw accuracy</span>
                                <span style={{ fontSize:9, color:"#1E3A5F", fontWeight:700 }}>── Mastery score</span>
                                <span style={{ fontSize:9, color:"#9A9490" }}>(dots = difficulty)</span>
                              </div>
                              <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display:"block", overflow:"visible" }}>
                                {[0,70,100,150].map(v => {
                                  if (v > maxVal + 10) return null;
                                  const y = toY(v);
                                  return <g key={v}><line x1={padL} y1={y} x2={w} y2={y} stroke={sub.border} strokeWidth="1" strokeDasharray={v===100?"4,2":"3,3"} opacity={v===100?0.7:0.4}/><text x={padL-4} y={y+4} textAnchor="end" fill={sub.accentDim} fontSize="8">{v}</text></g>;
                                })}
                                {/* 100 label annotation */}
                                {maxVal > 110 && <text x={w-2} y={toY(100)+4} textAnchor="end" fill={sub.accentDim} fontSize="8" opacity="0.6">100</text>}
                                {/* Raw area fill */}
                                <path d={areaPath} fill={sub.accent} opacity="0.07" />
                                {/* Raw line */}
                                <path d={rawPath} stroke={sub.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
                                {/* Mastery line */}
                                {masteryPath && <path d={masteryPath} stroke="#1E3A5F" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                                {/* Dots colored by difficulty */}
                                {masteryPts.map((v,i) => {
                                  const diff = diffHistory[i] || 0;
                                  const clr = diffColors[diff];
                                  return <circle key={i} cx={masteryXs[i]} cy={masteryYs[i]} r="5" fill={clr} stroke="#fff" strokeWidth="1.5" />;
                                })}
                              </svg>
                              <div style={{ display:"flex", justifyContent:"space-between", padding:"0 8px", marginTop:2 }}>
                                <div style={{ fontSize:9, color:sub.accentDim }}>← Oldest</div>
                                <div style={{ display:"flex", gap:8 }}>
                                  {[["S","#60a5fa"],["B","#f0a050"],["C","#c084fc"]].map(([l,c])=>(
                                    <span key={l} style={{ fontSize:9, color:c, fontWeight:800 }}>● {l}</span>
                                  ))}
                                </div>
                                <div style={{ fontSize:9, color:sub.accentDim }}>Most Recent →</div>
                              </div>
                            </div>
                          );
                        })()}
                        {/* Strong topics */}
                        {s.strongTopics?.length > 0 && (
                          <div style={{ marginBottom:10 }}>
                            <div style={{ fontSize:10, color:POS_COLOR, letterSpacing:2, textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>Strong Areas</div>
                            {s.strongTopics.map(({topic,accuracy,attempts}) => (
                              <div key={topic} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #F0EEE9" }}>
                                <span style={{ fontSize:12, color:"#166534" }}>{topicLabel(topic)}</span>
                                <span style={{ fontSize:11, color:POS_COLOR, fontFamily:"monospace", fontWeight:700 }}>{accuracy}% ({attempts} attempts)</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Weak topics */}
                        {s.weakTopics.length > 0 && (
                          <div style={{ marginBottom: s.persistentErrors?.length > 0 ? 10 : 0 }}>
                            <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>Needs Attention</div>
                            {s.weakTopics.map(({topic,accuracy,attempts}) => (
                              <div key={topic} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #F0EEE9" }}>
                                <span style={{ fontSize:12, color:"#555" }}>{topicLabel(topic)}</span>
                                <span style={{ fontSize:11, color:NEG_COLOR, fontFamily:"monospace", fontWeight:700 }}>{accuracy}% over {attempts} tries</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Persistent errors */}
                        {s.persistentErrors?.length > 0 && (
                          <div>
                            <div style={{ fontSize:10, color:NEG_COLOR, letterSpacing:2, textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>⚠ Repeated Errors</div>
                            {s.persistentErrors.map(({question,times},i) => (
                              <div key={i} style={{ padding:"6px 0", borderBottom:"1px solid #F0EEE9" }}>
                                <div style={{ fontSize:11, color:"#555", lineHeight:1.5 }}>"{question}"</div>
                                <div style={{ fontSize:10, color:NEG_COLOR, fontFamily:"monospace", marginTop:2 }}>missed {times}× across sessions</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {s.weakTopics.length === 0 && !s.persistentErrors?.length && s.sessions > 0 && (
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
                          <div style={{ background:"#EEF3FA", border:"1.5px solid #1E3A5F22", borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
                            <div style={{ fontSize:10, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>Overall Assessment</div>
                            <div style={{ fontSize:15, fontWeight:700, color:"#1E3A5F", lineHeight:1.7 }}>{ins.headline}</div>
                          </div>

                          {/* Data highlights — new field */}
                          {(ins.data_highlights||[]).length > 0 && (
                            <div style={{ background:"#1E3A5F", border:"1.5px solid #1E3A5F", borderRadius:12, padding:"16px 18px", marginBottom:16 }}>
                              <div style={{ fontSize:10, color:"#B8C8D8", letterSpacing:3, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>📊 Data Highlights</div>
                              {(ins.data_highlights||[]).map((s,i) => {
                                const parts = s.split("— EVIDENCE:");
                                return (
                                  <div key={i} style={{ marginBottom:10, paddingBottom:10, borderBottom: i < ins.data_highlights.length-1 ? "1px solid #ffffff18" : "none" }}>
                                    {parts[0] && <div style={{ fontSize:13, color:"#E8F0F8", lineHeight:1.6, fontWeight:600 }}>{parts[0].replace("OBSERVATION:","").trim()}</div>}
                                    {parts[1] && <div style={{ fontSize:12, color:"#7A9CBD", lineHeight:1.5, marginTop:3, fontFamily:"monospace" }}>→ {parts[1].trim()}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                            {/* Strengths */}
                            <div style={{ background:"#F0FDF4", border:"1.5px solid #BBF7D0", borderRadius:12, padding:"16px" }}>
                              <div style={{ fontSize:10, color:POS_COLOR, letterSpacing:3, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>✓ Strengths</div>
                              {(ins.strengths||[]).map((s,i) => (
                                <div key={i} style={{ fontSize:12, color:"#166534", lineHeight:1.75, marginBottom:8, paddingLeft:10, borderLeft:`2px solid ${POS_COLOR}` }}>
                                  {s}
                                </div>
                              ))}
                            </div>
                            {/* Growth areas */}
                            <div style={{ background:"#FFF7ED", border:"1.5px solid #FED7AA", borderRadius:12, padding:"16px" }}>
                              <div style={{ fontSize:10, color:"#D97706", letterSpacing:3, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>↑ Growth Areas</div>
                              {(ins.growth_areas||[]).map((s,i) => (
                                <div key={i} style={{ fontSize:12, color:"#92400E", lineHeight:1.75, marginBottom:8, paddingLeft:10, borderLeft:"2px solid #D97706" }}>
                                  {s}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Learning science note — new field */}
                          {ins.learning_science_note && (
                            <div style={{ background:"#F5F3FF", border:"1.5px solid #c084fc44", borderRadius:12, padding:"16px 18px", marginBottom:14 }}>
                              <div style={{ fontSize:10, color:"#7c3aed", letterSpacing:3, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>🔬 Learning Science</div>
                              <div style={{ fontSize:13, color:"#4c1d95", lineHeight:1.85 }}>{ins.learning_science_note}</div>
                            </div>
                          )}

                          {/* Patterns */}
                          <div style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:12, padding:"16px 18px", marginBottom:14 }}>
                            <div style={{ fontSize:10, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>📈 Engagement Patterns</div>
                            <div style={{ fontSize:13, color:"#444", lineHeight:1.85 }}>{ins.patterns}</div>
                          </div>

                          {/* Recommendation */}
                          <div style={{ background:"#FFFBEB", border:"1.5px solid #FDE68A", borderRadius:12, padding:"16px 18px", marginBottom:14 }}>
                            <div style={{ fontSize:10, color:"#92400E", letterSpacing:3, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>💡 Action Plan</div>
                            <div style={{ fontSize:13, color:"#78350F", lineHeight:1.9, whiteSpace:"pre-line" }}>{ins.recommendation}</div>
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

        {/* ════════════════════════════════════════════════════════
            TEST PREP SCREENS
        ════════════════════════════════════════════════════════ */}

        {/* SETUP STEP 1 — Subject + Date */}
        {testPrepScreen === "setup1" && (
          <div style={{ ...S.card, animation:"fade-in .3s ease" }}>
            <button onClick={() => setTestPrepScreen(null)} style={{ background:"none", border:"none", color:"#9A9490", cursor:"pointer", fontSize:12, marginBottom:12, padding:0 }}>← Back</button>
            <div style={{ fontSize:11, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>Test Prep · Step 1 of 3</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#1E3A5F", marginBottom:20 }}>What's the test?</div>

            {/* Subject picker */}
            <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Subject</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
              {SUBJECTS.map(sub => (
                <button key={sub.id} onClick={() => {
                    setTpSetup(s => ({...s, subject:sub}));
                    loadCurriculum(sub.id).then(setTpCurriculumTopics);
                  }}
                  style={{ padding:"10px 12px", background:tpSetup.subject?.id===sub.id ? sub.accent+"18" : "#F8F6F3", border:`1.5px solid ${tpSetup.subject?.id===sub.id ? sub.accent : "#E2DDD8"}`, borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", gap:8, transition:"all .15s" }}>
                  <SubjectIcon id={sub.id} size={16} color={tpSetup.subject?.id===sub.id ? sub.accent : "#9A9490"} strokeWidth={1.8}/>
                  <span style={{ fontSize:12, fontWeight:800, color:tpSetup.subject?.id===sub.id ? sub.accent : "#555" }}>{sub.name}</span>
                </button>
              ))}
            </div>

            {/* Test date */}
            <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Test Date</div>
            <input type="date" value={tpSetup.testDate}
              min={new Date().toISOString().split("T")[0]}
              max={new Date(Date.now()+14*86400000).toISOString().split("T")[0]}
              onChange={e => setTpSetup(s => ({...s, testDate:e.target.value}))}
              style={{ width:"100%", padding:"10px 12px", background:"#F8F6F3", border:"1.5px solid #E2DDD8", borderRadius:10, fontSize:14, color:"#1E3A5F", fontWeight:700, boxSizing:"border-box", marginBottom:8 }}/>
            {tpSetup.testDate && (() => {
              const d = Math.ceil((new Date(tpSetup.testDate) - new Date()) / 86400000);
              return <div style={{ fontSize:11, color: d<=1?"#dc2626":d<=3?"#D97706":"#16a34a", fontWeight:700, marginBottom:16 }}>
                {d <= 0 ? "⚠️ That date has passed" : d === 1 ? "⚡ Tomorrow — we'll make it count!" : d <= 3 ? `⏰ ${d} days — focused plan` : d <= 7 ? `📅 ${d} days — solid prep time` : `🗓 ${d} days — comprehensive plan`}
              </div>;
            })()}

            <button onClick={() => { if (tpSetup.subject && tpSetup.testDate && new Date(tpSetup.testDate) > new Date()) setTestPrepScreen("setup2"); }}
              disabled={!tpSetup.subject || !tpSetup.testDate || new Date(tpSetup.testDate) <= new Date()}
              style={{ width:"100%", padding:"12px", background:"#1E3A5F", border:"none", borderRadius:10, color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer", opacity:!tpSetup.subject||!tpSetup.testDate||new Date(tpSetup.testDate)<=new Date()?0.4:1 }}>
              Next: Add Topics →
            </button>
          </div>
        )}

        {/* SETUP STEP 2 — Topics */}
        {testPrepScreen === "setup2" && (
          <div style={{ ...S.card, animation:"fade-in .3s ease" }}>
            <button onClick={() => setTestPrepScreen("setup1")} style={{ background:"none", border:"none", color:"#9A9490", cursor:"pointer", fontSize:12, marginBottom:12, padding:0 }}>← Back</button>
            <div style={{ fontSize:11, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>Test Prep · Step 2 of 3</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#1E3A5F", marginBottom:4 }}>What topics?</div>
            <div style={{ fontSize:12, color:"#9A9490", marginBottom:16 }}>Add topics from your curriculum or type them in. Or skip — we'll extract them from your review materials.</div>

            {/* Topic chips */}
            {tpSetup.topics.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                {tpSetup.topics.map((t, i) => (
                  <span key={i} style={{ background:tpSetup.subject?.accent+"18", border:`1px solid ${tpSetup.subject?.accent}44`, borderRadius:20, padding:"4px 10px", fontSize:11, fontWeight:700, color:tpSetup.subject?.accent, display:"flex", alignItems:"center", gap:5 }}>
                    {t}
                    <button onClick={() => setTpSetup(s=>({...s, topics:s.topics.filter((_,j)=>j!==i)}))} style={{ background:"none", border:"none", cursor:"pointer", color:"inherit", fontSize:13, lineHeight:1, padding:0 }}>×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Free-form input */}
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              <input value={tpSetup.topicInput} onChange={e => setTpSetup(s=>({...s, topicInput:e.target.value}))}
                onKeyDown={e => { if (e.key==="Enter" && tpSetup.topicInput.trim()) { setTpSetup(s=>({...s, topics:[...s.topics, s.topicInput.trim()], topicInput:""})); }}}
                placeholder="Type a topic and press Enter…"
                style={{ flex:1, padding:"9px 12px", background:"#F8F6F3", border:"1.5px solid #E2DDD8", borderRadius:10, fontSize:13, color:"#1E3A5F" }}/>
              <button onClick={() => { if (tpSetup.topicInput.trim()) setTpSetup(s=>({...s, topics:[...s.topics, s.topicInput.trim()], topicInput:""})); }}
                style={{ padding:"9px 14px", background:tpSetup.subject?.accent||"#1E3A5F", border:"none", borderRadius:10, color:"#fff", fontWeight:800, cursor:"pointer", fontSize:13 }}>+</button>
            </div>

            {/* Curriculum library quick-add — uses component-level tpCurriculumTopics state */}
            {tpCurriculumTopics.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:9, color:"#9A9490", letterSpacing:2, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Quick-add from library</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {tpCurriculumTopics.map(t => {
                    const already = tpSetup.topics.includes(t.topicName);
                    return (
                      <button key={t.topicKey} onClick={() => { if (!already) setTpSetup(s=>({...s, topics:[...s.topics, t.topicName]})); }}
                        style={{ padding:"4px 10px", background:already?"#F0EEE9":"#fff", border:`1px solid ${tpSetup.subject?.accent||"#1E3A5F"}33`, borderRadius:20, fontSize:11, fontWeight:700, color:already?"#C0BCB8":tpSetup.subject?.accent||"#1E3A5F", cursor:already?"default":"pointer" }}>
                        {already ? "✓ " : ""}{t.topicName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ fontSize:11, color:"#9A9490", marginBottom:16, fontStyle:"italic" }}>
              💡 No topics added? That's fine — if you upload review materials in the next step, the AI will extract topics automatically.
            </div>

            <button onClick={() => setTestPrepScreen("setup3")}
              style={{ width:"100%", padding:"12px", background:"#1E3A5F", border:"none", borderRadius:10, color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer" }}>
              Next: Upload Materials →
            </button>
          </div>
        )}

        {/* SETUP STEP 3 — Materials + Generate */}
        {testPrepScreen === "setup3" && (
          <div style={{ ...S.card, animation:"fade-in .3s ease" }}>
            <button onClick={() => setTestPrepScreen("setup2")} style={{ background:"none", border:"none", color:"#9A9490", cursor:"pointer", fontSize:12, marginBottom:12, padding:0 }}>← Back</button>
            <div style={{ fontSize:11, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>Test Prep · Step 3 of 3</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#1E3A5F", marginBottom:4 }}>Upload materials</div>
            <div style={{ fontSize:12, color:"#9A9490", marginBottom:16 }}>Optional but powerful. Upload your review guide, previous homeworks, or class notes — the AI will calibrate every question to match the exact difficulty of your test.</div>

            {/* Upload area */}
            {!tpSetup.materials ? (
              <label style={{ display:"block", border:"2px dashed #E2DDD8", borderRadius:12, padding:"28px 16px", textAlign:"center", cursor:"pointer", marginBottom:16, background:"#FAFAF8" }}>
                <input type="file" accept="image/*,.pdf" style={{ display:"none" }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const b64 = ev.target.result.split(",")[1];
                      setTpSetup(s=>({...s, materials:file.name, materialsB64:b64, materialsType:file.type}));
                    };
                    reader.readAsDataURL(file);
                  }}/>
                <div style={{ fontSize:28, marginBottom:8 }}>📄</div>
                <div style={{ fontSize:13, fontWeight:700, color:"#555", marginBottom:4 }}>Tap to upload</div>
                <div style={{ fontSize:11, color:"#9A9490" }}>JPG, PNG, PDF — review guide, homework, class notes</div>
              </label>
            ) : (
              <div style={{ background:"#F0FDF4", border:"1px solid #86efac", borderRadius:10, padding:"12px 14px", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#16a34a" }}>✓ {tpSetup.materials}</div>
                  <div style={{ fontSize:11, color:"#9A9490" }}>AI will use this to calibrate question difficulty</div>
                </div>
                <button onClick={() => setTpSetup(s=>({...s, materials:null, materialsB64:null, materialsType:null}))}
                  style={{ background:"none", border:"none", color:"#9A9490", cursor:"pointer", fontSize:18 }}>×</button>
              </div>
            )}

            {/* Summary before generation */}
            <div style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
              <div style={{ fontSize:10, color:"#9A9490", letterSpacing:2, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Plan Preview</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  ["Subject", tpSetup.subject?.name],
                  ["Test date", tpSetup.testDate ? new Date(tpSetup.testDate).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "—"],
                  ["Days to prep", tpSetup.testDate ? Math.ceil((new Date(tpSetup.testDate)-new Date())/86400000) : "—"],
                  ["Topics", tpSetup.topics.length ? `${tpSetup.topics.length} selected` : "From materials"],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize:9, color:"#9A9490", letterSpacing:1, textTransform:"uppercase" }}>{label}</div>
                    <div style={{ fontSize:13, fontWeight:800, color:"#1E3A5F" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {tpSetup.generatingPlan ? (
              /* ── Magic loading screen while AI builds the plan ── */
              <div style={{ textAlign:"center", padding:"8px 0 4px" }}>
                {/* Animated brain/constellation graphic */}
                <div style={{ marginBottom:20, position:"relative", height:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width={120} height={100} viewBox="0 0 120 100" style={{ overflow:"visible" }}>
                    {/* Pulsing outer ring */}
                    <circle cx={60} cy={50} r={38} fill="none" stroke={tpSetup.subject?.accent||"#1E3A5F"} strokeWidth={1} strokeDasharray="4 6" opacity={0.3} style={{ animation:"spin 8s linear infinite", transformOrigin:"60px 50px" }}/>
                    {/* Middle ring */}
                    <circle cx={60} cy={50} r={26} fill="none" stroke={tpSetup.subject?.accent||"#1E3A5F"} strokeWidth={1.5} strokeDasharray="3 5" opacity={0.5} style={{ animation:"spin 5s linear infinite reverse", transformOrigin:"60px 50px" }}/>
                    {/* Core circle */}
                    <circle cx={60} cy={50} r={14} fill={tpSetup.subject?.accent||"#1E3A5F"} opacity={0.12}/>
                    <circle cx={60} cy={50} r={14} fill="none" stroke={tpSetup.subject?.accent||"#1E3A5F"} strokeWidth={2} opacity={0.6}/>
                    {/* Subject icon in center */}
                    <g transform="translate(48,38)">
                      <SubjectIcon id={tpSetup.subject?.id||"math"} size={24} color={tpSetup.subject?.accent||"#1E3A5F"} strokeWidth={1.8}/>
                    </g>
                    {/* Orbiting dots representing sessions being planned */}
                    {[0,1,2,3,4].map(i => {
                      const angle = (i/5)*Math.PI*2;
                      const x = 60 + Math.cos(angle)*38;
                      const y = 50 + Math.sin(angle)*38;
                      return <circle key={i} cx={x} cy={y} r={4} fill={tpSetup.subject?.accent||"#1E3A5F"} opacity={0.7} style={{ animation:`pulse ${1+i*0.3}s ease-in-out infinite alternate`, animationDelay:`${i*0.2}s` }}/>;
                    })}
                  </svg>
                </div>
                <div style={{ fontSize:17, fontWeight:900, color:"#1E3A5F", marginBottom:8 }}>
                  Generating your ideal study strategy
                </div>
                {/* Animated step indicators */}
                {[
                  tpSetup.materialsB64 ? "📄 Reading your review materials" : "📚 Loading subject curriculum",
                  "🧠 Analysing your mastery data",
                  "📅 Computing optimal spacing",
                  "✨ Calibrating question difficulty",
                ].map((step, i) => (
                  <div key={i} style={{ fontSize:12, color:"#9A9490", marginBottom:5, opacity:1, animation:`fade-in .5s ease ${i*0.7}s both` }}>
                    {step}
                  </div>
                ))}
                <div style={{ marginTop:16, width:"100%", height:4, background:"#E2DDD8", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:tpSetup.subject?.accent||"#1E3A5F", borderRadius:2, animation:"progress-bar 12s ease-out forwards" }}/>
                </div>
              </div>
            ) : (
              <button onClick={async () => {
                setTpSetup(s=>({...s, generatingPlan:true}));
                setTpPlanLoading(true);
                try {
                  const plan = await generateTestPrepPlan({
                    subject: tpSetup.subject,
                    testDate: tpSetup.testDate,
                    topics: tpSetup.topics,
                    materialsB64: tpSetup.materialsB64,
                    materialsType: tpSetup.materialsType,
                    masteryData: dashboardData,
                    username: currentUser?.username,
                  });
                  const existing = await loadTestPreps(currentUser?.username);
                  const updated = [...existing, plan];
                  await saveTestPreps(updated, currentUser?.username);
                  setTestPreps(updated);
                  setActiveTestPrep(plan);
                  setTestPrepScreen("plan");
                } catch(e) {
                  setError("Could not generate plan: " + e.message);
                  setTpSetup(s=>({...s, generatingPlan:false}));
                  setTpPlanLoading(false);
                }
              }} style={{ width:"100%", padding:"13px", background:tpSetup.subject?.accent||"#1E3A5F", border:"none", borderRadius:10, color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer" }}>
                ✨ Generate Study Plan
              </button>
            )}
          </div>
        )}

        {/* PLAN VIEW */}
        {testPrepScreen === "plan" && activeTestPrep && (() => {
          const prep = activeTestPrep;
          const sub = SUBJECTS.find(s => s.id === prep.subjectId);
          const accent = sub?.accent || "#1E3A5F";
          const daysLeft = Math.ceil((new Date(prep.testDate) - new Date()) / 86400000);
          const completedNums = new Set((prep.completedSessions||[]).map(c => c.sessionNumber));

          const archivePlan = async () => {
            const updated = testPreps.map(p => p.id===prep.id ? {...p, status:"archived"} : p);
            await saveTestPreps(updated, currentUser?.username);
            setTestPreps(updated);
            setTestPrepScreen(null);
            setActiveTestPrep(null);
          };

          return (
            <div style={{ ...S.card, animation:"fade-in .3s ease" }}>
              <button onClick={() => setTestPrepScreen(null)} style={{ background:"none", border:"none", color:"#9A9490", cursor:"pointer", fontSize:12, marginBottom:12, padding:0 }}>← Back to subjects</button>

              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <SubjectIcon id={prep.subjectId} size={20} color={accent} strokeWidth={1.6}/>
                    <div style={{ fontSize:18, fontWeight:900, color:accent }}>{prep.planTitle}</div>
                  </div>
                  <div style={{ fontSize:11, color:"#9A9490" }}>{prep.planSummary}</div>
                </div>
                {/* Countdown */}
                <div style={{ textAlign:"center", background:accent+"12", border:`1.5px solid ${accent}33`, borderRadius:12, padding:"10px 14px", flexShrink:0 }}>
                  <div style={{ fontSize:28, fontWeight:900, color:daysLeft<=1?"#dc2626":daysLeft<=3?"#D97706":accent, fontFamily:"monospace", lineHeight:1 }}>{Math.max(0,daysLeft)}</div>
                  <div style={{ fontSize:9, color:"#9A9490", letterSpacing:1, textTransform:"uppercase" }}>days left</div>
                  <div style={{ fontSize:9, color:"#9A9490", marginTop:2 }}>{new Date(prep.testDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <div style={{ fontSize:10, color:"#9A9490", fontWeight:700, letterSpacing:1 }}>SESSION PROGRESS</div>
                  <div style={{ fontSize:10, color:accent, fontWeight:800 }}>{completedNums.size}/{prep.sessions.length} complete</div>
                </div>
                <div style={{ background:"#E2DDD8", borderRadius:4, height:6, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(completedNums.size/prep.sessions.length)*100}%`, background:accent, borderRadius:4, transition:"width .5s ease" }}/>
                </div>
              </div>

              {/* Session cards */}
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
                {prep.sessions.map(session => {
                  const done = completedNums.has(session.sessionNumber);
                  const isNext = !done && !prep.sessions.slice(0, session.sessionNumber-1).some(s => !completedNums.has(s.sessionNumber));
                  const completedData = (prep.completedSessions||[]).find(c => c.sessionNumber === session.sessionNumber);
                  const sessionDate = new Date(session.scheduledDate);
                  const isPast = sessionDate < new Date() && !done;
                  return (
                    <div key={session.sessionNumber} style={{ background: done?"#F0FDF4": isNext?accent+"0f":"#F8F6F3", border:`1.5px solid ${done?"#86efac":isNext?accent+"55":"#E2DDD8"}`, borderRadius:12, padding:"12px 14px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:26, height:26, borderRadius:"50%", background:done?"#16a34a":isNext?accent:"#E2DDD8", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <span style={{ fontSize:11, fontWeight:900, color:"#fff" }}>{done?"✓":session.sessionNumber}</span>
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:800, color:done?"#16a34a":isNext?accent:"#9A9490" }}>{session.title}</div>
                            <div style={{ fontSize:10, color:"#9A9490" }}>
                              {session.scheduledDate ? new Date(session.scheduledDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}) : ""} · {session.questionCount}Q · {DIFFICULTY_LABELS[session.difficulty||1]}
                              {session.isConfidenceBuilder && <span style={{ marginLeft:6, color:"#16a34a", fontWeight:700 }}>★ Confidence builder</span>}
                              {isPast && !done && <span style={{ marginLeft:6, color:"#D97706", fontWeight:700 }}>⚠ Overdue</span>}
                            </div>
                          </div>
                        </div>
                        {done && completedData && (
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:15, fontWeight:900, color:"#16a34a", fontFamily:"monospace" }}>{completedData.score}%</div>
                            <div style={{ fontSize:9, color:"#9A9490" }}>{completedData.questionsAnswered}Q</div>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:"#9A9490", lineHeight:1.5, marginBottom: isNext ? 10 : 0 }}>{session.focus}</div>
                      {session.topicNames?.length > 0 && (
                        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom: isNext ? 8 : 0 }}>
                          {session.topicNames.map((t,i) => (
                            <span key={i} style={{ fontSize:9, background:accent+"18", border:`1px solid ${accent}33`, borderRadius:4, padding:"2px 6px", color:accent, fontWeight:700 }}>{t}</span>
                          ))}
                        </div>
                      )}
                      {isNext && (
                        <button onClick={() => {
                          setSubject(sub);
                          setActiveTestPrep({...prep, _launchSessionNumber: session.sessionNumber});
                          setHwTopic({
                            topicName: session.title,
                            topicKey: session.topics?.[0] || "general",
                            description: session.focus,
                            difficultyNotes: session.difficultyNotes || prep.difficultyCalibration,
                            _fromCurriculum: true,
                          });
                          setDifficulty(session.difficulty ?? 1);
                          setHwFile(null);
                          setTestPrepScreen(null);
                          setScreen("confirm");
                        }} style={{ width:"100%", padding:"9px", background:accent, border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer" }}>
                          ▶ Start this session
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Archive button */}
              <button onClick={archivePlan} style={{ width:"100%", padding:"9px", background:"transparent", border:"1px solid #E2DDD8", borderRadius:8, color:"#9A9490", fontSize:11, cursor:"pointer" }}>
                Archive this plan
              </button>
            </div>
          );
        })()}

        {screen === "loading" && (
          <div style={{ ...S.card, textAlign:"center" }}>
            <div style={{ fontSize:38, display:"inline-block", animation:"spin 1.2s linear infinite", marginBottom:18 }}>⚙</div>
            <div style={{ fontSize:20, fontWeight:800, color:"#1E3A5F", marginBottom:8 }}>Building your session…</div>
            <div style={{ fontSize:13, color:"#333", letterSpacing:1 }}>Generating problems</div>
          </div>
        )}

        {/* ── PROBLEM ── */}
        {waitingForQuestions && (
          <div style={{ ...S.card, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:300, gap:16 }}>
            <div style={{ fontSize:32 }}>⏳</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#1E3A5F" }}>Loading next questions…</div>
            <div style={{ fontSize:13, color:"#9A9490" }}>Generating your next batch</div>
            <div style={{ width:200, height:4, background:"#E2DDD8", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:"60%", background:"#1E3A5F", borderRadius:2, animation:"shimmer 1.2s ease-in-out infinite" }}/>
            </div>
          </div>
        )}

        {screen === "problem" && prob && (
          <div style={{ ...S.card, position:"relative" }}>
            {/* ── Adaptive difficulty toast ── */}
            {diffToast && (
              <div style={{ position:"absolute", top:12, left:"50%", transform:"translateX(-50%)", zIndex:100, background:diffToast.color, color:"#fff", padding:"7px 16px", borderRadius:20, fontSize:12, fontWeight:800, whiteSpace:"nowrap", boxShadow:"0 4px 16px #0003", animation:"fade-in .3s ease" }}>
                {diffToast.msg}
              </div>
            )}
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

            {/* ── Universal visual renderer — all subjects ── */}
            {prob.visual && (
              <QuestionVisual visual={prob.visual} submitted={submitted} isCorrect={isCorrect} />
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
            {/* Raw score */}
            <div style={S.bigScore}>{score}</div>
            <div style={S.bigDenom}>out of {log.length}</div>
            {timeTotal>0
              ? <div style={S.timeStat}>⏱ {fmt(Math.min(timeUsed,timeTotal))} of {fmt(timeTotal)}</div>
              : timeUsed>0 ? <div style={S.timeStat}>⏱ {fmt(timeUsed)} elapsed</div> : null}

            {/* Mastery score panel */}
            {(() => {
              const ms = masteryScore(score, log.length, difficulty);
              const w = DIFFICULTY_WEIGHTS[difficulty];
              const mLabel = masteryLabel(ms);
              const diffColor = DIFFICULTY_COLORS[difficulty];
              return (
                <div style={{ background:"#F8F6F3", border:`1.5px solid ${diffColor}44`, borderRadius:12, padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                  <div>
                    <div style={{ fontSize:10, color:"#9A9490", letterSpacing:3, textTransform:"uppercase", marginBottom:3, fontWeight:700 }}>Mastery Score</div>
                    <div style={{ fontSize:32, fontWeight:800, color:diffColor, fontFamily:"monospace", lineHeight:1 }}>{ms}</div>
                    <div style={{ fontSize:11, color:"#9A9490", marginTop:3 }}>= {Math.round(score/log.length*100)}% × {w}× difficulty_weight</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ background:diffColor+"18", border:`1px solid ${diffColor}44`, borderRadius:8, padding:"6px 12px", marginBottom:6 }}>
                      <div style={{ fontSize:12, fontWeight:800, color:diffColor }}>{DIFFICULTY_LABELS[difficulty]}</div>
                      <div style={{ fontSize:9, color:diffColor+"99", letterSpacing:1 }}>DIFFICULTY</div>
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:"#9A9490" }}>{mLabel}</div>
                  </div>
                </div>
              );
            })()}
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
            {/* ── Post-session debrief panel ── */}
            {log.some(l => !l.ok) && (
              <div style={{ marginBottom:16 }}>
                <button onClick={() => setDebriefOpen(o => !o)}
                  style={{ width:"100%", padding:"11px 14px", background: debriefOpen?"#1E3A5F":"#EEF3FA", border:"1.5px solid #1E3A5F33", borderRadius:10, color: debriefOpen?"#fff":"#1E3A5F", fontSize:13, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"all .2s" }}>
                  <span>📋 Session Debrief {debriefLoading ? "— Analysing…" : debrief ? `— ${log.filter(l=>!l.ok).length} missed` : ""}</span>
                  <span style={{ fontSize:11, opacity:0.7 }}>{debriefOpen ? "▲ Hide" : "▼ Show"}</span>
                </button>

                {debriefOpen && (
                  <div style={{ background:"#F8F6F3", border:"1px solid #E2DDD8", borderRadius:"0 0 10px 10px", padding:"14px", animation:"fade-in .3s ease" }}>
                    {debriefLoading && (
                      <div style={{ textAlign:"center", padding:"16px 0", color:"#9A9490" }}>
                        <div style={{ fontSize:22, marginBottom:6, display:"inline-block", animation:"spin 1.2s linear infinite" }}>⚙</div>
                        <div style={{ fontSize:12 }}>Reading your session…</div>
                      </div>
                    )}
                    {!debriefLoading && debrief && (
                      <>
                        {debrief.summary && (
                          <div style={{ background:"#1E3A5F", borderRadius:8, padding:"10px 12px", marginBottom:12, color:"#fff", fontSize:13, lineHeight:1.6 }}>
                            {debrief.summary}
                          </div>
                        )}
                        {(debrief.items||[]).map((item, i) => (
                          <div key={i} style={{ background:"#fff", border:"1px solid #E2DDD8", borderRadius:8, padding:"12px", marginBottom:8 }}>
                            <div style={{ fontSize:12, color:"#555", marginBottom:6, lineHeight:1.5 }}>
                              <span style={{ fontWeight:800, color:"#1E3A5F" }}>Q: </span>{item.question}
                            </div>
                            <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                              <div style={{ flex:1, minWidth:120, background:"#FEF2F2", border:"1px solid #fca5a544", borderRadius:6, padding:"5px 8px" }}>
                                <div style={{ fontSize:9, color:"#dc2626", fontWeight:800, letterSpacing:1, marginBottom:2 }}>YOU ANSWERED</div>
                                <div style={{ fontSize:12, color:"#dc2626", fontWeight:700 }}>{item.selected}</div>
                              </div>
                              <div style={{ flex:1, minWidth:120, background:"#F0FDF4", border:"1px solid #86efac44", borderRadius:6, padding:"5px 8px" }}>
                                <div style={{ fontSize:9, color:"#16a34a", fontWeight:800, letterSpacing:1, marginBottom:2 }}>CORRECT</div>
                                <div style={{ fontSize:12, color:"#16a34a", fontWeight:700 }}>{item.correct}</div>
                              </div>
                            </div>
                            {item.explanation && (
                              <div style={{ fontSize:12, color:"#555", lineHeight:1.6, marginBottom:item.memory?6:0 }}>
                                {item.explanation}
                              </div>
                            )}
                            {item.memory && (
                              <div style={{ background:"#FFF7ED", border:"1px solid #fed7aa", borderRadius:6, padding:"6px 9px", fontSize:11, color:"#92400e", fontWeight:700 }}>
                                💡 {item.memory}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={S.btnRow}>
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
