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

                // INTENTO DE ACTUALIZAR LA UI (LOGIN vs USUARIO)
                // Esto verifica si la función es visible globalmente antes de llamarla
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
            })
            .catch(error => console.error("Error al cargar el footer:", error));
    }
});