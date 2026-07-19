import { firebaseConfig, USER_EMAILS } from './firebase-config.js';

const $ = (sel) => document.querySelector(sel);
const USERS = ['Rafał', 'Marta'];
const CAT_ICONS = {
  Groceries: '🛒', Food: '🍕', Travel: '✈️', Transport: '🚌',
  Home: '🏠', Fun: '🎉', Other: '📦'
};
// Polish grammar helpers: dative (komu oddać), accusative (na kogo), past-tense verb by gender
const DATIVE = { 'Rafał': 'Rafałowi', 'Marta': 'Marcie' };
const ACCUSATIVE = { 'Rafał': 'Rafała', 'Marta': 'Martę' };
const PAID_VERB = { 'Rafał': 'Płacił', 'Marta': 'Płaciła' };

// ---------- setup check ----------
if (firebaseConfig.apiKey === 'PASTE_ME') {
  $('#setup-view').classList.remove('hidden');
  throw new Error('firebase not configured');
}

// ---------- firebase ----------
const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
const {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
const {
  initializeFirestore, persistentLocalCache,
  collection, addDoc, deleteDoc, doc, onSnapshot
} = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = initializeFirestore(fbApp, { localCache: persistentLocalCache() });

const EMAIL_TO_USER = Object.fromEntries(
  Object.entries(USER_EMAILS).map(([u, e]) => [e.toLowerCase(), u])
);

let me = null;
let selectedLoginUser = null;
let expenses = [];
let settlements = [];
let unsubscribers = [];

// ---------- helpers ----------
function parseAmount(str) {
  const n = Number(String(str).replace(',', '.').trim());
  return Number.isFinite(n) ? n : NaN;
}

function fmt(n) {
  return n.toFixed(2).replace('.', ',');
}

function otherUser(u) {
  return u === 'Marta' ? 'Rafał' : 'Marta';
}

function curLabel(c) {
  return c === 'PLN' ? 'zł' : c;
}

function createdMillis(item) {
  if (item.createdAt && typeof item.createdAt.toMillis === 'function') return item.createdAt.toMillis();
  return Date.now(); // pending server timestamp on fresh local writes
}

// ---------- views ----------
function showLogin() {
  $('#login-view').classList.remove('hidden');
  $('#main-view').classList.add('hidden');
}

function showMain() {
  $('#login-view').classList.add('hidden');
  $('#main-view').classList.remove('hidden');
  $('#hello').textContent = `Cześć, ${me} 👋`;
}

// ---------- auth ----------
document.querySelectorAll('.user-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedLoginUser = btn.dataset.user;
    document.querySelectorAll('.user-btn').forEach(b => b.classList.toggle('active', b === btn));
    $('#pin-input').focus();
  });
});

$('#login-btn').addEventListener('click', doLogin);
$('#pin-input').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const err = $('#login-error');
  err.classList.add('hidden');
  if (!selectedLoginUser) {
    err.textContent = 'Najpierw wybierz, kim jesteś';
    err.classList.remove('hidden');
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, USER_EMAILS[selectedLoginUser], $('#pin-input').value);
    $('#pin-input').value = '';
  } catch (e) {
    err.textContent = 'Złe hasło';
    err.classList.remove('hidden');
  }
}

$('#logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  if (!user) {
    me = null;
    showLogin();
    return;
  }
  me = EMAIL_TO_USER[(user.email || '').toLowerCase()] || user.email;
  showMain();
  unsubscribers.push(
    onSnapshot(collection(db, 'expenses'), snap => {
      expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    }),
    onSnapshot(collection(db, 'settlements'), snap => {
      settlements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    })
  );
});

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $('#tab-add').classList.toggle('hidden', tab.dataset.tab !== 'add');
    $('#tab-history').classList.toggle('hidden', tab.dataset.tab !== 'history');
  });
});



// ---------- receipt scanning ----------
$('#scan-btn').addEventListener('click', () => $('#scan-file').click());

$('#scan-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const status = $('#scan-status');
  const btn = $('#scan-btn');
  btn.disabled = true;
  status.classList.remove('hidden');
  try {
    if (!window.Tesseract) {
      status.textContent = 'Ładowanie silnika OCR… (za pierwszym razem pobiera pakiet języka polskiego)';
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('nie udało się załadować silnika OCR'));
        document.head.appendChild(s);
      });
    }
    status.textContent = 'Czytam paragon… 🔍';
    const worker = await Tesseract.createWorker('pol');
    const { data } = await worker.recognize(file);
    await worker.terminate();
    const total = parseReceiptTotal(data.text);
    if (total) {
      $('#f-amount').value = fmt(total);
      if (!$('#f-desc').value) $('#f-desc').value = guessStore(data.text) || 'Zakupy';
      status.textContent = `Znaleziona suma: ${fmt(total)} — sprawdź, czy się zgadza ✅`;
    } else {
      status.textContent = 'Nie udało się znaleźć sumy na paragonie — wpisz ręcznie';
    }
  } catch (err) {
    status.textContent = 'Skanowanie nie powiodło się: ' + err.message;
  } finally {
    btn.disabled = false;
    e.target.value = '';
  }
});

function parseReceiptTotal(text) {
  const amountRe = /(\d{1,6})[.,](\d{2})(?!\d)/g;
  // 1) look for the total line (Polish + English keywords)
  const totalRe = /(suma|razem|total|do\s*zap[łl]aty|karta|got[óo]wka)/i;
  for (const line of text.split('\n')) {
    if (totalRe.test(line)) {
      const matches = [...line.matchAll(amountRe)];
      if (matches.length) {
        const m = matches[matches.length - 1];
        return parseFloat(m[1] + '.' + m[2]);
      }
    }
  }
  // 2) fallback: biggest amount on the receipt
  let max = 0;
  for (const m of text.matchAll(amountRe)) {
    const v = parseFloat(m[1] + '.' + m[2]);
    if (v > max && v < 100000) max = v;
  }
  return max || null;
}

function guessStore(text) {
  const known = ['Biedronka', 'Lidl', 'Żabka', 'Zabka', 'Kaufland', 'Auchan', 'Carrefour', 'Netto', 'Aldi', 'Dino', 'Rossmann', 'Stokrotka'];
  const lower = text.toLowerCase();
  for (const k of known) {
    if (lower.includes(k.toLowerCase())) return k === 'Zabka' ? 'Żabka' : k;
  }
  return null;
}

// ---------- add expense ----------
$('#expense-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#form-error');
  err.classList.add('hidden');

  const amount = parseAmount($('#f-amount').value);

  if (!Number.isFinite(amount) || amount <= 0) return showFormError('Podaj poprawną kwotę');

  // payer = logged-in user, always split 50/50
  const paidBy = me;
  const half = Math.round(amount * 50) / 100;
  const shares = { [paidBy]: Math.round((amount - half) * 100) / 100, [otherUser(paidBy)]: half };

  try {
    const { serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    await addDoc(collection(db, 'expenses'), {
      desc: $('#f-desc').value.trim(),
      amount: Math.round(amount * 100) / 100,
      currency: 'PLN',
      paidBy,
      shares,
      category: 'Other',
      date: $('#f-date').value || new Date().toISOString().slice(0, 10),
      addedBy: me,
      createdAt: serverTimestamp()
    });
    $('#f-desc').value = '';
    $('#f-amount').value = '';
    $('#scan-status').classList.add('hidden');
    document.querySelector('.tab[data-tab="history"]').click();
  } catch (e2) {
    showFormError(e2.message);
  }
});

function showFormError(msg) {
  const err = $('#form-error');
  err.textContent = msg;
  err.classList.remove('hidden');
}

// ---------- balances ----------
function computeBalances() {
  const net = {};
  const touch = (cur) => net[cur] || (net[cur] = { 'Rafał': 0, 'Marta': 0 });
  for (const e of expenses) {
    const n = touch(e.currency);
    n[e.paidBy] += e.amount;
    for (const u of USERS) n[u] -= (e.shares && e.shares[u]) || 0;
  }
  for (const s of settlements) {
    const n = touch(s.currency);
    n[s.from] += s.amount;
    n[s.to] -= s.amount;
  }
  const result = {};
  for (const [cur, n] of Object.entries(net)) {
    const r = Math.round(n['Rafał'] * 100) / 100;
    if (Math.abs(r) >= 0.01) result[cur] = { 'Rafał': r, 'Marta': -r };
  }
  return result;
}

// ---------- render ----------
function render() {
  renderBalance(computeBalances());
  renderHistory();
}

function renderBalance(balances) {
  const el = $('#balance-banner');
  const currencies = Object.keys(balances);
  if (currencies.length === 0) {
    el.innerHTML = '<div class="balance-zero">✅ Wszystko rozliczone!</div>';
    return;
  }
  el.innerHTML = currencies.map(cur => {
    const rafal = balances[cur]['Rafał'];
    const debtor = rafal > 0 ? 'Marta' : 'Rafał';
    const creditor = otherUser(debtor);
    const amt = Math.abs(rafal);
    return `<div class="balance-line">
      <span class="balance-text"><b>${debtor}</b> ma oddać <b>${DATIVE[creditor]}</b> ${fmt(amt)} ${curLabel(cur)}</span>
      <button class="small" data-settle='${JSON.stringify({ from: debtor, to: creditor, amount: amt, currency: cur })}'>Rozlicz</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-settle]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const s = JSON.parse(btn.dataset.settle);
      if (!confirm(`Oznaczyć zwrot ${fmt(s.amount)} ${curLabel(s.currency)} (${s.from} → ${s.to}) jako oddany?`)) return;
      const { serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      await addDoc(collection(db, 'settlements'), {
        ...s,
        date: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp()
      });
    });
  });
}

function renderHistory() {
  const el = $('#history-list');
  const items = [
    ...expenses.map(e => ({ ...e, kind: 'expense' })),
    ...settlements.map(s => ({ ...s, kind: 'settlement' }))
  ].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '') || createdMillis(b) - createdMillis(a)
  );

  if (items.length === 0) {
    el.innerHTML = '<div class="empty">Brak wydatków.<br>Dodaj pierwszy! 🛒</div>';
    return;
  }

  let html = '';
  let lastDate = null;
  for (const item of items) {
    if (item.date !== lastDate) {
      html += `<div class="day-header">${formatDate(item.date)}</div>`;
      lastDate = item.date;
    }
    if (item.kind === 'expense') {
      html += `<div class="entry">
        <span class="entry-icon">${CAT_ICONS[item.category] || '📦'}</span>
        <div class="entry-main">
          <div class="entry-desc">${escapeHtml(item.desc)}</div>
          <div class="entry-sub">${PAID_VERB[item.paidBy]} ${item.paidBy}${splitSuffix(item)}</div>
        </div>
        <span class="entry-amount">${fmt(item.amount)} ${curLabel(item.currency)}</span>
        <button class="entry-del" data-del="expenses/${item.id}" title="Delete">🗑️</button>
      </div>`;
    } else {
      html += `<div class="entry">
        <span class="entry-icon">🤝</span>
        <div class="entry-main">
          <div class="entry-desc">Rozliczenie</div>
          <div class="entry-sub">${item.from} → ${item.to}</div>
        </div>
        <span class="entry-amount settle">${fmt(item.amount)} ${curLabel(item.currency)}</span>
        <button class="entry-del" data-del="settlements/${item.id}" title="Delete">🗑️</button>
      </div>`;
    }
  }
  el.innerHTML = html;

  el.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Usunąć ten wpis?')) return;
      const [col, id] = btn.dataset.del.split('/');
      await deleteDoc(doc(db, col, id));
    });
  });
}

// 50/50 is the norm now — only mention the split when an old entry deviates
function splitSuffix(e) {
  const m = e.shares['Marta'], r = e.shares['Rafał'];
  if (Math.abs(m - r) <= 0.01) return '';
  if (m === 0) return ` · wszystko na ${ACCUSATIVE['Rafał']}`;
  if (r === 0) return ` · wszystko na ${ACCUSATIVE['Marta']}`;
  return ` · Marta ${fmt(m)} / Rafał ${fmt(r)}`;
}

function formatDate(iso) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (iso === today) return 'Dzisiaj';
  if (iso === yesterday) return 'Wczoraj';
  return new Date(iso + 'T00:00:00').toLocaleDateString('pl-PL', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- init ----------
$('#f-date').value = new Date().toISOString().slice(0, 10);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
