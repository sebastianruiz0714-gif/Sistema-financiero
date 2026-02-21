/**
 * Finanzas Pro - Lógica de Gestión de Créditos
 * Versión: 2.0 (Full Responsive + Buscador + COP)
 */

const d = document;
let creditos = JSON.parse(localStorage.getItem('db_creditos')) || [];

// --- UTILIDADES ---

// Formatear a Peso Colombiano (COP)
const fCOP = (v) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(v);
};

// Cálculo dinámico del total con intereses
const calcularTotal = () => {
    const monto = parseFloat(d.getElementById('monto').value) || 0;
    const interes = parseFloat(d.getElementById('interes').value) || 0;
    const totalCalculado = monto + (monto * (interes / 100));
    
    d.getElementById('total').innerText = fCOP(totalCalculado);
    return totalCalculado;
};

// Escuchadores para calcular en tiempo real
d.getElementById('monto').addEventListener('input', calcularTotal);
d.getElementById('interes').addEventListener('input', calcularTotal);

// --- ACCIONES PRINCIPALES ---

// Crear nuevo crédito
d.getElementById('crear').onclick = () => {
    const nombre = d.getElementById('nombre').value;
    const identidad = d.getElementById('identidad').value;
    const telefono = d.getElementById('telefono').value;
    const cuotas = d.getElementById('cuotas').value;
    const monto = parseFloat(d.getElementById('monto').value);
    const interes = parseFloat(d.getElementById('interes').value);
    const frecuencia = d.querySelector('input[name="frecuencia"]:checked').value;

    if (!nombre || isNaN(monto)) {
        alert("⚠️ Por favor, ingresa al menos el nombre y el monto del crédito.");
        return;
    }

    const nuevoCredito = {
        id: Date.now(),
        nombre,
        identidad,
        telefono,
        montoInicial: monto,
        interes: interes,
        saldo: calcularTotal(),
        cuotas,
        frecuencia,
        fecha: new Date().toLocaleDateString('es-CO')
    };

    creditos.push(nuevoCredito);
    guardarYRefrescar();
    limpiarFormulario();
};

// Registrar Abonos o Editar Información
const gestionar = (id) => {
    const c = creditos.find(item => item.id === id);
    const menu = prompt(
        `GESTIÓN DE CRÉDITO: ${c.nombre}\n` +
        `Saldo actual: ${fCOP(c.saldo)}\n\n` +
        `Elige una opción:\n` +
        `1. Registrar Pago / Abono\n` +
        `2. Editar datos del cliente\n` +
        `3. Cancelar`
    );

    if (menu === "1") {
        const abono = parseFloat(prompt(`¿Cuánto desea abonar? (Saldo: ${fCOP(c.saldo)})`));
        if (abono > 0 && abono <= c.saldo) {
            c.saldo -= abono;
            alert(`✅ Abono aplicado. Nuevo saldo: ${fCOP(c.saldo)}`);
            guardarYRefrescar();
        } else {
            alert("❌ Monto inválido.");
        }
    } else if (menu === "2") {
        c.nombre = prompt("Nombre completo:", c.nombre) || c.nombre;
        c.identidad = prompt("Número de identidad:", c.identidad) || c.identidad;
        c.telefono = prompt("Número de contacto:", c.telefono) || c.telefono;
        guardarYRefrescar();
    }
};

// Borrar crédito
const eliminar = (id) => {
    if (confirm("¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.")) {
        creditos = creditos.filter(c => c.id !== id);
        guardarYRefrescar();
    }
};

// WhatsApp (Abrir lista de contactos para seleccionar)
const enviarWA = (id) => {
    const c = creditos.find(item => item.id === id);
    const cuotaVlr = c.saldo > 0 ? (c.saldo / (parseInt(c.cuotas) || 1)) : 0;
    
    const msg = `*COMPROBANTE FINANCIERO*%0A` +
                `--------------------------%0A` +
                `👤 *Cliente:* ${c.nombre}%0A` +
                `🆔 *CC:* ${c.identidad}%0A` +
                `💰 *Saldo Pendiente:* ${fCOP(c.saldo)}%0A` +
                `🗓️ *Plan:* ${c.cuotas} cuotas (${c.frecuencia})%0A` +
                `💵 *Sugerencia cuota:* ${fCOP(cuotaVlr)}%0A` +
                `--------------------------%0A` +
                `_Generado por Finanzas Pro Local._`;

    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
};

// --- RENDERIZADO Y PERSISTENCIA ---

const guardarYRefrescar = () => {
    localStorage.setItem('db_creditos', JSON.stringify(creditos));
    renderizar();
};

const renderizar = (busqueda = "") => {
    const lista = d.getElementById('lista');
    lista.innerHTML = '';

    const filtrados = creditos.filter(c => 
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
        c.identidad.includes(busqueda)
    );

    filtrados.forEach(c => {
        const esPagado = c.saldo <= 0;
        lista.innerHTML += `
            <div class="card item-lista ${esPagado ? 'pagado' : ''}">
                <div class="info">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start">
                        <strong>${c.nombre}</strong>
                        <span class="tag">${c.fecha}</span>
                    </div>
                    <div style="font-size: 0.85em; color: #666; margin: 5px 0;">
                        <p>🆔 CC: ${c.identidad} | 📞 Tel: ${c.telefono}</p>
                        <p>📊 Interés: ${c.interes}% | Plan: ${c.cuotas} (${c.frecuencia})</p>
                    </div>
                    <div style="margin-top:10px; border-top: 1px solid #eee; padding-top:8px">
                        <span style="font-weight:bold; color: var(--dark)">SALDO: ${fCOP(c.saldo)}</span>
                    </div>
                </div>
                <div class="acciones-vertical">
                    <button onclick="enviarWA(${c.id})" class="btn-wa" style="background:#25d366; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer">WhatsApp</button>
                    <button onclick="gestionar(${c.id})" class="btn-edit" style="background:#f1c40f; border:none; padding:8px; border-radius:6px; cursor:pointer">Gestionar</button>
                    <button onclick="eliminar(${c.id})" class="btn-del" style="background:#e74c3c; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer">Eliminar</button>
                </div>
            </div>
        `;
    });
};

// Buscador
d.getElementById('buscador').addEventListener('input', (e) => {
    renderizar(e.target.value);
});

// Limpiar formulario después de crear
const limpiarFormulario = () => {
    ['nombre', 'identidad', 'telefono', 'monto', 'interes', 'cuotas'].forEach(id => {
        d.getElementById(id).value = '';
    });
    d.getElementById('total').innerText = '$ 0';
};

// Carga Inicial
renderizar();