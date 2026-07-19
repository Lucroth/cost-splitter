# M&R Split 💜

Private expense-splitting app for Marta & Rafał. Track shared costs (groceries, travel, food…), see who owes whom, settle up. Installable on Android as a PWA.

**Live:** https://lucroth.github.io/cost-splitter/

## How it works
- Static app hosted on **GitHub Pages** (this repo).
- **Firebase Auth** — only two accounts (Rafał, Marta) can log in.
- **Cloud Firestore** — shared data, syncs live between both phones, works offline and syncs when back online.
- **Receipt scanning** — 📷 button uses the phone camera + on-device OCR (Tesseract.js, Polish language) to read the receipt total (SUMA/RAZEM…) and prefill the amount. Photos never leave the phone.

## Features
- Expenses: description, amount (comma or dot), currency (PLN/EUR/USD/GBP/CZK/HUF), category, date
- Who paid + split: 50/50, all on the other person, or custom shares
- Balance per currency ("Marta owes Rafał 43,75 PLN") + one-tap **Settle up**
- History grouped by day, live-updates when the other person adds something
- Android install: open in Chrome → ⋮ → **Add to Home screen**

## Setup
First time: follow [SETUP.md](SETUP.md) (create Firebase project, two accounts, paste config). After that everything is automatic — push to `main` redeploys Pages.

## Development
Any static server works, e.g. `npx http-server -p 3000`. Icons regenerate with `node scripts/make-icons.js`.
