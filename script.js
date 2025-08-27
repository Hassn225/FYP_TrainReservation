// ---------- UTIL ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const fmt = new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' });
const todayStr = () => new Date().toISOString().slice(0, 10);

const CNIC_RE = /^\d{5}-\d{7}-\d$/;
const PHONE_RE = /^(03)\d{2}-?\d{7}$/;

function uid(prefix = '') {
    return prefix + Math.random().toString(36).slice(2, 9).toUpperCase();
}

function toast(msg) {
    alert(msg); // minimalistic; could be upgraded to custom toasts
}

// ---------- STORAGE ----------
const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
    del(k) { localStorage.removeItem(k); }
};

// Keys
const K_USERS = 'pr_users';
const K_CURUSER = 'pr_current_user';
const K_TRAINS = 'pr_trains';
const K_BOOKINGS = 'pr_bookings';
// seats per train+date+class: pr_seats_<id>_<date>_<class>

// ---------- DATA (Seed) ----------
const CITIES = ['Karachi', 'Hyderabad', 'Rohri', 'Multan', 'Lahore', 'Rawalpindi', 'Peshawar', 'Quetta', 'Sukkur', 'Faisalabad'];

function seedTrains() {
    if (store.get(K_TRAINS)) return;
    const trains = [
        { id: 'PKR-1', name: 'Green Line Express', from: 'Karachi', to: 'Islamabad', via: ['Hyderabad', 'Rohri', 'Multan', 'Lahore', 'Rawalpindi'], dep: '20:00', arr: '15:30', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], classes: { 'Economy': 1800, 'Business': 3200, 'AC Sleeper': 5200 }, seatsPerCoach: 40 },
        { id: 'PKR-5', name: 'Khyber Mail', from: 'Karachi', to: 'Peshawar', via: ['Hyderabad', 'Rohri', 'Multan', 'Lahore', 'Rawalpindi'], dep: '22:15', arr: '19:45', days: ['Daily'], classes: { 'Economy': 1500, 'Business': 2900, 'AC Sleeper': 4800 }, seatsPerCoach: 40 },
        { id: 'PKR-9', name: 'Tezgam', from: 'Karachi', to: 'Rawalpindi', via: ['Hyderabad', 'Rohri', 'Multan', 'Lahore'], dep: '18:00', arr: '14:00', days: ['Daily'], classes: { 'Economy': 1600, 'Business': 3000, 'AC Sleeper': 5000 }, seatsPerCoach: 40 },
        { id: 'PKR-15', name: 'Jaffar Express', from: 'Quetta', to: 'Lahore', via: ['Sukkur', 'Multan', 'Faisalabad'], dep: '09:00', arr: '06:30', days: ['Mon', 'Wed', 'Fri'], classes: { 'Economy': 1400, 'Business': 2600, 'AC Sleeper': 4400 }, seatsPerCoach: 40 },
    ];
    store.set(K_TRAINS, trains);
}

// ---------- AUTH ----------
function currentUser() { return store.get(K_CURUSER, null); }
function setCurrentUser(email) { store.set(K_CURUSER, email); renderAuth(); }

function registerUser(data) {
    const users = store.get(K_USERS, []);
    if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
        throw new Error('Email already registered.');
    }
    users.push(data);
    store.set(K_USERS, users);
    setCurrentUser(data.email);
}

function login(email, pass) {
    const users = store.get(K_USERS, []);
    const u = users.find(x => x.email.toLowerCase() === email.toLowerCase() && x.pass === pass);
    if (!u) throw new Error('Invalid email or password');
    setCurrentUser(u.email);
}

function logout() { setCurrentUser(null); }

function renderAuth() {
    const box = $('#authBox');
    const email = currentUser();
    if (!email) {
        box.innerHTML = `
          <button class="btn btn-outline" data-nav="signin">Sign in</button>
          <button class="btn btn-primary" data-nav="signup">Create account</button>
        `;
    } else {
        const users = store.get(K_USERS, []);
        const u = users.find(x => x.email === email);
        box.innerHTML = `
        <span class="badge">Hi, ${u?.name?.split(' ')[0] || 'User'}</span>
        <button class="btn btn-outline" data-nav="bookings">My bookings</button>
        <button class="btn btn-danger" id="btnLogout">Logout</button>
        `;
        $('#btnLogout').onclick = () => { logout(); toast('Logged out'); go('home'); };
    }
    // rebind nav triggers
    $$('#authBox [data-nav]').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); go(b.dataset.nav); }));
    $('#userBadge').textContent = email || 'Guest';
}

// ---------- NAVIGATION ----------
function go(view) {
    // update menu active
    $$('#mainMenu button').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
    // show view
    $$('#main > section, main > section').forEach(sec => sec.classList.add('hidden'));
    const el = $(`#view-${view}`);
    if (el) el.classList.remove('hidden');
    if (view === 'trains') renderTrainsTable();
    if (view === 'bookings') renderBookings();
}

// Nav clicks
$$('#mainMenu [data-nav], footer [data-nav]').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); go(b.dataset.nav); }));

// ---------- HOME SEARCH ----------
function setupCityOptions() {
    const cities = Array.from(new Set([...CITIES, ...store.get(K_TRAINS, []).flatMap(t => [t.from, t.to, ...(t.via || [])])])).sort();
    [$('#homeFrom'), $('#homeTo'), $('#filterFrom'), $('#filterTo')].forEach(sel => {
        sel.innerHTML = '<option value="">Any</option>' + cities.map(c => `<option>${c}</option>`).join('');
    });
    $('#homeFrom').value = 'Karachi';
    $('#homeTo').value = 'Lahore';
    $('#homeDate').value = todayStr();
}

$('#homeSearchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = {
        from: $('#homeFrom').value,
        to: $('#homeTo').value,
        date: $('#homeDate').value,
        cls: $('#homeClass').value,
        pax: parseInt($('#homePassengers').value || '1', 10)
    };
    runSearch(q);
});

function runSearch(q) {
    const trains = store.get(K_TRAINS, []);
    const list = trains.filter(t => (!q.from || t.from === q.from || t.via.includes(q.from)) && (!q.to || t.to === q.to || t.via.includes(q.to)));
    $('#searchSummary').textContent = `${list.length} train(s) for ${q.from || 'Any'} → ${q.to || 'Any'} on ${q.date} • Class: ${q.cls} • Passengers: ${q.pax}`;
    const wrap = $('#searchResults');
    if (!list.length) { wrap.innerHTML = '<p class="muted">No trains match your search.</p>'; go('search'); return; }
    wrap.innerHTML = list.map(t => trainCard(t, q)).join('');
    // bind buttons
    $$('#searchResults .btn-book').forEach(btn => btn.addEventListener('click', () => startBooking(btn.dataset.id, q)));
    go('search');
}

function trainCard(t, q) {
    return `
        <div class="card" style="margin:10px 0;">
            <div class="row" style="justify-content:space-between; align-items:flex-start;">
                <div>
                    <div style="font-weight:800;">${t.name} <span class="muted">(${t.id})</span></div>
                    <div class="muted">${t.from} → ${t.to} • Dep ${t.dep} • Arr ${t.arr} • Days: ${t.days.join(', ')}</div>
                    <div class="mt-8">
                        ${Object.entries(t.classes).map(([c, p]) => `<span class="badge" style="margin-right:6px">${c}: ${fmt.format(p)}</span>`).join('')}
                    </div>
                </div>
                <div class="right" style="gap:10px">
                    <button class="btn btn-outline" onclick="showTrainInfo('${t.id}')">Details</button>
                    <button class="btn btn-primary btn-book" data-id="${t.id}">Book</button>
                </div>
            </div>
        </div>`;
}

function showTrainInfo(id) {
    const t = store.get(K_TRAINS, []).find(x => x.id === id);
    if (!t) return;
    $('#trainsTable').innerHTML = renderTrainInfoTable([t]);
    go('trains');
}

// ---------- TRAINS VIEW ----------
$('#clearFilters').addEventListener('click', () => { $('#filterFrom').value = ''; $('#filterTo').value = ''; renderTrainsTable(); });

function renderTrainsTable() {
    const from = $('#filterFrom').value;
    const to = $('#filterTo').value;
    let list = store.get(K_TRAINS, []);
    if (from) list = list.filter(t => t.from === from || t.via.includes(from));
    if (to) list = list.filter(t => t.to === to || t.via.includes(to));
    $('#trainsTable').innerHTML = renderTrainInfoTable(list);
}

function renderTrainInfoTable(list) {
    if (!list.length) return '<p class="muted">No trains available.</p>';
    return `
        <table>
            <thead>
                <tr>
                    <th>Train</th><th>Route</th><th>Timing</th><th>Days</th><th>Classes</th><th></th>
                </tr>
            </thead>
            <tbody>
                ${list.map(t => `
              <tr>
                <td><strong>${t.name}</strong><div class="muted">${t.id}</div></td>
                <td>${t.from} → ${t.to}<div class="muted">Via: ${t.via.join(', ')}</div></td>
                <td>Dep ${t.dep}<div class="muted">Arr ${t.arr}</div></td>
                <td>${t.days.join(', ')}</td>
                <td>${Object.entries(t.classes).map(([c, p]) => `<div>${c}: ${fmt.format(p)}</div>`).join('')}</td>
                <td class="right"><button class="btn btn-primary" onclick="startBooking('${t.id}', {date:'${todayStr()}', cls:'Economy', pax:1})">Book</button></td>
              </tr>`).join('')}
            </tbody>
        </table>`;
}

// ---------- BOOKING FLOW ----------
let bookingState = null; // {trainId, date, cls, pax, seats:[], amount}

function startBooking(trainId, q) {
    const t = store.get(K_TRAINS, []).find(x => x.id === trainId);
    if (!t) { toast('Train not found'); return; }
    bookingState = { trainId, date: q.date || todayStr(), cls: q.cls || 'Economy', pax: q.pax || 1, seats: [], amount: 0 };
    renderSeatStep();
    go('book');
}

function seatKey(trainId, date, cls) { return `pr_seats_${trainId}_${date}_${cls}`; }

function getBookedSeats(trainId, date, cls) { return new Set(store.get(seatKey(trainId, date, cls), [])); }
function setBookedSeats(trainId, date, cls, arr) { store.set(seatKey(trainId, date, cls), Array.from(new Set(arr))); }

function renderSeatStep() {
    setStep(1);
    const t = store.get(K_TRAINS, []).find(x => x.id === bookingState.trainId);
    const booked = getBookedSeats(bookingState.trainId, bookingState.date, bookingState.cls);
    const seatsCount = t.seatsPerCoach;
    const seatEls = Array.from({ length: seatsCount }, (_, i) => {
        const n = i + 1; const taken = booked.has(n);
        return `<div class="seat ${taken ? 'booked' : ''}" data-no="${n}">${n}</div>`;
    }).join('');
    const price = t.classes[bookingState.cls] || 0;
    const html = `
        <div class="row" style="justify-content:space-between; align-items:flex-start;">
            <div>
                <div style="font-weight:800;">${t.name} <span class="muted">(${t.id})</span></div>
                <div class="muted">${bookingState.date} • ${bookingState.cls} • ${t.from} → ${t.to} • Dep ${t.dep}</div>
            </div>
            <div class="chip"><span class="n">PKR</span> Base Fare ${fmt.format(price)} / seat</div>
        </div>
        <div class="mt-16">
            <div class="row"><strong>Select up to ${bookingState.pax} seat(s)</strong></div>
            <div class="seats mt-8" id="seatsGrid">${seatEls}</div>
            <div class="row mt-8" style="justify-content:space-between;">
                <div class="muted">Booked seats are greyed out. Click to select/deselect.</div>
                <div><strong>Selected:</strong> <span id="selSeats">None</span></div>
            </div>
            <div class="right mt-8"><button class="btn btn-primary" id="toPayment" disabled>Continue to payment</button></div>
        </div>`;
    $('#bookingPane').innerHTML = html;
    // bind selection
    $$('#seatsGrid .seat').forEach(s => s.addEventListener('click', () => {
        if (s.classList.contains('booked')) return;
        const n = parseInt(s.dataset.no, 10);
        const i = bookingState.seats.indexOf(n);
        if (i >= 0) { bookingState.seats.splice(i, 1); s.classList.remove('selected'); }
        else {
            if (bookingState.seats.length >= bookingState.pax) { toast(`Max ${bookingState.pax} seat(s)`); return; }
            bookingState.seats.push(n); s.classList.add('selected');
        }
        $('#selSeats').textContent = bookingState.seats.length ? bookingState.seats.join(', ') : 'None';
        $('#toPayment').disabled = bookingState.seats.length === 0;
    }));
    $('#toPayment').onclick = renderPaymentStep;
}

function setStep(n) {
    [$('#step1'), $('#step2'), $('#step3')].forEach((el, i) => el.classList.toggle('active', i === n - 1));
}

function renderPaymentStep() {
    setStep(2);
    const t = store.get(K_TRAINS, []).find(x => x.id === bookingState.trainId);
    const base = t.classes[bookingState.cls] * bookingState.seats.length;
    const tax = Math.round(base * 0.05);
    const total = base + tax;
    bookingState.amount = total;
    $('#bookingPane').innerHTML = `
        <div class="grid-2">
            <div>
                <h3>Passenger Details</h3>
                <form id="passengerForm" class="grid-2">
                    <div class="field"><label>Full name</label><input id="pName" required /></div>
                    <div class="field"><label>CNIC</label><input id="pCNIC" placeholder="12345-1234567-1" required /></div>
                    <div class="field"><label>Phone</label><input id="pPhone" placeholder="03xx-xxxxxxx" required /></div>
                    <div class="field"><label>Email</label><input type="email" id="pEmail" required /></div>
                </form>
                <div class="mt-16">
                    <h3>Payment</h3>
                    <div class="row" style="gap:6px;flex-wrap:wrap;">
                        <label class="chip"><input type="radio" name="pay" value="JazzCash" checked /> JazzCash</label>
                        <label class="chip"><input type="radio" name="pay" value="Easypaisa" /> Easypaisa</label>
                        <label class="chip"><input type="radio" name="pay" value="Card" /> Credit/Debit Card</label>
                    </div>
                    <div class="grid-2 mt-8" id="payFields"></div>
                </div>
            </div>
            <div>
                <h3>Summary</h3>
                <div class="card" style="padding:14px;">
                    <div style="font-weight:800;">${t.name} <span class="muted">(${t.id})</span></div>
                    <div class="muted">${t.from} → ${t.to} • ${bookingState.date} • ${bookingState.cls}</div>
                    <div class="mt-8"><strong>Seats:</strong> ${bookingState.seats.join(', ')}</div>
                    <div class="mt-8">
                        <div class="row" style="justify-content:space-between;"><div>Base fare</div><div>${fmt.format(base)}</div></div>
                        <div class="row" style="justify-content:space-between;"><div>Tax (5%)</div><div>${fmt.format(tax)}</div></div>
                        <hr style="border:none;border-top:1px solid var(--border);margin:10px 0;" />
                        <div class="row" style="justify-content:space-between;font-weight:900;"><div>Total</div><div>${fmt.format(total)}</div></div>
                    </div>
                    <div class="right mt-8"><button class="btn btn-primary" id="btnPay">Pay & Confirm</button></div>
                </div>
            </div>
        </div>`;

    function renderPayFields() {
        const method = document.querySelector('input[name="pay"]:checked').value;
        if (method === 'Card') {
            $('#payFields').innerHTML = `
            <div class="field"><label>Card number</label><input id="cardNo" placeholder="4111 1111 1111 1111" /></div>
            <div class="field"><label>Expiry</label><input id="cardExp" placeholder="MM/YY" /></div>
            <div class="field"><label>CVV</label><input id="cardCVV" placeholder="123" /></div>
            <div class="field"><label>Cardholder</label><input id="cardName" placeholder="As on card" /></div>`;
        } else {
            $('#payFields').innerHTML = `
            <div class="field"><label>Wallet number</label><input id="walletNo" placeholder="03xx-xxxxxxx" /></div>
            <div class="field"><label>Wallet PIN</label><input id="walletPin" type="password" placeholder="****" /></div>`;
        }
    }
    renderPayFields();
    $$('input[name="pay"]').forEach(r => r.addEventListener('change', renderPayFields));

    $('#btnPay').onclick = (e) => {
        e.preventDefault();
        // basic validation
        const name = $('#pName').value.trim();
        const cnic = $('#pCNIC').value.trim();
        const phone = $('#pPhone').value.trim();
        const email = $('#pEmail').value.trim();
        if (!name || !CNIC_RE.test(cnic) || !PHONE_RE.test(phone) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            toast('Please provide valid passenger details (CNIC 12345-1234567-1, phone 03xx-xxxxxxx).');
            return;
        }
        const method = document.querySelector('input[name="pay"]:checked').value;
        let payMasked = '';
        if (method === 'Card') {
            const no = ($('#cardNo').value || '').replace(/\s+/g, '');
            if (no.length < 12) return toast('Enter a valid card number');
            payMasked = `Card •••• ${no.slice(-4)}`;
        } else {
            const w = $('#walletNo').value || ''; const p = $('#walletPin').value || '';
            if (!PHONE_RE.test(w) || p.length < 4) return toast('Enter valid wallet details');
            payMasked = `${method} ${w.slice(0, 4)}•••••`;
        }
        // commit booking
        commitBooking({ name, cnic, phone, email, method, payMasked });
    };
}

function commitBooking(pass) {
    const t = store.get(K_TRAINS, []).find(x => x.id === bookingState.trainId);
    // Reserve seats
    const booked = getBookedSeats(bookingState.trainId, bookingState.date, bookingState.cls);
    bookingState.seats.forEach(n => booked.add(n));
    setBookedSeats(bookingState.trainId, bookingState.date, bookingState.cls, Array.from(booked));
    // Save booking
    const b = {
        pnr: uid('PNR-'),
        userEmail: currentUser(),
        trainId: t.id, trainName: t.name,
        from: t.from, to: t.to,
        date: bookingState.date, cls: bookingState.cls,
        seats: bookingState.seats.slice(),
        amount: bookingState.amount,
        passenger: pass,
        bookedAt: new Date().toISOString(),
        status: 'CONFIRMED'
    };
    const arr = store.get(K_BOOKINGS, []); arr.push(b); store.set(K_BOOKINGS, arr);
    renderConfirmStep(b);
}

function renderConfirmStep(b) {
    setStep(3);
    $('#bookingPane').innerHTML = `
        <div class="center">
            <div class="card" style="max-width:720px;">
                <h2 style="margin-top:0">Booking Confirmed</h2>
                <p>Your PNR is <strong>${b.pnr}</strong>. A confirmation has been sent to <strong>${b.passenger.email}</strong>.</p>
                <div class="grid-2 mt-8">
                    <div>
                        <div style="font-weight:800;">${b.trainName} <span class="muted">(${b.trainId})</span></div>
                        <div class="muted">${b.from} → ${b.to} • ${b.date} • ${b.cls}</div>
                        <div class="mt-8"><strong>Seats:</strong> ${b.seats.join(', ')}</div>
                        <div class="mt-8"><strong>Passenger:</strong> ${b.passenger.name} • ${b.passenger.cnic} • ${b.passenger.phone}</div>
                    </div>
                    <div>
                        <div class="card">
                            <div class="row" style="justify-content:space-between;"><div>Total paid</div><div><strong>${fmt.format(b.amount)}</strong></div></div>
                            <div class="row" style="justify-content:space-between;"><div>Payment</div><div>${b.passenger.method} (${b.passenger.payMasked})</div></div>
                        </div>
                    </div>
                </div>
                <div class="row right mt-16">
                    <button class="btn btn-outline" onclick="window.print()">Print Ticket</button>
                    <button class="btn btn-primary" onclick="go('bookings')">Go to My Bookings</button>
                </div>
            </div>
        </div>`;
}

// ---------- BOOKINGS VIEW ----------
function renderBookings() {
    const email = currentUser();
    const list = store.get(K_BOOKINGS, []).filter(b => !email || b.userEmail === email);
    if (!list.length) {
        $('#bookingsList').innerHTML = '<p class="muted">No bookings yet. Book a train to see it here.</p>';
        return;
    }
    $('#bookingsList').innerHTML = `
        <table>
            <thead><tr><th>PNR</th><th>Train</th><th>Route/Date</th><th>Seats</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
                ${list.map(b => `
              <tr>
                <td>${b.pnr}</td>
                <td>${b.trainName}<div class="muted">${b.trainId}</div></td>
                <td>${b.from} → ${b.to}<div class="muted">${b.date} • ${b.cls}</div></td>
                <td>${b.seats.join(', ')}</td>
                <td>${fmt.format(b.amount)}</td>
                <td>${b.status}</td>
                <td class="right">
                  <button class="btn btn-outline" onclick="printTicket('${b.pnr}')">Print</button>
                  ${b.status === 'CONFIRMED' ? `<button class="btn btn-danger" onclick="cancelBooking('${b.pnr}')">Cancel</button>` : ''}
                </td>
              </tr>`).join('')}
            </tbody>
        </table>`;
}

function cancelBooking(pnr) {
    const all = store.get(K_BOOKINGS, []);
    const i = all.findIndex(b => b.pnr === pnr);
    if (i < 0) return;
    const b = all[i];
    if (!confirm('Cancel this booking? Seats will be released.')) return;
    // release seats
    const booked = getBookedSeats(b.trainId, b.date, b.cls);
    b.seats.forEach(n => booked.delete(n));
    setBookedSeats(b.trainId, b.date, b.cls, Array.from(booked));
    // set status
    b.status = 'CANCELLED';
    all[i] = b; store.set(K_BOOKINGS, all);
    renderBookings();
    toast('Booking cancelled');
}

function printTicket(pnr) {
    const b = store.get(K_BOOKINGS, []).find(x => x.pnr === pnr);
    if (!b) return toast('Ticket not found');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Ticket ${b.pnr}</title><style>
            body{font - family:Arial;padding:20px}
            .box{border:1px solid #ddd;padding:16px;border-radius:10px}
            .row{display:flex;justify-content:space-between}
            .muted{color:#6b7280}
        </style></head><body>
                <h2>Pakistan Railways – E‑Ticket</h2>
                <div class="box">
                    <div class="row"><div><strong>PNR:</strong> ${b.pnr}</div><div><strong>Status:</strong> ${b.status}</div></div>
                    <p><strong>${b.trainName}</strong> (${b.trainId})<br />
                        ${b.from} → ${b.to} on ${b.date} • ${b.cls}<br />
                        Seats: ${b.seats.join(', ')}</p>
                    <p>Passenger: ${b.passenger.name} • ${b.passenger.cnic} • ${b.passenger.phone}</p>
                    <p>Paid: ${fmt.format(b.amount)} via ${b.passenger.method} (${b.passenger.payMasked})</p>
                </div>
                <p class="muted">Generated: ${new Date().toLocaleString()}</p>
                <script>window.print();<\/script>
            </body></html>`);
    w.document.close();
}

// ---------- SIGNUP / SIGNIN EVENTS ----------
$('#signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        name: $('#suName').value.trim(),
        email: $('#suEmail').value.trim(),
        phone: $('#suPhone').value.trim(),
        cnic: $('#suCNIC').value.trim(),
        pass: $('#suPass').value
    };
    if (!CNIC_RE.test(data.cnic)) return toast('Invalid CNIC. Use 12345-1234567-1');
    if (!PHONE_RE.test(data.phone)) return toast('Invalid phone. Use 03xx-xxxxxxx');
    if ($('#suPass').value !== $('#suPass2').value) return toast('Passwords do not match');
    try { registerUser(data); toast('Account created'); go('home'); }
    catch (err) { toast(err.message); }
});

$('#signinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    try { login($('#signinEmail').value.trim(), $('#signinPass').value); toast('Welcome back'); go('home'); }
    catch (err) { toast(err.message); }
});

// ---------- INIT ----------
function init() {
    seedTrains();
    setupCityOptions();
    renderAuth();
    $('#yearNow').textContent = new Date().getFullYear();
    // clicking the brand or menu
    $$('[data-nav]').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); go(b.dataset.nav); }));
}

init();
