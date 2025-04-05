import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import PDFDocument from "pdfkit";
import bodyParser from 'body-parser';
import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs'

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.get("/", (req, res) => {
    res.send("¡El servidor está funcionando correctamente! 🚀 Prueba la ruta /producto/{id}");
});

async function descargarImagen(url) {
    try {
        // 1. Descargar la imagen
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'arraybuffer',
            headers: {
                'Referer': 'https://www.chedraui.com.mx/',
                'User-Agent': 'Mozilla/5.0'
            }
        });

        // 2. Procesar la imagen con sharp (redimensionar y convertir a buffer)
        const imagenBuffer = await sharp(response.data)
            .resize(230, 230, { // Tamaño fijo para el PDF
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 }) // Convertir a JPEG para reducir tamaño
            .toBuffer();

        return imagenBuffer;
    } catch (error) {
        console.error(`Error al descargar imagen ${url}:`, error.message);
        return null;
    }
}

app.post('/generar-pdf', async (req, res) => {
    try {
        const { productos } = req.body;
    
        // Validar datos de entrada
        if (!productos || !Array.isArray(productos)) {
            return res.status(400).json({ error: "Datos de productos no válidos" });
        }
    
        // Crear PDF
        const doc = new PDFDocument({
            margin: 12,
            size: 'A4',
            bufferPages: true
        });

        /* const watermarkConfig = {
            text: 'Che 134 Lakin Raul Alberto M.Z 100509309',
            opacity: 0.05,
            color: '#999999',
            size: 40,
            rotation: -45,
            x: 300,  // Posición X central (A4)
            y: 400   // Posición Y central (A4)
          }; */
        
        /* ------------------------------------------------------------------------- */

        doc.save();
  
        /* ------------------------------------------------------------------------- */
    
        // Configurar respuesta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=productos-chedraui-con-imagenes.pdf');
        doc.pipe(res);
    
        // Variables para la grilla - MODIFICADO PARA CENTRAR
        const margin = 10; // Aumenté el margen entre tarjetas
        const cardWidth = 170; // Reduje ligeramente el ancho para dar más espacio
        const cardHeight = 267;
        let x, y = 2;
    
        // Calcular el ancho total del contenido (3 tarjetas + 2 márgenes)
        const contenidoAncho = (3 * cardWidth) + (2 * margin);
        
        // Calcular el margen izquierdo para centrar
        const margenIzquierdo = (doc.page.width - contenidoAncho) / 2;
    
        // Procesar cada producto
        for (let i = 0; i < productos.length; i++) {
            const producto = productos[i];
            
            // Nueva página cada 9 productos
            if (i > 0 && i % 9 === 0) {
                doc.addPage();
                y = 50;
            }
    
            // Calcular posición - MODIFICADO PARA CENTRAR
            const col = i % 3;
            const row = Math.floor((i % 9) / 3);
            
            // Nueva fórmula para X que incluye el margen izquierdo calculado
            x = margenIzquierdo + col * (cardWidth + margin);
            y = 10 + row * (cardHeight + margin);
    
            // Dibujar tarjeta (el resto del código permanece igual)
            doc.rect(x, y, cardWidth, cardHeight)
               .fillOpacity(0.1)
               /* .fillAndStroke('#3498db', '#DDD') */
               .fillAndStroke('#3498db', '#000000')
               .fillOpacity(1);
    
            // Descargar y colocar imagen (ajusté posición Y para mejor espaciado)
            if (producto.imageUrl) {
                try {
                    const imagenBuffer = await descargarImagen(producto.imageUrl);
                    if (imagenBuffer) {
                        // Centrar imagen horizontalmente dentro de la tarjeta
                        const imageX = x + (cardWidth - 100) / 2;
                        doc.image(imagenBuffer, imageX, y + 10, {
                            width: 100,
                            height: 100,
                            fit: [100, 100]
                        });
                    } else {
                        dibujarPlaceholder(doc, x + (cardWidth - 100) / 2, y + 10);
                    }
                } catch (error) {
                    console.error(`Error con imagen de ${producto.productName}:`, error);
                    dibujarPlaceholder(doc, x + (cardWidth - 100) / 2, y + 10);
                }
            } else {
                dibujarPlaceholder(doc, x + (cardWidth - 100) / 2, y + 10);
            }
    
            // Nombre del producto (ajusté posición Y)

            doc.fontSize(8).font('Helvetica-Bold')
            .fillColor('#000000') // Rojo (cambia este valor por el color que necesites)
            .text(producto.productName, x + 10, y + 120, {
                width: cardWidth - 20,
                align: 'center',
                ellipsis: true
            });
            if (producto.productName.length <= 36) {
                doc.fontSize(8).font('Helvetica')
               .text('Códigos EAN:', x + 10, y + 138);
            
                producto.ProductMultiEan.slice(0, 12).forEach((ean, idx) => {
                    doc.fontSize(8).font('Helvetica').text(`• ${ean}`, x + 15, y + 150 + (idx * 9));
                });
        
                if (producto.ProductMultiEan.length > 12) {
                    doc.fontSize(6).font('Helvetica').text(`******** +${producto.ProductMultiEan.length - 12} más...`, x + 15, y + 250);
                }
            } else {
                doc.fontSize(8).font('Helvetica')
               .text('Códigos EAN:', x + 10, y + 150);
            
                producto.ProductMultiEan.slice(0, 11).forEach((ean, idx) => {
                    doc.fontSize(8).font('Helvetica').text(`• ${ean}`, x + 15, y + 162 + (idx * 8));
                });
        
                if (producto.ProductMultiEan.length > 11) {
                    doc.fontSize(6).font('Helvetica').text(`******** +${producto.ProductMultiEan.length - 11} más...`, x + 15, y + 250);
                }
            }
    
            // Códigos EAN (ajusté posiciones Y)
        }
        
        doc.end();
    } catch (error) {
        console.error("Error al generar PDF:", error);
        res.status(500).json({ error: "Error al generar el PDF" });
    }
});

function dibujarPlaceholder(doc, x, y) {
    doc.rect(x, y, 100, 100)
       .fill('#f5f5f5')
       .stroke('#DDD');
    doc.fontSize(8).fill('#666')
       .text('Imagen no disponible', x, y + 45, {
           width: 100,
           align: 'center'
       });
}

app.get("/producto/:id", async (req, res) => {
    const productId = req.params.id;
    const url = `https://www.chedraui.com.mx/api/catalog_system/pub/products/search?fq=productId:${productId}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error en la API de Chedraui: ${response.status}`);
        }
        const data = await response.json();
        return res.json(data)
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
