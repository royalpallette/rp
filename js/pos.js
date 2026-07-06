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

    const discount = parseFloat(posDiscount.value) || 0;
    const delivery = parseFloat(posDelivery.value) || 0;
    const total    = (subtotal + delivery) - discount;

    posSubtotal.textContent = `Rs. ${subtotal.toFixed(2)}`;
    posTotal.textContent    = `Rs. ${total.toFixed(2)}`;
}

posDiscount.addEventListener('input', renderCart);
posDelivery.addEventListener('input', renderCart);

document.getElementById('clear-cart-btn').addEventListener('click', () => {
    if (confirm('Clear current order?')) {
        cart = [];
        posDiscount.value = '0';
        posDelivery.value = '0';
        posCustomer.value = '';
        renderCart();
    }
});

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
        const orderData = {
            orderNo:       newOrderNo,
            customer:      customer,
            source:        'POS',
            paymentMethod: method,
            amountGiven:   amountGiven,
            changeDue:     changeDue,
            items:         cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            subtotal:      subtotal,
            discount:      discountAmount,
            delivery:      deliveryAmount,
            total:         total,
            status:        'Completed',
            createdAt:     new Date().toISOString()
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

        // 5. Reset
        alert('✅ Payment successful! Order #' + newOrderNo + ' saved.');
        window.closePaymentModal();
        cart = [];
        posDiscount.value = '0';
        posDelivery.value = '0';
        posCustomer.value = '';
        renderCart();

    } catch (error) {
        console.error('Order save error:', error);
        alert('❌ Failed to save order: ' + error.message);
        throw error;
    }
};

// ===== PRINT RECEIPT — A5 Invoice =====
function printReceipt(orderData) {
    document.getElementById('receipt-shop-address').textContent = receiptSettings.shopAddress;
    document.getElementById('receipt-shop-phone').textContent   = 'Tel: ' + receiptSettings.shopPhone;
    document.getElementById('receipt-footer-msg').textContent   = receiptSettings.footerMsg;

    document.getElementById('receipt-order-no').textContent = '#' + orderData.orderNo;
    document.getElementById('receipt-date').textContent     = new Date(orderData.createdAt).toLocaleString('en-GB');
    document.getElementById('receipt-customer').textContent = orderData.customer;
    document.getElementById('receipt-method').textContent   = orderData.paymentMethod || 'Cash';

    // Items table — with row number and unit price
    const tbody = document.getElementById('receipt-items');
    tbody.innerHTML = '';
    orderData.items.forEach((item, idx) => {
        const tr  = document.createElement('tr');
        const bg  = idx % 2 === 0 ? '#fff' : '#f9f9f9';
        tr.style.background = bg;
        tr.innerHTML = `
            <td style="padding:5px 8px;border-bottom:1px solid #eee;color:#666;">${idx + 1}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #eee;font-weight:600;">${item.name}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;">Rs. ${parseFloat(item.price).toFixed(2)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">Rs. ${(item.price * item.quantity).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('receipt-subtotal').textContent = 'Rs. ' + orderData.subtotal.toFixed(2);
    document.getElementById('receipt-discount').textContent = 'Rs. ' + orderData.discount.toFixed(2);

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

// ===== INIT — load everything =====
(async function init() {
    await Promise.all([
        loadReceiptSettings(),
        loadProductImages(),
        loadCustomers()
    ]);
    await loadProducts();
})();

// Expose to window for onclick handlers
window.updateQuantity = updateQuantity;
window.setQuantity    = setQuantity;
