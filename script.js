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

/* =========================================
   FORMULARIO DE CONTACTO A WHATSAPP
========================================= */
const whatsappForm = document.getElementById('whatsapp-form');

if (whatsappForm) {
  whatsappForm.addEventListener('submit', async event => {
    event.preventDefault();

    if (!whatsappForm.reportValidity()) return;

    const submitButton = whatsappForm.querySelector('button[type="submit"]');
    const feedback = document.getElementById('form-feedback');
    submitButton.disabled = true;
    const formData = new FormData(whatsappForm);
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const service = String(formData.get('service') || '').trim();
    const message = String(formData.get('message') || '').trim();

    const whatsappMessage = [
      'Hola, MONTTECH. Quisiera recibir información sobre un proyecto.',
      '',
      'Nombre: ' + name,
      email ? 'Correo: ' + email : '',
      'Servicio: ' + service,
      'Descripción: ' + message
    ].filter(Boolean).join('\n');

    const whatsappUrl = 'https://wa.me/573137250239?text=' + encodeURIComponent(whatsappMessage);
    const whatsappTab = window.open('about:blank', '_blank');
    if (whatsappTab) whatsappTab.opener = null;

    if (feedback) {
      feedback.textContent = 'Registrando tu solicitud...';
    }

    try {
      const csrfResponse = await fetch('/api/csrf', { credentials: 'same-origin' });
      const csrfData = await csrfResponse.json().catch(() => ({}));
      if (!csrfResponse.ok) throw new Error(csrfData.error || 'No pudimos iniciar una sesión segura.');

      const requestResponse = await fetch('/api/public/requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token
        },
        body: JSON.stringify({ name, email, service, message })
      });
      const requestData = await requestResponse.json().catch(() => ({}));
      if (!requestResponse.ok) throw new Error(requestData.error || 'No pudimos registrar tu solicitud.');

      if (feedback) feedback.textContent = 'Solicitud registrada. Revisa el mensaje antes de enviarlo por WhatsApp.';
      if (whatsappTab) whatsappTab.location.replace(whatsappUrl);
      else window.location.assign(whatsappUrl);
      whatsappForm.reset();
    } catch (error) {
      if (whatsappTab && !whatsappTab.closed) whatsappTab.close();
      if (feedback) {
        feedback.textContent = 'No pudimos guardar tu solicitud: ' + error.message + ' Puedes continuar por WhatsApp de todas formas: ';
        const fallbackLink = document.createElement('a');
        fallbackLink.href = whatsappUrl;
        fallbackLink.target = '_blank';
        fallbackLink.rel = 'noopener noreferrer';
        fallbackLink.textContent = 'abrir WhatsApp';
        feedback.appendChild(fallbackLink);
      }
    } finally {
      submitButton.disabled = false;
    }
  });
}

/* =========================================
   FICHAS INTERACTIVAS DEL PORTAFOLIO
========================================= */
const projectDialog = document.getElementById('project-dialog');
const projectDialogTitle = document.getElementById('project-dialog-title');
const projectDialogCategory = document.getElementById('project-dialog-category');
const projectDialogDescription = document.getElementById('project-dialog-description');
const projectDialogOutcome = document.getElementById('project-dialog-outcome');
const projectDialogTech = document.getElementById('project-dialog-tech');

const projectDetails = {
  web: {
    category: 'DESARROLLO WEB',
    title: 'Experiencias digitales',
    description: 'Propuesta de un sitio web corporativo adaptable, con navegación clara, presentación de servicios y contacto directo.',
    outcome: 'Una presencia digital clara y accesible para presentar una marca o negocio.',
    tech: 'HTML5 · CSS3 · JavaScript'
  },
  data: {
    category: 'ANÁLISIS DE DATOS',
    title: 'Información inteligente',
    description: 'Prototipo de tablero de indicadores con métricas, gráficos y filtros para explorar información de ejemplo.',
    outcome: 'Facilitar la lectura de indicadores y apoyar decisiones basadas en datos.',
    tech: 'Python · JavaScript · Visualización de datos'
  },
  apps: {
    category: 'APLICACIONES',
    title: 'Software a tu medida',
    description: 'Concepto de una aplicación de gestión con formularios, registros y vistas organizadas para un flujo de trabajo.',
    outcome: 'Organizar tareas y centralizar información en una herramienta sencilla.',
    tech: 'JavaScript · Interfaces web · Bases de datos (según alcance)'
  },
  automation: {
    category: 'AUTOMATIZACIÓN',
    title: 'Procesos inteligentes',
    description: 'Ejemplo conceptual de un flujo que conecta tareas repetitivas, validaciones y notificaciones.',
    outcome: 'Reducir tareas manuales y hacer más consistente un proceso.',
    tech: 'JavaScript · Integraciones · APIs (según alcance)'
  }
};

document.querySelectorAll('[data-open-project]').forEach(button => {
  button.addEventListener('click', () => {
    if (!projectDialog || typeof projectDialog.showModal !== 'function') return;
    const project = projectDetails[button.dataset.openProject];
    if (!project) return;
    projectDialogCategory.textContent = project.category;
    projectDialogTitle.textContent = project.title;
    projectDialogDescription.textContent = project.description;
    projectDialogOutcome.textContent = project.outcome;
    projectDialogTech.textContent = project.tech;
    projectDialog.showModal();
  });
});

if (projectDialog) {
  projectDialog.querySelectorAll('[data-close-project]').forEach(button => {
    button.addEventListener('click', () => projectDialog.close());
  });

  projectDialog.addEventListener('click', event => {
    if (event.target === projectDialog) projectDialog.close();
  });

  const dialogContact = document.getElementById('project-dialog-contact');
  if (dialogContact) dialogContact.addEventListener('click', () => projectDialog.close());
}

/* Ambientes visuales persistentes */
(() => {
 const picker=document.getElementById('site-theme');
 if(!picker)return;
 const allowed=['aurora','ocean','lavender','sunrise'];
 let saved='aurora';
 try{saved=localStorage.getItem('monttech-theme')||'aurora';}catch(_){}
 if(!allowed.includes(saved))saved='aurora';
 document.body.dataset.theme=saved;picker.value=saved;
 picker.addEventListener('change',()=>{
  const theme=allowed.includes(picker.value)?picker.value:'aurora';
  document.body.dataset.theme=theme;
  try{localStorage.setItem('monttech-theme',theme);}catch(_){}
 });
})();
