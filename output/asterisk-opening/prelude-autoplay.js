        function playOpeningWithSound() {
          if (titleVisible || finished) return;
          var attempt = ++playAttempt, revision = preludeRevision;
          function currentAttempt() {
            return attempt === playAttempt && revision === preludeRevision && !titleVisible && !finished;
          }
          function playing() { if(currentAttempt())markOpeningPlaying(); }
          video.defaultMuted = false;
          video.muted = false;
          video.volume = 1;
          var playPromise = video.play();
          if (!playPromise || typeof playPromise.then !== 'function') return;
          playPromise.then(playing).catch(function(error) {
            if(!currentAttempt() || error.name === 'AbortError')return;
            if(error.name !== 'NotAllowedError'){showSoundGate();return;}
            video.defaultMuted = true;
            video.muted = true;
            var silentPromise=video.play();
            if(silentPromise && typeof silentPromise.then === 'function')silentPromise.then(playing).catch(function(silentError){
              if(currentAttempt() && silentError.name !== 'AbortError')showSoundGate();
            });
          });
        }
