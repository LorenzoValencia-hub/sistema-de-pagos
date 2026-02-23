// 1. Importar herramientas de Firebase (Auth para seguridad y Firestore para base de datos)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// 2. Tus llaves de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBDkoXL1SAcBT-J51THYeN77WH4LrlSfeg",
  authDomain: "sistema-de-pagos-6a6dc.firebaseapp.com",
  projectId: "sistema-de-pagos-6a6dc",
  storageBucket: "sistema-de-pagos-6a6dc.firebasestorage.app",
  messagingSenderId: "531499153358",
  appId: "1:531499153358:web:b38cb1b0c7f7cdd66a5d9f"
};

// 3. Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Inicializamos la base de datos

// --- SECCIÓN DE SEGURIDAD ---

// Vigilar si el usuario está logueado
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Si no hay usuario, lo regresamos al login
        window.location.href = "index.html";
    }
});

// Botón para cerrar sesión
const btnLogout = document.getElementById('btn-logout');
btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});

// --- NUEVO: CALCULADORA EN TIEMPO REAL ---
const inputMonto = document.getElementById('monto-prestado');
const inputInteres = document.getElementById('interes');
const inputPagos = document.getElementById('pagos');
const resumenTotal = document.getElementById('resumen-total');
const resumenPago = document.getElementById('resumen-pago');

function calcularResumen() {
    const prestamo = parseFloat(inputMonto.value) || 0;
    const interesPorcentaje = parseFloat(inputInteres.value) || 0;
    const cantidadPagos = parseInt(inputPagos.value) || 1; // Para no dividir entre cero

    // Fórmula matemática
    const ganancia = prestamo * (interesPorcentaje / 100);
    const totalAPagar = prestamo + ganancia;
    const montoPorPago = totalAPagar / cantidadPagos;

    // Mostrar en pantalla con 2 decimales
    resumenTotal.innerText = totalAPagar.toFixed(2);
    resumenPago.innerText = montoPorPago.toFixed(2);
}

// Cada vez que el usuario escriba en estos campos, se calcula todo
inputMonto.addEventListener('input', calcularResumen);
inputInteres.addEventListener('input', calcularResumen);
inputPagos.addEventListener('input', calcularResumen);

// --- SECCIÓN DE BASE DE DATOS (Guardar Cliente) ---
const formCliente = document.getElementById('form-cliente');

formCliente.addEventListener('submit', async (e) => {
    e.preventDefault(); 

    // 1. Obtener valores nuevos
    const nombre = document.getElementById('nombre').value;
    const montoPrestado = parseFloat(document.getElementById('monto-prestado').value);
    const porcentajeInteres = parseFloat(document.getElementById('interes').value);
    const cantidadPagos = parseInt(document.getElementById('pagos').value);
    const frecuencia = document.getElementById('frecuencia').value;
    const fechaInicio = document.getElementById('fecha').value;

    // 2. Cálculos finales para guardar
    const ganancia = montoPrestado * (porcentajeInteres / 100);
    const montoTotal = montoPrestado + ganancia;
    const montoPorPago = (montoTotal / cantidadPagos).toFixed(2);

    // 3. Generar el calendario de pagos
    const cuotas = [];
    let fechaProyectada = new Date(fechaInicio + 'T12:00:00'); 

    for(let i = 1; i <= cantidadPagos; i++) {
        cuotas.push({
            numero_pago: i,
            monto: parseFloat(montoPorPago),
            fecha_esperada: fechaProyectada.toLocaleDateString('es-MX'),
            estado: 'pendiente'
        });

        if(frecuencia === 'semanal') {
            fechaProyectada.setDate(fechaProyectada.getDate() + 7);
        } else {
            fechaProyectada.setDate(fechaProyectada.getDate() + 15);
        }
    }

    try {
        // 4. Guardar en Firebase (Ahora guardamos también el préstamo original y el % de interés)
        const docRef = await addDoc(collection(db, "clientes"), {
            nombre: nombre,
            monto_prestado: montoPrestado,
            porcentaje_interes: porcentajeInteres,
            monto_total_deuda: montoTotal,
            saldo_restante: montoTotal, 
            cantidad_pagos: cantidadPagos,
            monto_por_pago: parseFloat(montoPorPago),
            frecuencia: frecuencia,
            fecha_inicio: fechaInicio,
            fecha_registro: new Date(),
            cuotas: cuotas
        });
        
        alert(`¡Cliente registrado exitosamente!`);
        formCliente.reset(); 
        calcularResumen(); // Limpia los números del cuadrito gris

    } catch (error) {
        console.error("Error al guardar:", error);
    }
});

// --- SECCIÓN: MOSTRAR CLIENTES EN TIEMPO REAL ---

const listaClientes = document.getElementById('lista-clientes');

// --- SECCIÓN: MENÚ DE PESTAÑAS ---
const tabRegistrar = document.getElementById('tab-registrar');
const tabActivos = document.getElementById('tab-activos');
const tabFinalizados = document.getElementById('tab-finalizados');

const secRegistrar = document.getElementById('sec-registrar');
const secActivos = document.getElementById('sec-activos');
const secFinalizados = document.getElementById('sec-finalizados');

function cambiarPestana(tabActiva, secActiva) {
    // Ocultar todas
    [tabRegistrar, tabActivos, tabFinalizados].forEach(t => t.classList.remove('active'));
    [secRegistrar, secActivos, secFinalizados].forEach(s => s.classList.remove('active-content'));
    // Mostrar la seleccionada
    tabActiva.classList.add('active');
    secActiva.classList.add('active-content');
}

tabRegistrar.addEventListener('click', () => cambiarPestana(tabRegistrar, secRegistrar));
tabActivos.addEventListener('click', () => cambiarPestana(tabActivos, secActivos));
tabFinalizados.addEventListener('click', () => cambiarPestana(tabFinalizados, secFinalizados));

// --- SECCIÓN: MOSTRAR CLIENTES EN TIEMPO REAL ---
const listaActivos = document.getElementById('lista-activos');
const listaFinalizados = document.getElementById('lista-finalizados');

onSnapshot(collection(db, "clientes"), (snapshot) => {
    listaActivos.innerHTML = '';
    listaFinalizados.innerHTML = '';
    
    snapshot.forEach((doc) => {
        const cliente = doc.data();
        const idCliente = doc.id;
        
        if(cliente.saldo_restante === undefined) return; 

        const fila = document.createElement('tr');
        
        // --- CLIENTES ACTIVOS ---
        if (cliente.saldo_restante > 0) {
            fila.innerHTML = `
                <td>${cliente.nombre}</td>
                <td>$${cliente.monto_prestado || 0}</td> <td>$${cliente.monto_total_deuda}</td>
                <td style="color:red; font-weight:bold;">$${cliente.saldo_restante}</td>
                <td style="text-transform: capitalize;">${cliente.frecuencia}</td>
                <td style="display: flex; gap: 5px; align-items: center;">
                    <a href="cliente.html?id=${idCliente}" style="padding:6px 12px; background:#007bff; color:white; text-decoration:none; border-radius:5px; font-size: 14px;">Ver Detalles</a>
                    <button onclick="borrarCliente('${idCliente}', '${cliente.nombre}')" style="background:#dc3545; color:white; border:none; padding:6px 10px; border-radius:5px; cursor:pointer; font-size:14px;" title="Eliminar Cliente">🗑️</button>
                </td>
            `;
            listaActivos.appendChild(fila);
        } 
        // --- CLIENTES FINALIZADOS ---
        else {
            fila.innerHTML = `
                <td>${cliente.nombre}</td>
                <td>$${cliente.monto_prestado || 0}</td> <td>$${cliente.monto_total_deuda}</td>
                <td><span style="background:#28a745; color:white; padding:4px 8px; border-radius:4px;">PAGADO</span></td>
                <td style="display: flex; gap: 5px; align-items: center;">
                    <a href="cliente.html?id=${idCliente}" style="padding:6px 12px; background:#17a2b8; color:white; text-decoration:none; border-radius:5px; font-size: 14px;">Ver Historial</a>
                    <button onclick="borrarCliente('${idCliente}', '${cliente.nombre}')" style="background:#dc3545; color:white; border:none; padding:6px 10px; border-radius:5px; cursor:pointer; font-size:14px;" title="Eliminar Cliente">🗑️</button>
                </td>
            `;
            listaFinalizados.appendChild(fila);
        }
    });
});

// --- NUEVO: FUNCIÓN PARA ELIMINAR CLIENTE ---
window.borrarCliente = async function(idCliente, nombreCliente) {
    // Pedimos confirmación para evitar accidentes
    const confirmacion = confirm(`⚠️ ¿Estás súper seguro de que quieres ELIMINAR a ${nombreCliente}?\n\nEsta acción borrará todos sus datos y no se puede deshacer.`);
    
    if (confirmacion) {
        try {
            // Elimina el documento directamente en Firestore
            await deleteDoc(doc(db, "clientes", idCliente));
            alert(`✅ ${nombreCliente} ha sido eliminado del sistema.`);
        } catch (error) {
            console.error("Error al eliminar el cliente: ", error);
            alert("Hubo un error al intentar eliminar. Revisa la consola.");
        }
    }
}

