const API_URL = "http://localhost:3000/api";

// =========================
// Utilidad: mostrar/ocultar secciones principales
// =========================
function showSection(id) {
  const sections = ['section-destacados', 'contenido-menu'];
  sections.forEach(sid => {
    const el = document.getElementById(sid);
    if (!el) return;
    if (sid === id) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
  // scroll suave al contenido visible
  const visible = document.getElementById(id);
  const header = document.querySelector('header');

  if (visible) {
    visible.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Ocultar header inmediatamente para dar espacio
    if (header) {
      header.classList.add('header-hidden');
      setTimeout(() => { header.classList.add('header-hidden'); }, 50);
      setTimeout(() => { header.classList.add('header-hidden'); }, 300);
    }
  }
}

// ==============================
// Cargar categorías
// ==============================
async function cargarCategorias() {
  const res = await fetch(`${API_URL}/categories`);
  const categorias = await res.json();

  const lista = document.getElementById("lista-categorias");
  const mobileContainer = document.getElementById("mobile-categories-scroll");

  if (lista) lista.innerHTML = "";
  if (mobileContainer) mobileContainer.innerHTML = "";

  // Helper para sincronizar estado activo
  function setActiveCategory(catId) {
    // 1. Sidebar
    Array.from(lista.querySelectorAll("li")).forEach(li => {
      if (li.dataset.category == catId) li.classList.add("active");
      else li.classList.remove("active");
    });

    // 2. Mobile Carousel
    if (mobileContainer) {
      Array.from(mobileContainer.querySelectorAll(".cat-item-mobile")).forEach(item => {
        if (item.dataset.category == catId) {
          item.classList.add("active");
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
          item.classList.remove("active");
        }
      });
    }

    // 3. Mostrar Sección
    if (catId === 'favoritos') {
      cargarComidasFavoritas();
    } else {
      const cat = categorias.find(c => c.id == catId);
      if (cat) {
        showSection('contenido-menu');
        cargarComidas(cat.id, cat.name);
      }
    }
  }

  // --- Opción Favoritos (Manual) ---
  const favLi = document.createElement("li");
  favLi.textContent = "⭐ Favoritos";
  favLi.dataset.category = "favoritos";
  favLi.style.cursor = "pointer";
  favLi.addEventListener("click", () => setActiveCategory('favoritos'));
  if (lista) lista.appendChild(favLi);

  if (mobileContainer) {
    const divFav = document.createElement("div");
    divFav.className = "cat-item-mobile";
    divFav.dataset.category = "favoritos";
    divFav.onclick = () => setActiveCategory('favoritos');
    divFav.innerHTML = `
        <div class="cat-img-wrapper" style="border-color: #ffd900;">
            <div class="cat-img-fallback">⭐</div>
        </div>
        <span class="cat-name-mobile">Favoritos</span>
      `;
    mobileContainer.appendChild(divFav);
  }

  // --- Categorías Desde API ---
  const destacadas = (categorias || []).filter(c => c && (c.is_featured === 1 || c.is_featured === '1' || c.is_featured === true));
  const normales = (categorias || []).filter(c => !(c && (c.is_featured === 1 || c.is_featured === '1' || c.is_featured === true)));
  const ordenadas = [...destacadas, ...normales];

  ordenadas.forEach(cat => {
    // 1. Sidebar Item
    const li = document.createElement("li");
    li.textContent = cat.name;
    li.dataset.category = cat.id;
    li.style.cursor = "pointer";

    if (cat.is_featured) {
      li.classList.add("category-featured");
      li.style.background = "#fff7e6";
      li.style.borderRadius = "6px";
      li.style.fontWeight = "600";
    }

    li.onclick = () => setActiveCategory(cat.id);
    lista.appendChild(li);

    // 2. Mobile Item
    if (mobileContainer) {
      const div = document.createElement("div");
      div.className = "cat-item-mobile";
      div.dataset.category = cat.id;
      div.onclick = () => setActiveCategory(cat.id);

      let imgHtml = "";
      if (cat.image_url) {
        imgHtml = `<img src="${cat.image_url}" alt="${cat.name}">`;
      } else {
        imgHtml = `<div class="cat-img-fallback">${cat.name.charAt(0).toUpperCase()}</div>`;
      }

      div.innerHTML = `
            <div class="cat-img-wrapper">
                ${imgHtml}
            </div>
            <span class="cat-name-mobile">${cat.name}</span>
        `;
      mobileContainer.appendChild(div);
    }
  });

  // Seleccionar la primera categoría por defecto
  if (ordenadas.length > 0) {
    setActiveCategory(ordenadas[0].id);
  } else {
    const contenedor = document.getElementById("lista-comidas");
    if (contenedor) contenedor.innerHTML = "<p>No hay categorías disponibles</p>";
  }
}

// ==============================
// Cargar comidas de una categoría
// ==============================
async function cargarComidas(categoriaId, nombreCategoria) {
  try {
    const res = await fetch(`${API_URL}/foods?category=${categoriaId}`);
    const comidas = await res.json();

    const contenedor = document.getElementById("lista-comidas");
    const titulo = document.querySelector("#contenido-menu h2");
    if (titulo && nombreCategoria) titulo.textContent = nombreCategoria;

    if (!contenedor) return;
    contenedor.innerHTML = "";

    (comidas || []).forEach(comida => {
      const primerTam = comida.sizes?.[0];
      const card = document.createElement("div");
      card.classList.add("comida-card");
      card.innerHTML = `
        <img src="${comida.image_url}" class="img-plate" alt="${escapeHtml(comida.name)}">
        <h3>${escapeHtml(comida.name)}</h3>
        <p class="card-tamano">${primerTam ? escapeHtml(primerTam.size_name) : "Único"}</p>
        <p class="card-precio"><span class="signo-dolar">$</span> ${primerTam ? Number(primerTam.price).toFixed(2) : "N/D"}</p>
      `;
      card.addEventListener("click", () => abrirDetalle(comida, comidas));
      contenedor.appendChild(card);
    });
  } catch (err) {
    console.error("Error cargando comidas:", err);
  }
}

// ==============================
// Cargar comidas destacadas
// ==============================
async function cargarComidasFavoritas() {
  try {
    const res = await fetch(`${API_URL}/foods`);
    const comidas = await res.json();
    const contenedor = document.getElementById("lista-destacados");
    const titulo = document.querySelector("#section-destacados .tilt-cont-dina");
    if (titulo) titulo.textContent = "Destacados";

    const filtradas = (comidas || []).filter(f => {
      return f && (f.is_featured === 1 || f.is_featured === '1' || f.is_featured === true);
    });

    if (!contenedor) return;
    if (!filtradas.length) {
      contenedor.innerHTML = "<p>No hay comidas destacadas.</p>";
      showSection('section-destacados');
      return;
    }
    contenedor.innerHTML = "";
    filtradas.forEach(comida => {
      const primerTam = comida.sizes?.[0];
      const card = document.createElement("div");
      card.classList.add("comida-card");
      card.innerHTML = `
        <img src="${comida.image_url}" class="img-plate" alt="${escapeHtml(comida.name)}">
        <h3>${escapeHtml(comida.name)}</h3>
        <p class="card-tamano">${primerTam ? escapeHtml(primerTam.size_name) : "Único"}</p>
        <p class="card-precio"><span class="signo-dolar">$</span> ${primerTam ? Number(primerTam.price).toFixed(2) : "N/D"}</p>
      `;
      card.addEventListener("click", () => abrirDetalle(comida, filtradas));
      contenedor.appendChild(card);
    });
    showSection('section-destacados');
  } catch (err) {
    console.error("Error cargando destacados:", err);
  }
}

// ==============================
// Detalle / modal / carrusel
// ==============================
const detalle = document.getElementById("detalle-comida");
const detalleImg = document.getElementById("detalle-img");
const detalleNombre = document.getElementById("detalle-nombre");
const detalleDescripcion = document.getElementById("detalle-descripcion");
const carrusel = document.getElementById("carrusel");
const cerrarBtn = document.getElementById("cerrar-detalle");
const carouselContainer = document.querySelector(".detalle-carrusel");
const nextBtn = document.getElementById("next-btn");
const prevBtn = document.getElementById("prev-btn");
let carruselOffset = 0;

function abrirDetalle(comida, comidas) {
  if (detalleImg) detalleImg.src = "" + comida.image_url;
  if (detalleNombre) {
    detalleNombre.textContent = comida.name;
    detalleNombre.dataset.id = comida.id;
  }
  if (detalleDescripcion) detalleDescripcion.textContent = comida.description || "Sin descripción";

  const listaTamanos = document.getElementById("detalle-tamanos");
  const extrasContainerGlobal = document.getElementById("detalle-extras");
  if (listaTamanos) listaTamanos.innerHTML = "";
  if (extrasContainerGlobal) extrasContainerGlobal.innerHTML = "";

  if (Array.isArray(comida.sizes) && comida.sizes.length) {
    comida.sizes.forEach((size, index) => {
      const idRadio = `tamano-${comida.id}-${size.id || index}`;
      const label = document.createElement("label");
      label.style.display = "block";
      label.innerHTML = `
        <input type="radio" name="tamano" id="${idRadio}" value="${size.size_name}"
               data-price="${size.price}" data-calorias="${size.calories}" data-size-id="${size.id || ""}"
               ${index === 0 ? "checked" : ""}>
        <span>${size.size_name} - ${size.calories || 0} kcal - <span class="signo-dolar">$</span>${parseFloat(size.price || 0).toFixed(2)}</span>
      `;
      if (listaTamanos) listaTamanos.appendChild(label);
      if (index === 0) renderExtrasForSize(size);
    });

    if (listaTamanos) {
      listaTamanos.querySelectorAll('input[name="tamano"]').forEach(r => {
        r.addEventListener('change', () => {
          const sizeId = Number(r.dataset.sizeId || 0);
          const size = (comida.sizes || []).find(s => Number(s.id) === sizeId) || (comida.sizes || [])[0];
          renderExtrasForSize(size);
        });
      });
    }
  } else {
    if (listaTamanos) {
      const li = document.createElement("li");
      li.textContent = "Único tamaño";
      listaTamanos.appendChild(li);
    }
    if (comida.sizes && comida.sizes[0] && comida.sizes[0].extras) {
      renderExtrasForSize(comida.sizes[0]);
    } else if (extrasContainerGlobal) {
      extrasContainerGlobal.innerHTML = "<p>No hay extras para este producto</p>";
    }
  }

  function renderExtrasForSize(size) {
    const extrasContainer = document.getElementById("detalle-extras");
    if (!extrasContainer) return;
    extrasContainer.innerHTML = "";
    const extras = Array.isArray(size?.extras) ? size.extras : [];
    if (extras.length === 0) {
      extrasContainer.innerHTML = "<p>No hay extras disponibles</p>";
      return;
    }
    extras.forEach(ex => {
      const id = `detalle-extra-${ex.id}`;
      const wrapper = document.createElement("label");
      wrapper.style.display = "block";
      wrapper.style.marginBottom = "6px";
      wrapper.innerHTML = `
        <input type="checkbox" class="detalle-extra-checkbox" id="${id}" value="${ex.id}" data-price="${ex.price}" data-name="${escapeHtml(ex.name)}">
        ${escapeHtml(ex.name)} ($${Number(ex.price).toFixed(2)})
      `;
      extrasContainer.appendChild(wrapper);
    });
  }

  if (detalle) {
    detalle.classList.remove("hidden");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");
  }

  requestAnimationFrame(() => {
    posicionarCarouselAlrededorImagen();
    const imgs = Array.from(carrusel.querySelectorAll("img"));
    if (imgs.length === 0) { distribuirEnCirculo(); return; }
    let loaded = 0;
    imgs.forEach(im => {
      if (im.complete) loaded++;
      else {
        im.onload = () => { loaded++; if (loaded === imgs.length) distribuirEnCirculo(); };
        im.onerror = () => { loaded++; if (loaded === imgs.length) distribuirEnCirculo(); };
      }
    });
    if (loaded === imgs.length) distribuirEnCirculo();
  });

  const other = (comidas || []).filter(c => c.id !== comida.id);
  carrusel.innerHTML = "";
  other.forEach((c) => {
    const item = document.createElement("img");
    item.src = "" + c.image_url;
    item.alt = c.name;
    item.className = "carrusel-item";
    item.style.position = "absolute";
    item.style.left = "50%";
    item.style.top = "50%";
    item.style.transform = "translate(-50%,-50%) scale(0.6)";
    item.style.opacity = 0;
    item.style.pointerEvents = "none";
    item.addEventListener("click", () => abrirDetalle(c, comidas));
    carrusel.appendChild(item);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function posicionarCarouselAlrededorImagen() {
  if (!carouselContainer || !detalleImg) return;
  const overlayRect = detalle.getBoundingClientRect();
  const imgRect = detalleImg.getBoundingClientRect();
  const centerX = imgRect.left + imgRect.width / 2 - overlayRect.left;
  const centerY = imgRect.top + imgRect.height / 2 - overlayRect.top;
  const diameter = Math.max(imgRect.width * 1.4, 220);

  carouselContainer.style.width = `${Math.round(diameter)}px`;
  carouselContainer.style.height = `${Math.round(diameter)}px`;
  carouselContainer.style.left = `${Math.round(centerX)}px`;
  carouselContainer.style.top = `${Math.round(centerY)}px`;
  carouselContainer.style.transform = "translate(-50%, -50%)";
  carouselContainer.style.pointerEvents = "none";
  carouselContainer.style.zIndex = 2050;
}

function distribuirEnCirculo() {
  const items = document.querySelectorAll("#carrusel img");
  const total = items.length;
  if (total === 0 || !carouselContainer) return;

  const containerRect = carouselContainer.getBoundingClientRect();
  const radius = Math.max((Math.min(containerRect.width, containerRect.height) / 2) - 45, 60);
  const arc = Math.PI * 0.9;
  const startAngle = -arc / 2;
  const step = (total > 1) ? (arc / (total - 1)) : 0;
  const visibleThreshold = 0.02;
  const maxVisible = 4;

  const arr = Array.from(items).map((item, originalIndex) => {
    const i = (originalIndex + carruselOffset + total) % total;
    const angle = startAngle + i * step;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const depth = Math.cos(angle);
    const distance = Math.abs(angle);
    return { item, angle, x, y, depth, distance };
  });

  const candidates = arr.filter(a => a.depth > visibleThreshold);
  candidates.sort((a, b) => a.distance - b.distance);
  const visibles = candidates.slice(0, Math.min(maxVisible, candidates.length));
  const visibleSet = new Set(visibles.map(v => v.item));

  arr.forEach(a => {
    const el = a.item;
    el.style.left = "50%";
    el.style.top = "50%";
    el.style.transition = "transform 0.3s ease, opacity 0.3s ease";
    if (visibleSet.has(el)) {
      const scale = 0.65 + Math.max(0, a.depth) * 0.35;
      el.style.opacity = 1;
      el.style.pointerEvents = "auto";
      el.style.transform = `translate(-50%,-50%) translate(${Math.round(a.x)}px, ${Math.round(a.y)}px) scale(${scale})`;
      el.style.zIndex = 100 + Math.round(a.depth * 100);
    } else {
      el.style.opacity = 0;
      el.style.pointerEvents = "none";
      el.style.transform = `translate(-50%,-50%) translate(${Math.round(a.x)}px, ${Math.round(a.y)}px) scale(0.55)`;
      el.style.zIndex = 0;
    }
  });
}

if (nextBtn) nextBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const items = document.querySelectorAll(".carrusel-items img");
  if (!items.length) return;
  carruselOffset = (carruselOffset + 1) % items.length;
  distribuirEnCirculo();
});

if (prevBtn) prevBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const items = document.querySelectorAll(".carrusel-items img");
  if (!items.length) return;
  carruselOffset = (carruselOffset - 1 + items.length) % items.length;
  distribuirEnCirculo();
});

if (cerrarBtn) cerrarBtn.addEventListener("click", () => {
  if (detalle) {
    detalle.classList.add("hidden");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.classList.remove("modal-open");
  }
});

// ==============================
// SELECTORES cantidad & agregar al carrito
// ==============================
const btnAgregarCarrito = document.getElementById("btn-agregar-carrito");
const inputCantidad = document.getElementById("cantidad");
const btnMas = document.getElementById("cantidad-mas");
const btnMenos = document.getElementById("cantidad-menos");

if (btnMas && btnMenos && inputCantidad) {
  btnMas.addEventListener("click", () => {
    inputCantidad.value = parseInt(inputCantidad.value) + 1;
  });
  btnMenos.addEventListener("click", () => {
    if (parseInt(inputCantidad.value) > 1) {
      inputCantidad.value = parseInt(inputCantidad.value) - 1;
    }
  });
}

// Botón Agregar al carrito -> AHORA USA EL MODULO GLOBAL (carrito-modal.js)
if (btnAgregarCarrito) {
  btnAgregarCarrito.addEventListener("click", () => {
    // Verificar que la función global exista
    if (typeof window.agregarAlCarrito !== 'function') {
      alert("Error crítico: No se cargó el módulo del carrito.");
      return;
    }

    const seleccionado = document.querySelector('input[name="tamano"]:checked');
    if (!seleccionado) { alert("Selecciona un tamaño antes de continuar"); return; }

    // Captura de datos
    const cantidad = Number(inputCantidad.value) || 1;
    const sizeId = Number(seleccionado.dataset.sizeId || 0);
    const unitPrice = Number(seleccionado.dataset.price || 0);
    const extrasSelected = Array.from(document.querySelectorAll(".detalle-extra-checkbox:checked"))
      .map(cb => ({
        id: Number(cb.value),
        name: cb.dataset.name || cb.parentElement?.textContent?.trim() || String(cb.value),
        price: Number(cb.dataset.price || 0)
      }));

    const extrasIds = extrasSelected.map(e => e.id);
    const extrasTotal = extrasSelected.reduce((s, e) => s + (Number(e.price) || 0), 0);

    const pedido = {
      food_id: Number(detalleNombre.dataset.id || 0),
      nombre: detalleNombre.textContent || "",
      tamano: seleccionado.value,
      size_id: sizeId,
      extras: extrasIds,
      extras_detail: extrasSelected,
      quantity: cantidad,
      unit_price: unitPrice,
      subtotal: cantidad * (unitPrice + extrasTotal),
      img: detalleImg ? detalleImg.src : ""
    };

    // Llamada a función global del otro script
    window.agregarAlCarrito(pedido);
    alert("Agregado al carrito ✅");

    if (detalle) {
      detalle.classList.add("hidden");
      document.body.classList.remove("modal-open");
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      const header = document.querySelector('header');
      if (header) header.classList.remove('header-hidden');
    }
  });
}

// Inicializar carga de categorías
cargarCategorias();

// Variable de fallback si se necesita en otros sitios (pero no debería)
// window.mostrarFactura ahora está en carrito-modal.js
