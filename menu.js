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
            alert('Vamos te levar para o cadastro da academia...');
            // Aqui iria o código para o cadastro
        }
         // Funcionalidade do Menu Hamburguer
        const menuTrigger = document.getElementById('menuTrigger');
        const slideMenu = document.getElementById('slideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        const menuCloseBtn = document.getElementById('menuCloseBtn');
        const menuSearchBtn = document.getElementById('menuSearchBtn');

        // Abrir/fechar menu
        menuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menuTrigger.classList.toggle('active');
            slideMenu.classList.toggle('open');
            menuOverlay.classList.toggle('visible');
        });

        // Fechar menu pelo botão X
        menuCloseBtn.addEventListener('click', () => {
            menuTrigger.classList.remove('active');
            slideMenu.classList.remove('open');
            menuOverlay.classList.remove('visible');
        });

        // Fechar menu ao clicar no overlay
        menuOverlay.addEventListener('click', () => {
            menuTrigger.classList.remove('active');
            slideMenu.classList.remove('open');
            menuOverlay.classList.remove('visible');
        });

        // Fechar menu ao clicar em um link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                menuTrigger.classList.remove('active');
                slideMenu.classList.remove('open');
                menuOverlay.classList.remove('visible');
            });
        });

        // Abrir pesquisa pelo botão do menu
        menuSearchBtn.addEventListener('click', () => {
            // Fecha o menu
            menuTrigger.classList.remove('active');
            slideMenu.classList.remove('open');
            menuOverlay.classList.remove('visible');
            
            // Abre a pesquisa
            searchField.classList.add('expanded');
            searchInput.focus();
        });
             // Funcionalidade da Barra de Pesquisa
        const searchToggle = document.getElementById('searchToggle');
        const searchField = document.getElementById('searchField');
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        // Abrir/fechar pesquisa
        searchToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            searchField.classList.toggle('expanded');
            if (searchField.classList.contains('expanded')) {
                searchInput.focus();
            } else {
                searchInput.value = '';
                searchResults.classList.remove('active');
            }
        });

        // Fechar pesquisa ao clicar fora
        document.addEventListener('click', (e) => {
            if (!searchField.contains(e.target) && !searchToggle.contains(e.target)) {
                searchField.classList.remove('expanded');
                searchInput.value = '';
                searchResults.classList.remove('active');
            }
        });

        // Dados de exemplo para a pesquisa
        const searchData = [
            {
                category: 'Academia',
                title: 'Smart Strong',
                description: 'Academia de musculação no centro',
                link: 'smart-strong-sem-logar.html'
            },
            {
                category: 'Academia',
                title: 'Rede-Fit P2',
                description: 'Musculação e fitness',
                link: 'Redefit-sem-logar.html'
            },
            {
                category: 'Academia',
                title: 'Olympic Fit',
                description: 'Treinos de alto desempenho',
                link: 'olympic-sem-logar.html'
            },
            {
                category: 'Página',
                title: 'Blog & Dicas',
                description: 'Artigos sobre saúde e fitness',
                link: 'Blogs e dicas-sem-logar.html'
            },
            {
                category: 'Página',
                title: 'Cadastro de Academias',
                description: 'Divulgue sua academia',
                link: 'cadastro_academias-sem-logar.html'
            },
            {
                category: 'Página',
                title: 'Personal Trainer',
                description: 'Cadastro de personal trainers',
                link: 'cadastro_personal-sem-logar.html'
            }
        ];

        // Função de pesquisa
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            if (searchTerm.length === 0) {
                searchResults.classList.remove('active');
                searchResults.innerHTML = '';
                return;
            }
            
            const filteredResults = searchData.filter(item => 
                item.title.toLowerCase().includes(searchTerm) || 
                item.description.toLowerCase().includes(searchTerm) ||
                item.category.toLowerCase().includes(searchTerm)
            );
            
            if (filteredResults.length > 0) {
                searchResults.innerHTML = filteredResults.map(item => `
                    <div class="search-result-item" onclick="window.location.href='${item.link}'">
                        <div class="result-category">${item.category}</div>
                        <div class="result-title">${item.title}</div>
                        <div class="result-description">${item.description}</div>
                    </div>
                `).join('');
                searchResults.classList.add('active');
            } else {
                searchResults.innerHTML = `
                    <div class="search-result-item">
                        <div class="result-title">Nenhum resultado encontrado</div>
                        <div class="result-description">Tente outra palavra-chave</div>
                    </div>
                `;
                searchResults.classList.add('active');
            }
        });

        // Prevenir que o Enter no input de pesquisa recarregue a página
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
    // ========== FUNÇÕES AUXILIARES ==========
    function showNotification(message) {
        // Criar notificação temporária
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #00ff88;
            color: #000;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    function buscarPersonal() {
        showNotification('🔍 Buscando personal trainers...');
        navigateToFilter('personal trainer');
    }

    function cadastrarPersonal() {
        showNotification('👤 Redirecionando para cadastro de personal trainer...');
    }

    // ========== INICIALIZAÇÃO ==========
    function initializeSearch() {
        // Event Listeners da barra de pesquisa
        if (searchToggle) {
            searchToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleSearch();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                performSearch(e.target.value);
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const query = searchInput.value.trim();
                    if (query) {
                        const firstMatch = Object.entries(searchMap)
                            .find(([key, data]) => key.includes(query.toLowerCase()));
                        
                        if (firstMatch) {
                            navigateToFilter(firstMatch[0]);
                        } else {
                            showNotification(`Nenhum resultado encontrado para: "${query}"`);
                        }
                    }
                } else if (e.key === 'Escape') {
                    closeSearch();
                }
            });
        }

        // Filtros rápidos
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.addEventListener('click', function() {
                const filter = this.getAttribute('data-filter');
                navigateToFilter(filter);
            });
        });

        // Fechar ao clicar fora
        document.addEventListener('click', (e) => {
            if (searchExpanded && 
                !searchField?.contains(e.target) && 
                !searchToggle?.contains(e.target) &&
                !searchInput?.contains(e.target) &&
                !searchResults?.contains(e.target) &&
                !searchFilters?.contains(e.target)) {
                closeSearch();
            }
        });

        // Prevenir fechamento ao clicar nos resultados
        if (searchResults) {
            searchResults.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Tecla ESC para fechar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchExpanded) {
                closeSearch();
            }
        });

        // Funções adicionais
        document.querySelectorAll('[onclick*="buscarPersonal"]').forEach(btn => {
            btn.addEventListener('click', buscarPersonal);
        });

        document.querySelectorAll('[onclick*="cadastrarPersonal"]').forEach(btn => {
            btn.addEventListener('click', cadastrarPersonal);
        });

        console.log('🔍 Sistema de pesquisa com filtros carregado!');
        console.log('Filtros disponíveis:', Object.keys(searchMap));
        
        // Verificar se todos os filtros estão funcionando
        const filterTags = document.querySelectorAll('.filter-tag');
        console.log(`🎯 ${filterTags.length} filtros rápidos carregados:`);
        filterTags.forEach(tag => {
            console.log(`   - ${tag.textContent} (${tag.getAttribute('data-filter')})`);
        });
    }

    // Inicializar quando o DOM estiver carregado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSearch);
    } else {
        initializeSearch();
    }


// ========== FUNÇÕES ADICIONAIS ==========
function buscarPersonal() {
    showNotification('🔍 Buscando personal trainers...');
    navigateToFilter('personal trainer');
}

function cadastrarPersonal() {
    showNotification('👤 Redirecionando para cadastro de personal trainer...');
}

// Adicionando eventos para filtros específicos que podem estar no menu
document.querySelectorAll('[onclick*="buscarPersonal"]').forEach(btn => {
    btn.addEventListener('click', buscarPersonal);
});

document.querySelectorAll('[onclick*="cadastrarPersonal"]').forEach(btn => {
    btn.addEventListener('click', cadastrarPersonal);
});
