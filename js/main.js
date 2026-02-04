document.addEventListener('DOMContentLoaded', () => {

    // 1. Manejo de botones Toggle Simples (Exclusividad, Canje)
    // Buscamos todos los grupos que tengan la clase .toggle-group
    const toggleGroups = document.querySelectorAll('.toggle-group');

    toggleGroups.forEach(group => {
        const buttons = group.querySelectorAll('.btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', function () {
                // Reset visual del grupo
                buttons.forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-primary');
                });

                // Activar botón presionado
                this.classList.remove('btn-outline-primary');
                this.classList.add('active', 'btn-primary');

                // (Opcional) Si hay un input hidden asociado, actualizar su valor
                // const value = this.getAttribute('data-value');
                // Lógica para actualizar input hidden si es necesario
            });
        });
    });

    // 2. Manejo de Paneles (Venta, Arriendo)
    // Buscamos grupos con clase .toggle-panel
    const panelToggles = document.querySelectorAll('.toggle-panel');

    panelToggles.forEach(group => {
        const buttons = group.querySelectorAll('.btn');
        const targetId = group.getAttribute('data-target'); // ej: panelVenta
        const targetPanel = document.getElementById(targetId);

        buttons.forEach(btn => {
            btn.addEventListener('click', function () {
                // Reset visual
                buttons.forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-primary');
                });

                // Activar botón
                this.classList.remove('btn-outline-primary');
                this.classList.add('active', 'btn-primary');

                // Lógica de mostrar/ocultar panel
                const isYes = this.getAttribute('data-value') === 'true';
                if (isYes) {
                    targetPanel.classList.remove('disabled-panel');
                    targetPanel.style.pointerEvents = "auto";
                } else {
                    targetPanel.classList.add('disabled-panel');
                    targetPanel.style.pointerEvents = "none";
                    // Opcional: limpiar campos al desactivar
                }
            });
        });
    });

    // 3. Validación al presionar Siguiente
    // 3. Validación al presionar Siguiente
    const btnSiguiente = document.getElementById('btnSiguiente');
    btnSiguiente.addEventListener('click', () => {
        const requiredInputs = document.querySelectorAll('.required-field');
        let isValid = true;

        requiredInputs.forEach(input => {
            if (input.value.trim() === "") {
                input.classList.add('is-invalid');
                isValid = false;
            } else {
                input.classList.remove('is-invalid');
            }
        });

        if (isValid) {
            // 1. Guardamos los datos clave en LocalStorage para usarlos después
            const datosPaso1 = {
                tipo: document.getElementById('tipoPropiedad').value,
                rol: document.getElementById('rolSii').value
            };
            localStorage.setItem('nuevaPropiedad_Paso1', JSON.stringify(datosPaso1));

            // 2. Mensaje de éxito (Opcional, puedes quitarlo si prefieres que sea rápido)
            // alert("¡Paso 1 Validado! Pasando al Paso 2...");

            // 3. REDIRECCIÓN (Esta era la línea que tenías comentada)
            // Asegúrate de que tu archivo HTML del paso 2 se llame exactamente así:
            window.location.href = 'admin-publicar-paso2.html';

        } else {
            alert("Por favor, complete los campos obligatorios.");
        }
    });

    // Remover estado de error al escribir
    const inputs = document.querySelectorAll('.form-control, .form-select');
    inputs.forEach(input => {
        input.addEventListener('input', function () {
            if (this.classList.contains('is-invalid')) {
                this.classList.remove('is-invalid');
            }
        });
    });
});