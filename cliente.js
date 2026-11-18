import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    doc,
    onSnapshot,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// Persistencia offline activada en IndexedDB para cobrar sin internet y sincronizar al reconectar
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

const fmtMoneda = (valor) => {
    const num = Number(valor) || 0;
    return num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

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

// Estado de red y sincronización
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
                ? 'Sin conexión — Cobro guardado en el celular; se subirá automáticamente al tener internet'
                : 'Modo sin conexión — Puedes registrar cobros y generar tickets normalmente';
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
    mostrarToast('🌐 Conexión restaurada. Sincronizando cobros...');
});
window.addEventListener('offline', () => {
    actualizarUIEstadoConexion();
    mostrarToast('📴 Modo sin internet activo.');
});
actualizarUIEstadoConexion();

const urlParams = new URLSearchParams(window.location.search);
const idCliente = urlParams.get('id');
let datosCliente = null;
let cancelarSuscripcion = null;

// SEGURIDAD: Verificar sesión activa
onAuthStateChanged(auth, (user) => {
    if (user) {
        iniciarEscuchaCliente();
    } else {
        window.location.href = "index.html";
    }
});

function obtenerIniciales(nombre = '') {
    const partes = nombre.trim().split(/\s+/);
    if (partes.length === 0 || !partes[0]) return 'CL';
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// ESCUCHAR DATOS DEL CLIENTE EN TIEMPO REAL (Incluyendo caché local Offline)
function iniciarEscuchaCliente() {
    if (!idCliente) {
        alert("Error: No se encontró el ID del cliente.");
        window.location.href = "panel.html";
        return;
    }

    if (cancelarSuscripcion) cancelarSuscripcion();

    const docRef = doc(db, "clientes", idCliente);
    cancelarSuscripcion = onSnapshot(
        docRef,
        { includeMetadataChanges: true },
        (docSnap) => {
            if (!docSnap.exists()) {
                mostrarToast("Cliente no encontrado.");
                setTimeout(() => { window.location.href = "panel.html"; }, 1200);
                return;
            }

            hayCambiosPendientesDeSubir = docSnap.metadata.hasPendingWrites;
            actualizarUIEstadoConexion();

            datosCliente = docSnap.data();
            actualizarEncabezadoCliente();
            renderizarTablaPagos();
        },
        (error) => {
            console.error("Error al cargar cliente:", error);
            document.getElementById('nombre-cliente').innerText = "Error al cargar datos";
        }
    );
}

function actualizarEncabezadoCliente() {
    if (!datosCliente) return;

    document.getElementById('nombre-cliente').innerText = datosCliente.nombre;
    document.getElementById('avatar-iniciales').innerText = obtenerIniciales(datosCliente.nombre);
    document.getElementById('chip-frecuencia').innerText = datosCliente.frecuencia || 'Semanal';

    const deudaTotal = Number(datosCliente.monto_total_deuda) || 0;
    const saldoRestante = Number(datosCliente.saldo_restante) || 0;

    document.getElementById('deuda-total').innerText = '$' + fmtMoneda(deudaTotal);
    document.getElementById('saldo-restante').innerText = '$' + fmtMoneda(saldoRestante);

    const cuotas = Array.isArray(datosCliente.cuotas) ? datosCliente.cuotas : [];
    const pagadas = cuotas.filter((c) => c.estado === 'pagado').length;
    const totalCuotas = datosCliente.cantidad_pagos || cuotas.length || 1;
    const porcentaje = Math.min(100, Math.round((pagadas / totalCuotas) * 100));

    document.getElementById('chip-progreso-texto').innerText = `${pagadas} de ${totalCuotas} pagos`;
    document.getElementById('porcentaje-progreso').innerText = `${porcentaje}%`;
    document.getElementById('barra-progreso').style.width = `${porcentaje}%`;
}

// DIBUJAR TARJETAS DE CUOTAS ESTILO FINTECH / iOS
function renderizarTablaPagos() {
    const contenedor = document.getElementById('lista-pagos');
    contenedor.innerHTML = '';

    if (!datosCliente || !Array.isArray(datosCliente.cuotas)) return;

    // Identificar cuál es la próxima cuota pendiente para destacarla
    const proximoIndicePendiente = datosCliente.cuotas.findIndex((c) => c.estado === 'pendiente');

    datosCliente.cuotas.forEach((cuota, index) => {
        const tarjeta = document.createElement('div');
        const esPagado = cuota.estado === 'pagado';
        const esProximo = index === proximoIndicePendiente;

        tarjeta.className = `pago-card ${esPagado ? 'is-paid' : 'is-pending'} ${esProximo ? 'is-next-due' : ''}`;

        const badgeClass = esPagado ? 'badge paid' : (esProximo ? 'badge next-due' : 'badge pendiente');
        const badgeTexto = esPagado ? 'PAGADO' : (esProximo ? 'PRÓXIMO COBRO' : 'PENDIENTE');

        let zonaAccion = '';
        if (!esPagado) {
            zonaAccion = `
                <button class="btn-cobrar-ios ${esProximo ? 'btn-pulse' : ''}" onclick="abrirSheetCobro(${index})">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Registrar Pago de $${fmtMoneda(cuota.monto)}</span>
                </button>
            `;
        } else {
            const fechaCorta = (cuota.fecha_pago_real || '').split(' ')[0] || 'Registrado';
            const horaCorta = (cuota.fecha_pago_real || '').split(' ').slice(1).join(' ') || '';
            zonaAccion = `
                <div class="paid-footer-ios">
                    <div class="paid-timestamp">
                        <span class="check-circle">✓</span>
                        <div>
                            <strong>Pagado el ${fechaCorta}</strong>
                            ${horaCorta ? `<small>${horaCorta}</small>` : ''}
                        </div>
                    </div>
                    <button class="btn-ticket-ios" onclick="abrirSheetTicket(${index})">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                        <span>Comprobante</span>
                    </button>
                </div>
            `;
        }

        tarjeta.innerHTML = `
            <div class="pago-header">
                <div class="pago-title-group">
                    <span class="pago-number-circle">${cuota.numero_pago}</span>
                    <div>
                        <h4>Pago ${cuota.numero_pago} de ${datosCliente.cantidad_pagos}</h4>
                        <span class="pago-date-sub">Fecha programada: ${cuota.fecha_esperada}</span>
                    </div>
                </div>
                <span class="${badgeClass}">${badgeTexto}</span>
            </div>
            <div class="pago-body">
                <div class="pago-info">
                    <p>Importe de la cuota</p>
                </div>
                <div class="pago-amount-display">
                    <strong>$${fmtMoneda(cuota.monto)}</strong>
                </div>
            </div>
            <div class="pago-actions">
                ${zonaAccion}
            </div>
        `;

        contenedor.appendChild(tarjeta);
    });
}

// --- ACTION SHEET ESTILO iOS PARA CONFIRMAR PAGO Y COMPARTIR TICKET ---
const sheetBackdrop = document.getElementById('ios-sheet-backdrop');
const sheetContent = document.getElementById('sheet-content');

function cerrarSheet() {
    sheetBackdrop?.classList.add('hidden');
}

sheetBackdrop?.addEventListener('click', (e) => {
    if (e.target === sheetBackdrop) {
        cerrarSheet();
    }
});

window.cerrarSheet = cerrarSheet;

window.abrirSheetCobro = function(indexCuota) {
    const cuota = datosCliente.cuotas[indexCuota];
    if (!cuota) return;

    sheetContent.innerHTML = `
        <div class="sheet-header">
            <div class="sheet-icon-badge emerald">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
            </div>
            <h3>Confirmar Abono</h3>
            <p>Pago #${cuota.numero_pago} de ${datosCliente.nombre}</p>
        </div>

        <div class="sheet-amount-box">
            <span>Monto a registrar</span>
            <h2>$${fmtMoneda(cuota.monto)}</h2>
            <small>Fecha esperada: ${cuota.fecha_esperada}</small>
        </div>

        <div class="sheet-buttons">
            <button class="btn-ios-emerald" onclick="confirmarPagoCuota(${indexCuota})">
                Confirmar Pago Ahora
            </button>
            <button class="btn-ios-cancel" onclick="cerrarSheet()">
                Cancelar
            </button>
        </div>
    `;
    sheetBackdrop.classList.remove('hidden');
};

window.confirmarPagoCuota = async function(indexCuota) {
    const cuota = datosCliente.cuotas[indexCuota];
    if (!cuota || cuota.estado === 'pagado') {
        cerrarSheet();
        return;
    }

    cuota.estado = 'pagado';
    const fechaHoy = new Date();
    cuota.fecha_pago_real =
        fechaHoy.toLocaleDateString('es-MX') +
        ' ' +
        fechaHoy.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    let nuevoSaldo = parseFloat((datosCliente.saldo_restante - cuota.monto).toFixed(2));
    if (indexCuota === datosCliente.cantidad_pagos - 1 || nuevoSaldo < 0.01) {
        nuevoSaldo = 0.0;
    }
    datosCliente.saldo_restante = nuevoSaldo;

    // Actualizar UI inmediatamente y mostrar opciones de comprobante sin bloquear en modo Offline
    actualizarEncabezadoCliente();
    renderizarTablaPagos();
    abrirSheetTicket(indexCuota, true);

    try {
        const docRef = doc(db, "clientes", idCliente);
        const promesaUpdate = updateDoc(docRef, {
            cuotas: datosCliente.cuotas,
            saldo_restante: datosCliente.saldo_restante
        });

        if (navigator.onLine) {
            await promesaUpdate;
            mostrarToast('✅ Abono registrado y sincronizado');
        } else {
            mostrarToast('📲 Abono guardado en el celular (se subirá al reconectar)');
        }
    } catch (error) {
        console.error("Error al registrar pago:", error);
        mostrarToast("❌ Error al guardar el pago");
    }
};

window.abrirSheetTicket = function(indexCuota, recienPagado = false) {
    const cuota = datosCliente.cuotas[indexCuota];
    if (!cuota) return;

    sheetContent.innerHTML = `
        <div class="sheet-header">
            <div class="sheet-icon-badge ${recienPagado ? 'emerald' : 'blue'}">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <h3>${recienPagado ? '¡Pago Registrado!' : `Comprobante Pago #${cuota.numero_pago}`}</h3>
            <p>${datosCliente.nombre} • $${fmtMoneda(cuota.monto)}</p>
        </div>

        <div class="sheet-receipt-preview">
            <div class="receipt-row">
                <span>Fecha de pago</span>
                <strong>${cuota.fecha_pago_real}</strong>
            </div>
            <div class="receipt-row">
                <span>Número de cuota</span>
                <strong>${cuota.numero_pago} de ${datosCliente.cantidad_pagos}</strong>
            </div>
            <div class="receipt-row">
                <span>Nuevo saldo restante</span>
                <strong class="emerald-text">$${fmtMoneda(datosCliente.saldo_restante)}</strong>
            </div>
        </div>

        <div class="sheet-buttons">
            <button class="btn-ios-primary" onclick="accionCompartirTicket(${indexCuota})">
                📲 Compartir por WhatsApp / Celular
            </button>
            <button class="btn-ios-secondary" onclick="accionImprimirTicket(${indexCuota})">
                🖨️ Imprimir o Guardar PDF
            </button>
            <button class="btn-ios-cancel" onclick="cerrarSheet()">
                Listo
            </button>
        </div>
    `;
    sheetBackdrop.classList.remove('hidden');
};

window.accionCompartirTicket = function(indexCuota) {
    const cuota = datosCliente.cuotas[indexCuota];
    cerrarSheet();
    compartirTicketTexto(cuota);
};

window.accionImprimirTicket = function(indexCuota) {
    const cuota = datosCliente.cuotas[indexCuota];
    cerrarSheet();
    generarTicket(cuota);
};

// COMPARTIR POR WHATSAPP / MENÚ NATIVO iOS & ANDROID
function compartirTicketTexto(cuota) {
    const textoTicket = `🧾 *COMPROBANTE DE PAGO* 🧾\n\n👤 *Cliente:* ${datosCliente.nombre}\n📅 *Fecha:* ${cuota.fecha_pago_real}\n💰 *Monto Pagado:* $${fmtMoneda(cuota.monto)}\n🔢 *Pago:* ${cuota.numero_pago} de ${datosCliente.cantidad_pagos}\n\n📉 *Deuda Total:* $${fmtMoneda(datosCliente.monto_total_deuda)}\n💵 *Saldo Restante:* $${fmtMoneda(datosCliente.saldo_restante)}\n\n✅ _¡Gracias por su pago!_`;

    if (navigator.share) {
        navigator.share({
            title: 'Comprobante de Pago',
            text: textoTicket
        }).catch((error) => console.log('Compartir cancelado', error));
    } else {
        const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoTicket)}`;
        window.open(urlWhatsApp, '_blank');
    }
}

// DISEÑAR E IMPRIMIR TICKET TÉRMICO / PDF
function generarTicket(cuota) {
    const ventanaTicket = window.open('', 'PRINT', 'height=600,width=400');
    if (!ventanaTicket || ventanaTicket.closed) {
        alert("⚠️ Permite las ventanas emergentes para ver o imprimir el ticket.");
        return;
    }

    ventanaTicket.document.write(`
        <html>
            <head>
                <title>Ticket Pago #${cuota.numero_pago} - ${datosCliente.nombre}</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; text-align: center; padding: 20px; }
                    .ticket-box { border: 2px dashed #333; padding: 20px; width: 300px; margin: 0 auto; }
                    .divisor { border-top: 1px dashed #333; margin: 15px 0; }
                    h3 { margin: 0; }
                </style>
            </head>
            <body>
                <div class="ticket-box">
                    <h3>SISTEMA DE PAGOS</h3>
                    <p>Miriam Ek Iuit</p>
                    <p>Comprobante de Abono</p>
                    <div class="divisor"></div>
                    <p><strong>Cliente:</strong> ${datosCliente.nombre}</p>
                    <p><strong>Fecha:</strong> ${cuota.fecha_pago_real}</p>
                    <div class="divisor"></div>
                    <p style="font-size: 18px; font-weight: bold;">Pago ${cuota.numero_pago} de ${datosCliente.cantidad_pagos}</p>
                    <p>Monto Pagado: $${fmtMoneda(cuota.monto)}</p>
                    <div class="divisor"></div>
                    <p>Deuda Total: $${fmtMoneda(datosCliente.monto_total_deuda)}</p>
                    <p style="font-weight: bold; font-size: 16px;">SALDO RESTANTE: $${fmtMoneda(datosCliente.saldo_restante)}</p>
                    <div class="divisor"></div>
                    <p>¡Gracias por su pago!</p>
                    <p>Este ticket es tu comprobante, guárdalo o imprímelo.</p>
                    <p>Este comprobante no es válido como factura fiscal.</p>
                </div>
            </body>
        </html>
    `);
    ventanaTicket.document.close();
    ventanaTicket.focus();
    setTimeout(() => { ventanaTicket.print(); }, 800);
}

// IMPRIMIR HISTORIAL COMPLETO
const btnHistorial = document.getElementById('btn-imprimir-historial');
if (btnHistorial) {
    btnHistorial.addEventListener('click', () => {
        if (!datosCliente) return;
        const ventanaHistorial = window.open('', 'PRINT', 'height=600,width=450');
        if (!ventanaHistorial || ventanaHistorial.closed) {
            alert("⚠️ Permite las ventanas emergentes para ver el historial.");
            return;
        }

        let filasPagos = '';
        datosCliente.cuotas.forEach((cuota) => {
            const fechaMostrar = cuota.estado === 'pagado' ? cuota.fecha_pago_real : cuota.fecha_esperada;
            filasPagos += `
                <tr>
                    <td style="border-bottom: 1px solid #ccc; padding: 6px;">${cuota.numero_pago}</td>
                    <td style="border-bottom: 1px solid #ccc; padding: 6px;">$${fmtMoneda(cuota.monto)}</td>
                    <td style="border-bottom: 1px solid #ccc; padding: 6px;">${fechaMostrar}</td>
                    <td style="border-bottom: 1px solid #ccc; padding: 6px;">${cuota.estado.toUpperCase()}</td>
                </tr>
            `;
        });

        ventanaHistorial.document.write(`
            <html>
                <head>
                    <title>Historial - ${datosCliente.nombre}</title>
                    <style>
                        body { font-family: 'Courier New', Courier, monospace; padding: 20px; font-size: 12px;}
                        h2, h3 { text-align: center; margin: 5px 0;}
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; text-align: center;}
                        .divisor { border-top: 1px dashed #333; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <h2>SISTEMA DE PAGOS</h2>
                    <h3>HISTORIAL DE MOVIMIENTOS</h3>
                    <div class="divisor"></div>
                    <p><strong>Cliente:</strong> ${datosCliente.nombre}</p>
                    <p><strong>Deuda Original:</strong> $${fmtMoneda(datosCliente.monto_total_deuda)}</p>
                    <p><strong>Saldo Restante:</strong> $${fmtMoneda(datosCliente.saldo_restante)}</p>
                    <table>
                        <thead>
                            <tr><th>#</th><th>Monto</th><th>Fecha</th><th>Estado</th></tr>
                        </thead>
                        <tbody>
                            ${filasPagos}
                        </tbody>
                    </table>
                    <div class="divisor"></div>
                    <p style="text-align: center;">Fin del historial</p>
                </body>
            </html>
        `);
        ventanaHistorial.document.close();
        ventanaHistorial.focus();
        setTimeout(() => { ventanaHistorial.print(); }, 800);
    });
}
