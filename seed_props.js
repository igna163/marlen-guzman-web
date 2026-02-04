const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const properties = [
    {
        titulo: "Casa Mediterránea en Condominio Exclusivo",
        descripcion: "Hermosa casa estilo mediterráneo, no perimetral. Amplios espacios, quincho formado y jardín consolidado. Seguridad 24/7.",
        tipo_operacion: "Arriendo",
        tipo_propiedad: "Casa",
        precio: 1500000,
        moneda: "CLP",
        gastos_comunes: 180000,
        dormitorios: 4,
        banos: 3,
        comuna: "Chicureo",
        imagen_url: "https://images.unsplash.com/photo-1600596542815-e328d4de4bf7",
        m2_utiles: 140,
        m2_totales: 350,
        estacionamientos: 1,
        piscina: true,
        ascensor: false,
        quincho: true
    },
    {
        titulo: "Departamento Moderno en Las Condes",
        descripcion: "Espectacular departamento con vista despejada, finas terminaciones, cercano a metro y parques.",
        tipo_operacion: "Venta",
        tipo_propiedad: "Departamento",
        precio: 12500,
        moneda: "UF",
        gastos_comunes: 250000,
        dormitorios: 3,
        banos: 2,
        comuna: "Las Condes",
        imagen_url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00",
        m2_utiles: 95,
        m2_totales: 110,
        estacionamientos: 1,
        piscina: true,
        ascensor: true,
        quincho: true
    },
    {
        titulo: "Oficina Habilitada en Providencia",
        descripcion: "Oficina lista para ocupar, planta libre con 2 privados, climatizada, excelente conectividad.",
        tipo_operacion: "Arriendo",
        tipo_propiedad: "Oficina",
        precio: 45,
        moneda: "UF",
        gastos_comunes: 120000,
        dormitorios: 0,
        banos: 2,
        comuna: "Providencia",
        imagen_url: "https://images.unsplash.com/photo-1497366216548-37526070297c",
        m2_utiles: 60,
        m2_totales: 60,
        estacionamientos: 1,
        piscina: false,
        ascensor: true,
        quincho: false
    },
    {
        titulo: "Casa Familiar en La Reina",
        descripcion: "Acogedora casa en barrio tranquilo, gran patio, cerca de colegios y comercio.",
        tipo_operacion: "Venta",
        tipo_propiedad: "Casa",
        precio: 18000,
        moneda: "UF",
        gastos_comunes: 0,
        dormitorios: 5,
        banos: 4,
        comuna: "La Reina",
        imagen_url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994",
        m2_utiles: 220,
        m2_totales: 600,
        estacionamientos: 1,
        piscina: true,
        ascensor: false,
        quincho: true
    },
    {
        titulo: "Loft Industrial en Santiago Centro",
        descripcion: "Estiloso loft de doble altura, ideal para profesionales jóvenes, edificio patrimonial remodelado.",
        tipo_operacion: "Arriendo Temporal",
        tipo_propiedad: "Departamento",
        precio: 650000,
        moneda: "CLP",
        gastos_comunes: 80000,
        dormitorios: 1,
        banos: 1,
        comuna: "Santiago",
        imagen_url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688",
        m2_utiles: 50,
        m2_totales: 50,
        estacionamientos: 0,
        piscina: false,
        ascensor: true,
        quincho: true
    }
];

async function run() {
    try {
        console.log('Seeding properties...');
        for (const p of properties) {
            const query = `
                INSERT INTO propiedades 
                (titulo, descripcion, tipo_operacion, tipo_propiedad, precio, moneda, gastos_comunes, dormitorios, banos, comuna, imagen_url, m2_utiles, m2_totales, estacionamientos, piscina, ascensor, quincho, active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, TRUE)
            `;
            const values = [
                p.titulo, p.descripcion, p.tipo_operacion, p.tipo_propiedad,
                p.precio, p.moneda, p.gastos_comunes, p.dormitorios, p.banos,
                p.comuna, p.imagen_url, p.m2_utiles, p.m2_totales,
                p.estacionamientos, p.piscina, p.ascensor, p.quincho
            ];
            await pool.query(query, values);
        }
        console.log('✅ 5 properties seeded successfully.');
    } catch (err) {
        console.error('❌ Error seeding:', err);
    } finally {
        pool.end();
    }
}

run();
