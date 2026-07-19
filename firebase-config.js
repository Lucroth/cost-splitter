// 1. Paste your Firebase web app config here (Firebase console → Project settings → Your apps).
//    The apiKey is safe to publish — it only identifies the project; security comes from
//    Firestore rules + Auth.
export const firebaseConfig = {
  apiKey: "AIzaSyCWnoafIyzFzksdMv3a13-9ppdIfMD1-fU",
  authDomain: "cost-splitter-2daf2.firebaseapp.com",
  projectId: "cost-splitter-2daf2",
  storageBucket: "cost-splitter-2daf2.firebasestorage.app",
  messagingSenderId: "799800579105",
  appId: "1:799800579105:web:756ca367fdd42a4345bf60"
};

// 2. The two allowed accounts (create them in Firebase console → Authentication → Users).
//    Must match the emails in firestore.rules.
export const USER_EMAILS = {
  'Rafał': 'lewandowskyyy@gmail.com',
  'Marta': 'marta.mikolajczuk@o2.pl'
};
