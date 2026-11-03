// Preserve the original opening layout and its existing media controls.
var openingWorldInitializing = false;
var novelMediaWorld = null;
var rakudaiNovelMedia = null;
var cinemaSwitchTimer = null;
var openingBgmRevision = 0;

function initializeNovelWorld() {
  if (rakudaiNovelMedia) return;
  document.querySelectorAll('[data-world-logo]').forEach(function(img){img.src=openingMediaUrl(OPENING_ASTERISK_MEDIA.logos[img.dataset.worldLogo]);});
  rakudaiNovelMedia = {
    frame: document.querySelector('.book-frame').innerHTML,
    dots: document.querySelector('.carousel-dots').innerHTML,
    label: document.querySelector('.carousel-container').getAttribute('aria-label'),
    covers: NOVEL_COVERS.slice(), gallery: GALLERY_CARDS.slice(),
    audio: document.querySelector('#bgm-audio source').getAttribute('src')
  };
  document.querySelectorAll('.showcase-story-copy').forEach(function(el){el.dataset.originalStory=el.innerHTML;});
  document.addEventListener('lk:prelude-start',stopCarousel);
  document.addEventListener('lk:prelude-complete',function(){if(currentScene===1)startCarousel();});
  window.addEventListener('pagehide', function(){
    stopCarousel(); clearTimeout(cinemaSwitchTimer);
    document.querySelectorAll('video,audio').forEach(function(el){el.pause();});
  });
}

function openAcademyPicker() {
  if (!isAsteriskMode()) return;
  switchScene(2);
  var picker=document.getElementById('aw-academy-picker');picker.open=true;
  picker.scrollIntoView({behavior:'smooth',block:'start'});
}
function replayOpening() {
  if(bgmAudio)bgmAudio.pause();
  if(window.OpeningPrelude)window.OpeningPrelude.replay();
}
function applyNovelWorld() {
  if(!rakudaiNovelMedia)return;
  var ast=isAsteriskMode(), school=selectedAcademy();
  document.getElementById('aw-academy-current').textContent=school.name;
  worldText('.showcase-subtitle','学战都市 Asterisk · 正典文库卷目');
  worldText('.btn-narrative-skip','选择所属学园 ↗');
  worldText('#bgm-track-title','The Asterisk War');
  worldText('.bgm-popover-song','《学战都市 · The Asterisk War》');
  worldText('.aw-replay-op','重播 OP ▷');
  if(novelMediaWorld===activeOpeningWorld)return;
  stopCarousel();closeCinemaMode();clearTimeout(cinemaSwitchTimer);
  novelMediaWorld=activeOpeningWorld;
  var frame=document.querySelector('.book-frame'),dots=document.querySelector('.carousel-dots');
  var carousel=document.querySelector('.carousel-container');
  if(ast){
    frame.replaceChildren();dots.replaceChildren();
    var spine=document.createElement('div');spine.className='book-spine-glow';frame.append(spine);
    NOVEL_COVERS=OPENING_ASTERISK_MEDIA.volumes.map(function(v){return {title:'第 '+v.number+' 卷 · '+v.title,desc:'学战都市 Asterisk · 原作小说封面'};});
    OPENING_ASTERISK_MEDIA.volumes.forEach(function(v,i){
      var slide=document.createElement('div');slide.className='carousel-slide';slide.id='slide-'+i;
      slide.setAttribute('role','group');slide.setAttribute('aria-roledescription','幻灯片');
      slide.setAttribute('aria-label','第 '+v.number+' 卷，已收录 '+NOVEL_COVERS.length+' 卷');
      slide.setAttribute('aria-hidden','true');
      var img=document.createElement('img');img.dataset.src=openingMediaUrl(v.file);img.alt='《学战都市 Asterisk》第 '+v.number+' 卷 '+v.title;img.decoding='async';
      slide.append(img);frame.append(slide);
      var dot=document.createElement('button');dot.type='button';dot.className='dot';dot.setAttribute('aria-label','查看第 '+v.number+' 卷');
      dot.onclick=function(){goToSlide(i);};dots.append(dot);
    });
    carousel.setAttribute('aria-label','《学战都市 Asterisk》小说封面轮播，已收录 '+NOVEL_COVERS.length+' 卷');
    GALLERY_CARDS=OPENING_ASTERISK_MEDIA.gallery.map(function(v,i){return {id:i,img:openingMediaUrl(v.file),alt:'《学战都市 Asterisk》第 '+v.volume+' 卷彩插'};});
    var story=document.querySelectorAll('.showcase-story-copy');
    story[0].innerHTML='<h2 class="narrative-title">序章 · 星之脉动，六花之上</h2><p class="narrative-quote highlight">六座学园，一座水上都市。你的愿望，将在群星交汇的舞台上启程。</p><p class="narrative-quote">在星脉世代活跃的时代，水上学园都市<strong>六花</strong>汇聚着怀抱各自愿望的学生。这里有日常、伙伴与竞争，也有以星武祭为目标的修行。选择所属学园，写下属于自己的入学档案。</p>';
    story[1].innerHTML='<div class="narrative-box"><div class="narrative-box-title">◆ 星脉世代 · 新生档案</div><p class="narrative-box-p">登记你的星辰力、个人能力与所用武装。每所学园各有 72 个在名序列名额，第 1–12 名列于名单第一页，称为始页十二人；第 13–72 名同样在榜。序列是校内排名，不是通用战力等级。未上榜的学生，同样拥有自己的可能性。</p></div><p class="narrative-quote">武装与技艺、信念与愿望，都将成为你的故事。新生，请写下自己的名字，从六花的一次平凡相遇开始。</p>';
  }else{
    frame.innerHTML=rakudaiNovelMedia.frame;dots.innerHTML=rakudaiNovelMedia.dots;
    NOVEL_COVERS=rakudaiNovelMedia.covers.slice();GALLERY_CARDS=rakudaiNovelMedia.gallery.slice();
    carousel.setAttribute('aria-label',rakudaiNovelMedia.label);
    document.querySelectorAll('.showcase-story-copy').forEach(function(el){el.innerHTML=el.dataset.originalStory;});
  }
  if(bgmAudio){
    var resumeMusic=!bgmAudio.paused, bgmRevision=++openingBgmRevision;
    var musicSource=ast?openingMediaUrl(OPENING_ASTERISK_MEDIA.op):rakudaiNovelMedia.audio;
    bgmAudio.pause();bgmAudio.src=musicSource;bgmAudio.preload='metadata';bgmAudio.load();updateBgmUI(false);
    if(resumeMusic && !window.__openingOpActive){
      var musicPlay=bgmAudio.play();
      if(musicPlay && typeof musicPlay.catch==='function')musicPlay.catch(function(error){
        if(error.name!=='AbortError' && bgmRevision===openingBgmRevision && bgmAudio.src===musicSource && !window.__openingOpActive){updateBgmUI(false);showAutoplayBadge();}
      });
    }
  }
  document.getElementById('cinemaImg').alt=ast?'学战都市小说插画':'落第骑士英雄谭插画';
  document.querySelector('.bgm-disc-label').title=ast?'学战都市 · 星脉档案':'落第骑士英雄谭 · 破军学园徽章';
  configureOpeningPreludeMedia(activeOpeningWorld);
  initCardScene();showSlide(0);
  if(currentScene===1)startCarousel();
}
