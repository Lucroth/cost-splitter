// 1. Paste your Firebase web app config here (Firebase console → Project settings → Your apps).
//    The apiKey is safe to publish — it only identifies the project; security comes from
//    Firestore rules + Auth.
export const firebaseConfig = {
  apiKey: "PASTE_ME",
  authDomain: "PASTE_ME.firebaseapp.com",
  projectId: "PASTE_ME",
  storageBucket: "PASTE_ME.appspot.com",
  messagingSenderId: "PASTE_ME",
  appId: "PASTE_ME"
};

// 2. The two allowed accounts (create them in Firebase console → Authentication → Users).
//    Must match the emails in firestore.rules.
export const USER_EMAILS = {
  'Rafał': 'rafal@example.com',
  'Marta': 'marta@example.com'
};
