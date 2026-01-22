// ========== SISTEMA DE PÁGINAS ==========
const pages = [
    'home-page',
    'academias-page', 
    'personal-trainer-page',
    'blog-page',
    'sobre-page'
];

function goToPage(pageId) {
    // Esconder todas as páginas
    pages.forEach(page => {
        const pageElement = document.getElementById(page);
        if (pageElement) {
            pageElement.classList.remove('active');
        }
    });
    
    // Mostrar a página desejada
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Fechar a pesquisa
    closeSearch();
    console.log(`📍 Navegado para: ${pageId}`);
}

function cadastrar() {
    // Criar notificação visual
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 255, 64, 0.95);
        color: #000;
        padding: 24px 40px;
        border-radius: 20px;
        font-weight: 700;
        font-size: 1.2rem;
        z-index: 10000;
        box-shadow: 0 20px 60px rgba(0, 255, 64, 0.4);
        backdrop-filter: blur(20px);
        border: 2px solid rgba(255, 255, 255, 0.3);
        animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    
    notification.textContent = '🚀 Redirecionando para o cadastro...';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
        // Aqui iria o código para o cadastro
    }, 2000);
    
    console.log('📝 Iniciando cadastro da academia...');
}

// ========== ANIMAÇÃO DE POP-IN ==========
function createPopInAnimation() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes popIn {
            0% { 
                opacity: 0; 
                transform: translate(-50%, -50%) scale(0.5); 
            }
            70% { 
                opacity: 1; 
                transform: translate(-50%, -50%) scale(1.1); 
            }
            100% { 
                transform: translate(-50%, -50%) scale(1); 
            }
        }
        
        @keyframes slideInFromRight {
            0% { 
                opacity: 0; 
                transform: translateX(30px); 
            }
            100% { 
                opacity: 1; 
                transform: translateX(0); 
            }
        }
        
        @keyframes fadeInUp {
            0% { 
                opacity: 0; 
                transform: translateY(20px); 
            }
            100% { 
                opacity: 1; 
                transform: translateY(0); 
            }
        }
        
        @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
        }
    `;
    document.head.appendChild(style);
}

// ========== FUNCIONALIDADE DO MENU HAMBURGUER - MELHORADA ==========
const menuTrigger = document.getElementById('menuTrigger');
const slideMenu = document.getElementById('slideMenu');
const menuOverlay = document.getElementById('menuOverlay');
const menuCloseBtn = document.getElementById('menuCloseBtn');
const menuSearchBtn = document.getElementById('menuSearchBtn');

// Adicionar efeito de clique ao botão do menu
menuTrigger.addEventListener('mousedown', () => {
    menuTrigger.style.transform = 'scale(0.95)';
});

menuTrigger.addEventListener('mouseup', () => {
    menuTrigger.style.transform = 'scale(1)';
});

// Abrir/fechar menu com animação melhorada
menuTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menuTrigger.classList.toggle('active');
    slideMenu.classList.toggle('open');
    menuOverlay.classList.toggle('visible');
    
    // Adicionar efeito sonoro visual
    if (menuTrigger.classList.contains('active')) {
        console.log('📱 Menu aberto');
        // Animação de entrada dos itens
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach((item, index) => {
            item.style.animationDelay = `${index * 0.1}s`;
        });
    } else {
        console.log('📱 Menu fechado');
    }
});

// Fechar menu pelo botão X com animação
menuCloseBtn.addEventListener('click', () => {
    closeMenuWithAnimation();
});

// Fechar menu ao clicar no overlay com fade out
menuOverlay.addEventListener('click', () => {
    closeMenuWithAnimation();
});

// Fechar menu ao clicar em um link com transição suave
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Adicionar efeito visual ao clicar no link
        link.style.transform = 'scale(0.95)';
        setTimeout(() => {
            link.style.transform = '';
        }, 150);
        
        // Fechar menu com delay para ver a animação
        setTimeout(() => {
            closeMenuWithAnimation();
            
            // Navegar para o link após fechar o menu
            const href = link.getAttribute('href');
            if (href && href !== '#') {
                window.location.href = href;
            }
        }, 200);
    });
});

// Função para fechar menu com animação
function closeMenuWithAnimation() {
    menuTrigger.classList.remove('active');
    slideMenu.classList.remove('open');
    menuOverlay.classList.remove('visible');
    
    // Resetar animações dos itens
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.style.animationDelay = '0s';
    });
}

// Abrir pesquisa pelo botão do menu com animação
menuSearchBtn.addEventListener('click', () => {
    // Animação no botão
    menuSearchBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        menuSearchBtn.style.transform = '';
    }, 150);
    
    // Fecha o menu
    closeMenuWithAnimation();
    
    // Abre a pesquisa com delay
    setTimeout(() => {
        searchField.classList.add('expanded');
        searchInput.focus();
        
        // Efeito visual na barra de pesquisa
        searchField.style.animation = 'searchExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        setTimeout(() => {
            searchField.style.animation = '';
        }, 600);
    }, 300);
});

// 
// ========== FUNÇÕES AUXILIARES MELHORADAS ==========
function showNotification(message, type = 'success') {
    // Criar notificação estilizada
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'rgba(0, 255, 64, 0.95)' : 'rgba(255, 68, 68, 0.95)'};
        color: #000;
        padding: 16px 24px;
        border-radius: 16px;
        font-weight: 700;
        font-size: 0.95rem;
        z-index: 10000;
        box-shadow: 0 10px 40px ${type === 'success' ? 'rgba(0, 255, 64, 0.4)' : 'rgba(255, 68, 68, 0.4)'};
        backdrop-filter: blur(20px);
        border: 2px solid rgba(255, 255, 255, 0.3);
        animation: fadeInUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 400px;
        transform-origin: top right;
    `;
    
    const icon = type === 'success' ? '✅' : '⚠️';
    notification.innerHTML = `
        <span style="font-size: 1.2rem;">${icon}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Remover após 3 segundos com animação
    setTimeout(() => {
        notification.style.animation = 'fadeOutUp 0.5s ease forwards';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 500);
    }, 3000);
    
    // Adicionar animação de fade out
    const fadeOutStyle = document.createElement('style');
    fadeOutStyle.textContent = `
        @keyframes fadeOutUp {
            0% { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
            100% { 
                opacity: 0; 
                transform: translateY(-20px) scale(0.9); 
            }
        }
    `;
    document.head.appendChild(fadeOutStyle);
}

// ========== FUNÇÕES DE PESQUISA ADICIONAIS ==========
function closeSearch() {
    if (searchField.classList.contains('expanded')) {
        searchField.style.animation = 'searchCollapse 0.4s ease';
        setTimeout(() => {
            searchField.classList.remove('expanded');
            searchField.style.animation = '';
            searchInput.value = '';
            searchResults.classList.remove('active');
        }, 400);
    }
}

function toggleSearch() {
    searchToggle.click();
}

function performSearch(query) {
    searchInput.value = query;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Expandir se não estiver expandido
    if (!searchField.classList.contains('expanded')) {
        searchToggle.click();
    }
}

// ========== INICIALIZAÇÃO MELHORADA ==========
function initializeSearch() {
    // Criar animações
    createPopInAnimation();
    
    console.log('🎨 Sistema de navegação com efeitos visuais carregado!');
    console.log('📱 Menu hamburguer: ✅');
    console.log('🔍 Barra de pesquisa: ✅');
    console.log('✨ Efeitos visuais: ✅');
    
    // Adicionar efeito de inicialização
    setTimeout(() => {
        const logo = document.querySelector('.logo-img');
        if (logo) {
            logo.style.transition = 'all 0.5s ease';
            logo.style.transform = 'scale(1.1)';
            setTimeout(() => {
                logo.style.transform = 'scale(1)';
            }, 300);
        }
    }, 1000);
}

// Inicializar quando o DOM estiver carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeSearch();
        console.log('🚀 Sistema inicializado com sucesso!');
    });
} else {
    initializeSearch();
    console.log('🚀 Sistema inicializado (DOM já carregado)');
}

// ========== FUNÇÕES ADICIONAIS ==========
function buscarPersonal() {
    showNotification('🔍 Buscando personal trainers...', 'success');
    // Aqui você pode adicionar a lógica de busca
}

function cadastrarPersonal() {
    showNotification('👤 Redirecionando para cadastro de personal trainer...', 'success');
    // Aqui você pode adicionar a lógica de cadastro
}

// Adicionando eventos para filtros específicos que podem estar no menu
document.querySelectorAll('[onclick*="buscarPersonal"]').forEach(btn => {
    btn.addEventListener('click', buscarPersonal);
});

document.querySelectorAll('[onclick*="cadastrarPersonal"]').forEach(btn => {
    btn.addEventListener('click', cadastrarPersonal);
});

// Adicionar efeito de hover aos botões de gym-access
document.querySelectorAll('.gym-access-btn').forEach(btn => {
    btn.addEventListener('mouseenter', function() {
        this.style.zIndex = '100';
    });
    
    btn.addEventListener('mouseleave', function() {
        this.style.zIndex = '';
    });
});

// Adicionar efeito de clique nos resultados da pesquisa
document.addEventListener('click', function(e) {
    if (e.target.closest('.search-result-item')) {
        const item = e.target.closest('.search-result-item');
        item.style.animation = 'pulse 0.3s ease';
    }
});

// ========== ANIMAÇÃO DE PULSO ==========
const pulseStyle = document.createElement('style');
pulseStyle.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(0.98); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(pulseStyle);

console.log('🎯 Todas as funcionalidades da navbar carregadas com efeitos visuais!');
        // Dados das promoções
        const promocoes = [
            {
                id: 1,
                titulo: "Creatina Monohidratada 300g",
                subtitulo: "Marca: Max Titanium",
                descricao: "Creatina pura em pó, aumenta a força e o desempenho nos treinos. Sabor neutro, fácil de misturar.",
                categoria: "creatina",
                precoAntigo: 89.90,
                precoNovo: 67.90,
                desconto: "25%",
                validoAte: "30/11/2023",
                destaque: true
            },
            {
                id: 2,
                titulo: "Plano Anual Academia",
                subtitulo: "Smart Fit - Unidade Centro",
                descricao: "Plano anual com acesso ilimitado a todas unidades, aulas coletivas e área de musculação. Isenção de taxa de adesão.",
                categoria: "academia",
                precoAntigo: 99.90,
                precoNovo: 79.90,
                desconto: "20%",
                validoAte: "15/12/2023",
                destaque: false
            },
            {
                id: 3,
                titulo: "Whey Protein Concentrado 1kg",
                subtitulo: "Marca: IntegralMédica",
                descricao: "Proteína de alta qualidade para recuperação muscular. Disponível em vários sabores.",
                categoria: "proteina",
                precoAntigo: 119.90,
                precoNovo: 89.90,
                desconto: "25%",
                validoAte: "10/12/2023",
                destaque: true
            },
            
            {
                id: 5,
                titulo: "Creatina Creapure® 500g",
                subtitulo: "Marca: Growth",
                descricao: "Creatina alemã de altíssima pureza, considerada a melhor do mercado. Máxima absorção.",
                categoria: "creatina",
                precoAntigo: 159.90,
                precoNovo: 129.90,
                desconto: "19%",
                validoAte: "20/12/2023",
                destaque: false
            },
            {
                id: 6,
                titulo: "Plano Semestral + Personal",
                subtitulo: "Bluefit - Unidade Zona Sul",
                descricao: "6 meses de academia + 4 sessões mensais com personal trainer. Avaliação física inclusa.",
                categoria: "academia",
                precoAntigo: 199.90,
                precoNovo: 149.90,
                desconto: "25%",
                validoAte: "25/11/2023",
                destaque: true
            },
            {
                id: 7,
                titulo: "BCAA 2400mg 120 cápsulas",
                subtitulo: "Marca: Probiotica",
                descricao: "Aminoácidos de cadeia ramificada para reduzir fadiga e melhorar recuperação muscular.",
                categoria: "proteina",
                precoAntigo: 79.90,
                precoNovo: 59.90,
                desconto: "25%",
                validoAte: "12/12/2023",
                destaque: false
            }
        ];

        // Função para renderizar as promoções
        function renderPromocoes(filter = 'all') {
            const promoGrid = document.getElementById('promoGrid');
            promoGrid.innerHTML = '';
            
            const promocoesFiltradas = filter === 'all' 
                ? promocoes 
                : promocoes.filter(promo => promo.categoria === filter);
            
            if (promocoesFiltradas.length === 0) {
                promoGrid.innerHTML = '<div class="no-results">Nenhuma promoção encontrada para esta categoria.</div>';
                return;
            }
            
            promocoesFiltradas.forEach(promo => {
                const promoCard = document.createElement('div');
                promoCard.className = 'promo-card';
                
                // Determinar a classe de categoria para o cabeçalho
                const categoryClass = promo.categoria;
                
                promoCard.innerHTML = `
                    <div class="card-header ${categoryClass}">
                        <span class="card-category">${getCategoryName(promo.categoria)}</span>
                        <h3 class="card-title">${promo.titulo}</h3>
                        <p class="card-subtitle">${promo.subtitulo}</p>
                    </div>
                    <div class="card-body">
                        <p class="card-description">${promo.descricao}</p>
                        <div class="price-container">
                            <span class="old-price">R$ ${promo.precoAntigo.toFixed(2)}</span>
                            <span class="new-price">R$ ${promo.precoNovo.toFixed(2)}</span>
                            <span class="discount-badge">-${promo.desconto}</span>
                        </div>
                    </div>
                    <div class="card-footer">
                        <div class="valid-date">
                            <i class="far fa-calendar-alt"></i> Válido até: ${promo.validoAte}
                        </div>
                        <button class="btn-promo" onclick="verPromocao(${promo.id})">
                            <i class="fas fa-shopping-cart"></i> Ver Oferta
                        </button>
                    </div>
                `;
                
                promoGrid.appendChild(promoCard);
            });
        }
        
        // Função para obter o nome da categoria formatado
        function getCategoryName(category) {
            const names = {
                'creatina': 'Creatina',
                'academia': 'Academia',
                'proteina': 'Proteína',
                'acessorio': 'Acessório'
            };
            return names[category] || category;
        }
        
        // Função para filtrar as promoções
        function setupFilters() {
            const filterButtons = document.querySelectorAll('.filter-btn');
            
            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Remover classe active de todos os botões
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    
                    // Adicionar classe active ao botão clicado
                    button.classList.add('active');
                    
                    // Filtrar promoções
                    const filter = button.getAttribute('data-filter');
                    renderPromocoes(filter);
                });
            });
        }
        
        // Função para simular clique em uma promoção
        function verPromocao(id) {
            const promocao = promocoes.find(p => p.id === id);
            if (promocao) {
                alert(`Redirecionando para a oferta: ${promocao.titulo}\nPreço: R$ ${promocao.precoNovo.toFixed(2)}\nVálido até: ${promocao.validoAte}`);
                // Em um site real, aqui seria o redirecionamento para a página da oferta
            }
        }
        
        // Inicializar a página
        document.addEventListener('DOMContentLoaded', () => {
            renderPromocoes();
            setupFilters();
            
            // Configurar botão de destaque
            const highlightBtn = document.querySelector('.highlight-btn');
            highlightBtn.addEventListener('click', () => {
                alert('Redirecionando para a oferta especial do mês!');
            });
        });
    
