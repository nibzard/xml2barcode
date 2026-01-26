/**
 * ABOUTME: Debug console for on-device debugging
 * ABOUTME: Shows logs at bottom of screen when DEBUG mode is enabled
 */

// Check URL parameter or localStorage
const urlParams = new URLSearchParams(window.location.search);
const DEBUG = urlParams.get('debug') === 'true' || localStorage.getItem('xml2barcode-debug') === 'true';

class Debug {
    constructor() {
        this.logContainer = null;
        this.init();
    }

    init() {
        if (!DEBUG) return;

        this.logContainer = document.getElementById('debugLog');
        const panel = document.getElementById('debugPanel');
        const closeBtn = document.getElementById('debugClose');
        const clearBtn = document.getElementById('debugClear');
        const copyBtn = document.getElementById('debugCopy');

        // Show panel
        if (panel) panel.classList.remove('hidden');

        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                panel?.classList.add('hidden');
            });
        }

        // Clear button
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.logContainer) this.logContainer.innerHTML = '';
            });
        }

        // Copy button
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copyLogs();
            });
        }

        this.log('Debug', 'Debug console initialized');

        // Global enable/disable functions
        window.enableDebug = () => {
            localStorage.setItem('xml2barcode-debug', 'true');
            location.reload();
        };
        window.disableDebug = () => {
            localStorage.setItem('xml2barcode-debug', 'false');
            location.reload();
        };
    }

    log(category, message, type = 'info') {
        if (!DEBUG || !this.logContainer) return;

        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `debug-log-entry ${type}`;
        entry.innerHTML = `<span class="timestamp">[${timestamp}]</span><strong>[${category}]</strong> ${message}`;

        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    info(category, message) {
        this.log(category, message, 'info');
    }

    warn(category, message) {
        this.log(category, message, 'warn');
    }

    error(category, message) {
        this.log(category, message, 'error');
    }

    copyLogs() {
        if (!this.logContainer) return;

        const entries = this.logContainer.querySelectorAll('.debug-log-entry');
        let text = '';

        entries.forEach(entry => {
            const timestamp = entry.querySelector('.timestamp')?.textContent || '';
            const content = entry.textContent.replace(timestamp, '').trim();
            text += `${timestamp} ${content}\n`;
        });

        // Fallback for mobile browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            if (document.getElementById('debugCopy')) {
                const btn = document.getElementById('debugCopy');
                const originalText = btn.textContent;
                btn.textContent = '✓ Copied!';
                setTimeout(() => btn.textContent = originalText, 2000);
            }
        } catch (err) {
            this.error('Debug', 'Copy failed');
        }

        document.body.removeChild(textarea);
    }
}

const debug = new Debug();
