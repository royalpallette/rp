import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('toggle-auth');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    const signupFields = document.getElementById('signup-fields');
    const toggleText = document.getElementById('toggle-text');
    const errorMsg = document.getElementById('error-message');
    const googleBtn = document.getElementById('google-btn');

    const otpModal = document.getElementById('otp-modal');
    const otpInput = document.getElementById('otp-input');
    const otpError = document.getElementById('otp-error');
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    const cancelOtpBtn = document.getElementById('cancel-otp-btn');

    let isSignup = false;
    let pendingSignupData = null;
    let generatedOTP = "";
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYUjXNkd9evUAUUvPwmH4n4mOcwG_GUhV-eWelLvlq8G1-ErhIe3FuLo7J5SzYJPTf4Q/exec";

    if (!toggleBtn) return; // Guard clause


toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isSignup = !isSignup;
    if (isSignup) {
        formTitle.textContent = "Create an account";
        submitBtn.textContent = "Sign Up";
        signupFields.classList.remove('hidden');
        toggleText.textContent = "Already have an account?";
        toggleBtn.textContent = "Sign In";
    } else {
        formTitle.textContent = "Sign in to your account";
        submitBtn.textContent = "Sign In";
        signupFields.classList.add('hidden');
        toggleText.textContent = "Don't have an account?";
        toggleBtn.textContent = "Sign Up";
    }
    errorMsg.classList.add('hidden');
});

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email-address').value;
        const password = document.getElementById('password').value;
        errorMsg.classList.add('hidden');

        try {
            if (isSignup) {
                const username = document.getElementById('username').value;
                const phone = document.getElementById('phone').value;
                
                pendingSignupData = { email, password, username, phone };
                
                // Generate a real 6-digit OTP
                generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
                
                // Send OTP via Google Apps Script
                try {
                    fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        mode: 'no-cors', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: email, otp: generatedOTP })
                    });
                    console.log(`[Google Script] OTP request sent for ${email}`);
                    alert(`An OTP has been sent to your email (${email}).`);
                } catch (err) {
                    console.error("Error sending OTP:", err);
                    alert("Failed to trigger email script.");
                }
                
                // Show OTP Modal
                otpModal.classList.remove('hidden');
                otpInput.value = '';
                otpError.classList.add('hidden');
                
            } else {
                // Sign in directly
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = '../index.html';
            }
        } catch (error) {
            console.error("Auth Error:", error);
            errorMsg.textContent = error.message;
            errorMsg.classList.remove('hidden');
            alert("Error: " + error.message);
        }
    });

if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', async () => {
        const enteredCode = otpInput.value.trim();
        if (enteredCode === generatedOTP && pendingSignupData) {
            verifyOtpBtn.disabled = true;
            verifyOtpBtn.textContent = 'Verifying...';
            otpError.classList.add('hidden');

            try {
                // Create user in Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(auth, pendingSignupData.email, pendingSignupData.password);
                const user = userCredential.user;
                
                // Save additional user info in Realtime Database
                await set(ref(db, "users/" + user.uid), {
                    username: pendingSignupData.username,
                    email: pendingSignupData.email,
                    phone: pendingSignupData.phone,
                    role: 'customer',
                    createdAt: new Date().toISOString()
                });
                
                alert('Account created and verified successfully!');
                window.location.href = '../index.html';
            } catch (error) {
                console.error("Signup Error:", error);
                otpError.textContent = error.message;
                otpError.classList.remove('hidden');
                verifyOtpBtn.disabled = false;
                verifyOtpBtn.textContent = 'Verify & Create Account';
            }
        } else {
            otpError.classList.remove('hidden');
        }
    });
}

if (cancelOtpBtn) {
    cancelOtpBtn.addEventListener('click', () => {
        otpModal.classList.add('hidden');
        pendingSignupData = null;
        generatedOTP = "";
    });
}

    // Google Sign In
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                const result = await signInWithPopup(auth, provider);
                const user = result.user;
                
                await set(ref(db, "users/" + user.uid), {
                    username: user.displayName || "Google User",
                    email: user.email,
                    phone: user.phoneNumber || "",
                    role: 'customer',
                    createdAt: new Date().toISOString()
                });

                window.location.href = '../index.html';
            } catch (error) {
                console.error("Google Auth Error:", error);
                errorMsg.textContent = error.message;
                errorMsg.classList.remove('hidden');
                alert("Google Sign In Error: " + error.message + "\n\nMake sure Google Sign-in is enabled in Firebase Console and this domain is authorized.");
            }
        });
    }
});
