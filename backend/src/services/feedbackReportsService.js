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

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function pushUnique(target, value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return;
  }

  const alreadyExists = target.some(
    (item) => item.toLowerCase() === normalized.toLowerCase()
  );

  if (!alreadyExists) {
    target.push(normalized);
  }
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

function buildFallbackSummary(sessionData) {
  const answeredQuestions = Number(sessionData.answeredQuestions || 0);
  const skippedQuestions = Number(sessionData.skippedQuestions || 0);
  const totalQuestions = Number(sessionData.totalQuestions || sessionData.questionCount || 0);
  return `Completed interview with ${answeredQuestions} answered and ${skippedQuestions} skipped out of ${totalQuestions} questions.`;
}

async function getFeedbackReportsForUser(firestore, userId) {
  const snapshot = await firestore
    .collection("interviewSessions")
    .where("userId", "==", userId)
    .where("status", "==", "completed")
    .get();

  if (snapshot.empty) {
    return { reports: [] };
  }

  const sessions = snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      doc,
      sessionId: data.sessionId || doc.id,
      careerField: normalizeString(data.careerField) || "General",
      interviewType: normalizeString(data.interviewType) || "Interview",
      difficulty: normalizeString(data.difficulty) || "Medium",
      averageScore: data.averageScore,
      questionCount: Number(data.questionCount || 0),
      answeredQuestions: Number(data.answeredQuestions || 0),
      skippedQuestions: Number(data.skippedQuestions || 0),
      totalQuestions: Number(data.totalQuestions || data.questionCount || 0),
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
      completedAt: toIso(data.completedAt),
    };
  });

  const sortedSessions = sessions
    .slice()
    .sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));

  const reports = await Promise.all(
    sortedSessions.map(async (session, index) => {
      const questionSnapshot = await session.doc.ref.collection("questions").get();

      const strengths = [];
      const weaknesses = [];
      const suggestions = [];
      const summaryCandidates = [];
      const questionScores = [];

      const questions = questionSnapshot.docs
        .map((questionDoc) => questionDoc.data() || {})
        .sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
        .map((questionData) => {
          const feedback =
            questionData.feedback && typeof questionData.feedback === "object"
              ? questionData.feedback
              : {};
          const score = parseScore(feedback.score);

          if (score !== null) {
            questionScores.push(score);
          }

          if (Array.isArray(feedback.strengths)) {
            feedback.strengths.forEach((item) => pushUnique(strengths, item));
          }

          if (Array.isArray(feedback.improvements)) {
            feedback.improvements.forEach((item) => pushUnique(weaknesses, item));
            feedback.improvements.forEach((item) => pushUnique(suggestions, item));
          }

          pushUnique(suggestions, feedback.quickTip);
          pushUnique(suggestions, feedback.sessionNotes);
          pushUnique(suggestions, feedback.suggestedAnswer);
          pushUnique(summaryCandidates, feedback.summary);

          return {
            number: Number(questionData.number || 0),
            question: normalizeString(questionData.text),
            answer: normalizeString(questionData.answer),
            score: score ?? 0,
            feedbackSummary:
              normalizeString(feedback.summary) || "Feedback summary not available.",
            suggestedAnswer:
              normalizeString(feedback.suggestedAnswer) ||
              "Suggested answer not available.",
          };
        });

      const reportScore = normalizeSessionScore(session.averageScore, questionScores);
      const summary =
        summaryCandidates.find((item) => Boolean(normalizeString(item))) ||
        buildFallbackSummary(session);

      const normalizedStrengths = strengths.slice(0, 3);
      const normalizedWeaknesses = weaknesses.slice(0, 3);
      const normalizedSuggestions = suggestions.slice(0, 2);

      return {
        sessionId: session.sessionId,
        title: `Report ${index + 1} - ${session.careerField} Interview`,
        careerField: session.careerField,
        interviewType: session.interviewType,
        difficulty: session.difficulty,
        score: Number(reportScore.toFixed(1)),
        maxScore: 10,
        completedAt: session.completedAt,
        strengths: normalizedStrengths.length
          ? normalizedStrengths
          : ["You completed the interview and attempted the questions."],
        weaknesses: normalizedWeaknesses.length
          ? normalizedWeaknesses
          : ["No major weaknesses recorded yet."],
        suggestions: normalizedSuggestions.length
          ? normalizedSuggestions
          : [
              "Continue practising and include clear examples in your answers.",
            ],
        summary,
        questions,
      };
    })
  );

  return { reports };
}

module.exports = {
  getFeedbackReportsForUser,
};
