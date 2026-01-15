// serve-unificado.js - Servidor completo GYM P2
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

// ========== CONFIGURAÇÕES ==========

const DATA_DIR = path.join(__dirname, 'data');

// Arquivos de dados
const FILES = {
    academias: path.join(DATA_DIR, 'academias.json'),
    proprietarios: path.join(DATA_DIR, 'proprietarios.json'),
    personais: path.join(DATA_DIR, 'personais.json'),
    admins: path.join(DATA_DIR, 'admins.json'),
    usuarios: path.join(DATA_DIR, 'usuarios.json'),
    sessoes: path.join(DATA_DIR, 'sessoes.json')
};

// ========== MIDDLEWARE ==========
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Middleware de logging
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url} - IP: ${req.ip || req.connection.remoteAddress}`);
    next();
});

// Middleware de autenticação (opcional para rotas protegidas)
const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token && req.path.startsWith('/api/protegido')) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    if (token) {
        try {
            const usuario = await verificarSessao(token);
            if (usuario) {
                req.user = usuario;
            }
        } catch (error) {
            console.log('Token inválido:', error.message);
        }
    }
    
    next();
};

app.use(authMiddleware);

// ========== FUNÇÕES UTILITÁRIAS ==========

// Hash de senhas
function hashPassword(password, salt = null) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

function verifyPassword(password, hash, salt) {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

// Gera token de sessão
function gerarToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Inicialização dos arquivos de dados
async function initDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log('✅ Diretório de dados verificado');
        
        // Inicializar cada arquivo
        for (const [key, filepath] of Object.entries(FILES)) {
            try {
                await fs.access(filepath);
                console.log(`📄 ${key}.json já existe`);
            } catch {
                let initialData;
                
                switch(key) {
                    case 'admins':
                        initialData = [{
                            id: 1,
                            nome: "Admin Master",
                            email: "admin@gym.com",
                            nivel: "super_admin",
                            status: "ativo"
                        }];
                        break;
                        
                    case 'usuarios':
                        initialData = {
                            sistema: "Gymp2 - Sistema Seguro",
                            versao: "2.0",
                            criado_em: new Date().toISOString(),
                            total_usuarios: 0,
                            usuarios: {},
                            logs: []
                        };
                        break;
                        
                    case 'sessoes':
                        initialData = { sessoes: {} };
                        break;
                        
                    default:
                        initialData = [];
                }
                
                await fs.writeFile(filepath, JSON.stringify(initialData, null, 2));
                console.log(`📄 ${key}.json criado`);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao inicializar dados:', error);
    }
}

// Funções de leitura/escrita
async function readData(type) {
    try {
        const data = await fs.readFile(FILES[type], 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Erro ao ler ${type}:`, error.message);
        return type === 'usuarios' || type === 'sessoes' ? {} : [];
    }
}

async function writeData(type, data) {
    try {
        await fs.writeFile(FILES[type], JSON.stringify(data, null, 2));
        console.log(`💾 ${type} salvo com sucesso!`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao salvar ${type}:`, error);
        return false;
    }
}

// Gerenciamento de sessões
async function limparSessoesExpiradas() {
    const sessoes = await readData('sessoes');
    const agora = Date.now();
    const EXPIRACAO = 24 * 60 * 60 * 1000; // 24 horas

    Object.keys(sessoes.sessoes).forEach(token => {
        const sessao = sessoes.sessoes[token];
        if (agora - sessao.criado_em > EXPIRACAO) {
            delete sessoes.sessoes[token];
        }
    });

    await writeData('sessoes', sessoes);
}

async function verificarSessao(token) {
    await limparSessoesExpiradas();
    
    const sessoes = await readData('sessoes');
    const sessao = sessoes.sessoes[token];

    if (!sessao) {
        return null;
    }

    const db = await readData('usuarios');
    const usuario = db.usuarios[sessao.email];

    if (!usuario) {
        return null;
    }

    return {
        name: usuario.name,
        email: usuario.email,
        role: usuario.role
    };
}

// Logs de atividade
async function registrarLog(tipo, dados) {
    const db = await readData('usuarios');
    
    const log = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        tipo: tipo,
        dados: dados,
        ip: dados.ip || 'localhost'
    };

    db.logs.push(log);
    
    // Mantém apenas os últimos 1000 logs
    if (db.logs.length > 1000) {
        db.logs = db.logs.slice(-1000);
    }

    await writeData('usuarios', db);
}

// ========== ROTAS DE AUTENTICAÇÃO ==========

// Cadastro de usuário
app.post("/cadastro", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validações
        if (!name || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Todos os campos são obrigatórios' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Senha deve ter no mínimo 6 caracteres' 
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email inválido' 
            });
        }

        const db = await readData('usuarios');

        // Verifica se email já existe
        if (db.usuarios[email]) {
            await registrarLog('cadastro_falha', { 
                email, 
                motivo: 'email_existente' 
            });
            return res.status(400).json({ 
                success: false, 
                message: 'Email já cadastrado' 
            });
        }

        // Cria hash da senha
        const { hash, salt } = hashPassword(password);

        // Salva usuário
        db.usuarios[email] = {
            name,
            email,
            passwordHash: hash,
            passwordSalt: salt,
            role: 'user',
            criado_em: new Date().toISOString(),
            ultimo_login: null
        };

        db.total_usuarios = Object.keys(db.usuarios).length;
        await writeData('usuarios', db);

        await registrarLog('cadastro_sucesso', { email, name });

        res.json({ 
            success: true, 
            message: 'Conta criada com sucesso!',
            user: { name, email, role: 'user' }
        });
    } catch (error) {
        console.error('Erro no cadastro:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno no servidor' 
        });
    }
});

// Login
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email e senha são obrigatórios' 
            });
        }

        const db = await readData('usuarios');
        const usuario = db.usuarios[email];

        if (!usuario) {
            await registrarLog('login_falha', { 
                email, 
                motivo: 'email_nao_encontrado' 
            });
            return res.status(401).json({ 
                success: false, 
                message: 'Email não encontrado' 
            });
        }

        // Verifica senha
        const senhaCorreta = verifyPassword(password, usuario.passwordHash, usuario.passwordSalt);

        if (!senhaCorreta) {
            await registrarLog('login_falha', { 
                email, 
                motivo: 'senha_incorreta' 
            });
            return res.status(401).json({ 
                success: false, 
                message: 'Senha incorreta' 
            });
        }

        // Atualiza último login
        usuario.ultimo_login = new Date().toISOString();
        await writeData('usuarios', db);

        // Cria sessão
        const token = gerarToken();
        const sessoes = await readData('sessoes');
        
        sessoes.sessoes[token] = {
            email,
            criado_em: Date.now(),
            ip: req.ip || req.connection.remoteAddress
        };

        await writeData('sessoes', sessoes);
        await registrarLog('login_sucesso', { 
            email, 
            name: usuario.name 
        });

        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            token,
            user: {
                name: usuario.name,
                email: usuario.email,
                role: usuario.role
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno no servidor' 
        });
    }
});

// Verificar sessão
app.post("/verificar-sessao", async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ 
                success: false, 
                message: 'Token não fornecido' 
            });
        }

        const usuario = await verificarSessao(token);

        if (!usuario) {
            return res.status(401).json({ 
                success: false, 
                message: 'Sessão inválida ou expirada' 
            });
        }

        res.json({
            success: true,
            user: usuario
        });
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno no servidor' 
        });
    }
});

// Logout
app.post("/logout", async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ 
                success: false, 
                message: 'Token não fornecido' 
            });
        }

        const sessoes = await readData('sessoes');
        
        if (sessoes.sessoes[token]) {
            const email = sessoes.sessoes[token].email;
            delete sessoes.sessoes[token];
            await writeData('sessoes', sessoes);
            await registrarLog('logout', { email });
            
            res.json({ 
                success: true, 
                message: 'Logout realizado com sucesso' 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Sessão não encontrada' 
            });
        }
    } catch (error) {
        console.error('Erro no logout:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno no servidor' 
        });
    }
});

// ========== ROTAS DO PAINEL ADMIN ==========

// Health Check
app.get("/health", async (req, res) => {
    const academias = await readData('academias');
    const proprietarios = await readData('proprietarios');
    const personais = await readData('personais');
    const dbUsuarios = await readData('usuarios');
    
    const personaisAtivos = personais.filter(p => p.status === 'ativo').length;
    const personaisPendentes = personais.filter(p => p.status === 'pendente').length;
    
    res.json({ 
        status: "online",
        message: "Servidor GYM P2 UNIFICADO funcionando perfeitamente!",
        timestamp: new Date().toISOString(),
        stats: {
            academias: academias.length,
            proprietarios: proprietarios.length,
            personais: personais.length,
            personais_ativos: personaisAtivos,
            personais_pendentes: personaisPendentes,
            usuarios: dbUsuarios.total_usuarios || 0
        }
    });
});

app.get("/api/health", async (req, res) => {
    const academias = await readData('academias');
    const proprietarios = await readData('proprietarios');
    const personais = await readData('personais');
    const dbUsuarios = await readData('usuarios');
    
    res.json({ 
        status: "online",
        message: "API GYM P2 Unificada Online!",
        academias: academias.length,
        proprietarios: proprietarios.length,
        personais: personais.length,
        usuarios: dbUsuarios.total_usuarios || 0
    });
});

// Status do sistema
app.get("/stats", async (req, res) => {
    try {
        const db = await readData('usuarios');
        const sessoes = await readData('sessoes');
        const academias = await readData('academias');
        const proprietarios = await readData('proprietarios');
        const personais = await readData('personais');

        const loginsHoje = db.logs ? db.logs.filter(log => {
            const hoje = new Date().toDateString();
            const logDate = new Date(log.timestamp).toDateString();
            return log.tipo === 'login_sucesso' && logDate === hoje;
        }).length : 0;

        const personaisAtivos = personais.filter(p => p.status === 'ativo').length;
        const personaisPendentes = personais.filter(p => p.status === 'pendente').length;

        res.json({
            sistema: "GYM P2 - Sistema Unificado",
            total_usuarios: db.total_usuarios || 0,
            sessoes_ativas: Object.keys(sessoes.sessoes || {}).length,
            logins_hoje: loginsHoje,
            total_logs: db.logs ? db.logs.length : 0,
            academias: academias.length,
            proprietarios: proprietarios.length,
            personais: personais.length,
            personais_ativos: personaisAtivos,
            personais_pendentes: personaisPendentes
        });
    } catch (error) {
        console.error('Erro ao obter stats:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ========== ACADEMIAS ==========
app.get("/api/academias", async (req, res) => {
    const academias = await readData('academias');
    const proprietarios = await readData('proprietarios');
    
    const result = academias.map(a => ({
        ...a,
        proprietario_nome: proprietarios.find(p => p.id === a.proprietario_id)?.nome || "Não informado"
    }));
    
    res.json(result);
});

app.get("/api/academias/stats", async (req, res) => {
    const academias = await readData('academias');
    res.json({
        ativas: academias.filter(a => a.status === 'ativo').length,
        inativas: academias.filter(a => a.status === 'inativo').length,
        total: academias.length
    });
});

app.get("/api/academias/:id", async (req, res) => {
    const academias = await readData('academias');
    const proprietarios = await readData('proprietarios');
    const academia = academias.find(a => a.id == req.params.id);
    
    if (academia) {
        const proprietario = proprietarios.find(p => p.id === academia.proprietario_id);
        res.json({ ...academia, proprietario_nome: proprietario?.nome || "Não informado" });
    } else {
        res.status(404).json({ error: 'Academia não encontrada' });
    }
});

app.post('/api/academias', async (req, res) => {
    const academias = await readData('academias');
    const nova = { 
        id: Date.now(), 
        ...req.body, 
        data_cadastro: new Date().toISOString() 
    };
    academias.push(nova);
    await writeData('academias', academias);
    io.emit('academia-criada', nova);
    res.status(201).json(nova);
});

app.put('/api/academias/:id', async (req, res) => {
    const academias = await readData('academias');
    const index = academias.findIndex(a => a.id == req.params.id);
    
    if (index !== -1) {
        academias[index] = { 
            ...academias[index], 
            ...req.body, 
            data_atualizacao: new Date().toISOString() 
        };
        await writeData('academias', academias);
        io.emit('academia-atualizada', academias[index]);
        res.json(academias[index]);
    } else {
        res.status(404).json({ error: 'Academia não encontrada' });
    }
});

app.delete('/api/academias/:id', async (req, res) => {
    let academias = await readData('academias');
    const index = academias.findIndex(a => a.id == req.params.id);
    
    if (index !== -1) {
        const academiaExcluida = academias[index];
        academias.splice(index, 1);
        await writeData('academias', academias);
        io.emit('academia-excluida', req.params.id);
        res.json({ 
            success: true, 
            message: 'Academia excluída com sucesso',
            academia: academiaExcluida
        });
    } else {
        res.status(404).json({ error: 'Academia não encontrada' });
    }
});

// ========== PROPRIETÁRIOS ==========
app.get("/api/proprietarios", async (req, res) => {
    const proprietarios = await readData('proprietarios');
    res.json(proprietarios);
});

app.get("/api/proprietarios/:id", async (req, res) => {
    const proprietarios = await readData('proprietarios');
    const p = proprietarios.find(x => x.id == req.params.id);
    p ? res.json(p) : res.status(404).json({ error: 'Proprietário não encontrado' });
});

app.post('/api/proprietarios', async (req, res) => {
    const proprietarios = await readData('proprietarios');
    const novo = { 
        id: Date.now(), 
        ...req.body, 
        data_cadastro: new Date().toISOString() 
    };
    proprietarios.push(novo);
    await writeData('proprietarios', proprietarios);
    io.emit('proprietario-criado', novo);
    res.status(201).json(novo);
});

app.put('/api/proprietarios/:id', async (req, res) => {
    const proprietarios = await readData('proprietarios');
    const index = proprietarios.findIndex(p => p.id == req.params.id);
    
    if (index !== -1) {
        proprietarios[index] = { 
            ...proprietarios[index], 
            ...req.body, 
            data_atualizacao: new Date().toISOString() 
        };
        await writeData('proprietarios', proprietarios);
        io.emit('proprietario-atualizado', proprietarios[index]);
        res.json(proprietarios[index]);
    } else {
        res.status(404).json({ error: 'Proprietário não encontrado' });
    }
});

app.delete('/api/proprietarios/:id', async (req, res) => {
    let proprietarios = await readData('proprietarios');
    const index = proprietarios.findIndex(p => p.id == req.params.id);
    
    if (index !== -1) {
        const proprietarioExcluido = proprietarios[index];
        proprietarios.splice(index, 1);
        await writeData('proprietarios', proprietarios);
        io.emit('proprietario-excluido', req.params.id);
        res.json({ 
            success: true, 
            message: 'Proprietário excluído com sucesso',
            proprietario: proprietarioExcluido
        });
    } else {
        res.status(404).json({ error: 'Proprietário não encontrado' });
    }
});

// ========== PERSONAIS ==========
app.get("/api/personais", async (req, res) => {
    const personais = await readData('personais');
    const academias = await readData('academias');
    
    const result = personais.map(p => ({
        ...p,
        academia: academias.find(a => a.id === p.academia_id)?.nome || "Independente"
    }));
    
    res.json(result);
});

app.get("/api/personais/ativos", async (req, res) => {
    try {
        const personais = await readData('personais');
        const academias = await readData('academias');
        
        console.log(`📊 Total de personais no banco: ${personais.length}`);
        
        // Filtrar apenas personais com status "ativo"
        const personaisAtivos = personais.filter(p => p.status === 'ativo');
        
        console.log(`✅ Personais ativos: ${personaisAtivos.length}`);
        
        // Enriquecer dados dos personais
        const result = personaisAtivos.map(p => {
            const academiaInfo = p.academia_id ? 
                academias.find(a => a.id == p.academia_id) : null;
            
            return {
                id: p.id,
                nome: p.nome,
                email: p.email,
                telefone: p.telefone,
                foto: p.foto || '',
                especialidade: p.especialidade,
                anos_experiencia: p.anos_experiencia || 3,
                status: p.status,
                descricao: p.descricao || p.sobre || '',
                
                // Campos extras para o filtro
                genero: p.genero || 'Masculino',
                formacao: p.formacao || 'Educação Física',
                horarios: p.horarios || 'Seg-Sex: 6h-22h',
                cidade: p.cidade || 'São Paulo',
                bairros: p.bairros || [],
                
                // Academia
                academia_id: p.academia_id || null,
                academia: academiaInfo?.nome || 'Independente',
                academia_cidade: academiaInfo?.cidade || null,
                
                // Modalidades (presencial/online)
                modalidades: p.modalidades ? 
                    (typeof p.modalidades === 'string' ? 
                        JSON.parse(p.modalidades) : p.modalidades) 
                    : ['Presencial'],
                
                // Especializações
                especializacoes: p.especializacoes ? 
                    (typeof p.especializacoes === 'string' ? 
                        JSON.parse(p.especializacoes) : p.especializacoes)
                    : [p.especialidade],
                
                // Avaliações
                avaliacoes: p.avaliacoes || 5.0,
                numero_avaliacoes: p.numero_avaliacoes || 0,
                numero_clientes: p.numero_clientes || 0,
                
                // Datas
                data_cadastro: p.data_cadastro,
                data_atualizacao: p.data_atualizacao || p.data_cadastro
            };
        });
        
        console.log(`📤 Enviando ${result.length} personais ativos para o filtro`);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Erro ao buscar personais ativos:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao carregar personais',
            details: error.message 
        });
    }
});

app.post('/api/personais', async (req, res) => {
    try {
        const personais = await readData('personais');
        
        const novo = { 
            id: Date.now(), 
            ...req.body, 
            data_cadastro: new Date().toISOString(),
            status: req.body.status || 'pendente' // Default: pendente
        };
        
        personais.push(novo);
        await writeData('personais', personais);
        
        // ✅ ADICIONAR: Notificar via WebSocket
        io.emit('personal-criado', novo);
        
        // Se já for criado como ativo, notificar filtro público
        if (novo.status === 'ativo') {
            io.to('public-updates').emit('personal-aprovado', novo);
        }
        
        console.log(`✅ Personal criado: ${novo.nome} (Status: ${novo.status})`);
        
        res.status(201).json(novo);
    } catch (error) {
        console.error('❌ Erro ao criar personal:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/personais/:id', async (req, res) => {
    try {
        const personais = await readData('personais');
        const index = personais.findIndex(p => p.id == req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Personal não encontrado' });
        }
        
        const statusAnterior = personais[index].status;
        
        personais[index] = { 
            ...personais[index], 
            ...req.body, 
            data_atualizacao: new Date().toISOString() 
        };
        
        await writeData('personais', personais);
        
        const personalAtualizado = personais[index];
        
        // ✅ ADICIONAR: Notificar via WebSocket
        io.emit('personal-atualizado', personalAtualizado);
        
        // Se mudou de pendente para ativo, notificar filtro público
        if (statusAnterior !== 'ativo' && personalAtualizado.status === 'ativo') {
            console.log(`🎉 Personal APROVADO: ${personalAtualizado.nome}`);
            io.to('public-updates').emit('personal-aprovado', personalAtualizado);
            io.emit('personal-aprovado', personalAtualizado); // Para painel admin também
        }
        
        // Se mudou para ativo, notificar filtro público
        if (personalAtualizado.status === 'ativo') {
            io.to('public-updates').emit('personal-atualizado', personalAtualizado);
        }
        
        console.log(`✅ Personal atualizado: ${personalAtualizado.nome}`);
        
        res.json(personalAtualizado);
    } catch (error) {
        console.error('❌ Erro ao atualizar personal:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/personais/:id', async (req, res) => {
    try {
        let personais = await readData('personais');
        const index = personais.findIndex(p => p.id == req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Personal não encontrado' });
        }
        
        const personalExcluido = personais[index];
        personais.splice(index, 1);
        await writeData('personais', personais);
        
        // ✅ ADICIONAR: Notificar via WebSocket
        io.emit('personal-excluido', req.params.id);
        io.to('public-updates').emit('personal-excluido', req.params.id);
        
        console.log(`🗑️ Personal excluído: ${personalExcluido.nome}`);
        
        res.json({ 
            success: true, 
            message: 'Personal excluído com sucesso',
            personal: personalExcluido
        });
    } catch (error) {
        console.error('❌ Erro ao excluir personal:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== APROVAR MÚLTIPLOS PERSONAIS ==========
app.post('/api/personais/aprovar-pendentes', async (req, res) => {
    try {
        const personais = await readData('personais');
        
        // Filtrar personais pendentes
        const pendentes = personais.filter(p => p.status === 'pendente');
        
        if (pendentes.length === 0) {
            return res.json({
                success: true,
                message: 'Não há personais pendentes',
                aprovados: 0
            });
        }
        
        // Aprovar todos
        let aprovados = 0;
        pendentes.forEach(p => {
            const index = personais.findIndex(personal => personal.id === p.id);
            if (index !== -1) {
                personais[index].status = 'ativo';
                personais[index].data_aprovacao = new Date().toISOString();
                aprovados++;
                
                // Notificar cada aprovação
                io.emit('personal-aprovado', personais[index]);
                io.to('public-updates').emit('personal-aprovado', personais[index]);
            }
        });
        
        await writeData('personais', personais);
        
        console.log(`✅ ${aprovados} personais aprovados em massa`);
        
        res.json({
            success: true,
            message: `${aprovados} personais aprovados com sucesso`,
            aprovados: aprovados
        });
        
    } catch (error) {
        console.error('❌ Erro ao aprovar personais em massa:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ESTATÍSTICAS DE PERSONAIS ==========
app.get("/api/personais/stats", async (req, res) => {
    try {
        const personais = await readData('personais');
        
        const stats = {
            total: personais.length,
            ativos: personais.filter(p => p.status === 'ativo').length,
            pendentes: personais.filter(p => p.status === 'pendente').length,
            inativos: personais.filter(p => p.status === 'inativo').length,
            
            // Por especialidade
            especialidades: {},
            
            // Por cidade
            cidades: {},
            
            // Média de experiência
            media_experiencia: 0
        };
        
        // Contar por especialidade
        personais.forEach(p => {
            if (p.especialidade) {
                stats.especialidades[p.especialidade] = 
                    (stats.especialidades[p.especialidade] || 0) + 1;
            }
            
            if (p.cidade) {
                stats.cidades[p.cidade] = 
                    (stats.cidades[p.cidade] || 0) + 1;
            }
        });
        
        // Calcular média de experiência
        const totalExperiencia = personais.reduce((sum, p) => 
            sum + (p.anos_experiencia || 0), 0);
        stats.media_experiencia = personais.length > 0 ? 
            (totalExperiencia / personais.length).toFixed(1) : 0;
        
        res.json(stats);
        
    } catch (error) {
        console.error('❌ Erro ao calcular estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/personais/:id", async (req, res) => {
    try {
        const personais = await readData('personais');
        const academias = await readData('academias');
        
        const personal = personais.find(p => p.id == req.params.id);
        
        if (personal) {
            const academiaInfo = personal.academia_id ? 
                academias.find(a => a.id == personal.academia_id) : null;
            
            const response = {
                ...personal,
                academia: academiaInfo?.nome || "Independente",
                academia_info: academiaInfo || null
            };
            
            console.log(`✅ Personal encontrado: ${personal.nome} (ID: ${personal.id})`);
            res.json(response);
        } else {
            res.status(404).json({ 
                error: 'Personal não encontrado'
            });
        }
    } catch (error) {
        console.error('❌ Erro ao buscar personal:', error);
        res.status(500).json({ 
            error: 'Erro interno ao buscar personal',
            details: error.message 
        });
    }
});

// ========== ADMINISTRADORES - CRUD COMPLETO ==========
app.get("/api/administradores", async (req, res) => {
    try {
        const admins = await readData('admins');
        res.json(admins);
    } catch (error) {
        console.error('Erro ao buscar administradores:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.get("/api/administradores/:id", async (req, res) => {
    try {
        const admins = await readData('admins');
        const admin = admins.find(a => a.id == req.params.id);
        
        if (admin) {
            // Não retornar senha
            const { senha, ...adminSemSenha } = admin;
            res.json(adminSemSenha);
        } else {
            res.status(404).json({ error: 'Administrador não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao buscar administrador:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.post('/api/administradores', async (req, res) => {
    try {
        const { nome, email, senha, nivel, status, telefone, observacoes } = req.body;

        // Validações
        if (!nome || !email || !senha || !nivel) {
            return res.status(400).json({ 
                error: 'Nome, email, senha e nível são obrigatórios' 
            });
        }

        if (senha.length < 6) {
            return res.status(400).json({ 
                error: 'Senha deve ter no mínimo 6 caracteres' 
            });
        }

        const admins = await readData('admins');

        // Verificar se email já existe
        const emailExistente = admins.find(a => a.email === email);
        if (emailExistente) {
            return res.status(400).json({ 
                error: 'Este e-mail já está cadastrado' 
            });
        }

        // Gerar hash da senha
        const { hash, salt } = hashPassword(senha);

        const novoAdmin = {
            id: Date.now(),
            nome,
            email,
            senha: hash,
            salt: salt,
            nivel: nivel,
            status: status || 'ativo',
            telefone: telefone || '',
            observacoes: observacoes || '',
            data_cadastro: new Date().toISOString(),
            ultimo_acesso: null,
            criado_por: req.user?.email || 'sistema'
        };

        admins.push(novoAdmin);
        await writeData('admins', admins);

        // Notificar via WebSocket
        io.emit('admin-criado', { id: novoAdmin.id, nome: novoAdmin.nome, email: novoAdmin.email });

        // Registrar log
        await registrarLog('admin_criado', {
            admin_email: email,
            criado_por: req.user?.email || 'sistema',
            nivel: nivel
        });

        // Não retornar senha na resposta
        const { senha: _, salt: __, ...adminResponse } = novoAdmin;
        
        res.status(201).json(adminResponse);
    } catch (error) {
        console.error('Erro ao criar administrador:', error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

app.put('/api/administradores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, email, senha, nivel, status, telefone, observacoes } = req.body;

        const admins = await readData('admins');
        const adminIndex = admins.findIndex(a => a.id == id);

        if (adminIndex === -1) {
            return res.status(404).json({ error: 'Administrador não encontrado' });
        }

        // Não permitir alterar super admin se não for super admin
        if (admins[adminIndex].nivel === 'super_admin' && req.user?.role !== 'super_admin') {
            return res.status(403).json({ 
                error: 'Apenas super administradores podem modificar outros super admins' 
            });
        }

        // Verificar se email já está em uso por outro admin
        if (email && email !== admins[adminIndex].email) {
            const emailExistente = admins.find(a => a.email === email && a.id != id);
            if (emailExistente) {
                return res.status(400).json({ 
                    error: 'Este e-mail já está em uso por outro administrador' 
                });
            }
        }

        // Atualizar dados
        admins[adminIndex].nome = nome || admins[adminIndex].nome;
        admins[adminIndex].email = email || admins[adminIndex].email;
        admins[adminIndex].nivel = nivel || admins[adminIndex].nivel;
        admins[adminIndex].status = status || admins[adminIndex].status;
        admins[adminIndex].telefone = telefone;
        admins[adminIndex].observacoes = observacoes;
        admins[adminIndex].data_atualizacao = new Date().toISOString();

        // Atualizar senha se fornecida
        if (senha) {
            if (senha.length < 6) {
                return res.status(400).json({ 
                    error: 'Senha deve ter no mínimo 6 caracteres' 
                });
            }
            const { hash, salt } = hashPassword(senha);
            admins[adminIndex].senha = hash;
            admins[adminIndex].salt = salt;
        }

        await writeData('admins', admins);

        // Notificar via WebSocket
        io.emit('admin-atualizado', { id, nome: admins[adminIndex].nome });

        // Registrar log
        await registrarLog('admin_atualizado', {
            admin_id: id,
            atualizado_por: req.user?.email || 'sistema'
        });

        // Não retornar senha na resposta
        const { senha: _, salt: __, ...adminResponse } = admins[adminIndex];
        
        res.json(adminResponse);
    } catch (error) {
        console.error('Erro ao atualizar administrador:', error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

app.delete('/api/administradores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const admins = await readData('admins');
        const adminIndex = admins.findIndex(a => a.id == id);

        if (adminIndex === -1) {
            return res.status(404).json({ error: 'Administrador não encontrado' });
        }

        const admin = admins[adminIndex];

        // Não permitir excluir super admins
        if (admin.nivel === 'super_admin') {
            return res.status(403).json({ 
                error: 'Não é possível excluir um Super Administrador' 
            });
        }

        // Não permitir excluir a si mesmo
        if (req.user?.email === admin.email) {
            return res.status(403).json({ 
                error: 'Você não pode excluir sua própria conta' 
            });
        }

        // Verificar se é o último admin ativo
        const adminsAtivos = admins.filter(a => a.status === 'ativo' && a.id != id);
        if (adminsAtivos.length === 0) {
            return res.status(403).json({ 
                error: 'Não é possível excluir o último administrador ativo' 
            });
        }

        // Remover admin
        const adminExcluido = admins.splice(adminIndex, 1)[0];
        await writeData('admins', admins);

        // Notificar via WebSocket
        io.emit('admin-excluido', id);

        // Registrar log
        await registrarLog('admin_excluido', {
            admin_email: adminExcluido.email,
            excluido_por: req.user?.email || 'sistema'
        });

        res.json({ 
            success: true, 
            message: 'Administrador excluído com sucesso',
            admin: { id: adminExcluido.id, nome: adminExcluido.nome, email: adminExcluido.email }
        });
    } catch (error) {
        console.error('Erro ao excluir administrador:', error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

async function getDashboardStats() {
    const academias = await readData('academias');
    const proprietarios = await readData('proprietarios');
    const personais = await readData('personais');
    const dbUsuarios = await readData('usuarios');
    const sessoes = await readData('sessoes');
    
    const personaisAtivos = personais.filter(p => p.status === 'ativo').length;
    const personaisPendentes = personais.filter(p => p.status === 'pendente').length;
    
    return {
        total_academias: academias.length,
        academias_ativas: academias.filter(a => a.status === 'ativo').length,
        total_proprietarios: proprietarios.length,
        total_personais: personais.length,
        personais_ativos: personaisAtivos,
        personais_pendentes: personaisPendentes,
        total_usuarios: dbUsuarios.total_usuarios || 0,
        sessoes_ativas: Object.keys(sessoes.sessoes || {}).length
    };
}

// ========== WEBSOCKET ==========
io.on('connection', (socket) => {
    console.log('✅ Cliente WebSocket conectado:', socket.id);
    
    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`📍 Cliente ${socket.id} entrou na sala: ${room}`);
    });
    
    // Sala para atualizações públicas
    socket.on('subscribe-public', () => {
        socket.join('public-updates');
        console.log(`🌐 Cliente ${socket.id} inscrito em atualizações públicas`);
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
    });
    
    // Eventos personalizados
    socket.on('atualizar-dashboard', async () => {
        const stats = await getDashboardStats();
        io.emit('dashboard-atualizado', stats);
    });
});

// ========== ROTA PARA SERVER STATUS ==========
app.get("/status", (req, res) => {
    res.json({ 
        status: 'online',
        timestamp: new Date().toISOString(),
        sistema: 'GYM P2 - Servidor Unificado',
        versao: '1.0.0'
    });
});

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

// ========== ROTAS DE SINCRONIZAÇÃO ==========

// Rota específica para página pública buscar academias
app.get("/api/public/academias", async (req, res) => {
    try {
        const academias = await readData('academias');
        const proprietarios = await readData('proprietarios');
        
        // Filtrar apenas academias ativas para o público
        const academiasAtivas = academias.filter(a => a.status === 'ativo');
        
        const result = academiasAtivas.map(a => ({
            id: a.id,
            nome: a.nome,
            displayName: a.nome,
            tipo: a.tipo || 'musculacao',
            preco: a.preco || 60,
            endereco: a.endereco || '',
            cidade: a.cidade || '',
            estado: a.estado || '',
            telefone: a.telefone || '',
            email: a.email || '',
            foto: a.foto || 'https://via.placeholder.com/320x200/1a1a1a/28a745?text=Academia+Gym+P2',
            facilidades: a.facilidades || [],
            horario: {
                abertura: a.abertura || '06:00',
                fechamento: a.fechamento || '22:00'
            },
            schedule: {
                weekdays: `${a.abertura || '06:00'} - ${a.fechamento || '22:00'}`,
                weekend: '08:00 - 17:00'
            },
            status: a.status || 'ativo',
            data_atualizacao: a.data_atualizacao || a.data_cadastro,
            // Dados extras para a página pública
            location: a.localizacao || 'centro',
            address: a.endereco || '',
            description: a.descricao || '',
            adminData: {
                descricao: a.descricao,
                email: a.email,
                telefone: a.telefone,
                cnpj: a.cnpj
            }
        }));
        
        res.json({
            success: true,
            data: result,
            total: result.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erro ao buscar academias públicas:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao carregar academias' 
        });
    }
});

// Rota específica para cadastro de personais (para formulário público)
app.post('/api/personais/cadastro', async (req, res) => {
    try {
        const {
            nome, telefone, email, cidade, bairros,
            especialidade, anos_experiencia, cref,
            sobre, expectativas
        } = req.body;

        // Validações básicas
        if (!nome || !telefone || !email || !cidade || !bairros || !especialidade || !anos_experiencia) {
            return res.status(400).json({ 
                success: false, 
                error: 'Campos obrigatórios faltando' 
            });
        }

        // Ler personais existentes
        const personais = await readData('personais');
        
        // Criar novo personal
        const novoPersonal = {
            id: Date.now(),
            nome,
            telefone,
            email,
            cidade,
            bairros: bairros.split(',').map(b => b.trim()),
            especialidade,
            anos_experiencia: parseInt(anos_experiencia),
            cref: cref || '',
            sobre,
            expectativas,
            data_cadastro: new Date().toISOString(),
            status: 'pendente',
            tipo: 'independente',
            avaliacao: 0,
            experiencia: `${anos_experiencia} ano(s)`
        };

        // Adicionar ao array
        personais.push(novoPersonal);
        
        // Salvar no arquivo
        await writeData('personais', personais);

        // Registrar log
        await registrarLog('personal_cadastrado', {
            id: novoPersonal.id,
            nome: novoPersonal.nome,
            email: novoPersonal.email,
            cidade: novoPersonal.cidade
        });

        // Notificar via WebSocket
        io.emit('personal-cadastrado', novoPersonal);

        res.status(201).json({
            success: true,
            message: 'Cadastro realizado com sucesso! Aguarde aprovação.',
            data: novoPersonal
        });

    } catch (error) {
        console.error('Erro no cadastro de personal:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno no servidor' 
        });
    }
});

// ========== TESTE DE INTEGRAÇÃO ==========
app.get('/api/test/personais-filtro', async (req, res) => {
    try {
        const personais = await readData('personais');
        
        console.log('\n🧪 TESTE DE INTEGRAÇÃO PERSONAIS → FILTRO');
        console.log('═══════════════════════════════════════════');
        console.log(`Total de personais: ${personais.length}`);
        
        const ativos = personais.filter(p => p.status === 'ativo');
        console.log(`Personais ativos: ${ativos.length}`);
        
        const pendentes = personais.filter(p => p.status === 'pendente');
        console.log(`Personais pendentes: ${pendentes.length}`);
        
        console.log('\n📋 Dados que serão enviados para o filtro:');
        ativos.forEach((p, i) => {
            console.log(`\n${i + 1}. ${p.nome}`);
            console.log(`   - ID: ${p.id}`);
            console.log(`   - Status: ${p.status}`);
            console.log(`   - Especialidade: ${p.especialidade}`);
            console.log(`   - Experiência: ${p.anos_experiencia} anos`);
            console.log(`   - Foto: ${p.foto ? '✅ Tem' : '❌ Não tem'}`);
            console.log(`   - Cidade: ${p.cidade || 'Não informado'}`);
        });
        
        console.log('═══════════════════════════════════════════\n');
        
        res.json({
            success: true,
            total: personais.length,
            ativos: ativos.length,
            pendentes: pendentes.length,
            dados_ativos: ativos.map(p => ({
                id: p.id,
                nome: p.nome,
                status: p.status,
                especialidade: p.especialidade,
                tem_foto: !!p.foto
            }))
        });
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== INICIAR SERVIDOR ==========
async function startServer() {
    await initDataDir();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🏋️  GYM P2 SERVER UNIFICADO ONLINE 🚀                 ║
╠══════════════════════════════════════════════════════════════╣
║  🌐 URL: http://localhost:${PORT}                            ║
║  🔐 Sistema: Autenticação + Painel Admin                    ║
║  📊 Dashboard: /api/protegido/dashboard (protegido)         ║
║  📄 Painel: /painel-administrativo.html                     ║
║  🔍 Health: /health                                         ║
║  📈 Stats: /stats                                           ║
║  💾 Persistência: ✅ ATIVADA                                ║
║  🔒 Segurança: PBKDF2 + SHA512 + Tokens JWT-like           ║
║  📁 Dados salvos em: ./data/                                ║
╚══════════════════════════════════════════════════════════════╝
        `);
        
        console.log('\n✅ Rotas disponíveis:');
        console.log('   POST /cadastro');
        console.log('   POST /login');
        console.log('   POST /verificar-sessao');
        console.log('   POST /logout');
        console.log('   GET  /health');
        console.log('   GET  /stats');
        console.log('   GET  /status');
        console.log('   GET  /api/academias');
        console.log('   GET  /api/proprietarios');
        console.log('   GET  /api/personais');
        console.log('   GET  /api/personais/ativos ⭐ NOVO');
        console.log('   GET  /api/personais/stats ⭐ NOVO');
        console.log('   POST /api/personais/aprovar-pendentes ⭐ NOVO');
        console.log('   GET  /api/test/personais-filtro ⭐ NOVO');
        console.log('   GET  /api/public/academias');
        console.log('   GET  /api/administradores');
        console.log('\n💡 Pressione Ctrl+C para parar\n');
    });
}

startServer();

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada não tratada:', reason);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor GYM P2 rodando na porta", PORT);
});
