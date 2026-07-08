import { db } from './firebase-config.js';
import {
    ref, set, get, update, remove, onValue, push
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const FB_URL = 'https://royal-pallette-default-rtdb.asia-southeast1.firebasedatabase.app';

let allVoucherCount = 0;
let allPromoCount   = 0;
let allDealCount    = 0;

// =====================================================================
// TIER LOGIC
// =====================================================================
function getTier(points) {
    if (points >= 4000) return 'Platinum';
    if (points >= 1500) return 'Gold';
    if (points >= 500)  return 'Silver';
    return 'Bronze';
}
function getTierColor(tier) {
    return { Bronze: 'bronze', Silver: 'silver', Gold: 'gold', Platinum: 'platinum' }[tier] || 'bronze';
}
function getTierEmoji(tier) {
    return { Bronze: '🥉', Silver: '🥈', Gold: '🥇', Platinum: '💎' }[tier] || '🥉';
}
function getNextTierThreshold(points) {
    if (points < 500)  return { next: 'Silver',   threshold: 500,  progress: (points / 500) * 100 };
    if (points < 1500) return { next: 'Gold',     threshold: 1500, progress: ((points - 500) / 1000) * 100 };
    if (points < 4000) return { next: 'Platinum', threshold: 4000, progress: ((points - 1500) / 2500) * 100 };
    return { next: null, threshold: null, progress: 100 };
}

// =====================================================================
// POINTS TAB — Load & Render
// =====================================================================
let allPointsData = {};

onValue(ref(db, 'loyalty_points'), (snapshot) => {
    allPointsData = snapshot.exists() ? snapshot.val() : {};
    renderPointsTable(allPointsData);
    renderCardsGrid(allPointsData);
    updateHeaderStats();
});

function renderPointsTable(data) {
    const tbody = document.getElementById('points-table-body');
    if (!tbody) return;

    const entries = Object.entries(data);
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-gray-400">No loyalty members yet. Points are earned automatically on POS orders.</td></tr>';
        document.getElementById('stat-total-points').textContent = '0';
        return;
    }

    let totalPoints = 0;
    entries.sort((a, b) => (b[1].points || 0) - (a[1].points || 0));
    tbody.innerHTML = '';

    entries.forEach(([id, data]) => {
        const pts = data.points || 0;
        totalPoints += pts;
        const tier = getTier(pts);
        const tierColor = getTierColor(tier);
        const tierEmoji = getTierEmoji(tier);
        const { next, threshold, progress } = getNextTierThreshold(pts);
        const spent = data.totalSpent || 0;
        const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString('en-GB') : '—';

        const progressBar = next
            ? `<div class="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div class="progress-bar h-1.5 rounded-full bg-brand" style="width:${Math.min(progress, 100)}%"></div>
               </div>
               <p class="text-[10px] text-gray-400 mt-0.5">${pts} / ${threshold} pts to ${next}</p>`
            : `<div class="w-full bg-purple-200 rounded-full h-1.5 mt-1">
                <div class="h-1.5 rounded-full bg-purple-500" style="width:100%"></div>
               </div>
               <p class="text-[10px] text-purple-600 mt-0.5 font-bold">✨ Max Tier Reached!</p>`;

        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 hover:bg-gray-50';
        tr.dataset.name = (data.name || id).toLowerCase();
        tr.innerHTML = `
            <td class="px-5 py-3">
                <div class="font-semibold text-gray-800">${data.name || 'Customer'}</div>
                <div class="text-xs text-gray-500">${id}</div>
            </td>
            <td class="px-5 py-3 text-center">
                <span class="text-xs font-bold tier-${tierColor} px-2 py-0.5 rounded-full">${tierEmoji} ${tier}</span>
            </td>
            <td class="px-5 py-3 text-center">
                <span class="text-lg font-bold text-gray-800">${pts.toLocaleString()}</span>
                <span class="text-xs text-gray-500 block">points</span>
            </td>
            <td class="px-5 py-3 text-right">
                <span class="font-semibold text-gray-700">Rs. ${parseFloat(spent).toLocaleString()}</span>
            </td>
            <td class="px-5 py-3 min-w-[160px]">${progressBar}</td>
            <td class="px-5 py-3 text-right text-xs text-gray-500">${lastUpdated}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('stat-total-points').textContent = totalPoints.toLocaleString();
}

// Search/Filter points table
window.filterPointsTable = function() {
    const term = (document.getElementById('points-search')?.value || '').toLowerCase();
    document.querySelectorAll('#points-table-body tr').forEach(tr => {
        tr.style.display = (tr.dataset.name || '').includes(term) ? '' : 'none';
    });
};

// Manually adjust points
window.adjustPoints = async function() {
    const phone  = document.getElementById('adj-phone').value.trim();
    const adj    = parseInt(document.getElementById('adj-points').value);
    const reason = document.getElementById('adj-reason').value.trim();
    const msgEl  = document.getElementById('adj-msg');

    if (!phone) return showAdjMsg('Enter customer phone number.', 'error');
    if (isNaN(adj) || adj === 0) return showAdjMsg('Enter a non-zero point adjustment.', 'error');

    try {
        const snap = await get(ref(db, `loyalty_points/${phone}`));
        const current = snap.exists() ? (snap.val().points || 0) : 0;
        const newPts  = Math.max(0, current + adj);
        const newTier = getTier(newPts);

        await update(ref(db, `loyalty_points/${phone}`), {
            points: newPts,
            tier: newTier,
            lastUpdated: new Date().toISOString(),
            name: snap.exists() ? (snap.val().name || phone) : phone
        });

        // Log the adjustment
        await push(ref(db, `loyalty_log`), {
            phone, adj, reason: reason || 'Manual admin adjustment',
            before: current, after: newPts,
            by: 'admin', at: new Date().toISOString()
        });

        showAdjMsg(`✅ Points updated: ${current} → ${newPts} (${adj > 0 ? '+' : ''}${adj})`, 'success');
        document.getElementById('adj-phone').value = '';
        document.getElementById('adj-points').value = '';
        document.getElementById('adj-reason').value = '';
    } catch(e) {
        showAdjMsg('❌ Error: ' + e.message, 'error');
    }
};

function showAdjMsg(msg, type) {
    const el = document.getElementById('adj-msg');
    el.textContent = msg;
    el.className = `px-5 pb-4 text-sm font-medium ${type === 'error' ? 'text-red-500' : 'text-green-600'}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

// =====================================================================
// VOUCHERS TAB
// =====================================================================
window.createVoucher = async function() {
    const code     = document.getElementById('v-code').value.trim().toUpperCase();
    const type     = document.getElementById('v-type').value;
    const value    = parseFloat(document.getElementById('v-value').value);
    const minOrder = parseFloat(document.getElementById('v-minorder').value) || 0;
    const maxUses  = parseInt(document.getElementById('v-maxuses').value) || 1;
    const expiry   = document.getElementById('v-expiry').value;
    const customer = document.getElementById('v-customer').value.trim();
    const msgEl    = document.getElementById('v-msg');

    if (!code)   return showMsg(msgEl, 'Enter a voucher code.', 'error');
    if (!value || value <= 0) return showMsg(msgEl, 'Enter a valid discount value.', 'error');
    if (!expiry) return showMsg(msgEl, 'Select an expiry date.', 'error');
    if (type === 'percent' && value > 100) return showMsg(msgEl, 'Percentage cannot exceed 100.', 'error');

    // Check if code already exists
    const existing = await get(ref(db, `vouchers/${code}`));
    if (existing.exists()) return showMsg(msgEl, '⚠️ Code already exists! Use a different code.', 'error');

    await set(ref(db, `vouchers/${code}`), {
        code, type, value, minOrder, maxUses,
        usedCount: 0,
        expiresAt: expiry,
        assignedTo: customer,
        active: true,
        createdAt: new Date().toISOString()
    });

    showMsg(msgEl, `✅ Voucher "${code}" created!`, 'success');
    document.getElementById('v-code').value = '';
    document.getElementById('v-value').value = '';
    document.getElementById('v-customer').value = '';
    document.getElementById('v-minorder').value = '0';
    document.getElementById('v-maxuses').value = '1';
};

onValue(ref(db, 'vouchers'), (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : {};
    renderVouchers(data);
    updateHeaderStats();
});

function renderVouchers(data) {
    const container = document.getElementById('vouchers-list');
    const countEl   = document.getElementById('voucher-count');
    if (!container) return;

    const entries = Object.entries(data);
    allVoucherCount = entries.length;
    countEl.textContent = `${entries.length} vouchers`;
    updateHeaderStats();

    if (entries.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-gray-400">No vouchers created yet.</div>';
        return;
    }

    entries.sort((a, b) => new Date(b[1].createdAt || 0) - new Date(a[1].createdAt || 0));
    container.innerHTML = '';

    entries.forEach(([code, v]) => {
        const expired  = v.expiresAt && new Date(v.expiresAt) < new Date();
        const depleted = v.usedCount >= v.maxUses;
        const statusClass = !v.active || expired || depleted
            ? (expired ? 'badge-expired' : 'badge-used') : 'badge-active';
        const statusText  = expired ? 'Expired' : (!v.active || depleted ? 'Used Up' : 'Active');

        const discountLabel = v.type === 'fixed'
            ? `Rs. ${v.value} off`
            : `${v.value}% off`;

        const div = document.createElement('div');
        div.className = 'border border-gray-200 rounded-xl p-4 hover:shadow-sm transition bg-white';
        div.innerHTML = `
            <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                        <span class="voucher-code text-base text-gray-800">${code}</span>
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full ${statusClass}">${statusText}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
                        <span>💰 <b>${discountLabel}</b></span>
                        <span>📦 Min: Rs. ${v.minOrder || 0}</span>
                        <span>🔢 Uses: ${v.usedCount || 0} / ${v.maxUses}</span>
                        <span>📅 Exp: ${v.expiresAt || '—'}</span>
                        ${v.assignedTo ? `<span class="col-span-2">👤 For: ${v.assignedTo}</span>` : ''}
                    </div>
                </div>
                <button onclick="deleteVoucher('${code}')" class="text-red-400 hover:text-red-600 transition p-1" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.deleteVoucher = async function(code) {
    if (!confirm(`Delete voucher "${code}"?`)) return;
    await remove(ref(db, `vouchers/${code}`));
};

// =====================================================================
// PROMO CODES TAB
// =====================================================================
window.createPromo = async function() {
    const code     = document.getElementById('p-code').value.trim().toUpperCase();
    const type     = document.getElementById('p-type').value;
    const value    = parseFloat(document.getElementById('p-value').value);
    const minOrder = parseFloat(document.getElementById('p-minorder').value) || 0;
    const maxUses  = parseInt(document.getElementById('p-maxuses').value) || 100;
    const expiry   = document.getElementById('p-expiry').value;
    const msgEl    = document.getElementById('p-msg');

    if (!code)   return showMsg(msgEl, 'Enter a promo code.', 'error');
    if (!/^[A-Z0-9]+$/.test(code)) return showMsg(msgEl, 'Code must be letters & numbers only.', 'error');
    if (!value || value <= 0) return showMsg(msgEl, 'Enter a valid discount value.', 'error');
    if (!expiry) return showMsg(msgEl, 'Select an expiry date.', 'error');
    if (type === 'percent' && value > 100) return showMsg(msgEl, 'Percentage cannot exceed 100.', 'error');

    const existing = await get(ref(db, `promo_codes/${code}`));
    if (existing.exists()) return showMsg(msgEl, '⚠️ Promo code already exists!', 'error');

    await set(ref(db, `promo_codes/${code}`), {
        code, type, value, minOrder, maxUses,
        usedCount: 0,
        expiresAt: expiry,
        active: true,
        createdAt: new Date().toISOString()
    });

    showMsg(msgEl, `✅ Promo code "${code}" created!`, 'success');
    document.getElementById('p-code').value = '';
    document.getElementById('p-value').value = '';
    document.getElementById('p-minorder').value = '0';
    document.getElementById('p-maxuses').value = '100';
};

onValue(ref(db, 'promo_codes'), (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : {};
    renderPromos(data);
    updateHeaderStats();
});

function renderPromos(data) {
    const container = document.getElementById('promos-list');
    const countEl   = document.getElementById('promo-count');
    if (!container) return;

    const entries = Object.entries(data);
    allPromoCount = entries.length;
    countEl.textContent = `${entries.length} codes`;
    updateHeaderStats();

    if (entries.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-gray-400">No promo codes created yet.</div>';
        return;
    }

    entries.sort((a, b) => new Date(b[1].createdAt || 0) - new Date(a[1].createdAt || 0));
    container.innerHTML = '';

    entries.forEach(([code, p]) => {
        const expired  = p.expiresAt && new Date(p.expiresAt) < new Date();
        const depleted = p.usedCount >= p.maxUses;
        const statusClass = expired ? 'badge-expired' : (depleted ? 'badge-used' : 'badge-active');
        const statusText  = expired ? 'Expired' : (depleted ? 'Limit Reached' : 'Active');
        const discountLabel = p.type === 'fixed' ? `Rs. ${p.value} off` : `${p.value}% off`;
        const usagePct = Math.min(100, ((p.usedCount || 0) / p.maxUses) * 100);

        const div = document.createElement('div');
        div.className = 'border border-gray-200 rounded-xl p-4 hover:shadow-sm transition bg-white';
        div.innerHTML = `
            <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                        <span class="voucher-code text-base text-amber-700">${code}</span>
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full ${statusClass}">${statusText}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 mb-2">
                        <span>💰 <b>${discountLabel}</b></span>
                        <span>📦 Min: Rs. ${p.minOrder || 0}</span>
                        <span>📅 Exp: ${p.expiresAt || '—'}</span>
                        <span>🔢 ${p.usedCount || 0} / ${p.maxUses} uses</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-1.5">
                        <div class="h-1.5 rounded-full ${usagePct >= 100 ? 'bg-red-400' : 'bg-amber-400'}" style="width:${usagePct}%"></div>
                    </div>
                </div>
                <button onclick="deletePromo('${code}')" class="text-red-400 hover:text-red-600 transition p-1" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.deletePromo = async function(code) {
    if (!confirm(`Delete promo code "${code}"?`)) return;
    await remove(ref(db, `promo_codes/${code}`));
};

// =====================================================================
// LOYALTY CARDS TAB
// =====================================================================
function renderCardsGrid(data) {
    const grid = document.getElementById('cards-grid');
    if (!grid) return;

    const entries = Object.entries(data);
    if (entries.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-16 text-gray-400">No loyalty members yet. Points are earned automatically on POS checkouts.</div>';
        return;
    }

    entries.sort((a, b) => (b[1].points || 0) - (a[1].points || 0));
    grid.innerHTML = '';

    entries.forEach(([phone, d]) => {
        const pts  = d.points || 0;
        const tier = getTier(pts);
        const cls  = getTierColor(tier);
        const emoji = getTierEmoji(tier);
        const spent = d.totalSpent || 0;
        const { next, threshold, progress } = getNextTierThreshold(pts);

        const progressSection = next
            ? `<div class="mb-3">
                  <div class="flex justify-between text-xs opacity-75 mb-1">
                      <span>${pts} pts</span><span>${threshold} pts (${next})</span>
                  </div>
                  <div class="w-full bg-white bg-opacity-20 rounded-full h-1.5">
                      <div class="shimmer h-1.5 rounded-full bg-white bg-opacity-70" style="width:${Math.min(progress, 100)}%"></div>
                  </div>
              </div>`
            : `<div class="text-xs opacity-75 mb-3">✨ Maximum tier achieved!</div>`;

        const div = document.createElement('div');
        div.innerHTML = `
            <div class="loyalty-card ${cls}">
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <div class="text-xs font-bold opacity-70 tracking-widest uppercase mb-1">Royal Pallette</div>
                        <div class="text-lg font-bold">${d.name || 'Member'}</div>
                        <div class="text-xs opacity-75 mt-0.5">${phone}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-3xl">${emoji}</div>
                        <div class="text-xs font-bold tracking-widest mt-1">${tier.toUpperCase()}</div>
                    </div>
                </div>
                <div class="relative z-10">
                    ${progressSection}
                    <div class="flex justify-between items-end">
                        <div>
                            <div class="text-xs opacity-70">Points Balance</div>
                            <div class="text-2xl font-bold">${pts.toLocaleString()}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs opacity-70">Total Spent</div>
                            <div class="text-sm font-bold">Rs. ${parseFloat(spent).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(div);
    });
}

// =====================================================================
// DEALS TAB (AUTO PROMOTIONS)
// =====================================================================
window.toggleDealInputs = function() {
    // We could hide/show specific fields based on selection, but for now we keep it simple.
};

window.createDeal = async function() {
    const name    = document.getElementById('d-name').value.trim();
    const buyType = document.getElementById('d-buy-type').value;
    const buyQty  = parseFloat(document.getElementById('d-buy-qty').value) || 0;
    const getType = document.getElementById('d-get-type').value;
    const getVal  = parseFloat(document.getElementById('d-get-val').value) || 0;
    const expiry  = document.getElementById('d-expiry').value;
    const msgEl   = document.getElementById('d-msg');

    if (!name) return showMsg(msgEl, 'Enter a deal name.', 'error');
    if (buyQty <= 0) return showMsg(msgEl, 'Enter a valid condition amount.', 'error');
    if (getVal <= 0 && getType !== 'free_voucher') return showMsg(msgEl, 'Enter a valid reward value.', 'error');
    if (!expiry) return showMsg(msgEl, 'Select an expiry date.', 'error');

    const id = 'deal_' + Date.now();
    await set(ref(db, `deals/${id}`), {
        id, name, buyType, buyQty, getType, getVal,
        expiresAt: expiry,
        active: true,
        createdAt: new Date().toISOString()
    });

    showMsg(msgEl, `✅ Deal created successfully!`, 'success');
    document.getElementById('d-name').value = '';
    document.getElementById('d-buy-qty').value = '';
    document.getElementById('d-get-val').value = '';
};

onValue(ref(db, 'deals'), (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : {};
    renderDeals(data);
    updateHeaderStats();
});

function renderDeals(data) {
    const container = document.getElementById('deals-list');
    const countEl   = document.getElementById('deal-count');
    if (!container) return;

    const entries = Object.entries(data);
    allDealCount = entries.length;
    countEl.textContent = `${entries.length} deals`;
    updateHeaderStats();

    if (entries.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-gray-400">No active deals.</div>';
        return;
    }

    entries.sort((a, b) => new Date(b[1].createdAt || 0) - new Date(a[1].createdAt || 0));
    container.innerHTML = '';

    entries.forEach(([id, d]) => {
        const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
        const statusClass = expired ? 'badge-expired' : (d.active ? 'badge-active' : 'badge-used');
        const statusText  = expired ? 'Expired' : (d.active ? 'Active' : 'Disabled');

        let condText = d.buyType === 'any_qty' ? `Buy ${d.buyQty} items` : `Spend Rs. ${d.buyQty}`;
        let rewText = '';
        if (d.getType === 'discount_percent') rewText = `Get ${d.getVal}% off`;
        if (d.getType === 'discount_fixed') rewText = `Get Rs. ${d.getVal} off`;
        if (d.getType === 'free_voucher') rewText = `Get a Rs. ${d.getVal} Free Voucher`;

        const div = document.createElement('div');
        div.className = 'border border-gray-200 rounded-xl p-4 hover:shadow-sm transition bg-white';
        div.innerHTML = `
            <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="font-bold text-gray-800">${d.name}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${statusClass} uppercase">${statusText}</span>
                    </div>
                    <div class="text-sm text-gray-600 mb-1">🎯 <span class="font-medium">Condition:</span> ${condText}</div>
                    <div class="text-sm text-brand-dark font-semibold">🎁 <span class="font-medium text-gray-600">Reward:</span> ${rewText}</div>
                    <div class="text-xs text-gray-400 mt-2">Expires: ${d.expiresAt}</div>
                </div>
                <button onclick="deleteDeal('${id}')" class="text-red-400 hover:text-red-600 transition p-1" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.deleteDeal = async function(id) {
    if (!confirm('Delete this deal?')) return;
    await remove(ref(db, `deals/${id}`));
};

// =====================================================================
// HEADER STATS UPDATE
// =====================================================================
function updateHeaderStats() {
    const custCount = Object.keys(allPointsData).length;
    const custEl = document.getElementById('hdr-customers');
    const vEl    = document.getElementById('hdr-vouchers');
    const pEl    = document.getElementById('hdr-promos');
    if (custEl) custEl.textContent = custCount;
    if (vEl)    vEl.textContent    = allVoucherCount;
    if (pEl)    pEl.textContent    = allPromoCount;
}

// =====================================================================
// UTILITY
// =====================================================================
function showMsg(el, msg, type) {
    el.textContent = msg;
    el.className = `text-xs font-medium text-center py-2 ${type === 'error' ? 'text-red-500' : 'text-green-600'}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

// =====================================================================
// EXPORT: validate code (used by POS)
// =====================================================================
export async function validateDiscountCode(code, orderTotal) {
    code = code.trim().toUpperCase();

    // Check vouchers first
    const vSnap = await get(ref(db, `vouchers/${code}`));
    if (vSnap.exists()) {
        const v = vSnap.val();
        const expired  = v.expiresAt && new Date(v.expiresAt) < new Date();
        const depleted = (v.usedCount || 0) >= v.maxUses;
        if (!v.active || expired || depleted) return { valid: false, reason: 'Voucher is expired or used up.' };
        if (orderTotal < (v.minOrder || 0)) return { valid: false, reason: `Min order Rs. ${v.minOrder} required.` };
        const discount = v.type === 'fixed' ? v.value : (orderTotal * v.value / 100);
        return { valid: true, type: 'voucher', code, discountType: v.type, discountValue: v.value, discount: Math.min(discount, orderTotal), label: v.type === 'fixed' ? `Rs. ${v.value} off` : `${v.value}% off` };
    }

    // Check promo codes
    const pSnap = await get(ref(db, `promo_codes/${code}`));
    if (pSnap.exists()) {
        const p = pSnap.val();
        const expired  = p.expiresAt && new Date(p.expiresAt) < new Date();
        const depleted = (p.usedCount || 0) >= p.maxUses;
        if (!p.active || expired || depleted) return { valid: false, reason: 'Promo code is expired or limit reached.' };
        if (orderTotal < (p.minOrder || 0)) return { valid: false, reason: `Min order Rs. ${p.minOrder} required.` };
        const discount = p.type === 'fixed' ? p.value : (orderTotal * p.value / 100);
        return { valid: true, type: 'promo', code, discountType: p.type, discountValue: p.value, discount: Math.min(discount, orderTotal), label: p.type === 'fixed' ? `Rs. ${p.value} off` : `${p.value}% off` };
    }

    return { valid: false, reason: 'Invalid code. Please check and try again.' };
}

export async function consumeDiscountCode(type, code) {
    const dbPath = type === 'voucher' ? `vouchers/${code}` : `promo_codes/${code}`;
    const snap = await get(ref(db, dbPath));
    if (!snap.exists()) return;
    const current = snap.val().usedCount || 0;
    await update(ref(db, dbPath), { usedCount: current + 1 });
}

export async function addCustomerPoints(phone, name, orderTotal) {
    if (!phone || phone === 'Walk-in Customer' || !orderTotal) return;
    const pts = Math.floor(orderTotal / 100); // Rs.100 = 1 point
    if (pts <= 0) return;

    const snap = await get(ref(db, `loyalty_points/${phone}`));
    const current = snap.exists() ? snap.val() : { points: 0, totalSpent: 0 };

    const newPoints = (current.points || 0) + pts;
    const newSpent  = (current.totalSpent || 0) + orderTotal;
    const newTier   = getTier(newPoints);

    await set(ref(db, `loyalty_points/${phone}`), {
        phone,
        name: name || phone,
        points: newPoints,
        totalSpent: newSpent,
        tier: newTier,
        lastUpdated: new Date().toISOString()
    });
}
