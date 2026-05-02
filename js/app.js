document.getElementById('conference-filter').addEventListener('change', applyFilters);
document.getElementById('year-filter').addEventListener('change', applyFilters);
document.getElementById('search-input').addEventListener('input', debounce(applyFilters, 300));

document.getElementById('fav-filter-btn').addEventListener('click', () => {
    showFavoritesOnly = !showFavoritesOnly;
    document.getElementById('fav-filter-btn').classList.toggle('active', showFavoritesOnly);
    applyFilters();
});

document.getElementById('papers-container').addEventListener('click', (e) => {
    const btn = e.target.closest('.fav-btn');
    if (btn) {
        e.stopPropagation();
        const url = btn.dataset.url;
        const paper = allPapers.find(p => p.pdf_url === url);
        if (paper) {
            toggleFavorite(paper);
            btn.classList.toggle('active');
        }
        return;
    }
    const card = e.target.closest('.paper-card');
    if (card) {
        const url = card.dataset.url;
        const paper = allPapers.find(p => p.pdf_url === url);
        if (paper) openModal(paper);
    }
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    const btn = e.target.closest('.fav-btn');
    if (btn) {
        e.stopPropagation();
        const url = btn.dataset.url;
        const paper = allPapers.find(p => p.pdf_url === url);
        if (paper) {
            toggleFavorite(paper);
            btn.classList.toggle('active');
        }
        return;
    }
    if (e.target === document.getElementById('modal-overlay')) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderPapers(); saveState(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

document.getElementById('next-btn').addEventListener('click', () => {
    const tp = Math.ceil(filteredPapers.length / papersPerPage);
    if (currentPage < tp) { currentPage++; renderPapers(); saveState(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

document.getElementById('page-jump-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const tp = Math.ceil(filteredPapers.length / papersPerPage);
        const val = parseInt(e.target.value, 10);
        if (val >= 1 && val <= tp && val !== currentPage) {
            currentPage = val;
            renderPapers();
            saveState();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
});

document.getElementById('page-jump-input').addEventListener('blur', () => {
    const tp = Math.ceil(filteredPapers.length / papersPerPage);
    const val = parseInt(document.getElementById('page-jump-input').value, 10);
    if (val >= 1 && val <= tp && val !== currentPage) {
        currentPage = val;
        renderPapers();
        saveState();
    } else {
        document.getElementById('page-jump-input').value = currentPage;
    }
});

document.getElementById('per-page-select').addEventListener('change', (e) => {
    papersPerPage = parseInt(e.target.value, 10);
    currentPage = 1;
    renderPapers();
    saveState();
});

document.getElementById('export-btn').addEventListener('click', exportPapers);

loadPapers();
