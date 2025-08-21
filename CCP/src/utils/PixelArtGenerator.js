export class PixelArtGenerator {
    static createPixelTexture(scene, key, width, height, drawFunc) {
        const texture = scene.textures.createCanvas(key, width, height);
        const canvas = texture.getSourceImage();
        const context = canvas.getContext('2d');
        
        // 픽셀아트를 위한 설정
        context.imageSmoothingEnabled = false;
        drawFunc(context, width, height);
        
        texture.refresh();
        return texture;
    }

    static generateCharacterSprites(scene) {
        // 플레이어 (탑다운 뷰)
        this.createPixelTexture(scene, 'player_pixel', 32, 32, (ctx, w, h) => {
            // 몸통
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(10, 12, 12, 14);
            
            // 머리
            ctx.fillStyle = '#fdbcb4';
            ctx.fillRect(12, 6, 8, 8);
            
            // 헬멧
            ctx.fillStyle = '#2d5016';
            ctx.fillRect(11, 5, 10, 6);
            ctx.fillRect(10, 6, 12, 2);
            
            // 팔
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(6, 14, 4, 8);
            ctx.fillRect(22, 14, 4, 8);
            
            // 손
            ctx.fillStyle = '#fdbcb4';
            ctx.fillRect(6, 22, 4, 3);
            ctx.fillRect(22, 22, 4, 3);
            
            // 총
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(24, 16, 2, 8);
            ctx.fillRect(26, 18, 4, 2);
            
            // 다리
            ctx.fillStyle = '#2d3436';
            ctx.fillRect(11, 24, 4, 6);
            ctx.fillRect(17, 24, 4, 6);
        });

        // 기본 적
        this.createPixelTexture(scene, 'enemy_pixel', 32, 32, (ctx, w, h) => {
            // 몸통
            ctx.fillStyle = '#8b0000';
            ctx.fillRect(10, 10, 12, 12);
            
            // 머리
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(12, 6, 8, 8);
            
            // 눈
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(13, 8, 2, 2);
            ctx.fillRect(17, 8, 2, 2);
            
            // 팔
            ctx.fillStyle = '#8b0000';
            ctx.fillRect(6, 12, 4, 8);
            ctx.fillRect(22, 12, 4, 8);
            
            // 발톱
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(6, 20, 3, 2);
            ctx.fillRect(23, 20, 3, 2);
            
            // 다리
            ctx.fillStyle = '#660000';
            ctx.fillRect(11, 22, 4, 6);
            ctx.fillRect(17, 22, 4, 6);
        });

        // 방어형 적 (탱크)
        this.createPixelTexture(scene, 'enemy_tank_pixel', 40, 40, (ctx, w, h) => {
            // 갑옷
            ctx.fillStyle = '#1e3a8a';
            ctx.fillRect(8, 8, 24, 24);
            
            // 갑옷 디테일
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(10, 10, 20, 20);
            ctx.fillStyle = '#60a5fa';
            ctx.fillRect(12, 12, 16, 16);
            
            // 얼굴
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(16, 14, 8, 8);
            
            // 눈
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(17, 16, 2, 2);
            ctx.fillRect(21, 16, 2, 2);
            
            // 방패
            ctx.fillStyle = '#6b7280';
            ctx.fillRect(4, 12, 4, 16);
            ctx.fillRect(32, 12, 4, 16);
        });

        // 원거리 적
        this.createPixelTexture(scene, 'enemy_ranged_pixel', 32, 32, (ctx, w, h) => {
            // 몸통
            ctx.fillStyle = '#7c3aed';
            ctx.fillRect(11, 10, 10, 12);
            
            // 머리
            ctx.fillStyle = '#a855f7';
            ctx.fillRect(12, 6, 8, 8);
            
            // 눈 (스코프)
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(14, 8, 4, 2);
            
            // 팔과 활
            ctx.fillStyle = '#7c3aed';
            ctx.fillRect(6, 12, 4, 6);
            ctx.fillRect(22, 12, 4, 6);
            
            // 활
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(26, 16, 8, -Math.PI/2, Math.PI/2);
            ctx.stroke();
            
            // 화살
            ctx.fillStyle = '#cd853f';
            ctx.fillRect(18, 15, 12, 2);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(28, 14, 3, 4);
        });

        // 빠른 적
        this.createPixelTexture(scene, 'enemy_fast_pixel', 24, 24, (ctx, w, h) => {
            // 작고 날렵한 몸통
            ctx.fillStyle = '#00bfa5';
            ctx.fillRect(8, 8, 8, 10);
            
            // 머리
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(9, 4, 6, 6);
            
            // 날카로운 눈
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(10, 5, 1, 2);
            ctx.fillRect(13, 5, 1, 2);
            
            // 빠른 다리 (잔상 효과)
            ctx.fillStyle = '#00bfa560';
            ctx.fillRect(6, 16, 3, 4);
            ctx.fillRect(15, 16, 3, 4);
            ctx.fillStyle = '#00bfa5';
            ctx.fillRect(8, 17, 3, 4);
            ctx.fillRect(13, 17, 3, 4);
        });

        // 보스
        this.createPixelTexture(scene, 'enemy_boss_pixel', 64, 64, (ctx, w, h) => {
            // 거대한 몸통
            ctx.fillStyle = '#4a0e0e';
            ctx.fillRect(16, 20, 32, 32);
            
            // 갑옷 층
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(18, 22, 28, 28);
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(20, 24, 24, 24);
            
            // 머리
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(24, 12, 16, 16);
            
            // 뿔
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(22, 10, 3, 6);
            ctx.fillRect(39, 10, 3, 6);
            
            // 빛나는 눈
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(26, 16, 4, 3);
            ctx.fillRect(34, 16, 4, 3);
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(27, 17, 2, 1);
            ctx.fillRect(35, 17, 2, 1);
            
            // 거대한 팔
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(8, 24, 8, 20);
            ctx.fillRect(48, 24, 8, 20);
            
            // 주먹
            ctx.fillStyle = '#4a0e0e';
            ctx.fillRect(6, 42, 12, 8);
            ctx.fillRect(46, 42, 12, 8);
            
            // 다리
            ctx.fillStyle = '#4a0e0e';
            ctx.fillRect(22, 48, 8, 10);
            ctx.fillRect(34, 48, 8, 10);
        });
    }

    static generateBulletSprites(scene) {
        // 기본 총알
        this.createPixelTexture(scene, 'bullet_pixel', 8, 8, (ctx, w, h) => {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(2, 3, 4, 2);
            ctx.fillStyle = '#ff9900';
            ctx.fillRect(1, 3, 2, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(5, 3, 2, 2);
        });

        // 레이저
        this.createPixelTexture(scene, 'laser_pixel', 16, 4, (ctx, w, h) => {
            const gradient = ctx.createLinearGradient(0, 0, 16, 0);
            gradient.addColorStop(0, '#00ffff');
            gradient.addColorStop(0.5, '#ffffff');
            gradient.addColorStop(1, '#00ffff');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 1, 16, 2);
        });

        // 로켓
        this.createPixelTexture(scene, 'rocket_pixel', 16, 8, (ctx, w, h) => {
            // 탄두
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(12, 2, 4, 4);
            // 몸체
            ctx.fillStyle = '#666666';
            ctx.fillRect(4, 2, 8, 4);
            // 화염
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(0, 2, 4, 4);
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(0, 3, 2, 2);
        });

        // 화살
        this.createPixelTexture(scene, 'arrow_pixel', 16, 4, (ctx, w, h) => {
            // 화살촉
            ctx.fillStyle = '#888888';
            ctx.fillRect(13, 1, 3, 2);
            // 막대
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(3, 1, 10, 2);
            // 깃털
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, 3, 1);
            ctx.fillRect(0, 3, 3, 1);
        });

        // 마법 구체
        this.createPixelTexture(scene, 'magic_pixel', 12, 12, (ctx, w, h) => {
            // 외곽 빛
            ctx.fillStyle = '#ff00ff30';
            ctx.fillRect(2, 2, 8, 8);
            ctx.fillStyle = '#ff00ff60';
            ctx.fillRect(3, 3, 6, 6);
            // 중심
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(4, 4, 4, 4);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(5, 5, 2, 2);
        });
    }

    static generateTileSprites(scene) {
        // 바닥 타일
        this.createPixelTexture(scene, 'floor_tile', 32, 32, (ctx, w, h) => {
            ctx.fillStyle = '#3e3e3e';
            ctx.fillRect(0, 0, 32, 32);
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(1, 1, 30, 30);
            
            // 디테일
            ctx.fillStyle = '#525252';
            ctx.fillRect(4, 4, 2, 2);
            ctx.fillRect(26, 4, 2, 2);
            ctx.fillRect(4, 26, 2, 2);
            ctx.fillRect(26, 26, 2, 2);
        });

        // 벽 타일
        this.createPixelTexture(scene, 'wall_tile', 32, 32, (ctx, w, h) => {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, 32, 32);
            ctx.fillStyle = '#2d2d2d';
            ctx.fillRect(2, 2, 28, 28);
            
            // 벽돌 패턴
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 10, 32, 2);
            ctx.fillRect(0, 20, 32, 2);
            ctx.fillRect(10, 0, 2, 10);
            ctx.fillRect(20, 0, 2, 10);
            ctx.fillRect(5, 12, 2, 8);
            ctx.fillRect(15, 12, 2, 8);
            ctx.fillRect(25, 12, 2, 8);
            ctx.fillRect(10, 22, 2, 10);
            ctx.fillRect(20, 22, 2, 10);
        });

        // 특수 타일 (금속)
        this.createPixelTexture(scene, 'metal_tile', 32, 32, (ctx, w, h) => {
            ctx.fillStyle = '#71717a';
            ctx.fillRect(0, 0, 32, 32);
            
            // 금속 광택
            const gradient = ctx.createLinearGradient(0, 0, 32, 32);
            gradient.addColorStop(0, '#a1a1aa');
            gradient.addColorStop(0.5, '#71717a');
            gradient.addColorStop(1, '#52525b');
            ctx.fillStyle = gradient;
            ctx.fillRect(2, 2, 28, 28);
            
            // 볼트
            ctx.fillStyle = '#3f3f46';
            ctx.fillRect(4, 4, 3, 3);
            ctx.fillRect(25, 4, 3, 3);
            ctx.fillRect(4, 25, 3, 3);
            ctx.fillRect(25, 25, 3, 3);
        });
    }

    static generateEffectSprites(scene) {
        // 폭발 프레임들
        for (let i = 0; i < 4; i++) {
            const size = 16 + i * 8;
            this.createPixelTexture(scene, `explosion_${i}`, size, size, (ctx, w, h) => {
                const center = size / 2;
                const radius = size / 2 - 2;
                
                // 폭발 중심
                ctx.fillStyle = i < 2 ? '#ffffff' : '#ffff00';
                ctx.beginPath();
                ctx.arc(center, center, radius * (1 - i * 0.2), 0, Math.PI * 2);
                ctx.fill();
                
                // 외곽 불꽃
                ctx.fillStyle = i < 2 ? '#ff6600' : '#ff0000';
                ctx.beginPath();
                ctx.arc(center, center, radius, 0, Math.PI * 2);
                ctx.fill();
                
                // 파편
                if (i > 1) {
                    ctx.fillStyle = '#ff6600';
                    for (let j = 0; j < 8; j++) {
                        const angle = (Math.PI * 2 / 8) * j;
                        const px = center + Math.cos(angle) * radius * 1.2;
                        const py = center + Math.sin(angle) * radius * 1.2;
                        ctx.fillRect(px - 1, py - 1, 2, 2);
                    }
                }
            });
        }

        // 피격 효과
        this.createPixelTexture(scene, 'hit_effect', 16, 16, (ctx, w, h) => {
            ctx.fillStyle = '#ff000080';
            ctx.fillRect(6, 2, 4, 12);
            ctx.fillRect(2, 6, 12, 4);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(7, 7, 2, 2);
        });

        // 총구 화염
        this.createPixelTexture(scene, 'muzzle_flash', 16, 16, (ctx, w, h) => {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(0, 6, 8, 4);
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(8, 5, 6, 6);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(4, 7, 4, 2);
        });
    }

    static generateUIElements(scene) {
        // 체력바 배경
        this.createPixelTexture(scene, 'healthbar_bg', 100, 12, (ctx, w, h) => {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, 100, 12);
            ctx.fillStyle = '#2d2d2d';
            ctx.fillRect(1, 1, 98, 10);
        });

        // 체력바
        this.createPixelTexture(scene, 'healthbar_fill', 96, 8, (ctx, w, h) => {
            const gradient = ctx.createLinearGradient(0, 0, 96, 0);
            gradient.addColorStop(0, '#22c55e');
            gradient.addColorStop(0.5, '#16a34a');
            gradient.addColorStop(1, '#22c55e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 96, 8);
        });

        // 탄약 아이콘
        this.createPixelTexture(scene, 'ammo_icon', 16, 16, (ctx, w, h) => {
            // 탄창
            ctx.fillStyle = '#666666';
            ctx.fillRect(5, 4, 6, 10);
            // 총알들
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(6, 5, 1, 3);
            ctx.fillRect(8, 5, 1, 3);
            ctx.fillRect(10, 5, 1, 3);
        });
    }

    static initializeAllAssets(scene) {
        this.generateCharacterSprites(scene);
        this.generateBulletSprites(scene);
        this.generateTileSprites(scene);
        this.generateEffectSprites(scene);
        this.generateUIElements(scene);
    }
}