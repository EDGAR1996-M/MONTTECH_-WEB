/* =========================================
   MONTTECH 2.0
   FUNCIONALIDADES PRINCIPALES
========================================= */


/* =========================================
   1. MENÚ DE NAVEGACIÓN
========================================= */

const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');

if (toggle && nav) {

  toggle.addEventListener('click', () => {

    const isOpen = nav.classList.toggle('open');

    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.textContent = isOpen ? '×' : '☰';

  });

  document.querySelectorAll('.nav-links a').forEach(link => {

    link.addEventListener('click', () => {

      nav.classList.remove('open');

      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';

    });

  });

}


/* =========================================
   2. AÑO AUTOMÁTICO DEL FOOTER
========================================= */

const yearElement = document.getElementById('year');

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}


/* =========================================
   3. FILTROS DEL PORTAFOLIO
========================================= */

const filterButtons = document.querySelectorAll('.filter-btn');
const projectCards = document.querySelectorAll('.project-card');

filterButtons.forEach(button => {

  button.addEventListener('click', () => {

    // Categoría seleccionada
    const selectedFilter = button.dataset.filter;

    // Actualizar botón activo
    filterButtons.forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    });

    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');

    // Mostrar proyectos correspondientes
    projectCards.forEach(card => {

      const category = card.dataset.category;

      const shouldShow =
        selectedFilter === 'all' ||
        category === selectedFilter;

      if (shouldShow) {

        card.classList.remove('is-hidden');

        // Reiniciar animación
        card.style.animation = 'none';

        void card.offsetWidth;

        card.style.animation = 'projectAppear .5s ease both';

      } else {

        card.classList.add('is-hidden');

      }

    });

  });

});


/* =========================================
   4. ESTADO INICIAL DE LOS FILTROS
========================================= */

filterButtons.forEach(button => {

  button.setAttribute(
    'aria-pressed',
    button.classList.contains('active') ? 'true' : 'false'
  );

});