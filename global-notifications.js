// global-notifications.js - Sistema de notificações
class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Criar container de notificações se não existir
        if (!document.getElementById('global-notifications')) {
            this.container = document.createElement('div');
            this.container.id = 'global-notifications';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('global-notifications');
        }
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: ${this.getBackgroundColor(type)};
            color: white;
            padding: 15px 20px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
            cursor: pointer;
            border-left: 4px solid ${this.getBorderColor(type)};
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>${message}</span>
                <button style="background: none; border: none; color: white; cursor: pointer; margin-left: 10px;">×</button>
            </div>
        `;

        // Adicionar estilos de animação
        if (!document.getElementById('notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(styles);
        }

        this.container.appendChild(notification);

        // Fechar ao clicar no botão
        const closeBtn = notification.querySelector('button');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });

        // Auto-remover após duração
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }

        return notification;
    }

    removeNotification(notification) {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    getBackgroundColor(type) {
        const colors = {
            success: 'linear-gradient(135deg, #00b894, #00a085)',
            error: 'linear-gradient(135deg, #ff7675, #e84342)',
            warning: 'linear-gradient(135deg, #fdcb6e, #e17055)',
            info: 'linear-gradient(135deg, #74b9ff, #0984e3)'
        };
        return colors[type] || colors.info;
    }

    getBorderColor(type) {
        const colors = {
            success: '#00a085',
            error: '#e84342',
            warning: '#e17055',
            info: '#0984e3'
        };
        return colors[type] || colors.info;
    }

    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }
}

// Tornar global
window.notifications = new NotificationSystem();