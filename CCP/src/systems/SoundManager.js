export default class SoundManager {
    constructor(scene) {
        this.scene = scene;
        this.enabled = true;
        this.volume = 0.5;
        
        // 사운드 설정
        this.sounds = {};
        
        // Web Audio API를 사용한 프로시저럴 사운드 생성
        this.audioContext = null;
        this.initAudioContext();
    }
    
    initAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }
    
    // 프로시저럴 사운드 생성
    playShoot(weaponType = 'pistol') {
        if (!this.enabled || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // 무기별 사운드 설정
        const weaponSounds = {
            pistol: { freq: 150, duration: 0.1, type: 'square', filterFreq: 1000 },
            smg: { freq: 200, duration: 0.05, type: 'sawtooth', filterFreq: 1500 },
            shotgun: { freq: 80, duration: 0.2, type: 'square', filterFreq: 500 },
            sniper: { freq: 100, duration: 0.3, type: 'square', filterFreq: 800 },
            minigun: { freq: 250, duration: 0.03, type: 'sawtooth', filterFreq: 2000 },
            laser: { freq: 800, duration: 0.15, type: 'sine', filterFreq: 3000 },
            flamethrower: { freq: 60, duration: 0.5, type: 'sawtooth', filterFreq: 400 },
            plasma: { freq: 400, duration: 0.2, type: 'sine', filterFreq: 2500 },
            bow: { freq: 300, duration: 0.1, type: 'triangle', filterFreq: 1200 },
            grenade: { freq: 50, duration: 0.4, type: 'square', filterFreq: 300 }
        };
        
        const config = weaponSounds[weaponType] || weaponSounds.pistol;
        
        oscillator.type = config.type;
        oscillator.frequency.setValueAtTime(config.freq, now);
        oscillator.frequency.exponentialRampToValueAtTime(config.freq * 0.3, now + config.duration);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(config.filterFreq, now);
        filter.frequency.exponentialRampToValueAtTime(config.filterFreq * 0.2, now + config.duration);
        
        gainNode.gain.setValueAtTime(this.volume * 0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + config.duration);
        
        oscillator.start(now);
        oscillator.stop(now + config.duration);
    }
    
    playExplosion() {
        if (!this.enabled || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const noise = this.createNoise();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.5);
        
        gainNode.gain.setValueAtTime(this.volume * 0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        noise.start(now);
        noise.stop(now + 0.5);
    }
    
    playHit() {
        if (!this.enabled || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        
        gainNode.gain.setValueAtTime(this.volume * 0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    }
    
    playPickup() {
        if (!this.enabled || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.15);
        
        gainNode.gain.setValueAtTime(this.volume * 0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    }
    
    playReload() {
        if (!this.enabled || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(100, now);
        oscillator.frequency.setValueAtTime(150, now + 0.1);
        oscillator.frequency.setValueAtTime(100, now + 0.2);
        
        gainNode.gain.setValueAtTime(this.volume * 0.1, now);
        gainNode.gain.setValueAtTime(0, now + 0.05);
        gainNode.gain.setValueAtTime(this.volume * 0.1, now + 0.1);
        gainNode.gain.setValueAtTime(0, now + 0.15);
        gainNode.gain.setValueAtTime(this.volume * 0.1, now + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        oscillator.start(now);
        oscillator.stop(now + 0.3);
    }
    
    playFootstep() {
        if (!this.enabled || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const noise = this.createNoise();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        
        gainNode.gain.setValueAtTime(this.volume * 0.05, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        
        noise.start(now);
        noise.stop(now + 0.05);
    }
    
    playDash() {
        if (!this.enabled || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(100, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(500, now + 0.2);
        
        gainNode.gain.setValueAtTime(this.volume * 0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        oscillator.start(now);
        oscillator.stop(now + 0.2);
    }
    
    playEnemyDeath() {
        if (!this.enabled || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        
        gainNode.gain.setValueAtTime(this.volume * 0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        oscillator.start(now);
        oscillator.stop(now + 0.3);
    }
    
    playWarning() {
        if (!this.enabled || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        
        for (let i = 0; i < 3; i++) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 800;
            
            const startTime = now + i * 0.3;
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, startTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, startTime + 0.15);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + 0.15);
        }
    }
    
    // 노이즈 생성 (폭발음 등에 사용)
    createNoise() {
        const bufferSize = this.audioContext.sampleRate * 0.5;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        const whiteNoise = this.audioContext.createBufferSource();
        whiteNoise.buffer = buffer;
        
        return whiteNoise;
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
    
    toggleSound() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}