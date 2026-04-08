export class ReelItem extends HTMLElement {
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
    };

    this.#bindEvents();
  }

  set data(model) {
    if (!this.initialized || this.dataset.id === model.id) return;
    this.dataset.id = model.id;

    this.ui.avatar.src = model.avatar;
    this.ui.username.textContent = model.username;
    this.ui.description.textContent = model.description;
    this.ui.category.textContent = model.category;
    this.ui.likeCount.textContent = this.#formatCount(model.likes);
    this.ui.likeBtn.classList.toggle("liked", model.isLiked);
    this.ui.followBtn.classList.toggle("following", model.isFollowing);
    this.ui.followBtn.textContent = model.isFollowing ? "✓" : "+";

    const newSrc = window.location.origin + `/${model.src}`;
    if (this.video.src !== newSrc) {
      this.video.pause();
      this.video.src = newSrc;
      this.video.load();
    }
  }

  set active(isActive) {
    if (!this.initialized) return;
    if (isActive) this.#play();
    else this.#pause();
  }

  #play() {
    this.video?.play();
  }

  #pause() {
    this.video?.pause();
  }

  #bindEvents() {
    this.video?.addEventListener("timeupdate", () => {
      if (this.video.duration && this.ui.progressBar) {
        const percent = parseInt(
          (this.video.currentTime / this.video.duration) * 100,
        );
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
      this.onAction?.({ type: "TOGGLE_LIKE", id: this.dataset.id });
    });

    this.ui.followBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onAction?.({ type: "TOGGLE_FOLLOW", id: this.dataset.id });
    });
  }

  #formatCount(num) {
    return num >= 1000 ? (num / 1000).toFixed(1) + "K" : num.toString();
  }
}

customElements.define("reel-item", ReelItem);
