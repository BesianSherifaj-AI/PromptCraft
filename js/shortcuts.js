// Shortcuts Module

function setupShortcuts() {
    document.onkeydown = e => {
        if (e.target.matches('input,textarea')) return;
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); document.getElementById('save-page-btn').click() }
        if (e.ctrlKey && e.key === 'f') { e.preventDefault(); document.getElementById('search').focus() }
        if (e.key === 'Escape') {
            // Close all modals
            ['edit-modal', 'category-modal', 'lightbox-modal', 'note-modal', 'rename-variants-modal', 'drive-modal', 'create-prompt-modal'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            // Also close explorer lightbox if open
            if (typeof closeLightbox === 'function') closeLightbox();
        }
    };

    document.getElementById('shortcuts-btn').onclick = () => alert("Ctrl+S: Save\nCtrl+F: Search\nEsc: Close");

    document.getElementById('dark-mode-toggle').onclick = () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        document.getElementById('dark-mode-toggle').textContent = document.documentElement.classList.contains('dark') ? '☀️ Light' : '🌙 Dark';
    };
}