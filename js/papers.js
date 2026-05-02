const venueFiles = {
    'ICLR 2024': 'papers/iclr2024_oral_spotlight.json',
    'ICLR 2025': 'papers/iclr2025_oral_spotlight.json',
    'ICLR 2026': 'papers/iclr2026_oral_spotlight.json',
    'NeurIPS 2024': 'papers/neurips2024_oral_spotlight.json',
    'NeurIPS 2025': 'papers/neurips2025_oral_spotlight.json',
    'ICML 2024': 'papers/icml2024_oral_spotlight.json',
    'ICML 2025': 'papers/icml2025_oral_spotlight.json',
    'ACL 2024': 'papers/acl2024_oral.json',
    'ACL 2025': 'papers/acl2025_oral.json',
    'EMNLP 2024': 'papers/emnlp2024_oral.json',
    'EMNLP 2025': 'papers/emnlp2025_oral.json',
    'COLM 2024': 'papers/colm2024_all.json',
    'COLM 2025': 'papers/colm2025_all.json',
};

let allPapers = [];
let filteredPapers = [];
let currentPage = 1;
let papersPerPage = 20;
let showFavoritesOnly = false;

async function loadPapers() {
    const promises = Object.entries(venueFiles).map(async ([venue, file]) => {
        try {
            const response = await fetch(file);
            if (!response.ok) return [];
            const papers = await response.json();
            return papers.map(paper => {
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

    const cs = document.getElementById('conference-filter');
    conferences.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; cs.appendChild(o); });

    const ys = document.getElementById('year-filter');
    years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; ys.appendChild(o); });
}

function applyFilters() {
    const conference = document.getElementById('conference-filter').value;
    const year = document.getElementById('year-filter').value;
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

    currentPage = 1;
    renderPapers();
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

function createPaperCard(paper) {
    const [conf] = paper.venue.split(' ');
    const venueClass = `venue-${conf.toLowerCase()}`;
    const keywords = (paper.keywords || []).slice(0, 5);
    const area = paper.primary_area;
    const award = paper.award;

    let tags = '';
    if (award) tags += `<span class="tag award"><i class="fas fa-award"></i> ${award}</span>`;
    if (area) tags += `<span class="tag area">${area}</span>`;
    keywords.forEach(kw => { tags += `<span class="tag">${kw}</span>`; });

    const tldr = paper.tldr ? `<div class="tldr"><strong>TL;DR:</strong> ${paper.tldr}</div>` : '';

    const authors = paper.authors || [];
    const authorsStr = authors.length > 5
        ? authors.slice(0, 5).join(', ') + ` et al. (${authors.length} authors)`
        : authors.join(', ');

    return `<div class="paper-card" data-url="${paper.pdf_url}">
        <span class="paper-venue ${venueClass}">${paper.venue}</span>
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
