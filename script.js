/* ================================================================= */
/* 1. IMPORTACIÓN OBLIGATORIA (SIEMPRE EN LA LÍNEA 1)                */
/* ================================================================= */
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

/* ================= CONFIGURACIÓN GLOBAL ================= */
const API_URL = '/api/';

/* ======================================================= */
/* LOGICA TASACION IA (MOCK)                               */
/* ======================================================= */

window.startAIAppraisal = function (e) {
    e.preventDefault();

    // 1. Get Inputs
    const comuna = document.getElementById('ai-comuna').value;
    const m2 = parseInt(document.getElementById('ai-m2').value) || 0;
    const dorms = parseInt(document.getElementById('ai-dorms').value) || 0;
    const baths = parseInt(document.getElementById('ai-baths').value) || 0;
    const type = document.getElementById('ai-type').value;

    /* if (!comuna || m2 < 10) {
        alert("Por favor completa los campos correctamente.");
        return;
    }*/

    // 2. Hide Form, Show Processing
    document.getElementById('ai-step-form').style.display = 'none';
    document.getElementById('ai-step-processing').style.display = 'block';

    // 3. Simulate "Thinking" steps
    const consoleMsg = document.getElementById('ai-console-msg');
    const steps = [
        "Conectando a base de datos del SII...",
        `Analizando valor m² en ${comuna ? comuna.replace('_', ' ') : 'zona'}...`,
        "Cruzando con propiedades vendidas recientemente...",
        "Calculando depreciación por antigüedad...",
        "Generando informe final..."
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
        if (stepIndex < steps.length) {
            consoleMsg.innerText = steps[stepIndex];
            stepIndex++;
        } else {
            clearInterval(interval);
            finishAppraisal(comuna, type, m2, dorms, baths);
        }
    }, 800); // Change message every 800ms
}

function finishAppraisal(comuna, type, m2, dorms, baths) {
    // 4. Calculate Mock Value
    // Base Rates per m2 (UF) approx
    const rates = {
        'los_andes': 35,
        'san_felipe': 32,
        'rinconada': 38,
        'calle_larga': 34,
        'san_esteban': 30
    };

    let baseRate = rates[comuna] || 33; // Default
    if (type === 'depto') baseRate = baseRate * 1.1; // Deptos usually higher m2 value
    if (type === 'terreno') baseRate = baseRate * 0.4; // Land cheaper per m2

    // Modifiers
    let valUF = m2 * baseRate;
    valUF += (dorms * 50); // +50 UF per dorm
    valUF += (baths * 80); // +80 UF per bath

    // Randomize slightly (+/- 5%) to make it look "organic"
    const randomFactor = 0.95 + (Math.random() * 0.1);
    let finalUF = Math.round(valUF * randomFactor);

    // Create Range
    let minUF = Math.floor(finalUF * 0.97);
    let maxUF = Math.ceil(finalUF * 1.03);

    // Format
    const formatter = new Intl.NumberFormat('es-CL');
    const ufValueCLP = 37500; // Hardcoded approximation

    const priceEl = document.getElementById('ai-result-price');
    const clpEl = document.getElementById('ai-result-clp');

    if (priceEl) priceEl.innerText = `UF ${formatter.format(minUF)} - ${formatter.format(maxUF)}`;
    if (clpEl) clpEl.innerText = `$${formatter.format(minUF * ufValueCLP)} - $${formatter.format(maxUF * ufValueCLP)} aprox.`;

    // 5. Show Result
    document.getElementById('ai-step-processing').style.display = 'none';
    document.getElementById('ai-step-result').style.display = 'block';
}

window.resetAI = function () {
    document.getElementById('ai-step-result').style.display = 'none';
    document.getElementById('ai-step-form').style.display = 'block';
}
let properties = [];
let currentUser = null;

window.obtenerValorUFActual = function () {
    const memoriaRaw = localStorage.getItem('indicadores_chile_v5_n8n');
    if (memoriaRaw) {
        try {
            const memoriaObj = JSON.parse(memoriaRaw);
            if (memoriaObj && memoriaObj.datos && memoriaObj.datos.uf) {
                return parseFloat(memoriaObj.datos.uf);
            }
        } catch (e) {
            console.error("Error leyendo caché de indicadores:", e);
        }
    }
    return 38000; // Valor de respaldo
};

// VARIABLES DE PAGINACIÓN
let currentPage = 1;
let rows = 9;
let filteredData = [];

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    cargarIndicadores(); // ✅ ACTIVADO: Carga indicadores con estrategia blindada
    setupNavigation();
    setupChatbot();
    setupContactForm();


    const page = document.body.getAttribute('data-page');

    // ======================================================
    // CASO 1: PANEL PRINCIPAL DEL CLIENTE
    // ======================================================
    if (page === 'client-dashboard') {
        if (!currentUser) { window.location.href = 'index.html'; return; }
        const headerName = document.getElementById('header-username');
        if (headerName) headerName.textContent = currentUser.nombre_completo.split(' ')[0];
        return;
    }

    // ======================================================
    // CASO 2: CONFIGURACIÓN CLIENTE
    // ======================================================
    if (page === 'client-config') {
        if (!currentUser) { window.location.href = 'index.html'; return; }

        // Check for forced password change
        const params = new URLSearchParams(window.location.search);
        if (params.get('change_password') === 'true') {
            setTimeout(() => {
                alert("⚠️ Has ingresado con una contraseña temporal.\nPor favor, crea una nueva contraseña ahora.");
                const firstInput = document.getElementById('current-password');
                if (firstInput) firstInput.focus();
            }, 500);
        }

        const form = document.getElementById('change-password-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const currentP = document.getElementById('current-password').value;
                const newP = document.getElementById('new-password').value;
                const confP = document.getElementById('confirm-password').value;

                if (!currentP) { alert("Ingresa tu contraseña actual"); return; }
                if (newP !== confP) { alert("Las nuevas contraseñas no coinciden"); return; }
                if (newP.length < 4) { alert("La nueva contraseña es muy corta"); return; }

                const btn = form.querySelector('button');
                btn.textContent = "Guardando...";
                btn.disabled = true;

                try {
                    const res = await fetch(`${API_URL}users/${currentUser.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: currentUser.email,
                            telefono: currentUser.telefono,
                            password: newP,
                            currentPassword: currentP
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert("✅ Contraseña actualizada correctamente.");
                        currentUser = data.user;
                        localStorage.setItem('user', JSON.stringify(currentUser));
                        window.location.href = 'cliente.html';
                    } else {
                        alert("❌ Error: " + data.message);
                    }
                } catch (err) { alert("Error de conexión"); }
                finally { btn.textContent = "Guardar Cambios"; btn.disabled = false; }
            });
        }
        return;
    }

    // ======================================================
    // CASO 3: ADMIN Y LÓGICA GENERAL
    // ======================================================
    if (page === 'admin-config') {
        setupAdminConfig();
        const params = new URLSearchParams(window.location.search);
        if (params.get('change_password') === 'true') {
            setTimeout(() => {
                alert("⚠️ Has ingresado con una contraseña temporal.\nPor favor, crea una nueva contraseña ahora.");
                const firstInput = document.getElementById('current-password');
                if (firstInput) firstInput.focus();
            }, 500);
        }
    }
    if (page === 'admin-lista') { updateAdminList(); }
    if (page === 'admin-historial') { loadHistoryList(); }

    // CASO 4: PÁGINAS PÚBLICAS
    if (!page || page === 'home' || page.includes('venta') || page.includes('arriendo')) {
        setupHomeSearch();
        readUrlFilters();
        initPageLogic();
        setupSearchAutocomplete();
        setupRecoveryLogic(); // Lógica recuperar contraseña
    }

    // CASO ESPECIAL: PUBLICAR PROPIEDAD (Aquí activamos la IA)
    if (page === 'admin-publicar') {
        setupPropertyForm();
        setupAiDescriptionGenerator(); // <--- ✅ AQUÍ ACTIVAMOS A GEMINI

        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id');
        if (editId) loadPropertyForEdit(editId);
    }
});



/* ======================================================= */
/* EXPORTAR FUNCIONES GLOBALES (PARA HTML)                 */
/* ======================================================= */

window.handleLogout = function () {
    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
};

/* ================= 1. AUTENTICACIÓN Y USUARIOS ================= */
/* ================= 1. AUTENTICACIÓN Y USUARIOS (MODIFICADO) ================= */
function initAuth() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) { currentUser = JSON.parse(storedUser); }

    // NOTA: updateUserUI se llamará pero puede que el botón aún no esté.
    // Lo manejaremos con un Observer o simplemente esperando el click.
    updateUserUI(); // Intenta actualizar si ya cargó, si no, no pasa nada por ahora.

    // --- AQUÍ ESTÁ EL CAMBIO IMPORTANTE: DELEGACIÓN DE EVENTOS ---
    document.addEventListener('click', (e) => {
        // A. DETECTAR CLIC EN LOGIN
        const loginBtn = e.target.closest('#login-btn');
        if (loginBtn) {
            e.preventDefault();
            if (currentUser) {
                // Si ya hay usuario, redirige según rol
                if (currentUser.rol === 'admin') window.location.href = 'admin-dashboard.html';
                else window.location.href = 'cliente.html';
            } else {
                // Si no, abre el modal
                const modal = document.getElementById('login-modal');
                if (modal) modal.style.display = 'block';
            }
        }

        // B. DETECTAR CLIC EN CERRAR MODALES (X)
        if (e.target.closest('.close-modal')) {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        }

        // C. CERRAR SI CLICKEA FUERA DEL MODAL
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // D. MANEJO DE FORMULARIOS (LOGIN Y REGISTRO) CON DELEGACIÓN
    // Usamos delegación porque el modal se carga dinámicamente vía navbar.html
    document.addEventListener('submit', (e) => {
        if (e.target && (e.target.id === 'login-form' || e.target.closest('#login-form'))) {
            // Aseguramos que sea el formulario el que dispara o contiene el evento
            const form = e.target.id === 'login-form' ? e.target : e.target.closest('#login-form');
            e.preventDefault();
            handleLogin(e, form);
        }

        if (e.target && (e.target.id === 'register-form' || e.target.closest('#register-form'))) {
            const form = e.target.id === 'register-form' ? e.target : e.target.closest('#register-form');
            e.preventDefault();
            handleRegister(e, form);
        }
    });

    /* 
    BLOQUE ELIMINADO: Ya no necesitamos buscar el ID específico al cargar, 
    porque usamos la delegación de arriba.
    */

    /*document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        });
    });*/

    // E. DETECTAR URL PARAMETER ?action=login PARA ABRIR EL MODAL DIRECTAMENTE
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'login') {
        const modal = document.getElementById('login-modal');
        if (modal) modal.style.display = 'block';
        // Limpiamos la URL para que no se abra siempre al refrescar
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}
function updateUserUI() {
    const btn = document.getElementById('login-btn');
    if (!btn) return;

    if (currentUser) {
        btn.innerHTML = `<i class="fas fa-user"></i> ${currentUser.username}`;
        if (!document.getElementById('logout-btn-nav')) {
            const logout = document.createElement('a');
            logout.id = 'logout-btn-nav';
            logout.className = 'nav-link';
            logout.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
            logout.style.cursor = 'pointer';
            logout.onclick = handleLogout; // Esto funciona bien dentro del módulo
            btn.parentNode.appendChild(logout);
        }
    } else {
        btn.textContent = 'Login';
        const logout = document.getElementById('logout-btn-nav');
        if (logout) logout.remove();
    }
}

// --- AGREGA ESTA LÍNEA JUSTO AQUÍ ---
window.updateUserUI = updateUserUI;
/* ========================================== */
/* REEMPLAZAR ESTA FUNCIÓN EN TU SCRIPT.JS   */
/* ========================================== */

async function handleLogin(e) {
    e.preventDefault();

    // 1. OJO AQUÍ: Asegúrate que en tu HTML el input tenga id="email"
    // Si tu input se llama id="username", cambia 'email' por 'username' aquí abajo.
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;

    btn.innerText = "Verificando...";
    btn.disabled = true;

    // Asegúrate de que esta URL sea la correcta de tu Webhook de Login
    const loginUrl = `${API_URL}login`;
    console.log(`📡 Enviando login a: ${loginUrl}`, { email: email });

    try {
        const res = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 2. CORRECCIÓN PRINCIPAL: Enviamos 'email' en lugar de 'username'
            body: JSON.stringify({
                email: email,
                password: pass
            })
        });

        console.log(`📩 Respuesta status: ${res.status}`);
        const data = await res.json();
        console.log("📦 Datos recibidos:", data);

        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user)); // Key estandarizada
            // Mantenemos 'usuario_logueado' por compatibilidad temporal si es necesario, 
            // pero lo ideal es migrar todo a 'user'.
            localStorage.setItem('usuario_logueado', JSON.stringify(data.user));

            console.log("✅ Login exitoso:", data.user.nombre_completo);

            // VERIFICAR CAMBIO DE CONTRASEÑA OBLIGATORIO
            if (data.force_password_change) {
                alert("⚠️ Has ingresado con una contraseña temporal.\nPor seguridad, debes cambiar tu contraseña ahora.");
                // Redirigir a configuración segun rol
                if (data.user.rol === 'admin') {
                    window.location.href = 'admin-config.html?change_password=true';
                } else {
                    window.location.href = 'cliente-config.html?change_password=true';
                }
                return;
            }

            if (data.user.rol === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                window.location.href = 'cliente.html'; // O la página de inicio
            }
        } else {
            alert("❌ " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión con el servidor.');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const pass = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm-password').value;
    const btn = e.target.querySelector('button');

    if (pass !== confirm) { alert('Las contraseñas no coinciden'); return; }

    const formData = {
        nombre_completo: document.getElementById('reg-name').value,
        username: document.getElementById('reg-username').value,
        email: document.getElementById('reg-email').value,
        password: pass,
        telefono: document.getElementById('reg-phone').value
    };

    const originalText = btn.textContent;
    btn.textContent = "Registrando...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (data.success) {
            alert('✅ Registro exitoso.\n\nTe hemos enviado un correo de bienvenida.');
            switchAuthMode('login');
            e.target.reset();
        } else {
            alert("❌ Error: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión al registrar');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function handleLogout() {
    localStorage.removeItem('user');
    currentUser = null;
    window.location.href = 'index.html';
}

function setupRecoveryLogic() {
    // A. DELEGACIÓN PARA CLIC EN "OLVIDASTE TU CONTRASEÑA"
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('forgot-pass-trigger')) {
            e.preventDefault();
            const recoveryModal = document.getElementById('recovery-modal');
            const loginModal = document.getElementById('login-modal');

            if (loginModal) loginModal.style.display = 'none';
            if (recoveryModal) {
                recoveryModal.style.display = 'block';
                const emailInput = document.getElementById('recovery-email');
                if (emailInput) emailInput.value = '';
            } else {
                alert("Error: No se encuentra el modal de recuperación.");
            }
        }
    });

    // B. DELEGACIÓN PARA SUBMIT DEL FORMULARIO DE RECUPERACIÓN
    document.addEventListener('submit', async (e) => {
        if (e.target && (e.target.id === 'recovery-form' || e.target.closest('#recovery-form'))) {
            e.preventDefault();
            const form = e.target.id === 'recovery-form' ? e.target : e.target.closest('#recovery-form');
            const emailInput = document.getElementById('recovery-email');
            const btn = form.querySelector('button');
            const originalText = btn.textContent;

            btn.textContent = "Verificando...";
            btn.disabled = true;

            try {
                const res = await fetch(`${API_URL}forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput.value })
                });
                const data = await res.json();
                if (data.success) {
                    alert("✅ Se ha enviado una nueva contraseña a tu correo.");
                    document.getElementById('recovery-modal').style.display = 'none';
                    const loginModal = document.getElementById('login-modal');
                    if (loginModal) {
                        loginModal.style.display = 'block';
                        // Switch to login tab safely
                        if (typeof switchAuthMode === 'function') switchAuthMode('login');
                    }
                } else {
                    alert("❌ " + data.message);
                }
            } catch (err) { alert("Error de conexión"); }
            finally { btn.textContent = originalText; btn.disabled = false; }
        }
    });
}

/* ================= 2. LÓGICA DE PÁGINAS Y PROPIEDADES ================= */
async function initPageLogic() {
    // Si la página es admin-publicar, ya la manejamos arriba en el DOMContentLoaded
    // Aquí manejamos las de carga masiva
    await loadProperties();
    const page = document.body.getAttribute('data-page');

    if (page === 'venta' || page === 'arriendo' || page === 'arriendo-temporal') {
        const itemsSelector = document.getElementById('items-per-page');
        if (itemsSelector) {
            itemsSelector.addEventListener('change', (e) => {
                rows = parseInt(e.target.value);
                currentPage = 1;
                filterAndRender(page);
            });
        }
        initCategoryPage(page);
    }
    else if (page === 'favoritos') {
        renderFavoritesPage();
    }
    else if (page === 'home' || !page) {
        renderFeaturedProperties();
    }
}

async function updateAdminList() {
    const tbody = document.getElementById('published-table-body');
    if (!tbody) return;
    await loadProperties();

    if (properties.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No hay propiedades publicadas.</td></tr>';
        return;
    }

    tbody.innerHTML = properties.map(p => `
        <tr>
            <td style="padding: 1rem; border-bottom: 1px solid #eee;">
            <span style="background: ${p.estado === 'Activa' ? '#e6f4ea' : (p.estado === 'Pausada' ? '#fff8e1' : '#fce8e6')}; 
                color: ${p.estado === 'Activa' ? '#1e8e3e' : (p.estado === 'Pausada' ? '#f9a825' : '#c62828')}; 
                padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">
                ${p.estado || 'Activa'}
            </span>
                <div style="font-weight: 500;">${p.title}</div>
                <div style="font-size: 0.85rem; color: #666;">${p.type} - ${p.operation}</div>
            </td>
            <td style="padding: 1rem; border-bottom: 1px solid #eee;">${p.price}</td>
            <td style="padding: 1rem; border-bottom: 1px solid #eee;">${p.location}</td>
            <td style="padding: 1rem; border-bottom: 1px solid #eee;">
                <span style="background: #e6f4ea; color: #1e8e3e; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Publicada</span>
            </td>
            <td style="padding: 1rem; display: flex; gap: 5px;">
                <button class="btn btn-sm" onclick="openDetail(${p.id})" style="background: #17a2b8; color: white;" title="Ver"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm" onclick="window.location.href='admin-publicar.html?id=${p.id}'" style="background: #ffc107; color: black;" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm" onclick="deleteProperty(${p.id})" style="background: #dc3545; color: white;" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.deleteProperty = async function (id) {
    if (!confirm('¿Estás seguro de eliminar esta propiedad?')) return;
    try {
        const res = await fetch(`${API_URL}propiedades/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            alert('Propiedad eliminada correctamente');
            updateAdminList();
        } else {
            alert('Error al eliminar: ' + (data.message || 'Desconocido'));
        }
    } catch (err) { console.error(err); alert('Error de conexión al eliminar'); }
};

function setupPropertyForm() {
    const form = document.getElementById('property-form');
    if (form) {
        form.addEventListener('submit', handlePropertySubmit);
    }
}

/* ================================================================= */
/* LÓGICA DE FOTOS (NUEVAS Y ANTIGUAS)                               */
/* ================================================================= */
let newFilesArray = [];
let existingPhotosArray = [];
const inputFotos = document.getElementById('input-fotos');
const container = document.getElementById('preview-container');

if (inputFotos) {
    inputFotos.addEventListener('change', function (e) {
        const newFiles = Array.from(this.files);
        newFiles.forEach(file => {
            if (file.type.startsWith('image/')) { newFilesArray.push(file); }
        });
        renderAllPhotos();
        this.value = '';
    });
}

function renderAllPhotos() {
    if (!container) return;
    container.innerHTML = '';
    existingPhotosArray.forEach((url, index) => { createPhotoElement(url, index, 'existing'); });
    newFilesArray.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => { createPhotoElement(e.target.result, index, 'new'); }
        reader.readAsDataURL(file);
    });
}

function createPhotoElement(src, index, type) {
    const wrapper = document.createElement('div');
    wrapper.style = "position: relative; display: inline-block; margin: 10px;";
    const img = document.createElement('img');
    img.src = src;
    img.style = `width: 90px; height: 90px; object-fit: cover; border-radius: 6px; border: 2px solid ${type === 'existing' ? '#28a745' : '#ddd'}; box-shadow: 0 2px 5px rgba(0,0,0,0.1);`;
    const btn = document.createElement('div');
    btn.innerHTML = '<i class="fas fa-times"></i>';
    btn.style = `position: absolute; top: -8px; right: -8px; background-color: #dc3545; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid white; font-size: 12px; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transition: transform 0.2s;`;
    btn.onclick = function () {
        if (type === 'existing') { existingPhotosArray.splice(index, 1); }
        else { newFilesArray.splice(index, 1); }
        renderAllPhotos();
    };
    wrapper.appendChild(img);
    wrapper.appendChild(btn);
    container.appendChild(wrapper);
}

/* ================================================================= */
/* FUNCIÓN DE ENVÍO DE PROPIEDAD                                     */
/* ================================================================= */
async function handlePropertySubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('edit-id').value;
    const isEdit = !!editId;
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;

    btn.textContent = "Guardando cambios... ⏳";
    btn.disabled = true;

    const formData = new FormData();
    formData.append('title', document.getElementById('prop-title').value || '');
    formData.append('operation', document.getElementById('prop-operation').value || 'Venta');
    formData.append('type', document.getElementById('prop-type').value || 'Casa');
    formData.append('price', document.getElementById('prop-price').value || '0');
    formData.append('currency', document.getElementById('prop-currency').value || 'UF');
    formData.append('ggcc', document.getElementById('prop-ggcc').value || '0');
    formData.append('location', document.getElementById('prop-location').value || '');
    formData.append('dorms', document.getElementById('prop-dorms').value || '0');
    formData.append('baths', document.getElementById('prop-baths').value || '0');
    formData.append('m2_util', document.getElementById('prop-m2-util').value || '0');
    formData.append('m2_total', document.getElementById('prop-m2-total').value || '0');
    formData.append('desc', document.getElementById('prop-desc').value || '');
    formData.append('parking', document.getElementById('prop-parking').checked);
    formData.append('elevator', document.getElementById('prop-elevator').checked);
    formData.append('pool', document.getElementById('prop-pool').checked);
    formData.append('quincho', document.getElementById('prop-quincho').checked);

    if (document.getElementById('prop-status')) {
        formData.append('status', document.getElementById('prop-status').value);
    }

    if (newFilesArray.length > 0) { newFilesArray.forEach(file => { formData.append('fotos', file); }); }
    formData.append('fotos_guardadas', JSON.stringify(existingPhotosArray));

    try {
        let url = `${API_URL}propiedades`;
        let method = 'POST';
        if (isEdit) {
            url = `${API_URL}propiedades/${editId}`;
            method = 'PUT';
        }
        const res = await fetch(url, { method: method, body: formData });
        const data = await res.json();

        if (data.success) {
            alert(isEdit ? '¡Propiedad actualizada!' : '¡Propiedad publicada!');
            newFilesArray = []; existingPhotosArray = [];
            window.location.href = 'admin-lista.html';
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) { console.error(err); alert('Error de conexión.'); }
    finally { btn.textContent = originalText; btn.disabled = false; }
}

async function loadProperties() {
    try {
        const res = await fetch(`${API_URL}propiedades`);
        const allProperties = await res.json();
        const page = document.body.getAttribute('data-page');
        if (page === 'admin-lista') { properties = allProperties; }
        else { properties = allProperties.filter(p => p.estado === 'Activa' || !p.estado); }
    } catch (err) { console.error('Error cargando propiedades'); }
}

function initCategoryPage(category) { setupFilters(); filterAndRender(category); }

function filterAndRender(pageCategory) {
    const container = document.getElementById('category-grid');
    const paginationContainer = document.getElementById('pagination-container');
    if (!container) return;

    const loc = document.getElementById('filter-location')?.value.toLowerCase() || '';
    const type = document.getElementById('filter-type')?.value || '';
    const dorms = document.getElementById('filter-dorms')?.value || '';
    const baths = document.getElementById('filter-baths')?.value || '';
    const minPrice = parseFloat(document.getElementById('filter-min-price')?.value) || 0;
    const maxPrice = parseFloat(document.getElementById('filter-max-price')?.value) || Infinity;
    const sort = document.getElementById('filter-sort')?.value || '';

    let operationFilter = '';
    if (pageCategory === 'venta') operationFilter = 'Venta';
    else if (pageCategory === 'arriendo') operationFilter = 'Arriendo';
    else if (pageCategory === 'arriendo-temporal') operationFilter = 'Arriendo Temporal';

    filteredData = properties.filter(p => {
        if (operationFilter && !p.operation.includes(operationFilter)) return false;
        if (loc && !p.location.toLowerCase().includes(loc)) return false;
        if (type && p.type !== type) return false;
        if (dorms && p.specs.dorms < parseInt(dorms)) return false;
        if (baths && p.specs.baths < parseInt(baths)) return false;
        if (p.rawPrice) {
            if (p.rawPrice < minPrice) return false;
            if (p.rawPrice > maxPrice) return false;
        }
        return true;
    });

    if (sort === 'price_asc') filteredData.sort((a, b) => (a.rawPrice || 0) - (b.rawPrice || 0));
    if (sort === 'price_desc') filteredData.sort((a, b) => (b.rawPrice || 0) - (a.rawPrice || 0));
    if (sort === 'newest') filteredData.sort((a, b) => b.id - a.id);

    const start = (currentPage - 1) * rows;
    const end = start + rows;
    const paginatedItems = filteredData.slice(start, end);

    const startSpan = document.getElementById('start-index');
    const endSpan = document.getElementById('end-index');
    const totalSpan = document.getElementById('total-items');
    if (startSpan) startSpan.innerText = filteredData.length > 0 ? start + 1 : 0;
    if (endSpan) endSpan.innerText = Math.min(end, filteredData.length);
    if (totalSpan) totalSpan.innerText = filteredData.length;

    container.innerHTML = paginatedItems.length
        ? paginatedItems.map(p => createCardHTML(p)).join('')
        : '<p class="text-center full-width">No se encontraron propiedades con estos filtros.</p>';

    if (paginationContainer) { setupPaginationButtons(paginationContainer, pageCategory); }
}

function setupFilters() {
    const btnApply = document.getElementById('btn-apply-filters');
    const btnClear = document.getElementById('btn-clear-filters');
    const page = document.body.getAttribute('data-page');
    const runFilter = () => { if (typeof filterAndRender === 'function') { filterAndRender(page); } };

    document.querySelectorAll('.filters-container select, .filters-container input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', runFilter);
    });
    document.querySelectorAll('.filters-container input[type="number"]').forEach(input => {
        input.addEventListener('input', runFilter);
    });

    if (btnApply) { btnApply.addEventListener('click', runFilter); }
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            document.querySelectorAll('.filters-container input, .filters-container select').forEach(el => {
                if (el.type === 'checkbox') el.checked = false;
                else el.value = '';
            });
            runFilter();
        });
    }
}

async function renderFeaturedProperties() {
    const container = document.getElementById('featured-grid');
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}destacadas`);
        if (!res.ok) throw new Error('Error de red');

        const featured = await res.json();

        if (featured.length === 0) {
            container.innerHTML = '<p class="text-center full-width">Pronto tendremos novedades.</p>';
            return;
        }

        container.innerHTML = featured.map(p => createPremiumCardHTML(p)).join('');

    } catch (error) {
        console.error("Error al cargar destacadas:", error);
        container.innerHTML = '<p class="text-center full-width" style="color:red;">Error al cargar las propiedades.</p>';
    }
}

function setupSearchAutocomplete() {
    const inputs = document.querySelectorAll('#filter-location, .search-field input[type="text"]');
    inputs.forEach(input => {
        let list = input.parentNode.querySelector('.suggestions-list, .suggestions-box');
        if (!list) {
            list = document.createElement('ul');
            list.className = 'suggestions-box';
            list.style.display = 'none';
            input.parentNode.style.position = 'relative';
            input.parentNode.appendChild(list);
        }
        input.addEventListener('input', async (e) => {
            const query = e.target.value;
            if (query.length < 3) { list.style.display = 'none'; return; }
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=cl&limit=5`);
                const data = await res.json();
                list.innerHTML = '';
                if (data.length > 0) {
                    list.style.display = 'block';
                    data.forEach(place => {
                        const li = document.createElement('li');
                        li.className = 'suggestion-item';
                        li.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${place.display_name.split(',')[0]}`;
                        li.onclick = () => { input.value = place.display_name.split(',')[0]; list.style.display = 'none'; };
                        list.appendChild(li);
                    });
                }
            } catch (err) { console.error(err); }
        });
        document.addEventListener('click', (e) => { if (e.target !== input) list.style.display = 'none'; });
    });
}

function openDetail(id) {
    const p = properties.find(x => x.id == id);
    if (!p) return;
    document.getElementById('detail-title').textContent = p.title;
    document.getElementById('detail-price').textContent = p.price;
    document.getElementById('detail-location').textContent = p.location;
    document.getElementById('detail-desc').textContent = p.desc;
    document.getElementById('detail-main-img').src = p.images.main;
    setText('detail-dorms', p.specs.dorms);
    setText('detail-baths', p.specs.baths);
    setText('detail-m2', p.specs.m2Util);

    const thumbContainer = document.getElementById('detail-thumbnails');
    if (thumbContainer) {
        thumbContainer.innerHTML = '';
        if (p.images.gallery && p.images.gallery.length > 0) {
            p.images.gallery.forEach(imgUrl => {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.className = 'detail-thumb';
                img.style = "width: 60px; height: 40px; object-fit: cover; margin: 2px; cursor: pointer; border: 1px solid #ccc;";
                img.onclick = () => document.getElementById('detail-main-img').src = imgUrl;
                thumbContainer.appendChild(img);
            });
        }
    }

    // CALCULADORA HIPOTECARIA
    const calcBox = document.getElementById('mortgage-calculator');
    const pieSelect = document.getElementById('calc-pie');
    const yearSelect = document.getElementById('calc-years');
    const resultLabel = document.getElementById('calc-result');

    if (calcBox && p.operation.includes('Venta') && p.price.includes('UF')) {
        calcBox.style.display = 'block';
        const calculate = () => {
            let priceValue = parseFloat(p.price.replace(/[^0-9,]/g, '').replace('.', '').replace(',', '.'));
            if (p.rawPrice) priceValue = p.rawPrice;
            const piePercent = parseInt(pieSelect.value) / 100;
            const years = parseInt(yearSelect.value);
            const rate = 0.048;
            const loan = priceValue * (1 - piePercent);
            const r = rate / 12;
            const n = years * 12;
            const dividend = loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            resultLabel.textContent = "UF " + dividend.toFixed(2);
        };
        pieSelect.onchange = calculate;
        yearSelect.onchange = calculate;
        calculate();
    } else if (calcBox) { calcBox.style.display = 'none'; }

    // BOTÓN DE ACCIÓN
    const actionBtn = document.querySelector('#property-modal .btn-primary');
    if (actionBtn) {
        if (actionBtn.tagName === 'A') {
            actionBtn.href = "#contact";
            actionBtn.onclick = function () {
                document.getElementById('property-modal').style.display = 'none';
                const subject = document.getElementById('contact-message');
                if (subject) subject.value = "Hola, me interesa la propiedad: " + p.title;
            };
        } else {
            actionBtn.onclick = function () { openBookingModal(p.title); };
        }
    }
    document.getElementById('property-modal').style.display = 'block';
}

function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }

function setupNavigation() {
    // Guardamos un flag para no registrar listeners duplicados
    // si cargador.js llama esta función una segunda vez después de inyectar el navbar
    if (document._navSetup) return;
    document._navSetup = true;

    // ============================================================
    // DELEGACIÓN DE EVENTOS EN document
    // Funciona aunque el navbar se cargue async con fetch()
    // ============================================================
    document.addEventListener('click', function (e) {
        const nav = document.querySelector('.nav-links');
        const btn = document.querySelector('.mobile-menu-btn');

        // Si el navbar aún no cargó, no hacemos nada
        if (!nav || !btn) return;

        // ── 1. Click en el botón hamburguesa ──────────────────
        if (e.target.closest('.mobile-menu-btn')) {
            e.stopPropagation();
            const isOpen = nav.classList.contains('active');
            if (isOpen) {
                // CERRAR
                nav.classList.remove('active');
                btn.classList.remove('active');
                // Cerrar sub-dropdowns abiertos
                nav.querySelectorAll('.dropdown-content.mobile-open').forEach(d => {
                    d.classList.remove('mobile-open');
                    d.style.display = '';
                    d.style.position = '';
                    d.style.boxShadow = '';
                    d.style.borderTop = '';
                    d.style.padding = '';
                });
            } else {
                // ABRIR
                nav.classList.add('active');
                btn.classList.add('active');
            }
            return;
        }

        // ── 2. Click en cabecera de un dropdown (Nosotros, etc.) en MÓVIL ──
        if (window.innerWidth <= 900) {
            const dropLink = e.target.closest('.dropdown > a');
            if (dropLink && nav.contains(dropLink)) {
                e.preventDefault();
                e.stopPropagation();

                const dropdown = dropLink.closest('.dropdown');
                const content = dropdown.querySelector('.dropdown-content');
                if (!content) return;

                const isOpen = content.classList.contains('mobile-open');

                // Cerrar todos los demás dropdowns
                nav.querySelectorAll('.dropdown-content.mobile-open').forEach(d => {
                    d.classList.remove('mobile-open');
                    d.style.display = '';
                    d.style.position = '';
                    d.style.boxShadow = '';
                    d.style.borderTop = '';
                    d.style.padding = '';
                });

                if (!isOpen) {
                    content.classList.add('mobile-open');
                    content.style.display = 'block';
                    content.style.position = 'static';
                    content.style.boxShadow = 'none';
                    content.style.borderTop = 'none';
                    content.style.padding = '0 0 0 15px';
                }
                return;
            }

            // ── 3. Click en un link real (navegar) en MÓVIL → cerrar menú ──
            const realLink = e.target.closest('.nav-links a');
            if (realLink && !realLink.closest('.dropdown > a')) {
                nav.classList.remove('active');
                btn.classList.remove('active');
                nav.querySelectorAll('.dropdown-content.mobile-open').forEach(d => {
                    d.classList.remove('mobile-open');
                    d.style.display = '';
                    d.style.position = '';
                    d.style.boxShadow = '';
                    d.style.borderTop = '';
                    d.style.padding = '';
                });
                return;
            }

            // ── 4. Click fuera del navbar → cerrar menú ──
            if (nav.classList.contains('active') && !e.target.closest('.navbar')) {
                nav.classList.remove('active');
                btn.classList.remove('active');
                nav.querySelectorAll('.dropdown-content.mobile-open').forEach(d => {
                    d.classList.remove('mobile-open');
                    d.style.display = '';
                    d.style.position = '';
                    d.style.boxShadow = '';
                    d.style.borderTop = '';
                    d.style.padding = '';
                });
            }
        }
    });
}
window.setupNavigation = setupNavigation;

/* ================================================================= */

/* 3. CEREBRO DEL CHATBOT (CONECTADO A TU SERVER.JS /api/citas)      */
/* ================================================================= */

// 1. CONFIGURACIÓN IA (GEMINI)
const CHAT_API_KEY = "AIzaSyB_J9deh1hdogOWRK1RjXwDmDlS8hy9-Jo";
const chatGenAI = new GoogleGenerativeAI(CHAT_API_KEY);
const chatModel = chatGenAI.getGenerativeModel({ model: "gemini-robotics-er-1.5-preview" });

// 2. INSTRUCCIONES (PROMPT)
// Le enseñamos a Gemini a generar los códigos que tu servidor entiende
const SYSTEM_PROMPT = `
Eres la secretaria virtual de la Corredora Marlen Guzmán.
Tu misión es gestionar citas. Sé amable y breve.
Cuando tengas los datos, responde SOLO con estos códigos:

1. AGENDAR: ||AGENDAR|Nombre|Telefono|Email|Fecha(YYYY-MM-DD)|Hora(HH:MM)||
2. CONSULTAR: ||CONSULTAR|Telefono||
3. ELIMINAR: ||ELIMINAR|ID_Cita||
4. REPROGRAMAR: ||REPROGRAMAR|ID_Cita|Fecha_Nueva|Hora_Nueva||
5. DISPONIBILIDAD: ||DISPONIBILIDAD|Fecha(YYYY-MM-DD)||

IMPORTANTE: Pide siempre el Teléfono para identificar al cliente.
- Si el usuario quiere CANCELAR o ELIMINAR una cita y da el ID, responde SOLO con: ||ELIMINAR|ID_CITA||.
- Si el usuario pregunta "¿Qué horas tienes libres el martes?", calcula la fecha del próximo martes y responde: ||DISPONIBILIDAD|202X-MM-DD||.
- Pide siempre el Teléfono para identificar al cliente.
- El año actual es año 2026
`;

let chatHistory = [
    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
    { role: "model", parts: [{ text: "Entendido. Soy la asistente virtual." }] }
];

// 3. FUNCIÓN GLOBAL PARA BOTONES (HTML)
// 3. FUNCIÓN GLOBAL MEJORADA (Auto-relleno de datos)
window.fillInput = (accion) => {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat-btn');
    if (!input) return;

    // Detectar si hay usuario logueado para autocompletar
    let nombre = "[Nombre]";
    let fono = "[Tel]";
    let email = "[Email]";

    if (currentUser) {
        nombre = currentUser.nombre_completo || currentUser.username;
        fono = currentUser.telefono || "[Tel]";
        email = currentUser.email || "[Email]";
    }

    if (accion === 'agendar') {
        // Usamos comillas invertidas ` ` para insertar las variables
        input.value = `Hola, quiero agendar. Soy ${nombre}, fono ${fono}, correo ${email}, el [Fecha] a las [Hora]`;
    }
    else if (accion === 'consultar') {
        input.value = `Quiero ver mis citas. Mi teléfono es: ${fono}`;
    }
    else if (accion === 'reprogramar') {
        input.value = `Cambiar cita ID [ID]. Nueva fecha [Fecha] a las [Hora]`;
    }
    else if (accion === 'cancelar') {
        input.value = `Cancelar cita ID [ID]`;
    }

    // Enfocar y habilitar
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
};

// 4. FUNCIÓN PRINCIPAL (SETUP)
function setupChatbot() {
    const toggle = document.getElementById('chatbot-toggle');
    const widget = document.getElementById('chatbot-widget');
    const close = document.getElementById('close-chat');
    const input = document.getElementById('chat-input');
    const btnSend = document.getElementById('send-chat-btn');
    const typingInd = document.getElementById('typing-indicator');

    if (!toggle || !widget) return;

    // Abrir/Cerrar
    toggle.addEventListener('click', () => { widget.style.display = 'flex'; toggle.style.display = 'none'; });
    close.addEventListener('click', () => { widget.style.display = 'none'; toggle.style.display = 'block'; });

    // Activar botón al escribir
    input.addEventListener('input', () => { btnSend.disabled = input.value.trim() === ""; });

    // LÓGICA DE ENVÍO
    const handleSend = async () => {
        const text = input.value.trim();
        if (!text) return;

        // A) Mostrar mensaje usuario
        addMessage('user', text);
        input.value = '';
        input.disabled = true;
        btnSend.disabled = true;
        typingInd.style.display = 'block';

        try {
            // B) MODO " SIN COSTO " (Reglas Locales en vez de Gemini API)
            // Simulamos una latencia para que parezca "pensando"
            await new Promise(r => setTimeout(r, 600));

            let fullReply = "";
            const lowerText = text.toLowerCase();

            // 1. DETECCIÓN DE INTENCIÓN "AGENDAR"
            // Patrón esperado: "agendar ... soy [nombre], fono [fono], correo [email], el [fecha] a las [hora]"
            if (lowerText.includes("agendar") && lowerText.includes("fono") && lowerText.includes("correo")) {
                // Intentamos extraer datos con Regex básicos
                const nombreMatch = text.match(/Soy\s+(.+?),\s*fono/i) || text.match(/Soy\s+(.+?)\s*$/i);
                const fonoMatch = text.match(/fono\s+([0-9\+\s]+),/i);
                const emailMatch = text.match(/correo\s+([a-zA-Z0-9@\.]+),/i);
                const fechaMatch = text.match(/el\s+([0-9\-\/]+)/i);
                const horaMatch = text.match(/alas\s+([0-9:]+)|\sa\s+las\s+([0-9:]+)/i);

                if (fonoMatch && emailMatch && fechaMatch) {
                    const n = nombreMatch ? nombreMatch[1] : "Usuario";
                    const f = fonoMatch[1];
                    const e = emailMatch[1];
                    const d = fechaMatch[1];
                    const h = horaMatch ? (horaMatch[1] || horaMatch[2]) : "10:00";

                    fullReply = `||AGENDAR|${n}|${f}|${e}|${d}|${h}`;
                } else {
                    fullReply = "Para agendar, necesito que uses el formato: 'Soy [Nombre], fono [Numero], correo [Email], el [YYYY-MM-DD] a las [HH:MM]'. O usa los botones de ayuda.";
                }
            }
            // 2. DETECCIÓN DE "CONSULTAR CITAS"
            else if (lowerText.includes("ver mis citas") || (lowerText.includes("consultar") && lowerText.includes("teléfono"))) {
                const fonoMatch = text.match(/teléfono\s*(?:es|:)?\s*([0-9\+\s]+)/i);
                if (fonoMatch) {
                    fullReply = `||CONSULTAR|${fonoMatch[1]}`;
                } else {
                    fullReply = "Por favor indícame tu teléfono para buscar tus citas. Ej: 'Mi teléfono es 912345678'";
                }
            }
            // 3. DETECCIÓN DE "ELIMINAR/CANCELAR"
            else if (lowerText.includes("cancelar") || lowerText.includes("eliminar")) {
                const idMatch = text.match(/ID\s+(\w+)/i);
                if (idMatch) {
                    fullReply = `||ELIMINAR|${idMatch[1]}`;
                } else {
                    fullReply = "Para cancelar, necesito el ID de la cita. Ej: 'Cancelar cita ID X123'";
                }
            }
            // 4. DETECCIÓN DE "REPROGRAMAR"
            else if (lowerText.includes("reprogramar") || lowerText.includes("cambiar cita")) {
                const idMatch = text.match(/ID\s+(\w+)/i);
                const fechaMatch = text.match(/fecha\s+([0-9\-\/]+)/i);
                const horaMatch = text.match(/alas\s+([0-9:]+)|\sa\s+las\s+([0-9:]+)/i);

                if (idMatch && fechaMatch) {
                    const h = horaMatch ? (horaMatch[1] || horaMatch[2]) : "10:00";
                    fullReply = `||REPROGRAMAR|${idMatch[1]}|${fechaMatch[1]}|${h}`;
                } else {
                    fullReply = "Para reprogramar: 'Cambiar cita ID [ID]. Nueva fecha [YYYY-MM-DD] a las [HH:MM]'";
                }
            }
            // 5. DETECCIÓN DE "DISPONIBILIDAD"
            else if (lowerText.includes("disponibilidad") || lowerText.includes("horas libres")) {
                const fechaMatch = text.match(/el\s+([0-9\-\/]+)/i);
                if (fechaMatch) {
                    fullReply = `||DISPONIBILIDAD|${fechaMatch[1]}`;
                } else {
                    // Si no da fecha, asumimos hoy o pedimos fecha
                    // Para simplificar, le pedimos fecha
                    const hoy = new Date().toISOString().split('T')[0];
                    fullReply = `¿Para qué fecha buscas? Escribe: 'Disponibilidad el ${hoy}'`;
                }
            }
            // 6. DEFAULT (FALLBACK A INTELIGENCIA ARTIFICIAL)
            else {
                // En vez de responder con un texto fijo, le preguntamos a la IA
                // Pasamos 'text' que es lo que escribió el usuario
                await enviarMensajeAI(text);

                // Retornamos aquí para evitar que siga ejecutando el bloque de abajo "||"
                // Ya que enviarMensajeAI se encarga de mostrar la respuesta
                typingInd.style.display = 'none';
                input.disabled = false;
                input.focus();
                return;
            }

            typingInd.style.display = 'none';

            // C) Procesamos la respuesta (sea texto o comando)
            if (fullReply.startsWith("||")) {
                const tempDiv = addMessage('bot', "🔄 Procesando solicitud...");

                if (fullReply.includes("||AGENDAR")) await ejecutarComandoNativo('agendar', fullReply, tempDiv);
                else if (fullReply.includes("||CONSULTAR")) await ejecutarComandoNativo('consultar', fullReply, tempDiv);
                else if (fullReply.includes("||ELIMINAR")) await ejecutarComandoNativo('eliminar', fullReply, tempDiv);
                else if (fullReply.includes("||REPROGRAMAR")) await ejecutarComandoNativo('reprogramar', fullReply, tempDiv);
                else if (fullReply.includes("||DISPONIBILIDAD")) await ejecutarComandoNativo('disponibilidad', fullReply, tempDiv);
            } else {
                addMessage('bot', fullReply);
            }

        } catch (error) {
            console.error(error);
            typingInd.style.display = 'none';
            addMessage('bot', "⚠️ Error interno. Intenta de nuevo.");
        } finally {
            input.disabled = false;
            input.focus();
        }
    };

    btnSend.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
}

// 5. CONECTOR CON TU SERVER.JS (¡Aquí está la clave!)
async function ejecutarComandoNativo(accion, codigo, divMensaje) {
    const rawData = codigo.replace(`||${accion.toUpperCase()}|`, "").replace("||", "");
    const datos = rawData.split("|").map(d => d.trim());

    try {
        // CASO 1: AGENDAR (Coincide con app.post('/api/citas'))
        if (accion === 'agendar') {
            const body = {
                Nombre: datos[0],
                Teléfono: datos[1],      // ¡OJO! Tu server pide "Teléfono" con tilde
                Email: datos[2],
                Fecha: datos[3],
                Hora_inicio: datos[4],   // ¡OJO! Tu server pide "Hora_inicio"
                Motivo: "Solicitado por Chatbot"
            };

            const res = await fetch(`${API_URL}citas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.success) {
                divMensaje.innerHTML = `✅ <b>¡Cita Confirmada!</b><br>Te enviamos un correo.<br>Código: <b>${data.cita}</b>`;
            } else {
                divMensaje.innerText = `❌ Error: ${data.message}`;
            }
        }

        // CASO 2: CONSULTAR (Coincide con app.get('/api/citas'))
        else if (accion === 'consultar') {
            // Tomamos el dato de la IA y le quitamos los espacios antes del fetch
            const fonoRaw = datos[0];
            const fonoLimpio = fonoRaw.replace(/\s+/g, '');

            const res = await fetch(`${API_URL}citas?telefono=${encodeURIComponent(fonoLimpio)}`);
            const data = await res.json();

            if (data.length > 0) {
                let html = `<strong>📅 Tus Citas Encontradas:</strong><br><table class="citas-table">` +
                    `<tr><th>Fecha</th><th>Hora</th><th>ID</th></tr>`;
                data.forEach(c => {
                    // Formateamos la fecha de la cita
                    const fechaFormat = new Date(c.fecha).toLocaleDateString('es-CL');

                    // Formateamos la fecha de actualización (si existe)
                    const ultimaAct = c.updated_at
                        ? new Date(c.updated_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Original';

                    html += `
        <tr>
            <td>${fechaFormat}</td>
            <td>${c.hora_inicio}</td>
            <td>${c.id}</td>
            <td style="font-size: 0.85em; color: #888;">${ultimaAct}</td>
        </tr>`;
                });
                divMensaje.innerHTML = html + "</table>";
            } else {
                divMensaje.innerText = "Lamentablemente, no encontré citas con ese teléfono.";
            }
        }

        // CASO 3: ELIMINAR (Coincide con app.delete('/api/citas/:id'))
        else if (accion === 'eliminar') {
            const idCita = datos[0];
            const res = await fetch(`${API_URL}citas/${idCita}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) divMensaje.innerText = "🗑️ Cita eliminada correctamente.";
            else divMensaje.innerText = "❌ No encontré esa cita.";
        }

        // CASO 4: REPROGRAMAR (Coincide con app.put('/api/citas/:id'))
        // CASO 4: REPROGRAMAR (Coincide con app.put('/api/citas/:id'))
        // CASO 4: REPROGRAMAR (Coincide con app.put('/api/citas/:id'))
        else if (accion === 'reprogramar') {
            const id = datos[0];
            const body = {
                Fecha: datos[1],
                Hora_inicio: datos[2] // Tu server usa Hora_inicio en el UPDATE
            };
            const res = await fetch(`${API_URL}citas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) divMensaje.innerText = "🔄 Cita reprogramada con éxito.";
            else divMensaje.innerText = "❌ Error al reprogramar. Revisa el ID.";
        }

        // CASO 5: DISPONIBILIDAD (¡ESTE ES EL ÚNICO BLOQUE QUE NECESITAS PARA DISPONIBILIDAD!)
        else if (accion === 'disponibilidad') {
            const fecha = datos[0]; // La IA nos da la fecha YYYY-MM-DD

            // 1. Avisar al usuario que estamos pensando
            divMensaje.innerHTML = `🔎 Consultando agenda para el <b>${fecha}</b>...`;

            // 2. Llamar a TU servidor (que luego llamará a n8n)
            try {
                const res = await fetch(`${API_URL}disponibilidad?fecha=${fecha}`);
                const data = await res.json();

                // 3. Dibujar los botones si hay horas libres
                if (data.success && data.disponibles && data.disponibles.length > 0) {
                    const fechaBonita = fecha.split('-').reverse().join('/');
                    let html = `✅ <strong>Horas libres el ${fechaBonita}:</strong><br><div class="time-slots-grid">`;

                    data.disponibles.forEach(hora => {
                        html += `<button class="slot-btn" onclick="seleccionarHora('${fecha}', '${hora}')">${hora}</button>`;
                    });

                    html += `</div>`;
                    divMensaje.innerHTML = html;
                } else {
                    divMensaje.innerHTML = `⚠️ Lo siento, no quedan horas disponibles para el <b>${fecha}</b>.`;
                }
            } catch (err) {
                console.error("Error en fetch disponibilidad:", err);
                divMensaje.innerHTML = `❌ Error al conectar con el calendario.`;
            }
        }

    } catch (e) {
        console.error(e);
        divMensaje.innerText = "❌ Error de conexión con el servidor.";
    }
}

// 6. UTILIDAD VISUAL
function addMessage(role, text) {
    const chatBox = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}
/* ================= LOGIN/REGISTRO ================= */
window.switchAuthMode = function (mode) {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const title = document.querySelector('.login-welcome-title');

    if (mode === 'register') {
        if (loginForm) { loginForm.style.display = 'none'; loginForm.classList.remove('active'); }
        if (regForm) { regForm.style.display = 'block'; regForm.classList.add('active'); }
        if (tabLogin) tabLogin.classList.remove('active');
        if (tabRegister) tabRegister.classList.add('active');
        if (title) title.textContent = 'REGÍSTRATE';
    } else {
        if (regForm) { regForm.style.display = 'none'; regForm.classList.remove('active'); }
        if (loginForm) { loginForm.style.display = 'block'; loginForm.classList.add('active'); }
        if (tabRegister) tabRegister.classList.remove('active');
        if (tabLogin) tabLogin.classList.add('active');
        if (title) title.innerHTML = 'ACCESO A <span class="text-gold">SISTEMA</span>';
    }
};

/* ================= EDITAR PROPIEDAD ================= */
async function loadPropertyForEdit(id) {
    try {
        console.log("🔄 Cargando propiedad...", id);
        document.getElementById('form-mode-title').textContent = "✏️ Editando Propiedad #" + id;
        document.getElementById('edit-id').value = id;
        const btn = document.getElementById('btn-submit-prop');
        if (btn) {
            btn.textContent = "ACTUALIZAR DATOS";
            btn.style.backgroundColor = "#28a745";
            btn.style.borderColor = "#28a745";
        }
        document.getElementById('status-container').style.display = 'block';

        const res = await fetch(`${API_URL}propiedades/${id}`);
        const p = await res.json();

        document.getElementById('prop-title').value = p.titulo || '';
        document.getElementById('prop-operation').value = p.tipo_operacion || 'Venta';
        document.getElementById('prop-type').value = p.tipo_propiedad || 'Casa';
        document.getElementById('prop-price').value = p.precio || '';
        document.getElementById('prop-currency').value = p.moneda || 'UF';
        document.getElementById('prop-ggcc').value = p.gastos_comunes || '';
        document.getElementById('prop-location').value = p.comuna || '';
        document.getElementById('prop-dorms').value = p.dormitorios || 0;
        document.getElementById('prop-baths').value = p.banos || 0;
        document.getElementById('prop-m2-util').value = p.m2_utiles || 0;
        document.getElementById('prop-m2-total').value = p.m2_totales || 0;
        document.getElementById('prop-desc').value = p.descripcion || '';

        if (document.getElementById('prop-status')) document.getElementById('prop-status').value = p.estado || 'Activa';
        document.getElementById('prop-parking').checked = (p.estacionamientos) ? true : false;
        document.getElementById('prop-elevator').checked = p.ascensor ? true : false;
        document.getElementById('prop-pool').checked = p.piscina ? true : false;
        document.getElementById('prop-quincho').checked = p.quincho ? true : false;

        existingPhotosArray = [];
        if (p.galeria && Array.isArray(p.galeria)) { existingPhotosArray = p.galeria; }
        else if (p.imagen_url) { existingPhotosArray = [p.imagen_url]; }
        renderAllPhotos();

    } catch (err) { console.error(err); alert('Error al cargar datos: ' + err.message); }
}

/* ================= 7. BUSCADOR HOME ================= */
function setupHomeSearch() {
    const btnSearch = document.getElementById('btn-home-search');
    if (!btnSearch) return;
    btnSearch.addEventListener('click', () => {
        const pageUrl = document.getElementById('home-operation').value;
        const type = document.getElementById('home-type').value;
        const location = document.getElementById('home-location').value;
        window.location.href = `${pageUrl}?loc=${encodeURIComponent(location)}&type=${encodeURIComponent(type)}`;
    });
}

function readUrlFilters() {
    const params = new URLSearchParams(window.location.search);
    const loc = params.get('loc');
    const type = params.get('type');
    if (loc) {
        const inputLoc = document.getElementById('filter-location');
        if (inputLoc) { inputLoc.value = loc; inputLoc.dispatchEvent(new Event('input')); }
    }
    if (type) {
        const inputType = document.getElementById('filter-type');
        if (inputType) { inputType.value = type; inputType.dispatchEvent(new Event('change')); }
    }
}

/* ================= 8. BUSCADOR NAVBAR ================= */
/* ================= 8. BUSCADOR NAVBAR (CORREGIDO) ================= */
// Usamos delegación porque el buscador viene de navbar.html
document.addEventListener('click', (e) => {
    const trigger = e.target.closest('#nav-search-trigger');
    const backBtn = e.target.closest('#nav-search-back');
    const submitBtn = e.target.closest('#nav-search-submit');

    // Elementos fijos (suponiendo que el overlay está en navbar.html)
    const overlay = document.getElementById('nav-search-overlay');
    const input = document.getElementById('nav-search-input');

    // 1. ABRIR BUSCADOR
    if (trigger && overlay) {
        e.preventDefault();
        overlay.style.display = 'flex';
        if (input) input.focus();
    }

    // 2. CERRAR BUSCADOR
    if (backBtn && overlay) {
        e.preventDefault();
        overlay.style.display = 'none';
        if (input) input.value = '';
    }

    // 3. EJECUTAR BÚSQUEDA
    if (submitBtn && input) {
        const query = input.value.trim();
        if (query) { window.location.href = `venta.html?loc=${encodeURIComponent(query)}`; }
    }
});

// Listener para el Enter en el input (Delegado)
document.addEventListener('keypress', (e) => {
    if (e.target.id === 'nav-search-input' && e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) { window.location.href = `venta.html?loc=${encodeURIComponent(query)}`; }
    }
});

function setupAdminConfig() {
    loadUsersList();
    const passForm = document.getElementById('change-password-form');
    if (passForm) {
        passForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPass = document.getElementById('new-password').value;
            const confirmPass = document.getElementById('confirm-password').value;
            if (newPass !== confirmPass) { alert("❌ Las nuevas contraseñas no coinciden."); return; }
            if (newPass.length < 4) { alert("❌ La contraseña es muy corta."); return; }
            if (!currentUser || !currentUser.id) { alert("Error de sesión."); return; }

            try {
                const res = await fetch(`${API_URL}users/${currentUser.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentUser.email, telefono: currentUser.telefono, password: newPass })
                });
                const data = await res.json();
                if (data.success) { alert("✅ Contraseña actualizada."); passForm.reset(); currentUser = data.user; localStorage.setItem('user', JSON.stringify(currentUser)); }
                else { alert("❌ Error: " + data.message); }
            } catch (err) { alert("❌ Error de conexión."); }
        });
    }
}

async function loadUsersList() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    try {
        const res = await fetch(`${API_URL}users`);
        const users = await res.json();
        tbody.innerHTML = users.map(u => `<tr><td style="padding:1rem;">${u.nombre_completo}</td><td style="padding:1rem;">${u.username}</td><td style="padding:1rem;">${u.email}</td><td style="padding:1rem;">${u.rol}</td></tr>`).join('');
    } catch (err) { tbody.innerHTML = '<tr><td colspan="4">Error al cargar usuarios.</td></tr>'; }
}

async function loadHistoryList() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    try {
        const res = await fetch(`${API_URL}propiedades/historial`);
        const historial = await res.json();
        if (historial.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay historial.</td></tr>'; return; }
        tbody.innerHTML = historial.map(p => `<tr><td style="padding:1rem;">${p.titulo}</td><td style="padding:1rem;">${p.tipo_operacion}</td><td style="padding:1rem;">${p.moneda} ${p.precio}</td><td style="padding:1rem;">${p.comuna}</td><td style="padding:1rem;">-</td><td style="padding:1rem;">${p.estado}</td></tr>`).join('');
    } catch (err) { tbody.innerHTML = '<tr><td colspan="6">Error al cargar historial.</td></tr>'; }
    const logoutBtn = document.getElementById('logout-btn-dashboard');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
}

function setupContactForm() {
    const form = document.getElementById('main-contact-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('contact-name').value;
        const email = document.getElementById('contact-email').value;
        const telefono = document.getElementById('contact-phone').value;
        const mensaje = document.getElementById('contact-message').value;
        const btn = form.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = "Enviando... ⏳"; btn.disabled = true;
        try {
            const res = await fetch(`${API_URL}contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, email, telefono, mensaje }) });
            const data = await res.json();
            if (data.success) { alert("✅ Mensaje enviado."); form.reset(); } else { alert("❌ Error: " + data.message); }
        } catch (err) { alert("Error de conexión."); }
        finally { btn.textContent = originalText; btn.disabled = false; }
    });
}

function setupPaginationButtons(wrapper, pageCategory) {
    wrapper.innerHTML = "";
    let pageCount = Math.ceil(filteredData.length / rows);
    if (pageCount < 2) return;
    let btnPrev = document.createElement('button');
    btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    btnPrev.className = `page-btn ${currentPage === 1 ? 'disabled' : ''}`;
    btnPrev.onclick = () => { if (currentPage > 1) { currentPage--; filterAndRender(pageCategory); document.querySelector('.filters-container').scrollIntoView({ behavior: 'smooth' }); } };
    wrapper.appendChild(btnPrev);
    for (let i = 1; i <= pageCount; i++) {
        let btn = document.createElement('button');
        btn.innerText = i;
        btn.className = `page-btn ${currentPage === i ? 'active' : ''}`;
        btn.onclick = () => { currentPage = i; filterAndRender(pageCategory); document.querySelector('.filters-container').scrollIntoView({ behavior: 'smooth' }); };
        wrapper.appendChild(btn);
    }
    let btnNext = document.createElement('button');
    btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
    btnNext.className = `page-btn ${currentPage === pageCount ? 'disabled' : ''}`;
    btnNext.onclick = () => { if (currentPage < pageCount) { currentPage++; filterAndRender(pageCategory); document.querySelector('.filters-container').scrollIntoView({ behavior: 'smooth' }); } };
    wrapper.appendChild(btnNext);
}

function calculateSolarSavings() {
    const billInput = document.getElementById('solar-bill');
    const resultsDiv = document.getElementById('solar-results');
    const bill = parseInt(billInput.value);
    if (!bill || bill <= 0) { alert("Ingresa un monto válido."); return; }
    const savingsPerPanel = 5000;
    let panelsNeeded = Math.ceil((bill * 0.9) / savingsPerPanel);
    if (panelsNeeded < 2) panelsNeeded = 2;
    const annualSavings = (panelsNeeded * savingsPerPanel) * 12;
    const roi = panelsNeeded > 6 ? "4.5 años" : "5.5 años";
    document.getElementById('res-savings').innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(annualSavings);
    document.getElementById('res-panels').innerText = panelsNeeded + " Unidades";
    document.getElementById('res-roi').innerText = roi;
    resultsDiv.style.display = 'block';
    resultsDiv.style.opacity = '0';
    setTimeout(() => { resultsDiv.style.transition = 'opacity 0.5s'; resultsDiv.style.opacity = '1'; }, 10);
}

function getFavorites() { return JSON.parse(localStorage.getItem('myFavorites')) || []; }
function toggleFavorite(event, id) {
    event.stopPropagation();
    let favs = getFavorites();
    const index = favs.indexOf(id);
    const btn = event.currentTarget;
    if (index === -1) { favs.push(id); btn.classList.add('active'); }
    else { favs.splice(index, 1); btn.classList.remove('active'); }
    localStorage.setItem('myFavorites', JSON.stringify(favs));
}

function createPremiumCardHTML(p) {
    const favs = getFavorites();
    const isFav = favs.includes(p.id);
    const heartIcon = isFav ? 'fas fa-heart' : 'far fa-heart';
    const activeClass = isFav ? 'active' : '';

    // Asegurar imagen válida
    const imgUrl = (p.images && p.images.main) ? p.images.main : 'https://via.placeholder.com/400';

    // Formatear precio si viene como número
    let displayPrice = p.price;
    let precioAproxDisplay = '';
    const ufActual = window.obtenerValorUFActual();

    if (p.rawPrice && !isNaN(p.rawPrice)) {
        if (displayPrice && displayPrice.includes('UF')) {
            precioAproxDisplay = `$${new Intl.NumberFormat('es-CL').format(Math.round(p.rawPrice * ufActual))} aprox.`;
        } else if (displayPrice && (displayPrice.includes('$') || displayPrice.includes('COP') || displayPrice.includes('CLP') || displayPrice.includes('Pesos'))) {
            precioAproxDisplay = `UF ${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p.rawPrice / ufActual)} aprox.`;
        }
    }

    const dorms = (p.specs && p.specs.dorms) || 0;
    const baths = (p.specs && p.specs.baths) || 0;
    const m2 = (p.specs && p.specs.m2Util) || 0;
    const type = p.type || 'Propiedad';
    const code = p.id;

    // Determinar etiqueta según operación
    let tagClass = 'venta'; // Default color dorado
    if (p.operation.toLowerCase().includes('arriendo')) {
        tagClass = 'arriendo'; // Color oscuro
    }

    return `
    <article class="property-card-premium" onclick="window.location.href='web-ficha.html?id=${p.id}'" style="cursor: pointer;">
        <div class="premium-img-wrapper">
            <span class="premium-tag ${tagClass}">${p.operation}</span>
            <span class="premium-code">COD: ${code}</span>
            <img src="${imgUrl}" alt="${p.title}" onerror="this.src='https://via.placeholder.com/400'">
            
             <div class="premium-overlay" style="position:absolute; top:10px; right:10px; z-index:10;">
                 <button class="fav-btn ${activeClass}" onclick="toggleFavorite(event, ${p.id})" style="background:rgba(255,255,255,0.9); border:none; border-radius:50%; width:35px; height:35px; box-shadow:0 2px 5px rgba(0,0,0,0.2); cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <i class="${heartIcon}" style="color:#bfa378; font-size:1.1rem;"></i>
                </button>
            </div>
        </div>
        
        <div class="premium-body">
            <div class="premium-type">${type}</div>
            <h3 class="premium-title">${p.title}</h3>
            <p class="premium-location"><i class="fas fa-map-marker-alt" style="color:#bfa378;"></i> ${p.location}</p>
            <div class="premium-price">${displayPrice} <br><small style="font-size: 0.75rem; color: #999; font-weight: normal;">${precioAproxDisplay}</small></div>
            
            <div class="premium-features">
                <div class="feat-item"><i class="fas fa-bed"></i> ${dorms} Dorm</div>
                <div class="feat-item"><i class="fas fa-bath"></i> ${baths} Baños</div>
                <div class="feat-item"><i class="fas fa-ruler-combined"></i> ${m2} m²</div>
            </div>
            
            <a href="web-ficha.html?id=${p.id}" class="btn-premium">Ver Detalles</a>
        </div>
    </article>`;
}

function createCardHTML(p) {
    const favs = getFavorites();
    const isFav = favs.includes(p.id);
    const heartIcon = isFav ? 'fas fa-heart' : 'far fa-heart';
    const activeClass = isFav ? 'active' : '';
    const badgeClass = p.operation.includes('Venta') ? 'sale' : 'rent';

    let displayPrice = p.price || '';
    let precioAproxDisplay = '';
    const ufActual = window.obtenerValorUFActual();

    if (p.rawPrice && typeof p.rawPrice === 'number') {
        if (displayPrice.includes('UF')) {
            precioAproxDisplay = `$${new Intl.NumberFormat('es-CL').format(Math.round(p.rawPrice * ufActual))} aprox.`;
        } else if (displayPrice.includes('$') || displayPrice.includes('COP') || displayPrice.includes('CLP')) {
            precioAproxDisplay = `UF ${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p.rawPrice / ufActual)} aprox.`;
        }
    }

    // ✅ CORRECCIÓN: Usar la imagen principal de la base de datos o el placeholder si no hay
    const imgUrl = (p.images && p.images.main) ? p.images.main : 'https://via.placeholder.com/400';

    return `
    <article class="property-card" onclick="window.location.href='web-ficha.html?id=${p.id}'" style="cursor: pointer;">
        <div class="card-image-wrapper">
            <span class="badge ${badgeClass}">${p.operation}</span>
            <button class="fav-btn ${activeClass}" onclick="toggleFavorite(event, ${p.id})" title="Guardar en favoritos"><i class="${heartIcon}"></i></button>
            <img src="${imgUrl}" class="card-image" onerror="this.src='https://via.placeholder.com/400'">
        </div>
        <div class="card-content">
            <div class="card-price">${displayPrice} <br><small style="font-size: 0.75rem; color: #999; font-weight: normal;">${precioAproxDisplay}</small></div>
            <h3 class="card-title">${p.title}</h3>
            <p class="card-location"><i class="fas fa-map-marker-alt"></i> ${p.location}</p>
            <div class="card-features">
                <span><i class="fas fa-bed"></i> ${p.specs.dorms}</span>
                <span><i class="fas fa-bath"></i> ${p.specs.baths}</span>
                <span><i class="fas fa-ruler-combined"></i> ${p.specs.m2Util} m²</span>
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; text-align: right;">
                <span class="btn-card-action" style="color: #bfa378; font-weight: 600;">Ver Ficha</span>
            </div>
        </div>
    </article>`;
}

function renderFavoritesPage() {
    const container = document.getElementById('favorites-grid');
    if (!container) return;
    if (!properties || properties.length === 0) { setTimeout(renderFavoritesPage, 500); return; }
    const favIds = getFavorites();
    if (favIds.length === 0) {
        container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px;"><i class="far fa-heart" style="font-size: 4rem; color: #e0e0e0; margin-bottom: 20px;"></i><h3 style="color: #666;">Aún no tienes favoritos</h3><a href="venta.html" class="btn btn-primary">Ir a Vitrina</a></div>`;
        return;
    }
    const misFavoritos = properties.filter(p => favIds.some(id => String(id) === String(p.id)));
    if (misFavoritos.length > 0) { container.innerHTML = misFavoritos.map(p => createCardHTML(p)).join(''); }
    else { container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #666;"><p>Tus propiedades guardadas ya no están disponibles.</p><button onclick="localStorage.removeItem('myFavorites'); location.reload();" class="btn btn-outline" style="margin-top:10px;">Limpiar Lista</button></div>`; }
}

/* ================================================================= */
/* LÓGICA GENERACIÓN DESCRIPCIÓN CON IA (GEMINI 3.0)                 */
/* ================================================================= */

function setupAiDescriptionGenerator() {
    const btnAI = document.getElementById('btn-generate-ai');

    if (!btnAI) return;

    btnAI.addEventListener('click', async () => {
        // 1. Recopilar datos (Input)
        const titulo = document.getElementById('prop-title').value;
        const tipo = document.getElementById('prop-type').value;
        const operacion = document.getElementById('prop-operation').value;
        const ubicacion = document.getElementById('prop-location').value;
        const dorms = document.getElementById('prop-dorms').value;
        const banos = document.getElementById('prop-baths').value;
        const m2 = document.getElementById('prop-m2-total').value;

        // Validación básica
        if (!titulo || !ubicacion) {
            alert("⚠️ Por favor ingresa Título y Ubicación para que la IA pueda redactar.");
            return;
        }

        // 2. Interfaz de carga
        const loading = document.getElementById('ai-loading');
        const textArea = document.getElementById('prop-desc');
        if (loading) loading.style.display = 'block';
        btnAI.disabled = true;
        btnAI.innerHTML = '<i class="fas fa-bolt"></i> Generando con Gemini 3...'; // Feedback visual

        // 3. Prompt (Instrucción directa)
        const prompt = `
            Actúa como un experto Copywriter Inmobiliario.
            Redacta una descripción de venta persuasiva para esta propiedad:
            - Título: ${titulo}
            - Tipo: ${tipo} en ${operacion}
            - Ubicación: ${ubicacion}
            - Detalles: ${dorms} habitaciones, ${banos} baños, ${m2} m2 totales.
            
            Requisitos:
            - Sin saludos ni introducciones ("Aquí tienes la descripción...").
            - Texto directo, aspiracional y profesional.
            - Máximo 150 palabras.
            - Formato texto plano (sin asteriscos ni markdown).
        `;

        try {
            // 4. Conexión con Gemini 3.0 (SEGÚN DOCUMENTACIÓN ACTUAL)
            const API_KEY = "AIzaSyB_J9deh1hdogOWRK1RjXwDmDlS8hy9-Jo";
            const genAI = new GoogleGenerativeAI(API_KEY);

            // ACTUALIZACIÓN CRÍTICA: Usamos el modelo vigente
            const model = genAI.getGenerativeModel({ model: "gemini-robotics-er-1.5-preview" });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const textoGenerado = response.text();

            // 5. Output (Efecto de escritura)
            textArea.value = "";
            let i = 0;
            const speed = 5; // Más rápido para Gemini 3

            const typeWriter = setInterval(() => {
                textArea.value += textoGenerado.charAt(i);
                textArea.scrollTop = textArea.scrollHeight;
                i++;
                if (i > textoGenerado.length - 1) {
                    clearInterval(typeWriter);
                    btnAI.disabled = false;
                    btnAI.innerHTML = '<i class="fas fa-magic"></i> Redactar con IA';
                    if (loading) loading.style.display = 'none';
                }
            }, speed);

        } catch (error) {
            console.error("Error AI:", error);
            alert(`Error de API: ${error.message}. Verifica el modelo vigente en tu región.`);

            btnAI.disabled = false;
            btnAI.innerHTML = '<i class="fas fa-magic"></i> Intentar de nuevo';
            if (loading) loading.style.display = 'none';
        }
    });
}

// Función para mostrar el Menú Principal
function mostrarMenuPrincipal() {
    const menuHTML = `
        <div class="chat-menu-options">
            <button class="menu-btn" onclick="ejecutarOpcion(1)">📅 1. Agendar una visita</button>
            <button class="menu-btn" onclick="ejecutarOpcion(2)">🔍 2. Consultar mis citas</button>
            <button class="menu-btn" onclick="ejecutarOpcion(3)">🔄 3. Reprogramar cita</button>
            <button class="menu-btn" onclick="ejecutarOpcion(4)">❌ 4. Cancelar/Eliminar cita</button>
            <button class="menu-btn" onclick="ejecutarOpcion(5)">❓ 5. Preguntas Frecuentes</button>
            <button class="menu-btn" onclick="ejecutarOpcion(6)">👩‍💼 6. Hablar con Ejecutivo</button>
            <button class="menu-btn" onclick="ejecutarOpcion(7)">👋 7. Salir</button>
        </div>
    `;

    // Agregamos el mensaje del bot con el menú
    appendMessage('bot', '<strong>¿En qué puedo ayudarte hoy?</strong><br>Selecciona una opción:' + menuHTML);
}

// 6. FUNCIÓN DE INTELIGENCIA ARTIFICIAL (NUEVA)
async function enviarMensajeAI(pregunta) {
    const chatBox = document.getElementById('chat-messages');
    const typingInd = document.getElementById('typing-indicator');

    // Mostramos que está pensando
    typingInd.style.display = 'block';

    try {
        // 1. OBTENER CONTEXTO (FAQ DEL SITIO)
        // Leemos el contenido de la sección de preguntas frecuentes para que la IA sepa qué responder
        const faqSection = document.getElementById('faq');
        let contexto = "";
        if (faqSection) {
            contexto = faqSection.innerText.replace(/\s+/g, ' ').substring(0, 5000); // Limpiamos y limitamos
        } else {
            contexto = "Somos Inmobiliaria Marlen Guzmán. Ofrecemos venta, arriendo y administración de propiedades en Los Andes, San Felipe y alrededores.";
        }

        // 2. CREAR EL PROMPT (PERSONALIDAD SERIA Y VENTA)
        const prompt = `
            Eres la "Asistente Virtual Ejecutiva" de Inmobiliaria Marlen Guzmán.
            Tu objetivo es filtrar clientes, resolver dudas con elegancia y SIEMPRE invitar a la acción (agendar visita o contactar).
            
            INFORMACIÓN OFICIAL DEL SITIO:
            "${contexto}"

            TU PERSONALIDAD:
            - Tono: Profesional, Cercano, Educado y Persuasivo.
            - NO uses exceso de emojis (máximo 1 por mensaje).
            - NO inventes información. Si no sabes, deriva a WhatsApp (+569 5228 6689).
            - FORMATO: Respuestas cortas (máximo 40 palabras). Ve al grano.

            PREGUNTA DEL CLIENTE: "${pregunta}"
            
            TU RESPUESTA PROFESIONAL:
        `;

        // 3. LLAMAR A GEMINI (Usamos la instancia ya creada arriba 'chatModel')
        const result = await chatModel.generateContent(prompt);
        const response = await result.response;
        const textoIA = response.text();

        // 4. MOSTRAR RESPUESTA
        typingInd.style.display = 'none';
        addMessage('bot', textoIA);

    } catch (error) {
        console.error("Error AI Chat:", error);
        typingInd.style.display = 'none';
        addMessage('bot', "😓 Lo siento, tuve un error técnico. Por favor escríbeme por WhatsApp.");
    }
}


// Función que maneja qué pasa cuando clicas un botón
function ejecutarOpcion(opcion) {
    switch (opcion) {
        case 1: // Agendar
            appendMessage('bot', "¡Perfecto! Para agendar, dime: <strong>¿Qué día y hora te acomoda y cuál es tu teléfono?</strong>");
            break;
        case 2: // Consultar
            appendMessage('bot', "Para buscar tus citas, por favor escribe tu <strong>número de teléfono</strong> (ej: +5695555555).");
            // Aquí el usuario escribirá su número y el bot lo captará con la lógica que ya arreglamos
            break;
        case 3: // Reprogramar
            appendMessage('bot', "Entendido. Escribe el <strong>ID de la cita</strong> que quieres cambiar y la <strong>nueva fecha/hora</strong>.");
            break;
        case 4: // Eliminar (¡Nueva Funcionalidad!)
            appendMessage('bot', "Para cancelar, necesito que escribas: <strong>'Eliminar cita ID [numero]'</strong>. (Ej: Eliminar cita ID 16)");
            break;
        case 5: // Preguntas Frecuentes
            // Aquí podemos hacer que la IA responda sola o mostrar otro sub-menú
            enviarMensajeAI("¿Cuáles son los requisitos para arrendar o comprar?");
            break;
        case 6: // Ejecutivo
            appendMessage('bot', 'Te estoy derivando a WhatsApp con Marlen... <br><a href="https://wa.me/56959801912" target="_blank" style="color:green; font-weight:bold;">👉 Click aquí para abrir WhatsApp</a>');
            break;
        case 7: // Salir
            appendMessage('bot', "¡Gracias por visitar Inmobiliaria Marlen Guzmán! Cierra el chat cuando gustes.");
            // Opcional: Cerrar el widget automáticamente
            // document.getElementById('chatbot-widget').style.display = 'none';
            break;
    }
}

// Función auxiliar para los botones de hora
window.seleccionarHora = (fecha, hora) => {
    const input = document.getElementById('chat-input');
    const btnSend = document.getElementById('send-chat-btn');

    // Autocompletamos el mensaje con el formato que la IA entiende para AGENDAR
    // Usamos las variables globales de usuario si existen
    let nombre = "[Nombre]";
    let fono = "[Tel]";
    let email = "[Email]";

    if (currentUser) {
        nombre = currentUser.nombre_completo;
        fono = currentUser.telefono;
        email = currentUser.email;
    }

    input.value = `Quiero agendar el ${fecha} a las ${hora}. Soy ${nombre}, fono ${fono}, email ${email}`;

    // Activamos la interfaz para que el usuario solo tenga que dar Enter
    input.disabled = false;
    btnSend.disabled = false;
    input.focus();
};

/* ================================================================= */
/* INDICADORES ECONÓMICOS (ESTRATEGIA BLINDADA)                      */
/* ================================================================= */

// Ejecutar al cargar (Se llama desde DOMContentLoaded)
async function cargarIndicadores() {
    const STORAGE_KEY = 'indicadores_chile_v5_n8n'; // Nueva clave para limpiar caché viejo
    const CACHE_HORAS = 12; // Horas de validez del caché local
    const CACHE_MS = CACHE_HORAS * 60 * 60 * 1000;

    // 1. FASE DE VELOCIDAD: Mostrar caché local si existe y es reciente
    const memoriaRaw = localStorage.getItem(STORAGE_KEY);
    let memoriaObj = null;

    if (memoriaRaw) {
        try {
            memoriaObj = JSON.parse(memoriaRaw);
            const edadMs = Date.now() - (memoriaObj.timestamp || 0);

            if (edadMs < CACHE_MS) {
                // Datos frescos: usar directamente sin hacer fetch al servidor
                renderizarIndicadores(memoriaObj.datos);
                console.log(`⚡ Indicadores desde caché local (${Math.round(edadMs / 60000)} min de antigüedad)`);
                return;
            }

            // Datos viejos: pintarlos igual para mostrar algo mientras actualizamos
            renderizarIndicadores(memoriaObj.datos);
            console.log('⚠️ Caché local antiguo (>12h), actualizando desde servidor...');
        } catch (e) {
            console.warn('Caché corrupto, limpiando...');
            localStorage.removeItem(STORAGE_KEY);
            memoriaObj = null;
        }
    }

    // 2. FASE DE ACTUALIZACIÓN: Llamar al endpoint propio del servidor (proxy N8N)
    // Esto evita los bloqueos CORS y rate-limiting de mindicador.cl en el navegador
    try {
        const response = await fetch('/api/indicadores');
        if (!response.ok) throw new Error('Error de red al contactar /api/indicadores');

        const result = await response.json();

        if (result.success && result.datos) {
            // Guardar en localStorage con timestamp actual
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                timestamp: Date.now(),
                datos: result.datos
            }));
            renderizarIndicadores(result.datos);
            console.log(`✅ Indicadores actualizados (fuente: ${result.fuente})`);
        } else {
            throw new Error('El servidor no devolvió datos válidos');
        }

    } catch (error) {
        console.error('❌ Error al cargar indicadores desde servidor:', error.message);

        // 3. FASE DE RESPALDO: Si el servidor falla, usar caché antiguo o hardcoded
        if (memoriaObj && memoriaObj.datos) {
            renderizarIndicadores(memoriaObj.datos);
            console.warn('🗄️ Usando datos viejos del caché local como respaldo.');
        } else {
            // Último recurso: valores hardcoded para no mostrar '...'
            renderizarIndicadores({ uf: 38550, dolar: 980, euro: 1050, utm: 66000, ipc: 0.0 });
        }
    }
}

// Función visual segura (No falla si falta un elemento HTML)
function renderizarIndicadores(d) {
    const fmt = (num) => {
        if (!num) return '...';
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);
    };

    // 1. UF (Navbar Principal)
    const elUf = document.getElementById('nav-uf-valor');
    if (elUf && d.uf) {
        // Quitamos el signo $ para que diga "UF 38.000"
        elUf.textContent = `UF ${new Intl.NumberFormat('es-CL').format(d.uf)}`;
    }

    // 2. Elementos del Dropdown (Verificamos existencia antes de escribir)
    if (document.getElementById('nav-dolar')) document.getElementById('nav-dolar').textContent = fmt(d.dolar);
    if (document.getElementById('nav-euro')) document.getElementById('nav-euro').textContent = fmt(d.euro);
    if (document.getElementById('nav-utm')) document.getElementById('nav-utm').textContent = fmt(d.utm);
    if (document.getElementById('nav-ipc')) document.getElementById('nav-ipc').textContent = d.ipc + '%';

    // 3. Fecha de actualización
    if (document.getElementById('nav-fecha')) {
        document.getElementById('nav-fecha').textContent = new Date().toLocaleDateString('es-CL');
    }
}
