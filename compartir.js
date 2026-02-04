const { google } = require('googleapis');
const path = require('path');

// 1. Configuración (Igual que en tu server.js)
const keyFile = path.join(__dirname, 'google-credentials.json'); // O el nombre largo de tu archivo
const scopes = ['https://www.googleapis.com/auth/calendar'];

const auth = new google.auth.GoogleAuth({
    keyFile: keyFile,
    scopes: scopes,
});

const calendar = google.calendar({ version: 'v3', auth });

async function compartirCalendarioDelRobot() {
    try {
        console.log("🤖 El Robot está intentando compartir su calendario contigo...");

        const rule = {
            scope: {
                type: 'user',
                value: 'ignacio.ojeda2002@gmail.com', // <--- TU CORREO AQUÍ
            },
            role: 'writer', // Te da permiso para ver y editar
        };

        const res = await calendar.acl.insert({
            calendarId: 'primary',
            resource: rule,
        });

        console.log("✅ ¡ÉXITO! Calendario compartido.");
        console.log("🆔 ID de la regla:", res.data.id);
        console.log("👉 Ahora ve a Google Calendar y agrega el correo del robot en 'Suscribirse al calendario'.");

    } catch (error) {
        console.error("❌ Error al compartir:", error.message);
    }
}

compartirCalendarioDelRobot();