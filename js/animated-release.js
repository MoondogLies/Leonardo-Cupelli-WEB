// Animated release: the section is long only while the reader scrolls down through the animation.
// Once it has been passed (or the reader turns back up after it has finished) it collapses to one
// screen like the other releases, keeping the view where it is; it becomes long again only after the
// reader has gone back above it, ready for the next descent.
(() => {
  const list = document.getElementById("release-list");
  if (!list) return;

  let frame = 0;
  let lastY = window.scrollY;

  function finished(article) {
    const anim = article.querySelector("dattilogramma-scroll");
    if (!anim) return true;
    const end = (parseFloat(anim.getAttribute("end")) || 100) / 100;
    return (anim.reached ?? 0) >= end - .001;
  }

  function collapse(article, keep) {
    // read before the change: some browsers shift the scroll position themselves (scroll anchoring)
    const scrolled = window.scrollY;
    const before = article.offsetHeight;
    const top = article.getBoundingClientRect().top + scrolled;
    article.classList.add("is-collapsed");
    const removed = before - article.offsetHeight;
    // past the section: everything moves up by the height removed, so scroll back by the same amount;
    // inside it: the pinned view is the section's first screen, so go to its top
    const y = keep === "below" ? scrolled - removed : top;
    window.scrollTo({ top: y, behavior: "instant" });
    lastY = window.scrollY;
  }

  function update() {
    frame = 0;
    const y = window.scrollY;
    const goingUp = y < lastY;
    lastY = y;
    list.querySelectorAll(".release--animated").forEach(article => {
      const rect = article.getBoundingClientRect();
      if (article.classList.contains("is-collapsed")) {
        if (rect.top >= window.innerHeight) article.classList.remove("is-collapsed");
        return;
      }
      if (rect.bottom <= 0) collapse(article, "below");
      else if (goingUp && rect.top <= 0 && finished(article)) collapse(article, "inside");
    });
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("pageshow", schedule);
  new MutationObserver(schedule).observe(list, { childList: true });
  schedule();
})();
