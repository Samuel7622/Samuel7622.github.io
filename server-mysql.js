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
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url}`);
    next();
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
                // CORREÇÃO: Primeiro verificar se usuário existe
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
                    console.log(`🔄 Usuário ${emailParaBuscar} já existe, atualizando...`);
                    const { error } = await supabase
                        .from('usuarios')
                        .update(usuarioData)
                        .eq('email', emailParaBuscar);
                    
                    if (error) throw error;
                    console.log(`✅ Usuário ${emailParaBuscar} atualizado no Supabase`);
                    return emailParaBuscar;
                } else {
                    console.log(`🆕 Usuário ${data.email} não existe, criando novo...`);
                    const { data: result, error } = await supabase
                        .from('usuarios')
                        .insert([usuarioData])
                        .select();
                    
                    if (error) throw error;
                    console.log(`✅ Usuário ${data.email} criado no Supabase`);
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
                    console.log(`✅ Academia ${specificId} atualizada no Supabase`);
                    return specificId;
                } else {
                    const { data: result, error } = await supabase
                        .from('academias')
                        .insert([academiaData])
                        .select();
                    if (error) throw error;
                    console.log(`✅ Academia ${result[0].id} criada no Supabase`);
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
                    criado_em: new Date().toISOString(),
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
        
        console.log(`✅ ${type} lido do Supabase: ${data ? (Array.isArray(data) ? data.length : 1) : 0} registros`);
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
            console.log(`☁️ Dados de ${type} lidos do Supabase`);
            return supabaseData;
        }
    }
    
    // Fallback para arquivo
    console.log(`📁 Dados de ${type} lidos do arquivo (backup)`);
    return await readData(type);
}

async function saveDataUnified(type, data, specificId = null) {
    console.log(`🔄 Salvando ${type}...`);
    
    let savedId = specificId;
    
    // 1. Salvar no Supabase
    if (supabaseEnabled) {
        const supabaseId = await saveToSupabase(type, data, specificId);
        if (supabaseId) {
            savedId = supabaseId;
            console.log(`✅ ${type} salvo no Supabase com ID: ${supabaseId}`);
        } else {
            console.log(`⚠️ ${type} não salvo no Supabase, usando arquivo apenas`);
        }
    } else {
        console.log(`⚠️ Supabase não disponível, salvando apenas no arquivo`);
    }
    
    // 2. Salvar no arquivo (backup)
    console.log(`📁 Salvando ${type} no arquivo JSON...`);
    await saveToFile(type, data, savedId);
    console.log(`✅ ${type} salvo no arquivo com ID: ${savedId}`);
    
    return savedId;
}

// ========== ROTAS DE AUTENTICAÇÃO ==========
app.post("/cadastro", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        console.log(`📝 Tentando cadastrar: ${name} <${email}>`);

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
            console.log(`🔍 Verificação pré-cadastro no Supabase:`, usuarioExistente ? 'EXISTE' : 'NÃO EXISTE');
        }
        
        if (!usuarioExistente) {
            const db = await readData('usuarios');
            usuarioExistente = db.usuarios ? db.usuarios[email] : null;
            console.log(`🔍 Verificação no arquivo JSON:`, usuarioExistente ? 'EXISTE' : 'NÃO EXISTE');
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

        console.log(`💾 Salvando usuário ${email}...`);
        const savedId = await saveDataUnified('usuarios', usuario, email);
        console.log(`✅ Usuário ${email} salvo com ID: ${savedId}`);

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

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`🔐 Tentando login: ${email}`);

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
            console.log(`🔍 Buscando ${email} no Supabase:`, usuario ? `Encontrado (ID: ${usuario.id})` : 'Não encontrado');
            
            // Debug: Mostrar todos os campos
            if (usuario) {
                console.log('📋 Campos do usuário:', Object.keys(usuario));
                console.log('🔐 Campos de senha:', {
                    passwordhash: usuario.passwordhash ? 'EXISTE' : 'NÃO',
                    passwordsalt: usuario.passwordsalt ? 'EXISTE' : 'NÃO',
                    password_hash: usuario.password_hash ? 'EXISTE' : 'NÃO',
                    password_salt: usuario.password_salt ? 'EXISTE' : 'NÃO',
                    passwordHash: usuario.passwordHash ? 'EXISTE' : 'NÃO',
                    passwordSalt: usuario.passwordSalt ? 'EXISTE' : 'NÃO'
                });
            }
        }
        
        // Se não encontrou no Supabase, buscar no arquivo JSON
        if (!usuario) {
            console.log(`🔍 Buscando ${email} no arquivo JSON...`);
            const db = await readData('usuarios');
            usuario = db.usuarios ? db.usuarios[email] : null;
            console.log(`📁 Arquivo JSON:`, usuario ? 'Encontrado' : 'Não encontrado');
        }

        if (!usuario) {
            console.log(`❌ Usuário ${email} não encontrado em nenhum lugar`);
            return res.status(401).json({ success: false, message: 'Email não encontrado' });
        }

        console.log(`✅ Usuário ${email} encontrado, verificando senha...`);
        
        // Verificar senha - compatível com todos os formatos
        let senhaCorreta = false;
        let formatoUsado = '';
        
        // 1. Tentar formato Supabase (sem underline)
        if (usuario.passwordhash && usuario.passwordsalt) {
            senhaCorreta = verifyPassword(password, usuario.passwordhash, usuario.passwordsalt);
            formatoUsado = 'passwordhash/passwordsalt (sem underline)';
        }
        // 2. Tentar formato com underline
        else if (usuario.password_hash && usuario.password_salt) {
            senhaCorreta = verifyPassword(password, usuario.password_hash, usuario.password_salt);
            formatoUsado = 'password_hash/password_salt (com underline)';
        }
        // 3. Tentar formato JSON (camelCase)
        else if (usuario.passwordHash && usuario.passwordSalt) {
            senhaCorreta = verifyPassword(password, usuario.passwordHash, usuario.passwordSalt);
            formatoUsado = 'passwordHash/passwordSalt (camelCase)';
        }
        else {
            console.log('❌ Formato de senha não reconhecido. Campos disponíveis:', Object.keys(usuario));
            return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }

        console.log(`🔐 Verificação de senha usando formato: ${formatoUsado}`);
        
        if (!senhaCorreta) {
            console.log(`❌ Senha incorreta para ${email}`);
            return res.status(401).json({ success: false, message: 'Senha incorreta' });
        }

        console.log(`✅ Login bem-sucedido para ${email}`);

        // Atualizar último login
        const updateData = {
            ultimo_login: new Date().toISOString()
        };
        
        // Atualizar no Supabase
        if (supabaseEnabled && usuario.id) {
            await supabase
                .from('usuarios')
                .update(updateData)
                .eq('id', usuario.id);
        }
        
        // Atualizar no arquivo JSON também
        await saveToFile('usuarios', updateData, email);

        // Criar sessão
        const token = gerarToken();
        const sessaoData = {
            token,
            email,
            criado_em: Date.now(),
            ip: req.ip || 'localhost'
        };

        await saveDataUnified('sessoes', sessaoData, token);

        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            token,
            user: { 
                name: usuario.name, 
                email: usuario.email, 
                role: usuario.role || 'user' 
            }
        });
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
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

// ========== CRUD ACADEMIAS ==========
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

// ========== HEALTH CHECK ==========
app.get("/health", async (req, res) => {
    res.json({ 
        status: "online",
        database: supabaseEnabled ? "Supabase conectado ✅" : "Apenas arquivos JSON 📁",
        timestamp: new Date().toISOString(),
        version: "1.0.0"
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
        console.log('🔍 Rotas de debug:');
        console.log('   /debug/usuarios - Ver todos os usuários');
        console.log('   /debug/verificar-usuario/:email - Ver usuário específico');
    });
}

startServer();
