document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  const currentPath = window.location.pathname;
  const links = [
    { href: 'submit.html', label: 'Gửi Phản Hồi' },
    { href: 'admin.html',  label: 'Xem Phản Hồi' },
  ];
  nav.innerHTML = links.map(link => {
    const active = currentPath.endsWith(link.href.split('/').pop());
    return `<a href="${link.href}"
      class="px-4 py-2 rounded text-sm font-medium transition-colors
             ${active
               ? 'bg-white text-blue-700'
               : 'text-white hover:bg-blue-500'}"
    >${link.label}</a>`;
  }).join('');
});
