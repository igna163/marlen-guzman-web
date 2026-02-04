const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
// const { google } = require('googleapis'); <--- ELIMINADO (Ya no lo necesitamos)
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 1. CARPETA PÚBLICA PARA FOTOS
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. CONFIGURACIÓN MULTER (Subida de archivos)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 3. BASE DE DATOS
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect((err) => {
    if (err) console.error('❌ Error de conexión de la base de datos', err.stack);
    else console.log('✅ Correctamente se ha conectado a la base de datos');
});

// 4. CONFIGURACIÓN EMAIL
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ignacio.ojeda2002@gmail.com',
        pass: 'uoqxahcwqiibitcr'
    }
});

async function enviarCorreo(destinatario, asunto, mensajeHTML) {
    try {
        await transporter.sendMail({
            from: '"Gestión Inmobiliaria" <ignacio.ojeda2002@gmail.com>',
            to: destinatario,
            subject: asunto,
            html: mensajeHTML
        });
        console.log(`📧 Correo enviado a: ${destinatario}`);
    } catch (error) {
        console.error('❌ Error enviando correo:', error);
    }
}

const errorResponse = (res, msg, status = 500) => res.status(status).json({ success: false, message: msg });

/* ======================================================= */
/* NUEVA LÓGICA: CONEXIÓN CON N8N (WEBHOOK)                */
/* ======================================================= */

async function agendarEnGoogle(fechaStr, horaStr, nombreCliente, telefono, emailCliente) {
    console.log(`🚀 Preparando envío a N8N para: ${fechaStr} a las ${horaStr}`);

    // URL DE TU WEBHOOK DE N8N
    // NOTA: Si n8n está en "Inactive", usa 'webhook-test' y dale al botón "Listen".
    // Si n8n está en "Active" (verde), usa 'webhook' (sin -test).
    const N8N_URL = "http://localhost:5678/webhook/agendar-cita";

    try {
        // 1. Formatear la fecha para que sea estándar (YYYY-MM-DD)
        let fechaISO = fechaStr;
        if (fechaStr.includes('/')) {
            const partes = fechaStr.split('/');
            if (partes.length === 3) {
                fechaISO = `${partes[2]}-${partes[1]}-${partes[0]}`;
            }
        }

        const fechaInicio = new Date(`${fechaISO}T${horaStr}:00`);

        // Validación básica de fecha
        if (isNaN(fechaInicio.getTime())) {
            console.error("❌ Fecha inválida, cancelando envío a N8N.");
            return;
        }

        const fechaFin = new Date(fechaInicio);
        fechaFin.setHours(fechaInicio.getHours() + 1); // Duración: 1 hora

        // 2. Preparamos el paquete de datos (Payload)
        const payload = {
            summary: `Visita: ${nombreCliente}`,
            description: `Cliente: ${nombreCliente}\nTeléfono: ${telefono}\nEmail: ${emailCliente}\n\nAgendado vía Chatbot.`,
            start: fechaInicio.toISOString(),
            end: fechaFin.toISOString(),
            email: emailCliente // Este campo activa la invitación en n8n
        };

        // 3. Enviamos los datos a n8n usando fetch
        // (Node 18+ soporta fetch nativo. Si usas Node viejo, necesitas 'node-fetch')
        const response = await fetch(N8N_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log("✅ ÉXITO: Datos entregados a N8N. El calendario se actualizará pronto.");
        } else {
            console.error(`⚠️ N8N recibió los datos pero dio error: ${response.status} ${response.statusText}`);
        }

    } catch (error) {
        console.error('❌ Error conectando con N8N (Revisa que Docker esté corriendo):', error.message);
    }
}

// =======================================================
//                RUTAS DE AUTH Y USUARIOS
// =======================================================

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND password = $2', [email, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            delete user.password;
            res.json({ success: true, user: user });
        } else {
            res.status(401).json({ success: false, message: 'Correo electrónico o contraseña incorrectos' });
        }
    } catch (err) { errorResponse(res, err.message); }
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const userCheck = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Este correo no está registrado.' });
        }
        const tempPass = 'MG-' + Math.floor(1000 + Math.random() * 9000);
        await pool.query('UPDATE usuarios SET password = $1 WHERE email = $2', [tempPass, email]);

        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Recuperación de Clave</h2>
                <p>Tu nueva contraseña temporal es: <strong>${tempPass}</strong></p>
                <p>Por favor, cámbiala al ingresar.</p>
            </div>
        `;
        await enviarCorreo(email, "🔑 Tu Nueva Contraseña Temporal", html);
        res.json({ success: true, message: 'Correo enviado correctamente' });
    } catch (err) {
        console.error("Error en recuperación:", err);
        errorResponse(res, err.message);
    }
});

app.post('/api/register', async (req, res) => {
    const { nombre_completo, username, email, password, telefono } = req.body;
    if (!nombre_completo || !username || !email || !password) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
    }
    try {
        const check = await pool.query('SELECT * FROM usuarios WHERE username = $1 OR email = $2', [username, email]);
        if (check.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'El usuario o correo ya existe.' });
        }
        const query = 'INSERT INTO usuarios (nombre_completo, username, email, password, telefono, rol) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, rol, email, telefono';
        const result = await pool.query(query, [nombre_completo, username, email, password, telefono, 'cliente']);

        const currentUrl = req.get('origin') || req.get('referer') || 'http://localhost:3000';
        const htmlBienvenida = `<h1>¡Bienvenido ${nombre_completo}!</h1><p>Gracias por registrarte.</p><a href="${currentUrl}">Ir a la web</a>`;

        enviarCorreo(email, "¡Bienvenido a Marlen Guzmán! 🏠", htmlBienvenida);
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error(err);
        errorResponse(res, err.message);
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre_completo, username, email, telefono, rol FROM usuarios ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { errorResponse(res, err.message); }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { email, telefono, password, currentPassword } = req.body;
    try {
        if (password) {
            if (!currentPassword) return res.status(400).json({ success: false, message: 'Falta la contraseña actual.' });
            const userCheck = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
            if (userCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
            if (userCheck.rows[0].password !== currentPassword) return res.status(401).json({ success: false, message: 'La contraseña actual es incorrecta.' });

            const query = 'UPDATE usuarios SET email = $1, telefono = $2, password = $3 WHERE id = $4 RETURNING id, username, email, telefono, rol';
            const result = await pool.query(query, [email, telefono, password, id]);
            return res.json({ success: true, user: result.rows[0] });
        }
        const query = 'UPDATE usuarios SET email = $1, telefono = $2 WHERE id = $3 RETURNING id, username, email, telefono, rol';
        const result = await pool.query(query, [email, telefono, id]);
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error(err);
        errorResponse(res, err.message);
    }
});

// =======================================================
//                RUTAS DE PROPIEDADES
// =======================================================

app.get('/api/propiedades', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM propiedades WHERE active = TRUE ORDER BY id DESC');
        const propiedadesAdaptadas = result.rows.map(row => ({
            id: row.id,
            title: row.titulo,
            operation: row.tipo_operacion,
            type: row.tipo_propiedad,
            price: row.precio ? (row.moneda || 'UF') + ' ' + row.precio.toLocaleString('es-CL') : 'Consulte Precio',
            rawPrice: row.precio,
            location: row.comuna,
            desc: row.descripcion,
            ggcc: row.gastos_comunes,
            specs: {
                dorms: row.dormitorios,
                baths: row.banos,
                m2Total: row.m2_totales,
                m2Util: row.m2_utiles,
                parking: row.estacionamientos,
                pool: row.piscina,
                elevator: row.ascensor,
                quincho: row.quincho
            },
            images: {
                main: row.imagen_url || 'https://via.placeholder.com/400',
                gallery: row.galeria || []
            },
            estado: row.estado,
            active: row.active
        }));
        res.json(propiedadesAdaptadas);
    } catch (err) { errorResponse(res, err.message); }
});

app.get('/api/propiedades/historial', async (req, res) => {
    try {
        const query = "SELECT * FROM propiedades WHERE active = FALSE OR estado IN ('Vendida', 'Arrendada', 'Finalizada') ORDER BY id DESC";
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { errorResponse(res, err.message); }
});

app.get('/api/propiedades/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM propiedades WHERE id = $1', [req.params.id]);
        if (result.rows.length > 0) res.json(result.rows[0]);
        else res.status(404).json({ message: 'Propiedad no encontrada' });
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/propiedades', upload.array('fotos', 20), async (req, res) => {
    const { title, operation, type, price, currency, ggcc, location, dorms, baths, desc, m2_util, m2_total, parking, pool: hasPool, elevator, status, quincho } = req.body;
    let rutaPortada = 'https://via.placeholder.com/400';
    let galeriaCompleta = [];

    if (req.files && req.files.length > 0) {
        galeriaCompleta = req.files.map(file => 'uploads/' + file.filename);
        rutaPortada = galeriaCompleta[0];
    }

    try {
        const query = `
            INSERT INTO propiedades 
            (titulo, descripcion, tipo_operacion, tipo_propiedad, precio, moneda, gastos_comunes, dormitorios, banos, comuna, imagen_url, galeria, m2_utiles, m2_totales, estacionamientos, piscina, ascensor, active, estado, quincho)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, TRUE, $18, $19) RETURNING *
        `;
        const values = [
            title, desc, operation, type || 'Casa', parseInt(price) || 0, currency || 'UF', parseInt(ggcc) || 0,
            parseInt(dorms) || 0, parseInt(baths) || 0, location, rutaPortada, JSON.stringify(galeriaCompleta),
            parseInt(m2_util) || 0, parseInt(m2_total) || 0, parking === 'true' ? 1 : 0, hasPool === 'true',
            elevator === 'true', status || 'Activa', quincho === 'true'
        ];

        const result = await pool.query(query, values);
        const nuevaPropiedad = result.rows[0];

        // --- AUTOMATIZACIÓN PUBLICACIÓN RRSS (N8N) ---
        const CLOUDFLARE_URL = "https://wake-win-pub-attorney.trycloudflare.com/";
        const N8N_WEBHOOK_RRSS = "http://localhost:5678/webhook-test/publicar-casa";

        const payloadRRSS = {
            titulo: nuevaPropiedad.titulo,
            comuna: nuevaPropiedad.comuna,
            precio: `${nuevaPropiedad.moneda} ${nuevaPropiedad.precio}`,
            imagen_publica: CLOUDFLARE_URL + nuevaPropiedad.imagen_url,
            mensaje: `🏠 Nueva Propiedad en ${nuevaPropiedad.comuna}!`
        };

        // No bloqueamos la respuesta esperando a N8N
        fetch(N8N_WEBHOOK_RRSS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadRRSS)
        })
            .then(() => console.log("✅ Datos enviados a n8n (Redes Sociales)"))
            .catch(err => console.error("⚠️ Error conectando con n8n RRSS:", err.message));

        res.json({ success: true, property: nuevaPropiedad });
    } catch (err) {
        console.error("Error completo:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/propiedades/:id', upload.array('fotos', 20), async (req, res) => {
    const { id } = req.params;
    const { title, operation, type, price, currency, ggcc, location, dorms, baths, desc, m2_util, m2_total, parking, pool: hasPool, elevator, status, quincho, fotos_guardadas } = req.body;

    try {
        let galeriaFinal = [];
        if (fotos_guardadas) {
            try { galeriaFinal = JSON.parse(fotos_guardadas); } catch (e) { galeriaFinal = []; }
        }
        if (req.files && req.files.length > 0) {
            const nuevasFotos = req.files.map(file => 'uploads/' + file.filename);
            galeriaFinal = galeriaFinal.concat(nuevasFotos);
        }
        const nuevaPortada = galeriaFinal.length > 0 ? galeriaFinal[0] : 'https://via.placeholder.com/400';

        const query = `
            UPDATE propiedades SET 
            titulo=$1, descripcion=$2, tipo_operacion=$3, tipo_propiedad=$4, precio=$5, moneda=$6, gastos_comunes=$7, 
            dormitorios=$8, banos=$9, comuna=$10, m2_utiles=$11, m2_totales=$12, estacionamientos=$13, piscina=$14, 
            ascensor=$15, estado=$16, quincho=$17, imagen_url=$18, galeria=$19
            WHERE id=$20 RETURNING *
        `;
        const values = [
            title, desc, operation, type, parseInt(price) || 0, currency, parseInt(ggcc) || 0,
            parseInt(dorms) || 0, parseInt(baths) || 0, location, parseInt(m2_util) || 0, parseInt(m2_total) || 0,
            parking === 'true' ? 1 : 0, hasPool === 'true', elevator === 'true', status, quincho === 'true',
            nuevaPortada, JSON.stringify(galeriaFinal), id
        ];

        const result = await pool.query(query, values);
        res.json({ success: true, property: result.rows[0] });
    } catch (err) { console.error(err); res.status(500).send(err.message); }
});
/* ======================================================= */
/* API V2: GESTIÓN DE PROPIEDADES (TABLAS NUEVAS)         */
/* ======================================================= */

app.post('/api/publicar-v2', async (req, res) => {
    const { p1, p2, p3, p4, p5 } = req.body;
    console.log("📥 Recibiendo datos para tablas 'propietarios' y 'propiedades2'...");

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Iniciar transacción (Todo o nada)

        // ---------------------------------------------------------
        // 1. INSERTAR OBTENER PROPIETARIO (Tabla: propietarios)
        // ---------------------------------------------------------
        let propietarioId;

        // Verificamos si el RUT ya existe
        const checkProp = await client.query('SELECT id FROM propietarios WHERE rut = $1', [p5.rut]);

        if (checkProp.rows.length > 0) {
            // Si existe, tomamos su ID
            propietarioId = checkProp.rows[0].id;
            console.log(`👤 Propietario encontrado (ID: ${propietarioId})`);
        } else {
            // Si no existe, lo creamos
            const insertPropQuery = `
                INSERT INTO propietarios 
                (rut, nombre_completo, email, telefono, tipo_documento, es_activo, rating, comentarios)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id;
            `;
            // Construimos el nombre completo
            const nombreFull = `${p5.nombre} ${p5.apellidoP} ${p5.apellidoM || ''}`.trim();

            const valuesProp = [
                p5.rut,
                nombreFull,
                p5.email,
                p5.celular,
                p5.tipoDoc || 'rut',
                (p5.esActivo === 'true' || p5.esActivo === true), // Convertir a booleano
                parseInt(p5.rating) || 3,
                p5.comentarios
            ];

            const resProp = await client.query(insertPropQuery, valuesProp);
            propietarioId = resProp.rows[0].id;
            console.log(`🆕 Nuevo propietario creado (ID: ${propietarioId})`);
        }

        // ---------------------------------------------------------
        // 2. INSERTAR PROPIEDAD (Tabla: propiedades2)
        // ---------------------------------------------------------

        // Preparamos el objeto JSON para la columna 'detalles_json'
        // Aquí guardamos todos los checkboxes que no tienen columna propia
        const detallesExtras = {
            piscina: p3.piscina,
            jacuzzi: p3.jacuzzi,
            quincho: p3.quincho || p3.barbecue, // En tu paso 3 se llama 'barbecue' en el name
            loggia: p3.loggia,
            riego_automatico: p3.riego_auto,
            porton_automatico: p3.porton_auto,
            calefaccion: p3.tipo_calefaccion,
            ventanas: p3.tipo_ventanas,
            pisos: {
                dormitorios: p3.piso_dormitorios,
                banos: p3.piso_banos,
                cocina: p3.piso_cocina
            }
        };

        const insertCasaQuery = `
            INSERT INTO propiedades2 
            (
                propietario_id, 
                tipo_propiedad, rol_sii, exclusividad, 
                operacion_venta, precio_venta, moneda_venta, 
                operacion_arriendo, precio_arriendo, moneda_arriendo,
                gastos_comunes, contribuciones, canje,
                region, comuna, sector, direccion_calle, direccion_numero, direccion_unidad,
                dormitorios, banos, suites, superficie_util, superficie_total, estacionamientos, bodegas,
                detalles_json,
                titulo_publicacion, descripcion_publica, observaciones_internas, forma_visita,
                estado_publicacion
            )
            VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, 'PUBLICADA')
            RETURNING id;
        `;

        // Calculamos estacionamientos totales (cubiertos + descubiertos)
        const totalEstac = (parseInt(p3.estac_cub) || 0) + (parseInt(p3.estac_des) || 0);

        // Convertimos bodega 'Si'/'No' a numero (1/0) o lo dejamos como contador si el input fuera numero
        const totalBodegas = p3.bodega === 'Si' ? 1 : 0;

        const valuesCasa = [
            propietarioId,
            p1.tipo,
            p1.rol,
            (p1.exclusividad === 'Sí'), // Booleano
            p1.operacion.venta,         // Booleano
            parseInt(p1.operacion.precioVenta) || 0,
            p1.operacion.monedaVenta,
            p1.operacion.arriendo,      // Booleano
            parseInt(p1.operacion.precioArriendo) || 0,
            p1.operacion.monedaArriendo,
            parseInt(p1.gastosComunes) || 0,
            parseInt(p1.contribuciones) || 0,
            (p1.canje === 'Sí'),        // Booleano
            p2.region,
            p2.comuna,
            p2.sector,
            p2.calle,
            p2.numero,
            p2.unidad,
            parseInt(p3.num_dormitorios) || 0,
            parseInt(p3.num_banos) || 0,
            parseInt(p3.num_suites) || 0,
            parseFloat(p3.sup_construida) || 0,
            parseFloat(p3.sup_terreno) || 0,
            totalEstac,
            totalBodegas,
            JSON.stringify(detallesExtras), // Guardamos el JSON
            p4.titulo,
            p4.descripcion,
            p4.obsInternas,
            p4.formaVisita
        ];

        const resultCasa = await client.query(insertCasaQuery, valuesCasa);
        const nuevaPropiedadId = resultCasa.rows[0].id;

        await client.query('COMMIT'); // Confirmar cambios
        console.log(`✅ Propiedad guardada en 'propiedades2' (ID: ${nuevaPropiedadId})`);

        res.json({
            success: true,
            message: 'Datos guardados correctamente',
            propiedadId: nuevaPropiedadId,
            propietarioId: propietarioId
        });

    } catch (e) {
        await client.query('ROLLBACK'); // Cancelar si hay error
        console.error("❌ Error SQL:", e);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

/* ======================================================= */
/* API: LISTAR PROPIEDADES (LECTURA PARA BACKOFFICE)       */
/* ======================================================= */

app.get('/api/propiedades-list', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const offset = (page - 1) * limit;

        // 1. Contar total de propiedades activas
        const countResult = await pool.query("SELECT COUNT(*) FROM propiedades2 WHERE estado_publicacion = 'PUBLICADA'");
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);

        // 2. Obtener las propiedades
        // Hacemos JOIN con la tabla de propietarios para mostrar el nombre del dueño/captador
        const query = `
            SELECT 
                p.id, 
                p.titulo_publicacion, 
                p.tipo_propiedad, 
                p.operacion_venta, 
                p.operacion_arriendo,
                p.precio_venta, p.moneda_venta,
                p.precio_arriendo, p.moneda_arriendo,
                p.direccion_calle, p.direccion_numero, p.sector,
                p.comuna, p.region,
                p.estado_publicacion,
                p.detalles_json,
                c.nombre_completo as captador_nombre
            FROM propiedades2 p
            LEFT JOIN propietarios c ON p.propietario_id = c.id
            WHERE p.estado_publicacion = 'PUBLICADA'
            ORDER BY p.id DESC 
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, [limit, offset]);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages
            }
        });

    } catch (err) {
        console.error("Error al listar propiedades:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ======================================================= */
/* API V2: DESTACADAS (HOME)                               */
/* ======================================================= */

/* ======================================================= */
/* API V2: DESTACADAS (HOME)                               */
/* ======================================================= */
app.get('/api/destacadas', async (req, res) => {
    try {
        const query = `
            SELECT id, titulo_publicacion, operacion_venta, operacion_arriendo,
                   precio_venta, moneda_venta, precio_arriendo, moneda_arriendo,
                   comuna, dormitorios, banos, superficie_util, imagen_principal
            FROM propiedades2 
            WHERE estado_publicacion = 'PUBLICADA'
            ORDER BY es_destacada DESC, id DESC -- ✅ Prioriza las marcadas, luego las más nuevas
            LIMIT 3
        `;
        const result = await pool.query(query);

        const propiedadesAdaptadas = result.rows.map(row => {
            const operation = row.operacion_venta ? 'Venta' : 'Arriendo';
            const price = row.operacion_venta
                ? `${row.moneda_venta} ${parseInt(row.precio_venta).toLocaleString('es-CL')}`
                : `${row.moneda_arriendo} ${parseInt(row.precio_arriendo).toLocaleString('es-CL')}`;

            return {
                id: row.id,
                title: row.titulo_publicacion,
                operation: operation,
                type: 'Casa',
                price: price,
                location: row.comuna,
                specs: {
                    dorms: row.dormitorios || 0,
                    baths: row.banos || 0,
                    m2Util: row.superficie_util || 0
                },
                images: {
                    // CORRECCIÓN: Usar la imagen real de la base de datos
                    main: row.imagen_principal ? `http://localhost:3000${row.imagen_principal}` : 'https://via.placeholder.com/400'
                }
            };
        });
        res.json(propiedadesAdaptadas);
    } catch (err) {
        errorResponse(res, err.message);
    }
});
// =======================================================
//                RUTAS DE AUTOCOMPLETE Y CITAS
// =======================================================

app.get('/api/places', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const query = `SELECT DISTINCT comuna FROM propiedades WHERE comuna ILIKE $1 LIMIT 5`;
        const result = await pool.query(query, [`%${q}%`]);
        res.json(result.rows.map(r => r.comuna));
    } catch (err) { errorResponse(res, err.message); }
});

app.post('/api/citas', async (req, res) => {
    const { Nombre, Teléfono, Fecha, Hora_inicio, Email, Motivo } = req.body;
    console.log("📩 Payload recibido:", req.body);

    try {
        const id_publico = Math.random().toString(36).substr(2, 6).toUpperCase();

        // 1. Guardar en Base de Datos
        const query = `
            INSERT INTO citas 
            (id_cita_publico, nombre_contacto, telefono_contacto, email_contacto, fecha, hora_inicio, hora_fin, motivo) 
            VALUES ($1, $2, $3, $4, $5, $6, $6::time + '1 hour'::interval, $7) 
            RETURNING *
        `;
        await pool.query(query, [id_publico, Nombre, Teléfono, Email, Fecha, Hora_inicio, Motivo || 'General']);

        // 2. Enviar Correo de Confirmación
        const html = `
            <div style="font-family: Arial; border: 1px solid #ddd; padding: 20px;">
                <h2 style="color: #2c3e50;">¡Hola ${Nombre}! Tu cita está confirmada ✅</h2>
                <p><strong>📅 Fecha:</strong> ${Fecha}</p>
                <p><strong>⏰ Hora:</strong> ${Hora_inicio} hrs</p>
                <p><strong>📋 Motivo:</strong> ${Motivo}</p>
                <hr><p>Gestión Inmobiliaria Marlen Guzmán</p>
            </div>
        `;
        if (Email) await enviarCorreo(Email, "Confirmación de Visita", html);

        // 3. ENVIAR A N8N (Aquí estaba el error antes, ahora usará el Webhook)
        // No usamos await para que la respuesta al chat sea instantánea
        agendarEnGoogle(Fecha, Hora_inicio, Nombre, Teléfono, Email);

        res.json({ success: true, cita: id_publico });

    } catch (err) {
        console.error("❌ Error en el servidor:", err);
        errorResponse(res, err.message);
    }
});

app.get('/api/citas', async (req, res) => {
    const { telefono } = req.query;
    try {
        let result;
        if (telefono) {
            const fonoBusqueda = telefono.replace(/\s+/g, '');
            const query = `SELECT *, updated_at FROM citas WHERE REPLACE(telefono_contacto, ' ', '') = $1 ORDER BY updated_at DESC, fecha DESC`;
            result = await pool.query(query, [fonoBusqueda]);
        } else {
            result = await pool.query('SELECT * FROM citas ORDER BY updated_at DESC, fecha DESC');
        }
        res.json(result.rows);
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/citas/:id', async (req, res) => {
    try {
        const consulta = await pool.query('SELECT * FROM citas WHERE id = $1', [req.params.id]);
        if (consulta.rows.length > 0) {
            const cita = consulta.rows[0];
            await pool.query('DELETE FROM citas WHERE id = $1', [req.params.id]);
            if (cita.email_contacto) await enviarCorreo(cita.email_contacto, "Aviso de Cancelación de Cita", "<p>Tu cita ha sido cancelada.</p>");
        }
        res.json({ success: true, message: 'Eliminado' });
    } catch (err) { errorResponse(res, err.message); }
});

app.put('/api/citas/:id', async (req, res) => {
    const { id } = req.params;
    const { Fecha, Hora_inicio, Email } = req.body;
    try {
        const query = `UPDATE citas SET fecha = $1, hora_inicio = $2, hora_fin = $2::time + '1 hour'::interval WHERE id = $3 RETURNING *`;
        const result = await pool.query(query, [Fecha, Hora_inicio, id]);
        if (result.rows.length > 0) {
            const cita = result.rows[0];
            if (Email || cita.email_contacto) await enviarCorreo(Email || cita.email_contacto, "Actualización de Cita", `<p>Tu cita se movió al ${Fecha} a las ${Hora_inicio}.</p>`);
            res.json({ success: true, cita: result.rows[0] });
        } else {
            res.status(404).json({ success: false, message: 'Cita no encontrada' });
        }
    } catch (err) { errorResponse(res, err.message); }
});

// =======================================================
//                RUTA DE CONTACTO
// =======================================================

app.post('/api/contact', async (req, res) => {
    const { nombre, email, telefono, mensaje } = req.body;
    if (!nombre || !email || !mensaje) return res.status(400).json({ success: false, message: 'Faltan datos.' });

    try {
        const htmlAdmin = `<h2>Nuevo Mensaje</h2><p><strong>De:</strong> ${nombre} (${email})</p><p><strong>Tel:</strong> ${telefono}</p><p>${mensaje}</p>`;

        await transporter.sendMail({
            from: `"Web Marlen Guzmán" <ignacio.ojeda2002@gmail.com>`, // <--- CORREGIDO (Hardcode para evitar errores de .env)
            to: 'ignacio.ojeda2002@gmail.com',
            replyTo: email,
            subject: `📩 Nuevo contacto: ${nombre}`,
            html: htmlAdmin
        });

        const htmlCliente = `<h2>Hola ${nombre}</h2><p>Recibimos tu mensaje. Te contactaremos pronto.</p>`;
        await enviarCorreo(email, "Hemos recibido tu mensaje", htmlCliente);
        res.json({ success: true, message: 'Mensaje enviado.' });
    } catch (err) {
        console.error("Error enviando contacto:", err);
        res.status(500).json({ success: false, message: 'Error al enviar.' });
    }
});


/* ======================================================= */
/* NUEVA RUTA: CONSULTAR DISPONIBILIDAD (DEPURADA)         */
/* ======================================================= */
app.get('/api/disponibilidad', async (req, res) => {
    const { fecha } = req.query; // Recibimos la fecha (ej: 2026-01-20)

    console.log(`📡 1. Recibida petición en Node para fecha: ${fecha}`);

    // URL DE N8N (Asegúrate de que n8n esté en "Listening..." si usas -test)
    const N8N_URL = "http://localhost:5678/webhook/consultar-disponibilidad";

    try {
        console.log(`📤 2. Enviando a n8n: ${N8N_URL}?fecha=${fecha}`);

        // 1. Preguntar a n8n
        const response = await fetch(`${N8N_URL}?fecha=${fecha}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`📥 3. Respuesta de n8n status: ${response.status}`);

        if (!response.ok) {
            throw new Error(`n8n respondió con error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("📦 4. Datos recibidos de n8n:", JSON.stringify(data).substring(0, 100) + "...");

        // 2. Procesar los bloques ocupados
        // n8n con Google Calendar suele devolver: { "tu_email": { "busy": [...] } }
        let busySlots = [];
        const calendarKey = Object.keys(data).find(k => data[k].busy);
        if (calendarKey) {
            busySlots = data[calendarKey].busy;
        }

        console.log(`🧩 5. Bloques ocupados encontrados: ${busySlots.length}`);

        // 3. Calcular horas libres (Lógica corregida)
        // Horas posibles: 9 a 19
        const horasPosibles = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

        const horasLibres = horasPosibles.filter(hora => {
            // Construimos fechas comparables
            // IMPORTANTE: Forzamos la zona horaria para que coincida con la de Google (-03:00)
            const inicioCita = new Date(`${fecha}T${hora.toString().padStart(2, '0')}:00:00-03:00`);
            const finCita = new Date(inicioCita);
            finCita.setHours(inicioCita.getHours() + 1);

            // Verificamos colisión
            const choca = busySlots.some(slot => {
                const inicioOcupado = new Date(slot.start);
                const finOcupado = new Date(slot.end);
                return (inicioCita < finOcupado && finCita > inicioOcupado);
            });

            return !choca;
        });

        const resultadoFinal = horasLibres.map(h => `${h.toString().padStart(2, '0')}:00`);
        console.log(`✅ 6. Horas libres calculadas: ${resultadoFinal}`);

        res.json({ success: true, disponibles: resultadoFinal });

    } catch (err) {
        console.error("❌ ERROR CRÍTICO EN DISPONIBILIDAD:", err.message);
        res.status(500).json({ success: false, message: "Error al consultar agenda." });
    }
});

/* ======================================================= */
/* API V2: EDICIÓN DE PROPIEDADES (TABLAS NUEVAS)         */
/* ======================================================= */

// 1. OBTENER UNA SOLA PROPIEDAD POR ID (Para llenar el formulario de edición)
app.get('/api/propiedades2/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Obtener datos de la propiedad y el propietario
        const propQuery = `
            SELECT p.*, pr.nombre_completo, pr.rut 
            FROM propiedades2 p
            LEFT JOIN propietarios pr ON p.propietario_id = pr.id
            WHERE p.id = $1
        `;
        const propRes = await pool.query(propQuery, [id]);

        if (propRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "No encontrada" });
        }

        // 2. Obtener TODAS las imágenes de la galería (LO NUEVO)
        const imgQuery = `SELECT url_imagen FROM propiedad_imagenes WHERE propiedad_id = $1 ORDER BY es_portada DESC`;
        const imgRes = await pool.query(imgQuery, [id]);

        res.json({
            success: true,
            data: propRes.rows[0],
            imagenes: imgRes.rows // Enviamos el array de fotos
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. ACTUALIZAR PROPIEDAD (PUT) - CORREGIDO PARA INCLUIR JSON DE DETALLES
app.put('/api/propiedades2/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;

    try {
        // 1. Reconstruir el JSON de detalles (Amenities del Paso 3)
        // Si no hacemos esto, se pierden los datos como pisos, calefacción, etc.
        const detallesExtras = {
            piscina: body.detalles_extras?.piscina || 'No',
            quincho: body.detalles_extras?.quincho || 'No',
            loggia: body.detalles_extras?.loggia || 'No',
            riego_automatico: body.detalles_extras?.riego_automatico || 'No',
            porton_automatico: body.detalles_extras?.porton_automatico || 'No',
            calefaccion: body.detalles_extras?.calefaccion,
            ventanas: body.detalles_extras?.ventanas,
            pisos: body.detalles_extras?.pisos || {}
            // Agrega aquí más campos si los necesitas
        };

        const query = `
            UPDATE propiedades2 SET
                tipo_propiedad = $1,
                rol_sii = $2,
                exclusividad = $3,
                operacion_venta = $4,
                precio_venta = $5,
                moneda_venta = $6,
                operacion_arriendo = $7,
                precio_arriendo = $8,
                moneda_arriendo = $9,
                gastos_comunes = $10,
                contribuciones = $11,
                canje = $12, 
                
                region = $13,
                comuna = $14,
                sector = $15,
                direccion_calle = $16,
                direccion_numero = $17,
                direccion_unidad = $18,

                dormitorios = $19,
                banos = $20,
                superficie_util = $21,
                superficie_total = $22,
                estacionamientos = $23,
                bodegas = $24,
                
                titulo_publicacion = $25,
                descripcion_publica = $26,
                observaciones_internas = $27,
                estado_publicacion = $28,
                forma_visita = $29,
                
                detalles_json = $30  -- ¡IMPORTANTE! Actualizamos el JSON
            WHERE id = $31
            RETURNING id
        `;

        const values = [
            body.tipo_propiedad,
            body.rol_sii,
            body.exclusividad === 'Si',
            body.operacion_venta,
            parseInt(body.precio_venta) || 0,
            body.moneda_venta,
            body.operacion_arriendo,
            parseInt(body.precio_arriendo) || 0,
            body.moneda_arriendo,
            parseInt(body.gastos_comunes) || 0,
            parseInt(body.contribuciones) || 0,
            body.canje === 'Si', // Agregado Canje

            body.region,
            body.comuna,
            body.sector,
            body.direccion_calle,
            body.direccion_numero,
            body.direccion_unidad,

            parseInt(body.dormitorios) || 0,
            parseInt(body.banos) || 0,
            parseFloat(body.superficie_util) || 0,
            parseFloat(body.superficie_total) || 0,
            parseInt(body.estacionamientos) || 0,
            parseInt(body.bodegas) || 0,

            body.titulo_publicacion,
            body.descripcion_publica,
            body.observaciones_internas,
            body.estado_publicacion,
            body.forma_visita,

            JSON.stringify(detallesExtras), // Guardamos el JSON actualizado
            id
        ];

        await pool.query(query, values);
        res.json({ success: true, message: "Propiedad actualizada correctamente" });

    } catch (err) {
        console.error("Error al actualizar:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- 1. GUARDAR NUEVO LEAD2 (Desde el Modal) ---
app.post('/api/leads', async (req, res) => {
    const { nombre, telefono, email, comuna, consumo } = req.body;

    try {
        const result = await pool.query(
            "INSERT INTO leads2 (nombre_completo, telefono, email, comuna, consumo_mensual, estado) VALUES ($1, $2, $3, $4, $5, 'NUEVO') RETURNING *",
            [nombre, telefono, email, comuna, consumo]
        );
        res.json({ success: true, lead: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Error al guardar lead" });
    }
});

// --- 2. OBTENER TODOS LOS LEADS (Para el Kanban) ---
app.get('/api/leads', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM leads2 ORDER BY fecha_creacion DESC");
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Error al cargar leads" });
    }
});

// --- 3. ACTUALIZAR ESTADO (Mover de columna) ---
// Esta ruta servirá para cuando arrastres o muevas un lead
app.put('/api/leads/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { nuevoEstado } = req.body; // Ej: 'VISITA'

    try {
        await pool.query("UPDATE leads2 SET estado = $1 WHERE id = $2", [nuevoEstado, id]);
        res.json({ success: true, message: "Estado actualizado" });
    } catch (err) {
        res.status(500).json({ success: false, error: "Error actualizando estado" });
    }
});
/* ======================================================= */
/* NUEVAS RUTAS: GESTIÓN DE IMÁGENES (GALERÍA)             */
/* ======================================================= */
const fs = require('fs');

// 1. SUBIR FOTOS 
app.post('/api/propiedades/:id/imagenes', upload.array('fotos', 30), async (req, res) => {
    const propId = req.params.id;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: "No se subieron archivos" });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const file of files) {
                const url = '/uploads/' + file.filename;

                // 1. Guardamos en la tabla de galería (propiedad_imagenes)
                // Aquí la columna SÍ se llama 'url_imagen' según tu CREATE TABLE
                await client.query(
                    "INSERT INTO propiedad_imagenes (propiedad_id, url_imagen) VALUES ($1, $2)",
                    [propId, url]
                );
            }

            // --- LÓGICA DE PORTADA AUTOMÁTICA ---
            // Verificamos si la propiedad ya tiene una foto principal asignada en PROPIEDADES2
            // OJO: Aquí usamos 'imagen_principal'
            const checkMain = await client.query("SELECT imagen_principal FROM propiedades2 WHERE id = $1", [propId]);

            if (checkMain.rows.length > 0) {
                const currentImg = checkMain.rows[0].imagen_principal;

                // Si está vacía o es placeholder, ponemos la primera foto nueva como portada
                if (!currentImg || currentImg === '' || currentImg.includes('placeholder')) {
                    const primeraFoto = '/uploads/' + files[0].filename;

                    // Actualizamos propiedades2 con el nombre correcto de columna
                    await client.query("UPDATE propiedades2 SET imagen_principal = $1 WHERE id = $2", [primeraFoto, propId]);

                    // Marcamos en la galería
                    await client.query("UPDATE propiedad_imagenes SET es_portada = TRUE WHERE url_imagen = $1", [primeraFoto]);
                }
            }

            await client.query('COMMIT');
            res.json({ success: true, message: "Imágenes subidas correctamente" });

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Error subiendo imagen:", err);
        res.status(500).json({ success: false, message: err.message, error: err.message });
    }
});

// 2. OBTENER FOTOS
app.get('/api/propiedades/:id/imagenes', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM propiedad_imagenes WHERE propiedad_id = $1 ORDER BY es_portada DESC, id ASC",
            [req.params.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. ESTABLECER PORTADA
app.put('/api/imagenes/:id/portada', async (req, res) => {
    const imgId = req.params.id;
    const { propId } = req.body;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Desmarcar todas en la galería
            await client.query("UPDATE propiedad_imagenes SET es_portada = false WHERE propiedad_id = $1", [propId]);

            // 2. Marcar la seleccionada
            const result = await client.query("UPDATE propiedad_imagenes SET es_portada = true WHERE id = $1 RETURNING url_imagen", [imgId]);

            if (result.rows.length > 0) {
                const urlNueva = result.rows[0].url_imagen;
                // 3. Actualizar la tabla propiedades2 con el nombre correcto de columna
                await client.query("UPDATE propiedades2 SET imagen_principal = $1 WHERE id = $2", [urlNueva, propId]);
            }

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. ELIMINAR FOTO
app.delete('/api/imagenes/:id', async (req, res) => {
    try {
        const result = await pool.query("SELECT url_imagen FROM propiedad_imagenes WHERE id = $1", [req.params.id]);

        if (result.rows.length > 0) {
            const urlWeb = result.rows[0].url_imagen;
            const filePath = path.join(__dirname, urlWeb);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        await pool.query("DELETE FROM propiedad_imagenes WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ======================================================= */
/* NUEVAS RUTAS: GESTIÓN DE DOCUMENTOS (ARCHIVOS)          */
/* ======================================================= */

// 1. SUBIR DOCUMENTOS
app.post('/api/propiedades/:id/documentos', upload.array('documentos', 10), async (req, res) => {
    const propId = req.params.id;
    const { tipo } = req.body; // Recibimos el tipo de documento (ej: Contrato)
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: "No se subieron archivos" });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const file of files) {
                const url = '/uploads/' + file.filename;

                await client.query(
                    `INSERT INTO propiedad_documentos 
                    (propiedad_id, tipo_documento, nombre_archivo, url_archivo) 
                    VALUES ($1, $2, $3, $4)`,
                    [propId, tipo || 'Documento', file.originalname, url]
                );
            }

            await client.query('COMMIT');
            res.json({ success: true, message: "Documentos subidos correctamente" });

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Error subiendo documento:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. OBTENER DOCUMENTOS DE UNA PROPIEDAD
app.get('/api/propiedades/:id/documentos', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM propiedad_documentos WHERE propiedad_id = $1 ORDER BY fecha_subida DESC",
            [req.params.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. ELIMINAR DOCUMENTO
app.delete('/api/documentos/:id', async (req, res) => {
    try {
        // Obtener ruta para borrar archivo físico
        const result = await pool.query("SELECT url_archivo FROM propiedad_documentos WHERE id = $1", [req.params.id]);

        if (result.rows.length > 0) {
            const urlWeb = result.rows[0].url_archivo;
            const filePath = path.join(__dirname, urlWeb);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        await pool.query("DELETE FROM propiedad_documentos WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ======================================================= */
/* NUEVA RUTA: ACTUALIZAR ESTADO Y CONFIGURACIÓN           */
/* ======================================================= */

app.put('/api/propiedades/:id/configuracion', async (req, res) => {
    const { id } = req.params;
    const body = req.body;

    try {
        const query = `
            UPDATE propiedades2 SET 
                estado_publicacion = $1,
                ejecutivo_asignado = $2,
                publicar_internet = $3,
                es_destacada = $4,
                es_vendida = $5,
                es_arrendada = $6,
                portales_json = $7
            WHERE id = $8
            RETURNING id
        `;

        const values = [
            body.estado_publicacion,
            body.ejecutivo_asignado,
            body.publicar_internet === 'Si', // Convertir "Si" a true
            body.es_destacada === 'Si',
            body.es_vendida === 'Si',
            body.es_arrendada === 'Si',
            JSON.stringify(body.portales), // Guardar objeto de portales
            id
        ];

        await pool.query(query, values);
        res.json({ success: true, message: "Configuración actualizada correctamente" });

    } catch (err) {
        console.error("Error actualizando configuración:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ======================================================= */
/* NUEVAS RUTAS: BITÁCORA DE PROPIEDAD                     */
/* ======================================================= */

// 1. OBTENER BITÁCORA (Historial)
app.get('/api/propiedades/:id/bitacora', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM propiedad_bitacora WHERE propiedad_id = $1 ORDER BY fecha DESC",
            [req.params.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. AGREGAR COMENTARIO MANUAL
app.post('/api/propiedades/:id/bitacora', async (req, res) => {
    const { usuario, detalle, accion } = req.body;

    try {
        await pool.query(
            "INSERT INTO propiedad_bitacora (propiedad_id, usuario, accion, detalle) VALUES ($1, $2, $3, $4)",
            [req.params.id, usuario || 'Usuario Admin', accion || 'Comentario', detalle]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ======================================================= */
/* NUEVA RUTA: DATOS DEL PROPIETARIO DE UNA PROPIEDAD      */
/* ======================================================= */

/* ======================================================= */
/* NUEVA RUTA: DATOS DEL PROPIETARIO DE UNA PROPIEDAD      */
/* ======================================================= */

app.get('/api/propiedades/:id/propietario', async (req, res) => {
    const { id } = req.params;

    try {
        // CORRECCIÓN: Cambiamos 'pr.fecha_creacion' por 'pr.fecha_registro'
        const query = `
            SELECT 
                pr.id, pr.nombre_completo, pr.rut, pr.email, pr.telefono, 
                pr.es_activo, pr.tipo_documento, pr.fecha_registro as fecha_creacion, 
                p.ejecutivo_asignado
            FROM propiedades2 p
            JOIN propietarios pr ON p.propietario_id = pr.id
            WHERE p.id = $1
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length > 0) {
            const propietario = result.rows[0];

            // Simular estadísticas
            const stats = {
                listados_enviados: Math.floor(Math.random() * 10),
                ordenes_visita: Math.floor(Math.random() * 5),
                contactos: Math.floor(Math.random() * 20)
            };

            res.json({ success: true, data: propietario, stats: stats });
        } else {
            res.status(404).json({ success: false, message: "Propietario no asignado o no encontrado" });
        }

    } catch (err) {
        console.error("Error cargando propietario:", err); // Esto imprimirá el error real en tu terminal
        res.status(500).json({ success: false, message: "Error interno del servidor", error: err.message });
    }
});

/* ======================================================= */
/* RUTAS DE CLIENTES (FICHA INDIVIDUAL)                    */
/* ======================================================= */

app.get('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("SELECT * FROM propietarios WHERE id = $1", [id]);

        if (result.rows.length > 0) {
            // Simulamos datos extras que aparecen en la ficha de Nexxos
            const cliente = result.rows[0];
            const extras = {
                listados: Math.floor(Math.random() * 5),
                visitas: Math.floor(Math.random() * 10),
                contactos: Math.floor(Math.random() * 15),
                fecha_ingreso: cliente.fecha_registro || new Date()
            };
            res.json({ success: true, data: cliente, stats: extras });
        } else {
            res.status(404).json({ success: false, message: "Cliente no encontrado" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ======================================================= */
/* RUTA: CAMBIAR/REASIGNAR DUEÑO DE UNA PROPIEDAD          */
/* ======================================================= */

app.post('/api/propiedades/:id/cambiar-propietario', async (req, res) => {
    const propId = req.params.id;
    const {
        rut, nombre, apellidoP, apellidoM, email,
        celular, fono_fijo, fono_comercial,
        es_activo, es_vendedor, es_arrendador,
        comentarios
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Construir nombre completo
        const nombreCompleto = `${nombre} ${apellidoP} ${apellidoM || ''}`.trim();
        let nuevoPropietarioId;

        // 2. Buscar si el cliente ya existe por RUT
        const checkCliente = await client.query("SELECT id FROM propietarios WHERE rut = $1", [rut]);

        if (checkCliente.rows.length > 0) {
            // A) Cliente existe: Usamos su ID y actualizamos sus datos de contacto por si acaso
            nuevoPropietarioId = checkCliente.rows[0].id;
            await client.query(
                `UPDATE propietarios SET 
                nombre_completo=$1, email=$2, telefono=$3, es_activo=$4, comentarios=$5 
                WHERE id=$6`,
                [nombreCompleto, email, celular, (es_activo === 'Si'), comentarios, nuevoPropietarioId]
            );
        } else {
            // B) Cliente nuevo: Lo creamos
            const insertRes = await client.query(
                `INSERT INTO propietarios 
                (rut, nombre_completo, email, telefono, tipo_documento, es_activo, rating, comentarios)
                VALUES ($1, $2, $3, $4, 'rut', $5, 3, $6)
                RETURNING id`,
                [rut, nombreCompleto, email, celular, (es_activo === 'Si'), comentarios]
            );
            nuevoPropietarioId = insertRes.rows[0].id;
        }

        // 3. EL CAMBIO MÁGICO: Actualizar la propiedad para que apunte al nuevo dueño
        await client.query(
            "UPDATE propiedades2 SET propietario_id = $1 WHERE id = $2",
            [nuevoPropietarioId, propId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Propiedad reasignada correctamente al nuevo dueño." });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

/* ======================================================= */
/* RUTAS DE INFORMES DE PROPIEDAD                          */
/* ======================================================= */

// 1. OBTENER INFORMES
app.get('/api/propiedades/:id/informes', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM propiedad_informes WHERE propiedad_id = $1 ORDER BY fecha_generacion DESC",
            [req.params.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// 2. CREAR NUEVO INFORME
app.post('/api/propiedades/:id/informes', async (req, res) => {
    const { titulo, config } = req.body;
    try {
        await pool.query(
            "INSERT INTO propiedad_informes (propiedad_id, titulo, configuracion) VALUES ($1, $2, $3)",
            [req.params.id, titulo, JSON.stringify(config)]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// RUTA PARA PROBAR EL ENVÍO A PORTALES (SIMULACRO)
app.get('/api/test-publicacion/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Buscamos la propiedad en tu tabla propiedades2
        const result = await pool.query("SELECT * FROM propiedades2 WHERE id = $1", [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Propiedad no encontrada en la base de datos" });
        }

        const p = result.rows[0];

        // 2. Formateamos los datos como los pide un portal profesional (TOC TOC / Portal Inmobiliario)
        const datosParaPortal = {
            id_externo: p.id,
            titulo: p.titulo_publicacion,
            descripcion: p.descripcion_publica,
            operacion: p.operacion_venta ? 'Venta' : 'Arriendo',
            tipo: p.tipo_propiedad,
            precio: p.precio_venta || p.precio_arriendo,
            moneda: p.moneda_venta || p.moneda_arriendo,
            comuna: p.comuna,
            direccion: `${p.direccion_calle} ${p.direccion_numero}`,
            dormitorios: p.dormitorios,
            banos: p.banos,
            superficie: p.superficie_util,
            imagen_url: `http://localhost:3000${p.imagen_principal}`
        };

        // 3. Devolvemos el JSON para que tú lo veas en Postman
        res.json({
            status: "Listo para enviar a TOC TOC",
            payload: datosParaPortal
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* === NUEVA RUTA: ESTADÍSTICAS REALES PARA DASHBOARD === */
/* === NUEVA RUTA: ESTADÍSTICAS REALES PARA DASHBOARD === */
app.get('/api/admin/stats', async (req, res) => {
    try {
        // 1. Contar propiedades reales
        const props = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE estado_publicacion = 'PUBLICADA') as activas,
                COUNT(*) FILTER (WHERE es_vendida = true) as vendidas,
                COUNT(*) FILTER (WHERE es_arrendada = true) as arrendadas
            FROM propiedades2
        `);

        // 2. Traer las últimas 5 citas reales para la tabla
        const citas = await pool.query(`
            SELECT nombre_contacto, fecha, hora_inicio, motivo 
            FROM citas 
            ORDER BY fecha DESC LIMIT 5
        `);

        res.json({
            success: true,
            summary: props.rows[0],
            citas: citas.rows
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// A. RUTA PARA SUMAR VISITAS
app.post('/api/visitas/registrar', async (req, res) => {
    try {
        await pool.query(`
            INSERT INTO visitas_web (fecha, contador) VALUES (CURRENT_DATE, 1) 
            ON CONFLICT (fecha) DO UPDATE SET contador = visitas_web.contador + 1
        `);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// B. RUTA PARA EL GRÁFICO DE 7 DÍAS
app.get('/api/admin/visitas-semana', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT TO_CHAR(fecha, 'DD/MM') as dia, contador 
            FROM visitas_web WHERE fecha >= CURRENT_DATE - INTERVAL '6 days'
            ORDER BY fecha ASC
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

/* === RUTA PARA ELIMINAR UN INTERESADO === */
app.delete('/api/leads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM leads2 WHERE id = $1", [id]);
        res.json({ success: true, message: "Lead eliminado correctamente" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* === GESTIÓN DE DOCUMENTOS PARA INTERESADOS (LEADS) === */

// 1. Subir Documentos a un Lead
app.post('/api/leads/:id/documentos', upload.array('archivos', 5), async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;
    const files = req.files;

    if (!files || files.length === 0) return res.status(400).json({ success: false, message: "No hay archivos" });

    try {
        for (const file of files) {
            const url = '/uploads/' + file.filename;
            await pool.query(
                "INSERT INTO lead_documentos (lead_id, tipo_documento, nombre_archivo, url_archivo) VALUES ($1, $2, $3, $4)",
                [id, tipo || 'Otro', file.originalname, url]
            );
        }
        res.json({ success: true, message: "Documentos cargados" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Obtener Documentos de un Lead
app.get('/api/leads/:id/documentos', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM lead_documentos WHERE lead_id = $1 ORDER BY fecha_subida DESC", [req.params.id]);
        res.json({ success: true, data: result.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Eliminar Documento de un Lead
app.delete('/api/documentos-lead/:id', async (req, res) => {
    try {
        const result = await pool.query("SELECT url_archivo FROM lead_documentos WHERE id = $1", [req.params.id]);
        if (result.rows.length > 0) {
            const filePath = path.join(__dirname, result.rows[0].url_archivo);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await pool.query("DELETE FROM lead_documentos WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ======================================================= */
/* RUTA DE REPORTE MENSUAL (DATOS REALES) 📊               */
/* ======================================================= */
app.get('/api/admin/reporte-mensual', async (req, res) => {
    try {
        // 1. Resumen de Propiedades (Inventario Real)
        const props = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE estado_publicacion = 'PUBLICADA') as activas,
                COUNT(*) FILTER (WHERE es_vendida = true) as vendidas,
                COUNT(*) FILTER (WHERE es_arrendada = true) as arrendadas,
                COALESCE(SUM(precio_venta) FILTER (WHERE es_vendida = true), 0) as monto_ventas_uf
            FROM propiedades2
        `);

        // 2. Resumen de Interesados/Leads (Clientes Reales)
        const leads = await pool.query(`
            SELECT estado, COUNT(*) as cantidad 
            FROM leads2 
            GROUP BY estado
        `);

        // 3. Resumen de Visitas Web (Tráfico Real)
        // Sumamos las visitas de los últimos 30 días
        const visitas = await pool.query(`
            SELECT COALESCE(SUM(contador), 0) as total 
            FROM visitas_web 
            WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'
        `);

        // 4. Últimos movimientos (Bitácora de ventas)
        const cierres = await pool.query(`
            SELECT titulo_publicacion, precio_venta, moneda_venta, fecha_publicacion 
            FROM propiedades2 
            WHERE es_vendida = true 
            ORDER BY id DESC LIMIT 5
        `);

        res.json({
            success: true,
            inventario: props.rows[0],
            leads_por_estado: leads.rows,
            visitas_mensuales: visitas.rows[0].total,
            ultimos_cierres: cierres.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});