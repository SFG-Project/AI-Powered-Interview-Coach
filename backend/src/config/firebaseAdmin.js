const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

function hasRequiredFirebaseEnv(env) {
  if (Boolean(env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    return true;
  }

  return (
    Boolean(env.FIREBASE_PROJECT_ID) &&
    Boolean(env.FIREBASE_CLIENT_EMAIL) &&
    Boolean(env.FIREBASE_PRIVATE_KEY)
  );
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
    console.warn(
      "[firebase-admin] Credentials not found. Skipping Firebase Admin initialization."
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
