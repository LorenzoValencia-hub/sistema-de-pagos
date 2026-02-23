// 1. Importar las herramientas de Firebase desde internet
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 2. Tu configuración personal de Firebase (Tus llaves)
const firebaseConfig = {
  apiKey: "AIzaSyBDkoXL1SAcBT-J51THYeN77WH4LrlSfeg",
  authDomain: "sistema-de-pagos-6a6dc.firebaseapp.com",
  projectId: "sistema-de-pagos-6a6dc",
  storageBucket: "sistema-de-pagos-6a6dc.firebasestorage.app",
  messagingSenderId: "531499153358",
  appId: "1:531499153358:web:b38cb1b0c7f7cdd66a5d9f"
};

// 3. Inicializar Firebase y la Autenticación
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 4. Capturar los elementos de tu página web
const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

// 5. Escuchar cuando presiones el botón "Ingresar"
loginForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Evita que la página se recargue

    // Obtener lo que escribiste en los cuadros de texto
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Intentar iniciar sesión en Firebase
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // ¡Éxito! Las credenciales son correctas
            console.log("¡Inicio de sesión exitoso!");
            
            // Redirigir a la pantalla principal del sistema (que crearemos a continuación)
            window.location.href = "panel.html"; 
        })
        .catch((error) => {
            // Error: Contraseña o correo equivocados
            console.error("Error al iniciar sesión:", error.message);
            errorMessage.style.display = 'block';
            errorMessage.innerText = "Usuario o contraseña incorrectos. Intenta de nuevo.";
        });
});