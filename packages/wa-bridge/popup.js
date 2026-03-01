document.addEventListener('DOMContentLoaded', () => {
  const waBadge   = document.getElementById('wa-badge');
  const waDot     = document.getElementById('wa-dot');
  const waText    = document.getElementById('wa-text');
  const tabCount  = document.getElementById('tab-count');
  const btnOpenWa = document.getElementById('btn-open-wa');

  // Consultar estado de WA Web al abrir el popup
  chrome.runtime.sendMessage({ type: 'WA_CHECK' }, (response) => {
    const open  = response?.waTabOpen ?? false;
    const count = response?.tabCount  ?? 0;

    if (open) {
      waBadge.className = 'badge badge-green';
      waDot.className   = 'dot dot-green';
      waText.textContent = 'Abierta';
      tabCount.textContent = `${count} pestaña${count !== 1 ? 's' : ''}`;
    } else {
      waBadge.className = 'badge badge-red';
      waDot.className   = 'dot dot-red';
      waText.textContent = 'No encontrada';
      tabCount.textContent = '0';
    }
  });

  // Botón "Abrir WhatsApp Web"
  btnOpenWa.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'WA_OPEN_HOME' }, () => {
      window.close(); // Cerrar popup tras abrir WA
    });
  });
});
