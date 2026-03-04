/**
 * FINANZAS PRO - JSC 
 * Versión 4.7: EDICIÓN COMERCIAL PROFESIONAL
 * Incluye: Dashboard de Métricas, Notificaciones, Proyección y Lógica 4.6 Original.
 */

const d = document;

// --- ESTADO Y UTILIDADES ---
let creditos = JSON.parse(localStorage.getItem('db_creditos')) || [];
let config = JSON.parse(localStorage.getItem('db_config')) || { capitalDisponible: 0, gananciasTotales: 0 };

const fCOP = (v) => new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    minimumFractionDigits: 0 
}).format(v);

const guardarEnStorage = () => {
    localStorage.setItem('db_creditos', JSON.stringify(creditos));
    localStorage.setItem('db_config', JSON.stringify(config));
    renderizar();
};

const fmtFecha = (f) => {
    if(!f) return "---";
    const fechaStr = typeof f === 'object' ? f.fecha : f;
    if(!fechaStr || typeof fechaStr !== 'string') return "---";
    const [y, m, d] = fechaStr.split('-');
    return `${d}/${m}/${y}`;
};

// --- [NUEVO] FEEDBACK VISUAL (TOASTS) ---
const notificar = (msj, color = "#2ecc71") => {
    const toast = d.createElement('div');
    toast.style = `
        position: fixed; bottom: 20px; right: 20px; 
        background: ${color}; color: white; padding: 12px 25px; 
        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000; font-family: sans-serif; font-weight: bold;
        animation: slideIn 0.5s ease-out;
    `;
    toast.innerText = msj;
    d.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
};

// --- [NUEVO] LÓGICA DEL DASHBOARD DE RENDIMIENTO ---
const actualizarDashboardExtra = () => {
    const hoyStr = new Date().toISOString().split('T')[0];
    const limiteSemana = new Date();
    limiteSemana.setDate(limiteSemana.getDate() + 7);
    const limiteStr = limiteSemana.toISOString().split('T')[0];

    let enCalle = 0;
    let moraCount = 0;
    let proyeccion7Dias = 0;

    creditos.forEach(c => {
        if (c.saldoTotal > 0) {
            enCalle += c.saldoTotal;
            if (c.proximoCobro < hoyStr) moraCount++;

            c.cronograma.forEach(q => {
                if (!q.pagado && q.fecha >= hoyStr && q.fecha <= limiteStr) {
                    proyeccion7Dias += c.valorCuota;
                }
            });
        }
    });

    if(d.getElementById('stats-en-calle')) d.getElementById('stats-en-calle').innerText = fCOP(enCalle);
    if(d.getElementById('stats-mora')) d.getElementById('stats-mora').innerText = `${moraCount} Clientes`;
    if(d.getElementById('stats-proyeccion')) d.getElementById('stats-proyeccion').innerText = fCOP(proyeccion7Dias);
};

// --- LÓGICA DE CÁLCULO (VISTA PREVIA) ---
const actualizarVistaTotal = () => {
    const monto = parseFloat(d.getElementById('monto').value) || 0;
    const tasaInteres = parseFloat(d.getElementById('interes').value) || 0;
    const interesPesos = monto * (tasaInteres / 100);
    const totalPagar = monto + interesPesos;

    if(d.getElementById('interes-pesos')) d.getElementById('interes-pesos').innerText = fCOP(interesPesos);
    if(d.getElementById('total-preview')) d.getElementById('total-preview').innerText = fCOP(totalPagar);
};

// --- LÓGICA DE NEGOCIO ---
const calcularCronograma = (cuotas, frecuencia, fechaInicio) => {
    const fechas = [];
    let base = new Date(fechaInicio);
    base.setMinutes(base.getMinutes() + base.getTimezoneOffset());

    for (let i = 0; i < cuotas; i++) {
        let proxima = new Date(base);
        if (frecuencia === "quincenal") {
            proxima.setDate(base.getDate() + (i * 15));
        } else {
            proxima.setMonth(base.getMonth() + i);
        }
        fechas.push(proxima.toISOString().split('T')[0]);
    }
    return fechas;
};

const crearCredito = () => {
    const campos = {
        nombre: d.getElementById('nombre').value.trim(),
        identidad: d.getElementById('identidad').value.trim(),
        telefono: d.getElementById('telefono').value.trim(),
        monto: parseFloat(d.getElementById('monto').value),
        interes: parseFloat(d.getElementById('interes').value) || 0,
        cuotas: parseInt(d.getElementById('cuotas').value) || 0,
        frecuencia: d.querySelector('input[name="frecuencia"]:checked')?.value || "quincenal",
        fechaPrimerPago: d.getElementById('fecha-primer-pago').value
    };

    if (!campos.nombre || !campos.fechaPrimerPago || isNaN(campos.monto) || campos.cuotas <= 0) {
        return notificar("⚠️ Completa los datos obligatorios", "#e74c3c");
    }
    
    if (creditos.some(c => c.identidad === campos.identidad && c.saldoTotal > 0)) {
        return notificar("❌ Cliente con crédito activo", "#e74c3c");
    }
    if (campos.monto > config.capitalDisponible) {
        return notificar("❌ Capital insuficiente", "#e74c3c");
    }

    const cronograma = calcularCronograma(campos.cuotas, campos.frecuencia, campos.fechaPrimerPago)
        .map(fecha => ({ fecha, pagado: false })); 

    const montoInteres = campos.monto * (campos.interes / 100);
    const saldoTotal = campos.monto + montoInteres;

    const nuevoCredito = {
        id: Date.now(),
        ...campos,
        montoPrestado: campos.monto,
        interesMonto: montoInteres,
        saldoTotal: saldoTotal,
        valorCuota: saldoTotal / campos.cuotas,
        fechaCreacion: new Date().toISOString().split('T')[0],
        proximoCobro: cronograma[0].fecha,
        cronograma,
        historial: []
    };

    config.capitalDisponible -= campos.monto;
    creditos.push(nuevoCredito);
    guardarEnStorage();
    
    d.querySelectorAll('input:not([type="radio"])').forEach(i => i.value = "");
    actualizarVistaTotal();
    notificar("✅ Crédito creado con éxito");
};

// --- GESTIÓN DE CRÉDITOS ---
const actualizarFechaCuota = (id, index, nuevaFecha) => {
    const c = creditos.find(i => i.id === id);
    if(typeof c.cronograma[index] === 'object') {
        c.cronograma[index].fecha = nuevaFecha;
    }
    if (index === 0) c.proximoCobro = nuevaFecha;
    guardarEnStorage();
};

const registrarAbono = (id) => {
    const c = creditos.find(i => i.id === id);
    const abono = parseFloat(prompt(`Saldo: ${fCOP(c.saldoTotal)}\n¿Monto del abono?`));
    
    if (!abono || abono <= 0 || abono > c.saldoTotal) return;

    const totalOriginal = c.montoPrestado + c.interesMonto;
    const ratio = abono / totalOriginal;
    const ganancia = c.interesMonto * ratio;
    const capitalRecuperado = abono - ganancia;

    config.gananciasTotales += ganancia;
    config.capitalDisponible += capitalRecuperado;
    c.saldoTotal -= abono;
    
    c.historial.push({ 
        fecha: new Date().toLocaleString(), 
        monto: abono, 
        ganancia: ganancia 
    });

    const idx = c.cronograma.findIndex(cuota => !cuota.pagado);
    if (idx !== -1) {
        c.cronograma[idx].pagado = true;
        const proxima = c.cronograma.find(cuota => !cuota.pagado);
        if (proxima) c.proximoCobro = proxima.fecha;
    }

    guardarEnStorage();
    notificar("💰 Abono registrado correctamente");
};

const deshacerUltimoAbono = (id) => {
    const c = creditos.find(i => i.id === id);
    if (c.historial.length === 0) return notificar("No hay abonos para deshacer", "#e67e22");

    if (confirm("¿Revertir el último abono?")) {
        const ultimo = c.historial.pop();
        const gananciaARestar = ultimo.ganancia || 0;

        c.saldoTotal += ultimo.monto;
        config.gananciasTotales -= gananciaARestar;
        config.capitalDisponible -= (ultimo.monto - gananciaARestar);

        const pagadas = c.cronograma.filter(q => q.pagado);
        if (pagadas.length > 0) {
            const ultimaPagada = pagadas[pagadas.length - 1];
            ultimaPagada.pagado = false;
            c.proximoCobro = ultimaPagada.fecha;
        }
        guardarEnStorage();
        notificar("↩️ Abono revertido", "#e67e22");
    }
};

// --- RENDERIZADO ---
function renderizar() {
    const lista = d.getElementById('lista-creditos');
    const busq = d.getElementById('buscador').value.toLowerCase();
    const filtro = d.getElementById('filtro-estado')?.value || 'todos';
    const hoy = new Date().toISOString().split('T')[0];
    
    lista.innerHTML = '';

    let filtrados = creditos.filter(c => 
        c.nombre.toLowerCase().includes(busq) || c.identidad.includes(busq)
    );

    if (filtro === 'pendientes') filtrados = filtrados.filter(c => c.saldoTotal > 0);
    if (filtro === 'pagados') filtrados = filtrados.filter(c => c.saldoTotal <= 0);

    filtrados.forEach(c => {
        const esMora = c.saldoTotal > 0 && c.proximoCobro < hoy;
        const card = d.createElement('div');
        card.className = `card ${c.saldoTotal <= 0 ? 'pagado' : (esMora ? 'mora' : '')}`;
        
        card.innerHTML = `
            <div class="card-header">
                <strong>${c.nombre}</strong>
                ${esMora ? '<span class="tag-vencido">VENCIDO</span>' : ''}
            </div>
            <p>ID: ${c.identidad} | Tel: ${c.telefono}</p>
            <p class="saldo-destacado">SALDO: ${fCOP(c.saldoTotal)}</p>
            <p>📅 Cobro: <b>${fmtFecha(c.proximoCobro)}</b></p>
            
            <details>
                <summary class="details-summary">Cronograma e Historial</summary>
                <div class="details-content">
                    <strong>Cuotas (Valor: ${fCOP(c.valorCuota)}):</strong>
                    ${c.cronograma.map((q, i) => `
                        <div class="date-input-row" style="${q.pagado ? 'opacity: 0.5; text-decoration: line-through;' : ''}">
                            <span>${q.pagado ? '✅' : '⏳'} Cuota ${i+1}:</span>
                            <input type="date" value="${q.fecha}" onchange="actualizarFechaCuota(${c.id}, ${i}, this.value)" ${q.pagado ? 'disabled' : ''}>
                        </div>
                    `).join('')}
                    <hr>
                    <button onclick="deshacerUltimoAbono(${c.id})" class="btn-sm" style="background:#e67e22; color:white; width:100%; margin-bottom:10px; cursor:pointer; border:none; padding:5px; border-radius:4px;">↩️ Deshacer Último Abono</button>
                    <strong>Historial de Abonos:</strong>
                    <ul class="history-list">
                        ${c.historial.map(h => `<li>${h.fecha} - ${fCOP(h.monto)}</li>`).join('')}
                    </ul>
                </div>
            </details>

            <div class="card-actions">
                <button onclick="registrarAbono(${c.id})" class="btn-primary">Abono</button>
                <button onclick="enviarWhatsApp(${c.id})" class="btn-whatsapp">WhatsApp</button>
                <button onclick="eliminarCredito(${c.id})" class="btn-danger">X</button>
            </div>
        `;
        lista.appendChild(card);
    });

    d.getElementById('caja-capital').innerText = fCOP(config.capitalDisponible);
    d.getElementById('caja-ganancias').innerText = fCOP(config.gananciasTotales);
    
    // Llamada a la nueva función de estadísticas
    actualizarDashboardExtra();
}

// --- WHATSAPP Y BACKUP ---
const enviarWhatsApp = (id) => {
    const c = creditos.find(i => i.id === id);
    const plan = c.cronograma.map((q, i) => 
        `📅 Cuota ${i+1} (${fmtFecha(q)}): ${q.pagado ? "✅ PAGADO" : "⏳ PENDIENTE (" + fCOP(c.valorCuota) + ")"}`
    ).join('\n');
    
    const msg = `*💸 JSC FINANZAS*\n👤 Cliente: ${c.nombre}\n💰 Saldo: ${fCOP(c.saldoTotal)}\n📅 Cobro: ${fmtFecha(c.proximoCobro)}\n\n*Detalle de Pagos:*\n${plan}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
};

const exportarDatos = () => {
    const blob = new Blob([JSON.stringify({ creditos, config })], { type: 'application/json' });
    const a = d.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Backup_JSC_${new Date().toLocaleDateString()}.json`;
    a.click();
    notificar("📥 Respaldo descargado");
};

const importarDatos = (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = JSON.parse(event.target.result);
        creditos = data.creditos || [];
        config = data.config || { capitalDisponible: 0, gananciasTotales: 0 };
        guardarEnStorage();
        notificar("📤 Datos importados con éxito", "#9b59b6");
    };
    reader.readAsText(e.target.files[0]);
};

// --- CONFIGURACIÓN DE CAPITAL ---
const setCapital = () => {
    const n = parseFloat(prompt("Definir Capital Inicial:", config.capitalDisponible));
    if(!isNaN(n)) {
        config.capitalDisponible = n;
        guardarEnStorage();
        notificar("💰 Capital actualizado");
    }
};

const eliminarCredito = (id) => {
    if(confirm("¿Eliminar este crédito permanentemente?")) {
        creditos = creditos.filter(c => c.id !== id);
        guardarEnStorage();
        notificar("🗑️ Crédito eliminado", "#e74c3c");
    }
};

// --- EVENTOS ---
d.getElementById('btn-crear')?.addEventListener('click', crearCredito);
d.getElementById('monto')?.addEventListener('input', actualizarVistaTotal);
d.getElementById('interes')?.addEventListener('input', actualizarVistaTotal);
d.getElementById('buscador')?.addEventListener('input', renderizar);
d.getElementById('filtro-estado')?.addEventListener('change', renderizar);

renderizar();

