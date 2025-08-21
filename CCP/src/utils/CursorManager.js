export default class CursorManager {
    constructor(scene) {
        this.scene = scene;
        this.currentCursor = null;
        this.cursorSprite = null;
        this.reloadGauge = null;
        this.reloadGaugeBg = null;
        this.reloadGaugeFill = null;
        this.createCursors();
    }

    createCursors() {
        // 커서 텍스처 생성
        this.createCursorTextures();
        
        // 커서 스프라이트 생성
        this.cursorSprite = this.scene.add.image(0, 0, 'cursor_default');
        this.cursorSprite.setScrollFactor(0);
        this.cursorSprite.setDepth(9999);
        this.cursorSprite.setOrigin(0.5);
        
        // 기본 커서 숨기기
        this.scene.input.setDefaultCursor('none');
        
        // 커서 이동 이벤트
        this.scene.input.on('pointermove', (pointer) => {
            this.cursorSprite.x = pointer.x;
            this.cursorSprite.y = pointer.y;
            
            // 재장전 게이지 위치 업데이트
            if (this.reloadGaugeBg && this.reloadGaugeBg.visible) {
                this.reloadGaugeBg.x = pointer.x;
                this.reloadGaugeBg.y = pointer.y + 30;
                this.reloadGaugeFill.x = pointer.x - 24;
                this.reloadGaugeFill.y = pointer.y + 30;
            }
        });
    }

    createCursorTextures() {
        // 기본 조준점
        this.createPixelTexture('cursor_default', 32, 32, (ctx) => {
            // 십자선
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            // 가로선
            ctx.beginPath();
            ctx.moveTo(8, 16);
            ctx.lineTo(12, 16);
            ctx.moveTo(20, 16);
            ctx.lineTo(24, 16);
            ctx.stroke();
            // 세로선
            ctx.beginPath();
            ctx.moveTo(16, 8);
            ctx.lineTo(16, 12);
            ctx.moveTo(16, 20);
            ctx.lineTo(16, 24);
            ctx.stroke();
            // 중앙 점
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(15, 15, 2, 2);
        });

        // 권총 조준점
        this.createPixelTexture('cursor_pistol', 32, 32, (ctx) => {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(14, 14, 4, 4);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(15, 15, 2, 2);
        });

        // SMG 조준점 (분산된 십자)
        this.createPixelTexture('cursor_smg', 32, 32, (ctx) => {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 1;
            // 확산된 십자선
            ctx.beginPath();
            ctx.moveTo(4, 16);
            ctx.lineTo(10, 16);
            ctx.moveTo(22, 16);
            ctx.lineTo(28, 16);
            ctx.moveTo(16, 4);
            ctx.lineTo(16, 10);
            ctx.moveTo(16, 22);
            ctx.lineTo(16, 28);
            ctx.stroke();
            // 중앙 원
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(16, 16, 3, 0, Math.PI * 2);
            ctx.stroke();
        });

        // 샷건 조준점 (원형 산탄)
        this.createPixelTexture('cursor_shotgun', 40, 40, (ctx) => {
            ctx.strokeStyle = '#ff9900';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(20, 20, 12, 0, Math.PI * 2);
            ctx.stroke();
            // 산탄 표시
            ctx.fillStyle = '#ffcc00';
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i;
                const x = 20 + Math.cos(angle) * 8;
                const y = 20 + Math.sin(angle) * 8;
                ctx.fillRect(x - 1, y - 1, 2, 2);
            }
        });

        // 저격총 조준점 (정밀 스코프)
        this.createPixelTexture('cursor_sniper', 48, 48, (ctx) => {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 1;
            // 외곽 원
            ctx.beginPath();
            ctx.arc(24, 24, 20, 0, Math.PI * 2);
            ctx.stroke();
            // 십자선
            ctx.beginPath();
            ctx.moveTo(4, 24);
            ctx.lineTo(44, 24);
            ctx.moveTo(24, 4);
            ctx.lineTo(24, 44);
            ctx.stroke();
            // 거리 표시
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(23, 14, 2, 2);
            ctx.fillRect(23, 32, 2, 2);
            // 중앙 점
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(23, 23, 2, 2);
        });

        // 레일건 조준점 (충전 게이지 포함)
        this.createPixelTexture('cursor_railgun', 40, 40, (ctx) => {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            // 다이아몬드 모양
            ctx.beginPath();
            ctx.moveTo(20, 8);
            ctx.lineTo(32, 20);
            ctx.lineTo(20, 32);
            ctx.lineTo(8, 20);
            ctx.closePath();
            ctx.stroke();
            // 에너지 코어
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(18, 18, 4, 4);
        });

        // 마법봉 조준점 (별 모양)
        this.createPixelTexture('cursor_wand', 32, 32, (ctx) => {
            ctx.fillStyle = '#ff00ff';
            // 별 그리기
            const drawStar = (cx, cy, size) => {
                ctx.beginPath();
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI * 2 / 10) * i;
                    const radius = i % 2 === 0 ? size : size / 2;
                    const x = cx + Math.cos(angle - Math.PI / 2) * radius;
                    const y = cy + Math.sin(angle - Math.PI / 2) * radius;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
            };
            drawStar(16, 16, 8);
            // 중앙 빛
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(15, 15, 2, 2);
        });

        // 활 조준점 (화살표)
        this.createPixelTexture('cursor_bow', 32, 32, (ctx) => {
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 2;
            // 활 모양
            ctx.beginPath();
            ctx.arc(8, 16, 12, -Math.PI/3, Math.PI/3);
            ctx.stroke();
            // 화살
            ctx.fillStyle = '#cd853f';
            ctx.fillRect(16, 15, 12, 2);
            // 화살촉
            ctx.fillStyle = '#888888';
            ctx.beginPath();
            ctx.moveTo(28, 16);
            ctx.lineTo(32, 14);
            ctx.lineTo(32, 18);
            ctx.closePath();
            ctx.fill();
        });

        // 로켓 조준점 (타겟 락온)
        this.createPixelTexture('cursor_rocket', 40, 40, (ctx) => {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            // 사각 타겟
            ctx.strokeRect(12, 12, 16, 16);
            // 코너 마커
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(10, 10, 4, 4);
            ctx.fillRect(26, 10, 4, 4);
            ctx.fillRect(10, 26, 4, 4);
            ctx.fillRect(26, 26, 4, 4);
            // 중앙 X
            ctx.beginPath();
            ctx.moveTo(18, 18);
            ctx.lineTo(22, 22);
            ctx.moveTo(22, 18);
            ctx.lineTo(18, 22);
            ctx.stroke();
        });

        // 유탄 조준점 (포물선 표시)
        this.createPixelTexture('cursor_grenade', 36, 36, (ctx) => {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            // 착탄 지점 원
            ctx.beginPath();
            ctx.arc(18, 18, 10, 0, Math.PI * 2);
            ctx.stroke();
            // 포물선 힌트
            ctx.strokeStyle = '#00ff0080';
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(4, 18);
            ctx.quadraticCurveTo(18, 8, 32, 18);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // 무전기 조준점 (위성 표시)
        this.createPixelTexture('cursor_radio', 40, 40, (ctx) => {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            // 신호 전파
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(20, 20, 6 + i * 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 0.5 - i * 0.15;
            }
            ctx.globalAlpha = 1;
            // 중앙 점
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(19, 19, 2, 2);
        });
    }

    createPixelTexture(key, width, height, drawFunc) {
        // 텍스처가 이미 존재하면 스킵
        if (this.scene.textures.exists(key)) {
            return;
        }
        
        const texture = this.scene.textures.createCanvas(key, width, height);
        const canvas = texture.getSourceImage();
        if (!canvas) {
            console.warn(`Failed to create texture: ${key}`);
            return;
        }
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        drawFunc(context);
        texture.refresh();
    }

    setCursorForWeapon(weaponType) {
        const cursorMap = {
            'pistol': 'cursor_pistol',
            'smg': 'cursor_smg',
            'shotgun': 'cursor_shotgun',
            'rifle': 'cursor_default',
            'sniper': 'cursor_sniper',
            'machinegun': 'cursor_smg',
            'chaingun': 'cursor_smg',
            'grenade': 'cursor_grenade',
            'mortar': 'cursor_grenade',
            'rocket': 'cursor_rocket',
            'railgun': 'cursor_railgun',
            'staff': 'cursor_wand',
            'wand': 'cursor_wand',
            'bow': 'cursor_bow',
            'crossbow': 'cursor_bow',
            'radio': 'cursor_radio'
        };

        const cursorTexture = cursorMap[weaponType] || 'cursor_default';
        
        if (this.cursorSprite) {
            this.cursorSprite.setTexture(cursorTexture);
            
            // 저격총일 때 크기 확대
            if (weaponType === 'sniper') {
                this.cursorSprite.setScale(1.5);
            } else {
                this.cursorSprite.setScale(1);
            }
        }
    }

    createReloadGauge() {
        // 재장전 게이지 배경
        this.reloadGaugeBg = this.scene.add.rectangle(0, 0, 50, 6, 0x000000, 0.7);
        this.reloadGaugeBg.setStrokeStyle(1, 0xffffff);
        this.reloadGaugeBg.setScrollFactor(0);
        this.reloadGaugeBg.setDepth(9998);
        this.reloadGaugeBg.setVisible(false);
        
        // 재장전 게이지 채우기
        this.reloadGaugeFill = this.scene.add.rectangle(0, 0, 0, 4, 0x00ff00);
        this.reloadGaugeFill.setScrollFactor(0);
        this.reloadGaugeFill.setDepth(9998);
        this.reloadGaugeFill.setOrigin(0, 0.5);
        this.reloadGaugeFill.setVisible(false);
    }

    showReloadGauge(duration) {
        if (!this.reloadGaugeBg) {
            this.createReloadGauge();
        }
        
        const pointer = this.scene.input.activePointer;
        this.reloadGaugeBg.x = pointer.x;
        this.reloadGaugeBg.y = pointer.y + 30;
        this.reloadGaugeFill.x = pointer.x - 24;
        this.reloadGaugeFill.y = pointer.y + 30;
        
        this.reloadGaugeBg.setVisible(true);
        this.reloadGaugeFill.setVisible(true);
        this.reloadGaugeFill.width = 0;
        
        // 애니메이션
        this.scene.tweens.add({
            targets: this.reloadGaugeFill,
            width: 48,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                this.hideReloadGauge();
            }
        });
        
        // 재장전 텍스트
        const reloadText = this.scene.add.text(pointer.x, pointer.y + 45, 'RELOAD', {
            fontSize: '10px',
            color: '#ffffff',
            fontFamily: 'monospace'
        });
        reloadText.setOrigin(0.5);
        reloadText.setScrollFactor(0);
        reloadText.setDepth(9998);
        
        this.scene.time.delayedCall(duration, () => {
            reloadText.destroy();
        });
    }

    hideReloadGauge() {
        if (this.reloadGaugeBg) {
            this.reloadGaugeBg.setVisible(false);
            this.reloadGaugeFill.setVisible(false);
        }
    }

    updateChargeLevel(level) {
        // 차징 무기의 경우 커서 색상 변경
        if (this.cursorSprite && level > 0) {
            const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                { r: 255, g: 255, b: 255 },
                { r: 255, g: 0, b: 0 },
                100,
                level * 100
            );
            this.cursorSprite.setTint(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
        } else if (this.cursorSprite) {
            this.cursorSprite.clearTint();
        }
    }

    resetCursor() {
        // 커서를 기본 상태로 리셋
        if (this.cursorSprite) {
            this.cursorSprite.setTexture('cursor_default');
            this.cursorSprite.clearTint();
            this.cursorSprite.setScale(1);
            this.cursorSprite.setVisible(false); // 게임오버 시 숨김
        }
        
        // 재장전 게이지 숨기기
        if (this.reloadGaugeBg) {
            this.reloadGaugeBg.setVisible(false);
        }
        if (this.reloadGaugeFill) {
            this.reloadGaugeFill.setVisible(false);
        }
        
        // 기본 커서 보이기
        this.scene.input.setDefaultCursor('auto');
    }
    
    destroy() {
        if (this.cursorSprite) {
            this.cursorSprite.destroy();
        }
        if (this.reloadGaugeBg) {
            this.reloadGaugeBg.destroy();
        }
        if (this.reloadGaugeFill) {
            this.reloadGaugeFill.destroy();
        }
    }
}