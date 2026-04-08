class ReelItem extends HTMLElement {
  constructor() {
    super();
    this.initialized = false;
    this._currentDataId = null;
    this._isVisible = false;
    this._observer = null;
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    const template = document.getElementById("reel-template");
    if (!template) return;

    this.appendChild(template.content.cloneNode(true));

    this.video = this.querySelector("video");
    this.ui = {
      progressBar: this.querySelector(".progress-bar"),
      progressContainer: this.querySelector(".progress-container"),
      descContainer: this.querySelector(".description-container"),
      description: this.querySelector(".description"),
      likeBtn: this.querySelector(".like-btn"),
      heartIcon: this.querySelector(".heart-icon"),
      followBtn: this.querySelector(".follow-btn"),
      avatar: this.querySelector(".avatar"),
      username: this.querySelector(".username"),
      category: this.querySelector(".category"),
      likeCount: this.querySelector(".like-count"),
    };

    this.#bindEvents();
    this.#initObserver();
  }

  disconnectedCallback() {
    if (this._observer) {
      this._observer.disconnect();
    }
  }

  set data(videoModel) {
    if (!this.initialized || !videoModel) return;

    this._currentDataId = videoModel.id;

    const newSrc = `/${videoModel.src}`;
    if (this.video.getAttribute("src") !== newSrc) {
      this.video.src = newSrc;
      if (this._isVisible)
        this.video.play().catch((e) => console.warn("Autoplay prevented:", e));
    }

    this.ui.avatar.src = videoModel.avatar;
    this.ui.username.textContent = videoModel.username;
    this.ui.description.textContent = videoModel.description;
    this.ui.category.textContent = videoModel.category;
    this.ui.likeCount.textContent = this.#formatCount(videoModel.likes);

    this.ui.likeBtn.classList.toggle("liked", videoModel.isLiked);
    this.ui.followBtn.classList.toggle("following", videoModel.isFollowing);
    this.ui.followBtn.textContent = videoModel.isFollowing ? "✓" : "+";
  }

  #bindEvents() {
    this.video?.addEventListener("timeupdate", () => {
      if (this.video.duration && this.ui.progressBar) {
        const percent = (this.video.currentTime / this.video.duration) * 100;
        this.ui.progressBar.style.width = `${percent}%`;
      }
    });

    this.ui.progressContainer?.addEventListener("click", (e) => {
      const rect = this.ui.progressContainer.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      if (this.video.duration)
        this.video.currentTime = pos * this.video.duration;
    });

    this.ui.descContainer?.addEventListener("click", () => {
      this.ui.descContainer.classList.toggle("expanded");
    });

    this.ui.likeBtn?.addEventListener("click", () => {
      this.onAction({ type: "TOGGLE_LIKE", id: this._currentDataId });
    });

    this.ui.followBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onAction({ type: "TOGGLE_FOLLOW", id: this._currentDataId });
    });
  }

  #initObserver() {
    this._observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        this._isVisible = entry.isIntersecting;

        if (this._isVisible)
          if (this.video?.getAttribute("src"))
            this.video
              .play()
              .catch((e) => console.warn("Autoplay prevented:", e));
          else this.video?.pause();
      },
      { threshold: 0.45 },
    );

    this._observer.observe(this);
  }

  #formatCount(num) {
    return num >= 1000 ? (num / 1000).toFixed(1) + "K" : num.toString();
  }
}

customElements.define("reel-item", ReelItem);
