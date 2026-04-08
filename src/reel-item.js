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
      commentBtn: this.querySelector(".comment-btn"),
      commentsSheet: this.querySelector(".comments-sheet"),
      closeComments: this.querySelector(".close-comments"),
    };

    this.#bindEvents();
  }

  #bindEvents() {
    if (!this.video) return;

    this.video.addEventListener("click", () => {
      if (this.video.classList.contains("zoomed")) {
        this.closeComments();
      } else {
        this.video.paused ? this.video.play() : this.video.pause();
      }
    });

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

    this.ui.commentBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openComments();
    });

    this.ui.closeComments?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeComments();
    });
  }

  openComments() {
    this.ui.commentsSheet?.classList.add("open");
    this.video?.classList.add("zoomed");
    this.ui.overlay?.classList.add("hidden");
  }

  closeComments() {
    this.ui.commentsSheet?.classList.remove("open");
    this.video?.classList.remove("zoomed");
    this.ui.overlay?.classList.remove("hidden");
  }

  updateData(index, videoSrc) {
    if (!this.initialized || !this.video) return;

    this.video.src = `/${videoSrc}`;
    this.closeComments();

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
