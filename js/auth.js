import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendEmailVerification
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

    let isSignup = false;

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
            submitBtn.disabled = true;
            submitBtn.textContent = "Processing...";

            if (isSignup) {
                const username = document.getElementById('username').value;
                const phone = document.getElementById('phone').value;
                
                // Create user in Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Save additional user info in Realtime Database
                await set(ref(db, "users/" + user.uid), {
                    username: username,
                    email: email,
                    phone: phone,
                    role: 'customer',
                    createdAt: new Date().toISOString()
                });

                // Send Firebase Email Verification
                await sendEmailVerification(user);
                
                alert('Account created successfully! An email verification link has been sent to ' + email + '. Please check your inbox (and spam folder) to verify your account.');
                window.location.href = '../index.html';
                
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
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isSignup ? "Sign Up" : "Sign In";
        }
    });

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
