import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, get, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const checkoutForm = document.getElementById('checkout-form');

let currentUser = null;
let cartDetails = [];
let totalAmount = 0;

// 1. Check Auth and Prefill form
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            const snapshot = await get(ref(db, "users/" + user.uid));
            if (snapshot.exists()) {
                const data = snapshot.val();
                document.getElementById('chk-name').value = data.username || '';
                document.getElementById('chk-phone').value = data.phone || '';
            }
        } catch (e) {
            console.error("Error fetching user details", e);
        }
    } else {
        alert("Please login to complete your checkout.");
        window.location.href = 'auth.html';
    }
});

// 2. Load Cart Items
async function loadCart() {
    const cartIds = JSON.parse(localStorage.getItem('cart')) || [];
    
    if (cartIds.length === 0) {
        cartItemsContainer.innerHTML = '<div class="text-center py-10 text-gray-500">Your cart is empty.</div>';
        return;
    }

    cartItemsContainer.innerHTML = '<div class="text-center py-4 text-gray-500">Fetching product details...</div>';
    cartDetails = [];
    totalAmount = 0;

    try {
        // Group identical items
        const itemCounts = {};
        cartIds.forEach(id => {
            itemCounts[id] = (itemCounts[id] || 0) + 1;
        });

        cartItemsContainer.innerHTML = '';
        
        for (const [id, quantity] of Object.entries(itemCounts)) {
            const snapshot = await get(ref(db, "products/" + id));
            if (snapshot.exists()) {
                const product = snapshot.val();
                product.id = id;
                product.quantity = quantity;
                cartDetails.push(product);
                
                const itemTotal = product.price * quantity;
                totalAmount += itemTotal;

                const div = document.createElement('div');
                div.className = "flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100";
                div.innerHTML = `
                    <div class="flex items-center gap-4">
                        <img src="${product.imageUrl || 'https://via.placeholder.com/60'}" class="w-16 h-16 object-cover rounded shadow-sm">
                        <div>
                            <h4 class="font-bold text-gray-900">${product.name}</h4>
                            <div class="text-sm text-gray-500">Qty: ${quantity} × Rs. ${product.price.toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="font-bold text-lg text-brand-dark">Rs. ${itemTotal.toFixed(2)}</div>
                `;
                cartItemsContainer.appendChild(div);
            }
        }
        
        cartTotalElement.textContent = `Rs. ${totalAmount.toFixed(2)}`;

    } catch (error) {
        console.error("Error loading cart products", error);
        cartItemsContainer.innerHTML = '<div class="text-red-500 py-4">Error loading products.</div>';
    }
}

loadCart();

// 3. Handle Checkout Form Submit (Direct Order Placement)
checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (cartDetails.length === 0) {
        alert("Your cart is empty!");
        return;
    }
    
    const submitBtn = document.getElementById('place-order-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
        
    const orderData = {
        source: 'Online',
        userId: currentUser.uid,
        customerName: document.getElementById('chk-name').value,
        customerPhone: document.getElementById('chk-phone').value,
        deliveryAddress: document.getElementById('chk-address').value,
        paymentMethod: 'Cash On Delivery',
        items: cartDetails.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        total: totalAmount,
        status: 'Pending',
        createdAt: new Date().toISOString()
    };

    try {
        await push(ref(db, "orders"), orderData);
        alert('Order placed successfully! Thank you for shopping with Royal Pallette.');
        
        // Clear Cart
        localStorage.removeItem('cart');
        
        // Redirect to home
        window.location.href = '../index.html';
    } catch (error) {
        console.error("Error saving order:", error);
        alert("An error occurred while saving your order.");
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Order';
    }
});
