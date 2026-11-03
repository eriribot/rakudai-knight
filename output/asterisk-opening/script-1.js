
      (function () {
        var root = document.getElementById("lkPrelude");
        var openingScreen = document.getElementById("lkOpeningScreen");
        var titleScreen = document.getElementById("lkTitleScreen");
        var video = document.getElementById("lkOpeningVideo");
        var videoBackdrop = document.getElementById("lkOpeningVideoBackdrop");
        var soundGate = document.getElementById("lkOpSoundGate");
        var skipButton = document.getElementById("lkOpSkip");
        var continuePrompt = document.getElementById("lkContinuePrompt");
        var titleVisible = false;
        var needsGesture = false;
        var finished = false;
        var messageHost = root.closest(".mes_text, .mes_block");
        var localParent = root.parentElement || document.body;

        var previewParams = new URLSearchParams(window.location.search);
        if (previewParams.get("preview") === "1" || previewParams.get("world") === "asterisk") {
          window.__lkPreludeComplete = true;
          document.body.classList.remove("prelude-active");
          root.hidden = true; root.classList.add("is-finished");
          video.pause(); videoBackdrop.pause();
          return;
        }
        window.__lkPreludeComplete = false;

        if (messageHost) {
          root.classList.add("is-message-embedded");
          messageHost.classList.add("lk-prelude-host-active");
          document.body.classList.remove("prelude-active");
        }

        function setGuideInert(inert) {
          Array.prototype.forEach.call(localParent.children, function (child) {
            if (
              child !== root &&
              child.tagName !== "SCRIPT" &&
              child.tagName !== "STYLE"
            ) {
              child.inert = inert;
            }
          });
        }

        function showSoundGate() {
          if (titleVisible || finished) return;
          needsGesture = true;
          videoBackdrop.pause();
          soundGate.classList.add("is-visible");
        }

        function syncOpeningBackdrop(force) {
          try {
            if (
              force ||
              Math.abs(videoBackdrop.currentTime - video.currentTime) > 0.45
            ) {
              videoBackdrop.currentTime = video.currentTime;
            }
          } catch (error) {
            /* 元数据尚未就绪时，playing 事件会再次同步。 */
          }
        }

        function playOpeningBackdrop() {
          syncOpeningBackdrop(true);
          videoBackdrop.muted = true;
          var backdropPromise = videoBackdrop.play();
          if (backdropPromise && typeof backdropPromise.catch === "function") {
            backdropPromise.catch(function () {});
          }
        }

        function markOpeningPlaying() {
          if (titleVisible || finished) {
            video.pause();
            videoBackdrop.pause();
            return;
          }
          needsGesture = false;
          soundGate.classList.remove("is-visible");
          playOpeningBackdrop();
        }

        function playOpeningWithSound() {
          if (titleVisible || finished) return;
          video.defaultMuted = false;
          video.muted = false;
          video.volume = 1;
          var playPromise = video.play();
          if (playPromise && typeof playPromise.then === "function") {
            playPromise.then(markOpeningPlaying).catch(showSoundGate);
          }
        }

        function revealTitle() {
          if (titleVisible || finished) return;
          titleVisible = true;
          // 跳过后取消延迟启播，避免加载完成时重播隐藏的 OP。
          window.removeEventListener("load", playOpeningWithSound);
          video.pause();
          videoBackdrop.pause();
          openingScreen.classList.remove("is-active");
          openingScreen.setAttribute("aria-hidden", "true");
          titleScreen.classList.add("is-active");
          titleScreen.setAttribute("aria-hidden", "false");
          document.dispatchEvent(new CustomEvent("lk:title-visible"));
          continuePrompt.focus({ preventScroll: true });
        }

        function finishPrelude() {
          if (!titleVisible || finished) return;
          finished = true;
          window.__lkPreludeComplete = true;
          document.body.classList.remove("prelude-active");
          setGuideInert(false);
          root.classList.add("is-finished");
          document.dispatchEvent(new CustomEvent("lk:prelude-complete"));

          document.removeEventListener("keydown", handlePreludeKey, true);
          window.setTimeout(function () {
            root.hidden = true;
            if (messageHost) {
              messageHost.classList.remove("lk-prelude-host-active");
            }
          }, 450);
        }

        function handleOpeningClick(event) {
          if (event.target === soundGate || event.target === skipButton) return;
          if (needsGesture || video.paused) {
            playOpeningWithSound();
          } else {
            revealTitle();
          }
        }

        function handlePreludeKey(event) {
          if (finished || event.repeat) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          if (!titleVisible) {
            if (needsGesture || video.paused) {
              playOpeningWithSound();
            } else {
              revealTitle();
            }
            return;
          }
          finishPrelude();
        }

        soundGate.addEventListener("click", function (event) {
          event.stopPropagation();
          playOpeningWithSound();
        });
        skipButton.addEventListener("click", function (event) {
          event.stopPropagation();
          revealTitle();
        });
        openingScreen.addEventListener("click", handleOpeningClick);
        titleScreen.addEventListener("click", finishPrelude);
        video.addEventListener("playing", markOpeningPlaying);
        video.addEventListener("timeupdate", function () {
          syncOpeningBackdrop(false);
        });
        video.addEventListener("seeking", function () {
          syncOpeningBackdrop(true);
        });
        video.addEventListener("ended", revealTitle, { once: true });
        video.addEventListener("error", revealTitle, { once: true });
        videoBackdrop.addEventListener(
          "error",
          function () {
            videoBackdrop.hidden = true;
          },
          { once: true },
        );
        document.addEventListener("keydown", handlePreludeKey, true);
        function activatePreludeScope() {
          setGuideInert(true);
        }

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", activatePreludeScope, {
            once: true,
          });
        } else {
          activatePreludeScope();
        }

        if (document.readyState === "complete") {
          playOpeningWithSound();
        } else {
          window.addEventListener("load", playOpeningWithSound, { once: true });
        }
      })();
    