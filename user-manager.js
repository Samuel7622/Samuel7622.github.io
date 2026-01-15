
// ========== USER MANAGER UNIFICADO ==========
class UserManager {
    constructor() {
        this.usersKey = 'gymp2_users';
        this.currentUserKey = 'gymp2_current_user';
        this.tokenKey = 'gymp2_token';
        this.apiURL = 'http://localhost:3000'; // URL do servidor
        this.init();
        console.log('✅ UserManager inicializado');
    }

    // Inicializar banco de dados LOCAL (fallback quando servidor offline)
    init() {
        if (!localStorage.getItem(this.usersKey)) {
            const initialUsers = {
                'admin@gymp2.com': {
                    name: 'Administrador',
                    email: 'admin@gymp2.com',
                    password: '123456',
                    joined: new Date().toISOString(),
                    role: 'admin',
                    avatar: null
                },
                'usuario@gymp2.com': {
                    name: 'João Silva',
                    email: 'usuario@gymp2.com',
                    password: '123456',
                    joined: new Date().toISOString(),
                    role: 'user',
                    avatar: null
                }
            };
            localStorage.setItem(this.usersKey, JSON.stringify(initialUsers));
            console.log('📦 Banco de usuários local criado');
        }
    }

    // ========== MÉTODOS DE DADOS ==========

    // Obter todos os usuários
    getUsers() {
        return JSON.parse(localStorage.getItem(this.usersKey)) || {};
    }

    // Salvar usuários no localStorage
    saveUsers(users) {
        localStorage.setItem(this.usersKey, JSON.stringify(users));
    }

    // Obter usuário específico por email
    getUser(email) {
        const users = this.getUsers();
        return users[email] || null;
    }

    // ========== MÉTODOS DE AUTENTICAÇÃO ==========

    // Login LOCAL (fallback)
    loginLocal(email, password) {
        const user = this.getUser(email);

        if (!user) {
            return { success: false, message: 'Email não encontrado' };
        }

        if (user.password !== password) {
            return { success: false, message: 'Senha incorreta' };
        }

        // Salvar sessão
        this.saveUserSession(user);
        
        console.log('✅ Login local realizado:', user.email);
        return { success: true, message: 'Login realizado com sucesso!', user };
    }

    // Salvar sessão do usuário (compatível com todos os métodos)
    saveUserSession(user, token = null) {
        // LocalStorage (permanente)
        localStorage.setItem(this.currentUserKey, JSON.stringify(user));
        localStorage.setItem('currentUser', JSON.stringify(user)); // Compatibilidade
        
        // SessionStorage (temporário - mais seguro)
        sessionStorage.setItem(this.currentUserKey, JSON.stringify(user));
        sessionStorage.setItem('gymp2_user', JSON.stringify(user));
        
        // Token se fornecido
        if (token) {
            sessionStorage.setItem(this.tokenKey, token);
        }

        // Disparar evento para atualizar UI
        this.dispatchLoginEvent(user);
    }

    // Login principal (tenta servidor primeiro, depois local)
    async login(email, password) {
        // Tentar servidor primeiro
        const serverOnline = await this.checkServerStatus();
        
        if (serverOnline) {
            try {
                const response = await fetch(`${this.apiURL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();

                if (result.success) {
                    this.saveUserSession(result.user, result.token);
                    console.log('✅ Login via servidor realizado');
                    return result;
                }
                
                return result;
            } catch (error) {
                console.warn('⚠️ Servidor offline, usando login local');
            }
        }

        // Fallback para login local
        return this.loginLocal(email, password);
    }

    // Logout COMPLETO
    logout() {
        const user = this.getCurrentUser();
        
        // Limpar TUDO
        localStorage.removeItem(this.currentUserKey);
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem(this.currentUserKey);
        sessionStorage.removeItem('gymp2_user');
        sessionStorage.removeItem(this.tokenKey);
        
        console.log('✅ Logout realizado');
        
        // Disparar evento
        this.dispatchLogoutEvent(user);
    }

    // Obter usuário atual (prioriza sessionStorage)
    getCurrentUser() {
        // 1. Tentar sessionStorage primeiro (mais seguro)
        let userData = sessionStorage.getItem('gymp2_user') || 
                       sessionStorage.getItem(this.currentUserKey);
        
        // 2. Fallback para localStorage
        if (!userData) {
            userData = localStorage.getItem(this.currentUserKey) ||
                      localStorage.getItem('currentUser');
        }
        
        if (!userData) {
            return null;
        }

        try {
            return JSON.parse(userData);
        } catch (error) {
            console.error('❌ Erro ao ler dados do usuário:', error);
            return null;
        }
    }

    // ========== MÉTODOS DE CRIAÇÃO DE USUÁRIO ==========

    // Criar usuário principal (tenta servidor primeiro)
    async createUser(userData) {
        const serverOnline = await this.checkServerStatus();
        
        if (serverOnline) {
            try {
                const response = await fetch(`${this.apiURL}/cadastro`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                const result = await response.json();
                console.log('✅ Cadastro via servidor');
                return result;
            } catch (error) {
                console.warn('⚠️ Servidor offline, cadastro local');
            }
        }

        // Fallback local
        return this.createUserLocal(userData);
    }

    // Criar usuário LOCAL
    createUserLocal(userData) {
        const users = this.getUsers();

        if (!userData.email || !userData.password || !userData.name) {
            return { success: false, message: 'Preencha todos os campos' };
        }

        if (users[userData.email]) {
            return { success: false, message: 'Email já cadastrado' };
        }

        users[userData.email] = {
            name: userData.name,
            email: userData.email,
            password: userData.password,
            joined: new Date().toISOString(),
            role: userData.role || 'user',
            avatar: userData.avatar || null
        };

        this.saveUsers(users);
        console.log('✅ Usuário criado localmente:', userData.email);
        
        return { 
            success: true, 
            message: 'Conta criada com sucesso!', 
            user: users[userData.email] 
        };
    }

    // ========== MÉTODOS DE SERVIDOR ==========

    // Verificar se servidor está online
    async checkServerStatus() {
        try {
            const response = await fetch(`${this.apiURL}/status`, {
                method: 'GET',
                timeout: 2000
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    // ========== MÉTODOS AUXILIARES ==========

    // Atualizar perfil do usuário
    updateUserProfile(updatedData) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            return { success: false, message: 'Nenhum usuário logado' };
        }

        const users = this.getUsers();
        
        if (users[currentUser.email]) {
            users[currentUser.email] = { 
                ...users[currentUser.email], 
                ...updatedData,
                email: currentUser.email // Prevenir alteração de email
            };
            
            this.saveUsers(users);
            
            // Atualizar sessão atual
            const updatedUser = users[currentUser.email];
            this.saveUserSession(updatedUser);
            
            console.log('✅ Perfil atualizado:', updatedUser.email);
            return { success: true, message: 'Perfil atualizado!', user: updatedUser };
        }
        
        return { success: false, message: 'Erro ao atualizar perfil' };
    }

    // Verificar se está logado
    isLoggedIn() {
        return this.getCurrentUser() !== null;
    }

    // Proteger página (requer autenticação)
    requireAuth(redirectUrl = 'login-gym.html') {
        if (!this.isLoggedIn()) {
            console.log('⚠️ Usuário não autenticado, redirecionando...');
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    }

    // Verificar se já está logado (redirecionar se sim)
    checkAlreadyLoggedIn(redirectUrl = 'Menu-inicial-logado.html') {
        if (this.isLoggedIn()) {
            console.log('ℹ️ Usuário já está logado, redirecionando...');
            window.location.href = redirectUrl;
            return true;
        }
        return false;
    }

    // ========== EVENTOS CUSTOMIZADOS ==========

    dispatchLoginEvent(user) {
        const event = new CustomEvent('userLoggedIn', { 
            detail: { user } 
        });
        window.dispatchEvent(event);
        console.log('📢 Evento userLoggedIn disparado');
    }

    dispatchLogoutEvent(user) {
        const event = new CustomEvent('userLoggedOut', { 
            detail: { user } 
        });
        window.dispatchEvent(event);
        console.log('📢 Evento userLoggedOut disparado');
    }
}

// ========== INICIALIZAÇÃO GLOBAL ==========
window.userManager = new UserManager();

// ========== FUNÇÕES DE PROTEÇÃO DE PÁGINA ==========

// Proteger página (requer autenticação)
function protectPage() {
    return window.userManager.requireAuth();
}

// Redirecionar se já estiver logado
function redirectIfLoggedIn() {
    return window.userManager.checkAlreadyLoggedIn();
}

// Tornar funções globais para compatibilidade
window.protectPage = protectPage;
window.redirectIfLoggedIn = redirectIfLoggedIn;

console.log('🔐 Sistema de autenticação UNIFICADO carregado!');