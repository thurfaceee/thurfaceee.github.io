const API_BASE = "http://localhost:3000";
const API_URL = "http://localhost:3000/api";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

let selectedKode = null;
let currentKode = null;
let adminToken = localStorage.getItem("adminToken") || "";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`
  };
}

function badgeClass(status) {
  if (status === "Diproses") return "badge badge-proses";
  if (status === "Selesai") return "badge badge-selesai";
  if (status === "Ditolak") return "badge badge-tolak";
  return "badge badge-wait";
}

function formatTanggal(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${adminToken}`
    }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Terjadi kesalahan pada server.");
  }

  return result;
}

async function doLogin() {
  const inputs = document.querySelectorAll("#login-shell .login-input");
  const username = inputs[0]?.value.trim();
  const password = inputs[1]?.value.trim();

  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Login gagal.");
    }

    adminToken = result.token;
    localStorage.setItem("adminToken", adminToken);

    $("#login-shell").style.display = "none";
    $("#admin-shell").style.display = "block";

    showAdminPage("dashboard");
    showToast("Berhasil masuk sebagai Admin Polsek Wanasari");
  } catch (error) {
    showToast(error.message);
  }
}

function doLogout() {
  localStorage.removeItem("adminToken");
  adminToken = "";

  $("#admin-shell").style.display = "none";
  $("#login-shell").style.display = "flex";

  showToast("Berhasil keluar dari sistem");
}

function togglePw() {
  const inputPassword = $("#pw-input");
  if (!inputPassword) return;

  inputPassword.type = inputPassword.type === "password" ? "text" : "password";
}

function showAdminPage(name) {
  $$(".admin-page").forEach((page) => page.classList.remove("active"));

  const targetPage = $("#page-" + name);
  if (targetPage) targetPage.classList.add("active");

  const navMap = {
    dashboard: "nav-dashboard",
    data: "nav-data",
    detail: "nav-data",
    kategori: "nav-kategori",
    profil: "nav-profil"
  };

  $$(".nav-item").forEach((nav) => nav.classList.remove("active"));

  const activeNav = $("#" + navMap[name]);
  if (activeNav) activeNav.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name === "dashboard") loadDashboard();
  if (name === "data") loadDataPengaduan();
}

async function loadDashboard() {
  try {
    const result = await apiFetch("/stats");
    const stats = result.data;

    const values = $$("#page-dashboard .stat-value");

    if (values[0]) values[0].textContent = stats.total;
    if (values[1]) values[1].textContent = stats.menunggu;
    if (values[2]) values[2].textContent = stats.diproses;
    if (values[3]) values[3].textContent = stats.selesai;
    if (values[4]) values[4].textContent = stats.ditolak;

    renderRecentTable(stats.terbaru || []);
    renderTopKategori(stats.topKategori || []);
  } catch (error) {
    showToast(error.message);
  }
}

function renderTopKategori(list) {
  const container = $("#page-dashboard .analytics-row .card:nth-child(2)");
  if (!container) return;

  const max = list[0]?.jumlah || 1;

  container.innerHTML = `
    <div class="card-header"><h3>Top Kategori</h3></div>
    ${
      list.length
        ? list
            .map((item) => {
              const width = Math.max(8, (item.jumlah / max) * 100);
              return `
                <div class="top-kat-item">
                  <div class="top-kat-row">
                    <span>${escapeHTML(item.nama)}</span>
                    <span class="top-kat-count">${item.jumlah}</span>
                  </div>
                  <div class="top-kat-bar">
                    <div class="top-kat-fill" style="width:${width}%;"></div>
                  </div>
                </div>
              `;
            })
            .join("")
        : `<p style="font-size:13px;color:var(--gray-600);">Belum ada laporan.</p>`
    }
  `;
}

function renderRecentTable(list) {
  const tbody = $("#page-dashboard .table-section tbody");
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--gray-600);">
          Belum ada pengaduan masuk.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map(
      (item) => `
      <tr>
        <td class="kode-col">#${escapeHTML(item.kode)}</td>
        <td>${escapeHTML(item.namaLengkap)}</td>
        <td>${escapeHTML(item.kategori)}</td>
        <td>${formatTanggal(item.createdAt)}</td>
        <td><span class="${badgeClass(item.status)}">${escapeHTML(item.status)}</span></td>
        <td>
          <div class="action-icons">
            <button onclick="lihatDetail('${item.kode}')">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

async function loadDataPengaduan() {
  const dataPage = $("#page-data");
  if (!dataPage) return;

  const searchInput = dataPage.querySelector(".filter-input");
  const selects = dataPage.querySelectorAll(".filter-select");

  const q = searchInput?.value.trim() || "";
  const kategori = selects[0]?.value || "Semua Kategori";
  const status = selects[1]?.value || "Semua Status";

  const params = new URLSearchParams();
  if (q) params.append("q", q);
  if (kategori !== "Semua Kategori") params.append("kategori", kategori);
  if (status !== "Semua Status") params.append("status", status);

  try {
    const result = await apiFetch(`/pengaduan?${params.toString()}`);
    renderDataTable(result.data || []);
  } catch (error) {
    showToast(error.message);
  }
}

function renderDataTable(list) {
  const tbody = $("#page-data tbody");
  const paginationText = $("#page-data .pagination-row span");

  if (!tbody) return;

  if (paginationText) {
    paginationText.textContent = `Menampilkan ${list.length} data pengaduan`;
  }

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:var(--gray-600);">
          Tidak ada data pengaduan.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map(
      (item) => `
      <tr>
        <td class="kode-col">#${escapeHTML(item.kode)}</td>
        <td>
          <div class="pelapor-name">${escapeHTML(item.namaLengkap)}</div>
          <div class="pelapor-phone">${escapeHTML(item.noHp)}</div>
        </td>
        <td>${escapeHTML(item.kategori)}</td>
        <td>${escapeHTML(item.lokasi)}</td>
        <td>${formatTanggal(item.createdAt)}</td>
        <td><span class="${badgeClass(item.status)}">${escapeHTML(item.status)}</span></td>
        <td>
          <div class="action-icons">
            <button onclick="lihatDetail('${item.kode}')" title="Lihat Detail">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>

            <button class="red" onclick="openModal('${item.kode}')" title="Hapus">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

async function lihatDetail(kode) {
  try {
    const response = await fetch(`${API_URL}/pengaduan/${kode}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Detail pengaduan tidak ditemukan.");
    }

    currentKode = kode;
    renderDetail(result.data);
    showAdminPage("detail");
  } catch (error) {
    showToast(error.message);
  }
}

function renderDetail(data) {
  const detailPage = $("#page-detail");
  if (!detailPage) return;

  const kodeBig = detailPage.querySelector(".kode-big");
  const statusBadge = detailPage.querySelector(".detail-header-right .badge");
  const timeLabel = detailPage.querySelector(".time-lbl");
  const values = detailPage.querySelectorAll(".info-item .val");
  const kronologi = detailPage.querySelector(".kronologi-text");
  const buktiGrid = detailPage.querySelector(".bukti-grid");
  const statusSelect = detailPage.querySelector(".tl-select");

  if (kodeBig) kodeBig.textContent = "#" + data.kode;

  if (statusBadge) {
    statusBadge.className = badgeClass(data.status);
    statusBadge.style.fontSize = "13px";
    statusBadge.style.padding = "6px 16px";
    statusBadge.textContent = "● " + data.status;
  }

  if (timeLabel) {
    timeLabel.textContent = "Diterima: " + formatTanggal(data.createdAt);
  }

  if (values[0]) values[0].textContent = data.namaLengkap || "-";
  if (values[1]) values[1].textContent = data.noHp || "-";
  if (values[2]) values[2].textContent = data.alamat || "-";
  if (values[3]) values[3].textContent = data.kategori || "-";
  if (values[4]) values[4].textContent = formatTanggal(data.tanggalKejadian);
  if (values[5]) values[5].textContent = data.lokasi || "-";

  if (kronologi) {
    kronologi.textContent = data.kronologi || "-";
  }

  if (buktiGrid) {
    if (data.bukti && data.bukti.url) {
      buktiGrid.innerHTML = `
        <a class="bukti-item doc" href="${API_BASE}${data.bukti.url}" target="_blank">
          Buka Bukti<br/>
          ${escapeHTML(data.bukti.namaAsli)}
        </a>
      `;
    } else {
      buktiGrid.innerHTML = `
        <div class="bukti-item doc">
          Tidak ada bukti
        </div>
      `;
    }
  }

  if (statusSelect) {
    statusSelect.value = data.status;
  }

  renderRiwayat(data.riwayat || []);
}

function renderRiwayat(riwayat) {
  const card = $(".riwayat-card");
  if (!card) return;

  card.querySelectorAll(".riwayat-item").forEach((item) => item.remove());

  const title = card.querySelector("h4");

  riwayat.forEach((item) => {
    const div = document.createElement("div");
    div.className = "riwayat-item";

    div.innerHTML = `
      <div class="riwayat-dot blue">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </div>
      <div class="riwayat-text">
        <div class="r-title">Status: ${escapeHTML(item.status)}</div>
        <div class="r-sub">${escapeHTML(item.catatan)} • ${formatTanggal(item.waktu)}</div>
      </div>
    `;

    title.insertAdjacentElement("afterend", div);
  });
}

async function simpanTindakLanjut() {
  if (!currentKode) {
    showToast("Pilih data pengaduan terlebih dahulu.");
    return;
  }

  const detailPage = $("#page-detail");
  const statusSelect = detailPage.querySelector(".tl-select");
  const catatan = detailPage.querySelector(".tl-textarea");

  const status = statusSelect.value;
  const catatanAdmin = catatan.value.trim();

  if (!catatanAdmin) {
    showToast("Catatan admin wajib diisi.");
    return;
  }

  try {
    await apiFetch(`/pengaduan/${currentKode}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({
        status,
        catatanAdmin
      })
    });

    catatan.value = "";
    showToast("Status pengaduan berhasil diperbarui.");
    await lihatDetail(currentKode);
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

function openModal(kode) {
  selectedKode = kode;

  const modal = $("#delete-modal");
  if (modal) modal.classList.add("open");
}

function closeModal() {
  const modal = $("#delete-modal");
  if (modal) modal.classList.remove("open");
}

async function confirmDelete() {
  if (!selectedKode) {
    showToast("Data belum dipilih.");
    closeModal();
    return;
  }

  try {
    await apiFetch(`/pengaduan/${selectedKode}`, {
      method: "DELETE",
      headers: authHeaders()
    });

    showToast("Data berhasil dihapus.");
    selectedKode = null;
    closeModal();

    await loadDataPengaduan();
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

function filterDataPengaduan() {
  loadDataPengaduan();
}

function filterKategori() {
  const kategoriPage = $("#page-kategori");
  if (!kategoriPage) return;

  const searchInput = kategoriPage.querySelector(".search-box");
  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : "";

  const rows = kategoriPage.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const rowText = row.innerText.toLowerCase();
    row.style.display = rowText.includes(searchValue) ? "" : "none";
  });
}

function tambahKategori() {
  const namaKategori = prompt("Masukkan nama kategori baru:");

  if (!namaKategori || namaKategori.trim() === "") {
    showToast("Nama kategori tidak boleh kosong.");
    return;
  }

  const kategoriPage = $("#page-kategori");
  const tbody = kategoriPage.querySelector("tbody");
  const jumlahRow = tbody.querySelectorAll("tr").length + 1;

  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${jumlahRow}</td>
    <td>
      <div style="font-weight:700;">${escapeHTML(namaKategori)}</div>
      <div style="font-size:11px;color:var(--gray-600);">Kategori baru</div>
    </td>
    <td style="color:var(--gray-600);">
      Deskripsi kategori ${escapeHTML(namaKategori)} dapat diedit oleh admin.
    </td>
    <td><span class="badge badge-aktif">Aktif</span></td>
    <td>
      <div class="action-icons">
        <button class="red" onclick="this.closest('tr').remove()">
          Hapus
        </button>
      </div>
    </td>
  `;

  tbody.appendChild(row);
  showToast("Kategori baru berhasil ditambahkan.");
}

function simpanProfil() {
  showToast("Profil admin berhasil diperbarui.");
}

function showToast(message) {
  let toast = $("#toast-notification");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-notification";
    toast.style.position = "fixed";
    toast.style.right = "24px";
    toast.style.bottom = "24px";
    toast.style.background = "#0d1117";
    toast.style.color = "#fff";
    toast.style.padding = "12px 18px";
    toast.style.borderRadius = "8px";
    toast.style.boxShadow = "0 8px 30px rgba(0,0,0,.25)";
    toast.style.fontSize = "13px";
    toast.style.fontWeight = "600";
    toast.style.zIndex = "9999";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all .25s ease";

    document.body.appendChild(toast);
  }

  toast.textContent = message;

  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
  }, 2500);
}

document.addEventListener("DOMContentLoaded", () => {
  const deleteModal = $("#delete-modal");

  if (deleteModal) {
    deleteModal.addEventListener("click", function (event) {
      if (event.target === this) closeModal();
    });
  }

  const btnConfirm = $(".btn-confirm");
  if (btnConfirm) {
    btnConfirm.onclick = confirmDelete;
  }

  const dataPage = $("#page-data");

  if (dataPage) {
    const searchInput = dataPage.querySelector(".filter-input");
    const filterSelects = dataPage.querySelectorAll(".filter-select");
    const filterBtn = dataPage.querySelector(".filter-btn");

    if (searchInput) searchInput.addEventListener("keyup", filterDataPengaduan);
    filterSelects.forEach((select) => select.addEventListener("change", filterDataPengaduan));
    if (filterBtn) filterBtn.addEventListener("click", filterDataPengaduan);
  }

  const kategoriPage = $("#page-kategori");

  if (kategoriPage) {
    const kategoriSearch = kategoriPage.querySelector(".search-box");
    const btnTambah = kategoriPage.querySelector(".btn-tambah");
    const btnFilter = kategoriPage.querySelector(".btn-filter");

    if (kategoriSearch) kategoriSearch.addEventListener("keyup", filterKategori);
    if (btnFilter) btnFilter.addEventListener("click", filterKategori);
    if (btnTambah) btnTambah.addEventListener("click", tambahKategori);
  }

  const btnSimpanTindakLanjut = $(".btn-simpan");
  if (btnSimpanTindakLanjut) {
    btnSimpanTindakLanjut.addEventListener("click", simpanTindakLanjut);
  }

  const btnSimpanProfil = $(".btn-simpan-profil");
  if (btnSimpanProfil) {
    btnSimpanProfil.addEventListener("click", simpanProfil);
  }

  if (adminToken) {
    $("#login-shell").style.display = "none";
    $("#admin-shell").style.display = "block";
    showAdminPage("dashboard");
  }
});