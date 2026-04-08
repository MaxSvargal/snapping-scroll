class ReelItem extends HTMLElement {
  constructor() {
    super();
    this.initialized = false;
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    const template = document.getElementById("reel-template");
    if (!template) return;

    this.appendChild(template.content.cloneNode(true));

    this.video = this.querySelector("video");
    this.ui = {
      overlay: this.querySelector(".reels-overlay"),
      progressBar: this.querySelector(".progress-bar"),
      progressContainer: this.querySelector(".progress-container"),
      descContainer: this.querySelector(".description-container"),
      likeBtn: this.querySelector(".like-btn"),
      heartIcon: this.querySelector(".heart-icon"),
      followBtn: this.querySelector(".follow-btn"),
      avatar: this.querySelector(".avatar"),
      username: this.querySelector(".username"),
      likeCount: this.querySelector(".like-count"),
    };

    this.#bindEvents();
  }

  #bindEvents() {
    if (!this.video) return;

    this.video.addEventListener("timeupdate", () => {
      if (this.video.duration && this.ui.progressBar) {
        const percent = (this.video.currentTime / this.video.duration) * 100;
        this.ui.progressBar.style.width = `${percent}%`;
      }
    });

    this.ui.progressContainer?.addEventListener("click", (e) => {
      const rect = this.ui.progressContainer.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      this.video.currentTime = pos * this.video.duration;
    });

    this.ui.descContainer?.addEventListener("click", () => {
      this.ui.descContainer.classList.toggle("expanded");
    });

    this.ui.likeBtn?.addEventListener("click", () => {
      const isLiked = this.ui.likeBtn.classList.toggle("liked");
      this.ui.heartIcon.setAttribute("fill", isLiked ? "#ff3040" : "none");
      this.ui.heartIcon.setAttribute(
        "stroke",
        isLiked ? "#ff3040" : "currentColor",
      );
    });

    this.ui.followBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const isFollowing = this.ui.followBtn.classList.toggle("following");
      this.ui.followBtn.textContent = isFollowing ? "✓" : "+";
    });
  }

  updateData(index, videoSrc) {
    if (!this.initialized || !this.video) return;

    this.video.src = `/${videoSrc}`;

    if (this.ui.avatar)
      this.ui.avatar.src = `https://i.pravatar.cc/150?u=${index + 10}`;
    if (this.ui.username)
      this.ui.username.textContent = `@creator_${index + 1}`;
    if (this.ui.likeCount)
      this.ui.likeCount.textContent = `${(Math.random() * 100).toFixed(1)}K`;
  }

  playVideo() {
    if (this.video && this.video.getAttribute("src"))
      this.video.play().catch(() => {});
  }

  pauseVideo() {
    this.video?.pause();
  }
}

customElements.define("reel-item", ReelItem);
