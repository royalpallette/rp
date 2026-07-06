import { db } from './firebase-config.js';
import { ref, onValue, push, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const posProducts = document.getElementById('pos-products');
const posCart = document.getElementById('pos-cart');
const posSubtotal = document.getElementById('pos-subtotal');
const posDiscount = document.getElementById('pos-discount');
const posDelivery = document.getElementById('pos-delivery');
const posTotal = document.getElementById('pos-total');
const searchInput = document.getElementById('pos-search');
const posCustomer = document.getElementById('pos-customer');

let productsData = [];
let cart = [];
let receiptSettings = {
    shopName: "Royal Pallette",
    shopAddress: "123 Beauty Lane, Colombo",
    shopPhone: "011-2345678",
    footerMsg: "Thank you for shopping with us!"
};

// Fetch Receipt Settings
onValue(ref(db, "settings/receipt"), (snapshot) => {
    if (snapshot.exists()) {
        receiptSettings = snapshot.val();
    }
});

// Fetch Customers
onValue(ref(db, "users"), (snapshot) => {
    const currentValue = posCustomer.value;
    posCustomer.innerHTML = '<option value="">Select Customer...</option><option value="Walk-in Customer">Walk-in Customer</option>';
    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();
            if (user.role === 'customer' || user.role === 'Customer') {
                const opt = document.createElement('option');
                opt.value = user.username + (user.phone ? ` (${user.phone})` : '');
                opt.textContent = `${user.username} ${user.email ? '- ' + user.email : ''}`;
                posCustomer.appendChild(opt);
            }
        });
    }
    // Restore selection if it still exists
    if (currentValue) posCustomer.value = currentValue;
});

// Cache for product images
let productImagesCache = {};
onValue(ref(db, "product_images"), (snapshot) => {
    productImagesCache = {};
    if (snapshot.exists()) {
        snapshot.forEach((child) => {
            productImagesCache[child.key] = child.val().imageBase64 || '';
        });
    }
    renderProducts(productsData); // Re-render if products are already loaded
});

// Fetch Products from Realtime Database
onValue(ref(db, "products"), (snapshot) => {
    productsData = [];
    snapshot.forEach((childSnapshot) => {
        productsData.push({ id: childSnapshot.key, ...childSnapshot.val() });
    });
    renderProducts(productsData);
});

function renderProducts(products) {
    posProducts.innerHTML = '';
    if (products.length === 0) {
        posProducts.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">No products available in inventory.</div>';
        return;
    }

    products.forEach(product => {
        const div = document.createElement('div');
        div.className = "bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:border-brand transition transform hover:-translate-y-1";
        div.onclick = () => addToCart(product);
        
        let imgSrc = 'https://via.placeholder.com/150';
        if (product.imageCode && productImagesCache[product.imageCode]) {
            imgSrc = productImagesCache[product.imageCode];
        } else if (product.imageUrl) {
            imgSrc = product.imageUrl;
        }

        div.innerHTML = `
            <div class="h-32 bg-gray-200">
                <img src="${imgSrc}" class="w-full h-full object-cover">
            </div>
            <div class="p-3">
                <div class="text-[10px] font-bold text-gray-400 mb-0.5">${product.productCode || ''}</div>
                <h3 class="text-sm font-bold text-gray-800 leading-tight mb-1 truncate">${product.name}</h3>
                <p class="text-xs text-gray-500 mb-2 truncate">${product.category}</p>
                <div class="text-brand-dark font-bold">Rs. ${parseFloat(product.price).toFixed(2)}</div>
            </div>
        `;
        posProducts.appendChild(div);
    });
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = productsData.filter(p => 
        p.name.toLowerCase().includes(term) || 
        (p.productCode && p.productCode.toLowerCase().includes(term))
    );
    renderProducts(filtered);
});

function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1, price: parseFloat(product.price) });
    }
    renderCart();
}

function updateQuantity(id, change) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.id !== id);
        }
        renderCart();
    }
}

function setQuantity(id, value) {
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
}

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
            div.className = "flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm";
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
    const total = (subtotal + delivery) - discount;

    posSubtotal.textContent = `Rs. ${subtotal.toFixed(2)}`;
    posTotal.textContent = `Rs. ${total.toFixed(2)}`;
}

posDiscount.addEventListener('input', renderCart);
posDelivery.addEventListener('input', renderCart);

document.getElementById('clear-cart-btn').addEventListener('click', () => {
    if(confirm('Clear current order?')) {
        cart = [];
        posDiscount.value = "0";
        posDelivery.value = "0";
        posCustomer.value = "";
        renderCart();
    }
});

// Add Customer Modal Handlers
document.getElementById('add-customer-btn').addEventListener('click', () => {
    const modal = document.getElementById('add-customer-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('new-cust-name').focus();
});

document.getElementById('cancel-cust-btn').addEventListener('click', () => {
    const modal = document.getElementById('add-customer-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
});

document.getElementById('save-cust-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-cust-name').value.trim();
    const email = document.getElementById('new-cust-email').value.trim();
    const phone = document.getElementById('new-cust-phone').value.trim();
    const modal = document.getElementById('add-customer-modal');
    const saveBtn = document.getElementById('save-cust-btn');
    
    if (!name) {
        document.getElementById('new-cust-name').focus();
        return alert('Name is required!');
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    
    try {
        // Use Firebase REST API (no SDK needed, works regardless of module state)
        const FB_URL = 'https://royal-pallette-default-rtdb.asia-southeast1.firebasedatabase.app';
        const res = await fetch(`${FB_URL}/users.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: name,
                email: email,
                phone: phone,
                role: 'customer',
                createdAt: new Date().toISOString()
            })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        document.getElementById('new-cust-name').value = '';
        document.getElementById('new-cust-email').value = '';
        document.getElementById('new-cust-phone').value = '';
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    } catch (error) {
        console.error(error);
        alert('Error adding customer: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Customer";
    }
});

// Checkout Process — open payment modal
document.getElementById('checkout-btn').addEventListener('click', () => {
    if (cart.length === 0) return alert('Cart is empty!');
    const customer = posCustomer.value;
    if (!customer) return alert('Please select a customer!');
    // Open the payment modal (defined in inline script)
    window.openPaymentModal();
});

// Exposed to pos.html inline script's doConfirmPayment()
window.processPayment = async function(method, amountGiven, changeDue) {
    const customer = posCustomer.value;
    const subtotalStr = posSubtotal.textContent.replace('Rs. ', '');
    const totalStr = posTotal.textContent.replace('Rs. ', '');
    const discountAmount = parseFloat(posDiscount.value) || 0;
    const deliveryAmount = parseFloat(posDelivery.value) || 0;
    const totalAmount = parseFloat(totalStr);

    try {
        // 1. Generate Incremental Order ID
        const ordersRef = ref(db, "orders");
        const snapshot = await get(ordersRef);
        let maxId = 0;
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const order = childSnapshot.val();
                if (order.orderNo) {
                    const num = parseInt(order.orderNo, 10);
                    if (num > maxId) maxId = num;
                }
            });
        }
        const newOrderNo = (maxId + 1).toString().padStart(4, '0');

        // 2. Save Order
        const orderData = {
            orderNo: newOrderNo,
            customer: customer,
            source: 'POS',
            paymentMethod: method,
            amountGiven: amountGiven,
            changeDue: changeDue,
            items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            subtotal: parseFloat(subtotalStr),
            discount: discountAmount,
            delivery: deliveryAmount,
            total: totalAmount,
            status: 'Completed',
            createdAt: new Date().toISOString()
        };

        await push(ordersRef, orderData);

        // 3. Print Receipt
        printReceipt(orderData);

        // 4. Reset POS
        alert('✅ Payment successful & Order saved!');
        window.closePaymentModal();
        cart = [];
        posDiscount.value = "0";
        posDelivery.value = "0";
        posCustomer.value = "";
        renderCart();
    } catch (error) {
        console.error("Error creating order:", error);
        alert('Error processing order: ' + error.message);
        throw error; // re-throw so doConfirmPayment can handle finally
    }
};

function printReceipt(orderData) {
    document.getElementById('receipt-shop-name').textContent = receiptSettings.shopName;
    document.getElementById('receipt-shop-address').textContent = receiptSettings.shopAddress;
    document.getElementById('receipt-shop-phone').textContent = "Tel: " + receiptSettings.shopPhone;
    document.getElementById('receipt-footer-msg').textContent = receiptSettings.footerMsg;
    
    document.getElementById('receipt-order-no').textContent = "#" + orderData.orderNo;
    document.getElementById('receipt-date').textContent = new Date(orderData.createdAt).toLocaleString();
    document.getElementById('receipt-customer').textContent = orderData.customer;
    
    const tbody = document.getElementById('receipt-items');
    tbody.innerHTML = '';
    orderData.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 2px 0;">${item.name}</td>
            <td style="text-align: center; padding: 2px 0;">${item.quantity}</td>
            <td style="text-align: right; padding: 2px 0;">Rs. ${(item.price * item.quantity).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('receipt-subtotal').textContent = "Rs. " + orderData.subtotal.toFixed(2);
    document.getElementById('receipt-discount').textContent = "Rs. " + orderData.discount.toFixed(2);
    
    if (orderData.delivery > 0) {
        document.getElementById('receipt-delivery-row').style.display = 'block';
        document.getElementById('receipt-delivery').textContent = "Rs. " + orderData.delivery.toFixed(2);
    } else {
        document.getElementById('receipt-delivery-row').style.display = 'none';
    }
    
    document.getElementById('receipt-total').textContent = "Rs. " + orderData.total.toFixed(2);

    document.getElementById('receipt-method').textContent = orderData.paymentMethod || 'Cash';
    document.getElementById('receipt-paid').textContent = "Rs. " + (orderData.amountGiven || orderData.total).toFixed(2);
    
    if (orderData.changeDue > 0) {
        document.getElementById('receipt-change-row').style.display = 'block';
        document.getElementById('receipt-change').textContent = "Rs. " + orderData.changeDue.toFixed(2);
    } else {
        document.getElementById('receipt-change-row').style.display = 'none';
    }

    const printContent = document.getElementById('print-receipt').innerHTML;
    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write('<html><head><title>Receipt</title></head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    
    // Give it a small delay to render before printing
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

// Expose to window for onclick handlers
window.updateQuantity = updateQuantity;
window.setQuantity = setQuantity;
