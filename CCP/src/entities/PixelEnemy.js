import Phaser from 'phaser';

export default class PixelEnemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, type = 'normal') {
        const textureMap = {
            'normal': 'enemy_pixel',
            'tank': 'enemy_tank_pixel',
            'ranged': 'enemy_ranged_pixel',
            'fast': 'enemy_fast_pixel',
            'boss': 'enemy_boss_pixel'
        };
        
        super(scene, x, y, textureMap[type] || 'enemy_pixel');
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.type = type;
        this.setupStats();
        
        // 애니메이션 상태
        this.animState = 'idle';
        this.animTimer = 0;
        this.frameIndex = 0;
        
        // 그림자
        this.createShadow();
        
        // 체력바
        this.createHealthBar();
        
        // AI 상태
        this.aiState = 'patrol';
        this.target = null;
        this.lastShot = 0;
        
        // 애니메이션 시작
        this.startAnimation();
    }
    
    setupStats() {
        const stats = {
            'normal': {
                health: 50,
                maxHealth: 50,
                speed: 100,
                damage: 10,
                detectionRange: 500,  // 탐지 범위 증가
                attackRange: 40,
                attackSpeed: 1000,
                scale: 1,
                tint: null,
                aggressive: true  // 즉시 공격
            },
            'tank': {
                health: 150,
                maxHealth: 150,
                speed: 50,
                damage: 20,
                detectionRange: 400,
                attackRange: 40,
                attackSpeed: 1500,
                scale: 1.2,
                tint: null,
                aggressive: true
            },
            'kamikaze': {  // 자폭 적
                health: 30,
                maxHealth: 30,
                speed: 180,
                damage: 50,
                detectionRange: 600,
                attackRange: 30,
                attackSpeed: 100,
                scale: 0.8,
                tint: 0xff0000,
                pattern: 'kamikaze',
                aggressive: true
            },
            'teleporter': {  // 순간이동 적
                health: 40,
                maxHealth: 40,
                speed: 90,
                damage: 15,
                detectionRange: 450,
                attackRange: 150,
                attackSpeed: 1200,
                scale: 0.9,
                tint: 0x9900ff,
                pattern: 'teleport',
                canTeleport: true,
                aggressive: true
            },
            'splitter': {  // 분열 적
                health: 60,
                maxHealth: 60,
                speed: 80,
                damage: 12,
                detectionRange: 400,
                attackRange: 40,
                attackSpeed: 900,
                scale: 1.1,
                tint: 0x00ff99,
                pattern: 'splitter',
                canSplit: true,
                aggressive: true
            },
            'ranged': {
                health: 40,
                maxHealth: 40,
                speed: 80,
                damage: 15,
                detectionRange: 400,
                attackRange: 250,
                attackSpeed: 800,
                scale: 1,
                tint: null,
                canShoot: true
            },
            'fast': {
                health: 30,
                maxHealth: 30,
                speed: 150,
                damage: 8,
                detectionRange: 350,
                attackRange: 30,
                attackSpeed: 500,
                scale: 0.8,
                tint: null
            },
            'boss': {
                health: 500,
                maxHealth: 500,
                speed: 60,
                damage: 40,
                detectionRange: 500,
                attackRange: 60,
                attackSpeed: 2000,
                scale: 1.5,
                tint: null,
                isBoss: true
            }
        };
        
        const stat = stats[this.type] || stats['normal'];
        Object.assign(this, stat);
        
        // 패턴별 추가 변수
        this.pattern = stat.pattern || null;
        this.zigzagTimer = 0;
        this.circleAngle = 0;
        this.chargeTarget = null;
        this.isCharging = false;
        this.chargeTimer = 0;
        
        this.setScale(this.scale);
        // 초기 색상 설정 - clearTint로 원래 텍스처 색상 표시
        this.clearTint();
        if (this.type === 'boss') {
            this.setTint(0xff6666);
        } else if (stat.tint) {
            this.setTint(stat.tint);
        }
        this.setCollideWorldBounds(true);
        this.setDrag(200);
    }
    
    createShadow() {
        const shadowSize = this.type === 'boss' ? { w: 40, h: 20 } : { w: 20, h: 10 };
        this.shadow = this.scene.add.ellipse(
            this.x, 
            this.y + this.height * 0.5,
            shadowSize.w,
            shadowSize.h,
            0x000000,
            0.3
        );
        this.shadow.setDepth(this.depth - 1);
    }
    
    createHealthBar() {
        const barWidth = this.type === 'boss' ? 60 : 30;
        const barHeight = this.type === 'boss' ? 6 : 4;
        const yOffset = this.type === 'boss' ? -40 : -20;
        
        // 체력바 배경
        this.healthBarBg = this.scene.add.rectangle(
            this.x,
            this.y + yOffset,
            barWidth,
            barHeight,
            0x000000
        );
        this.healthBarBg.setStrokeStyle(1, 0x333333);
        this.healthBarBg.setDepth(this.depth + 10);
        
        // 체력바
        this.healthBar = this.scene.add.rectangle(
            this.x - barWidth/2 + 1,
            this.y + yOffset,
            (barWidth - 2) * (this.health / this.maxHealth),
            barHeight - 2,
            this.type === 'boss' ? 0xff0000 : 0xff6600
        );
        this.healthBar.setOrigin(0, 0.5);
        this.healthBar.setDepth(this.depth + 11);
    }
    
    startAnimation() {
        // 대기 애니메이션 (좌우 흔들림)
        this.idleAnim = this.scene.tweens.add({
            targets: this,
            scaleX: this.scale * 1.05,
            scaleY: this.scale * 0.95,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // 보스는 추가 효과
        if (this.type === 'boss') {
            this.scene.tweens.add({
                targets: this,
                tint: 0xff6666,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }
    
    update(player) {
        if (!this.active) return;
        
        this.target = player;
        const distance = this.getDistanceToTarget();
        
        // AI 상태 업데이트
        this.updateAI(distance);
        
        // 이동 처리
        this.handleMovement(distance);
        
        // 공격 처리
        this.handleAttack(distance);
        
        // UI 업데이트
        this.updateUI();
        
        // 애니메이션 업데이트
        this.updateAnimation();
    }
    
    updateAI(distance) {
        // 공격적 AI - 바로 추격 시작
        if (this.aggressive || distance < this.detectionRange) {
            if (distance < this.attackRange) {
                this.aiState = 'attack';
            } else {
                this.aiState = 'chase';
            }
        } else if (distance < this.detectionRange * 1.5) {
            // 탐지 범위 근처면 경계
            this.aiState = 'alert';
        } else {
            this.aiState = 'patrol';
        }
    }
    
    handleMovement(distance) {
        if (this.aiState === 'chase') {
            const angle = Phaser.Math.Angle.Between(
                this.x, this.y,
                this.target.x, this.target.y
            );
            
            const velocityX = Math.cos(angle) * this.speed;
            const velocityY = Math.sin(angle) * this.speed;
            
            this.setVelocity(velocityX, velocityY);
            
            // 탑다운 뷰 - 항상 아래쪽 향함
            this.setRotation(0);
            
            // 이동 애니메이션
            if (!this.moveAnim) {
                this.moveAnim = this.scene.tweens.add({
                    targets: this,
                    scaleX: this.scale * 0.9,
                    scaleY: this.scale * 1.1,
                    duration: 200,
                    yoyo: true,
                    repeat: -1
                });
            }
        } else if (this.aiState === 'patrol') {
            // 순찰 패턴
            if (Math.random() < 0.02) {
                const randomAngle = Math.random() * Math.PI * 2;
                const vx = Math.cos(randomAngle) * this.speed * 0.3;
                const vy = Math.sin(randomAngle) * this.speed * 0.3;
                this.setVelocity(vx, vy);
                
                // 탑다운 뷰 방향 고정
                this.setRotation(0);
            }
            
            if (this.moveAnim) {
                this.moveAnim.stop();
                this.moveAnim = null;
            }
        } else {
            this.setVelocity(0, 0);
            this.setRotation(0);
            
            if (this.moveAnim) {
                this.moveAnim.stop();
                this.moveAnim = null;
            }
        }
    }
    
    handleAttack(distance) {
        const now = this.scene.time.now;
        
        if (this.aiState === 'attack' && now - this.lastShot > this.attackSpeed) {
            if (this.canShoot && this.type === 'ranged') {
                this.shootProjectile();
            } else {
                this.meleeAttack();
            }
            this.lastShot = now;
        }
    }
    
    shootProjectile() {
        if (!this.target) return;
        
        const angle = Phaser.Math.Angle.Between(
            this.x, this.y,
            this.target.x, this.target.y
        );
        
        // 발사체 생성 (안전 체크)
        if (!this.scene || !this.scene.add || !this.scene.physics) {
            return;
        }
        
        const projectile = this.scene.add.circle(this.x, this.y, 3, 0xff00ff);
        this.scene.physics.add.existing(projectile);
        
        const speed = 300;
        projectile.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );
        
        // 발사 효과 (안전 체크)
        if (this.scene && this.scene.tweens) {
            this.scene.tweens.add({
            targets: this,
            scaleX: this.scale * 1.3,
            scaleY: this.scale * 0.7,
            duration: 100,
                yoyo: true
            });
        }
        
        // 충돌 처리
        this.scene.physics.add.overlap(projectile, this.target, () => {
            this.target.takeDamage(this.damage);
            
            // 체력 UI 업데이트 - UIManager 사용
            if (this.scene && this.scene.uiManager && this.target) {
                const health = Math.max(0, this.target.health || 0);
                const maxHealth = this.target.maxHealth || 100;
                this.scene.uiManager.updateHealth(health, maxHealth);
            }
            
            // 게임오버 체크
            if (this.target.health <= 0 && this.scene.gameOver) {
                this.scene.gameOver();
            }
            
            projectile.destroy();
        });
        
        // 시간 제한 (안전 체크)
        if (this.scene && this.scene.time) {
            this.scene.time.delayedCall(2000, () => {
                if (projectile && projectile.active && projectile.destroy) {
                    projectile.destroy();
                }
            });
        }
    }
    
    meleeAttack() {
        // 근접 공격 애니메이션 (안전 체크)
        if (!this.scene || !this.scene.tweens || !this.target) {
            return;
        }
        
        const angle = Phaser.Math.Angle.Between(
            this.x, this.y,
            this.target.x, this.target.y
        );
        
        this.scene.tweens.add({
            targets: this,
            x: this.x + Math.cos(angle) * 20,
            y: this.y + Math.sin(angle) * 20,
            scaleX: this.scale * 1.5,
            scaleY: this.scale * 1.5,
            duration: 100,
            yoyo: true,
            onComplete: () => {
                // 공격 판정
                const hitDistance = Phaser.Math.Distance.Between(
                    this.x, this.y,
                    this.target.x, this.target.y
                );
                
                if (hitDistance < this.attackRange + 10) {
                    this.target.takeDamage(this.damage);
                    
                    // 게임오버 체크 (안전 체크)
                    if (this.target.health <= 0 && this.scene && this.scene.gameOver) {
                        this.scene.gameOver();
                    }
                    
                    // 히트 이펙트
                    this.createHitEffect();
                }
            }
        });
    }
    
    createHitEffect() {
        // 안전 체크 추가
        if (!this.scene || !this.scene.add || !this.scene.tweens || !this.target) {
            return;
        }
        
        const flash = this.scene.add.circle(
            this.target.x,
            this.target.y,
            20,
            0xffffff,
            0.5
        );
        
        this.scene.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                if (flash && flash.destroy) {
                    flash.destroy();
                }
            }
        });
    }
    
    updateUI() {
        // 그림자 위치
        if (this.shadow) {
            this.shadow.x = this.x;
            this.shadow.y = this.y + this.height * 0.5;
        }
        
        // 체력바 위치
        if (this.healthBar && this.healthBarBg) {
            const yOffset = this.type === 'boss' ? -40 : -20;
            this.healthBarBg.x = this.x;
            this.healthBarBg.y = this.y + yOffset;
            
            const barWidth = this.type === 'boss' ? 60 : 30;
            this.healthBar.x = this.x - barWidth/2 + 1;
            this.healthBar.y = this.y + yOffset;
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            this.healthBar.width = Math.max(0, (barWidth - 2) * healthPercent);
            
            // HP가 0이면 HP바 숨기기
            if (this.health <= 0) {
                this.healthBar.setVisible(false);
                this.healthBarBg.setVisible(false);
            }
        }
    }
    
    updateAnimation() {
        // 움직임에 따른 애니메이션
        const velocity = this.body.velocity.length();
        
        if (velocity > 10) {
            // 걷기 애니메이션
            this.animTimer++;
            if (this.animTimer % 10 === 0) {
                this.setScale(
                    this.scale + (this.frameIndex % 2 === 0 ? 0.05 : -0.05),
                    this.scale
                );
                this.frameIndex++;
            }
        }
    }
    
    takeDamage(damage) {
        this.health -= damage;
        
        // 피격 애니메이션
        this.setTint(0xffffff);
        if (this.scene && this.scene.time) {
            this.scene.time.delayedCall(100, () => {
                // 원래 색상으로 복귀
                if (this.active) {
                    this.clearTint();
                    if (this.type === 'boss') {
                        this.setTint(0xff6666);
                    } else if (this.tint) {
                        this.setTint(this.tint);
                    }
                }
            });
        }
        
        // 넉백 (안전 체크 추가)
        if (this.target && this.body && this.active) {
            const angle = Phaser.Math.Angle.Between(
                this.target.x, this.target.y,
                this.x, this.y
            );
            if (this.body.velocity) {  // velocity 존재 확인
                this.setVelocity(
                    Math.cos(angle) * 200,
                    Math.sin(angle) * 200
                );
            }
        }
        
        // 피격 파티클 (안전 체크 추가)
        if (this.scene && this.scene.add && this.scene.tweens) {
            for (let i = 0; i < 5; i++) {
                const particle = this.scene.add.rectangle(
                    this.x + Phaser.Math.Between(-10, 10),
                    this.y + Phaser.Math.Between(-10, 10),
                    2, 2,
                    0xff0000
                );
                particle.setDepth(this.depth + 5);
                
                this.scene.tweens.add({
                    targets: particle,
                    x: particle.x + Phaser.Math.Between(-30, 30),
                    y: particle.y + Phaser.Math.Between(-30, 30),
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        if (particle && particle.destroy) {
                            particle.destroy();
                        }
                    }
                });
            }
        }
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        // 분열 타입은 죽을 때 작은 적 생성
        if (this.canSplit && !this.hasSplit) {
            this.split();
        }
        
        // 점수 추가 (안전 체크)
        if (this.scene && this.scene.player) {
            const points = this.type === 'boss' ? 100 : 
                          this.type === 'tank' ? 30 :
                          this.type === 'fast' ? 15 :
                          this.type === 'ranged' ? 20 : 10;
            this.scene.player.score += points;
            if (this.scene.scoreText) {
                this.scene.scoreText.setText('Score: ' + this.scene.player.score);
            }
        }
        
        // 죽음 애니메이션 (안전 체크)
        if (this.scene && this.scene.tweens) {
            this.scene.tweens.add({
                targets: this,
                scaleX: 0,
                scaleY: 0,
                angle: 360,
                duration: 500,
                onComplete: () => {
                // 아이템 드롭
                this.dropItems();
                
                // 정리
                if (this.shadow) this.shadow.destroy();
                if (this.healthBar) this.healthBar.destroy();
                if (this.healthBarBg) this.healthBarBg.destroy();
                if (this.idleAnim) this.idleAnim.stop();
                if (this.moveAnim) this.moveAnim.stop();
                
                // 새로운 적 스폰 (보스가 아닌 경우만)
                // destroy 호출 전에 이벤트 발생
                if (this.type !== 'boss' && this.scene && this.scene.enemies && this.scene.mapGenerator) {
                    const spawn = this.scene.mapGenerator.getRandomSpawnPoint();
                    if (this.scene.player && 
                        Phaser.Math.Distance.Between(spawn.x, spawn.y, this.scene.player.x, this.scene.player.y) > 300) {
                        const types = ['normal', 'fast', 'ranged', 'tank'];
                        const type = Phaser.Math.RND.pick(types);
                        // GameScene에서 처리하도록 이벤트 발생
                        this.scene.events.emit('enemyKilled', { x: spawn.x, y: spawn.y, type: type });
                    }
                }
                
                    this.destroy();
                }
            });
        } else {
            // scene이 없으면 그냥 파괴
            this.destroy();
            return;
        }
        
        // 죽음 파티클 (안전 체크)
        if (this.scene && this.scene.add && this.scene.tweens) {
            for (let i = 0; i < 10; i++) {
                const particle = this.scene.add.circle(
                this.x,
                this.y,
                Phaser.Math.Between(2, 5),
                this.type === 'boss' ? 0xff0000 : 0x8b0000
            );
            particle.setDepth(this.depth + 5);
            
            const angle = (Math.PI * 2 / 10) * i;
            const distance = Phaser.Math.Between(20, 60);
            
                this.scene.tweens.add({
                    targets: particle,
                    x: this.x + Math.cos(angle) * distance,
                    y: this.y + Math.sin(angle) * distance,
                    scale: 0,
                    alpha: 0,
                    duration: 800,
                    ease: 'Power2',
                    onComplete: () => {
                        if (particle && particle.destroy) {
                            particle.destroy();
                        }
                    }
                });
            }
        }
    }
    
    dropItems() {
        // 아이템 드롭 확률
        const dropChance = this.type === 'boss' ? 1 : 0.3;
        
        if (Math.random() < dropChance) {
            const itemTypes = ['health', 'ammo', 'powerup'];
            const itemType = Phaser.Math.RND.pick(itemTypes);
            
            // scene.add가 존재하는지 확인
            if (this.scene && this.scene.add) {
                const item = this.scene.add.rectangle(
                    this.x,
                    this.y,
                    16, 16,
                    itemType === 'health' ? 0x00ff00 : 
                    itemType === 'ammo' ? 0xffff00 : 0x00ffff
                );
                item.setDepth(5);
                item.itemType = itemType;
                
                // 아이템 애니메이션 (안전 체크)
                if (this.scene.tweens) {
                    this.scene.tweens.add({
                        targets: item,
                        y: item.y - 10,
                        duration: 500,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
                
                // 아이템 리스트에 추가 (GameScene에서 관리)
                if (this.scene.droppedItems) {
                    this.scene.droppedItems.push(item);
                }
            }
            // 중복 코드 제거됨
        }
    }
    
    getDistanceToTarget() {
        if (!this.target) return Infinity;
        return Phaser.Math.Distance.Between(
            this.x, this.y,
            this.target.x, this.target.y
        );
    }
    
    handleSpecialPattern(distance) {
        if (!this.aggressive && distance > this.detectionRange) {
            this.setVelocity(0, 0);
            return;
        }
        
        switch(this.pattern) {
            case 'zigzag':
                this.handleZigzagPattern();
                break;
            case 'circle':
                this.handleCirclePattern();
                break;
            case 'charge':
                this.handleChargePattern();
                break;
            case 'sniper':
                this.handleSniperPattern();
                break;
            case 'kamikaze':
                this.handleKamikazePattern();
                break;
            case 'teleport':
                this.handleTeleportPattern();
                break;
            case 'splitter':
                this.handleSplitterPattern();
                break;
        }
    }
    
    handleZigzagPattern() {
        if (!this.target) return;
        
        const angle = Phaser.Math.Angle.Between(
            this.x, this.y,
            this.target.x, this.target.y
        );
        
        this.zigzagTimer += 0.1;
        const zigzagOffset = Math.sin(this.zigzagTimer * 5) * 1.5;
        
        const velocityX = Math.cos(angle) * this.speed + Math.cos(angle + Math.PI/2) * zigzagOffset * 50;
        const velocityY = Math.sin(angle) * this.speed + Math.sin(angle + Math.PI/2) * zigzagOffset * 50;
        
        this.setVelocity(velocityX, velocityY);
        this.setRotation(0);
    }
    
    handleCirclePattern() {
        if (!this.target) return;
        
        const idealDistance = 200;
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            this.target.x, this.target.y
        );
        
        this.circleAngle += 0.05;
        
        const targetX = this.target.x + Math.cos(this.circleAngle) * idealDistance;
        const targetY = this.target.y + Math.sin(this.circleAngle) * idealDistance;
        
        const angle = Phaser.Math.Angle.Between(
            this.x, this.y,
            targetX, targetY
        );
        
        this.setVelocity(
            Math.cos(angle) * this.speed,
            Math.sin(angle) * this.speed
        );
        this.setRotation(0);
    }
    
    handleChargePattern() {
        if (!this.target) return;
        
        const now = this.scene.time.now;
        
        if (!this.isCharging) {
            if (now - this.chargeTimer > 2000) {
                this.isCharging = true;
                this.chargeTarget = { x: this.target.x, y: this.target.y };
                this.chargeTimer = now;
                
                this.setTint(0xff0000);
                this.scene.time.delayedCall(300, () => {
                    this.setTint(this.tint || 0xffffff);
                });
            } else {
                const angle = Phaser.Math.Angle.Between(
                    this.x, this.y,
                    this.target.x, this.target.y
                );
                this.setVelocity(
                    Math.cos(angle) * this.speed * 0.5,
                    Math.sin(angle) * this.speed * 0.5
                );
            }
        } else {
            if (this.chargeTarget) {
                const angle = Phaser.Math.Angle.Between(
                    this.x, this.y,
                    this.chargeTarget.x, this.chargeTarget.y
                );
                this.setVelocity(
                    Math.cos(angle) * this.speed * 2,
                    Math.sin(angle) * this.speed * 2
                );
                
                const distance = Phaser.Math.Distance.Between(
                    this.x, this.y,
                    this.chargeTarget.x, this.chargeTarget.y
                );
                
                if (distance < 30 || now - this.chargeTimer > 1000) {
                    this.isCharging = false;
                    this.chargeTimer = now;
                    this.chargeTarget = null;
                }
            }
        }
        
        this.setRotation(0);
    }
    
    handleSniperPattern() {
        if (!this.target) return;
        
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            this.target.x, this.target.y
        );
        
        if (distance < 300) {
            const angle = Phaser.Math.Angle.Between(
                this.target.x, this.target.y,
                this.x, this.y
            );
            this.setVelocity(
                Math.cos(angle) * this.speed,
                Math.sin(angle) * this.speed
            );
        } else if (distance > 350) {
            const angle = Phaser.Math.Angle.Between(
                this.x, this.y,
                this.target.x, this.target.y
            );
            this.setVelocity(
                Math.cos(angle) * this.speed * 0.5,
                Math.sin(angle) * this.speed * 0.5
            );
        } else {
            this.setVelocity(0, 0);
        }
        
        this.setRotation(0);
    }
    
    handleKamikazePattern() {
        if (!this.target) return;
        
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            this.target.x, this.target.y
        );
        
        // 자폭 공격 - 매우 빠르게 접근
        const angle = Phaser.Math.Angle.Between(
            this.x, this.y,
            this.target.x, this.target.y
        );
        
        this.setVelocity(
            Math.cos(angle) * this.speed,
            Math.sin(angle) * this.speed
        );
        
        // 가까이 왔을 때 폭발
        if (distance < 30 && !this.isExploding) {
            this.isExploding = true;
            this.explode();
        }
        
        // 빨간색 깜빡임
        if (Math.floor(this.scene.time.now / 200) % 2 === 0) {
            this.setTint(0xff0000);
        } else {
            this.setTint(0xffff00);
        }
        
        this.setRotation(0);
    }
    
    handleTeleportPattern() {
        if (!this.target) return;
        
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            this.target.x, this.target.y
        );
        
        const now = this.scene.time.now;
        
        // 3초마다 순간이동
        if (!this.lastTeleport) this.lastTeleport = now;
        
        if (now - this.lastTeleport > 3000) {
            // 순간이동 이펙트
            const flash = this.scene.add.circle(this.x, this.y, 30, 0x9900ff, 0.5);
            this.scene.tweens.add({
                targets: flash,
                scale: 2,
                alpha: 0,
                duration: 300,
                onComplete: () => flash.destroy()
            });
            
            // 플레이어 근처로 순간이동
            const angle = Math.random() * Math.PI * 2;
            const dist = 150 + Math.random() * 100;
            this.x = this.target.x + Math.cos(angle) * dist;
            this.y = this.target.y + Math.sin(angle) * dist;
            
            this.lastTeleport = now;
            
            // 도착 이펙트
            const arrivalFlash = this.scene.add.circle(this.x, this.y, 30, 0x9900ff, 0.8);
            this.scene.tweens.add({
                targets: arrivalFlash,
                scale: 0.5,
                alpha: 0,
                duration: 300,
                onComplete: () => arrivalFlash.destroy()
            });
        } else {
            // 일반 이동
            const angle = Phaser.Math.Angle.Between(
                this.x, this.y,
                this.target.x, this.target.y
            );
            this.setVelocity(
                Math.cos(angle) * this.speed,
                Math.sin(angle) * this.speed
            );
        }
        
        this.setRotation(0);
    }
    
    handleSplitterPattern() {
        if (!this.target) return;
        
        // 일반 추격
        const angle = Phaser.Math.Angle.Between(
            this.x, this.y,
            this.target.x, this.target.y
        );
        
        this.setVelocity(
            Math.cos(angle) * this.speed,
            Math.sin(angle) * this.speed
        );
        
        this.setRotation(0);
    }
    
    explode() {
        // 자폭 폭발
        if (this.scene && this.scene.events) {
            this.scene.events.emit('explosion', {
                x: this.x,
                y: this.y,
                damage: this.damage * 2,
                radius: 100
            });
        }
        
        // 폭발 이펙트 (안전 체크)
        if (this.scene && this.scene.add && this.scene.tweens) {
            const explosion = this.scene.add.circle(this.x, this.y, 20, 0xff0000);
            this.scene.tweens.add({
                targets: explosion,
                scale: 5,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    if (explosion && explosion.destroy) {
                        explosion.destroy();
                    }
                }
            });
        }
        
        this.die();
    }
    
    split() {
        // 분열 - 죽을 때 작은 적 2개 생성
        if (this.scene && this.scene.enemies && !this.hasSplit) {
            this.hasSplit = true;
            
            for (let i = 0; i < 2; i++) {
                const angle = (Math.PI * 2 / 2) * i;
                const x = this.x + Math.cos(angle) * 30;
                const y = this.y + Math.sin(angle) * 30;
                
                const mini = new PixelEnemy(this.scene, x, y, 'fast');
                mini.setScale(0.6);
                mini.health = 20;
                mini.maxHealth = 20;
                mini.damage = 5;
                
                if (this.scene.enemies) {
                    this.scene.enemies.add(mini);
                }
            }
        }
    }
}