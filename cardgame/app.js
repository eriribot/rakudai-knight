(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { CARDS, INTENTS, createBattle, playCard, endTurn, snapshot } = BattleEngine;
  let state = createBattle(), busy = false, demo = false, generation = 0, sound = true, audioContext;
  let assetStatus = 'loading', assetFailures = [];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const descriptions = {
    slash: '造成 <b>7</b> 點傷害。',
    guard: '獲得 <b>8</b> 點格擋。',
    insight: '抽 <b>1</b> 張牌。<br>本回合下次攻擊 <b>+4</b>。',
    step: '獲得 <b>4</b> 點格擋。<br>抽 <b>1</b> 張牌。',
    riposte: '造成 <b>6</b> 點傷害。<br>已有格擋時，改為 <b>12</b>。',
    shura: '造成 <b>24</b> 點傷害。<br>自損 <b>6</b> 體力。本場移除。'
  };
  const labels = { slash:'INTETSU', guard:'DEFENSE', insight:'INSIGHT', step:'FOOTWORK', riposte:'COUNTER', shura:'ITTO SHURA' };
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

  function render(vitals = state) {
    for (const side of ['player','enemy']) {
      $(side+'-hp').textContent = vitals[side].hp;
      $(side+'-block').textContent = vitals[side].block;
      $(side+'-hp-fill').style.width = (vitals[side].hp / vitals[side].maxHp * 100)+'%';
      $(side+'-meter').setAttribute('aria-valuenow', vitals[side].hp);
    }
    $('energy').textContent = state.energy;
    $('max-energy').textContent = state.maxEnergy;
    $('energy-pips').innerHTML = Array.from({length:state.maxEnergy}, (_,i)=>'<i class="'+(i>=state.energy?'empty':'')+'"></i>').join('');
    $('draw-count').textContent = state.draw.length;
    $('discard-count').textContent = state.discard.length;
    $('turn-label').textContent = 'ROUND '+String(state.turn).padStart(2,'0');
    $('phase-label').textContent = assetStatus === 'loading' ? '動作素材載入中' : assetStatus === 'failed' ? '動作素材載入失敗' : state.status !== 'playing' ? '模擬戰結束' : busy ? '招式發動中' : '你的回合';
    $('hand-count').textContent = state.hand.length+' 張手牌';
    $('hand-title').textContent = assetStatus === 'loading' ? '正在準備戰鬥動作' : assetStatus === 'failed' ? '動作素材尚未就緒' : state.energy ? '選擇你的招式' : '行動點已用盡';
    $('player-trait').textContent = state.nextAttackBonus ? '看破 · 下一張攻擊傷害 +'+state.nextAttackBonus : '劍術的極致，不由天賦決定。';
    const intent = INTENTS[state.intentIndex];
    $('intent-name').textContent = intent.name;
    $('intent-description').textContent = intent.description;
    $('intent-amount').textContent = intent.amount;
    $('intent-icon').textContent = intent.type === 'block' ? '◇' : '⌁';
    $('intent').classList.toggle('is-block', intent.type === 'block');
    $('end-hint').textContent = intent.type === 'block' ? '對手將獲得 '+intent.amount+' 格擋' : '對手將造成 '+intent.amount+' 點傷害';
    $('end-turn').disabled = assetStatus !== 'ready' || busy || demo || state.status !== 'playing';
    $('autoplay').disabled = assetStatus !== 'ready' || busy || demo;
    $('autoplay').textContent = demo ? '▷ 連招演示中' : '▷ 演示連招';
    $('game').classList.toggle('turn-running', busy);
    $('game').setAttribute('aria-busy', String(assetStatus === 'loading' || busy));
    $('hand').innerHTML = state.hand.map((card,index) => {
      const data = CARDS[card.id];
      const disabled = assetStatus !== 'ready' || data.cost > state.energy || busy || demo || state.status !== 'playing';
      return '<button class="card" data-id="'+card.id+'" data-uid="'+card.uid+'" '+(disabled?'disabled':'')+' aria-label="'+data.name+'，'+data.cost+' 行動點。'+data.description+'" title="'+data.description+'">'+
        '<span class="cost">'+data.cost+'</span><span class="card-art" aria-hidden="true"></span><h3>'+data.name+'</h3><span class="card-type">'+data.keyword+'</span><span class="card-description">'+descriptions[card.id]+'</span><span class="card-bottom"><span>'+labels[card.id]+'</span><span class="card-key">'+(index<6?index+1:'')+'</span></span></button>';
    }).join('');
  }

  function message(text) {
    $('battle-message').textContent = text;
    $('battle-message').classList.remove('changed');
    void $('battle-message').offsetWidth;
    $('battle-message').classList.add('changed');
  }

  function openingMessage() {
    if (assetStatus === 'loading') return '正在載入一輝與史黛菈的步伐和揮劍動作……';
    if (assetStatus === 'failed') {
      const names = [...new Set(assetFailures.map(path => path.includes('ikki') ? '一輝' : path.includes('stella') ? '史黛菈' : '人物'))];
      return (names.join('、') || '人物') + '的動作素材未能載入，請重新整理頁面後再試。';
    }
    return '先看她的下一招，再決定你的第一劍。';
  }

  function recoverAction(previous, current, error, previousMusicMode) {
    if (current !== generation) return;
    // Invalidate delayed callbacks and demo steps before restoring the snapshot.
    generation++;
    state = previous;
    busy = false;
    demo = false;
    CombatActors.reset();
    BattleMedia.restoreMode(previousMusicMode);
    $('float-layer').replaceChildren();
    $('cutin').classList.remove('active');
    if (error?.name === 'CombatAssetError') assetStatus = 'failed';
    render();
    message(assetStatus === 'failed' ? openingMessage() : '動作播放失敗，已還原這一步。請重新選牌或結束回合。');
  }

  function playSound(kind) {
    if (!sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = kind === 'guard' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(kind === 'guard' ? 620 : kind === 'shura' ? 170 : 370, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'guard' ? 250 : 50, now+.22);
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.exponentialRampToValueAtTime(.09,now+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,now+.27);
      oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(now);oscillator.stop(now+.28);
    } catch { /* A missing oscillator must not stop the BGM. */ }
  }

  function floatEvents(events) {
    for (const event of events) {
      if (!['damage','block','selfDamage'].includes(event.type)) continue;
      const el=document.createElement('span');
      const isBlock = event.type === 'block' || (event.type === 'damage' && !event.amount);
      el.className='float-number '+event.target+(isBlock?' block':'');
      el.textContent=isBlock ? (event.type==='block'?'＋'+event.amount:'格擋') : '−'+event.amount;
      $('float-layer').append(el);setTimeout(()=>el.remove(),1200);
    }
  }

  function showResult() {
    if (state.status === 'playing') return;
    BattleMedia.finish();
    const won=state.status==='won';
    $('result-eyebrow').textContent=won?'BEYOND TALENT':'ONE MORE CHALLENGE';
    $('result-title').textContent=won?'此劍，超越天賦。':'下一劍，會更強。';
    $('result-copy').textContent=won?'「原來如此……這就是你的劍啊，一輝。」':'讀懂火焰的間隙，再向紅蓮皇女挑戰。';
    $('result-stats').textContent=state.turn+' 回合 · 剩餘體力 '+state.player.hp+' / 48';
    $('result').hidden=false;
    document.querySelectorAll('.topbar,.arena,.command-zone,.bottom-bar').forEach(el=>{el.inert=true;});
    $('play-again').focus();
  }

  async function useCard(uid, automated=false) {
    if (assetStatus !== 'ready' || busy || (demo&&!automated) || state.status!=='playing') return;
    const card=state.hand.find(item=>item.uid===uid);if(!card)return;
    const data=CARDS[card.id], current=generation, previous=snapshot(state), previousMusicMode=BattleMedia.state.mode;
    const result=playCard(state,uid);
    if(!result.ok){message(result.reason);return;}
    busy=true;render(previous);message('「'+data.name+'」');
    try {
      const isAttack=data.type==='attack';
      if(card.id==='shura') {
        message('一刀修羅，發動。');
        const completed = await BattleMedia.shuraIntro();
        if(!completed || current!==generation)return;
        $('cutin').classList.remove('active');void $('cutin').offsetWidth;$('cutin').classList.add('active');
      }
      const onImpact=()=>{if(current!==generation)return;playSound(card.id);floatEvents(result.events);render();};
      if(isAttack) await CombatActors.attack('player',{finisher:card.id==='shura',blocked:result.events.some(e=>e.type==='damage'&&e.blocked>0),onImpact});
      else if(card.id==='insight') await CombatActors.insight({onImpact});
      else await CombatActors.guard('player',{onImpact});
      if(current!==generation)return;
      const meaningful=result.events.filter(event=>['damage','block','bonus','selfDamage'].includes(event.type));
      message(meaningful.map(event=>event.text).join(' '));
    } catch (error) { recoverAction(previous,current,error,previousMusicMode); }
    finally { if(current===generation){busy=false;render();showResult();} }
  }

  async function finishTurn(automated=false) {
    if(assetStatus !== 'ready'||busy||(demo&&!automated)||state.status!=='playing')return;
    busy=true;const current=generation,intent=INTENTS[state.intentIndex],previous=snapshot(state),previousMusicMode=BattleMedia.state.mode;
    render();$('phase-label').textContent='對手回合';message('史黛菈 · '+intent.name);
    const result=endTurn(state);
    try {
      const onImpact=()=>{if(current!==generation)return;playSound(intent.type==='block'?'guard':'slash');floatEvents(result.events);render();$('phase-label').textContent='對手回合';};
      if(intent.type==='attack') await CombatActors.attack('enemy',{finisher:intent.amount>=16,blocked:result.events.some(e=>e.type==='damage'&&e.blocked>0),onImpact});
      else await CombatActors.guard('enemy',{onImpact});
      if(current!==generation)return;
      message(state.status==='playing'?'第 '+state.turn+' 回合。行動點恢復，新的五張手牌已就緒。':'勝負已分。');
    } catch (error) { recoverAction(previous,current,error,previousMusicMode); }
    finally { if(current===generation){busy=false;render();showResult();} }
  }

  function restart() {
    generation++;busy=false;demo=false;state=createBattle();CombatActors.reset();BattleMedia.reset();
    $('float-layer').replaceChildren();$('cutin').classList.remove('active');$('result').hidden=true;
    document.querySelectorAll('.topbar,.arena,.command-zone,.bottom-bar').forEach(el=>{el.inert=false;});
    message(openingMessage());render();
  }

  async function demonstrate() {
    if(assetStatus !== 'ready'||busy||demo)return;
    restart();demo=true;render();const current=generation;
    message('演示：看破 → 受身 → 返擊 → 斬擊。');
    for(const id of ['insight','guard','riposte','slash']) {
      await wait(600);if(current!==generation)return;
      const card=state.hand.find(item=>item.id===id);
      if(card)await useCard(card.uid,true);
      if(current!==generation)return;
    }
    await wait(800);if(current!==generation)return;
    await finishTurn(true);if(current!==generation)return;
    demo=false;render();message('連招完成：一輝 48 / 48，史黛菈 49 / 72。現在輪到你。');
  }

  function openModal(content) {$('modal-content').innerHTML=content;$('modal').showModal();}
  function showPile(which) {
    const cards=state[which],title=which==='draw'?'抽牌堆':'棄牌堆';
    const list=cards.map(card=>'<div class="pile-row"><b>'+escape(CARDS[card.id].name)+'</b><span>'+CARDS[card.id].cost+' AP · '+escape(CARDS[card.id].description)+'</span></div>').join('');
    openModal('<span class="mini-tag">'+(which==='draw'?'DRAW PILE':'DISCARD PILE')+'</span><h2>'+title+' · '+cards.length+'</h2>'+(list||'<p class="empty-pile">這裡目前沒有卡牌。</p>')+'<p class="subtle">抽牌堆用盡時，棄牌會重新洗入。已移除：'+(state.exhaust.length?state.exhaust.map(c=>CARDS[c.id].name).join('、'):'無')+'。</p>');
  }
  function updateSound() {$('sound').textContent=sound?'♫':'♪';$('sound').setAttribute('aria-label',sound?'關閉音樂與音效':'開啟音樂與音效');$('sound').title=sound?'關閉音樂與音效':'開啟音樂與音效';$('sound').setAttribute('aria-pressed',String(sound));}

  $('hand').addEventListener('click',event=>{const card=event.target.closest('[data-uid]');if(card)useCard(card.dataset.uid);});
  $('end-turn').addEventListener('click',()=>finishTurn());
  $('restart').addEventListener('click',restart);$('play-again').addEventListener('click',restart);
  $('autoplay').addEventListener('click',demonstrate);
  $('draw-pile').addEventListener('click',()=>showPile('draw'));$('discard-pile').addEventListener('click',()=>showPile('discard'));
  $('modal-close').addEventListener('click',()=>$('modal').close());
  $('modal').addEventListener('click',event=>{if(event.target===$('modal')){const b=$('modal').getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)$('modal').close();}});
  $('help').addEventListener('click',()=>openModal('<span class="mini-tag">HOW TO PLAY</span><h2>用牌序，改寫勝負。</h2><ol><li>先讀右上角的<strong>對手意圖</strong>：她這回合會攻擊，還是蓄勢？</li><li>每回合有 <strong>3 行動點</strong>、抽 <strong>5 張牌</strong>。點擊卡牌發動招式，角色會前衝揮劍、格擋或看破。</li><li><strong>格擋先承受傷害</strong>，到持有者下回合開始消退。先受身，再返擊，可以提高傷害。</li><li>結束回合後，手牌進入棄牌堆，史黛菈執行預告行動。抽牌堆空時重新洗牌。</li><li><strong>一刀修羅</strong>威力強大，但會自損 6 體力且本場移除。雙方同時歸零也算挑戰失敗。</li></ol><p>鍵盤：<strong>1–6</strong> 出牌 · <strong>空白鍵</strong>結束回合 · <strong>R</strong> 重新開局。也可點「演示連招」觀看一個完整回合。</p><p class="subtle">這是依動畫設定圖製作的同人概念试玩，採用独立演示數值。AP 是行動預算；不代表魔力上限。一刀修羅不等於魔人覺醒。正式 TRPG v0.3 的未定條款、MVU 與世界書均未在此定案或接線。</p>'));
  $('sound').addEventListener('click',()=>{sound=!sound;BattleMedia.setEnabled(sound);updateSound();if(sound){BattleMedia.unlock();playSound('guard');}});
  document.addEventListener('pointerdown',event=>{if(event.isTrusted && event.button===0 && !event.target.closest('#sound'))BattleMedia.unlock();});
  document.addEventListener('keydown',event=>{if(event.isTrusted && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('#sound'))BattleMedia.unlock();});
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}catch{message('此瀏覽器不支援全螢幕，仍可正常出牌。');}});
  document.addEventListener('keydown',event=>{
    if($('modal').open||event.ctrlKey||event.altKey||event.metaKey||event.repeat)return;
    if(event.key.toLowerCase()==='r'){event.preventDefault();restart();return;}
    if(BattleMedia.state.introActive){if(event.key==='Escape'){event.preventDefault();BattleMedia.skipIntro();}return;}
    if(event.target.closest('button,a,input,textarea,select')&&(event.code==='Space'||event.key==='Enter'))return;
    if(event.code==='Space'){event.preventDefault();finishTurn();}
    else if(/^[1-6]$/.test(event.key)){event.preventDefault();const card=state.hand[Number(event.key)-1];if(card)useCard(card.uid);}
  });
  // Read-only diagnostics for local acceptance checks; the live state remains private.
  Object.defineProperty(window,'Cardgame',{value:Object.freeze({get state(){return snapshot(state);},get busy(){return busy;},get demonstrating(){return demo;},get assetsReady(){return assetStatus==='ready';},get assetStatus(){return assetStatus;},get assetFailures(){return assetFailures.slice();}})});
  render();updateSound();message(openingMessage());
  Promise.resolve(CombatActors.ready).then(report => {
    assetStatus = report?.ok ? 'ready' : 'failed';
    assetFailures = (report?.failures || []).map(asset => String(asset.path));
    render();message(openingMessage());
  }).catch(() => {
    assetStatus = 'failed';
    render();message(openingMessage());
  });
})();
