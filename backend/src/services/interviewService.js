const { randomUUID } = require("crypto");
const { admin } = require("../config/firebaseAdmin");

const DEFAULT_CAREER_FIELD = "Software Developer";
const DEFAULT_INTERVIEW_TYPE = "Technical";
const DEFAULT_DIFFICULTY = "Medium";
const FALLBACK_USER_ID = "anonymous";
require("dotenv").config();

const ALLOWED_CAREER_FIELDS = [
    "Software Development",
    "Finance",
    "Healthcare",
    "Education",
    "Marketing",
    "Engineering",
    "Human Resources",
    "Sales",
    "Customer Support",
    "Other",
];

const ALLOWED_INTERVIEW_TYPES = ["Technical", "Behavioural", "HR", "Mixed"];
const ALLOWED_DIFFICULTIES = ["Easy", "Medium", "Hard"];
const ALLOWED_QUESTION_COUNTS = [3, 5, 10];
const METRIC_STATUSES = [
  "Not Rated",
  "Poor",
  "Improving",
  "Moderate",
  "Good",
  "Strong",
  "Excellent",
];
const QUESTION_SOURCE_VALUES = ["grok", "fallback", "firestore", "unknown"];
const QUESTION_SOURCE_SET = new Set(QUESTION_SOURCE_VALUES);
const FALLBACK_SPECIFIC_POOLS = {
  "software developer::technical": [
    "Explain polymorphism in object-oriented programming and share one practical example.",
    "What are key differences between REST and GraphQL, and when would you choose each?",
    "How would you diagnose and optimize a slow database query in production?",
    "Describe JavaScript closures and a real use case where they are useful.",
    "How would you design error handling for a distributed microservice API?",
    "What tradeoffs exist between SQL and NoSQL for user activity tracking?",
    "Explain CI/CD and how it reduces release risk.",
    "How do you approach debugging an intermittent frontend bug reported by users?",
    "What is the purpose of indexing, and what are indexing pitfalls?",
    "How would you secure authentication tokens in a SPA?",
  ],
  "software developer::behavioural": [
    "Describe a time you had to resolve a technical disagreement with a teammate.",
    "Tell me about a project that did not go as planned and what you learned.",
    "How do you prioritize tasks when multiple deadlines collide?",
    "Give an example of mentoring or helping another developer improve.",
    "Describe a time you received difficult feedback and how you responded.",
  ],
  "software developer::hr": [
    "Why are you interested in this software developer role?",
    "How does this role fit into your career goals?",
    "Describe your preferred team culture and work environment.",
    "How do you handle feedback from managers and peers?",
    "What motivates you to keep improving your technical skills?",
  ],
  "data analyst::technical": [
    "How do you validate data quality before producing a business report?",
    "Explain the difference between correlation and causation with an example.",
    "How would you design a dashboard for executive stakeholders?",
    "What SQL techniques do you use for large dataset performance?",
    "How do you communicate uncertainty in analytical findings?",
  ],
  "business analyst::mixed": [
    "How do you gather and prioritize stakeholder requirements?",
    "Describe a time you resolved conflicting requirements.",
    "How do you measure success after a process change implementation?",
    "How do you translate technical constraints to non-technical stakeholders?",
    "What artifacts do you produce for a requirements workshop?",
  ],
  "project manager::mixed": [
    "How do you manage scope creep while keeping stakeholders aligned?",
    "Describe your approach to risk management during delivery.",
    "How do you recover a project that is behind schedule?",
    "How do you handle team conflict affecting milestones?",
    "What project metrics do you report weekly and why?",
  ],
  "cybersecurity analyst::technical": [
    "How would you respond to a suspected phishing incident?",
    "Explain defense in depth and practical controls at each layer.",
    "What is your process for vulnerability triage and remediation?",
    "How do you balance security controls with user productivity?",
    "Describe a recent security threat trend and mitigation approach.",
  ],
};
const FALLBACK_GENERAL_POOLS_BY_TYPE = {
  technical: [
    "Explain a complex technical concept in simple terms.",
    "How do you approach debugging a high-priority production issue?",
    "What steps do you follow before deploying a major change?",
    "How do you evaluate tradeoffs between performance and maintainability?",
    "Describe a technical decision you made and why it worked.",
    "How do you ensure quality when requirements are unclear?",
    "What tools do you use to monitor system or data reliability?",
    "How do you break down a large technical task into milestones?",
    "Describe your approach to writing secure code or queries.",
    "How do you validate that your solution solved the root problem?",
  ],
  behavioural: [
    "Tell me about a time you handled a difficult stakeholder conversation.",
    "Describe a situation where you had to adapt quickly to change.",
    "How do you prioritize when everything feels urgent?",
    "Share an example of collaborating across teams.",
    "Tell me about a mistake you made and what you changed afterward.",
    "Describe a time you disagreed with a teammate and how you resolved it.",
    "How do you stay motivated during long or challenging projects?",
    "Tell me about a time you had to communicate bad news.",
    "Describe how you prepare for high-pressure discussions.",
    "How do you balance speed and quality in your work?",
  ],
  hr: [
    "Why do you want to join this company?",
    "What strengths will you bring to this role?",
    "What is one area you are actively improving?",
    "How do you define success in your first 90 days?",
    "Why are you considering a new opportunity now?",
    "What type of manager helps you perform your best?",
    "How do you handle competing expectations from different leaders?",
    "How do your values align with this position?",
    "What kind of projects energize you most?",
    "How do you handle feedback you initially disagree with?",
  ],
  mixed: [
    "Walk me through a recent project you are proud of.",
    "How do you gather requirements before solving a problem?",
    "Describe how you communicate technical updates to non-technical stakeholders.",
    "How do you manage risk while still delivering on time?",
    "Give an example of a decision you made with incomplete information.",
    "How do you prepare for interviews and evaluate your own performance?",
    "What does a strong answer look like when discussing your past work?",
    "Describe a challenge that improved your problem-solving approach.",
    "How do you collaborate when priorities change mid-project?",
    "How do you decide what to optimize first: quality, speed, or scope?",
  ],
};

const memorySessions = new Map();

function nowIsoString() {
  return new Date().toISOString();
}

function normalizeChoice(value, allowed, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const match = allowed.find(
    (option) => option.toLowerCase() === value.trim().toLowerCase()
  );

  return match || fallback;
}

function parseQuestionCount(value) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && ALLOWED_QUESTION_COUNTS.includes(parsed)) {
    return parsed;
  }
  return null;
}

function normalizeMetricStatus(value, fallback = "Moderate") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  // Exact matches
  const exactMatch = METRIC_STATUSES.find(
    (option) => option.toLowerCase() === normalized
  );

  if (exactMatch) {
    return exactMatch;
  }

  // AI wording mapping
  if (
    normalized.includes("excellent") ||
    normalized.includes("outstanding")
  ) {
    return "Excellent";
  }

  if (
    normalized.includes("strong") ||
    normalized.includes("very good")
  ) {
    return "Strong";
  }

  if (
    normalized.includes("good") ||
    normalized.includes("clear")
  ) {
    return "Good";
  }

  if (
    normalized.includes("average") ||
    normalized.includes("fair") ||
    normalized.includes("moderate")
  ) {
    return "Moderate";
  }

  if (
    normalized.includes("improve") ||
    normalized.includes("developing")
  ) {
    return "Improving";
  }

  if (
    normalized.includes("weak") ||
    normalized.includes("poor")
  ) {
    return "Poor";
  }

  return fallback;
}
function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 6.5;
  }
  return Math.max(0, Math.min(10, Number(score.toFixed(1))));
}

function parseScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return null;
  }

  return Math.max(0, Math.min(10, Number(score.toFixed(1))));
}

function calculateSessionSummary(session) {
  const totalQuestions = Number(session?.questionCount || session?.questions?.length || 0);
  const answeredQuestions = session.questions.filter(
    (question) => !question.skipped && typeof question.answer === "string" && question.answer.trim()
  ).length;
  const skippedQuestions = session.questions.filter((question) => question.skipped).length;
  const scoredQuestions = session.questions
    .map((question) => parseScore(question?.feedback?.score))
    .filter((score) => score !== null);

  const averageScore = scoredQuestions.length
    ? Number(
        (scoredQuestions.reduce((sum, score) => sum + score, 0) / scoredQuestions.length).toFixed(
          1
        )
      )
    : 0;

  return {
    averageScore,
    answeredQuestions,
    skippedQuestions,
    totalQuestions,
  };
}

function getUserId(value) {
  if (typeof value !== "string" || !value.trim()) {
    return FALLBACK_USER_ID;
  }
  return value.trim();
}

function toIso(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return null;
}

function parseJsonObject(rawContent) {
  if (typeof rawContent !== "string") {
    return null;
  }

  const trimmed = rawContent.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    // fall through
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch (_error) {
      // fall through
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch (_error) {
      return null;
    }
  }

  return null;
}

function hasXaiConfig() {
  return Boolean(process.env.GROQ_API_KEY);
}

function getXaiConfig() {
  return {
    apiKey: process.env.GROQ_API_KEY || "",
    baseUrl: (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(
      /\/$/,
      ""
    ),
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
  };
}
async function callXaiChat(messages) {
  const { apiKey, baseUrl, model } = getXaiConfig();

  const endpoint = `${baseUrl}/chat/completions`;

  console.log("========== GROQ DEBUG ==========");
  console.log("API KEY EXISTS:", Boolean(apiKey));
  console.log("ENDPOINT:", endpoint);
  console.log("MODEL:", model);
  console.log("================================");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();

    console.log("========== GROQ RESPONSE ==========");
    console.log(rawText);
    console.log("===================================");

    if (!response.ok) {
      throw new Error(
        `Groq request failed (${response.status}): ${rawText}`
      );
    }

    const payload = JSON.parse(rawText);

    const messageContent =
      payload?.choices?.[0]?.message?.content;

    if (!messageContent) {
      throw new Error("Groq returned empty content.");
    }

    let parsed;

    try {
      parsed = JSON.parse(messageContent);
    } catch (err) {
      console.error("FAILED TO PARSE AI JSON:");
      console.error(messageContent);

      throw new Error("Groq returned invalid JSON.");
    }

    return parsed;

  } catch (error) {
    console.error("GROQ ERROR:", error.message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function normalizeQuestionSource(value, fallback = "unknown") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!QUESTION_SOURCE_SET.has(normalized)) {
    return fallback;
  }

  return normalized;
}

function normalizeInterviewTypeKey(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "behavioral") {
    return "behavioural";
  }

  return normalized;
}

function collectUniqueQuestionTexts(values) {
  const deduped = [];
  const seen = new Set();

  values.forEach((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) {
      return;
    }

    const key = text.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    deduped.push(text);
  });

  return deduped;
}

function toQuestionRecord({ number, text, source }) {
  return {
    questionId: `q-${number}`,
    number,
    text,
    source: normalizeQuestionSource(source, "unknown"),
    answer: "",
    skipped: false,
    feedback: null,
    answeredAt: null,
    createdAt: nowIsoString(),
  };
}

function logQuestionGenerationStart(options) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  console.info(
    `[interview/questions] start careerField=${options.careerField} type=${options.interviewType} difficulty=${options.difficulty} questionCount=${options.questionCount}`
  );
}

function logQuestionSelection(options, question) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  console.info(
    `[interview/questions] source=${question.source} careerField=${options.careerField} type=${options.interviewType} difficulty=${options.difficulty} number=${question.number}`
  );
}

function logFallbackReason(reason) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  if (reason === "XAI_API_KEY missing") {
    console.info("[interview/questions] XAI_API_KEY missing. Using fallback interview questions.");
  }

  console.info(`[interview/questions] source=fallback reason=${reason}`);
}

function getFallbackQuestionCandidates(careerField, interviewType) {
  const careerKey = typeof careerField === "string" ? careerField.trim().toLowerCase() : "";
  const interviewTypeKey = normalizeInterviewTypeKey(interviewType);
  const specificKey = `${careerKey}::${interviewTypeKey}`;
  const careerTechnicalKey = `${careerKey}::technical`;

  const candidates = [
    ...(FALLBACK_SPECIFIC_POOLS[specificKey] || []),
    ...(FALLBACK_GENERAL_POOLS_BY_TYPE[interviewTypeKey] || []),
    ...(FALLBACK_SPECIFIC_POOLS[careerTechnicalKey] || []),
    ...(FALLBACK_GENERAL_POOLS_BY_TYPE.mixed || []),
    ...(FALLBACK_GENERAL_POOLS_BY_TYPE.technical || []),
  ];

  return collectUniqueQuestionTexts(candidates);
}

function buildFallbackQuestions({
  careerField,
  interviewType,
  difficulty,
  questionCount,
}) {
  const baseQuestions = getFallbackQuestionCandidates(careerField, interviewType);
  const selected = baseQuestions.slice(0, questionCount);

  while (selected.length < questionCount) {
    const index = selected.length + 1;
    selected.push(
      `Describe a practical ${interviewType.toLowerCase()} scenario relevant to ${careerField}. Focus point ${index}.`
    );
  }

  return selected.map((text, index) =>
    toQuestionRecord({
      number: index + 1,
      text: `[${difficulty}] ${text}`,
      source: "fallback",
    })
  );
}

function defaultFeedback(skipped = false) {
  if (skipped) {
    return {
      score: 0,
      summary: "Question skipped. No score was given.",
      clarity: "Not Rated",
      technicalAccuracy: "Not Rated",
      confidence: "Not Rated",
      communication: "Not Rated",
      quickTip: "Try to answer before skipping so your performance can be evaluated.",
      sessionNotes: "Skipped questions are not rated.",
      strengths: [],
      improvements: ["Attempt the question before skipping."],
      suggestedAnswer: "",
    };
  }

  return {
    score: 0,
    summary: "Your answer was saved, but AI feedback could not be generated.",
    clarity: "Not Rated",
    technicalAccuracy: "Not Rated",
    confidence: "Not Rated",
    communication: "Not Rated",
    quickTip: "Please check the AI API connection.",
    sessionNotes: "Fallback feedback was used because the AI evaluation failed.",
    strengths: [],
    improvements: [],
    suggestedAnswer: "",
  };
}
function normalizeFeedback(payload, skipped = false) {
  const fallback = defaultFeedback(skipped);

  return {
    score: clampScore(payload?.score ?? fallback.score),
    summary:
      typeof payload?.summary === "string" && payload.summary.trim()
        ? payload.summary.trim()
        : fallback.summary,
    clarity: normalizeMetricStatus(payload?.clarity, fallback.clarity),
    technicalAccuracy: normalizeMetricStatus(
      payload?.technicalAccuracy,
      fallback.technicalAccuracy
    ),
    confidence: normalizeMetricStatus(payload?.confidence, fallback.confidence),
    communication: normalizeMetricStatus(
      payload?.communication,
      fallback.communication
    ),
    quickTip:
      typeof payload?.quickTip === "string" && payload.quickTip.trim()
        ? payload.quickTip.trim()
        : fallback.quickTip,
    sessionNotes:
      typeof payload?.sessionNotes === "string" && payload.sessionNotes.trim()
        ? payload.sessionNotes.trim()
        : fallback.sessionNotes,
    strengths: Array.isArray(payload?.strengths)
      ? payload.strengths.map((item) => String(item)).slice(0, 5)
      : fallback.strengths,
    improvements: Array.isArray(payload?.improvements)
      ? payload.improvements.map((item) => String(item)).slice(0, 5)
      : fallback.improvements,
    suggestedAnswer:
      typeof payload?.suggestedAnswer === "string" &&
      payload.suggestedAnswer.trim()
        ? payload.suggestedAnswer.trim()
        : fallback.suggestedAnswer,
  };
}

async function generateQuestionsFromAi(options) {
  const previousQuestions = Array.isArray(options.previousQuestions)
    ? collectUniqueQuestionTexts(options.previousQuestions)
    : [];

  const parsed = await callXaiChat([
    {
      role: "system",
      content:
        "You are an interview coach. Return strict JSON only and no markdown.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "generate_interview_questions",
        instructions:
          "Create concise interview questions tailored to the setup. Return JSON with key 'questions' containing an array of strings. Do not repeat any previous questions or duplicate items in the returned list.",
        setup: {
          careerField: options.careerField,
          interviewType: options.interviewType,
          difficulty: options.difficulty,
          questionCount: options.questionCount,
        },
        previousQuestions,
      }),
    },
  ]);

  if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
    throw new Error("xAI did not return a valid questions array.");
  }

  const cleaned = collectUniqueQuestionTexts(
    parsed.questions.map((item) => String(item))
  )
    .filter((item) => !previousQuestions.some((previous) => previous.toLowerCase() === item.toLowerCase()))
    .slice(0, options.questionCount);

  if (cleaned.length === 0) {
    throw new Error("xAI questions were empty.");
  }

  const fallbackCandidates = buildFallbackQuestions(options).map((question) => question.text);
  const combined = collectUniqueQuestionTexts([...cleaned, ...fallbackCandidates])
    .slice(0, options.questionCount);

  while (combined.length < options.questionCount) {
    const questionIndex = combined.length + 1;
    combined.push(
      `Describe a practical ${options.interviewType.toLowerCase()} scenario relevant to ${options.careerField}. Focus point ${questionIndex}.`
    );
  }

  return combined.map((text, index) =>
    toQuestionRecord({
      number: index + 1,
      text,
      source: "grok",
    })
  );
}

async function generateQuestions(options) {
  logQuestionGenerationStart(options);

  if (!hasXaiConfig()) {
    logFallbackReason("XAI_API_KEY missing");
    const fallbackQuestions = buildFallbackQuestions(options);
    fallbackQuestions.forEach((question) => logQuestionSelection(options, question));
    return fallbackQuestions;
  }

  try {
    const aiQuestions = await generateQuestionsFromAi(options);
    aiQuestions.forEach((question) => logQuestionSelection(options, question));
    return aiQuestions;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "xAI generation failed";
    logFallbackReason(reason);
    console.warn(
      `[interview] xAI question generation failed. Using fallback questions. ${reason}`
    );
    const fallbackQuestions = buildFallbackQuestions(options);
    fallbackQuestions.forEach((question) => logQuestionSelection(options, question));
    return fallbackQuestions;
  }
}

async function evaluateAnswerWithAi({ session, question, answer, skipped }) {
  if (skipped) {
    return defaultFeedback(true);
  }

  const parsed = await callXaiChat([
    {
      role: "system",
      content:
        "You are an interview evaluator. Return strict JSON only and no markdown.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "evaluate_interview_answer",
       instructions:
  `
Return STRICT JSON only.

You are an experienced technical interview evaluator.

Evaluate the candidate answer carefully based on:
- relevance to the question
- technical correctness
- depth of explanation
- communication quality
- confidence and clarity
- structure of the answer
- use of examples
- problem-solving ability

IMPORTANT:
Do NOT give the same rating for all metrics unless the answer truly deserves it.

Each metric must be evaluated independently:
- clarity
- technicalAccuracy
- confidence
- communication

Use realistic variation between metrics.

For example:
- Someone may communicate well but be technically weak.
- Someone may be technically strong but unclear.
- Someone may sound confident but give inaccurate answers.

SCORING RULES:
- score must be between 0 and 10
- use decimals when appropriate (example: 6.5)
- avoid always using high scores
- short or vague answers should score lower
- incorrect technical answers must reduce technicalAccuracy heavily
- skipped or empty answers should score near 0

For clarity, technicalAccuracy, confidence, and communication,
you MUST ONLY use ONE of these exact values:

Poor
Improving
Moderate
Good
Strong
Excellent

Return JSON with these exact fields:

{
  "score": number,
  "summary": string,
  "clarity": string,
  "technicalAccuracy": string,
  "confidence": string,
  "communication": string,
  "quickTip": string,
  "sessionNotes": string,
  "strengths": string[],
  "improvements": string[],
  "suggestedAnswer": string
}

strengths:
- include 1 to 3 concise strengths
- do not repeat the same idea

improvements:
- include 1 to 3 specific improvements
- be constructive and actionable

quickTip:
- must be short and practical

suggestedAnswer:
- provide a stronger example answer
- keep it concise but realistic

Do not include markdown.
Do not include explanations outside JSON.
Do not wrap JSON in triple backticks.
`,        sessionContext: {
          careerField: session.careerField,
          interviewType: session.interviewType,
          difficulty: session.difficulty,
          questionNumber: question.number,
          questionTotal: session.questionCount,
        },
        question: question.text,
        answer,
      }),
    },
  ]);

  return normalizeFeedback(parsed, false);
}

async function evaluateAnswer(payload) {
  if (!hasXaiConfig()) {
    return defaultFeedback(Boolean(payload.skipped));
  }

  try {
    return await evaluateAnswerWithAi(payload);
  } catch (error) {
    console.warn(
      `[interview] xAI answer evaluation failed. Using fallback feedback. ${error.message}`
    );
    return defaultFeedback(Boolean(payload.skipped));
  }
}

function isFirestoreReady() {
  return admin.apps.length > 0;
}

function getFirestore() {
  return admin.firestore();
}

function serializeSession(session) {
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    careerField: session.careerField,
    interviewType: session.interviewType,
    difficulty: session.difficulty,
    questionCount: session.questionCount,
    status: session.status,
    currentQuestionIndex: session.currentQuestionIndex,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    averageScore: Number(session.averageScore || 0),
    answeredQuestions: Number(session.answeredQuestions || 0),
    skippedQuestions: Number(session.skippedQuestions || 0),
    totalQuestions: Number(session.totalQuestions || session.questionCount || 0),
    questions: session.questions.map((question) => ({ ...question })),
  };
}

async function createSessionStore(session) {
  if (!isFirestoreReady()) {
    memorySessions.set(session.sessionId, serializeSession(session));
    return;
  }

  const db = getFirestore();
  const sessionRef = db.collection("interviewSessions").doc(session.sessionId);
  const batch = db.batch();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  batch.set(sessionRef, {
    sessionId: session.sessionId,
    userId: session.userId,
    careerField: session.careerField,
    interviewType: session.interviewType,
    difficulty: session.difficulty,
    questionCount: session.questionCount,
    status: session.status,
    currentQuestionIndex: session.currentQuestionIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    averageScore: 0,
    answeredQuestions: 0,
    skippedQuestions: 0,
    totalQuestions: session.questionCount,
  });

  for (const question of session.questions) {
    const questionRef = sessionRef
      .collection("questions")
      .doc(question.questionId);

    batch.set(questionRef, {
      questionId: question.questionId,
      number: question.number,
      text: question.text,
      source: normalizeQuestionSource(question.source, "unknown"),
      answer: "",
      skipped: false,
      feedback: null,
      answeredAt: null,
      createdAt: timestamp,
    });
  }

  await batch.commit();
}

async function readFirestoreSession(sessionId) {
  const db = getFirestore();
  const sessionRef = db.collection("interviewSessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    return null;
  }

  const sessionData = sessionSnap.data() || {};
  const questionSnap = await sessionRef.collection("questions").get();
  const questions = questionSnap.docs
    .map((doc) => doc.data())
    .sort((a, b) => Number(a.number) - Number(b.number))
    .map((question) => ({
      questionId: question.questionId,
      number: Number(question.number),
      text: question.text || "",
      source: normalizeQuestionSource(question.source, "firestore"),
      answer: question.answer || "",
      skipped: Boolean(question.skipped),
      feedback: question.feedback || null,
      answeredAt: toIso(question.answeredAt),
      createdAt: toIso(question.createdAt),
    }));

  return {
    sessionId: sessionData.sessionId || sessionId,
    userId: sessionData.userId || FALLBACK_USER_ID,
    careerField: sessionData.careerField || DEFAULT_CAREER_FIELD,
    interviewType: sessionData.interviewType || DEFAULT_INTERVIEW_TYPE,
    difficulty: sessionData.difficulty || DEFAULT_DIFFICULTY,
    questionCount: Number(sessionData.questionCount || questions.length || 0),
    status: sessionData.status || "active",
    currentQuestionIndex: Number(sessionData.currentQuestionIndex || 0),
    createdAt: toIso(sessionData.createdAt),
    updatedAt: toIso(sessionData.updatedAt),
    completedAt: toIso(sessionData.completedAt),
    averageScore: Number(sessionData.averageScore || 0),
    answeredQuestions: Number(sessionData.answeredQuestions || 0),
    skippedQuestions: Number(sessionData.skippedQuestions || 0),
    totalQuestions: Number(sessionData.totalQuestions || sessionData.questionCount || 0),
    questions,
  };
}

async function getSessionById(sessionId) {
  if (!sessionId) {
    return null;
  }

  if (!isFirestoreReady()) {
    const session = memorySessions.get(sessionId);
    return session ? serializeSession(session) : null;
  }

  return readFirestoreSession(sessionId);
}

async function saveSessionState(session) {
  session.updatedAt = nowIsoString();
  const sessionSummary = calculateSessionSummary(session);
  session.averageScore = sessionSummary.averageScore;
  session.answeredQuestions = sessionSummary.answeredQuestions;
  session.skippedQuestions = sessionSummary.skippedQuestions;
  session.totalQuestions = sessionSummary.totalQuestions;

  if (!isFirestoreReady()) {
    memorySessions.set(session.sessionId, serializeSession(session));
    return;
  }

  const db = getFirestore();
  const sessionRef = db.collection("interviewSessions").doc(session.sessionId);
  const batch = db.batch();

  batch.set(
    sessionRef,
    {
      userId: session.userId,
      careerField: session.careerField,
      interviewType: session.interviewType,
      difficulty: session.difficulty,
      questionCount: session.questionCount,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      averageScore: session.averageScore,
      answeredQuestions: session.answeredQuestions,
      skippedQuestions: session.skippedQuestions,
      totalQuestions: session.totalQuestions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: session.completedAt
        ? admin.firestore.Timestamp.fromDate(new Date(session.completedAt))
        : null,
    },
    { merge: true }
  );

  for (const question of session.questions) {
    const questionRef = sessionRef
      .collection("questions")
      .doc(question.questionId);

    batch.set(
      questionRef,
      {
        questionId: question.questionId,
        number: question.number,
        text: question.text,
        source: normalizeQuestionSource(question.source, "unknown"),
        answer: question.answer,
        skipped: question.skipped,
        feedback: question.feedback,
        answeredAt: question.answeredAt
          ? admin.firestore.Timestamp.fromDate(new Date(question.answeredAt))
          : null,
        createdAt: question.createdAt
          ? admin.firestore.Timestamp.fromDate(new Date(question.createdAt))
          : admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

function toPublicQuestion(question, total) {
  return {
    id: question.questionId,
    text: question.text,
    number: question.number,
    total,
    source: normalizeQuestionSource(question.source, "unknown"),
  };
}

function getNextQuestion(session) {
  const current = session.questions[session.currentQuestionIndex];
  if (!current) {
    return null;
  }
  return toPublicQuestion(current, session.questionCount);
}

function ensureActiveSession(sessionId, session) {
  if (!session) {
    const error = new Error("Interview session not found.");
    error.statusCode = 404;
    throw error;
  }

  if (session.status !== "active") {
    const error = new Error(
      "Interview session is no longer active. Start a new session."
    );
    error.statusCode = 400;
    throw error;
  }

  if (!session.questions.length) {
    const error = new Error("Interview session has no questions.");
    error.statusCode = 500;
    throw error;
  }

  if (!session.sessionId) {
    const error = new Error(`Invalid interview session ${sessionId}.`);
    error.statusCode = 500;
    throw error;
  }
}

function createEndSummary(session) {
  const summary = calculateSessionSummary(session);

  return `Interview session completed with ${summary.answeredQuestions} answered and ${summary.skippedQuestions} skipped out of ${summary.totalQuestions} questions.`;
}

async function startInterviewSession(payload, userIdInput) {
  const careerField = normalizeChoice(
    payload?.careerField,
    ALLOWED_CAREER_FIELDS,
    DEFAULT_CAREER_FIELD
  );
  const interviewType = normalizeChoice(
    payload?.interviewType,
    ALLOWED_INTERVIEW_TYPES,
    DEFAULT_INTERVIEW_TYPE
  );
  const difficulty = normalizeChoice(
    payload?.difficulty,
    ALLOWED_DIFFICULTIES,
    DEFAULT_DIFFICULTY
  );
  const questionCount = parseQuestionCount(payload?.questionCount);
  if (questionCount === null) {
    const error = new Error("questionCount is required and must be one of: 3, 5, 10.");
    error.statusCode = 400;
    throw error;
  }
  const userId = getUserId(userIdInput);

  const questions = await generateQuestions({
    careerField,
    interviewType,
    difficulty,
    questionCount,
  });

  const sessionId = randomUUID();
  const now = nowIsoString();
  const session = {
    sessionId,
    userId,
    careerField,
    interviewType,
    difficulty,
    questionCount,
    status: "active",
    currentQuestionIndex: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    averageScore: 0,
    answeredQuestions: 0,
    skippedQuestions: 0,
    totalQuestions: questionCount,
    questions,
  };

  await createSessionStore(session);

  return {
    sessionId,
    question: toPublicQuestion(questions[0], questionCount),
  };
}

async function submitInterviewAnswer(sessionId, payload) {
  const session = await getSessionById(sessionId);
  ensureActiveSession(sessionId, session);

  const questionId = String(payload?.questionId || "").trim();
  const answer = String(payload?.answer || "").trim();
  const skipped = Boolean(payload?.skipped);
  const currentQuestion = session.questions[session.currentQuestionIndex];

  if (!currentQuestion) {
    const error = new Error("No remaining question in this session.");
    error.statusCode = 400;
    throw error;
  }

  if (questionId && questionId !== currentQuestion.questionId) {
    const error = new Error(
      "Submitted question does not match the current active question."
    );
    error.statusCode = 400;
    throw error;
  }

  if (!skipped && !answer) {
    const error = new Error("Answer text is required.");
    error.statusCode = 400;
    throw error;
  }

  const feedback = await evaluateAnswer({
    session,
    question: currentQuestion,
    answer,
    skipped,
  });

  currentQuestion.answer = skipped ? "" : answer;
  currentQuestion.skipped = skipped;
  currentQuestion.feedback = feedback;
  currentQuestion.answeredAt = nowIsoString();

  session.currentQuestionIndex += 1;

  let isComplete = false;
  let nextQuestion = null;

  if (session.currentQuestionIndex >= session.questionCount) {
    session.status = "completed";
    session.completedAt = nowIsoString();
    isComplete = true;
  } else {
    nextQuestion = toPublicQuestion(
      session.questions[session.currentQuestionIndex],
      session.questionCount
    );
  }

  await saveSessionState(session);

  return {
    feedback,
    nextQuestion,
    isComplete,
  };
}

async function skipInterviewQuestion(sessionId, payload) {
  return submitInterviewAnswer(sessionId, {
    questionId: payload?.questionId,
    answer: "",
    skipped: true,
  });
}

async function endInterviewSession(sessionId) {
  const session = await getSessionById(sessionId);

  if (!session) {
    const error = new Error("Interview session not found.");
    error.statusCode = 404;
    throw error;
  }

  if (session.status !== "completed") {
    session.status = "completed";
    session.completedAt = nowIsoString();
    await saveSessionState(session);
  }

  return {
    sessionId: session.sessionId,
    status: session.status,
    summary: createEndSummary(session),
  };
}

async function getInterviewSession(sessionId) {
  const session = await getSessionById(sessionId);

  if (!session) {
    const error = new Error("Interview session not found.");
    error.statusCode = 404;
    throw error;
  }

  const currentQuestion =
    session.status === "active" ? getNextQuestion(session) : null;

  const latestFeedback =
    session.questions
      .slice()
      .reverse()
      .find((question) => question.feedback)?.feedback || null;

  return {
    sessionId: session.sessionId,
    userId: session.userId,
    careerField: session.careerField,
    interviewType: session.interviewType,
    difficulty: session.difficulty,
    questionCount: session.questionCount,
    status: session.status,
    currentQuestionIndex: session.currentQuestionIndex,
    currentQuestion,
    isComplete: session.status === "completed",
    latestFeedback,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
  };
}

async function getInterviewHistoryForUser(userIdInput) {
  const userId = getUserId(userIdInput);

  if (!isFirestoreReady()) {
    return Array.from(memorySessions.values())
      .filter((session) => session.userId === userId)
      .map((session) => {
        const latestFeedback =
          session.questions
            .slice()
            .reverse()
            .find((question) => question.feedback)?.feedback || null;
        return {
          sessionId: session.sessionId,
          careerField: session.careerField,
          interviewType: session.interviewType,
          difficulty: session.difficulty,
          questionCount: session.questionCount,
          status: session.status,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          latestScore: latestFeedback?.score ?? null,
        };
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  const db = getFirestore();
  const snapshot = await db
    .collection("interviewSessions")
    .where("userId", "==", userId)
    .get();

  const sessions = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const sessionData = doc.data() || {};
      let latestScore = null;
      const questionSnap = await doc.ref.collection("questions").get().catch(() => null);

      if (questionSnap && !questionSnap.empty) {
        const latestQuestionWithFeedback = questionSnap.docs
          .map((questionDoc) => questionDoc.data())
          .filter((question) => question && question.feedback)
          .sort((a, b) => Number(b.number || 0) - Number(a.number || 0))[0];

        if (
          latestQuestionWithFeedback &&
          typeof latestQuestionWithFeedback.feedback?.score !== "undefined"
        ) {
          latestScore = clampScore(latestQuestionWithFeedback.feedback.score);
        }
      }

      return {
        sessionId: sessionData.sessionId || doc.id,
        careerField: sessionData.careerField || DEFAULT_CAREER_FIELD,
        interviewType: sessionData.interviewType || DEFAULT_INTERVIEW_TYPE,
        difficulty: sessionData.difficulty || DEFAULT_DIFFICULTY,
        questionCount: Number(sessionData.questionCount || 0),
        status: sessionData.status || "active",
        createdAt: toIso(sessionData.createdAt),
        completedAt: toIso(sessionData.completedAt),
        latestScore,
      };
    })
  );

  return sessions.sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
}

function getRuntimeMode() {
  return {
    firestore: isFirestoreReady() ? "enabled" : "fallback-memory",
    xai: hasXaiConfig() ? "configured" : "fallback-local",
  };
}

function isDevelopmentEnvironment() {
  return process.env.NODE_ENV !== "production";
}

module.exports = {
  startInterviewSession,
  submitInterviewAnswer,
  skipInterviewQuestion,
  endInterviewSession,
  getInterviewSession,
  getInterviewHistoryForUser,
  getRuntimeMode,
  getUserId,
};
