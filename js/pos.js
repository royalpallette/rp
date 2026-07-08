// ============================================================
// POS.JS — All Firebase calls use REST API (fetch), no SDK imports
// This is required because the file:// protocol blocks ES module
// cross-origin imports.
// ============================================================

const FB_URL = 'https://royal-pallette-default-rtdb.asia-southeast1.firebasedatabase.app';

const posProducts = document.getElementById('pos-products');
const posCart     = document.getElementById('pos-cart');
const posSubtotal = document.getElementById('pos-subtotal');
const posDiscount = document.getElementById('pos-discount');
const posDelivery = document.getElementById('pos-delivery');
const posTotal    = document.getElementById('pos-total');
const searchInput = document.getElementById('pos-search');
const posCustomer = document.getElementById('pos-customer');

let productsData       = [];
let cart               = [];
let productImagesCache = {};
let appliedPromo       = null; // { type, code, discountType, discountValue, discount, label }
let activeDeals        = [];
let appliedDeal        = null;
let receiptSettings    = {
    shopName:   'Royal Pallette',
    shopAddress:'123 Beauty Lane, Colombo',
    shopPhone:  '011-2345678',
    footerMsg:  'Thank you for shopping with us!'
};

// ===== LOAD RECEIPT SETTINGS =====
async function loadReceiptSettings() {
    try {
        const res  = await fetch(`${FB_URL}/settings/receipt.json`);
        const data = await res.json();
        if (data) receiptSettings = data;
        
        // Load custom logo
        const logoRes = await fetch(`${FB_URL}/settings/favicon.json`);
        const logoData = await logoRes.json();
        if (logoData) receiptSettings.logoUrl = logoData;
    } catch(e) { console.warn('Could not load receipt settings', e); }
}

// ===== LOAD CUSTOMERS INTO DROPDOWN =====
async function loadCustomers() {
    const current = posCustomer.value;
    posCustomer.innerHTML = '<option value="">Select Customer...</option><option value="Walk-in Customer">Walk-in Customer</option>';
    try {
        const res  = await fetch(`${FB_URL}/users.json`);
        const data = await res.json();
        if (data) {
            Object.values(data).forEach(user => {
                if (user.role === 'customer' || user.role === 'Customer') {
                    const opt = document.createElement('option');
                    opt.value       = user.username + (user.phone ? ` (${user.phone})` : '');
                    opt.textContent = user.username + (user.email ? ' - ' + user.email : '');
                    posCustomer.appendChild(opt);
                }
            });
        }
        if (current) posCustomer.value = current;
    } catch(e) { console.warn('Could not load customers', e); }
}

// ===== LOAD PRODUCT IMAGES CACHE =====
async function loadProductImages() {
    try {
        const res  = await fetch(`${FB_URL}/product_images.json`);
        const data = await res.json();
        if (data) {
            Object.entries(data).forEach(([key, val]) => {
                productImagesCache[key] = val.imageBase64 || '';
            });
        }
    } catch(e) { console.warn('Could not load product images', e); }
}

// ===== LOAD PRODUCTS =====
async function loadProducts() {
    posProducts.innerHTML = '<div class="col-span-full text-center py-20 text-gray-400">Loading products...</div>';
    try {
        const res  = await fetch(`${FB_URL}/products.json`);
        const data = await res.json();
        productsData = [];
        if (data) {
            Object.entries(data).forEach(([key, val]) => {
                productsData.push({ id: key, ...val });
            });
        }
        renderProducts(productsData);
    } catch(e) {
        posProducts.innerHTML = '<div class="col-span-full text-center py-10 text-red-500">❌ Failed to load products.</div>';
        console.error(e);
    }
}

// ===== RENDER PRODUCTS GRID =====
function renderProducts(products) {
    posProducts.innerHTML = '';
    if (products.length === 0) {
        posProducts.innerHTML = '<div class="col-span-full text-center py-20 text-gray-400">No products in inventory.</div>';
        return;
    }
    products.forEach(product => {
        let imgSrc = 'https://via.placeholder.com/150';
        if (product.imageCode && productImagesCache[product.imageCode]) {
            imgSrc = productImagesCache[product.imageCode];
        } else if (product.imageUrl) {
            imgSrc = product.imageUrl;
        }

        const div = document.createElement('div');
        div.className = 'bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:border-brand transition transform hover:-translate-y-1';
        div.onclick   = () => addToCart(product);
        div.innerHTML = `
            <div class="h-32 bg-gray-200">
                <img src="${imgSrc}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/150'">
            </div>
            <div class="p-3">
                <div class="text-[10px] font-bold text-gray-400 mb-0.5">${product.productCode || ''}</div>
                <h3 class="text-sm font-bold text-gray-800 leading-tight mb-1 truncate">${product.name}</h3>
                <p class="text-xs text-gray-500 mb-2 truncate">${product.category || ''}</p>
                <div class="text-brand-dark font-bold">Rs. ${parseFloat(product.price).toFixed(2)}</div>
            </div>
        `;
        posProducts.appendChild(div);
    });
}

// ===== SEARCH =====
searchInput.addEventListener('input', (e) => {
    const term     = e.target.value.toLowerCase();
    const filtered = productsData.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.productCode && p.productCode.toLowerCase().includes(term))
    );
    renderProducts(filtered);
});

// ===== CART FUNCTIONS =====
function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1, price: parseFloat(product.price) });
    }
    renderCart();
}

window.updateQuantity = function(id, change) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
        renderCart();
    }
};

window.setQuantity = function(id, value) {
    const item = cart.find(i => i.id === id);
    if (item) {
        const qty = parseFloat(value);
        if (isNaN(qty) || qty <= 0) {
            cart = cart.filter(i => i.id !== id);
        } else {
            item.quantity = qty;
        }
        renderCart();
    }
};

function renderCart() {
    posCart.innerHTML = '';
    let subtotal = 0;

    if (cart.length === 0) {
        posCart.innerHTML = '<div class="text-center py-10 text-gray-400 text-sm italic">Cart is empty</div>';
    } else {
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm';
            div.innerHTML = `
                <div class="flex-1 pr-2">
                    <h4 class="text-sm font-semibold text-gray-800 line-clamp-1">${item.name}</h4>
                    <div class="text-xs text-gray-500">Rs. ${item.price.toFixed(2)}</div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex items-center bg-gray-100 rounded-md border border-gray-200 overflow-hidden">
                        <button onclick="updateQuantity('${item.id}', -1)" class="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200">-</button>
                        <input type="number" step="0.01" min="0" value="${item.quantity}" onchange="setQuantity('${item.id}', this.value)" class="w-12 text-center text-xs font-semibold bg-transparent focus:outline-none border-x border-gray-200 h-6">
                        <button onclick="updateQuantity('${item.id}', 1)" class="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200">+</button>
                    </div>
                    <div class="font-bold text-sm text-gray-900 w-16 text-right">Rs. ${itemTotal.toFixed(2)}</div>
                </div>
            `;
            posCart.appendChild(div);
        });
    }

    const manualDiscount = parseFloat(posDiscount.value) || 0;
    const delivery       = parseFloat(posDelivery.value) || 0;
    const promoDiscount  = appliedPromo ? appliedPromo.discount : 0;

    // Evaluate Auto Deals
    evaluateAutoDeals(subtotal);
    const dealDiscount = appliedDeal && appliedDeal.discount ? appliedDeal.discount : 0;

    const total = Math.max(0, (subtotal + delivery) - manualDiscount - promoDiscount - dealDiscount);

    posSubtotal.textContent = `Rs. ${subtotal.toFixed(2)}`;
    posTotal.textContent    = `Rs. ${total.toFixed(2)}`;
}

// ===== AUTO DEALS LOGIC =====
function evaluateAutoDeals(subtotal) {
    appliedDeal = null;
    const dealBar = document.getElementById('auto-deal-bar');
    const dealLabel = document.getElementById('auto-deal-label');

    if (!activeDeals || activeDeals.length === 0 || cart.length === 0) {
        if (dealBar) dealBar.classList.add('hidden');
        return;
    }

    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Find the best applicable deal
    let bestDeal = null;
    let maxDiscount = 0;

    activeDeals.forEach(deal => {
        let isEligible = false;
        if (deal.buyType === 'any_qty' && totalQty >= deal.buyQty) isEligible = true;
        if (deal.buyType === 'min_spend' && subtotal >= deal.buyQty) isEligible = true;

        if (isEligible) {
            let discount = 0;
            if (deal.getType === 'discount_percent') {
                discount = subtotal * (deal.getVal / 100);
            } else if (deal.getType === 'discount_fixed') {
                discount = deal.getVal;
            } else if (deal.getType === 'free_voucher') {
                // Free voucher doesn't discount the cart, it generates on checkout
                discount = 0;
            }

            if (deal.getType === 'free_voucher') {
                // Prioritize free voucher if no discount deal is better (just taking the first valid one or comparing)
                if (!bestDeal || maxDiscount === 0) {
                    bestDeal = { ...deal, discount: 0 };
                }
            } else if (discount > maxDiscount) {
                maxDiscount = discount;
                bestDeal = { ...deal, discount: Math.min(discount, subtotal) };
            }
        }
    });

    if (bestDeal) {
        appliedDeal = bestDeal;
        if (dealBar) dealBar.classList.remove('hidden');
        if (bestDeal.getType === 'free_voucher') {
            dealLabel.textContent = `🎁 ${bestDeal.name} (Earn Rs. ${bestDeal.getVal} Voucher on Checkout!)`;
        } else {
            dealLabel.textContent = `🎁 ${bestDeal.name} (- Rs. ${bestDeal.discount.toFixed(2)})`;
        }
    } else {
        if (dealBar) dealBar.classList.add('hidden');
    }
}

posDiscount.addEventListener('input', renderCart);
posDelivery.addEventListener('input', renderCart);

document.getElementById('clear-cart-btn').addEventListener('click', () => {
    if (confirm('Clear current order?')) {
        cart = [];
        posDiscount.value = '0';
        posDelivery.value = '0';
        posCustomer.value = '';
        appliedPromo = null;
        appliedDeal = null;
        clearPromoUI();
        renderCart();
    }
});

// ===== PROMO / VOUCHER CODE =====
window.applyDiscountCode = async function() {
    const code    = (document.getElementById('pos-promo-input')?.value || '').trim().toUpperCase();
    const msgEl   = document.getElementById('promo-msg');
    const applyBtn = document.getElementById('apply-code-btn');
    if (!code) return showPromoMsg('Enter a promo or voucher code.', 'error');

    const subtotal = parseFloat(posSubtotal.textContent.replace('Rs. ', '')) || 0;
    if (subtotal <= 0) return showPromoMsg('Add items to cart first.', 'error');

    applyBtn.disabled = true;
    applyBtn.textContent = '...';

    try {
        const res = await validateDiscountCodeREST(code, subtotal);
        if (!res.valid) {
            showPromoMsg('❌ ' + res.reason, 'error');
        } else {
            appliedPromo = res;
            // Show applied bar
            const bar = document.getElementById('promo-applied-bar');
            bar.classList.remove('hidden');
            document.getElementById('promo-applied-label').textContent = `🎉 ${res.code} — ${res.label} (Rs. ${res.discount.toFixed(2)} off)`;
            document.getElementById('pos-promo-input').value = '';
            showPromoMsg(`✅ Code "${res.code}" applied! Rs. ${res.discount.toFixed(2)} discount.`, 'success');
            renderCart();
        }
    } catch(e) {
        showPromoMsg('❌ Error validating code.', 'error');
    } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply';
    }
};

window.clearPromoCode = function() {
    appliedPromo = null;
    clearPromoUI();
    renderCart();
};

function clearPromoUI() {
    const bar = document.getElementById('promo-applied-bar');
    if (bar) bar.classList.add('hidden');
    const inp = document.getElementById('pos-promo-input');
    if (inp) inp.value = '';
    const msg = document.getElementById('promo-msg');
    if (msg) msg.classList.add('hidden');
}

function showPromoMsg(msg, type) {
    const el = document.getElementById('promo-msg');
    if (!el) return;
    el.textContent = msg;
    el.className = `text-xs mt-1 font-medium ${type === 'error' ? 'text-red-500' : 'text-green-600'}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

// REST-based code validator (no ES module needed)
async function validateDiscountCodeREST(code, orderTotal) {
    code = code.trim().toUpperCase();

    // Check vouchers
    try {
        const vRes  = await fetch(`${FB_URL}/vouchers/${code}.json`);
        const v     = await vRes.json();
        if (v && v.code) {
            const expired  = v.expiresAt && new Date(v.expiresAt) < new Date();
            const depleted = (v.usedCount || 0) >= v.maxUses;
            if (!v.active || expired || depleted) return { valid: false, reason: 'Voucher is expired or used up.' };
            if (orderTotal < (v.minOrder || 0)) return { valid: false, reason: `Minimum order Rs. ${v.minOrder} required.` };
            const discount = v.type === 'fixed' ? v.value : (orderTotal * v.value / 100);
            return { valid: true, type: 'voucher', code, discountType: v.type, discountValue: v.value, discount: Math.min(discount, orderTotal), label: v.type === 'fixed' ? `Rs. ${v.value} off` : `${v.value}% off` };
        }
    } catch(e) {}

    // Check promo codes
    try {
        const pRes  = await fetch(`${FB_URL}/promo_codes/${code}.json`);
        const p     = await pRes.json();
        if (p && p.code) {
            const expired  = p.expiresAt && new Date(p.expiresAt) < new Date();
            const depleted = (p.usedCount || 0) >= p.maxUses;
            if (!p.active || expired || depleted) return { valid: false, reason: 'Promo code is expired or limit reached.' };
            if (orderTotal < (p.minOrder || 0)) return { valid: false, reason: `Minimum order Rs. ${p.minOrder} required.` };
            const discount = p.type === 'fixed' ? p.value : (orderTotal * p.value / 100);
            return { valid: true, type: 'promo', code, discountType: p.type, discountValue: p.value, discount: Math.min(discount, orderTotal), label: p.type === 'fixed' ? `Rs. ${p.value} off` : `${p.value}% off` };
        }
    } catch(e) {}

    return { valid: false, reason: 'Invalid code. Please check and try again.' };
}

// ===== CHECKOUT BUTTON — opens payment modal =====
document.getElementById('checkout-btn').addEventListener('click', () => {
    if (cart.length === 0)     return alert('Cart is empty!');
    if (!posCustomer.value)    return alert('Please select a customer!');
    window.openPaymentModal();
});

// ===== PROCESS PAYMENT (called by pos.html inline doConfirmPayment) =====
window.processPayment = async function(method, amountGiven, changeDue) {
    const customer       = posCustomer.value;
    const subtotal       = parseFloat(posSubtotal.textContent.replace('Rs. ', '')) || 0;
    const total          = parseFloat(posTotal.textContent.replace('Rs. ', ''))    || 0;
    const discountAmount = parseFloat(posDiscount.value) || 0;
    const deliveryAmount = parseFloat(posDelivery.value) || 0;

    try {
        // 1. Get existing orders to generate next order number
        const ordersRes  = await fetch(`${FB_URL}/orders.json`);
        const ordersData = await ordersRes.json();

        let maxId = 0;
        if (ordersData) {
            Object.values(ordersData).forEach(order => {
                if (order.orderNo) {
                    const num = parseInt(order.orderNo, 10);
                    if (num > maxId) maxId = num;
                }
            });
        }
        const newOrderNo = (maxId + 1).toString().padStart(4, '0');

        // 2. Build order object
        const promoDiscountAmount = appliedPromo ? appliedPromo.discount : 0;
        const promoCodeApplied    = appliedPromo ? appliedPromo.code    : null;
        const dealDiscountAmount  = (appliedDeal && appliedDeal.discount) ? appliedDeal.discount : 0;
        const dealNameApplied     = appliedDeal ? appliedDeal.name : null;

        const orderData = {
            orderNo:        newOrderNo,
            customer:       customer,
            source:         'POS',
            paymentMethod:  method,
            amountGiven:    amountGiven,
            changeDue:      changeDue,
            items:          cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            subtotal:       subtotal,
            discount:       discountAmount,
            promoDiscount:  promoDiscountAmount,
            promoCode:      promoCodeApplied,
            dealDiscount:   dealDiscountAmount,
            dealName:       dealNameApplied,
            delivery:       deliveryAmount,
            total:          total,
            status:         'Completed',
            createdAt:      new Date().toISOString()
        };

        // 3. Save via REST API (POST to /orders.json)
        const saveRes = await fetch(`${FB_URL}/orders.json`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(orderData)
        });
        if (!saveRes.ok) throw new Error('HTTP ' + saveRes.status);

        // 4. Print receipt
        printReceipt(orderData);

        // 5. Consume discount code & earn loyalty points
        if (appliedPromo) {
            try {
                const codePath = appliedPromo.type === 'voucher'
                    ? `vouchers/${appliedPromo.code}`
                    : `promo_codes/${appliedPromo.code}`;
                const codeRes  = await fetch(`${FB_URL}/${codePath}.json`);
                const codeData = await codeRes.json();
                if (codeData) {
                    await fetch(`${FB_URL}/${codePath}/usedCount.json`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify((codeData.usedCount || 0) + 1)
                    });
                }
            } catch(e) { console.warn('Could not update code usage', e); }
            appliedPromo = null;
            clearPromoUI();
        }

        // Deal: If Free Voucher, generate it now
        if (appliedDeal && appliedDeal.getType === 'free_voucher') {
            try {
                // Generate a random 6 char code
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                let code = 'RPVC-';
                for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
                
                // 30 days expiry
                const exp = new Date();
                exp.setDate(exp.getDate() + 30);
                
                const custNameOnly = customer.replace(/\s*\(.*\)/, '').trim();

                await fetch(`${FB_URL}/vouchers/${code}.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code, type: 'fixed', value: appliedDeal.getVal, minOrder: 0, maxUses: 1,
                        usedCount: 0, expiresAt: exp.toISOString().split('T')[0], assignedTo: custNameOnly,
                        active: true, createdAt: new Date().toISOString()
                    })
                });
                console.log(`✅ Generated free voucher ${code} for ${custNameOnly}`);
                alert(`🎁 Free Voucher Generated for customer: ${code}\nValue: Rs. ${appliedDeal.getVal}`);
            } catch(e) { console.warn('Could not generate free voucher', e); }
        }

        // Earn loyalty points for customer (Rs.100 = 1 point)
        try {
            const custVal = customer;
            // Extract phone — customer value format: "Name (07X-XXXXXX)" or raw phone
            const phoneMatch = custVal.match(/\((\d[\d\-\s]+)\)/);
            const phone = phoneMatch ? phoneMatch[1].replace(/[\s\-]/g, '') : null;
            const nameOnly = custVal.replace(/\s*\(.*\)/, '').trim();
            if (phone && phone.length >= 9) {
                const ptsToAdd = Math.floor(total / 100);
                if (ptsToAdd > 0) {
                    const lpRes  = await fetch(`${FB_URL}/loyalty_points/${phone}.json`);
                    const lpData = await lpRes.json();
                    const curPts  = lpData ? (lpData.points || 0) : 0;
                    const curSpent= lpData ? (lpData.totalSpent || 0) : 0;
                    const newPts  = curPts + ptsToAdd;
                    const newSpent= curSpent + total;
                    const tier    = newPts >= 4000 ? 'Platinum' : newPts >= 1500 ? 'Gold' : newPts >= 500 ? 'Silver' : 'Bronze';
                    await fetch(`${FB_URL}/loyalty_points/${phone}.json`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone, name: nameOnly, points: newPts, totalSpent: newSpent, tier, lastUpdated: new Date().toISOString() })
                    });
                    console.log(`✅ +${ptsToAdd} points for ${nameOnly} (${phone}). Total: ${newPts}`);
                }
            }
        } catch(e) { console.warn('Could not update loyalty points', e); }

        // 6. Reset
        alert('✅ Payment successful! Order #' + newOrderNo + ' saved.');
        window.closePaymentModal();
        cart = [];
        posDiscount.value = '0';
        posDelivery.value = '0';
        posCustomer.value = '';
        appliedDeal = null;
        clearPromoUI();
        renderCart();

    } catch (error) {
        console.error('Order save error:', error);
        alert('❌ Failed to save order: ' + error.message);
        throw error;
    }
};

// ===== PRINT RECEIPT — A5 Invoice =====
function printReceipt(orderData) {
    document.getElementById('receipt-shop-address').textContent = receiptSettings.shopAddress || '123 Beauty Lane, Colombo';
    document.getElementById('receipt-shop-phone').textContent   = 'Tel: ' + (receiptSettings.shopPhone || '011-2345678');
    document.getElementById('receipt-footer-msg').textContent   = receiptSettings.footerMsg || 'Thank you for shopping with us!';

    if (receiptSettings.logoUrl) {
        document.getElementById('default-invoice-logo').style.display = 'none';
        const cLogo = document.getElementById('custom-invoice-logo');
        cLogo.src = receiptSettings.logoUrl;
        cLogo.style.display = 'block';
    } else {
        document.getElementById('default-invoice-logo').style.display = 'block';
        document.getElementById('custom-invoice-logo').style.display = 'none';
    }

    document.getElementById('receipt-order-no').textContent = '#' + orderData.orderNo;
    document.getElementById('receipt-date').textContent     = new Date(orderData.createdAt).toLocaleString('en-GB');
    document.getElementById('receipt-customer').textContent = orderData.customer;
    document.getElementById('receipt-method').textContent   = orderData.paymentMethod || 'Cash';

    // Items table — with row number and unit price
    const tbody = document.getElementById('receipt-items');
    tbody.innerHTML = '';
    orderData.items.forEach((item, idx) => {
        const tr  = document.createElement('tr');
        const bg  = idx % 2 === 0 ? '#ffffff' : '#f2f2f2';
        tr.style.background = bg;
        tr.innerHTML = `
            <td style="padding:5px 8px;border-bottom:1px solid #cccccc;color:#000000;font-weight:600;">${idx + 1}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #cccccc;font-weight:600;color:#000000;">${item.name}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #cccccc;text-align:center;color:#000000;">${item.quantity}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #cccccc;text-align:right;color:#000000;">Rs. ${parseFloat(item.price).toFixed(2)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #cccccc;text-align:right;font-weight:700;color:#000000;">Rs. ${(item.price * item.quantity).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('receipt-subtotal').textContent = 'Rs. ' + orderData.subtotal.toFixed(2);
    document.getElementById('receipt-discount').textContent = 'Rs. ' + (orderData.discount || 0).toFixed(2);

    // Show promo/voucher discount row on receipt
    const promoRow = document.getElementById('receipt-promo-row');
    if (promoRow) {
        if (orderData.promoDiscount > 0) {
            promoRow.style.display = '';
            document.getElementById('receipt-promo-code').textContent  = orderData.promoCode || 'Code';
            document.getElementById('receipt-promo-amt').textContent   = '- Rs. ' + orderData.promoDiscount.toFixed(2);
        } else {
            promoRow.style.display = 'none';
        }
    }

    // Show auto deal discount row on receipt
    const dealRow = document.getElementById('receipt-deal-row');
    if (dealRow) {
        if (orderData.dealDiscount > 0) {
            dealRow.style.display = '';
            document.getElementById('receipt-deal-name').textContent = orderData.dealName || 'Deal Discount';
            document.getElementById('receipt-deal-amt').textContent  = '- Rs. ' + orderData.dealDiscount.toFixed(2);
        } else {
            dealRow.style.display = 'none';
        }
    }

    const delivRow = document.getElementById('receipt-delivery-row');
    if (orderData.delivery > 0) {
        delivRow.style.display = '';
        document.getElementById('receipt-delivery').textContent = 'Rs. ' + orderData.delivery.toFixed(2);
    } else {
        delivRow.style.display = 'none';
    }

    document.getElementById('receipt-total').textContent = 'Rs. ' + orderData.total.toFixed(2);
    document.getElementById('receipt-paid').textContent  = 'Rs. ' + (orderData.amountGiven || orderData.total).toFixed(2);

    const changeRow = document.getElementById('receipt-change-row');
    if (orderData.changeDue > 0) {
        changeRow.style.display = 'flex';
        document.getElementById('receipt-change').textContent = 'Rs. ' + orderData.changeDue.toFixed(2);
    } else {
        changeRow.style.display = 'none';
    }

    // Open A5 print window
    const invoiceHTML = document.getElementById('invoice-body').outerHTML;
    const printWindow = window.open('', '_blank', 'width=700,height=900');
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Invoice #${orderData.orderNo} — Royal Pallette</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page {
    size: A5 portrait;
    margin: 0;
  }
  body {
    width: 148mm;
    min-height: 210mm;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @media print {
    body { width: 148mm; }
    button { display: none !important; }
  }
</style>
</head>
<body>
${invoiceHTML}
<div style="text-align:center;padding:12px;font-family:Arial,sans-serif;font-size:11px;color:#888;border-top:1px solid #eee;margin-top:8px;" id="print-btn-bar">
  <button onclick="window.print()" style="background:#1a1a1a;color:#fff;border:none;padding:8px 28px;border-radius:6px;font-size:13px;cursor:pointer;margin-right:8px;">🖨️ Print</button>
  <button onclick="window.close()" style="background:#eee;color:#333;border:none;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;">Close</button>
</div>
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
}

async function loadDeals() {
    try {
        const res = await fetch(`${FB_URL}/deals.json`);
        const data = await res.json();
        if (data) {
            const now = new Date();
            activeDeals = Object.values(data).filter(d => {
                const expired = d.expiresAt && new Date(d.expiresAt) < now;
                return d.active && !expired;
            });
        }
    } catch(e) { console.warn('Could not load deals', e); }
}

// ===== INIT — load everything =====
(async function init() {
    await Promise.all([
        loadReceiptSettings(),
        loadProductImages(),
        loadCustomers(),
        loadDeals()
    ]);
    await loadProducts();
})();

// Expose to window for onclick handlers
window.updateQuantity = updateQuantity;
window.setQuantity    = setQuantity;
