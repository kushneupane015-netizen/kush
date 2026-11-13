
/* ==========================================
   KUSH NEUPANE WEBSITE - AUTHENTICATION
   Firebase Compatibility SDK
   Final Authentication Version
========================================== */

(function () {
    "use strict";

    const FIREBASE_VERSION = "10.12.2";
    const SCRIPT_TIMEOUT = 15000;

    let suppressAuthRender = false;
    let authInitialized = false;

    // ==========================================
    // FIREBASE SDK LOADER
    // ==========================================

    function loadScript(src, isReady) {
        if (isReady()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            let script = document.querySelector(
                `script[src="${src}"]`
            );

            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error(
                    "Firebase SDK loading timed out: " + src
                ));
            }, SCRIPT_TIMEOUT);

            function cleanup() {
                clearTimeout(timeout);
                script.removeEventListener("load", onLoad);
                script.removeEventListener("error", onError);
            }

            function onLoad() {
                if (isReady()) {
                    script.dataset.loaded = "true";
                    cleanup();
                    resolve();
                } else {
                    cleanup();
                    reject(new Error(
                        "Firebase SDK failed to initialize: " + src
                    ));
                }
            }

            function onError() {
                cleanup();
                reject(new Error(
                    "Could not load Firebase SDK: " + src
                ));
            }

            if (script) {
                if (script.dataset.loaded === "true" || script.readyState === "complete") {
                    cleanup();
                    reject(new Error(
                        "Firebase SDK script exists but its service is unavailable: " + src
                    ));
                    return;
                }

                script.addEventListener("load", onLoad, { once: true });
                script.addEventListener("error", onError, { once: true });
                return;
            }

            script = document.createElement("script");
            script.src = src;
            script.async = true;

            script.addEventListener("load", onLoad, { once: true });
            script.addEventListener("error", onError, { once: true });

            document.head.appendChild(script);
        });
    }

    // ==========================================
    // INITIALIZE FIREBASE
    // ==========================================

    async function initializeAuthentication() {
        if (authInitialized) return;

        try {
            if (!window.firebaseConfig) {
                throw new Error(
                    "Firebase configuration was not found. Load firebase-config.js before auth.js."
                );
            }

            const base =
                `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

            await loadScript(
                `${base}/firebase-app-compat.js`,
                () => !!window.firebase?.initializeApp
            );

            await loadScript(
                `${base}/firebase-auth-compat.js`,
                () => !!window.firebase?.auth
            );

            await loadScript(
                `${base}/firebase-firestore-compat.js`,
                () => !!window.firebase?.firestore
            );

            const firebase = window.firebase;

            if (!firebase.apps.length) {
                firebase.initializeApp(window.firebaseConfig);
            }

            const auth = firebase.auth();
            const db = firebase.firestore();

            await auth.setPersistence(
                firebase.auth.Auth.Persistence.LOCAL
            );

            authInitialized = true;

            // ==========================================
            // GLOBAL AUTHENTICATION SERVICES
            // ==========================================

            window.siteAuth = {
                auth,
                db,

                getCurrentUser: () => auth.currentUser,

                async isCreator() {
                    const user = auth.currentUser;

                    if (!user) return false;

                    const token = await user.getIdTokenResult(true);

                    return token.claims.creator === true;
                },

                async isEmailVerified() {
                    const user = auth.currentUser;

                    if (!user) return false;

                    await user.reload();

                    return user.emailVerified;
                }
            };

            createAuthenticationInterface(auth, db);

        } catch (error) {
            console.error(
                "Authentication initialization failed:",
                error
            );
        }
    }

    // ==========================================
    // USER PROFILE CREATION
    // ==========================================

    async function ensureUserProfile(db, user) {
        const userRef = db.collection("users").doc(user.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            const name = user.displayName || "";
            const parts = name.trim().split(/\s+/);

            await userRef.set({
                firstName: parts[0] || "",
                lastName: parts.slice(1).join(" "),
                displayName: name,
                email: user.email || "",
                provider: user.providerData.map(
                    item => item.providerId
                ),
                createdAt:
                    window.firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        return userRef;
    }

    // ==========================================
    // AUTHENTICATION INTERFACE
    // ==========================================

    function createAuthenticationInterface(auth, db) {

        if (document.getElementById("siteAuthButton")) {
            return;
        }

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

        // ==========================================
        // LOGIN BUTTON
        // ==========================================

        const button = document.createElement("button");

        button.id = "siteAuthButton";
        button.textContent = "Login / Profile";

        document.body.appendChild(button);

        // ==========================================
        // LOGIN MODAL
        // ==========================================

        const overlay = document.createElement("div");

        overlay.id = "siteAuthOverlay";

        overlay.innerHTML = `
            <div id="siteAuthModal">

                <button class="auth-close"
                    id="siteAuthClose"
                    aria-label="Close">&times;</button>

                <div id="siteAuthContent"></div>

                <div id="siteAuthMessage"
                    role="status"></div>

            </div>
        `;

        document.body.appendChild(overlay);

        const content =
            document.getElementById("siteAuthContent");

        const message =
            document.getElementById("siteAuthMessage");

        // ==========================================
        // MESSAGE HANDLER
        // ==========================================

        function showMessage(text, success = false) {
            message.textContent = text;

            message.style.color = success
                ? "#9be5b0"
                : "#ffb7b7";
        }

        // ==========================================
        // OPEN AND CLOSE MODAL
        // ==========================================

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
            if (event.target === overlay) {
                closeModal();
            }
        });

        document.addEventListener("keydown", event => {
            if (
                event.key === "Escape" &&
                overlay.style.display === "flex"
            ) {
                closeModal();
            }
        });

        // ==========================================
        // LOGIN PAGE
        // ==========================================

        function showLogin() {

            content.innerHTML = `
                <h2>Welcome Back</h2>

                <form id="authLoginForm">

                    <input id="authLoginEmail"
                        type="email"
                        placeholder="Email address"
                        autocomplete="email"
                        required>

                    <input id="authLoginPassword"
                        type="password"
                        placeholder="Password"
                        autocomplete="current-password"
                        required>

                    <button type="submit">Login</button>

                </form>

                <button class="auth-secondary"
                    id="authGoogle">
                    Continue with Google
                </button>

                <div class="auth-switch"
                    id="authForgot">
                    Forgot password?
                </div>

                <div class="auth-switch"
                    id="authShowSignup">
                    Don't have an account? Create one
                </div>
            `;

            // EMAIL LOGIN

            document.getElementById("authLoginForm")
                .addEventListener("submit", async event => {

                    event.preventDefault();

                    const submit =
                        event.submitter ||
                        event.currentTarget.querySelector(
                            'button[type="submit"]'
                        );

                    submit.disabled = true;

                    showMessage("Signing in...");

                    try {

                        const email =
                            document.getElementById(
                                "authLoginEmail"
                            ).value.trim();

                        const password =
                            document.getElementById(
                                "authLoginPassword"
                            ).value;

                        const result =
                            await auth.signInWithEmailAndPassword(
                                email,
                                password
                            );

                        const user = result.user;

                        await user.reload();

                        if (!user.emailVerified) {

                            try {
                                await user.sendEmailVerification();
                            } catch (verificationError) {
                                console.error(
                                    "Verification email error:",
                                    verificationError
                                );
                            }

                            await auth.signOut();

                            showLogin();

                            showMessage(
                                "Please verify your email before logging in. Check your inbox and spam folder."
                            );

                            return;
                        }

                        await ensureUserProfile(db, user);

                        showMessage(
                            "Login successful.",
                            true
                        );

                        await showProfile();

                    } catch (error) {

                        showMessage(error.message);

                    } finally {

                        submit.disabled = false;

                    }
                });

            // GOOGLE LOGIN

            document.getElementById("authGoogle")
                .addEventListener("click", async event => {

                    const btn = event.currentTarget;

                    btn.disabled = true;

                    showMessage("Connecting to Google...");

                    try {

                        const provider =
                            new window.firebase.auth.GoogleAuthProvider();

                        provider.setCustomParameters({
                            prompt: "select_account"
                        });

                        const result =
                            await auth.signInWithPopup(provider);

                        await ensureUserProfile(
                            db,
                            result.user
                        );

                        showMessage(
                            "Google sign-in successful.",
                            true
                        );

                        await showProfile();

                    } catch (error) {

                        showMessage(error.message);

                    } finally {

                        btn.disabled = false;

                    }
                });

            // FORGOT PASSWORD

            document.getElementById("authForgot")
                .addEventListener("click", async () => {

                    const email =
                        document.getElementById(
                            "authLoginEmail"
                        ).value.trim();

                    if (!email) {

                        showMessage(
                            "Enter your email address first."
                        );

                        return;
                    }

                    try {

                        await auth.sendPasswordResetEmail(email);

                        showMessage(
                            "Password reset email sent.",
                            true
                        );

                    } catch (error) {

                        showMessage(error.message);

                    }
                });

            // OPEN SIGNUP

            document.getElementById("authShowSignup")
                .addEventListener("click", showSignup);
        }

        // ==========================================
        // SIGNUP PAGE
        // ==========================================

        function showSignup() {

            content.innerHTML = `
                <h2>Create Account</h2>

                <form id="authSignupForm">

                    <input id="authFirstName"
                        type="text"
                        placeholder="First name"
                        maxlength="50"
                        autocomplete="given-name"
                        required>

                    <input id="authLastName"
                        type="text"
                        placeholder="Last name"
                        maxlength="50"
                        autocomplete="family-name"
                        required>

                    <input id="authAge"
                        type="number"
                        placeholder="Age"
                        min="1"
                        max="120"
                        required>

                    <select id="authGender" required>

                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">
                            Prefer not to say
                        </option>

                    </select>

                    <input id="authSignupEmail"
                        type="email"
                        placeholder="Email address"
                        autocomplete="email"
                        required>

                    <input id="authSignupPassword"
                        type="password"
                        placeholder="Password (minimum 6 characters)"
                        minlength="6"
                        autocomplete="new-password"
                        required>

                    <input id="authConfirmPassword"
                        type="password"
                        placeholder="Confirm password"
                        minlength="6"
                        autocomplete="new-password"
                        required>

                    <button type="submit">
                        Create Account
                    </button>

                </form>

                <div class="auth-switch"
                    id="authShowLogin">
                    Already have an account? Login
                </div>
            `;

            document.getElementById("authSignupForm")
                .addEventListener("submit", async event => {

                    event.preventDefault();

                    const submit =
                        event.submitter ||
                        event.currentTarget.querySelector(
                            'button[type="submit"]'
                        );

                    submit.disabled = true;

                    const firstName =
                        document.getElementById(
                            "authFirstName"
                        ).value.trim();

                    const lastName =
                        document.getElementById(
                            "authLastName"
                        ).value.trim();

                    const age = Number(
                        document.getElementById(
                            "authAge"
                        ).value
                    );

                    const gender =
                        document.getElementById(
                            "authGender"
                        ).value;

                    const email =
                        document.getElementById(
                            "authSignupEmail"
                        ).value.trim();

                    const password =
                        document.getElementById(
                            "authSignupPassword"
                        ).value;

                    const confirmPassword =
                        document.getElementById(
                            "authConfirmPassword"
                        ).value;

                    if (password !== confirmPassword) {

                        showMessage(
                            "Passwords do not match."
                        );

                        submit.disabled = false;

                        return;
                    }

                    if (
                        !Number.isInteger(age) ||
                        age < 1 ||
                        age > 120
                    ) {

                        showMessage(
                            "Please enter a valid age."
                        );

                        submit.disabled = false;

                        return;
                    }

                    if (!firstName || !lastName) {

                        showMessage(
                            "Please enter your first and last name."
                        );

                        submit.disabled = false;

                        return;
                    }

                    showMessage("Creating your account...");

                    suppressAuthRender = true;

                    try {

                        const result =
                            await auth.createUserWithEmailAndPassword(
                                email,
                                password
                            );

                        const user = result.user;

                        const fullName =
                            `${firstName} ${lastName}`;

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

                                provider: ["password"],

                                createdAt:
                                    window.firebase.firestore.FieldValue.serverTimestamp()

                            });

                        await user.sendEmailVerification();

                        await auth.signOut();

                        showLogin();

                        showMessage(
                            "Account created successfully. Please verify your email using the link sent to your inbox before logging in.",
                            true
                        );

                    } catch (error) {

                        showMessage(error.message);

                    } finally {

                        suppressAuthRender = false;

                        submit.disabled = false;

                    }
                });

            document.getElementById("authShowLogin")
                .addEventListener("click", showLogin);
        }

        // ==========================================
        // USER PROFILE
        // ==========================================

        async function showProfile() {

            const user = auth.currentUser;

            if (!user) {
                showLogin();
                return;
            }

            content.innerHTML = `
                <h2>Your Profile</h2>

                <div class="auth-profile"
                    id="authProfileDetails">
                    Loading profile...
                </div>

                <button id="authLogout">
                    Logout
                </button>
            `;

            try {

                await user.reload();

                if (!auth.currentUser ||
                    auth.currentUser.uid !== user.uid) {
                    return;
                }

                const token =
                    await user.getIdTokenResult(true);

                const creator =
                    token.claims.creator === true;

                const doc =
                    await db.collection("users")
                        .doc(user.uid)
                        .get();

                const profile =
                    doc.exists ? doc.data() : {};

                if (!auth.currentUser ||
                    auth.currentUser.uid !== user.uid) {
                    return;
                }

                const details =
                    document.getElementById(
                        "authProfileDetails"
                    );

                if (!details) return;

                details.textContent =

                    `Name: ${profile.displayName || user.displayName || "Not provided"}\n` +

                    `Email: ${user.email || "Not available"}\n` +

                    `Age: ${profile.age ?? "Not provided"}\n` +

                    `Gender: ${profile.gender || "Not provided"}\n` +

                    `Account: ${creator ? "Creator" : "Normal User"}\n` +

                    `Email verified: ${user.emailVerified ? "Yes" : "No"}`;

                details.style.whiteSpace = "pre-line";

                if (creator) {

                    const creatorText =
                        document.createElement("p");

                    creatorText.textContent =
                        "Creator access is enabled.";

                    creatorText.style.color =
                        "#bca6ff";

                    details.appendChild(creatorText);
                }

            } catch (error) {

                showMessage(
                    "Could not load profile: " + error.message
                );

            }

            const logoutButton =
                document.getElementById("authLogout");

            if (!logoutButton) return;

            logoutButton.addEventListener(
                "click",
                async () => {

                    logoutButton.disabled = true;

                    try {

                        await auth.signOut();

                        showLogin();

                        showMessage(
                            "You have logged out.",
                            true
                        );

                    } catch (error) {

                        showMessage(error.message);

                        logoutButton.disabled = false;

                    }
                }
            );
        }

        // ==========================================
        // AUTHENTICATION STATE LISTENER
        // ==========================================

        auth.onAuthStateChanged(async user => {

            button.textContent = user
                ? "Profile"
                : "Login / Profile";

            window.dispatchEvent(
                new CustomEvent("creator-auth-changed", {
                    detail: { user }
                })
            );

            if (suppressAuthRender) return;

            if (user) {

                const isPasswordUser =
                    user.providerData.some(
                        item => item.providerId === "password"
                    );

                if (isPasswordUser && !user.emailVerified) {

                    try {
                        await auth.signOut();
                    } catch (error) {
                        console.error(
                            "Could not sign out unverified user:",
                            error
                        );
                    }

                    if (overlay.style.display === "flex") {

                        showLogin();

                        showMessage(
                            "Please verify your email before accessing your account."
                        );
                    }

                    return;
                }
            }

            if (overlay.style.display === "flex") {

                if (user) {
                    await showProfile();
                } else {
                    showLogin();
                }
            }
        });
    }

    // ==========================================
    // PAGE READY
    // ==========================================

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
