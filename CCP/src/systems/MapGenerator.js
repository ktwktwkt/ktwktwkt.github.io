export default class MapGenerator {
    constructor(scene) {
        this.scene = scene;
        this.tileSize = 32;
        this.mapWidth = 60;  // 타일 개수
        this.mapHeight = 40;
        this.tiles = [];
        this.obstacles = [];
    }

    generateMap() {
        // 타일 그룹 생성
        this.tileGroup = this.scene.add.group();
        this.wallGroup = this.scene.physics.add.staticGroup();
        
        // 기본 바닥 타일 생성
        for (let x = 0; x < this.mapWidth; x++) {
            for (let y = 0; y < this.mapHeight; y++) {
                const tileX = x * this.tileSize;
                const tileY = y * this.tileSize;
                
                // 바닥 타일
                const tile = this.scene.add.image(tileX + 16, tileY + 16, 'floor_tile');
                tile.setOrigin(0.5);
                tile.setDepth(-2);
                
                // 랜덤 디테일
                if (Math.random() < 0.05) {
                    tile.setTint(0x999999);
                }
                
                this.tileGroup.add(tile);
            }
        }
        
        // 외벽 생성
        this.createWalls();
        
        // 장애물 생성
        this.createObstacles();
        
        // 특수 지역 생성
        this.createSpecialAreas();
    }

    createWalls() {
        // 상단 벽
        for (let x = 0; x < this.mapWidth; x++) {
            this.createWall(x * this.tileSize + 16, 16);
        }
        
        // 하단 벽
        for (let x = 0; x < this.mapWidth; x++) {
            this.createWall(x * this.tileSize + 16, (this.mapHeight - 1) * this.tileSize + 16);
        }
        
        // 좌측 벽
        for (let y = 1; y < this.mapHeight - 1; y++) {
            this.createWall(16, y * this.tileSize + 16);
        }
        
        // 우측 벽
        for (let y = 1; y < this.mapHeight - 1; y++) {
            this.createWall((this.mapWidth - 1) * this.tileSize + 16, y * this.tileSize + 16);
        }
    }

    createWall(x, y) {
        const wall = this.scene.physics.add.sprite(x, y, 'wall_tile');
        wall.setOrigin(0.5);
        wall.setImmovable(true);
        wall.body.setSize(32, 32);
        wall.setDepth(-1);
        this.wallGroup.add(wall);
    }

    createObstacles() {
        // 랜덤 장애물 배치
        const obstacleCount = 15;
        
        for (let i = 0; i < obstacleCount; i++) {
            const x = Phaser.Math.Between(3, this.mapWidth - 4);
            const y = Phaser.Math.Between(3, this.mapHeight - 4);
            
            // 장애물 유형 선택
            const type = Phaser.Math.Between(0, 2);
            
            switch(type) {
                case 0: // 작은 박스
                    this.createBox(x * this.tileSize, y * this.tileSize, 1, 1);
                    break;
                case 1: // 큰 박스
                    this.createBox(x * this.tileSize, y * this.tileSize, 2, 2);
                    break;
                case 2: // 긴 벽
                    if (Math.random() < 0.5) {
                        this.createBox(x * this.tileSize, y * this.tileSize, 4, 1);
                    } else {
                        this.createBox(x * this.tileSize, y * this.tileSize, 1, 4);
                    }
                    break;
            }
        }
    }

    createBox(x, y, width, height) {
        for (let dx = 0; dx < width; dx++) {
            for (let dy = 0; dy < height; dy++) {
                const box = this.scene.physics.add.sprite(
                    x + dx * this.tileSize + 16, 
                    y + dy * this.tileSize + 16, 
                    'metal_tile'
                );
                box.setOrigin(0.5);
                box.setImmovable(true);
                box.setDepth(0);
                box.setTint(0x888888);
                this.wallGroup.add(box);
                this.obstacles.push(box);
            }
        }
    }

    createSpecialAreas() {
        // 중앙 아레나
        const centerX = Math.floor(this.mapWidth / 2);
        const centerY = Math.floor(this.mapHeight / 2);
        
        // 아레나 바닥 표시
        for (let x = -5; x <= 5; x++) {
            for (let y = -5; y <= 5; y++) {
                if (Math.abs(x) === 5 || Math.abs(y) === 5) {
                    const marker = this.scene.add.image(
                        (centerX + x) * this.tileSize + 16,
                        (centerY + y) * this.tileSize + 16,
                        'floor_tile'
                    );
                    marker.setTint(0x660000);
                    marker.setDepth(-2);
                }
            }
        }
        
        // 탈출 지점 표시 (10분 후 활성화)
        this.escapeZone = this.scene.add.circle(
            centerX * this.tileSize + 16,
            centerY * this.tileSize + 16,
            100,
            0x00ff00,
            0.2
        );
        this.escapeZone.setStrokeStyle(3, 0x00ff00);
        this.escapeZone.setDepth(-1);
        this.escapeZone.setVisible(false);
    }

    showEscapeZone() {
        this.escapeZone.setVisible(true);
        
        // 펄스 애니메이션
        this.scene.tweens.add({
            targets: this.escapeZone,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.5,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
    }

    getWallGroup() {
        return this.wallGroup;
    }

    getRandomSpawnPoint() {
        let x, y;
        let validSpawn = false;
        
        while (!validSpawn) {
            x = Phaser.Math.Between(2, this.mapWidth - 3) * this.tileSize;
            y = Phaser.Math.Between(2, this.mapHeight - 3) * this.tileSize;
            
            // 장애물과 충돌 체크
            validSpawn = true;
            for (let obstacle of this.obstacles) {
                const dist = Phaser.Math.Distance.Between(x, y, obstacle.x, obstacle.y);
                if (dist < 64) {
                    validSpawn = false;
                    break;
                }
            }
        }
        
        return { x, y };
    }
}