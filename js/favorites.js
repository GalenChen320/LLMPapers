function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem('favorites') || '[]');
    } catch { return []; }
}

function saveFavorites(favs) {
    localStorage.setItem('favorites', JSON.stringify(favs));
}

function isFavorite(paper) {
    return getFavorites().includes(paper.pdf_url);
}

function toggleFavorite(paper) {
    let favs = getFavorites();
    if (favs.includes(paper.pdf_url)) {
        favs = favs.filter(u => u !== paper.pdf_url);
    } else {
        favs.push(paper.pdf_url);
    }
    saveFavorites(favs);
    updateFavCount();
    if (showFavoritesOnly) applyFilters();
}

function updateFavCount() {
    const count = getFavorites().length;
    document.getElementById('fav-count').textContent = count;
    document.getElementById('fav-stat-count').textContent = count;
}
