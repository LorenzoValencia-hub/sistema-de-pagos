import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js"; 

// 1. TUS LLAVES DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBDkoXL1SAcBT-J51THYeN77WH4LrlSfeg",
  authDomain: "sistema-de-pagos-6a6dc.firebaseapp.com",
  projectId: "sistema-de-pagos-6a6dc",
  storageBucket: "sistema-de-pagos-6a6dc.firebasestorage.app",
  messagingSenderId: "531499153358",
  appId: "1:531499153358:web:b38cb1b0c7f7cdd66a5d9f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

const urlParams = new URLSearchParams(window.location.search);
const idCliente = urlParams.get('id');
let datosCliente = null;

// 2. SEGURIDAD: VERIFICAR SI HAY SESIÓN ACTIVA
onAuthStateChanged(auth, (user) => {
    if (user) {
        cargarCliente(); 
    } else {
        window.location.href = "index.html"; 
    }
});

// 3. CARGAR DATOS DEL CLIENTE DESDE FIREBASE
async function cargarCliente() {
    if (!idCliente) {
        alert("Error: No se encontró el ID del cliente.");
        window.location.href = "panel.html";
        return;
    }

    try {
        const docRef = doc(db, "clientes", idCliente);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            datosCliente = docSnap.data();
            
            document.getElementById('nombre-cliente').innerText = datosCliente.nombre;
            document.getElementById('deuda-total').innerText = '$' + (datosCliente.monto_total_deuda || 0);
            document.getElementById('saldo-restante').innerText = '$' + (datosCliente.saldo_restante || 0);

            renderizarTablaPagos();
        } else {
            alert("Cliente no encontrado en la base de datos.");
            window.location.href = "panel.html";
        }
    } catch (error) {
        console.error("Error al cargar cliente:", error);
        document.getElementById('nombre-cliente').innerText = "Error al cargar datos";
    }
}

// 4. DIBUJAR LAS TARJETAS DE PAGOS Y BOTONES
function renderizarTablaPagos() {
    const contenedor = document.getElementById('lista-pagos');
    contenedor.innerHTML = '';

    if(!datosCliente.cuotas) return;

    datosCliente.cuotas.forEach((cuota, index) => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'pago-card';
        
        const badgeClass = cuota.estado === 'pagado' ? 'badge' : 'badge pendiente';
        
        // Área del botón: Si debe, sale botón verde gigante. Si pagó, sale fecha y botón de Ticket.
        let zonaAccion = '';
        if (cuota.estado === 'pendiente') {
            zonaAccion = `
                <button class="btn-cobrar" style="width: 100%; padding: 14px; font-size: 16px;" onclick="procesarPago(${index})">
                    💰 Registrar Pago
                </button>
            `;
        } else {
            zonaAccion = `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #e2e8f0; padding: 12px; border-radius: 8px;">
                    <span style="color: var(--text-muted); font-size: 13px; font-weight: 700;">
                        ✅ Pagado: <br>${cuota.fecha_pago_real.split(' ')[0]}
                    </span>
                    <button onclick="reimprimirTicket(${index})" style="background: var(--info-color); color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        📄 Ver Ticket
                    </button>
                </div>
            `;
        }

        // Armamos la tarjeta completa
        tarjeta.innerHTML = `
            <div class="pago-header">
                <h4>Pago ${cuota.numero_pago} de ${datosCliente.cantidad_pagos}</h4>
                <span class="${badgeClass}">${cuota.estado.toUpperCase()}</span>
            </div>
            <div class="pago-body">
                <div class="pago-info">
                    <p>Fecha Esperada</p>
                    <strong>${cuota.fecha_esperada}</strong>
                </div>
                <div class="pago-info" style="text-align: right;">
                    <p>Monto</p>
                    <strong>$${cuota.monto}</strong>
                </div>
            </div>
            <div class="pago-actions">
                ${zonaAccion}
            </div>
        `;
        
        contenedor.appendChild(tarjeta);
    });
}

// 5. FUNCIÓN PRINCIPAL PARA COBRAR UN PAGO
window.procesarPago = async function(indexCuota) {
    const cuota = datosCliente.cuotas[indexCuota];
    
    const confirmar = confirm(`¿Confirmas el PAGO ${cuota.numero_pago} por la cantidad de $${cuota.monto}?`);
    if(!confirmar) return;

    cuota.estado = 'pagado';
    const fechaHoy = new Date();
    cuota.fecha_pago_real = fechaHoy.toLocaleDateString('es-MX') + ' ' + fechaHoy.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'});
    
    const nuevoSaldo = (datosCliente.saldo_restante - cuota.monto).toFixed(2);
    datosCliente.saldo_restante = parseFloat(nuevoSaldo);

    try {
        const docRef = doc(db, "clientes", idCliente);
        await updateDoc(docRef, {
            cuotas: datosCliente.cuotas,
            saldo_restante: datosCliente.saldo_restante
        });

        cargarCliente(); 
        
        setTimeout(() => {
            const opcion = confirm("✅ Pago registrado con éxito.\n\n¿Quieres COMPARTIR el ticket por WhatsApp?\n\n(Dale 'Cancelar' para Imprimir/Guardar PDF)");
            if (opcion) {
                compartirTicketTexto(cuota);
            } else {
                generarTicket(cuota);
            }
        }, 500);

    } catch (error) {
        console.error("Error al registrar pago:", error);
        alert("Error al procesar el pago. Revisa la consola.");
    }
}

// 6. FUNCIÓN PARA REIMPRIMIR UN TICKET VIEJO
window.reimprimirTicket = function(indexCuota) {
    const cuota = datosCliente.cuotas[indexCuota];
    
    const opcion = confirm(`📄 RECUPERANDO TICKET DEL PAGO ${cuota.numero_pago}\n\n¿Qué deseas hacer?\n\n👉 [ACEPTAR] = Compartir por WhatsApp\n👉 [CANCELAR] = Ver para Imprimir / Guardar PDF`);
    
    if (opcion) {
        compartirTicketTexto(cuota);
    } else {
        generarTicket(cuota); 
    }
}

// 7. COMPARTIR POR WHATSAPP
function compartirTicketTexto(cuota) {
    const textoTicket = `🧾 *COMPROBANTE DE PAGO* 🧾\n\n👤 *Cliente:* ${datosCliente.nombre}\n📅 *Fecha:* ${cuota.fecha_pago_real}\n💰 *Monto Pagado:* $${cuota.monto}\n🔢 *Pago:* ${cuota.numero_pago} de ${datosCliente.cantidad_pagos}\n\n📉 *Préstamo Original:* $${datosCliente.monto_prestado || datosCliente.monto_total_deuda}\n💵 *Saldo Restante:* $${datosCliente.saldo_restante}\n\n✅ _¡Gracias por su pago!_`;

    if (navigator.share) {
        navigator.share({
            title: 'Ticket de Pago',
            text: textoTicket
        }).catch((error) => console.log('Error al compartir', error));
    } else {
        const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoTicket)}`;
        window.open(urlWhatsApp, '_blank');
    }
}

// 8. DISEÑAR E IMPRIMIR TICKET (Normal o PDF sin cerrarse)
function generarTicket(cuota) {
    const ventanaTicket = window.open('', 'PRINT', 'height=600,width=400');
    if (!ventanaTicket || ventanaTicket.closed) {
        alert("⚠️ Permite las ventanas emergentes para ver el ticket."); return;
    }
    
    ventanaTicket.document.write(`
        <html>
            <head>
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
                    <p>Monto Pagado: $${cuota.monto}</p>
                    <div class="divisor"></div>
                    <p>Deuda Total: $${datosCliente.monto_total_deuda}</p>
                    <p style="font-weight: bold; font-size: 16px;">SALDO RESTANTE: $${datosCliente.saldo_restante}</p>
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
    // Le damos 1 segundo y ya NO CERRAMOS la ventana
    setTimeout(() => { ventanaTicket.print(); }, 1000);
}

// 9. IMPRIMIR HISTORIAL COMPLETO
const btnHistorial = document.getElementById('btn-imprimir-historial');
if(btnHistorial) {
    btnHistorial.addEventListener('click', () => {
        const ventanaHistorial = window.open('', 'PRINT', 'height=600,width=400');
        if (!ventanaHistorial || ventanaHistorial.closed) {
            alert("⚠️ Permite las ventanas emergentes para ver el historial."); return;
        }

        let filasPagos = '';
        datosCliente.cuotas.forEach(cuota => {
            const fechaMostrar = cuota.estado === 'pagado' ? cuota.fecha_pago_real : cuota.fecha_esperada;
            filasPagos += `
                <tr>
                    <td style="border-bottom: 1px solid #ccc; padding: 5px;">${cuota.numero_pago}</td>
                    <td style="border-bottom: 1px solid #ccc; padding: 5px;">$${cuota.monto}</td>
                    <td style="border-bottom: 1px solid #ccc; padding: 5px;">${fechaMostrar}</td>
                    <td style="border-bottom: 1px solid #ccc; padding: 5px;">${cuota.estado.toUpperCase()}</td>
                </tr>
            `;
        });

        ventanaHistorial.document.write(`
            <html>
                <head>
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
                    <p><strong>Deuda Original:</strong> $${datosCliente.monto_total_deuda}</p>
                    <p><strong>Saldo Restante:</strong> $${datosCliente.saldo_restante}</p>
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
        // Le damos 1 segundo y ya NO CERRAMOS la ventana
        setTimeout(() => { ventanaHistorial.print(); }, 1000);
    });
}