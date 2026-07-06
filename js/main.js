import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { get, ref } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Handle UI updates based on Auth State
const navLogin = document.getElementById('nav-login');
const navProfile = document.getElementById('nav-profile');

onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        if (navLogin) navLogin.classList.add('hidden');
        if (navProfile) navProfile.classList.remove('hidden');
    } else {
        // User is signed out
        if (navLogin) navLogin.classList.remove('hidden');
        if (navProfile) navProfile.classList.add('hidden');
    }
});

// Load Products on Homepage
const productGrid = document.getElementById('product-grid');
if (productGrid) {
    loadProducts();
}

async function loadProducts() {
    try {
        // Fetch product images first
        let productImagesCache = {};
        const imagesSnapshot = await get(ref(db, "product_images"));
        if (imagesSnapshot.exists()) {
            imagesSnapshot.forEach(child => {
                productImagesCache[child.key] = child.val().imageBase64 || '';
            });
        }

        const snapshot = await get(ref(db, "products"));
        productGrid.innerHTML = ''; // Clear loading state
        
        if (!snapshot.exists()) {
            productGrid.innerHTML = '<div class="col-span-full text-center py-20 text-gray-500">No products available yet.</div>';
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const docId = childSnapshot.key;
            const product = childSnapshot.val();

            if (product.showOnWebsite === false) {
                return; // Skip POS-only products
            }

            let imgSrc = 'https://via.placeholder.com/300x400?text=No+Image';
            if (product.imageCode && productImagesCache[product.imageCode]) {
                imgSrc = productImagesCache[product.imageCode];
            } else if (product.imageUrl) {
                imgSrc = product.imageUrl;
            }

            const productCard = document.createElement('div');
            productCard.className = 'bg-white rounded-xl overflow-hidden shadow-sm card-hover border border-gray-100';
            productCard.innerHTML = `
                <div class="h-64 bg-gray-200 relative">
                    <img src="${imgSrc}" alt="${product.name}" class="w-full h-full object-cover">
                    ${product.isNew ? '<span class="absolute top-2 left-2 bg-brand text-white text-xs font-bold px-2 py-1 rounded">NEW</span>' : ''}
                </div>
                <div class="p-5">
                    <div class="flex justify-between items-center mb-1">
                        <p class="text-xs text-brand font-medium tracking-wide uppercase">${product.category || 'Beauty'}</p>
                        <span class="text-[10px] text-gray-400 font-bold">${product.productCode || ''}</span>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-1">${product.name}</h3>
                    <p class="text-gray-500 text-sm mb-4 line-clamp-2">${product.description || ''}</p>
                    <div class="flex justify-between items-center mt-4">
                        <span class="text-xl font-bold text-brand-dark">Rs. ${product.price}</span>
                        <button onclick="addToCart('${docId}')" class="bg-dark text-white p-2 rounded-full hover:bg-brand transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            productGrid.appendChild(productCard);
        });
    } catch (error) {
        console.error("Error loading products: ", error);
        productGrid.innerHTML = '<div class="col-span-full text-center py-20 text-red-500">Failed to load products. Please check database connection.</div>';
    }
}

// Simple Cart functionality (Local Storage)
window.addToCart = function(productId) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.push(productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    alert('Item added to cart!');
}

function updateCartCount() {
    const countElement = document.getElementById('cart-count');
    if (countElement) {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        countElement.textContent = cart.length;
    }
}

updateCartCount();
