const API_URL = "http://localhost:3000/api";

function showPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));

  const target = document.getElementById("page-" + name);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-links a").forEach((a) => a.classList.remove("active"));

  const map = {
    beranda: "nav-beranda",
    info: "nav-info",
    buat: "nav-buat",
    cek: "nav-cek",
    kontak: "nav-kontak"
  };

  if (map[name]) {
    const nav = document.getElementById(map[name]);
    if (nav) nav.classList.add("active");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = btn.classList.contains("open");

  document.querySelectorAll(".faq-q").forEach((q) => {
    q.classList.remove("open");
    if (q.nextElementSibling) q.nextElementSibling.classList.remove("open");
  });

  if (!isOpen) {
    btn.classList.add("open");
    answer.classList.add("open");
  }
}

function badgeClass(status) {
  if (status === "Diproses") return "badge-proses";
  if (status === "Selesai") return "badge-selesai";
  if (status === "Ditolak") return "badge-tolak";
  return "badge-wait";
}

function formatTanggal(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function copyKode() {
  const kodeEl = document.querySelector(".kode-val");
  if (!kodeEl) return;

  const kode = kodeEl.innerText.trim();

  navigator.clipboard.writeText(kode).then(() => {
    showToastUser("Kode " + kode + " berhasil disalin.");
  });
}

function showToastUser(message) {
  let toast = document.getElementById("copy-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "copy-toast";
    toast.style.cssText = `
      position:fixed;
      bottom:32px;
      left:50%;
      transform:translateX(-50%);
      background:#1a237e;
      color:#fff;
      padding:12px 24px;
      border-radius:8px;
      font-size:14px;
      font-weight:600;
      box-shadow:0 4px 16px rgba(0,0,0,.2);
      z-index:9999;
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = message;

  setTimeout(() => {
    toast.remove();
  }, 2500);
}

async function kirimPengaduan(event) {
  event.preventDefault();

  const form = event.target;
  const agree = document.getElementById("agree");

  if (!agree || !agree.checked) {
    showToastUser("Centang pernyataan kebenaran data dulu.");
    return;
  }

  const submitBtn = form.querySelector(".btn-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Mengirim...";

  try {
    const formData = new FormData(form);

    const response = await fetch(`${API_URL}/pengaduan`, {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Gagal mengirim pengaduan.");
    }

    const kode = result.data.kode;

    const kodeBox = document.querySelector("#page-sukses .kode-val");

    if (kodeBox) {
      kodeBox.innerHTML = `
        ${kode}
        <svg onclick="copyKode()" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" title="Salin kode">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      `;
    }

    form.reset();

    const uploadText = document.getElementById("upload-text");
    if (uploadText) uploadText.textContent = "Pilih Berkas";

    const kategoriLain = document.getElementById("kategori-lain");
    if (kategoriLain) kategoriLain.style.display = "none";

    showPage("sukses");
  } catch (error) {
    showToastUser(error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      Kirim Pengaduan
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="18" height="18">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12 5 19 12 12 19"/>
      </svg>
    `;
  }
}

async function cariStatus() {
  const input = document.getElementById("input-kode");
  const hasil = document.getElementById("hasil-section");

  if (!input || !hasil) return;

  const kode = input.value.trim();

  if (!kode) {
    showToastUser("Kode pengaduan wajib diisi.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/pengaduan/${kode}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Data tidak ditemukan.");
    }

    const data = result.data;

    hasil.style.display = "block";
    hasil.innerHTML = `
      <div class="hasil-card">
        <div class="hasil-header">
          <h3>Hasil Pencarian</h3>
          <span class="${badgeClass(data.status)}">● ${data.status.toUpperCase()}</span>
        </div>

        <div class="hasil-body">
          <div class="info-field">
            <div class="lbl">Kode Laporan</div>
            <div class="val">${data.kode}</div>
          </div>

          <div class="info-field">
            <div class="lbl">Kategori</div>
            <div class="val" style="font-weight:500;">${data.kategori}</div>
          </div>

          <div class="hasil-img">
            <div class="img-placeholder">
              🏛️<br/>
              STATUS LAPORAN<br/>
              <strong>Polsek Wanasari</strong>
            </div>
          </div>

          <div class="info-field">
            <div class="lbl">Nama Pelapor</div>
            <div class="val">${data.namaLengkap}</div>
          </div>

          <div class="info-field">
            <div class="lbl">Tanggal Masuk</div>
            <div class="val" style="font-weight:500;">${formatTanggal(data.createdAt)}</div>
          </div>

          <div class="catatan-admin">
            <div class="cat-lbl">Catatan Admin</div>
            <p>"${data.catatanAdmin || "Belum ada catatan admin."}"</p>
          </div>
        </div>

        <div class="progress-wrap">
          <div class="progress-steps">
            <div class="prog-step">
              <div class="prog-circle done">✓</div>
              <h5>Laporan Diterima</h5>
              <div class="prog-sub">${formatTanggal(data.createdAt)}</div>
            </div>

            <div class="prog-conn ${data.status !== "Menunggu Verifikasi" ? "done" : ""}"></div>

            <div class="prog-step">
              <div class="prog-circle ${data.status === "Menunggu Verifikasi" ? "active" : "done"}">2</div>
              <h5>Verifikasi</h5>
              <div class="prog-sub">${data.status}</div>
            </div>

            <div class="prog-conn ${data.status === "Selesai" ? "done" : ""}"></div>

            <div class="prog-step">
              <div class="prog-circle ${data.status === "Selesai" ? "done" : ""}">3</div>
              <h5>Selesai</h5>
              <div class="prog-sub">${data.status === "Selesai" ? "Laporan selesai" : "Menunggu proses"}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    hasil.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    hasil.style.display = "none";
    showToastUser(error.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-pengaduan");
  if (form) {
    form.addEventListener("submit", kirimPengaduan);
  }

  const kategoriSelect = document.getElementById("kategori-pengaduan");
  const kategoriLain = document.getElementById("kategori-lain");

  if (kategoriSelect && kategoriLain) {
    kategoriSelect.addEventListener("change", () => {
      kategoriLain.style.display = kategoriSelect.value === "Lainnya" ? "block" : "none";
    });
  }

  const uploadBox = document.getElementById("upload-box");
  const buktiInput = document.getElementById("bukti-input");
  const uploadText = document.getElementById("upload-text");

  if (uploadBox && buktiInput) {
    uploadBox.addEventListener("click", () => {
      buktiInput.click();
    });

    buktiInput.addEventListener("change", () => {
      if (buktiInput.files.length > 0 && uploadText) {
        uploadText.textContent = buktiInput.files[0].name;
      }
    });
  }

  const btnCari = document.querySelector(".btn-cari");
  if (btnCari) {
    btnCari.removeAttribute("onclick");
    btnCari.addEventListener("click", cariStatus);
  }

  const hasil = document.getElementById("hasil-section");
  if (hasil) {
    hasil.style.display = "none";
  }
});