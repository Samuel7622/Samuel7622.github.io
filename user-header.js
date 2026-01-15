
// ========== SISTEMA UNIFICADO DE LOGIN E HEADER DE USUÁRIO ==========

// ========== PARTE 1: SISTEMA DE LOGIN COM REDIRECIONAMENTO ==========
// Para usar na página de login (login-gym.html)

function setupLoginSystem() {
    // Verificar se estamos na página de login
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (!loginForm && !signupForm) {
        return false; // Não é página de login
    }
    
    // Modificar a função de login
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Modificar a função de signup
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    return true;
}

function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Usar o sistema do segundo código se disponível
    if (window.userManager) {
        const result = window.userManager.login(email, password);
        
        if (result.success) {
            showMessage('login-message', result.message, 'success');
            
            // Disparar evento de login
            window.dispatchEvent(new CustomEvent('userLoggedIn', {
                detail: { user: result.user }
            }));
            
            // Redirecionar após 1 segundo
            setTimeout(() => {
                window.location.href = window.location.origin + '/Menu-inicial-sem-logar.html';
            }, 1000);
        } else {
            showMessage('login-message', result.message, 'error');
        }
    } else {
        // Fallback para o sistema original
        const result = db.login(email, password);

        if (result.success) {
            showMessage('login-message', result.message, 'success');
            
            // Salvar usuário no localStorage
            localStorage.setItem('currentUser', JSON.stringify(result.user));
            localStorage.setItem('gymp2_current_user', JSON.stringify(result.user));
            
            // Disparar evento de login
            window.dispatchEvent(new CustomEvent('userLoggedIn', {
                detail: { user: result.user }
            }));
            
            // Redirecionar após 1 segundo
            setTimeout(() => {
                window.location.href = window.location.origin + '/Menu-inicial-sem-logar.html';
            }, 1000);
        } else {
            showMessage('login-message', result.message, 'error');
        }
    }
}

function handleSignup(e) {
    e.preventDefault();

    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    // Usar o sistema do segundo código se disponível
    if (window.userManager) {
        const result = window.userManager.createUser({ name, email, password });
        
        if (result.success) {
            showMessage('signup-message', result.message, 'success');
            
            // Fazer login automático após criar conta
            setTimeout(() => {
                const loginResult = window.userManager.login(email, password);
                if (loginResult.success) {
                    // Disparar evento de login
                    window.dispatchEvent(new CustomEvent('userLoggedIn', {
                        detail: { user: loginResult.user }
                    }));
                    
                    window.location.replace('Menu-inicial-sem-logar.html');
                }
            }, 1500);
        } else {
            showMessage('signup-message', result.message, 'error');
        }
    } else {
        // Fallback para o sistema original
        const result = db.createUser({ name, email, password });

        if (result.success) {
            showMessage('signup-message', result.message, 'success');
            
            // Fazer login automático após criar conta
            setTimeout(() => {
                const loginResult = db.login(email, password);
                if (loginResult.success) {
                    localStorage.setItem('currentUser', JSON.stringify(loginResult.user));
                    localStorage.setItem('gymp2_current_user', JSON.stringify(loginResult.user));
                    
                    // Disparar evento de login
                    window.dispatchEvent(new CustomEvent('userLoggedIn', {
                        detail: { user: loginResult.user }
                    }));
                    
                    window.location.replace('Menu-inicial-sem-logar.html');
                }
            }, 1500);
        } else {
            showMessage('signup-message', result.message, 'error');
        }
    }
}

// ========== PARTE 2: SISTEMA DE HEADER DE USUÁRIO ==========

// Adicionar estilos CSS unificados
function addUserHeaderStyles() {
    if (document.getElementById('user-header-styles')) {
        return;
    }

    const styles = `
        <style id="user-header-styles">
            .user-header-container {
                display: flex;
                align-items: center;
                gap: 12px;
                background: rgba(0, 255, 136, 0.1);
                border: 2px solid rgba(0, 255, 136, 0.3);
                border-radius: 30px;
                padding: 6px 16px 6px 6px;
                transition: all 0.3s ease;
                cursor: pointer;
                position: relative;
                animation: fadeInScale 0.4s ease-out;
            }

            .user-header-container:hover {
                background: rgba(0, 255, 136, 0.2);
                border-color: rgba(0, 255, 136, 0.5);
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);
            }

            .user-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 16px;
                color: #000;
                border: 2px solid #fff;
                flex-shrink: 0;
            }

            .user-avatar img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
            }

            .user-name-text {
                font-size: 14px;
                font-weight: 600;
                color: #fff;
                max-width: 150px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .user-dropdown-menu {
                position: absolute;
                top: calc(100% + 10px);
                right: 0;
                background: #1a1a1a;
                border: 2px solid rgba(0, 255, 136, 0.3);
                border-radius: 16px;
                padding: 12px;
                min-width: 220px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                opacity: 0;
                visibility: hidden;
                transform: translateY(-10px);
                transition: all 0.3s ease;
                z-index: 3000;
            }

            .user-header-container.active .user-dropdown-menu {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }

            .user-dropdown-info {
                padding: 12px;
                border-bottom: 1px solid rgba(0, 255, 136, 0.2);
                margin-bottom: 8px;
            }

            .user-dropdown-name {
                font-size: 16px;
                font-weight: 700;
                color: #fff;
                margin-bottom: 4px;
            }

            .user-dropdown-email {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.6);
            }

            .user-dropdown-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s ease;
                color: #fff;
                text-decoration: none;
                margin-bottom: 4px;
            }

            .user-dropdown-item:hover {
                background: rgba(0, 255, 136, 0.1);
            }

            .user-dropdown-item.logout {
                color: #ff4444;
                border-top: 1px solid rgba(255, 68, 68, 0.2);
                margin-top: 8px;
            }

            .user-dropdown-item.logout:hover {
                background: rgba(255, 68, 68, 0.1);
            }

            .user-dropdown-icon {
                width: 20px;
                height: 20px;
                fill: currentColor;
            }

            @keyframes fadeInScale {
                from {
                    opacity: 0;
                    transform: scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            /* Estilos para o menu hamburguer quando logado */
            .nav-link i {
                width: 20px;
                text-align: center;
                margin-right: 10px;
            }

            .nav-link[style*="color: #00ff88"] {
                background: rgba(0, 255, 136, 0.1);
                border-radius: 8px;
                margin: 5px 0;
                padding: 12px 15px !important;
            }

            .nav-link[style*="color: #ff4444"] {
                background: rgba(255, 68, 68, 0.1);
                border-radius: 8px;
                margin: 5px 0;
                padding: 12px 15px !important;
            }

            .nav-link[style*="color: #00ff88"]:hover {
                background: rgba(0, 255, 136, 0.2);
                color: #00ff88 !important;
            }

            .nav-link[style*="color: #ff4444"]:hover {
                background: rgba(255, 68, 68, 0.2);
                color: #ff4444 !important;
            }

            @media (max-width: 768px) {
                .user-name-text {
                    display: none;
                }
                .user-header-container {
                    padding: 6px;
                }
                .user-dropdown-menu {
                    min-width: 200px;
                }
            }
        </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
}

// ========== FUNÇÕES PARA CRIAÇÃO DO HEADER ==========

function createUserHeaderHTML(user) {
    const initials = user.name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const firstName = user.name.split(' ')[0];

    return `
        <div class="user-header-container" id="userHeaderContainer">
            <div class="user-avatar">
                ${user.avatar 
                    ? `<img src="${user.avatar}" alt="${user.name}">` 
                    : initials
                }
            </div>
            <span class="user-name-text">${firstName}</span>
            
            <div class="user-dropdown-menu" id="userDropdownMenu">
                <div class="user-dropdown-info">
                    <div class="user-dropdown-name">${user.name}</div>
                    <div class="user-dropdown-email">${user.email || 'usuario@gymp2.com'}</div>
                </div>
                
                <a href="perfil.html" class="user-dropdown-item">
                    <svg class="user-dropdown-icon" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                    </svg>
                    Meu Perfil
                </a>
                
                <div class="user-dropdown-item logout" id="logoutBtn">
                    <svg class="user-dropdown-icon" viewBox="0 0 24 24">
                        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                    </svg>
                    Sair
                </div>
            </div>
        </div>
    `;
}

function createUserHeaderManually(user) {
    const rightControls = document.querySelector('.right-controls');
    
    if (!rightControls) {
        console.error('❌ Container .right-controls não encontrado');
        return;
    }

    // Verificar se já existe um componente de usuário
    if (document.getElementById('userHeaderContainer')) {
        console.log('ℹ️ Header de usuário já existe');
        return;
    }

    // Remover o botão "Login" se existir
    const gymButtons = rightControls.querySelectorAll('.gym-access-btn');
    gymButtons.forEach(btn => {
        if (btn.textContent.includes('Login')) {
            btn.remove();
        }
    });

    // Criar e inserir o componente
    const menuTrigger = document.getElementById('menuTrigger');
    const userContainer = document.createElement('div');
    userContainer.innerHTML = createUserHeaderHTML(user);
    
    if (menuTrigger) {
        menuTrigger.parentNode.insertBefore(userContainer.firstElementChild, menuTrigger);
    } else {
        rightControls.appendChild(userContainer.firstElementChild);
    }

    setupUserHeaderEvents();
    
    console.log('✅ Header de usuário criado:', user.name);
}

// ========== GERENCIAMENTO DO MENU HAMBURGUER ==========

function updateHamburgerMenuForLoggedUser(user) {
    const navigationList = document.querySelector('.navigation-list');
    
    if (!navigationList) {
        console.log('❌ Menu hamburguer não encontrado');
        return;
    }

    // Encontrar o item de login no menu
    const loginItems = navigationList.querySelectorAll('.nav-link');
    let loginItem = null;
    
    loginItems.forEach(item => {
        if (item.textContent.trim() === 'Login' || item.getAttribute('href') === '#espaço-cliente') {
            loginItem = item.closest('.nav-item');
        }
    });
    
    // Se encontrou o item de login, substituir por Perfil
    if (loginItem) {
        const firstName = user.name.split(' ')[0];
        
        loginItem.innerHTML = `
            <a href="perfil.html" class="nav-link" style="color: #00ff88; font-weight: 700;">
                <i class="fas fa-user" style="margin-right: 10px;"></i>
                Meu Perfil (${firstName})
            </a>
        `;
        
        // Remover item de logout existente se houver
        const existingLogout = document.getElementById('menuLogoutBtn');
        if (existingLogout) {
            existingLogout.closest('.nav-item').remove();
        }
        
        // Adicionar item de logout
        const logoutItem = document.createElement('li');
        logoutItem.className = 'nav-item';
        logoutItem.innerHTML = `
            <a href="#logout" class="nav-link" style="color: #ff4444;" id="menuLogoutBtn">
                <i class="fas fa-sign-out-alt" style="margin-right: 10px;"></i>
                Sair
            </a>
        `;
        
        navigationList.appendChild(logoutItem);
        
        // Configurar evento de logout no menu
        const menuLogoutBtn = document.getElementById('menuLogoutBtn');
        if (menuLogoutBtn) {
            menuLogoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        }
        
        console.log('✅ Menu hamburguer atualizado para usuário logado');
    } else {
        console.log('ℹ️ Item de login não encontrado no menu hamburguer');
    }
}

function resetHamburgerMenu() {
    const navigationList = document.querySelector('.navigation-list');
    if (!navigationList) return;
    
    // Restaurar item de login se não existir
    const loginItems = navigationList.querySelectorAll('.nav-link');
    let loginExists = false;
    
    loginItems.forEach(item => {
        if (item.textContent.includes('Login') || item.getAttribute('href') === '#espaço-cliente') {
            loginExists = true;
        }
    });
    
    if (!loginExists) {
        // Encontrar onde inserir o login (normalmente após Home)
        const homeItem = Array.from(navigationList.querySelectorAll('.nav-link')).find(item => 
            item.textContent === 'Home' || item.getAttribute('href') === '#home'
        );
        
        if (homeItem) {
            const loginItem = document.createElement('li');
            loginItem.className = 'nav-item';
            loginItem.innerHTML = `
                <a href="#espaço-cliente" class="nav-link">Login</a>
            `;
            homeItem.closest('.nav-item').after(loginItem);
        }
    }
    
    // Remover item de logout se existir
    const logoutItems = navigationList.querySelectorAll('#menuLogoutBtn');
    logoutItems.forEach(item => {
        item.closest('.nav-item').remove();
    });
}

// ========== CONFIGURAÇÃO DE EVENTOS ==========

function setupUserHeaderEvents() {
    const userContainer = document.getElementById('userHeaderContainer');
    const dropdownMenu = document.getElementById('userDropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!userContainer || !dropdownMenu || !logoutBtn) {
        return;
    }

    // Toggle do dropdown
    userContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        userContainer.classList.toggle('active');
    });

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!userContainer.contains(e.target)) {
            userContainer.classList.remove('active');
        }
    });

    // Prevenir fechamento ao clicar no dropdown
    dropdownMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Evento de logout
    logoutBtn.addEventListener('click', handleLogout);

    // Fechar dropdown ao clicar nos links
    const dropdownLinks = dropdownMenu.querySelectorAll('a.user-dropdown-item');
    dropdownLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            userContainer.classList.remove('active');
        });
    });
}

// ========== FUNÇÃO DE LOGOUT UNIFICADA ==========

function handleLogout() {
    if (!confirm('Deseja realmente sair da sua conta?')) {
        return;
    }

    try {
        // Usar o método do userManager se disponível
        if (window.userManager) {
            window.userManager.logout();
        } else {
            // Fallback para limpeza manual
            localStorage.removeItem('currentUser');
            localStorage.removeItem('gymp2_current_user');
        }

        // Disparar evento de logout
        window.dispatchEvent(new CustomEvent('userLoggedOut'));

        // Mostrar notificação se disponível
        if (window.notifications) {
            window.notifications.success('Logout realizado com sucesso!');
        } else {
            alert('Logout realizado com sucesso!');
        }

        // Remover componente do header COM ANIMAÇÃO
        const userContainer = document.getElementById('userHeaderContainer');
        if (userContainer) {
            userContainer.style.transition = 'all 0.3s ease';
            userContainer.style.opacity = '0';
            userContainer.style.transform = 'scale(0.8)';
            setTimeout(() => userContainer.remove(), 300);
        }

        // Restaurar menu hamburguer
        resetHamburgerMenu();

        // Redirecionar para a página inicial
        setTimeout(() => {
            window.location.replace('Menu-inicial-sem-logar.html');
        }, 500);
        
    } catch (error) {
        console.error('❌ Erro no logout:', error);
        // Força limpeza e redirecionamento
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('Menu-inicial-sem-logar.html');
    }
}

// ========== FUNÇÃO PRINCIPAL DE VERIFICAÇÃO DE LOGIN ==========
function checkAndUpdateHeader() {
    console.log('🔄 VERIFICANDO HEADER...');
    
    // Tentar TODAS as fontes possíveis
    let user = null;
    let source = '';
    
    // 1. userManager (API)
    if (window.userManager && window.userManager.getCurrentUser) {
        user = window.userManager.getCurrentUser();
        if (user) source = 'userManager';
    }
    
    // 2. localStorage - currentUser
    if (!user) {
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            try {
                user = JSON.parse(userData);
                source = 'localStorage (currentUser)';
            } catch (e) {
                console.error('❌ Erro ao parsear currentUser:', e);
            }
        }
    }
    
    // 3. localStorage - gymp2_current_user
    if (!user) {
        const userData = localStorage.getItem('gymp2_current_user');
        if (userData) {
            try {
                user = JSON.parse(userData);
                source = 'localStorage (gymp2_current_user)';
            } catch (e) {
                console.error('❌ Erro ao parsear gymp2_current_user:', e);
            }
        }
    }
    
    // 4. sessionStorage (do segundo código)
    if (!user) {
        const userData = sessionStorage.getItem('gymp2_user');
        if (userData) {
            try {
                user = JSON.parse(userData);
                source = 'sessionStorage (API)';
                
                // Sincronizar com localStorage
                localStorage.setItem('gymp2_current_user', userData);
                localStorage.setItem('currentUser', userData);
                console.log('🔄 Sincronizado API → localStorage');
            } catch (e) {
                console.error('❌ Erro ao parsear session user:', e);
            }
        }
    }
    
    console.log('📊 RESULTADO DA VERIFICAÇÃO:');
    console.log('- Usuário encontrado:', user ? 'SIM' : 'NÃO');
    console.log('- Fonte:', source);
    console.log('- Detalhes:', user);
    
    if (user) {
        console.log('🎯 CRIANDO HEADER PARA:', user.name);
        createUserHeaderManually(user);
        updateHamburgerMenuForLoggedUser(user);
    } else {
        console.log('👤 Nenhum usuário logado');
        resetHamburgerMenu();
    }
}

// Observador de mudanças no localStorage (para abas diferentes)
window.addEventListener('storage', (e) => {
    if ((e.key === 'currentUser' || e.key === 'gymp2_current_user')) {
        console.log('🔄 Mudança de login detectada! Atualizando página...');
        setTimeout(() => {
            checkAndUpdateHeader();
        }, 500);
    }
});

// ========== INICIALIZAÇÃO DO SISTEMA ==========

function initializeUnifiedSystem() {
    console.log('🚀 Inicializando sistema unificado...');
    
    // Verificar se estamos na página de login
    const isLoginPage = setupLoginSystem();
    
    // Se não for página de login, configurar o header
    if (!isLoginPage) {
        addUserHeaderStyles();
        checkAndUpdateHeader();
    }
}

// Executar quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUnifiedSystem);
} else {
    // DOM já carregado
    initializeUnifiedSystem();
}

// Tentar novamente após 500ms (garantia extra)
setTimeout(() => {
    if (!document.getElementById('userHeaderContainer')) {
        const userData = localStorage.getItem('currentUser') || localStorage.getItem('gymp2_current_user');
        if (userData) {
            console.log('🔄 Tentativa adicional de inicialização do header...');
            checkAndUpdateHeader();
        }
    }
}, 500);

// ========== EXPORTAÇÃO PARA USO GLOBAL ==========

window.gymp2AuthSystem = {
    // Funções do sistema de login
    setupLoginSystem: setupLoginSystem,
    handleLogin: handleLogin,
    handleSignup: handleSignup,
    
    // Funções do sistema de header
    initializeUserHeader: checkAndUpdateHeader,
    createUserHeader: createUserHeaderManually,
    updateHamburgerMenu: updateHamburgerMenuForLoggedUser,
    
    // Funções comuns
    handleLogout: handleLogout,
    checkAuth: checkAndUpdateHeader,
    
    // Eventos
    onLogin: (callback) => window.addEventListener('userLoggedIn', (e) => callback(e.detail.user)),
    onLogout: (callback) => window.addEventListener('userLoggedOut', callback)
};

console.log('✅ Sistema Unificado de Login e Header carregado e pronto!');

// Função auxiliar para mostrar mensagens (do primeiro código)
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = message;
    element.style.color = type === 'success' ? '#00ff88' : '#ff4444';
    element.style.display = 'block';
    
    // Auto-esconder após 5 segundos
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}