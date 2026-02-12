/**
 * ADMIN AUTHENTICATION & UI SYNC
 * Este script debe incluirse en TODAS las páginas del panel de administración (admin-*.html).
 * Se encarga de:
 * 1. Verificar si hay un usuario logueado en localStorage ('user').
 * 2. Redirigirse al login si no hay sesión.
 * 3. Actualizar la interfaz (Sidebar, Header) con el nombre del usuario.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificación de Sesión
    // Intentamos leer 'user' (el estándar nuevo) o 'usuario_logueado' (el antiguo, por compatibilidad durante la migración)
    let userStr = localStorage.getItem('user') || localStorage.getItem('usuario_logueado');

    if (!userStr) {
        console.warn("⚠️ No se detectó sesión activa. Redirigiendo a Login...");
        window.location.href = 'index.html';
        return;
    }

    let user;
    try {
        user = JSON.parse(userStr);
    } catch (e) {
        console.error("❌ Error al leer datos de usuario:", e);
        localStorage.removeItem('user');
        localStorage.removeItem('usuario_logueado');
        window.location.href = 'index.html';
        return;
    }

    // 2. Validación de Rol (Opcional, pero recomendada)
    if (user.rol !== 'admin') {
        alert("⛔ Acceso denegado. Se requieren permisos de administrador.");
        window.location.href = 'index.html';
        return;
    }

    console.log("✅ Sesión validada para:", user.nombre_completo);

    // 3. Actualización de UI (Elementos Comunes)
    updateAdminUI(user);
});

function updateAdminUI(user) {
    const nombre = user.nombre_completo || "Admin";
    const primerNombre = nombre.split(' ')[0];

    // A. Sidebar (Nombre debajo de la foto/icono)
    // ID común: 'sidebar-user' o 'sidebar_usuario'
    const sidebarUser = document.getElementById('sidebar-user') || document.getElementById('sidebar_usuario');
    if (sidebarUser) sidebarUser.textContent = nombre;

    const sidebarCode = document.getElementById('sidebar_cod'); // A veces se usa para mostrar el ID del admin
    if (sidebarCode && !sidebarCode.textContent.includes("Cód")) {
        // Solo si no es un código de propiedad
        sidebarCode.textContent = `ID: ${user.id || 'N/A'}`;
    }

    // B. Header / Mensaje de Bienvenida
    // ID común: 'welcome-msg' (Dashboard) o elementos con clase 'admin-welcome'
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) welcomeMsg.innerText = `Hola, ${primerNombre} 👋`;

    const adminWelcomeClass = document.querySelector('.admin-welcome');
    if (adminWelcomeClass) adminWelcomeClass.innerText = `Bienvenido, ${primerNombre}`;

    // C. Header Nav (Usuario arriba a la derecha en algunas plantillas)
    const headerUsername = document.getElementById('header-username');
    if (headerUsername) headerUsername.textContent = primerNombre;
}

// Función global de Logout para ser usada en cualquier botón
window.logout = function () {
    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
        localStorage.removeItem('user');
        localStorage.removeItem('usuario_logueado'); // Limpiamos ambos por si acaso
        window.location.href = 'index.html';
    }
};
