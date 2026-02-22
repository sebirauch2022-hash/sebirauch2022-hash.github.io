(() => {
  // DOM Elements
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const backBtn = document.getElementById('backBtn');
  const menuPanel = document.getElementById('menuPanel');
  const gamePanel = document.getElementById('gamePanel');
  const gameOverPanel = document.getElementById('gameOverPanel');
  const overlay = document.getElementById('overlay');
  const finalScoreEl = document.getElementById('finalScore');
  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('highscore');
  const livesEl = document.getElementById('lives');
  const shieldEl = document.getElementById('shield');
  const modeTitle = document.getElementById('modeTitle');
  const modeDesc = document.getElementById('modeDesc');
  const menuBtns = document.querySelectorAll('.game-select');
  const menuBtn = document.getElementById('menuBtn');
  const muteBtn = document.getElementById('muteBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const kofiBtn = document.getElementById('kofiBtn');

  // Audio setup
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let soundEnabled = localStorage.getItem('galaxy_sound') !== 'off';
  updateMuteButton();

  // Smooth animations
  function animateValue(element, start, end, duration) {
    const startTime = performance.now();
    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * easeOut);
      element.textContent = current;
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  function scaleElement(element) {
    element.style.animation = 'none';
    setTimeout(() => {
      element.style.animation = 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
    }, 10);
  }

  function updateMuteButton() {
    muteBtn.textContent = soundEnabled ? '🔊' : '🔇';
    muteBtn.title = soundEnabled ? 'Sound ausschalten' : 'Sound einschalten';
    muteBtn.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  }

  // Small helpers to reduce repeated DOM logic
  function pulse(el, duration = 350) {
    if(!el) return;
    el.style.animation = 'pulse 0.3s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
    setTimeout(() => { el.style.animation = ''; }, duration);
  }

  function setCanvasVisible(visible) {
    if(visible) canvas.classList.remove('hidden'); else canvas.classList.add('hidden');
  }

  function setMenuVisible(visible) {
    if(visible) menuPanel.classList.remove('hidden'); else menuPanel.classList.add('hidden');
  }

  function playSound(freq, duration, type = 'sine') {
    if (!soundEnabled) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
  }

  muteBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('galaxy_sound', soundEnabled ? 'on' : 'off');
    updateMuteButton();
  });

  // Fullscreen Handler
  function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) elem.requestFullscreen();
      else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
      document.body.classList.add('fullscreen');
      fullscreenBtn.textContent = '⊡';
      fullscreenBtn.title = 'Fullscreen beenden';
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      document.body.classList.remove('fullscreen');
      fullscreenBtn.textContent = '⛶';
      fullscreenBtn.title = 'Fullscreen';
      W = 900;
      H = 600;
      canvas.width = W;
      canvas.height = H;
    }
  }

  fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      document.body.classList.remove('fullscreen');
      fullscreenBtn.textContent = '⛶';
      fullscreenBtn.title = 'Fullscreen';
      W = 900;
      H = 600;
      canvas.width = W;
      canvas.height = H;
    }
  });

  let W = canvas.width, H = canvas.height;
  let last = 0; let running = false; let score = 0; let high = parseInt(localStorage.getItem('galaxy_high') || '0', 10);
  highEl.textContent = high;

  // game state
  let mode = null; // 'dodge' | 'shooter' | 'arena'
  const player = {x: W/2, y: H-60, r: 20, speed: 420, lives: 3, shield: 0, weaponMult: 1};
  const asteroids = [];
  const enemies = [];
  const bullets = [];
  const enemyBullets = [];
  const pickups = [];

  let spawnTimer = 0; let difficulty = 1; let accum = 0; let lastShieldSpawnTime = 0;

  function rand(min, max){ return Math.random()*(max-min)+min }

  function resetGame(){
    asteroids.length = enemies.length = bullets.length = enemyBullets.length = pickups.length = 0;
    score = 0; difficulty = 1; accum = 0; spawnTimer = 0; lastShieldSpawnTime = 0;
    player.x = W/2; player.y = H-60; player.lives = 3; player.shield = 0; player.weaponMult = 1; player.speed = 420;
    updateUI();
  }

  function spawnAsteroid(){ const r=rand(12,42); asteroids.push({x:rand(r,W-r), y:-r-10, r, vy:rand(80,180)*difficulty, rot:rand(0,Math.PI*2)}); }

  function spawnEnemy(){ const r=18; const x = rand(r, W-r); const dir = Math.random() < 0.5 ? -1 : 1; enemies.push({x, y:-30, r, vy:rand(30,70)*difficulty, vx:dir*rand(20,70)*difficulty, shootTimer:rand(0.6,2.2)}); }

  function spawnPickup(){
    const r = 14;
    const pickupType = Math.random() < 0.6 ? 'shield' : 'life';
    const currentTime = performance.now() / 1000;
    if(pickupType === 'shield' && (currentTime - lastShieldSpawnTime) < 30) return;
    if(pickupType === 'shield') lastShieldSpawnTime = currentTime;
    pickups.push({x:rand(r,W-r), y:-r-10, r, type:pickupType, vy:80, age:0});
  }

  function collide(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy <= (a.r+b.r)*(a.r+b.r); }

  function update(dt){
    if(!running) return;
    // input movement
    if(input.left) player.x -= player.speed*dt;
    if(input.right) player.x += player.speed*dt;
    if(input.mouseX !== null){ player.x += (input.mouseX - player.x)*8*dt; }
    player.x = Math.max(player.r, Math.min(W-player.r, player.x));

    spawnTimer += dt;
    // spawn rules by mode
    if(mode === 'dodge'){
      if(spawnTimer > Math.max(0.35, 1.2 - difficulty*0.08)){ spawnAsteroid(); spawnTimer=0 }
      if(Math.random()<0.005) spawnPickup();
    } else if(mode === 'shooter'){
      if(spawnTimer > Math.max(0.6, 1.0 - difficulty*0.06)){ spawnEnemy(); spawnTimer=0 }
      if(Math.random()<0.006) spawnPickup();
    } else if(mode === 'arena'){
      if(spawnTimer > Math.max(0.3, 0.6 - difficulty*0.09)){ if(Math.random()<0.6) spawnAsteroid(); else spawnEnemy(); spawnTimer=0 }
      if(Math.random()<0.01) spawnPickup();
    }

    // update asteroids
    for(let i=asteroids.length-1;i>=0;--i){ const a=asteroids[i]; a.y += a.vy*dt; a.rot += dt*1.2; if(a.y - a.r > H+50){ asteroids.splice(i,1); score += Math.floor(5*difficulty); } }

    // update enemies
    for(let i=enemies.length-1;i>=0;--i){ const e=enemies[i]; e.x += e.vx*dt; e.y += e.vy*dt; e.shootTimer -= dt; if(e.x<e.r||e.x>W-e.r) e.vx *= -1; if(e.shootTimer<=0){ // shoot
        enemyBullets.push({x:e.x, y:e.y+e.r+6, r:5, vy: 180 + 60*difficulty}); e.shootTimer = rand(0.7,1.8); }
      if(e.y - e.r > H+50){ enemies.splice(i,1); score += Math.floor(15*difficulty); } }

    // update bullets
    for(let i=bullets.length-1;i>=0;--i){ const b=bullets[i]; b.y += b.vy*dt; if(b.y+b.r< -10) bullets.splice(i,1); }
    for(let i=enemyBullets.length-1;i>=0;--i){ const b=enemyBullets[i]; b.y += b.vy*dt; if(b.y - b.r > H+20) enemyBullets.splice(i,1); }

    // pickups
    for(let i=pickups.length-1;i>=0;--i){ const p=pickups[i]; p.y += (p.vy||80)*dt; p.age += dt; if(p.y-p.r>H+30) pickups.splice(i,1); else if(collide(p, player)) { if(p.type==='shield'){ player.shield = 6; playSound(880, 0.15); } else if(p.type==='life'){ player.lives += 1; playSound(1320, 0.15); } pickups.splice(i,1); } }

    // collisions: player vs asteroids/enemies/enemyBullets
    if(player.shield > 0) player.shield = Math.max(0, player.shield - dt);
    for(let i=asteroids.length-1;i>=0;--i){ if(collide(player, asteroids[i])){ handlePlayerHit(); asteroids.splice(i,1); } }
    for(let i=enemies.length-1;i>=0;--i){ if(collide(player, enemies[i])){ handlePlayerHit(); enemies.splice(i,1); } }
    for(let i=enemyBullets.length-1;i>=0;--i){ if(collide(player, enemyBullets[i])){ enemyBullets.splice(i,1); handlePlayerHit(); } }

    // bullets hitting enemies/asteroids
    for(let i=bullets.length-1;i>=0;--i){ const b=bullets[i]; let removed=false; for(let j=enemies.length-1;j>=0;--j){ if(collide(b, enemies[j])){ enemies.splice(j,1); bullets.splice(i,1); score += 30; playSound(600, 0.1); removed=true; break } } if(removed) continue; for(let k=asteroids.length-1;k>=0;--k){ if(collide(b, asteroids[k])){ asteroids.splice(k,1); bullets.splice(i,1); score += 8; playSound(400, 0.1); removed=true; break } } }

    // difficulty ramp
    accum += dt; if(accum > 3){ difficulty += 0.02; accum = 0 }

    // update score and UI
    score += dt * 6 * difficulty; updateScore();
    updateUI();
  }

  function handlePlayerHit(){ if(player.shield>0){ player.shield = 0; playSound(440, 0.1); return; } player.lives -= 1; playSound(200, 0.2); if(player.lives <= 0){ endGame(); } }

  function updateUI(){ 
    livesEl.textContent = player.lives;
    shieldEl.textContent = player.shield>0 ? player.shield.toFixed(0)+'s' : '0s'; 
    if(player.shield > 0) {
      shieldEl.parentElement.style.animation = 'pulse 0.6s ease-out';
    }
  }

  let lastDisplayedScore = 0;
  function updateScore() {
    if (Math.floor(score) !== lastDisplayedScore) {
      const oldScore = Math.floor(lastDisplayedScore);
      const newScore = Math.floor(score);
      animateValue(scoreEl, oldScore, newScore, 300);
      lastDisplayedScore = newScore;
    }
  }

  function draw(){ ctx.clearRect(0,0,W,H); // background
    const g = ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0b1530'); g.addColorStop(1,'#020316'); ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    // small stars
    for(let i=0;i<80;i++){ ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect((i*61)%W, (i*47)%H, 1.2, 1.2); }

    // draw pickups with textures
    for(const p of pickups){
      ctx.save(); ctx.translate(p.x,p.y);
      if(p.type==='shield'){
        // Shield: cyan glow
        ctx.fillStyle = 'rgba(0,212,255,0.15)';
        ctx.beginPath(); ctx.arc(0,0,p.r+6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(-p.r*0.4,-p.r*0.4,p.r*0.4,0,Math.PI*2); ctx.fill();
      } else if(p.type==='life'){
        // Heart: golden with glow
        const bounce = Math.sin(p.age*8)*2;
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.beginPath(); ctx.arc(0,0,p.r+8+bounce,0,Math.PI*2); ctx.fill();
        drawHeart(ctx, 0, 0, p.r, '#ffd700');
      }
      ctx.restore();
    }

    // draw player (triangle + shield)
    ctx.save(); ctx.translate(player.x, player.y);
    if(player.shield>0){
      // Enhanced shield glow
      const pulseSize = 6 + Math.sin(performance.now()/200)*2;
      for(let i=3;i>0;i--){
        ctx.strokeStyle=`rgba(0,212,255,${0.2/i})`;
        ctx.lineWidth=4;
        ctx.beginPath(); ctx.arc(0,0,player.r+6+i*3,0,Math.PI*2); ctx.stroke();
      }
    }
    ctx.fillStyle = '#7c3aed';
    ctx.shadowColor = 'rgba(124,58,237,0.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0,-player.r); ctx.lineTo(player.r*0.8, player.r); ctx.lineTo(-player.r*0.8, player.r); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.restore();

    // draw asteroids with texture
    for(const a of asteroids){
      ctx.save(); ctx.translate(a.x,a.y); ctx.rotate(a.rot);
      // Asteroid shadow
      ctx.fillStyle='rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(0,0,a.r*1.05,0,Math.PI*2); ctx.fill();
      // Asteroid main
      ctx.fillStyle='#8b8b8b';
      ctx.beginPath(); ctx.arc(0,0,a.r,0,Math.PI*2); ctx.fill();
      // Craters
      ctx.fillStyle='rgba(0,0,0,0.4)';
      for(let i=0;i<3;i++){
        const cx = Math.cos(i*Math.PI*2/3)*a.r*0.6;
        const cy = Math.sin(i*Math.PI*2/3)*a.r*0.6;
        ctx.beginPath(); ctx.arc(cx,cy,a.r*0.2,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    // draw enemies with texture
    for(const e of enemies){
      ctx.save(); ctx.translate(e.x,e.y);
      // Shadow
      ctx.fillStyle='rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.rect(-e.r, -e.r+2, e.r*2, e.r*2); ctx.fill();
      // Main body
      ctx.fillStyle='#f59e0b';
      ctx.beginPath(); ctx.rect(-e.r, -e.r, e.r*2, e.r*2); ctx.fill();
      // Highlight
      ctx.fillStyle='rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.rect(-e.r*0.8, -e.r*0.8, e.r*1.2, e.r*0.6); ctx.fill();
      // Eye glow
      ctx.fillStyle='#ff6b6b';
      ctx.beginPath(); ctx.arc(-e.r*0.3, 0, e.r*0.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r*0.3, 0, e.r*0.2, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // draw bullets with glow
    for(const b of bullets){
      ctx.fillStyle='rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffffff';
      ctx.shadowColor='rgba(255,255,255,0.6)';
      ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      ctx.shadowColor='transparent';
    }
    
    for(const b of enemyBullets){
      ctx.fillStyle='rgba(255,107,107,0.2)';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff6b6b';
      ctx.shadowColor='rgba(255,107,107,0.6)';
      ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      ctx.shadowColor='transparent';
    }
  }

  function drawHeart(ctx, x, y, size, color){
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.4);
    ctx.bezierCurveTo(x - size * 0.5, y - size * 0.3, x - size * 0.7, y, x, y + size * 0.7);
    ctx.bezierCurveTo(x + size * 0.7, y, x + size * 0.5, y - size * 0.3, x, y + size * 0.4);
    ctx.fill();
  }

  function loop(ts){ if(!last) last=ts; const dt = Math.min(0.05,(ts-last)/1000); last=ts; update(dt); draw(); if(running) requestAnimationFrame(loop); }

  // Bluetooth & Multi-player setup
  async function initBluetooth(selectedMode) {
    if (selectedMode === 'pvp') {
      if (!navigator.bluetooth) {
        return { success: false, reason: 'Bluetooth nicht unterstützt' };
      }
      try {
        console.log('PVP Mode: Ready for Bluetooth connection on same device');
        return { success: true };
      } catch (error) {
        console.error('Bluetooth error:', error);
        return { success: false, reason: 'Bluetooth-Verbindung fehlgeschlagen' };
      }
    }
    return { success: true };
  }

  // Game start without countdown
  function startGameDirectly() {
    // Hide menu/overlay/header/footer so only the game canvas and HUD are visible
    try { menuPanel.classList.add('hidden'); } catch(e){}
    try { overlay.classList.add('hidden'); } catch(e){}
    const headerEl = document.querySelector('.game-header');
    const footerEl = document.querySelector('.game-footer');
    const mp = document.getElementById('modePreview');
    if(headerEl) headerEl.classList.add('hidden');
    if(footerEl) footerEl.classList.add('hidden');
    if(mp) mp.classList.add('hidden');
    canvas.classList.remove('hidden');
    running = true;
    last = null;
    requestAnimationFrame(loop);
  }

  function startGame(selectedMode) { 
    mode = selectedMode;
    modeTitle.textContent = mode.toUpperCase();
    modeDesc.textContent = modeDescText(mode);
    gamePanel.classList.add('hide-menu'); 
    playSound(1200, 0.1); 
    
    initBluetooth(mode).then(result => {
      if (!result.success) {
        // Return to menu on Bluetooth failure
        playSound(200, 0.3);
        gamePanel.classList.remove('hide-menu');
        gamePanel.classList.remove('hidden');
        gamePanel.classList.add('hidden');
        menuPanel.classList.remove('hidden');
        try{ overlay.classList.remove('hidden'); }catch(e){}
        const headerEl = document.querySelector('.game-header');
        const footerEl = document.querySelector('.game-footer');
        if(headerEl) headerEl.classList.remove('hidden');
        if(footerEl) footerEl.classList.remove('hidden');
        return;
      }
      
      setTimeout(()=>{ 
        gamePanel.classList.add('hidden'); 
        gamePanel.classList.remove('hide-menu'); 
      }, 500);
      
      gameOverPanel.classList.add('hidden');
      resetGame();
      startGameDirectly();
    });
  }

  function modeDescText(m){ 
    const modes = {
      'dodge': 'Klassisch: Weiche Meteoriten aus und schieße um Punkte zu bekommen!',
      'shooter': 'Gegner schießen auf dich - werde schneller und treffsicherer!',
      'arena': 'Total chaotisch: Mix aus Meteoriten & Gegnern, sehr hart!',
      'boss': 'Bekämpfe epische Boss-Gegner in Eins-gegen-Eins Gefechten!',
      'survival': 'Wie lange kannst du überleben? Wellen von Gegnern warten!',
      'pvp': '1v1 Bluetooth: Tritt gegen einen Freund auf demselben Gerät an!'
    };
    return modes[m] || 'Unbekannter Modus';
  }

  // Quick-choice handlers A/B/C
  function handleChoiceA(){
    // Toggle sound and play test tone
    soundEnabled = !soundEnabled;
    localStorage.setItem('galaxy_sound', soundEnabled ? 'on' : 'off');
    updateMuteButton();
    playSound(880, 0.15, 'sine');
    pulse(muteBtn);
  }

  function handleChoiceB(){
    // Open a simple difficulty selector in the menu
    const choice = prompt('Balance wählen: easy, normal oder hard', 'normal');
    if(!choice) return;
    if(choice.toLowerCase()==='easy') difficulty = 0.6;
    else if(choice.toLowerCase()==='hard') difficulty = 1.6;
    else difficulty = 1;
    alert('Schwierigkeit gesetzt: ' + (difficulty===1? 'normal' : (difficulty<1? 'easy' : 'hard')));
    playSound(660, 0.12);
  }

  function handleChoiceC(){
    // Copy highscore to clipboard (simple share)
    const text = 'Mein Highscore: ' + high + ' auf Galaxy Dodge!';
    if(navigator.clipboard){ navigator.clipboard.writeText(text).then(()=>{ alert('Highscore kopiert: ' + text); playSound(1320,0.12); }); }
    else { prompt('Kopiere deinen Highscore:', text); }
  }
  

  function endGame(){ 
    running=false; 
    overlay.style.pointerEvents='auto'; 
    gameOverPanel.classList.remove('hidden'); 
    gamePanel.classList.add('hidden'); 
    
    const oldScore = Math.floor(lastDisplayedScore);
    const finalScore = Math.floor(score);
    animateValue(finalScoreEl, oldScore, finalScore, 500);
    
    playSound(150, 0.3);
    
    if(finalScore > high){ 
      high = finalScore; 
      localStorage.setItem('galaxy_high', high); 
      animateValue(highEl, parseInt(highEl.textContent), high, 500);
      scaleElement(highEl.parentElement);
    } 
  }

  // input
  const input = {left:false,right:false,mouseX:null};
  window.addEventListener('keydown', e=>{ 
    if(e.key==='ArrowLeft'||e.key==='a') input.left=true; 
    if(e.key==='ArrowRight'||e.key==='d') input.right=true; 
    if(e.key===' '||e.key==='Spacebar'){ e.preventDefault(); playerShoot(); }
  });
  window.addEventListener('keyup', e=>{ if(e.key==='ArrowLeft'||e.key==='a') input.left=false; if(e.key==='ArrowRight'||e.key==='d') input.right=false; });
  canvas.addEventListener('mousemove', e=>{ const rect=canvas.getBoundingClientRect(); input.mouseX = (e.clientX-rect.left) * (canvas.width/rect.width); });
  canvas.addEventListener('mouseleave', ()=>{ input.mouseX = null });
  canvas.addEventListener('click', ()=>{ playerShoot(); });
  canvas.addEventListener('touchstart', e=>{ const rect=canvas.getBoundingClientRect(); const t=e.touches[0]; const x=(t.clientX-rect.left)*(canvas.width/rect.width); input.mouseX=x; playerShoot(); }, {passive:false});

  function playerShoot(){ if(!running) return; bullets.push({x:player.x, y:player.y-player.r-6, r:6, vy:-420}); playSound(800, 0.05); }

  // menu interactions with smooth transitions
  menuBtns.forEach(b=> { 
    b.addEventListener('click', ()=>{ 
      pulse(b);
      setTimeout(()=>{
        const m=b.dataset.mode; 
        modeTitle.textContent = m.toUpperCase(); 
        modeDesc.textContent = modeDescText(m); 
        startBtn.onclick = ()=> startGame(m); 
      }, 200);
    });
  });

  // New mode card interactions for main menu
  const modeCards = document.querySelectorAll('.mode-card');
  const modesGrid = document.querySelector('.modes-grid');
  const modePreview = document.getElementById('modePreview');
  
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      // Ignore coming-soon cards
      if (card.classList.contains('coming-soon')) {
        playSound(400, 0.1);
        return;
      }
      
      const m = card.dataset.mode;
      modeTitle.textContent = m.toUpperCase();
      modeDesc.textContent = modeDescText(m);
      startBtn.onclick = () => startGame(m);
      
      // Show preview directly
      modePreview.classList.remove('hidden');
    });
  });

  // Back button from preview to grid
  if (modePreview) {
    const modePreviewBackBtn = document.createElement('button');
    modePreviewBackBtn.className = 'back-btn';
    modePreviewBackBtn.textContent = '←';
    modePreviewBackBtn.title = 'Zurück';
    modePreviewBackBtn.addEventListener('click', () => {
      modePreview.classList.add('hidden');
    });
    modePreview.insertBefore(modePreviewBackBtn, modePreview.firstChild);
  }

  restartBtn.addEventListener('click', ()=>{ 
    pulse(restartBtn);
    setTimeout(()=>{
      gameOverPanel.classList.add('hidden'); 
      startGame(mode);
    }, 150);
  });

  menuBtn.addEventListener('click', ()=>{ 
    pulse(menuBtn);
    setTimeout(()=>{
      gameOverPanel.classList.add('hidden'); 
      setMenuVisible(true);
      setCanvasVisible(false);
      try{ overlay.classList.remove('hidden'); }catch(e){}
      const headerEl = document.querySelector('.game-header');
      const footerEl = document.querySelector('.game-footer');
      if(headerEl) headerEl.classList.remove('hidden');
      if(footerEl) footerEl.classList.remove('hidden');
    }, 150);
  });

  backBtn.addEventListener('click', ()=>{ 
    pulse(backBtn);
    setTimeout(()=>{
      gamePanel.classList.add('hidden');
      setMenuVisible(true);
      setCanvasVisible(false);
      try{ overlay.classList.remove('hidden'); }catch(e){}
      const headerEl = document.querySelector('.game-header');
      const footerEl = document.querySelector('.game-footer');
      if(headerEl) headerEl.classList.remove('hidden');
      if(footerEl) footerEl.classList.remove('hidden');
    }, 150);
  });

  startBtn.addEventListener('click', function() { pulse(this); });

  overlay.style.pointerEvents='auto'; menuPanel.classList.remove('hidden'); gamePanel.classList.add('hidden'); gameOverPanel.classList.add('hidden');
  function initCanvas(){ W = canvas.width = 900; H = canvas.height = 600; }
  
  // Resize handler for fullscreen and mobile
  window.addEventListener('resize', () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    }
  });
  
  // Mobile fullscreen support
  if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
    fullscreenBtn.style.display = 'flex';
  }
  
  initCanvas(); updateUI();
})();
