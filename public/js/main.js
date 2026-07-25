document.addEventListener('DOMContentLoaded', () => {
  const logoImgs = document.querySelectorAll('.logo-img');
  logoImgs.forEach((img) => {
    img.src = '/images/logo.svg';
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  const progressBars = document.querySelectorAll('.prog-fill');
  progressBars.forEach((bar, index) => {
    setTimeout(() => bar.classList.add('animated'), 150 * index + 200);
  });
});
