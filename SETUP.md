# One-time Firebase setup (~10 minutes)

The app is static (GitHub Pages) — Firebase provides login + shared database.

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com → **Add project** (name e.g. `cost-splitter`).
   Analytics: off, doesn't matter.

## 2. Enable login
1. **Build → Authentication → Get started → Email/Password** → Enable → Save.
2. **Users** tab → **Add user** twice:
   - your email + a password (this is what you'll type in the app)
   - Marta's email + her password
   Passwords must be ≥ 6 characters.

## 3. Create the database
1. **Build → Firestore Database → Create database** → production mode → region `europe-central2` (Warsaw) or `eur3`.
2. **Rules** tab → replace everything with the contents of `firestore.rules` from this repo,
   **but put your two real emails in** — then **Publish**.

## 4. Connect the app
1. **Project settings (⚙️) → Your apps → Web (`</>`)** → register app (no hosting needed).
2. Copy the `firebaseConfig = { ... }` object it shows.
3. Paste it into `firebase-config.js` in this repo, and set the two emails in `USER_EMAILS`
   (same emails as step 2).
4. Commit + push — GitHub Pages redeploys automatically in ~1 minute.

## 5. Phones
Open `https://lucroth.github.io/cost-splitter/` in Chrome on each phone → log in →
menu (⋮) → **Add to Home screen**. Done — you stay logged in.

## Security notes
- Only the two emails listed in the Firestore rules can read or write data —
  even if someone else creates an account, the rules reject them.
- The `apiKey` in `firebase-config.js` is public by design (it identifies the
  project, it's not a secret). Your emails will be visible in the public repo —
  if you don't want that, use throwaway addresses for the accounts.
