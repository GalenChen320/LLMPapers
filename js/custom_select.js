function initCustomSelect(el) {
    const id = el.dataset.id;
    const trigger = el.querySelector('.custom-select-trigger');
    const optionsContainer = el.querySelector('.custom-select-options');
    const triggerSpan = trigger.querySelector('span');

    let hiddenSelect = document.getElementById(id);
    if (!hiddenSelect) {
        hiddenSelect = document.createElement('select');
        hiddenSelect.id = id;
        hiddenSelect.style.display = 'none';
        document.body.appendChild(hiddenSelect);
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select.open').forEach(s => {
            if (s !== el) s.classList.remove('open');
        });
        el.classList.toggle('open');
    });

    optionsContainer.addEventListener('click', (e) => {
        const opt = e.target.closest('.custom-select-option');
        if (!opt) return;
        e.stopPropagation();
        const value = opt.dataset.value;
        const label = opt.textContent;
        el.dataset.value = value;
        triggerSpan.textContent = label;
        el.classList.remove('open');
        optionsContainer.querySelectorAll('.custom-select-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.value === value);
        });
        setHiddenOption(hiddenSelect, value);
        hiddenSelect.dispatchEvent(new Event('change'));
    });

    document.addEventListener('click', () => {
        el.classList.remove('open');
    });
}

function setHiddenOption(hiddenSelect, value) {
    hiddenSelect.value = value;
}

function addCustomOption(selectEl, value, label) {
    const optionsContainer = selectEl.querySelector('.custom-select-options');
    const opt = document.createElement('div');
    opt.className = 'custom-select-option';
    opt.dataset.value = value;
    opt.textContent = label;

    const current = selectEl.dataset.value;
    if (value === current) opt.classList.add('selected');

    optionsContainer.appendChild(opt);

    const hiddenSelect = document.getElementById(selectEl.dataset.id);
    const hOpt = document.createElement('option');
    hOpt.value = value;
    hOpt.textContent = label;
    hiddenSelect.appendChild(hOpt);
}

function setCustomValue(selectEl, value) {
    selectEl.dataset.value = value;
    const triggerSpan = selectEl.querySelector('.custom-select-trigger span');
    const opt = selectEl.querySelector(`.custom-select-option[data-value="${value}"]`);
    if (opt) {
        triggerSpan.textContent = opt.textContent;
        selectEl.querySelectorAll('.custom-select-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.value === value);
        });
    }
    const hiddenSelect = document.getElementById(selectEl.dataset.id);
    if (hiddenSelect) hiddenSelect.value = value;
}

function initAllCustomSelects() {
    document.querySelectorAll('.custom-select').forEach(initCustomSelect);
}
