document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // App State
    let comidas = [];
    let programa = {};
    let config = {};

    // Días y momentos estándar
    const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
    const COMENSALES = ["Vito", "Rochi", "Berni", "Mamá", "Papá"];
    const UNIDADES = ["gramos", "ml", "unidad", "unidades", "taza", "tazas", "cucharada", "cucharadas", "diente", "dientes", "pizca", "paquete", "lata"];

    // DOM Elements - Main Layout
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // DOM Elements - Recetario Pestaña
    const comidasList = document.getElementById('comidasList');
    const searchComidas = document.getElementById('searchComidas');
    const btnOpenAddModal = document.getElementById('btnOpenAddModal');

    // DOM Elements - Planificación Pestaña
    const programWeek = document.getElementById('programWeek');
    const btnSavePrograma = document.getElementById('btnSavePrograma');

    // DOM Elements - Lista de Compras Pestaña
    const compraCard = document.getElementById('compraCard');
    const btnCopyCompra = document.getElementById('btnCopyCompra');
    const btnPrintCompra = document.getElementById('btnPrintCompra');

    // DOM Elements - Modal Comida
    const comidaModal = document.getElementById('comidaModal');
    const btnCloseComidaModal = document.getElementById('btnCloseComidaModal');
    const comidaModalOverlay = document.getElementById('comidaModalOverlay');
    const btnCancelComida = document.getElementById('btnCancelComida');
    const formComida = document.getElementById('formComida');
    const modalTitle = document.getElementById('modalTitle');
    
    const inputComidaId = document.getElementById('comidaId');
    const inputComidaNombre = document.getElementById('comidaNombre');
    const textareaComidaReceta = document.getElementById('comidaReceta');
    const ingredientsListContainer = document.getElementById('ingredientsListContainer');
    const btnAddIngredientRow = document.getElementById('btnAddIngredientRow');
    const btnIaGen = document.getElementById('btnIaGen');
    const iaStatus = document.getElementById('iaStatus');
    const iaStatusText = document.getElementById('iaStatusText');

    // DOM Elements - Ajustes Sidebar
    const btnSettings = document.getElementById('btnSettings');
    const settingsSidebar = document.getElementById('settingsSidebar');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const formSettings = document.getElementById('formSettings');
    const inputGeminiKey = document.getElementById('setGeminiKey');
    const btnToggleKey = document.getElementById('btnToggleKey');

    // DOM Elements - Toast
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    /* -------------------------------------------------------------
       Inicialización y Carga de Datos
       ------------------------------------------------------------- */
    async function initApp() {
        showLoadingState();
        await fetchConfig();
        await fetchComidas();
        await fetchPrograma();
        renderComidas();
        renderPlanificador();
    }

    // Mostrar alerta Toast flotante
    function showToast(message, type = 'info') {
        toast.className = `toast ${type}`;
        toastMessage.textContent = message;
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check-circle';
        if (type === 'error') iconName = 'alert-triangle';
        
        toastIcon.setAttribute('data-lucide', iconName);
        lucide.createIcons();
        
        toast.classList.remove('hidden');
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    // Obtener la configuración del servidor
    async function fetchConfig() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                config = await response.json();
                inputGeminiKey.value = config.gemini_api_key || "";
            }
        } catch (e) {
            console.error("Error al cargar configuración", e);
        }
    }

    // Obtener todas las comidas del servidor
    async function fetchComidas() {
        try {
            const response = await fetch('/api/comidas');
            if (response.ok) {
                comidas = await response.json();
            } else {
                showToast("Error al obtener las comidas", "error");
            }
        } catch (e) {
            showToast("No se pudo conectar con el servidor", "error");
            console.error(e);
        }
    }

    // Obtener la planificación semanal
    async function fetchPrograma() {
        try {
            const response = await fetch('/api/programa');
            if (response.ok) {
                programa = await response.json();
            } else {
                showToast("Error al obtener la planificación", "error");
            }
        } catch (e) {
            console.error(e);
        }
    }

    // Estado cargando en comidas
    function showLoadingState() {
        comidasList.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando comidas familiares...</p>
            </div>
        `;
    }

    /* -------------------------------------------------------------
       Tab Navigation
       ------------------------------------------------------------- */
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Toggle active buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle active content views
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });

            // Specific tab init actions
            if (tabId === 'tab-compra') {
                generarListaCompra();
            } else if (tabId === 'tab-programa') {
                // Refresh planificador inputs in case comidas list changed
                renderPlanificador();
            } else if (tabId === 'tab-comidas') {
                renderComidas();
            }
        });
    });

    /* -------------------------------------------------------------
       Pestaña 1: COMIDAS (Recetario & CRUD)
       ------------------------------------------------------------- */
    
    // Filtrar comidas en barra de búsqueda
    searchComidas.addEventListener('input', () => {
        renderComidas();
    });

    // Renderizar la grilla de comidas
    function renderComidas() {
        const query = searchComidas.value.toLowerCase().trim();
        comidasList.innerHTML = "";
        
        const filteredComidas = comidas.filter(comida => {
            const matchName = comida.nombre.toLowerCase().includes(query);
            const matchIngredient = comida.ingredientes && comida.ingredientes.some(
                ing => ing.nombre.toLowerCase().includes(query)
            );
            return matchName || matchIngredient;
        });

        if (filteredComidas.length === 0) {
            comidasList.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="utensils-cross-keys" class="empty-icon"></i>
                    <h3>No se encontraron platos</h3>
                    <p>${query ? 'Prueba con otro término de búsqueda.' : 'Crea tu primer comida familiar haciendo clic en "Agregar Comida".'}</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        filteredComidas.forEach(comida => {
            const card = document.createElement('div');
            card.className = "card-comida";
            card.dataset.id = comida.id;

            // Header of card
            const header = document.createElement('div');
            header.className = "card-title-row";
            
            const title = document.createElement('h3');
            title.textContent = comida.nombre;
            header.appendChild(title);

            // Action buttons
            const actions = document.createElement('div');
            actions.className = "card-actions";
            
            const btnEdit = document.createElement('button');
            btnEdit.className = "btn-card-action";
            btnEdit.title = "Editar";
            btnEdit.innerHTML = `<i data-lucide="edit-3"></i>`;
            btnEdit.addEventListener('click', () => openComidaModal(comida));
            
            const btnDelete = document.createElement('button');
            btnDelete.className = "btn-card-action delete";
            btnDelete.title = "Eliminar";
            btnDelete.innerHTML = `<i data-lucide="trash-2"></i>`;
            btnDelete.addEventListener('click', () => deleteComidaHandler(comida));

            actions.appendChild(btnEdit);
            actions.appendChild(btnDelete);
            header.appendChild(actions);
            card.appendChild(header);

            // Ingredients list (visual tags)
            if (comida.ingredientes && comida.ingredientes.length > 0) {
                const ingContainer = document.createElement('div');
                ingContainer.className = "card-ingredients";
                comida.ingredientes.slice(0, 5).forEach(ing => {
                    const pill = document.createElement('span');
                    pill.className = "ing-pill";
                    pill.textContent = `${ing.nombre} (${ing.cantidad} ${ing.unidad})`;
                    ingContainer.appendChild(pill);
                });
                if (comida.ingredientes.length > 5) {
                    const extraPill = document.createElement('span');
                    extraPill.className = "ing-pill";
                    extraPill.textContent = `+${comida.ingredientes.length - 5} más`;
                    ingContainer.appendChild(extraPill);
                }
                card.appendChild(ingContainer);
            }

            // Recipe instructions collapsible section
            if (comida.receta) {
                const collapsible = document.createElement('div');
                collapsible.className = "recipe-collapsible";
                
                const btnToggle = document.createElement('button');
                btnToggle.className = "btn-toggle-recipe";
                btnToggle.innerHTML = `<span>Ver receta</span> <i data-lucide="chevron-down"></i>`;
                
                const recipeText = document.createElement('div');
                recipeText.className = "recipe-text-content hidden-height";
                recipeText.textContent = comida.receta;

                btnToggle.addEventListener('click', () => {
                    btnToggle.classList.toggle('active');
                    recipeText.classList.toggle('hidden-height');
                    const isExpanded = !recipeText.classList.contains('hidden-height');
                    btnToggle.querySelector('span').textContent = isExpanded ? "Ocultar receta" : "Ver receta";
                });

                collapsible.appendChild(btnToggle);
                collapsible.appendChild(recipeText);
                card.appendChild(collapsible);
            }

            comidasList.appendChild(card);
        });

        lucide.createIcons();
    }

    // Modal de comidas - Controladores de Apertura y Cierre
    btnOpenAddModal.addEventListener('click', () => openComidaModal());
    btnCloseComidaModal.addEventListener('click', closeComidaModal);
    comidaModalOverlay.addEventListener('click', closeComidaModal);
    btnCancelComida.addEventListener('click', closeComidaModal);

    function openComidaModal(comida = null) {
        formComida.reset();
        ingredientsListContainer.innerHTML = "";
        
        if (comida) {
            // Edit Mode
            modalTitle.textContent = "Editar Comida";
            inputComidaId.value = comida.id;
            inputComidaNombre.value = comida.nombre;
            textareaComidaReceta.value = comida.receta || "";
            
            if (comida.ingredientes && comida.ingredientes.length > 0) {
                comida.ingredientes.forEach(ing => {
                    addIngredientRow(ing.nombre, ing.cantidad, ing.unidad);
                });
            } else {
                addIngredientRow();
            }
        } else {
            // Creation Mode
            modalTitle.textContent = "Agregar Nueva Comida";
            inputComidaId.value = "";
            addIngredientRow();
        }
        
        comidaModal.classList.add('open');
        inputComidaNombre.focus();
        lucide.createIcons();
    }

    function closeComidaModal() {
        comidaModal.classList.remove('open');
    }

    // Manejar filas de ingredientes en el Form
    btnAddIngredientRow.addEventListener('click', () => {
        addIngredientRow();
    });

    function addIngredientRow(nombre = "", cantidad = 1, unidad = "gramos") {
        const row = document.createElement('div');
        row.className = "ingredient-row";

        const inputNombre = document.createElement('input');
        inputNombre.type = "text";
        inputNombre.placeholder = "Ingrediente (ej. Pollo)";
        inputNombre.required = true;
        inputNombre.value = nombre;

        const inputQty = document.createElement('input');
        inputQty.type = "number";
        inputQty.min = "0.01";
        inputQty.step = "any";
        inputQty.placeholder = "Cant.";
        inputQty.required = true;
        inputQty.value = cantidad;

        const selectUnit = document.createElement('select');
        UNIDADES.forEach(unit => {
            const opt = document.createElement('option');
            opt.value = unit;
            opt.textContent = unit;
            if (unit === unidad) opt.selected = true;
            selectUnit.appendChild(opt);
        });

        const btnDelete = document.createElement('button');
        btnDelete.type = "button";
        btnDelete.className = "btn-delete-row";
        btnDelete.innerHTML = `<i data-lucide="trash-2"></i>`;
        btnDelete.addEventListener('click', () => {
            row.remove();
        });

        row.appendChild(inputNombre);
        row.appendChild(inputQty);
        row.appendChild(selectUnit);
        row.appendChild(btnDelete);
        ingredientsListContainer.appendChild(row);
        
        lucide.createIcons();
    }

    // Enviar formulario de comida (Guardar / Actualizar)
    formComida.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = inputComidaId.value;
        const nombre = inputComidaNombre.value.trim();
        const receta = textareaComidaReceta.value.trim();
        
        // Recopilar ingredientes de las filas
        const ingredientes = [];
        const rows = ingredientsListContainer.querySelectorAll('.ingredient-row');
        rows.forEach(row => {
            const inputs = row.querySelectorAll('input, select');
            const ingNombre = inputs[0].value.trim();
            const ingQty = parseFloat(inputs[1].value);
            const ingUnit = inputs[2].value;
            
            if (ingNombre) {
                ingredientes.push({
                    nombre: ingNombre,
                    cantidad: ingQty,
                    unidad: ingUnit
                });
            }
        });

        const payload = {
            nombre,
            receta,
            ingredientes
        };

        try {
            let response;
            if (id) {
                // Editar existente
                response = await fetch(`/api/comidas/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // Crear nueva
                response = await fetch('/api/comidas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const result = await response.json();

            if (response.ok) {
                showToast(id ? "Comida actualizada" : "Comida creada con éxito", "success");
                closeComidaModal();
                await fetchComidas();
                renderComidas();
            } else {
                showToast(result.error || "Error al guardar el plato", "error");
            }
        } catch (e) {
            showToast("Error de conexión", "error");
            console.error(e);
        }
    });

    // Eliminar comida
    async function deleteComidaHandler(comida) {
        if (confirm(`¿Estás seguro de que deseas eliminar "${comida.nombre}"? Se quitará de la planificación también.`)) {
            try {
                const response = await fetch(`/api/comidas/${comida.id}`, {
                    method: 'DELETE'
                });
                const result = await response.json();
                
                if (response.ok) {
                    showToast("Comida eliminada", "success");
                    await fetchComidas();
                    await fetchPrograma();
                    renderComidas();
                } else {
                    showToast(result.error || "No se pudo eliminar", "error");
                }
            } catch (e) {
                showToast("Error de conexión", "error");
                console.error(e);
            }
        }
    }

    // Integración de IA: Buscar receta con Gemini
    btnIaGen.addEventListener('click', async () => {
        const nombre = inputComidaNombre.value.trim();
        if (!nombre) {
            showToast("Escribe primero el nombre del plato para buscar la receta", "info");
            inputComidaNombre.focus();
            return;
        }

        // Bloquear UI de carga
        btnIaGen.disabled = true;
        iaStatus.classList.remove('hidden');
        iaStatusText.textContent = "Gemini cocinando receta...";

        try {
            const response = await fetch('/api/buscar-receta-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre })
            });
            const result = await response.json();

            if (response.ok) {
                // Populate Receta
                textareaComidaReceta.value = result.receta || "";
                
                // Clear and Populate Ingredientes
                ingredientsListContainer.innerHTML = "";
                if (result.ingredientes && result.ingredientes.length > 0) {
                    result.ingredientes.forEach(ing => {
                        // Check if unit is accepted or use generic default
                        let cleanUnit = ing.unidad.toLowerCase().trim();
                        if (!UNIDADES.includes(cleanUnit)) {
                            if (cleanUnit.includes("gramo")) cleanUnit = "gramos";
                            else if (cleanUnit.includes("unidad")) cleanUnit = "unidad";
                            else if (cleanUnit.includes("ml") || cleanUnit.includes("mili")) cleanUnit = "ml";
                            else if (cleanUnit.includes("taza")) cleanUnit = "tazas";
                            else if (cleanUnit.includes("cuchara")) cleanUnit = "cucharadas";
                            else cleanUnit = "unidad"; // fallback
                        }
                        addIngredientRow(ing.nombre, ing.cantidad, cleanUnit);
                    });
                } else {
                    addIngredientRow();
                }
                showToast("Receta e ingredientes importados por Gemini", "success");
            } else {
                showToast(result.error || "Error al obtener receta con IA", "error");
            }
        } catch (e) {
            showToast("Error al contactar al servidor", "error");
            console.error(e);
        } finally {
            btnIaGen.disabled = false;
            iaStatus.classList.add('hidden');
        }
    });


    /* -------------------------------------------------------------
       Pestaña 2: PLANIFICADOR (Menú Semanal)
       ------------------------------------------------------------- */
    
    // Generar el grid interactivo de planificación semanal
    function renderPlanificador() {
        programWeek.innerHTML = "";

        DIAS.forEach(dia => {
            const dayCard = document.createElement('div');
            dayCard.className = "day-card";
            
            const title = document.createElement('div');
            title.className = "day-title";
            title.textContent = dia;
            dayCard.appendChild(title);

            const mealsContainer = document.createElement('div');
            mealsContainer.className = "meal-block-container";

            // Almuerzo & Cena
            ["Almuerzo", "Cena"].forEach(momento => {
                const mealBlock = document.createElement('div');
                mealBlock.className = `meal-block ${momento.toLowerCase()}`;

                const mHeader = document.createElement('div');
                mHeader.className = "meal-header";
                
                const icon = momento === "Almuerzo" ? "sun" : "moon";
                mHeader.innerHTML = `<i data-lucide="${icon}"></i> <span>${momento}</span>`;
                mealBlock.appendChild(mHeader);

                // Select de comidas
                const select = document.createElement('select');
                select.className = "select-comida";
                select.dataset.dia = dia;
                select.dataset.momento = momento;

                // Opción vacía
                const optEmpty = document.createElement('option');
                optEmpty.value = "";
                optEmpty.textContent = "— Seleccionar Comida —";
                select.appendChild(optEmpty);

                // Llenar select con comidas disponibles
                comidas.forEach(comida => {
                    const opt = document.createElement('option');
                    opt.value = comida.id;
                    opt.textContent = comida.nombre;
                    
                    // Marcar seleccionada
                    if (programa[dia] && programa[dia][momento] && programa[dia][momento].comida_id === comida.id) {
                        opt.selected = true;
                    }
                    select.appendChild(opt);
                });
                mealBlock.appendChild(select);

                // Fila de comensales
                const comTitle = document.createElement('div');
                comTitle.className = "comensales-title";
                comTitle.textContent = "Comensales:";
                mealBlock.appendChild(comTitle);

                const comRow = document.createElement('div');
                comRow.className = "comensales-row";

                COMENSALES.forEach(comensal => {
                    const uniqueId = `cb-${dia}-${momento}-${comensal}`.replace(/\s+/g, '-').toLowerCase();
                    
                    const cb = document.createElement('input');
                    cb.type = "checkbox";
                    cb.className = "comensal-checkbox-input";
                    cb.id = uniqueId;
                    cb.dataset.dia = dia;
                    cb.dataset.momento = momento;
                    cb.dataset.comensal = comensal;

                    // Marcar presencia si está configurado en el estado
                    if (programa[dia] && programa[dia][momento] && 
                        programa[dia][momento].comensales && 
                        programa[dia][momento].comensales[comensal] === true) {
                        cb.checked = true;
                    }

                    const label = document.createElement('label');
                    label.className = "comensal-checkbox-label";
                    label.htmlFor = uniqueId;
                    // Initial letter
                    label.textContent = comensal.charAt(0);
                    label.title = comensal;

                    comRow.appendChild(cb);
                    comRow.appendChild(label);
                });

                mealBlock.appendChild(comRow);
                mealsContainer.appendChild(mealBlock);
            });

            dayCard.appendChild(mealsContainer);
            programWeek.appendChild(dayCard);
        });

        lucide.createIcons();
    }

    // Guardar cambios en el menú semanal (Programa)
    btnSavePrograma.addEventListener('click', async () => {
        const payload = {};
        
        DIAS.forEach(dia => {
            payload[dia] = {
                "Almuerzo": { "comida_id": "", "comensales": {} },
                "Cena": { "comida_id": "", "comensales": {} }
            };
        });

        // Leer todos los selectores de comidas
        const selects = programWeek.querySelectorAll('.select-comida');
        selects.forEach(select => {
            const dia = select.dataset.dia;
            const momento = select.dataset.momento;
            payload[dia][momento].comida_id = select.value;
        });

        // Leer todos los checkboxes de comensales
        const checkboxes = programWeek.querySelectorAll('.comensal-checkbox-input');
        checkboxes.forEach(cb => {
            const dia = cb.dataset.dia;
            const momento = cb.dataset.momento;
            const comensal = cb.dataset.comensal;
            payload[dia][momento].comensales[comensal] = cb.checked;
        });

        btnSavePrograma.disabled = true;

        try {
            const response = await fetch('/api/programa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (response.ok) {
                showToast("Menú semanal guardado", "success");
                programa = result.programa;
            } else {
                showToast(result.error || "No se pudo guardar el menú semanal", "error");
            }
        } catch (e) {
            showToast("Error al guardar el menú", "error");
            console.error(e);
        } finally {
            btnSavePrograma.disabled = false;
        }
    });

    /* -------------------------------------------------------------
       Pestaña 3: LISTA DE COMPRAS (MRP)
       ------------------------------------------------------------- */
    let currentListaCompra = [];

    async function generarListaCompra() {
        compraCard.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Calculando requerimientos (MRP)...</p>
            </div>
        `;
        btnCopyCompra.disabled = true;
        btnPrintCompra.disabled = true;

        try {
            const response = await fetch('/api/lista-compra');
            const result = await response.json();

            if (response.ok) {
                currentListaCompra = result.lista_compra || [];
                renderListaCompra();
            } else {
                compraCard.innerHTML = `<div class="empty-state"><p>Error al calcular: ${result.error}</p></div>`;
            }
        } catch (e) {
            compraCard.innerHTML = `<div class="empty-state"><p>Error de red al calcular lista.</p></div>`;
            console.error(e);
        }
    }

    function renderListaCompra() {
        if (currentListaCompra.length === 0) {
            compraCard.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="shopping-basket" class="empty-icon"></i>
                    <h3>Lista vacía</h3>
                    <p>No hay platos con comensales asignados en el menú semanal. Selecciona platos y marca comensales activos para generar compras.</p>
                </div>
            `;
            btnCopyCompra.disabled = true;
            btnPrintCompra.disabled = true;
            lucide.createIcons();
            return;
        }

        btnCopyCompra.disabled = false;
        btnPrintCompra.disabled = false;

        const ul = document.createElement('ul');
        ul.className = "compra-list";

        currentListaCompra.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = "compra-item";
            
            const cb = document.createElement('input');
            cb.type = "checkbox";
            cb.className = "compra-item-checkbox";
            cb.id = `item-${index}`;

            const label = document.createElement('span');
            label.className = "compra-item-text";
            label.textContent = item.nombre;

            const qty = document.createElement('span');
            qty.className = "compra-item-qty";
            qty.textContent = `${item.cantidad} ${item.unidad}`;

            // Add events for crossing out items locally
            li.addEventListener('click', (e) => {
                if (e.target !== cb) {
                    cb.checked = !cb.checked;
                }
                li.classList.toggle('checked', cb.checked);
            });

            cb.addEventListener('change', () => {
                li.classList.toggle('checked', cb.checked);
            });

            li.appendChild(cb);
            li.appendChild(label);
            li.appendChild(qty);
            ul.appendChild(li);
        });

        compraCard.innerHTML = "";
        compraCard.appendChild(ul);
    }

    // Copiar lista consolidada para enviar por WhatsApp
    btnCopyCompra.addEventListener('click', () => {
        if (currentListaCompra.length === 0) return;

        let text = "🛒 *LISTA DE COMPRAS FAMILIARES* 🛒\n\n*Ingredientes necesarios para la semana:*\n";
        currentListaCompra.forEach(item => {
            text += `• *${item.nombre}*: ${item.cantidad} ${item.unidad}\n`;
        });
        text += "\n_Generado automáticamente por la App Comidas Daosrl_";

        navigator.clipboard.writeText(text).then(() => {
            showToast("Lista copiada al portapapeles. ¡Listo para enviar por WhatsApp!", "success");
        }).catch(err => {
            showToast("No se pudo copiar de manera automática.", "error");
            console.error("Error al copiar texto: ", err);
        });
    });

    // Imprimir lista de compras
    btnPrintCompra.addEventListener('click', () => {
        window.print();
    });


    /* -------------------------------------------------------------
       Ajustes / Configuración Sidebar
       ------------------------------------------------------------- */
    btnSettings.addEventListener('click', openSettings);
    btnCloseSettings.addEventListener('click', closeSettings);
    sidebarOverlay.addEventListener('click', closeSettings);

    function openSettings() {
        settingsSidebar.classList.add('open');
    }

    function closeSettings() {
        settingsSidebar.classList.remove('open');
    }

    // Toggle password visibility para la API Key
    btnToggleKey.addEventListener('click', () => {
        const type = inputGeminiKey.type === 'password' ? 'text' : 'password';
        inputGeminiKey.type = type;
        btnToggleKey.innerHTML = `<i data-lucide="${type === 'password' ? 'eye' : 'eye-off'}"></i>`;
        lucide.createIcons();
    });

    // Guardar ajustes en la base
    formSettings.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const gemini_api_key = inputGeminiKey.value.trim();

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gemini_api_key })
            });
            const result = await response.json();

            if (response.ok) {
                showToast("Configuración guardada", "success");
                config.gemini_api_key = gemini_api_key;
                closeSettings();
            } else {
                showToast(result.error || "No se pudo guardar la clave", "error");
            }
        } catch (e) {
            showToast("Error de conexión al guardar ajustes", "error");
            console.error(e);
        }
    });

    // Empezar la App
    initApp();
});
