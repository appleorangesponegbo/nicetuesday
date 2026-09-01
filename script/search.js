document.addEventListener('DOMContentLoaded', function () {
  const searchInput = document.getElementById('gameSearch');
  const gameList = document.getElementById('gameList');
  if (!searchInput || !gameList) return;

  searchInput.addEventListener('input', function () {
    const query = this.value.trim().toLowerCase();
    const buttons = gameList.querySelectorAll('.g-launch');

    buttons.forEach(function (btn) {
      const title = (
        btn.getAttribute('n') ||
        btn.dataset.n ||
        ''
      ).toLowerCase();

      const match = title.includes(query);
      btn.style.display = match ? '' : 'none';
    });
  });
});
