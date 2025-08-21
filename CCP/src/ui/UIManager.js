export default class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.elements = {};
        this.createUI();
    }
    
    createUI() {
        // HP 바 컨테이너
        this.createHealthBar();
        
        // 점수 표시
        this.createScoreDisplay();
        
        // 타이머
        this.createTimer();
        
        // 웨이브 정보
        this.createWaveDisplay();
        
        // 무기 정보
        this.createWeaponInfo();
        
        // 미니맵
        this.createMinimap();
        
        // 보스 체력바
        this.createBossHealthBar();
    }
    
    createHealthBar() {
        const x = 250;  // 왼쪽에서 250픽셀 (오른쪽으로 50px)
        const y = 150;  // 위에서 150픽셀 (위로 50px)
        const width = 250;  // 너비 줄임
        const height = 35;   // 높이 줄임
        
        // 체력바 배경
        this.elements.healthBarBg = this.scene.add.graphics();
        this.elements.healthBarBg.fillStyle(0x000000, 0.9);  // 더 진하게
        this.elements.healthBarBg.fillRoundedRect(x, y, width, height, 5);
        this.elements.healthBarBg.lineStyle(3, 0xffffff);  // 더 굵고 밝은 테두리
        this.elements.healthBarBg.strokeRoundedRect(x, y, width, height, 5);
        this.elements.healthBarBg.setScrollFactor(0);
        this.elements.healthBarBg.setDepth(10000);  // 더 높은 depth
        
        // 체력바
        this.elements.healthBar = this.scene.add.graphics();
        this.elements.healthBar.setScrollFactor(0);
        this.elements.healthBar.setDepth(10001);  // 더 높은 depth
        
        // 체력 텍스트
        this.elements.healthText = this.scene.add.text(x + width/2, y + height/2, '100/100', {
            fontSize: '20px',  // 크기 조정
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        this.elements.healthText.setScrollFactor(0);
        this.elements.healthText.setDepth(10002);  // 더 높은 depth
        
        // HP 아이콘
        const hpIcon = this.scene.add.text(x + 10, y + height/2, '❤', {
            fontSize: '24px',  // 크기 조정
            color: '#ff0000'
        }).setOrigin(0, 0.5);
        hpIcon.setScrollFactor(0);
        hpIcon.setDepth(10002);  // 더 높은 depth
        
        // HP 라벨
        const hpLabel = this.scene.add.text(x + 35, y + height/2 - 10, 'HP', {
            fontSize: '14px',  // 크기 조정
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        hpLabel.setScrollFactor(0);
        hpLabel.setDepth(10002);  // 더 높은 depth
    }
    
    createScoreDisplay() {
        // 점수 배경
        const scoreBg = this.scene.add.graphics();
        scoreBg.fillStyle(0x000000, 0.5);
        scoreBg.fillRoundedRect(250, 195, 150, 30, 5);  // HP 바 아래 배치
        scoreBg.setScrollFactor(0);
        scoreBg.setDepth(10000);  // 더 높은 depth
        
        // 점수 텍스트
        this.elements.scoreText = this.scene.add.text(260, 210, 'SCORE: 0', {  // 위치 조정
            fontSize: '16px',  // 크기 조정
            color: '#ffff00',
            fontFamily: 'monospace',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        this.elements.scoreText.setScrollFactor(0);
        this.elements.scoreText.setDepth(10001);  // 더 높은 depth
    }
    
    createTimer() {
        // 타이머 배경
        const timerBg = this.scene.add.graphics();
        timerBg.fillStyle(0x000000, 0.6);
        timerBg.fillRoundedRect(540, 150, 200, 40, 10);  // 화면 중앙 (위로 50px)
        timerBg.lineStyle(3, 0x00ff00);
        timerBg.strokeRoundedRect(540, 150, 200, 40, 10);  // 화면 중앙
        timerBg.setScrollFactor(0);
        timerBg.setDepth(10000);
        
        // 타이머 텍스트
        this.elements.timerText = this.scene.add.text(640, 170, '00:00', {  // 위치 조정
            fontSize: '24px',  // 크기 조정
            color: '#00ff00',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.elements.timerText.setScrollFactor(0);
        this.elements.timerText.setDepth(10001);
    }
    
    createWaveDisplay() {
        // 웨이브 배경
        const waveBg = this.scene.add.graphics();
        waveBg.fillStyle(0x000000, 0.5);
        waveBg.fillRoundedRect(540, 195, 200, 30, 5);  // 타이머 아래
        waveBg.setScrollFactor(0);
        waveBg.setDepth(10000);
        
        // 웨이브 텍스트
        this.elements.waveText = this.scene.add.text(640, 210, 'WAVE 1', {  // 위치 조정
            fontSize: '16px',  // 크기 조정
            color: '#ff9900',
            fontFamily: 'monospace',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.elements.waveText.setScrollFactor(0);
        this.elements.waveText.setDepth(10001);
    }
    
    createWeaponInfo() {
        const x = 250;  // 왼쪽에서 250픽셀 (오른쪽으로 50px)
        const bottomY = 480;  // 하단 쪽 (위로 20px)
        
        // 무기 정보 배경 (크기 절반)
        const weaponBg = this.scene.add.graphics();
        weaponBg.fillStyle(0x000000, 0.8);
        weaponBg.fillRoundedRect(x, bottomY, 140, 50, 5);  // 크기 절반으로 축소
        weaponBg.lineStyle(2, 0x00ff00);  // 녹색 테두리
        weaponBg.strokeRoundedRect(x, bottomY, 140, 50, 5);
        weaponBg.setScrollFactor(0);
        weaponBg.setDepth(10000);
        
        // 무기 이름
        this.elements.weaponText = this.scene.add.text(x + 5, bottomY + 5, 'PISTOL', {
            fontSize: '12px',  // 폰트 크기 축소
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold'
        });
        this.elements.weaponText.setScrollFactor(0);
        this.elements.weaponText.setDepth(10001);
        
        // 탄약 표시
        this.elements.ammoText = this.scene.add.text(x + 5, bottomY + 20, '12 / 12', {
            fontSize: '16px',  // 폰트 크기 축소
            color: '#ffff00',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.elements.ammoText.setScrollFactor(0);
        this.elements.ammoText.setDepth(10001);
        
        // 탄약 아이콘
        const ammoIcon = this.scene.add.text(x + 100, bottomY + 20, '🔫', {
            fontSize: '14px'  // 폰트 크기 축소
        });
        ammoIcon.setScrollFactor(0);
        ammoIcon.setDepth(10001);
        
        // 무기 레벨
        this.elements.weaponLevelText = this.scene.add.text(x + 5, bottomY + 35, 'LV.1', {
            fontSize: '10px',  // 폰트 크기 축소
            color: '#00ffff',
            fontFamily: 'monospace'
        });
        this.elements.weaponLevelText.setScrollFactor(0);
        this.elements.weaponLevelText.setDepth(10001);
        
        // 무기 업그레이드 상태
        this.elements.upgradeText = this.scene.add.text(x + 40, bottomY + 35, '', {
            fontSize: '10px',  // 폰트 크기 축소
            color: '#ff00ff',
            fontFamily: 'monospace'
        });
        this.elements.upgradeText.setScrollFactor(0);
        this.elements.upgradeText.setDepth(10001);
        
        // 재장전 바
        this.elements.reloadBarBg = this.scene.add.graphics();
        this.elements.reloadBarBg.fillStyle(0x333333, 0.5);
        this.elements.reloadBarBg.fillRect(x + 5, bottomY + 42, 130, 5);  // 크기와 위치 조정
        this.elements.reloadBarBg.setScrollFactor(0);
        this.elements.reloadBarBg.setDepth(10001);
        this.elements.reloadBarBg.setVisible(false);
        
        this.elements.reloadBar = this.scene.add.graphics();
        this.elements.reloadBar.setScrollFactor(0);
        this.elements.reloadBar.setDepth(10002);
        this.elements.reloadBar.setVisible(false);
        
        // 재장전 텍스트
        this.elements.reloadText = this.scene.add.text(x + 80, bottomY + 10, 'RELOAD', {
            fontSize: '10px',  // 폰트 크기 축소
            color: '#ff0000',
            fontFamily: 'monospace',
            fontStyle: 'bold'
        });
        this.elements.reloadText.setScrollFactor(0);
        this.elements.reloadText.setDepth(10002);
        this.elements.reloadText.setVisible(false);
    }
    
    createMinimap() {
        const size = 100;  // 크기
        const x = 950;  // 오른쪽으로 50px 더 이동
        const y = 150;  // 화면 위에서 150픽셀 (위로 50px)
        
        // 미니맵 배경
        this.elements.minimapBg = this.scene.add.graphics();
        this.elements.minimapBg.fillStyle(0x000000, 0.7);
        this.elements.minimapBg.fillRect(x, y, size, size);
        this.elements.minimapBg.lineStyle(2, 0x333333);
        this.elements.minimapBg.strokeRect(x, y, size, size);
        this.elements.minimapBg.setScrollFactor(0);
        this.elements.minimapBg.setDepth(10000);
        
        // 미니맵 컨테이너
        this.elements.minimap = this.scene.add.container(x, y);
        this.elements.minimap.setScrollFactor(0);
        this.elements.minimap.setDepth(10001);
        
        // 플레이어 위치 표시
        this.elements.minimapPlayer = this.scene.add.circle(50, 50, 3, 0x00ff00);  // size/2 = 50
        this.elements.minimap.add(this.elements.minimapPlayer);
        
        // 적 위치들을 담을 배열
        this.minimapEnemies = [];
    }
    
    createBossHealthBar() {
        // 보스 체력바 (초기엔 숨김) - 크기 1/4로 축소
        const width = 150;  // 600 -> 150
        const height = 20;  // 40 -> 20
        const x = 640 - width/2;  // 화면 중앙
        const y = 100;  // 화면 상단 쪽으로
        
        this.elements.bossHealthContainer = this.scene.add.container(x, y);
        this.elements.bossHealthContainer.setScrollFactor(0);
        this.elements.bossHealthContainer.setDepth(10000);
        this.elements.bossHealthContainer.setVisible(false);
        
        // 배경
        const bossBg = this.scene.add.graphics();
        bossBg.fillStyle(0x000000, 0.8);
        bossBg.fillRoundedRect(0, 0, width, height, 3);
        bossBg.lineStyle(1, 0xff0000);  // 테두리 두께 감소
        bossBg.strokeRoundedRect(0, 0, width, height, 3);
        this.elements.bossHealthContainer.add(bossBg);
        
        // 체력바
        this.elements.bossHealthBar = this.scene.add.graphics();
        this.elements.bossHealthContainer.add(this.elements.bossHealthBar);
        
        // 보스 이름
        this.elements.bossNameText = this.scene.add.text(width/2, -8, 'BOSS', {
            fontSize: '12px',  // 폰트 크기 1/2로
            color: '#ff0000',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5);
        this.elements.bossHealthContainer.add(this.elements.bossNameText);
    }
    
    updateHealth(current, max) {
        // 안전성 체크
        if (!this.elements.healthBar || !this.elements.healthText) return;
        if (isNaN(current) || isNaN(max)) return;
        
        const width = 240;  // HP바 크기에 맞춤
        const height = 30;  // HP바 높이에 맞춤
        const x = 255;  // HP바 위치에 맞춤 (오른쪽으로 50px)
        const y = 155;  // HP바 위치에 맞춤 (위로 50px)
        
        // 안전한 값 계산
        current = Math.max(0, current);
        max = Math.max(1, max);
        const healthPercent = Math.min(1, Math.max(0, current / max));
        
        this.elements.healthBar.clear();
        
        // 체력에 따른 색상 변경
        let color = 0x00ff00;
        if (healthPercent < 0.3) color = 0xff0000;
        else if (healthPercent < 0.6) color = 0xffaa00;
        
        this.elements.healthBar.fillStyle(color, 1);
        this.elements.healthBar.fillRoundedRect(x, y, width * healthPercent, height, 3);
        
        this.elements.healthText.setText(`${Math.floor(current)}/${max}`);
    }
    
    updateScore(score) {
        this.elements.scoreText.setText(`SCORE: ${score}`);
    }
    
    updateTimer(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const timeString = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        this.elements.timerText.setText(timeString);
        
        // 탈출 단계에서 색상 변경
        if (seconds >= 600) {
            this.elements.timerText.setColor('#ff0000');
            this.elements.timerText.setScale(1 + Math.sin(seconds * 5) * 0.1);
        }
    }
    
    updateWave(waveNumber) {
        this.elements.waveText.setText(`WAVE ${waveNumber}`);
        
        // 웨이브 변경 애니메이션
        this.scene.tweens.add({
            targets: this.elements.waveText,
            scale: 1.5,
            duration: 300,
            yoyo: true,
            ease: 'Power2'
        });
    }
    
    updateWeaponInfo(weapon) {
        if (!weapon) return;
        
        // 무기 이름 (한글)
        this.elements.weaponText.setText(weapon.stats.name || weapon.type.toUpperCase());
        
        // 탄약 표시
        if (weapon.stats.special?.manaRegen) {
            this.elements.ammoText.setText(`∞`);
            this.elements.ammoText.setColor('#00ffff');
        } else {
            this.elements.ammoText.setText(`${weapon.currentAmmo} / ${weapon.stats.magazineSize}`);
            const ammoPercent = weapon.currentAmmo / weapon.stats.magazineSize;
            if (ammoPercent <= 0.2) {
                this.elements.ammoText.setColor('#ff0000');
            } else if (ammoPercent <= 0.5) {
                this.elements.ammoText.setColor('#ffaa00');
            } else {
                this.elements.ammoText.setColor('#ffff00');
            }
        }
        
        // 무기 레벨
        this.elements.weaponLevelText.setText(`LV.${weapon.level}`);
        
        // 업그레이드 상태 표시
        if (weapon.upgrades) {
            const upgradeInfo = [];
            if (weapon.upgrades.damage > 0) upgradeInfo.push(`DMG+${weapon.upgrades.damage}`);
            if (weapon.upgrades.fireRate > 0) upgradeInfo.push(`SPD+${weapon.upgrades.fireRate}`);
            if (weapon.upgrades.reload > 0) upgradeInfo.push(`RLD+${weapon.upgrades.reload}`);
            this.elements.upgradeText.setText(upgradeInfo.join(' '));
        }
    }
    
    showReloadBar(duration) {
        this.elements.reloadBarBg.setVisible(true);
        this.elements.reloadBar.setVisible(true);
        this.elements.reloadText.setVisible(true);
        
        const x = 255;
        const bottomY = 480;  // createWeaponInfo와 동일
        const width = 130;  // 크기 절반
        
        // 재장전 텍스트 깜빡임
        this.scene.tweens.add({
            targets: this.elements.reloadText,
            alpha: 0.3,
            duration: 200,
            yoyo: true,
            repeat: -1
        });
        
        // 재장전 애니메이션
        const reloadTween = this.scene.tweens.add({
            targets: { progress: 0 },
            progress: 1,
            duration: duration,
            onUpdate: (tween) => {
                const progress = tween.getValue();
                this.elements.reloadBar.clear();
                this.elements.reloadBar.fillStyle(0x00ff00, 1);
                this.elements.reloadBar.fillRect(x, bottomY + 85, width * progress, 10);
            },
            onComplete: () => {
                this.elements.reloadBarBg.setVisible(false);
                this.elements.reloadBar.setVisible(false);
                this.elements.reloadBar.clear();
                this.elements.reloadText.setVisible(false);
                this.scene.tweens.killTweensOf(this.elements.reloadText);
                this.elements.reloadText.setAlpha(1);
            }
        });
        
        // 재장전 취소 가능하도록 트윈 참조 저장
        this.currentReloadTween = reloadTween;
    }
    
    hideReloadBar() {
        if (this.currentReloadTween) {
            this.currentReloadTween.stop();
            this.currentReloadTween = null;
        }
        this.elements.reloadBarBg.setVisible(false);
        this.elements.reloadBar.setVisible(false);
        this.elements.reloadBar.clear();
        this.elements.reloadText.setVisible(false);
        this.scene.tweens.killTweensOf(this.elements.reloadText);
        this.elements.reloadText.setAlpha(1);
    }
    
    updateMinimap(player, enemies) {
        if (!player) return;
        
        const mapSize = 3000; // 맵 크기
        const minimapSize = 150;
        const scale = minimapSize / mapSize;
        
        // 플레이어 위치 업데이트
        this.elements.minimapPlayer.x = player.x * scale;
        this.elements.minimapPlayer.y = player.y * scale;
        
        // 기존 적 표시 제거
        this.minimapEnemies.forEach(dot => dot.destroy());
        this.minimapEnemies = [];
        
        // 새로운 적 위치 표시
        enemies.children.entries.forEach(enemy => {
            if (enemy.active) {
                const enemyDot = this.scene.add.circle(
                    enemy.x * scale,
                    enemy.y * scale,
                    2,
                    enemy.type === 'boss' ? 0xff00ff : 0xff0000
                );
                this.elements.minimap.add(enemyDot);
                this.minimapEnemies.push(enemyDot);
            }
        });
    }
    
    showBossHealth(boss) {
        this.elements.bossHealthContainer.setVisible(true);
        this.elements.bossNameText.setText(boss.type === 'boss' ? 'DESTROYER' : 'MINI BOSS');
        this.updateBossHealth(boss.health, boss.maxHealth);
    }
    
    hideBossHealth() {
        this.elements.bossHealthContainer.setVisible(false);
    }
    
    updateBossHealth(current, max) {
        const width = 145;  // 590 -> 145 (1/4 크기)
        const height = 15;  // 30 -> 15 (1/2 크기)
        const x = 2;  // 5 -> 2
        const y = 2;  // 5 -> 2
        
        const healthPercent = Math.max(0, current / max);
        
        this.elements.bossHealthBar.clear();
        this.elements.bossHealthBar.fillStyle(0xff0000, 1);
        this.elements.bossHealthBar.fillRect(x, y, width * healthPercent, height);
        
        // 체력 구간 표시
        this.elements.bossHealthBar.lineStyle(1, 0x000000, 0.5);
        for (let i = 1; i < 10; i++) {
            const lineX = x + (width / 10) * i;
            this.elements.bossHealthBar.moveTo(lineX, y);
            this.elements.bossHealthBar.lineTo(lineX, y + height);
        }
        this.elements.bossHealthBar.strokePath();
    }
    
    showEscapeAlert() {
        // 탈출 알림 애니메이션
        const escapeAlert = this.scene.add.text(640, 300, 'ESCAPE PHASE!', {
            fontSize: '48px',
            color: '#00ff00',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        escapeAlert.setScrollFactor(0);
        escapeAlert.setDepth(200);
        
        this.scene.tweens.add({
            targets: escapeAlert,
            scale: 1.5,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => escapeAlert.destroy()
        });
    }
}