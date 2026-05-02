function openModal(paper) {
    const [conf] = paper.venue.split(' ');
    const venueClass = `venue-${conf.toLowerCase()}`;
    const keywords = paper.keywords || [];
    const area = paper.primary_area;
    const award = paper.award;
    const authors = paper.authors || [];

    let tags = '';
    if (award) tags += `<span class="tag award"><i class="fas fa-award"></i> ${award}</span>`;
    if (area) tags += `<span class="tag area">${area}</span>`;
    keywords.forEach(kw => { tags += `<span class="tag">${kw}</span>`; });

    const tldr = paper.tldr ? `<div class="modal-tldr"><strong>TL;DR:</strong> ${escapeHtml(paper.tldr)}</div>` : '';

    document.getElementById('modal-content').innerHTML = `
        <span class="paper-venue ${venueClass}">${paper.venue}</span>
        <h2 class="modal-title">${escapeHtml(paper.title)}</h2>
        <p class="modal-authors"><i class="fas fa-users"></i> ${escapeHtml(authors.join(', '))}</p>
        ${tldr}
        <p class="modal-abstract">${escapeHtml(paper.abstract || 'No abstract available')}</p>
        ${tags ? `<div class="modal-tags">${tags}</div>` : ''}
        <div class="modal-actions">
            <a href="${paper.pdf_url}" target="_blank"><i class="fas fa-file-pdf"></i> PDF</a>
            <a href="${paper.html_url}" target="_blank"><i class="fas fa-external-link-alt"></i> View</a>
            <button class="fav-btn${isFavorite(paper) ? ' active' : ''}" data-url="${paper.pdf_url}" title="Toggle favorite"><i class="fas fa-heart"></i></button>
        </div>
    `;

    document.getElementById('modal-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.body.style.overflow = '';
}
