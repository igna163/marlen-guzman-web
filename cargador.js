document.addEventListener("DOMContentLoaded", function () {

    // --- 1. CARGAR EL NAVBAR ---
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (navPlaceholder) {
        fetch('navbar.html')
            .then(response => {
                if (!response.ok) throw new Error("No se pudo cargar el navbar");
                return response.text();
            })
            .then(data => {
                document.getElementById('nav-placeholder').innerHTML = data;

                // ============================================================
                // TOGGLE DEL MENÚ HAMBURGUESA (☰)
                // Se configura aquí directamente para garantizar que funcione
                // independientemente del timing de script.js (type=module)
                // ============================================================
                initNavbarToggle();

                // Intentar también llamar setupNavigation de script.js si está disponible
                document._navSetup = false;
                if (typeof window.setupNavigation === 'function') {
                    window.setupNavigation();
                } else {
                    // Si script.js aún no cargó, esperamos un ciclo y reintentamos
                    setTimeout(() => {
                        if (typeof window.setupNavigation === 'function' && !document._navSetup) {
                            window.setupNavigation();
                        }
                    }, 300);
                }

                // Actualizar UI de login/usuario
                if (typeof window.updateUserUI === 'function') {
                    window.updateUserUI();
                }
            })
            .catch(error => console.error("Error al cargar navbar:", error));
    }

    // --- 2. CARGAR EL FOOTER ---
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
        fetch('footer.html')
            .then(response => {
                if (!response.ok) throw new Error("No se pudo cargar el footer");
                return response.text();
            })
            .then(data => {
                footerPlaceholder.innerHTML = data;
                // Actualizar año automáticamente
                const yearSpan = document.getElementById('footer-year');
                if (yearSpan) {
                    yearSpan.textContent = new Date().getFullYear();
                }
            })
            .catch(error => console.error("Error al cargar el footer:", error));
    }
});

// ============================================================
// FUNCIÓN DE TOGGLE DEL NAVBAR MÓVIL
// Implementada aquí para garantizar funcionamiento sin depender
// del timing de carga de script.js (que es type="module")
// ============================================================
function initNavbarToggle() {
    const btn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('.nav-links');

    if (!btn || !nav) {
        console.warn('initNavbarToggle: no se encontró .mobile-menu-btn o .nav-links');
        return;
    }

    // Eliminar listeners previos clonando el botón
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    // Toggle al hacer click en ☰
    newBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = nav.classList.contains('active');

        if (isOpen) {
            // CERRAR menú
            nav.classList.remove('active');
            newBtn.classList.remove('active');
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
            // ABRIR menú
            nav.classList.add('active');
            newBtn.classList.add('active');
        }
    });

    // Click en un link de dropdown en móvil → abrir/cerrar sub-menú
    nav.addEventListener('click', function (e) {
        if (window.innerWidth > 900) return;

        const dropLink = e.target.closest('.dropdown > a');
        if (dropLink) {
            e.preventDefault();
            e.stopPropagation();

            const dropdown = dropLink.closest('.dropdown');
            const content = dropdown.querySelector('.dropdown-content');
            if (!content) return;

            const isOpen = content.classList.contains('mobile-open');

            // Cerrar todos los otros dropdowns
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
        }
    });

    // Click fuera del navbar → cerrar menú
    document.addEventListener('click', function (e) {
        if (window.innerWidth > 900) return;
        if (nav.classList.contains('active') && !e.target.closest('.navbar')) {
            nav.classList.remove('active');
            newBtn.classList.remove('active');
            nav.querySelectorAll('.dropdown-content.mobile-open').forEach(d => {
                d.classList.remove('mobile-open');
                d.style.display = '';
                d.style.position = '';
                d.style.boxShadow = '';
                d.style.borderTop = '';
                d.style.padding = '';
            });
        }
    });
}