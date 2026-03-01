/**
 * FINANZAS PRO - JSC 
 * Versión 3.1: Fecha de primer pago personalizable + Cronograma exacto
 * Lógica de negocio y manejo de interfaz.
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
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
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
        return alert("⚠️ Por favor, selecciona la fecha del primer pago y completa los datos.");
    }
    
    if (creditos.some(c => c.identidad === campos.identidad && c.saldoTotal > 0)) {
        return alert("❌ Este cliente ya tiene un crédito activo.");
    }
    if (campos.monto > config.capitalDisponible) {
        return alert("❌ No hay capital suficiente disponible.");
    }

    const cronograma = calcularCronograma(campos.cuotas, campos.frecuencia, campos.fechaPrimerPago);

    const montoInteres = campos.monto * (campos.interes / 100);
    const saldoTotal = campos.monto + montoInteres;
    const valorCuota = saldoTotal / campos.cuotas; 

    const nuevoCredito = {
        id: Date.now(),
        ...campos,
        montoPrestado: campos.monto,
        interesMonto: montoInteres,
        saldoTotal: saldoTotal,
        valorCuota: valorCuota,
        fechaCreacion: new Date().toISOString().split('T')[0],
        proximoCobro: cronograma[0],
        cronograma,
        historial: []
    };

    config.capitalDisponible -= campos.monto;
    creditos.push(nuevoCredito);
    guardarEnStorage();
    
    d.querySelectorAll('input:not([type="radio"])').forEach(i => i.value = "");
    d.getElementById('total-preview').innerText = "$ 0";
};

// --- GESTIÓN DE CRÉDITOS ---
const actualizarFechaCuota = (id, index, nuevaFecha) => {
    const c = creditos.find(i => i.id === id);
    c.cronograma[index] = nuevaFecha;
    
    if (index === 0) c.proximoCobro = nuevaFecha;
    guardarEnStorage();
};

const registrarAbono = (id) => {
    const c = creditos.find(i => i.id === id);
    const abono = parseFloat(prompt(`Saldo: ${fCOP(c.saldoTotal)}\n¿Monto del abono?`));
    
    if (!abono || abono <= 0 || abono > c.saldoTotal) return;

    const totalOriginal = c.montoPrestado + c.interesMonto;
    const ratioAbono = abono / totalOriginal;
    
    const ganancia = c.interesMonto * ratioAbono;
    const capitalRecuperado = abono - ganancia;

    config.gananciasTotales += ganancia;
    config.capitalDisponible += capitalRecuperado;
    
    c.saldoTotal -= abono;
    c.historial.push({ fecha: new Date().toLocaleString(), monto: abono });
    
    if (c.saldoTotal > 0) {
        c.proximoCobro = prompt("Confirmar próxima fecha de cobro (YYYY-MM-DD):", c.proximoCobro);
    }
    guardarEnStorage();
};

const enviarWhatsApp = (id) => {
    const c = creditos.find(i => i.id === id);
    
    const plan = c.cronograma.map((f, i) => 
        `📅 Cuota ${i+1} (${fmtFecha(f)}): ${fCOP(c.valorCuota)}`
    ).join('\n');
    
    const mensaje = 
        `*💸 RECIBO DE CRÉDITO - JSC 💸*\n` +
        `---------------------------\n` +
        `👤 *Cliente:* ${c.nombre}\n` +
        `💰 *Total a Pagar:* ${fCOP(c.saldoTotal)}\n` +
        `🔢 *Cuotas:* ${c.cuotas}\n` +
        `💵 *Valor Cuota:* ${fCOP(c.valorCuota)}\n` +
        `📅 *Próximo Cobro:* ${fmtFecha(c.proximoCobro)}\n` +
        `---------------------------\n` +
        `*🗓️ PLAN DE PAGOS:*\n` +
        `${plan}\n` +
        `---------------------------\n` +
        `¡Gracias por tu pago!`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`);
};

// --- RENDERIZADO DE INTERFAZ ---
function renderizar() {
    const lista = d.getElementById('lista-creditos');
    const busq = d.getElementById('buscador').value.toLowerCase();
    const hoy = new Date().toISOString().split('T')[0];
    lista.innerHTML = '';

    creditos.filter(c => c.nombre.toLowerCase().includes(busq) || c.identidad.includes(busq))
    .forEach(c => {
        const esMora = c.saldoTotal > 0 && c.proximoCobro < hoy;
        const card = d.createElement('div');
        
        card.className = `card ${c.saldoTotal <= 0 ? 'pagado' : (esMora ? 'mora' : '')}`;
        
        card.innerHTML = `
            <div class="card-header">
                <strong>${c.nombre}</strong>
                ${esMora ? '<span class="tag-vencido">VENCIDO</span>' : ''}
            </div>
            <p>ID: ${c.identidad} | Tel: ${c.telefono || 'N/A'}</p>
            <p class="saldo-destacado">SALDO: ${fCOP(c.saldoTotal)}</p>
            <p>📅 Cobro: <b>${fmtFecha(c.proximoCobro)}</b></p>
            
            <details>
                <summary class="details-summary">Editar Cronograma / Historial</summary>
                <div class="details-content">
                    <strong>Calendario de Cuotas (Fijas):</strong><br>
                    ${c.cronograma.map((f, i) => `
                        <div class="date-input-row">
                            <span>Cuota ${i+1}:</span>
                            <input type="date" value="${f}" onchange="actualizarFechaCuota(${c.id}, ${i}, this.value)">
                        </div>
                    `).join('')}
                    <hr>
                    <strong>Abonos realizados:</strong>
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
}

// --- ACCIONES DE DATOS Y EVENTOS ---
const eliminarCredito = (id) => {
    if(confirm("¿Eliminar registro?")) {
        creditos = creditos.filter(c => c.id !== id);
        guardarEnStorage();
    }
};

const setCapital = () => {
    const n = parseFloat(prompt("Definir Capital:", config.capitalDisponible));
    if(!isNaN(n)){
        config.capitalDisponible = n;
        guardarEnStorage();
    }
};

const exportarDatos = () => {
    const blob = new Blob([JSON.stringify({ creditos, config })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = d.createElement('a');
    a.href = url;
    a.download = `Respaldo_JSC_${new Date().toLocaleDateString()}.json`;
    a.click();
};

const importarDatos = (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = JSON.parse(event.target.result);
        creditos = data.creditos;
        config = data.config;
        guardarEnStorage();
    };
    reader.readAsText(e.target.files[0]);
};

// --- EVENTOS ---
d.getElementById('btn-crear')?.addEventListener('click', crearCredito);

const inputMonto = d.getElementById('monto');
const inputInteres = d.getElementById('interes');

const actualizarVistaTotal = () => {
    const monto = parseFloat(inputMonto.value) || 0;
    const interes = parseFloat(inputInteres.value) || 0;
    const total = monto + (monto * (interes / 100));
    d.getElementById('total-preview').innerText = fCOP(total);
};

inputMonto?.addEventListener('input', actualizarVistaTotal);
inputInteres?.addEventListener('input', actualizarVistaTotal);

d.getElementById('buscador')?.addEventListener('input', renderizar);

renderizar();
