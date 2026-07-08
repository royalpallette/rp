import { db } from './firebase-config.js';
import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const logsList = document.getElementById('logs-list');

// ===== FETCH LOGS =====
onValue(ref(db, 'admin_logs'), (snapshot) => {
    logsList.innerHTML = '';
    const logs = [];
    if (snapshot.exists()) {
        snapshot.forEach(s => {
            logs.push({ id: s.key, ...s.val() });
        });
    }

    if (logs.length === 0) {
        logsList.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">No activity logs found.</td></tr>';
        return;
    }

    // Sort newest first
    logs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 border-b transition";
        
        const dateObj = new Date(log.timestamp);
        const dateStr = dateObj.toLocaleDateString();
        const timeStr = dateObj.toLocaleTimeString();

        // Color code actions
        let actionClass = "text-gray-900";
        if (log.action.includes('Logged In')) actionClass = "text-green-600 font-semibold";
        if (log.action.includes('Logged Out')) actionClass = "text-red-500 font-semibold";

        tr.innerHTML = `
            <td class="p-4 text-sm text-gray-500">${dateStr} <span class="text-xs text-gray-400 ml-1">${timeStr}</span></td>
            <td class="p-4 text-sm font-semibold text-gray-800">${log.user || 'Admin'}</td>
            <td class="p-4 text-sm ${actionClass}">${log.action}</td>
        `;
        logsList.appendChild(tr);
    });
});

// ===== CLEAR LOGS =====
window.clearLogs = async () => {
    if(!confirm("Are you sure you want to delete all activity logs? This cannot be undone.")) return;
    
    try {
        await set(ref(db, 'admin_logs'), null);
        alert("All logs cleared successfully!");
    } catch (e) {
        alert("Failed to clear logs: " + e.message);
    }
};
