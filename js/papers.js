const venueFiles = {
    'ICLR 2024': 'papers/raw/iclr2024_oral_spotlight.json',
    'ICLR 2025': 'papers/raw/iclr2025_oral_spotlight.json',
    'ICLR 2026': 'papers/raw/iclr2026_oral_spotlight.json',
    'NeurIPS 2024': 'papers/raw/neurips2024_oral_spotlight.json',
    'NeurIPS 2025': 'papers/raw/neurips2025_oral_spotlight.json',
    'ICML 2024': 'papers/raw/icml2024_oral_spotlight.json',
    'ICML 2025': 'papers/raw/icml2025_oral_spotlight.json',
    'ACL 2024': 'papers/raw/acl2024_oral.json',
    'ACL 2025': 'papers/raw/acl2025_oral.json',
    'EMNLP 2024': 'papers/raw/emnlp2024_oral.json',
    'EMNLP 2025': 'papers/raw/emnlp2025_oral.json',
    'COLM 2024': 'papers/raw/colm2024_all.json',
    'COLM 2025': 'papers/raw/colm2025_all.json',
};

let allPapers = [];
let filteredPapers = [];
let currentPage = 1;
let papersPerPage = 20;
let showFavoritesOnly = false;

function saveState() {
    try {
        localStorage.setItem('appState', JSON.stringify({
            conference: document.querySelector('.custom-select[data-id="conference-filter"]').dataset.value,
            year: document.querySelector('.custom-select[data-id="year-filter"]').dataset.value,
            search: document.getElementById('search-input').value,
            perPage: papersPerPage,
            page: currentPage,
            favOnly: showFavoritesOnly,
        }));
    } catch {}
}

function restoreState() {
    try {
        const s = JSON.parse(localStorage.getItem('appState'));
        if (!s) return;
        if (s.conference) setCustomValue(document.querySelector('.custom-select[data-id="conference-filter"]'), s.conference);
        if (s.year) setCustomValue(document.querySelector('.custom-select[data-id="year-filter"]'), s.year);
        if (s.search) document.getElementById('search-input').value = s.search;
        if (s.perPage) {
            papersPerPage = s.perPage;
            setCustomValue(document.querySelector('.custom-select[data-id="per-page-select"]'), String(s.perPage));
        }
        if (s.page) {
            currentPage = s.page;
            window._restoring = true;
        }
        if (s.favOnly) {
            showFavoritesOnly = true;
            document.getElementById('fav-filter-btn').classList.add('active');
        }
    } catch {}
}

async function loadPapers() {
    initAllCustomSelects();

    const promises = Object.entries(venueFiles).map(async ([venue, file]) => {
        try {
            const response = await fetch(file);
            if (!response.ok) return [];
            const papers = await response.json();
            return papers.map(paper => {
                paper.originalVenue = paper.venue;
                paper.venue = venue;
                return paper;
            });
        } catch (e) {
            console.error(`Error loading ${file}:`, e);
            return [];
        }
    });

    const results = await Promise.all(promises);
    allPapers = results.flat();

    allPapers.sort((a, b) => {
        const vc = a.venue.localeCompare(b.venue);
        return vc !== 0 ? vc : a.title.localeCompare(b.title);
    });

    updateStats();
    populateFilters();
    restoreState();
    updateFavCount();
    applyFilters();
}

function updateStats() {
    document.getElementById('total-papers').textContent = allPapers.length;
    const conferences = new Set(allPapers.map(p => p.venue.split(' ')[0]));
    document.getElementById('total-conferences').textContent = conferences.size;
}

function populateFilters() {
    const conferences = [...new Set(allPapers.map(p => p.venue.split(' ')[0]))].sort();
    const years = [...new Set(allPapers.map(p => p.venue.split(' ')[1]))].sort();

    const confSelect = document.querySelector('.custom-select[data-id="conference-filter"]');
    conferences.forEach(c => addCustomOption(confSelect, c, c));

    const yearSelect = document.querySelector('.custom-select[data-id="year-filter"]');
    years.forEach(y => addCustomOption(yearSelect, y, y));

    const perPageSelect = document.querySelector('.custom-select[data-id="per-page-select"]');
    addCustomOption(perPageSelect, '10', '10');
    addCustomOption(perPageSelect, '20', '20');
    addCustomOption(perPageSelect, '50', '50');
    addCustomOption(perPageSelect, '100', '100');
}

function applyFilters() {
    const conference = document.querySelector('.custom-select[data-id="conference-filter"]').dataset.value;
    const year = document.querySelector('.custom-select[data-id="year-filter"]').dataset.value;
    const search = document.getElementById('search-input').value.toLowerCase();
    const favs = getFavorites();

    filteredPapers = allPapers.filter(paper => {
        if (showFavoritesOnly && !favs.includes(paper.pdf_url)) return false;
        const [conf, yr] = paper.venue.split(' ');
        if (conference !== 'all' && conf !== conference) return false;
        if (year !== 'all' && yr !== year) return false;
        if (search) {
            const fields = [paper.title, paper.authors.join(' '), paper.abstract, paper.keywords?.join(' ') || '', paper.tldr || '', paper.primary_area || ''].join(' ').toLowerCase();
            if (!fields.includes(search)) return false;
        }
        return true;
    });

    if (!window._restoring) currentPage = 1;
    window._restoring = false;
    renderPapers();
    saveState();
}

function renderPapers() {
    const container = document.getElementById('papers-container');
    const start = (currentPage - 1) * papersPerPage;
    const papersToShow = filteredPapers.slice(start, start + papersPerPage);

    document.getElementById('filtered-count').textContent = filteredPapers.length;

    if (papersToShow.length === 0) {
        container.innerHTML = '<div class="no-results"><i class="fas fa-search"></i><p>No papers found matching your criteria</p></div>';
        document.getElementById('pagination').style.display = 'none';
        return;
    }

    container.innerHTML = papersToShow.map(createPaperCard).join('');

    const totalPages = Math.ceil(filteredPapers.length / papersPerPage);
    document.getElementById('pagination').style.display = totalPages > 1 ? 'flex' : 'none';
    document.getElementById('prev-btn').disabled = currentPage === 1;
    document.getElementById('next-btn').disabled = currentPage === totalPages;
    document.getElementById('total-pages').textContent = totalPages;
    const jumpInput = document.getElementById('page-jump-input');
    jumpInput.max = totalPages;
    jumpInput.value = currentPage;
}

function getPaperTypeLabel(paper) {
    const conf = paper.venue.split(' ')[0];
    if (conf === 'COLM') return 'Regular';
    if (paper.award) return paper.award;
    const ov = (paper.originalVenue || '').toLowerCase();
    if (ov.includes('spotlight')) return 'Spotlight';
    if (ov.includes('oral')) return 'Oral';
    return 'Oral';
}

function createPaperCard(paper) {
    const [conf] = paper.venue.split(' ');
    const venueClass = `venue-${conf.toLowerCase()}`;
    const keywords = (paper.keywords || []).slice(0, 5);
    const area = paper.primary_area;
    const typeLabel = getPaperTypeLabel(paper);

    let tags = '';
    if (area) tags += `<span class="tag area">${area}</span>`;
    keywords.forEach(kw => { tags += `<span class="tag">${kw}</span>`; });

    const tldr = paper.tldr ? `<div class="tldr"><strong>TL;DR:</strong> ${paper.tldr}</div>` : '';

    const authors = paper.authors || [];
    const authorsStr = authors.length > 5
        ? authors.slice(0, 5).join(', ') + ` et al. (${authors.length} authors)`
        : authors.join(', ');

    const typeClass = typeLabel === 'Regular' ? 'paper-type-regular' :
                      (paper.award ? 'paper-type-award' :
                      (typeLabel === 'Spotlight' ? 'paper-type-spotlight' : 'paper-type-oral'));

    return `<div class="paper-card" data-url="${paper.pdf_url}">
        <span class="paper-venue ${venueClass}">${paper.venue}</span>
        <span class="paper-type ${typeClass}">${paper.award ? '<i class="fas fa-award"></i> ' : ''}${escapeHtml(typeLabel)}</span>
        <h3 class="paper-title">${escapeHtml(paper.title)}</h3>
        <p class="paper-authors"><i class="fas fa-users"></i> ${escapeHtml(authorsStr)}</p>
        ${tldr}
        <p class="paper-abstract">${escapeHtml(paper.abstract || 'No abstract available')}</p>
        <div class="paper-tags">${tags}</div>
        <div class="paper-links">
            <a href="${paper.pdf_url}" target="_blank"><i class="fas fa-file-pdf"></i> PDF</a>
            <a href="${paper.html_url}" target="_blank"><i class="fas fa-external-link-alt"></i> View</a>
            <button class="fav-btn${isFavorite(paper) ? ' active' : ''}" data-url="${paper.pdf_url}" title="Toggle favorite"><i class="fas fa-heart"></i></button>
        </div>
    </div>`;
}

function exportPapers() {
    if (filteredPapers.length === 0) return;
    const lines = filteredPapers.map(p => {
        const [conference, year] = p.venue.split(' ');
        return JSON.stringify({ conference, year, authors: p.authors || [], title: p.title || '', abstract: p.abstract || '' });
    });
    const blob = new Blob([lines.join('\n')], { type: 'application/x-jsonlines' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `papers_${filteredPapers.length}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
