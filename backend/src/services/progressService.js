const METRIC_LABEL_TO_PERCENTAGE = {
  strong: 90,
  good: 80,
  moderate: 65,
  improving: 55,
  weak: 40,
  poor: 35,
  excellent: 95,
};

const SKILL_NAMES = [
  "Technical Accuracy",
  "Communication",
  "Confidence",
  "Problem Solving",
];

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

function parseScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(0, Math.min(10, Number(numeric.toFixed(1))));
}

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseMetricAsPercentage(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 10) {
      return clampPercentage(value * 10);
    }

    return clampPercentage(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const mapped = METRIC_LABEL_TO_PERCENTAGE[trimmed.toLowerCase()];
    if (typeof mapped === "number") {
      return mapped;
    }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    if (numeric <= 10) {
      return clampPercentage(numeric * 10);
    }

    return clampPercentage(numeric);
  }

  return null;
}

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildEmptyProgressResponse() {
  return {
    overview: {
      totalInterviews: 0,
      completedInterviews: 0,
      averageScore: 0,
      bestScore: 0,
      latestScore: 0,
    },
    skills: SKILL_NAMES.map((name) => ({ name, percentage: 0 })),
    interviewScores: [],
  };
}

function normalizeSessionScore(storedAverageScore, questionScores) {
  const directScore = parseScore(storedAverageScore);
  if (directScore !== null) {
    return directScore;
  }

  const computedAverage = average(questionScores);
  if (computedAverage === null) {
    return 0;
  }

  return Number(Math.max(0, Math.min(10, computedAverage)).toFixed(1));
}

function getSortTimestamp(session) {
  const completedTime = Date.parse(session.completedAt || "");
  if (Number.isFinite(completedTime)) {
    return completedTime;
  }

  const updatedTime = Date.parse(session.updatedAt || "");
  if (Number.isFinite(updatedTime)) {
    return updatedTime;
  }

  const createdTime = Date.parse(session.createdAt || "");
  if (Number.isFinite(createdTime)) {
    return createdTime;
  }

  return 0;
}

async function getProgressForUser(firestore, userId) {
  const snapshot = await firestore
    .collection("interviewSessions")
    .where("userId", "==", userId)
    .get();

  if (snapshot.empty) {
    return buildEmptyProgressResponse();
  }

  const allSessions = snapshot.docs.map((doc) => {
    const data = doc.data() || {};

    return {
      doc,
      sessionId: data.sessionId || doc.id,
      status: typeof data.status === "string" ? data.status : "active",
      averageScore: data.averageScore,
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
      completedAt: toIso(data.completedAt),
    };
  });

  const completedSessions = allSessions.filter((session) => session.status === "completed");
  if (!completedSessions.length) {
    return {
      ...buildEmptyProgressResponse(),
      overview: {
        totalInterviews: allSessions.length,
        completedInterviews: 0,
        averageScore: 0,
        bestScore: 0,
        latestScore: 0,
      },
    };
  }

  const skillBuckets = {
    technicalAccuracy: [],
    communication: [],
    confidence: [],
    problemSolving: [],
  };

  const sessionsWithScores = await Promise.all(
    completedSessions.map(async (session) => {
      const questionSnapshot = await session.doc.ref.collection("questions").get();
      const questionScores = [];

      questionSnapshot.forEach((questionDoc) => {
        const question = questionDoc.data() || {};
        const feedback = question.feedback && typeof question.feedback === "object" ? question.feedback : {};
        const score = parseScore(feedback.score);

        if (score !== null) {
          questionScores.push(score);
        }

        const scorePercentage = score !== null ? clampPercentage(score * 10) : null;

        const technicalAccuracy =
          parseMetricAsPercentage(feedback.technicalAccuracy) ?? scorePercentage;
        if (technicalAccuracy !== null) {
          skillBuckets.technicalAccuracy.push(technicalAccuracy);
        }

        const communication =
          parseMetricAsPercentage(feedback.communication) ?? scorePercentage;
        if (communication !== null) {
          skillBuckets.communication.push(communication);
        }

        const confidence = parseMetricAsPercentage(feedback.confidence) ?? scorePercentage;
        if (confidence !== null) {
          skillBuckets.confidence.push(confidence);
        }

        const directProblemSolving = parseMetricAsPercentage(feedback.problemSolving);
        const derivedProblemSolving =
          directProblemSolving ??
          (() => {
            if (technicalAccuracy !== null && scorePercentage !== null) {
              return clampPercentage((technicalAccuracy + scorePercentage) / 2);
            }

            if (technicalAccuracy !== null) {
              return technicalAccuracy;
            }

            if (scorePercentage !== null) {
              return scorePercentage;
            }

            return null;
          })();

        if (derivedProblemSolving !== null) {
          skillBuckets.problemSolving.push(derivedProblemSolving);
        }
      });

      const sessionScore = normalizeSessionScore(session.averageScore, questionScores);

      return {
        sessionId: session.sessionId,
        completedAt: session.completedAt,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt,
        score: sessionScore,
      };
    })
  );

  const sortedByDateAscending = sessionsWithScores
    .slice()
    .sort((a, b) => getSortTimestamp(a) - getSortTimestamp(b));
  const sortedByDateDescending = sessionsWithScores
    .slice()
    .sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));

  const scoreValues = sessionsWithScores.map((session) => session.score);
  const averageScore = Number((average(scoreValues) || 0).toFixed(1));
  const bestScore = Number(Math.max(...scoreValues, 0).toFixed(1));
  const latestScore = Number((sortedByDateDescending[0]?.score || 0).toFixed(1));

  const skillPercentages = {
    technicalAccuracy: clampPercentage(average(skillBuckets.technicalAccuracy) || 0),
    communication: clampPercentage(average(skillBuckets.communication) || 0),
    confidence: clampPercentage(average(skillBuckets.confidence) || 0),
    problemSolving: clampPercentage(average(skillBuckets.problemSolving) || 0),
  };

  return {
    overview: {
      totalInterviews: allSessions.length,
      completedInterviews: completedSessions.length,
      averageScore,
      bestScore,
      latestScore,
    },
    skills: [
      { name: "Technical Accuracy", percentage: skillPercentages.technicalAccuracy },
      { name: "Communication", percentage: skillPercentages.communication },
      { name: "Confidence", percentage: skillPercentages.confidence },
      { name: "Problem Solving", percentage: skillPercentages.problemSolving },
    ],
    interviewScores: sortedByDateAscending.map((session, index) => ({
      label: `Interview ${index + 1}`,
      score: Number(session.score.toFixed(1)),
      maxScore: 10,
      sessionId: session.sessionId,
      completedAt: session.completedAt,
    })),
  };
}

module.exports = {
  getProgressForUser,
  buildEmptyProgressResponse,
};
