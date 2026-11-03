// These media bindings are initialized before the original prelude controller.
var openingIsLocalPreview = location.protocol==='file:' || (/^(127\.0\.0\.1|localhost)$/.test(location.hostname) && decodeURIComponent(location.pathname).includes('/开局网页正则替换/'));
var openingMediaBase = openingIsLocalPreview ? new URL('assets/asterisk/', location.href).href : 'https://eriribot.github.io/rakudai-knight/第一卷-世界书整理/开局网页正则替换/assets/asterisk/';
function openingMediaUrl(file) {
  if(!openingIsLocalPreview && file===OPENING_ASTERISK_MEDIA.op)return 'https://eriribot.github.io/rakudai-knight/op.mp4';
  return new URL(file,openingMediaBase).href;
}
var originalPreludeMedia = null;
var openingTitleInitialized = false;
function initializeOpeningTitleMedia() {
  if(openingTitleInitialized)return;
  openingTitleInitialized=true;
  var root=document.getElementById('lkPrelude'),art=document.querySelector('.lk-title-art');
  var logo=document.querySelector('.lk-title-logo'),astLogo=document.querySelector('.aw-title-logo');
  var astArt=document.querySelector('.aw-title-original-art');
  if(OPENING_ASTERISK_MEDIA.titleBackdrop){
    // The generated asset contains scenery only; original character files stay separate.
    document.documentElement.style.setProperty('--opening-title-backdrop','url("'+openingMediaUrl(OPENING_ASTERISK_MEDIA.titleBackdrop)+'")');
  }
  var decorations=document.querySelectorAll('.aw-title-divider,.aw-title-cross');
  var sources=[
    {src:openingMediaUrl(OPENING_ASTERISK_MEDIA.entryCover),pair:true},
    {src:originalPreludeMedia.art,pair:false}
  ];
  var request=0, failedLogo=false, rakudaiReady=false, asteriskReady=false, asteriskFailed=false;
  function applyLayout() {
    var paired=rakudaiReady&&asteriskReady;
    root.dataset.titleLayout=paired?'original-pair':'rakudai';
    astArt.hidden=!paired;
    astLogo.hidden=!paired||failedLogo;
    decorations.forEach(function(el){el.hidden=!paired;});
    art.alt='落第骑士英雄谭 · 史黛菈、珠雫、绫辻绚濑与东堂刀华原图';
  }
  var originalLogoSrc=logo.getAttribute('src');
  logo.onerror=function(){
    if(logo.getAttribute('src')!==originalLogoSrc)logo.src=originalLogoSrc;
    else logo.hidden=true;
  };
  logo.src=openingMediaUrl(OPENING_ASTERISK_MEDIA.logos.rakudai);
  astLogo.onerror=function(){failedLogo=true;astLogo.hidden=true;};
  astLogo.src=openingMediaUrl(OPENING_ASTERISK_MEDIA.logos.asterisk);
  // Render the two source files directly. Character pixels are never regenerated.
  astArt.onload=function(){if(asteriskFailed)return;asteriskReady=true;applyLayout();};
  astArt.onerror=function(){
    asteriskFailed=true;asteriskReady=false;astArt.onload=null;astArt.onerror=null;applyLayout();
  };
  astArt.src=openingMediaUrl(OPENING_ASTERISK_MEDIA.asteriskEntryCover);
  if(astArt.complete&&astArt.naturalWidth>0)astArt.onload();
  function loadCover(index) {
    var item=sources[index],revision=++request;
    rakudaiReady=false;applyLayout();
    art.onload=function(){
      if(revision!==request||art.getAttribute('src')!==item.src)return;
      rakudaiReady=item.pair;applyLayout();
    };
    art.onerror=function(){
      if(revision!==request||art.getAttribute('src')!==item.src)return;
      if(index+1<sources.length)loadCover(index+1);
      else {request++;art.onload=null;art.onerror=null;rakudaiReady=false;applyLayout();}
    };
    document.documentElement.style.setProperty('--opening-title-art','url("'+item.src+'")');
    art.src=item.src;
    if(art.complete&&art.naturalWidth>0)art.onload();
  }
  loadCover(0);
}
function configureOpeningPreludeMedia(world) {
  var video=document.getElementById('lkOpeningVideo'),backdrop=document.getElementById('lkOpeningVideoBackdrop');
  var art=document.querySelector('.lk-title-art'),logo=document.querySelector('.lk-title-logo');
  if(!originalPreludeMedia)originalPreludeMedia={video:video.querySelector('source').getAttribute('data-src'),art:art.getAttribute('src')};
  // Both worlds share the user's edited OP from the original Rakudai page.
  // Local preview uses the user's root op.mp4; hosted/ST entry retains the original URL.
  var src=openingIsLocalPreview && !window.__openingOpRemoteFallback?openingMediaUrl(OPENING_ASTERISK_MEDIA.op):originalPreludeMedia.video;
  [video,backdrop].forEach(function(el){if(el.getAttribute('src')!==src){el.pause();el.src=src;el.preload='metadata';el.load();}});
  // This is one shared title screen; switching worlds must not reload its artwork.
  initializeOpeningTitleMedia();
  document.body.dataset.world=world;
}
window.OPENING_ASTERISK_MEDIA=OPENING_ASTERISK_MEDIA;
window.openingMediaUrl=openingMediaUrl;
window.configureOpeningPreludeMedia=configureOpeningPreludeMedia;
configureOpeningPreludeMedia(new URLSearchParams(location.search).get('world')==='asterisk'?'asterisk':'rakudai');
