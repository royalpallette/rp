import { db } from './firebase-config.js';
import { ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const form = document.getElementById('add-item-form');
const statusMsg = document.getElementById('status-msg');
const inventoryList = document.getElementById('inventory-list');

// Add Item
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('add-btn');
    btn.disabled = true;
    btn.textContent = "Adding...";

    // Get image URL from whichever tab is active
    // resolvedImageUrl is a global set by the inline script in items.html
    const imageUrl = window.resolvedImageUrl || '';

    const salePriceVal = document.getElementById('item-sale-price').value;

    const itemData = {
        name: document.getElementById('item-name').value.trim(),
        description: document.getElementById('item-desc').value.trim(),
        price: parseFloat(document.getElementById('item-price').value),
        salePrice: salePriceVal ? parseFloat(salePriceVal) : null,
        imageUrl: imageUrl,
        department: document.getElementById('item-dept').value.trim(),
        mainCategory: document.getElementById('item-main-cat').value.trim(),
        subCategory: document.getElementById('item-sub-cat').value.trim(),
        category: `${document.getElementById('item-dept').value.trim()} > ${document.getElementById('item-main-cat').value.trim()}`,
        isNew: true,
        createdAt: new Date().toISOString()
    };

    try {
        await push(ref(db, "products"), itemData);
        statusMsg.textContent = "✅ Item added successfully!";
        statusMsg.className = "text-sm text-center text-green-600 mt-2 block";
        form.reset();
        // Reset preview and resolvedImageUrl
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

// Load Items Real-time
onValue(ref(db, "products"), (snapshot) => {
    inventoryList.innerHTML = '';

    if (!snapshot.exists()) {
        inventoryList.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 text-sm">No items found. Add your first product!</td></tr>';
        return;
    }

    snapshot.forEach((childSnapshot) => {
        const item = childSnapshot.val();
        const key = childSnapshot.key;

        // Determine display image
        const imgSrc = item.imageUrl
            ? item.imageUrl
            : 'https://placehold.co/40x40/f3f4f6/9ca3af?text=No+Img';

        // Sale price badge
        const saleBadge = item.salePrice
            ? `<span class="text-brand-dark font-bold text-xs">Rs. ${parseFloat(item.salePrice).toFixed(2)}</span><br><span class="line-through text-gray-400 text-xs">Rs. ${parseFloat(item.price).toFixed(2)}</span>`
            : `<span class="text-gray-900 text-sm">Rs. ${parseFloat(item.price).toFixed(2)}</span>`;

        const salePriceCell = item.salePrice
            ? `<span class="inline-block bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">SALE</span>`
            : `<span class="text-gray-400 text-xs">—</span>`;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 border-b";
        tr.innerHTML = `
            <td class="p-3 text-sm font-medium text-gray-900">
                <div class="flex items-center gap-3">
                    <img src="${imgSrc}" class="w-10 h-10 rounded object-cover border border-gray-100" onerror="this.src='https://placehold.co/40x40/f3f4f6/9ca3af?text=Img'">
                    <div>
                        <div>${item.name}</div>
                        <div class="text-xs text-gray-400">${item.subCategory || ''}</div>
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
}, (error) => {
    console.error("DB Load Error:", error);
    inventoryList.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500 text-sm">❌ Failed to load items: ${error.message}</td></tr>`;
});

// Delete Item
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
