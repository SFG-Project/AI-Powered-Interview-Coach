const { admin } = require("../config/firebaseAdmin");
const {
  average,
  getSortTimestamp,
  normalizeSessionScore,
  parseScore,
  toIso,
} = require("./progressService");

const USERS_COLLECTION = "users";
const INTERVIEW_SESSIONS_COLLECTION = "interviewSessions";
const DEFAULT_CAREER_FIELD = "Software Developer";
const DEFAULT_INTERVIEW_TYPE = "Interview";
const USER_ROLE_ADMIN = "admin";
const USER_ROLE_USER = "user";
const USER_STATUS_ACTIVE = "active";
const USER_STATUS_PENDING = "pending";
const USER_STATUS_BLOCKED = "blocked";
const USER_STATUS_VALUES = [
  USER_STATUS_ACTIVE,
  USER_STATUS_PENDING,
  USER_STATUS_BLOCKED,
];

function getTrimmedString(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed || "";
}

function normalizeUserRole(value) {
  const normalized = getTrimmedString(value).toLowerCase();
  return normalized === USER_ROLE_ADMIN ? USER_ROLE_ADMIN : USER_ROLE_USER;
}

function normalizeUserStatus(value) {
  const normalized = getTrimmedString(value).toLowerCase();
  return USER_STATUS_VALUES.includes(normalized) ? normalized : USER_STATUS_ACTIVE;
}

function formatUserStatus(status) {
  if (status === USER_STATUS_PENDING) {
    return "Pending";
  }

  if (status === USER_STATUS_BLOCKED) {
    return "Blocked";
  }

  return "Active";
}

function normalizeInterviewTypeLabel(value) {
  const rawValue = getTrimmedString(value);
  const normalized = rawValue.toLowerCase();

  if (!normalized) {
    return DEFAULT_INTERVIEW_TYPE;
  }

  if (normalized.includes("tech")) {
    return "Technical";
  }

  if (normalized.includes("behav")) {
    return "Behavioral";
  }

  if (normalized.includes("mixed")) {
    return "Mixed";
  }

  if (normalized === "hr") {
    return "HR";
  }

  return rawValue;
}

function normalizeInterviewTypeKey(value) {
  const normalized = normalizeInterviewTypeLabel(value).toLowerCase();

  if (normalized === "technical") {
    return "technical";
  }

  if (normalized === "behavioral") {
    return "behavioral";
  }

  if (normalized === "mixed") {
    return "mixed";
  }

  return "other";
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const isoValue = toIso(value);
  if (typeof isoValue !== "string" || !isoValue.trim()) {
    return 0;
  }

  const parsed = Date.parse(isoValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDashboardDate(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function formatScore(value) {
  if (!Number.isFinite(value)) {
    return "0/10";
  }

  if (Number.isInteger(value)) {
    return `${value}/10`;
  }

  return `${value.toFixed(1)}/10`;
}

function capitalizeFirstCharacter(value) {
  if (!value) {
    return "A";
  }

  return value[0].toUpperCase();
}

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function resolveUserNameFromData(data, fallbackEmail) {
  const fullName = getTrimmedString(data.fullName);
  if (fullName) {
    return fullName;
  }

  const displayName = getTrimmedString(data.displayName);
  if (displayName) {
    return displayName;
  }

  const firstName = getTrimmedString(data.firstName);
  const lastName = getTrimmedString(data.lastName);
  const derivedName = `${firstName} ${lastName}`.trim();
  if (derivedName) {
    return derivedName;
  }

  if (fallbackEmail) {
    return fallbackEmail.split("@")[0];
  }

  return "Unknown User";
}

function resolveUserRoleLabel(data) {
  const careerField =
    getTrimmedString(data.careerField) || getTrimmedString(data.industry);
  if (careerField) {
    return careerField;
  }

  return normalizeUserRole(data.role) === USER_ROLE_ADMIN ? "Admin" : "User";
}

function normalizeUserDoc(doc) {
  const data = doc.data() || {};
  const email = getTrimmedString(data.email);
  const normalizedStatus = normalizeUserStatus(data.status);
  const uid = getTrimmedString(data.uid) || doc.id;
  const createdAt = toIso(data.createdAt);
  const updatedAt = toIso(data.updatedAt);

  return {
    userId: uid,
    name: resolveUserNameFromData(data, email),
    email,
    roleLabel: resolveUserRoleLabel(data),
    status: normalizedStatus,
    statusLabel: formatUserStatus(normalizedStatus),
    createdAt,
    updatedAt,
    createdTime: toTimestamp(data.createdAt),
    updatedTime: toTimestamp(data.updatedAt),
  };
}

function normalizeSessionDoc(doc) {
  const data = doc.data() || {};
  const createdAt = toIso(data.createdAt);
  const updatedAt = toIso(data.updatedAt);
  const completedAt = toIso(data.completedAt);
  const interviewType = normalizeInterviewTypeLabel(data.interviewType);

  return {
    doc,
    sessionId: getTrimmedString(data.sessionId) || doc.id,
    userId: getTrimmedString(data.userId),
    careerField: getTrimmedString(data.careerField) || "General",
    interviewType,
    interviewTypeKey: normalizeInterviewTypeKey(interviewType),
    difficulty: getTrimmedString(data.difficulty) || "Medium",
    status: getTrimmedString(data.status) || "active",
    createdAt,
    updatedAt,
    completedAt,
    sortTime: getSortTimestamp({ createdAt, updatedAt, completedAt }),
    storedAverageScore: data.averageScore,
  };
}

async function resolveSessionScore(session) {
  const directScore = parseScore(session.storedAverageScore);
  if (directScore !== null) {
    return directScore;
  }

  const questionSnapshot = await session.doc.ref.collection("questions").get();
  const questionScores = questionSnapshot.docs
    .map((questionDoc) => {
      const questionData = questionDoc.data() || {};
      const feedback =
        questionData.feedback && typeof questionData.feedback === "object"
          ? questionData.feedback
          : {};
      return parseScore(feedback.score);
    })
    .filter((score) => score !== null);

  return normalizeSessionScore(null, questionScores);
}

function pickDisplayDate(session) {
  return session.completedAt || session.updatedAt || session.createdAt || "";
}

function toPercentage(value, total) {
  if (total <= 0) {
    return 0;
  }

  const computed = Math.round((value / total) * 100);
  return Math.max(0, Math.min(100, computed));
}

function getTodayUtcStartTimestamp() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today.getTime();
}

function isActiveSince(timestamp, threshold) {
  return Number.isFinite(timestamp) && timestamp >= threshold;
}

function escapeCsv(value) {
  const stringValue = value === undefined || value === null ? "" : String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes("\n") ||
    stringValue.includes("\"")
  ) {
    return `"${stringValue.replace(/\"/g, '""')}"`;
  }

  return stringValue;
}

function toCsv(rows) {
  return rows.map((row) => row.map((value) => escapeCsv(value)).join(",")).join("\n");
}

async function getAdminDashboardPayload(firestore, authUser) {
  const [usersSnapshot, sessionsSnapshot] = await Promise.all([
    firestore.collection(USERS_COLLECTION).get(),
    firestore.collection(INTERVIEW_SESSIONS_COLLECTION).get(),
  ]);

  const users = usersSnapshot.docs.map((doc) => normalizeUserDoc(doc));
  const usersById = new Map(users.map((user) => [user.userId, user]));
  const allSessions = sessionsSnapshot.docs.map((doc) => normalizeSessionDoc(doc));
  const completedSessions = allSessions.filter((session) => session.status === "completed");

  const scoredSessions = await Promise.all(
    completedSessions.map(async (session) => ({
      ...session,
      resolvedScore: await resolveSessionScore(session),
    }))
  );

  const scoreValues = scoredSessions
    .map((session) => session.resolvedScore)
    .filter((score) => Number.isFinite(score));
  const averageScore = Number((average(scoreValues) || 0).toFixed(1));

  const recentUsers = users
    .slice()
    .sort((a, b) => {
      // Prefer `createdAt` order, and fallback to `updatedAt` when older data does not have
      // populated creation timestamps.
      if (a.createdTime !== b.createdTime) {
        return b.createdTime - a.createdTime;
      }

      if (a.updatedTime !== b.updatedTime) {
        return b.updatedTime - a.updatedTime;
      }

      return b.userId.localeCompare(a.userId);
    })
    .slice(0, 5)
    .map((user) => ({
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.roleLabel,
      status: user.statusLabel,
      action: "View",
    }));

  const userStatusCounts = users.reduce(
    (accumulator, user) => {
      if (user.status === USER_STATUS_PENDING) {
        accumulator.pending += 1;
      } else if (user.status === USER_STATUS_BLOCKED) {
        accumulator.blocked += 1;
      } else {
        accumulator.active += 1;
      }

      return accumulator;
    },
    { active: 0, pending: 0, blocked: 0 }
  );

  const interviewTypeCounts = scoredSessions.reduce(
    (accumulator, session) => {
      if (session.interviewTypeKey === "technical") {
        accumulator.technical += 1;
      } else if (session.interviewTypeKey === "behavioral") {
        accumulator.behavioral += 1;
      } else if (session.interviewTypeKey === "mixed") {
        accumulator.mixed += 1;
      }

      return accumulator;
    },
    { technical: 0, behavioral: 0, mixed: 0 }
  );

  const recentInterviewReports = scoredSessions
    .slice()
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 5)
    .map((session) => {
      const user = usersById.get(session.userId);
      return {
        sessionId: session.sessionId,
        date: formatDashboardDate(pickDisplayDate(session)),
        user: user?.name || "Unknown User",
        interviewType: session.interviewType,
        score: formatScore(session.resolvedScore),
        report: "Open",
      };
    });

  const todayUtcStart = getTodayUtcStartTimestamp();
  const activeTodayUserIds = new Set();

  // The app does not store a dedicated `lastActiveAt` field yet. We use
  // user-document updates and interview-session timestamps as the safest
  // grounded approximation of "active today".
  users.forEach((user) => {
    if (
      isActiveSince(user.createdTime, todayUtcStart) ||
      isActiveSince(user.updatedTime, todayUtcStart)
    ) {
      activeTodayUserIds.add(user.userId);
    }
  });

  allSessions.forEach((session) => {
    const createdAtTimestamp = Date.parse(session.createdAt || "");
    const updatedAtTimestamp = Date.parse(session.updatedAt || "");
    const completedAtTimestamp = Date.parse(session.completedAt || "");

    if (
      isActiveSince(createdAtTimestamp, todayUtcStart) ||
      isActiveSince(updatedAtTimestamp, todayUtcStart) ||
      isActiveSince(completedAtTimestamp, todayUtcStart)
    ) {
      if (session.userId) {
        activeTodayUserIds.add(session.userId);
      }
    }
  });

  const adminName =
    getTrimmedString(authUser?.displayName) ||
    getTrimmedString(authUser?.email) ||
    "Admin";

  return {
    summaryCards: [
      { label: "Total Users", value: String(users.length) },
      { label: "Total Interviews", value: String(scoredSessions.length) },
      { label: "Average Score", value: `${averageScore.toFixed(1)} / 10` },
      { label: "Active Today", value: String(activeTodayUserIds.size) },
    ],
    recentUsers,
    systemSummary: [
      {
        label: "Active Users",
        value: String(userStatusCounts.active),
        tone: "active",
      },
      {
        label: "Pending Users",
        value: String(userStatusCounts.pending),
        tone: "pending",
      },
      {
        label: "Blocked Users",
        value: String(userStatusCounts.blocked),
        tone: "blocked",
      },
    ],
    performanceOverview: [
      {
        label: "Technical Interviews",
        percentage: toPercentage(interviewTypeCounts.technical, scoredSessions.length),
      },
      {
        label: "Behavioral Interviews",
        percentage: toPercentage(interviewTypeCounts.behavioral, scoredSessions.length),
      },
      {
        label: "Mixed Interviews",
        percentage: toPercentage(interviewTypeCounts.mixed, scoredSessions.length),
      },
    ],
    recentInterviewReports,
    adminActions: [
      { label: "Add User", action: "add-user", tone: "primary", enabled: true },
      {
        label: "Export Reports",
        action: "export-reports",
        tone: "warning",
        enabled: true,
      },
      {
        label: "Clear Logs",
        action: "clear-logs",
        tone: "danger",
        enabled: false,
        hint: "Log storage is not configured yet in this project.",
      },
    ],
    adminUser: {
      name: adminName,
      avatarText: capitalizeFirstCharacter(adminName),
    },
  };
}

function normalizeCreateUserPayload(payload) {
  const firstName = getTrimmedString(payload?.firstName);
  const lastName = getTrimmedString(payload?.lastName);
  const email = getTrimmedString(payload?.email).toLowerCase();
  const password = getTrimmedString(payload?.password);
  const role = normalizeUserRole(payload?.role);
  const status = normalizeUserStatus(payload?.status);
  const careerField =
    getTrimmedString(payload?.careerField) ||
    getTrimmedString(payload?.industry) ||
    DEFAULT_CAREER_FIELD;

  if (!firstName) {
    throw createHttpError(400, "firstName is required.", "invalid-first-name");
  }

  if (!lastName) {
    throw createHttpError(400, "lastName is required.", "invalid-last-name");
  }

  if (!email) {
    throw createHttpError(400, "email is required.", "invalid-email");
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw createHttpError(400, "email must be a valid email address.", "invalid-email");
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw createHttpError(
      400,
      "password must be at least 8 characters and include letters and numbers.",
      "weak-password"
    );
  }

  return {
    firstName,
    lastName,
    email,
    password,
    role,
    status,
    careerField,
    fullName: `${firstName} ${lastName}`.trim(),
  };
}

async function createUserByAdmin({ firestore, auth, payload }) {
  const normalizedPayload = normalizeCreateUserPayload(payload);
  let createdAuthUser = null;

  try {
    createdAuthUser = await auth.createUser({
      email: normalizedPayload.email,
      password: normalizedPayload.password,
      displayName: normalizedPayload.fullName,
    });

    await firestore
      .collection(USERS_COLLECTION)
      .doc(createdAuthUser.uid)
      .set(
        {
          uid: createdAuthUser.uid,
          firstName: normalizedPayload.firstName,
          lastName: normalizedPayload.lastName,
          fullName: normalizedPayload.fullName,
          displayName: normalizedPayload.fullName,
          email: normalizedPayload.email,
          role: normalizedPayload.role,
          status: normalizedPayload.status,
          industry: normalizedPayload.careerField,
          careerField: normalizedPayload.careerField,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return {
      id: createdAuthUser.uid,
      user: {
        userId: createdAuthUser.uid,
        name: normalizedPayload.fullName,
        email: normalizedPayload.email,
        role:
          normalizedPayload.role === USER_ROLE_ADMIN
            ? "Admin"
            : normalizedPayload.careerField,
        status: formatUserStatus(normalizedPayload.status),
      },
    };
  } catch (error) {
    if (createdAuthUser?.uid) {
      try {
        await auth.deleteUser(createdAuthUser.uid);
      } catch {
        // Ignore rollback failures and surface the original error.
      }
    }

    const code = typeof error?.code === "string" ? error.code : "unknown";

    if (code === "auth/email-already-exists") {
      throw createHttpError(
        409,
        "An account with this email already exists.",
        "auth/email-already-in-use"
      );
    }

    if (code === "auth/invalid-email") {
      throw createHttpError(400, "Please enter a valid email address.", "auth/invalid-email");
    }

    if (code === "auth/invalid-password") {
      throw createHttpError(
        400,
        "Password is too weak. Use at least 8 characters.",
        "auth/weak-password"
      );
    }

    throw createHttpError(500, "Failed to create user.", code);
  }
}

async function buildAdminReportsExportCsv(firestore) {
  const [usersSnapshot, sessionsSnapshot] = await Promise.all([
    firestore.collection(USERS_COLLECTION).get(),
    firestore
      .collection(INTERVIEW_SESSIONS_COLLECTION)
      .where("status", "==", "completed")
      .get(),
  ]);

  const users = usersSnapshot.docs.map((doc) => normalizeUserDoc(doc));
  const usersById = new Map(users.map((user) => [user.userId, user]));

  const completedSessions = sessionsSnapshot.docs.map((doc) => normalizeSessionDoc(doc));
  const scoredSessions = await Promise.all(
    completedSessions.map(async (session) => ({
      ...session,
      resolvedScore: await resolveSessionScore(session),
    }))
  );

  const rows = [
    [
      "Session ID",
      "Date",
      "User",
      "Email",
      "Interview Type",
      "Career Field",
      "Score",
      "Status",
    ],
    ...scoredSessions
      .slice()
      .sort((a, b) => b.sortTime - a.sortTime)
      .map((session) => {
        const user = usersById.get(session.userId);
        return [
          session.sessionId,
          formatDashboardDate(pickDisplayDate(session)),
          user?.name || "Unknown User",
          user?.email || "",
          session.interviewType,
          session.careerField,
          formatScore(session.resolvedScore),
          session.status,
        ];
      }),
  ];

  return toCsv(rows);
}

function buildReportSummary(session, questionRows) {
  const answered = Number(session.answeredQuestions || 0);
  const skipped = Number(session.skippedQuestions || 0);

  const explicitSummary = questionRows
    .map((question) => getTrimmedString(question.feedbackSummary))
    .find(
      (summary) => Boolean(summary) && summary !== "Feedback summary not available."
    );

  if (explicitSummary) {
    return explicitSummary;
  }

  return `Completed interview with ${answered} answered and ${skipped} skipped questions.`;
}

async function getAdminReportDetails(firestore, sessionIdInput) {
  const sessionId = getTrimmedString(sessionIdInput);
  if (!sessionId) {
    throw createHttpError(400, "A valid sessionId is required.", "invalid-session-id");
  }

  const sessionDoc = await firestore
    .collection(INTERVIEW_SESSIONS_COLLECTION)
    .doc(sessionId)
    .get();

  if (!sessionDoc.exists) {
    throw createHttpError(404, "Interview report not found.", "report-not-found");
  }

  const sessionData = sessionDoc.data() || {};
  const normalizedSession = normalizeSessionDoc(sessionDoc);
  const userId = normalizedSession.userId;

  let user = null;
  if (userId) {
    const userSnapshot = await firestore.collection(USERS_COLLECTION).doc(userId).get();
    if (userSnapshot.exists) {
      user = normalizeUserDoc(userSnapshot);
    }
  }

  const questionSnapshot = await sessionDoc.ref.collection("questions").get();
  const questionRows = questionSnapshot.docs
    .map((questionDoc) => {
      const questionData = questionDoc.data() || {};
      const feedback =
        questionData.feedback && typeof questionData.feedback === "object"
          ? questionData.feedback
          : {};
      const questionScore = parseScore(feedback.score);

      return {
        number: Number(questionData.number || 0),
        question: getTrimmedString(questionData.text) || "Question text unavailable.",
        answer: getTrimmedString(questionData.answer) || "No answer recorded.",
        score: questionScore === null ? 0 : questionScore,
        feedbackSummary:
          getTrimmedString(feedback.summary) || "Feedback summary not available.",
      };
    })
    .sort((a, b) => a.number - b.number);

  const resolvedScore = await resolveSessionScore(normalizedSession);

  return {
    sessionId: normalizedSession.sessionId,
    user: {
      userId,
      name: user?.name || "Unknown User",
      email: user?.email || "",
    },
    interviewType: normalizedSession.interviewType,
    difficulty: normalizedSession.difficulty,
    careerField: normalizedSession.careerField,
    status: normalizedSession.status,
    score: resolvedScore,
    maxScore: 10,
    completedAt: normalizedSession.completedAt,
    summary: buildReportSummary(
      {
        answeredQuestions: sessionData.answeredQuestions,
        skippedQuestions: sessionData.skippedQuestions,
      },
      questionRows
    ),
    questions: questionRows,
  };
}

module.exports = {
  USER_STATUS_ACTIVE,
  USER_STATUS_PENDING,
  USER_STATUS_BLOCKED,
  normalizeUserStatus,
  getAdminDashboardPayload,
  createUserByAdmin,
  buildAdminReportsExportCsv,
  getAdminReportDetails,
};
