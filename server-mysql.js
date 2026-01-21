// serve-supabase.js - Servidor GYM P2 EXCLUSIVO PARA SUPABASE
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ========== CONFIGURAÇÃO ==========
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Arquivos de backup
const FILES = {
    academias: path.join(DATA_DIR, 'academias.json'),
    proprietarios: path.join(DATA_DIR, 'proprietarios.json'),
    personais: path.join(DATA_DIR, 'personais.json'),
    admins: path.join(DATA_DIR, 'admins.json'),
    usuarios: path.join(DATA_DIR, 'usuarios.json'),
    sessoes: path.join(DATA_DIR, 'sessoes.json')
};

// ========== CONEXÃO SUPABASE ==========
let supabase = null;
let supabaseEnabled = false;

async function initSupabase() {
    try {
        console.log('🔌 Conectando ao Supabase...');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados no .env');
        }
        
        supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: false
            }
        });
        
        // Testar conexão
        const { error } = await supabase
            .from('usuarios')
            .select('*')
            .limit(1);
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        console.log('✅ Supabase conectado com sucesso!');
        supabaseEnabled = true;
        
        // Criar usuário admin padrão se não existir
        await criarUsuarioAdmin();
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar Supabase:', error.message);
        return false;
    }
}

// ========== FUNÇÃO PARA CRIAR USUÁRIO ADMIN PADRÃO ==========
async function criarUsuarioAdmin() {
    if (!supabaseEnabled) {
        console.log('⚠️  Supabase não disponível, não criando admin');
        return;
    }
    
    try {
        // Verificar se já existe usuário admin
        const { data: existingAdmin, error: fetchError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', 'admin@ifpi.edu.br')
            .maybeSingle();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('❌ Erro ao verificar admin existente:', fetchError.message);
            return;
        }
        
        if (existingAdmin) {
            console.log('✅ Usuário admin já existe');
            return;
        }
        
        // Gerar hash para senha "123456"
        const { hash, salt } = hashPassword('123456');
        
        console.log('👤 Criando usuário admin...');
        
        // Criar usuário admin
        const usuarioData = {
            name: 'Administrador',
            email: 'admin@ifpi.edu.br',
            passwordhash: hash,
            passwordsalt: salt,
            role: 'admin',
            status: 'ativo',
            criado_em: new Date().toISOString()
        };
        
        const { error: insertError, data: result } = await supabase
            .from('usuarios')
            .insert([usuarioData])
            .select();
        
        if (insertError) {
            console.error('❌ Erro ao criar admin:', insertError.message);
        } else {
            console.log('✅ Usuário admin criado com sucesso!');
            console.log('📧 Email: admin@ifpi.edu.br');
            console.log('🔑 Senha: 123456');
            console.log('🆔 ID:', result[0]?.id);
        }
        
        // Salvar no arquivo JSON também
        await saveToFile('usuarios', {
            name: 'Administrador',
            email: 'admin@ifpi.edu.br',
            passwordHash: hash,
            passwordSalt: salt,
            role: 'admin',
            status: 'ativo',
            criado_em: new Date().toISOString()
        }, 'admin@ifpi.edu.br');
        
    } catch (error) {
        console.error('❌ Erro na criação do admin:', error.message);
    }
}

// ========== MIDDLEWARE ==========
// CORS completo
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Expose-Headers', 'Content-Length, X-Total-Count');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    // Log simplificado para evitar poluição
    if (!req.url.includes('/health') && !req.url.includes('/favicon.ico')) {
        console.log(`📥 ${req.method} ${req.url}`);
    }
    next();
});

app.use(cors({ 
    origin: '*', 
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.')); // Serve todos arquivos da pasta atual

// ========== ROTAS PARA ARQUIVOS ESTÁTICOS ==========
app.get('/', (req, res) => {
    res.redirect('/login-gym.html');
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login-gym.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login-gym.html'));
});

// ========== FUNÇÕES UTILITÁRIAS ==========
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

function gerarToken() {
    return crypto.randomBytes(32).toString('hex');
}

function getDefaultImageByType(tipo) {
    const imagens = {
        'musculacao': 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=330&fit=crop&q=80',
        'artes-marciais': 'https://images.unsplash.com/photo-1549060279-7e168fce7090?w=600&h=330&fit=crop&q=80',
        'crossfit': 'https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?w=600&h=330&fit=crop&q=80',
        'yoga': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=330&fit=crop&q=80',
        'pilates': 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=600&h=330&fit=crop&q=80',
        'danca': 'https://images.unsplash.com/photo-1518693800412-ad92111a1d46?w=600&h=330&fit=crop&q=80',
        'outros': 'https://images.unsplash.com/photo-1534367507877-0edd93bd013b?w=600&h=330&fit=crop&q=80'
    };
    
    return imagens[tipo] || imagens['outros'];
}

// ========== INICIALIZAÇÃO ==========
async function initDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log('✅ Diretório de dados criado');
        
        // Conectar ao Supabase
        await initSupabase();
        
        // Criar arquivos JSON de backup
        for (const [key, filepath] of Object.entries(FILES)) {
            try {
                await fs.access(filepath);
            } catch {
                let initialData;
                if (key === 'usuarios') {
                    initialData = {
                        sistema: "Gymp2 - Supabase",
                        versao: "3.0",
                        total_usuarios: 0,
                        usuarios: {},
                        logs: []
                    };
                } else if (key === 'sessoes') {
                    initialData = { sessoes: {} };
                } else {
                    initialData = [];
                }
                await fs.writeFile(filepath, JSON.stringify(initialData, null, 2));
                console.log(`📄 Backup ${key}.json criado`);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao inicializar:', error);
    }
}

// ========== FUNÇÕES DE ARQUIVO (BACKUP) ==========
async function readData(type) {
    try {
        const data = await fs.readFile(FILES[type], 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return type === 'usuarios' || type === 'sessoes' ? {} : [];
    }
}

async function writeData(type, data) {
    try {
        await fs.writeFile(FILES[type], JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`❌ Erro ao salvar backup ${type}:`, error);
        return false;
    }
}

async function saveToFile(type, data, specificId) {
    try {
        const fileData = await readData(type);
        
        if (Array.isArray(fileData)) {
            let newId = specificId || Date.now();
            const index = fileData.findIndex(item => item.id == newId);
            
            if (index !== -1) {
                fileData[index] = { ...fileData[index], ...data, id: newId };
            } else {
                fileData.push({ id: newId, ...data });
            }
            
            await writeData(type, fileData);
            return newId;
            
        } else if (type === 'usuarios') {
            if (!fileData.usuarios) fileData.usuarios = {};
            const email = specificId || data.email;
            
            fileData.usuarios[email] = { 
                ...fileData.usuarios[email], 
                ...data,
                email: email
            };
            
            fileData.total_usuarios = Object.keys(fileData.usuarios).length;
            await writeData(type, fileData);
            return email;
            
        } else if (type === 'sessoes') {
            if (!fileData.sessoes) fileData.sessoes = {};
            const token = data.token || specificId;
            fileData.sessoes[token] = data;
            await writeData(type, fileData);
            return token;
        }
        
        return specificId;
    } catch (error) {
        console.error(`❌ Erro saveToFile ${type}:`, error);
        return null;
    }
}

// ========== SALVAR NO SUPABASE ==========
async function saveToSupabase(type, data, specificId) {
    if (!supabaseEnabled || !supabase) {
        console.log('⚠️  Supabase não disponível');
        return null;
    }
    
    try {
        console.log(`☁️ Tentando salvar ${type} no Supabase...`);
        
        switch(type) {
            case 'usuarios':
                // Verificar se usuário existe
                let usuarioExistente = null;
                const emailParaBuscar = specificId || data.email;
                
                if (emailParaBuscar) {
                    const { data: existingUser } = await supabase
                        .from('usuarios')
                        .select('*')
                        .eq('email', emailParaBuscar)
                        .maybeSingle();
                    
                    usuarioExistente = existingUser;
                }
                
                const usuarioData = {
                    name: data.name,
                    email: data.email,
                    passwordhash: data.passwordHash || data.password_hash || data.passwordhash,
                    passwordsalt: data.passwordSalt || data.password_salt || data.passwordsalt,
                    role: data.role || 'user',
                    criado_em: new Date().toISOString(),
                    ultimo_login: data.ultimo_login || null,
                    status: data.status || 'ativo'
                };
                
                if (usuarioExistente) {
                    const { error } = await supabase
                        .from('usuarios')
                        .update(usuarioData)
                        .eq('email', emailParaBuscar);
                    
                    if (error) throw error;
                    return emailParaBuscar;
                } else {
                    const { data: result, error } = await supabase
                        .from('usuarios')
                        .insert([usuarioData])
                        .select();
                    
                    if (error) throw error;
                    return result[0].id;
                }

            case 'academias':
                const academiaData = {
                    nome: data.nome,
                    cnpj: data.cnpj || null,
                    tipo: data.tipo,
                    preco: data.preco,
                    endereco: data.endereco,
                    cidade: data.cidade,
                    estado: data.estado,
                    telefone: data.telefone,
                    email: data.email,
                    descricao: data.descricao || null,
                    facilidades: data.facilidades || [],
                    abertura: data.abertura,
                    fechamento: data.fechamento,
                    status: data.status || 'ativo',
                    proprietario_id: data.proprietario_id || null,
                    criado_em: new Date().toISOString()
                };
                
                if (specificId) {
                    const { error } = await supabase
                        .from('academias')
                        .update(academiaData)
                        .eq('id', specificId);
                    if (error) throw error;
                    return specificId;
                } else {
                    const { data: result, error } = await supabase
                        .from('academias')
                        .insert([academiaData])
                        .select();
                    if (error) throw error;
                    return result[0].id;
                }

            case 'proprietarios':
                const proprietarioData = {
                    nome: data.nome,
                    email: data.email,
                    telefone: data.telefone,
                    cpf: data.cpf,
                    endereco: data.endereco,
                    cidade: data.cidade || null,
                    estado: data.estado || null,
                    descricao: data.descricao || null,
                    status: data.status || 'ativo',
                    criado_em: new Date().toISOString()
                };
                
                if (specificId) {
                    const { error } = await supabase
                        .from('proprietarios')
                        .update(proprietarioData)
                        .eq('id', specificId);
                    if (error) throw error;
                    return specificId;
                } else {
                    const { data: result, error } = await supabase
                        .from('proprietarios')
                        .insert([proprietarioData])
                        .select();
                    if (error) throw error;
                    return result[0].id;
                }

            case 'personais':
                const personalData = {
                    nome: data.nome,
                    telefone: data.telefone,
                    email: data.email,
                    cidade: data.cidade || null,
                    bairros: data.bairros || [],
                    especialidade: data.especialidade,
                    anos_experiencia: data.anos_experiencia || 0,
                    cref: data.cref || null,
                    sobre: data.sobre || null,
                    descricao: data.descricao || null,
                    expectativas: data.expectativas || null,
                    academia_id: data.academia_id || null,
                    status: data.status || 'pendente',
                    tipo: data.tipo || 'independente',
                    avaliacao: data.avaliacao || 0,
                    experiencia: data.experiencia || `${data.anos_experiencia || 0} ano(s)`,
                    criado_em: new Date().toISOString()
                };
                
                if (specificId) {
                    const { error } = await supabase
                        .from('personais')
                        .update(personalData)
                        .eq('id', specificId);
                    if (error) throw error;
                    return specificId;
                } else {
                    const { data: result, error } = await supabase
                        .from('personais')
                        .insert([personalData])
                        .select();
                    if (error) throw error;
                    return result[0].id;
                }

            case 'admins':
                const adminData = {
                    nome: data.nome,
                    email: data.email,
                    senha: data.senha,
                    salt: data.salt,
                    nivel: data.nivel || 'admin',
                    status: data.status || 'ativo',
                    telefone: data.telefone || null,
                    observacoes: data.observacoes || null,
                    criado_em: new Date().toISOString()
                };
                
                if (specificId) {
                    const { error } = await supabase
                        .from('administradores')
                        .update(adminData)
                        .eq('id', specificId);
                    if (error) throw error;
                    return specificId;
                } else {
                    const { data: result, error } = await supabase
                        .from('administradores')
                        .insert([adminData])
                        .select();
                    if (error) throw error;
                    return result[0].id;
                }

            case 'sessoes':
                const sessaoData = {
                    token: data.token || specificId,
                    email: data.email,
                    criado_em: Date.now(),
                    ip: data.ip || null
                };
                
                const { error } = await supabase
                    .from('sessoes')
                    .upsert([sessaoData]);
                
                if (error) throw error;
                return data.token;

            default:
                console.log(`⚠️ Tipo ${type} não suportado para Supabase`);
                return null;
        }
    } catch (error) {
        console.error(`❌ Erro Supabase ${type}:`, error.message);
        return null;
    }
}

// ========== LER DO SUPABASE ==========
async function readFromSupabase(type, specificId = null) {
    if (!supabaseEnabled || !supabase) {
        console.log(`📁 Supabase não disponível, lendo ${type} do arquivo`);
        return null;
    }
    
    try {
        console.log(`🔍 Lendo ${type} do Supabase...`);
        
        let query = supabase.from(type).select('*');
        
        if (specificId) {
            if (type === 'usuarios') {
                query = query.eq('email', specificId);
            } else if (type === 'sessoes') {
                query = query.eq('token', specificId);
            } else {
                query = query.eq('id', specificId);
            }
        }
        
        const { data, error } = await query;
        if (error) {
            console.error(`❌ Erro ao buscar ${type}:`, error.message);
            return null;
        }
        
        // Converter bigint para número se for do tipo sessoes
        if (type === 'sessoes' && data) {
            if (Array.isArray(data)) {
                data.forEach(item => {
                    if (item.criado_em && typeof item.criado_em === 'bigint') {
                        item.criado_em = Number(item.criado_em);
                    }
                });
            } else if (data.criado_em && typeof data.criado_em === 'bigint') {
                data.criado_em = Number(data.criado_em);
            }
        }
        
        return specificId ? (data[0] || null) : (data || []);
    } catch (error) {
        console.error(`❌ Erro ao ler ${type} do Supabase:`, error.message);
        return null;
    }
}

// ========== FUNÇÕES UNIFICADAS ==========
async function readDataUnified(type, specificId = null) {
    // Tenta Supabase primeiro
    if (supabaseEnabled) {
        const supabaseData = await readFromSupabase(type, specificId);
        if (supabaseData !== null) {
            return supabaseData;
        }
    }
    
    // Fallback para arquivo
    return await readData(type);
}

async function saveDataUnified(type, data, specificId = null) {
    let savedId = specificId;
    
    // 1. Salvar no Supabase (assíncrono)
    if (supabaseEnabled) {
        saveToSupabase(type, data, specificId)
            .then(supabaseId => {
                if (supabaseId) {
                    savedId = supabaseId;
                }
            })
            .catch(err => console.error(`⚠️ Erro ao salvar no Supabase ${type}:`, err.message));
    }
    
    // 2. Salvar no arquivo (backup) - também assíncrono
    saveToFile(type, data, savedId)
        .catch(err => console.error(`⚠️ Erro ao salvar arquivo ${type}:`, err.message));
    
    return savedId;
}

// ========== ROTAS PÚBLICAS DE ACADEMIAS (PARA PÁGINA PÚBLICA) ==========

// ROTA PÚBLICA: Todas as academias ativas (para página pública)
app.get("/api/academias-publicas", async (req, res) => {
    try {
        console.log('🌐 Página pública buscando academias...');
        
        if (!supabaseEnabled) {
            console.log('⚠️ Supabase não disponível, retornando array vazio');
            return res.json({
                success: true,
                academias: [],
                total: 0,
                message: 'Banco de dados temporariamente indisponível'
            });
        }
        
        console.log('🔍 Buscando academias no Supabase...');
        
        const { data, error } = await supabase
            .from('academias')
            .select('*')
            .eq('status', 'ativo')
            .order('nome', { ascending: true });
        
        if (error) {
            console.error('❌ Erro ao buscar academias:', error.message);
            return res.json({
                success: true,
                academias: [],
                total: 0,
                message: 'Erro ao buscar dados'
            });
        }
        
        console.log(`✅ Encontradas ${data?.length || 0} academias`);
        
        // Formatar resposta para página pública
        const academiasFormatadas = (data || []).map(academia => ({
            id: academia.id,
            nome: academia.nome || 'Academia',
            tipo: academia.tipo || 'musculacao',
            preco: academia.preco ? parseFloat(academia.preco).toFixed(2) : '0.00',
            endereco: academia.endereco || 'Endereço não informado',
            cidade: academia.cidade || '',
            estado: academia.estado || '',
            telefone: academia.telefone || '',
            email: academia.email || '',
            descricao: academia.descricao || '',
            abertura: academia.abertura || '06:00',
            fechamento: academia.fechamento || '22:00',
            facilidades: academia.facilidades || [],
            foto: academia.foto || getDefaultImageByType(academia.tipo),
            status: academia.status || 'ativo'
        }));
        
        res.json({
            success: true,
            academias: academiasFormatadas,
            total: academiasFormatadas.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro na rota pública:', error);
        res.json({
            success: true,
            academias: [],
            total: 0,
            message: 'Erro interno do servidor'
        });
    }
});

// ROTA PÚBLICA: Detalhes de uma academia (para página pública)
app.get("/api/academia-publica/:id", async (req, res) => {
    try {
        const id = req.params.id;
        console.log(`🔍 Página pública buscando academia ID: ${id}`);
        
        if (!supabaseEnabled) {
            return res.status(404).json({ 
                success: false,
                error: 'Banco de dados indisponível' 
            });
        }
        
        const { data, error } = await supabase
            .from('academias')
            .select('*')
            .eq('id', id)
            .eq('status', 'ativo')
            .single();
        
        if (error || !data) {
            return res.status(404).json({ 
                success: false,
                error: 'Academia não encontrada ou inativa' 
            });
        }
        
        res.json({
            success: true,
            academia: data
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar academia:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno' 
        });
    }
});

// ========== ROTAS DE AUTENTICAÇÃO (OTIMIZADAS) ==========
app.post("/cadastro", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        console.log(`📝 Cadastro: ${name} <${email}>`);

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Senha deve ter no mínimo 6 caracteres' });
        }

        // Verificar se existe
        let usuarioExistente = null;
        
        if (supabaseEnabled) {
            const { data } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', email)
                .maybeSingle();
            usuarioExistente = data;
        }
        
        if (!usuarioExistente) {
            const db = await readData('usuarios');
            usuarioExistente = db.usuarios ? db.usuarios[email] : null;
        }

        if (usuarioExistente) {
            return res.status(400).json({ success: false, message: 'Email já cadastrado' });
        }

        const { hash, salt } = hashPassword(password);

        const usuario = {
            name,
            email,
            passwordHash: hash,
            passwordSalt: salt,
            passwordhash: hash,
            passwordsalt: salt,
            role: 'user',
            criado_em: new Date().toISOString(),
            ultimo_login: null,
            status: 'ativo'
        };

        const savedId = await saveDataUnified('usuarios', usuario, email);

        res.json({ 
            success: true, 
            message: 'Conta criada com sucesso!',
            user: { name, email, role: 'user' }
        });
    } catch (error) {
        console.error('❌ Erro no cadastro:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
});

// ========== ROTA DE LOGIN OTIMIZADA ==========
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`🔐 Login: ${email}`);

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
        }

        // Buscar usuário - PRIMEIRO no Supabase
        let usuario = null;
        
        if (supabaseEnabled) {
            const { data } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', email)
                .maybeSingle();
            usuario = data;
            
            if (!usuario) {
                console.log(`❌ ${email} não encontrado no Supabase`);
            }
        }
        
        // Se não encontrou no Supabase, buscar no arquivo JSON
        if (!usuario) {
            const db = await readData('usuarios');
            usuario = db.usuarios ? db.usuarios[email] : null;
            if (!usuario) {
                console.log(`❌ ${email} não encontrado em nenhum lugar`);
                return res.status(401).json({ success: false, message: 'Email não encontrado' });
            }
        }

        // Verificar senha - versão simplificada e rápida
        let senhaCorreta = false;
        
        // 1. Formato Supabase (sem underline)
        if (usuario.passwordhash && usuario.passwordsalt) {
            senhaCorreta = verifyPassword(password, usuario.passwordhash, usuario.passwordsalt);
        }
        // 2. Formato com underline
        else if (usuario.password_hash && usuario.password_salt) {
            senhaCorreta = verifyPassword(password, usuario.password_hash, usuario.password_salt);
        }
        // 3. Formato JSON (camelCase)
        else if (usuario.passwordHash && usuario.passwordSalt) {
            senhaCorreta = verifyPassword(password, usuario.passwordHash, usuario.passwordSalt);
        }
        else {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }
        
        if (!senhaCorreta) {
            console.log(`❌ Senha incorreta para ${email}`);
            return res.status(401).json({ success: false, message: 'Senha incorreta' });
        }

        console.log(`✅ Login bem-sucedido: ${email}`);

        // Atualizar último login (FAZER ASSÍNCRONO para não bloquear resposta)
        const updateData = { ultimo_login: new Date().toISOString() };
        
        // Atualizar no Supabase (assíncrono)
        if (supabaseEnabled && usuario.id) {
            supabase
                .from('usuarios')
                .update(updateData)
                .eq('id', usuario.id)
                .catch(err => console.error('⚠️ Erro ao atualizar último login:', err.message));
        }
        
        // Atualizar no arquivo JSON (assíncrono)
        saveToFile('usuarios', updateData, email)
            .catch(err => console.error('⚠️ Erro ao atualizar arquivo JSON:', err.message));

        // Criar sessão
        const token = gerarToken();
        
        // Salvar sessão de forma ASSÍNCRONA (não bloquear resposta)
        const sessaoData = {
            token,
            email,
            criado_em: Date.now(),
            ip: req.ip || 'localhost'
        };
        
        // Salvar sessão assincronamente
        setTimeout(() => {
            saveDataUnified('sessoes', sessaoData, token)
                .catch(err => console.error('⚠️ Erro ao salvar sessão:', err.message));
        }, 100);
        
        // Responder IMEDIATAMENTE sem esperar operações de salvar
        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            token,
            user: { 
                name: usuario.name, 
                email: usuario.email, 
                role: usuario.role || 'user' 
            },
            redirect: 'index.html'
        });
        
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
});

// ========== ROTAS PARA VERIFICAÇÃO DE SESSÃO ==========
app.post("/verificar-sessao", async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.json({ success: false, message: 'Token não fornecido' });
        }
        
        // Buscar sessão no Supabase
        let sessao = null;
        if (supabaseEnabled) {
            const { data } = await supabase
                .from('sessoes')
                .select('*')
                .eq('token', token)
                .maybeSingle();
            sessao = data;
        }
        
        // Se não encontrou, buscar no arquivo
        if (!sessao) {
            const db = await readData('sessoes');
            sessao = db.sessoes ? db.sessoes[token] : null;
        }
        
        if (!sessao) {
            return res.json({ success: false, message: 'Sessão inválida' });
        }
        
        // Verificar se a sessão expirou (24 horas)
        const sessaoAge = Date.now() - sessao.criado_em;
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas
        
        if (sessaoAge > maxAge) {
            // Remover sessão expirada (assíncrono)
            if (supabaseEnabled) {
                supabase.from('sessoes').delete().eq('token', token)
                    .catch(err => console.error('⚠️ Erro ao remover sessão expirada:', err));
            }
            return res.json({ success: false, message: 'Sessão expirada' });
        }
        
        // Buscar informações do usuário
        let usuario = null;
        if (supabaseEnabled) {
            const { data } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', sessao.email)
                .maybeSingle();
            usuario = data;
        }
        
        if (!usuario) {
            const db = await readData('usuarios');
            usuario = db.usuarios ? db.usuarios[sessao.email] : null;
        }
        
        if (!usuario) {
            return res.json({ success: false, message: 'Usuário não encontrado' });
        }
        
        res.json({
            success: true,
            user: {
                name: usuario.name,
                email: usuario.email,
                role: usuario.role || 'user'
            }
        });
        
    } catch (error) {
        console.error('❌ Erro na verificação de sessão:', error);
        res.json({ success: false, message: 'Erro interno' });
    }
});

app.post("/logout", async (req, res) => {
    try {
        const { token } = req.body;
        
        if (token) {
            // Remover sessão do Supabase (assíncrono)
            if (supabaseEnabled) {
                supabase.from('sessoes').delete().eq('token', token)
                    .catch(err => console.error('⚠️ Erro ao remover sessão:', err));
            }
            
            // Remover do arquivo JSON (assíncrono)
            setTimeout(async () => {
                try {
                    const db = await readData('sessoes');
                    if (db.sessoes && db.sessoes[token]) {
                        delete db.sessoes[token];
                        await writeData('sessoes', db);
                    }
                } catch (err) {
                    console.error('⚠️ Erro ao remover sessão do arquivo:', err);
                }
            }, 100);
        }
        
        res.json({ success: true, message: 'Logout realizado' });
    } catch (error) {
        console.error('❌ Erro no logout:', error);
        res.json({ success: false, message: 'Erro interno' });
    }
});

// ========== CRUD ACADEMIAS (ADMIN) ==========
app.get("/api/academias", async (req, res) => {
    try {
        const academias = await readDataUnified('academias');
        const proprietarios = await readDataUnified('proprietarios');
        
        const academiasArray = Array.isArray(academias) ? academias : [];
        const proprietariosArray = Array.isArray(proprietarios) ? proprietarios : [];
        
        const result = academiasArray.map(a => ({
            ...a,
            proprietario_nome: proprietariosArray.find(p => p.id == a.proprietario_id)?.nome || "Não informado"
        }));
        
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar academias:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.get("/api/academias/:id", async (req, res) => {
    try {
        const academia = await readDataUnified('academias', req.params.id);
        if (academia) {
            res.json(academia);
        } else {
            res.status(404).json({ error: 'Academia não encontrada' });
        }
    } catch (error) {
        console.error('Erro ao buscar academia:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.post('/api/academias', async (req, res) => {
    try {
        const nova = { ...req.body };
        
        // Validação básica
        if (!nova.nome || !nova.endereco || !nova.tipo) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando: nome, endereco, tipo' });
        }
        
        // Adicionar data de criação
        nova.criado_em = new Date().toISOString();
        nova.status = nova.status || 'ativo';
        
        const savedId = await saveDataUnified('academias', nova, null);
        
        const novaAcademia = {
            id: Date.now(),
            ...req.body,
            status: 'ativo',
            data_criacao: new Date().toISOString()
        };

        // Emitir evento via WebSocket
        if (io) {
            io.emit('academia-criada', novaAcademia);
        }

        res.status(201).json({ ...nova, id: savedId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Função para broadcast para páginas públicas
function broadcastToPublicPages(academia) {
    // Emitir para todas as páginas públicas conectadas
    if (io) {
        io.emit('atualizar-pagina-publica', {
            tipo: 'academia-nova',
            academia: academia
        });
    }
}

app.put('/api/academias/:id', async (req, res) => {
    try {
        const atualizada = { ...req.body };
        
        // Verificar se academia existe
        const academiaExistente = await readDataUnified('academias', req.params.id);
        if (!academiaExistente) {
            return res.status(404).json({ error: 'Academia não encontrada' });
        }
        
        const savedId = await saveDataUnified('academias', atualizada, req.params.id);
        res.json({ ...atualizada, id: savedId });
        
        // Emitir evento via WebSocket
        io.emit('academia-atualizada', { ...atualizada, id: savedId });
    } catch (error) {
        console.error('Erro ao atualizar academia:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar academia' });
    }
});

app.delete('/api/academias/:id', async (req, res) => {
    try {
        // Verificar se academia existe
        const academiaExistente = await readDataUnified('academias', req.params.id);
        if (!academiaExistente) {
            return res.status(404).json({ error: 'Academia não encontrada' });
        }
        
        // Remover do arquivo JSON
        let academias = await readData('academias');
        const index = academias.findIndex(a => a.id == req.params.id);
        
        if (index !== -1) {
            academias.splice(index, 1);
            await writeData('academias', academias);
        }
        
        // Remover do Supabase (assíncrono)
        if (supabaseEnabled) {
            supabase.from('academias').delete().eq('id', req.params.id)
                .catch(err => console.error('⚠️ Erro ao remover academia do Supabase:', err));
        }
        
        res.json({ success: true, message: 'Academia excluída com sucesso' });
        
        // Emitir evento via WebSocket
        io.emit('academia-excluida', { id: req.params.id });
    } catch (error) {
        console.error('Erro ao excluir academia:', error);
        res.status(500).json({ error: 'Erro interno ao excluir academia' });
    }
});

app.patch('/api/academias/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!status || !['ativo', 'inativo', 'pendente'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }
        
        // Verificar se academia existe
        const academiaExistente = await readDataUnified('academias', req.params.id);
        if (!academiaExistente) {
            return res.status(404).json({ error: 'Academia não encontrada' });
        }
        
        // Atualizar apenas o status
        const updateData = { status };
        const savedId = await saveDataUnified('academias', updateData, req.params.id);
        
        res.json({ 
            success: true, 
            message: 'Status atualizado',
            id: savedId,
            status 
        });
        
        io.emit('academia-status-alterado', { id: req.params.id, status });
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ========== CRUD PROPRIETÁRIOS ==========
app.get("/api/proprietarios", async (req, res) => {
    try {
        const proprietarios = await readDataUnified('proprietarios');
        res.json(Array.isArray(proprietarios) ? proprietarios : []);
    } catch (error) {
        console.error('Erro ao buscar proprietários:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.get("/api/proprietarios/:id", async (req, res) => {
    try {
        const proprietario = await readDataUnified('proprietarios', req.params.id);
        if (proprietario) {
            res.json(proprietario);
        } else {
            res.status(404).json({ error: 'Proprietário não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.post('/api/proprietarios', async (req, res) => {
    try {
        const novo = { ...req.body };
        const savedId = await saveDataUnified('proprietarios', novo, null);
        res.status(201).json({ ...novo, id: savedId });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.put('/api/proprietarios/:id', async (req, res) => {
    try {
        const atualizado = { ...req.body };
        const savedId = await saveDataUnified('proprietarios', atualizado, req.params.id);
        res.json({ ...atualizado, id: savedId });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.delete('/api/proprietarios/:id', async (req, res) => {
    try {
        let proprietarios = await readData('proprietarios');
        const index = proprietarios.findIndex(p => p.id == req.params.id);
        
        if (index !== -1) {
            proprietarios.splice(index, 1);
            await writeData('proprietarios', proprietarios);
            
            // Remover do Supabase (assíncrono)
            if (supabaseEnabled) {
                supabase.from('proprietarios').delete().eq('id', req.params.id)
                    .catch(err => console.error('⚠️ Erro ao remover proprietário do Supabase:', err));
            }
            
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Proprietário não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ========== CRUD PERSONAIS ==========
app.get("/api/personais", async (req, res) => {
    try {
        const personais = await readDataUnified('personais');
        res.json(Array.isArray(personais) ? personais : []);
    } catch (error) {
        console.error('Erro ao buscar personais:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.get("/api/personais/:id", async (req, res) => {
    try {
        const personal = await readDataUnified('personais', req.params.id);
        if (personal) {
            res.json(personal);
        } else {
            res.status(404).json({ error: 'Personal não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.post('/api/personais', async (req, res) => {
    try {
        const novo = { ...req.body };
        const savedId = await saveDataUnified('personais', novo, null);
        res.status(201).json({ ...novo, id: savedId });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.put('/api/personais/:id', async (req, res) => {
    try {
        const atualizado = { ...req.body };
        const savedId = await saveDataUnified('personais', atualizado, req.params.id);
        res.json({ ...atualizado, id: savedId });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.delete('/api/personais/:id', async (req, res) => {
    try {
        let personais = await readData('personais');
        const index = personais.findIndex(p => p.id == req.params.id);
        
        if (index !== -1) {
            personais.splice(index, 1);
            await writeData('personais', personais);
            
            // Remover do Supabase (assíncrono)
            if (supabaseEnabled) {
                supabase.from('personais').delete().eq('id', req.params.id)
                    .catch(err => console.error('⚠️ Erro ao remover personal do Supabase:', err));
            }
            
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Personal não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ========== CRUD ADMINS ==========
app.get("/api/administradores", async (req, res) => {
    try {
        const admins = await readDataUnified('admins');
        res.json(Array.isArray(admins) ? admins : []);
    } catch (error) {
        console.error('Erro ao buscar administradores:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.get("/api/administradores/:id", async (req, res) => {
    try {
        const admin = await readDataUnified('admins', req.params.id);
        if (admin) {
            res.json(admin);
        } else {
            res.status(404).json({ error: 'Administrador não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.post('/api/administradores', async (req, res) => {
    try {
        const { nome, email, senha, nivel, status, telefone, observacoes } = req.body;

        if (!nome || !email || !senha || !nivel) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }

        const { hash, salt } = hashPassword(senha);

        const novoAdmin = {
            nome, email,
            senha: hash,
            salt,
            nivel, status: status || 'ativo',
            telefone, observacoes
        };

        const savedId = await saveDataUnified('admins', novoAdmin, null);
        // Remover senha e salt da resposta
        const { senha: _, salt: __, ...response } = { ...novoAdmin, id: savedId };
        res.status(201).json(response);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.put('/api/administradores/:id', async (req, res) => {
    try {
        const { nome, email, senha, nivel, status, telefone, observacoes } = req.body;

        const atualizado = { nome, email, nivel, status, telefone, observacoes };

        if (senha) {
            const { hash, salt } = hashPassword(senha);
            atualizado.senha = hash;
            atualizado.salt = salt;
        }

        const savedId = await saveDataUnified('admins', atualizado, req.params.id);
        const { senha: _, salt: __, ...response } = { ...atualizado, id: savedId };
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.delete('/api/administradores/:id', async (req, res) => {
    try {
        let admins = await readData('admins');
        const index = admins.findIndex(a => a.id == req.params.id);
        
        if (index !== -1) {
            const admin = admins[index];
            
            if (admin.nivel === 'super_admin') {
                return res.status(403).json({ error: 'Não pode excluir super admin' });
            }
            
            admins.splice(index, 1);
            await writeData('admins', admins);
            
            // Remover do Supabase (assíncrono)
            if (supabaseEnabled) {
                supabase.from('administradores').delete().eq('id', req.params.id)
                    .catch(err => console.error('⚠️ Erro ao remover admin do Supabase:', err));
            }
            
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Admin não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ========== ROTAS DE DEBUG ==========
app.get("/debug/usuarios", async (req, res) => {
    try {
        const db = await readData('usuarios');
        let supabaseUsers = { data: [] };
        
        if (supabaseEnabled) {
            const { data, error } = await supabase.from('usuarios').select('*');
            if (!error) supabaseUsers = { data };
        }
        
        res.json({
            arquivo_json: db,
            supabase: supabaseUsers.data,
            total_arquivo: db.usuarios ? Object.keys(db.usuarios).length : 0,
            total_supabase: supabaseUsers.data ? supabaseUsers.data.length : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/debug/verificar-usuario/:email", async (req, res) => {
    try {
        const { email } = req.params;
        
        let supabaseUser = null;
        let fileUser = null;
        
        if (supabaseEnabled) {
            const { data, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', email)
                .maybeSingle();
            
            if (!error) supabaseUser = data;
        }
        
        const db = await readData('usuarios');
        fileUser = db.usuarios ? db.usuarios[email] : null;
        
        res.json({
            email,
            supabase: supabaseUser,
            arquivo: fileUser,
            existe_supabase: !!supabaseUser,
            existe_arquivo: !!fileUser,
            campos_supabase: supabaseUser ? Object.keys(supabaseUser) : [],
            campos_arquivo: fileUser ? Object.keys(fileUser) : []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== HEALTH CHECK ==========
app.get("/health", async (req, res) => {
    res.json({ 
        status: "online",
        database: supabaseEnabled ? "Supabase conectado ✅" : "Apenas arquivos JSON 📁",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        rotas_publicas: {
            academias_publicas: "/api/academias-publicas",
            academia_publica: "/api/academia-publica/:id"
        }
    });
});

// ========== WEBSOCKET ==========
io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);
    socket.on('disconnect', () => console.log('❌ Cliente desconectado:', socket.id));
});

// ========== INICIAR SERVIDOR ==========
async function startServer() {
    await initDataDir();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║          🏋️  GYM P2 SERVER - SUPABASE 🚀                    ║
╠══════════════════════════════════════════════════════════════╣
║  🌐 URL: http://localhost:${PORT}                            ║
║  ☁️  Banco: ${supabaseEnabled ? 'Supabase ✅'.padEnd(44) : 'Arquivos JSON 📁'.padEnd(44)} ║
║  💾 Backup: Arquivos JSON (./data/)                         ║
║  🔐 Sistema: Autenticação + CRUD completo                   ║
╚══════════════════════════════════════════════════════════════╝
        `);
        
        console.log('✅ Sistema pronto para uso!\n');
        console.log('👤 Admin padrão: admin@ifpi.edu.br / 123456');
        console.log('\n📡 ROTAS PÚBLICAS (para página de academias):');
        console.log('   GET /api/academias-publicas - Todas academias ATIVAS');
        console.log('   GET /api/academia-publica/:id - Detalhes de uma academia');
        console.log('\n🔐 ROTAS DE ADMINISTRAÇÃO:');
        console.log('   POST /cadastro - Registrar usuário');
        console.log('   POST /login - Fazer login (OTIMIZADO)');
        console.log('   GET /api/academias - Todas academias (admin)');
        console.log('\n🔍 ROTAS DE DEBUG:');
        console.log('   GET /debug/usuarios - Ver todos os usuários');
        console.log('   GET /health - Status do servidor');
        console.log('📁 Servindo arquivos estáticos da pasta atual');
    });
}

startServer();
