// ==============================
// admin.js 
// ==============================

// API_URL y funciones auxiliares (fetchData, etc.) ahora están en admin-core.js


// ==============================
// ==== FUNCIONES AUXILIARES ====
// ==============================
// (fetchData, formatDateTime12h movidos a admin-core.js)


async function fetchAndRenderAdminPendingCounts() {
  try {
    // 1. Conteo de Facturas Pendientes
    const invRes = await fetchData(`${API_URL}/orders/invoices/admin-pending-count`);
    const invCount = invRes?.count || 0;
    updateAdminTabBadge('invoices-badge', invCount);

    // 2. Conteo de Reservas Pendientes
    // Nota: La ruta de reservas tiene un segmento diferente, revisa si es necesario cambiar el prefijo en tu proyecto, asumo que las rutas de reservas están montadas en /api/reservations
    const resRes = await fetchData(`${API_URL}/reservations/admin-pending-count`);
    const resCount = resRes?.count || 0;
    updateAdminTabBadge('reservations-badge', resCount);

  } catch (error) {
    console.error("Error cargando conteos pendientes del Admin:", error);
  }
}

function updateAdminTabBadge(elementId, count) {
  const badgeEl = document.getElementById(elementId);
  if (!badgeEl) return;

  if (count > 0) {
    badgeEl.textContent = count > 9 ? '9+' : count;
    badgeEl.classList.remove('hidden');
  } else {
    badgeEl.classList.add('hidden');
  }
}

// ==============================
// ==== GLOBALS =================
const foodForm = document.getElementById("foodForm");
const foodTableBody = document.getElementById("foodTableBody");
const foodCategorySelect = document.getElementById("food-category");
const sizesListContainer = document.getElementById("sizes-list");
const foodFeaturedCheckbox = document.getElementById("food-featured");
const addSizeBtn = document.getElementById("add-size-btn");

// almacenamos todos los extras globalmente para poblar selects por tamaño
let allExtras = [];

// ==============================
// ==== COMIDAS (FOODS) ========
// ==============================
async function loadFoods() {
  const foods = await fetchData(`${API_URL}/foods`);
  foodTableBody.innerHTML = "";
  foods.forEach((food) => {
    const sizesText = food.sizes
      ? food.sizes.map(s => `${s.size_name} ($${s.price})`).join(", ")
      : "Sin tamaños";

    const featuredLabel = food.is_featured ? "⭐ " : "";

    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = featuredLabel + (food.name || "");
    tr.appendChild(tdName);

    const tdCat = document.createElement("td");
    tdCat.textContent = food.category_name || "Sin categoría";
    tr.appendChild(tdCat);

    const tdSizes = document.createElement("td");
    tdSizes.textContent = sizesText;
    tr.appendChild(tdSizes);

    const tdImg = document.createElement("td");
    const img = document.createElement("img");
    img.src = food.image_url || "";
    img.alt = "imagen";
    img.width = 50;
    tdImg.appendChild(img);
    tr.appendChild(tdImg);

    const tdActions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "✏️";
    editBtn.title = "Editar";
    editBtn.addEventListener("click", () => editFood(food.id));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "🗑️";
    delBtn.title = "Eliminar";
    delBtn.addEventListener("click", () => deleteFood(food.id));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    foodTableBody.appendChild(tr);
  });
}

async function loadCategoriesForSelect() {
  const categories = await fetchData(`${API_URL}/categories`);
  categories.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
  foodCategorySelect.innerHTML = "";
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat.id;
    option.textContent = cat.name;
    foodCategorySelect.appendChild(option);
  });
}

// ==============================
// ==== EXTRAS GLOBAL (para selects por tamaño) =====
// ==============================
async function loadAllExtrasGlobal() {
  try {
    allExtras = await fetchData(`${API_URL}/extras`) || [];
  } catch (err) {
    console.error("No se pudieron cargar extras globales:", err);
    allExtras = [];
  }
}

// ==============================
// ==== FORM SUBMIT (CREATE / UPDATE FOOD) =======
// ==============================
if (foodForm) {
  foodForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("food-id").value;

    const sizesNodes = Array.from(document.querySelectorAll(".size-item"));
    const sizesMeta = sizesNodes.map((node) => {
      const sizeName = node.querySelector('input[name="size_name[]"]').value;
      const calories = node.querySelector('input[name="calories[]"]').value || 0;
      const price = node.querySelector('input[name="prices[]"]').value || 0;

      const extrasContainer = node.querySelector(".size-extras-container");
      const extrasSelected = extrasContainer
        ? Array.from(extrasContainer.querySelectorAll("input.size-extra-checkbox:checked"))
          .map(ch => Number(ch.value))
          .filter(n => !isNaN(n))
        : [];

      return {
        size_name: sizeName,
        calories: Number(calories),
        price: Number(price),
        extras: extrasSelected
      };
    });

    const formData = new FormData(foodForm);
    formData.set("sizes_json", JSON.stringify(sizesMeta));

    if (foodFeaturedCheckbox) {
      formData.set("is_featured", foodFeaturedCheckbox.checked ? "1" : "0");
    }

    try {
      if (id) {
        await fetchData(`${API_URL}/foods/${id}`, {
          method: "PUT",
          body: formData
        });
        alert("Comida actualizada con éxito");
      } else {
        await fetchData(`${API_URL}/foods`, {
          method: "POST",
          body: formData
        });
        alert("Comida creada con éxito");
      }

      foodForm.reset();
      document.getElementById("food-id").value = "";
      if (sizesListContainer) sizesListContainer.innerHTML = "";
      if (foodFeaturedCheckbox) foodFeaturedCheckbox.checked = false;

      await loadFoods();
    } catch (err) {
      console.error("Error al guardar comida:", err);
      alert("Ocurrió un error al guardar la comida. Revisa la consola.");
    }
  });
}

// ==============================
// ==== EDIT / DELETE FOOD =======
// ==============================
async function editFood(id) {
  const foods = await fetchData(`${API_URL}/foods`);
  const current = foods.find((f) => f.id === id);
  if (!current) return alert("Comida no encontrada");

  document.getElementById("food-id").value = current.id;
  document.getElementById("food-name").value = current.name;
  document.getElementById("food-description").value = current.description;
  document.getElementById("food-category").value = current.category_id;

  if (foodFeaturedCheckbox) {
    foodFeaturedCheckbox.checked = Boolean(current.is_featured);
  }

  if (sizesListContainer) sizesListContainer.innerHTML = "";
  if (current.sizes) {
    current.sizes.forEach(size => {
      const selectedExtrasIds = (size.extras || []).map(e => e.id);
      addSize(size.size_name, size.calories, size.price, selectedExtrasIds);
    });
  }
}

async function deleteFood(id) {
  if (!confirm("¿Seguro que deseas eliminar esta comida?")) return;
  try {
    await fetchData(`${API_URL}/foods/${id}`, { method: "DELETE" });
    alert("Comida eliminada");
    loadFoods();
  } catch (err) {
    console.error("Error eliminando comida:", err);
    alert("No se pudo eliminar la comida.");
  }
}

// ==============================
// ==== TAMANO, CALORIAS, PRECIO (con extras por tamaño) =======
function addSize(sizeName = "", calories = "", price = "", selectedExtras = []) {
  const div = document.createElement("div");
  div.classList.add("size-item");

  // crear inputs
  const inputSize = document.createElement("input");
  inputSize.type = "text";
  inputSize.name = "size_name[]";
  inputSize.placeholder = "Tamaño (ej: Familiar)";
  inputSize.value = sizeName;

  const inputCalories = document.createElement("input");
  inputCalories.type = "number";
  inputCalories.name = "calories[]";
  inputCalories.placeholder = "Calorías";
  inputCalories.value = calories;

  const inputPrice = document.createElement("input");
  inputPrice.type = "number";
  inputPrice.name = "prices[]";
  inputPrice.placeholder = "Precio";
  inputPrice.step = "0.01";
  inputPrice.value = price;

  const extrasWrapper = document.createElement("div");
  extrasWrapper.style.marginTop = "6px";

  const extrasTitle = document.createElement("strong");
  extrasTitle.textContent = "Extras por tamaño:";
  extrasWrapper.appendChild(extrasTitle);

  const extrasContainer = document.createElement("div");
  extrasContainer.classList.add("size-extras-container");
  extrasContainer.style.padding = "6px";
  extrasContainer.style.border = "1px solid #ddd";
  extrasContainer.style.maxHeight = "160px";
  extrasContainer.style.overflow = "auto";

  allExtras.forEach(extra => {
    const label = document.createElement("label");
    label.style.display = "block";
    label.style.marginBottom = "4px";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.classList.add("size-extra-checkbox");
    chk.value = extra.id;
    if ((selectedExtras || []).some(id => Number(id) === Number(extra.id))) chk.checked = true;

    label.appendChild(chk);
    label.appendChild(document.createTextNode(` ${extra.name} ($${Number(extra.price).toFixed(2)})`));
    extrasContainer.appendChild(label);
  });

  extrasWrapper.appendChild(extrasContainer);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "❌";
  removeBtn.style.marginTop = "6px";
  removeBtn.addEventListener("click", () => div.remove());

  div.appendChild(inputSize);
  div.appendChild(inputCalories);
  div.appendChild(inputPrice);
  div.appendChild(extrasWrapper);
  div.appendChild(removeBtn);

  if (sizesListContainer) sizesListContainer.appendChild(div);
}

// -----------------------------
// ==== CATEGORÍAS ==============
const categoryForm = document.getElementById("categoryForm");
const categoryTableBody = document.getElementById("categoryTableBody");
const categoryFeaturedCheckbox = document.getElementById("category-featured");

async function loadCategories() {
  const categories = await fetchData(`${API_URL}/categories`);
  categories.forEach(c => { c.is_featured = c.is_featured ? 1 : 0; });
  categories.sort((a, b) => (b.is_featured - a.is_featured));

  categoryTableBody.innerHTML = "";
  categories.forEach((cat) => {
    const tr = document.createElement("tr");
    if (cat.is_featured) {
      tr.style.background = "#fff8e6";
      tr.style.fontWeight = "600";
    }

    // Columna Imagen
    const tdImg = document.createElement("td");
    if (cat.image_url) {
      const img = document.createElement("img");
      img.src = cat.image_url;
      img.alt = "img";
      img.width = 40;
      img.height = 40;
      img.style.objectFit = "cover";
      img.style.borderRadius = "4px";
      tdImg.appendChild(img);
    } else {
      tdImg.textContent = "-";
    }
    tr.appendChild(tdImg);

    const tdName = document.createElement("td");
    tdName.textContent = cat.name;
    tr.appendChild(tdName);

    const tdFeatured = document.createElement("td");
    tdFeatured.style.textAlign = "center";
    tdFeatured.textContent = cat.is_featured ? "Sí" : "No";
    tr.appendChild(tdFeatured);

    const tdActions = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => editCategory(cat.id, cat.name, cat.is_featured ? 1 : 0));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", () => deleteCategory(cat.id));

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.title = "Activar/Desactivar destacado";
    toggleBtn.textContent = cat.is_featured ? "Desmarcar" : "Destacar";
    toggleBtn.addEventListener("click", () => toggleCategoryFeature(cat.id, cat.is_featured ? 0 : 1));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);
    tdActions.appendChild(toggleBtn);
    tr.appendChild(tdActions);

    categoryTableBody.appendChild(tr);
  });

  loadCategoriesForSelect();
}

if (categoryForm) {
  categoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("category-id").value;
    const formData = new FormData(categoryForm);

    // Ajustar checkbox manualmente si no se envía
    const isFeatured = categoryFeaturedCheckbox && categoryFeaturedCheckbox.checked ? "1" : "0";
    formData.set("is_featured", isFeatured);

    try {
      if (id) {
        // En PUT, si queremos usar FormData, necesitamos que el backend lo acepte.
        // categories.js fue modificado para usar upload.single("image") en PUT también.
        await fetchData(`${API_URL}/categories/${id}`, {
          method: "PUT",
          body: formData
        });
        alert("Categoría actualizada");
      } else {
        await fetchData(`${API_URL}/categories`, {
          method: "POST",
          body: formData
        });
        alert("Categoría creada");
      }

      categoryForm.reset();
      document.getElementById("category-id").value = "";
      if (categoryFeaturedCheckbox) categoryFeaturedCheckbox.checked = false;
      await loadCategories();
    } catch (err) {
      console.error("Error guardando categoría:", err);
      alert("Error guardando categoría");
    }
  });
}

function editCategory(id, name, is_featured = 0) {
  document.getElementById("category-id").value = id;
  document.getElementById("category-name").value = name;
  if (categoryFeaturedCheckbox) categoryFeaturedCheckbox.checked = Boolean(is_featured);
}

async function toggleCategoryFeature(id, newVal) {
  try {
    await fetchData(`${API_URL}/categories/${id}/feature`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_featured: newVal ? 1 : 0 })
    });
    await loadCategories();
  } catch (err) {
    console.error("Error toggleCategoryFeature:", err);
    alert("No se pudo cambiar estado destacado");
  }
}

async function deleteCategory(id) {
  if (!confirm("¿Seguro que deseas eliminar esta categoría?")) return;
  try {
    await fetchData(`${API_URL}/categories/${id}`, { method: "DELETE" });
    alert("Categoría eliminada");
    loadCategories();
  } catch (err) {
    console.error("Error eliminando categoría:", err);
    alert("Error eliminando categoría");
  }
}

// ==============================
// ==== EXTRAS (CRUD de extras globales) =================
const extraForm = document.getElementById("extraForm");
const extraTableBody = document.getElementById("extraTableBody");

async function loadExtras() {
  const extras = await fetchData(`${API_URL}/extras`);
  extraTableBody.innerHTML = "";
  extras.forEach((extra) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = extra.name;
    tr.appendChild(tdName);

    const tdPrice = document.createElement("td");
    tdPrice.textContent = `$${Number(extra.price).toFixed(2)}`;
    tr.appendChild(tdPrice);

    const tdActions = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => editExtra(extra.id, extra.name, Number(extra.price)));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", () => deleteExtra(extra.id));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    extraTableBody.appendChild(tr);
  });
}

if (extraForm) {
  extraForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("extra-id").value;
    const name = document.getElementById("extra-name").value;
    const price = document.getElementById("extra-price").value;

    try {
      if (id) {
        await fetchData(`${API_URL}/extras/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, price }),
        });
        alert("Extra actualizado");
      } else {
        await fetchData(`${API_URL}/extras`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, price }),
        });
        alert("Extra creado");
      }
      extraForm.reset();
      document.getElementById("extra-id").value = "";
      await loadExtras();
      await loadAllExtrasGlobal();
    } catch (err) {
      console.error("Error guardando extra:", err);
      alert("Error guardando extra");
    }
  });
}

function editExtra(id, name, price) {
  document.getElementById("extra-id").value = id;
  document.getElementById("extra-name").value = name;
  document.getElementById("extra-price").value = price;
}

async function deleteExtra(id) {
  if (!confirm("¿Seguro que deseas eliminar este extra?")) return;
  try {
    await fetchData(`${API_URL}/extras/${id}`, { method: "DELETE" });
    alert("Extra eliminado");
    await loadExtras();
    await loadAllExtrasGlobal();
  } catch (err) {
    console.error("Error eliminando extra:", err);
    alert("Error eliminando extra");
  }
}

// -----------------------------
// FACTURAS / INVOICES (ADMIN UI)
// (escapeHtml movido a admin-core.js)


const invoicesTableBody = document.getElementById("invoicesTableBody");
const invoicesTabPending = document.getElementById("tab-pending");
const invoicesTabDone = document.getElementById("tab-done");
const invoicesSearch = document.getElementById("invoice-search");
const refreshInvoicesBtn = document.getElementById("refresh-invoices");

const invoiceDetailModal = document.getElementById("invoice-detail");
const invIdEl = document.getElementById("inv-id");
const invClientNameEl = document.getElementById("inv-cliente-name");
const invClientEmailEl = document.getElementById("inv-cliente-email");
const invDateEl = document.getElementById("inv-date");
const invTotalEl = document.getElementById("inv-total");
const invDetailsContainer = document.getElementById("inv-details-container");
const invPaymentMethod = document.getElementById("inv-payment-method");
const invStatus = document.getElementById("inv-status");
const invPaymentDesc = document.getElementById("inv-payment-desc");
const saveInvoiceBtn = document.getElementById("save-invoice-changes");
const deleteInvoiceBtn = document.getElementById("delete-invoice");
const closeInvoiceBtn = document.getElementById("close-invoice");
const closeInvoiceDetailBtn = document.getElementById("close-invoice-detail");

let currentInvoice = null;
let currentFilter = "pendiente";

if (invoiceDetailModal) {
  invoiceDetailModal.classList.add("hidden");
  invoiceDetailModal.style.display = "none";
  const inner = document.getElementById("invoice-detail-inner");
  if (inner) inner.addEventListener("click", (ev) => ev.stopPropagation());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !invoiceDetailModal.classList.contains("hidden")) {
      invoiceDetailModal.classList.add("hidden");
      invoiceDetailModal.style.display = "none";
    }
  });
}

async function loadInvoices(filter = "pendiente", search = "") {
  try {
    const qs = new URLSearchParams();
    if (filter) qs.set("status", filter);
    if (search) qs.set("search", search);
    const invoices = await fetchData(`${API_URL}/orders/invoices?${qs.toString()}`);
    renderInvoices(invoices || []);
  } catch (err) {
    console.error("Error cargando invoices:", err);
  }
}

function renderInvoices(invoices) {
  invoicesTableBody.innerHTML = "";
  invoices.forEach(inv => {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = inv.id;
    tr.appendChild(tdId);

    const tdUser = document.createElement("td");
    const fullName = `${inv.user_name || "Anon"} ${inv.user_lastname || ""}`.trim();
    tdUser.textContent = fullName || `ID: ${inv.usuario_id}`;
    tr.appendChild(tdUser);

    const tdDate = document.createElement("td");
    tdDate.textContent = formatDateTime12h(inv.date);
    tr.appendChild(tdDate);

    const tdTotal = document.createElement("td");
    tdTotal.textContent = `$${Number(inv.total).toFixed(2)}`;
    tr.appendChild(tdTotal);

    const tdMethod = document.createElement("td");
    tdMethod.textContent = inv.payment_method || "-";
    tr.appendChild(tdMethod);

    const tdStatus = document.createElement("td");
    const statusDot = inv.status === "pagada" ? "●" : "●";
    tdStatus.innerHTML = `${statusDot} ${escapeHtml(inv.status)}`;
    tr.appendChild(tdStatus);

    const tdActions = document.createElement("td");
    const viewBtn = document.createElement("button");
    viewBtn.classList.add("btn-view-inv");
    viewBtn.type = "button";
    viewBtn.dataset.id = inv.id;
    viewBtn.textContent = "Ver";
    viewBtn.addEventListener("click", () => openInvoiceDetails(Number(viewBtn.dataset.id)));

    tdActions.appendChild(viewBtn);

    if (inv.status === "pendiente") {
      const delBtn = document.createElement("button");
      delBtn.classList.add("btn-delete-inv");
      delBtn.type = "button";
      delBtn.dataset.id = inv.id;
      delBtn.textContent = "Eliminar";
      delBtn.addEventListener("click", () => {
        const id = Number(delBtn.dataset.id);
        if (!confirm("¿Eliminar factura pendiente?")) return;
        deleteInvoice(id);
      });
      tdActions.appendChild(delBtn);
    }

    tr.appendChild(tdActions);
    invoicesTableBody.appendChild(tr);
  });
}

async function openInvoiceDetails(id) {
  try {
    const res = await fetchData(`${API_URL}/orders/invoices/${id}`);
    currentInvoice = res.invoice;
    const details = res.details || [];

    invIdEl.textContent = currentInvoice.id;
    if (invClientNameEl) {
      // Unimos nombre y apellido, o mostramos "Anon" si no existen
      const fullName = `${currentInvoice.user_name || ""} ${currentInvoice.user_lastname || ""}`.trim();
      invClientNameEl.textContent = fullName || "Anon";
    }

    if (invClientEmailEl) {
      invClientEmailEl.textContent = currentInvoice.user_email || "No registrado"; // Este campo viene del JOIN nuevo en orders.js
    }

    invDateEl.textContent = formatDateTime12h(currentInvoice.date);
    invTotalEl.textContent = Number(currentInvoice.total).toFixed(2);
    invPaymentMethod.textContent = currentInvoice.payment_method || "N/A";
    invStatus.value = currentInvoice.status || "pendiente";
    invPaymentDesc.value = currentInvoice.payment_description || "";

    // === NUEVO: PARSEAR ENLACES DE MAPAS ===
    const mapLinksContainer = document.getElementById("inv-map-links");
    if (mapLinksContainer) {
      mapLinksContainer.innerHTML = ""; // Limpiar
      const desc = currentInvoice.payment_description || "";

      // Buscar patrón de Google Maps
      const gMapMatch = desc.match(/Google: (https:\/\/www\.google\.com\/maps\?q=[^ |]+)/);
      if (gMapMatch && gMapMatch[1]) {
        const btnG = document.createElement("a");
        btnG.href = gMapMatch[1];
        btnG.target = "_blank";
        btnG.className = "btn-view-inv"; // Reutilizar clase estilo botón
        btnG.style.textDecoration = "none";
        btnG.style.backgroundColor = "#4285F4"; // Color Google
        btnG.style.color = "white";
        btnG.textContent = "📍 Ver en Google Maps";
        mapLinksContainer.appendChild(btnG);
      }

      // Buscar patrón de Apple Maps
      const aMapMatch = desc.match(/Apple: (https:\/\/maps\.apple\.com\/\?q=[^ |]+)/);
      if (aMapMatch && aMapMatch[1]) {
        const btnA = document.createElement("a");
        btnA.href = aMapMatch[1];
        btnA.target = "_blank";
        btnA.className = "btn-view-inv";
        btnA.style.textDecoration = "none";
        btnA.style.backgroundColor = "#000000"; // Color Apple
        btnA.style.color = "white";
        btnA.textContent = "🍏 Ver en Apple Maps";
        mapLinksContainer.appendChild(btnA);
      }
    }

    // === NUEVO: MOSTRAR IMAGEN CAPTURE ===
    const invImg = document.getElementById("inv-capture");
    const invNoImg = document.getElementById("inv-no-capture");

    invImg.classList.add("zoomable-image");
    invImg.style.cursor = "pointer";

    if (currentInvoice.capture_url) {
      invImg.src = currentInvoice.capture_url;
      invImg.style.display = "inline-block";
      invNoImg.style.display = "none";


      invImg.onclick = function () {
        showLightbox(this.src);
      };
      // -----------------------------------------------------

      invImg.onerror = function () {
        this.style.display = 'none';
        invNoImg.style.display = 'block';
        invNoImg.textContent = 'Error al cargar imagen';
      };
    } else {
      invImg.style.display = "none";
      invNoImg.style.display = "block";
      invNoImg.textContent = 'No se adjuntó imagen';
    }
    // =====================================

    invDetailsContainer.innerHTML = "";
    details.forEach(d => {
      let extrasHtml = "";
      try {
        const parsed = typeof d.extras_json === "string" ? JSON.parse(d.extras_json) : d.extras_json;
        if (Array.isArray(parsed) && parsed.length) {
          extrasHtml = `<div style="margin-top:6px;"><strong>Extras:</strong><ul style="margin:6px 0 6px 18px;">` +
            parsed.map(e => {
              if (typeof e === "object") return `<li>${escapeHtml(e.name || e.id)} — $${Number(e.price || 0).toFixed(2)}</li>`;
              return `<li>Extra ID: ${escapeHtml(String(e))}</li>`;
            }).join("") +
            `</ul></div>`;
        }
      } catch (err) {
        extrasHtml = "";
      }

      const row = document.createElement("div");
      row.style.borderBottom = "1px solid #eee";
      row.style.padding = "8px 4px";
      row.innerHTML = `
        <div><strong>${escapeHtml(d.food_name || "Item")}</strong> — ${escapeHtml(d.size_name || "")}</div>
        <div>Cantidad: ${d.quantity} · Precio unit: $${Number(d.unit_price).toFixed(2)} · Extras_total: $${Number(d.extras_total || 0).toFixed(2)}</div>
        ${extrasHtml}
        <div><strong>Subtotal:</strong> $${Number(d.subtotal).toFixed(2)}</div>
      `;
      invDetailsContainer.appendChild(row);
    });

    invoiceDetailModal.classList.remove("hidden");
    invoiceDetailModal.style.display = "block";
  } catch (err) {
    console.error("Error abriendo detalle invoice:", err);
    alert("No se pudo cargar la factura.");
  }
}

async function saveInvoiceChanges() {
  if (!currentInvoice) return;

  // 1. Referencia al botón y bloqueo
  const btn = document.getElementById("save-invoice-changes");
  const originalText = btn.textContent;

  btn.disabled = true;       // Bloquear
  btn.textContent = "Procesando..."; // Feedback visual

  const id = currentInvoice.id;
  const payload = {
    status: invStatus.value,
    payment_description: invPaymentDesc.value || null
  };

  try {
    await fetchData(`${API_URL}/orders/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    alert("Factura actualizada");

    // Cerrar modal y recargar
    invoiceDetailModal.classList.add("hidden");
    invoiceDetailModal.style.display = "none";
    await loadInvoices(currentFilter, invoicesSearch ? invoicesSearch.value.trim() : "");

  } catch (err) {
    console.error("Error guardando invoice:", err);
    alert("No se pudo guardar cambios.");
  } finally {

    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

async function deleteInvoice(id) {
  try {
    await fetchData(`${API_URL}/orders/invoices/${id}`, { method: "DELETE" });
    alert("Factura eliminada");
    invoiceDetailModal.classList.add("hidden");
    invoiceDetailModal.style.display = "none";
    await loadInvoices(currentFilter, invoicesSearch ? invoicesSearch.value.trim() : "");
  } catch (err) {
    console.error("Error eliminando invoice:", err);
    alert("No se pudo eliminar factura. Revisa la consola.");
  }
}

// ==============================
// ==== CONFIGURACIÓN (TASA BCV) =================
// ==============================
const configForm = document.getElementById("configForm");

async function loadConfig() {
  try {
    const data = await fetchData(`${API_URL}/config/tasa`);
    if (data && data.tasa) {
      document.getElementById("config-tasa").value = data.tasa;
    }
  } catch (err) {
    console.error("Error loading config:", err);
  }
}

if (configForm) {
  configForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tasa = document.getElementById("config-tasa").value;
    try {
      await fetchData(`${API_URL}/config/tasa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasa })
      });
      alert("Tasa actualizada correctamente");
    } catch (err) {
      console.error("Error updating config:", err);
      alert("Error actualizando la tasa");
    }
  });
}

// eventos UI para tabs y botones (manejados por JS, no inline)
function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const tabId = btn.dataset.tab;
      const content = document.getElementById(tabId);
      if (content) content.classList.add("active");
    });
  });
}

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
  // Tabs Logic
  const tabs = document.querySelectorAll(".tab-button");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  loadFoods();
  loadCategories();
  loadExtras();
  loadAllExtrasGlobal();
  loadInvoices(currentFilter);

  // NEW: Load Config
  loadConfig();

  // Refresh buttons
  if (refreshInvoicesBtn) refreshInvoicesBtn.addEventListener("click", () => loadInvoices(currentFilter, invoicesSearch.value));
  if (invoicesSearch) invoicesSearch.addEventListener("keydown", (e) => {
    if (e.key === 'Enter') loadInvoices(currentFilter, invoicesSearch.value);
  });

  // Initial count load
  fetchAndRenderAdminPendingCounts();
  // Poll every 30s
  setInterval(fetchAndRenderAdminPendingCounts, 30000);
});

if (invoicesTabPending) invoicesTabPending.addEventListener("click", () => {
  currentFilter = "pendiente";
  invoicesTabPending.classList.add("active");
  if (invoicesTabDone) invoicesTabDone.classList.remove("active");
  loadInvoices(currentFilter, invoicesSearch ? invoicesSearch.value.trim() : "");
});
if (invoicesTabDone) invoicesTabDone.addEventListener("click", () => {
  currentFilter = "pagada";
  invoicesTabDone.classList.add("active");
  if (invoicesTabPending) invoicesTabPending.classList.remove("active");
  loadInvoices(currentFilter, invoicesSearch ? invoicesSearch.value.trim() : "");
});
if (refreshInvoicesBtn) refreshInvoicesBtn.addEventListener("click", () => loadInvoices(currentFilter, invoicesSearch ? invoicesSearch.value.trim() : ""));
if (invoicesSearch) invoicesSearch.addEventListener("keydown", (e) => { if (e.key === "Enter") loadInvoices(currentFilter, invoicesSearch.value.trim()); });

if (saveInvoiceBtn) saveInvoiceBtn.addEventListener("click", saveInvoiceChanges);
if (deleteInvoiceBtn) deleteInvoiceBtn.addEventListener("click", async () => {
  if (!currentInvoice) return;
  if (!confirm("¿Eliminar esta factura pendiente?")) return;
  await deleteInvoice(currentInvoice.id);
});
if (closeInvoiceBtn) closeInvoiceBtn.addEventListener("click", () => {
  invoiceDetailModal.classList.add("hidden");
  invoiceDetailModal.style.display = "none";
});
if (closeInvoiceDetailBtn) closeInvoiceDetailBtn.addEventListener("click", () => {
  invoiceDetailModal.classList.add("hidden");
  invoiceDetailModal.style.display = "none";
});

// manejar addSize desde boton con id
if (addSizeBtn) addSizeBtn.addEventListener("click", () => addSize());

// ==========================================
// ==== GESTIÓN DE RESERVAS DE PAQUETES Y PISTAS =========
// ==========================================
const reservationsTableBody = document.getElementById("reservationsTableBody");
const reservationDetailModal = document.getElementById("reservation-detail");
const resSearchInput = document.getElementById("reservation-search");
let currentResFilter = "pending";
let currentReservationId = null;

// Cargar Reservas
async function loadReservations(filter = "pending", search = "") {
  try {
    const qs = new URLSearchParams();
    if (filter) qs.set("status", filter);
    if (search) qs.set("search", search);

    // Ajusta la URL según tus rutas
    const data = await fetchData(`${API_URL}/reservations?${qs.toString()}`);
    renderReservations(data || []);
  } catch (err) {
    console.error("Error cargando reservas:", err);
  }
}

// Renderizar tabla
// Renderizar tabla Reservas
function renderReservations(list) {
  if (!reservationsTableBody) return;
  reservationsTableBody.innerHTML = "";

  list.forEach(res => {
    const tr = document.createElement("tr");

    // ID
    const tdId = document.createElement("td");
    tdId.textContent = res.id;
    tr.appendChild(tdId);

    // Cliente
    const tdUser = document.createElement("td");
    tdUser.textContent = `${res.user_name || "Anon"} ${res.user_lastname || ""}`;
    tr.appendChild(tdUser);

    // Fecha Juego (Formato 12hrs)
    const tdDate = document.createElement("td");
    tdDate.textContent = formatDateTime12h(res.start_time);
    tr.appendChild(tdDate);

    // Paquete (Lógica condicional)
    const tdPkg = document.createElement("td");
    tdPkg.textContent = res.package_name || "No incluye (Solo pista)";
    if (!res.package_name) tdPkg.style.color = "#888"; // Visualmente gris si es solo pista
    tr.appendChild(tdPkg);

    // Pista asignada
    const tdLane = document.createElement("td");
    tdLane.textContent = res.lane_number ? `Pista ${res.lane_number}` : "Sin asignar";
    tdLane.style.fontWeight = "bold";
    tr.appendChild(tdLane);

    // Total
    const tdTotal = document.createElement("td");
    tdTotal.textContent = `$${(res.total_price_cents).toFixed(2)}`;
    tr.appendChild(tdTotal);

    // Método de Pago 
    const tdMethod = document.createElement("td");
    tdMethod.textContent = res.payment_method || "N/A";
    tdMethod.style.textTransform = "capitalize";
    tr.appendChild(tdMethod);

    // Estado
    const tdStatus = document.createElement("td");
    let statusIcon = "❓";
    if (res.status === 'pending') statusIcon = "⏳";
    if (res.status === 'confirmed') statusIcon = "✅";
    if (res.status === 'cancelled') statusIcon = "❌";
    if (res.status === 'completed') statusIcon = "🏁";

    tdStatus.innerHTML = `${statusIcon} ${res.status}`;
    tr.appendChild(tdStatus);

    // Acciones
    const tdActions = document.createElement("td");
    const btnView = document.createElement("button");
    btnView.textContent = "Ver Detalle";
    btnView.onclick = () => openReservationDetail(res.id);
    tdActions.appendChild(btnView);
    tr.appendChild(tdActions);

    reservationsTableBody.appendChild(tr);
  });
}

// Abrir Modal Detalle
async function openReservationDetail(id) {
  try {
    const data = await fetchData(`${API_URL}/reservations/${id}`);
    const r = data.reservation;
    const lanes = data.lanes || [];
    currentReservationId = r.id;

    // Llenar campos
    document.getElementById("dt-res-id").textContent = r.id;

    const fullName = `${r.user_name || ""} ${r.user_lastname || ""}`.trim();
    document.getElementById("dt-res-user").textContent = fullName || "Anon";
    const emailEl = document.getElementById("dt-res-email");
    if (emailEl) {
      emailEl.textContent = r.email || "No registrado";
    }

    // Validar nombre paquete en modal también
    document.getElementById("dt-res-package").textContent = r.package_name || "No incluye (Solo pista)";

    // Fechas en 12hrs
    document.getElementById("dt-res-start").textContent = formatDateTime12h(r.start_time);
    document.getElementById("dt-res-end").textContent = formatDateTime12h(r.end_time);

    document.getElementById("dt-res-people").textContent = r.number_of_people;
    document.getElementById("dt-res-shoes").textContent = r.shoe_sizes || "No especificadas";
    document.getElementById("dt-res-total").textContent = (r.total_price_cents).toFixed(2);
    document.getElementById("dt-res-method").textContent = r.payment_method;
    document.getElementById("dt-res-ref").textContent = r.payment_reference; // Aquí sí dejamos la referencia para que el admin la vea
    document.getElementById("dt-res-notes").value = r.notes || "";

    // Select de estado
    document.getElementById("dt-res-status-select").value = r.status;

    // Pistas
    const lanesText = lanes.map(l => `Pista ${l.lane_number}`).join(", ");
    document.getElementById("dt-res-lanes").textContent = lanesText || "Sin asignar";

    // Imagen comprobante
    const imgEl = document.getElementById("dt-res-capture");
    const noImgText = document.getElementById("no-capture-text");

    imgEl.classList.add("zoomable-image");
    imgEl.style.cursor = "pointer";

    if (r.payment_capture_url) {
      imgEl.src = r.payment_capture_url;
      imgEl.style.display = "block";
      noImgText.style.display = "none";
      imgEl.onclick = function () {
        showLightbox(this.src);
      };
    } else {
      imgEl.style.display = "none";
      noImgText.style.display = "block";
    }

    // Mostrar Modal
    reservationDetailModal.style.display = "block";
    reservationDetailModal.classList.remove("hidden");

  } catch (err) {
    console.error(err);
    alert("Error cargando detalle");
  }
}


// Guardar Cambios en Reservas
document.getElementById("save-res-changes").addEventListener("click", async () => {
  if (!currentReservationId) return;

  // 1. Referencia al botón y bloqueo
  const btn = document.getElementById("save-res-changes");
  const originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = "Actualizando...";

  const newStatus = document.getElementById("dt-res-status-select").value;
  const notes = document.getElementById("dt-res-notes").value;

  try {
    await fetchData(`${API_URL}/reservations/${currentReservationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, notes: notes })
    });
    alert("Reserva actualizada");
    reservationDetailModal.style.display = "none";
    loadReservations(currentResFilter);
  } catch (err) {
    console.error(err);
    alert("Error al guardar");
  } finally {
    // 2. Desbloqueo siempre
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
});

// Eliminar
document.getElementById("delete-res").addEventListener("click", async () => {
  if (!currentReservationId) return;
  if (!confirm("¿Estás seguro de ELIMINAR esta reserva? Esta acción es irreversible.")) return;

  try {
    await fetchData(`${API_URL}/reservations/${currentReservationId}`, { method: "DELETE" });
    alert("Reserva eliminada");
    reservationDetailModal.style.display = "none";
    loadReservations(currentResFilter);
  } catch (err) {
    console.error(err);
    alert("Error al eliminar");
  }
});

// Cerrar modales
document.getElementById("close-res-btn").addEventListener("click", () => {
  reservationDetailModal.style.display = "none";
});
document.getElementById("close-reservation-detail").addEventListener("click", () => {
  reservationDetailModal.style.display = "none";
});


// Filtros Tabs
function filterReservations(status) {
  currentResFilter = status;
  // Actualizar clases visuales de tabs
  document.getElementById("res-tab-pending").classList.toggle("active", status === 'pending');
  document.getElementById("res-tab-confirmed").classList.toggle("active", status === 'confirmed');
  document.getElementById("res-tab-all").classList.toggle("active", status === 'todas');

  loadReservations(status, resSearchInput.value);
}
const btnResPending = document.getElementById("res-tab-pending");
const btnResConfirmed = document.getElementById("res-tab-confirmed");
const btnResAll = document.getElementById("res-tab-all");

if (btnResPending) {
  btnResPending.addEventListener("click", () => filterReservations('pending'));
}

if (btnResConfirmed) {
  btnResConfirmed.addEventListener("click", () => filterReservations('confirmed'));
}

if (btnResAll) {
  btnResAll.addEventListener("click", () => filterReservations('todas'));
}

// Listener búsqueda
if (resSearchInput) {
  resSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadReservations(currentResFilter, resSearchInput.value);
  });
}
document.getElementById("refresh-reservations").addEventListener("click", () => loadReservations(currentResFilter));

// ==========================================
// ==== GESTIÓN DE PAQUETES =================
// ==========================================
const packageForm = document.getElementById("packageForm");
const packagesTableBody = document.getElementById("packagesTableBody");

async function loadPackages() {
  try {
    // Obtenemos todos los paquetes
    const pkgs = await fetchData(`${API_URL}/packages`);
    // Si tu backend filtra por active=1 en GET /, asegúrate de usar GET /all o modificar la ruta
    // en el paso 1 ya modificamos packages.js para devolver todos.

    packagesTableBody.innerHTML = "";
    pkgs.forEach(p => {
      const tr = document.createElement("tr");

      // Nombre
      const tdName = document.createElement("td");
      tdName.textContent = p.name;
      tr.appendChild(tdName);

      // Precio (Centavos -> Dolares)
      const tdPrice = document.createElement("td");
      tdPrice.textContent = `$${(p.price_cents).toFixed(2)}`;
      tr.appendChild(tdPrice);

      // Horas
      const tdDur = document.createElement("td");
      tdDur.textContent = p.duration_hours;
      tr.appendChild(tdDur);

      // Max Personas
      const tdMax = document.createElement("td");
      tdMax.textContent = p.max_people;
      tr.appendChild(tdMax);

      // Activo
      const tdActive = document.createElement("td");
      tdActive.textContent = p.active ? "✅" : "❌";
      tr.appendChild(tdActive);

      // Acciones
      const tdActions = document.createElement("td");

      const btnEdit = document.createElement("button");
      btnEdit.textContent = "✏️";
      btnEdit.onclick = () => editPackage(p);

      const btnDel = document.createElement("button");
      btnDel.textContent = "🗑️";
      btnDel.onclick = () => deletePackage(p.id);

      tdActions.appendChild(btnEdit);
      tdActions.appendChild(btnDel);
      tr.appendChild(tdActions);

      packagesTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error cargando paquetes", err);
  }
}

// Crear / Editar Paquete
if (packageForm) {
  packageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("pkg-id").value;
    const formData = new FormData(packageForm);

    // Manejo manual del checkbox en FormData
    const isActive = document.getElementById("pkg-active").checked;
    formData.set("active", isActive ? "1" : "0");

    try {
      if (id) {
        await fetchData(`${API_URL}/packages/${id}`, { method: "PUT", body: formData });
        alert("Paquete actualizado");
      } else {
        await fetchData(`${API_URL}/packages`, { method: "POST", body: formData });
        alert("Paquete creado");
      }
      packageForm.reset();
      document.getElementById("pkg-id").value = "";
      document.getElementById("pkg-active").checked = true;
      loadPackages();
    } catch (err) {
      console.error(err);
      alert("Error guardando paquete");
    }
  });
}

function editPackage(p) {
  document.getElementById("pkg-id").value = p.id;
  document.getElementById("pkg-name").value = p.name;
  document.getElementById("pkg-desc").value = p.description;
  document.getElementById("pkg-price").value = (p.price_cents).toFixed(2);
  document.getElementById("pkg-duration").value = p.duration_hours;
  document.getElementById("pkg-max").value = p.max_people;
  document.getElementById("pkg-active").checked = (p.active === 1);
  // Cambiar tab a packages si no estamos ahi (opcional)
}

async function deletePackage(id) {
  if (!confirm("¿Eliminar este paquete?")) return;
  try {
    await fetchData(`${API_URL}/packages/${id}`, { method: "DELETE" });
    loadPackages();
  } catch (err) { alert("Error eliminando"); }
}


// ==========================================
// ==== GESTIÓN DE PISTAS (LANES) ===========
// ==========================================
const laneForm = document.getElementById("laneForm");
const lanesTableBody = document.getElementById("lanesTableBody");

async function loadLanes() {
  try {
    const lanes = await fetchData(`${API_URL}/lanes`); // GET /lanes (ruta admin)
    lanesTableBody.innerHTML = "";
    lanes.forEach(l => {
      const tr = document.createElement("tr");

      const tdNum = document.createElement("td");
      tdNum.textContent = l.lane_number;
      tr.appendChild(tdNum);

      const tdName = document.createElement("td");
      tdName.textContent = l.name;
      tr.appendChild(tdName);

      const tdPrice = document.createElement("td");
      tdPrice.textContent = `$${(l.price_per_hour_cents).toFixed(2)}`;
      tr.appendChild(tdPrice);

      const tdActive = document.createElement("td");
      tdActive.textContent = l.active ? "✅" : "❌";
      tr.appendChild(tdActive);

      const tdActions = document.createElement("td");

      const btnEdit = document.createElement("button");
      btnEdit.textContent = "✏️";
      btnEdit.onclick = () => editLane(l);

      const btnDel = document.createElement("button");
      btnDel.textContent = "🗑️";
      btnDel.onclick = () => deleteLane(l.id);

      tdActions.appendChild(btnEdit);
      tdActions.appendChild(btnDel);
      tr.appendChild(tdActions);

      lanesTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error cargando pistas", err);
  }
}

if (laneForm) {
  laneForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("lane-id").value;

    const payload = {
      lane_number: document.getElementById("lane-number").value,
      name: document.getElementById("lane-name").value,
      description: document.getElementById("lane-desc").value,
      price: document.getElementById("lane-price").value,
      max_players: document.getElementById("lane-max").value,
      active: document.getElementById("lane-active").checked
    };

    try {
      if (id) {
        await fetchData(`${API_URL}/lanes/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        alert("Pista actualizada");
      } else {
        await fetchData(`${API_URL}/lanes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        alert("Pista creada");
      }
      laneForm.reset();
      document.getElementById("lane-id").value = "";
      document.getElementById("lane-active").checked = true;
      loadLanes();
    } catch (err) {
      console.error(err);
      alert("Error guardando pista");
    }
  });
}

function editLane(l) {
  document.getElementById("lane-id").value = l.id;
  document.getElementById("lane-number").value = l.lane_number;
  document.getElementById("lane-name").value = l.name;
  document.getElementById("lane-desc").value = l.description || "";
  document.getElementById("lane-price").value = (l.price_per_hour_cents).toFixed(2);
  document.getElementById("lane-max").value = l.max_players;
  document.getElementById("lane-active").checked = (l.active === 1);
}

async function deleteLane(id) {
  if (!confirm("¿Eliminar pista? Esto puede romper historiales de reserva.")) return;
  try {
    await fetchData(`${API_URL}/lanes/${id}`, { method: "DELETE" });
    loadLanes();
  } catch (err) { alert("Error eliminando pista"); }
}

// ==========================================
// ==== LIGHTBOX (Visor de Imágenes) ========
// ==========================================
const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');

// Cerrar lightbox
if (lightboxClose) {
  lightboxClose.addEventListener('click', () => {
    lightboxOverlay.classList.add('hidden');
    lightboxImg.src = ""; // Limpiar source
  });
}

// Cerrar al hacer clic fuera de la imagen (en el fondo negro)
if (lightboxOverlay) {
  lightboxOverlay.addEventListener('click', (e) => {
    if (e.target === lightboxOverlay) {
      lightboxOverlay.classList.add('hidden');
      lightboxImg.src = "";
    }
  });
}

// Delegación de eventos global para detectar clics en imágenes zoomables
// Esto funciona tanto para Reservas como para Facturas sin repetir código
document.addEventListener('click', (e) => {
  if (e.target && e.target.classList.contains('zoomable-image')) {
    const src = e.target.src;
    if (src && src !== window.location.href) { // Validar que tenga source
      lightboxImg.src = src;
      lightboxOverlay.classList.remove('hidden');
    }
  }
});

// Función auxiliar para abrir el visor
function showLightbox(src) {
  const overlay = document.getElementById('lightbox-overlay');
  const img = document.getElementById('lightbox-img');
  if (overlay && img && src) {
    img.src = src;
    overlay.classList.remove('hidden');
  }
}

// ==============================
// ==== POSTS (NOTICIAS) ========
// ==============================
// Lógica de Noticias movida a admin-news.js


// ==============================
// ==== INIT ====================
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  await loadAllExtrasGlobal();
  await loadFoods();
  await loadCategories();
  await loadExtras();
  await fetchAndRenderAdminPendingCounts();
  loadInvoices(currentFilter || "pendiente");
  loadReservations("pending");
  loadPackages();
  loadLanes();
  // loadPosts() movido a admin-news.js

  loadDeliveryConfig(); // NUEVO: Cargar config de delivery
  setInterval(fetchAndRenderAdminPendingCounts, 5000); // 5 segundos
});

// ==============================
// ==== CONFIGURACIÓN DELIVERY ===
// ==============================
async function loadDeliveryConfig() {
  try {
    const config = await fetchData(`${API_URL}/config/delivery`);
    if (config) {
      const form = document.getElementById("deliveryConfigForm");
      if (form) {
        if (document.getElementById("del-km-base")) document.getElementById("del-km-base").value = config.km_base;
        if (document.getElementById("del-precio-base")) document.getElementById("del-precio-base").value = config.precio_base;
        if (document.getElementById("del-precio-km")) document.getElementById("del-precio-km").value = config.precio_km;
        if (document.getElementById("del-distancia-max")) document.getElementById("del-distancia-max").value = config.distancia_max;
      }
    }
  } catch (error) {
    console.error("Error loading delivery config:", error);
  }
}

const deliveryConfigForm = document.getElementById("deliveryConfigForm");
if (deliveryConfigForm) {
  deliveryConfigForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(deliveryConfigForm);
    const data = {
      km_base: formData.get("km_base"),
      precio_base: formData.get("precio_base"),
      precio_km: formData.get("precio_km"),
      distancia_max: formData.get("distancia_max")
    };

    try {
      await fetchData(`${API_URL}/config/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      alert("✅ Configuración de delivery actualizada");
    } catch (error) {
      console.error("Error saving delivery config:", error);
      alert("❌ Error al guardar configuración");
    }
  });
}
