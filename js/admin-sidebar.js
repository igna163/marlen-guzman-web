document.addEventListener("DOMContentLoaded", function () {
    const sidebarContainer = document.querySelector(".sidebar");
    if (sidebarContainer) {
        fetch("sidebar-admin.html")
            .then((response) => response.text())
            .then((html) => {
                sidebarContainer.innerHTML = html;

                // Highlight active link
                const currentPath = window.location.pathname.split("/").pop();
                const links = sidebarContainer.querySelectorAll("a");
                links.forEach((link) => {
                    if (link.getAttribute("href") === currentPath) {
                        link.classList.add("active");
                    }
                });

                // Re-run user update logic if admin-auth.js is present
                // We use a small timeout to ensure admin-auth has run its check, or just read from localStorage directly
                const userStr = localStorage.getItem("user");
                if (userStr) {
                    try {
                        const user = JSON.parse(userStr);
                        if (typeof updateAdminUI === "function") {
                            updateAdminUI(user);
                        } else {
                            // Fallback if updateAdminUI is not global or available
                            const sidebarUser = document.getElementById("sidebar-user");
                            if (sidebarUser) {
                                sidebarUser.textContent = user.nombre_completo || "Usuario";
                            }
                        }
                    } catch (e) {
                        console.error("Error parsing user for sidebar update", e);
                    }
                }
            })
            .catch((err) => console.error("Error loading sidebar:", err));
    }
});
