// =============================================================================
// PRAKTIKUM 3: REST API PROVIDER (CORE MODULE NODE.JS)
// =============================================================================

// Tips untuk Tugas Mahasiswa Butir 6:
// Tambahkan console.log identitas Anda pada baris paling atas ini jika untuk tugas mandiri.
// console.log('Nama Lengkap - Stambuk');

const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'destinations.json');

// -----------------------------------------------------------------------------
// HELPER RESPONS (Kode 3.4)
// -----------------------------------------------------------------------------
function kirimJSON(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

function kirimError(res, statusCode, pesan) {
    kirimJSON(res, statusCode, { error: pesan });
}

// -----------------------------------------------------------------------------
// HELPER DATA & PERSISTENSI (Kode 3.6)
// -----------------------------------------------------------------------------
async function bacaData() {
    const isi = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(isi);
}

async function simpanData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// -----------------------------------------------------------------------------
// HELPER REQUEST & VALIDASI BODY (Kode 3.9)
// -----------------------------------------------------------------------------
const FIELD_WAJIB = ['name', 'region', 'category'];

function buatError(statusCode, pesan) {
    const err = new Error(pesan);
    err.statusCode = statusCode;
    return err;
}

function bacaBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            if (body === '') return resolve(null);
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(buatError(400, 'Body request bukan JSON yang valid'));
            }
        });
        req.on('error', reject);
    });
}

function cekFieldWajib(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        return FIELD_WAJIB;
    }
    return FIELD_WAJIB.filter(
        (field) => typeof input[field] !== 'string' || input[field].trim() === ''
    );
}

// -----------------------------------------------------------------------------
// HANDLER ENDPOINT (Kode 3.8, Kode 3.10, Kode 3.11)
// -----------------------------------------------------------------------------

// GET /destinations (Dukungan query filter ?category=...)
async function daftarDestinasi(req, res, url) {
    let data = await bacaData();
    const kategori = url.searchParams.get('category');
    if (kategori) {
        data = data.filter((item) => item.category === kategori);
    }
    kirimJSON(res, 200, data);
}

// GET /destinations/:id
async function detailDestinasi(req, res, id) {
    const data = await bacaData();
    const item = data.find((d) => d.id === id);
    if (!item) {
        return kirimError(res, 404, `Destinasi dengan id ${id} tidak ditemukan`);
    }
    kirimJSON(res, 200, item);
}

// POST /destinations
async function tambahDestinasi(req, res) {
    const input = await bacaBody(req);
    const kurang = cekFieldWajib(input);
    if (kurang.length > 0) {
        return kirimError(res, 400, `Field wajib belum diisi: ${kurang.join(', ')}`);
    }

    const data = await bacaData();
    const idBaru = data.length === 0 ? 1 : Math.max(...data.map((d) => d.id)) + 1;
    const item = {
        id: idBaru,
        name: input.name.trim(),
        region: input.region.trim(),
        category: input.category.trim()
    };

    data.push(item);
    await simpanData(data);

    res.setHeader('Location', `/destinations/${idBaru}`);
    kirimJSON(res, 201, item);
}

// PUT /destinations/:id
async function ubahDestinasi(req, res, id) {
    const input = await bacaBody(req);
    const data = await bacaData();
    const index = data.findIndex((d) => d.id === id);
    if (index === -1) {
        return kirimError(res, 404, `Destinasi dengan id ${id} tidak ditemukan`);
    }

    const kurang = cekFieldWajib(input);
    if (kurang.length > 0) {
        return kirimError(res, 400, `Field wajib belum diisi: ${kurang.join(', ')}`);
    }

    data[index] = {
        id,
        name: input.name.trim(),
        region: input.region.trim(),
        category: input.category.trim()
    };
    await simpanData(data);
    kirimJSON(res, 200, data[index]);
}

// DELETE /destinations/:id
async function hapusDestinasi(req, res, id) {
    const data = await bacaData();
    const index = data.findIndex((d) => d.id === id);
    if (index === -1) {
        return kirimError(res, 404, `Destinasi dengan id ${id} tidak ditemukan`);
    }

    data.splice(index, 1);
    await simpanData(data);
    res.writeHead(204);
    res.end();
}

// -----------------------------------------------------------------------------
// ROUTER & KERANGKA SERVER (Kode 3.7)
// -----------------------------------------------------------------------------
async function router(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const segmen = url.pathname.split('/').filter(Boolean);

    if (segmen[0] !== 'destinations' || segmen.length > 2) {
        return kirimError(res, 404, 'Endpoint tidak ditemukan');
    }

    // Endpoint koleksi: /destinations
    if (segmen.length === 1) {
        if (req.method === 'GET') return daftarDestinasi(req, res, url);
        if (req.method === 'POST') return tambahDestinasi(req, res);
        res.setHeader('Allow', 'GET, POST');
        return kirimError(res, 405, `Method ${req.method} tidak didukung pada endpoint ini`);
    }

    // Endpoint item: /destinations/:id
    const id = Number(segmen[1]);
    if (!Number.isInteger(id) || id < 1) {
        return kirimError(res, 400, 'id harus berupa bilangan bulat positif');
    }

    if (req.method === 'GET') return detailDestinasi(req, res, id);
    if (req.method === 'PUT') return ubahDestinasi(req, res, id);
    if (req.method === 'DELETE') return hapusDestinasi(req, res, id);
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return kirimError(res, 405, `Method ${req.method} tidak didukung pada endpoint ini`);
}

// Inisialisasi HTTP Server
const server = http.createServer(async (req, res) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    try {
        await router(req, res);
    } catch (err) {
        if (err.statusCode) {
            return kirimError(res, err.statusCode, err.message);
        }
        console.error(err);
        kirimError(res, 500, 'Terjadi kesalahan pada server');
    }
});

// Menjalankan Server
server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});