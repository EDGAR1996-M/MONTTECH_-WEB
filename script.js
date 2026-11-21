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

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
      toggle.focus();
    }
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

/* =================================
   MONTTECH - ANIMACIONES AL SCROLL
================================= */

const revealSections = document.querySelectorAll(
    'section'
);

revealSections.forEach(section => {
    section.classList.add('reveal-section');
});

if ('IntersectionObserver' in window) {

    const revealObserver = new IntersectionObserver(
        (entries, observer) => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    entry.target.classList.add('is-visible');

                    observer.unobserve(entry.target);
                }

            });

        },
        {
            threshold: 0.12,
            rootMargin: '0px 0px -40px 0px'
        }
    );

    revealSections.forEach(section => {
        revealObserver.observe(section);
    });

} else {

    revealSections.forEach(section => {
        section.classList.add('is-visible');
    });

}


/* =========================================
   6. NAVEGACIÓN ACTIVA SEGÚN LA SECCIÓN
========================================= */
const navigationLinks = document.querySelectorAll('.nav-links a');
const observedSections = document.querySelectorAll('main section[id]');

if ('IntersectionObserver' in window && navigationLinks.length && observedSections.length) {
  const navigationObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navigationLinks.forEach(link => {
        const active = link.getAttribute('href') === '#' + entry.target.id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-25% 0px -65% 0px', threshold: 0 });

  observedSections.forEach(section => navigationObserver.observe(section));
}
