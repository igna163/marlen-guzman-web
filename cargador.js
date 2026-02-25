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

                // Reiniciar el flag para que setupNavigation() se registre ahora
                // que el navbar ya está en el DOM
                document._navSetup = false;
                if (typeof window.setupNavigation === 'function') {
                    window.setupNavigation();
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