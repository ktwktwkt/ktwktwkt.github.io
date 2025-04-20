window.onload = () => {
  const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#222',
    physics: {
      default: 'arcade',
      arcade: { debug: false }
    },
    scene: [WeaponSelectScene, GameScene]
  };
  new Phaser.Game(config);
};

class WeaponSelectScene extends Phaser.Scene {
  constructor() { super('WeaponSelect'); }
  create() {
    this.add.text(400, 100, '무기 선택', { font: '32px Arial', fill: '#fff' }).setOrigin(0.5);
    this.weapons = [
      { name: '스태프', key: 'staff', color: 0x00ffff },
      { name: '권총', key: 'pistol', color: 0xffff00 },
      { name: '샷건', key: 'shotgun', color: 0xff8800 }
    ];
    this.weapons.forEach((w, i) => {
      const x = 200 + i * 200, y = 300;
      const circle = this.add.circle(x, y, 40, w.color).setInteractive();
      this.add.text(x, y + 60, w.name, { font: '16px Arial', fill: '#fff' }).setOrigin(0.5);
      circle.on('pointerdown', () => {
        this.scene.start('Game', { weapon: w.key });
      });
    });
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }
  init(data) { this.weaponType = data.weapon; }
  preload() {}
  create() {
    // 텍스처 생성
    const gfx = this.add.graphics();
    // player
    gfx.fillStyle(0x00ff00).fillCircle(16,16,16);
    gfx.generateTexture('player',32,32);
    gfx.clear();
    // bullet textures per weapon
    gfx.fillStyle(0x00ffff).fillCircle(8,8,8);
    gfx.generateTexture('bullet_staff',16,16);
    gfx.clear();
    gfx.fillStyle(0xffff00).fillCircle(8,8,8);
    gfx.generateTexture('bullet_pistol',16,16);
    gfx.clear();
    gfx.fillStyle(0xff8800).fillCircle(8,8,8);
    gfx.generateTexture('bullet_shotgun',16,16);
    gfx.clear();
    // special
    gfx.fillStyle(0xff00ff).fillCircle(12,12,12);
    gfx.generateTexture('special',24,24);
    gfx.clear();
    // enemies
    gfx.fillStyle(0xff0000).fillCircle(16,16,16);
    gfx.generateTexture('enemy_melee',32,32);
    gfx.clear();
    gfx.fillStyle(0xff00ff).fillCircle(16,16,16);
    gfx.generateTexture('enemy_fast',32,32);
    gfx.clear();
    gfx.fillStyle(0xffff00).fillCircle(32,32,32);
    gfx.generateTexture('enemy_tank',64,64);
    gfx.clear();

    // groups
    this.bullets = this.physics.add.group();
    this.enemies = this.physics.add.group();

    // 적 유형 설정(HP, 속도, 크기, 회피 여부) 및 보스 소환 플래그
    this.enemyConfigs = {
      melee: { key:'enemy_melee', speed:100, scale:1, hp:2 },
      fast:  { key:'enemy_fast',  speed:150, scale:1, hp:1 },
      tank:  { key:'enemy_tank',  speed:60,  scale:1.5, hp:5 },
      dodger:{ key:'enemy_fast',  speed:120, scale:1, hp:3, dodge:true },
      boss:  { key:'enemy_tank',  speed:40,  scale:2, hp:20 }
    };
    this.bossSpawned = false;

    // player
    this.player = this.physics.add.sprite(400,300,'player').setCollideWorldBounds(true);

    // input
    this.cursors = this.input.keyboard.addKeys('W,A,S,D');

    // UI
    this.timeElapsed = 0;
    this.timerText = this.add.text(10,10,'Time:0',{font:'16px Arial',fill:'#fff'});
    this.health = 3;
    this.healthText = this.add.text(10,30,'HP:'+this.health,{font:'16px Arial',fill:'#fff'});
    this.gameOver = false;

    // 시나리오/스폰/업그레이드 매니저 정의
    class ScenarioManager {
      constructor(scene) {
        this.scene = scene;
        this.timeElapsed = 0;
        this.phase = 'combat';
        this.text = scene.add.text(600,10,'Phase:Combat',{font:'16px Arial',fill:'#fff'});
      }
      update(delta) {
        this.timeElapsed += delta/1000;
        if(this.phase==='combat' && this.timeElapsed>=600){
          this.phase = 'escape';
          this.text.setText('Phase:Escape');
        }
        this.text.setText('Phase:'+this.phase+' '+Math.floor(this.timeElapsed));
      }
    }

    class SpawnManager {
      constructor(scene) {
        this.scene = scene;
        this.timer = 0;
      }
      update(delta) {
        const t = Math.min(this.scene.scenarioManager.timeElapsed/600,1);
        const interval = Phaser.Math.Linear(2000,500,t);
        this.timer += delta;
        if(this.timer > interval){ this.timer = 0; this.scene.spawnEnemy(); }
      }
    }

    class UpgradeManager {
      constructor(scene) {
        this.scene = scene;
        this.killCount = 0;
        this.level = 0;
        this.text = scene.add.text(600,30,'UpLv:0',{font:'16px Arial',fill:'#fff'});
      }
      onKill() {
        this.killCount++;
        const next = (this.level+1)*10;
        if(this.killCount >= next && this.level<3){ this.level++; this.text.setText('UpLv:'+this.level); }
      }
    }

    // 매니저 인스턴스화
    this.scenarioManager = new ScenarioManager(this);
    this.spawnManager = new SpawnManager(this);
    this.upgradeManager = new UpgradeManager(this);

    // collisions
    this.physics.add.overlap(this.bullets,this.enemies,this.bulletHit,null,this);
    this.physics.add.overlap(this.player,this.enemies,(p,e)=>{
      e.destroy();
      if(!this.gameOver){
        this.health--;
        this.healthText.setText('HP:'+this.health);
        if(this.health<=0){
          this.gameOver=true;
          this.add.text(400,300,'Game Over',{font:'32px Arial',fill:'#f00'}).setOrigin(0.5);
        }
      }
    });

    // shooting
    this.input.on('pointerdown', pointer => {
      if(pointer.rightButtonDown() && this.timeElapsed>this.specialCooldown){
        this.shoot('special',pointer);
        this.specialCooldown=this.timeElapsed+3;
      } else if(pointer.leftButtonDown()){
        this.shoot('bullet',pointer);
      }
    });
  }

  update(time,delta){
    if(this.gameOver) return;

    // 시나리오 및 스폰 매니저 업데이트
    this.scenarioManager.update(delta);
    if(!this.bossSpawned && this.scenarioManager.timeElapsed>30){ this.spawnBoss(); this.bossSpawned=true; }
    if(this.scenarioManager.phase==='combat'){ this.spawnManager.update(delta); }

    // 플레이어 이동
    const speed=200; let vx=0,vy=0;
    if(this.cursors.W.isDown) vy=-speed;
    if(this.cursors.S.isDown) vy=speed;
    if(this.cursors.A.isDown) vx=-speed;
    if(this.cursors.D.isDown) vx=speed;
    this.player.setVelocity(vx,vy);

    // 적 이동 및 회피 로직
    this.enemies.getChildren().forEach(e=>{
      if(e.dodge){
        let nearest=null, min=Infinity;
        this.bullets.getChildren().forEach(b=>{ const d = Phaser.Math.Distance.Between(e.x,e.y,b.x,b.y); if(d<min){ min=d; nearest=b; } });
        if(nearest && min<150){
          const vec = new Phaser.Math.Vector2(e.x-nearest.x,e.y-nearest.y).normalize().scale(e.speed);
          e.setVelocity(vec.x,vec.y);
          return;
        }
      }
      this.physics.moveToObject(e,this.player,e.speed);
      if(e.x<0||e.x>800||e.y<0||e.y>600) e.destroy();
    });

    // update time
    this.timeElapsed+=delta/1000;
    this.timerText.setText('Time:'+Math.floor(this.timeElapsed));
  }

  shoot(type,p){
    // 샷건: 5연발 산탄
    if(type==='bullet' && this.weaponType==='shotgun'){
      const base=Phaser.Math.Angle.Between(this.player.x,this.player.y,p.worldX,p.worldY);
      for(let i=-2;i<=2;i++){
        const ang = base + i*0.1;
        const b = this.bullets.create(this.player.x,this.player.y,'bullet_shotgun');
        b.rotation=ang; b.damage=1;
        this.physics.velocityFromRotation(ang,400,b.body.velocity);
      }
      return;
    }
    // 권총: 3연발 버스트
    if(type==='bullet' && this.weaponType==='pistol'){
      for(let i=0;i<3;i++){
        this.time.delayedCall(i*100,()=>{
          const ang=Phaser.Math.Angle.Between(this.player.x,this.player.y,p.worldX,p.worldY);
          const b=this.bullets.create(this.player.x,this.player.y,'bullet_pistol');
          b.rotation=ang; b.damage=1;
          this.physics.velocityFromRotation(ang,600,b.body.velocity);
        });
      }
      return;
    }
    // 기본/스태프
    const cfg = { bullet: 'bullet_'+this.weaponType, spd:500, dmg:1 };
    if(this.weaponType==='staff'){ cfg.bullet='bullet_staff'; cfg.spd=300; cfg.dmg=2; }
    if(type==='special'){ cfg.bullet='special'; cfg.spd=300; cfg.dmg=3; }
    const b = this.bullets.create(this.player.x,this.player.y,cfg.bullet);
    b.rotation=Phaser.Math.Angle.Between(this.player.x,this.player.y,p.worldX,p.worldY);
    b.damage=cfg.dmg;
    if(this.weaponType==='staff'){ b.setBounce(1); b.setCollideWorldBounds(true); }
    this.physics.moveTo(b,p.worldX,p.worldY,cfg.spd);
  }

  spawnEnemy(){
    let types=Object.keys(this.enemyConfigs).filter(k=>k!=='boss');
    let type=types[Phaser.Math.Between(0,types.length-1)];
    const cfg=this.enemyConfigs[type];
    const x=Phaser.Math.Between(0,800),y=Phaser.Math.Between(0,600);
    if(Phaser.Math.Distance.Between(x,y,this.player.x,this.player.y)<100) return;
    const e=this.enemies.create(x,y,cfg.key);
    e.speed=cfg.speed; e.hp=cfg.hp; e.dodge=cfg.dodge||false; e.setScale(cfg.scale||1);
    this.tweens.add({targets:e,scale:e.scale+0.3,yoyo:true,duration:300});
  }

  // 보스 소환 처리
  spawnBoss(){
    const cfg=this.enemyConfigs.boss;
    const x=Phaser.Math.Between(0,800), y=Phaser.Math.Between(0,600);
    const e = this.enemies.create(x,y,cfg.key);
    e.speed=cfg.speed; e.hp=cfg.hp; e.totalHp=cfg.hp; e.isBoss=true;
    e.setScale(cfg.scale);
    // 보스 체력바
    const bar = this.add.graphics();
    bar.fillStyle(0x00ff00).fillRect(x-50,y-80,100,10);
    e.healthBar = bar;
    // 소환 연출
    this.cameras.main.shake(500,0.02);
    const particles = this.add.particles('special');
    particles.createEmitter({speed:{min:-200,max:200},scale:{start:0.5,end:0},lifespan:1000}).explode(50,x,y);
    this.tweens.add({targets:e,scale:e.scale+0.3,yoyo:true,duration:300});
  }

  // 탄환 - 적 충돌 처리
  bulletHit(b,e){
    b.destroy();
    e.hp -= b.damage;
    if(e.isBoss){ e.healthBar.clear(); e.healthBar.fillStyle(0x00ff00).fillRect(e.x-50,e.y-80,100*(e.hp/e.totalHp),10); }
    if(e.hp <= 0){
      if(e.isBoss) e.healthBar.destroy();
      e.destroy();
      this.upgradeManager.onKill();
    }
  }
}
