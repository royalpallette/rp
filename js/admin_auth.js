// Admin Authentication Logic
const ADMIN_USER = "saveen";
const ADMIN_PASS = "@Saveen2014518";

// 1. Handle Login Form (on admin/login.html)
const adminLoginForm = document.getElementById('admin-login-form');
if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-username').value;
        const pass = document.getElementById('admin-password').value;
        const err = document.getElementById('admin-error');
        
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            sessionStorage.setItem('admin_logged_in', 'true');
            window.location.href = 'pos.html';
        } else {
            err.classList.remove('hidden');
        }
    });
}

// 2. Protect Admin Pages
// Call this function at the top of protected admin pages (pos, items, orders)
window.checkAdminAuth = function() {
    if (sessionStorage.getItem('admin_logged_in') !== 'true') {
        window.location.replace('login.html');
    }
}

// 3. Admin Logout
window.adminLogout = function() {
    sessionStorage.removeItem('admin_logged_in');
    window.location.replace('login.html');
}
