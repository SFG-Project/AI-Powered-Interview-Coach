const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

function hasRequiredFirebaseEnv(env) {
  return getMissingFirebaseEnvVarNames(env).length === 0;
}

function getMissingFirebaseEnvVarNames(env) {
  if (isNonEmptyString(env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    return [];
  }

  const requiredVars = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ];

  return requiredVars.filter((envVarName) => !isNonEmptyString(env[envVarName]));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePrivateKey(privateKey) {
  if (!privateKey) {
    return privateKey;
  }

  const hasWrappingQuotes =
    privateKey.startsWith('"') && privateKey.endsWith('"');
  const unwrappedPrivateKey = hasWrappingQuotes
    ? privateKey.slice(1, -1)
    : privateKey;

  return unwrappedPrivateKey
    .replace(/\\\r?\n/g, "\n")
    .replace(/\\n/g, "\n")
    .trim();
}

function isFirebaseAdminInitialized() {
  return admin.apps.length > 0;
}

function initializeFirebaseAdmin() {
  if (isFirebaseAdminInitialized()) {
    return { initialized: true };
  }

  if (!hasRequiredFirebaseEnv(process.env)) {
    const missingVarNames = getMissingFirebaseEnvVarNames(process.env);
    console.warn(
      `[firebase-admin] Missing environment variable(s): ${missingVarNames.join(
        ", "
      )}. Skipping Firebase Admin initialization.`
    );
    return { initialized: false };
  }

  try {
    const firebaseConfig = {};

    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccountPath = path.resolve(
        process.cwd(),
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      );
      const serviceAccountJson = fs.readFileSync(serviceAccountPath, "utf8");
      const serviceAccount = JSON.parse(serviceAccountJson);

      firebaseConfig.credential = admin.credential.cert(serviceAccount);
    } else {
      firebaseConfig.credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      });
    }

    if (process.env.FIREBASE_DATABASE_URL) {
      firebaseConfig.databaseURL = process.env.FIREBASE_DATABASE_URL;
    }

    admin.initializeApp({
      ...firebaseConfig,
    });

    console.log("[firebase-admin] Firebase Admin initialized.");
    return { initialized: true };
  } catch (error) {
    console.warn(
      `[firebase-admin] Initialization failed, continuing without Firebase: ${error.message}`
    );
    return { initialized: false };
  }
}

module.exports = {
  admin,
  initializeFirebaseAdmin,
  isFirebaseAdminInitialized,
};
