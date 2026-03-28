/*
========================================
APP.JS - LÓGICA PRINCIPAL 2026
Soporte para autenticación con nombre de usuario,
gestión de reseñas y reservas con Supabase
========================================
*/

// ------------------- CONFIGURACIÓN INICIAL -------------------
let currentUser = null;
let currentUsername = null;
let selectedRating = 0;

// Verificar si Supabase está disponible
function isSupabaseAvailable() {
    return window.supabase && typeof window.supabase.from === 'function';
}

// ------------------- MENÚ MÓVIL -------------------
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
        const isActive = navLinks.classList.toggle('active');
        menuToggle.setAttribute('aria-expanded', isActive);
        
        const spans = menuToggle.querySelectorAll('span');
        if (isActive) {
            spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
        } else {
            spans.forEach(span => span.style.transform = 'none');
            spans[1].style.opacity = '1';
        }
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            const spans = menuToggle.querySelectorAll('span');
            spans.forEach(span => span.style.transform = 'none');
            spans[1].style.opacity = '1';
        });
    });
}

// ------------------- MODAL DE AUTENTICACIÓN -------------------
const authModal = document.getElementById('authModal');
const loginBtnNav = document.getElementById('loginBtnNav');
const closeModal = document.querySelector('.close-modal');
const tabBtns = document.querySelectorAll('.tab-btn');

function toggleModal(show) {
    if (authModal) {
        authModal.style.display = show ? 'flex' : 'none';
        if (show) {
            authModal.focus();
        }
    }
}

if (loginBtnNav) {
    loginBtnNav.addEventListener('click', (e) => {
        e.preventDefault();
        toggleModal(true);
    });
}

if (closeModal) {
    closeModal.addEventListener('click', () => toggleModal(false));
}

window.addEventListener('click', (e) => {
    if (e.target === authModal) toggleModal(false);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModal && authModal.style.display === 'flex') {
        toggleModal(false);
    }
});

if (tabBtns.length) {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            
            document.querySelectorAll('.auth-form').forEach(form => {
                form.classList.remove('active');
            });
            
            if (tab === 'login') {
                document.getElementById('loginForm').classList.add('active');
            } else if (tab === 'register') {
                document.getElementById('registerForm').classList.add('active');
            }
            
            document.getElementById('loginMessage').innerHTML = '';
            document.getElementById('registerMessage').innerHTML = '';
        });
    });
}

// ------------------- REGISTRO -------------------
const registerForm = document.getElementById('registerForm');
const registerMessage = document.getElementById('registerMessage');

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const phone = document.getElementById('registerPhone').value.trim();
        const password = document.getElementById('registerPassword').value;

        if (!username || !phone || !password) {
            showMessage(registerMessage, 'Por favor completa los campos obligatorios', 'error');
            return;
        }

        if (password.length < 6) {
            showMessage(registerMessage, 'La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        const phonePattern = /^\+53\s?[0-9]{8}$/;
        if (!phonePattern.test(phone)) {
            showMessage(registerMessage, 'Teléfono debe estar en formato cubano: +53 seguido de 8 dígitos', 'error');
            return;
        }

        showMessage(registerMessage, 'Creando cuenta...', 'loading');

        try {
            const tempEmail = email || `${username}@temp.local`;
            
            const { data, error } = await window.supabase.auth.signUp({
                email: tempEmail,
                password: password,
                options: {
                    data: {
                        username: username,
                        phone: phone,
                        email_original: email
                    }
                }
            });

            if (error) throw error;

            showMessage(registerMessage, '¡Cuenta creada exitosamente! Ya puedes iniciar sesión.', 'success');
            
            setTimeout(() => {
                toggleModal(false);
                registerForm.reset();
                tabBtns[0].click();
            }, 2000);
            
        } catch (error) {
            showMessage(registerMessage, 'Error: ' + error.message, 'error');
        }
    });
}

// ------------------- LOGIN -------------------
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            showMessage(loginMessage, 'Por favor ingresa tu nombre de usuario y contraseña', 'error');
            return;
        }

        showMessage(loginMessage, 'Iniciando sesión...', 'loading');

        try {
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: `${username}@temp.local`,
                password: password
            });

            if (error) {
                const { data: data2, error: error2 } = await window.supabase.auth.signInWithPassword({
                    email: username,
                    password: password
                });
                
                if (error2) {
                    showMessage(loginMessage, 'Credenciales inválidas. Verifica tu nombre de usuario y contraseña.', 'error');
                    return;
                }
                currentUser = data2.user;
            } else {
                currentUser = data.user;
            }

            await fetchUserMetadata();
            updateAuthUI();
            toggleModal(false);
            loadReviews();
            
            showMessage(loginMessage, '¡Sesión iniciada exitosamente!', 'success');
            loginForm.reset();
            
            setTimeout(() => {
                loginMessage.style.display = 'none';
            }, 2000);
            
        } catch (error) {
            showMessage(loginMessage, 'Error: ' + error.message, 'error');
        }
    });
}

async function fetchUserMetadata() {
    if (currentUser) {
        try {
            const { data, error } = await window.supabase.auth.getUser();
            if (!error && data.user) {
                currentUsername = data.user.user_metadata?.username || 
                                  data.user.email.split('@')[0];
                currentUser = data.user;
            }
        } catch (error) {
            // console.error('Error fetching metadata', error);
            currentUsername = currentUser.email.split('@')[0];
        }
    }
}

function updateAuthUI() {
    const authNavLink = document.getElementById('auth-nav-link');
    
    if (currentUser && authNavLink) {
        const displayName = currentUsername || 'Usuario';
        authNavLink.innerHTML = `
            <a href="#" id="logoutBtn" class="btn-login">
                <i class="fas fa-user-circle"></i> ${displayName}
            </a>
        `;
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await window.supabase.auth.signOut();
                currentUser = null;
                currentUsername = null;
                updateAuthUI();
                loadReviews();
                window.location.reload();
            });
        }
        
        const reviewFormContainer = document.getElementById('reviewFormContainer');
        const loginPrompt = document.getElementById('loginPrompt');
        if (reviewFormContainer) reviewFormContainer.style.display = 'block';
        if (loginPrompt) loginPrompt.style.display = 'none';
        
    } else if (authNavLink) {
        authNavLink.innerHTML = `
            <a href="#" id="loginBtnNav" class="btn-login">Acceder</a>
        `;
        
        const newLoginBtn = document.getElementById('loginBtnNav');
        if (newLoginBtn) {
            newLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleModal(true);
            });
        }
        
        const reviewFormContainer = document.getElementById('reviewFormContainer');
        const loginPrompt = document.getElementById('loginPrompt');
        if (reviewFormContainer) reviewFormContainer.style.display = 'none';
        if (loginPrompt) loginPrompt.style.display = 'block';
        
        const showLoginModal = document.getElementById('showLoginModal');
        const showRegisterModal = document.getElementById('showRegisterModal');
        
        if (showLoginModal) {
            showLoginModal.addEventListener('click', (e) => {
                e.preventDefault();
                toggleModal(true);
                if (tabBtns.length) tabBtns[0].click();
            });
        }
        
        if (showRegisterModal) {
            showRegisterModal.addEventListener('click', (e) => {
                e.preventDefault();
                toggleModal(true);
                if (tabBtns.length) tabBtns[1].click();
            });
        }
    }
}

async function checkSession() {
    try {
        if (!isSupabaseAvailable()) {
            // console.warn('Supabase no disponible, usando modo offline');
            return;
        }
        
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
            currentUser = session.user;
            await fetchUserMetadata();
        }
        updateAuthUI();
    } catch (error) {
        // console.error('Error checking session:', error);
    }
}

// ------------------- MENÚ DINÁMICO -------------------
let menuData = [];

async function loadMenu() {
    if (!isSupabaseAvailable()) {
        return getFallbackMenuData();
    }
    
    try {
        const { data, error } = await window.supabase
            .from('menu_items')
            .select('*')
            .order('categoria', { ascending: true })
            .order('nombre', { ascending: true });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        // console.error('Error cargando menú:', error);
        return getFallbackMenuData();
    }
}

function getFallbackMenuData() {
    return [
        { id: 1, nombre: 'Ropa Vieja', descripcion: 'Carne desmechada en salsa de tomate con arroz y frijoles negros', precio: 1500, categoria: 'cubanos', imagen: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400' },
        { id: 2, nombre: 'Pasta Carbonara', descripcion: 'Espagueti con salsa cremosa, bacon y parmesano', precio: 1800, categoria: 'italianos', imagen: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400' },
        { id: 3, nombre: 'Mojito Cubano', descripcion: 'Cóctel tradicional con ron, menta, lima y soda', precio: 500, categoria: 'bebidas', imagen: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400' },
        { id: 4, nombre: 'Lechón Asado', descripcion: 'Cerdo asado lentamente con mojo criollo y yuca', precio: 2000, categoria: 'cubanos', imagen: 'https://images.unsplash.com/photo-1544025162-d76690b67f11?w=400' },
        { id: 5, nombre: 'Pizza Margarita', descripcion: 'Tomate, mozzarella fresca y albahaca', precio: 1600, categoria: 'italianos', imagen: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400' },
        { id: 6, nombre: 'Tiramisú', descripcion: 'Postre italiano con mascarpone y café', precio: 800, categoria: 'postres', imagen: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400' }
    ];
}

async function renderMenu() {
    menuData = await loadMenu();
    
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;
    
    const categorias = ['todos', ...new Set(menuData.map(item => item.categoria))];
    const categoriesContainer = document.querySelector('.menu-categories');
    
    if (categoriesContainer) {
        categoriesContainer.innerHTML = categorias.map(cat => 
            `<button class="menu-category-btn ${cat === 'todos' ? 'active' : ''}" 
                     data-category="${cat}" 
                     role="tab" 
                     aria-selected="${cat === 'todos'}">
                ${cat === 'todos' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>`
        ).join('');
        
        document.querySelectorAll('.menu-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.menu-category-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                filterMenu(btn.dataset.category);
            });
        });
    }
    
    filterMenu('todos');
}

function filterMenu(categoria) {
    const filtered = categoria === 'todos' 
        ? menuData 
        : menuData.filter(item => item.categoria === categoria);
    
    const grid = document.getElementById('menuGrid');
    if (!grid) return;
    
    grid.innerHTML = filtered.map(item => `
        <article class="menu-item">
            <img src="${item.imagen}" 
                 alt="${item.nombre}" 
                 class="menu-item-image" 
                 loading="lazy">
            <div class="menu-item-content">
                <h3 class="menu-item-title">${item.nombre}</h3>
                <p class="menu-item-description">${item.descripcion}</p>
                <p class="menu-item-price">$${item.precio} CUP 
                    <span class="price-note">*precio aproximado</span>
                </p>
            </div>
        </article>
    `).join('');
}

// ------------------- RESEÑAS -------------------
async function loadReviews() {
    if (!isSupabaseAvailable()) {
        loadFallbackReviews();
        return;
    }
    
    try {
        const { data: reviews, error } = await window.supabase
            .from('reviews')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('reviewsContainer');
        if (!container) return;
        
        if (!reviews || !reviews.length) {
            container.innerHTML = `
                <div class="testimonial-card">
                    <p class="testimonial-text">¡Sé el primero en dejar tu opinión!</p>
                    <p class="testimonial-author">- Restaurante Sabores</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = reviews.map(review => {
            const author = review.username || 'Cliente';
            const stars = '⭐'.repeat(review.rating || 5);
            return `
                <div class="testimonial-card" role="listitem">
                    <div class="testimonial-stars" aria-label="${review.rating} de 5 estrellas">${stars}</div>
                    <p class="testimonial-text">"${review.comment}"</p>
                    <p class="testimonial-author">- ${author}</p>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        // console.error('Error cargando reseñas:', error);
        loadFallbackReviews();
    }
}

function loadFallbackReviews() {
    const container = document.getElementById('reviewsContainer');
    if (container) {
        container.innerHTML = `
            <div class="testimonial-card" role="listitem">
                <div class="testimonial-stars" aria-label="5 de 5 estrellas">⭐⭐⭐⭐⭐</div>
                <p class="testimonial-text">"¡Excelente experiencia! La ropa vieja es la mejor que he probado en Pinar del Río."</p>
                <p class="testimonial-author">- María González</p>
            </div>
            <div class="testimonial-card" role="listitem">
                <div class="testimonial-stars" aria-label="5 de 5 estrellas">⭐⭐⭐⭐⭐</div>
                <p class="testimonial-text">"Ambiente acogedor y servicio impecable. Volveremos seguro."</p>
                <p class="testimonial-author">- Carlos Rodríguez</p>
            </div>
            <div class="testimonial-card" role="listitem">
                <div class="testimonial-stars" aria-label="4 de 5 estrellas">⭐⭐⭐⭐</div>
                <p class="testimonial-text">"La pasta carbonara increíble. Precios justos para la calidad."</p>
                <p class="testimonial-author">- Ana Martínez</p>
            </div>
        `;
    }
}

function setupRatingStars() {
    const ratingStars = document.querySelectorAll('.rating-stars i');
    
    ratingStars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            selectedRating = rating;
            const ratingInput = document.getElementById('reviewRating');
            if (ratingInput) ratingInput.value = rating;
            
            updateStars(rating);
        });
        
        star.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                star.click();
            }
        });
        
        star.addEventListener('mouseenter', () => {
            const rating = parseInt(star.dataset.rating);
            updateStars(rating, true);
        });
        
        star.addEventListener('mouseleave', () => {
            updateStars(selectedRating);
        });
    });
}

function updateStars(rating, isHover = false) {
    const ratingStars = document.querySelectorAll('.rating-stars i');
    ratingStars.forEach((s, idx) => {
        if (idx < rating) {
            s.classList.remove('far');
            s.classList.add('fas');
        } else {
            s.classList.remove('fas');
            s.classList.add('far');
        }
    });
}

const reviewForm = document.getElementById('reviewForm');
const reviewMessage = document.getElementById('reviewMessage');

if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            showMessage(reviewMessage, 'Debes iniciar sesión para enviar una reseña', 'error');
            return;
        }
        
        const rating = selectedRating;
        const comment = document.getElementById('reviewComment').value.trim();
        
        if (rating === 0 || !comment) {
            showMessage(reviewMessage, 'Por favor selecciona una calificación y escribe un comentario', 'error');
            return;
        }
        
        if (comment.length < 10) {
            showMessage(reviewMessage, 'El comentario debe tener al menos 10 caracteres', 'error');
            return;
        }
        
        showMessage(reviewMessage, 'Enviando tu opinión...', 'loading');
        
        try {
            const { error } = await window.supabase
                .from('reviews')
                .insert([{
                    user_id: currentUser.id,
                    user_email: currentUser.email,
                    username: currentUsername,
                    rating: rating,
                    comment: comment,
                    status: 'pending'
                }]);
            
            if (error) throw error;
            
            showMessage(reviewMessage, '¡Gracias! Tu opinión será revisada y publicada pronto.', 'success');
            
            // ---------- NUEVO: ENVIAR NOTIFICACIÓN POR WHATSAPP ----------
            const mensajeWhatsApp = `*Nueva reseña en Restaurante Sabores*%0A%0A👤 Usuario: ${currentUsername || currentUser.email}%0A⭐ Calificación: ${rating} estrellas%0A💬 Comentario: ${comment}%0A%0ARevisar en panel admin.`;
            const urlWhatsApp = `https://wa.me/5356126176?text=${mensajeWhatsApp}`;
            window.open(urlWhatsApp, '_blank');
            // ------------------------------------------------------------
            
            document.getElementById('reviewComment').value = '';
            selectedRating = 0;
            updateStars(0);
            document.getElementById('reviewRating').value = '0';
            
        } catch (error) {
            showMessage(reviewMessage, 'Error al enviar: ' + error.message, 'error');
        }
    });
}

// ------------------- RESERVAS -------------------
const reservationForm = document.getElementById('reservationForm');
const submitBtn = document.getElementById('submitBtn');
const formStatus = document.getElementById('formStatus');
const fechaInput = document.getElementById('fecha');

if (fechaInput) {
    const hoy = new Date();
    fechaInput.min = hoy.toISOString().split('T')[0];
    
    const maxFecha = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
    fechaInput.max = maxFecha.toISOString().split('T')[0];
}

// Función para mantener el prefijo +53 en los campos de teléfono
function setupPhonePrefix(phoneInputId) {
    const phoneInput = document.getElementById(phoneInputId);
    if (!phoneInput) return;
    phoneInput.value = '+53 ';
    phoneInput.addEventListener('input', function() {
        let val = this.value;
        if (!val.startsWith('+53 ')) {
            val = '+53 ' + val.replace(/^\+53\s?/, '');
            this.value = val;
        }
    });
}

if (reservationForm) {
    // Aplicar prefijo al campo teléfono de reserva
    setupPhonePrefix('telefono');

    reservationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let telefono = document.getElementById('telefono').value.trim();
        if (!telefono.startsWith('+53')) telefono = '+53 ' + telefono;
        const formData = {
            nombre: document.getElementById('nombre').value.trim(),
            telefono: telefono,
            fecha: document.getElementById('fecha').value,
            hora: document.getElementById('hora').value,
            personas: document.getElementById('personas').value,
            ocasion: document.getElementById('ocasion').value,
            notas: document.getElementById('notas').value.trim(),
            estado: 'pendiente',
            creado: new Date().toISOString()
        };
        if (!formData.nombre || !formData.telefono || !formData.fecha || !formData.hora || !formData.personas) {
            showStatus('Por favor completa todos los campos obligatorios', 'error');
            return;
        }
        const telefonoLimpio = formData.telefono.replace(/\D/g, '');
        if (telefonoLimpio.length < 8) {
            showStatus('Número de teléfono inválido (mínimo 8 dígitos)', 'error');
            return;
        }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...'; }
        showStatus('Procesando tu reserva...', 'loading');
        const mensajeWhatsApp = `Hola, soy ${formData.nombre}. Quiero reservar para ${formData.personas} personas el ${formData.fecha} a las ${formData.hora}. Tel: ${formData.telefono}. Gracias.`;
        const urlWhatsApp = `https://wa.me/5356126176?text=${encodeURIComponent(mensajeWhatsApp)}`;
        if (isSupabaseAvailable()) {
            try {
                const { error } = await window.supabase.from('reservas').insert([formData]);
                if (error) throw error;
                showStatus('¡Reserva recibida! Redirigiendo a WhatsApp para confirmación...', 'success');
                setTimeout(() => { window.open(urlWhatsApp, '_blank'); reservationForm.reset(); setupPhonePrefix('telefono'); }, 1500);
            } catch (error) {
                // console.error('Error guardando reserva:', error);
                showStatus('Conexión lenta. Redirigiendo a WhatsApp directamente...', 'warning');
                setTimeout(() => window.open(urlWhatsApp, '_blank'), 1500);
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Reserva'; }
            }
        } else {
            showStatus('Modo offline. Redirigiendo a WhatsApp...', 'warning');
            setTimeout(() => window.open(urlWhatsApp, '_blank'), 1500);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Reserva'; }
        }
    });
}

function showStatus(mensaje, tipo) {
    if (!formStatus) return;
    formStatus.textContent = mensaje;
    formStatus.className = `form-status ${tipo}`;
    formStatus.style.display = 'block';
    if (tipo !== 'loading') setTimeout(() => formStatus.style.display = 'none', 5000);
}

function showMessage(element, mensaje, tipo) {
    if (!element) return;
    element.textContent = mensaje;
    element.className = `form-status ${tipo}`;
    element.style.display = 'block';
    if (tipo !== 'loading') setTimeout(() => element.style.display = 'none', 4000);
}

// ------------------- DETECCIÓN DE CONEXIÓN -------------------
const offlineNotice = document.getElementById('offlineNotice');

function updateOnlineStatus() {
    if (!navigator.onLine) {
        if (offlineNotice) offlineNotice.classList.add('show');
        document.body.classList.add('data-saver');
    } else {
        if (offlineNotice) offlineNotice.classList.remove('show');
        document.body.classList.remove('data-saver');
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

if (navigator.connection) {
    const connection = navigator.connection;
    if (connection.saveData || ['slow-2g', '2g'].includes(connection.effectiveType)) {
        document.body.classList.add('data-saver');
    }
}

// ------------------- INICIALIZACIÓN -------------------
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    renderMenu();
    loadReviews();
    setupRatingStars();
    // Aplicar prefijo al campo de teléfono en registro (si está presente)
    setupPhonePrefix('registerPhone');
    // console.log('✅ Aplicación cargada - Restaurante Sabores 2026');
});