import { Component, cssFrom, htmlFrom } from "../lib/Component.js";
import { reactive } from "../lib/reactive.js";
import { GestureDetector } from "../lib/GestureDetector.js";
import { VideoProgress } from "../lib/VideoProgress.js";
import reelItemCss from "./ReelItem.css?raw";
import reelItemHtml from "./ReelItem.html?raw";

const DOUBLE_TAP_THRESHOLD_MS = 300;

/**
 * Custom element for a single video card in the reel feed.
 * @element reel-item
 * @extends {Component}
 * @property {((action: import('../stores/videoStore.js').StoreAction) => void) | undefined} onAction
 *   Assigned by the consumer to receive user interaction actions (like, follow).
 */
export class ReelItem extends Component {
  static styles = cssFrom(reelItemCss);
  static template = htmlFrom(reelItemHtml);

  #isActive = false;
  #pendingData = null;
  #videoProgress = null;

  #gestureDetector = new GestureDetector(
    () => this.#handleSingleTap(),
    (e) => this.#handleDoubleTap(e),
    DOUBLE_TAP_THRESHOLD_MS,
  );

  state = reactive({
    // mapped from model
    username: "",
    avatar: "",
    description: "",
    category: "",
    likesCount: 0,      // raw number for arithmetic
    likes: "0",         // formatted string for display
    isLiked: false,
    isFollowing: false,
    // local UI
    followBtnText: "+",
    progress: "0%",
    isDescExpanded: false,
    isHeartAnimating: false,
    heartLeft: "0px",
    heartTop: "0px",
    isLikeAnimating: false,
  });

  onInit() {
    this.listenTo(document, "visibilitychange", () =>
      this.#handleVisibilityChange(),
    );

    this.#videoProgress = new VideoProgress(this.refs.video, (percent) => {
      this.state.progress = `${percent}%`;
    });

    if (this.#pendingData) {
      const pending = this.#pendingData;
      this.#pendingData = null;
      this.data = pending;
    }
  }

  onDisconnect() {
    this.#gestureDetector?.cleanup();
    this.#videoProgress?.cleanup();
    this.#pause();
  }

  /**
   * Assigns a video model. A new `id` triggers a full reload (src + all UI fields);
   * the same id patches only changed reactive fields (likes, isLiked, isFollowing).
   * Passing `null` pauses playback.
   * @param {import('../services/api.js').VideoModel | null} videoModel
   */
  set data(videoModel) {
    if (!this.refs.video) {
      this.#pendingData = videoModel ?? this.#pendingData;
      return;
    }
    if (!videoModel) { this.#pause(); return; }
    this.#applyModel(videoModel);
  }

  #applyModel(videoModel) {
    const { id, src, username, avatar, description, category, likes, isLiked, isFollowing } = videoModel;
    this._id = id;

    Object.assign(this.state, { username, avatar, description, category, isLiked, isFollowing });
    this.state.likesCount = likes;
    this.state.likes = this.#formatCount(likes);
    this.state.followBtnText = isFollowing ? "✓" : "+";

    const newSrc = `${window.location.origin}/${src}`;
    if (this.refs.video.src !== newSrc) {
      this.refs.video.pause();
      this.#videoProgress?.stop();
      this.refs.video.removeAttribute("src");
      this.refs.video.load();
      this.refs.video.src = newSrc;
    }
  }

  /**
   * `true` starts playback and the progress loop (respects `readyState`);
   * `false` pauses and stops the progress loop.
   * @param {boolean} isActive
   */
  set active(isActive) {
    if (this.#isActive === isActive) return;
    this.#isActive = isActive;
    isActive ? this.#play() : this.#pause();
  }

  #play() {
    if (!this.refs.video || this.refs.video.readyState < 2) return;
    const playPromise = this.refs.video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.refs.video.muted = true;
        this.refs.video.play().catch(() => {});
      });
    }
    this.#videoProgress?.start();
  }

  #pause() {
    this.refs.video?.pause();
    this.#videoProgress?.stop();
  }

  #handleVisibilityChange() {
    if (document.hidden) this.#videoProgress?.stop();
    else if (this.#isActive) this.#videoProgress?.start();
  }

  // Called by data-event="animationend:onHeartAnimationEnd" on .floating-heart
  onHeartAnimationEnd() {
    this.state.isHeartAnimating = false;
  }

  // Called by data-event="canplay:onVideoCanPlay" on video
  onVideoCanPlay() {
    if (this.#isActive) this.#play();
  }

  // Called by data-event="pointerdown:onVideoPointerDown" on video
  onVideoPointerDown(e) {
    this.#gestureDetector?.handlePointerDown(e);
  }

  // Called by data-event="pointerup:onVideoPointerUp" on video
  onVideoPointerUp(e) {
    this.#gestureDetector?.handlePointerUp(e);
  }

  #updateLikeState() {
    const isNowLiked = !this.state.isLiked;
    this.state.isLiked = isNowLiked;
    this.state.likesCount += isNowLiked ? 1 : -1;
    this.state.likes = this.#formatCount(this.state.likesCount);
    if (isNowLiked) this.#triggerLikeAnimation();
  }

  toggleLike() {
    this.#updateLikeState();
    this.onAction?.({ type: "TOGGLE_LIKE", id: this._id });
  }

  toggleFollow(e) {
    e.stopPropagation();
    this.state.isFollowing = !this.state.isFollowing;
    this.state.followBtnText = this.state.isFollowing ? "✓" : "+";
    this.onAction?.({ type: "TOGGLE_FOLLOW", id: this._id });
  }

  seekVideo(e, target) {
    const rect = target.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (this.refs.video?.duration)
      this.refs.video.currentTime = pos * this.refs.video.duration;
  }

  toggleDescription() {
    this.state.isDescExpanded = !this.state.isDescExpanded;
  }

  #handleDoubleTap(e) {
    this.#updateLikeState();
    this.#showDoubleTapHeart(e.clientX, e.clientY);
    this.onAction?.({ type: "TOGGLE_LIKE", id: this._id });
    e.preventDefault();
  }

  #handleSingleTap() {
    this.refs.video.paused ? this.#play() : this.#pause();
  }

  #triggerLikeAnimation() {
    this.state.isLikeAnimating = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.state.isLikeAnimating = true;
      }),
    );
  }

  /**
   * @private
   * @param {number} x - viewport x coordinate of the tap
   * @param {number} y - viewport y coordinate of the tap
   */
  #showDoubleTapHeart(x, y) {
    if (this.state.isHeartAnimating) return;
    const rect = this.getBoundingClientRect();
    this.state.heartLeft = `${x - rect.left - 40}px`;
    this.state.heartTop = `${y - rect.top - 40}px`;
    this.state.isHeartAnimating = true;
  }

  /**
   * @private
   * @param {number} num
   * @returns {string}
   */
  #formatCount(num) {
    return num >= 1000 ? (num / 1000).toFixed(1) + "K" : num.toString();
  }
}
