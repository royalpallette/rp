import { db } from './firebase-config.js';
import { ref, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const posProducts = document.getElementById('pos-products');
const posCart = document.getElementById('pos-cart');
const posSubtotal = document.getElementById('pos-subtotal');
const posTotal = document.getElementById('pos-total');
const searchInput = document.getElementById('pos-search');

let productsData = [];
let cart = [];

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
        div.innerHTML = `
            <div class="h-32 bg-gray-200">
                <img src="${product.imageUrl || 'https://via.placeholder.com/150'}" class="w-full h-full object-cover">
            </div>
            <div class="p-3">
                <h3 class="text-sm font-bold text-gray-800 leading-tight mb-1 truncate">${product.name}</h3>
                <p class="text-xs text-gray-500 mb-2 truncate">${product.category}</p>
                <div class="text-brand-dark font-bold">Rs. ${product.price.toFixed(2)}</div>
            </div>
        `;
        posProducts.appendChild(div);
    });
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = productsData.filter(p => p.name.toLowerCase().includes(term));
    renderProducts(filtered);
});

function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
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

function renderCart() {
    posCart.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        posCart.innerHTML = '<div class="text-center py-10 text-gray-400 text-sm italic">Cart is empty</div>';
    } else {
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            const div = document.createElement('div');
            div.className = "flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm";
            div.innerHTML = `
                <div class="flex-1">
                    <h4 class="text-sm font-semibold text-gray-800 line-clamp-1">${item.name}</h4>
                    <div class="text-xs text-gray-500">Rs. ${item.price.toFixed(2)}</div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="flex items-center bg-gray-100 rounded-md">
                        <button onclick="updateQuantity('${item.id}', -1)" class="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-l-md">-</button>
                        <span class="w-6 text-center text-xs font-semibold">${item.quantity}</span>
                        <button onclick="updateQuantity('${item.id}', 1)" class="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-r-md">+</button>
                    </div>
                    <div class="font-bold text-sm text-gray-900 w-16 text-right">Rs. ${itemTotal.toFixed(0)}</div>
                </div>
            `;
            posCart.appendChild(div);
        });
    }

    posSubtotal.textContent = `Rs. ${total.toFixed(2)}`;
    posTotal.textContent = `Rs. ${total.toFixed(2)}`;
}

document.getElementById('clear-cart-btn').addEventListener('click', () => {
    if(confirm('Clear current order?')) {
        cart = [];
        renderCart();
    }
});

document.getElementById('checkout-btn').addEventListener('click', async () => {
    if (cart.length === 0) return alert('Cart is empty!');
    
    const btn = document.getElementById('checkout-btn');
    btn.disabled = true;
    btn.innerHTML = 'Processing...';

    const totalStr = posTotal.textContent.replace('Rs. ', '');
    const totalAmount = parseFloat(totalStr);

    const orderData = {
        source: 'POS',
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        total: totalAmount,
        status: 'Completed',
        createdAt: new Date().toISOString()
    };

    try {
        await push(ref(db, "orders"), orderData);
        alert('Payment successful & Order saved!');
        cart = [];
        renderCart();
    } catch (error) {
        console.error("Error creating order:", error);
        alert('Error processing order.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> Pay & Checkout`;
    }
});

// Expose to window for onclick handlers
window.updateQuantity = updateQuantity;
