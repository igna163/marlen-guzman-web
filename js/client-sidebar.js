document.addEventListener("DOMContentLoaded", function () {
    const sidebarContainer = document.querySelector(".sidebar");
    
    // Función para manejar el logout (reutilizada de script.js si es necesario)
    window.handleLogout = function() {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    };

    if (sidebarContainer) {
        fetch("client-sidebar.html")
            .then((response) => response.text())
            .then((html) => {
                sidebarContainer.innerHTML = html;

                // Highlight active link
                const currentPath = window.location.pathname.split("/").pop() || 'cliente.html'; // Default to cliente.html if root
                const links = sidebarContainer.querySelectorAll("a");
                links.forEach((link) => {
                    if (link.getAttribute("href") === currentPath) {
                        link.classList.add("active");
                    }
                });

                // User Identification
                const userStr = localStorage.getItem("user");
                if (userStr) {
                    try {
                        const user = JSON.parse(userStr);
                        const sidebarUser = document.getElementById("sidebar-user");
                        
                        // Actualizar nombre en sidebar
                        if (sidebarUser) {
                            sidebarUser.textContent = user.nombre_completo || user.username || "Cliente";
                        }
                        
                        // Actualizar mensaje de bienvenida en dashboard si existe
                        const welcomeMsg = document.getElementById("welcome-msg");
                        if (welcomeMsg) {
                            welcomeMsg.textContent = `Hola, ${user.nombre_completo || user.username} 👋`;
                        }

                    } catch (e) {
                        console.error("Error parsing user for sidebar update", e);
                    }
                } else {
                     // Si no hay usuario, redirigir al login (opcional, pero buena práctica)
                     // window.location.href = 'index.html'; 
                }
            })
            .catch((err) => console.error("Error loading sidebar:", err));
    }
});
