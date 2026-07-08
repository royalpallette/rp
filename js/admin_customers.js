import { db } from './firebase-config.js';
import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { setupLocationDropdowns } from './sl_locations.js';

const customersList = document.getElementById('customers-list');
const searchInput = document.getElementById('search-customer');

let allCustomers = [];
let allOrders = [];
let allLoyalty = {};

// ===== MODAL CONTROLS =====
window.openAddCustModal = () => {
    const modal = document.getElementById('add-customer-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setupLocationDropdowns('new-cust-province', 'new-cust-district', 'new-cust-town', 'new-cust-zip');
};
window.closeAddCustModal = () => {
    const modal = document.getElementById('add-customer-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};
window.closeCustomerModal = () => {
    const modal = document.getElementById('customer-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// ===== SAVE CUSTOMER =====
window.saveNewCustomer = async () => {
    const btn = document.getElementById('save-cust-btn');
    const name = document.getElementById('new-cust-name').value.trim();
    
    const phone = document.getElementById('new-cust-phone').value.trim();
    const phone2 = document.getElementById('new-cust-phone2') ? document.getElementById('new-cust-phone2').value.trim() : '';
    const phone3 = document.getElementById('new-cust-phone3') ? document.getElementById('new-cust-phone3').value.trim() : '';
    
    const email = document.getElementById('new-cust-email').value.trim();
    const email2 = document.getElementById('new-cust-email2') ? document.getElementById('new-cust-email2').value.trim() : '';
    const email3 = document.getElementById('new-cust-email3') ? document.getElementById('new-cust-email3').value.trim() : '';
    
    const province = document.getElementById('new-cust-province') ? document.getElementById('new-cust-province').value : '';
    const district = document.getElementById('new-cust-district') ? document.getElementById('new-cust-district').value : '';
    const town = document.getElementById('new-cust-town') ? document.getElementById('new-cust-town').value : '';
    const zip = document.getElementById('new-cust-zip') ? document.getElementById('new-cust-zip').value.trim() : '';

    const address = document.getElementById('new-cust-address').value.trim();
    const address2 = document.getElementById('new-cust-address2') ? document.getElementById('new-cust-address2').value.trim() : '';
    const address3 = document.getElementById('new-cust-address3') ? document.getElementById('new-cust-address3').value.trim() : '';
    
    if (!name || !phone) return alert('Name and Phone 1 are required!');
    if (!province || !district || !town) return alert('Province, District, and Town are required!');

    btn.disabled = true;
    btn.textContent = 'Saving...';

    const newId = 'user_' + Date.now();
    try {
        await set(ref(db, 'users/' + newId), {
            id: newId,
            username: name,
            phone: phone,
            phone2: phone2,
            phone3: phone3,
            email: email,
            email2: email2,
            email3: email3,
            province: province,
            district: district,
            town: town,
            postalCode: zip,
            address: address,
            address2: address2,
            address3: address3,
            role: 'customer',
            createdAt: new Date().toISOString()
        });
        
        alert('Customer added!');
        window.closeAddCustModal();
        document.getElementById('new-cust-name').value = '';
        document.getElementById('new-cust-phone').value = '';
        if(document.getElementById('new-cust-phone2')) document.getElementById('new-cust-phone2').value = '';
        if(document.getElementById('new-cust-phone3')) document.getElementById('new-cust-phone3').value = '';
        document.getElementById('new-cust-email').value = '';
        if(document.getElementById('new-cust-email2')) document.getElementById('new-cust-email2').value = '';
        if(document.getElementById('new-cust-email3')) document.getElementById('new-cust-email3').value = '';
        if(document.getElementById('new-cust-province')) document.getElementById('new-cust-province').value = '';
        if(document.getElementById('new-cust-district')) document.getElementById('new-cust-district').value = '';
        if(document.getElementById('new-cust-town')) document.getElementById('new-cust-town').value = '';
        if(document.getElementById('new-cust-zip')) document.getElementById('new-cust-zip').value = '';
        document.getElementById('new-cust-address').value = '';
        if(document.getElementById('new-cust-address2')) document.getElementById('new-cust-address2').value = '';
        if(document.getElementById('new-cust-address3')) document.getElementById('new-cust-address3').value = '';
    } catch (e) {
        alert('Failed to save: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Customer';
    }
};

// ===== FETCH DATA =====
// 1. Fetch Orders
onValue(ref(db, 'orders'), (snapshot) => {
    allOrders = [];
    if (snapshot.exists()) {
        snapshot.forEach(s => {
            allOrders.push({ id: s.key, ...s.val() });
        });
    }
});

// 2. Fetch Loyalty
onValue(ref(db, 'loyalty_points'), (snapshot) => {
    allLoyalty = {};
    if (snapshot.exists()) {
        allLoyalty = snapshot.val();
    }
});

// 3. Fetch Customers
onValue(ref(db, 'users'), (snapshot) => {
    allCustomers = [];
    if (snapshot.exists()) {
        snapshot.forEach(s => {
            const user = s.val();
            if (user.role === 'customer' || user.role === 'Customer') {
                allCustomers.push({ id: s.key, ...user });
            }
        });
    }
    renderCustomers();
});

// ===== RENDER CUSTOMERS =====
function renderCustomers() {
    const term = searchInput.value.toLowerCase();
    const filtered = allCustomers.filter(c => {
        return (c.username || '').toLowerCase().includes(term) ||
               (c.phone || '').toLowerCase().includes(term) ||
               (c.email || '').toLowerCase().includes(term);
    });

    customersList.innerHTML = '';
    if (filtered.length === 0) {
        customersList.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No customers found.</td></tr>';
        return;
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    filtered.forEach(cust => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 border-b transition cursor-pointer";
        tr.onclick = () => openCustomer360(cust);
        
        const dateStr = cust.createdAt ? new Date(cust.createdAt).toLocaleDateString() : 'N/A';
        const email = cust.email || '-';
        const phone = cust.phone || '-';

        tr.innerHTML = `
            <td class="p-4 text-sm font-semibold text-gray-900">${cust.username}</td>
            <td class="p-4 text-sm text-gray-600">${phone}</td>
            <td class="p-4 text-sm text-gray-600">${email}</td>
            <td class="p-4 text-sm text-gray-500">${dateStr}</td>
            <td class="p-4 text-sm text-right">
                <button class="text-brand hover:text-brand-dark font-medium text-xs px-3 py-1 bg-brand bg-opacity-10 rounded-lg transition">View Profile</button>
            </td>
        `;
        customersList.appendChild(tr);
    });
}

searchInput.addEventListener('input', renderCustomers);

// ===== CUSTOMER 360 VIEW =====
window.openCustomer360 = (customer) => {
    const cModal = document.getElementById('customer-modal');
    cModal.classList.remove('hidden');
    cModal.classList.add('flex');
    
    document.getElementById('modal-cust-name').textContent = customer.username;
    document.getElementById('modal-cust-phone').textContent = customer.phone || 'No phone provided';
    document.getElementById('modal-cust-email').textContent = customer.email || 'No email provided';
    document.getElementById('modal-cust-address').textContent = customer.address || 'No address provided';
    
    const joined = customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'Unknown';
    document.getElementById('modal-cust-joined').textContent = 'Joined: ' + joined;

    // Loyalty Info
    const rawPhone = customer.phone ? customer.phone.replace(/[\s\-]/g, '') : null;
    let points = 0;
    let spent = 0;
    let tier = 'Bronze';
    
    if (rawPhone && allLoyalty[rawPhone]) {
        points = allLoyalty[rawPhone].points || 0;
        spent = allLoyalty[rawPhone].totalSpent || 0;
        tier = allLoyalty[rawPhone].tier || 'Bronze';
    }
    
    document.getElementById('modal-cust-points').textContent = points + ' Pts';
    document.getElementById('modal-cust-tier').textContent = tier;
    
    // Order History
    // A customer matches an order if the order.customer string contains their exact name or phone
    const myOrders = allOrders.filter(o => {
        if (!o.customer) return false;
        // order.customer usually formatted like "Name (Phone)"
        return o.customer.includes(customer.username) || (rawPhone && o.customer.includes(rawPhone));
    });

    // Calculate spent from actual orders if not available in loyalty
    if (spent === 0 && myOrders.length > 0) {
        spent = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    }
    
    document.getElementById('modal-cust-spent').textContent = 'Rs. ' + spent.toFixed(2);

    const historyBody = document.getElementById('modal-order-history');
    historyBody.innerHTML = '';
    
    if (myOrders.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-gray-500 italic">No orders found for this customer.</td></tr>';
        return;
    }

    myOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    myOrders.forEach(o => {
        const itemStr = o.items ? o.items.map(i => `${i.quantity}x ${i.name}`).join('<br>') : '-';
        const dateStr = new Date(o.createdAt).toLocaleString();
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-semibold text-gray-700">#${o.orderNo || o.id.substring(0,6)}</td>
            <td class="p-3 text-gray-500">${dateStr}</td>
            <td class="p-3 text-gray-600 text-xs">${itemStr}</td>
            <td class="p-3 font-bold text-right text-gray-900">Rs. ${(o.total || 0).toFixed(2)}</td>
        `;
        historyBody.appendChild(tr);
    });
};
