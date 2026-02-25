/**
 * FINANZAS PRO - JSC
 * Sistema de Gestión de Créditos con Capitalización y Cronogramas
 */

const d = document;

// --- ESTADO DE LA APLICACIÓN ---
let creditos = JSON.parse(localStorage.getItem('db_creditos')) || [];
let config = JSON.parse(localStorage.getItem('db_config')) || { capitalDisponible: 0, gananciasTotales: 0 };

// --- UTILIDADES (HELPERS) ---
const fCOP = (v) => new Intl.NumberFormat('es-CO', { 
    style: 'currency', currency: 'COP', minimumFractionDigits: 0 
}).format(v);

const guardarEnStorage = () => {
    localStorage.setItem('db_creditos', JSON.stringify(creditos));
    localStorage.setItem('db_config', JSON.stringify(config));
    renderizar();
};

// --- LÓGICA DE CÁLCULO EN VIVO ---
const calcularTotalEnvivo = () => {
    const m = parseFloat(d.getElementById('monto').value) || 0;
    const i = parseFloat(d.getElementById('interes').value) || 0;
    const totalCalculado = m + (m * (i / 100));
    
    const display = d.getElementById('total-preview');
    if (display) display.innerText = fCOP(totalCalculado);
    return totalCalculado;
};

// --- LÓGICA FINANCIERA DE FECHAS ---
const calcularCronograma = (cuotas, frecuencia) => {
    const fechas = [];
    for (let i = 1; i <= cuotas; i++) {
        const fechaCuota = new Date();
        if (frecuencia === "quincenal") {
            fechaCuota.setDate(fechaCuota.getDate() + (i * 15));
        } else {
            fechaCuota.setMonth(fechaCuota.getMonth() + i);
        }
        fechas.push(fechaCuota.toLocaleDateString('es-CO'));
    }
    return fechas;
};

// --- ACCIONES DE CAJA ---
const setCapital = () => {
    const actual = config.capitalDisponible || 0;
    const nuevo = parseFloat(prompt("Definir Capital Total:", actual));
    if (!isNaN(nuevo)) {
        config.capitalDisponible = nuevo;
        guardarEnStorage();
    }
};

const actualizarInterfazCaja = () => {
    const capEl = d.getElementById('caja-capital');
    const ganEl = d.getElementById('caja-ganancias');
    if (capEl) capEl.innerText = fCOP(config.capitalDisponible);
    if (ganEl) ganEl.innerText = fCOP(config.gananciasTotales);
};

// --- GESTIÓN DE CRÉDITOS ---
const crearCredito = () => {
    const campos = {
        nombre: d.getElementById('nombre').value.trim(),
        identidad: d.getElementById('identidad').value.trim(),
        telefono: d.getElementById('telefono').value.trim(),
        monto: parseFloat(d.getElementById('monto').value),
        interes: parseFloat(d.getElementById('interes').value) || 0,
        cuotas: parseInt(d.getElementById('cuotas').value) || 0,
        frecuencia: d.querySelector('input[name="frecuencia"]:checked')?.value || "quincenal"
    };

    if (!campos.nombre || !campos.identidad || isNaN(campos.monto) || campos.cuotas <= 0) {
        return alert("⚠️ Datos incompletos o incorrectos.");
    }

    if (creditos.some(c => c.identidad === campos.identidad && c.saldoTotal > 0)) {
        return alert(`❌ El cliente CC ${campos.identidad} ya tiene un crédito activo.`);
    }

    if (campos.monto > config.capitalDisponible) {
        return alert("❌ No hay capital suficiente en caja.");
    }

    const cronograma = calcularCronograma(campos.cuotas, campos.frecuencia);

    const nuevoCredito = {
        id: Date.now(),
        ...campos,
        montoPrestado: campos.monto,
        interesMonto: campos.monto * (campos.interes / 100),
        saldoTotal: campos.monto * (1 + (campos.interes / 100)),
        fechaInicio: new Date().toLocaleDateString('es-CO'),
        proximoCobro: cronograma[0], // Sincronizado con Cuota 1
        cronograma,
        historial: []
    };

    config.capitalDisponible -= campos.monto;
    creditos.push(nuevoCredito);
    guardarEnStorage();
    limpiarFormulario();
    alert("✅ Crédito creado exitosamente.");
};

const registrarAbono = (id) => {
    const c = creditos.find(i => i.id === id);
    const abono = parseFloat(prompt(`Saldo: ${fCOP(c.saldoTotal)}\n¿Monto del abono?`));

    if (!abono || abono <= 0 || abono > c.saldoTotal) return alert("❌ Monto inválido.");

    const ratioInteres = c.interesMonto / (c.montoPrestado + c.interesMonto);
    const ganancia = abono * ratioInteres;
    const recuperacionCapital = abono - ganancia;

    config.gananciasTotales += ganancia;
    config.capitalDisponible += recuperacionCapital;
    
    c.saldoTotal -= abono;
    c.historial.push({ fecha: new Date().toLocaleString(), monto: abono });
    
    if (c.saldoTotal > 0) {
        c.proximoCobro = prompt("Confirmar próxima fecha de pago:", c.proximoCobro);
    }

    guardarEnStorage();
};

// --- INTERFAZ Y RENDERIZADO ---
const enviarWhatsApp = (id) => {
    const c = creditos.find(i => i.id === id);
    const cronoTexto = (c.cronograma || []).map((f, i) => `Cuota ${i+1}: ${f}`).join('%0A');
    
    const mensaje = `*RECIBO DE PAGO - JSC*%0A` +
                    `--------------------------%0A` +
                    `👤 *Cliente:* ${c.nombre}%0A` +
                    `💰 *Saldo Total:* ${fCOP(c.saldoTotal)}%0A` +
                    `📅 *Próximo Cobro:* ${c.proximoCobro}%0A` +
                    `--------------------------%0A` +
                    `*PLAN DE PAGOS:*%0A${cronoTexto}%0A` +
                    `--------------------------%0A` +
                    `¡Gracias por su puntualidad!`;
    
    window.open(`https://api.whatsapp.com/send?text=${mensaje}`);
};

function renderizar() {
    const contenedor = d.getElementById('lista-creditos');
    if (!contenedor) return;

    const busqueda = d.getElementById('buscador')?.value.toLowerCase() || "";
    const filtro = d.getElementById('filtro-estado')?.value || "todos";
    
    contenedor.innerHTML = '';

    const filtrados = creditos.filter(c => {
        const matchesBusqueda = c.nombre.toLowerCase().includes(busqueda) || c.identidad.includes(busqueda);
        const matchesFiltro = filtro === "todos" || 
                             (filtro === "pendientes" && c.saldoTotal > 0) || 
                             (filtro === "pagados" && c.saldoTotal <= 0);
        return matchesBusqueda && matchesFiltro;
    });

    filtrados.forEach(c => {
        const card = d.createElement('div');
        card.className = `card ${c.saldoTotal <= 0 ? 'pagado' : ''}`;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between">
                <strong>${c.nombre}</strong>
                <span class="tag">${c.frecuencia || 'N/A'}</span>
            </div>
            <p>ID: ${c.identidad}</p>
            <p class="saldo-destacado">SALDO: ${fCOP(c.saldoTotal)}</p>
            <p>📅 Cobro: <b>${c.proximoCobro || 'Finalizado'}</b></p>
            
            <details>
                <summary style="color:#2980b9; cursor:pointer">Ver Detalle</summary>
                <div style="font-size:0.8em; padding:10px; background:#f9f9f9; border-radius:5px; margin-top:5px">
                    <strong>Plan de Pagos:</strong><br>
                    ${c.cronograma ? c.cronograma.join(' | ') : 'No disponible'}
                    <hr>
                    <strong>Historial de Abonos:</strong>
                    <ul>${(c.historial || []).map(h => `<li>${h.fecha}: ${fCOP(h.monto)}</li>`).join('')}</ul>
                </div>
            </details>

            <div style="margin-top:10px; display:flex; gap:5px">
                <button onclick="registrarAbono(${c.id})" style="background:#27ae60; color:white; flex:1">Abono</button>
                <button onclick="enviarWhatsApp(${c.id})" style="background:#25d366; color:white; flex:1">WhatsApp</button>
                <button onclick="eliminarCredito(${c.id})" style="background:#e74c3c; color:white; width:40px">X</button>
            </div>
        `;
        contenedor.appendChild(card);
    });
    actualizarInterfazCaja();
}

const eliminarCredito = (id) => {
    if (confirm("¿Seguro que desea eliminar este crédito?")) {
        creditos = creditos.filter(c => c.id !== id);
        guardarEnStorage();
    }
};

const limpiarFormulario = () => {
    ['nombre', 'identidad', 'telefono', 'monto', 'interes', 'cuotas'].forEach(id => {
        const el = d.getElementById(id);
        if (el) el.value = '';
    });
    const tp = d.getElementById('total-preview');
    if (tp) tp.innerText = '$ 0';
};

// --- INICIALIZACIÓN ---

// Escuchar cambios para calcular total en vivo
d.getElementById('monto')?.addEventListener('input', calcularTotalEnvivo);
d.getElementById('interes')?.addEventListener('input', calcularTotalEnvivo);

// Botón crear
d.getElementById('btn-crear')?.addEventListener('click', crearCredito);

// Buscador
d.getElementById('buscador')?.addEventListener('input', renderizar);

// Carga inicial
renderizar();

// --- FUNCIONES DE RESPALDO (Siguen ahí) ---
const exportarDatos = () => {
    const data = JSON.stringify({ creditos, config });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = d.createElement('a');
    a.href = url;
    a.download = `Respaldo_${new Date().toLocaleDateString()}.json`;
    a.click();
};

const importarDatos = (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const { creditos: c, config: cfg } = JSON.parse(event.target.result);
        creditos = c; config = cfg;
        guardarEnStorage();
    };
    reader.readAsText(e.target.files[0]);
};
