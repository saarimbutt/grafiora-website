/* Grafiora — shared behaviour for all pages.
   Video loading: hero/feature videos load after the page load event (posters
   cover until frames play, 3.5s safety release, tap-to-play works early).
   All other videos lazy-load via IntersectionObserver (500px margin).
   Autoplay videos play muted in view and pause out of view.
   Unmuting one video mutes the others. FAQ is a single-open accordion. */
(function () {
  "use strict";

  var videos = Array.prototype.slice.call(document.querySelectorAll("video[data-src]"));

  function attach(video) {
    if (video.dataset.attached) return;
    video.dataset.attached = "1";
    video.src = video.dataset.src;
    video.load();
  }

  function playVideo(video) {
    attach(video);
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked; poster stays */ });
  }

  function syncPlayButton(media) {
    var video = media.querySelector("video");
    var btn = media.querySelector(".vbtn-play");
    if (!video || !btn) return;
    var playing = !video.paused && !video.ended;
    btn.classList.toggle("is-playing", playing);
    var cat = media.closest("[data-category]");
    var label = cat ? cat.getAttribute("data-category") : "video";
    btn.setAttribute("aria-label", (playing ? "Pause " : "Play ") + label + " ad");
  }

  function syncMuteButton(media) {
    var video = media.querySelector("video");
    var btn = media.querySelector(".vbtn-mute");
    if (!video || !btn) return;
    btn.classList.toggle("is-unmuted", !video.muted);
    var cat = media.closest("[data-category]");
    var label = cat ? cat.getAttribute("data-category") : "video";
    btn.setAttribute("aria-label", (video.muted ? "Unmute " : "Mute ") + label + " ad");
  }

  function muteOthers(except) {
    videos.forEach(function (v) {
      if (v !== except && !v.muted) {
        v.muted = true;
        var m = v.closest(".vcard-media");
        if (m) syncMuteButton(m);
      }
    });
  }

  videos.forEach(function (video) {
    var media = video.closest(".vcard-media");
    if (!media) return;

    video.addEventListener("playing", function () {
      media.classList.add("is-playing");
      syncPlayButton(media);
    });
    video.addEventListener("pause", function () { syncPlayButton(media); });
    video.addEventListener("volumechange", function () { syncMuteButton(media); });

    var playBtn = media.querySelector(".vbtn-play");
    if (playBtn) {
      playBtn.addEventListener("click", function () {
        if (video.paused) {
          playVideo(video);
        } else {
          video.pause();
        }
        syncPlayButton(media);
      });
    }

    var muteBtn = media.querySelector(".vbtn-mute");
    if (muteBtn) {
      muteBtn.addEventListener("click", function () {
        if (video.muted) {
          muteOthers(video);
          video.muted = false;
          video.volume = 1;
          if (video.paused) playVideo(video);
        } else {
          video.muted = true;
        }
        syncMuteButton(media);
      });
    }

    syncPlayButton(media);
    syncMuteButton(media);
  });

  /* Deferred videos (hero trio, project feature): load after window load. */
  var deferred = videos.filter(function (v) { return v.hasAttribute("data-defer"); });
  var released = false;
  function releaseDeferred() {
    if (released) return;
    released = true;
    deferred.forEach(function (video) {
      attach(video);
      if (video.hasAttribute("data-autoplay")) playVideo(video);
    });
  }
  if (deferred.length) {
    window.addEventListener("load", releaseDeferred);
    setTimeout(releaseDeferred, 3500);
  }

  /* Lazy videos: IntersectionObserver, 500px margin. */
  var lazy = videos.filter(function (v) { return !v.hasAttribute("data-defer"); });
  if ("IntersectionObserver" in window && lazy.length) {
    var loader = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          attach(entry.target);
          loader.unobserve(entry.target);
        }
      });
    }, { rootMargin: "500px 0px" });
    lazy.forEach(function (v) { loader.observe(v); });

    var autoplayOnes = lazy.filter(function (v) { return v.hasAttribute("data-autoplay"); });
    if (autoplayOnes.length) {
      var watcher = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var video = entry.target;
          if (entry.isIntersecting) {
            if (video.dataset.attached) playVideo(video);
            else video.addEventListener("loadeddata", function onReady() {
              video.removeEventListener("loadeddata", onReady);
              playVideo(video);
            });
          } else if (!video.paused) {
            video.pause();
          }
        });
      }, { threshold: 0.25 });
      autoplayOnes.forEach(function (v) { watcher.observe(v); });
    }
  } else {
    lazy.forEach(function (v) {
      attach(v);
      if (v.hasAttribute("data-autoplay")) playVideo(v);
    });
  }

  /* Deferred autoplay videos also pause out of view. */
  var deferredAuto = deferred.filter(function (v) { return v.hasAttribute("data-autoplay"); });
  if ("IntersectionObserver" in window && deferredAuto.length) {
    var dw = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        if (!video.dataset.attached) return;
        if (entry.isIntersecting) playVideo(video);
        else if (!video.paused) video.pause();
      });
    }, { threshold: 0.25 });
    deferredAuto.forEach(function (v) { dw.observe(v); });
  }

  /* FAQ: single-open accordion, all closed by default. */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var btn = item.querySelector(".faq-q");
    var panel = item.querySelector(".faq-a");
    if (!btn || !panel) return;
    btn.addEventListener("click", function () {
      var willOpen = !item.classList.contains("open");
      document.querySelectorAll(".faq-item").forEach(function (other) {
        other.classList.remove("open");
        var b = other.querySelector(".faq-q");
        var p = other.querySelector(".faq-a");
        if (b) b.setAttribute("aria-expanded", "false");
        if (p) p.style.maxHeight = "0px";
      });
      if (willOpen) {
        item.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });
  });

  /* Header hamburger menu (<=1023px): dropdown with all links + Contact. */
  var navToggle = document.querySelector(".nav-toggle");
  var mainNav = document.getElementById("main-nav");
  function closeMenu() {
    if (!mainNav || !navToggle) return;
    mainNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open menu");
  }
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var open = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    mainNav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }
  /* Legal dialogs (single-page home): Privacy Policy and Terms &
     Conditions open in place instead of loading another page. */
  (function () {
    var triggers = document.querySelectorAll("[data-dialog]");
    if (!triggers.length) return;
    var lastTrigger = null;
    function openDialog(id, trigger) {
      var dlg = document.getElementById(id);
      if (!dlg) return;
      lastTrigger = trigger || null;
      dlg.hidden = false;
      document.body.style.overflow = "hidden";
      var closeBtn = dlg.querySelector(".dialog-close");
      if (closeBtn) closeBtn.focus();
    }
    function closeDialog(dlg) {
      dlg.hidden = true;
      document.body.style.overflow = "";
      if (lastTrigger) lastTrigger.focus();
    }
    triggers.forEach(function (t) {
      t.addEventListener("click", function () {
        openDialog(t.getAttribute("data-dialog"), t);
      });
    });
    document.querySelectorAll(".dialog-overlay").forEach(function (dlg) {
      dlg.addEventListener("click", function (e) {
        if (e.target === dlg || e.target.closest(".dialog-close")) closeDialog(dlg);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".dialog-overlay").forEach(function (dlg) {
          if (!dlg.hidden) closeDialog(dlg);
        });
      }
    });
  })();

  /* Videos gallery filter: chip buttons show only one category.
     Guarded on #video-filter, so other pages are unaffected. Hidden
     cards pause their video so no audio keeps playing off-screen. */
  (function () {
    var filterBar = document.getElementById("video-filter");
    var grid = document.getElementById("video-grid");
    if (!filterBar || !grid) return;
    var chips = Array.prototype.slice.call(filterBar.querySelectorAll(".filter-chip"));
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".work-card"));
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var wanted = chip.getAttribute("data-filter");
        chips.forEach(function (c) {
          var active = c === chip;
          c.classList.toggle("is-active", active);
          c.setAttribute("aria-pressed", active ? "true" : "false");
        });
        cards.forEach(function (card) {
          var show = wanted === "all" || card.getAttribute("data-category") === wanted;
          card.classList.toggle("is-hidden", !show);
          if (!show) {
            var video = card.querySelector("video");
            if (video && !video.paused) video.pause();
          }
        });
      });
    });
  })();

  /* Scroll progress line: thin yellow bar fixed at the very top of the
     viewport; fills left-to-right as the page scrolls down, empties back
     as it scrolls up. The bar element is created here so every page gets
     it with no markup changes. */
  var progressBar = document.createElement("div");
  progressBar.className = "scroll-progress";
  progressBar.setAttribute("aria-hidden", "true");
  document.body.appendChild(progressBar);
  var progressQueued = false;
  function updateProgress() {
    progressQueued = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var pct = 0;
    if (max > 0) {
      pct = Math.min(100, Math.max(0, (window.scrollY || window.pageYOffset) / max * 100));
    }
    progressBar.style.width = pct + "%";
  }
  function queueProgress() {
    if (progressQueued) return;
    progressQueued = true;
    if ("requestAnimationFrame" in window) requestAnimationFrame(updateProgress);
    else updateProgress();
  }
  window.addEventListener("scroll", queueProgress, { passive: true });
  window.addEventListener("resize", queueProgress);
  updateProgress();
})();
