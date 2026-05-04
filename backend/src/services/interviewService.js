const { randomUUID } = require("crypto");
const { admin } = require("../config/firebaseAdmin");

const DEFAULT_CAREER_FIELD = "Software Developer";
const DEFAULT_INTERVIEW_TYPE = "Technical";
const DEFAULT_DIFFICULTY = "Medium";
const FALLBACK_USER_ID = "anonymous";

const ALLOWED_CAREER_FIELDS = [
  "Software Developer",
  "Data Analyst",
  "Business Analyst",
  "Project Manager",
  "Cybersecurity Analyst",
  "Other",
];

const ALLOWED_INTERVIEW_TYPES = ["Technical", "Behavioural", "HR", "Mixed"];
const ALLOWED_DIFFICULTIES = ["Easy", "Medium", "Hard"];
const ALLOWED_QUESTION_COUNTS = [3, 5, 10];
const METRIC_STATUSES = [
  "Poor",
  "Improving",
  "Moderate",
  "Good",
  "Strong",
  "Excellent",
];

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

function normalizeMetricStatus(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const match = METRIC_STATUSES.find(
    (option) => option.toLowerCase() === value.trim().toLowerCase()
  );

  return match || fallback;
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 6.5;
  }
  return Math.max(0, Math.min(10, Number(score.toFixed(1))));
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
  return Boolean(process.env.XAI_API_KEY);
}

function getXaiConfig() {
  return {
    apiKey: process.env.XAI_API_KEY || "",
    baseUrl: (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(
      /\/$/,
      ""
    ),
    model: process.env.XAI_MODEL || "grok-4.3",
  };
}

async function callXaiChat(messages) {
  const { apiKey, baseUrl, model } = getXaiConfig();
  const endpoint = `${baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

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
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`xAI request failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    const messageContent = payload?.choices?.[0]?.message?.content;

    if (!messageContent) {
      throw new Error("xAI returned an empty response.");
    }

    const parsed = parseJsonObject(messageContent);
    if (!parsed) {
      throw new Error("xAI response was not valid JSON.");
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function getFallbackQuestionPool(careerField, interviewType) {
  const key = `${careerField}::${interviewType}`.toLowerCase();

  const pools = {
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

  return (
    pools[key] ||
    pools[`${careerField.toLowerCase()}::technical`] ||
    pools["software developer::technical"]
  );
}

function buildFallbackQuestions({
  careerField,
  interviewType,
  difficulty,
  questionCount,
}) {
  const pool = getFallbackQuestionPool(careerField, interviewType);

  return Array.from({ length: questionCount }, (_item, index) => {
    const poolQuestion = pool[index % pool.length];
    return {
      questionId: `q-${index + 1}`,
      number: index + 1,
      text: `[${difficulty}] ${poolQuestion}`,
      answer: "",
      skipped: false,
      feedback: null,
      answeredAt: null,
    };
  });
}

function defaultFeedback(skipped = false) {
  if (skipped) {
    return {
      score: 5.8,
      summary: "Question skipped. The session moved to the next question.",
      clarity: "Moderate",
      technicalAccuracy: "Moderate",
      confidence: "Improving",
      communication: "Moderate",
      quickTip: "Give a direct opening sentence before expanding the answer.",
      sessionNotes: "Try to attempt each question with at least one example.",
      strengths: ["You kept the session moving forward."],
      improvements: ["Attempt the question before skipping when possible."],
      suggestedAnswer:
        "A stronger answer should include a concise definition, explanation, and practical example.",
    };
  }

  return {
    score: 6.5,
    summary: "Your answer was recorded successfully.",
    clarity: "Good",
    technicalAccuracy: "Moderate",
    confidence: "Improving",
    communication: "Good",
    quickTip: "Use a clear structure and include a practical example.",
    sessionNotes:
      "Try to expand your explanation and link it to the role.",
    strengths: ["You attempted the question clearly."],
    improvements: ["Add more specific examples."],
    suggestedAnswer:
      "A stronger answer should include a definition, explanation, and example.",
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
          "Create concise interview questions tailored to the setup. Return JSON with key 'questions' containing an array of strings.",
        setup: {
          careerField: options.careerField,
          interviewType: options.interviewType,
          difficulty: options.difficulty,
          questionCount: options.questionCount,
        },
      }),
    },
  ]);

  if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
    throw new Error("xAI did not return a valid questions array.");
  }

  const cleaned = parsed.questions
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, options.questionCount);

  if (cleaned.length === 0) {
    throw new Error("xAI questions were empty.");
  }

  while (cleaned.length < options.questionCount) {
    cleaned.push(
      `Describe a practical ${options.interviewType.toLowerCase()} scenario relevant to ${options.careerField}.`
    );
  }

  return cleaned.map((text, index) => ({
    questionId: `q-${index + 1}`,
    number: index + 1,
    text,
    answer: "",
    skipped: false,
    feedback: null,
    answeredAt: null,
  }));
}

async function generateQuestions(options) {
  if (!hasXaiConfig()) {
    return buildFallbackQuestions(options);
  }

  try {
    return await generateQuestionsFromAi(options);
  } catch (error) {
    console.warn(
      `[interview] xAI question generation failed. Using fallback questions. ${error.message}`
    );
    return buildFallbackQuestions(options);
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
          "Return JSON with fields: score, summary, clarity, technicalAccuracy, confidence, communication, quickTip, sessionNotes, strengths, improvements, suggestedAnswer.",
        sessionContext: {
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
  });

  for (const question of session.questions) {
    const questionRef = sessionRef
      .collection("questions")
      .doc(question.questionId);

    batch.set(questionRef, {
      questionId: question.questionId,
      number: question.number,
      text: question.text,
      answer: "",
      skipped: false,
      feedback: null,
      answeredAt: null,
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
      answer: question.answer || "",
      skipped: Boolean(question.skipped),
      feedback: question.feedback || null,
      answeredAt: toIso(question.answeredAt),
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
        answer: question.answer,
        skipped: question.skipped,
        feedback: question.feedback,
        answeredAt: question.answeredAt
          ? admin.firestore.Timestamp.fromDate(new Date(question.answeredAt))
          : null,
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
  const answeredCount = session.questions.filter(
    (question) => question.answer || question.skipped
  ).length;

  return `Interview session completed with ${answeredCount} of ${session.questionCount} questions handled.`;
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
