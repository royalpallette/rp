import { db } from './firebase-config.js';
import { ref, push, onValue, remove, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const form = document.getElementById('add-item-form');
const statusMsg = document.getElementById('status-msg');
const inventoryList = document.getElementById('inventory-list');

// Cache for product images (code -> base64)
let productImagesCache = {};

// Load product images into cache once
onValue(ref(db, "product_images"), (snapshot) => {
    productImagesCache = {};
    if (snapshot.exists()) {
        snapshot.forEach((child) => {
            productImagesCache[child.key] = child.val().imageBase64 || '';
        });
    }
    // Refresh inventory display when images load
    refreshInventory();
});

// Load Categories
onValue(ref(db, "settings/categories"), (snapshot) => {
    const deptSelect = document.getElementById('item-dept');
    const mainSelect = document.getElementById('item-main-cat');
    const subSelect = document.getElementById('item-sub-cat');

    if(!deptSelect || !mainSelect || !subSelect) return;

    const currDept = deptSelect.value;
    const currMain = mainSelect.value;
    const currSub = subSelect.value;

    deptSelect.innerHTML = '<option value="">Select Department...</option>';
    mainSelect.innerHTML = '<option value="">Select Main Category...</option>';
    subSelect.innerHTML = '<option value="">Select Sub Category...</option>';

    if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.dept) Object.values(data.dept).forEach(c => deptSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        if (data.main) Object.values(data.main).forEach(c => mainSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        if (data.sub) Object.values(data.sub).forEach(c => subSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`);
    }

    deptSelect.value = currDept;
    mainSelect.value = currMain;
    subSelect.value = currSub;
});


let productsSnapshot = null;

// ===== ADD ITEM =====
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('add-btn');
    btn.disabled = true;
    btn.textContent = "Adding...";

    const productCode = document.getElementById('item-product-code').value.trim();
    if (!productCode) {
        alert("Please enter a Product Code!");
        btn.disabled = false;
        btn.textContent = "Add Item to DB";
        return;
    }

    const imageUrl = window.resolvedImageUrl || '';
    let imageCode = document.getElementById('item-image-code')?.value?.trim() || '';
    const salePriceVal = document.getElementById('item-sale-price').value;

    // If an image was generated in the canvas editor, save it directly to `product_images`
    // to prevent the `products` node from bloating and loading very slowly.
    if (imageUrl && !imageCode) {
        try {
            await set(ref(db, `product_images/${productCode}`), {
                imageBase64: imageUrl,
                code: productCode,
                description: `Auto-saved for ${productCode}`,
                savedAt: new Date().toISOString()
            });
            imageCode = productCode;
        } catch (e) {
            console.error("Failed to upload image separately", e);
        }
    }

    const itemData = {
        productCode: productCode,
        name: document.getElementById('item-name').value.trim(),
        description: document.getElementById('item-desc').value.trim(),
        price: parseFloat(document.getElementById('item-price').value),
        salePrice: salePriceVal ? parseFloat(salePriceVal) : null,
        imageUrl: imageCode ? '' : imageUrl, // Only store url if we don't have an imageCode
        imageCode: imageCode, // Code linking to product_images
        department: document.getElementById('item-dept').value.trim(),
        mainCategory: document.getElementById('item-main-cat').value.trim(),
        subCategory: document.getElementById('item-sub-cat').value.trim(),
        category: `${document.getElementById('item-dept').value.trim()} > ${document.getElementById('item-main-cat').value.trim()}`,
        showOnWebsite: document.getElementById('item-show-web').checked,
        isNew: true,
        createdAt: new Date().toISOString()
    };

    try {
        await push(ref(db, "products"), itemData);
        statusMsg.textContent = "✅ Item added successfully!";
        statusMsg.className = "text-sm text-center text-green-600 mt-2 block";
        form.reset();
        window.resolvedImageUrl = '';
        const preview = document.getElementById('img-preview');
        if (preview) preview.classList.remove('show');
    } catch (error) {
        console.error("Error adding item:", error);
        statusMsg.textContent = "❌ Error: " + error.message;
        statusMsg.className = "text-sm text-center text-red-600 mt-2 block";
    } finally {
        btn.disabled = false;
        btn.textContent = "Add Item to DB";
        statusMsg.classList.remove('hidden');
        setTimeout(() => statusMsg.classList.add('hidden'), 4000);
    }
});

// ===== LOAD ITEMS =====
function getImageSrc(item) {
    // Priority: 1. imageCode from product_images DB, 2. imageUrl (URL/base64), 3. placeholder
    if (item.imageCode && productImagesCache[item.imageCode]) {
        return productImagesCache[item.imageCode];
    }
    if (item.imageUrl) {
        return item.imageUrl;
    }
    return 'https://placehold.co/40x40/f3f4f6/9ca3af?text=No+Img';
}

function refreshInventory() {
    if (!productsSnapshot) return;
    renderInventory(productsSnapshot);
}

function renderInventory(snapshot) {
    inventoryList.innerHTML = '';

    if (!snapshot.exists()) {
        inventoryList.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 text-sm">No items found. Add your first product!</td></tr>';
        return;
    }

    snapshot.forEach((childSnapshot) => {
        const item = childSnapshot.val();
        const key = childSnapshot.key;

        const imgSrc = getImageSrc(item);

        const saleBadge = item.salePrice
            ? `<span class="text-brand-dark font-bold text-xs">Rs. ${parseFloat(item.salePrice).toFixed(2)}</span><br><span class="line-through text-gray-400 text-xs">Rs. ${parseFloat(item.price).toFixed(2)}</span>`
            : `<span class="text-gray-900 text-sm">Rs. ${parseFloat(item.price).toFixed(2)}</span>`;

        const salePriceCell = item.salePrice
            ? `<span class="inline-block bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">SALE</span>`
            : `<span class="text-gray-400 text-xs">—</span>`;

        const imageCodeBadge = item.imageCode
            ? `<span class="text-xs text-blue-500">📷 ${item.imageCode}</span>`
            : '';

        const visibilityBadge = (item.showOnWebsite === false)
            ? `<span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium ml-2">POS Only</span>`
            : `<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium ml-2">Web & POS</span>`;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 border-b";
        tr.innerHTML = `
            <td class="p-3 text-sm font-medium text-gray-900">
                <div class="flex items-center gap-3">
                    <img src="${imgSrc}" class="w-10 h-10 rounded object-cover border border-gray-100" onerror="this.src='https://placehold.co/40x40/f3f4f6/9ca3af?text=Img'">
                    <div>
                        <div class="flex items-center text-xs font-bold text-gray-500 mb-0.5">Code: ${item.productCode || '-'}</div>
                        <div class="flex items-center">${item.name} ${visibilityBadge}</div>
                        <div class="text-xs text-gray-400">${item.subCategory || ''} ${imageCodeBadge}</div>
                    </div>
                </div>
            </td>
            <td class="p-3 text-sm text-gray-500">${item.category || '—'}</td>
            <td class="p-3">${saleBadge}</td>
            <td class="p-3">${salePriceCell}</td>
            <td class="p-3 text-sm text-right">
                <button onclick="deleteItem('${key}')" class="text-red-500 hover:text-red-700 font-medium text-xs border border-red-200 hover:border-red-400 px-2 py-1 rounded transition">Delete</button>
            </td>
        `;
        inventoryList.appendChild(tr);
    });
}

onValue(ref(db, "products"), (snapshot) => {
    productsSnapshot = snapshot;
    renderInventory(snapshot);
}, (error) => {
    console.error("DB Load Error:", error);
    inventoryList.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500 text-sm">❌ Failed to load items: ${error.message}<br><small>Check Firebase Database Rules — set .read and .write to true</small></td></tr>`;
});

// ===== DELETE ITEM =====
window.deleteItem = async function(id) {
    if (confirm("Are you sure you want to delete this item?")) {
        try {
            await remove(ref(db, "products/" + id));
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Failed to delete item: " + error.message);
        }
    }
}
