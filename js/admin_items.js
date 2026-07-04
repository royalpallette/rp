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

    const itemData = {
        name: document.getElementById('item-name').value,
        description: document.getElementById('item-desc').value,
        price: parseFloat(document.getElementById('item-price').value),
        imageUrl: document.getElementById('item-image').value,
        department: document.getElementById('item-dept').value,
        mainCategory: document.getElementById('item-main-cat').value,
        subCategory: document.getElementById('item-sub-cat').value,
        category: `${document.getElementById('item-dept').value} > ${document.getElementById('item-main-cat').value}`,
        isNew: true,
        createdAt: new Date().toISOString()
    };

    try {
        await push(ref(db, "products"), itemData);
        statusMsg.textContent = "Item added successfully!";
        statusMsg.className = "text-sm text-center text-green-600 mt-2 block";
        form.reset();
    } catch (error) {
        console.error("Error adding document: ", error);
        statusMsg.textContent = "Error adding item.";
        statusMsg.className = "text-sm text-center text-red-600 mt-2 block";
    } finally {
        btn.disabled = false;
        btn.textContent = "Add Item to DB";
        setTimeout(() => statusMsg.classList.add('hidden'), 3000);
    }
});

// Load Items Real-time
onValue(ref(db, "products"), (snapshot) => {
    inventoryList.innerHTML = '';
    if (!snapshot.exists()) {
        inventoryList.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500 text-sm">No items found.</td></tr>';
        return;
    }

    snapshot.forEach((childSnapshot) => {
        const item = childSnapshot.val();
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 border-b";
        tr.innerHTML = `
            <td class="p-3 text-sm font-medium text-gray-900">
                <div class="flex items-center gap-3">
                    <img src="${item.imageUrl || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded object-cover">
                    ${item.name}
                </div>
            </td>
            <td class="p-3 text-sm text-gray-500">${item.category}</td>
            <td class="p-3 text-sm text-gray-900">Rs. ${item.price.toFixed(2)}</td>
            <td class="p-3 text-sm text-right">
                <button onclick="deleteItem('${childSnapshot.key}')" class="text-red-500 hover:text-red-700 font-medium text-xs">Delete</button>
            </td>
        `;
        inventoryList.appendChild(tr);
    });
});

window.deleteItem = async function(id) {
    if(confirm("Are you sure you want to delete this item?")) {
        try {
            await remove(ref(db, "products/" + id));
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Failed to delete item");
        }
    }
}
