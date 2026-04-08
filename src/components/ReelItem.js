const DOUBLE_TAP_THRESHOLD_MS = 300;

export class ReelItem extends HTMLElement {
  #rafId = null;
  #currentProgress = 0;
  #targetProgress = 0;
  #isActive = false;
  #lastTap = 0;

  constructor() {
    super();
    this.initialized = false;
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    const template = document.getElementById("reel-template");
    this.appendChild(template.content.cloneNode(true));

    this.video = this.querySelector("video");
    this.ui = {
      progressBar: this.querySelector(".progress-bar"),
      progressContainer: this.querySelector(".progress-container"),
      descContainer: this.querySelector(".description-container"),
      description: this.querySelector(".description"),
      likeBtn: this.querySelector(".like-btn"),
      followBtn: this.querySelector(".follow-btn"),
      avatar: this.querySelector(".avatar"),
      username: this.querySelector(".username"),
      category: this.querySelector(".category"),
      likeCount: this.querySelector(".like-count"),
      floatingHeart: this.querySelector(".floating-heart"),
    };

    this.#bindEvents();
  }

  disconnectedCallback() {
    this.#pause();
  }

  set data(model) {
    if (!this.initialized || !model) return;

    const isNewItem = this.dataset.id !== model.id;

    if (isNewItem) {
      this.#setItemData(model);
    } else {
      this.#updateItemState(model);
    }

    this.ui.likeCount.textContent = this.#formatCount(model.likes);
    this.ui.followBtn.classList.toggle("following", model.isFollowing);
    this.ui.followBtn.textContent = model.isFollowing ? "✓" : "+";
  }

  #setItemData(model) {
    this.dataset.id = model.id;
    this.ui.avatar.src = model.avatar;
    this.ui.username.textContent = model.username;
    this.ui.description.textContent = model.description;
    this.ui.category.textContent = model.category;
    this.ui.likeBtn.classList.toggle("liked", model.isLiked);

    const newSrc = window.location.origin + `/${model.src}`;
    if (this.video.src !== newSrc) {
      this.video.pause();
      this.video.src = newSrc;
      this.video.load();
    }
  }

  #updateItemState(model) {
    // Only sync like state if it differs from current DOM state
    const isCurrentlyLiked = this.ui.likeBtn.classList.contains("liked");
    if (model.isLiked !== isCurrentlyLiked) {
      this.ui.likeBtn.classList.toggle("liked", model.isLiked);
    }
  }

  set active(isActive) {
    if (!this.initialized) return;
    this.#isActive = isActive;
    if (isActive) this.#play();
    else this.#pause();
  }

  #play() {
    if (!this.video || this.video.readyState < 2) return;
    const playPromise = this.video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.video.muted = true;
        this.video.play().catch(() => {});
      });
    }
    this.#startProgressLoop();
  }

  #pause() {
    this.video?.pause();
    this.#stopProgressLoop();
  }

  #startProgressLoop() {
    this.#stopProgressLoop();
    const animate = () => {
      this.#currentProgress +=
        (this.#targetProgress - this.#currentProgress) * 0.1;
      this.ui.progressBar.style.width = `${this.#currentProgress}%`;
      this.#rafId = requestAnimationFrame(animate);
    };
    this.#rafId = requestAnimationFrame(animate);
  }

  #stopProgressLoop() {
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  #bindEvents() {
    this.#setupVideoLifecycleEvents();
    this.#setupGestureHandling();
    this.#setupUIListeners();
  }

  #setupVideoLifecycleEvents() {
    this.video?.addEventListener("timeupdate", () => {
      if (this.video.duration) {
        this.#targetProgress =
          (this.video.currentTime / this.video.duration) * 100;
      }
    });

    this.video?.addEventListener("canplay", () => {
      if (this.#isActive) this.#play();
    });
  }

  #setupGestureHandling() {
    let tapTimeout;

    this.video?.addEventListener("pointerup", (e) => {
      const now = performance.now();
      const tapLength = now - this.#lastTap;

      if (tapLength < DOUBLE_TAP_THRESHOLD_MS && tapLength > 0) {
        // Double-tap detected
        clearTimeout(tapTimeout);
        this.#handleDoubleTap(e);
      } else {
        // Single tap - wait to see if second tap comes
        clearTimeout(tapTimeout);
        tapTimeout = setTimeout(
          () => this.#handleSingleTap(),
          DOUBLE_TAP_THRESHOLD_MS,
        );
      }

      this.#lastTap = now;
    });
  }

  #setupUIListeners() {
    this.ui.progressContainer?.addEventListener("click", (e) => {
      const rect = this.ui.progressContainer.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      if (this.video.duration)
        this.video.currentTime = pos * this.video.duration;
    });

    this.ui.descContainer?.addEventListener("click", () => {
      this.ui.descContainer.classList.toggle("expanded");
    });

    this.ui.floatingHeart?.addEventListener("animationend", () => {
      this.ui.floatingHeart.classList.remove("animate");
    });

    this.ui.likeBtn?.addEventListener("click", () => {
      const isLiked = this.ui.likeBtn.classList.toggle("liked");

      if (isLiked) {
        // Trigger animation by removing and re-adding the class
        requestAnimationFrame(() => {
          this.ui.likeBtn.classList.remove("liked");
          requestAnimationFrame(() => {
            this.ui.likeBtn.classList.add("liked");
          });
        });
      }

      this.onAction?.({ type: "TOGGLE_LIKE", id: this.dataset.id });
    });

    this.ui.followBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onAction?.({ type: "TOGGLE_FOLLOW", id: this.dataset.id });
    });
  }

  #handleDoubleTap(e) {
    const isNowLiked = this.ui.likeBtn.classList.toggle("liked");

    if (isNowLiked) {
      requestAnimationFrame(() => {
        this.ui.likeBtn.classList.remove("liked");
        requestAnimationFrame(() => {
          this.ui.likeBtn.classList.add("liked");
        });
      });
    }

    this.onAction?.({ type: "TOGGLE_LIKE", id: this.dataset.id });
    this.#showDoubleTapHeart(e.clientX, e.clientY);
    e.preventDefault();
  }

  #handleSingleTap() {
    if (this.video.paused) this.#play();
    else this.#pause();
  }

  #showDoubleTapHeart(x, y) {
    const heart = this.ui.floatingHeart;
    if (!heart || heart.classList.contains("animate")) return;

    const rect = this.getBoundingClientRect();
    heart.style.left = `${x - rect.left - 40}px`;
    heart.style.top = `${y - rect.top - 40}px`;
    heart.classList.add("animate");
  }

  #formatCount(num) {
    return num >= 1000 ? (num / 1000).toFixed(1) + "K" : num.toString();
  }
}

customElements.define("reel-item", ReelItem);
