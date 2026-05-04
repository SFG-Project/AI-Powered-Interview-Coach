const {
  average,
  getSortTimestamp,
  normalizeSessionScore,
  parseScore,
  parseMetricAsPercentage,
  toIso,
} = require("./progressService");

const MAX_RECENT_INTERVIEWS = 5;
const DEFAULT_WELCOME_MESSAGE =
  "You are improving. Keep practicing to increase confidence and communication.";
const FIRST_INTERVIEW_WELCOME_MESSAGE =
  "Start your first interview to begin tracking your progress.";

function clampConfidencePercentage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function toScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(10, Number(parsed.toFixed(1))));
}

function formatDashboardDate(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function buildEmptyDashboardResponse() {
  return {
    summary: {
      totalInterviews: 0,
      averageScore: 0,
      confidenceLevel: 0,
    },
    welcomeMessage: {
      title: "Welcome Back",
      message: FIRST_INTERVIEW_WELCOME_MESSAGE,
    },
    recentInterviews: [],
  };
}

async function getDashboardForUser(firestore, userId) {
  const snapshot = await firestore
    .collection("interviewSessions")
    .where("userId", "==", userId)
    .get();

  if (snapshot.empty) {
    return buildEmptyDashboardResponse();
  }

  const completedSessions = snapshot.docs
    .map((doc) => {
      const data = doc.data() || {};
      return {
        doc,
        sessionId: data.sessionId || doc.id,
        status: typeof data.status === "string" ? data.status : "active",
        careerField:
          typeof data.careerField === "string" && data.careerField.trim()
            ? data.careerField.trim()
            : "General",
        interviewType:
          typeof data.interviewType === "string" && data.interviewType.trim()
            ? data.interviewType.trim()
            : "Interview",
        averageScore: data.averageScore,
        completedAt: toIso(data.completedAt),
        updatedAt: toIso(data.updatedAt),
        createdAt: toIso(data.createdAt),
      };
    })
    .filter((session) => session.status === "completed");

  if (!completedSessions.length) {
    return buildEmptyDashboardResponse();
  }

  const confidenceValues = [];
  const sessionsWithScores = await Promise.all(
    completedSessions.map(async (session) => {
      const questionSnapshot = await session.doc.ref.collection("questions").get();
      const questionScores = [];

      questionSnapshot.forEach((questionDoc) => {
        const question = questionDoc.data() || {};
        const feedback =
          question.feedback && typeof question.feedback === "object" ? question.feedback : {};

        const parsedScore =
          feedback && typeof feedback.score !== "undefined"
            ? parseScore(feedback.score)
            : null;
        if (parsedScore !== null) {
          questionScores.push(parsedScore);
        }

        const confidence = parseMetricAsPercentage(feedback.confidence);
        if (confidence !== null) {
          confidenceValues.push(confidence);
        }
      });

      const sessionScore = normalizeSessionScore(session.averageScore, questionScores);

      return {
        sessionId: session.sessionId,
        score: toScore(sessionScore),
        careerField: session.careerField,
        interviewType: session.interviewType,
        completedAt: session.completedAt,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt,
      };
    })
  );

  const averageScore = toScore(
    average(sessionsWithScores.map((session) => session.score)) || 0
  );
  const derivedConfidence = clampConfidencePercentage(averageScore * 10);
  const confidenceLevel = clampConfidencePercentage(
    average(confidenceValues) ?? derivedConfidence
  );

  const recentInterviews = sessionsWithScores
    .slice()
    .sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a))
    .slice(0, MAX_RECENT_INTERVIEWS)
    .map((session) => {
      const dateValue = session.completedAt || session.updatedAt || session.createdAt;

      return {
        sessionId: session.sessionId,
        date: formatDashboardDate(dateValue),
        careerField: session.careerField,
        interviewType: session.interviewType,
        score: toScore(session.score),
        maxScore: 10,
        completedAt: session.completedAt || null,
      };
    });

  return {
    summary: {
      totalInterviews: completedSessions.length,
      averageScore,
      confidenceLevel,
    },
    welcomeMessage: {
      title: "Welcome Back",
      message: DEFAULT_WELCOME_MESSAGE,
    },
    recentInterviews,
  };
}

module.exports = {
  getDashboardForUser,
  buildEmptyDashboardResponse,
};
