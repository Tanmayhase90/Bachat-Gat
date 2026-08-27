const admin = require('firebase-admin');

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }

  return admin.credential.applicationDefault();
}

const firebaseApp = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      credential: getCredential(),
      projectId: process.env.FIREBASE_PROJECT_ID || undefined,
    });

const auth = admin.auth(firebaseApp);
const db = admin.firestore(firebaseApp);

module.exports = { admin, auth, db };