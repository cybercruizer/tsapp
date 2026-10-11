import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Increase JSON body limit for image uploads
app.use(express.json({ limit: '30mb' }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API: Gemini Vision Image Analysis
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { image, additionalContext } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const cleanBase64 = image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: `Anda adalah asisten AI surveyor & dokumentasi foto profesional. Analisis foto ini untuk keperluan timestamp & watermarking lapangan/proyek/kegiatan.
Identifikasi atau estimasikan informasi berikut:
1. Lokasi: nama tempat, landmark, jalan, atau kota dan negara jika dapat dikenali dari visual.
2. Koordinat perkiraan (latitude, longitude numerik contoh: -6.2088, 106.8456) jika lokasinya dikenali atau representatif untuk area tersebut.
3. Waktu hari (pagi, siang, sore, malam) dan perkiraan kondisi pencahayaan/cuaca (misal: "Cerah 31°C", "Berawan", "Hujan ringan").
4. Keterangan / Catatan Singkat: deskripsi ringkas 1-2 kalimat dalam Bahasa Indonesia yang cocok untuk catatan dokumentasi proyek/survey foto (misal: "Pengecekan konstruksi jalan raya pada sore hari").
${additionalContext ? `Konteks tambahan dari pengguna: ${additionalContext}` : ''}`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            location: {
              type: Type.STRING,
              description: 'Nama tempat, kota, landmark atau alamat perkiraan',
            },
            coordinates: {
              type: Type.STRING,
              description: 'Format lat, lng misal "-6.2088, 106.8456"',
            },
            dateTime: {
              type: Type.STRING,
              description: 'Estimasi tanggal/waktu ISO jika ada teks waktu di foto, atau biarkan kosong',
            },
            weather: {
              type: Type.STRING,
              description: 'Kondisi cuaca dan estimasi suhu, misal "Cerah 30°C"',
            },
            description: {
              type: Type.STRING,
              description: 'Catatan ringkas situasi foto dalam Bahasa Indonesia',
            },
          },
          required: ['location', 'description'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      return res.json({ location: '', description: '' });
    }

    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze:', error);
    return res.status(500).json({
      error: 'Failed to analyze image with Gemini',
      message: error?.message || 'Unknown error',
    });
  }
});

// API: Reverse Geocode Proxy (OSM Nominatim)
app.get('/api/geocode/reverse', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng parameters are required' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      String(lat)
    )}&lon=${encodeURIComponent(String(lng))}&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MKD-Timestamp-AI-Studio/2.0 (contact: build@aistudio.local)',
        'Accept-Language': 'id,en;q=0.8',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Geocoding service unavailable' });
    }

    const data = await response.json();
    const addr = data.address || {};
    const street = addr.road || addr.pedestrian || addr.suburb || '';
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
    const state = addr.state || addr.province || '';
    const country = addr.country || '';

    const formatted = [street, city, state, country].filter(Boolean).join(', ') || data.display_name || '';

    return res.json({
      display_name: formatted,
      full_display_name: data.display_name,
      address: addr,
      lat: data.lat,
      lon: data.lon,
    });
  } catch (error: any) {
    console.error('Reverse geocode error:', error);
    return res.status(500).json({ error: 'Geocode error', message: error?.message });
  }
});

// API: Search Location Proxy (OSM Nominatim)
app.get('/api/geocode/search', async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q
    )}&limit=5&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MKD-Timestamp-AI-Studio/2.0 (contact: build@aistudio.local)',
        'Accept-Language': 'id,en;q=0.8',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Search service unavailable' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error('Search geocode error:', error);
    return res.status(500).json({ error: 'Search error', message: error?.message });
  }
});

// Health check route
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Development mode with Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode with built assets
    app.use(express.static(path.join(__dirname, 'dist')));
    // In Express 5, use middleware instead of app.get('*') to avoid path-to-regexp wildcard syntax error
    app.use((_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MKD-Timestamp server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
