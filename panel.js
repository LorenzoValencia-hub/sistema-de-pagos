import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    collection,
    addDoc,
    onSnapshot,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Habilitar persistencia local IndexedDB de Firestore para lectura/escritura offline y sincronización automática
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

// Utilidad de formato de moneda
const fmtMoneda = (valor) => {
    const num = Number(valor) || 0;
    return num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Toast de notificación estilo iOS
const toastEl = document.getElementById('ios-toast');
let toastTimeout = null;
function mostrarToast(mensaje) {
    if (!toastEl) return;
    toastEl.textContent = mensaje;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 3200);
}

// Indicador de estado de red y sincronización pendiente
const networkBanner = document.getElementById('network-banner');
const networkBannerText = document.getElementById('network-banner-text');
const syncPill = document.getElementById('sync-status-pill');
const syncLabel = document.getElementById('sync-status-label');
let hayCambiosPendientesDeSubir = false;

function actualizarUIEstadoConexion() {
    const online = navigator.onLine;
    if (!online) {
        networkBanner?.classList.remove('hidden');
        if (networkBannerText) {
            networkBannerText.textContent = hayCambiosPendientesDeSubir
                ? 'Sin conexión — Tienes cambios guardados en el celular listos para subir al reconectar'
                : 'Modo sin conexión — Puedes consultar y registrar datos normalmente';
        }
        if (syncPill && syncLabel) {
            syncPill.className = 'sync-pill offline';
            syncLabel.textContent = hayCambiosPendientesDeSubir ? 'Pendiente de subir' : 'Modo Offline';
        }
    } else {
        networkBanner?.classList.add('hidden');
        if (syncPill && syncLabel) {
            if (hayCambiosPendientesDeSubir) {
                syncPill.className = 'sync-pill syncing';
                syncLabel.textContent = 'Sincronizando...';
            } else {
                syncPill.className = 'sync-pill online';
                syncLabel.textContent = 'Sincronizado';
            }
        }
    }
}

window.addEventListener('online', () => {
    actualizarUIEstadoConexion();
    mostrarToast('🌐 Conexión restaurada. Sincronizando con la nube...');
});
window.addEventListener('offline', () => {
    actualizarUIEstadoConexion();
    mostrarToast('📴 Sin internet. Trabajando en modo local seguro.');
});
actualizarUIEstadoConexion();

// Inicializar fecha por defecto a hoy
const inputFecha = document.getElementById('fecha');
if (inputFecha && !inputFecha.value) {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    inputFecha.value = `${yyyy}-${mm}-${dd}`;
}

// --- SEGURIDAD ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    }
});

const btnLogout = document.getElementById('btn-logout');
btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});

// --- CALCULADORA EN TIEMPO REAL ---
const inputMonto = document.getElementById('monto-prestado');
const inputInteres = document.getElementById('interes');
const inputPagos = document.getElementById('pagos');
const resumenTotal = document.getElementById('resumen-total');
const resumenPago = document.getElementById('resumen-pago');

function calcularResumen() {
    const prestamo = parseFloat(inputMonto.value) || 0;
    const interesPorcentaje = parseFloat(inputInteres.value) || 0;
    const cantidadPagos = parseInt(inputPagos.value) || 1;

    const ganancia = prestamo * (interesPorcentaje / 100);
    const totalAPagar = prestamo + ganancia;
    const montoPorPago = totalAPagar / cantidadPagos;

    resumenTotal.innerText = fmtMoneda(totalAPagar);
    resumenPago.innerText = fmtMoneda(montoPorPago);
}

inputMonto.addEventListener('input', calcularResumen);
inputInteres.addEventListener('input', calcularResumen);
inputPagos.addEventListener('input', calcularResumen);

// --- NAVEGACIÓN DE PESTAÑAS (Top Segmented Control + Bottom Tab Bar iOS) ---
const secRegistrar = document.getElementById('sec-registrar');
const secActivos = document.getElementById('sec-activos');
const secFinalizados = document.getElementById('sec-finalizados');

const mapaSecciones = {
    registrar: secRegistrar,
    activos: secActivos,
    finalizados: secFinalizados
};

function activarSeccion(clave) {
    Object.values(mapaSecciones).forEach((sec) => sec?.classList.remove('active-content'));
    mapaSecciones[clave]?.classList.add('active-content');

    document.querySelectorAll('[data-target]').forEach((btn) => {
        if (btn.getAttribute('data-target') === clave) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        activarSeccion(target);
    });
});

// --- GUARDAR CLIENTE (Funciona Online y Offline sin duplicarse) ---
const formCliente = document.getElementById('form-cliente');

formCliente.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const montoPrestado = parseFloat(document.getElementById('monto-prestado').value);
    const porcentajeInteres = parseFloat(document.getElementById('interes').value);
    const cantidadPagos = parseInt(document.getElementById('pagos').value);
    const frecuencia = document.getElementById('frecuencia').value;
    const fechaInicio = document.getElementById('fecha').value;

    const ganancia = montoPrestado * (porcentajeInteres / 100);
    const montoTotal = parseFloat((montoPrestado + ganancia).toFixed(2));
    const montoPorPagoBase = parseFloat((montoTotal / cantidadPagos).toFixed(2));

    const cuotas = [];
    const fechaProyectada = new Date(fechaInicio + 'T12:00:00');
    let sumaPagosAcumulados = 0;

    for (let i = 1; i <= cantidadPagos; i++) {
        let montoDeEstaCuota = montoPorPagoBase;

        // En la última cuota ajustamos cualquier diferencia de centavos para cuadrar el total exacto
        if (i === cantidadPagos) {
            montoDeEstaCuota = parseFloat((montoTotal - sumaPagosAcumulados).toFixed(2));
        }

        sumaPagosAcumulados += montoDeEstaCuota;

        cuotas.push({
            numero_pago: i,
            monto: montoDeEstaCuota,
            fecha_esperada: fechaProyectada.toLocaleDateString('es-MX'),
            estado: 'pendiente'
        });

        if (frecuencia === 'semanal') {
            fechaProyectada.setDate(fechaProyectada.getDate() + 7);
        } else {
            fechaProyectada.setDate(fechaProyectada.getDate() + 15);
        }
    }

    const nuevoClientePayload = {
        nombre: nombre,
        monto_prestado: montoPrestado,
        porcentaje_interes: porcentajeInteres,
        monto_total_deuda: montoTotal,
        saldo_restante: montoTotal,
        cantidad_pagos: cantidadPagos,
        monto_por_pago: montoPorPagoBase,
        frecuencia: frecuencia,
        fecha_inicio: fechaInicio,
        fecha_registro: new Date(),
        cuotas: cuotas
    };

    try {
        // En modo offline, addDoc guarda inmediatamente en la cola local IndexedDB
        // No bloqueamos la interfaz esperando confirmación del servidor remoto si no hay red
        const promesaGuardado = addDoc(collection(db, "clientes"), nuevoClientePayload);

        if (navigator.onLine) {
            await promesaGuardado;
            mostrarToast(`✅ ${nombre} registrado y sincronizado`);
        } else {
            mostrarToast(`📲 ${nombre} guardado en el celular (subirá al reconectar)`);
        }

        formCliente.reset();
        if (inputFecha) {
            const hoy = new Date();
            inputFecha.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        }
        calcularResumen();
        activarSeccion('activos');
    } catch (error) {
        console.error("Error al guardar:", error);
        mostrarToast("❌ Hubo un error al guardar el cliente");
    }
});

// --- MOSTRAR CLIENTES EN TIEMPO REAL Y GESTIONAR BÚSQUEDA + ESTADO DE SINCRONIZACIÓN ---
const listaActivos = document.getElementById('lista-activos');
const listaFinalizados = document.getElementById('lista-finalizados');
const inputBuscarActivos = document.getElementById('buscar-activos');
const inputBuscarFinalizados = document.getElementById('buscar-finalizados');

let cacheClientes = [];

function obtenerIniciales(nombre = '') {
    const partes = nombre.trim().split(/\s+/);
    if (partes.length === 0 || !partes[0]) return 'CL';
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function renderizarListasClientes() {
    const filtroActivos = (inputBuscarActivos?.value || '').trim().toLowerCase();
    const filtroFinalizados = (inputBuscarFinalizados?.value || '').trim().toLowerCase();

    listaActivos.innerHTML = '';
    listaFinalizados.innerHTML = '';

    let totalPorCobrar = 0;
    let totalRecuperado = 0;
    let conteoActivos = 0;
    let conteoFinalizados = 0;

    cacheClientes.forEach((item) => {
        const { idCliente, cliente, pendienteSync } = item;
        if (cliente.saldo_restante === undefined) return;

        const deudaTotal = Number(cliente.monto_total_deuda) || 0;
        const saldoRestante = Number(cliente.saldo_restante) || 0;
        const cobradoCliente = Math.max(0, deudaTotal - saldoRestante);
        totalRecuperado += cobradoCliente;

        const cuotasPagadas = Array.isArray(cliente.cuotas)
            ? cliente.cuotas.filter((c) => c.estado === 'pagado').length
            : 0;
        const totalCuotas = cliente.cantidad_pagos || (Array.isArray(cliente.cuotas) ? cliente.cuotas.length : 1);
        const porcentajeAvance = Math.min(100, Math.round((cuotasPagadas / totalCuotas) * 100));

        const syncBadgeHTML = pendienteSync
            ? `<span class="chip-sync-pending" title="Guardado en el celular, esperando internet para subir">⏳ Pendiente de subir</span>`
            : '';

        if (saldoRestante > 0) {
            conteoActivos++;
            totalPorCobrar += saldoRestante;

            if (filtroActivos && !cliente.nombre.toLowerCase().includes(filtroActivos)) {
                return;
            }

            const tarjeta = document.createElement('div');
            tarjeta.className = 'cliente-card';
            tarjeta.innerHTML = `
                <div class="cliente-card-header">
                    <div class="cliente-header-left">
                        <div class="avatar-circle">${obtenerIniciales(cliente.nombre)}</div>
                        <div>
                            <h4>${cliente.nombre}</h4>
                            <div class="card-subchips">
                                <span class="freq-pill">${cliente.frecuencia}</span>
                                <span class="cuota-pill">${cuotasPagadas}/${totalCuotas} pagos</span>
                                ${syncBadgeHTML}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mini-progress-wrap">
                    <div class="mini-progress-bar" style="width: ${porcentajeAvance}%"></div>
                </div>

                <div class="cliente-card-body">
                    <div class="cliente-card-item">
                        <span>Préstamo</span>
                        <strong>$${fmtMoneda(cliente.monto_prestado || 0)}</strong>
                    </div>
                    <div class="cliente-card-item">
                        <span>Total c/ Interés</span>
                        <strong>$${fmtMoneda(deudaTotal)}</strong>
                    </div>
                    <div class="cliente-card-item">
                        <span>Cuota</span>
                        <strong class="primary-text">$${fmtMoneda(cliente.monto_por_pago || (deudaTotal / totalCuotas))}</strong>
                    </div>
                    <div class="cliente-card-item saldo-highlight-box">
                        <span>Saldo Restante</span>
                        <strong class="danger-text">$${fmtMoneda(saldoRestante)}</strong>
                    </div>
                </div>

                <div class="cliente-card-actions">
                    <a href="cliente.html?id=${idCliente}" class="btn-card-primary">
                        <span>Cobrar / Ver Pagos</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </a>
                    <button class="btn-card-delete" onclick="borrarCliente('${idCliente}', '${cliente.nombre.replace(/'/g, "\\'")}')" title="Eliminar Cliente">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            listaActivos.appendChild(tarjeta);
        } else {
            conteoFinalizados++;

            if (filtroFinalizados && !cliente.nombre.toLowerCase().includes(filtroFinalizados)) {
                return;
            }

            const tarjeta = document.createElement('div');
            tarjeta.className = 'cliente-card card-finished';
            tarjeta.innerHTML = `
                <div class="cliente-card-header">
                    <div class="cliente-header-left">
                        <div class="avatar-circle emerald">${obtenerIniciales(cliente.nombre)}</div>
                        <div>
                            <h4>${cliente.nombre}</h4>
                            <div class="card-subchips">
                                <span class="paid-pill">LIQUIDADO</span>
                                ${syncBadgeHTML}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="cliente-card-body two-cols">
                    <div class="cliente-card-item">
                        <span>Préstamo Inicial</span>
                        <strong>$${fmtMoneda(cliente.monto_prestado || 0)}</strong>
                    </div>
                    <div class="cliente-card-item">
                        <span>Total Pagado</span>
                        <strong class="emerald-text">$${fmtMoneda(deudaTotal)}</strong>
                    </div>
                </div>

                <div class="cliente-card-actions">
                    <a href="cliente.html?id=${idCliente}" class="btn-card-secondary">
                        <span>Ver Historial y Tickets</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </a>
                    <button class="btn-card-delete" onclick="borrarCliente('${idCliente}', '${cliente.nombre.replace(/'/g, "\\'")}')" title="Eliminar Cliente">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            listaFinalizados.appendChild(tarjeta);
        }
    });

    if (listaActivos.children.length === 0) {
        listaActivos.innerHTML = `
            <div class="empty-state-ios">
                <p>No hay clientes activos${filtroActivos ? ' que coincidan con tu búsqueda' : ''}.</p>
            </div>
        `;
    }

    if (listaFinalizados.children.length === 0) {
        listaFinalizados.innerHTML = `
            <div class="empty-state-ios">
                <p>Aún no hay préstamos liquidados${filtroFinalizados ? ' que coincidan con tu búsqueda' : ''}.</p>
            </div>
        `;
    }

    // Actualizar KPIs del Wallet Hero y contadores de pestañas
    document.getElementById('kpi-por-cobrar').textContent = `$${fmtMoneda(totalPorCobrar)}`;
    document.getElementById('kpi-total-cobrado').textContent = `$${fmtMoneda(totalRecuperado)}`;
    document.getElementById('kpi-clientes-activos').textContent = conteoActivos;
    document.getElementById('kpi-clientes-finalizados').textContent = conteoFinalizados;

    document.getElementById('badge-activos').textContent = conteoActivos;
    document.getElementById('badge-finalizados').textContent = conteoFinalizados;
    document.getElementById('mobile-badge-activos').textContent = conteoActivos;
}

inputBuscarActivos?.addEventListener('input', renderizarListasClientes);
inputBuscarFinalizados?.addEventListener('input', renderizarListasClientes);

// Escuchar cambios con includeMetadataChanges para saber si hay escrituras locales pendientes de subir a la nube
onSnapshot(
    collection(db, "clientes"),
    { includeMetadataChanges: true },
    (snapshot) => {
        hayCambiosPendientesDeSubir = snapshot.metadata.hasPendingWrites;
        actualizarUIEstadoConexion();

        const listaTemp = [];
        snapshot.forEach((docSnap) => {
            listaTemp.push({
                idCliente: docSnap.id,
                cliente: docSnap.data(),
                pendienteSync: docSnap.metadata.hasPendingWrites
            });
        });

        cacheClientes = listaTemp;
        renderizarListasClientes();
    }
);

// --- FUNCIÓN PARA ELIMINAR CLIENTE ---
window.borrarCliente = async function(idCliente, nombreCliente) {
    const confirmacion = confirm(`⚠️ ¿Seguro que deseas eliminar a ${nombreCliente}?\n\nEsta acción borrará su expediente y no se puede deshacer.`);

    if (confirmacion) {
        try {
            const promesaBorrado = deleteDoc(doc(db, "clientes", idCliente));
            if (navigator.onLine) {
                await promesaBorrado;
            }
            mostrarToast(`🗑️ ${nombreCliente} eliminado`);
        } catch (error) {
            console.error("Error al eliminar el cliente: ", error);
            mostrarToast("❌ No se pudo eliminar el cliente");
        }
    }
};
