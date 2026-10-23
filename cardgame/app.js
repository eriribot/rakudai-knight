(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { CARDS, createBattle, playCard, cardAvailability, currentIntent, endTurn, snapshot } = BattleEngine;
  let state = createBattle(), busy = false, demo = false, generation = 0, sound = true, audioContext;
  let assetStatus = 'loading', assetFailures = [];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function cardDescription(data) {
    if (data.id === 'guard') return '格擋 <b>'+data.block+'</b><br>本回合下次受擊<br>格擋後傷害最多 <b>4</b>';
    if (data.id === 'insight') return '解析 <b>+'+data.insight+'%</b> · 抽 <b>'+data.draw+'</b> 張牌<br>本回合下次攻擊 <b>+'+data.bonus+'</b>';
    if (data.id === 'step') return '格擋 <b>'+data.block+'</b><br>抽 <b>'+data.draw+'</b> 張牌';
    if (data.id === 'riposte') return '傷害 <b>'+data.damage+'</b><br>有格擋時：<b>'+data.guardedDamage+'</b><br>交鋒解析 <b>+10%</b>';
    if (data.id === 'shura') return '傷害 <b>'+data.damage+'</b><br>失去 <b>'+data.selfDamage+'</b> 體力 · 本場移除';
    return '傷害 <b>'+data.damage+'</b><br>交鋒解析 <b>+10%</b>';
  }
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

  function render(vitals = state) {
    for (const side of ['player','enemy']) {
      $(side+'-hp').textContent = vitals[side].hp;
      $(side+'-max-hp').textContent = vitals[side].maxHp;
      $(side+'-block').textContent = vitals[side].block;
      $(side+'-hp-fill').style.width = (vitals[side].hp / vitals[side].maxHp * 100)+'%';
      $(side+'-meter').setAttribute('aria-valuenow', vitals[side].hp);
      $(side+'-meter').setAttribute('aria-valuemax', vitals[side].maxHp);
      $(side+'-mp').textContent = vitals[side].mp;
      $(side+'-max-mp').textContent = vitals[side].maxMp;
      $(side+'-mp-fill').style.width = (vitals[side].mp / vitals[side].maxMp * 100)+'%';
      $(side+'-mp-meter').setAttribute('aria-valuenow', vitals[side].mp);
      $(side+'-mp-meter').setAttribute('aria-valuemax', vitals[side].maxMp);
    }
    $('enemy-barrier').textContent = vitals.enemy.barrier;
    $('player-insight').textContent = vitals.insight;
    $('player-insight-fill').style.width = vitals.insight+'%';
    $('player-insight-meter').setAttribute('aria-valuenow', vitals.insight);
    $('player-insight-meter').classList.toggle('is-ready', vitals.insight === 100);
    $('player-insight-meter').setAttribute('aria-valuetext', vitals.insight === 100 ? '解析完成，下次攻擊穿透魔力護盾' : vitals.insight+'%');
    $('energy').textContent = state.energy;
    $('max-energy').textContent = state.maxEnergy;
    $('energy-pips').innerHTML = Array.from({length:state.maxEnergy}, (_,i)=>'<i class="'+(i>=state.energy?'empty':'')+'"></i>').join('');
    $('draw-count').textContent = state.draw.length;
    $('discard-count').textContent = state.discard.length;
    $('turn-label').textContent = '第 '+state.turn+' 回合';
    $('phase-label').textContent = assetStatus === 'loading' ? '人物載入中' : assetStatus === 'failed' ? '人物載入失敗' : state.status !== 'playing' ? '模擬戰結束' : busy ? '招式發動中' : '我方行動';
    $('hand-count').textContent = state.hand.length+' 張手牌';
    $('hand-title').textContent = assetStatus === 'loading' ? '載入中' : assetStatus === 'failed' ? '人物素材未就緒' : state.energy ? '選擇手牌' : '行動點已用盡';
    $('player-trait').textContent = [vitals.player.glancing ? '受身：下次受擊最多 4' : '', vitals.nextAttackBonus ? '下次攻擊 +'+vitals.nextAttackBonus : '', vitals.insight === 100 ? '下次攻擊穿盾' : ''].filter(Boolean).join(' · ');
    const intent = currentIntent(state);
    $('intent-name').textContent = intent.name;
    $('intent-description').textContent = intent.description;
    $('intent-amount').textContent = intent.amount;
    $('intent-icon').textContent = intent.type === 'barrier' ? '◇' : '⚔';
    $('intent').classList.toggle('is-block', intent.type === 'barrier');
    $('end-hint').textContent = intent.type === 'barrier' ? '對手將獲得 '+intent.amount+' 護盾' : '對手將造成 '+intent.amount+' 傷害';
    $('end-turn').disabled = assetStatus !== 'ready' || busy || demo || state.status !== 'playing';
    $('autoplay').disabled = assetStatus !== 'ready' || busy || demo;
    $('autoplay').textContent = demo ? '▷ 連招演示中' : '▷ 演示連招';
    $('game').classList.toggle('turn-running', busy);
    $('game').setAttribute('aria-busy', String(assetStatus === 'loading' || busy));
    $('hand').innerHTML = state.hand.map((card,index) => {
      const data = CARDS[card.id];
      const available = cardAvailability(state, card.uid);
      const disabled = assetStatus !== 'ready' || !available.ok || busy || demo;
      return '<button class="card" data-id="'+card.id+'" data-uid="'+card.uid+'" '+(disabled?'disabled':'')+' aria-label="'+data.name+'，'+data.cost+' 行動點。'+data.description+(available.ok?'':' '+available.reason)+'" title="'+data.description+(available.ok?'':' '+available.reason)+'">'+
        '<span class="cost">'+data.cost+'</span><span class="card-art" aria-hidden="true"></span><h3>'+data.name+'</h3><span class="card-type">'+data.keyword+'</span><span class="card-description">'+cardDescription(data)+'</span><span class="card-bottom"><span>'+(data.mpCost?data.mpCost+' MP':data.keyword)+'</span><span class="card-key">'+(index<6?index+1:'')+'</span></span></button>';
    }).join('');
  }

  function message(text) {
    $('battle-message').textContent = text;
    $('battle-message').classList.remove('changed');
    void $('battle-message').offsetWidth;
    $('battle-message').classList.add('changed');
  }

  function openingMessage() {
    if (assetStatus === 'loading') return '正在載入人物……';
    if (assetStatus === 'failed') {
      const names = [...new Set(assetFailures.map(path => path.includes('ikki') ? '一輝' : path.includes('stella') ? '史黛菈' : '人物'))];
      return (names.join('、') || '人物') + '的動作素材未能載入，請重新整理頁面後再試。';
    }
    return '查看對手意圖，再選擇手牌。';
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
      if (!['damage','block','barrier','selfDamage'].includes(event.type)) continue;
      const el=document.createElement('span');
      const isBlock = event.type === 'block' || event.type === 'barrier' || (event.type === 'damage' && !event.amount);
      el.className='float-number '+event.target+(isBlock?' block':'');
      el.textContent=isBlock ? (event.type==='block'||event.type==='barrier'?'＋'+event.amount:event.barrierBlocked?'護盾':'格擋') : '−'+event.amount;
      $('float-layer').append(el);setTimeout(()=>el.remove(),1200);
    }
  }

  function showResult() {
    if (state.status === 'playing') return;
    BattleMedia.finish();
    const won=state.status==='won';
    $('result-eyebrow').textContent='模擬戰結果';
    $('result-title').textContent=won?'勝利':'敗北';
    $('result-copy').textContent=won?'史黛菈的體力歸零。':'一輝的體力歸零。';
    $('result-stats').textContent=state.turn+' 回合 · 體力 '+state.player.hp+' / '+state.player.maxHp+' · MP '+state.player.mp+' / '+state.player.maxMp;
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
      if(isAttack) await CombatActors.attack('player',{finisher:card.id==='shura',blocked:result.events.some(e=>e.type==='damage'&&(e.blocked>0||e.barrierBlocked>0)),onImpact});
      else if(card.id==='insight') await CombatActors.insight({onImpact});
      else await CombatActors.guard('player',{onImpact});
      if(current!==generation)return;
      const meaningful=result.events.filter(event=>['damage','block','pierce','selfDamage'].includes(event.type));
      message(meaningful.map(event=>event.text).join(' '));
    } catch (error) { recoverAction(previous,current,error,previousMusicMode); }
    finally { if(current===generation){busy=false;render();showResult();} }
  }

  async function finishTurn(automated=false) {
    if(assetStatus !== 'ready'||busy||(demo&&!automated)||state.status!=='playing')return;
    busy=true;const current=generation,intent=currentIntent(state),previous=snapshot(state),previousMusicMode=BattleMedia.state.mode;
    render();$('phase-label').textContent='對手回合';message('史黛菈 · '+intent.name);
    const result=endTurn(state);
    try {
      const onImpact=()=>{if(current!==generation)return;playSound(intent.type==='barrier'?'guard':'slash');floatEvents(result.events);render();$('phase-label').textContent='對手回合';};
      if(intent.type==='attack') await CombatActors.attack('enemy',{finisher:intent.amount>=28,blocked:result.events.some(e=>e.type==='damage'&&(e.blocked>0||e.mitigated>0)),onImpact});
      else await CombatActors.guard('enemy',{onImpact});
      if(current!==generation)return;
      message(state.status==='playing'?'第 '+state.turn+' 回合 · '+intent.name+'已結算。':'模擬戰結束。');
    } catch (error) { recoverAction(previous,current,error,previousMusicMode); }
    finally { if(current===generation){busy=false;render();showResult();} }
  }

  function restart() {
    closeMenu();
    generation++;busy=false;demo=false;state=createBattle();CombatActors.reset();BattleMedia.reset();
    $('float-layer').replaceChildren();$('cutin').classList.remove('active');$('result').hidden=true;
    document.querySelectorAll('.topbar,.arena,.command-zone,.bottom-bar').forEach(el=>{el.inert=false;});
    message(openingMessage());render();
  }

  async function demonstrate() {
    closeMenu();
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
    demo=false;render();message('演示完成 · 體力 '+state.player.hp+' / '+state.player.maxHp+'，對手 '+state.enemy.hp+' / '+state.enemy.maxHp+' · 解析 '+state.insight+'%。');
  }

  function closeMenu() { $('battle-menu').open = false; }
  function openModal(content) {closeMenu();$('modal-content').innerHTML=content;$('modal').showModal();}
  function showLibrary() {
    const cards=Object.values(CARDS).map(data=>'<article class="codex-card"><img class="codex-art" src="assets/cards/'+data.id+'.jpg" alt="'+data.name+'配圖"><h3>'+data.name+'</h3><span class="codex-meta">'+data.cost+' AP'+(data.mpCost?' · '+data.mpCost+' MP':'')+'</span><p>'+escape(data.description)+'</p></article>').join('');
    const locked='<article class="codex-card is-locked" data-card-id="rasetsu" aria-label="一刀羅剎，未解鎖，不在牌組"><img class="codex-art" src="assets/cards/rasetsu-locked.jpg" alt="動畫第12話，一輝紅黑突進畫面"><h3>一刀羅剎</h3><span class="codex-status">未解鎖</span><p>不在本次牌組中。</p></article>';
    openModal('<h2>招式圖鑑</h2><p>固定牌組 · 15 張牌 · 6 種已解鎖招式</p><div class="codex-grid">'+cards+locked+'</div>');
  }
  function showPile(which) {
    const cards=state[which],title=which==='draw'?'抽牌堆':'棄牌堆';
    const list=cards.map(card=>'<div class="pile-row"><b>'+escape(CARDS[card.id].name)+'</b><span>'+CARDS[card.id].cost+' AP · '+escape(CARDS[card.id].description)+'</span></div>').join('');
    openModal('<h2>'+title+' · '+cards.length+'</h2>'+(list||'<p class="empty-pile">這裡目前沒有卡牌。</p>')+'<p class="subtle">抽牌堆用盡時，棄牌會重新洗入。已移除：'+(state.exhaust.length?state.exhaust.map(c=>CARDS[c.id].name).join('、'):'無')+'。</p>');
  }
  function updateSound() {$('sound').textContent=sound?'♫':'♪';$('sound').setAttribute('aria-label',sound?'關閉音樂與音效':'開啟音樂與音效');$('sound').title=sound?'關閉音樂與音效':'開啟音樂與音效';$('sound').setAttribute('aria-pressed',String(sound));}

  $('hand').addEventListener('click',event=>{const card=event.target.closest('[data-uid]');if(card)useCard(card.dataset.uid);});
  $('end-turn').addEventListener('click',()=>finishTurn());
  $('restart').addEventListener('click',restart);$('play-again').addEventListener('click',restart);
  $('autoplay').addEventListener('click',demonstrate);
  $('card-library').addEventListener('click',showLibrary);
  $('draw-pile').addEventListener('click',()=>showPile('draw'));$('discard-pile').addEventListener('click',()=>showPile('discard'));
  $('modal-close').addEventListener('click',()=>$('modal').close());
  $('modal').addEventListener('click',event=>{if(event.target===$('modal')){const b=$('modal').getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)$('modal').close();}});
  $('help').addEventListener('click',()=>openModal('<h2>玩法說明</h2><ol><li>讀取對手上方的<strong>行動預告</strong>，再分配每回合 <strong>3 AP</strong>。固定 15 張牌，每回合抽 5 張；用盡抽牌堆後重洗棄牌。</li><li><strong>體力</strong>歸零即敗北。<strong>MP</strong>是整場魔力，不隨回合恢復，也不等同 AP。</li><li>傷害依次扣除<strong>魔力護盾 → 格擋 → 體力</strong>。護盾保留到耗盡，格擋在持有者下回合開始時清空。</li><li><strong>受身</strong>須先出牌：本回合下一次敵方攻擊，格擋後最多損失 4 體力。它不抵消修羅的體力代價。</li><li><strong>解析</strong>跨回合保留。看破牌 +20%，普通交鋒 +10%，成功格擋或受身 +15%。滿 100% 後，下次攻擊消耗解析並穿透魔力護盾；仍會被格擋，不會自動斬殺。</li><li><strong>一刀修羅</strong>消耗 2 AP、10 MP，造成 42 傷害並失去 18 體力，本場移除。同時歸零算敗北。<strong>一刀羅剎</strong>尚未解鎖，不在牌組中。</li></ol><p>鍵盤：<strong>1–6</strong> 出牌 · <strong>空白鍵</strong>結束回合 · <strong>R</strong> 重開 · <strong>Esc</strong> 跳過修羅演出。選單中的演示連招會重開並演示一個回合。</p><p class="subtle">幻想形態訓練戰。數值為本次試玩標定，招式效果不作原作數值設定。</p>'));
  $('sound').addEventListener('click',()=>{sound=!sound;BattleMedia.setEnabled(sound);updateSound();if(sound){BattleMedia.unlock();playSound('guard');}});
  document.addEventListener('pointerdown',event=>{if(event.isTrusted && event.button===0 && !event.target.closest('#sound'))BattleMedia.unlock();});
  document.addEventListener('keydown',event=>{if(event.isTrusted && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('#sound'))BattleMedia.unlock();});
  $('fullscreen').addEventListener('click',async()=>{closeMenu();try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}catch{message('此瀏覽器不支援全螢幕，仍可正常出牌。');}});
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
