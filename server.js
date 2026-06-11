const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DB_FILE = path.join(DATA_DIR, "pengaduan.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]", "utf-8");

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

const ADMIN_USERNAME = "admin_wanasari";
const ADMIN_PASSWORD = "admin123";
const ADMIN_TOKEN = "demo-admin-token-wanasari";

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function clean(value) {
  return String(value || "").trim();
}

function makeKode() {
  const list = readDB();
  const year = new Date().getFullYear();
  const sameYear = list.filter((item) => item.kode.includes(`WNS-${year}`));
  const nextNumber = sameYear.length + 1;

  return `WNS-${year}-${String(nextNumber).padStart(5, "0")}`;
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";

  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak. Silakan login sebagai admin."
    });
  }

  next();
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const safeName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Backend E-Pengaduan Polsek Wanasari aktif."
  });
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.json({
      success: true,
      message: "Login berhasil.",
      token: ADMIN_TOKEN,
      admin: {
        username: ADMIN_USERNAME,
        nama: "Admin Polsek Wanasari"
      }
    });
  }

  return res.status(401).json({
    success: false,
    message: "Username atau password salah."
  });
});

app.post("/api/pengaduan", upload.single("bukti"), (req, res) => {
  const {
    nama_lengkap,
    no_hp,
    alamat,
    kategori,
    kategori_lain,
    lokasi,
    tanggal_kejadian,
    kronologi
  } = req.body;

  const kategoriFinal = clean(kategori) === "Lainnya"
    ? clean(kategori_lain)
    : clean(kategori);

  if (
    !clean(nama_lengkap) ||
    !clean(no_hp) ||
    !clean(alamat) ||
    !kategoriFinal ||
    !clean(lokasi) ||
    !clean(tanggal_kejadian) ||
    !clean(kronologi)
  ) {
    return res.status(400).json({
      success: false,
      message: "Semua data wajib diisi."
    });
  }

  const now = new Date().toISOString();
  const kode = makeKode();

  const laporanBaru = {
    id: Date.now().toString(),
    kode,
    namaLengkap: clean(nama_lengkap),
    noHp: clean(no_hp),
    alamat: clean(alamat),
    kategori: kategoriFinal,
    lokasi: clean(lokasi),
    tanggalKejadian: clean(tanggal_kejadian),
    kronologi: clean(kronologi),
    bukti: req.file
      ? {
          namaFile: req.file.filename,
          namaAsli: req.file.originalname,
          url: `/uploads/${req.file.filename}`
        }
      : null,
    status: "Menunggu Verifikasi",
    catatanAdmin: "Laporan telah diterima dan menunggu verifikasi petugas.",
    createdAt: now,
    updatedAt: now,
    riwayat: [
      {
        status: "Menunggu Verifikasi",
        catatan: "Laporan dikirim oleh pelapor.",
        waktu: now
      }
    ]
  };

  const list = readDB();
  list.unshift(laporanBaru);
  writeDB(list);

  res.status(201).json({
    success: true,
    message: "Pengaduan berhasil dikirim.",
    data: laporanBaru
  });
});

app.get("/api/pengaduan", requireAdmin, (req, res) => {
  const { q, kategori, status } = req.query;
  let list = readDB();

  if (q) {
    const keyword = q.toLowerCase();
    list = list.filter((item) =>
      item.kode.toLowerCase().includes(keyword) ||
      item.namaLengkap.toLowerCase().includes(keyword) ||
      item.noHp.toLowerCase().includes(keyword)
    );
  }

  if (kategori && kategori !== "Semua Kategori") {
    list = list.filter((item) => item.kategori === kategori);
  }

  if (status && status !== "Semua Status") {
    list = list.filter((item) => item.status === status);
  }

  res.json({
    success: true,
    total: list.length,
    data: list
  });
});

app.get("/api/pengaduan/:kode", (req, res) => {
  const { kode } = req.params;
  const list = readDB();

  const laporan = list.find((item) => item.kode === kode);

  if (!laporan) {
    return res.status(404).json({
      success: false,
      message: "Kode pengaduan tidak ditemukan."
    });
  }

  res.json({
    success: true,
    data: laporan
  });
});

app.patch("/api/pengaduan/:kode/status", requireAdmin, (req, res) => {
  const { kode } = req.params;
  const { status, catatanAdmin } = req.body;

  const allowedStatus = [
    "Menunggu Verifikasi",
    "Diproses",
    "Selesai",
    "Ditolak"
  ];

  if (!allowedStatus.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status tidak valid."
    });
  }

  if (!clean(catatanAdmin)) {
    return res.status(400).json({
      success: false,
      message: "Catatan admin wajib diisi."
    });
  }

  const list = readDB();
  const index = list.findIndex((item) => item.kode === kode);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "Data pengaduan tidak ditemukan."
    });
  }

  const now = new Date().toISOString();

  list[index].status = status;
  list[index].catatanAdmin = clean(catatanAdmin);
  list[index].updatedAt = now;
  list[index].riwayat.unshift({
    status,
    catatan: clean(catatanAdmin),
    waktu: now
  });

  writeDB(list);

  res.json({
    success: true,
    message: "Status pengaduan berhasil diperbarui.",
    data: list[index]
  });
});

app.delete("/api/pengaduan/:kode", requireAdmin, (req, res) => {
  const { kode } = req.params;

  const list = readDB();
  const laporan = list.find((item) => item.kode === kode);

  if (!laporan) {
    return res.status(404).json({
      success: false,
      message: "Data pengaduan tidak ditemukan."
    });
  }

  if (laporan.bukti && laporan.bukti.namaFile) {
    const filePath = path.join(UPLOAD_DIR, laporan.bukti.namaFile);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  const filtered = list.filter((item) => item.kode !== kode);
  writeDB(filtered);

  res.json({
    success: true,
    message: "Data pengaduan berhasil dihapus."
  });
});

app.get("/api/stats", requireAdmin, (req, res) => {
  const list = readDB();

  const countByStatus = (status) =>
    list.filter((item) => item.status === status).length;

  const kategoriMap = {};

  list.forEach((item) => {
    kategoriMap[item.kategori] = (kategoriMap[item.kategori] || 0) + 1;
  });

  const topKategori = Object.entries(kategoriMap)
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 5);

  res.json({
    success: true,
    data: {
      total: list.length,
      menunggu: countByStatus("Menunggu Verifikasi"),
      diproses: countByStatus("Diproses"),
      selesai: countByStatus("Selesai"),
      ditolak: countByStatus("Ditolak"),
      topKategori,
      terbaru: list.slice(0, 5)
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend berjalan di http://localhost:${PORT}`);
});