import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Registrar Service Worker con verificación inmediata de actualizaciones
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
            .then((reg) => reg.update())
            .catch((err) => console.warn('Service Worker no pudo registrarse:', err));
    });
}

const firebaseConfig = {
    apiKey: "AIzaSyBDkoXL1SAcBT-J51THYeN77WH4LrlSfeg",
    authDomain: "sistema-de-pagos-6a6dc.firebaseapp.com",
    projectId: "sistema-de-pagos-6a6dc",
    storageBucket: "sistema-de-pagos-6a6dc.firebasestorage.app",
    messagingSenderId: "531499153358",
    appId: "1:531499153358:web:b38cb1b0c7f7cdd66a5d9f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Si el usuario ya tiene sesión guardada en el teléfono (incluso sin internet), llevarlo directo al panel
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "panel.html";
    }
});

// Banner de estado de red
const networkBanner = document.getElementById('network-banner');
function actualizarEstadoRed() {
    if (!networkBanner) return;
    if (navigator.onLine) {
        networkBanner.classList.add('hidden');
    } else {
        networkBanner.classList.remove('hidden');
    }
}
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);
actualizarEstadoRed();

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const btnLogin = document.getElementById('btn-login');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    errorMessage.style.display = 'none';
    const originalBtnHTML = btnLogin.innerHTML;
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span>Verificando...</span>';

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            window.location.href = "panel.html";
        })
        .catch((error) => {
            console.error("Error al iniciar sesión:", error.message);
            btnLogin.disabled = false;
            btnLogin.innerHTML = originalBtnHTML;
            errorMessage.style.display = 'block';

            if (!navigator.onLine) {
                errorMessage.innerText = "Estás sin conexión. Conéctate a internet para iniciar sesión por primera vez.";
            } else {
                errorMessage.innerText = "Correo o contraseña incorrectos. Verifica tus datos.";
            }
        });
});
