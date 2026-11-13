
/* ==========================================
   KUSH NEUPANE WEBSITE - AUTHENTICATION
   Firebase Compatibility SDK
========================================== */

(function () {
    "use strict";

    const FIREBASE_VERSION = "10.12.2";

    // Load Firebase SDK if it is not already loaded.
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(
                `script[src="${src}"]`
            );

            if (existing) {
                if (existing.dataset.loaded === "true") {
                    resolve();
                    return;
                }

                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener("error", reject, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.onload = () => {
                script.dataset.loaded = "true";
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function initializeAuthentication() {
        try {
            if (!window.firebaseConfig) {
                throw new Error(
                    "Firebase configuration was not found. Load firebase-config.js before auth.js."
                );
            }

            const base =
                `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

            await loadScript(`${base}/firebase-app-compat.js`);
            await loadScript(`${base}/firebase-auth-compat.js`);
            await loadScript(`${base}/firebase-firestore-compat.js`);

            const firebase = window.firebase;

            if (!firebase.apps.length) {
                firebase.initializeApp(window.firebaseConfig);
            }

            const auth = firebase.auth();
            const db = firebase.firestore();

            await auth.setPersistence(
                firebase.auth.Auth.Persistence.LOCAL
            );

            // Make authentication services available to other page scripts.
            window.siteAuth = {
                auth,
                db,

                getCurrentUser: () => auth.currentUser,

                async isCreator() {
                    const user = auth.currentUser;

                    if (!user) return false;

                    const token = await user.getIdTokenResult(true);
                    return token.claims.creator === true;
                }
            };

            createAuthenticationInterface(auth, db);

        } catch (error) {
            console.error("Authentication initialization failed:", error);
        }
    }

    function createAuthenticationInterface(auth, db) {

        // Do not create duplicate interfaces.
        if (document.getElementById("siteAuthButton")) return;

        const style = document.createElement("style");

        style.textContent = `
            #siteAuthButton {
                position: fixed;
                top: 14px;
                right: 20px;
                z-index: 9998;
                padding: 10px 17px;
                border: 1px solid rgba(255,255,255,.3);
                border-radius: 12px;
                color: white;
                background: rgba(15,10,35,.88);
                backdrop-filter: blur(12px);
                font-size: 14px;
                cursor: pointer;
            }

            #siteAuthOverlay {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 16px;
                background: rgba(0,0,0,.78);
                backdrop-filter: blur(8px);
            }

            #siteAuthModal {
                width: 100%;
                max-width: 410px;
                max-height: 90vh;
                overflow-y: auto;
                position: relative;
                padding: 27px;
                border: 1px solid rgba(160,120,255,.4);
                border-radius: 18px;
                color: white;
                background: #11101f;
                box-shadow: 0 15px 55px rgba(0,0,0,.6);
                font-family: Arial, sans-serif;
            }

            #siteAuthModal h2 {
                margin: 0 0 20px;
                text-align: center;
                font-size: 23px;
            }

            #siteAuthModal input,
            #siteAuthModal select {
                width: 100%;
                box-sizing: border-box;
                margin: 7px 0;
                padding: 12px;
                border: 1px solid rgba(255,255,255,.2);
                border-radius: 9px;
                outline: none;
                color: white;
                background: #201d32;
                font-size: 14px;
            }

            #siteAuthModal select option {
                color: white;
                background: #201d32;
            }

            #siteAuthModal button {
                width: 100%;
                margin-top: 10px;
                padding: 12px;
                border: none;
                border-radius: 9px;
                color: white;
                background: linear-gradient(110deg,#5935a8,#245cba);
                font-size: 14px;
                cursor: pointer;
            }

            #siteAuthModal button:disabled {
                opacity: .6;
                cursor: wait;
            }

            #siteAuthModal .auth-secondary {
                background: #29263b;
            }

            #siteAuthModal .auth-close {
                position: absolute;
                top: 10px;
                right: 12px;
                width: auto;
                margin: 0;
                padding: 5px 10px;
                background: transparent;
                font-size: 22px;
            }

            #siteAuthModal .auth-switch {
                margin-top: 17px;
                text-align: center;
                color: #c7b7ff;
                font-size: 13px;
                cursor: pointer;
            }

            #siteAuthMessage {
                min-height: 18px;
                margin-top: 12px;
                color: #ffb7b7;
                text-align: center;
                font-size: 13px;
                overflow-wrap: anywhere;
            }

            #siteAuthModal .auth-note {
                color: #b9b5c9;
                font-size: 12px;
                line-height: 1.5;
                text-align: center;
            }

            #siteAuthModal .auth-profile {
                line-height: 1.8;
                overflow-wrap: anywhere;
            }

            @media(max-width:480px) {
                #siteAuthButton {
                    top: 10px;
                    right: 12px;
                }

                #siteAuthModal {
                    padding: 23px 18px;
                }
            }
        `;

        document.head.appendChild(style);

        const button = document.createElement("button");
        button.id = "siteAuthButton";
        button.textContent = "Login / Profile";
        document.body.appendChild(button);

        const overlay = document.createElement("div");
        overlay.id = "siteAuthOverlay";

        overlay.innerHTML = `
            <div id="siteAuthModal">
                <button class="auth-close" id="siteAuthClose"
                    aria-label="Close">&times;</button>

                <div id="siteAuthContent"></div>

                <div id="siteAuthMessage" role="status"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        const content = document.getElementById("siteAuthContent");
        const message = document.getElementById("siteAuthMessage");

        function showMessage(text, success = false) {
            message.textContent = text;
            message.style.color = success ? "#9be5b0" : "#ffb7b7";
        }

        function openModal() {
            overlay.style.display = "flex";
            message.textContent = "";

            if (auth.currentUser) {
                showProfile();
            } else {
                showLogin();
            }
        }

        function closeModal() {
            overlay.style.display = "none";
        }

        button.addEventListener("click", openModal);

        document.getElementById("siteAuthClose")
            .addEventListener("click", closeModal);

        overlay.addEventListener("click", event => {
            if (event.target === overlay) closeModal();
        });

        function showLogin() {
            content.innerHTML = `
                <h2>Welcome Back</h2>

                <form id="authLoginForm">
                    <input id="authLoginEmail" type="email"
                        placeholder="Email address" required>

                    <input id="authLoginPassword" type="password"
                        placeholder="Password" required>

                    <button type="submit">Login</button>
                </form>

                <button class="auth-secondary" id="authGoogle">
                    Continue with Google
                </button>

                <div class="auth-switch" id="authForgot">
                    Forgot password?
                </div>

                <div class="auth-switch" id="authShowSignup">
                    Don't have an account? Create one
                </div>
            `;

            document.getElementById("authLoginForm")
                .addEventListener("submit", async event => {
                    event.preventDefault();

                    const submit = event.submitter;
                    submit.disabled = true;
                    showMessage("Signing in...");

                    try {
                        await auth.signInWithEmailAndPassword(
                            document.getElementById("authLoginEmail").value.trim(),
                            document.getElementById("authLoginPassword").value
                        );

                        showMessage("Login successful.", true);
                        showProfile();
                    } catch (error) {
                        showMessage(error.message);
                    } finally {
                        submit.disabled = false;
                    }
                });

            document.getElementById("authGoogle")
                .addEventListener("click", async event => {
                    const btn = event.currentTarget;
                    btn.disabled = true;

                    try {
                        const provider =
                            new firebase.auth.GoogleAuthProvider();

                        await auth.signInWithPopup(provider);

                        showMessage("Google sign-in successful.", true);
                        showProfile();
                    } catch (error) {
                        showMessage(error.message);
                    } finally {
                        btn.disabled = false;
                    }
                });

            document.getElementById("authForgot")
                .addEventListener("click", async () => {
                    const email =
                        document.getElementById("authLoginEmail").value.trim();

                    if (!email) {
                        showMessage("Enter your email address first.");
                        return;
                    }

                    try {
                        await auth.sendPasswordResetEmail(email);
                        showMessage("Password reset email sent.", true);
                    } catch (error) {
                        showMessage(error.message);
                    }
                });

            document.getElementById("authShowSignup")
                .addEventListener("click", showSignup);
        }

        function showSignup() {
            content.innerHTML = `
                <h2>Create Account</h2>

                <form id="authSignupForm">
                    <input id="authFirstName" type="text"
                        placeholder="First name" maxlength="50" required>

                    <input id="authLastName" type="text"
                        placeholder="Last name" maxlength="50" required>

                    <input id="authAge" type="number"
                        placeholder="Age" min="1" max="120" required>

                    <select id="authGender" required>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                    </select>

                    <input id="authSignupEmail" type="email"
                        placeholder="Email address" required>

                    <input id="authSignupPassword" type="password"
                        placeholder="Password (minimum 6 characters)"
                        minlength="6" required>

                    <input id="authConfirmPassword" type="password"
                        placeholder="Confirm password" minlength="6" required>

                    <button type="submit">Create Account</button>
                </form>

                <div class="auth-switch" id="authShowLogin">
                    Already have an account? Login
                </div>
            `;

            document.getElementById("authSignupForm")
                .addEventListener("submit", async event => {
                    event.preventDefault();

                    const submit = event.submitter;
                    submit.disabled = true;

                    const firstName =
                        document.getElementById("authFirstName").value.trim();

                    const lastName =
                        document.getElementById("authLastName").value.trim();

                    const age = Number(
                        document.getElementById("authAge").value
                    );

                    const gender =
                        document.getElementById("authGender").value;

                    const email =
                        document.getElementById("authSignupEmail").value.trim();

                    const password =
                        document.getElementById("authSignupPassword").value;

                    const confirmPassword =
                        document.getElementById("authConfirmPassword").value;

                    if (password !== confirmPassword) {
                        showMessage("Passwords do not match.");
                        submit.disabled = false;
                        return;
                    }

                    if (!Number.isInteger(age) || age < 1 || age > 120) {
                        showMessage("Please enter a valid age.");
                        submit.disabled = false;
                        return;
                    }

                    showMessage("Creating your account...");

                    try {
                        const result =
                            await auth.createUserWithEmailAndPassword(
                                email,
                                password
                            );

                        const user = result.user;
                        const fullName = `${firstName} ${lastName}`;

                        await user.updateProfile({
                            displayName: fullName
                        });

                        await db.collection("users")
                            .doc(user.uid)
                            .set({
                                firstName,
                                lastName,
                                displayName: fullName,
                                email: user.email,
                                age,
                                gender,
                                createdAt:
                                    firebase.firestore.FieldValue.serverTimestamp()
                            });

                        await user.sendEmailVerification();

                        showMessage(
                            "Account created. Please verify your email. A verification link has been sent.",
                            true
                        );

                        showProfile();

                    } catch (error) {
                        showMessage(error.message);
                    } finally {
                        submit.disabled = false;
                    }
                });

            document.getElementById("authShowLogin")
                .addEventListener("click", showLogin);
        }

        async function showProfile() {
            const user = auth.currentUser;

            if (!user) {
                showLogin();
                return;
            }

            content.innerHTML = `
                <h2>Your Profile</h2>
                <div class="auth-profile" id="authProfileDetails">
                    Loading profile...
                </div>
                <button id="authLogout">Logout</button>
            `;

            try {
                const token = await user.getIdTokenResult(true);
                const creator = token.claims.creator === true;

                const doc = await db.collection("users")
                    .doc(user.uid).get();

                const profile = doc.exists ? doc.data() : {};

                const details =
                    document.getElementById("authProfileDetails");

                details.textContent =
                    `Name: ${profile.displayName || user.displayName || "Not provided"}\n` +
                    `Email: ${user.email || "Not available"}\n` +
                    `Age: ${profile.age ?? "Not provided"}\n` +
                    `Gender: ${profile.gender || "Not provided"}\n` +
                    `Account: ${creator ? "Creator" : "Normal User"}\n` +
                    `Email verified: ${user.emailVerified ? "Yes" : "No"}`;

                details.style.whiteSpace = "pre-line";

                if (creator) {
                    const creatorText = document.createElement("p");
                    creatorText.textContent = "Creator access is enabled.";
                    creatorText.style.color = "#bca6ff";
                    details.appendChild(creatorText);
                }

            } catch (error) {
                showMessage("Could not load profile: " + error.message);
            }

            document.getElementById("authLogout")
                .addEventListener("click", async () => {
                    try {
                        await auth.signOut();
                        showMessage("You have logged out.", true);
                        showLogin();
                    } catch (error) {
                        showMessage(error.message);
                    }
                });
        }

        auth.onAuthStateChanged(async user => {
            if (user) {
                button.textContent = "Profile";
            } else {
                button.textContent = "Login / Profile";
            }

            window.dispatchEvent(
                new CustomEvent("creator-auth-changed", {
                    detail: { user }
                })
            );

            if (overlay.style.display === "flex") {
                if (user) {
                    showProfile();
                } else {
                    showLogin();
                }
            }
        });
    }

    // Wait until the page is ready before creating the interface.
    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeAuthentication,
            { once: true }
        );
    } else {
        initializeAuthentication();
    }

})();
