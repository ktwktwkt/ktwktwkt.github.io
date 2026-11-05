// Phaser Forge · Phaser 4.2.1
const game=window.forgeGame=(function launchGame(Phaser, project, options = {}, logicFactory, inventoryFactory, definitionFactory, timelineFactory, stateFactory, machineFactory, musicFactory, effectFactory, gameplayFactory, gameUiFactory, rigFactory, nineSliceFactory, nineSliceLayout, frameworkFactory, observatoryFactory, lightingFactory, requirementsFactory, interactionFactory, particleFactory, motionPathFactory, collisionFactory, factionFactory, connectionFactory, ropePhysicsFactory, projectileGuidanceFactory, textureLookupFactory, scriptFactory) {
	let observatory;
	let framework;
	let frameworkPaused = false;
	let frameworkPausedScenes = [];
	let frameworkSettings = project.framework?.enabled ? project.framework.settings : undefined;
	const setMasterVolume = (value) => {
		game.sound.volume = value;
		const context = game.sound.context;
		// 일시정지·불러오기 뒤의 음량 변경은 현재 오디오 시간에 적용합니다.
		if (context) game.sound.masterVolumeNode?.gain.setValueAtTime(value, context.currentTime);
	};
	const applyFrameworkKeys = (scene) => {
		if (!frameworkSettings || !project.framework?.modules.settings || !scene.keys || !scene.input.keyboard) return;
		const code = (key) => /^Key[A-Z]$/.test(key) ? key.charCodeAt(3) : /^Digit[0-9]$/.test(key) ? key.charCodeAt(5) : Phaser.Input.Keyboard.KeyCodes[key.replace(/^Arrow/, "").toUpperCase()];
		const controls = frameworkSettings.controls;
		for (const [name, control] of [
			["left", "left"],
			["right", "right"],
			["up", "up"],
			["down", "down"],
			["space", "jump"]
		]) {
			const keyCode = code(controls[control]);
			if (typeof keyCode === "number") scene.keys[name] = scene.input.keyboard.addKey(keyCode);
		};
		scene.keys.a = scene.keys.left;
		scene.keys.d = scene.keys.right;
		scene.keys.w = scene.keys.up;
		scene.keys.s = scene.keys.down;
		const action = code(controls.action);
		if (typeof action === "number") scene.keys.action = scene.input.keyboard.addKey(action);
	};
	let musicRuntime;
	const music = () => musicRuntime ??= musicFactory?.(project, game.sound, (message) => report("error", message));
	let activeItemScene = null;
	let requirementsRuntime;
	const inventory = inventoryFactory?.(project, (id) => activeItemScene?.ctx?.run(id), (id) => requirementsRuntime?.check(id, "use").passed ?? !project.items?.find((item) => item.id === id)?.requirements?.use);
	let pendingCheckpoint = null;
	let factions;
	const assetById = new Map(project.assets.map((a) => [a.id, a]));
	const textureLookup = textureLookupFactory?.(project);
	let generatedId = 0;
	let bloodMode = project.runtimeSettings?.bloodEffects ?? "full";
	const applyBloodPresentation = (go, definition) => {
		if (definition.customProperties?.bloodEffect !== true) return;
		go.setData?.("forgeBloodBaseAlpha", definition.opacity);
		go.alpha = definition.opacity * (bloodMode === "off" ? 0 : bloodMode === "reduced" ? .35 : 1);
	};
	const runtimeId = () => globalThis.crypto?.randomUUID?.() ?? `forge_${Date.now().toString(36)}_${++generatedId}`;
	const sourceFor = (asset, frame = 0) => {
		if (textureLookup) return textureLookup.source(asset, frame);
		// Preserve the previous serialized-launch API for callers which do not
		// inject the optional lookup factory. Preview/export inject the full
		// shared-page aliases explicitly, without an outer-module dependency.
		const named = typeof frame === "string" ? asset.atlas?.frames.findIndex((value) => value.name === frame) : -1;
		const index = named !== undefined && named >= 0 ? named : frame === "__BASE" ? 0 : Number(frame);
		const area = asset.atlas?.frames[index];
		return {
			key: area?.pageId ?? asset.id,
			frame: area ? area.pageId ? `${asset.id}:${index}` : area.name : asset.type === "image" ? "__BASE" : frame
		};
	};
	const atlasData = (a) => ({ frames: Object.fromEntries((a.atlas?.frames ?? []).map((f) => [f.name, {
		frame: {
			x: f.x,
			y: f.y,
			w: f.width,
			h: f.height
		},
		rotated: f.rotated,
		trimmed: true,
		spriteSourceSize: {
			x: f.offsetX,
			y: f.offsetY,
			w: f.displayWidth ?? (f.rotated ? f.height : f.width),
			h: f.displayHeight ?? (f.rotated ? f.width : f.height)
		},
		sourceSize: {
			w: f.sourceWidth,
			h: f.sourceHeight
		}
	}])) });
	const report = (level, message) => {
		const text = String(message);
		if (window.parent !== window) window.parent.postMessage({
			source: "phaser-forge-runtime",
			level,
			message: text
		}, "*");
		if (level === "error") console.error(text);
	};
	window.addEventListener("error", (e) => report("error", e.message));
	window.addEventListener("unhandledrejection", (e) => report("error", e.reason));
	window.addEventListener("keydown", (e) => {
		if (framework?.capturesInput() || project.framework?.modules.menu && framework && e.code === framework.settings().controls.menu) return;
		if (e.key === "Escape" && game?.scene.getScenes(true).some((s) => s.gameUi?.hasFocus())) return;
		const normalized = [
			...e.ctrlKey || e.metaKey ? ["Ctrl"] : [],
			...e.altKey ? ["Alt"] : [],
			...e.shiftKey ? ["Shift"] : [],
			e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key
		].join("+");
		if ((normalized === (options.stopShortcut ?? "F5") || e.key === "Escape" && project.runtimeSettings?.stopOnEscape !== false) && window.parent !== window) {
			e.preventDefault();
			window.parent.postMessage({
				source: "phaser-forge-runtime",
				level: "stop"
			}, "*");
		}
	});
	const vars = Object.fromEntries(project.variables.map((v) => [v.name, v.type === "number" ? Number(v.value) || 0 : v.type === "boolean" ? v.value === "true" : v.value]));
	const overlayParents = new Map();
	requirementsRuntime = requirementsFactory?.(project, {
		variable: (id) => {
			const variable = project.variables.find((variable) => variable.id === id);
			return variable ? vars[variable.name] : undefined;
		},
		itemCount: (id) => inventory?.count(id) ?? 0
	});
	const storageRequests = new Map();
	window.addEventListener("message", (event) => {
		if (event.source !== window.parent || event.data?.source !== "phaser-forge-storage") return;
		const request = storageRequests.get(event.data.id);
		if (!request) return;
		clearTimeout(request.timer);
		storageRequests.delete(event.data.id);
		if (event.data.error) request.reject(new Error(event.data.error));
		else request.resolve(event.data.value);
	});
	const storage = (action, key, value) => {
		if (!/^[a-zA-Z0-9._-]{1,80}$/.test(key)) return Promise.reject(new Error("저장 키는 영문·숫자·._- 1~80자여야 합니다."));
		if (action === "save") try {
			if (new Blob([JSON.stringify(value)]).size > 1024 * 1024) return Promise.reject(new Error("게임 저장 데이터는 슬롯당 1MB 이하여야 합니다."));
		} catch (error) {
			return Promise.reject(error);
		};
		if (window.parent !== window) return new Promise((resolve, reject) => {
			const id = String(Date.now()) + Math.random().toString(36).slice(2);
			const timer = setTimeout(() => {
				storageRequests.delete(id);
				reject(new Error("게임 저장 응답 시간이 초과됐습니다."));
			}, 8e3);
			storageRequests.set(id, {
				resolve,
				reject,
				timer
			});
			window.parent.postMessage({
				source: "phaser-forge-runtime",
				level: "storage",
				id,
				action,
				key,
				value
			}, "*");
		});
		try {
			const name = "forge-game:" + project.id + ":" + key;
			if (action === "load") return Promise.resolve(JSON.parse(localStorage.getItem(name) ?? "null"));
			if (action === "save") localStorage.setItem(name, JSON.stringify(value));
			if (action === "remove") localStorage.removeItem(name);
			return Promise.resolve(null);
		} catch (error) {
			return Promise.reject(error);
		}
	};
	const scenes = project.scenes.map((def) => {
		return class ForgeScene extends Phaser.Scene {
			objectMap = new Map();
			actors = [];
			hooks = {};
			ctx;
			keys;
			scoreText;
			startupData = {};
			loadingDisplay;
			logic;
			timeline;
			effects;
			lighting;
			interaction;
			particles;
			motionPaths;
			collision;
			connections;
			projectiles;
			states;
			gameplay;
			gameUi;
			rigs;
			syncUiCameras;
			actorListDirty = false;
			pruneActors;
			updateUiFrame;
			progress;
			runToken = { active: true };
			fired = new Set();
			variableEvents = new Map();
			touching = new Map();
			constructor() {
				super({ key: def.id });
			}
			init(data) {
				this.startupData = data ?? {};
			}
			preload() {
				if (project.assets.some((a) => a.type === "audio" ? !this.cache.audio.exists(a.id) : !this.textures.exists(a.id))) {
					this.loadingDisplay = this.add.text(this.scale.width / 2, this.scale.height / 2, "리소스 로딩 0%", {
						fontFamily: "system-ui",
						fontSize: "24px",
						color: "#bcc9da"
					}).setOrigin(.5);
					this.load.on("progress", (progress) => this.loadingDisplay?.setText("리소스 로딩 " + Math.round(progress * 100) + "%"));
				};
				for (const page of project.atlasPages ?? []) if (!this.textures.exists(page.id)) this.load.atlas(page.id, page.data, { frames: page.frames });
				project.assets.forEach((a) => {
					if (a.atlas?.frames[0]?.pageId) return;
					if (a.type === "audio") {
						if (!this.cache.audio.exists(a.id)) this.load.audio(a.id, a.data);
					} else if (!this.textures.exists(a.id)) {
						if (a.atlas) this.load.atlas(a.id, a.data, atlasData(a));
						else if (a.type === "spritesheet") this.load.spritesheet(a.id, a.data, {
							frameWidth: a.frameWidth,
							frameHeight: a.frameHeight,
							margin: a.grid?.margin ?? 0,
							spacing: a.grid?.spacing ?? 0
						});
						else this.load.image(a.id, a.data);
					}
				});
				this.load.on("loaderror", (file) => report("error", `리소스 로드 실패: ${project.assets.find((a) => a.id === file.key)?.name ?? file.key}`));
			}
			create() {
				textureLookup?.register(this.textures);
				activeItemScene = this;
				this.loadingDisplay?.destroy();
				this.loadingDisplay = null;
				this.objectMap = new Map();
				this.runToken = { active: true };
				const runToken = this.runToken;
				const observationSession = runtimeId();
				this.events.once("shutdown", () => {
					runToken.active = false;
					this.logic?.cancelObservations();
					this.states?.destroy();
					this.gameplay?.destroy();
					this.gameUi?.destroy();
					this.rigs?.destroy();
					this.effects?.destroy();
					this.interaction?.dispose();
					this.particles?.dispose();
					this.motionPaths?.dispose();
					this.collision?.dispose();
					this.connections?.dispose();
					this.projectiles?.dispose();
					factions?.refresh();
					musicRuntime?.stop(def.music?.fadeOut ?? 0, def.id);
				});
				this.states = undefined;
				this.gameplay = undefined;
				this.gameUi = undefined;
				this.rigs = undefined;
				this.syncUiCameras = undefined;
				this.updateUiFrame = undefined;
				this.effects = undefined;
				this.actors = [];
				this.interaction = undefined;
				this.motionPaths = undefined;
				this.connections = undefined;
				this.projectiles = undefined;
				this.particles = particleFactory?.(Phaser);
				this.collision = collisionFactory?.(project, () => this.actors, (message) => report("error", message));
				this.hooks = {};
				this.fired = new Set();
				this.variableEvents = new Map();
				this.touching = new Map();
				this.logic = logicFactory?.(project, vars, {
					script: (id, name, args, target) => {
						const script = project.scripts.find((row) => row.id === id);
						if (!script) throw Error("호출할 공통 코드가 없습니다: " + id);
						const exports = script.modulePath ? this.ctx.modules?.require(script.modulePath) : this.ctx.utils;
						const fn = exports?.[name];
						if (typeof fn !== "function") throw Error("공통 코드의 함수를 찾을 수 없습니다: " + script.name + " / " + name);
						return fn(this.ctx, args, target);
					},
					requirement: (step, value) => {
						if (!requirementsRuntime) return {
							passed: false,
							reasons: ["조건 판정기를 사용할 수 없습니다."]
						};
						const id = step.targetId ?? "", command = step.property ?? (step.kind === "requirements" ? "use" : "learn");
						if (step.kind === "requirements") return requirementsRuntime.check(id, command);
						if (command === "learn") return requirementsRuntime.progression.learn(id);
						if (!["string", "number"].includes(typeof value) || String(value).trim() === "" || !Number.isFinite(Number(value))) throw Error("진행 설정에는 유효한 숫자가 필요합니다.");
						const number = Number(value), progress = requirementsRuntime.progression;
						if (command === "setLevel") progress.setLevel(number);
						else if (command === "setPoints") progress.setPoints(number);
						else if (command === "addPoints") progress.addPoints(number);
						else if (command === "setRank") progress.setRank(id, number);
						else throw Error("지원하지 않는 진행 설정입니다.");
						return {
							passed: true,
							reasons: []
						};
					},
					scene: (id, command) => command === "overlay" ? this.ctx?.openOverlay(id) : command === "close" ? this.ctx?.closeOverlay() : this.ctx?.goto(id),
					sound: (id) => {
						if (this.cache.audio.exists(id)) this.sound.play(id);
					},
					message: (text) => this.ctx?.notify(text),
					animation: (id, target) => {
						const go = this.objectMap.get(target ?? "");
						if (go?.play && this.anims.exists(id)) go.play(id);
					},
					error: (message) => report("error", message),
					observing: (id, stack) => observatory?.watching(id, stack, def.id) ?? false,
					observe: (entry) => observatory?.observe({
						...entry,
						callId: observationSession + ":" + entry.callId,
						parentCallId: entry.parentCallId ? observationSession + ":" + entry.parentCallId : undefined
					}, def.id),
					variableChanged: (id, before, after, cause) => observatory?.variableChanged(id, before, after, cause),
					wait: (duration, callback) => {
						this.time.delayedCall(duration, () => {
							if (runToken.active) callback();
						});
					},
					storage: this.progress = async (operation, key) => {
						const parent = overlayParents.get(def.id);
						if (parent && operation !== "remove") {
							const scene = this.scene.get(parent);
							if (!scene?.progress) throw Error("저장할 게임 씬을 찾지 못했습니다.");
							return scene.progress(operation, key);
						};
						if (operation === "save") {
							const transientIds = new Set(), children = new Map();
							for (const { def: object } of this.actors) {
								if (object.customProperties?.gameEffectTransient === true) transientIds.add(object.id);
								if (object.parentId) {
									const list = children.get(object.parentId) ?? [];
									list.push(object.id);
									children.set(object.parentId, list);
								}
							};
							const transientQueue = [...transientIds];
							for (let i = 0; i < transientQueue.length; i++) for (const id of children.get(transientQueue[i]) ?? []) if (!transientIds.has(id)) {
								transientIds.add(id);
								transientQueue.push(id);
							};
							const objects = [...this.objectMap].filter(([id, o]) => !o.isDestroyed && !o.getData?.("forgeUiTransient") && !transientIds.has(id)).map(([id, o]) => {
								const g = o.getData?.("forgeAnchor") ?? o;
								return {
									id,
									active: o.active,
									pickupAmounts: o.getData?.("forgePickupAmounts"),
									x: g.x,
									y: g.y,
									angle: g.angle,
									alpha: g.alpha,
									visible: g.visible,
									scaleX: g.scaleX,
									scaleY: g.scaleY,
									frame: o.getData?.("forgeLiveRig") ? undefined : o.frame?.name,
									tilePositionX: o.tilePositionX,
									tilePositionY: o.tilePositionY,
									velocityX: o.body?.velocity?.x,
									velocityY: o.body?.velocity?.y,
									accelerationX: o.body?.acceleration?.x,
									accelerationY: o.body?.acceleration?.y
								};
							});
							await storage("save", key, {
								version: 1,
								sceneId: def.id,
								variables: { ...vars },
								inventory: inventory?.serialize(),
								progression: requirementsRuntime?.progression.snapshot(),
								objects,
								cameras: this.cameras.cameras.filter((camera) => camera.forgeCameraId).map((camera) => ({
									id: camera.forgeCameraId,
									scrollX: camera.scrollX,
									scrollY: camera.scrollY,
									zoom: camera.zoom,
									rotation: camera.rotation,
									alpha: camera.alpha,
									visible: camera.visible,
									useBounds: camera.useBounds,
									bounds: camera.useBounds ? {
										x: camera._bounds.x,
										y: camera._bounds.y,
										width: camera._bounds.width,
										height: camera._bounds.height
									} : undefined
								})),
								removed: def.objects.filter((o) => transientIds.has(o.id) || !this.objectMap.has(o.id) || this.objectMap.get(o.id)?.isDestroyed).map((o) => o.id),
								fired: [...this.fired],
								timelines: this.timeline?.status(),
								states: this.states?.snapshot().filter((state) => !transientIds.has(state.owner)),
								gameplay: this.gameplay?.snapshot(),
								rigs: this.rigs?.snapshot(),
								lighting: this.lighting?.snapshot(),
								interaction: this.interaction?.snapshot(),
								particles: this.particles?.snapshot(),
								motionPaths: this.motionPaths?.snapshot(),
								collision: this.collision?.snapshot(),
								factions: factions?.snapshot(),
								connections: this.connections?.snapshot(),
								music: musicRuntime?.status(),
								projectiles: this.projectiles?.snapshot(),
								spawned: this.actors.filter((a) => !a.go.isDestroyed && !transientIds.has(a.def.id) && !def.objects.some((o) => o.id === a.def.id) && !a.go.getData?.("forgeUiTransient")).map((a) => a.def)
							});
							return runToken.active ? true : undefined;
						};
						if (operation === "remove") {
							await storage("remove", key);
							return runToken.active ? true : undefined;
						};
						const data = await storage("load", key);
						if (!runToken.active) return;
						if (!data) return false;
						if (data.version !== 1 || !project.scenes.some((s) => s.id === data.sceneId) || !data.variables || !Array.isArray(data.objects)) throw new Error("이 프로젝트에서 읽을 수 없는 게임 저장 데이터입니다.");
						if (data.progression !== undefined && requirementsRuntime && !requirementsRuntime.progression.restore(data.progression)) throw Error("저장된 레벨·스킬 진행 정보를 확인하세요.");
						if (data.progression === undefined) requirementsRuntime?.progression.reset();
						for (const v of project.variables) {
							const value = data.variables[v.name];
							if (typeof value === v.type && (v.type !== "number" || Number.isFinite(value))) vars[v.name] = value;
						};
						if (data.inventory) inventory?.restore(data.inventory);
						factions?.dispose();
						factions = undefined;
						pendingCheckpoint = data;
						const closed = new Set([def.id]);
						let changed = true;
						while (changed) {
							changed = false;
							for (const [child, parent] of overlayParents) if (closed.has(parent) && !closed.has(child)) {
								closed.add(child);
								changed = true;
							}
						};
						for (const key of [...closed].reverse()) if (key !== def.id) {
							game.scene.stop(key);
							overlayParents.delete(key);
						};
						this.scene.start(data.sceneId);
						return;
					},
					action: (step, value, target, initialValues) => {
						if (step.kind === "projectileGuidance") {
							const owner = step.objectId || target || "", runtime = game.scene.scenes.find((s) => s.objectMap?.get(owner)?.active && s.projectiles)?.projectiles;
							if (!runtime) throw Error("유도 이동을 제어할 오브젝트가 없습니다.");
							const command = step.property || "restart";
							if (!runtime.command(command, owner, ["target", "owner"].includes(command) ? step.targetId || String(value ?? "") : value)) throw Error("대상 오브젝트에 유도·추종·귀환 설정을 추가하세요.");
							return;
						};
						if (step.kind === "connection") {
							const owner = step.objectId || target || "", runtime = game.scene.scenes.find((scene) => scene.objectMap?.get(owner)?.active && scene.connections)?.connections, command = step.property || "on";
							if (!runtime) throw Error("연결 효과를 제어할 오브젝트가 없습니다.");
							const argument = command === "attachEnd" || command === "attachStart" ? {
								targetId: step.targetId || String(value ?? ""),
								...Number.isFinite(step.x) && Number.isFinite(step.y) ? {
									x: step.x,
									y: step.y
								} : {}
							} : [
								"progress",
								"extend",
								"retract"
							].includes(command) ? value === undefined ? undefined : Number(value) : value;
							runtime.command(command, owner, argument);
							return;
						};
						if (step.kind === "faction") {
							if (!factions) throw Error("진영 서비스를 사용할 수 없습니다.");
							const owner = step.objectId || target || "", command = step.property || "team", from = step.text || factions.team(owner), to = step.targetId || "";
							if (command === "team") factions.setTeam(owner, String(value ?? ""));
							else if (command === "relation" || command === "relationBoth") factions.setRelation(from, to, String(value), command === "relationBoth");
							else if (command === "clearRelation" || command === "clearRelationBoth") factions.clearRelation(from, to, command === "clearRelationBoth");
							else if (command === "default") factions.setDefault(String(value));
							else if (command === "enemyOfEnemy") {
								if (value !== true && value !== false && value !== "true" && value !== "false") throw Error("적의 적 규칙은 참거짓으로 입력하세요.");
								factions.setEnemyOfEnemy(value === true || value === "true");
							} else throw Error("진영 명령을 확인하세요.");
							return;
						};
						if ([
							"interaction",
							"particles",
							"motionPath",
							"collision"
						].includes(step.kind)) {
							const owner = step.objectId || target || "", property = step.kind === "interaction" ? "interaction" : step.kind === "motionPath" ? "motionPaths" : step.kind;
							const runtime = game.scene.scenes.find((s) => s.objectMap?.get(owner)?.active && s[property]);
							if (!runtime) throw Error("엔진 기능을 제어할 실행 중인 오브젝트를 선택하세요.");
							const command = step.property || (step.kind === "interaction" ? "enable" : step.kind === "particles" ? "on" : step.kind === "motionPath" ? "play" : "enable");
							if (step.kind === "interaction") runtime.interaction.command(command, owner, value);
							else if (step.kind === "particles") runtime.particles.command(owner, command, step.value && command === "explode" ? Number(value) : undefined);
							else if (step.kind === "motionPath") runtime.motionPaths.command(owner, command, command === "seek" ? Number(value) : value);
							else runtime.collision.command(owner, command, value);
							return;
						};
						if (step.kind === "lighting") {
							const id = step.targetId === "$self" ? target || step.objectId || "" : step.targetId || "";
							if (step.targetId === "$self" && !id) throw Error("이 조명 함수는 호출한 오브젝트가 필요합니다.");
							const runtime = id ? game.scene.scenes.find((s) => s.objectMap?.get(id)?.active && s.lighting)?.lighting : this.lighting;
							if (!runtime) throw Error("실행 중인 조명 대상을 찾을 수 없습니다.");
							runtime.command(step.text || "enable", id, value);
							return;
						};
						if (step.kind === "framework") {
							framework?.action(step.property || "menu", step.targetId || step.text || "", value);
							return;
						};
						if (step.kind === "rig") {
							const owner = target || step.objectId || "", runtime = game.scene.scenes.find((s) => s.objectMap?.get(owner)?.active && s.rigs)?.rigs;
							const command = step.property || "play", flag = step.value ? value === true || value === 1 || value === "true" || value === "1" : true;
							if (command === "play") runtime?.play(owner, step.targetId || "", step.duration);
							else if (command === "aim") runtime?.aim(owner, flag, step.text || "");
							else if (command === "pause") runtime?.pause(owner, flag);
							else if (command === "auto") runtime?.auto(owner);
							else if (command === "reset") runtime?.reset(owner);
							return;
						};
						if (step.kind === "agent") {
							const owner = target || step.objectId || "", runtime = game.scene.scenes.find((s) => s.objectMap?.get(owner)?.active && s.gameplay)?.gameplay;
							runtime?.agent(owner, step.property || "enable", step.targetId || "");
							return;
						};
						if (step.kind === "combat") {
							const owner = target || step.objectId || "", command = step.property || "attack";
							const runtime = game.scene.scenes.find((s) => s.objectMap?.get(owner)?.active && s.gameplay)?.gameplay;
							if (command === "attack") runtime?.attack(owner, step.targetId || undefined, step.text || "basic");
							else if (command === "damage") runtime?.damage(owner, Number(value), step.targetId || "");
							else if (command === "heal") runtime?.heal(owner, Number(value));
							else if (command === "revive") runtime?.revive(owner);
							else if (command === "status") runtime?.status(owner, step.text || "", step.targetId || owner);
							else if (command === "clearStatus") runtime?.clearStatus(owner, step.text || "");
							return;
						};
						if (step.kind === "effect") {
							const go = step.text === "camera" ? this.cameras.cameras.find((camera) => camera.forgeCameraId === step.cameraId) ?? this.cameras.main : this.objectMap.get(target ?? "") ?? this.cameras.main;
							if (step.property === "clear") this.effects?.stop(go);
							else if (step.property === "remove") this.effects?.stop(go, step.targetId);
							else this.effects?.play(go, step.targetId ?? "", { duration: step.duration || undefined });
							return;
						};
						if (step.kind === "music") {
							const command = step.property ?? "play", player = music();
							if (command === "play") player?.play(step.targetId ?? "", {
								volume: Number(value),
								fade: (step.duration ?? 0) / 1e3,
								loop: step.text !== "once",
								owner: def.id
							});
							else if (command === "stop") player?.stop((step.duration ?? 0) / 1e3);
							else if (command === "pause") player?.pause();
							else if (command === "resume") player?.resume();
							else if (command === "volume") player?.volume(Number(value), (step.duration ?? 0) / 1e3);
							return;
						};
						if (step.kind === "state") {
							const owner = target ?? "", machine = step.targetId || undefined, command = step.property ?? "set";
							if (command === "trigger") this.states?.trigger(owner, step.text ?? "", machine);
							else if (command === "signal") this.states?.signal(owner, step.text ?? "", machine);
							else if (command === "change") this.states?.change(owner, step.layerId ?? "", step.stateId ?? "", machine);
							else if (command === "enable" || command === "disable") this.states?.enable(owner, command === "enable", machine);
							else if (command === "reset") this.states?.reset(owner, machine);
							else {
								const previous = Number(this.states?.get(owner, step.text ?? "", machine)), n = Number(value);
								this.states?.set(owner, step.text ?? "", step.operation === "add" ? previous + n : step.operation === "subtract" ? previous - n : step.operation === "multiply" ? previous * n : value, machine);
							};
							return;
						};
						if (step.kind === "timeline") {
							const id = step.targetId ?? "", command = step.property ?? "play";
							if (command === "pause") this.timeline?.pause(id);
							else if (command === "stop") this.timeline?.stop(id);
							else if (command === "seek") this.timeline?.seek(id, Number(value) || 0);
							else this.timeline?.play(id, command !== "resume");
							return;
						};
						if (step.kind === "item") {
							activeItemScene = this;
							const id = step.targetId ?? "", n = Number(value) || 1;
							if (step.property === "pickup") {
								const object = this.objectMap.get(target ?? "");
								if (!object?.active) return;
								const amounts = object.getData("forgePickupAmounts") ?? {}, saved = amounts[step.id], remaining = typeof saved === "number" && Number.isSafeInteger(saved) && saved > 0 ? saved : Math.min(1e6, Math.max(1, Number.isFinite(n) ? Math.floor(n) : 1)), taken = inventory?.give(id, remaining) ?? 0, left = remaining - taken;
								if (taken > 0) this.ctx?.notify(((project.items ?? []).find((item) => item.id === id || item.key === id)?.name ?? "아이템") + " " + taken + "개 획득");
								if (left <= 0) {
									const actor = this.actors.find((a) => a.go === object);
									if (actor) this.fireEvents(actor.def.events ?? [], "collect", actor.def.id);
									object.destroy();
								} else {
									object.setData("forgePickupAmounts", {
										...amounts,
										[step.id]: left
									});
									if (!taken) this.ctx?.notify("소지품이 가득합니다.");
								};
								return;
							};
							if (step.property === "take") inventory?.take(id, n);
							else if (step.property === "use") inventory?.use(id);
							else if (step.property === "equip") inventory?.equip(id);
							else if (step.property === "unequip") inventory?.unequip((project.items ?? []).find((i) => i.id === id)?.slot ?? "");
							else inventory?.give(id, n);
							return;
						};
						const go = this.objectMap.get(target ?? ""), number = Number(value) || 0, property = step.property ?? "x";
						if (step.kind === "gravity") {
							this.physics.world.gravity.set(step.x ?? 0, step.y ?? 900);
							return;
						};
						if (step.kind === "camera") {
							const camera = this.cameras.cameras.find((camera) => camera.forgeCameraId === step.cameraId) ?? this.cameras.main, duration = step.duration ?? 500;
							if (property === "shake") camera.shake(duration, Math.min(.1, Math.max(0, number || .007)));
							else if (property === "flash") camera.flash(duration);
							else if (property === "fade") camera.fadeOut(duration);
							else if (property === "zoom") camera.zoomTo(Math.max(.05, Math.min(20, number)), duration);
							return;
						};
						if (step.kind === "spawn") {
							const point = go?.getWorldTransformMatrix();
							const bindings = {};
							for (const [id, value] of Object.entries(step.spawnBindings ?? {})) {
								const node = value === "$self" ? target || step.objectId || "" : value;
								if (!node) throw Error("생성 인수의 호출 대상이 없습니다.");
								bindings[id] = node;
							};
							this.ctx?.spawn(step.targetId, step.property === "atTarget" ? point?.tx ?? 0 : step.x ?? 0, step.property === "atTarget" ? point?.ty ?? 0 : step.y ?? 0, {
								values: initialValues,
								bindings
							});
							return;
						};
						if (!go?.active) {
							report("error", "오브젝트 동작의 실행 대상을 찾을 수 없습니다.");
							return;
						};
						if (step.kind === "destroy") {
							go.destroy();
							return;
						};
						const transformTarget = go.getData?.("forgeAnchor") ?? go;
						const aliases = {
							rotation: "angle",
							opacity: "alpha",
							width: "displayWidth",
							height: "displayHeight"
						}, key = aliases[property] ?? property;
						const targetObject = property.startsWith("velocity") || property.startsWith("acceleration") ? go.body : transformTarget;
						if (!targetObject || property.startsWith("velocity") && !targetObject.velocity || property.startsWith("acceleration") && !targetObject.acceleration) {
							report("error", "속도·가속도를 변경하려면 동적 물리를 설정하세요.");
							return;
						};
						const vector = property.startsWith("velocity") ? "velocity" : property.startsWith("acceleration") ? "acceleration" : "";
						const before = vector ? targetObject[vector][property.endsWith("X") ? "x" : "y"] : property === "scale" ? transformTarget.scaleX / (transformTarget.getData("forgeScaleX") || 1) : targetObject[key];
						let next = step.operation === "add" ? Number(before) + number : step.operation === "subtract" ? Number(before) - number : step.operation === "multiply" ? Number(before) * number : number;
						if (step.kind === "object" && property === "text" && go.setText) {
							go.setText(step.operation === "add" ? String(before ?? "") + String(value ?? "") : String(value ?? ""));
							return;
						};
						if (!Number.isFinite(next)) {
							report("error", "오브젝트 동작의 값이 유효한 수가 아닙니다.");
							return;
						};
						if (property === "scale") next = Math.max(1e-4, Math.min(1e4, next));
						if (property === "width" || property === "height") next = Math.max(1, Math.min(16384, next));
						if (property === "opacity") next = Math.max(0, Math.min(1, next));
						if (step.kind === "tween") {
							const props = property === "scale" ? {
								scaleX: next * (transformTarget.getData("forgeScaleX") || 1),
								scaleY: next * (transformTarget.getData("forgeScaleY") || 1)
							} : { [key]: next };
							this.tweens.add({
								targets: transformTarget,
								...props,
								duration: step.duration ?? 500,
								ease: step.ease ?? "Linear"
							});
						} else if (vector) targetObject[vector][property.endsWith("X") ? "x" : "y"] = next;
						else if (property === "scale") transformTarget.setScale(next * (transformTarget.getData("forgeScaleX") || 1), next * (transformTarget.getData("forgeScaleY") || 1));
						else if (property === "text" && go.setText) go.setText(String(value ?? ""));
						else if ([
							"visible",
							"active",
							"flipX",
							"flipY"
						].includes(property)) {
							targetObject[key] = value === true || value === "true";
							if (property === "active" && go.body) go.body.enable = targetObject[key];
						} else targetObject[key] = next;
					}
				});
				this.physics.world.gravity.y = def.gravity;
				this.physics.world.gravity.x = def.physicsSettings?.gravityX ?? 0;
				this.physics.world.setFPS(def.physicsSettings?.fps ?? 60);
				this.input.setTopOnly(def.physicsSettings?.topOnly ?? true);
				this.physics.world.setBounds(def.physicsSettings?.boundsX ?? 0, def.physicsSettings?.boundsY ?? 0, def.physicsSettings?.boundsWidth ?? def.worldWidth, def.physicsSettings?.boundsHeight ?? def.worldHeight, def.physicsSettings?.left ?? true, def.physicsSettings?.right ?? true, def.physicsSettings?.up ?? true, def.physicsSettings?.down ?? true);
				setMasterVolume(project.audioVolume * (frameworkSettings?.masterVolume ?? 1));
				this.cameras.main.setBackgroundColor(def.background);
				this.keys = this.input.keyboard.addKeys({
					left: "LEFT",
					right: "RIGHT",
					up: "UP",
					down: "DOWN",
					a: "A",
					d: "D",
					w: "W",
					s: "S",
					space: "SPACE",
					action: "Z",
					r: "R"
				});
				applyFrameworkKeys(this);
				const restartEvent = (event) => {
					if (project.runtimeSettings?.restartOnR !== false && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !this.gameUi?.capturesInput() && !framework?.capturesInput()) this.scene.restart();
				};
				this.input.keyboard.on("keydown-R", restartEvent);
				this.events.once("shutdown", () => this.input.keyboard.off("keydown-R", restartEvent));
				for (const anim of project.animations) {
					const asset = project.assets.find((a) => a.id === anim.assetId);
					if (this.anims.exists(anim.id) || !asset) continue;
					const blankKey = "__forge_blank_" + anim.assetId;
					if (anim.frames.includes(-1) && !this.textures.exists(blankKey)) this.textures.createCanvas(blankKey, asset.frameWidth, asset.frameHeight);
					const frames = anim.frames.flatMap((frame, index) => {
						const source = frame === -1 ? {
							key: blankKey,
							frame: "__BASE"
						} : sourceFor(asset, frame);
						return this.textures.exists(source.key) && this.textures.get(source.key).has(source.frame) ? [{
							...source,
							...anim.frameDurations ? { duration: anim.frameDurations[index] } : {}
						}] : [];
					});
					if (frames.length) this.anims.create({
						key: anim.id,
						frames,
						frameRate: anim.frameDurations ? 1e3 : anim.fps,
						repeat: anim.repeat,
						yoyo: anim.yoyo
					});
				};
				const statics = [];
				const actors = [];
				const classifiedActors = [];
				const triggers = [];
				const fixed = [];
				const players = [];
				this.actorListDirty = false;
				this.pruneActors = () => {
					this.actors = this.actors.filter((actor) => !actor.go.isDestroyed);
					for (const list of [
						actors,
						players,
						statics,
						fixed,
						classifiedActors
					]) {
						const live = list.filter((go) => !go.isDestroyed);
						list.splice(0, list.length, ...live);
					};
					this.actorListDirty = false;
					factions?.refresh();
				};
				const buildObjects = (definitions, spawned = false) => {
					const actorStart = this.actors.length, triggerStart = triggers.length;
					// 새 루트는 현재 씬의 살아 있는 루트 뒤에 추가한다. 자식 깊이는 컨테이너 안의 순서다.
					const spawnDepth = spawned ? this.actors.reduce((maximum, actor) => {
						const node = actor.go;
						return node?.active && !node.isDestroyed && node.scene === this && !node.parentContainer ? Math.max(maximum, Number(node.depth) || 0) : maximum;
					}, -1) + 1 : 0;
					for (const o of definitions.filter((o) => o.kind === "group")) this.objectMap.set(o.id, this.add.container(o.x, o.y).setSize(o.width, o.height));
					for (const o of definitions) {
						const tint = parseInt(o.color.slice(1), 16);
						let go;
						const asset = assetById.get(o.assetId) ?? (o.kind === "sprite" && o.rigPlayback?.enabled ? assetById.get(o.rigPlayback.assetId) : undefined);
						if (o.kind === "group") go = this.objectMap.get(o.id);
						else if (o.kind === "tilemap") {
							if (!asset || !this.textures.exists(asset.id)) continue;
							const data = Array.from({ length: o.rows }, (_, r) => o.tiles.slice(r * o.columns, (r + 1) * o.columns));
							const map = this.make.tilemap({
								data,
								tileWidth: o.tileMap?.tileWidth ?? asset.frameWidth,
								tileHeight: o.tileMap?.tileHeight ?? asset.frameHeight
							});
							const sources = o.tileMap?.sources ?? [{
								assetId: asset.id,
								start: 0
							}];
							const tilesets = sources.flatMap((source) => {
								const image = assetById.get(source.assetId);
								if (!image || !this.textures.exists(image.id)) return [];
								// Atlas frames may have irregular rectangles, trims, rotation or
								// live on different packed pages. A native Tileset assumes one
								// uniform image. Resolve each logical frame once into a cached
								// sheet; original files and project resources remain untouched.
								let textureKey = image.id, imageWidth = image.width, imageHeight = image.height, tileWidth = image.frameWidth, tileHeight = image.frameHeight, margin = image.grid?.margin ?? 0, spacing = image.grid?.spacing ?? 0;
								if (image.atlas?.frames.length) {
									tileWidth = map.tileWidth;
									tileHeight = map.tileHeight;
									margin = spacing = 0;
									textureKey = "__forge_tiles__" + image.id + "__" + tileWidth + "x" + tileHeight;
									const count = image.atlas.frames.length, columns = Math.max(1, Math.ceil(Math.sqrt(count * tileHeight / tileWidth))), rows = Math.ceil(count / columns);
									imageWidth = columns * tileWidth;
									imageHeight = rows * tileHeight;
									const gl = this.game.renderer.gl, maxDimension = Math.min(8192, gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 8192);
									if (!Number.isFinite(imageWidth * imageHeight) || imageWidth > maxDimension || imageHeight > maxDimension || imageWidth * imageHeight > 16777216) throw Error("타일의 논리 크기가 너무 큽니다: " + image.name + " · 타일 크기를 줄이거나 타일셋을 나누세요.");
									if (!this.textures.exists(textureKey)) {
										const texture = this.textures.createCanvas(textureKey, imageWidth, imageHeight);
										if (!texture) throw Error("타일 아틀라스를 준비하지 못했습니다: " + image.name);
										const context = texture.context;
										context.imageSmoothingEnabled = false;
										try {
											for (let index = 0; index < count; index++) {
												const location = sourceFor(image, index), sourceTexture = this.textures.get(location.key), frame = sourceTexture?.get(location.frame);
												if (!frame || !frame.source?.image) throw Error("타일 프레임을 찾을 수 없습니다: " + image.name + " · " + index);
												const sx = tileWidth / Math.max(1, frame.realWidth), sy = tileHeight / Math.max(1, frame.realHeight), x = index % columns * tileWidth + (frame.x ?? 0) * sx, y = Math.floor(index / columns) * tileHeight + (frame.y ?? 0) * sy, width = frame.width * sx, height = frame.height * sy;
												if (frame.rotated) {
													context.save();
													context.translate(x, y + height);
													context.rotate(-Math.PI / 2);
													context.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, height, width);
													context.restore();
												} else context.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, x, y, width, height);
											};
											texture.refresh();
										} catch (error) {
											this.textures.remove(textureKey);
											throw error;
										}
									}
								};
								const set = map.addTilesetImage(image.id, textureKey, tileWidth, tileHeight, margin, spacing, source.start);
								if (!set) return [];
								set.updateTileData(imageWidth, imageHeight);
								if (image.atlas?.frames.length) set.total = image.atlas.frames.length;
								for (const animation of o.tileMap?.animations ?? []) if (animation.index >= source.start && animation.index < source.start + ("count" in source ? source.count : 4096)) {
									let time = 0;
									set.tileData[animation.index - source.start] = {
										animation: animation.frames.map((f) => {
											const frame = {
												tileid: f.index - source.start,
												duration: f.duration,
												startTime: time
											};
											time += f.duration;
											return frame;
										}),
										animationDuration: animation.frames.reduce((total, f) => total + f.duration, 0)
									};
								};
								return [set];
							});
							if (!tilesets.length) continue;
							go = map.createLayer(0, tilesets, o.x - o.width / 2, o.y - o.height / 2);
							go.setScale(o.width / (o.columns * (o.tileMap?.tileWidth ?? asset.frameWidth)), o.height / (o.rows * (o.tileMap?.tileHeight ?? asset.frameHeight)));
							if (o.tileMap?.flags) go.forEachTile((tile) => {
								const flags = o.tileMap.flags[tile.y * o.columns + tile.x] ?? 0;
								tile.rotation = [
									0,
									0,
									Math.PI,
									Math.PI,
									Math.PI * 1.5,
									Math.PI / 2,
									Math.PI * 1.5,
									Math.PI / 2
								][flags];
								tile.flipX = [
									false,
									true,
									true,
									false,
									true,
									false,
									false,
									true
								][flags];
							});
							if (o.physics === "static") {
								if (o.tileMap?.collisionTiles) go.setCollision(o.tileMap.collisionTiles);
								else go.setCollisionByExclusion([-1]);
								if (o.tileMap?.collisionOverrides) {
									go.forEachTile((tile) => {
										const value = o.tileMap.collisionOverrides[tile.y * o.columns + tile.x];
										if (value !== undefined && value >= 0) tile.setCollision(value === 1 && tile.index >= 0, value === 1 && tile.index >= 0, value === 1 && tile.index >= 0, value === 1 && tile.index >= 0, false);
									});
									go.calculateFacesWithin?.();
								};
								statics.push(go);
							}
						} else if (o.kind === "sprite" && asset && this.textures.exists(sourceFor(asset, o.frame).key)) {
							go = o.background?.enabled ? this.add.tileSprite(o.x, o.y, o.width, o.height, sourceFor(asset, o.frame).key, sourceFor(asset, o.frame).frame).setTilePosition(o.background.offsetX, o.background.offsetY).setTileScale(o.background.tileScaleX, o.background.tileScaleY) : o.gameUi?.nineSlice?.enabled && nineSliceFactory && nineSliceLayout ? nineSliceFactory(this, sourceFor(asset, o.frame).key, sourceFor(asset, o.frame).frame, o.width, o.height, o.gameUi.nineSlice, nineSliceLayout).setPosition(o.x, o.y) : this.add.sprite(o.x, o.y, sourceFor(asset, o.frame).key, sourceFor(asset, o.frame).frame).setDisplaySize(o.width, o.height);
							if (!o.background?.enabled && o.animationId && this.anims.exists(o.animationId)) go.play?.(o.animationId);
						} else if (o.kind === "text") go = this.add.text(o.x, o.y, o.textBinding && this.logic ? this.logic.format(o.textBinding) : o.text, {
							fontFamily: "system-ui, sans-serif",
							fontSize: `${o.fontSize}px`,
							color: o.color,
							align: o.gameUi?.enabled ? o.gameUi.text.align ?? "center" : "center",
							...o.gameUi?.enabled ? {
								fixedWidth: o.width,
								fixedHeight: o.height
							} : {},
							wordWrap: { width: o.width }
						}).setOrigin(.5);
						else if (o.kind === "ellipse") go = this.add.ellipse(o.x, o.y, o.width, o.height, tint);
						else if (o.kind === "particles") {
							const key = asset ? sourceFor(asset, o.frame).key : "__forge_particle";
							if (!this.textures.exists(key)) {
								const g = this.make.graphics({
									x: 0,
									y: 0
								});
								g.fillStyle(16777215);
								g.fillCircle(3, 3, 3);
								g.generateTexture(key, 6, 6);
								g.destroy();
							};
							go = this.add.particles(o.x, o.y, key, o.particleSettings && this.particles ? this.particles.config(o.particleSettings, asset ? sourceFor(asset, o.frame).frame : undefined) : {
								...asset ? { frame: sourceFor(asset, o.frame).frame } : {},
								speed: {
									min: 10,
									max: o.speed
								},
								lifespan: 1500,
								quantity: 1,
								frequency: 100,
								scale: {
									start: .8,
									end: 0
								},
								alpha: {
									start: 1,
									end: 0
								},
								tint
							});
							this.particles?.register(o.id, go, o.particleSettings, !(pendingCheckpoint?.sceneId === def.id && pendingCheckpoint?.particles));
						} else go = this.add.rectangle(o.x, o.y, o.width, o.height, tint);
						if (o.kind !== "group") {
							if (go.setOrigin) go.setOrigin(o.renderSettings?.originX ?? .5, o.renderSettings?.originY ?? .5);
							if (go.setFlip) {
								go.setFlip(o.renderSettings?.flipX ?? false, o.renderSettings?.flipY ?? false);
							};
							if (o.renderSettings?.blend && !(o.kind === "particles" && o.particleSettings)) go.setBlendMode(Phaser.BlendModes[o.renderSettings.blend]);
							if (o.renderSettings?.tint && go.setTint) go.setTint(parseInt(o.renderSettings.tint.slice(1), 16));
						};
						if (o.scale !== undefined) go.setScale(go.scaleX * o.scale, go.scaleY * o.scale);
						const customProperties = {
							...o.customProperties,
							...o.tileMap?.properties
						};
						go.setData(Object.fromEntries(Object.entries(customProperties).filter(([key]) => ![
							"__proto__",
							"constructor",
							"prototype"
						].includes(key) && !key.startsWith("forge"))));
						go.setData({
							forgeId: o.id,
							forgeValue: o.value,
							forgeScaleX: go.scaleX / (o.scale ?? 1),
							forgeScaleY: go.scaleY / (o.scale ?? 1)
						});
						go.setDepth((o.parentId ? 0 : spawnDepth) + definitions.indexOf(o));
						if (o.kind === "tilemap") {
							const anchor = this.add.container(o.x, o.y).setSize(o.width, o.height).setScale(o.scale ?? 1).setAngle(o.rotation).setAlpha(o.opacity).setVisible(o.visible);
							anchor.setData({
								forgeScaleX: 1,
								forgeScaleY: 1
							});
							if (o.parentId) this.objectMap.get(o.parentId)?.add(anchor);
							go.setData("forgeAnchor", anchor);
							const setLayerVisible = go.setVisible.bind(go);
							go.setVisible = (visible) => {
								anchor.setVisible(visible);
								return setLayerVisible(visible);
							};
							anchor.once("destroy", () => {
								if (go.active && !go.isDestroyed) go.destroy();
							});
							go.once("destroy", () => {
								if (anchor.active && !anchor.isDestroyed) anchor.destroy();
							});
						} else if (o.parentId) this.objectMap.get(o.parentId)?.add(go);
						go.setName(o.name).setAlpha(o.opacity).setVisible(o.visible).setAngle(o.rotation);
						if (o.fixed) {
							go.setScrollFactor(0);
							fixed.push(go);
						} else go.setScrollFactor?.(o.renderSettings?.scrollFactorX ?? 1, o.renderSettings?.scrollFactorY ?? 1);
						go.setData?.("forgeObjectId", o.id);
						this.objectMap.set(o.id, go);
						go.once("destroy", () => {
							this.actorListDirty = true;
							this.objectMap.delete(o.id);
							this.effects?.stop(go);
							this.states?.remove(o.id);
							for (const e of o.events ?? []) {
								this.fired.delete(e.id);
								this.touching.delete(e.id);
							}
						});
						if (o.lifetime) this.time.delayedCall(o.lifetime, () => {
							if (go.active) go.destroy();
						});
						applyBloodPresentation(go, o);
						this.actors.push({
							def: o,
							go,
							startX: o.x,
							startY: o.y
						});
						this.lighting?.bind(o, go);
						if (o.kind !== "tilemap" && o.kind !== "particles" && o.kind !== "group" && o.physics !== "none") {
							this.physics.add.existing(go, o.physics === "static");
							if (o.physics === "static") statics.push(go);
							else {
								go.body.setAllowGravity(o.gravity).setBounce(o.bounce).setCollideWorldBounds(true);
								actors.push(go);
								if (o.collision) classifiedActors.push(go);
							}
						};
						if (go.body && o.kind !== "tilemap") {
							const b = o.bodySettings ?? {}, sx = Math.abs(go.scaleX / (o.scale ?? 1)) || 1, sy = Math.abs(go.scaleY / (o.scale ?? 1)) || 1;
							if (b.shape === "circle" && go.body.setCircle) go.body.setCircle((b.radius ?? Math.min(o.width, o.height) / 2) / sx);
							else if (b.width !== undefined || b.height !== undefined) go.body.setSize((b.width ?? o.width) / sx, (b.height ?? o.height) / sy, false);
							if (b.offsetX !== undefined || b.offsetY !== undefined) go.body.setOffset((b.offsetX ?? 0) / sx, (b.offsetY ?? 0) / sy);
							if (go.body.setVelocity) {
								go.body.setVelocity(b.velocityX ?? 0, b.velocityY ?? 0);
								go.body.setAcceleration(b.accelerationX ?? 0, b.accelerationY ?? 0);
								go.body.setDrag(b.dragX ?? 0, b.dragY ?? 0);
								go.body.setMaxVelocity(b.maxVelocityX ?? 1e4, b.maxVelocityY ?? 1e4);
								go.body.setMass(b.mass ?? 1);
								go.body.setImmovable(b.immovable ?? false);
								go.body.pushable = b.pushable ?? true;
								go.body.setCollideWorldBounds(b.collideWorldBounds ?? true);
							};
							if (go.parentContainer && go.body.physicsType === Phaser.Physics.Arcade.DYNAMIC_BODY) {
								const original = go.body.postUpdate.bind(go.body);
								go.body.postUpdate = () => {
									const x = go.x, y = go.y;
									original();
									const dx = go.x - x, dy = go.y - y, m = go.parentContainer.getWorldTransformMatrix(), det = m.a * m.d - m.b * m.c;
									go.x = x + (m.d * dx - m.c * dy) / det;
									go.y = y + (-m.b * dx + m.a * dy) / det;
								};
							}
						};
						if (["collectible", "goal"].includes(o.behavior)) {
							if (!go.body) this.physics.add.existing(go, true);
							triggers.push({
								def: o,
								go
							});
						};
						if (o.behavior === "button") go.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
							if (this.gameUi?.isDisabled(o.id)) return;
							if (o.soundId && this.cache.audio.exists(o.soundId)) this.sound.play(o.soundId);
							if (o.targetScene && project.scenes.some((s) => s.id === o.targetScene)) this.scene.start(o.targetScene);
						});
						if (o.events?.some((e) => e.trigger === "click")) go.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
							if (this.gameUi?.isDisabled(o.id)) return;
							this.fireEvents(o.events ?? [], "click", o.id);
						});
						if (o.tween === "float" || o.behavior === "float") this.tweens.add({
							targets: go,
							y: o.y - 9,
							duration: 1400,
							yoyo: true,
							repeat: -1,
							ease: "Sine.inOut"
						});
						if (o.tween === "pulse") this.tweens.add({
							targets: go,
							alpha: .35,
							duration: 800,
							yoyo: true,
							repeat: -1,
							ease: "Sine.inOut"
						});
						if (o.tween === "spin") this.tweens.add({
							targets: go,
							angle: 360,
							duration: 2400,
							repeat: -1
						});
					};
					players.splice(0, players.length, ...this.actors.filter((a) => a.go.active && ["platformer", "topdown"].includes(a.def.behavior)).map((a) => a.go));
					if (spawned) setupInteractions(this.actors.slice(actorStart), triggers.slice(triggerStart));
					for (const actor of this.actors.slice(actorStart)) {
						this.collision?.bind(actor.def, actor.go);
						this.interaction?.bind(actor.def, actor.go);
						this.motionPaths?.bind(actor.def, actor.go);
						this.connections?.bind(actor.def, actor.go);
						this.projectiles?.bind(actor.def, actor.go);
					};
					factions?.refresh();
				};
				buildObjects(def.objects);
				this.refreshStaticBodies();
				this.physics.add.collider(actors, statics, undefined, (a, b) => this.collision?.canSeparate(a, b) ?? true);
				this.physics.add.collider(classifiedActors, actors, undefined, (a, b) => a !== b && (this.collision?.canSeparate(a, b) ?? true));
				const setupInteractions = (newActors, newTriggers) => {
					for (const trigger of newTriggers) this.physics.add.overlap(players, trigger.go, () => {
						if (!trigger.go.active || !trigger.go.visible) return;
						if (trigger.def.behavior === "collectible") {
							if (trigger.def.itemId) {
								const n = inventory?.give(trigger.def.itemId, trigger.def.itemQuantity ?? 1) ?? 0;
								if (!n) return;
								const remaining = (trigger.def.itemQuantity ?? 1) - n;
								if (remaining > 0) {
									trigger.def = {
										...trigger.def,
										itemQuantity: remaining
									};
									return;
								}
							};
							vars.score = (Number(vars.score) || 0) + trigger.def.value;
							if (trigger.def.soundId && this.cache.audio.exists(trigger.def.soundId)) this.sound.play(trigger.def.soundId);
							this.fireEvents(trigger.def.events ?? [], "collect", trigger.def.id);
							trigger.go.destroy();
							report("info", `아이템 획득 +${trigger.def.value}`);
						} else if (trigger.def.targetScene) this.scene.start(trigger.def.targetScene);
					});
					for (const actor of newActors) for (const event of actor.def.events ?? []) if (event.trigger === "overlap") {
						if (!actor.go.body) this.physics.add.existing(actor.go, true);
						const other = event.otherObjectId ? this.objectMap.get(event.otherObjectId) : undefined;
						if (other && !other.body) this.physics.add.existing(other, true);
						this.physics.add.overlap(other ?? players, actor.go, (a, b) => {
							if (a === b || !actor.go.active) return;
							const frame = this.game.loop.frame, last = this.touching.get(event.id) ?? -100;
							this.touching.set(event.id, frame);
							if (frame - last > 2) this.fireEvents([event], "overlap", actor.def.id, (a === actor.go ? b : a)?.getData?.("forgeObjectId"));
						});
					}
				};
				setupInteractions(this.actors, triggers);
				for (const actor of this.actors) this.collision?.bind(actor.def, actor.go);
				this.refreshStaticBodies();
				for (const event of def.events ?? []) if (event.enabled !== false && event.trigger === "key") {
					const seen = new WeakSet();
					const eventName = event.key === "ACTION" ? "keydown" : "keydown-" + (event.key ?? "SPACE");
					const handle = (e) => {
						if ((this.gameUi?.capturesInput() || framework?.capturesInput()) && !event.allowWhileUi) return;
						if (event.key === "ACTION" && e.code !== (frameworkSettings?.controls.action ?? "KeyZ")) return;
						if (e.ctrlKey || e.metaKey || e.altKey) return;
						if (seen.has(e) || e.repeat) return;
						seen.add(e);
						this.fireEvents([event], "key");
					};
					this.input.keyboard.on(eventName, handle);
					this.events.once("shutdown", () => this.input.keyboard.off(eventName, handle));
				};
				def.cameras.forEach((c, i) => {
					const cam = i === 0 ? this.cameras.main : this.cameras.add(c.x, c.y, c.width, c.height, false, c.name);
					cam.forgeCameraId = c.id;
					cam.setViewport(c.x, c.y, c.width, c.height).setName(c.name).setZoom(c.zoom).setScroll(c.scrollX, c.scrollY).setVisible(c.visible);
					if (c.bounds?.enabled === false) cam.removeBounds();
					else cam.setBounds(c.bounds?.x ?? 0, c.bounds?.y ?? 0, c.bounds?.width ?? def.worldWidth, c.bounds?.height ?? def.worldHeight);
					cam.setRotation((c.rotation ?? 0) * Math.PI / 180);
					if (c.deadzone?.enabled) cam.setDeadzone(c.deadzone.width, c.deadzone.height);
					const target = this.objectMap.get(c.follow);
					if (target) {
						let lastX = target.getWorldTransformMatrix().tx, lastY = target.getWorldTransformMatrix().ty;
						const followed = target.parentContainer ? {
							get x() {
								if (target.active) lastX = target.getWorldTransformMatrix().tx;
								return lastX;
							},
							get y() {
								if (target.active) lastY = target.getWorldTransformMatrix().ty;
								return lastY;
							}
						} : target;
						cam.startFollow(followed, c.roundPixels ?? project.pixelArt, c.lerp, c.lerp, c.followOffsetX ?? 0, c.followOffsetY ?? 0);
					};
					const saved = pendingCheckpoint?.sceneId === def.id && Array.isArray(pendingCheckpoint?.cameras) ? pendingCheckpoint.cameras.find((row) => row?.id === c.id) : undefined;
					if (saved && [
						"scrollX",
						"scrollY",
						"zoom",
						"rotation",
						"alpha"
					].every((key) => Number.isFinite(saved[key])) && saved.zoom > 0 && saved.zoom <= 100 && saved.alpha >= 0 && saved.alpha <= 1) {
						cam.setScroll(saved.scrollX, saved.scrollY).setZoom(saved.zoom).setRotation(saved.rotation).setAlpha(saved.alpha);
						if (typeof saved.visible === "boolean") cam.setVisible(saved.visible);
						if (saved.useBounds === false) cam.removeBounds();
						else if (saved.useBounds === true && saved.bounds && [
							"x",
							"y",
							"width",
							"height"
						].every((key) => Number.isFinite(saved.bounds[key])) && saved.bounds.width > 0 && saved.bounds.height > 0) cam.setBounds(saved.bounds.x, saved.bounds.y, saved.bounds.width, saved.bounds.height);
					};
					if (i > 0 && fixed.length) cam.ignore(fixed);
					if (c.effect === "fade") cam.fadeIn(650, 0, 0, 0);
					if (c.effect === "shake") cam.shake(500, .007);
					if (c.effect === "flash") cam.flash(500);
				});
				if (project.showScore) this.scoreText = this.add.text(project.width - 25, 25, "", {
					fontFamily: "monospace",
					fontSize: "18px",
					color: "#fff1ce",
					backgroundColor: "#192632",
					padding: {
						x: 10,
						y: 6
					}
				}).setOrigin(1, 0).setScrollFactor(0).setDepth(9999);
				if (this.scoreText) this.cameras.cameras.slice(1).forEach((c) => c.ignore(this.scoreText));
				this.ctx = {
					project,
					debugEnabled: !!options.editorInspection,
					presentation: {
						bloodMode: () => bloodMode,
						setBloodMode: (mode) => {
							if (![
								"off",
								"reduced",
								"full"
							].includes(mode)) throw Error("혈흔 표시는 끄기·약하게·보통 중 하나를 선택하세요.");
							bloodMode = mode;
							for (const scene of game.scene.getScenes(false)) for (const actor of scene.actors ?? []) if (actor.go.active) applyBloodPresentation(actor.go, actor.def);
						}
					},
					requirements: requirementsRuntime ? { check: requirementsRuntime.check } : undefined,
					progression: requirementsRuntime?.progression,
					framework,
					controls: {
						isDown: (name) => !framework?.capturesInput() && !!this.keys?.[name === "jump" ? "space" : name]?.isDown,
						justDown: (name) => !framework?.capturesInput() && !!this.keys?.[name === "jump" ? "space" : name] && Phaser.Input.Keyboard.JustDown(this.keys[name === "jump" ? "space" : name])
					},
					catalog: definitionFactory?.(project.definitions ?? []) ?? {},
					definition: (idOrKey) => {
						const record = project.definitions?.find((d) => d.published && (d.id === idOrKey || d.key === idOrKey));
						return record ? this.ctx.catalog[record.key] : undefined;
					},
					sceneBlueprint: (idOrName) => {
						const source = project.scenes.find((scene) => scene.id === idOrName || scene.name === idOrName);
						return source ? structuredClone(source) : undefined;
					},
					inventory: inventory ? new Proxy(inventory, { get: (target, key) => {
						const value = target[key];
						return typeof value === "function" ? (...args) => {
							activeItemScene = this;
							return value(...args);
						} : value;
					} }) : undefined,
					spawn: (id, x = project.width / 2, y = project.height / 2, options = {}) => {
						const prefab = project.prefabs.find((p) => p.id === id || p.name === id);
						if (!prefab) {
							report("error", "생성할 프리팹을 찾을 수 없습니다.");
							return null;
						};
						if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error("생성 위치는 유효한 숫자여야 합니다.");
						if (!options || typeof options !== "object") throw Error("생성 설정은 값과 대상 연결을 담은 객체여야 합니다.");
						this.actors = this.actors.filter((a) => !a.go.isDestroyed);
						for (const [key, go] of this.objectMap) if (go.isDestroyed) this.objectMap.delete(key);
						for (const list of [
							actors,
							statics,
							players,
							fixed,
							classifiedActors
						]) {
							const active = list.filter((go) => !go.isDestroyed);
							list.splice(0, list.length, ...active);
						};
						const source = prefab.objects ?? [prefab.object];
						const sourceIds = new Set(source.map((o) => o.id));
						for (const [id, targetId] of Object.entries(options.bindings ?? {})) {
							if (sourceIds.has(id)) throw Error("프리팹 내부 연결은 생성 인수로 바꿀 수 없습니다.");
							if (!this.objectMap.get(targetId)?.active) throw Error("생성할 프리팹의 외부 연결 대상이 현재 씬에 없습니다.");
						};
						const initial = {};
						for (const [key, raw] of Object.entries(options.values ?? {})) {
							if (key === "name") {
								if (typeof raw !== "string" || !raw.trim() || raw.length > 200) throw Error("생성할 이름은 1~200자여야 합니다.");
								initial[key] = raw;
							} else if (key === "color") {
								if (typeof raw !== "string" || !/^#[0-9a-fA-F]{6}$/.test(raw)) throw Error("생성 색은 #RRGGBB 형식이어야 합니다.");
								initial[key] = raw;
							} else {
								const limits = {
									opacity: [0, 1],
									rotation: [-36e3, 36e3],
									speed: [0, 1e4],
									value: [-1e9, 1e9],
									"gameplay.combat.maxHp": [1, 1e8]
								}, limit = limits[key], value = Number(raw);
								if (!limit || !(typeof raw === "number" || typeof raw === "string" && raw.trim()) || !Number.isFinite(value) || value < limit[0] || value > limit[1]) throw Error("생성할 " + key + " 값이 허용 범위를 벗어났습니다.");
								if (key === "gameplay.combat.maxHp" && !prefab.object.gameplay?.combat) throw Error("프리팹에 전투 설정이 없습니다.");
								initial[key] = value;
							}
						};
						if (this.actors.length + source.length > 5e3) {
							report("error", "실행 중 오브젝트가 5000개를 넘었습니다.");
							return null;
						};
						const mapping = new Map(source.map((o) => [o.id, runtimeId()])), objects = JSON.parse(JSON.stringify(source));
						const references = new Map([...mapping, ...Object.entries(options.bindings ?? {})]);
						for (const o of objects) {
							const old = o.id;
							o.id = mapping.get(old);
							o.parentId = o.parentId ? mapping.get(o.parentId) : undefined;
							for (const aim of o.rigPlayback?.aims ?? []) if (aim.targetId) aim.targetId = references.get(aim.targetId) ?? aim.targetId;
							if (o.gameplay?.agent?.targetId) o.gameplay.agent.targetId = references.get(o.gameplay.agent.targetId) ?? o.gameplay.agent.targetId;
							if (o.projectileGuidance) {
								for (const key of ["targetId", "ownerId"]) if (o.projectileGuidance[key]) o.projectileGuidance[key] = references.get(o.projectileGuidance[key]) ?? o.projectileGuidance[key];
							};
							if (o.lighting?.light?.follow === "object") o.lighting.light.targetId = references.get(o.lighting.light.targetId) ?? o.lighting.light.targetId;
							if (o.interaction) {
								o.interaction.targetIds = o.interaction.targetIds.map((id) => references.get(id) ?? id);
								if (o.interaction.areaObjectId) o.interaction.areaObjectId = references.get(o.interaction.areaObjectId) ?? o.interaction.areaObjectId;
							};
							if (o.connection) for (const anchor of [o.connection.start, o.connection.end]) {
								const bound = anchor.bindingKey ? options.bindings?.[anchor.bindingKey] : undefined;
								if (bound) {
									anchor.mode = "object";
									anchor.targetId = bound;
								} else if (anchor.mode === "object" && anchor.targetId) anchor.targetId = references.get(anchor.targetId) ?? anchor.targetId;
							};
							for (const e of o.events ?? []) {
								e.id = runtimeId();
								if (e.otherObjectId) e.otherObjectId = references.get(e.otherObjectId) ?? e.otherObjectId;
							};
							if (old === prefab.object.id) {
								delete o.parentId;
								o.x = x;
								o.y = y;
								for (const [key, value] of Object.entries(initial)) {
									if (key === "gameplay.combat.maxHp") o.gameplay.combat.maxHp = value;
									else o[key] = value;
								}
							};
							for (const b of o.effects ?? []) b.id = runtimeId();
							for (const binding of o.stateMachines ?? []) {
								binding.id = runtimeId();
								for (const slot of Object.keys(binding.targets)) binding.targets[slot] = references.get(binding.targets[slot]) ?? binding.targets[slot];
							}
						};
						buildObjects(objects, true);
						this.states?.sync();
						for (const o of objects) this.effects?.bind(this.objectMap.get(o.id), o.effects);
						this.refreshStaticBodies();
						this.syncUiCameras?.();
						return this.objectMap.get(mapping.get(prefab.object.id));
					},
					texture: (assetId, frame = 0) => {
						const asset = project.assets.find((a) => a.id === assetId);
						return asset ? sourceFor(asset, frame) : {
							key: assetId,
							frame
						};
					},
					applyResource: (target, resource) => {
						const go = typeof target === "string" ? this.ctx.find(target) : target;
						if (!go || !resource) return false;
						if (resource.kind === "animation" && go.play && this.anims.exists(resource.animationId)) {
							go.play(resource.animationId);
							return true;
						};
						if (resource.kind === "asset") {
							const asset = assetById.get(resource.assetId);
							if (asset && asset.type !== "audio" && go.setTexture) {
								const source = sourceFor(asset, resource.frame ?? 0);
								if (this.textures.exists(source.key) && this.textures.get(source.key).has(source.frame)) {
									go.anims?.stop();
									go.setTexture(source.key, source.frame);
									return true;
								}
							}
						};
						report("error", "적용할 리소스와 대상 오브젝트를 확인하세요.");
						return false;
					},
					scene: this,
					objects: this.objectMap,
					vars,
					data: this.startupData,
					storage: {
						load: async (key, fallback = null) => await storage("load", key) ?? fallback,
						save: (key, value) => storage("save", key, value),
						remove: (key) => storage("remove", key)
					},
					utils: {},
					physics2d: ropePhysicsFactory?.(Phaser, this),
					find: (name) => this.objectMap.get(name) ?? [...this.objectMap.values()].find((o) => o.name === name),
					goto: (id, data = {}) => {
						const scene = project.scenes.find((s) => s.id === id || s.name === id);
						if (scene) {
							const parent = overlayParents.get(def.id);
							if (parent) {
								this.scene.stop(parent);
								overlayParents.delete(def.id);
							};
							this.scene.start(scene.id, data);
						}
					},
					openOverlay: (id, data = {}) => {
						const target = project.scenes.find((s) => s.id === id || s.name === id);
						if (!target || target.id === def.id || this.scene.isActive(target.id)) return false;
						overlayParents.set(target.id, def.id);
						this.scene.launch(target.id, data);
						this.scene.pause(def.id);
						return true;
					},
					closeOverlay: () => {
						const parent = overlayParents.get(def.id);
						if (!parent) return false;
						overlayParents.delete(def.id);
						this.scene.resume(parent);
						this.scene.stop(def.id);
						return true;
					},
					notify: (message) => {
						const notice = this.add.text(project.width / 2, project.height / 2, message, {
							fontFamily: "system-ui",
							fontSize: "28px",
							color: "#b7c9e3",
							backgroundColor: "#192632",
							padding: {
								x: 24,
								y: 16
							},
							align: "center"
						}).setOrigin(.5).setScrollFactor(0).setDepth(1e4);
						this.time.delayedCall(2600, () => notice.destroy());
					},
					log: (message) => report("info", message),
					run: (id, args = {}, target) => {
						const fn = project.functions?.find((f) => f.id === id || f.name === id);
						return fn ? this.logic?.run(fn.id, args, target) : false;
					}
				};
				if (pendingCheckpoint?.sceneId === def.id && Array.isArray(pendingCheckpoint.spawned)) {
					const spawned = pendingCheckpoint.spawned.filter((o) => o && typeof o.id === "string" && !def.objects.some((base) => base.id === o.id));
					if (spawned.length + def.objects.length > 5e3) throw new Error("저장한 진행의 오브젝트가 5,000개를 넘습니다.");
					buildObjects(spawned, true);
				};
				this.timeline = timelineFactory?.(project, def.id, {
					apply: (id, property, value) => {
						const object = this.objectMap.get(id);
						if (!object?.active) return;
						const go = object.getData?.("forgeAnchor") ?? object;
						if (property === "scale") go.setScale(Math.max(1e-4, Math.min(1e4, value)) * (go.getData("forgeScaleX") || 1), Math.max(1e-4, Math.min(1e4, value)) * (go.getData("forgeScaleY") || 1));
						else if (property === "rotation") go.angle = value;
						else if (property === "opacity") go.alpha = Math.max(0, Math.min(1, value));
						else if (property === "visible") go.visible = value >= .5;
						else if (property === "frame") {
							const a = assetById.get(def.objects.find((o) => o.id === id)?.assetId ?? "");
							if (a && object.setTexture) {
								const src = sourceFor(a, Math.max(0, Math.round(value)));
								object.setTexture(src.key, src.frame);
							}
						} else go[property] = value;
						if (go.body?.updateFromGameObject) go.body.updateFromGameObject();
					},
					marker: (m) => this.logic?.run(m.functionId, m.args),
					error: (message) => report("error", message)
				});
				this.ctx.timeline = this.timeline;
				if (pendingCheckpoint?.sceneId === def.id) {
					for (const state of pendingCheckpoint.objects) {
						const object = this.objectMap.get(state.id);
						if (!object) continue;
						const go = object.getData?.("forgeAnchor") ?? object;
						for (const key of [
							"x",
							"y",
							"angle",
							"alpha",
							"scaleX",
							"scaleY"
						]) if (Number.isFinite(state[key])) go[key] = state[key];
						if (typeof state.visible === "boolean") go.visible = state.visible;
						if (typeof state.active === "boolean") object.setActive(state.active);
						if (state.pickupAmounts && typeof state.pickupAmounts === "object" && !Array.isArray(state.pickupAmounts) && Object.entries(state.pickupAmounts).every(([key, value]) => key.length > 0 && key.length <= 200 && typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 1e6)) object.setData("forgePickupAmounts", { ...state.pickupAmounts });
						if (state.frame !== undefined && object.setFrame && !this.actors.find((a) => a.go === object)?.def.rigPlayback?.enabled) object.setFrame(state.frame);
						if (object.setTilePosition && Number.isFinite(state.tilePositionX) && Number.isFinite(state.tilePositionY)) object.setTilePosition(state.tilePositionX, state.tilePositionY);
						if (go.body?.updateFromGameObject) go.body.updateFromGameObject();
						if (Number.isFinite(state.velocityX) && Number.isFinite(state.velocityY)) go.body?.setVelocity?.(state.velocityX, state.velocityY);
						if (Number.isFinite(state.accelerationX) && Number.isFinite(state.accelerationY)) go.body?.setAcceleration?.(state.accelerationX, state.accelerationY);
					};
					for (const actor of this.actors) applyBloodPresentation(actor.go, actor.def);
					this.ctx.resumed = true;
					this.ctx.checkpoint = pendingCheckpoint;
					pendingCheckpoint = null;
				};
				if (this.ctx.resumed) {
					const checkpoint = this.ctx.checkpoint;
					this.fired = new Set(checkpoint?.fired ?? []);
					for (const id of checkpoint?.removed ?? []) this.objectMap.get(id)?.destroy();
					this.actors = this.actors.filter((a) => !a.go.isDestroyed);
					for (const list of [
						actors,
						players,
						statics,
						fixed,
						classifiedActors
					]) {
						const live = list.filter((go) => !go.isDestroyed);
						list.splice(0, list.length, ...live);
					};
					this.timeline?.restore(checkpoint?.timelines ?? []);
				} else this.timeline?.autoplay();
				if (lightingFactory) {
					this.lighting = lightingFactory(project, def, this, () => this.actors, (message) => report("error", message));
					this.ctx.lighting = this.lighting;
					if (this.ctx.checkpoint?.lighting) this.lighting.restore(this.ctx.checkpoint.lighting);
				};
				factions ??= factionFactory?.(project.factionSettings, { actors: () => game.scene.getScenes(false).filter((scene) => scene.scene.isActive() || scene.scene.isPaused()).flatMap((scene) => scene.actors ?? []) });
				if (this.ctx.checkpoint?.factions && !factions?.restore(this.ctx.checkpoint.factions)) throw Error("저장된 진영 관계를 확인하세요.");
				this.ctx.factions = factions;
				if (interactionFactory) {
					const keys = new Map();
					this.interaction = interactionFactory({
						actors: () => this.actors,
						relation: (owner, other) => factions?.relation(factions.team(owner), factions.team(other)) ?? "neutral",
						fire: (id, trigger, other) => {
							const actor = this.actors.find((a) => a.def.id === id);
							if (actor) this.fireEvents(actor.def.events ?? [], trigger, id, other);
						},
						isKeyDown: (name) => {
							if (this.gameUi?.capturesInput() || framework?.capturesInput()) return false;
							let key = keys.get(name);
							if (!key) {
								key = this.input.keyboard?.addKey(name, false);
								if (key) keys.set(name, key);
							};
							return !!key?.isDown;
						}
					});
					for (const actor of this.actors) this.interaction.bind(actor.def, actor.go);
					if (this.ctx.checkpoint?.interaction) this.interaction.restore(this.ctx.checkpoint.interaction);
					this.ctx.interaction = this.interaction;
				};
				if (motionPathFactory) {
					this.motionPaths = motionPathFactory(this, () => this.actors, (message) => report("error", message));
					if (this.ctx.checkpoint?.motionPaths) this.motionPaths.restore(this.ctx.checkpoint.motionPaths);
					this.ctx.motionPaths = this.motionPaths;
				};
				if (projectileGuidanceFactory) {
					this.projectiles = projectileGuidanceFactory(project, this, {
						actors: () => this.actors,
						object: (id) => this.objectMap.get(id),
						run: (id, args, ownerId) => {
							this.logic?.run(id, args, ownerId);
						},
						relation: (owner, target) => factions?.relation(factions.team(owner), factions.team(target)) ?? "neutral",
						resolveTarget: (id, owner, source) => id === "$self" ? source : id === "$owner" ? owner : id === "$player" ? this.actors.find((a) => a.go.active && ["platformer", "topdown"].includes(a.def.behavior))?.def.id ?? "" : id === "$target" ? String(this.objectMap.get(owner)?.getData?.("aiTarget") ?? "") : id,
						paused: () => !!(this.gameUi?.capturesInput() || framework?.capturesInput()),
						error: (message) => report("error", message)
					});
					for (const actor of this.actors) this.projectiles.bind(actor.def, actor.go);
					if (this.ctx.checkpoint?.projectiles && !this.projectiles.restore(this.ctx.checkpoint.projectiles)) throw Error("저장된 유도 이동 상태를 확인하세요.");
					this.ctx.projectiles = this.projectiles;
					const updateProjectiles = (_time, delta) => this.projectiles?.update(delta);
					this.events.on("postupdate", updateProjectiles);
					this.events.once("shutdown", () => this.events.off("postupdate", updateProjectiles));
				};
				if (this.ctx.checkpoint?.particles) this.particles?.restore(this.ctx.checkpoint.particles);
				if (this.ctx.checkpoint?.collision) this.collision?.restore(this.ctx.checkpoint.collision);
				this.ctx.particles = this.particles;
				this.ctx.collision = this.collision;
				if (connectionFactory) {
					this.connections = connectionFactory(this, {
						actors: () => this.actors,
						source: (id, frame) => {
							const asset = assetById.get(id);
							return asset ? sourceFor(asset, frame) : undefined;
						},
						error: (message) => report("error", message)
					});
					for (const actor of this.actors) this.connections.bind(actor.def, actor.go);
					if (this.ctx.checkpoint?.connections) this.connections.restore(this.ctx.checkpoint.connections);
					this.connections.update(0);
					this.ctx.connections = this.connections;
					const updateConnections = (_time, delta) => this.connections?.update(delta);
					this.events.on("postupdate", updateConnections);
					this.events.once("shutdown", () => this.events.off("postupdate", updateConnections));
				};
				if (effectFactory) {
					this.effects = effectFactory(Phaser, project, this, (message) => report("error", message));
					this.ctx.effects = this.effects;
					this.effects.bind(this.cameras.main, def.effects);
					def.cameras.forEach((c, i) => this.effects?.bind(this.cameras.cameras[i], c.effects));
					for (const a of this.actors) if (a.go.active) this.effects.bind(a.go.getData?.("forgeAnchor") ?? a.go, a.def.effects);
				};
				this.ctx.music = music();
				if (this.ctx.checkpoint?.music) musicRuntime?.restore(this.ctx.checkpoint.music, def.id);
				else if (def.music) musicRuntime?.play(def.music.assetId, {
					volume: def.music.volume,
					loop: def.music.loop,
					fade: def.music.fadeIn,
					owner: def.id
				});
				if (stateFactory && machineFactory && project.stateMachines?.length) {
					this.states = stateFactory(project, def, {
						objects: this.objectMap,
						effect: (id, preset) => {
							const go = this.objectMap.get(id);
							if (go) {
								this.effects?.stop(go, undefined, "forge-state");
								if (preset) this.effects?.play(go, preset, { key: "forge-state" });
							}
						},
						actors: () => this.actors,
						variable: (id) => this.logic?.read(id),
						run: (id, args, target, alive) => {
							this.logic?.run(id, args, target || undefined, [], { remaining: 512 }, () => true, alive);
						},
						gravity: () => this.physics.world.gravity,
						factions: () => factions,
						error: (message) => report("error", message)
					}, machineFactory);
					this.ctx.states = this.states;
					const normalizedKey = (event) => event.code.replace(/^Key|^Digit/, "").replace(/^Arrow/, "").toUpperCase();
					const keyDown = (event) => !this.gameUi?.capturesInput() && this.states?.key(normalizedKey(event), true), keyUp = (event) => this.states?.key(normalizedKey(event), false), blur = () => this.states?.releaseKeys();
					this.input.keyboard.on("keydown", keyDown);
					this.input.keyboard.on("keyup", keyUp);
					window.addEventListener("blur", blur);
					this.events.once("shutdown", () => {
						this.input.keyboard?.off("keydown", keyDown);
						this.input.keyboard?.off("keyup", keyUp);
						window.removeEventListener("blur", blur);
					});
					this.states.start(this.ctx.checkpoint?.states ?? []);
				};
				if (gameplayFactory) {
					this.gameplay = gameplayFactory(project, def, {
						scene: this,
						actors: () => this.actors,
						objects: this.objectMap,
						factions: () => factions,
						skillAllowed: (skill, owner) => {
							if (!skill.definitionId) return !skill.requireLearned;
							const result = requirementsRuntime?.progression.use(skill.definitionId, { requireLearned: skill.requireLearned }) ?? {
								passed: false,
								reasons: ["스킬 조건 판정기를 사용할 수 없습니다."]
							};
							this.objectMap.get(owner)?.setData("requirementReasons", result.reasons);
							return result.passed;
						},
						states: () => this.states,
						run: (id, args, owner) => this.logic?.run(id, args, owner),
						write: (id, value) => {
							const v = project.variables.find((v) => v.id === id);
							if (v && typeof value === v.type && (v.type !== "number" || Number.isFinite(value))) vars[v.name] = value;
						},
						equipment: () => inventory?.stats() ?? {},
						error: (message) => report("error", message)
					});
					this.ctx.gameplay = this.gameplay;
					this.gameplay.restore(this.ctx.checkpoint?.gameplay ?? []);
				};
				if (gameUiFactory && def.objects.some((o) => o.gameUi?.enabled || o.gameUi?.buttonFrames?.enabled)) {
					const focusMarks = new Map();
					const uiObjects = new Set(), uiCamera = this.cameras.add(this.cameras.main.x, this.cameras.main.y, this.cameras.main.width, this.cameras.main.height).setName("게임 UI");
					const register = (go) => {
						const root = go?.getData?.("forgeAnchor") ?? go;
						if (!root) return;
						const visit = (node) => {
							uiObjects.add(node);
							node.cameraFilter &= ~uiCamera.id;
							node.setData?.("forgeGameUi", true);
							for (const child of node.list ?? []) visit(child);
						};
						visit(root);
					};
					const uiIds = new Set(def.objects.filter((o) => o.gameUi?.enabled).map((o) => o.id));
					let added = true;
					while (added) {
						added = false;
						for (const o of def.objects) if (o.parentId && uiIds.has(o.parentId) && !uiIds.has(o.id)) {
							uiIds.add(o.id);
							added = true;
						}
					};
					for (const id of uiIds) register(this.objectMap.get(id));
					this.syncUiCameras = () => {
						for (const go of uiObjects) if (!go.active) uiObjects.delete(go);
						const allowed = new Set(uiObjects);
						for (const go of uiObjects) for (let parent = go.parentContainer; parent; parent = parent.parentContainer) allowed.add(parent);
						for (const camera of this.cameras.cameras) if (camera !== uiCamera) for (const go of uiObjects) camera.ignore(go);
						const visit = (go) => {
							if (!allowed.has(go)) uiCamera.ignore(go);
							for (const child of go.list ?? []) visit(child);
						};
						for (const go of this.children.list) visit(go);
					};
					const worldAdded = (go) => {
						if (!uiObjects.has(go)) uiCamera.ignore(go);
					};
					this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, worldAdded);
					this.events.once("shutdown", () => this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, worldAdded));
					this.updateUiFrame = () => {
						for (const go of uiObjects) if (!go.active) uiObjects.delete(go);
						const main = this.cameras.main;
						if (uiCamera.x !== main.x || uiCamera.y !== main.y || uiCamera.width !== main.width || uiCamera.height !== main.height) uiCamera.setViewport(main.x, main.y, main.width, main.height);
						for (const [go, mark] of focusMarks) {
							if (!go.active || !go.visible) {
								mark.setVisible(false);
								continue;
							};
							const bounds = go.getBounds();
							mark.setVisible(true).setPosition(bounds.centerX, bounds.centerY).setSize(bounds.width + 8, bounds.height + 8);
						}
					};
					this.gameUi = gameUiFactory(project, def, {
						objects: this.objectMap,
						create: (definitions) => {
							if (this.actors.filter((a) => !a.go.isDestroyed).length + definitions.length > 5e3) throw Error("게임 UI의 반복 오브젝트가 전체 5000개 한도를 넘었습니다.");
							this.actors = this.actors.filter((a) => !a.go.isDestroyed);
							for (const [id, go] of this.objectMap) if (go.isDestroyed) this.objectMap.delete(id);
							for (const list of [
								actors,
								statics,
								players,
								fixed,
								classifiedActors
							]) {
								const live = list.filter((go) => !go.isDestroyed);
								list.splice(0, list.length, ...live);
							};
							buildObjects(definitions, true);
							for (const o of definitions) register(this.objectMap.get(o.id));
							this.syncUiCameras?.();
							return new Map(definitions.map((o) => [o.id, this.objectMap.get(o.id)]));
						},
						variable: (id) => this.logic?.read(id),
						writeVariable: (id, value) => {
							const variable = project.variables.find((v) => v.id === id);
							if (!variable || variable.type === "number" && (typeof value !== "number" || !Number.isFinite(value)) || variable.type === "boolean" && typeof value !== "boolean" || variable.type === "string" && typeof value !== "string") return false;
							const before = vars[variable.name];
							vars[variable.name] = typeof value === "string" ? value.slice(0, 1e4) : value;
							observatory?.variableChanged(id, before, vars[variable.name], "UI 입력");
							return true;
						},
						run: (id, args, target) => this.logic?.run(id, args, target),
						viewport: () => ({
							width: this.cameras.main.width,
							height: this.cameras.main.height
						}),
						error: (message) => report("error", message),
						gamepads: () => [...navigator.getGamepads?.() ?? []],
						inventory: () => inventory?.list().map(({ item, quantity }) => ({
							id: item.id,
							key: item.key,
							name: item.name,
							description: item.description,
							quantity,
							iconAssetId: item.iconAssetId,
							iconFrame: item.iconFrame,
							equipped: Object.values(inventory.equipment()).includes(item.id)
						})) ?? [],
						focus: (go, active) => {
							const previous = focusMarks.get(go);
							if (previous) {
								uiObjects.delete(previous);
								previous.destroy();
							};
							focusMarks.delete(go);
							if (!active || !go.active) return;
							const bounds = go.getBounds(), mark = this.add.rectangle(bounds.centerX, bounds.centerY, bounds.width + 8, bounds.height + 8).setFillStyle(0, 0).setStrokeStyle(2, 11454962).setScrollFactor(0).setDepth(10001);
							register(mark);
							this.syncUiCameras?.();
							focusMarks.set(go, mark);
						}
					});
					this.ctx.gameUi = this.gameUi;
					this.ctx.gameUi.attachVisual = (go) => {
						register(go);
						this.syncUiCameras?.();
						return go;
					};
					const keyDown = (event) => this.gameUi?.keyDown(event);
					this.input.keyboard?.on("keydown", keyDown);
					this.events.once("shutdown", () => {
						this.input.keyboard?.off("keydown", keyDown);
						for (const mark of focusMarks.values()) mark.destroy();
					});
					this.gameUi.update(0, 0);
					this.syncUiCameras();
				};
				this.rigs = rigFactory?.(project, this, {
					actors: () => this.actors,
					objects: this.objectMap,
					variable: (id) => this.logic?.read(id),
					texture: sourceFor,
					error: (message) => report("error", message)
				});
				this.ctx.rigs = this.rigs;
				this.rigs?.update(0);
				this.rigs?.restore(this.ctx.checkpoint?.rigs);
				for (const event of def.events ?? []) {
					if (event.enabled !== false && event.trigger === "timer") this.time.addEvent({
						delay: event.interval,
						loop: !event.once,
						callback: () => this.fireEvents([event], "timer")
					});
					if (event.enabled !== false && event.trigger === "change") this.variableEvents.set(event.id, this.logic?.read(event.variableId));
				};
				if (scriptFactory) {
					this.ctx.modules = scriptFactory(project, this.ctx, Phaser, (message) => report("error", message));
					this.ctx.modules.load();
				} else for (const script of project.scripts) try {
					const result = new Function("ctx", "Phaser", script.code)(this.ctx, Phaser);
					if (result && typeof result === "object") Object.assign(this.ctx.utils, result);
				} catch (e) {
					report("error", `${script.name}: ${e}`);
				};
				try {
					this.hooks = new Function("Phaser", `${def.code}\nreturn {create:typeof create==='function'?create:null,update:typeof update==='function'?update:null};`)(Phaser);
					this.hooks.create?.(this.ctx);
					this.fireEvents(def.events ?? [], "start");
				} catch (e) {
					report("error", `${def.name} create: ${e}`);
				};
				report("success", `${def.name} 실행 · Phaser ${Phaser.VERSION}`);
				if (window.parent !== window) window.parent.postMessage({
					source: "phaser-forge-runtime",
					level: "ready",
					sceneId: def.id,
					version: Phaser.VERSION
				}, "*");
			}
			refreshStaticBodies() {
				for (const actor of this.actors) {
					if (!actor.go.active) continue;
					const go = actor.go, o = {
						...actor.def,
						...this.states?.profile(actor.def.id)
					};
					const anchor = go.getData?.("forgeAnchor");
					if (anchor?.active && o.kind === "tilemap") {
						const matrix = anchor.getWorldTransformMatrix(), x = -anchor.width / 2, y = -anchor.height / 2;
						go.x = matrix.a * x + matrix.c * y + matrix.tx;
						go.y = matrix.b * x + matrix.d * y + matrix.ty;
						go.scaleX = Math.hypot(matrix.a, matrix.b) * anchor.width / (o.columns * (o.tileMap?.tileWidth ?? assetById.get(o.assetId)?.frameWidth ?? o.tileSize));
						go.scaleY = Math.hypot(matrix.c, matrix.d) * anchor.height / (o.rows * (o.tileMap?.tileHeight ?? assetById.get(o.assetId)?.frameHeight ?? o.tileSize));
						go.rotation = Math.atan2(matrix.b, matrix.a);
						go.visible = anchor.visible;
						go.alpha = anchor.alpha;
						let parent = anchor.parentContainer;
						while (parent) {
							go.visible = go.visible && parent.visible;
							go.alpha *= parent.alpha;
							parent = parent.parentContainer;
						}
					};
					if (!go.active || !go.body || go.body.physicsType !== Phaser.Physics.Arcade.STATIC_BODY) continue;
					const m = go.getWorldTransformMatrix(), signature = [
						m.a,
						m.b,
						m.c,
						m.d,
						m.tx,
						m.ty
					].join(",");
					if (go._forgeStaticPose === signature) continue;
					go._forgeStaticPose = signature;
					const sx = Math.hypot(m.a, m.b), sy = Math.hypot(m.c, m.d), baseX = Math.abs(go.scaleX / (o.scale ?? 1)) || 1, baseY = Math.abs(go.scaleY / (o.scale ?? 1)) || 1, b = o.bodySettings ?? {}, body = go.body;
					body.world.staticTree.remove(body);
					body.position.set(m.tx - (go.displayOriginX - (b.offsetX ?? 0) / baseX) * sx, m.ty - (go.displayOriginY - (b.offsetY ?? 0) / baseY) * sy);
					body.width = (b.shape === "circle" ? (b.radius ?? Math.min(o.width, o.height) / 2) * 2 : b.width ?? o.width) / baseX * sx;
					body.height = (b.shape === "circle" ? (b.radius ?? Math.min(o.width, o.height) / 2) * 2 : b.height ?? o.height) / baseY * sy;
					body.halfWidth = body.width / 2;
					body.halfHeight = body.height / 2;
					body.center.set(body.position.x + body.halfWidth, body.position.y + body.halfHeight);
					body.world.staticTree.insert(body);
				}
			}
			fireEvents(events, trigger, target, otherId) {
				for (const event of events) if (event.enabled !== false && event.trigger === trigger && (!otherId || !event.otherObjectId || event.otherObjectId === otherId) && (!event.once || !this.fired.has(event.id))) {
					if (event.once) this.fired.add(event.id);
					this.logic?.run(event.functionId, otherId ? Object.fromEntries(Object.entries(event.args).map(([key, value]) => [key, value === "$other" ? otherId : value === "$self" ? target ?? "" : value])) : event.args, target);
				}
			}
			update(time, delta) {
				if (!this.keys) return;
				this.gameUi?.update(time, delta);
				for (const actor of this.actors) if (actor.go.active && actor.def.background?.enabled && actor.go.setTilePosition) {
					const b = actor.def.background;
					actor.go.setTilePosition(actor.go.tilePositionX + b.speedX * delta / 1e3, actor.go.tilePositionY + b.speedY * delta / 1e3);
				};
				this.updateUiFrame?.();
				const uiCapturesInput = !!(this.gameUi?.capturesInput() || framework?.capturesInput());
				if (uiCapturesInput) this.states?.releaseKeys();
				this.states?.before(delta);
				this.timeline?.advance(delta);
				this.refreshStaticBodies();
				const k = this.keys;
				const dx = uiCapturesInput ? 0 : (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
				const dy = uiCapturesInput ? 0 : (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
				const wantsJump = !uiCapturesInput && this.actors.some((a) => (this.states?.profile(a.def.id)?.behavior ?? a.def.behavior) === "platformer" && a.go.active && a.go.body) && (Phaser.Input.Keyboard.JustDown(k.space) || Phaser.Input.Keyboard.JustDown(k.up) || Phaser.Input.Keyboard.JustDown(k.w));
				for (const a of this.actors) {
					const { go } = a, override = this.states?.profile(a.def.id), o = override ? {
						...a.def,
						...override
					} : a.def;
					if (!go.active) continue;
					if (this.motionPaths?.isDriving(o.id) || this.projectiles?.isDriving(o.id)) continue;
					if (go.getData?.("gameplayBlocked")) {
						(go.getData?.("forgeAnchor") ?? go).body?.setVelocity?.(0, 0);
						continue;
					};
					if (!o.stop && o.behavior === "platformer" && go.body?.setVelocity) {
						const gx = go.body.allowGravity ? this.physics.world.gravity.x + go.body.gravity.x : 0, gy = go.body.allowGravity ? this.physics.world.gravity.y + go.body.gravity.y : 0, length = Math.hypot(gx, gy), nx = length ? gx / length : 0, ny = length ? gy / length : 1, tx = ny, ty = -nx, normal = go.body.velocity.x * nx + go.body.velocity.y * ny;
						go.body.setVelocity(tx * dx * o.speed + nx * normal, ty * dx * o.speed + ny * normal);
						if (dx && go.setFlipX) go.setFlipX(dx < 0);
						const side = Math.abs(nx) > Math.abs(ny) ? nx > 0 ? "right" : "left" : ny > 0 ? "down" : "up";
						if (wantsJump && (go.body.blocked[side] || go.body.touching[side])) go.body.setVelocity(tx * dx * o.speed - nx * o.jump, ty * dx * o.speed - ny * o.jump);
					};
					if (!o.stop && o.behavior === "topdown" && go.body?.setVelocity) {
						const len = Math.hypot(dx, dy) || 1;
						go.body.setVelocity(dx / len * o.speed, dy / len * o.speed);
						if (dx && go.setFlipX) go.setFlipX(dx < 0);
					};
					if (!o.stop && o.behavior === "patrol" && go.body?.setVelocityX) go.body.setVelocityX(Math.cos(time / 1500) * o.speed);
					if (o.behavior === "rotate") go.angle += o.speed * delta / 1e3;
				};
				const zones = this.actors.filter((a) => a.def.behavior === "gravityZone" && a.go.active).sort((a, b) => (a.def.gravityField?.priority ?? 0) - (b.def.gravityField?.priority ?? 0));
				for (const actor of this.actors) {
					const go = actor.go, o = actor.def;
					if (!go.active || !go.body || go.body.physicsType !== Phaser.Physics.Arcade.DYNAMIC_BODY) continue;
					const b = o.bodySettings ?? {}, world = this.physics.world.gravity;
					let gx = b.gravityMode === "replace" ? b.gravityX ?? 0 : world.x + (b.gravityMode === "add" ? b.gravityX ?? 0 : 0), gy = b.gravityMode === "replace" ? b.gravityY ?? 900 : world.y + (b.gravityMode === "add" ? b.gravityY ?? 0 : 0);
					if (o.gravity && go.body.allowGravity) {
						const center = go.body.center;
						for (const zone of zones) {
							const point = zone.go.getWorldTransformMatrix().applyInverse(center.x, center.y), r = zone.def.renderSettings, ox = r?.originX ?? .5, oy = r?.originY ?? .5;
							if (point.x >= -zone.def.width * ox && point.x <= zone.def.width * (1 - ox) && point.y >= -zone.def.height * oy && point.y <= zone.def.height * (1 - oy)) {
								const field = zone.def.gravityField;
								if (field?.mode === "add") {
									gx += field.x;
									gy += field.y;
								} else {
									gx = field?.x ?? 0;
									gy = field?.y ?? -700;
								}
							}
						}
					};
					go.body.setGravity(gx - world.x, gy - world.y);
				};
				if (this.scoreText?.active) this.scoreText.setText("★ " + (vars.score ?? 0));
				for (const actor of this.actors) {
					if (actor.go.active && actor.def.textBinding && actor.go.setText) {
						const text = this.logic?.format(actor.def.textBinding);
						if (text !== undefined && actor.go.text !== text) actor.go.setText(text);
					}
				};
				for (const event of def.events ?? []) if (event.trigger === "change") {
					const value = this.logic?.read(event.variableId);
					if (!Object.is(value, this.variableEvents.get(event.id))) {
						this.variableEvents.set(event.id, value);
						this.fireEvents([event], "change");
					}
				};
				if (window.parent !== window && Math.floor(time / 250) !== Math.floor((time - delta) / 250)) window.parent.postMessage({
					source: "phaser-forge-runtime",
					level: "variables",
					values: Object.fromEntries(project.variables.map((v) => [v.name, typeof vars[v.name] === "string" ? vars[v.name].slice(0, 512) : vars[v.name]]))
				}, "*");
				if (this.hooks.update) try {
					this.hooks.update(this.ctx, time, delta);
				} catch (e) {
					report("error", `${def.name} update: ${e}`);
					this.hooks.update = null;
				};
				this.gameplay?.update(delta);
				this.interaction?.update(delta);
				this.states?.after();
				this.states?.endFrame();
				this.rigs?.update(delta);
				if (this.actorListDirty) this.pruneActors?.();
			}
		};
	});
	const first = options.startSceneId ?? project.startSceneId;
	const index = project.scenes.findIndex((s) => s.id === first);
	if (index > 0) {
		const [entry] = scenes.splice(index, 1);
		scenes.unshift(entry);
	};
	const game = new Phaser.Game({
		autoFocus: options.autoFocus !== false,
		type: options.renderer ?? Phaser.AUTO,
		parent: "game",
		width: project.width,
		height: project.height,
		backgroundColor: "#141a24",
		pixelArt: project.pixelArt,
		roundPixels: project.pixelArt,
		render: { maxLights: Math.max(16, ...project.scenes.map((s) => s.lighting?.maxLights ?? 16)) },
		banner: false,
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH
		},
		physics: {
			default: "arcade",
			arcade: {
				gravity: {
					x: 0,
					y: 900
				},
				debug: !!options.debug
			}
		},
		scene: scenes,
		audio: { disableWebAudio: false }
	});
	let debugPaused = false, debugTime = 0;
	const frameworkScene = () => game.scene.getScenes(false).find((s) => s.ctx && !overlayParents.has(s.scene.key) && (s.scene.isActive() || s.scene.isPaused()));
	const busSounds = new Map();
	const busGain = (sound) => sound.forgeMusicBus ? frameworkSettings?.musicVolume ?? 1 : frameworkSettings?.effectsVolume ?? 1;
	if (project.framework?.enabled && project.framework.modules.settings && game.sound) {
		const originalAdd = game.sound.add.bind(game.sound);
		game.sound.add = (...args) => {
			const sound = originalAdd(...args);
			const output = sound.pannerNode ?? sound.spatialNode ?? sound.volumeNode;
			const gain = output && game.sound.context?.createGain();
			if (gain) {
				output.disconnect(game.sound.destination);
				output.connect(gain);
				gain.connect(game.sound.destination);
			};
			const updateTagVolume = !gain && sound.updateVolume?.bind(sound);
			if (updateTagVolume) sound.updateVolume = () => {
				updateTagVolume();
				if (sound.audio) sound.audio.volume *= busGain(sound);
			};
			const state = {
				update: () => {
					if (gain) gain.gain.setValueAtTime(busGain(sound), game.sound.context.currentTime);
					else sound.updateVolume?.();
				},
				dispose: () => {
					gain?.disconnect();
				}
			};
			busSounds.set(sound, state);
			sound.on("play", state.update);
			sound.once("destroy", () => {
				state.dispose();
				busSounds.delete(sound);
			});
			state.update();
			return sound;
		};
	};
	if (project.framework?.enabled) framework = frameworkFactory?.(project, {
		mount: document.getElementById("game") ?? document.body,
		scene: () => {
			const s = frameworkScene();
			return s ? {
				id: s.scene.key,
				name: project.scenes.find((d) => d.id === s.scene.key)?.name ?? s.scene.key
			} : undefined;
		},
		progress: async (operation, key) => {
			const scene = frameworkScene();
			if (!scene?.progress) throw Error("실행 중인 게임 씬이 없습니다.");
			return scene.progress(operation, key);
		},
		storage: {
			load: async (key, fallback) => await storage("load", key) ?? fallback,
			save: (key, value) => storage("save", key, value),
			remove: (key) => storage("remove", key)
		},
		vars,
		run: (id, args) => {
			const scene = frameworkScene();
			scene?.ctx?.run(id, args);
		},
		pause: (paused) => {
			if (paused === frameworkPaused) return;
			frameworkPaused = paused;
			if (paused) {
				frameworkPausedScenes = game.scene.getScenes(true).map((s) => s.scene.key);
				for (const id of frameworkPausedScenes) game.scene.pause(id);
			} else {
				for (const id of frameworkPausedScenes) if (game.scene.isPaused(id)) game.scene.resume(id);
				frameworkPausedScenes = [];
			}
		},
		navigate: (id) => {
			if (!project.scenes.some((s) => s.id === id)) return;
			for (const s of game.scene.getScenes(false)) if (s.scene.isActive() || s.scene.isPaused()) game.scene.stop(s.scene.key);
			overlayParents.clear();
			game.scene.start(id);
		},
		reset: () => {
			pendingCheckpoint = null;
			factions?.dispose();
			factions = undefined;
			requirementsRuntime?.progression.reset();
			inventory?.restore({
				version: 1,
				quantities: Object.fromEntries((project.items ?? []).map((i) => [i.id, i.initialQuantity])),
				equipment: {}
			});
		},
		applySettings: (settings) => {
			frameworkSettings = settings;
			setMasterVolume(project.audioVolume * settings.masterVolume);
			game.sound.mute = settings.muted;
			if (game.sound.context) game.sound.masterMuteNode?.gain.setValueAtTime(settings.muted ? 0 : 1, game.sound.context.currentTime);
			for (const state of busSounds.values()) state.update();
			for (const s of game.scene.getScenes(false)) applyFrameworkKeys(s);
			if (game.canvas) game.canvas.style.imageRendering = settings.pixelated ? "pixelated" : "auto";
		},
		fullscreen: async (enabled) => {
			if (enabled) await document.documentElement.requestFullscreen?.();
			else if (document.fullscreenElement) await document.exitFullscreen();
		},
		error: (message) => report("error", message)
	});
	const collectDebugSnapshot = (only) => {
		const objectIds = only ? new Set(only.filter((w) => w.kind === "object").map((w) => w.sceneId + ":" + w.targetId)) : undefined;
		const sceneIds = only ? new Set(only.filter((w) => w.kind !== "variable").map((w) => w.sceneId)) : undefined;
		const runtimeScenes = game.scene.getScenes(false).filter((s) => s.objectMap && (s.scene.isActive() || s.scene.isPaused()) && (!sceneIds || sceneIds.has(s.scene.key)));
		const objects = runtimeScenes.flatMap((s) => [...s.objectMap].filter(([id]) => !objectIds || objectIds.has(s.scene.key + ":" + id)).map(([id, object]) => {
			const o = object.getData?.("forgeAnchor") ?? object, m = o.getWorldTransformMatrix?.();
			return {
				id,
				sceneId: s.scene.key,
				name: object.name || id,
				active: object.active,
				x: o.x,
				y: o.y,
				rotation: o.angle,
				opacity: o.alpha,
				scaleX: o.scaleX,
				scaleY: o.scaleY,
				visible: o.visible,
				worldX: m?.tx ?? o.x,
				worldY: m?.ty ?? o.y,
				velocityX: object.body?.velocity?.x,
				velocityY: object.body?.velocity?.y,
				body: object.body ? {
					x: object.body.x,
					y: object.body.y,
					width: object.body.width,
					height: object.body.height
				} : null
			};
		}));
		return {
			source: "phaser-forge-runtime",
			level: "inspect",
			objects,
			values: { ...vars },
			music: musicRuntime?.status(),
			states: only && !only.some((w) => w.kind === "state") ? [] : runtimeScenes.flatMap((s) => (s.states?.inspect() ?? []).map((entry) => ({
				...entry,
				sceneId: s.scene.key
			}))),
			timelines: runtimeScenes.flatMap((s) => s.timeline?.status() ?? [])
		};
	};
	const debugSnapshot = () => {
		if (window.parent !== window) window.parent.postMessage(collectDebugSnapshot(), "*");
		observatory?.flush();
	};
	const debugVariableNames = options.editorInspection ? new Map(project.variables.map((v) => [v.id, v.name])) : undefined;
	if (options.editorInspection && window.parent !== window) observatory = observatoryFactory?.({
		sample: collectDebugSnapshot,
		variableName: (id) => debugVariableNames?.get(id),
		send: (packet) => window.parent.postMessage({
			source: "phaser-forge-runtime",
			level: "observation",
			packet
		}, "*"),
		pause: () => {
			if (!debugPaused) {
				debugPaused = true;
				debugTime = game.loop.time;
				game.loop.sleep();
				game.sound.pauseAll();
			}
		}
	});
	const observationTimer = observatory ? setInterval(() => observatory?.flush(), 100) : undefined;
	if (options.observatoryConfig) observatory?.configure(options.observatoryConfig);
	const commands = (e) => {
		if (e.source !== window.parent || e.data?.source !== "phaser-forge-editor") return;
		if (e.data.action === "observeConfigure") observatory?.configure(e.data.config ?? { enabled: false });
		if (e.data.action === "observeClear") observatory?.clear();
		if (e.data.action === "pause") {
			debugPaused = true;
			debugTime = game.loop.time;
			game.loop.sleep();
			game.sound.pauseAll();
		};
		if (e.data.action === "resume") {
			debugPaused = false;
			game.loop.wake();
			game.sound.resumeAll();
		};
		if (e.data.action === "step" && debugPaused) {
			debugTime += 1e3 / 60;
			game.loop.frame++;
			game.loop.time = debugTime;
			game.loop.delta = 1e3 / 60;
			game.step(debugTime, 1e3 / 60);
			debugSnapshot();
		};
		if (e.data.action === "effectPreview") {
			const s = game.scene.getScenes(true).find((s) => s.ctx);
			if (s?.effects && e.data.preset) {
				const views = s.forgeEffectPreviewViews ??= new Map(s.cameras.cameras.map((c) => [c, {
					x: c.x,
					y: c.y,
					width: c.width,
					height: c.height,
					zoomX: c.zoomX,
					zoomY: c.zoomY,
					scrollX: c.scrollX,
					scrollY: c.scrollY,
					rotation: c.rotation,
					visible: c.visible,
					useBounds: c.useBounds,
					bounds: c._bounds && {
						x: c._bounds.x,
						y: c._bounds.y,
						width: c._bounds.width,
						height: c._bounds.height
					},
					follow: c._follow,
					lerpX: c.lerp?.x,
					lerpY: c.lerp?.y,
					offsetX: c.followOffset?.x,
					offsetY: c.followOffset?.y,
					roundPixels: c.roundPixels
				}]));
				for (const c of s.cameras.cameras) s.effects.stop(c, undefined, "forge-preview");
				for (const go of s.ctx.objects.values()) s.effects.stop(go, undefined, "forge-preview");
				for (const [c, b] of views) {
					c.stopFollow();
					c.removeBounds();
					c.setViewport(b.x, b.y, b.width, b.height).setZoom(b.zoomX, b.zoomY).setRotation(b.rotation).setScroll(b.scrollX, b.scrollY).setVisible(b.visible);
					if (b.useBounds && b.bounds) c.setBounds(b.bounds.x, b.bounds.y, b.bounds.width, b.bounds.height);
					if (b.follow) c.startFollow(b.follow, b.roundPixels, b.lerpX, b.lerpY, b.offsetX, b.offsetY);
				};
				s.effects.upsert(e.data.preset);
				const target = e.data.mode === "camera" ? s.cameras.cameras.find((c) => c.forgeCameraId === e.data.cameraId) ?? s.cameras.main : s.ctx.find(e.data.targetId || "효과 대상");
				const object = e.data.mode === "camera" ? null : s.ctx.find(e.data.targetId || "효과 대상");
				if (e.data.fit && target) {
					const view = e.data.mode === "camera" ? target : s.cameras.cameras.find((c) => c.visible && !(object.cameraFilter & c.id)) ?? s.cameras.main;
					const width = game.scale.width, height = game.scale.height;
					for (const c of s.cameras.cameras) c.setVisible(c === view);
					view.stopFollow();
					view.removeBounds();
					if (e.data.mode === "camera") {
						const b = views.get(view), factor = Math.min(width / b.width, height / b.height);
						view.setViewport((width - b.width * factor) / 2, (height - b.height * factor) / 2, b.width * factor, b.height * factor).setZoom(b.zoomX * factor, b.zoomY * factor);
						view.centerOn(b.scrollX + b.width / 2, b.scrollY + b.height / 2);
					} else {
						const b = object.getBounds();
						view.setViewport(0, 0, width, height).setRotation(0);
						view.setZoom(Math.max(.001, Math.min(16, Math.min(width / Math.max(1, b.width), height / Math.max(1, b.height)) * .75)));
						view.centerOn(b.centerX, b.centerY);
					}
				};
				if (e.data.enabled !== false) s.effects.play(target, e.data.preset.id, { key: "forge-preview" });
			}
		};
		if (e.data.action === "debugCommand") {
			if (!options.editorInspection) return;
			const requestId = String(e.data.requestId ?? "").slice(0, 100), d = e.data.command ?? {}, reply = (ok, value, message) => {
				window.parent.postMessage({
					source: "phaser-forge-runtime",
					level: "debugResult",
					result: {
						requestId,
						ok,
						value,
						message
					}
				}, "*");
				debugSnapshot();
			};
			try {
				const typed = (type, input) => {
					if (type === "number") {
						if (input === null || typeof input === "object" || typeof input === "boolean" || typeof input === "string" && !input.trim() || !Number.isFinite(Number(input))) throw Error("유한한 숫자를 입력하세요.");
						return Number(input);
					};
					if (type === "boolean") {
						if (input === true || input === "true") return true;
						if (input === false || input === "false") return false;
						throw Error("참/거짓 값을 확인하세요.");
					};
					if (input && typeof input === "object") throw Error("문자열을 입력하세요.");
					return String(input ?? "").slice(0, 1e4);
				};
				if (d.action === "getVariable" || d.action === "setVariable") {
					const v = project.variables.find((v) => v.id === d.id);
					if (!v) throw Error("정식 게임 변수를 선택하세요.");
					if (d.action === "getVariable") reply(true, vars[v.name]);
					else {
						const value = typed(v.type, d.value), before = vars[v.name];
						vars[v.name] = value;
						observatory?.variableChanged(v.id, before, value, "점검 중 수정");
						reply(true, value, "적용됨");
					};
					return;
				};
				let s = game.scene.getScenes(true).find((s) => s.scene.key === d.sceneId);
				if (d.action === "game" && typeof s?.data?.get?.("spaceGame")?.debug !== "function") s = game.scene.getScenes(true).find((scene) => typeof scene.data?.get?.("spaceGame")?.debug === "function");
				if (!s?.ctx) throw Error("선택한 씬이 실행 중이 아닙니다.");
				if (d.action === "game") {
					const api = s.data?.get?.("spaceGame");
					if (typeof api?.debug !== "function") throw Error("이 게임은 전용 값 점검을 제공하지 않습니다.");
					if (!/^(\$fields|credits|tick|ship\.(hull|shield|energy|heat|fuel|speed|velocity\.[xy]))$/.test(String(d.path))) throw Error("편집할 수 없는 게임 값입니다.");
					const result = api.debug({
						path: d.path,
						...Object.hasOwn(d, "value") ? { value: typed("number", d.value) } : {}
					});
					if (!result?.ok) throw Error(result?.reason ?? "게임 값 적용이 거절됐습니다.");
					reply(true, result.value, Object.hasOwn(d, "value") ? "게임 값 적용됨" : "게임 값");
					return;
				};
				if (d.action === "runFunction") {
					const fn = project.functions?.find((f) => f.id === d.id);
					if (!fn) throw Error("함수를 찾지 못했습니다.");
					if (d.objectId && !s.objectMap?.get(d.objectId)?.active) throw Error("함수 실행 대상이 없습니다.");
					const input = d.args ?? {};
					if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !fn.parameters.some((p) => p.name === key))) throw Error("함수 인수를 확인하세요.");
					const args = Object.fromEntries(fn.parameters.map((p) => [p.name, typed(p.type, Object.hasOwn(input, p.name) ? input[p.name] : p.value)])), accepted = s.logic.run(fn.id, args, d.objectId || undefined, [], { remaining: 512 }, () => true, () => !!s.runToken?.active);
					if (accepted === false) throw Error("함수 실행이 거절됐습니다. 실행 기록을 확인하세요.");
					reply(true, args, "함수 실행 요청됨");
					return;
				};
				if (d.action === "setObject") {
					const object = s.objectMap?.get(d.id);
					if (!object?.active) throw Error("편집할 실행 오브젝트가 없습니다.");
					const property = d.property, go = object.getData?.("forgeAnchor") ?? object;
					if (![
						"x",
						"y",
						"rotation",
						"opacity",
						"visible",
						"velocityX",
						"velocityY"
					].includes(property)) throw Error("읽기 전용 속성입니다.");
					const value = typed(property === "visible" ? "boolean" : "number", d.value);
					if (property === "visible") go.visible = value;
					else if (property === "rotation") go.angle = value;
					else if (property === "opacity") {
						if (Number(value) < 0 || Number(value) > 1) throw Error("불투명도는 0~1입니다.");
						go.alpha = value;
					} else if (property === "velocityX" || property === "velocityY") {
						const setter = property === "velocityX" ? "setVelocityX" : "setVelocityY";
						if (typeof object.body?.[setter] !== "function") throw Error("물리 몸체가 없어 속도를 수정할 수 없습니다.");
						object.body[setter](value);
					} else {
						if (Math.abs(Number(value)) > 1e7) throw Error("위치 범위를 넘었습니다.");
						go[property] = value;
					};
					go.body?.updateFromGameObject?.();
					s.refreshStaticBodies?.();
					reply(true, value, "적용됨");
					return;
				};
				if (d.action === "stateCommand" && d.command === "set") {
					const binding = s.states?.inspect().find((row) => row.owner === (d.owner || "") && row.bindingId === d.bindingId), parameter = binding?.parameters.find((p) => p.id === d.key || p.name === d.key);
					if (!parameter) throw Error("실행 중인 상태 매개변수가 없습니다.");
					if (parameter.type === "trigger") throw Error("트리거는 값으로 수정할 수 없습니다.");
					const value = typed(parameter.type ?? typeof parameter.value, d.value);
					s.states.set(d.owner || "", d.key, value, d.bindingId);
					reply(true, value, "적용됨");
					return;
				};
				throw Error("지원하지 않는 점검 명령입니다.");
			} catch (error) {
				reply(false, undefined, error instanceof Error ? error.message : String(error));
			};
			return;
		};
		if (e.data.action === "inspect") debugSnapshot();
		if (e.data.action === "stateCommand") {
			const s = game.scene.getScenes(true).find((s) => s.scene.key === e.data.sceneId), d = e.data, owner = d.owner || "", machine = d.bindingId;
			if (s?.states && s.states.inspect().some((entry) => entry.owner === owner && entry.bindingId === machine)) {
				if (d.command === "set") s.states.set(owner, d.key, d.value, machine);
				else if (d.command === "trigger") s.states.trigger(owner, d.key, machine);
				else if (d.command === "signal") s.states.signal(owner, String(d.key).slice(0, 200), machine);
				else if (d.command === "change") s.states.change(owner, d.layerId, d.stateId, machine);
				else if (d.command === "enable") s.states.enable(owner, !!d.value, machine);
				else if (d.command === "layer") s.states.enableLayer(owner, d.layerId, !!d.value, machine);
				else if (d.command === "reset") s.states.reset(owner, machine);
				debugSnapshot();
			}
		};
		if (e.data.action === "setVariable") {
			const variable = project.variables.find((v) => v.id === e.data.id);
			if (variable) {
				const value = variable.type === "number" ? Number(e.data.value) : variable.type === "boolean" ? e.data.value === true || e.data.value === "true" : String(e.data.value ?? "").slice(0, 1e4);
				if (variable.type !== "number" || Number.isFinite(value)) {
					const before = vars[variable.name];
					vars[variable.name] = value;
					observatory?.variableChanged(variable.id, before, value, "점검 중 수정");
					debugSnapshot();
				}
			}
		};
		if (e.data.action === "setObject") {
			const scene = game.scene.getScenes(true).find((s) => s.scene.key === e.data.sceneId), object = scene?.objectMap?.get(e.data.id), property = e.data.property, value = Number(e.data.value);
			if (object && Number.isFinite(value) && [
				"x",
				"y",
				"rotation",
				"opacity",
				"visible",
				"velocityX",
				"velocityY"
			].includes(property)) {
				const go = object.getData?.("forgeAnchor") ?? object;
				if (property === "rotation") go.angle = value;
				else if (property === "opacity") go.alpha = Math.max(0, Math.min(1, value));
				else if (property === "visible") go.visible = value >= .5;
				else if (property === "velocityX" && object.body?.setVelocityX) object.body.setVelocityX(value);
				else if (property === "velocityY" && object.body?.setVelocityY) object.body.setVelocityY(value);
				else if (property === "x" || property === "y") go[property] = Math.max(-1e7, Math.min(1e7, value));
				go.body?.updateFromGameObject?.();
				scene.refreshStaticBodies?.();
				debugSnapshot();
			}
		};
		if (e.data.action === "runFunction") {
			const scene = game.scene.getScenes(true).find((s) => s.scene.key === e.data.sceneId) || game.scene.getScenes(true).find((s) => s.ctx);
			if (scene?.logic && project.functions?.some((f) => f.id === e.data.id)) {
				try {
					scene.logic.run(e.data.id, e.data.args && typeof e.data.args === "object" ? e.data.args : {}, e.data.objectId || undefined, [], { remaining: 512 }, () => true, () => !!scene.runToken?.active);
				} catch (error) {
					report("error", error);
				}
			};
			debugSnapshot();
		};
		if (e.data.action === "inventory" && inventory) {
			const item = project.items?.find((i) => i.id === e.data.itemId);
			if (!item) return;
			activeItemScene = game.scene.getScenes(true).find((s) => s.ctx) ?? activeItemScene;
			try {
				if (e.data.operation === "use") inventory.use(item.id);
				if (e.data.operation === "equip") inventory.equip(item.id);
				if (e.data.operation === "unequip") inventory.unequip(item.slot);
			} catch (error) {
				report("error", error);
			}
		}
	};
	window.addEventListener("message", commands);
	const stats = setInterval(() => {
		if (window.parent !== window) window.parent.postMessage({
			source: "phaser-forge-runtime",
			level: "stats",
			inventory: inventory?.serialize(),
			fps: game.loop.actualFps,
			objects: game.scene.getScenes(true).reduce((n, s) => n + s.children.length, 0)
		}, "*");
	}, 1e3);
	game.events.once("destroy", () => {
		observatory?.dispose();
		clearInterval(observationTimer);
		framework?.dispose();
		musicRuntime?.destroy();
		factions?.dispose();
		clearInterval(stats);
		window.removeEventListener("message", commands);
	});
	return game;
})(Phaser,project,{},function createGameLogic(project, vars, effects) {
	const definitions = new Map(project.variables.map((v) => [v.id, v]));
	const functions = new Map((project.functions ?? []).map((f) => [f.id, f]));
	let callSequence = 0;
	const pending = new Map();
	const convert = (value, type) => type === "number" ? Number.isFinite(Number(value)) ? Number(value) : 0 : type === "boolean" ? value === true || value === "true" : String(value ?? "");
	const read = (ref, args) => !ref ? "" : ref.source === "definition" ? (() => {
		const [definitionId, fieldId] = ref.value.split("/");
		const d = project.definitions?.find((d) => d.id === definitionId && d.published), f = d?.fields.find((f) => f.id === fieldId && f.published);
		if (!f) return "";
		if (f.type === "number") return Number(f.value) || 0;
		if (f.type === "boolean") return f.value === "true";
		if ([
			"json",
			"reference-list",
			"resource",
			"resource-list"
		].includes(f.type)) {
			try {
				return JSON.parse(f.value);
			} catch {
				return null;
			}
		};
		return f.value;
	})() : ref.source === "variable" ? vars[definitions.get(ref.value)?.name ?? ""] : ref.source === "parameter" ? args[ref.value] : ref.value;
	const format = (binding) => {
		const v = definitions.get(binding.variableId);
		let value = v ? vars[v.name] : "";
		if (typeof value === "number") value = binding.digits > 0 ? value.toFixed(binding.digits) : String(value);
		return binding.prefix + String(value ?? "") + binding.suffix;
	};
	const describe = (text) => text.replace(/\{\{([A-Za-z_$][\w$]*)\}\}/g, (_, name) => String(vars[name] ?? ""));
	const run = (id, input = {}, target, stack = [], budget = { remaining: 512 }, done = () => true, active = () => true, parentCallId) => {
		const fn = functions.get(id);
		const watching = !!effects.observe && !!effects.observing?.(id, stack);
		const callId = watching ? String(++callSequence) : "";
		const started = watching ? Date.now() : 0;
		let ended = false;
		const emit = (kind, detail = {}) => {
			if (!watching) return;
			try {
				effects.observe?.({
					kind,
					functionId: id,
					functionName: fn?.name ?? id,
					callId,
					parentCallId,
					stack: [...stack, id],
					time: Date.now(),
					target,
					...detail
				});
			} catch {}
		};
		const end = (kind = "return", message) => {
			if (!watching || ended) return;
			ended = true;
			pending.delete(callId);
			emit(kind, {
				duration: Date.now() - started,
				message
			});
		};
		const fail = (message) => {
			emit("error", { message });
			effects.error(message);
		};
		if (!fn) {
			fail("연결된 게임 함수를 찾을 수 없습니다.");
			return false;
		};
		if (stack.includes(id) || stack.length >= 16) {
			fail("게임 함수의 순환 호출을 중단했습니다: " + fn.name);
			return false;
		};
		const args = Object.fromEntries(fn.parameters.map((p) => [p.name, convert(Object.hasOwn(input, p.name) ? input[p.name] : p.value, p.type)]));
		emit("call", { args });
		if (watching) pending.set(callId, () => end("cancel", "씬 종료로 중단"));
		const complete = () => {
			end();
			return done();
		};
		const execute = (steps, finish = complete) => {
			if (!active()) {
				end("cancel");
				return false;
			};
			try {
				for (let index = 0; index < steps.length; index++) {
					if (!active()) {
						end("cancel");
						return false;
					};
					const step = steps[index], rest = () => execute(steps.slice(index + 1), finish);
					if (watching) emit("step", {
						stepId: step.id,
						stepKind: step.kind
					});
					if (--budget.remaining < 0) {
						fail("한 이벤트의 동작이 512개를 넘었습니다.");
						end("cancel");
						return false;
					};
					if (step.kind === "script") {
						if (!effects.script) throw Error("공통 코드 호출은 게임 실행에서 확인하세요.");
						const input = Object.fromEntries(Object.entries(step.scriptArgs ?? {}).map(([key, value]) => [key, read(value, args)]));
						const result = effects.script(step.targetId ?? "", step.property ?? "", input, step.objectId === "$self" ? target ?? "" : step.objectId || target || "");
						const record = (value) => {
							if (!step.resultVariableId) return;
							const variable = definitions.get(step.resultVariableId);
							if (!variable) throw Error("코드 실행 결과의 변수가 연결되지 않았습니다.");
							const before = vars[variable.name], after = convert(value, variable.type);
							vars[variable.name] = after;
							effects.variableChanged?.(variable.id, before, after, id);
							emit("variable", {
								variableId: variable.id,
								before,
								after,
								stepId: step.id
							});
						};
						if (result && typeof result.then === "function") {
							emit("wait", {
								stepId: step.id,
								message: "공통 코드 응답 대기"
							});
							void Promise.resolve(result).then((value) => {
								if (!active()) {
									end("cancel");
									return;
								};
								record(value);
								emit("resume");
								rest();
							}).catch((error) => {
								if (active()) fail(String(error));
								end("cancel");
							});
							return true;
						};
						record(result);
						continue;
					};
					if (step.kind === "wait") {
						if (!effects.wait) {
							fail("동작 대기는 게임 실행에서 확인하세요.");
							end("cancel");
							return false;
						};
						emit("wait", {
							duration: Math.max(16, step.duration ?? 500),
							stepId: step.id
						});
						effects.wait(Math.max(16, step.duration ?? 500), () => {
							if (!active()) {
								end("cancel");
								return;
							};
							emit("resume");
							rest();
						});
						return true;
					};
					if (step.kind === "storage") {
						if (!effects.storage) {
							fail("게임 저장·불러오기는 게임 실행에서 확인하세요.");
							end("cancel");
							return false;
						};
						emit("wait", {
							message: "저장 장치 응답 대기",
							stepId: step.id
						});
						void effects.storage(step.property ?? "save", step.text || "checkpoint").then((ok) => {
							if (ok === undefined) {
								end("cancel", "불러오기 후 씬 재시작");
								return;
							};
							emit("resume");
							execute(ok ? step.then ?? [] : step.otherwise ?? [], rest);
						}).catch((error) => {
							fail(String(error));
							execute(step.otherwise ?? [], rest);
						});
						return true;
					};
					if (step.kind === "requirements" || step.kind === "progression") {
						const result = effects.requirement?.(step, read(step.value, args)) ?? {
							passed: false,
							reasons: ["조건과 진행 판정기를 게임 실행에서 확인하세요."]
						};
						for (const [variableId, value, type] of [[
							step.resultVariableId,
							result.passed,
							"boolean"
						], [
							step.reasonVariableId,
							result.reasons.join("\n"),
							"string"
						]]) {
							if (!variableId) continue;
							const variable = definitions.get(variableId);
							if (!variable || variable.type !== type) {
								fail("조건 판정 결과의 " + (type === "boolean" ? "참거짓" : "문자열") + " 변수를 확인하세요.");
								continue;
							};
							const before = vars[variable.name];
							vars[variable.name] = value;
							effects.variableChanged?.(variable.id, before, value, id);
						};
						emit("condition", {
							stepId: step.id,
							after: result.passed,
							message: result.reasons.join(" / ")
						});
						return execute(result.passed ? step.then ?? [] : step.otherwise ?? [], rest);
					};
					if ([
						"object",
						"tween",
						"spawn",
						"destroy",
						"camera",
						"gravity",
						"item",
						"timeline",
						"state",
						"music",
						"effect",
						"rig",
						"agent",
						"combat",
						"framework",
						"lighting",
						"interaction",
						"particles",
						"motionPath",
						"collision",
						"faction",
						"connection",
						"projectileGuidance"
					].includes(step.kind)) {
						effects.action?.(step.targetValue ? {
							...step,
							targetId: String(read(step.targetValue, args) ?? "")
						} : step, read(step.value, args), step.objectId === "$self" ? target : step.objectId || target, step.kind === "spawn" ? Object.fromEntries(Object.entries(step.spawnValues ?? {}).map(([key, value]) => [key, read(value, args)])) : undefined);
					} else if (step.kind === "value") {
						const variable = definitions.get(step.variableId ?? "");
						if (!variable) {
							fail(fn.name + ": 변수가 연결되지 않았습니다.");
							continue;
						};
						const value = convert(read(step.value, args), variable.type);
						let next = value;
						if (step.operation && step.operation !== "set" && variable.type === "number") {
							const before = Number(vars[variable.name]) || 0, n = Number(value);
							next = step.operation === "add" ? before + n : step.operation === "subtract" ? before - n : before * n;
						};
						if (typeof next === "number" && !Number.isFinite(next)) {
							fail(fn.name + ": 계산 결과가 수의 범위를 벗어났습니다.");
							continue;
						};
						const before = vars[variable.name];
						vars[variable.name] = next;
						if (watching) emit("variable", {
							stepId: step.id,
							variableId: variable.id,
							before,
							after: next
						});
						try {
							effects.variableChanged?.(variable.id, before, next, id);
						} catch {}
					} else if (step.kind === "condition") {
						const variable = definitions.get(step.variableId ?? "");
						if (!variable) {
							fail(fn.name + ": 조건 변수가 연결되지 않았습니다.");
							continue;
						};
						const a = vars[variable.name], b = convert(read(step.value, args), variable.type);
						const yes = step.compare === "eq" ? a === b : step.compare === "ne" ? a !== b : step.compare === "lt" ? Number(a) < Number(b) : step.compare === "lte" ? Number(a) <= Number(b) : step.compare === "gt" ? Number(a) > Number(b) : Number(a) >= Number(b);
						if (watching) emit("condition", {
							stepId: step.id,
							variableId: variable.id,
							before: a,
							after: yes
						});
						return execute(yes ? step.then ?? [] : step.otherwise ?? [], rest);
					} else if (step.kind === "scene") {
						end("cancel", "씬 이동");
						effects.scene(step.targetId ?? "", step.property);
						return false;
					} else if (step.kind === "sound") {
						const resource = step.property === "definition" ? read(step.value, args) : null;
						const id = step.property === "definition" ? resource?.kind === "asset" ? resource.assetId : "" : step.targetId;
						if (id && (step.property !== "definition" || project.assets.some((a) => a.id === id && a.type === "audio"))) effects.sound(id);
						else fail(fn.name + ": 재생할 소리 연결을 확인하세요.");
					} else if (step.kind === "message") effects.message(describe(step.text ?? ""));
					else if (step.kind === "animation") {
						const resource = step.property === "definition" ? read(step.value, args) : null;
						const id = step.property === "definition" ? resource?.kind === "animation" ? resource.animationId : "" : step.targetId;
						if (id && (step.property !== "definition" || project.animations.some((a) => a.id === id))) effects.animation(id, step.objectId || target);
						else fail(fn.name + ": 재생할 애니메이션 연결을 확인하세요.");
					} else if (step.kind === "function") {
						const childResult = run(step.targetId ?? "", args, target, [...stack, id], budget, rest, active, callId || parentCallId);
						if (!childResult) end("cancel", "하위 함수 중단");
						return childResult;
					}
				};
				return finish();
			} catch (error) {
				emit("error", { message: String(error) });
				end("cancel");
				throw error;
			}
		};
		return execute(fn.steps);
	};
	return {
		run,
		format,
		cancelObservations: () => {
			for (const cancel of [...pending.values()]) cancel();
			pending.clear();
		},
		read: (id) => vars[definitions.get(id)?.name ?? ""]
	};
},function createInventory(project, effect = () => {}, canUse = () => true) {
	const definitions = project.items ?? [], quantities = new Map(definitions.map((i) => [i.id, i.initialQuantity])), equipment = new Map();
	const find = (id) => definitions.find((i) => i.id === id || i.key === id);
	const count = (id) => quantities.get(find(id)?.id ?? "") ?? 0;
	const amount = (n) => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
	let depth = 0;
	const fire = (id, itemId) => {
		if (!id) return;
		if (depth >= 8) throw new Error("아이템 효과가 순환 호출됩니다.");
		depth++;
		try {
			effect(id, itemId);
		} finally {
			depth--;
		}
	};
	const unequip = (slot) => {
		const id = equipment.get(slot), item = id ? find(id) : undefined;
		if (!item) return false;
		equipment.delete(slot);
		fire(item.onUnequip, item.id);
		return true;
	};
	const give = (id, n = 1) => {
		const item = find(id);
		if (!item) return 0;
		const before = count(id), after = Math.min(item.stackLimit, before + amount(n));
		quantities.set(item.id, after);
		return after - before;
	};
	const take = (id, n = 1) => {
		const item = find(id);
		if (!item) return 0;
		const removed = Math.min(count(id), amount(n));
		quantities.set(item.id, count(id) - removed);
		if (!count(id)) {
			for (const [slot, equipped] of equipment) if (equipped === item.id) unequip(slot);
		};
		return removed;
	};
	return {
		count,
		give,
		take,
		list: () => definitions.filter((i) => count(i.id) > 0).map((i) => ({
			item: i,
			quantity: count(i.id)
		})),
		use: (id) => {
			const item = find(id);
			if (!item || !count(id) || !canUse(item.id)) return false;
			if (item.consumable) take(item.id, 1);
			fire(item.onUse, item.id);
			return true;
		},
		equip: (id) => {
			const item = find(id);
			if (!item || !item.slot || !count(id)) return false;
			if (equipment.get(item.slot) === item.id) return true;
			unequip(item.slot);
			equipment.set(item.slot, item.id);
			fire(item.onEquip, item.id);
			return true;
		},
		unequip,
		equipment: () => Object.fromEntries(equipment),
		stats: () => {
			const result = Object.create(null);
			for (const id of new Set(equipment.values())) for (const stat of find(id)?.stats ?? []) result[stat.name] = (result[stat.name] || 0) + stat.value;
			return result;
		},
		weight: () => definitions.reduce((sum, item) => sum + count(item.id) * item.weight, 0),
		serialize: () => ({
			version: 1,
			quantities: Object.fromEntries(quantities),
			equipment: Object.fromEntries(equipment)
		}),
		restore: (value) => {
			const data = value;
			if (!data || data.version !== 1 || !data.quantities || typeof data.quantities !== "object" || !data.equipment || typeof data.equipment !== "object") return false;
			const next = new Map(definitions.map((i) => [i.id, Math.min(i.stackLimit, amount(Number(data.quantities[i.id] ?? 0)))]));
			quantities.clear();
			next.forEach((n, id) => quantities.set(id, n));
			equipment.clear();
			for (const [slot, id] of Object.entries(data.equipment)) {
				const item = find(String(id));
				if (item?.slot === slot && count(item.id)) equipment.set(slot, item.id);
			};
			return true;
		}
	};
},function publishedDefinitions(definitions = []) {
	const value = (f) => {
		if (f.type === "number") return Number.isFinite(Number(f.value)) ? Number(f.value) : 0;
		if (f.type === "boolean") return f.value === "true";
		if ([
			"json",
			"reference-list",
			"resource",
			"resource-list"
		].includes(f.type)) {
			try {
				return JSON.parse(f.value);
			} catch {
				return null;
			}
		};
		return f.value;
	};
	return Object.fromEntries(definitions.filter((d) => d.published).map((d) => [d.key, Object.fromEntries(d.fields.filter((f) => f.published).map((f) => [f.key, value(f)]))]));
},function createTimelinePlayer(project, sceneId, effects) {
	const timelines = new Map((project.timelines ?? []).filter((t) => t.sceneId === sceneId).map((t) => [t.id, {
		...t,
		tracks: t.tracks.map((track) => ({
			...track,
			keys: [...track.keys].sort((a, b) => a.time - b.time)
		}))
	}]));
	const states = new Map();
	const ease = (kind, n) => {
		if (kind === "hold") return n === 1 ? 1 : 0;
		if (kind === "sine") return (1 - Math.cos(Math.PI * n)) / 2;
		if (kind === "quad") return n * n;
		if (kind === "cubic") return 1 - (1 - n) ** 3;
		if (kind === "back") {
			const c = 1.70158;
			return 1 + (c + 1) * (n - 1) ** 3 + c * (n - 1) ** 2;
		};
		if (kind === "bounce") {
			const c = 7.5625, d = 2.75;
			if (n < 1 / d) return c * n * n;
			if (n < 2 / d) return c * (n -= 1.5 / d) * n + .75;
			if (n < 2.5 / d) return c * (n -= 2.25 / d) * n + .9375;
			return c * (n -= 2.625 / d) * n + .984375;
		};
		return n;
	};
	const sample = (track, time) => {
		const keys = track.keys;
		if (!keys.length) return undefined;
		if (time <= keys[0].time) return keys[0].value;
		let low = 0, high = keys.length - 1;
		while (low < high) {
			const mid = Math.ceil((low + high) / 2);
			if (keys[mid].time <= time) low = mid;
			else high = mid - 1;
		};
		const a = keys[low], b = keys[low + 1];
		if (!b || time === a.time) return a.value;
		if (track.property === "visible" || track.property === "frame") return a.value;
		const n = (time - a.time) / (b.time - a.time);
		return a.value + (b.value - a.value) * ease(a.ease, n);
	};
	const position = (t, elapsed) => {
		const active = Math.max(0, elapsed - t.delay), span = t.duration * (t.yoyo ? 2 : 1), total = t.repeat < 0 ? Infinity : span * (t.repeat + 1), complete = active >= total;
		let part = complete ? span : active % span;
		if (t.yoyo && part > t.duration) part = 2 * t.duration - part;
		return {
			time: Math.max(0, Math.min(t.duration, part)),
			complete,
			active: elapsed >= t.delay
		};
	};
	const apply = (t, time) => {
		for (const track of t.tracks) if (track.enabled) {
			const value = sample(track, time);
			if (value !== undefined) effects.apply(track.objectId, track.property, value);
		}
	};
	const seek = (id, time) => {
		const t = timelines.get(id);
		if (!t) return false;
		const state = states.get(id) ?? {
			time: 0,
			playing: false,
			complete: false
		};
		state.time = t.delay + Math.max(0, Math.min(t.duration, time));
		state.complete = false;
		states.set(id, state);
		apply(t, Math.max(0, Math.min(t.duration, time)));
		return true;
	};
	const play = (id, restart = true) => {
		const t = timelines.get(id);
		if (!t) {
			effects.error?.("재생할 타임라인을 찾을 수 없습니다.");
			return false;
		};
		const state = states.get(id);
		states.set(id, {
			time: restart || state?.complete ? 0 : state?.time ?? 0,
			playing: true,
			complete: false
		});
		apply(t, position(t, states.get(id).time).time);
		if (restart && t.delay === 0) {
			for (const m of t.markers) if (m.time === 0) effects.marker?.(m);
		};
		return true;
	};
	const pause = (id) => {
		const s = states.get(id);
		if (s) s.playing = false;
	};
	const stop = (id) => {
		pause(id);
		seek(id, 0);
	};
	const advance = (delta) => {
		for (const [id, state] of [...states]) {
			if (!state.playing) continue;
			const t = timelines.get(id), before = state.time, next = before + Math.max(0, Number.isFinite(delta) ? delta : 0) * t.timeScale;
			state.time = next;
			const p = position(t, next);
			apply(t, p.time);
			const span = t.duration * (t.yoyo ? 2 : 1), events = [];
			for (const m of t.markers) {
				for (const offset of [m.time, ...t.yoyo && m.time > 0 && m.time < t.duration ? [span - m.time] : []]) {
					const first = Math.max(0, Math.floor((before - t.delay - offset) / span) + 1), last = Math.min(t.repeat < 0 ? Infinity : t.repeat, Math.floor((next - t.delay - offset) / span));
					for (let cycle = first; cycle <= last && events.length <= 512; cycle++) events.push({
						at: t.delay + cycle * span + offset,
						marker: m
					});
					if (events.length > 512) break;
				};
				if (events.length > 512) break;
			};
			if (events.length > 512) {
				effects.error?.("한 프레임의 타임라인 이벤트가 512개를 넘어 중단했습니다.");
				state.playing = false;
				continue;
			};
			for (const event of events.sort((a, b) => a.at - b.at)) {
				if (states.get(id) !== state || !state.playing) break;
				effects.marker?.(event.marker);
			};
			if (states.get(id) === state && p.complete) {
				state.complete = true;
				state.playing = false;
			}
		}
	};
	const restore = (records) => {
		for (const r of records) {
			const t = timelines.get(r.id);
			if (!t || !Number.isFinite(r.time)) continue;
			const state = {
				time: Math.max(0, r.time),
				playing: !!r.playing,
				complete: !!r.complete
			};
			states.set(r.id, state);
			apply(t, position(t, state.time).time);
		}
	};
	return {
		sample,
		ease,
		position,
		seek,
		play,
		pause,
		stop,
		advance,
		restore,
		status: () => [...states].map(([id, s]) => ({
			id,
			...s,
			position: position(timelines.get(id), s.time).time
		})),
		autoplay: () => {
			for (const t of timelines.values()) if (t.autoplay) play(t.id);
		}
	};
},function createSceneStateRuntime(project, sceneDefinition, host, factory) {
	const machines = new Map((project.stateMachines ?? []).map((m) => [m.id, m]));
	const entries = new Map(), overrides = new Map();
	const baselines = new Map(), previous = new Map(), animationTokens = new Map();
	const keys = new Map();
	const definitions = new Map();
	const ownerEntries = new Map();
	const effectTokens = new Map();
	const diagnostics = new Map();
	const observations = new Map();
	let destroyed = false, operationDepth = 0;
	const resolveOwner = (target) => typeof target === "string" ? host.objects.has(target) ? target : host.actors().find((a) => a.def.name === target)?.def.id ?? target : target?.getData?.("forgeObjectId") ?? [...host.objects].find(([, go]) => go === target)?.[0] ?? "";
	const property = (owner, key, targets = {}) => {
		if (key === "inputX") return (keys.get("RIGHT")?.held || keys.get("D")?.held ? 1 : 0) - (keys.get("LEFT")?.held || keys.get("A")?.held ? 1 : 0);
		if (key === "inputY") return (keys.get("DOWN")?.held || keys.get("S")?.held ? 1 : 0) - (keys.get("UP")?.held || keys.get("W")?.held ? 1 : 0);
		const go = host.objects.get(owner);
		if (!go) return undefined;
		const observed = observations.get(owner);
		if (observed && Object.prototype.hasOwnProperty.call(observed, key)) return observed[key];
		if (key === "faction" || key === "team") return host.factions?.()?.team(owner) ?? go.getData?.("faction") ?? "";
		if (key.startsWith("relation:")) {
			const id = targets[key.slice(9)], runtime = host.factions?.();
			return id && host.objects.get(id)?.active && runtime ? runtime.relation(runtime.team(owner), runtime.team(id)) : undefined;
		};
		const relative = /^(distance|deltaX|deltaY):(.+)$/.exec(key);
		if (relative) {
			const target = host.objects.get(targets[relative[2]] ?? "");
			if (!target || target.active === false) return undefined;
			const origin = go.getData?.("forgeAnchor") ?? go, destination = target.getData?.("forgeAnchor") ?? target, targetObservation = observations.get(targets[relative[2]]), dx = (targetObservation?.x ?? destination.x) - (observed?.x ?? origin.x), dy = (targetObservation?.y ?? destination.y) - (observed?.y ?? origin.y);
			return relative[1] === "distance" ? Math.hypot(dx, dy) : relative[1] === "deltaX" ? dx : dy;
		};
		if (key === "velocityX" || key === "velocityY") return go.body?.velocity?.[key.endsWith("X") ? "x" : "y"] ?? 0;
		if (key === "absVelocityX" || key === "absVelocityY") return Math.abs(go.body?.velocity?.[key.endsWith("X") ? "x" : "y"] ?? 0);
		if (key === "speed") return Math.hypot(go.body?.velocity?.x ?? 0, go.body?.velocity?.y ?? 0);
		if (key === "normalVelocity") {
			const w = host.gravity(), gx = w.x + (go.body?.gravity?.x ?? 0), gy = w.y + (go.body?.gravity?.y ?? 0), length = Math.hypot(gx, gy) || 1;
			return ((go.body?.velocity?.x ?? 0) * gx + (go.body?.velocity?.y ?? 0) * gy) / length;
		};
		if (key === "grounded") {
			const world = host.gravity(), gx = go.body?.allowGravity ? world.x + (go.body.gravity?.x ?? 0) : 0, gy = go.body?.allowGravity ? world.y + (go.body.gravity?.y ?? 0) : 0;
			const side = Math.abs(gx) > Math.abs(gy) ? gx > 0 ? "right" : "left" : gy >= 0 ? "down" : "up";
			return !!(go.body?.blocked?.[side] || go.body?.touching?.[side]);
		};
		if (key.startsWith("blocked")) {
			const side = key.slice(7).toLowerCase();
			return !!(go.body?.blocked?.[side] || go.body?.touching?.[side]);
		};
		if (key === "animationComplete") return !!go.anims?.currentAnim && !go.anims.isPlaying;
		if (key === "animationPlaying") return !!go.anims?.isPlaying;
		if (key === "opacity") return (go.getData?.("forgeAnchor") ?? go).alpha;
		if (key.startsWith("data:")) return go.getData?.(key.slice(5));
		return go[key];
	};
	const attach = (owner, b) => {
		const key = owner + "/" + b.id;
		if (entries.has(key)) return;
		const machine = machines.get(b.machineId);
		if (!machine) {
			host.error("연결된 상태 구성을 찾을 수 없습니다: " + b.name);
			return;
		};
		const engine = factory(machine, b, {
			variable: host.variable,
			property: (key, targetId) => property(targetId ? b.targets[targetId] ?? "" : owner, key, b.targets),
			key: (name, mode) => {
				const k = keys.get(name.toUpperCase());
				return mode === "pressed" ? !!k?.pressed : mode === "released" ? !!k?.released : mode === "up" ? !k?.held : !!k?.held;
			},
			run: (id, alive) => host.run(id, Object.fromEntries(machine.parameters.map((p) => [p.key, engine.get(p.id)])), owner, alive),
			error: host.error
		});
		const entry = {
			owner,
			binding: b,
			engine,
			enabled: b.enabled
		};
		entries.set(key, entry);
		let owned = ownerEntries.get(owner);
		if (!owned) {
			owned = new Set();
			ownerEntries.set(owner, owned);
		};
		owned.add(key);
	};
	const sync = () => {
		if (destroyed) return;
		for (const a of host.actors()) definitions.set(a.def.id, a.def);
		for (const b of sceneDefinition.stateMachines ?? []) attach("", b);
		for (const a of host.actors()) if (host.objects.has(a.def.id)) for (const b of a.def.stateMachines ?? []) attach(a.def.id, b);
		for (const [key, e] of entries) if (e.owner && !host.objects.has(e.owner)) {
			e.engine.destroy();
			entries.delete(key);
			diagnostics.delete(e.owner);
			observations.delete(e.owner);
			ownerEntries.get(e.owner)?.delete(key);
			if (!ownerEntries.get(e.owner)?.size) ownerEntries.delete(e.owner);
		};
		for (const id of baselines.keys()) if (!host.objects.has(id)) {
			baselines.delete(id);
			previous.delete(id);
			animationTokens.delete(id);
			overrides.delete(id);
		}
	};
	const readBase = (go, def, key) => {
		const anchor = go.getData?.("forgeAnchor") ?? go;
		if ([
			"behavior",
			"speed",
			"jump",
			"stop"
		].includes(key)) return key === "stop" ? false : def?.[key];
		if (key === "gravity") return go.body?.allowGravity ?? false;
		if (key === "bodyEnabled") return go.body?.enable ?? true;
		if (key === "opacity") return anchor.alpha;
		if (key === "visible") return anchor.visible;
		if (key === "tint") return {
			tinted: go.isTinted,
			color: go.tintTopLeft ?? go.fillColor ?? 16777215
		};
		if (key.startsWith("velocity")) return go.body?.velocity?.[key.endsWith("X") ? "x" : "y"] ?? 0;
		if (key.startsWith("acceleration")) return go.body?.acceleration?.[key.endsWith("X") ? "x" : "y"] ?? 0;
		return go[key];
	};
	const motionWarnings = new Set();
	const setPhysical = (go, key, value) => {
		if (go.getData?.("forgeMotionPath") && (key === "gravity" || key.startsWith("velocity") || key.startsWith("acceleration"))) {
			const id = go.getData?.("forgeId") ?? go.name ?? "";
			if (!motionWarnings.has(id)) {
				motionWarnings.add(id);
				host.error("이동 경로 사용 중에는 상태의 속도·가속도·중력을 함께 제어할 수 없습니다.");
			};
			return;
		};
		const anchor = go.getData?.("forgeAnchor") ?? go;
		if (key === "visible") anchor.visible = value;
		else if (key === "opacity") anchor.alpha = value;
		else if (key === "flipX") go.setFlipX?.(value);
		else if (key === "flipY") go.setFlipY?.(value);
		else if (key === "gravity") go.body?.setAllowGravity?.(value);
		else if (key === "bodyEnabled" && go.body) go.body.enable = value;
		else if (key.startsWith("velocity") && go.body?.velocity) go.body.velocity[key.endsWith("X") ? "x" : "y"] = value;
		else if (key.startsWith("acceleration") && go.body?.acceleration) go.body.acceleration[key.endsWith("X") ? "x" : "y"] = value;
		else if (key === "tint") {
			const n = typeof value === "string" ? parseInt(value.slice(1), 16) : value?.color ?? 16777215;
			if (go.setFillStyle) go.setFillStyle(n);
			else if (typeof value === "object" && !value.tinted) go.clearTint?.();
			else go.setTint?.(n);
		}
	};
	const apply = () => {
		const merged = new Map();
		for (const e of [...entries.values()].filter((e) => e.enabled).sort((a, b) => a.binding.priority - b.binding.priority)) for (const [target, view] of e.engine.profiles()) {
			const id = target || e.owner;
			if (!id || !host.objects.has(id)) continue;
			const before = merged.get(id);
			merged.set(id, {
				profile: {
					...before?.profile,
					...view.profile
				},
				effectToken: view.effectToken ? e.binding.id + ":" + view.effectToken : before?.effectToken,
				animationToken: view.animationToken ? e.binding.id + ":" + view.animationToken : before?.animationToken ?? ""
			});
		};
		for (const id of new Set([...previous.keys(), ...merged.keys()])) {
			const go = host.objects.get(id);
			if (!go) continue;
			const current = merged.get(id), profile = current?.profile ?? {}, old = previous.get(id) ?? new Set(), next = new Set(Object.keys(profile));
			const base = baselines.get(id) ?? new Map();
			baselines.set(id, base);
			for (const key of next) if (!base.has(key)) {
				if (key.startsWith("animation")) {
					if (!base.has("animation")) base.set("animation", {
						id: go.anims?.currentAnim?.key,
						playing: go.anims?.isPlaying,
						progress: go.anims?.getProgress?.(),
						timeScale: go.anims?.timeScale
					});
				} else base.set(key, readBase(go, definitions.get(id), key));
			};
			for (const key of old) if (!next.has(key) && !key.startsWith("animation")) setPhysical(go, key, base.get(key));
			if (old.has("animationSpeed") && !next.has("animationSpeed") && go.anims) go.anims.timeScale = base.get("animation")?.timeScale ?? 1;
			if ([...old].some((k) => k.startsWith("animation")) && ![...next].some((k) => k.startsWith("animation"))) {
				const b = base.get("animation");
				if (b?.id && go.play) {
					go.play(b.id);
					if (Number.isFinite(b.progress)) go.anims.setProgress(b.progress);
					if (!b.playing) go.anims.stop();
					go.anims.timeScale = b.timeScale ?? 1;
				} else go.anims?.stop();
				animationTokens.delete(id);
			};
			for (const [key, value] of Object.entries(profile)) setPhysical(go, key, value);
			overrides.set(id, profile);
			const fxToken = profile.effectId ? current?.effectToken ?? profile.effectId : "";
			if (fxToken !== (effectTokens.get(id) ?? "")) {
				host.effect?.(id, profile.effectId ?? "");
				if (fxToken) effectTokens.set(id, fxToken);
				else effectTokens.delete(id);
			};
			if (current) {
				if (profile.animationMode === "stop") go.anims?.stop();
				else if (profile.animationId && go.play && current.animationToken !== animationTokens.get(id)) {
					if (profile.restartAnimation !== false || go.anims?.currentAnim?.key !== profile.animationId || !go.anims.isPlaying) try {
						go.play(profile.animationId);
					} catch (e) {
						host.error(String(e));
					}
				};
				if (profile.animationSpeed !== undefined && go.anims) go.anims.timeScale = profile.animationSpeed;
				if (current.animationToken) animationTokens.set(id, current.animationToken);
			};
			if (next.size) previous.set(id, next);
			else {
				previous.delete(id);
				overrides.delete(id);
				baselines.delete(id);
			}
		}
	};
	const find = (target, machine) => {
		const owner = resolveOwner(target ?? "");
		return [...ownerEntries.get(owner) ?? []].flatMap((key) => {
			const entry = entries.get(key);
			return entry ? [entry] : [];
		}).filter((e) => e.owner === owner && (!machine || [
			e.binding.id,
			e.binding.name,
			e.binding.machineId,
			machines.get(e.binding.machineId)?.name
		].includes(machine)));
	};
	const operate = (target, machine, fn) => {
		if (operationDepth >= 16) {
			host.error("상태 함수의 반복 제어를 중단했습니다. 진입 함수의 초기화·재진입 연결을 확인하세요.");
			return false;
		};
		operationDepth++;
		try {
			const list = find(target, machine), results = list.map(fn);
			apply();
			return !!list.length && results.some((result) => result !== false);
		} finally {
			operationDepth--;
		}
	};
	const api = {
		sync,
		isEnabled: (target, machine) => find(target, machine).some((entry) => entry.enabled && entry.engine.isEnabled()),
		evaluate: (target, machine, delta = 0) => operate(target, machine, (entry) => {
			if (!entry.enabled || !entry.engine.isEnabled()) return false;
			entry.engine.update(delta);
			return true;
		}),
		start: (saved = []) => {
			sync();
			for (const e of entries.values()) {
				const snapshot = saved.find((s) => s.owner === e.owner && s.bindingId === e.binding.id);
				if (snapshot) {
					e.enabled = snapshot.enabled ?? e.enabled;
					e.engine.restore(snapshot);
				} else if (e.enabled) e.engine.start();
			};
			apply();
		},
		before: (delta) => {
			for (const e of entries.values()) if (e.enabled) e.engine.update(delta);
			apply();
		},
		remove: (id) => {
			if (effectTokens.has(id)) {
				host.effect?.(id, "");
				effectTokens.delete(id);
			};
			for (const [key, e] of entries) if (e.owner === id) {
				e.engine.destroy();
				entries.delete(key);
				ownerEntries.get(e.owner)?.delete(key);
				if (!ownerEntries.get(e.owner)?.size) ownerEntries.delete(e.owner);
			};
			baselines.delete(id);
			previous.delete(id);
			overrides.delete(id);
			animationTokens.delete(id);
			definitions.delete(id);
			diagnostics.delete(id);
			observations.delete(id);
		},
		after: () => {
			for (const [id, p] of overrides) {
				const go = host.objects.get(id);
				if (!go) continue;
				if (p.stop && go.body?.setVelocity) {
					const def = definitionsFor(id), world = host.gravity();
					if ((p.behavior ?? def?.behavior) === "platformer") {
						const gx = go.body.allowGravity ? world.x + (go.body.gravity?.x ?? 0) : 0, gy = go.body.allowGravity ? world.y + (go.body.gravity?.y ?? 0) : 0, length = Math.hypot(gx, gy) || 1, nx = gx / length, ny = gy / length, n = go.body.velocity.x * nx + go.body.velocity.y * ny;
						go.body.setVelocity(nx * n, ny * n);
					} else go.body.setVelocity(0, 0);
				};
				for (const key of [
					"velocityX",
					"velocityY",
					"accelerationX",
					"accelerationY",
					"flipX",
					"flipY"
				]) if (p[key] !== undefined) setPhysical(go, key, p[key]);
			}
		},
		profile: (id) => overrides.get(id),
		observe: (target, values) => {
			const owner = resolveOwner(target);
			if (values) observations.set(owner, Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)));
			else observations.delete(owner);
		},
		diagnose: (target, code, message) => {
			const owner = resolveOwner(target);
			if (!message) {
				diagnostics.get(owner)?.delete(code);
				if (!diagnostics.get(owner)?.size) diagnostics.delete(owner);
				return;
			};
			let warnings = diagnostics.get(owner);
			if (!warnings) diagnostics.set(owner, warnings = new Map());
			if (warnings.get(code) !== message) {
				warnings.set(code, message);
				host.error(message);
			}
		},
		key: (key, down) => {
			key = key.toUpperCase().replace(/^(SHIFT|CONTROL|ALT|META)(LEFT|RIGHT)$/, "$1").replace(/^CONTROL$/, "CTRL");
			const previous = keys.get(key) ?? {
				held: false,
				pressed: false,
				released: false
			};
			keys.set(key, {
				held: down,
				pressed: previous.pressed || down && !previous.held,
				released: previous.released || !down && previous.held
			});
		},
		releaseKeys: () => {
			for (const [key, k] of keys) if (k.held) keys.set(key, {
				held: false,
				pressed: false,
				released: true
			});
		},
		endFrame: () => {
			for (const k of keys.values()) {
				k.pressed = false;
				k.released = false;
			}
		},
		set: (target, key, value, machine) => operate(target, machine, (e) => e.engine.set(key, value)),
		get: (target, key, machine) => find(target, machine).map((e) => e.engine.get(key)).find((value) => value !== undefined),
		// Sensor writes only change parameters; transitions/profiles run once in before().
		// Avoid reapplying every actor's appearance after each individual sensor value.
		setParameters: (target, values, machine) => {
			const list = find(target, machine);
			let changed = false;
			for (const entry of list) for (const [key, value] of Object.entries(values)) changed = entry.engine.set(key, value) || changed;
			return changed;
		},
		trigger: (target, key, machine) => operate(target, machine, (e) => e.engine.trigger(key)),
		signal: (target, name, machine) => operate(target, machine, (e) => e.engine.signal(name)),
		change: (target, layer, state, machine, reenter = false) => operate(target, machine, (e) => e.engine.force(layer, state, reenter)),
		enable: (target, enabled, machine) => operate(target, machine, (e) => {
			if (e.enabled && !enabled) e.engine.suspend();
			e.enabled = enabled;
			if (enabled) e.engine.start();
		}),
		enableLayer: (target, layer, enabled, machine) => operate(target, machine, (e) => e.engine.enableLayer(layer, enabled)),
		reset: (target, machine) => operate(target, machine, (e) => {
			e.engine.destroy();
			entries.delete(e.owner + "/" + e.binding.id);
			attach(e.owner, e.binding);
			const next = entries.get(e.owner + "/" + e.binding.id);
			if (next?.enabled) next.engine.start();
		}),
		snapshot: () => [...entries.values()].map((e) => ({
			...e.engine.snapshot(),
			owner: e.owner,
			enabled: e.enabled
		})),
		inspect: () => [...entries.values()].map((e) => ({
			...e.engine.inspect(),
			owner: e.owner,
			ownerName: e.owner ? definitionsFor(e.owner)?.name ?? e.owner : sceneDefinition.name,
			enabled: e.enabled,
			warnings: [...diagnostics.get(e.owner)?.values() ?? []]
		})),
		destroy: () => {
			destroyed = true;
			for (const e of entries.values()) e.engine.destroy();
			entries.clear();
			ownerEntries.clear();
			keys.clear();
			diagnostics.clear();
			observations.clear();
			apply();
		}
	};
	function definitionsFor(id) {
		return definitions.get(id);
	}
	return api;
},function createStateMachineRuntime(machine, binding, effects) {
	// 같은 불변 정의를 여러 오브젝트가 사용할 때 실행 계획만 공유한다.
	const factory = createStateMachineRuntime;
	const plans = factory.definitionPlans ??= new WeakMap();
	let plan = plans.get(machine);
	if (!plan || plan.stateSource !== machine.states || plan.transitionSource !== machine.transitions || plan.layerSource !== machine.layers || plan.stateCount !== machine.states.length || plan.transitionCount !== machine.transitions.length) {
		plan = {
			stateSource: machine.states,
			transitionSource: machine.transitions,
			layerSource: machine.layers,
			stateCount: machine.states.length,
			transitionCount: machine.transitions.length,
			states: new Map(machine.states.map((s) => [s.id, s])),
			paths: new Map(),
			leaves: new Map(),
			from: new Map(),
			candidates: new Map()
		};
		plans.set(machine, plan);
	};
	const definition = plan, states = definition.states, parameters = new Map(machine.parameters.map((p) => [p.id, p]));
	const byKey = new Map(machine.parameters.map((p) => [p.key, p.id])), values = new Map(), signals = new Set();
	const slots = new Map(machine.animationSlots.map((s) => [s.id, s.animationId]));
	const active = new Map();
	let alive = true, generation = 0, updating = false, requests = [];
	const history = [];
	let clock = 0;
	const stats = {
		transitionChecks: 0,
		conditionChecks: 0,
		updateFunctionCalls: 0
	};
	const clearStats = () => {
		stats.transitionChecks = 0;
		stats.conditionChecks = 0;
		stats.updateFunctionCalls = 0;
	};
	const convert = (p, v) => p.type === "number" ? Number.isFinite(Number(v)) ? Number(v) : 0 : p.type === "boolean" || p.type === "trigger" ? v === true || v === "true" : String(v ?? "");
	for (const p of machine.parameters) values.set(p.id, convert(p, binding.parameters[p.id] ?? p.value));
	const path = (id) => {
		const cached = definition.paths.get(id);
		if (cached) return cached;
		const original = id;
		const result = [];
		const seen = new Set();
		while (id && !seen.has(id)) {
			seen.add(id);
			const s = states.get(id);
			if (!s) break;
			result.unshift(s);
			id = s.parentId;
		};
		definition.paths.set(original, result);
		return result;
	};
	const leaf = (id) => {
		const cached = definition.leaves.get(id);
		if (cached !== undefined) return cached;
		const original = id;
		const seen = new Set();
		while (id && !seen.has(id)) {
			seen.add(id);
			const s = states.get(id);
			if (!s) break;
			const child = states.get(s.initialChildId);
			if (!child || child.parentId !== id) break;
			id = child.id;
		};
		definition.leaves.set(original, id);
		return id;
	};
	const order = (a, b) => b.t.priority - a.t.priority || b.depth - a.depth || a.i - b.i;
	if (!definition.from.size) {
		for (const layer of machine.layers) {
			definition.from.set(layer.id, new Map());
			definition.candidates.set(layer.id, new Map());
		};
		machine.transitions.forEach((t, i) => {
			if (!t.enabled) return;
			const byFrom = definition.from.get(t.layerId);
			if (!byFrom) return;
			let bucket = byFrom.get(t.from);
			if (!bucket) {
				bucket = [];
				byFrom.set(t.from, bucket);
			};
			bucket.push({
				t,
				i,
				depth: t.from === "*" ? -1 : path(t.from).length - 1
			});
		});
	};
	const candidates = (layerId, stateId, ancestry) => {
		const cache = definition.candidates.get(layerId), cached = cache?.get(stateId);
		if (cached) return cached;
		const byFrom = definition.from.get(layerId), result = [...byFrom?.get("*") ?? []];
		for (const state of ancestry) result.push(...byFrom?.get(state.id) ?? []);
		result.sort(order);
		cache?.set(stateId, result);
		return result;
	};
	const call = (id, token) => {
		if (id && alive) try {
			effects.run(id, () => alive && (token?.active ?? true));
		} catch (e) {
			effects.error(machine.name + ": " + String(e));
		}
	};
	const change = (layerId, destination, reenter = false, transitionId = "", silent = false) => {
		const layer = active.get(layerId), next = states.get(leaf(destination));
		if (!layer || !next || next.layerId !== layerId) return false;
		const before = layer.stateId;
		if (before === next.id && !reenter) return false;
		const previous = layer.ancestry, following = path(next.id);
		let shared = 0;
		while (shared < previous.length && shared < following.length && previous[shared].id === following[shared].id) shared++;
		if (reenter) {
			const requested = following.findIndex((s) => s.id === destination);
			if (requested >= 0) shared = Math.min(shared, requested);
		};
		for (const s of previous.slice(shared).reverse()) {
			const token = layer.tokens.get(s.id);
			if (token) token.active = false;
			layer.tokens.delete(s.id);
			layer.elapsed.delete(s.id);
			layer.updates.delete(s.id);
			if (!silent) call(s.exitFunctionId);
		};
		layer.stateId = next.id;
		layer.ancestry = following;
		layer.candidates = candidates(layerId, next.id, following);
		for (const s of following.slice(shared)) {
			const token = {
				active: true,
				generation: ++generation
			};
			layer.tokens.set(s.id, token);
			layer.elapsed.set(s.id, 0);
			layer.updates.set(s.id, 0);
			if (!silent) call(s.enterFunctionId, token);
		};
		if (before) {
			history.push({
				layerId,
				from: before,
				to: next.id,
				transitionId,
				time: clock
			});
			if (history.length > 64) history.shift();
		};
		return true;
	};
	for (const l of machine.layers) active.set(l.id, {
		stateId: "",
		elapsed: new Map(),
		updates: new Map(),
		tokens: new Map(),
		enabled: l.enabled,
		ancestry: [],
		candidates: []
	});
	const initialize = () => {
		for (const l of machine.layers) {
			const a = active.get(l.id);
			if (a.enabled && !a.stateId) change(l.id, l.initialStateId);
		}
	};
	const compare = (a, b, op) => op === "eq" ? a === b : op === "ne" ? a !== b : op === "lt" ? Number(a) < Number(b) : op === "lte" ? Number(a) <= Number(b) : op === "gt" ? Number(a) > Number(b) : Number(a) >= Number(b);
	const test = (c, elapsed) => {
		stats.conditionChecks++;
		let a;
		if (c.source === "parameter") a = values.get(byKey.get(c.key) ?? c.key);
		else if (c.source === "variable") a = effects.variable(c.key);
		else if (c.source === "property") a = effects.property(c.key, c.targetId);
		else if (c.source === "time") a = elapsed;
		else if (c.source === "key") return c.compare === "ne" ? !effects.key(c.key, c.value) : effects.key(c.key, c.value);
		else a = signals.has(c.key);
		if (a === undefined) return false;
		const b = typeof a === "number" ? Number(c.value) : typeof a === "boolean" ? c.value === "true" : c.value;
		return compare(a, b, c.compare);
	};
	const api = {
		isEnabled: () => alive && machine.layers.some((layer) => active.get(layer.id)?.enabled ?? layer.enabled),
		start: () => {
			updating = true;
			initialize();
			updating = false;
		},
		update: (delta) => {
			clearStats();
			if (!alive) return;
			updating = true;
			initialize();
			const dt = Math.max(0, Math.min(1e3, Number.isFinite(delta) ? delta : 0));
			clock += dt;
			const pending = requests;
			requests = [];
			for (const r of pending) change(r.layer, r.state, r.reenter);
			const consumed = new Set();
			for (const l of machine.layers) {
				const a = active.get(l.id);
				if (!a.enabled) continue;
				for (const id of a.elapsed.keys()) a.elapsed.set(id, (a.elapsed.get(id) ?? 0) + dt);
				for (const { t } of a.candidates) {
					stats.transitionChecks++;
					const elapsed = a.elapsed.get(t.from === "*" ? a.stateId : t.from) ?? 0;
					if (elapsed < t.minTime) continue;
					const group = !t.groups.length ? [] : t.groups.find((g) => g.every((c) => test(c, elapsed)));
					if (!group) continue;
					// A matching higher-priority self transition holds the state. It must
					// not fall through to a lower-priority wildcard fallback each frame.
					if (a.stateId === leaf(t.to) && !t.reenter) {
						for (const c of group) if (c.source === "parameter") {
							const id = byKey.get(c.key) ?? c.key;
							if (parameters.get(id)?.type === "trigger") consumed.add(id);
						};
						break;
					};
					if (change(l.id, t.to, t.reenter, t.id)) {
						for (const c of group) if (c.source === "parameter") {
							const id = byKey.get(c.key) ?? c.key;
							if (parameters.get(id)?.type === "trigger") consumed.add(id);
						};
						call(t.functionId);
						break;
					}
				};
				for (const s of a.ancestry) {
					const elapsed = (a.updates.get(s.id) ?? 0) + dt;
					if (s.updateFunctionId && elapsed >= s.updateInterval) {
						a.updates.set(s.id, elapsed % s.updateInterval);
						stats.updateFunctionCalls++;
						call(s.updateFunctionId, a.tokens.get(s.id));
					} else a.updates.set(s.id, elapsed);
				}
			};
			for (const id of consumed) values.set(id, false);
			signals.clear();
			updating = false;
		},
		get: (key) => values.get(byKey.get(key) ?? key),
		set: (key, value) => {
			const id = byKey.get(key) ?? key, p = parameters.get(id);
			if (!p) return false;
			values.set(id, convert(p, value));
			return true;
		},
		trigger: (key) => parameters.get(byKey.get(key) ?? key)?.type === "trigger" && api.set(key, true),
		signal: (name) => {
			if (name.length <= 200) signals.add(name);
		},
		force: (layer, state, reenter = false) => {
			const l = machine.layers.find((l) => l.id === layer || l.name === layer), s = machine.states.find((s) => (s.id === state || s.name === state) && s.layerId === l?.id);
			if (!l || !s) return false;
			if (updating) {
				if (requests.length < 64) requests.push({
					layer: l.id,
					state: s.id,
					reenter
				});
				return true;
			};
			return change(l.id, s.id, reenter);
		},
		enableLayer: (id, enabled) => {
			const l = machine.layers.find((l) => l.id === id || l.name === id), a = l && active.get(l.id);
			if (!a || !l) return false;
			if (!enabled) {
				for (let index = a.ancestry.length - 1; index >= 0; index--) {
					const s = a.ancestry[index];
					const token = a.tokens.get(s.id);
					if (token) token.active = false;
					call(s.exitFunctionId);
				};
				a.stateId = "";
				a.ancestry = [];
				a.candidates = [];
				a.tokens.clear();
				a.elapsed.clear();
				a.updates.clear();
			};
			a.enabled = enabled;
			if (enabled && !a.stateId) change(l.id, l.initialStateId);
			return true;
		},
		profiles: () => {
			const result = new Map();
			for (const l of machine.layers) {
				const a = active.get(l.id);
				if (!a.enabled) continue;
				for (const s of a.ancestry) for (const effect of s.effects) {
					const target = effect.targetId ? binding.targets[effect.targetId] : "";
					if (effect.targetId && !target) continue;
					const previous = result.get(target ?? "") ?? {
						profile: {},
						animationToken: ""
					};
					const p = { ...effect.profile };
					for (const [key, id] of Object.entries(effect.parameters ?? {})) {
						if (values.has(id)) {
							const v = values.get(id);
							if (typeof v === "number") {
								const max = key === "opacity" ? 1 : key === "animationSpeed" ? 10 : 1e4, min = [
									"opacity",
									"animationSpeed",
									"jump"
								].includes(key) ? 0 : -1e4;
								p[key] = Math.max(min, Math.min(max, v));
							} else if (key !== "tint" || /^#[0-9a-fA-F]{6}$/.test(String(v))) p[key] = v;
						}
					};
					if (p.animationSlotId) p.animationId = binding.animations[p.animationSlotId] ?? slots.get(p.animationSlotId) ?? "";
					const controlsAnimation = p.animationMode !== undefined || !!p.animationId;
					result.set(target ?? "", {
						profile: {
							...previous.profile,
							...p
						},
						effectToken: p.effectId ? effect.id + ":" + (a.tokens.get(s.id)?.generation ?? 0) : previous.effectToken,
						animationToken: controlsAnimation ? effect.id + ":" + (a.tokens.get(s.id)?.generation ?? 0) : previous.animationToken
					});
				}
			};
			return result;
		},
		snapshot: () => ({
			machineId: machine.id,
			bindingId: binding.id,
			parameters: Object.fromEntries(values),
			layers: [...active].map(([id, a]) => ({
				id,
				enabled: a.enabled,
				stateId: a.stateId,
				elapsed: Object.fromEntries(a.elapsed)
			}))
		}),
		restore: (snapshot) => {
			if (snapshot.machineId !== machine.id || snapshot.bindingId !== binding.id) return false;
			for (const p of machine.parameters) if (Object.hasOwn(snapshot.parameters ?? {}, p.id)) values.set(p.id, convert(p, snapshot.parameters[p.id]));
			for (const l of machine.layers) {
				const a = active.get(l.id), saved = snapshot.layers?.find((s) => s.id === l.id);
				if (!saved) continue;
				for (const token of a.tokens.values()) token.active = false;
				a.stateId = "";
				a.ancestry = [];
				a.candidates = [];
				a.tokens.clear();
				a.elapsed.clear();
				a.updates.clear();
				a.enabled = saved.enabled;
				if (a.enabled) {
					const state = states.get(saved.stateId);
					change(l.id, state?.layerId === l.id ? state.id : l.initialStateId, false, "", true);
					for (const id of a.elapsed.keys()) {
						const v = saved.elapsed?.[id];
						if (Number.isFinite(v) && v >= 0) a.elapsed.set(id, Math.min(v, 864e5));
					}
				}
			};
			return true;
		},
		inspect: () => ({
			machineId: machine.id,
			bindingId: binding.id,
			name: binding.name || machine.name,
			parameters: machine.parameters.map((p) => ({
				id: p.id,
				key: p.key,
				name: p.name,
				type: p.type,
				value: values.get(p.id)
			})),
			layers: machine.layers.map((l) => {
				const a = active.get(l.id);
				return {
					...l,
					enabled: a.enabled,
					stateId: a.stateId,
					path: a.ancestry.map((s) => ({
						id: s.id,
						name: s.name
					})),
					elapsed: a.elapsed.get(a.stateId) ?? 0
				};
			}),
			history: [...history],
			stats: {
				...stats,
				activeStates: [...active.values()].reduce((count, layer) => count + (layer.enabled ? layer.ancestry.length : 0), 0),
				definedStates: states.size
			}
		}),
		suspend: () => {
			clearStats();
			for (const a of active.values()) for (const [id, token] of a.tokens) {
				token.active = false;
				a.tokens.set(id, {
					active: true,
					generation: ++generation
				});
			};
			signals.clear();
			requests = [];
		},
		destroy: () => {
			if (!alive) return;
			for (const a of active.values()) for (const token of a.tokens.values()) token.active = false;
			alive = false;
			clearStats();
			signals.clear();
			requests = [];
		}
	};
	return api;
},function createMusicRuntime(project, manager, onError) {
	let current = null, assetId = "", owner = "", targetVolume = 1, loop = true, dead = false;
	const sounds = new Set(), owners = new Map(), timers = new Map();
	const cancel = (s) => {
		const timer = timers.get(s);
		if (timer) clearInterval(timer);
		timers.delete(s);
	};
	const dispose = (s) => {
		if (!sounds.delete(s)) return;
		cancel(s);
		owners.delete(s);
		s.stop();
		s.destroy();
	};
	const fade = (s, to, seconds, done) => {
		cancel(s);
		const start = Number(s.volume) || 0, started = Date.now();
		if (!seconds) {
			s.setVolume(to);
			done?.();
			return;
		};
		const timer = setInterval(() => {
			const fraction = Math.min(1, (Date.now() - started) / (seconds * 1e3));
			s.setVolume(start + (to - start) * fraction);
			if (fraction === 1) {
				cancel(s);
				done?.();
			}
		}, 20);
		timers.set(s, timer);
	};
	const api = {
		play: (id, options = {}) => {
			if (dead) return false;
			const a = project.assets.find((a) => a.id === id && a.type === "audio");
			if (!a) {
				onError("배경음 리소스가 없습니다.");
				return false;
			};
			const settings = a.audioSettings, requested = Math.max(0, Math.min(1, options.volume ?? 1)), volume = requested * (settings?.volume ?? 1);
			owner = options.owner ?? owner;
			targetVolume = requested;
			loop = options.loop ?? true;
			if (current && assetId === id && (current.isPlaying || current.isPaused)) {
				owners.set(current, owner);
				current.setLoop(loop);
				if (options.rate) current.setRate(options.rate);
				fade(current, volume, options.fade ?? 0);
				return true;
			};
			const old = current;
			// 전환 중 다시 곡을 바꾸면 이전 전환의 꼬리를 먼저 정리한다.
			for (const sound of [...sounds]) if (sound !== old) dispose(sound);
			if (old) fade(old, 0, options.fade ?? 0, () => dispose(old));
			try {
				const sound = manager.add(id);
				sound.forgeMusicBus = true;
				sounds.add(sound);
				owners.set(sound, owner);
				current = sound;
				assetId = id;
				const start = settings?.loopStart ?? 0, end = settings?.loopEnd ?? 0, duration = Math.max(0, end - start);
				if (duration > 0) sound.addMarker({
					name: "forge-loop",
					start,
					duration,
					config: { loop }
				});
				sound.once?.("complete", () => {
					if (current === sound) {
						current = null;
						assetId = "";
					};
					dispose(sound);
				});
				const config = {
					volume: options.fade ? 0 : volume,
					loop,
					rate: options.rate ?? settings?.rate ?? 1,
					seek: Math.max(0, Math.min(duration || 1e7, options.seek ?? 0))
				};
				if (duration > 0) sound.play("forge-loop", config);
				else sound.play(config);
				if (options.fade) fade(sound, volume, options.fade);
				return true;
			} catch (e) {
				onError("배경음을 재생하지 못했습니다: " + String(e));
				current = null;
				assetId = "";
				return false;
			}
		},
		stop: (seconds = 0, sceneOwner) => {
			const stopping = [...sounds].filter((sound) => !sceneOwner || owners.get(sound) === sceneOwner);
			if (stopping.includes(current)) {
				current = null;
				assetId = "";
				owner = "";
			};
			for (const sound of stopping) fade(sound, 0, seconds, () => dispose(sound));
		},
		pause: () => current?.pause(),
		resume: () => current?.resume(),
		volume: (value, seconds = 0) => {
			targetVolume = Math.max(0, Math.min(1, value));
			if (current) fade(current, targetVolume * (project.assets.find((a) => a.id === assetId)?.audioSettings?.volume ?? 1), seconds);
		},
		status: () => ({
			assetId,
			owner,
			volume: targetVolume,
			loop,
			seek: current?.seek ?? 0,
			rate: current?.rate ?? 1,
			playing: !!current?.isPlaying,
			paused: !!current?.isPaused
		}),
		restore: (saved, sceneOwner) => {
			if (!saved?.assetId) return false;
			const result = api.play(saved.assetId, {
				volume: saved.volume,
				loop: saved.loop,
				seek: saved.seek,
				rate: saved.rate,
				owner: sceneOwner
			});
			if (saved.paused) api.pause();
			return result;
		},
		destroy: () => {
			dead = true;
			for (const s of sounds) dispose(s);
			current = null;
		}
	};
	return api;
},function createEffectRuntime(Phaser, project, scene, error) {
	const entries = new Map(), baselines = new Map(), filterFocusBaselines = new Map(), presets = new Map(project.visualEffects?.map((p) => [p.id, p]));
	const identities = new WeakMap();
	let serial = 0, webglWarning = false;
	const resolve = (target) => typeof target === "string" ? scene.objectMap?.get(target) ?? scene.cameras.cameras.find((c) => c.name === target) : target ?? scene.cameras.main;
	const preserveContainerFilterBounds = (go) => {
		if (go.type !== "Container" || go.filtersAutoFocus === false || go.filtersFocusContext || !go.getBounds || !go.getWorldTransformMatrix) return;
		const bounds = go.getBounds(), matrix = go.getWorldTransformMatrix(), left = -go.width * go.originX, top = -go.height * go.originY, poorlyBounded = ![
			left,
			top,
			go.width,
			go.height
		].every(Number.isFinite) || !(go.width > 0 && go.height > 0);
		if (!(bounds.width > 0 && bounds.height > 0) || !poorlyBounded && !matrix.applyInverse) return;
		// Phaser focuses a sized Container on its center-based logical rectangle,
		// not the bounds of its children. Positive-coordinate scene groups can
		// extend far outside it. Use the documented camera-context path only for
		// overflowing groups; ordinary sprites and centered UI keep tight buffers.
		const outside = poorlyBounded || [
			[bounds.x, bounds.y],
			[bounds.x + bounds.width, bounds.y],
			[bounds.x, bounds.y + bounds.height],
			[bounds.x + bounds.width, bounds.y + bounds.height]
		].some(([x, y]) => {
			const point = matrix.applyInverse(x, y, {});
			return point.x < left - .5 || point.x > left + go.width + .5 || point.y < top - .5 || point.y > top + go.height + .5;
		});
		if (outside) {
			if (!filterFocusBaselines.has(go)) filterFocusBaselines.set(go, go.filtersFocusContext);
			go.filtersFocusContext = true;
		}
	};
	const clear = (key) => {
		const e = entries.get(key);
		if (!e) return;
		entries.delete(key);
		e.timer?.remove(false);
		for (const timer of e.timers) timer.remove(false);
		for (const child of e.children) clear(child);
		for (const tween of e.tweens) tween.remove();
		for (const visual of e.visuals) {
			scene.events.off("update", visual.update);
			visual.go.destroy();
		};
		for (const f of e.filters) if (f.controller.camera) f.list.remove(f.controller, true);
		if (filterFocusBaselines.has(e.target) && ![...entries.values()].some((other) => other.target === e.target && other.filters.length)) {
			e.target.filtersFocusContext = filterFocusBaselines.get(e.target);
			filterFocusBaselines.delete(e.target);
		};
		for (const property of e.cameraEffects) if (![...entries.values()].some((other) => other.target === e.target && other.cameraEffects.has(property))) e.target[property]?.reset();
		for (const property of e.properties) if (![...entries.values()].some((other) => other.target === e.target && other.properties.has(property))) {
			const base = baselines.get(e.target), value = base?.get(property);
			if (value !== undefined) {
				e.target[property] = value;
				base.delete(property);
			};
			if (!base?.size) baselines.delete(e.target);
		}
	};
	const api = {
		upsert: (preset) => {
			presets.set(preset.id, preset);
		},
		play: (target, presetId, options = {}) => {
			const go = resolve(target), preset = options.preset ?? presets.get(presetId);
			if (!go || !preset) return false;
			let identity = identities.get(go);
			if (!identity) {
				identity = "target_" + ++serial;
				identities.set(go, identity);
			};
			const key = String(identity) + "/" + (options.key ?? preset.id);
			clear(key);
			const e = {
				target: go,
				presetId,
				filters: [],
				tweens: [],
				timer: null,
				timers: [],
				children: new Set(),
				parent: options.parent,
				properties: new Set(),
				cameraEffects: new Set(),
				visuals: []
			};
			entries.set(key, e);
			const capture = (property) => {
				let map = baselines.get(go);
				if (!map) {
					map = new Map();
					baselines.set(go, map);
				};
				if (!map.has(property)) map.set(property, go[property]);
				e.properties.add(property);
			};
			const color = (v) => parseInt(String(v ?? "#ffffff").replace("#", ""), 16);
			if (preset.items.some((item) => item.enabled && item.timing)) {
				const items = preset.items.filter((item) => item.enabled);
				for (const item of items) {
					const childKey = (options.key ?? preset.id) + "/item/" + item.id, apply = () => {
						if (entries.get(key) !== e || go.active === false) return;
						const child = {
							...preset,
							items: [{
								...item,
								timing: undefined
							}],
							duration: item.timing?.duration ?? 0
						};
						e.children.add(String(identity) + "/" + childKey);
						api.play(go, presetId, {
							key: childKey,
							scope: options.scope,
							values: options.values,
							preset: child,
							parent: key,
							origin: options.origin
						});
					};
					if (item.timing?.start) e.timers.push(scene.time.delayedCall(item.timing.start, apply));
					else apply();
				};
				const finite = items.every((item) => (item.timing?.duration ?? 0) > 0), duration = options.duration ?? (preset.duration || (finite ? Math.max(0, ...items.map((item) => item.timing.start + item.timing.duration)) : 0));
				if (duration > 0) e.timer = scene.time.delayedCall(duration, () => clear(key));
				return true;
			};
			try {
				for (const item of preset.items) {
					if (!item.enabled) continue;
					const p = {
						...item.params,
						...options.values?.[item.id]
					}, num = (key) => Number(p[key]);
					if (item.type === "sprite") {
						const asset = project.assets.find((a) => a.id === item.assetId && a.type !== "audio");
						if (!asset) throw Error("원화 애니메이션의 이미지 리소스를 연결하세요.");
						const number = (name, fallback) => Number.isFinite(Number(p[name])) ? Number(p[name]) : fallback, start = Math.max(0, Math.floor(number("frameStart", 0))), end = Math.max(start, Math.floor(number("frameEnd", start))), count = asset.atlas?.frames.length ?? (asset.type === "image" ? 1 : asset.frameTotal ?? 1), fps = Math.max(1, Math.min(120, number("fps", 24)));
						if (start >= count || end >= count) throw Error("원화 애니메이션의 프레임 범위를 확인하세요.");
						if (item.animation && ![
							"width",
							"height",
							"x",
							"y",
							"angle",
							"opacity"
						].includes(item.animation.property)) throw Error("원화의 시간 변화 속성을 확인하세요.");
						const textureAt = (index) => {
							const frame = asset.atlas?.frames[index];
							return {
								key: project.official ? "forge-added-" + asset.id : frame?.pageId ?? asset.id,
								frame: frame?.pageId ? `${asset.id}:${index}` : frame?.name ?? (asset.type === "image" ? undefined : index)
							};
						}, first = textureAt(start), sprite = scene.add.sprite(0, 0, first.key, first.frame), life = Math.max(1, number("duration", 0) || (end - start + 1) * 1e3 / fps), fadeIn = Math.max(0, number("fadeIn", 0)), fadeOut = Math.max(0, number("fadeOut", 70)), sourceWidth = asset.atlas?.frames[start]?.sourceWidth ?? asset.frameWidth ?? asset.width, sourceHeight = asset.atlas?.frames[start]?.sourceHeight ?? asset.frameHeight ?? asset.height, scale = Math.max(.01, options.origin?.scale ?? 1), follow = p.follow === "follow";
						if (item.animation) {
							const animation = item.animation;
							p[animation.property] = animation.from;
							e.tweens.push(scene.tweens.add({
								targets: p,
								[animation.property]: animation.to,
								duration: animation.duration,
								delay: animation.delay,
								repeat: animation.repeat,
								yoyo: animation.yoyo,
								ease: animation.ease
							}));
						};
						const size = () => {
							const w = Math.max(0, number("width", 96)) || sourceWidth, h = Math.max(0, number("height", 0)) || sourceHeight * w / Math.max(1, sourceWidth);
							sprite.setDisplaySize(w * scale, h * scale);
						};
						sprite.setOrigin(number("originX", .5), p.orientation === "target" && options.origin?.mirrorY === true ? 1 - number("originY", .5) : number("originY", .5)).setFlipY(p.orientation === "target" && options.origin?.mirrorY === true).setBlendMode(Phaser.BlendModes?.[String(p.blend ?? "NORMAL")] ?? 0);
						size();
						sprite.setData?.("forgeEffectSprite", {
							presetId,
							itemId: item.id,
							assetId: asset.id,
							start,
							end,
							fps
						});
						sprite.cameraFilter = typeof go.setZoom === "function" ? (scene.cameras.cameras ?? []).reduce((mask, camera) => camera === go ? mask : mask | (camera.id ?? 0), 0) : go.cameraFilter ?? 0;
						sprite.setScrollFactor(go.scrollFactorX ?? 1, go.scrollFactorY ?? 1);
						const sourceTransform = () => {
							const camera = typeof go.setZoom === "function";
							let x = camera ? go.worldView?.centerX ?? go.scrollX + go.width / 2 : go.x ?? 0, y = camera ? go.worldView?.centerY ?? go.scrollY + go.height / 2 : go.y ?? 0, angle = go.rotation ?? 0;
							if (go.parentContainer && go.getWorldTransformMatrix) {
								const matrix = go.getWorldTransformMatrix();
								x = matrix.tx;
								y = matrix.ty;
								angle = matrix.rotation ?? angle;
							};
							return {
								x,
								y,
								angle
							};
						}, snapshot = sourceTransform(), transform = () => {
							const current = follow ? sourceTransform() : snapshot, x = options.origin ? options.origin.x + current.x - snapshot.x : current.x, y = options.origin ? options.origin.y + current.y - snapshot.y : current.y, angle = options.origin?.angle !== undefined ? options.origin.angle + current.angle - snapshot.angle : current.angle;
							const rotation = p.orientation === "target" ? angle : 0, mirror = p.orientation === "target" && options.origin?.mirrorY === true ? -1 : 1, ox = number("x", 0), oy = number("y", 0) * mirror;
							sprite.setPosition(x + ox * Math.cos(rotation) - oy * Math.sin(rotation), y + ox * Math.sin(rotation) + oy * Math.cos(rotation));
							sprite.setRotation(rotation + number("angle", 0) * Math.PI * mirror / 180);
							sprite.setDepth((Number(go.depth) || 0) + number("depth", 1));
						};
						let elapsed = 0, frameIndex = start, removed = false;
						const dispose = () => {
							if (removed) return;
							removed = true;
							scene.events.off("update", update);
							sprite.destroy();
							e.visuals = e.visuals.filter((row) => row.go !== sprite);
							if (!e.visuals.length && preset.items.every((item) => !item.enabled || item.type === "sprite")) clear(key);
						}, update = (_time, delta) => {
							if (removed) return;
							// 접촉점에 고정한 원화는 상대 사망·풀 재사용 뒤에도 한 번의 재생을 마친다.
							if (follow && (go.active === false || !go.scene && go.destroyed)) {
								dispose();
								return;
							};
							elapsed += Math.max(0, delta) * (scene.time.timeScale ?? 1);
							if (elapsed >= life) {
								dispose();
								return;
							};
							const index = Math.min(end, start + Math.floor(elapsed / 1e3 * fps));
							if (index !== frameIndex) {
								const texture = textureAt(index);
								sprite.setTexture(texture.key, texture.frame);
								frameIndex = index;
							};
							if (follow || item.animation && [
								"x",
								"y",
								"angle"
							].includes(item.animation.property)) transform();
							size();
							sprite.setAlpha(Math.max(0, Math.min(1, number("opacity", 1))) * (fadeIn ? Math.min(1, elapsed / fadeIn) : 1) * (fadeOut ? Math.min(1, (life - elapsed) / fadeOut) : 1));
						};
						transform();
						sprite.setAlpha(fadeIn ? 0 : Math.max(0, Math.min(1, number("opacity", 1))));
						e.visuals.push({
							go: sprite,
							update
						});
						scene.events.on("update", update);
						continue;
					};
					if (item.type === "tween") {
						const property = String(p.property) === "opacity" ? "alpha" : String(p.property) === "rotation" ? "angle" : String(p.property);
						if (property === "scale") {
							const camera = typeof go.setZoom === "function";
							const x = camera ? "zoomX" : "scaleX", y = camera ? "zoomY" : "scaleY";
							capture(x);
							capture(y);
							const baseX = baselines.get(go).get(x), baseY = baselines.get(go).get(y);
							go[x] = baseX * num("from");
							go[y] = baseY * num("from");
							e.tweens.push(scene.tweens.add({
								targets: go,
								[x]: baseX * num("to"),
								[y]: baseY * num("to"),
								duration: num("duration"),
								repeat: num("repeat"),
								yoyo: !!num("yoyo"),
								ease: "Sine.InOut"
							}));
						} else if ([
							"alpha",
							"angle",
							"x",
							"y"
						].includes(property)) {
							capture(property);
							go[property] = num("from");
							e.tweens.push(scene.tweens.add({
								targets: go,
								[property]: num("to"),
								duration: num("duration"),
								repeat: num("repeat"),
								yoyo: !!num("yoyo"),
								ease: "Sine.InOut"
							}));
						};
						continue;
					};
					if ([
						"pan",
						"zoom",
						"rotate"
					].includes(item.type)) {
						if (typeof go.setZoom !== "function") {
							error("카메라 이동·확대·회전은 카메라에 적용하세요.");
							continue;
						};
						if (item.type === "pan") {
							capture("scrollX");
							capture("scrollY");
							e.cameraEffects.add("panEffect");
							const center = {
								x: go.scrollX + go.width / 2,
								y: go.scrollY + go.height / 2
							};
							go.pan(center.x + num("x"), center.y + num("y"), num("duration"), Phaser.Tweens.Builders.GetEaseFunction(String(p.ease)), true);
						} else {
							const values = {};
							if (item.type === "zoom") {
								capture("zoomX");
								capture("zoomY");
								values.zoomX = go.zoomX * num("amount");
								values.zoomY = go.zoomY * num("amount");
							} else {
								capture("rotation");
								values.rotation = go.rotation + num("angle") * Math.PI / 180;
							};
							e.tweens.push(scene.tweens.add({
								targets: go,
								...values,
								duration: num("duration"),
								ease: String(p.ease),
								yoyo: !!Number(p.yoyo ?? 0),
								repeat: Math.max(0, Math.min(100, Math.floor(Number(p.repeat) || 0)))
							}));
						};
						continue;
					};
					if ([
						"shake",
						"flash",
						"fade",
						"fadeIn"
					].includes(item.type)) {
						if (!go.filters || go.enableFilters) {
							error("화면 흔들림·번쩍임·페이드는 카메라에 적용하세요.");
							continue;
						};
						e.cameraEffects.add(item.type === "fadeIn" ? "fadeEffect" : item.type + "Effect");
						if (item.type === "shake") go.shake(num("duration"), num("amount"));
						else {
							const value = color(p.color), args = [
								num("duration"),
								value >> 16 & 255,
								value >> 8 & 255,
								value & 255
							];
							if (item.type === "flash") go.flash(...args);
							else if (item.type === "fadeIn") go.fadeIn(...args);
							else go.fadeOut(...args);
						};
						continue;
					};
					if (!scene.game.renderer.gl) {
						if (!webglWarning) {
							error("이 실행 환경은 WebGL 필터를 지원하지 않습니다.");
							webglWarning = true;
						};
						continue;
					};
					go.enableFilters?.();
					const list = go.filters?.[options.scope ?? "internal"];
					if (!list) continue;
					let controller;
					if (item.type === "glow") controller = list.addGlow(color(p.color), num("outerStrength"), num("innerStrength"), num("scale"), false, num("quality"), num("distance"));
					else if (item.type === "shadow") controller = list.addShadow(num("x"), num("y"), num("decay"), num("power"), color(p.color), num("samples"), num("intensity"));
					else if (item.type === "blur") controller = list.addBlur(num("quality"), num("x"), num("y"), num("strength"), 16777215, num("steps"));
					else if (item.type === "bokeh") controller = list.addBokeh(num("radius"), num("amount"), num("contrast"));
					else if (item.type === "tiltShift") controller = list.addTiltShift(num("radius"), num("amount"), num("contrast"), num("blurX"), num("blurY"), num("strength"));
					else if (item.type === "pixelate") controller = list.addPixelate(num("amount"));
					else if (item.type === "barrel") controller = list.addBarrel(num("amount"));
					else if (item.type === "vignette") controller = list.addVignette(num("x"), num("y"), num("radius"), num("strength"), color(p.color));
					else if (item.type === "color") {
						controller = list.addColorMatrix();
						const mode = String(p.mode);
						if ([
							"grayscale",
							"sepia",
							"negative",
							"brightness",
							"contrast",
							"saturate",
							"hue",
							"night",
							"lsd"
						].includes(mode)) controller.colorMatrix[mode](num("amount"));
					} else if (item.type === "quantize") controller = list.addQuantize({
						steps: [
							num("steps"),
							num("steps"),
							num("steps"),
							255
						],
						dither: !!num("dither")
					});
					else if (item.type === "threshold") controller = list.addThreshold(num("edge1"), num("edge2"));
					else if (item.type === "wipe") {
						controller = list.addWipe(num("width"), num("direction"), num("axis"));
						controller.progress = num("progress");
					} else if (item.type === "displacement" || item.type === "blend") {
						const a = project.assets.find((a) => a.id === item.assetId), f = a?.atlas?.frames[0], texture = a ? scene.textures.getFrame(project.official ? "forge-added-" + a.id : f?.pageId ?? a.id, f?.pageId ? `${a.id}:0` : f?.name ?? (a.type === "image" ? undefined : 0)) : null;
						if (!texture) throw Error("효과에 사용할 이미지 리소스를 연결하세요.");
						controller = item.type === "displacement" ? list.addDisplacement(texture, num("x"), num("y")) : list.addBlend(texture, Phaser.BlendModes[String(p.mode)] ?? Phaser.BlendModes.SCREEN, num("amount"));
					} else if (item.type === "shader") {
						let hash = 2166136261;
						for (let i = 0; i < item.fragment.length; i++) hash = Math.imul(hash ^ item.fragment.charCodeAt(i), 16777619);
						const nodeName = "ForgeFilter_" + (hash >>> 0).toString(16), source = item.fragment;
						if (!scene.game.renderer.renderNodes.hasNode(nodeName)) {
							class CustomNode extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
								constructor(manager) {
									super(nodeName, manager, null, source);
								}
								setupUniforms(control, context) {
									this.programManager.setUniform("uTime", (control.camera?.scene?.time?.now ?? 0) / 1e3);
									this.programManager.setUniform("uResolution", [context.width, context.height]);
									for (const [key, value] of Object.entries(control.values)) this.programManager.setUniform(key, value);
								}
							}
							scene.game.renderer.renderNodes.addNodeConstructor(nodeName, CustomNode);
						};
						controller = new Phaser.Filters.Controller(list.camera, nodeName);
						controller.values = Object.fromEntries(item.uniforms.map((u) => [u.key, Number(p[u.key] ?? u.value)]));
						list.add(controller);
					};
					if (controller) {
						controller.setPaddingOverride?.(null);
						e.filters.push({
							list,
							controller
						});
						preserveContainerFilterBounds(go);
						if (item.animation) {
							const a = item.animation, object = item.type === "shader" ? controller.values : controller;
							if (![
								"__proto__",
								"constructor",
								"prototype"
							].includes(a.property)) {
								object[a.property] = a.from;
								e.tweens.push(scene.tweens.add({
									targets: object,
									[a.property]: a.to,
									duration: a.duration,
									delay: a.delay,
									repeat: a.repeat,
									yoyo: a.yoyo,
									ease: a.ease
								}));
							}
						}
					}
				};
				const duration = options.duration ?? preset.duration;
				if (duration > 0) e.timer = scene.time.delayedCall(duration, () => clear(key));
				return true;
			} catch (cause) {
				clear(key);
				error(preset.name + ": " + String(cause));
				return false;
			}
		},
		bind: (target, bindings) => {
			for (const b of bindings ?? []) if (b.enabled) api.play(target, b.presetId, {
				key: b.id,
				scope: b.scope,
				values: b.values
			});
		},
		stop: (target, presetId, key) => {
			const go = resolve(target);
			for (const [id, e] of entries) if (e.target === go && (!presetId || e.presetId === presetId) && (!key || id.endsWith("/" + key))) clear(id);
		},
		controls: (target) => {
			const go = resolve(target), properties = new Set(), presetIds = new Set();
			for (const entry of entries.values()) {
				if (entry.target !== go) continue;
				presetIds.add(entry.presetId);
				for (const property of entry.properties) properties.add(property);
			};
			return {
				properties: [...properties],
				presetIds: [...presetIds]
			};
		},
		status: () => [...entries.values()].filter((e) => !e.parent).map((e) => ({
			target: e.target.name ?? "카메라",
			presetId: e.presetId,
			filters: e.filters.length + [...e.children].reduce((sum, key) => sum + (entries.get(key)?.filters.length ?? 0), 0),
			sprites: e.visuals.length + [...e.children].reduce((sum, key) => sum + (entries.get(key)?.visuals.length ?? 0), 0),
			activeItems: e.children.size ? [...e.children].filter((key) => entries.has(key)).length : undefined
		})),
		destroy: () => {
			for (const key of [...entries.keys()]) clear(key);
		}
	};
	return api;
},function createGameplayRuntime(project, definition, host) {
	const actors = new Map();
	let elapsed = 0, routeBudget = 4, obstacleTime = -Infinity, obstacleRects = [], destroyed = false, inUpdate = false;
	const targetCells = new Map();
	const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
	const anchor = (go) => go?.getData?.("forgeAnchor") ?? go;
	const position = (go) => {
		go = anchor(go);
		if (go.parentContainer && go.getWorldTransformMatrix) {
			const m = go.getWorldTransformMatrix();
			return {
				x: m.tx,
				y: m.ty
			};
		};
		return {
			x: finite(go.x),
			y: finite(go.y)
		};
	};
	const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
	const actorSetting = (actor) => actor.def.gameplay?.agent;
	const combatSetting = (actor) => actor.def.gameplay?.combat;
	const team = (actor) => host.factions?.()?.team(actor.def.id) ?? actor.def.gameplay?.faction ?? combatSetting(actor)?.team ?? "";
	const relation = (actor, target) => host.factions?.()?.relation(team(actor), team(target)) ?? (team(actor) === team(target) ? "friendly" : "hostile");
	const attackable = (actor, target) => {
		const value = relation(actor, target), settings = combatSetting(actor);
		return value === "hostile" || value === "friendly" && !!settings?.friendlyFire || value === "neutral" && !!settings?.attackNeutral;
	};
	const isPlayer = (target) => ["topdown", "platformer"].includes(target.def.behavior) || team(target) === "player";
	const matchesTarget = (actor, target, settings, explicit = false) => (settings.targetMode ?? "team") === "team" ? explicit || team(target) === settings.targetTeam : settings.targetMode === "player" ? isPlayer(target) : relation(actor, target) === settings.targetMode;
	const data = (actor, key, value) => actor.go.setData?.(key, value);
	const state = (actor, key, value, trigger = false) => {
		for (const binding of actor.def.stateMachines ?? []) {
			const machine = project.stateMachines?.find((m) => m.id === binding.machineId);
			if (!machine?.parameters.some((p) => p.key === key || p.id === key)) continue;
			if (trigger) host.states()?.trigger(actor.def.id, key, machine.id);
			else host.states()?.set(actor.def.id, key, value, machine.id);
		}
	};
	const invoke = (id, owner, args = {}) => {
		if (id) host.run(id, args, owner.def.id);
	};
	const stats = (actor) => {
		const c = combatSetting(actor);
		const result = {
			maxHp: c?.maxHp ?? 100,
			attack: c?.attack ?? 0,
			defense: c?.defense ?? 0,
			maxEnergy: c?.maxEnergy ?? 0
		};
		const record = project.definitions?.find((d) => d.id === c?.definitionId);
		for (const field of record?.fields ?? []) if (field.type === "number" && field.key in result) result[field.key] = Math.max(0, finite(field.value, result[field.key]));
		if (c?.useEquipment) {
			const equipment = host.equipment?.() ?? {};
			for (const key of Object.keys(result)) result[key] += finite(equipment[key]);
			result.attack += finite(equipment["공격력"]);
			result.defense += finite(equipment["방어력"]);
			result.maxHp += finite(equipment["최대 체력"]);
		};
		result.maxHp = Math.max(1, result.maxHp);
		result.maxEnergy = Math.max(0, result.maxEnergy);
		return result;
	};
	function publish(actor) {
		const s = stats(actor);
		actor.hp = Math.max(0, Math.min(s.maxHp, actor.hp));
		actor.energy = Math.max(0, Math.min(s.maxEnergy, actor.energy));
		data(actor, "hp", actor.hp);
		data(actor, "maxHp", s.maxHp);
		data(actor, "energy", actor.energy);
		data(actor, "combatStatus", actor.effects.map((e) => ({
			id: e.id,
			name: e.name,
			remaining: e.remaining,
			stacks: e.stacks
		})));
		data(actor, "aiState", actor.ai);
		data(actor, "aiTarget", actor.target);
		data(actor, "gameplayBlocked", actor.hp <= 0 || actor.effects.some((e) => e.kind === "stun"));
		state(actor, "hp", actor.hp);
		state(actor, "energy", actor.energy);
		state(actor, "aiState", actor.ai);
		const c = combatSetting(actor), a = actorSetting(actor);
		if (c?.healthVariableId) host.write?.(c.healthVariableId, actor.hp);
		if (c?.energyVariableId) host.write?.(c.energyVariableId, actor.energy);
		if (a?.stateVariableId) host.write?.(a.stateVariableId, actor.ai);
		if (!a || !actor.enabled) {
			const velocity = anchor(actor.go).body?.velocity;
			if (velocity) {
				state(actor, "moving", Math.hypot(velocity.x, velocity.y) > .5);
				if (Math.abs(velocity.x) > .5) state(actor, "facing", velocity.x < 0 ? "left" : "right");
			}
		}
	}
	function sync() {
		const live = new Set();
		const entries = host.actors(), required = new Set(entries.map((e) => e.def.gameplay?.agent?.targetId).filter(Boolean));
		const playerTargets = entries.some((entry) => entry.def.gameplay?.agent?.targetMode === "player");
		for (const a of actors.values()) if (a.forcedTarget) required.add(a.forcedTarget);
		for (const entry of entries) {
			if (!entry.go?.active || !entry.def.gameplay && !required.has(entry.def.id) && !(playerTargets && isPlayer(entry)) || entry.go.getData?.("forgeUiTransient")) continue;
			live.add(entry.def.id);
			if (actors.get(entry.def.id)?.go === entry.go) continue;
			const actor = {
				...entry,
				home: position(entry.go),
				hp: 100,
				energy: 0,
				cooldowns: {},
				effects: [],
				invulnerable: 0,
				ai: "idle",
				enabled: entry.def.gameplay?.agent?.enabled ?? false,
				target: "",
				lostFor: 0,
				wait: 0,
				waypoint: 0,
				route: [],
				repath: 0,
				facing: {
					x: 1,
					y: 0
				},
				blocked: false,
				seen: "",
				decisionAt: 0,
				decisionRevision: -1,
				decisions: 0
			};
			const s = stats(actor);
			actor.hp = s.maxHp;
			actor.energy = s.maxEnergy;
			actors.set(entry.def.id, actor);
			publish(actor);
		};
		for (const id of actors.keys()) if (!live.has(id)) actors.delete(id);
	}
	function obstacles() {
		if (elapsed - obstacleTime < 200) return obstacleRects;
		obstacleTime = elapsed;
		obstacleRects = [];
		for (const { def, go } of host.actors()) {
			if (!go?.active || def.physics !== "static" || def.fixed) continue;
			if (def.kind === "tilemap" && go.layer?.data) {
				for (const row of go.layer.data) for (const tile of row) if (tile.collides) obstacleRects.push({
					id: def.id,
					rect: {
						x: go.x + tile.pixelX * go.scaleX,
						y: go.y + tile.pixelY * go.scaleY,
						width: tile.width * go.scaleX,
						height: tile.height * go.scaleY
					}
				});
			} else {
				const physical = anchor(go), body = physical.body;
				const rect = body ? {
					x: body.x,
					y: body.y,
					width: body.width,
					height: body.height
				} : go.getBounds?.();
				if (rect?.width > 0 && rect.height > 0) obstacleRects.push({
					id: def.id,
					rect
				});
			}
		};
		return obstacleRects;
	}
	const segmentRect = (from, to, rect) => {
		let low = 0, high = 1;
		for (const [a, b, min, max] of [[
			from.x,
			to.x,
			rect.x,
			rect.x + rect.width
		], [
			from.y,
			to.y,
			rect.y,
			rect.y + rect.height
		]]) {
			const delta = b - a;
			if (Math.abs(delta) < 1e-9) {
				if (a < min || a > max) return false;
				continue;
			};
			const q = (min - a) / delta, r = (max - a) / delta;
			low = Math.max(low, Math.min(q, r));
			high = Math.min(high, Math.max(q, r));
			if (low > high) return false;
		};
		return true;
	};
	const clearLine = (from, to, owner = "", target = "") => !obstacles().some((o) => o.id !== owner && o.id !== target && segmentRect(from, to, o.rect));
	function findPath(actor, destination, settings) {
		const size = settings.cellSize, width = Math.max(1, Math.ceil((definition.worldWidth || project.width) / size)), height = Math.max(1, Math.ceil((definition.worldHeight || project.height) / size));
		if (width * height > 262144) {
			host.error("이동 격자가 너무 큽니다. AI의 경로 칸 크기를 늘리세요.");
			return null;
		};
		const sx = Math.max(0, Math.min(width - 1, Math.floor(position(actor.go).x / size))), sy = Math.max(0, Math.min(height - 1, Math.floor(position(actor.go).y / size)));
		let gx = Math.max(0, Math.min(width - 1, Math.floor(destination.x / size))), gy = Math.max(0, Math.min(height - 1, Math.floor(destination.y / size)));
		const blocked = new Uint8Array(width * height), radius = settings.radius;
		for (const o of obstacles()) if (o.id !== actor.def.id && o.id !== actor.target) {
			const left = Math.max(0, Math.ceil((o.rect.x - radius) / size - .5)), right = Math.min(width - 1, Math.floor((o.rect.x + o.rect.width + radius) / size - .5));
			const top = Math.max(0, Math.ceil((o.rect.y - radius) / size - .5)), bottom = Math.min(height - 1, Math.floor((o.rect.y + o.rect.height + radius) / size - .5));
			for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) blocked[y * width + x] = 1;
		};
		if (blocked[gy * width + gx]) {
			let best = Infinity, candidate;
			for (let y = Math.max(0, gy - 4); y <= Math.min(height - 1, gy + 4); y++) for (let x = Math.max(0, gx - 4); x <= Math.min(width - 1, gx + 4); x++) {
				const d = Math.hypot(x - gx, y - gy);
				if (!blocked[y * width + x] && d < best) {
					candidate = {
						x,
						y
					};
					best = d;
				}
			};
			if (!candidate) return null;
			gx = candidate.x;
			gy = candidate.y;
		};
		const start = sy * width + sx, goal = gy * width + gx;
		const costs = new Float64Array(width * height);
		costs.fill(Infinity);
		costs[start] = 0;
		const previous = new Int32Array(width * height);
		previous.fill(-1);
		const closed = new Uint8Array(width * height);
		const queue = [];
		const push = (key, score) => {
			let i = queue.length;
			queue.push({
				key,
				score
			});
			while (i) {
				const parent = i - 1 >> 1;
				if (queue[parent].score <= score) break;
				queue[i] = queue[parent];
				i = parent;
			};
			queue[i] = {
				key,
				score
			};
		};
		const pop = () => {
			const first = queue[0], last = queue.pop();
			if (queue.length) {
				let i = 0;
				while (i * 2 + 1 < queue.length) {
					let child = i * 2 + 1;
					if (child + 1 < queue.length && queue[child + 1].score < queue[child].score) child++;
					if (queue[child].score >= last.score) break;
					queue[i] = queue[child];
					i = child;
				};
				queue[i] = last;
			};
			return first.key;
		};
		push(start, 0);
		let expanded = 0;
		while (queue.length && expanded++ < 12e3) {
			const key = pop();
			if (closed[key]) continue;
			if (key === goal) {
				const path = [];
				let n = key;
				while (n !== start) {
					path.push({
						x: (n % width + .5) * size,
						y: (Math.floor(n / width) + .5) * size
					});
					n = previous[n];
					if (n < 0) return null;
				};
				path.reverse();
				if (!path.length) path.push({ ...destination });
				return path;
			};
			closed[key] = 1;
			const x = key % width, y = Math.floor(key / width);
			for (const [nx, ny] of [
				[x - 1, y],
				[x + 1, y],
				[x, y - 1],
				[x, y + 1]
			]) {
				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
				const next = ny * width + nx, cost = costs[key] + 1;
				if (blocked[next] || closed[next] || cost >= costs[next]) continue;
				costs[next] = cost;
				previous[next] = key;
				push(next, cost + Math.abs(nx - gx) + Math.abs(ny - gy));
			}
		};
		return null;
	}
	const stunned = (actor) => actor.effects.some((e) => e.kind === "stun");
	function move(actor, direction, speed, delta) {
		const go = anchor(actor.go), length = Math.hypot(direction.x, direction.y), vx = length ? direction.x / length * speed : 0, vy = length ? direction.y / length * speed : 0;
		if (go.body?.setVelocity) go.body.setVelocity(vx, vy);
		else {
			const pos = position(go), dest = {
				x: pos.x + vx * delta / 1e3,
				y: pos.y + vy * delta / 1e3
			};
			if (go.parentContainer?.getWorldTransformMatrix) {
				const local = go.parentContainer.getWorldTransformMatrix().applyInverse(dest.x, dest.y);
				go.x = local.x;
				go.y = local.y;
			} else {
				go.x = dest.x;
				go.y = dest.y;
			}
		};
		if (length) actor.facing = {
			x: direction.x / length,
			y: direction.y / length
		};
		state(actor, "moving", speed > 0 && length > 0);
		if (Math.abs(vx) > .01) state(actor, "facing", vx < 0 ? "left" : "right");
	}
	const basicSkill = (c) => ({
		id: "basic",
		name: "기본 공격",
		power: 0,
		attackScale: 1,
		defenseScale: 1,
		element: "physical",
		range: c.range,
		cost: 0,
		castMs: c.castMs,
		cooldownMs: c.cooldownMs,
		statusId: "",
		onHit: ""
	});
	function changeHealth(actor, amount, source = "", allowInvulnerable = false) {
		if (!combatSetting(actor)?.enabled || actor.hp <= 0 || amount < 0 && actor.invulnerable > 0 && !allowInvulnerable) return 0;
		const previous = actor.hp;
		actor.hp = Math.max(0, Math.min(stats(actor).maxHp, actor.hp + amount));
		if (actor.hp < previous) {
			if (!allowInvulnerable) actor.invulnerable = combatSetting(actor).invulnerableMs;
			state(actor, "hurt", true, true);
			invoke(combatSetting(actor)?.onHurt, actor, {
				sourceId: source,
				damage: previous - actor.hp,
				hp: actor.hp
			});
		};
		if (actor.hp === 0) {
			actor.ai = "dead";
			actor.cast = undefined;
			move(actor, {
				x: 0,
				y: 0
			}, 0, 0);
			invoke(combatSetting(actor)?.onDeath, actor, { sourceId: source });
		};
		publish(actor);
		return Math.abs(actor.hp - previous);
	}
	function applyStatus(targetId, status, source = "") {
		const actor = actors.get(targetId);
		if (!actor || actor.hp <= 0) return false;
		const existing = actor.effects.find((e) => e.id === status.id);
		if (!existing) actor.effects.push({
			...status,
			remaining: status.duration,
			tick: 0,
			stacks: 1,
			source
		});
		else if (status.stacking === "replace") Object.assign(existing, status, {
			remaining: status.duration,
			tick: 0,
			stacks: 1,
			source
		});
		else {
			existing.remaining = status.duration;
			if (status.stacking === "stack") existing.stacks = Math.min(status.maxStacks, existing.stacks + 1);
		};
		if (status.kind === "stun") actor.cast = undefined;
		publish(actor);
		return true;
	}
	function hit(actor, target, skill) {
		if (actor.hp <= 0 || target.hp <= 0 || !target.go.active || !attackable(actor, target) || distance(position(actor.go), position(target.go)) > skill.range || !clearLine(position(actor.go), position(target.go), actor.def.id, target.def.id)) return false;
		const offense = stats(actor), defense = stats(target), resistance = combatSetting(target)?.resistances[skill.element] ?? 0;
		const critical = Math.random() < (combatSetting(actor)?.criticalChance ?? 0);
		if (resistance >= 1) return false;
		const damage = Math.max(1, Math.round(Math.max(1, offense.attack * skill.attackScale + skill.power - defense.defense * skill.defenseScale) * (1 - resistance) * (critical ? combatSetting(actor).criticalScale : 1)));
		const changed = changeHealth(target, -damage, actor.def.id);
		if (!changed) return false;
		const status = combatSetting(actor)?.statuses.find((s) => s.id === skill.statusId);
		if (status && target.hp > 0) applyStatus(target.def.id, status, actor.def.id);
		invoke(skill.onHit || combatSetting(actor)?.onHit, actor, {
			targetId: target.def.id,
			damage: changed,
			critical
		});
		return true;
	}
	function attack(owner, targetId, skillId = "basic") {
		if (!inUpdate) sync();
		const actor = actors.get(owner), c = actor && combatSetting(actor);
		if (!actor || !c?.enabled || actor.hp <= 0 || actor.cast || stunned(actor)) return false;
		const skill = skillId === "basic" ? basicSkill(c) : c.skills.find((s) => s.id === skillId);
		if (!skill || (actor.cooldowns[skill.id] ?? 0) > 0 || actor.energy < skill.cost) return false;
		if (host.skillAllowed && !host.skillAllowed(skill, owner)) return false;
		let target = actors.get(targetId || actor.target);
		if (!target) target = [...actors.values()].filter((a) => a !== actor && combatSetting(a)?.enabled && attackable(actor, a) && a.hp > 0).sort((a, b) => distance(position(actor.go), position(a.go)) - distance(position(actor.go), position(b.go)))[0];
		if (!target || !combatSetting(target)?.enabled || target === actor || !attackable(actor, target) || distance(position(actor.go), position(target.go)) > skill.range || !clearLine(position(actor.go), position(target.go), owner, target.def.id)) return false;
		actor.energy -= skill.cost;
		actor.cooldowns[skill.id] = skill.cooldownMs;
		state(actor, "attack", true, true);
		if (skill.castMs > 0) actor.cast = {
			target: target.def.id,
			skill: { ...skill },
			remaining: skill.castMs
		};
		else hit(actor, target, skill);
		publish(actor);
		return true;
	}
	function updateAgent(actor, delta) {
		const a = actorSetting(actor);
		if (!a || !actor.enabled) return;
		if (actor.hp <= 0 || stunned(actor)) {
			move(actor, {
				x: 0,
				y: 0
			}, 0, delta);
			return;
		};
		const current = position(actor.go), candidates = [];
		const explicitTarget = actor.forcedTarget ?? a.targetId;
		const previousTarget = actors.get(actor.target);
		if (previousTarget && !matchesTarget(actor, previousTarget, a, !!explicitTarget)) {
			invoke(a.onLost, actor, { targetId: actor.target });
			actor.target = "";
			actor.lastSeen = undefined;
			actor.lostFor = 0;
			actor.route = [];
			actor.pathGoal = undefined;
			actor.seen = "";
			actor.decisionAt = 0;
		};
		const revision = host.factions?.()?.revision ?? 0, decide = elapsed >= actor.decisionAt || actor.decisionRevision !== revision;
		if (decide) {
			if (explicitTarget) {
				const target = actors.get(explicitTarget);
				if (target) candidates.push(target);
			} else {
				const radius = Math.ceil(a.detectionRange / 128), cx = Math.floor(current.x / 128), cy = Math.floor(current.y / 128);
				if (radius > 16) candidates.push(...[...actors.values()].filter((t) => t !== actor && matchesTarget(actor, t, a)));
				else for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) candidates.push(...targetCells.get(x + ":" + y) ?? []);
			};
			const canSee = (target) => {
				if (target === actor || !target.go.active || target.hp <= 0 || target.go.visible === false || !matchesTarget(actor, target, a, !!explicitTarget)) return false;
				const p = position(target.go), d = distance(current, p);
				if (d > a.detectionRange) return false;
				if (a.fieldOfView < 360 && d > .001) {
					const dot = (actor.facing.x * (p.x - current.x) + actor.facing.y * (p.y - current.y)) / d;
					if (dot < Math.cos(a.fieldOfView * Math.PI / 360)) return false;
				};
				return !a.lineOfSight || clearLine(current, p, actor.def.id, target.def.id);
			};
			let nearest, nearestDistance = Infinity;
			for (const target of candidates) if (canSee(target)) {
				const d = distance(current, position(target.go));
				if (d < nearestDistance) {
					nearest = target;
					nearestDistance = d;
				}
			};
			actor.seen = nearest?.def.id ?? "";
			actor.decisionRevision = revision;
			const interval = a.decisionIntervalMs ?? 100;
			// 첫 판단은 즉시 실행하고 다음 시각부터 오브젝트 ID별로 분산한다.
			if (actor.decisions === 0) {
				let phase = 0;
				for (let n = 0; n < actor.def.id.length; n++) phase = phase * 31 + actor.def.id.charCodeAt(n) >>> 0;
				actor.decisionAt = elapsed + Math.max(16, phase % interval);
			} else actor.decisionAt = elapsed + interval;
			actor.decisions++;
		};
		let seen = actors.get(actor.seen);
		if (seen && (!seen.go.active || seen.hp <= 0 || seen.go.visible === false || !matchesTarget(actor, seen, a, !!explicitTarget) || distance(current, position(seen.go)) > a.detectionRange)) {
			seen = undefined;
			actor.seen = "";
		};
		let goal, stop = a.stopDistance;
		if (actor.forcedHome || a.leashRange > 0 && distance(current, actor.home) > a.leashRange) {
			actor.forcedHome = true;
			actor.target = "";
			actor.lastSeen = undefined;
			actor.ai = "return";
			goal = actor.home;
			stop = 5;
			if (distance(current, actor.home) <= stop) actor.forcedHome = false;
		} else if (seen) {
			if (actor.target !== seen.def.id) invoke(a.onDetect, actor, { targetId: seen.def.id });
			actor.target = seen.def.id;
			actor.lastSeen = position(seen.go);
			actor.lostFor = 0;
			actor.wait = 0;
			actor.ai = "chase";
			goal = actor.lastSeen;
			if (a.autoAttack && combatSetting(actor)?.enabled && attack(actor.def.id, seen.def.id, a.autoAttackSkillId || "basic")) actor.ai = "attack";
		} else if (actor.lastSeen) {
			if (actor.lostFor === 0) invoke(a.onLost, actor, { targetId: actor.target });
			actor.lostFor += delta;
			actor.ai = "search";
			goal = actor.lastSeen;
			stop = 5;
			if (actor.lostFor > a.memoryMs + a.searchMs) {
				actor.lastSeen = undefined;
				actor.target = "";
				actor.route = [];
				goal = actor.home;
				actor.ai = "return";
			}
		} else if (a.mode === "follow" && explicitTarget && actors.get(explicitTarget)?.go.active && matchesTarget(actor, actors.get(explicitTarget), a, true)) goal = position(actors.get(explicitTarget).go);
		else if (a.mode === "patrol" && a.waypoints.length) {
			actor.ai = "patrol";
			goal = a.waypoints[actor.waypoint % a.waypoints.length];
			stop = 5;
			if (distance(current, goal) <= stop) {
				actor.wait += delta;
				if (actor.wait >= a.patrolWaitMs) {
					actor.waypoint = (actor.waypoint + 1) % a.waypoints.length;
					actor.wait = 0;
					actor.route = [];
				}
			}
		} else {
			goal = actor.home;
			stop = 5;
			actor.ai = distance(current, actor.home) > stop ? "return" : "idle";
		};
		if (!goal || distance(current, goal) <= stop || actor.cast) {
			actor.route = [];
			move(actor, {
				x: 0,
				y: 0
			}, 0, delta);
			publish(actor);
			return;
		};
		actor.repath -= delta;
		if ((actor.repath <= 0 || !actor.pathGoal || distance(goal, actor.pathGoal) > a.cellSize) && routeBudget > 0) {
			routeBudget--;
			const path = findPath(actor, goal, a);
			actor.repath = a.repathMs;
			actor.pathGoal = { ...goal };
			if (!path) {
				if (!actor.blocked) invoke(a.onPathFailed, actor, { targetId: actor.target });
				actor.blocked = true;
				actor.route = [];
				actor.ai = "blocked";
			} else {
				actor.blocked = false;
				actor.route = path;
			}
		};
		while (actor.route.length && distance(current, actor.route[0]) < Math.max(2, a.speed * delta / 1e3)) actor.route.shift();
		const next = actor.route[0], slow = actor.effects.filter((e) => e.kind === "slow").reduce((n, e) => Math.min(n, Math.max(.05, 1 - e.power * e.stacks / 100)), 1);
		if (actor.blocked && !next) actor.ai = "blocked";
		move(actor, next ? {
			x: next.x - current.x,
			y: next.y - current.y
		} : {
			x: 0,
			y: 0
		}, next ? a.speed * slow : 0, delta);
		publish(actor);
	}
	const graphics = host.scene.add?.graphics?.();
	if (graphics) {
		graphics.setDepth?.(9998);
		graphics.setName?.("AI 경로·시야");
	};
	function update(delta) {
		if (destroyed) return;
		delta = Math.max(0, Math.min(250, finite(delta)));
		elapsed += delta;
		routeBudget = 4;
		sync();
		inUpdate = true;
		targetCells.clear();
		for (const actor of actors.values()) {
			const p = position(actor.go), key = Math.floor(p.x / 128) + ":" + Math.floor(p.y / 128);
			const list = targetCells.get(key) ?? [];
			list.push(actor);
			targetCells.set(key, list);
		};
		for (const actor of actors.values()) {
			const c = combatSetting(actor);
			actor.invulnerable = Math.max(0, actor.invulnerable - delta);
			for (const id of Object.keys(actor.cooldowns)) actor.cooldowns[id] = Math.max(0, actor.cooldowns[id] - delta);
			if (c?.enabled && actor.hp > 0) actor.energy = Math.min(stats(actor).maxEnergy, actor.energy + c.energyRegen * delta / 1e3);
			for (const effect of actor.effects) {
				const activeDelta = Math.min(delta, effect.remaining);
				effect.remaining -= delta;
				effect.tick += activeDelta;
				while (effect.tick >= effect.tickMs && actor.hp > 0) {
					effect.tick -= effect.tickMs;
					const amount = effect.power * effect.stacks;
					if (effect.kind === "regen") changeHealth(actor, amount, effect.source, true);
					else if (effect.kind === "poison" || effect.kind === "burn") changeHealth(actor, -amount * (1 - (c?.resistances[effect.kind === "burn" ? "fire" : "poison"] ?? 0)), effect.source, true);
				}
			};
			actor.effects = actor.effects.filter((e) => e.remaining > 0);
		};
		// 모든 기존 상태의 시간을 먼저 진행한다. 이 프레임의 적중으로 생긴 상태는 다음 프레임부터 시간을 센다.
		for (const actor of actors.values()) {
			if (actor.cast) {
				actor.cast.remaining -= delta;
				if (actor.cast.remaining <= 0) {
					const cast = actor.cast;
					actor.cast = undefined;
					const target = actors.get(cast.target);
					if (target) hit(actor, target, cast.skill);
				}
			};
			updateAgent(actor, delta);
			publish(actor);
		};
		inUpdate = false;
		if (graphics) {
			graphics.clear();
			for (const actor of actors.values()) if (actorSetting(actor)?.debug) {
				const p = position(actor.go);
				graphics.lineStyle(1, 8302561, .5);
				graphics.strokeCircle(p.x, p.y, actorSetting(actor).detectionRange);
				graphics.lineStyle(2, actor.blocked ? 15628151 : 11782639, .85);
				graphics.beginPath();
				graphics.moveTo(p.x, p.y);
				for (const point of actor.route) graphics.lineTo(point.x, point.y);
				graphics.strokePath();
			}
		}
	}
	sync();
	return {
		update,
		attack,
		damage: (id, amount, source = "") => {
			sync();
			const actor = actors.get(id);
			return actor ? changeHealth(actor, -Math.max(0, finite(amount)), source) : 0;
		},
		heal: (id, amount) => {
			sync();
			const actor = actors.get(id);
			return actor ? changeHealth(actor, Math.max(0, finite(amount))) : 0;
		},
		revive: (id) => {
			sync();
			const actor = actors.get(id);
			if (!actor) return false;
			actor.hp = stats(actor).maxHp;
			actor.energy = stats(actor).maxEnergy;
			actor.effects = [];
			actor.cooldowns = {};
			actor.cast = undefined;
			actor.invulnerable = 0;
			actor.ai = "idle";
			host.states()?.reset(id);
			publish(actor);
			return true;
		},
		status: (id, statusId, source = id) => {
			sync();
			const owner = actors.get(source), status = owner && combatSetting(owner)?.statuses.find((s) => s.id === statusId);
			return status ? applyStatus(id, status, source) : false;
		},
		clearStatus: (id, statusId = "") => {
			const actor = actors.get(id);
			if (actor) {
				actor.effects = actor.effects.filter((e) => statusId && e.id !== statusId);
				publish(actor);
			}
		},
		agent: (id, command, target = "") => {
			sync();
			const actor = actors.get(id);
			if (!actor?.def.gameplay?.agent) return false;
			if (command === "enable" && actor.go.getData?.("forgeMotionPath")) {
				host.error("이동 경로를 제어 중인 오브젝트에는 AI 이동을 함께 켤 수 없습니다.");
				return false;
			};
			if (command === "enable" || command === "disable") {
				actor.enabled = command === "enable";
				actor.decisionAt = 0;
				if (!actor.enabled) move(actor, {
					x: 0,
					y: 0
				}, 0, 0);
			} else if (command === "target") {
				actor.forcedTarget = target;
				actor.target = target;
				actor.seen = "";
				actor.decisionAt = 0;
				actor.repath = 0;
			} else if (command === "return") {
				actor.lastSeen = undefined;
				actor.target = "";
				actor.seen = "";
				actor.decisionAt = 0;
				actor.forcedHome = true;
				actor.route = [];
				actor.repath = 0;
			};
			return true;
		},
		inspect: () => [...actors.values()].map((a) => ({
			id: a.def.id,
			name: a.def.name,
			team: team(a),
			targetRelation: actors.has(a.target) ? relation(a, actors.get(a.target)) : "",
			ai: a.ai,
			target: a.target,
			decisions: a.decisions,
			hp: a.hp,
			maxHp: stats(a).maxHp,
			energy: a.energy,
			path: a.route.map((p) => ({ ...p })),
			cooldowns: { ...a.cooldowns },
			statuses: a.effects.map((e) => ({ ...e }))
		})),
		snapshot: () => [...actors.values()].map((a) => ({
			id: a.def.id,
			hp: a.hp,
			energy: a.energy,
			cooldowns: { ...a.cooldowns },
			effects: a.effects.map((e) => ({ ...e })),
			invulnerable: a.invulnerable,
			cast: a.cast ? JSON.parse(JSON.stringify(a.cast)) : undefined,
			ai: a.ai,
			enabled: a.enabled,
			target: a.target,
			forcedTarget: a.forcedTarget,
			forcedHome: a.forcedHome,
			home: { ...a.home },
			lastSeen: a.lastSeen ? { ...a.lastSeen } : undefined,
			lostFor: a.lostFor,
			waypoint: a.waypoint,
			wait: a.wait
		})),
		restore: (values) => {
			sync();
			if (!Array.isArray(values)) return;
			const point = (value) => value && Number.isFinite(value.x) && Number.isFinite(value.y) ? {
				x: Math.max(-32768, Math.min(32768, value.x)),
				y: Math.max(-32768, Math.min(32768, value.y))
			} : undefined;
			for (const value of values.slice(0, 5e3)) {
				const a = actors.get(value?.id), c = a && combatSetting(a);
				if (!a || !Number.isFinite(value.hp) || !Number.isFinite(value.energy)) continue;
				a.hp = value.hp;
				a.energy = value.energy;
				const skills = c ? [basicSkill(c), ...c.skills] : [];
				a.cooldowns = Object.fromEntries(skills.map((s) => [s.id, Math.max(0, Math.min(6e5, finite(value.cooldowns?.[s.id])))]));
				a.effects = (Array.isArray(value.effects) ? value.effects : []).slice(0, 64).flatMap((e) => {
					if (!e || ![
						"poison",
						"burn",
						"regen",
						"stun",
						"slow"
					].includes(e.kind) || typeof e.id !== "string" || !Number.isFinite(e.power) || e.power < 0 || !Number.isFinite(e.remaining) || e.remaining <= 0 || !Number.isFinite(e.tickMs) || e.tickMs < 50) return [];
					const tickMs = Math.min(6e4, e.tickMs), maxStacks = Math.max(1, Math.min(100, Math.floor(finite(e.maxStacks, 1))));
					return [{
						id: e.id.slice(0, 200),
						name: String(e.name ?? "").slice(0, 200),
						kind: e.kind,
						power: Math.min(1e6, e.power),
						duration: Math.min(36e5, Math.max(1, finite(e.duration, e.remaining))),
						tickMs,
						maxStacks,
						stacking: [
							"refresh",
							"stack",
							"replace"
						].includes(e.stacking) ? e.stacking : "refresh",
						remaining: Math.min(36e5, e.remaining),
						tick: Math.max(0, finite(e.tick)) % tickMs,
						stacks: Math.max(1, Math.min(maxStacks, Math.floor(finite(e.stacks, 1)))),
						source: typeof e.source === "string" ? e.source.slice(0, 200) : ""
					}];
				});
				a.invulnerable = Math.max(0, Math.min(6e4, finite(value.invulnerable)));
				const castSkill = skills.find((s) => s.id === value.cast?.skill?.id);
				a.cast = castSkill && actors.has(value.cast?.target) && Number.isFinite(value.cast.remaining) ? {
					target: value.cast.target,
					skill: { ...castSkill },
					remaining: Math.max(0, Math.min(castSkill.castMs, value.cast.remaining))
				} : undefined;
				a.enabled = typeof value.enabled === "boolean" ? value.enabled : a.enabled;
				a.target = typeof value.target === "string" && actors.has(value.target) ? value.target : "";
				a.forcedTarget = typeof value.forcedTarget === "string" && host.objects.has(value.forcedTarget) ? value.forcedTarget : undefined;
				a.forcedHome = value.forcedHome === true;
				a.home = point(value.home) ?? a.home;
				a.lastSeen = point(value.lastSeen);
				a.ai = [
					"idle",
					"patrol",
					"chase",
					"search",
					"return",
					"blocked",
					"attack",
					"dead"
				].includes(value.ai) ? value.ai : "idle";
				a.lostFor = Math.max(0, Math.min(12e5, finite(value.lostFor)));
				a.waypoint = Math.max(0, Math.floor(finite(value.waypoint)));
				a.wait = Math.max(0, Math.min(6e4, finite(value.wait)));
				a.route = [];
				a.repath = 0;
				a.seen = "";
				a.decisionAt = 0;
				a.decisionRevision = -1;
				publish(a);
			}
		},
		destroy: () => {
			destroyed = true;
			graphics?.destroy();
			actors.clear();
		}
	};
},function createGameUiRuntime(project, scene, host) {
	const definitions = new Map(scene.objects.map((o) => [o.id, o]));
	const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]));
	const entries = new Map(), byObject = new Map(), transient = new Set(), templates = new Set();
	const repeaters = new Map();
	const cleanup = new Map(), warned = new Set();
	const keyEvents = new WeakMap();
	const controls = new Map();
	let focused = "", keyboardNavigation = false, destroyed = false, lastData = -Infinity, padHeld = new Set(), layoutEntries = [], layoutSize = -1, autoFocusSuppressed = false;
	const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
	const imageFrames = (asset) => {
		if (asset.atlas) return asset.atlas.frames.length;
		if (asset.frameTotal) return asset.frameTotal;
		if (asset.pixelRuns) return asset.pixelRuns.frames.length;
		if (asset.type !== "spritesheet") return 1;
		if (asset.spriteDocument) return asset.spriteDocument.frames.length;
		if (asset.composition && !asset.compositionDirty) return asset.composition.frames;
		const margin = asset.grid?.margin ?? 0, spacing = asset.grid?.spacing ?? 0;
		return Math.max(1, Math.floor((asset.width - 2 * margin + spacing) / (asset.frameWidth + spacing)) * Math.floor((asset.height - 2 * margin + spacing) / (asset.frameHeight + spacing)));
	};
	const path = (value, key) => {
		if (!key) return value;
		for (const part of key.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean)) {
			if ([
				"__proto__",
				"constructor",
				"prototype"
			].includes(part) || value == null || typeof value !== "object") return undefined;
			value = Object.prototype.hasOwnProperty.call(value, part) ? value[part] : undefined;
		};
		return value;
	};
	const decode = (value) => {
		if (typeof value !== "string") return value;
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	};
	const read = (binding, item, index = 0) => {
		let value;
		if (binding.source === "item") value = binding.path === "$index" ? index : item;
		else if (binding.source === "variable") value = decode(host.variable(binding.variableId));
		else if (binding.source === "inventory") value = host.inventory?.() ?? [];
		else {
			const definition = project.definitions?.find((d) => d.id === binding.definitionId || d.key === binding.definitionId), field = definition?.fields.find((f) => f.id === binding.fieldId || f.key === binding.fieldId);
			value = definition?.published && field?.published ? decode(field.value) : undefined;
		};
		return binding.source === "item" && binding.path === "$index" ? value : path(value, binding.path);
	};
	const warn = (key, message) => {
		if (!warned.has(key)) {
			warned.add(key);
			host.error(message);
		}
	};
	const buttonDisabled = (entry) => !!entry.def.gameUi?.buttonFrames?.isDisabled || !!(entry.def.gameUi?.buttonFrames?.disabledVariableId && decode(host.variable(entry.def.gameUi.buttonFrames.disabledVariableId))) || !!(entry.def.gameUi?.buttonColors?.enabled && (entry.def.gameUi.buttonColors.isDisabled || entry.def.gameUi.buttonColors.disabledVariableId && decode(host.variable(entry.def.gameUi.buttonColors.disabledVariableId))));
	const clearFocus = () => {
		const previous = entries.get(focused);
		if (previous) {
			previous.go.setData?.("forgeUiFocused", false);
			host.focus?.(previous.go, false);
		};
		focused = "";
	};
	const focus = (id, source = "keyboard") => {
		const entry = entries.get(id);
		if (!entry || !entry.visible || !entry.def.gameUi?.navigation.enabled || buttonDisabled(entry)) return false;
		keyboardNavigation = source !== "pointer";
		if (focused === id) return true;
		clearFocus();
		focused = id;
		entry.go.setData?.("forgeUiFocused", true);
		const ownFocusStyle = entry.def.gameUi?.buttonColors?.enabled && typeof entry.go.setFillStyle === "function" && typeof entry.go.setStrokeStyle === "function" && !(entry.def.gameUi.buttonFrames?.enabled && typeof entry.go.setTexture === "function");
		host.focus?.(entry.go, !ownFocusStyle);
		return true;
	};
	const isVisible = (entry) => {
		if (!entry.visible || entry.go.active === false) return false;
		for (let parent = entry.go.parentContainer; parent; parent = parent.parentContainer) if (parent.visible === false) return false;
		return true;
	};
	const active = () => [...entries.values()].filter((entry) => !buttonDisabled(entry) && entry.def.gameUi?.navigation.enabled && isVisible(entry) && !templates.has(entry.def.id)).sort((a, b) => finite(a.def.gameUi?.navigation.order) - finite(b.def.gameUi?.navigation.order) || a.index - b.index);
	const activate = (entry) => {
		const id = entry.def.gameUi?.navigation.functionId;
		if (!entry.visible || !id || !entry.def.gameUi?.navigation.enabled || buttonDisabled(entry)) return false;
		const item = entry.item, args = {
			index: entry.index,
			item: typeof item === "object" ? JSON.stringify(item) : item ?? "",
			value: item ?? ""
		};
		if (item && typeof item === "object" && !Array.isArray(item)) {
			for (const [key, value] of Object.entries(item)) if (![
				"index",
				"item",
				"value",
				"__proto__",
				"constructor",
				"prototype"
			].includes(key)) args[key] = value;
		};
		host.run(id, args, entry.def.id);
		return true;
	};
	const add = (definition, go, context, isTransient = false) => {
		if (!go || !definition.gameUi?.enabled && !definition.gameUi?.buttonFrames?.enabled && !definition.gameUi?.buttonColors?.enabled) return;
		const entry = {
			def: definition,
			go,
			item: context?.item,
			index: context?.index ?? 0,
			offsetX: context?.offsetX ?? 0,
			offsetY: context?.offsetY ?? 0,
			transient: isTransient,
			visible: definition.visible !== false
		};
		entries.set(definition.id, entry);
		byObject.set(go, entry);
		layoutSize = -1;
		if (definition.gameUi.enabled) {
			go.setScrollFactor?.(0);
			go.setData?.("forgeGameUi", true);
			if (go.body) go.body.enable = false;
		};
		if (isTransient) {
			transient.add(definition.id);
			go.setData?.("forgeUiTransient", true);
		};
		if (definition.gameUi.enabled && definition.gameUi.control && typeof document !== "undefined") {
			const control = definition.gameUi.control, element = document.createElement("input"), kind = control.kind;
			element.type = kind === "slider" ? "range" : kind === "input" ? "text" : "checkbox";
			element.setAttribute("aria-label", definition.name);
			if (kind === "toggle") element.setAttribute("role", "switch");
			element.min = String(control.minimum);
			element.max = String(control.maximum);
			element.step = String(control.step);
			element.maxLength = control.maxLength;
			element.placeholder = control.placeholder;
			Object.assign(element.style, {
				position: "fixed",
				zIndex: "50",
				margin: "0",
				boxSizing: "border-box",
				accentColor: "#91abc8",
				background: "#1b2736",
				color: "#e1ebf5",
				border: "1px solid #61758e",
				borderRadius: kind === "toggle" ? "18px" : "4px",
				padding: kind === "input" ? "5px 9px" : "0",
				fontFamily: "sans-serif",
				pointerEvents: "auto",
				display: "none"
			});
			document.body.append(element);
			const commit = () => {
				if (element.disabled || !isVisible(entry)) return;
				const variable = project.variables.find((v) => v.id === control.variableId), value = kind === "input" ? element.value.slice(0, control.maxLength) : kind === "slider" ? Number(element.value) : element.checked, type = kind === "input" ? "string" : kind === "slider" ? "number" : "boolean";
				if (kind === "slider" && (!Number.isFinite(value) || Number(value) < control.minimum || Number(value) > control.maximum)) return;
				if (Object.is(host.variable(control.variableId), value)) return;
				if (variable?.type !== type || !host.writeVariable?.(control.variableId, value)) {
					warn(definition.id + ".control", "UI 입력의 연결 변수를 확인하세요.");
					return;
				};
				if (definition.gameUi?.navigation.enabled && definition.gameUi.navigation.functionId) host.run(definition.gameUi.navigation.functionId, { value }, definition.id);
			};
			const change = () => commit(), key = (event) => {
				event.stopPropagation();
				if (event.key === "Escape") {
					event.preventDefault();
					element.blur();
				} else if (event.key === "Enter" && kind === "input") {
					event.preventDefault();
					commit();
					element.blur();
				}
			}, stop = (event) => event.stopPropagation(), hide = () => {
				element.style.display = "none";
				if (document.activeElement === element) element.blur();
			};
			element.addEventListener(kind === "slider" ? "input" : "change", change);
			element.addEventListener("keydown", key);
			for (const name of [
				"pointerdown",
				"pointerup",
				"click",
				"keyup",
				"wheel"
			]) element.addEventListener(name, stop);
			go.scene?.events?.on?.("sleep", hide);
			const remove = () => {
				go.scene?.events?.off?.("sleep", hide);
				element.remove();
			};
			controls.set(definition.id, {
				element,
				entry,
				remove
			});
			go.once?.("destroy", () => {
				remove();
				controls.delete(definition.id);
			});
		};
		if (definition.gameUi.navigation.enabled || definition.gameUi.buttonFrames?.enabled || definition.gameUi.buttonColors?.enabled) {
			go.setInteractive?.({ useHandCursor: true });
			const over = () => {
				keyboardNavigation = false;
				entry.hovered = true;
				if (!buttonDisabled(entry)) focus(definition.id, "pointer");
			}, out = () => {
				entry.hovered = false;
				entry.pressed = false;
				if (focused === definition.id) clearFocus();
			}, up = () => {
				entry.pressed = false;
			}, down = () => {
				keyboardNavigation = false;
				if (buttonDisabled(entry)) return;
				entry.pressed = true;
				focus(definition.id, "pointer");
				activate(entry);
			};
			go.on?.("pointerover", over);
			go.on?.("pointerdown", down);
			go.on?.("pointerout", out);
			go.on?.("pointerup", up);
			cleanup.set(definition.id, () => {
				go.off?.("pointerover", over);
				go.off?.("pointerdown", down);
				go.off?.("pointerout", out);
				go.off?.("pointerup", up);
			});
		}
	};
	const subtree = (root) => {
		const found = new Set([root]);
		for (let size = -1; size !== found.size;) {
			size = found.size;
			for (const definition of definitions.values()) if (definition.parentId && found.has(definition.parentId)) found.add(definition.id);
		};
		return [...found].map((id) => definitions.get(id)).filter(Boolean);
	};
	for (const definition of scene.objects) {
		if (!definition.gameUi?.enabled && !definition.gameUi?.buttonFrames?.enabled && !definition.gameUi?.buttonColors?.enabled) continue;
		add(definition, host.objects.get(definition.id));
		if (definition.gameUi.repeat.enabled) {
			const hidden = subtree(definition.id).map((o) => o.id);
			repeaters.set(definition.id, {
				source: definition,
				instances: new Map(),
				hidden
			});
			hidden.forEach((id) => {
				templates.add(id);
				const go = host.objects.get(id);
				go?.setVisible?.(false);
				if (go?.body) go.body.enable = false;
			});
		}
	};
	const dispose = (instance) => {
		if (instance.ids.includes(focused)) clearFocus();
		for (const id of instance.ids) {
			controls.get(id)?.remove();
			controls.delete(id);
			cleanup.get(id)?.();
			cleanup.delete(id);
			const go = host.objects.get(id);
			go?.destroy?.();
			byObject.delete(go);
			host.objects.delete(id);
			entries.delete(id);
			transient.delete(id);
			layoutSize = -1;
		}
	};
	const synchronize = () => {
		for (const { source, instances } of repeaters.values()) {
			const settings = source.gameUi.repeat, raw = read(settings.binding), data = Array.isArray(raw) ? raw : [];
			if (!Array.isArray(raw) && raw != null) warn(source.id + ".array", `UI '${source.name}': 반복 자료가 배열이 아닙니다.`);
			const sourceTree = subtree(source.id), alive = new Set(), duplicates = new Map();
			for (let index = 0; index < data.length; index++) {
				const item = data[index], rawKey = path(item, settings.keyPath), base = rawKey == null ? String(index) : String(rawKey), occurrence = duplicates.get(base) ?? 0;
				duplicates.set(base, occurrence + 1);
				const key = `${base.length}:${base}:${occurrence}`;
				alive.add(key);
				let instance = instances.get(key);
				const column = settings.direction === "row" ? index : settings.direction === "grid" ? index % settings.columns : 0, row = settings.direction === "column" ? index : settings.direction === "grid" ? Math.floor(index / settings.columns) : 0, offsetX = column * ((settings.itemWidth || source.width) + settings.gapX), offsetY = row * ((settings.itemHeight || source.height) + settings.gapY);
				if (!instance) {
					if (host.objects.size + sourceTree.length > 5e3) {
						warn(source.id + ".limit", `UI '${source.name}': 반복 항목을 포함한 씬 노드는 5,000개 이내로 구성하세요.`);
						break;
					};
					const remap = new Map(sourceTree.map((o) => [o.id, "ui." + crypto.randomUUID()]));
					const clones = sourceTree.map((original) => {
						const clone = JSON.parse(JSON.stringify(original));
						clone.id = remap.get(original.id);
						clone.parentId = remap.get(original.parentId ?? "") ?? original.parentId;
						clone.fixed = true;
						clone.physics = "none";
						clone.behavior = "none";
						clone.stateMachines = [];
						clone.events = clone.events?.map((event) => ({
							...event,
							id: crypto.randomUUID(),
							otherObjectId: remap.get(event.otherObjectId ?? "") ?? event.otherObjectId,
							args: Object.fromEntries(Object.entries(event.args).map(([key, value]) => [key, value.replace(/\{\{(index|item(?:\.[\w.]+)?)\}\}/g, (_match, expression) => String(expression === "index" ? index : path(item, expression === "item" ? "" : expression.slice(5)) ?? ""))]))
						}));
						if (clone.gameUi) clone.gameUi.repeat.enabled = false;
						return clone;
					});
					const created = host.create(clones);
					instance = {
						ids: [...remap.values()],
						root: remap.get(source.id)
					};
					instances.set(key, instance);
					for (let i = 0; i < clones.length; i++) {
						const clone = clones[i], go = created.get(clone.id) ?? host.objects.get(clone.id);
						if (!go) continue;
						go.setData?.("forgeUiTransient", true);
						transient.add(clone.id);
						add(clone, go, {
							item,
							index,
							offsetX: i === 0 ? offsetX : 0,
							offsetY: i === 0 ? offsetY : 0
						}, true);
					}
				};
				for (const id of instance.ids) {
					const entry = entries.get(id);
					if (entry) {
						entry.item = item;
						entry.index = index;
						if (id === instance.root) {
							entry.offsetX = offsetX;
							entry.offsetY = offsetY;
						}
					}
				}
			};
			for (const [key, instance] of instances) if (!alive.has(key)) {
				dispose(instance);
				instances.delete(key);
			}
		}
	};
	const layout = () => {
		const viewport = host.viewport();
		if (layoutSize !== entries.size) {
			const depth = (entry) => {
				let count = 0;
				for (let parent = entry.go.parentContainer; parent; parent = parent.parentContainer) count++;
				return count;
			};
			layoutEntries = [...entries.values()].sort((a, b) => depth(a) - depth(b));
			layoutSize = entries.size;
		};
		for (const entry of layoutEntries) {
			const id = entry.def.id;
			const options = entry.def.gameUi, go = entry.go;
			const framed = !!options.buttonFrames?.enabled && typeof go.setTexture === "function";
			if (options.buttonColors?.enabled && !framed && typeof go.setFillStyle === "function" && typeof go.setStrokeStyle === "function") {
				const colors = options.buttonColors, state = buttonDisabled(entry) ? "disabled" : entry.pressed || (entry.pressedUntil ?? 0) > Date.now() ? "pressed" : entry.hovered ? "hover" : focused === id ? "focused" : "normal", paint = colors[state], lineWidth = state === "focused" ? colors.focusStrokeWidth : colors.strokeWidth, signature = JSON.stringify([
					state,
					paint.fill,
					paint.stroke,
					lineWidth
				]);
				if (!entry.basePaint) entry.basePaint = {
					fillColor: go.fillColor,
					fillAlpha: go.fillAlpha,
					strokeColor: go.strokeColor,
					strokeAlpha: go.strokeAlpha,
					lineWidth: go.lineWidth,
					isFilled: !!go.isFilled,
					isStroked: !!go.isStroked
				};
				if (entry.paintSignature !== signature) {
					go.setFillStyle(parseInt(paint.fill.slice(1), 16), 1);
					go.setStrokeStyle(lineWidth, parseInt(paint.stroke.slice(1), 16), 1);
					go.setData?.("forgeUiButtonState", state);
					entry.paintSignature = signature;
				}
			} else if (entry.basePaint) {
				const base = entry.basePaint;
				go.setFillStyle?.(base.fillColor, base.fillAlpha);
				go.setStrokeStyle?.(base.lineWidth, base.strokeColor, base.strokeAlpha);
				go.isFilled = base.isFilled;
				go.isStroked = base.isStroked;
				go.setData?.("forgeUiButtonState", "");
				entry.basePaint = undefined;
				entry.paintSignature = undefined;
			};
			if (options.buttonFrames?.enabled && typeof go.setTexture === "function") {
				const states = options.buttonFrames, state = buttonDisabled(entry) ? "disabled" : entry.pressed || (entry.pressedUntil ?? 0) > Date.now() ? "pressed" : entry.hovered || focused === entry.def.id ? "hover" : "normal", index = states[state], assetId = states[`${state}AssetId`] || entry.def.assetId, asset = assetMap.get(assetId);
				const count = asset ? imageFrames(asset) : 0;
				if (!asset || asset.type === "audio") {
					if (assetId) warn("button-image:" + id + ":" + state, entry.def.name + ": 버튼 상태의 이미지 리소스를 확인하세요.");
				} else if (!Number.isInteger(index) || index < 0 || index >= count) {
					warn("button-frame:" + id + ":" + state, entry.def.name + ": 버튼 상태의 프레임 번호를 확인하세요.");
				} else {
					const frame = asset.atlas?.frames[index], texture = frame?.pageId ?? asset.id, name = frame ? frame.pageId ? `${asset.id}:${index}` : frame.name : asset.type === "image" ? "__BASE" : index, signature = JSON.stringify([texture, name]);
					if (entry.texture !== signature) {
						const slice = !!go.getData?.("forgeNineSlice"), width = slice ? go.width : go.displayWidth, height = slice ? go.height : go.displayHeight, sx = go.scaleX, sy = go.scaleY, bx = go.getData?.("forgeScaleX"), by = go.getData?.("forgeScaleY"), logicalWidth = go.width, logicalHeight = go.height;
						go.setTexture(texture, name);
						if (Number.isFinite(width) && Number.isFinite(height)) {
							if (slice) go.setNineSliceSize?.(width, height);
							else {
								go.setDisplaySize?.(width, height);
								if (sx < 0 && go.scaleX > 0) go.scaleX *= -1;
								if (sy < 0 && go.scaleY > 0) go.scaleY *= -1;
							}
						};
						if (!slice) {
							if (Number.isFinite(bx) && Number.isFinite(logicalWidth) && go.width > 0) go.setData?.("forgeScaleX", bx * logicalWidth / go.width);
							if (Number.isFinite(by) && Number.isFinite(logicalHeight) && go.height > 0) go.setData?.("forgeScaleY", by * logicalHeight / go.height);
							const hitArea = go.input?.hitArea;
							if (hitArea && !go.input.customHitArea && Number.isFinite(hitArea.width) && Number.isFinite(hitArea.height)) {
								hitArea.x = 0;
								hitArea.y = 0;
								hitArea.width = go.width;
								hitArea.height = go.height;
							}
						};
						entry.texture = signature;
					};
					go.setData?.("forgeUiButtonState", state);
				}
			};
			if (!options.enabled) continue;
			if (templates.has(id)) {
				go.setVisible?.(false);
				entry.visible = false;
				continue;
			};
			const parent = go.parentContainer, parentEntry = parent && byObject.get(parent), area = parentEntry ? {
				width: finite(parent.width),
				height: finite(parent.height),
				x: -finite(parent.width) / 2,
				y: -finite(parent.height) / 2
			} : viewport;
			const width = options.relativeWidth ? area.width * options.relativeWidth : entry.def.width, height = options.relativeHeight ? area.height * options.relativeHeight : entry.def.height, size = `${width}/${height}/${entry.def.kind === "text" ? options.text.align ?? "center" : ""}`;
			go.setPosition?.(finite(area.x) + area.width * options.anchorX + options.offsetX + entry.offsetX + (finite(go.originX, .5) - options.anchorX) * width, finite(area.y) + area.height * options.anchorY + options.offsetY + entry.offsetY + (finite(go.originY, .5) - options.anchorY) * height);
			if ((options.relativeWidth || options.relativeHeight || entry.def.kind === "text") && size !== entry.size) {
				if (typeof go.setText === "function") {
					go.setAlign?.(options.text.align ?? "center");
					go.setWordWrapWidth?.(width);
					go.setFixedSize?.(width, height);
					const lineSpacing = finite(go.lineSpacing), lineHeight = finite(go.style?.metrics?.fontSize, entry.def.fontSize * 1.2) + finite(go.style?.strokeThickness), available = height - finite(go.padding?.top) - finite(go.padding?.bottom);
					go.setMaxLines?.(Math.max(1, Math.floor((available + lineSpacing) / Math.max(1, lineHeight + lineSpacing))));
				} else if (entry.def.kind === "group") go.setSize?.(width, height);
				else go.setDisplaySize?.(width, height);
				entry.size = size;
			};
			let visible = entry.def.visible !== false;
			if (options.visibility.enabled) {
				const value = read(options.visibility.binding, entry.item, entry.index), compare = options.visibility.compare, expected = decode(options.visibility.value);
				visible &&= compare === "truthy" ? !!value : compare === "eq" ? String(value) === String(expected) : compare === "ne" ? String(value) !== String(expected) : compare === "gt" ? Number(value) > Number(expected) : compare === "gte" ? Number(value) >= Number(expected) : compare === "lt" ? Number(value) < Number(expected) : Number(value) <= Number(expected);
			};
			if (options.image?.enabled && typeof go.setTexture === "function") {
				const value = read(options.image.binding, entry.item, entry.index), assetId = typeof value === "string" ? value : String(path(value, options.image.assetPath) ?? path(value, "assetId") ?? ""), index = Math.max(0, Math.floor(finite(path(value, options.image.framePath) ?? path(value, "frame")))), asset = assetMap.get(assetId);
				if (!asset || asset.type === "audio") visible = false;
				else {
					const frame = asset.atlas?.frames[index], texture = frame?.pageId ?? asset.id, name = frame ? frame.pageId ? `${asset.id}:${index}` : frame.name : asset.type === "image" ? "__BASE" : index, signature = JSON.stringify([texture, name]);
					if (entry.texture !== signature) {
						go.setTexture(texture, name);
						go.setDisplaySize?.(width, height);
						entry.texture = signature;
					}
				}
			};
			if (options.progress?.enabled && typeof go.setDisplaySize === "function" && entry.def.kind !== "group" && entry.def.kind !== "text") {
				const settings = options.progress, maximum = settings.useMaximumBinding ? finite(read(settings.maximumBinding, entry.item, entry.index), settings.maximum) : settings.maximum, fraction = Math.max(0, Math.min(1, finite(read(settings.binding, entry.item, entry.index)) / Math.max(1e-6, maximum)));
				const originX = finite(go.originX, .5), originY = finite(go.originY, .5);
				if (settings.direction === "horizontal") {
					go.setDisplaySize(width * fraction, height);
					go.x += width * (1 - fraction) * (settings.inverted ? 1 - originX : -originX);
				} else {
					go.setDisplaySize(width, height * fraction);
					go.y += height * (1 - fraction) * (settings.inverted ? -originY : 1 - originY);
				};
				visible &&= fraction > 0;
			};
			entry.visible = visible;
			go.setVisible?.(visible);
			if (options.text.enabled && typeof go.setText === "function") {
				const value = read(options.text.binding, entry.item, entry.index), content = typeof value === "number" ? value.toFixed(options.text.decimals) : value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value), text = options.text.prefix + content + options.text.suffix;
				if (text !== entry.text) {
					go.setText(text);
					entry.text = text;
				}
			}
		};
		const focusedEntry = entries.get(focused);
		if (focusedEntry && (!isVisible(focusedEntry) || buttonDisabled(focusedEntry))) clearFocus();
	};
	const navigate = (direction, acrossGroups = false, reverse = false) => {
		let candidates = active();
		if (!candidates.length) return false;
		const current = entries.get(focused);
		if (!current || !candidates.includes(current)) return focus(candidates[0].def.id);
		if (!acrossGroups) candidates = candidates.filter((entry) => entry.def.gameUi.navigation.group === current.def.gameUi.navigation.group);
		if (acrossGroups) {
			const next = (candidates.indexOf(current) + (reverse ? -1 : 1) + candidates.length) % candidates.length;
			return focus(candidates[next].def.id);
		};
		const horizontal = direction === "left" || direction === "right", sign = direction === "left" || direction === "up" ? -1 : 1;
		const point = (entry) => {
			const matrix = entry.go.getWorldTransformMatrix?.();
			return matrix ? {
				x: matrix.tx,
				y: matrix.ty
			} : {
				x: finite(entry.go.x),
				y: finite(entry.go.y)
			};
		};
		const center = point(current);
		const ranked = candidates.filter((entry) => entry !== current).map((entry) => {
			const p = point(entry), major = (horizontal ? p.x - center.x : p.y - center.y) * sign, minor = Math.abs(horizontal ? p.y - center.y : p.x - center.x);
			return {
				entry,
				major,
				score: major + minor * 3
			};
		}).filter((item) => item.major > .01).sort((a, b) => a.score - b.score);
		return ranked[0] ? focus(ranked[0].entry.def.id) : false;
	};
	const keyDown = (event) => {
		const handledBefore = keyEvents.get(event);
		if (handledBefore !== undefined) return handledBefore;
		if (destroyed || !active().length) return false;
		const direction = {
			ArrowLeft: "left",
			ArrowRight: "right",
			ArrowUp: "up",
			ArrowDown: "down"
		};
		let handled = false;
		const selected = entries.get(focused), acceptsKeyboard = !!selected && (keyboardNavigation || selected.def.gameUi.navigation.captureInput !== false || selected.def.gameUi.navigation.autoFocus);
		if (event.key === "Tab") {
			handled = navigate("down", true, event.shiftKey);
			keyboardNavigation = handled;
			autoFocusSuppressed = false;
		} else if (event.key === "Escape" && focused && acceptsKeyboard) {
			clearFocus();
			keyboardNavigation = false;
			autoFocusSuppressed = true;
			handled = true;
		} else if (direction[event.key] && focused && acceptsKeyboard) {
			navigate(direction[event.key]);
			handled = true;
		} else if ((event.key === "Enter" || event.key === " ") && acceptsKeyboard) {
			const entry = entries.get(focused);
			if (entry) {
				handled = true;
				if (!event.repeat) {
					entry.pressedUntil = Date.now() + 130;
					activate(entry);
				}
			}
		};
		if (handled) event.preventDefault?.();
		keyEvents.set(event, handled);
		return handled;
	};
	const pollGamepad = () => {
		const next = new Set();
		let pads = [];
		try {
			pads = host.gamepads?.() ?? (typeof navigator !== "undefined" ? [...navigator.getGamepads?.() ?? []].filter(Boolean) : []);
		} catch {
			return;
		};
		for (const pad of pads) {
			const buttons = pad?.buttons ?? [], axes = pad?.axes ?? [], pressed = (index) => !!buttons[index]?.pressed;
			if (pressed(12) || finite(axes[1]) < -.55) next.add("ArrowUp");
			if (pressed(13) || finite(axes[1]) > .55) next.add("ArrowDown");
			if (pressed(14) || finite(axes[0]) < -.55) next.add("ArrowLeft");
			if (pressed(15) || finite(axes[0]) > .55) next.add("ArrowRight");
			if (pressed(0)) next.add("Enter");
		};
		for (const key of next) if (!padHeld.has(key)) {
			keyboardNavigation = true;
			const hadFocus = !!focused;
			if (!hadFocus) navigate("down");
			if (hadFocus || key === "Enter") keyDown({ key });
		};
		padHeld = next;
	};
	return {
		update(time, _delta = 0) {
			if (destroyed) return;
			if (time - lastData >= 80 || !Number.isFinite(lastData)) {
				synchronize();
				lastData = time;
			};
			layout();
			for (const { element, entry } of controls.values()) {
				const bounds = entry.go.getBounds?.(), canvas = entry.go.scene?.game?.canvas?.getBoundingClientRect?.(), control = entry.def.gameUi?.control, camera = entry.go.scene?.cameras?.cameras?.find((camera) => camera.name === "?? UI"), shown = camera?.visible !== false && isVisible(entry) && entry.go.visible !== false && !templates.has(entry.def.id) && !!bounds && !!canvas;
				if (!shown || !control) {
					element.style.display = "none";
					if (document.activeElement === element) element.blur();
					continue;
				};
				const game = entry.go.scene.game, sx = canvas.width / game.scale.width, sy = canvas.height / game.scale.height, current = host.variable(control.variableId);
				Object.assign(element.style, {
					display: "block",
					left: canvas.left + ((camera?.x ?? 0) + bounds.x) * sx + "px",
					top: canvas.top + ((camera?.y ?? 0) + bounds.y) * sy + "px",
					width: Math.max(1, bounds.width * sx) + "px",
					height: Math.max(1, bounds.height * sy) + "px",
					fontSize: Math.max(8, Math.min(18, bounds.height * .45) * sy) + "px"
				});
				element.disabled = buttonDisabled(entry) || !host.writeVariable;
				const variable = project.variables.find((v) => v.id === control.variableId), expected = control.kind === "slider" ? "number" : control.kind === "input" ? "string" : "boolean";
				element.disabled ||= variable?.type !== expected || control.kind === "slider" && control.minimum >= control.maximum;
				if (control.kind === "toggle") {
					element.style.appearance = "none";
					element.style.background = "radial-gradient(circle at " + (current === true ? "75%" : "25%") + " 50%,#d3dfed 0 9px,transparent 10px)," + (current === true ? "#567493" : "#26384c");
				};
				if (document.activeElement !== element) {
					if (control.kind === "checkbox" || control.kind === "toggle") element.checked = current === true;
					else element.value = String(current ?? "");
				}
			};
			const automatic = active().filter((entry) => entry.def.gameUi.navigation.autoFocus);
			if (!automatic.length) autoFocusSuppressed = false;
			else if (!focused && !autoFocusSuppressed) focus(automatic[0].def.id, "auto");
			pollGamepad();
		},
		keyDown,
		focus,
		isDisabled(id) {
			const entry = entries.get(id);
			return !!entry && buttonDisabled(entry);
		},
		blur() {
			clearFocus();
			keyboardNavigation = false;
			autoFocusSuppressed = true;
		},
		hasFocus() {
			const entry = entries.get(focused);
			return !!entry && isVisible(entry);
		},
		capturesInput() {
			if (typeof document !== "undefined" && [...controls.values()].some((control) => control.element === document.activeElement)) return true;
			const entry = entries.get(focused);
			return !!entry && isVisible(entry) && (entry.def.gameUi.navigation.captureInput !== false || keyboardNavigation || entry.def.gameUi.navigation.autoFocus);
		},
		capturesPoint(x, y) {
			if (destroyed || !Number.isFinite(x) || !Number.isFinite(y)) return false;
			// Disabled controls still occupy their screen area; a click must not reach the world below.
			for (const entry of entries.values()) {
				if (!entry.def.gameUi?.navigation.enabled && !entry.def.gameUi?.control || !isVisible(entry)) continue;
				const bounds = entry.go.getBounds?.();
				if (bounds && x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) return true;
			};
			return false;
		},
		get focusedId() {
			return focused;
		},
		get transientIds() {
			return [...transient];
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			for (const control of controls.values()) control.remove();
			controls.clear();
			clearFocus();
			for (const group of repeaters.values()) for (const instance of group.instances.values()) dispose(instance);
			for (const fn of cleanup.values()) fn();
			cleanup.clear();
			entries.clear();
			byObject.clear();
			repeaters.clear();
			transient.clear();
		}
	};
},(function(runtime,meshFactory,attachmentFactory){return function(project,scene,hooks){return runtime(project,scene,hooks,meshFactory,attachmentFactory);};})(function createRigRuntime(project, scene, hooks, meshFactory = __vite_ssr_import_0__.createRigMeshTools, attachmentFactory = __vite_ssr_import_1__.createRigAttachmentTools) {
	let meshTools;
	const mesh = () => meshTools ??= meshFactory();
	let attachmentTools;
	const images = () => attachmentTools ??= attachmentFactory();
	let meshWarnings, visibleMeshCells = 0;
	const meshVisible = (go) => {
		if (!go.visible || go.alpha === 0) return false;
		for (let p = go.parentContainer; p; p = p.parentContainer) if (!p.visible || p.alpha === 0) return false;
		const cameras = scene.cameras?.cameras;
		if (!cameras?.length) return true;
		const bounds = go.getBounds?.();
		return cameras.some((camera) => {
			if (camera.visible === false || camera.alpha === 0 || go.willRender && !go.willRender(camera)) return false;
			const view = camera.worldView;
			return !bounds || !view || bounds.right >= view.x && bounds.x <= view.right && bounds.bottom >= view.y && bounds.y <= view.bottom;
		});
	};
	const rad = Math.PI / 180, properties = [
		"x",
		"y",
		"rotation",
		"length",
		"opacity"
	];
	// 독립 HTML에서도 외부 함수 없이 같은 원본축·뼈축 변환을 사용한다.
	const partSizing = (part, length) => {
		const ratio = part.lengthScale ? length / part.lengthScale.reference : 1;
		return {
			x: part.scaleX * (part.stretchWithBone ? length : 1) * (part.lengthScale?.axis === "x" ? ratio : 1),
			y: part.scaleY * (part.lengthScale?.axis === "y" ? ratio : 1),
			bone: part.lengthScale?.axis === "bone" ? ratio : 1
		};
	};
	const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
	const angle = (n) => ((n + 180) % 360 + 360) % 360 - 180;
	const mixAngle = (a, b, t) => a + angle(b - a) * t;
	const fade = (value, target, ms, dt, span = 1) => ms > 0 ? value + Math.sign(target - value) * Math.min(Math.abs(target - value), dt / ms * span) : target;
	const assets = new Map(project.assets.map((a) => [a.id, a]));
	const states = new Map(), paletteTextures = new Map();
	const documents = new Map();
	const tracksByClip = new WeakMap();
	const failures = new Set();
	let serial = 0, destroyed = false;
	const report = (message) => {
		if (!failures.has(message)) {
			failures.add(message);
			hooks.error?.(message);
		}
	};
	const enabled = (c) => {
		if (!c?.variableId) return true;
		const v = hooks.variable(c.variableId), raw = c.value;
		const b = typeof v === "number" ? Number(raw) : typeof v === "boolean" ? raw === "true" || raw === "1" : raw;
		switch (c.compare) {
			case "eq": return v === b;
			case "ne": return v !== b;
			case "lt": return Number(v) < Number(b);
			case "lte": return Number(v) <= Number(b);
			case "gt": return Number(v) > Number(b);
			case "gte": return Number(v) >= Number(b);
			default: return !!v;
		}
	};
	const sample = (doc, clip, time) => {
		const local = {}, t = clip ? Math.max(0, clip.loop ? time % clip.duration : Math.min(time, clip.duration)) : 0;
		let tracks = clip && tracksByClip.get(clip);
		if (clip && !tracks) {
			tracks = new Map(clip.tracks.map((track) => [track.boneId, Object.fromEntries(properties.map((p) => [p, track.keys.filter((k) => k[p] !== undefined)]))]));
			tracksByClip.set(clip, tracks);
		};
		for (const bone of doc.bones) {
			const track = tracks?.get(bone.id), pose = {};
			for (const p of properties) {
				const keys = track?.[p] ?? [];
				if (!keys.length) {
					pose[p] = bone[p];
					continue;
				};
				let i = 0;
				while (i < keys.length && keys[i].time <= t) i++;
				if (!i) pose[p] = keys[0][p];
				else if (i === keys.length) pose[p] = keys[i - 1][p];
				else {
					const a = keys[i - 1], b = keys[i];
					let blend = (t - a.time) / Math.max(.001, b.time - a.time);
					if (a.interpolation === "step") blend = 0;
					else if (a.interpolation === "smooth") blend = blend * blend * (3 - 2 * blend);
					// 여러 바퀴 회전하도록 작성한 키는 편집기와 같은 경로로 보간한다.
					pose[p] = a[p] + (b[p] - a[p]) * blend;
				}
			};
			pose.rotation = clamp(pose.rotation, bone.minAngle, bone.maxAngle);
			local[bone.id] = pose;
		};
		return local;
	};
	const world = (doc, local) => {
		const result = {}, bones = new Map(doc.bones.map((b) => [b.id, b])), visiting = new Set();
		const solve = (id) => {
			if (result[id]) return result[id];
			if (visiting.has(id)) {
				report(doc.name + ": 뼈 연결이 순환합니다.");
				return;
			};
			const bone = bones.get(id);
			if (!bone) return;
			visiting.add(id);
			const p = local[id] ?? bone, parent = bone.parentId ? solve(bone.parentId) : undefined;
			let { x, y, opacity, length } = p, rotation = clamp(p.rotation, bone.minAngle, bone.maxAngle);
			if (parent) {
				const a = parent.rotation * rad, dx = x + parent.length * bone.anchor;
				x = parent.x + Math.cos(a) * dx - Math.sin(a) * y;
				y = parent.y + Math.sin(a) * dx + Math.cos(a) * y;
				rotation += parent.rotation;
				opacity *= parent.opacity;
			};
			if (bone.aimAt) {
				const target = solve(bone.aimAt.boneId);
				if (target) {
					const a = target.rotation * rad, dx = target.x + Math.cos(a) * bone.aimAt.offsetX - Math.sin(a) * bone.aimAt.offsetY - x;
					const dy = target.y + Math.sin(a) * bone.aimAt.offsetX + Math.cos(a) * bone.aimAt.offsetY - y;
					length = Math.max(.01, Math.hypot(dx, dy));
					if (length > .010001) rotation = Math.atan2(dy, dx) / rad;
				}
			};
			result[id] = {
				x,
				y,
				rotation,
				length,
				opacity,
				endX: x + Math.cos(rotation * rad) * length,
				endY: y + Math.sin(rotation * rad) * length
			};
			visiting.delete(id);
			return result[id];
		};
		doc.bones.forEach((b) => solve(b.id));
		return result;
	};
	const mix = (a, b, weight) => ({
		x: a.x + (b.x - a.x) * weight,
		y: a.y + (b.y - a.y) * weight,
		rotation: mixAngle(a.rotation, b.rotation, weight),
		length: a.length + (b.length - a.length) * weight,
		opacity: a.opacity + (b.opacity - a.opacity) * weight
	});
	const copy = (pose) => Object.fromEntries(Object.entries(pose).map(([id, t]) => [id, { ...t }]));
	const point = (go, x, y, doc, undoFlip = true) => {
		const p = go.getWorldTransformMatrix().applyInverse(x, y), ox = go.displayOriginX ?? go.width * (go.originX ?? .5), oy = go.displayOriginY ?? go.height * (go.originY ?? .5);
		let px = p.x + ox, py = p.y + oy;
		if (undoFlip && go.flipX) px = doc.width - px;
		if (undoFlip && go.flipY) py = doc.height - py;
		return {
			x: px,
			y: py
		};
	};
	const pointer = () => {
		const p = scene.input?.activePointer;
		if (!p) return;
		// 카메라 이동과 확대를 반영한 월드 위치로 변환한다.
		return p.positionToCamera?.(scene.cameras.main) ?? {
			x: p.worldX ?? p.x,
			y: p.worldY ?? p.y
		};
	};
	const target = (rule) => {
		if (rule.source === "pointer") return pointer();
		if (rule.source !== "object") return;
		const o = hooks.objects.get(rule.targetId);
		if (!o?.active) return;
		const matrix = o.getWorldTransformMatrix?.();
		return matrix ? {
			x: matrix.tx,
			y: matrix.ty
		} : {
			x: o.x,
			y: o.y
		};
	};
	const sourceTexture = (asset, index, doc, untrim = false) => {
		const source = hooks.texture(asset, index), mapping = doc.paletteMapping;
		if (!untrim && (!mapping || !Object.keys(mapping).length) && !doc.sampling) return source;
		if (!untrim && (!mapping || !Object.keys(mapping).length) && doc.sampling) {
			const original = scene.textures.getFrame(source.key, source.frame);
			if (!original) return source;
			if (original.source.scaleMode === (doc.sampling === "linear" ? 0 : 1)) return source;
			const signature = "page:" + source.key + ":" + original.sourceIndex + ":" + doc.sampling;
			let key = paletteTextures.get(signature), texture = key ? scene.textures.get(key) : undefined;
			if (!texture) {
				key = `__forge_rig_palette_${scene.sys.settings.key}_${++serial}`;
				const image = original.source.image;
				texture = scene.textures.createCanvas(key, original.source.width, original.source.height);
				texture.context.drawImage(image, 0, 0);
				texture.refresh();
				texture.setFilter(doc.sampling === "linear" ? 0 : 1);
				paletteTextures.set(signature, key);
			};
			if (!texture.has(original.name)) {
				// 같은 원본 페이지의 픽셀·UV·잘림 정보를 재사용해 파츠마다 텍스처를 늘리지 않는다.
				const frame = original.clone();
				frame.texture = texture;
				frame.sourceIndex = 0;
				frame.source = texture.source[0];
				frame.u0 = original.u0;
				frame.v0 = original.v0;
				frame.u1 = original.u1;
				frame.v1 = original.v1;
				texture.frames[original.name] = frame;
				texture.frameTotal++;
			};
			return {
				key,
				frame: original.name
			};
		};
		const signature = (untrim ? "mesh:" : "") + asset.id + ":" + index + ":" + JSON.stringify(mapping ?? {}) + ":" + (doc.sampling ?? "");
		const existing = paletteTextures.get(signature);
		if (existing) return {
			key: existing,
			frame: "__BASE"
		};
		const frame = scene.textures.getFrame(source.key, source.frame);
		if (!frame) return source;
		const key = `__forge_rig_palette_${scene.sys.settings.key}_${++serial}`;
		const texture = scene.textures.createCanvas(key, frame.realWidth, frame.realHeight), ctx = texture.context;
		const f = frame.data.spriteSourceSize;
		ctx.save();
		ctx.translate(f.x, f.y);
		ctx.scale(f.w / (frame.rotated ? frame.cutHeight : frame.cutWidth), f.h / (frame.rotated ? frame.cutWidth : frame.cutHeight));
		if (frame.rotated) {
			ctx.translate(0, frame.cutWidth);
			ctx.rotate(-Math.PI / 2);
		};
		ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
		ctx.restore();
		if (mapping && Object.keys(mapping).length) {
			const pixels = ctx.getImageData(0, 0, frame.realWidth, frame.realHeight), replacements = new Map();
			for (const [from, to] of Object.entries(mapping ?? {})) {
				const parse = (hex) => [
					1,
					3,
					5,
					7
				].map((at, i) => i === 3 && hex.length < 9 ? 255 : parseInt(hex.slice(at, at + 2), 16));
				const a = parse(from), b = parse(to);
				replacements.set((a[0] << 24 | a[1] << 16 | a[2] << 8 | a[3]) >>> 0, b);
			};
			for (let i = 0; i < pixels.data.length; i += 4) {
				const d = pixels.data, replacement = replacements.get((d[i] << 24 | d[i + 1] << 16 | d[i + 2] << 8 | d[i + 3]) >>> 0);
				if (replacement) d.set(replacement, i);
			};
			ctx.putImageData(pixels, 0, 0);
		};
		texture.refresh();
		if (doc.sampling) texture.setFilter(doc.sampling === "linear" ? 0 : 1);
		paletteTextures.set(signature, key);
		return {
			key,
			frame: "__BASE"
		};
	};
	const resizeCoordinates = (go, sx, sy) => {
		for (const [key, scale] of [["forgeScaleX", sx], ["forgeScaleY", sy]]) {
			const value = go.getData?.(key);
			if (typeof value === "number") go.setData(key, value * scale);
		};
		const b = go.body;
		if (b && Number.isFinite(b.sourceWidth) && Number.isFinite(b.sourceHeight)) {
			b.sourceWidth /= sx;
			b.sourceHeight /= sy;
			if (b.radius) b.radius /= Math.abs(sx);
			if (b.offset) {
				b.offset.x /= sx;
				b.offset.y /= sy;
			};
			b.updateBounds?.();
		}
	};
	const remove = (state, restore = false) => {
		for (const part of state.parts) {
			if (part.container) {
				part.container.remove(part.image);
				part.container.destroy();
			};
			part.image.destroy();
		};
		if (state.animation && state.animation.setCurrentFrame === state.wrappedFrame) state.animation.setCurrentFrame = state.originalFrame;
		if (restore && state.go.active) {
			const asset = assets.get(state.def.assetId);
			if (asset) {
				const source = hooks.texture(asset, state.def.frame);
				state.go.setTexture(source.key, source.frame);
			};
			state.go.setScale(state.go.scaleX / state.scaleX, state.go.scaleY / state.scaleY);
			resizeCoordinates(state.go, 1 / state.scaleX, 1 / state.scaleY);
		};
		if (state.go.active) state.go.setData("forgeLiveRig", false);
		scene.textures.remove(state.key);
		states.delete(state.def.id);
	};
	const install = (def, go, settings, source) => {
		const original = source.rigDocument;
		let meshCells = 0, meshParts = 0, meshPixels = 0, meshFrames;
		for (const part of original.attachments) {
			if (!part.visible || !part.mesh?.enabled && !original.clips.some((clip) => clip.attachmentTracks?.some((track) => track.attachmentId === part.id))) continue;
			const variants = [part];
			for (const clip of original.clips) for (const track of clip.attachmentTracks ?? []) if (track.attachmentId === part.id) for (const key of track.keys) variants.push(key);
			if (part.mesh?.enabled) {
				meshParts++;
				meshCells += part.mesh.columns * part.mesh.rows;
			};
			let width = 0, height = 0;
			for (const variant of variants) {
				const asset = assets.get(variant.assetId);
				if (!asset || asset.type === "audio" || variant !== part && asset.rigDocument) throw Error(part.name + ": 그림 키의 원본 이미지가 없습니다.");
				const ref = hooks.texture(asset, variant.frame), frame = scene.textures.getFrame(ref.key, ref.frame);
				if (!frame) throw Error(part.name + ": 그림 키의 프레임이 없습니다.");
				if (!part.mesh?.enabled) continue;
				if (!width) {
					width = frame.realWidth;
					height = frame.realHeight;
				} else if (width !== frame.realWidth || height !== frame.realHeight) throw Error(part.name + ": 변형 파츠의 그림 키는 같은 논리 프레임 크기를 사용하세요.");
				const pixels = frame.realWidth * frame.realHeight, id = variant.assetId + ":" + variant.frame;
				if (pixels > 1048576) throw Error(part.name + ": 변형 파츠의 논리 프레임은 100만 픽셀 이내로 맞추세요.");
				meshFrames ??= new Set();
				if (!meshFrames.has(id)) {
					meshFrames.add(id);
					meshPixels += pixels;
				}
			}
		};
		if (meshParts > 32 || meshCells > 512 || meshPixels > 8388608) throw Error("격자 변형은 리그당 32파츠·512칸·원본 전체 800만 픽셀 이내로 맞추세요.");
		// 트랙은 처음 한 번만 정렬한다.
		let doc = documents.get(source.id);
		if (!doc) {
			doc = {
				...original,
				clips: original.clips.map((c) => ({
					...c,
					tracks: c.tracks.map((t) => ({
						...t,
						keys: [...t.keys].sort((a, b) => a.time - b.time)
					}))
				}))
			};
			documents.set(source.id, doc);
		};
		const key = `__forge_live_rig_${scene.sys.settings.key}_${++serial}`;
		const texture = scene.textures.addDynamicTexture(key, doc.width, doc.height);
		if (!texture) {
			report(def.name + ": 리그 출력 텍스처를 만들 수 없습니다.");
			return;
		};
		if (doc.sampling) texture.setFilter?.(doc.sampling === "linear" ? 0 : 1);
		const parts = [];
		for (const attachment of [...doc.attachments].sort((a, b) => a.order - b.order)) {
			const asset = assets.get(attachment.assetId);
			if (!asset || !attachment.visible) continue;
			const deform = attachment.mesh?.enabled, src = sourceTexture(asset, attachment.frame, doc, !!deform);
			if (!scene.textures.exists(src.key) || !scene.textures.get(src.key).has(src.frame)) {
				report(def.name + " / " + attachment.name + ": 파츠 프레임을 찾을 수 없습니다.");
				continue;
			};
			const geometry = deform ? mesh().geometry(attachment.mesh) : undefined, logical = geometry ? scene.textures.getFrame(src.key, src.frame) : undefined, webgl = !texture.context;
			const image = geometry && webgl ? scene.make.mesh2d({
				key: src.key,
				vertices: () => geometry.vertices,
				indices: () => geometry.indices,
				add: false
			}) : scene.make.image({
				key: src.key,
				frame: src.frame,
				add: false
			});
			// 4.2의 quad 결합은 셀의 대각선을 바꿔 비선형 변형이 달라진다. 세 경로 모두 같은 삼각형을 유지한다.
			if (geometry && webgl) {
				image.setSize(logical.realWidth, logical.realHeight).setOrigin(0, 0);
				image.flipV = true;
				image.setRenderAsTriangles(true);
			} else image.setOrigin(attachment.pivotX / image.frame.realWidth, attachment.pivotY / image.frame.realHeight);
			const container = attachment.lengthScale?.axis === "bone" ? scene.make.container({
				children: [image],
				add: false
			}) : undefined;
			const part = {
				attachment,
				image,
				container
			};
			if (doc.clips.some((clip) => clip.attachmentTracks?.some((track) => track.attachmentId === attachment.id))) {
				part.variants = new Map([[attachment.assetId + ":" + attachment.frame, src]]);
				part.variant = attachment.assetId + ":" + attachment.frame;
				for (const clip of doc.clips) for (const track of clip.attachmentTracks ?? []) if (track.attachmentId === attachment.id) for (const key of track.keys) {
					const id = key.assetId + ":" + key.frame;
					if (!part.variants.has(id)) part.variants.set(id, sourceTexture(assets.get(key.assetId), key.frame, doc, !!deform));
				}
			};
			if (geometry) {
				part.mesh = {
					...geometry,
					width: logical.realWidth,
					height: logical.realHeight,
					values: new Float32Array(attachment.mesh.points.length * 2),
					layer: new Float32Array(attachment.mesh.points.length * 2),
					source: logical.source.image,
					canvas: !webgl
				};
				if (!webgl) part.canvasDraw = () => {
					const ctx = texture.context, b = state.world[attachment.boneId];
					if (!b) return;
					const sizing = partSizing(attachment, b.length), angle = b.rotation * rad, rotation = attachment.rotation * rad, cos = Math.cos(rotation), sin = Math.sin(rotation);
					ctx.save();
					ctx.globalAlpha = attachment.opacity * b.opacity;
					ctx.imageSmoothingEnabled = doc.sampling === "linear";
					ctx.translate(b.x, b.y);
					ctx.rotate(angle);
					ctx.transform(sizing.bone * cos * sizing.x, sin * sizing.x, -sizing.bone * sin * sizing.y, cos * sizing.y, sizing.bone * attachment.offsetX, attachment.offsetY);
					mesh().draw(ctx, part.mesh.source, part.mesh.width, part.mesh.height, part.mesh.vertices, part.mesh.indices);
					ctx.restore();
				};
			};
			parts.push(part);
		};
		const scaleX = (go.width || doc.width) / doc.width, scaleY = (go.height || doc.height) / doc.height;
		go.setTexture(key);
		go.setScale(go.scaleX * scaleX, go.scaleY * scaleY);
		resizeCoordinates(go, scaleX, scaleY);
		const state = {
			def,
			go,
			settings,
			sourceId: source.id,
			doc,
			parts,
			texture,
			key,
			time: 0,
			clipId: "",
			local: {},
			world: {},
			aims: new Map(),
			layers: new Map(),
			paused: false,
			manualClip: "",
			aimOverride: new Map(),
			elapsed: 0,
			transition: settings.transition,
			scaleX,
			scaleY,
			meshCells,
			meshParts,
			meshPixels
		};
		if (go.anims?.setCurrentFrame) {
			state.animation = go.anims;
			state.originalFrame = go.anims.setCurrentFrame;
			state.wrappedFrame = function(...args) {
				const result = state.originalFrame.apply(this, args);
				// 애니메이션 시계와 이벤트를 유지하되 물리 갱신 전에 리그 크기·원점을 복구한다.
				if (go.active && scene.textures.exists(key)) go.setTexture(key);
				return result;
			};
			go.anims.setCurrentFrame = state.wrappedFrame;
		};
		states.set(def.id, state);
		return state;
	};
	const correspondingClip = (doc, id, previous) => {
		const exact = doc.clips.find((c) => c.id === id);
		if (exact) return exact;
		const motion = previous?.human?.linkedMotions[id]?.motionId;
		const old = previous?.clips.find((c) => c.id === id);
		const action = (s) => [
			["idle", /idle|대기/],
			["walk", /walk|걷기|보행/],
			["run", /run|달리기|질주/],
			["attack", /attack|action|공격/],
			["hurt", /hurt|피격/],
			["death", /death|쓰러짐|사망/],
			["cast", /cast|시전/],
			["jump", /jump|점프/]
		].find(([, p]) => p.test(s.toLowerCase()))?.[0];
		return doc.clips.find((c) => motion && doc.human?.linkedMotions[c.id]?.motionId === motion || old && c.name === old.name || action(id) && action(c.id + " " + c.name) === action(id)) ?? doc.clips.find((c) => /idle|대기/.test(c.id + " " + c.name)) ?? doc.clips[0];
	};
	const directionSource = (def, go, r, state) => {
		const config = r.directions;
		let direction = state?.direction ?? config?.initial ?? "right";
		if (!config?.enabled) return {
			source: assets.get(r.assetId),
			direction,
			flip: undefined,
			fallback: false
		};
		const vx = go.body?.velocity?.x ?? 0, vy = go.body?.velocity?.y ?? 0, moving = Math.hypot(vx, vy) > 1, p = pointer();
		const vector = config.priority === "pointer" && p ? (() => {
			const m = go.getWorldTransformMatrix?.(), origin = m?.transformPoint(0, 0) ?? go;
			return {
				x: p.x - origin.x,
				y: p.y - origin.y
			};
		})() : moving ? {
			x: vx,
			y: vy
		} : undefined;
		if (vector && Math.hypot(vector.x, vector.y) > 1) {
			const x = Math.abs(vector.x), y = Math.abs(vector.y), vertical = direction === "up" || direction === "down";
			// 대각선 경계에서 매 프레임 방향이 떨리지 않게 현재 축에 작은 여유를 둔다.
			if (x > y * (vertical ? 1.12 : .88)) direction = vector.x < 0 ? "left" : "right";
			else direction = vector.y < 0 ? "up" : "down";
		};
		const own = assets.get(config.assets[direction]), base = assets.get(r.assetId);
		if (own?.rigDocument) return {
			source: own,
			direction,
			flip: false,
			fallback: false
		};
		if (direction === "right" || direction === "left") {
			if (config.mirrorHorizontal) {
				const opposite = assets.get(config.assets[direction === "left" ? "right" : "left"]);
				if (opposite?.rigDocument) return {
					source: opposite,
					direction,
					flip: true,
					fallback: false
				};
			};
			return {
				source: base,
				direction,
				flip: config.mirrorHorizontal && direction === "left",
				fallback: direction === "left" && !config.mirrorHorizontal
			};
		};
		return {
			source: base,
			direction,
			flip: false,
			fallback: true
		};
	};
	const clipFor = (state) => {
		const { settings: r, doc, go } = state;
		if (state.manualClip) return correspondingClip(doc, state.manualClip, assets.get(r.assetId)?.rigDocument)?.id;
		const animId = go.anims?.currentAnim?.key;
		if (r.followAnimation && animId) {
			const explicit = r.animationMap.find((m) => m.animationId === animId);
			if (explicit && doc.clips.some((c) => c.id === explicit.clipId)) return explicit.clipId;
			const a = project.animations.find((a) => a.id === animId);
			if (a) {
				const category = (s) => [
					["idle", /\bidle\b|대기|서있기/i],
					["walk", /\bwalk\b|걷기|보행/i],
					["run", /\brun\b|달리기|질주/i],
					["action", /\baction\b|\battack\b|직업 동작|공격|베기/i],
					["hurt", /\bhurt\b|피격|경직/i],
					["death", /\bdeath\b|쓰러짐|사망|죽음/i],
					["jump", /\bjump\b|점프|도약/i],
					["cast", /\bcast\b|시전/i]
				].find(([, pattern]) => pattern.test(s))?.[0];
				const candidate = (a.action || a.id.split(/[.\/:]/).reverse().find((s) => /idle|walk|run|attack|hurt|death|jump|cast|action/i.test(s)) || a.name || "").toLowerCase(), action = category(candidate);
				const found = doc.clips.find((c) => c.id.toLowerCase() === candidate || c.name.toLowerCase() === candidate || c.id.toLowerCase().endsWith("." + candidate) || action && category(c.id + " " + c.name) === action);
				if (found) return found.id;
			}
		};
		if (r.locomotion?.enabled && go.body?.velocity) {
			const speed = Math.hypot(go.body.velocity.x ?? 0, go.body.velocity.y ?? 0), id = speed > r.locomotion.runSpeed ? r.locomotion.runClipId : speed > 1 ? r.locomotion.walkClipId : r.locomotion.idleClipId;
			return correspondingClip(doc, id, assets.get(r.assetId)?.rigDocument)?.id;
		};
		return correspondingClip(doc, r.clipId)?.id;
	};
	const aimPose = (state, rule, dt, local, current) => {
		const { go, doc } = state, bone = doc.bones.find((b) => b.id === rule.boneId);
		if (!bone || bone.aimAt || !current[bone.id]) return;
		let s = state.aims.get(rule.id);
		if (!s) {
			s = {
				weight: 0,
				heading: current[bone.id].rotation
			};
			state.aims.set(rule.id, s);
		};
		let valid = enabled(rule.condition) && (state.aimOverride.get(rule.id) ?? state.aimOverride.get("") ?? true), desired;
		if (rule.source === "angle" || rule.source === "variable") {
			const v = rule.source === "angle" ? rule.angle : Number(hooks.variable(rule.variableId));
			if (Number.isFinite(v)) {
				// 숫자 각도도 마우스와 동일한 게임 월드 좌표계를 사용한다.
				const m = go.getWorldTransformMatrix(), origin = m.transformPoint(0, 0), p = point(go, origin.x + Math.cos(v * rad) * 1e3, origin.y + Math.sin(v * rad) * 1e3, doc);
				const center = point(go, origin.x, origin.y, doc);
				desired = Math.atan2(p.y - center.y, p.x - center.x) / rad + rule.angleOffset;
			} else valid = false;
		} else {
			const t = target(rule);
			if (t && Number.isFinite(t.x) && Number.isFinite(t.y)) {
				const p = point(go, t.x, t.y, doc), b = current[bone.id];
				if (Math.hypot(p.x - b.x, p.y - b.y) > .01) desired = Math.atan2(p.y - b.y, p.x - b.x) / rad + rule.angleOffset;
				else valid = false;
			} else valid = false;
		};
		const targetWeight = valid && Number.isFinite(desired) ? rule.weight : 0;
		if (targetWeight > 0) {
			if (s.weight < .001) s.heading = current[bone.id].rotation;
			s.heading = mixAngle(s.heading, desired, rule.smoothing > 0 ? 1 - Math.exp(-dt / rule.smoothing) : 1);
		};
		s.weight = fade(s.weight, targetWeight, targetWeight ? rule.smoothing : rule.returnTime, dt, rule.weight || 1);
		if (s.weight < 1e-4) return;
		const parent = bone.parentId ? current[bone.parentId] : undefined, base = local[bone.id].rotation;
		let desiredLocal = s.heading - (parent?.rotation ?? 0);
		const delta = clamp(angle(desiredLocal - base), rule.minAngle, rule.maxAngle);
		desiredLocal = base + delta;
		const parentBone = doc.bones.find((b) => b.id === bone.parentId);
		const directChain = doc.ik.find((ik) => ik.lowerBoneId === bone.parentId);
		const hand = directChain ? bone : parentBone;
		const fore = hand && doc.bones.find((b) => b.id === hand.parentId);
		const upper = fore && doc.bones.find((b) => b.id === fore.parentId);
		const chain = fore && upper && doc.ik.find((ik) => ik.upperBoneId === upper.id && ik.lowerBoneId === fore.id);
		const namedArm = hand && fore && upper && /hand|손/i.test(hand.id + " " + hand.name) && /arm|팔/i.test(fore.id + " " + fore.name) && /arm|팔/i.test(upper.id + " " + upper.name);
		if (rule.followArm && hand && fore && upper && (chain || namedArm) && hand.anchor === 1 && fore.anchor === 1 && Math.abs(hand.x) + Math.abs(hand.y) + Math.abs(fore.x) + Math.abs(fore.y) < .01) {
			const u = current[upper.id], f = current[fore.id], h = current[hand.id];
			const l1 = u.length, l2 = f.length, reach = clamp(Math.hypot(h.x - u.x, h.y - u.y), Math.abs(l1 - l2) + .1, (l1 + l2) * .94);
			// 현재 동작의 팔꿈치 굽힘 방향을 유지한다.
			const bendValue = Math.sin(local[fore.id].rotation * rad), bend = Math.abs(bendValue) < .001 ? chain?.bend ?? -1 : bendValue < 0 ? -1 : 1;
			const desiredWeapon = (parent?.rotation ?? 0) + desiredLocal;
			const theta = (desiredWeapon - rule.angleOffset) * rad;
			const elbow = Math.acos(clamp((reach * reach - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1)) * bend;
			const shoulder = theta - Math.atan2(l2 * Math.sin(elbow), l1 + l2 * Math.cos(elbow));
			const ancestor = upper.parentId ? current[upper.parentId]?.rotation ?? 0 : 0;
			const shoulderLocal = clamp(shoulder / rad - ancestor, upper.minAngle, upper.maxAngle);
			local[upper.id].rotation = mixAngle(local[upper.id].rotation, shoulderLocal, s.weight);
			local[fore.id].rotation = mixAngle(local[fore.id].rotation, clamp(elbow / rad, fore.minAngle, fore.maxAngle), s.weight);
			const updated = world(doc, local), handParent = updated[fore.id];
			// 손과 장비의 부모 연결을 유지한 채 손목 각도를 맞춘다.
			local[hand.id].rotation = mixAngle(local[hand.id].rotation, clamp(desiredWeapon - (bone.id === hand.id ? 0 : base) - handParent.rotation, hand.minAngle, hand.maxAngle), s.weight);
		} else local[bone.id].rotation = mixAngle(base, clamp(desiredLocal, bone.minAngle, bone.maxAngle), s.weight);
	};
	const render = (state, dt) => {
		const { doc, go, settings: r } = state;
		if (go.texture.key !== state.key) go.setTexture(state.key);
		const nextId = clipFor(state), next = doc.clips.find((c) => c.id === nextId) ?? doc.clips[0];
		if (next.id !== state.clipId) {
			if (state.meshParts) {
				for (const part of state.parts) if (part.mesh) part.mesh.from = part.mesh.ready ? part.mesh.values.slice() : undefined;
			};
			state.from = Object.keys(state.local).length ? copy(state.local) : undefined;
			state.clipId = next.id;
			state.time = 0;
			state.elapsed = 0;
			state.fade = state.transition ?? r.transition;
			state.transition = undefined;
		};
		if (!state.paused) {
			let advance = dt * r.speed;
			const motion = doc.human?.linkedMotions?.[next.id], velocity = go.body?.velocity;
			if (r.movementSync && motion?.travel > 0 && velocity) {
				const speed = Math.hypot(velocity.x ?? 0, velocity.y ?? 0), matrix = go.getWorldTransformMatrix?.(), scale = matrix && Number.isFinite(matrix.a) && Number.isFinite(matrix.b) ? Math.hypot(matrix.a, matrix.b) : Math.abs(go.scaleX ?? 1);
				if (speed > 1 && scale > 1e-5) advance = dt * speed / (motion.travel * scale) * next.duration / 1e3;
			};
			state.time += advance;
			state.elapsed += dt;
		};
		const local = sample(doc, next, state.time);
		if (state.from && state.fade > 0 && state.elapsed < state.fade) for (const b of doc.bones) local[b.id] = mix(state.from[b.id] ?? local[b.id], local[b.id], clamp(state.elapsed / state.fade, 0, 1));
		else state.from = undefined;
		for (const layer of r.layers) {
			const clip = doc.clips.find((c) => c.id === layer.clipId);
			if (!clip) continue;
			let l = state.layers.get(layer.id);
			if (!l) {
				l = {
					weight: 0,
					time: 0,
					active: false
				};
				state.layers.set(layer.id, l);
			};
			const active = enabled(layer.condition);
			if (active && !l.active) l.time = 0;
			l.active = active;
			if (!state.paused) {
				l.time += dt * layer.speed;
				l.weight = fade(l.weight, active ? layer.weight : 0, layer.fade, dt, layer.weight || 1);
			};
			if (l.weight > 1e-4) {
				const pose = sample(doc, clip, l.time);
				for (const id of layer.boneIds) if (local[id] && pose[id]) local[id] = mix(local[id], pose[id], l.weight);
			}
		};
		if (r.directions?.enabled) go.setFlipX(!!state.directionFlip);
		else if (r.facing === "animation") {
			const a = project.animations.find((a) => a.id === go.anims?.currentAnim?.key);
			if (a?.direction === "left" || /[.\/:]left$/.test(a?.id ?? "")) go.setFlipX(true);
			else if (a?.direction === "right" || /[.\/:]right$/.test(a?.id ?? "")) go.setFlipX(false);
		} else if (r.facing === "pointer") {
			const p = pointer();
			if (p) {
				const v = point(go, p.x, p.y, doc, false);
				if (Math.abs(v.x - doc.width * (go.originX ?? .5)) > .5) go.setFlipX(v.x < doc.width * (go.originX ?? .5));
			}
		} else if (r.facing === "movement") {
			const vx = go.body?.velocity?.x;
			if (Math.abs(vx ?? 0) > 1) go.setFlipX(vx < 0);
		};
		let current = world(doc, local);
		if (!state.paused) for (const rule of r.aims) {
			aimPose(state, rule, dt, local, current);
			current = world(doc, local);
		}
		else if (state.local && Object.keys(state.local).length) {
			Object.assign(local, copy(state.local));
			current = world(doc, local);
		};
		state.local = local;
		state.world = current;
		const meshOnscreen = !state.meshParts || meshVisible(go);
		for (const part of state.parts) {
			const a = part.attachment, b = current[a.boneId];
			if (!b) {
				part.image.setVisible(false);
				continue;
			};
			if (part.variants) {
				let selected = images().sample(a, next, state.time);
				for (const layer of r.layers) {
					const l = state.layers.get(layer.id), clip = doc.clips.find((clip) => clip.id === layer.clipId);
					if (l?.weight >= .5 && layer.boneIds.includes(a.boneId) && clip?.attachmentTracks?.some((track) => track.attachmentId === a.id)) selected = images().sample(a, clip, l.time);
				};
				const id = selected.assetId + ":" + selected.frame;
				if (id !== part.variant) {
					const source = part.variants.get(id);
					if (!source) throw Error(a.name + ": 그림 키의 준비된 프레임이 없습니다.");
					part.image.setTexture(source.key, source.frame);
					part.variant = id;
					if (part.mesh) {
						const frame = scene.textures.getFrame(source.key, source.frame);
						part.mesh.source = frame.source.image;
					} else part.image.setOrigin(a.pivotX / part.image.frame.realWidth, a.pivotY / part.image.frame.realHeight);
				}
			};
			if (part.mesh && meshOnscreen) {
				const m = part.mesh;
				mesh().sample(a, next, state.time, true, m.values);
				if (m.from && state.from && state.fade > 0 && state.elapsed < state.fade) {
					const weight = clamp(state.elapsed / state.fade, 0, 1);
					for (let i = 0; i < m.values.length; i++) m.values[i] = m.from[i] + (m.values[i] - m.from[i]) * weight;
				} else m.from = undefined;
				for (const layer of r.layers) {
					const l = state.layers.get(layer.id), clip = doc.clips.find((clip) => clip.id === layer.clipId);
					if (!l || l.weight < 1e-4 || !layer.boneIds.includes(a.boneId) || !clip?.meshTracks?.some((track) => track.attachmentId === a.id)) continue;
					mesh().sample(a, clip, l.time, true, m.layer);
					for (let i = 0; i < m.values.length; i++) m.values[i] += (m.layer[i] - m.values[i]) * l.weight;
				};
				mesh().write(m.vertices, m.values, m.width, m.height, a.pivotX, a.pivotY);
				m.ready = true;
			};
			const rotation = b.rotation * rad, sizing = partSizing(a, b.length);
			if (part.container) {
				part.container.setPosition(b.x, b.y).setAngle(b.rotation).setScale(sizing.bone, 1);
				part.image.setVisible(true).setPosition(a.offsetX, a.offsetY).setAngle(a.rotation).setScale(sizing.x, sizing.y).setAlpha(a.opacity * b.opacity);
			} else part.image.setVisible(true).setPosition(b.x + Math.cos(rotation) * a.offsetX - Math.sin(rotation) * a.offsetY, b.y + Math.sin(rotation) * a.offsetX + Math.cos(rotation) * a.offsetY).setAngle(b.rotation + a.rotation).setScale(sizing.x, sizing.y).setAlpha(a.opacity * b.opacity);
		};
		if (!go.visible || go.alpha === 0 || !meshOnscreen) state.rendered = false;
		else if (!state.paused || !state.rendered) {
			state.texture.clear();
			const nodes = state.texture.renderer?.renderNodes;
			let previousTexture = "";
			for (const part of state.parts) {
				if (!part.image.visible) continue;
				if (part.mesh?.canvas) {
					state.texture.callback(part.canvasDraw);
					continue;
				};
				const key = part.image.texture.key;
				// 서로 다른 파츠 원본의 배치를 나눠 WebGL 다중 텍스처의 빈 삼각형을 막는다.
				// 같은 아틀라스의 연속 파츠는 한 배치로 유지하며 전역 렌더러 설정은 바꾸지 않는다.
				if (previousTexture && previousTexture !== key && nodes?.finishBatch && state.texture.callback) state.texture.callback(() => nodes.finishBatch());
				state.texture.draw(part.container ?? part.image);
				previousTexture = key;
			};
			state.texture.render();
			state.rendered = true;
		};
		// 원래 스프라이트의 애니메이션·상태·물리를 유지하고 최종 그림만 갱신한다.
		if (go.texture.key !== state.key) go.setTexture(state.key);
		go.setData("forgeLiveRig", true);
	};
	const update = (delta) => {
		if (destroyed) return;
		const live = new Set(), dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 250);
		visibleMeshCells = 0;
		for (const { def, go } of hooks.actors()) {
			if (!go?.active || def.kind !== "sprite") continue;
			let s = states.get(def.id);
			const r = def.rigPlayback, selected = r?.enabled ? directionSource(def, go, r, s) : undefined, source = selected?.source;
			if (!r?.enabled || !source?.rigDocument) {
				if (s) remove(s, true);
				continue;
			};
			live.add(def.id);
			if (s && s.go !== go) {
				remove(s, true);
				s = undefined;
			};
			try {
				if (s && s.sourceId !== source.id) {
					const previous = s, oldClip = previous.doc.clips.find((c) => c.id === previous.clipId), phase = oldClip ? previous.time / oldClip.duration : 0;
					remove(previous, true);
					s = install(def, go, r, source);
					if (s) {
						const clip = correspondingClip(s.doc, previous.clipId, previous.doc);
						s.clipId = clip?.id ?? "";
						s.time = phase * (clip?.duration ?? 1e3);
						s.elapsed = previous.elapsed;
						s.paused = previous.paused;
						s.manualClip = previous.manualClip;
						s.aimOverride = previous.aimOverride;
						s.aims = previous.aims;
						s.layers = previous.layers;
						s.from = undefined;
						s.fade = 0;
					}
				};
				s ??= install(def, go, r, source);
				if (s) {
					s.settings = r;
					s.direction = selected.direction;
					s.directionFlip = selected.flip;
					s.directionFallback = selected.fallback;
					if (s.meshCells && meshVisible(go)) visibleMeshCells += s.meshCells;
					render(s, dt);
				}
			} catch (error) {
				report(def.name + ": 실시간 리그를 재생할 수 없습니다. " + String(error));
				if (s) remove(s, true);
			}
		};
		for (const [id, s] of states) if (!live.has(id) || !s.go.active) remove(s, false);
		if (visibleMeshCells > 4096) {
			const message = "화면의 변형 격자가 권장 4,096칸을 넘었습니다. 현재 " + visibleMeshCells + "칸입니다.";
			meshWarnings ??= new Set();
			if (!meshWarnings.has("visible-cells")) {
				meshWarnings.add("visible-cells");
				if (hooks.warning) hooks.warning(message);
				else console.warn(message);
			}
		}
	};
	const stateFor = (id) => {
		if (!states.has(id) && !destroyed) update(0);
		return states.get(id);
	};
	return {
		update,
		play: (id, clipId, transition) => {
			const s = stateFor(id);
			if (!s || ![s.doc, assets.get(s.settings.assetId)?.rigDocument].some((doc) => doc?.clips.some((c) => c.id === clipId))) return false;
			s.manualClip = clipId;
			s.clipId = "";
			s.transition = transition === undefined ? s.settings.transition : clamp(transition, 0, 5e3);
			s.paused = false;
			return true;
		},
		auto: (id) => {
			const s = stateFor(id);
			if (!s) return false;
			s.manualClip = "";
			return true;
		},
		aim: (id, active, ruleId = "") => {
			const s = stateFor(id);
			if (!s) return false;
			s.aimOverride.set(ruleId, active);
			return true;
		},
		pause: (id, active = true) => {
			const s = stateFor(id);
			if (!s) return false;
			s.paused = active;
			return true;
		},
		reset: (id) => {
			const s = stateFor(id);
			if (!s) return false;
			s.manualClip = "";
			s.clipId = "";
			s.time = 0;
			s.paused = false;
			s.aims.clear();
			s.layers.clear();
			s.aimOverride.clear();
			return true;
		},
		status: (id) => {
			const s = states.get(id);
			return s ? {
				clipId: s.clipId,
				time: s.time,
				paused: s.paused,
				flipX: !!s.go.flipX,
				assetId: s.sourceId,
				direction: s.direction,
				directionFallback: !!s.directionFallback,
				...s.meshParts ? { mesh: {
					parts: s.meshParts,
					cells: s.meshCells,
					vertices: s.parts.reduce((sum, part) => sum + (part.mesh?.vertices.length ?? 0) / 4, 0),
					sourcePixels: s.meshPixels,
					sceneVisibleCells: visibleMeshCells,
					offscreen: !meshVisible(s.go)
				} } : {},
				local: copy(s.local),
				world: copy(s.world),
				aims: Object.fromEntries([...s.aims].map(([id, a]) => [id, {
					weight: a.weight,
					heading: a.heading
				}]))
			} : undefined;
		},
		snapshot: () => [...states.values()].map((s) => ({
			id: s.def.id,
			clipId: s.clipId,
			manualClip: s.manualClip,
			time: s.time,
			elapsed: s.elapsed,
			paused: s.paused,
			direction: s.direction,
			local: copy(s.local),
			from: s.from ? copy(s.from) : undefined,
			...s.meshParts ? { meshFrom: Object.fromEntries(s.parts.filter((part) => part.mesh?.from).map((part) => [part.attachment.id, Array.from(part.mesh.from)])) } : {},
			fade: s.fade,
			aims: Object.fromEntries([...s.aims].map(([id, v]) => [id, { ...v }])),
			layers: Object.fromEntries([...s.layers].map(([id, v]) => [id, { ...v }])),
			aimOverride: Object.fromEntries(s.aimOverride)
		})),
		restore: (data) => {
			if (!Array.isArray(data)) return;
			for (const entry of data.slice(0, 5e3)) {
				if (!entry || typeof entry.id !== "string") continue;
				let s = stateFor(entry.id);
				if (!s) continue;
				if ([
					"right",
					"left",
					"up",
					"down"
				].includes(entry.direction)) {
					s.direction = entry.direction;
					update(0);
					s = states.get(entry.id);
					if (!s) continue;
				};
				const finite = (n, fallback, max = 0xe8d4a51000) => typeof n === "number" && Number.isFinite(n) ? clamp(n, 0, max) : fallback;
				if (s.doc.clips.some((c) => c.id === entry.clipId)) s.clipId = entry.clipId;
				s.manualClip = s.doc.clips.some((c) => c.id === entry.manualClip) ? entry.manualClip : "";
				s.time = finite(entry.time, 0);
				s.elapsed = finite(entry.elapsed, 0);
				s.paused = entry.paused === true;
				s.fade = finite(entry.fade, 0, 5e3);
				const restorePose = (value) => {
					if (!value || typeof value !== "object") return undefined;
					const pose = {};
					for (const bone of s.doc.bones) {
						const p = value[bone.id];
						if (!p || !properties.every((k) => typeof p[k] === "number" && Number.isFinite(p[k]) && Math.abs(p[k]) <= 1e5)) return undefined;
						pose[bone.id] = Object.fromEntries(properties.map((k) => [k, p[k]]));
					};
					return pose;
				};
				s.local = restorePose(entry.local) ?? s.local;
				s.from = restorePose(entry.from);
				if (s.meshParts) for (const part of s.parts) {
					const values = entry.meshFrom?.[part.attachment.id];
					if (part.mesh && Array.isArray(values) && values.length === part.mesh.values.length && values.every((value) => Number.isFinite(value) && Math.abs(value) <= 2)) part.mesh.from = new Float32Array(values);
				};
				for (const aim of s.settings.aims) {
					const a = entry.aims?.[aim.id];
					if (a && Number.isFinite(a.heading) && Number.isFinite(a.weight)) s.aims.set(aim.id, {
						heading: a.heading,
						weight: clamp(a.weight, 0, 1)
					});
				};
				for (const layer of s.settings.layers) {
					const l = entry.layers?.[layer.id];
					if (l) s.layers.set(layer.id, {
						time: finite(l.time, 0),
						weight: finite(l.weight, 0, 1),
						active: l.active === true
					});
				};
				for (const key of ["", ...s.settings.aims.map((a) => a.id)]) if (typeof entry.aimOverride?.[key] === "boolean") s.aimOverride.set(key, entry.aimOverride[key]);
				s.rendered = false;
				render(s, 0);
			}
		},
		destroy: () => {
			destroyed = true;
			for (const s of [...states.values()]) remove(s, true);
			for (const key of paletteTextures.values()) scene.textures.remove(key);
			paletteTextures.clear();
			documents.clear();
		}
	};
},function createRigMeshTools() {
	const sorted = new WeakMap();
	const zero = (columns = 2, rows = 2) => ({
		enabled: true,
		columns,
		rows,
		points: Array.from({ length: (columns + 1) * (rows + 1) }, () => ({
			x: 0,
			y: 0
		}))
	});
	const sample = (part, clip, time, wrap = true, output) => {
		const mesh = part.mesh;
		if (!mesh?.enabled) return undefined;
		const out = output ?? new Float32Array(mesh.points.length * 2), track = clip?.meshTracks?.find((track) => track.attachmentId === part.id);
		let keys = track && sorted.get(track.keys);
		if (track && !keys) {
			keys = [...track.keys].sort((a, b) => a.time - b.time);
			sorted.set(track.keys, keys);
		};
		let a, b, blend = 0;
		if (keys?.length) {
			const t = Math.max(0, clip.loop && wrap ? time % clip.duration : Math.min(time, clip.duration));
			let low = 0, high = keys.length;
			while (low < high) {
				const mid = low + high >>> 1;
				if (keys[mid].time <= t) low = mid + 1;
				else high = mid;
			};
			a = keys[Math.max(0, low - 1)];
			b = keys[Math.min(keys.length - 1, low)];
			blend = a === b ? 0 : (t - a.time) / (b.time - a.time);
			if (a.interpolation === "step") blend = 0;
			else if (a.interpolation === "smooth") blend = blend * blend * (3 - 2 * blend);
		};
		for (let i = 0; i < mesh.points.length; i++) {
			const p = a?.points[i] ?? mesh.points[i], q = b?.points[i] ?? p;
			out[i * 2] = p.x + (q.x - p.x) * blend;
			out[i * 2 + 1] = p.y + (q.y - p.y) * blend;
		};
		return out;
	};
	const geometry = (mesh) => {
		const vertices = new Array((mesh.columns + 1) * (mesh.rows + 1) * 4).fill(0), indices = [];
		for (let y = 0; y <= mesh.rows; y++) for (let x = 0; x <= mesh.columns; x++) {
			const at = (y * (mesh.columns + 1) + x) * 4;
			vertices[at + 2] = x / mesh.columns;
			vertices[at + 3] = y / mesh.rows;
		};
		for (let y = 0; y < mesh.rows; y++) for (let x = 0; x < mesh.columns; x++) {
			const a = y * (mesh.columns + 1) + x, b = a + 1, c = a + mesh.columns + 1, d = c + 1;
			indices.push(a, b, c, 0, b, c, d, 0);
		};
		return {
			vertices,
			indices
		};
	};
	const write = (vertices, points, width, height, pivotX = 0, pivotY = 0) => {
		for (let i = 0; i < vertices.length; i += 4) {
			vertices[i] = (vertices[i + 2] + points[i / 2]) * width - pivotX;
			vertices[i + 1] = (vertices[i + 3] + points[i / 2 + 1]) * height - pivotY;
		}
	};
	const draw = (ctx, image, width, height, vertices, indices) => {
		for (let at = 0; at < indices.length; at += 4) {
			const p = indices[at] * 4, q = indices[at + 1] * 4, r = indices[at + 2] * 4, x0 = vertices[p], y0 = vertices[p + 1], x1 = vertices[q], y1 = vertices[q + 1], x2 = vertices[r], y2 = vertices[r + 1];
			if (Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) < 1e-8) continue;
			const sx0 = vertices[p + 2] * width, sy0 = vertices[p + 3] * height, sx1 = vertices[q + 2] * width - sx0, sy1 = vertices[q + 3] * height - sy0, sx2 = vertices[r + 2] * width - sx0, sy2 = vertices[r + 3] * height - sy0, det = sx1 * sy2 - sx2 * sy1;
			if (Math.abs(det) < 1e-8) continue;
			const a = ((x1 - x0) * sy2 - (x2 - x0) * sy1) / det, b = ((y1 - y0) * sy2 - (y2 - y0) * sy1) / det, c = ((x2 - x0) * sx1 - (x1 - x0) * sx2) / det, d = ((y2 - y0) * sx1 - (y1 - y0) * sx2) / det;
			ctx.save();
			ctx.beginPath();
			ctx.moveTo(x0, y0);
			ctx.lineTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.closePath();
			ctx.clip();
			ctx.transform(a, b, c, d, x0 - a * sx0 - c * sy0, y0 - b * sx0 - d * sy0);
			ctx.drawImage(image, 0, 0);
			ctx.restore();
		}
	};
	const resample = (mesh, points, columns, rows) => {
		const out = [];
		for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
			const u = x / columns * mesh.columns, v = y / rows * mesh.rows, cx = Math.min(mesh.columns - 1, Math.floor(u)), cy = Math.min(mesh.rows - 1, Math.floor(v)), tx = u - cx, ty = v - cy, a = points[cy * (mesh.columns + 1) + cx], b = points[cy * (mesh.columns + 1) + cx + 1], c = points[(cy + 1) * (mesh.columns + 1) + cx], d = points[(cy + 1) * (mesh.columns + 1) + cx + 1];
			out.push({
				x: (a.x * (1 - tx) + b.x * tx) * (1 - ty) + (c.x * (1 - tx) + d.x * tx) * ty,
				y: (a.y * (1 - tx) + b.y * tx) * (1 - ty) + (c.y * (1 - tx) + d.y * tx) * ty
			});
		};
		return out;
	};
	return {
		zero,
		sample,
		geometry,
		write,
		draw,
		resample
	};
},function createRigAttachmentTools() {
	const sorted = new WeakMap();
	const sample = (part, clip, time, wrap = true) => {
		const track = clip?.attachmentTracks?.find((track) => track.attachmentId === part.id);
		if (!track?.keys.length) return part;
		let keys = sorted.get(track.keys);
		if (!keys) {
			keys = [...track.keys].sort((a, b) => a.time - b.time);
			sorted.set(track.keys, keys);
		};
		const t = Math.max(0, clip.loop && wrap ? time % clip.duration : Math.min(time, clip.duration));
		let low = 0, high = keys.length;
		while (low < high) {
			const mid = low + high >>> 1;
			if (keys[mid].time <= t) low = mid + 1;
			else high = mid;
		};
		return low ? keys[low - 1] : part;
	};
	return { sample };
}),function createNineSliceObject(scene, textureKey, frameName, width, height, settings, grid) {
	const root = scene.add.container(0, 0), parts = [];
	let texture = textureKey, frame = frameName, originX = .5, originY = .5, flipX = false, flipY = false, tint, blend;
	Object.defineProperties(root, {
		originX: {
			get: () => originX,
			configurable: true
		},
		originY: {
			get: () => originY,
			configurable: true
		}
	});
	// Container.getBounds includes invisible spare slices. Report the authored
	// rectangle so 3-slice buttons, trimmed frames and state changes keep the
	// same bounds as their input area. Keep this inside the serialized factory.
	const Bounds = root.getBounds().constructor;
	root.getBounds = (output) => {
		const bounds = output ?? new Bounds(), matrix = root.getWorldTransformMatrix(), center = matrix.transformPoint((.5 - originX) * width, (.5 - originY) * height), worldWidth = Math.abs(matrix.a) * width + Math.abs(matrix.c) * height, worldHeight = Math.abs(matrix.b) * width + Math.abs(matrix.d) * height;
		return bounds.setTo(center.x - worldWidth / 2, center.y - worldHeight / 2, worldWidth, worldHeight);
	};
	const syncHitArea = () => {
		const input = root.input;
		if (!input?.hitArea || input.customHitArea) return;
		// Container 입력 좌표에는 Phaser가 항상 width/height의 절반을 더한다.
		input.hitArea.x = (.5 - originX) * width;
		input.hitArea.y = (.5 - originY) * height;
		input.hitArea.width = width;
		input.hitArea.height = height;
	};
	const originalInteractive = root.setInteractive.bind(root);
	root.setInteractive = (...args) => {
		originalInteractive(...args);
		syncHitArea();
		return root;
	};
	root.setData("forgeNineSlice", true);
	const draw = () => {
		const source = scene.textures.get(texture), base = source?.get(frame);
		if (!base) return;
		const region = settings.regions?.[String(frame)] ?? settings.region, rx = Math.max(0, region.x), ry = Math.max(0, region.y), rw = region.width || base.realWidth, rh = region.height || base.realHeight;
		const layout = grid(rw, rh, width, height, settings);
		width = layout.width;
		height = layout.height;
		root.setSize(width, height);
		const trimX = base.x ?? 0, trimY = base.y ?? 0, trimWidth = base.cutWidth, trimHeight = base.cutHeight;
		while (parts.length < 9) {
			const part = scene.make.image({
				key: texture,
				frame,
				add: false
			}).setOrigin(0, 0);
			root.add(part);
			parts.push(part);
		};
		parts.forEach((part) => part.setVisible(false));
		for (const [index, cell] of layout.cells.entries()) {
			const x = Math.max(rx + cell.sx, trimX), y = Math.max(ry + cell.sy, trimY), right = Math.min(rx + cell.sx + cell.sw, trimX + trimWidth), bottom = Math.min(ry + cell.sy + cell.sh, trimY + trimHeight);
			if (right <= x || bottom <= y) continue;
			const name = "__forge-nine:" + JSON.stringify([
				frame,
				x,
				y,
				right,
				bottom
			]);
			if (!source.has(name)) source.add(name, base.sourceIndex, base.cutX + x - trimX, base.cutY + y - trimY, right - x, bottom - y);
			const dw = (right - x) * cell.dw / cell.sw, dh = (bottom - y) * cell.dh / cell.sh, dx = cell.dx + (x - rx - cell.sx) * cell.dw / cell.sw, dy = cell.dy + (y - ry - cell.sy) * cell.dh / cell.sh;
			const part = parts[index].setTexture(texture, name).setVisible(true).setDisplaySize(dw, dh).setPosition((flipX ? width - dx - dw : dx) - originX * width, (flipY ? height - dy - dh : dy) - originY * height).setFlip(flipX, flipY);
			if (tint !== undefined) part.setTint(tint);
			if (blend !== undefined) part.setBlendMode(blend);
		};
		syncHitArea();
	};
	root.setOrigin = (x, y = x) => {
		originX = x;
		originY = y;
		draw();
		return root;
	};
	root.setFlip = (x, y) => {
		if (flipX !== x || flipY !== y) {
			flipX = x;
			flipY = y;
			draw();
		};
		return root;
	};
	root.setTint = (color) => {
		tint = color;
		parts.forEach((p) => p.setTint(color));
		return root;
	};
	root.clearTint = () => {
		tint = undefined;
		parts.forEach((p) => p.clearTint());
		return root;
	};
	const originalBlend = root.setBlendMode?.bind(root);
	root.setBlendMode = (mode) => {
		blend = mode;
		originalBlend?.(mode);
		parts.forEach((p) => p.setBlendMode(mode));
		return root;
	};
	root.setNineSliceSize = (w, h) => {
		if (width !== w || height !== h) {
			width = w;
			height = h;
			draw();
		};
		return root;
	};
	root.setDisplaySize = (w, h) => root.setNineSliceSize(w, h);
	root.setTexture = (key, name) => {
		if (texture !== key || frame !== name) {
			texture = key;
			frame = name;
			draw();
		};
		return root;
	};
	root.setFrame = (name) => root.setTexture(texture, name);
	draw();
	return root;
},function nineSliceGrid(sourceWidth, sourceHeight, width, height, options) {
	const left = Math.max(0, Math.min(options.left, sourceWidth - 1)), right = Math.max(0, Math.min(options.right, sourceWidth - left - 1)), top = Math.max(0, Math.min(options.top, sourceHeight - 1)), bottom = Math.max(0, Math.min(options.bottom, sourceHeight - top - 1));
	width = Math.max(left + right + 1, width);
	height = Math.max(top + bottom + 1, height);
	const sx = [
		0,
		left,
		sourceWidth - right,
		sourceWidth
	], sy = [
		0,
		top,
		sourceHeight - bottom,
		sourceHeight
	], dx = [
		0,
		left,
		width - right,
		width
	], dy = [
		0,
		top,
		height - bottom,
		height
	];
	return {
		width,
		height,
		cells: Array.from({ length: 9 }, (_, n) => {
			const x = n % 3, y = Math.floor(n / 3);
			return {
				sx: sx[x],
				sy: sy[y],
				sw: sx[x + 1] - sx[x],
				sh: sy[y + 1] - sy[y],
				dx: dx[x],
				dy: dy[y],
				dw: dx[x + 1] - dx[x],
				dh: dy[y + 1] - dy[y]
			};
		}).filter((cell) => cell.sw > 0 && cell.sh > 0 && cell.dw > 0 && cell.dh > 0)
	};
},function createGameFrameworkRuntime(project, host) {
	const config = project.framework, enabled = !!config?.enabled, events = new Map(), variables = new Map(project.variables.map((variable) => [variable.id, variable]));
	const copy = (value) => JSON.parse(JSON.stringify(value)), defaults = config?.settings ?? {
		masterVolume: .8,
		musicVolume: .7,
		effectsVolume: .8,
		muted: false,
		pixelated: false,
		controls: {
			up: "ArrowUp",
			down: "ArrowDown",
			left: "ArrowLeft",
			right: "ArrowRight",
			jump: "Space",
			action: "KeyZ",
			menu: "Escape"
		}
	};
	let settings = copy(defaults), disposed = false, view = "", busy = false, paused = false, lastFocus = null, dialogueId = "", nodeId = "", dialogueTrail = 0, gamepadRequest = 0, held = new Set(), toastTimer;
	let root, overlay, panel, body, heading, status;
	const prefix = config?.storagePrefix ?? "framework", slotKey = (id) => prefix + ".slot." + id, indexKey = prefix + ".slots", settingsKey = prefix + ".settings";
	const novel = config?.dialogueOptions?.presentation === "novel";
	let choiceGuard;
	const choiceAllowed = (choice) => {
		if (choice.enabledVariableId && !value(choice.enabledVariableId)) return false;
		try {
			return choiceGuard?.({
				dialogueId,
				nodeId,
				choiceId: choice.id
			}) !== false;
		} catch (error) {
			fail(error);
			return false;
		}
	};
	const refreshChoices = () => {
		if (view !== "dialogue" || !body) return;
		const current = node();
		if (!current) return;
		for (const item of body.querySelectorAll(".fgf-dialogue-options button[data-choice]")) {
			const choice = current.choices.find((c) => c.id === item.dataset.choice);
			if (choice) item.disabled = !choiceAllowed(choice);
		}
	};
	let reading = {
		textSpeed: config?.dialogueOptions?.textSpeed ?? 0,
		autoDelay: config?.dialogueOptions?.autoDelay ?? 2500,
		auto: false,
		skipRead: false
	}, readingPaused = false, readingFrame = 0, readingTimer, readingToken = 0, revealing = false, revealAll, readingLog;
	const readSeen = new Set(), readingHistory = [];
	const readingKey = () => {
		const text = node()?.text ?? "";
		let hash = 2166136261;
		for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
		return dialogueId + "/" + nodeId + "/" + (hash >>> 0).toString(36);
	};
	let rescheduleReading, refreshReadingControls, readSaveTimer, readDirty = false;
	const flushReadSeen = () => {
		clearTimeout(readSaveTimer);
		readSaveTimer = undefined;
		if (!readDirty) return;
		readDirty = false;
		void host.storage.save(prefix + ".read-lines", [...readSeen].slice(-6e4)).catch(fail);
	};
	const queueReadSave = () => {
		readDirty = true;
		clearTimeout(readSaveTimer);
		readSaveTimer = setTimeout(flushReadSeen, 250);
	};
	const closeReadingLog = () => {
		readingLog?.remove();
		readingLog = undefined;
		if (!revealing) rescheduleReading?.();
	};
	const stopReading = () => {
		readingToken++;
		cancelFrame(readingFrame);
		readingFrame = 0;
		clearTimeout(readingTimer);
		readingTimer = undefined;
		revealing = false;
		revealAll = undefined;
		rescheduleReading = undefined;
		refreshReadingControls = undefined;
		readingLog?.remove();
		readingLog = undefined;
	};
	const cancelFrame = (id) => {
		if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
	};
	const value = (id) => host.vars[variables.get(id)?.name ?? ""];
	const write = (id, input) => {
		const variable = variables.get(id);
		if (!variable) return;
		host.vars[variable.name] = variable.type === "number" ? Number(input) || 0 : variable.type === "boolean" ? Boolean(input) : String(input ?? "");
	};
	const notify = (message) => {
		if (status) {
			status.textContent = message;
			status.hidden = false;
			clearTimeout(toastTimer);
			toastTimer = setTimeout(() => {
				if (status) status.hidden = true;
			}, 3500);
		}
	};
	const emit = (event, data = {}) => {
		for (const listener of events.get(event) ?? []) try {
			listener(data);
		} catch (error) {
			host.error(String(error));
		};
		const fn = event === "dialogueNodeChanged" ? undefined : config?.hooks[event];
		if (fn) host.run(fn, data);
	};
	const fail = (error) => {
		const message = String(error instanceof Error ? error.message : error);
		notify(message);
		host.error(message);
		return false;
	};
	const normalize = (input) => {
		const next = copy(settings);
		if (!input || typeof input !== "object") return next;
		for (const key of [
			"masterVolume",
			"musicVolume",
			"effectsVolume"
		]) if (Number.isFinite(input[key])) next[key] = Math.max(0, Math.min(1, input[key]));
		for (const key of ["muted", "pixelated"]) if (typeof input[key] === "boolean") next[key] = input[key];
		for (const key of Object.keys(next.controls)) if (typeof input.controls?.[key] === "string" && /^[A-Za-z0-9]{1,40}$/.test(input.controls[key])) next.controls[key] = input.controls[key];
		return next;
	};
	const applySettings = async (input, persist = true) => {
		if (disposed) return false;
		try {
			const next = normalize(input);
			settings = next;
			await host.applySettings(next);
			if (persist) await host.storage.save(settingsKey, copy(settings));
			emit("settingsChanged", { settings: copy(settings) });
			return true;
		} catch (error) {
			return fail(error);
		}
	};
	const ready = enabled && config?.modules.settings ? host.storage.load(settingsKey).then((saved) => {
		if (disposed) return;
		return applySettings(saved ?? defaults, false);
	}).catch(fail) : Promise.resolve();
	const readingReady = novel ? Promise.all([host.storage.load(prefix + ".reading"), host.storage.load(prefix + ".read-lines")]).then(([options, seen]) => {
		if (disposed) return;
		if (options && typeof options === "object") {
			if (Number.isFinite(options.textSpeed)) reading.textSpeed = Math.max(0, Math.min(150, options.textSpeed));
			if (Number.isFinite(options.autoDelay)) reading.autoDelay = Math.max(500, Math.min(15e3, options.autoDelay));
		};
		if (Array.isArray(seen)) seen.slice(-6e4).forEach((key) => {
			if (typeof key === "string" && key.length < 700) readSeen.add(key);
		});
	}).catch(fail) : Promise.resolve();
	const slots = async () => {
		const raw = await host.storage.load(indexKey, []);
		return Array.isArray(raw) ? raw.filter((slot) => slot && typeof slot.id === "string" && /^[1-9][0-9]?$/.test(slot.id) && Number(slot.id) <= Number(config?.saveSlots ?? 3) && typeof slot.savedAt === "string" && typeof slot.name === "string").map((slot) => ({
			id: slot.id,
			name: slot.name.slice(0, 100),
			sceneId: String(slot.sceneId ?? ""),
			sceneName: String(slot.sceneName ?? ""),
			savedAt: slot.savedAt
		})) : [];
	};
	const validSlot = (id) => {
		if (!/^[1-9][0-9]?$/.test(id) || Number(id) > Number(config?.saveSlots ?? 3)) throw Error("저장 슬롯을 확인하세요.");
	};
	const save = async (id = "1", name = "") => {
		if (!enabled || !config?.modules.save || busy) return false;
		busy = true;
		try {
			validSlot(id);
			const scene = host.scene();
			if (!scene) throw Error("저장할 게임 씬이 없습니다.");
			const menuValue = value(config.variables.menuOpen), dialogueValue = value(config.variables.dialogueId);
			let ok;
			write(config.variables.menuOpen, false);
			write(config.variables.dialogueId, "");
			try {
				ok = await host.progress("save", slotKey(id));
			} finally {
				write(config.variables.menuOpen, menuValue);
				write(config.variables.dialogueId, dialogueValue);
			};
			if (ok === false) throw Error("게임을 저장하지 못했습니다.");
			const list = await slots(), slot = {
				id,
				name: name.trim().slice(0, 100) || "저장 " + id,
				sceneId: scene.id,
				sceneName: scene.name,
				savedAt: new Date().toISOString()
			};
			await host.storage.save(indexKey, [...list.filter((item) => item.id !== id), slot]);
			write(config.variables.lastSlot, id);
			emit("saved", {
				slotId: id,
				slotName: slot.name
			});
			notify(slot.name + " 저장 완료");
			return true;
		} catch (error) {
			return fail(error);
		} finally {
			busy = false;
		}
	};
	const close = (finishDialogue = true) => {
		if (disposed) return;
		const wasDialogue = view === "dialogue", oldDialogue = dialogueId;
		stopReading();
		view = "";
		dialogueId = "";
		nodeId = "";
		if (overlay) overlay.hidden = true;
		if (paused) {
			paused = false;
			host.pause(false);
		};
		if (config) {
			write(config.variables.menuOpen, false);
			if (wasDialogue) write(config.variables.dialogueId, "");
		};
		cancelFrame(gamepadRequest);
		gamepadRequest = 0;
		held.clear();
		lastFocus?.focus?.();
		if (wasDialogue && finishDialogue) emit("dialogueFinished", {
			dialogueId: oldDialogue,
			cancelled: true
		});
	};
	const load = async (id = "1") => {
		if (!enabled || !config?.modules.save || busy) return false;
		busy = true;
		try {
			validSlot(id);
			const exists = (await slots()).some((slot) => slot.id === id);
			if (!exists) {
				notify("비어 있는 저장 슬롯입니다.");
				return false;
			};
			close();
			const ok = await host.progress("load", slotKey(id));
			if (ok === false) throw Error("저장된 게임을 읽지 못했습니다.");
			write(config.variables.lastSlot, id);
			emit("loaded", { slotId: id });
			notify("불러오기 완료");
			return true;
		} catch (error) {
			return fail(error);
		} finally {
			busy = false;
		}
	};
	const remove = async (id) => {
		if (!enabled || !config?.modules.save || busy) return false;
		busy = true;
		try {
			validSlot(id);
			await host.progress("remove", slotKey(id));
			await host.storage.save(indexKey, (await slots()).filter((slot) => slot.id !== id));
			notify("저장을 삭제했습니다.");
			return true;
		} catch (error) {
			return fail(error);
		} finally {
			busy = false;
		}
	};
	const make = (tag, text = "", parent) => {
		const element = document.createElement(tag);
		element.textContent = text;
		parent?.append(element);
		return element;
	};
	const button = (label, run, parent = body) => {
		const element = make("button", label, parent);
		element.type = "button";
		element.addEventListener("click", () => {
			void Promise.resolve().then(run).catch(fail);
		});
		return element;
	};
	const focusable = () => panel ? [...panel.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex=\"0\"]")].filter((element) => !element.hidden && element.getClientRects().length) : [];
	const moveFocus = (delta) => {
		const items = focusable(), index = items.indexOf(document.activeElement);
		items[(index + delta + items.length) % items.length]?.focus();
	};
	const pollGamepad = () => {
		if (disposed || !view) return;
		const pad = [...navigator.getGamepads?.() ?? []].find(Boolean), next = new Set();
		if (pad) {
			pad.buttons.forEach((button, index) => {
				if (button.pressed) next.add(index);
			});
			if (pad.axes[1] < -.55) next.add(12);
			if (pad.axes[1] > .55) next.add(13);
			if (pad.axes[0] < -.55) next.add(14);
			if (pad.axes[0] > .55) next.add(15);
			for (const key of next) if (!held.has(key)) {
				const active = document.activeElement;
				if (key === 12 || key === 13) moveFocus(key === 12 ? -1 : 1);
				else if ((key === 14 || key === 15) && active instanceof HTMLInputElement && active.type === "range") {
					key === 14 ? active.stepDown() : active.stepUp();
					active.dispatchEvent(new Event("input", { bubbles: true }));
				} else if (key === 0 && active instanceof HTMLElement) active.click();
				else if (key === 1) close();
			}
		};
		held = next;
		gamepadRequest = requestAnimationFrame(pollGamepad);
	};
	const open = (mode, title) => {
		if (!root || !overlay || !body || !heading || disposed) return false;
		stopReading();
		overlay.dataset.view = mode;
		if (!view) lastFocus = document.activeElement;
		view = mode;
		heading.textContent = title;
		body.replaceChildren();
		overlay.hidden = false;
		if (!paused) {
			paused = true;
			host.pause(true);
		};
		if (config) write(config.variables.menuOpen, true);
		cancelFrame(gamepadRequest);
		gamepadRequest = requestAnimationFrame(pollGamepad);
		return true;
	};
	const finishRender = () => {
		queueMicrotask(() => {
			const readingAction = view === "dialogue" ? body?.querySelector(".fgf-dialogue-options button:not(:disabled)") : null;
			(readingAction ?? focusable()[0])?.focus({ preventScroll: true });
		});
	};
	const openSlots = async (mode) => {
		if (!config?.modules.save || !open(mode, mode === "save" ? "게임 저장" : "게임 불러오기")) return false;
		const expected = view, list = await slots().catch((error) => {
			fail(error);
			return [];
		});
		if (view !== expected || disposed) return false;
		for (let n = 1; n <= config.saveSlots; n++) {
			const id = String(n), slot = list.find((slot) => slot.id === id), row = make("div", "", body);
			row.className = "fgf-slot";
			const summary = make("div", "", row);
			make("strong", slot?.name ?? "슬롯 " + id, summary);
			make("small", slot ? slot.sceneName + " · " + new Date(slot.savedAt).toLocaleString("ko-KR") : "비어 있음", summary);
			const action = button(mode === "save" ? "여기에 저장" : "불러오기", async () => {
				if (mode === "save") {
					if (await save(id)) void openSlots(mode);
				} else await load(id);
			}, row);
			action.disabled = mode === "load" && !slot;
			if (slot) button("삭제", async () => {
				if (await remove(id)) void openSlots(mode);
			}, row);
		};
		finishRender();
		return true;
	};
	const openSettings = async () => {
		await ready;
		if (!config?.modules.settings || !open("settings", "게임 설정")) return false;
		const volumeLabels = {
			masterVolume: "전체 음량",
			musicVolume: "배경음",
			effectsVolume: "효과음"
		};
		for (const key of Object.keys(volumeLabels)) {
			const label = make("label", volumeLabels[key], body), output = make("output", Math.round(settings[key] * 100) + "%", label), input = make("input", "", label);
			input.type = "range";
			input.min = "0";
			input.max = "100";
			input.value = String(Math.round(settings[key] * 100));
			input.setAttribute("aria-label", volumeLabels[key]);
			input.addEventListener("input", () => {
				output.textContent = input.value + "%";
				void applySettings({ [key]: Number(input.value) / 100 }, false);
			});
		};
		for (const [key, labelText] of [["muted", "모든 소리 끄기"], ["pixelated", "픽셀 경계 선명하게"]]) {
			const label = make("label", labelText, body), input = make("input", "", label);
			input.type = "checkbox";
			input.checked = settings[key];
			input.addEventListener("change", () => {
				void applySettings({ [key]: input.checked }, false);
			});
		};
		if (host.fullscreen) button(document.fullscreenElement ? "전체 화면 끝내기" : "전체 화면", () => host.fullscreen(!document.fullscreenElement));
		const keys = make("details", "", body);
		make("summary", "키보드 조작", keys);
		for (const [key, labelText] of [
			["up", "위"],
			["down", "아래"],
			["left", "왼쪽"],
			["right", "오른쪽"],
			["jump", "점프"],
			["action", "행동"],
			["menu", "메뉴"]
		]) {
			const label = make("label", labelText, keys), input = make("input", "", label);
			input.readOnly = true;
			input.value = settings.controls[key];
			input.setAttribute("aria-label", labelText + " 조작 키");
			input.addEventListener("keydown", (event) => {
				if ([
					"Tab",
					"Shift",
					"Control",
					"Alt",
					"Meta"
				].includes(event.key)) return;
				event.preventDefault();
				event.stopPropagation();
				if (Object.entries(settings.controls).some(([name, code]) => name !== key && code === event.code)) {
					notify("다른 조작에 쓰는 키입니다.");
					return;
				};
				input.value = event.code;
				void applySettings({ controls: {
					...settings.controls,
					[key]: event.code
				} }, false);
			});
		};
		const actions = make("div", "", body);
		actions.className = "fgf-actions";
		button("기본값", async () => {
			await applySettings(defaults, true);
			openSettings();
		}, actions);
		button("설정 저장", async () => {
			if (await applySettings(settings, true)) {
				notify("설정을 저장했습니다.");
				close();
			}
		}, actions);
		finishRender();
		return true;
	};
	const node = () => config?.dialogues.find((dialogue) => dialogue.id === dialogueId)?.nodes.find((node) => node.id === nodeId);
	const renderDialogue = () => {
		const current = node();
		if (!current || !body || !heading) {
			close(false);
			return false;
		};
		heading.textContent = current.speaker || (novel ? "" : "대화");
		stopReading();
		const token = readingToken, key = readingKey(), readBefore = readSeen.has(key);
		if (reading.skipRead && !readBefore) reading.skipRead = false;
		body.replaceChildren();
		const copyBody = novel ? make("div", "", body) : body;
		if (novel) {
			copyBody.className = "fgf-dialogue-copy";
			copyBody.tabIndex = 0;
			copyBody.setAttribute("aria-label", "대사 본문");
			copyBody.addEventListener("keydown", (event) => {
				if ([
					"ArrowUp",
					"ArrowDown",
					"PageUp",
					"PageDown",
					"Home",
					"End"
				].includes(event.key)) event.stopPropagation();
			});
		};
		if (current.portraitAssetId && (!novel || config?.dialogueOptions?.portraitMode !== "hidden")) {
			const asset = project.assets.find((asset) => asset.id === current.portraitAssetId);
			if (asset && asset.type !== "audio") {
				const index = current.portraitFrame, margin = asset.grid?.margin ?? 0, spacing = asset.grid?.spacing ?? 0, w = asset.type === "spritesheet" ? asset.frameWidth : asset.width, h = asset.type === "spritesheet" ? asset.frameHeight : asset.height, cols = Math.max(1, Math.floor((asset.width - margin * 2 + spacing) / (w + spacing))), f = asset.atlas?.frames[index] ?? {
					x: asset.type === "spritesheet" ? margin + index % cols * (w + spacing) : 0,
					y: asset.type === "spritesheet" ? margin + Math.floor(index / cols) * (h + spacing) : 0,
					width: w,
					height: h,
					sourceWidth: w,
					sourceHeight: h,
					offsetX: 0,
					offsetY: 0,
					rotated: false
				};
				const canvas = make("canvas", "", copyBody);
				canvas.className = "fgf-portrait";
				canvas.width = f.sourceWidth;
				canvas.height = f.sourceHeight;
				canvas.setAttribute("role", "img");
				canvas.setAttribute("aria-label", current.speaker);
				const image = new Image();
				image.onload = () => {
					if (!canvas.isConnected) return;
					const context = canvas.getContext("2d");
					if (!context) return;
					context.imageSmoothingEnabled = !settings.pixelated;
					context.translate(f.offsetX, f.offsetY);
					context.scale((("displayWidth" in f ? Number(f.displayWidth) : 0) || (f.rotated ? f.height : f.width)) / (f.rotated ? f.height : f.width), (("displayHeight" in f ? Number(f.displayHeight) : 0) || (f.rotated ? f.width : f.height)) / (f.rotated ? f.width : f.height));
					if (f.rotated) {
						context.translate(0, f.width);
						context.rotate(-Math.PI / 2);
					};
					context.drawImage(image, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
				};
				image.onerror = () => canvas.remove();
				image.src = ("pageId" in f && f.pageId ? project.atlasPages?.find((page) => page.id === f.pageId)?.data : undefined) ?? asset.data;
			}
		};
		const text = make("p", current.text.replace(/\{\{([A-Za-z_$][\w$]*)\}\}/g, (_, name) => String(host.vars[name] ?? "")), copyBody);
		text.className = "fgf-dialogue-text";
		text.setAttribute("aria-live", novel ? "off" : "polite");
		const fullText = text.textContent ?? "";
		const entry = {
			dialogueId,
			nodeId,
			speaker: current.speaker,
			text: fullText
		};
		const previous = readingHistory.at(-1);
		if (!previous || previous.dialogueId !== dialogueId || previous.nodeId !== nodeId || previous.text !== fullText) {
			readingHistory.push(entry);
			if (readingHistory.length > 2e4) readingHistory.shift();
		};
		const choices = make("div", "", body);
		choices.className = "fgf-dialogue-options";
		if (current.choices.length) for (const choice of current.choices) {
			const item = button(choice.text, () => choose(choice.id), choices);
			item.dataset.choice = choice.id;
			item.disabled = !choiceAllowed(choice);
		}
		else {
			const advance = button("▸", next, choices);
			advance.className = "fgf-dialogue-advance";
			advance.setAttribute("aria-label", current.nextNodeId ? "대사 넘기기" : "대화 마치기");
		};
		const scheduleAdvance = () => {
			clearTimeout(readingTimer);
			if (!novel || current.choices.length || !reading.auto && !reading.skipRead) return;
			const wait = reading.skipRead && readBefore ? 70 : reading.autoDelay;
			readingTimer = setTimeout(() => {
				if (disposed || token !== readingToken || view !== "dialogue") return;
				if (document.hidden || readingPaused || readingLog) {
					scheduleAdvance();
					return;
				};
				next();
			}, wait);
		};
		rescheduleReading = scheduleAdvance;
		const complete = () => {
			if (token !== readingToken) return;
			text.textContent = fullText;
			revealing = false;
			revealAll = undefined;
			if (!readSeen.has(key)) {
				readSeen.add(key);
				if (novel) queueReadSave();
			};
			refreshReadingControls?.();
			scheduleAdvance();
		};
		if (novel) {
			const controls = make("div", "", body);
			controls.className = "fgf-reading-controls";
			const automatic = button(reading.auto ? "자동 진행 켜짐" : "자동 진행", () => {
				reading.auto = !reading.auto;
				refreshReadingControls?.();
				if (!revealing) scheduleAdvance();
			}, controls);
			const skip = button("읽은 내용 넘기기", () => {
				if (!readSeen.has(key)) {
					notify("처음 읽는 대사는 건너뛰지 않습니다.");
					return;
				};
				reading.skipRead = !reading.skipRead;
				skip.textContent = reading.skipRead ? "넘기기 중단" : "읽은 내용 넘기기";
				if (!revealing) scheduleAdvance();
			}, controls);
			const logButton = button("대화 기록", () => {
				clearTimeout(readingTimer);
				readingLog?.remove();
				readingLog = make("section", "", overlay);
				readingLog.className = "fgf-reading-log";
				readingLog.setAttribute("role", "dialog");
				readingLog.setAttribute("aria-modal", "true");
				readingLog.setAttribute("aria-label", "대화 기록");
				make("h2", "대화 기록", readingLog);
				const search = make("input", "", readingLog);
				search.type = "search";
				search.placeholder = "대사 검색";
				search.setAttribute("aria-label", "대화 기록 검색");
				const rows = make("div", "", readingLog);
				rows.className = "fgf-reading-log-rows";
				let all = false;
				const draw = () => {
					rows.replaceChildren();
					const query = search.value.trim().toLocaleLowerCase(), list = readingHistory.filter((item) => !query || (item.speaker + " " + item.text + " " + (item.choice ?? "")).toLocaleLowerCase().includes(query));
					for (const item of all || query ? list : list.slice(-250)) {
						const row = make("article", "", rows);
						make("strong", item.speaker || "나레이션", row);
						make("p", item.text, row);
						if (item.choice) make("small", "선택 · " + item.choice, row);
					};
					rows.scrollTop = query ? 0 : rows.scrollHeight;
				};
				search.addEventListener("input", draw);
				button("전체 기록", () => {
					all = true;
					draw();
				}, readingLog);
				button("돌아가기", () => {
					closeReadingLog();
					logButton.focus();
				}, readingLog);
				draw();
				search.focus();
			}, controls);
			const label = make("label", "글자 속도", controls), speed = make("input", "", label);
			speed.type = "range";
			speed.min = "0";
			speed.max = "100";
			speed.value = String(reading.textSpeed);
			speed.setAttribute("aria-label", "대사 글자 속도");
			speed.addEventListener("input", () => {
				reading.textSpeed = Number(speed.value);
				if (!reading.textSpeed) revealAll?.();
				void host.storage.save(prefix + ".reading", reading).catch(fail);
			});
			refreshReadingControls = () => {
				automatic.textContent = reading.auto ? "자동 진행 켜짐" : "자동 진행";
				automatic.setAttribute("aria-pressed", String(reading.auto));
				skip.textContent = reading.skipRead ? "넘기기 중단" : "읽은 내용 넘기기";
				skip.setAttribute("aria-pressed", String(reading.skipRead));
				speed.value = String(reading.textSpeed);
			};
			refreshReadingControls();
			if (reading.textSpeed > 0 && !(reading.skipRead && readBefore)) {
				text.textContent = "";
				revealing = true;
				let count = 0, last = performance.now();
				const chars = Array.from(fullText);
				revealAll = () => {
					cancelFrame(readingFrame);
					complete();
				};
				const tick = (now) => {
					if (disposed || token !== readingToken || view !== "dialogue") return;
					const delta = Math.min(100, Math.max(0, now - last));
					last = now;
					if (!document.hidden && !readingPaused && !readingLog) {
						count += delta * reading.textSpeed / 1e3;
						const following = copyBody.scrollTop + copyBody.clientHeight >= copyBody.scrollHeight - 8;
						text.textContent = chars.slice(0, Math.floor(count)).join("");
						if (novel && following) copyBody.scrollTop = copyBody.scrollHeight;
						if (count >= chars.length || !reading.textSpeed) {
							complete();
							return;
						}
					};
					readingFrame = requestAnimationFrame(tick);
				};
				readingFrame = requestAnimationFrame(tick);
			} else complete();
		} else complete();
		emit("dialogueNodeChanged", {
			dialogueId,
			nodeId,
			speaker: current.speaker,
			text: fullText,
			read: readBefore
		});
		if (current.onEnterFunctionId) host.run(current.onEnterFunctionId, {
			dialogueId,
			nodeId
		});
		finishRender();
		return true;
	};
	const goNode = (id) => {
		if (++dialogueTrail > 1e3) {
			fail("대화가 같은 노드를 너무 많이 거쳤습니다.");
			close(false);
			return false;
		};
		nodeId = id;
		return renderDialogue();
	};
	const endDialogue = () => {
		const id = dialogueId;
		close(false);
		if (config) write(config.variables.dialogueId, "");
		emit("dialogueFinished", {
			dialogueId: id,
			cancelled: false
		});
		return true;
	};
	function next() {
		if (readingLog || readingPaused) return false;
		if (revealing) {
			revealAll?.();
			return true;
		};
		const current = node();
		if (current?.choices.length) return false;
		return current?.nextNodeId ? goNode(current.nextNodeId) : endDialogue();
	}
	function choose(id) {
		if (readingLog || readingPaused) return false;
		if (revealing) {
			revealAll?.();
			return false;
		};
		const current = node(), choice = current?.choices.find((choice) => choice.id === id);
		if (!choice || !choiceAllowed(choice)) return false;
		if (config) write(config.variables.lastChoice, id);
		if (readingHistory.length) readingHistory[readingHistory.length - 1].choice = choice.text;
		emit("choiceSelected", {
			dialogueId,
			nodeId,
			choiceId: id
		});
		if (choice.functionId) host.run(choice.functionId, {
			dialogueId,
			nodeId,
			choiceId: id
		});
		return choice.nextNodeId ? goNode(choice.nextNodeId) : endDialogue();
	}
	const startDialogue = (id, resumeNodeId) => {
		const dialogue = config?.dialogues.find((dialogue) => dialogue.id === id);
		if (!config?.modules.dialogue || !dialogue) return false;
		if (!open("dialogue", dialogue.name)) return false;
		dialogueId = id;
		nodeId = resumeNodeId && dialogue.nodes.some((node) => node.id === resumeNodeId) ? resumeNodeId : dialogue.startNodeId;
		dialogueTrail = 0;
		write(config.variables.dialogueId, id);
		emit("dialogueStarted", { dialogueId: id });
		return renderDialogue();
	};
	const newGame = () => {
		if (!config) return false;
		close(false);
		host.reset?.();
		for (const variable of project.variables) host.vars[variable.name] = variable.type === "number" ? Number(variable.value) || 0 : variable.type === "boolean" ? variable.value === "true" : variable.value;
		emit("newGame");
		host.navigate(config.startSceneId || project.startSceneId);
		return true;
	};
	const title = () => {
		if (!config?.titleSceneId) return false;
		close(false);
		host.navigate(config.titleSceneId);
		return true;
	};
	const openMenu = () => {
		if (!config?.modules.menu || !open("menu", "일시정지")) return false;
		button("계속하기", () => close());
		if (config.modules.save) {
			button("게임 저장", () => openSlots("save"));
			button("불러오기", () => openSlots("load"));
		};
		if (config.modules.settings) button("게임 설정", openSettings);
		if (config.titleSceneId) button("타이틀로", title);
		finishRender();
		return true;
	};
	const advanceDialoguePointer = (event) => {
		if (disposed || view !== "dialogue" || readingLog || readingPaused || event.defaultPrevented || event.button !== 0) return;
		const target = event.target instanceof Element ? event.target : undefined;
		if (target?.closest("button,input,select,textarea,a,label,[role=\"button\"],[data-dialogue-ignore]") || target instanceof HTMLElement && target.isContentEditable) return;
		if (window.getSelection()?.toString()) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		next();
	};
	const keyDown = (event) => {
		if (disposed || event.isComposing || event.defaultPrevented) return;
		if (view === "dialogue" && ["Enter", " "].includes(event.key) && event.repeat) {
			event.preventDefault();
			event.stopPropagation();
			return;
		};
		if (view) {
			if (view === "dialogue" && novel && readingLog && event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				closeReadingLog();
				return;
			};
			if (view === "dialogue" && ["Enter", " "].includes(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey && !(event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLElement && event.target.isContentEditable)) {
				event.preventDefault();
				event.stopPropagation();
				if (!event.repeat) next();
				return;
			};
			if (event.key === "Escape" && !(event.target instanceof HTMLInputElement)) {
				event.preventDefault();
				close();
			} else if (event.key === "Tab") {
				const items = readingLog ? [...readingLog.querySelectorAll("button:not(:disabled),input,select,[tabindex=\"0\"]")] : focusable(), index = items.indexOf(document.activeElement);
				if (event.shiftKey && index <= 0) {
					event.preventDefault();
					items.at(-1)?.focus();
				} else if (!event.shiftKey && index === items.length - 1) {
					event.preventDefault();
					items[0]?.focus();
				}
			} else if (["ArrowUp", "ArrowDown"].includes(event.key) && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)) {
				event.preventDefault();
				moveFocus(event.key === "ArrowUp" ? -1 : 1);
			};
			event.stopPropagation();
		} else if (config?.modules.menu && event.code === settings.controls.menu && !event.repeat && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)) {
			event.preventDefault();
			event.stopPropagation();
			openMenu();
		}
	};
	if (enabled && typeof document !== "undefined") {
		root = make("div");
		root.className = "forge-framework";
		if (novel) root.classList.add("fgf-novel");
		root.style.setProperty("--fgf-panel", config.theme.panel);
		root.style.setProperty("--fgf-text", config.theme.text);
		root.style.setProperty("--fgf-accent", config.theme.accent);
		root.style.setProperty("--fgf-radius", config.theme.radius + "px");
		root.style.setProperty("--fgf-font", config.theme.fontSize + "px");
		root.style.setProperty("--fgf-dialogue-width", (config.dialogueOptions?.panelWidth ?? 1140) + "px");
		root.style.setProperty("--fgf-dialogue-height", (config.dialogueOptions?.panelHeight ?? 280) + "px");
		const style = make("style", "", root);
		style.textContent = ".forge-framework{position:fixed;inset:0;z-index:40;pointer-events:none;color:var(--fgf-text);font:var(--fgf-font)/1.5 system-ui,sans-serif}.forge-framework *{box-sizing:border-box}.forge-framework button,.forge-framework input,.forge-framework select{font:inherit}.forge-framework button{background:#34465f;color:var(--fgf-text);border:1px solid #64748b;border-radius:6px;min-height:44px;padding:8px 16px;cursor:pointer;touch-action:manipulation}.forge-framework button:hover{background:var(--fgf-accent)}.forge-framework button:disabled{opacity:.45;cursor:default}.forge-framework :focus-visible{outline:3px solid #d3e5ff;outline-offset:3px}.forge-framework .fgf-toggle{position:absolute;right:14px;top:14px;pointer-events:auto}.forge-framework .fgf-overlay{position:absolute;inset:0;background:#0a101cb8;pointer-events:auto;display:flex;align-items:center;justify-content:center;padding:clamp(12px,4vw,40px)}.forge-framework [hidden]{display:none!important}.forge-framework .fgf-panel{width:min(620px,100%);max-height:100%;display:flex;flex-direction:column;background:var(--fgf-panel);border:1px solid #64748b;border-radius:var(--fgf-radius);box-shadow:0 16px 60px #0008;overflow:hidden}.forge-framework .fgf-header{display:flex;gap:20px;align-items:center;padding:14px 20px;border-bottom:1px solid #64748b}.forge-framework h2{font-size:1.12em;margin:0;flex:1}.forge-framework .fgf-body{display:flex;flex-direction:column;gap:12px;overflow:auto;padding:20px;overscroll-behavior:contain;scrollbar-width:auto}.forge-framework .fgf-slot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px;border:1px solid #64748b;border-radius:6px}.forge-framework .fgf-slot>div{flex:1;min-width:150px}.forge-framework small{display:block;opacity:.8}.forge-framework label{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}.forge-framework input[type=range]{width:100%;accent-color:var(--fgf-accent)}.forge-framework input[type=checkbox]{width:22px;height:22px}.forge-framework input[readonly]{width:140px;background:#152031;color:var(--fgf-text);border:1px solid #64748b;padding:8px}.forge-framework .fgf-actions{display:flex;gap:12px;justify-content:flex-end;margin-top:8px}.forge-framework .fgf-dialogue-text{white-space:pre-wrap;margin:0;padding:4px 0 12px}.forge-framework .fgf-portrait{max-height:200px;max-width:180px;object-fit:contain;align-self:flex-start}.forge-framework .fgf-status{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);max-width:90%;padding:10px 18px;background:#132034f0;border:1px solid #64748b;border-radius:6px;pointer-events:none}";
		style.textContent += `
      .fgf-dialogue-options{display:flex;flex-direction:column;gap:10px}
      .fgf-reading-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:16px;font-size:13px}
      .forge-framework .fgf-reading-controls button{font-size:13px;min-height:34px;padding:6px 10px}
      .fgf-reading-controls label{display:flex;gap:8px;align-items:center}.forge-framework .fgf-reading-controls input{width:110px}
      .forge-framework .fgf-reading-log{position:absolute;inset:4%;padding:22px;display:flex;flex-direction:column;gap:12px;background:var(--fgf-panel);border:1px solid color-mix(in srgb,var(--fgf-text) 30%,transparent);border-radius:var(--fgf-radius);pointer-events:auto}
      .fgf-reading-log-rows{overflow:auto;flex:1;min-height:0}.fgf-reading-log article{padding:12px;border-bottom:1px solid color-mix(in srgb,var(--fgf-text) 20%,transparent)}.fgf-reading-log p{white-space:pre-wrap;line-height:1.8}
      .forge-framework .fgf-reading-log input{font:inherit;padding:10px;background:color-mix(in srgb,var(--fgf-panel) 90%,var(--fgf-text));border:1px solid color-mix(in srgb,var(--fgf-text) 30%,transparent);color:inherit}
      .fgf-novel button{background:color-mix(in srgb,var(--fgf-panel) 92%,var(--fgf-text));color:var(--fgf-text);border-color:color-mix(in srgb,var(--fgf-text) 25%,transparent)}.fgf-novel button:hover{background:color-mix(in srgb,var(--fgf-panel) 85%,var(--fgf-accent))}.fgf-novel .fgf-status{background:var(--fgf-panel);color:var(--fgf-text)}
      .fgf-novel .fgf-overlay[data-view=dialogue]{background:transparent;align-items:flex-end;padding:18px;pointer-events:none}
      .fgf-novel .fgf-overlay[data-view=dialogue] .fgf-panel{width:min(var(--fgf-dialogue-width),100%);height:var(--fgf-dialogue-height);max-height:calc(100dvh - 36px);flex-shrink:0;background:color-mix(in srgb,var(--fgf-panel) 88%,transparent);color:var(--fgf-text);border:1px solid color-mix(in srgb,var(--fgf-text) 12%,transparent);border-top:1px solid color-mix(in srgb,var(--fgf-accent) 65%,transparent);border-radius:var(--fgf-radius);box-shadow:0 8px 24px #101b3235;pointer-events:auto}
      .fgf-novel .fgf-overlay[data-view=dialogue] .fgf-header{height:30px;min-height:30px;padding:4px 24px 0;border:0;color:var(--fgf-accent);gap:12px}
      .fgf-novel .fgf-header h2{flex:0 1 auto;font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-left:2px solid var(--fgf-accent);padding-left:10px;line-height:20px}.fgf-novel .fgf-header h2:empty{visibility:hidden}
      .fgf-novel .fgf-overlay[data-view=dialogue] .fgf-header button{margin-left:auto;width:24px;height:24px;min-height:24px;background:transparent;color:var(--fgf-text);opacity:.65;border:0;padding:0;font-size:18px;line-height:20px}
      .fgf-novel .fgf-overlay[data-view=dialogue] .fgf-body{flex:1;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto auto;gap:6px;padding:6px 24px 10px;overflow:hidden}
      .fgf-novel .fgf-dialogue-copy{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--fgf-accent) transparent;padding-right:8px}
      .fgf-novel .fgf-dialogue-text{font-size:1em;line-height:1.65;min-height:0;padding:0;overflow-wrap:anywhere;cursor:pointer}
      .fgf-novel .fgf-portrait{float:left;width:90px;height:120px;object-fit:contain;margin:0 16px 0 0}
      .fgf-novel .fgf-dialogue-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:8px;max-height:112px;min-height:34px;overflow:auto;scrollbar-width:thin}
      .fgf-novel .fgf-dialogue-options button{min-height:48px;margin:0;padding:8px 14px;background:color-mix(in srgb,var(--fgf-panel) 94%,var(--fgf-text));color:var(--fgf-text);border:1px solid color-mix(in srgb,var(--fgf-text) 22%,transparent);border-left:2px solid var(--fgf-accent);border-radius:3px;text-align:left;font-size:.78em;line-height:1.4;overflow-wrap:anywhere}
      .fgf-novel .fgf-dialogue-options button:only-child{justify-self:end;min-height:34px;min-width:112px;text-align:center;background:transparent;border:0;border-bottom:1px solid color-mix(in srgb,var(--fgf-text) 35%,transparent);padding:4px 18px}
      .fgf-novel .fgf-dialogue-options button:hover{background:color-mix(in srgb,var(--fgf-panel) 88%,var(--fgf-accent));border-color:var(--fgf-accent)}
      .fgf-novel .fgf-reading-controls{justify-content:flex-end;gap:4px;margin:0;padding-top:4px;border-top:1px solid color-mix(in srgb,var(--fgf-text) 12%,transparent);color:var(--fgf-text);min-height:32px}
      .fgf-novel .fgf-reading-controls button{background:transparent;color:inherit;border:0;border-radius:3px;padding:4px 8px;min-height:28px;font-size:12px;white-space:nowrap}
      .fgf-novel .fgf-reading-controls button:hover,.fgf-novel .fgf-reading-controls button[aria-pressed=true]{background:color-mix(in srgb,var(--fgf-panel) 85%,var(--fgf-accent))}
      .fgf-novel .fgf-reading-controls input{accent-color:var(--fgf-accent);width:88px}.fgf-novel :focus-visible{outline-color:var(--fgf-accent)}
      @media(max-width:700px){.fgf-novel .fgf-overlay[data-view=dialogue]{padding:8px}.fgf-novel .fgf-overlay[data-view=dialogue] .fgf-panel{max-height:calc(100dvh - 16px)}.fgf-novel .fgf-overlay[data-view=dialogue] .fgf-header{padding:5px 14px 0}.fgf-novel .fgf-overlay[data-view=dialogue] .fgf-body{padding:6px 14px 8px;gap:6px}.fgf-novel .fgf-dialogue-text{font-size:16px}.fgf-novel .fgf-reading-controls{justify-content:flex-start;gap:2px}.fgf-novel .fgf-reading-controls button{font-size:11px;padding:4px 6px}.fgf-novel .fgf-portrait{width:70px;height:90px;margin-right:12px}}
    `;
		if (config.modules.menu) {
			const toggle = button("메뉴", openMenu, root);
			toggle.className = "fgf-toggle";
		};
		status = make("div", "", root);
		status.className = "fgf-status";
		status.setAttribute("role", "status");
		status.hidden = true;
		overlay = make("div", "", root);
		overlay.className = "fgf-overlay";
		overlay.hidden = true;
		panel = make("section", "", overlay);
		panel.className = "fgf-panel";
		panel.setAttribute("role", "dialog");
		panel.setAttribute("aria-modal", "true");
		panel.setAttribute("aria-label", "게임 공통 메뉴");
		const header = make("div", "", panel);
		header.className = "fgf-header";
		heading = make("h2", "", header);
		const closeButton = button("닫기", () => close(), header);
		if (novel) {
			closeButton.textContent = "×";
			closeButton.setAttribute("aria-label", "닫기");
			closeButton.title = "닫기";
		};
		body = make("div", "", panel);
		body.className = "fgf-body";
		root.addEventListener("keydown", keyDown);
		(host.mount ?? document.body).append(root);
		window.addEventListener("keydown", keyDown);
		window.addEventListener("click", advanceDialoguePointer, true);
	};
	const transportListeners = new Set();
	let transportClosed = false;
	const transport = host.transport ?? {
		async request(command) {
			if (disposed || transportClosed) return {
				id: command.id,
				ok: false,
				error: "서비스가 종료됐습니다."
			};
			if (command.authority === "server") return {
				id: command.id,
				ok: false,
				error: "서버 권한 명령은 온라인 전송 어댑터가 필요합니다."
			};
			try {
				const payload = command.payload && typeof command.payload === "object" ? command.payload : {}, ok = await api.action(command.type, typeof payload.id === "string" ? payload.id : "", payload.value);
				if (disposed || transportClosed) return {
					id: command.id,
					ok: false,
					error: "서비스가 종료됐습니다."
				};
				for (const listener of transportListeners) try {
					listener(copy(command));
				} catch (error) {
					host.error(String(error));
				};
				return {
					id: command.id,
					ok: ok !== false,
					value: ok
				};
			} catch (error) {
				return {
					id: command.id,
					ok: false,
					error: String(error)
				};
			}
		},
		subscribe(listener) {
			if (disposed || transportClosed) return () => {};
			transportListeners.add(listener);
			return () => {
				transportListeners.delete(listener);
			};
		},
		dispose() {
			transportClosed = true;
			transportListeners.clear();
		}
	};
	const api = {
		transport,
		ready: Promise.all([ready, readingReady]),
		openMenu,
		openSave: () => openSlots("save"),
		openLoad: () => openSlots("load"),
		openSettings,
		startDialogue,
		next,
		choose,
		close,
		newGame,
		title,
		save,
		load,
		remove,
		slots,
		settings: () => copy(settings),
		applySettings,
		capturesInput: () => !!view,
		status: () => ({
			view,
			dialogueId,
			nodeId,
			busy
		}),
		history: () => copy(readingHistory),
		dialogue: (id) => {
			const found = config?.dialogues.find((dialogue) => dialogue.id === id) ?? config?.dialogues.find((dialogue) => dialogue.name === id);
			return found ? copy(found) : undefined;
		},
		dialogueNodeIds: (id) => config?.dialogues.find((dialogue) => dialogue.id === id)?.nodes.map((node) => node.id) ?? [],
		setChoiceGuard: (guard) => {
			choiceGuard = guard;
			refreshChoices();
			return () => {
				if (choiceGuard === guard) {
					choiceGuard = undefined;
					refreshChoices();
				}
			};
		},
		readingOptions: () => novel ? { ...reading } : undefined,
		pauseReading: (paused) => {
			readingPaused = paused;
		},
		setReadingOptions: (input) => {
			if (Number.isFinite(input.textSpeed)) reading.textSpeed = Math.max(0, Math.min(150, input.textSpeed));
			if (Number.isFinite(input.autoDelay)) reading.autoDelay = Math.max(500, Math.min(15e3, input.autoDelay));
			if (typeof input.auto === "boolean") reading.auto = input.auto;
			if (typeof input.skipRead === "boolean") reading.skipRead = input.skipRead;
			if (!reading.textSpeed) revealAll?.();
			refreshReadingControls?.();
			if (!revealing) rescheduleReading?.();
			void host.storage.save(prefix + ".reading", reading).catch(fail);
			return { ...reading };
		},
		on(event, listener) {
			const list = events.get(event) ?? new Set();
			list.add(listener);
			events.set(event, list);
			return () => list.delete(listener);
		},
		async action(command, id = "", input) {
			if (command === "menu") return openMenu();
			if (command === "save-menu") return openSlots("save");
			if (command === "load-menu") return openSlots("load");
			if (command === "settings") return openSettings();
			if (command === "dialogue") return startDialogue(id, input && typeof input === "object" && "nodeId" in input ? String(input.nodeId) : undefined);
			if (command === "save") return save(id || "1");
			if (command === "load") return load(id || "1");
			if (command === "remove") return remove(id);
			if (command === "new-game") return newGame();
			if (command === "title") return title();
			if (command === "close" || command === "resume") {
				close();
				return true;
			};
			if (command === "setting") return applySettings({ [id]: input });
			if (command === "next") return next();
			return false;
		},
		dispose() {
			if (disposed) return;
			close(false);
			disposed = true;
			clearTimeout(toastTimer);
			flushReadSeen();
			stopReading();
			cancelFrame(gamepadRequest);
			if (typeof window !== "undefined") window.removeEventListener("keydown", keyDown);
			if (typeof window !== "undefined") window.removeEventListener("click", advanceDialoguePointer, true);
			root?.remove();
			events.clear();
			choiceGuard = undefined;
			transport.dispose();
		}
	};
	return api;
},function createRuntimeObservatory(host) {
	let config = {
		enabled: false,
		recording: true,
		watches: [],
		functions: []
	};
	let sequence = 0;
	let events = [];
	let changes = [];
	let stopped = "";
	const last = new Map();
	const safe = (value) => {
		if (typeof value === "string") return value.slice(0, 1e4);
		if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
		if (value === null || typeof value === "boolean" || value === undefined) return value;
		try {
			const text = JSON.stringify(value);
			return text.length > 1e4 ? text.slice(0, 1e4) + "…" : JSON.parse(text);
		} catch {
			return "표시할 수 없는 값";
		}
	};
	const update = (watch, value, available, cause) => {
		const next = safe(value), previous = last.get(watch.id);
		const changed = !!previous && (available !== previous.available || JSON.stringify(previous.value) !== JSON.stringify(next));
		const matched = available && (watch.stop === "change" ? changed : watch.stop === "eq" ? String(next) === watch.threshold : watch.stop === "gt" ? Number(next) > Number(watch.threshold) : watch.stop === "lt" ? Number(next) < Number(watch.threshold) : false);
		last.set(watch.id, {
			value: next,
			available,
			matched
		});
		const reading = {
			id: watch.id,
			value: next,
			available,
			time: Date.now(),
			sequence: ++sequence,
			changed,
			cause
		};
		if (config.recording && (changed || !previous)) changes.push(reading);
		if (changes.length > 500) changes.splice(0, changes.length - 500);
		if (previous && matched && (watch.stop === "change" || !previous.matched)) {
			stopped = watch.label + " · " + (watch.stop === "change" ? "값 변경" : "중단 조건 충족");
			host.pause();
		};
		return reading;
	};
	const sample = () => {
		if (!config.enabled || !config.watches.length) return [];
		const snapshot = host.sample(config.watches);
		return config.watches.map((watch) => {
			if (watch.kind === "variable") {
				const name = host.variableName(watch.targetId);
				return update(watch, name ? snapshot.values[name] : undefined, !!name && Object.hasOwn(snapshot.values, name));
			};
			if (watch.kind === "object") {
				const object = snapshot.objects.find((o) => o.id === watch.targetId && o.sceneId === watch.sceneId && o.active);
				const allowed = [
					"x",
					"y",
					"rotation",
					"opacity",
					"scaleX",
					"scaleY",
					"visible",
					"worldX",
					"worldY",
					"velocityX",
					"velocityY"
				];
				const ok = !!object && allowed.includes(watch.property ?? "") && object[watch.property] !== undefined;
				return update(watch, ok ? object[watch.property] : undefined, ok);
			};
			const binding = snapshot.states.find((s) => s.sceneId === watch.sceneId && s.bindingId === watch.bindingId && s.owner === watch.owner);
			const parameter = binding?.parameters?.find((p) => p.id === watch.targetId);
			return update(watch, parameter?.value, !!parameter);
		});
	};
	const flush = () => {
		if (!config.enabled) return;
		const readings = sample();
		// Full current values plus bounded intermediate changes (including multiple writes in one tick).
		host.send({
			readings: [...changes, ...readings.map((r) => ({
				...r,
				changed: false
			}))],
			events,
			...stopped ? {
				paused: true,
				reason: stopped
			} : {}
		});
		changes = [];
		events = [];
		stopped = "";
	};
	return {
		configure(next) {
			const enabled = !!next.enabled;
			config = {
				enabled,
				recording: next.recording !== false,
				watches: Array.isArray(next.watches) ? next.watches.filter((w) => w && typeof w.id === "string" && [
					"variable",
					"object",
					"state"
				].includes(w.kind)).slice(0, 256) : [],
				functions: Array.isArray(next.functions) ? next.functions.filter((id) => typeof id === "string").slice(0, 256) : [],
				sceneId: next.sceneId
			};
			const ids = new Set(config.watches.map((w) => w.id));
			for (const id of last.keys()) if (!ids.has(id)) last.delete(id);
			if (!enabled) {
				last.clear();
				changes = [];
				events = [];
			};
			flush();
		},
		watching(functionId, stack, sceneId) {
			return config.enabled && config.recording && (!config.sceneId || config.sceneId === sceneId) && (config.functions.includes(functionId) || stack.some((id) => config.functions.includes(id)));
		},
		observe(entry, sceneId) {
			if (!config.enabled || !config.recording) return;
			const safeEntry = {
				...entry,
				args: entry.args ? safe(entry.args) : undefined,
				before: safe(entry.before),
				after: safe(entry.after),
				callId: sceneId + ":" + entry.callId,
				parentCallId: entry.parentCallId ? sceneId + ":" + entry.parentCallId : undefined,
				sceneId,
				sequence: ++sequence
			};
			events.push(safeEntry);
			if (events.length > 500) events.splice(0, events.length - 500);
		},
		variableChanged(id, before, after, cause) {
			if (!config.enabled) return;
			for (const watch of config.watches) if (watch.kind === "variable" && watch.targetId === id) {
				if (!last.has(watch.id)) update(watch, before, true);
				update(watch, after, true, cause);
			}
		},
		flush,
		clear() {
			events = [];
			changes = [];
			last.clear();
		},
		dispose() {
			config.enabled = false;
			events = [];
			changes = [];
			last.clear();
		}
	};
},function createLightingRuntime(project, definition, scene, actors, error) {
	const sceneState = {
		enabled: false,
		ambientColor: "#ffffff",
		ambientIntensity: .25,
		maxLights: 16,
		...definition.lighting
	};
	const records = new Map();
	const surfaces = new Map();
	const defaults = {
		enabled: true,
		kind: "point",
		color: "#ffd49a",
		radius: 240,
		height: 32,
		intensity: 1.5,
		direction: 0,
		coneAngle: 70,
		softness: .25,
		follow: "self",
		targetId: "",
		followRotation: false,
		aimAtPointer: false,
		offsetX: 0,
		offsetY: 0,
		flicker: 0,
		flickerSpeed: 7,
		pulse: 0,
		pulseSpeed: 1
	};
	let disposed = false, warned = false;
	const webgl = () => !!scene.game?.renderer?.gl;
	const color = (value) => parseInt(value.slice(1), 16);
	const ambient = () => {
		const c = color(sceneState.ambientColor), v = sceneState.ambientIntensity;
		return Math.round((c >> 16 & 255) * v) << 16 | Math.round((c >> 8 & 255) * v) << 8 | Math.round((c & 255) * v);
	};
	const eachLeaf = (go, apply) => {
		apply(go);
		for (const child of go.list ?? []) eachLeaf(child, apply);
	};
	const receives = (o) => {
		let current = o, receive = o.lighting?.receive ?? "auto";
		const visited = new Set();
		while (current && !visited.has(current.id)) {
			visited.add(current.id);
			if (receive === "auto" && current.lighting?.receive && current.lighting.receive !== "auto") receive = current.lighting.receive;
			if (current.fixed || current.gameUi?.enabled) return receive === "on";
			current = current.parentId ? surfaces.get(current.parentId)?.def : undefined;
		};
		return receive !== "off";
	};
	const applySurface = (record) => {
		const enabled = sceneState.enabled && webgl() && receives(record.def), settings = record.def.lighting;
		eachLeaf(record.go, (go) => {
			go.setLighting?.(enabled);
			if (go.setSelfShadow) {
				go.selfShadow = { ...go.selfShadow };
				go.setSelfShadow(settings?.selfShadow ?? false, settings?.penumbra ?? .5, settings?.diffuseFlatThreshold ?? 1 / 3);
			}
		});
	};
	const applyScene = () => {
		if (sceneState.enabled && !webgl()) {
			if (!warned) {
				warned = true;
				error("이 실행 환경은 WebGL 조명을 지원하지 않습니다. WebGL 실행 환경에서 확인하세요.");
			}
		};
		if (sceneState.enabled && webgl()) scene.lights.enable().setAmbientColor(ambient());
		else scene.lights?.disable();
		for (const record of surfaces.values()) applySurface(record);
	};
	const bind = (o, go) => {
		if (disposed || !go) return;
		surfaces.set(o.id, {
			def: o,
			go
		});
		applySurface({
			def: o,
			go
		});
		if (o.lighting?.light) {
			const previous = records.get(o.id);
			if (previous) {
				scene.lights?.removeLight(previous.light);
				records.delete(o.id);
			};
			const options = {
				...defaults,
				...o.lighting.light
			};
			const light = scene.lights?.addLight(o.x, o.y, options.radius, color(options.color), 0);
			if (light) records.set(o.id, {
				def: o,
				go,
				options,
				light
			});
		}
	};
	const visible = (go) => {
		for (let node = go; node; node = node.parentContainer) if (node.active === false || node.visible === false) return false;
		return true;
	};
	const pointerPoint = () => {
		const pointer = scene.input?.activePointer, camera = (pointer && scene.cameras.getCamerasBelowPointer?.(pointer)?.find((c) => c.name !== "게임 UI")) ?? scene.cameras.main;
		return pointer ? camera.getWorldPoint(pointer.x, pointer.y) : {
			x: 0,
			y: 0
		};
	};
	const update = () => {
		if (disposed) return;
		const time = scene.time.now / 1e3;
		for (const [id, record] of records) {
			const { go, options: o, light } = record;
			if (go.active === false) {
				if (go.scene == null) {
					scene.lights.removeLight(light);
					records.delete(id);
					surfaces.delete(id);
				} else light.setVisible(false).setIntensity(0);
				continue;
			};
			const target = o.follow === "object" ? scene.objectMap?.get(o.targetId) : go;
			if (!sceneState.enabled || !o.enabled || !visible(go) || o.follow === "object" && (!target || !visible(target))) {
				light.setVisible(false).setIntensity(0);
				continue;
			};
			light.setVisible(true);
			let x, y, rotation = 0;
			if (o.follow === "pointer") {
				const p = pointerPoint();
				x = p.x + o.offsetX;
				y = p.y + o.offsetY;
			} else {
				const anchor = target.getData?.("forgeAnchor") ?? target, matrix = anchor.getWorldTransformMatrix?.();
				if (matrix) {
					x = matrix.tx + matrix.a * o.offsetX + matrix.c * o.offsetY;
					y = matrix.ty + matrix.b * o.offsetX + matrix.d * o.offsetY;
					rotation = Math.atan2(matrix.b, matrix.a);
				} else {
					x = anchor.x + o.offsetX;
					y = anchor.y + o.offsetY;
					rotation = anchor.rotation ?? 0;
				}
			};
			light.setPosition(x, y).setRadius(o.radius).setColor(color(o.color)).setZ(o.height);
			let intensity = o.intensity;
			if (o.pulse) intensity *= 1 - o.pulse * (.5 + .5 * Math.sin(time * o.pulseSpeed * Math.PI * 2));
			if (o.flicker) {
				const phase = [...id].reduce((v, c) => v + c.charCodeAt(0), 0);
				const wave = (Math.sin(time * o.flickerSpeed * 5.71 + phase) + Math.sin(time * o.flickerSpeed * 9.13 + phase * .3) + 2) / 4;
				intensity *= 1 - o.flicker * wave;
			};
			light.setIntensity(Math.max(0, intensity));
			if (o.kind === "cone") {
				let direction = o.direction * Math.PI / 180;
				if (o.aimAtPointer) {
					const p = pointerPoint();
					direction += Math.atan2(p.y - y, p.x - x);
				} else if (o.followRotation) direction += rotation;
				const outer = o.coneAngle * Math.PI / 180;
				light.setCone(direction, outer * (1 - o.softness), outer);
			} else light.disableCone();
		}
	};
	const command = (name, targetId, value) => {
		if (!targetId) {
			if (name === "enable" || name === "disable" || name === "toggle") sceneState.enabled = name === "toggle" ? !sceneState.enabled : name === "enable";
			else if (name === "ambient") {
				const n = Number(value);
				if (!Number.isFinite(n)) throw Error("기본 밝기는 숫자여야 합니다.");
				sceneState.ambientIntensity = Math.max(0, Math.min(1, n));
			} else if (name === "color" && /^#[0-9a-fA-F]{6}$/.test(String(value))) sceneState.ambientColor = String(value);
			else throw Error("씬에서 지원하지 않는 조명 조작입니다.");
			applyScene();
			update();
			return true;
		};
		const record = records.get(targetId);
		if (!record) throw Error("대상 오브젝트에 광원이 없습니다.");
		const o = record.options;
		if (name === "enable" || name === "disable" || name === "toggle") o.enabled = name === "toggle" ? !o.enabled : name === "enable";
		else if (name === "color") {
			if (!/^#[0-9a-fA-F]{6}$/.test(String(value))) throw Error("광원 색은 #RRGGBB 형식이어야 합니다.");
			o.color = String(value);
		} else if (name === "intensity" || name === "radius") {
			const n = Number(value);
			if (!Number.isFinite(n)) throw Error("광원 값은 숫자여야 합니다.");
			o[name] = name === "radius" ? Math.max(1, Math.min(16384, n)) : Math.max(0, Math.min(20, n));
		} else throw Error("지원하지 않는 광원 조작입니다.");
		update();
		return true;
	};
	const snapshot = () => ({
		scene: { ...sceneState },
		lights: Object.fromEntries([...records].map(([id, r]) => [id, { ...r.options }]))
	});
	const restore = (value) => {
		if (!value || typeof value !== "object") return;
		if (typeof value.scene?.enabled === "boolean") sceneState.enabled = value.scene.enabled;
		if (typeof value.scene?.ambientColor === "string" && /^#[0-9a-fA-F]{6}$/.test(value.scene.ambientColor)) sceneState.ambientColor = value.scene.ambientColor;
		if (Number.isFinite(value.scene?.ambientIntensity)) sceneState.ambientIntensity = Math.max(0, Math.min(1, value.scene.ambientIntensity));
		for (const [id, r] of records) {
			const saved = value.lights?.[id];
			if (!saved) continue;
			for (const key of [
				"enabled",
				"color",
				"radius",
				"intensity"
			]) {
				if (key === "enabled" && typeof saved[key] === "boolean") r.options[key] = saved[key];
				else if (key === "color" && typeof saved[key] === "string" && /^#[0-9a-fA-F]{6}$/.test(saved[key])) r.options[key] = saved[key];
				else if (key === "radius" && Number.isFinite(saved[key])) r.options[key] = Math.max(1, Math.min(16384, saved[key]));
				else if (key === "intensity" && Number.isFinite(saved[key])) r.options[key] = Math.max(0, Math.min(20, saved[key]));
			}
		};
		applyScene();
		update();
	};
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		scene.events.off("postupdate", update);
		for (const r of records.values()) scene.lights?.removeLight(r.light);
		records.clear();
		surfaces.clear();
	};
	for (const actor of actors()) bind(actor.def, actor.go);
	applyScene();
	update();
	scene.events.on("postupdate", update);
	scene.events.once("shutdown", dispose);
	return {
		bind,
		update,
		command,
		snapshot,
		restore,
		dispose
	};
},function createRequirementsRuntime(project, host = {}) {
	const definitions = new Map((project.definitions ?? []).map((value) => [value.id, value])), rules = new Map((project.conditionRules ?? []).map((value) => [value.id, value])), variables = new Map(project.variables.map((value) => [value.id, value])), items = new Map((project.items ?? []).map((value) => [value.id, value]));
	let level = 1, points = 0;
	const skills = new Map();
	const skill = (id) => definitions.get(id) ?? [...definitions.values()].find((value) => value.key === id);
	const rule = (id) => rules.get(id) ?? [...rules.values()].find((value) => value.key === id);
	const fail = (message) => ({
		passed: false,
		reasons: [message]
	}), pass = () => ({
		passed: true,
		reasons: []
	});
	const finite = (value, min, max) => typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= min && value <= max;
	const compare = (left, right, op) => typeof left !== typeof right ? false : op === "eq" ? left === right : op === "ne" ? left !== right : typeof left === "number" && typeof right === "number" ? op === "lt" ? left < right : op === "lte" ? left <= right : op === "gt" ? left > right : op === "gte" ? left >= right : false : false;
	const comparison = {
		eq: "같음",
		ne: "다름",
		lt: "미만",
		lte: "이하",
		gt: "초과",
		gte: "이상"
	};
	const variable = (id) => {
		if (host.variable) return host.variable(id);
		const value = variables.get(id);
		return value?.type === "number" ? Number(value.value) : value?.type === "boolean" ? value.value === "true" : value?.value;
	};
	function evaluate(node, active, budget, depth = 0) {
		if (!node || typeof node !== "object" || --budget.remaining < 0 || depth > 32) return fail("조건의 항목 수나 연결 깊이를 확인하세요.");
		if (node.type === "all" || node.type === "any") {
			if (!Array.isArray(node.children) || node.children.length > 32) return fail("조건 묶음의 항목을 확인하세요.");
			const results = node.children.map((child) => evaluate(child, active, budget, depth + 1));
			if (node.type === "all") return {
				passed: results.every((result) => result.passed),
				reasons: [...new Set(results.flatMap((result) => result.reasons))].slice(0, 32)
			};
			if (results.some((result) => result.passed)) return pass();
			return fail(results.length ? "다음 중 하나가 필요합니다: " + [...new Set(results.flatMap((result) => result.reasons))].slice(0, 8).join(" / ") : "충족할 대안 조건이 없습니다.");
		};
		if (node.type === "condition") {
			const value = rules.get(node.ruleId);
			if (!value) return fail("참조한 공통 조건이 없습니다.");
			if (active.has(value.id)) return fail(value.name + ": 공통 조건이 순환 참조됩니다.");
			active.add(value.id);
			const result = evaluate(value.condition, active, budget, depth + 1);
			active.delete(value.id);
			return result;
		};
		let current, expected = node.type === "variable" || node.type === "item" || node.type === "skill" || node.type === "profile" ? node.value : undefined, label = "조건";
		if (node.type === "variable") {
			const value = variables.get(node.variableId);
			if (!value) return fail("조건의 변수가 없습니다.");
			current = variable(value.id);
			label = value.label || value.name;
			if (typeof expected !== value.type) return fail(label + ": 비교값의 유형을 확인하세요.");
		} else if (node.type === "item") {
			const value = items.get(node.itemId);
			if (!value) return fail("조건의 아이템이 없습니다.");
			current = host.itemCount ? host.itemCount(value.id) : value.initialQuantity;
			label = value.name + " 수량";
		} else if (node.type === "skill") {
			const value = definitions.get(node.definitionId);
			if (value?.kind !== "skill") return fail("조건의 스킬 데이터가 없습니다.");
			current = skills.get(value.id) ?? 0;
			label = value.name + " 습득 단계";
		} else if (node.type === "profile") {
			current = node.property === "level" ? level : node.property === "points" ? points : undefined;
			label = node.property === "level" ? "레벨" : "스킬 포인트";
		} else return fail("지원하지 않는 선행조건입니다.");
		if (typeof current === "number" && (!Number.isFinite(current) || typeof expected !== "number" || !Number.isFinite(expected))) return fail(label + ": 유효한 숫자가 필요합니다.");
		return compare(current, expected, node.compare) ? pass() : fail(label + " " + String(expected) + " " + (comparison[node.compare] ?? "비교값") + " 필요 · 현재 " + String(current));
	}
	const check = (id, phase = "use") => {
		if (![
			"display",
			"learn",
			"use"
		].includes(phase)) return fail("조건 판정 단계를 확인하세요.");
		const value = skill(id);
		if (value) {
			const node = value.requirements?.[phase];
			return node ? evaluate(node, new Set(), { remaining: 2048 }) : pass();
		};
		const item = items.get(id) ?? [...items.values()].find((item) => item.key === id);
		if (item) {
			const node = item.requirements?.[phase];
			return node ? evaluate(node, new Set(), { remaining: 2048 }) : pass();
		};
		const valueRule = rule(id);
		if (valueRule) return evaluate(valueRule.condition, new Set([valueRule.id]), { remaining: 2048 });
		return fail("판정할 설정 데이터나 공통 조건이 없습니다.");
	};
	const getRank = (id) => {
		const value = skill(id);
		return value?.kind === "skill" ? skills.get(value.id) ?? 0 : 0;
	};
	const checkLearn = (id) => {
		const value = skill(id);
		if (value?.kind !== "skill") return fail("습득할 스킬 데이터가 없습니다.");
		const result = check(value.id, "learn");
		if (!result.passed) return result;
		if (getRank(value.id) >= (value.skillLearning?.maxRank ?? 1)) return fail(value.name + ": 이미 최대 단계까지 배웠습니다.");
		const cost = value.skillLearning?.pointCost ?? 0;
		if (points < cost) return fail("스킬 포인트 " + cost + " 필요 · 현재 " + points);
		return pass();
	};
	const learn = (id) => {
		const result = checkLearn(id);
		if (!result.passed) return {
			...result,
			rank: getRank(id),
			spent: 0
		};
		const value = skill(id), spent = value.skillLearning?.pointCost ?? 0, rank = getRank(value.id) + 1;
		points -= spent;
		skills.set(value.id, rank);
		return {
			passed: true,
			reasons: [],
			rank,
			spent
		};
	};
	const use = (id, options = {}) => {
		const value = skill(id);
		if (value?.kind !== "skill") return fail("사용할 스킬 데이터가 없습니다.");
		if (options.requireLearned && getRank(value.id) < 1) return fail(value.name + ": 먼저 스킬을 배워야 합니다.");
		return check(value.id, "use");
	};
	const snapshot = () => ({
		version: 1,
		level,
		points,
		skills: Object.fromEntries(skills)
	});
	const restore = (value) => {
		if (!value || typeof value !== "object") return false;
		const input = value;
		if (input.version !== undefined && input.version !== 1 || !finite(input.level, 1, 1e6) || !finite(input.points, 0, 1e9) || !input.skills || typeof input.skills !== "object" || Array.isArray(input.skills) || Object.keys(input.skills).length > 1e4) return false;
		const next = new Map();
		for (const [id, rank] of Object.entries(input.skills)) {
			const d = definitions.get(id);
			if (d?.kind !== "skill" || !finite(rank, 0, d.skillLearning?.maxRank ?? 1)) return false;
			if (rank > 0) next.set(id, rank);
		};
		level = input.level;
		points = input.points;
		skills.clear();
		for (const [id, rank] of next) skills.set(id, rank);
		return true;
	};
	const reset = () => {
		level = 1;
		points = 0;
		skills.clear();
		if (project.progression) restore(project.progression);
	};
	const setLevel = (value) => {
		if (!finite(value, 1, 1e6)) throw Error("레벨은 1~1,000,000의 정수로 설정하세요.");
		level = value;
		return level;
	};
	const setPoints = (value) => {
		if (!finite(value, 0, 1e9)) throw Error("스킬 포인트는 0~1,000,000,000의 정수로 설정하세요.");
		points = value;
		return points;
	};
	const setRank = (id, value) => {
		const definition = skill(id);
		if (definition?.kind !== "skill") throw Error("설정할 스킬 데이터가 없습니다.");
		if (!finite(value, 0, definition.skillLearning?.maxRank ?? 1)) throw Error("스킬 단계가 허용 범위를 벗어났습니다.");
		if (value === 0) skills.delete(definition.id);
		else skills.set(definition.id, value);
		return value;
	};
	reset();
	return {
		check,
		progression: {
			check: checkLearn,
			learn,
			use,
			getRank,
			setLevel,
			setPoints,
			addPoints: (value) => setPoints(points + value),
			setRank,
			snapshot,
			restore,
			reset
		}
	};
},function createInteractionRuntime(host) {
	const regions = new Map(), keys = new Map(), pending = new Map();
	let disposed = false;
	const triggers = [
		"enter",
		"stay",
		"exit",
		"interact"
	];
	const finite = (value, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
	const anchor = (go) => go?.getData?.("forgeAnchor") ?? go;
	const usable = (go) => {
		if (!go || go.active === false || go.visible === false) return false;
		for (let node = anchor(go), count = 0; node; node = node.parentContainer) {
			if (++count > 64 || node.active === false || node.visible === false) return false;
		};
		return !go.getData?.("forgeUiTransient");
	};
	const matrix = (go) => {
		go = anchor(go);
		if (!go) return;
		try {
			if (go.getWorldTransformMatrix) {
				const m = go.getWorldTransformMatrix();
				if ([
					m.a,
					m.b,
					m.c,
					m.d,
					m.tx,
					m.ty
				].every(Number.isFinite)) return {
					a: m.a,
					b: m.b,
					c: m.c,
					d: m.d,
					tx: m.tx,
					ty: m.ty
				};
				return;
			}
		} catch {
			return;
		};
		const rotation = finite(go.rotation), sx = finite(go.scaleX, 1), sy = finite(go.scaleY, 1), cos = Math.cos(rotation), sin = Math.sin(rotation);
		if (go.parentContainer) return;
		return {
			a: cos * sx,
			b: sin * sx,
			c: -sin * sy,
			d: cos * sy,
			tx: finite(go.x),
			ty: finite(go.y)
		};
	};
	const local = (m, x, y) => {
		const determinant = m.a * m.d - m.b * m.c;
		if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-9) return;
		const dx = x - m.tx, dy = y - m.ty;
		return {
			x: (m.d * dx - m.c * dy) / determinant,
			y: (m.a * dy - m.b * dx) / determinant
		};
	};
	const keyDown = (key) => !!host.isKeyDown(key);
	const load = (region, saved) => {
		region.enabled = saved.enabled;
		region.fired = new Set(saved.fired);
		region.inside = new Map(saved.inside.map((visit) => [visit.id, {
			elapsed: visit.elapsed,
			fired: new Set(visit.fired)
		}]));
	};
	const bind = (def, go) => {
		if (disposed || !def.interaction || !go) return;
		const previous = regions.get(def.id);
		if (previous && previous.go === go) {
			previous.def = def;
			return;
		};
		const region = {
			def,
			go,
			enabled: def.interaction.enabled,
			inside: new Map(),
			fired: new Set()
		};
		regions.set(def.id, region);
		const saved = pending.get(def.id);
		if (saved) {
			load(region, saved);
			pending.delete(def.id);
		};
		const key = def.interaction.key;
		if (!keys.has(key)) keys.set(key, keyDown(key));
	};
	const emit = (region, trigger, otherId, visit) => {
		if (!region.enabled || !usable(region.go) || regions.get(region.def.id) !== region) return;
		const repeat = region.def.interaction?.repeat ?? "always";
		if (repeat === "once" && region.fired.has(trigger) || repeat === "reenter" && visit.fired.has(trigger)) return;
		region.fired.add(trigger);
		visit.fired.add(trigger);
		host.fire(region.def.id, trigger, otherId);
	};
	const update = (delta) => {
		if (disposed) return;
		const entries = host.actors().slice(), live = new Set();
		for (const entry of entries) if (entry.def.interaction && entry.go?.active !== false) {
			bind(entry.def, entry.go);
			live.add(entry.def.id);
		};
		for (const id of regions.keys()) if (!live.has(id)) regions.delete(id);
		const pressed = new Set();
		for (const key of new Set([...keys.keys(), ...[...regions.values()].map((region) => region.def.interaction.key)])) {
			const down = keyDown(key);
			if (down && keys.get(key) === false) pressed.add(key);
			keys.set(key, down);
		};
		const choices = new Map();
		for (const region of [...regions.values()]) {
			const settings = region.def.interaction;
			if (!region.enabled || !usable(region.go)) {
				region.inside.clear();
				continue;
			};
			const area = settings.sizeMode === "object" && settings.areaObjectId ? entries.find((entry) => entry.def.id === settings.areaObjectId) : {
				def: region.def,
				go: region.go
			}, areaGo = area && anchor(area.go);
			let m = area && usable(area.go) ? matrix(area.go) : undefined;
			if (!area || !m) {
				for (const [id, visit] of region.inside) emit(region, "exit", id, visit);
				region.inside.clear();
				continue;
			};
			const objectSize = settings.sizeMode === "object", nativeWidth = finite(areaGo?.width, area.def.width), nativeHeight = finite(areaGo?.height, area.def.height), width = objectSize ? nativeWidth : settings.width, height = objectSize ? nativeHeight : settings.height, baseX = objectSize ? 1 : finite(areaGo?.getData?.("forgeScaleX"), area.def.kind === "sprite" && nativeWidth > 0 ? area.def.width / nativeWidth : 1), baseY = objectSize ? 1 : finite(areaGo?.getData?.("forgeScaleY"), area.def.kind === "sprite" && nativeHeight > 0 ? area.def.height / nativeHeight : 1);
			if (!objectSize) {
				if (Math.abs(baseX) < 1e-9 || Math.abs(baseY) < 1e-9) continue;
				m = {
					...m,
					a: m.a / baseX,
					b: m.b / baseX,
					c: m.c / baseY,
					d: m.d / baseY
				};
			};
			const offsetX = settings.offsetX + (.5 - finite(areaGo?.originX, .5)) * nativeWidth * baseX, offsetY = settings.offsetY + (.5 - finite(areaGo?.originY, .5)) * nativeHeight * baseY, round = objectSize ? area.def.kind === "ellipse" : settings.shape === "circle", rx = objectSize ? width / 2 : settings.radius, ry = objectSize ? height / 2 : settings.radius, inside = new Set(), center = {
				x: m.tx + m.a * offsetX + m.c * offsetY,
				y: m.ty + m.b * offsetX + m.d * offsetY
			};
			for (const entry of entries) {
				if (entry.def.id === region.def.id || !usable(entry.go) || (settings.target === "objects" ? !settings.targetIds.includes(entry.def.id) : entry.def.fixed || !["platformer", "topdown"].includes(entry.def.behavior))) continue;
				if (settings.relation && settings.relation !== "all" && (host.relation?.(region.def.id, entry.def.id) ?? "neutral") !== settings.relation) continue;
				const target = matrix(entry.go);
				if (!target) continue;
				const targetGo = anchor(entry.go), cx = (.5 - finite(targetGo?.originX, .5)) * finite(targetGo?.width, entry.def.width), cy = (.5 - finite(targetGo?.originY, .5)) * finite(targetGo?.height, entry.def.height), worldX = target.tx + target.a * cx + target.c * cy, worldY = target.ty + target.b * cx + target.d * cy;
				const at = local(m, worldX, worldY);
				if (!at) continue;
				const dx = at.x - offsetX, dy = at.y - offsetY;
				if (round ? rx <= 0 || ry <= 0 || (dx / rx) ** 2 + (dy / ry) ** 2 > 1 : width <= 0 || height <= 0 || Math.abs(dx) > width / 2 || Math.abs(dy) > height / 2) continue;
				inside.add(entry.def.id);
				let visit = region.inside.get(entry.def.id);
				if (!visit) {
					visit = {
						elapsed: 0,
						fired: new Set()
					};
					region.inside.set(entry.def.id, visit);
					emit(region, "enter", entry.def.id, visit);
				} else {
					visit.elapsed += Math.max(0, Math.min(36e5, finite(delta)));
					if (visit.elapsed >= settings.stayInterval) {
						visit.elapsed %= settings.stayInterval;
						emit(region, "stay", entry.def.id, visit);
					}
				};
				if (!region.enabled || !usable(region.go) || region.inside.get(entry.def.id) !== visit) continue;
				const distance = Math.hypot(worldX - center.x, worldY - center.y), key = settings.key;
				if (pressed.has(key) && distance <= settings.interactDistance && region.def.events?.some((event) => event.enabled !== false && event.trigger === "interact" && (!event.otherObjectId || event.otherObjectId === entry.def.id))) {
					const repeat = settings.repeat ?? "always";
					if (repeat === "once" && region.fired.has("interact") || repeat === "reenter" && visit.fired.has("interact")) continue;
					const previous = choices.get(key), tie = region.def.id + "\0" + entry.def.id;
					if (!previous || distance < previous.distance || distance === previous.distance && tie < previous.region.def.id + "\0" + previous.otherId) choices.set(key, {
						region,
						otherId: entry.def.id,
						visit,
						distance
					});
				}
			};
			for (const [id, visit] of region.inside) if (!inside.has(id)) {
				region.inside.delete(id);
				emit(region, "exit", id, visit);
			}
		};
		for (const { region, otherId, visit } of choices.values()) if (region.inside.get(otherId) === visit) emit(region, "interact", otherId, visit);
	};
	const command = (name, id, value) => {
		if (disposed) return false;
		if (!regions.has(id)) {
			const entry = host.actors().find((entry) => entry.def.id === id);
			if (entry) bind(entry.def, entry.go);
		};
		const region = regions.get(id);
		if (!region) return false;
		if (name === "reset") {
			region.inside.clear();
			region.fired.clear();
			for (const key of keys.keys()) keys.set(key, keyDown(key));
			return true;
		};
		if (![
			"enable",
			"disable",
			"toggle"
		].includes(name)) return false;
		region.enabled = name === "toggle" ? !region.enabled : name === "disable" ? false : value === undefined ? true : value === true || value === 1 || value === "true" || value === "1";
		if (!region.enabled) region.inside.clear();
		return true;
	};
	const snapshot = () => ({
		version: 1,
		regions: [...[...regions.values()].map((region) => ({
			id: region.def.id,
			enabled: region.enabled,
			fired: [...region.fired],
			inside: [...region.inside].map(([id, visit]) => ({
				id,
				elapsed: visit.elapsed,
				fired: [...visit.fired]
			}))
		})), ...[...pending.values()].map((saved) => ({
			...saved,
			fired: saved.fired.slice(),
			inside: saved.inside.map((visit) => ({
				...visit,
				fired: visit.fired.slice()
			}))
		}))]
	});
	const restore = (value) => {
		if (disposed || !value || typeof value !== "object") return false;
		const input = value;
		if (input.version !== 1 || !Array.isArray(input.regions) || input.regions.length > 1e4) return false;
		const validId = (id) => typeof id === "string" && id.length > 0 && id.length <= 200, validFired = (value) => Array.isArray(value) && value.length <= 4 && value.every((trigger) => triggers.includes(trigger)) && new Set(value).size === value.length;
		const ids = new Set();
		let visits = 0;
		for (const region of input.regions) {
			if (!region || !validId(region.id) || ids.has(region.id) || typeof region.enabled !== "boolean" || !validFired(region.fired) || !Array.isArray(region.inside) || (visits += region.inside.length) > 5e4) return false;
			ids.add(region.id);
			const otherIds = new Set();
			for (const visit of region.inside) {
				if (!visit || !validId(visit.id) || otherIds.has(visit.id) || typeof visit.elapsed !== "number" || !Number.isFinite(visit.elapsed) || visit.elapsed < 0 || visit.elapsed > 36e5 || !validFired(visit.fired)) return false;
				otherIds.add(visit.id);
			}
		};
		pending.clear();
		for (const region of regions.values()) {
			region.inside.clear();
			region.fired.clear();
			region.enabled = region.def.interaction?.enabled ?? false;
		};
		for (const saved of input.regions) {
			const copy = {
				id: saved.id,
				enabled: saved.enabled,
				fired: saved.fired.slice(),
				inside: saved.inside.map((visit) => ({
					...visit,
					fired: visit.fired.slice()
				}))
			};
			const region = regions.get(copy.id);
			if (region) load(region, copy);
			else pending.set(copy.id, copy);
		};
		for (const key of keys.keys()) keys.set(key, keyDown(key));
		return true;
	};
	return {
		bind,
		update,
		command,
		snapshot,
		restore,
		dispose: () => {
			disposed = true;
			regions.clear();
			pending.clear();
			keys.clear();
		}
	};
},function createParticleRuntime(Phaser) {
	const entries = new Map();
	let disposed = false;
	const range = (min, max) => min === max ? min : {
		min,
		max
	};
	const fade = (start, end) => start === end ? start : {
		start,
		end
	};
	function config(settings, frame) {
		// maxParticles는 비활성 풀까지 세므로 재사용을 막는다. 동시 활성 상한만으로 풀 크기를 제한한다.
		const value = {
			emitting: false,
			frequency: settings.mode === "burst" ? -1 : settings.frequency,
			quantity: settings.quantity,
			maxAliveParticles: settings.maxAlive,
			maxParticles: 0,
			lifespan: range(settings.lifespanMin, settings.lifespanMax),
			speed: range(settings.speedMin, settings.speedMax),
			angle: range(settings.angleMin, settings.angleMax),
			gravityX: settings.gravityX,
			gravityY: settings.gravityY,
			alpha: fade(settings.alphaStart, settings.alphaEnd),
			scaleX: fade(settings.scaleStart * settings.stretchX, settings.scaleEnd * settings.stretchX),
			scaleY: fade(settings.scaleStart * settings.stretchY, settings.scaleEnd * settings.stretchY),
			rotate: fade(settings.rotationStart, settings.rotationEnd),
			color: [parseInt(settings.colorStart.slice(1), 16), parseInt(settings.colorEnd.slice(1), 16)],
			blendMode: settings.blendMode
		};
		if (frame !== undefined) value.frame = frame;
		if (settings.zone === "rectangle") value.emitZone = {
			type: "random",
			source: new Phaser.Geom.Rectangle(-settings.zoneWidth / 2, -settings.zoneHeight / 2, settings.zoneWidth, settings.zoneHeight)
		};
		else if (settings.zone === "circle") value.emitZone = {
			type: "random",
			source: new Phaser.Geom.Circle(0, 0, settings.zoneRadius)
		};
		return value;
	}
	function remove(id) {
		const entry = entries.get(id);
		if (!entry) return false;
		entry.emitter.off?.("destroy", entry.destroy);
		entries.delete(id);
		return true;
	}
	function find(id) {
		const entry = entries.get(id);
		if (!entry || entry.emitter.isDestroyed) {
			if (entry) remove(id);
			return undefined;
		};
		return entry;
	}
	function command(id, operation, count) {
		if (disposed) return false;
		const entry = find(id);
		if (!entry) return false;
		const emitter = entry.emitter, mode = entry.settings?.mode ?? "continuous";
		if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 500)) throw Error("한 번 방출할 수량은 1~500의 정수여야 합니다.");
		if (operation === "off") {
			entry.enabled = false;
			emitter.stop(false);
			return true;
		};
		if (![
			"on",
			"explode",
			"restart"
		].includes(operation)) throw Error("지원하지 않는 파티클 명령입니다.");
		if (operation === "on" && entry.enabled && (mode === "burst" || emitter.emitting && emitter.frequency >= 0)) return true;
		if (operation === "restart") {
			emitter.stop(false);
			emitter.killAll();
		};
		entry.enabled = true;
		if (operation === "explode" || mode === "burst") {
			emitter.explode(count ?? entry.quantity);
			emitter.stop(false);
		} else emitter.flow(entry.frequency, entry.quantity);
		return true;
	}
	function register(id, emitter, settings, activate = true) {
		if (disposed || !id || !emitter || emitter.isDestroyed) return false;
		const previous = entries.get(id);
		if (previous) {
			if (previous.emitter === emitter) return true;
			previous.emitter.stop(false);
			previous.emitter.killAll();
			remove(id);
		};
		const entry = {
			emitter,
			settings: settings ? { ...settings } : undefined,
			frequency: settings?.frequency ?? Math.max(0, emitter.frequency ?? 100),
			quantity: settings?.quantity ?? Math.max(1, Number(emitter.quantity) || 1),
			enabled: settings ? false : !!emitter.emitting,
			destroy: () => {
				if (entries.get(id) === entry) remove(id);
			}
		};
		entries.set(id, entry);
		emitter.once?.("destroy", entry.destroy);
		if (settings && activate && settings.emitting) command(id, "on");
		return true;
	}
	function snapshot() {
		return {
			version: 1,
			emitters: [...entries.keys()].flatMap((id) => {
				const entry = find(id);
				return entry ? [{
					id,
					mode: entry.emitter.frequency < 0 ? "burst" : "continuous",
					emitting: entry.emitter.frequency < 0 ? entry.enabled : !!entry.emitter.emitting
				}] : [];
			})
		};
	}
	function restore(value) {
		if (disposed || !value || typeof value !== "object") return false;
		const data = value;
		if (data.version !== 1 || !Array.isArray(data.emitters) || data.emitters.length > 5e3) return false;
		const ids = new Set();
		for (const row of data.emitters) {
			if (!row || typeof row.id !== "string" || row.id.length > 200 || ids.has(row.id) || !["continuous", "burst"].includes(row.mode) || typeof row.emitting !== "boolean") return false;
			ids.add(row.id);
		};
		for (const row of data.emitters) {
			const entry = find(row.id);
			if (!entry) continue;
			const emitter = entry.emitter;
			emitter.stop(false);
			emitter.killAll();
			entry.enabled = row.emitting;
			emitter.setFrequency(row.mode === "burst" ? -1 : entry.frequency, entry.quantity);
			if (row.emitting && row.mode === "continuous") emitter.start();
		};
		return true;
	}
	function dispose() {
		if (disposed) return;
		disposed = true;
		for (const [id, entry] of entries) {
			if (!entry.emitter.isDestroyed) {
				entry.emitter.stop(false);
				entry.emitter.killAll();
			};
			remove(id);
		}
	}
	return {
		config,
		register,
		command,
		snapshot,
		restore,
		remove,
		dispose
	};
},function createMotionPathRuntime(scene, actors, report = () => {}) {
	const records = new Map(), warnings = new Set();
	let disposed = false;
	const warn = (id, message) => {
		const key = id + ":" + message;
		if (!warnings.has(key)) {
			warnings.add(key);
			report(message);
		}
	};
	const conflict = (o) => {
		if (o.physics === "static") return "고정 물리는 이동 경로를 지원하지 않습니다. 동적 물리나 물리 없음을 선택하세요.";
		if (o.gameUi?.enabled) return "게임 UI의 위치 맞춤과 이동 경로를 함께 사용할 수 없습니다.";
		if (o.gameplay?.agent?.enabled) return "AI 이동과 이동 경로를 함께 사용할 수 없습니다.";
		if ([
			"platformer",
			"topdown",
			"patrol",
			"float"
		].includes(o.behavior)) return "기본 이동 동작과 이동 경로를 함께 사용할 수 없습니다.";
		if (o.tween === "float" || o.motionPath?.rotateToPath && (o.tween === "spin" || o.behavior === "rotate")) return "위치·회전 효과와 이동 경로가 충돌합니다.";
		return "";
	};
	const sample = (points, smooth, t) => {
		const scaled = Math.max(0, Math.min(1, t)) * (points.length - 1), i = Math.min(points.length - 2, Math.floor(scaled)), u = scaled - i, b = points[i], c = points[i + 1];
		if (!smooth) return {
			x: b.x + (c.x - b.x) * u,
			y: b.y + (c.y - b.y) * u
		};
		const a = points[Math.max(0, i - 1)], d = points[Math.min(points.length - 1, i + 2)], u2 = u * u, u3 = u2 * u;
		const axis = (key) => .5 * (2 * b[key] + (-a[key] + c[key]) * u + (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * u2 + (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * u3);
		return {
			x: axis("x"),
			y: axis("y")
		};
	};
	const ease = (r, t) => r.settings.ease === "sineInOut" ? (1 - Math.cos(Math.PI * t)) / 2 : r.settings.ease === "quadInOut" ? t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t) : r.settings.ease === "cubicInOut" ? t < .5 ? 4 * t * t * t : 1 - 4 * (1 - t) * (1 - t) * (1 - t) : t;
	const at = (r, progress) => {
		const distance = Math.max(0, Math.min(1, progress)) * r.length, table = r.table;
		let lo = 0, hi = table.length - 1;
		while (lo + 1 < hi) {
			const middle = lo + hi >> 1;
			if (table[middle].distance < distance) lo = middle;
			else hi = middle;
		};
		const a = table[lo], b = table[hi], ratio = b.distance > a.distance ? (distance - a.distance) / (b.distance - a.distance) : 0;
		return sample(r.settings.points, r.settings.interpolation === "smooth", a.t + (b.t - a.t) * ratio);
	};
	const acquire = (r) => {
		if (r.held) return;
		r.held = true;
		r.node.setData?.("forgeMotionPath", true);
		const body = r.node.body;
		if (body?.setDirectControl) {
			r.body = {
				direct: body.directControl,
				gravity: body.allowGravity,
				vx: body.velocity?.x ?? 0,
				vy: body.velocity?.y ?? 0,
				ax: body.acceleration?.x ?? 0,
				ay: body.acceleration?.y ?? 0
			};
			body.setDirectControl(true);
			body.setAllowGravity?.(false);
			body.setAcceleration?.(0, 0);
			body.setVelocity?.(0, 0);
		}
	};
	const release = (r) => {
		r.held = false;
		if (!r.node.isDestroyed && r.node.scene) r.node.setData?.("forgeMotionPath", false);
		const body = r.node.body;
		if (body && r.body) {
			body.setDirectControl?.(r.body.direct);
			body.setAllowGravity?.(r.body.gravity);
			body.setAcceleration?.(r.body.ax, r.body.ay);
			body.setVelocity?.(r.body.vx, r.body.vy);
		};
		r.body = undefined;
	};
	const apply = (r) => {
		const p = at(r, ease(r, r.progress)), origin = r.settings.relative ? r.origin : {
			x: 0,
			y: 0
		};
		r.node.x = origin.x + p.x;
		r.node.y = origin.y + p.y;
		if (r.settings.rotateToPath) {
			const a = at(r, Math.max(0, ease(r, r.progress) - 1e-4)), b = at(r, Math.min(1, ease(r, r.progress) + 1e-4));
			if (Math.hypot(b.x - a.x, b.y - a.y) > 1e-6) r.node.angle = Math.atan2((b.y - a.y) * r.direction, (b.x - a.x) * r.direction) * 180 / Math.PI + r.settings.rotationOffset;
		}
	};
	const teleport = (r) => {
		apply(r);
		const body = r.node.body;
		if (body?.reset) {
			body.reset(r.node.x, r.node.y);
			body.updateFromGameObject?.();
			for (const key of [
				"prev",
				"prevFrame",
				"autoFrame"
			]) body[key]?.copy?.(body.position);
		}
	};
	const bind = (def, go) => {
		if (disposed || !def.motionPath?.enabled || !go || records.has(def.id)) return false;
		const settings = def.motionPath, issue = conflict(def), node = go.getData?.("forgeAnchor") ?? go;
		if (issue) {
			warn(def.id, `${def.name}: ${issue}`);
			return false;
		};
		if (node.body && !node.body.setDirectControl) {
			warn(def.id, `${def.name}: 이 물리 방식은 이동 경로를 지원하지 않습니다.`);
			return false;
		};
		if (def.kind === "group" && actors().some((a) => a.go !== go && a.go.body && (() => {
			for (let p = a.go.parentContainer; p; p = p.parentContainer) if (p === go) return true;
			return false;
		})())) {
			warn(def.id, `${def.name}: 물리 자식이 있는 그룹 대신 움직일 물체에 경로를 연결하세요.`);
			return false;
		};
		if (settings.points.length < 2 || settings.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) || !Number.isFinite(settings.duration) || settings.duration < 16) {
			warn(def.id, `${def.name}: 이동 경로의 점과 시간을 확인하세요.`);
			return false;
		};
		const r = {
			def,
			go,
			node,
			settings,
			origin: {
				x: node.x,
				y: node.y
			},
			progress: 0,
			direction: 1,
			leg: 0,
			playing: settings.autoStart,
			held: false,
			length: 0,
			table: [{
				distance: 0,
				t: 0
			}]
		};
		const count = (settings.points.length - 1) * (settings.interpolation === "smooth" ? 32 : 1);
		let previous = sample(settings.points, settings.interpolation === "smooth", 0);
		for (let i = 1; i <= count; i++) {
			const t = i / count, p = sample(settings.points, settings.interpolation === "smooth", t);
			r.length += Math.hypot(p.x - previous.x, p.y - previous.y);
			r.table.push({
				distance: r.length,
				t
			});
			previous = p;
		};
		if (r.length < 1e-6) {
			warn(def.id, `${def.name}: 서로 다른 위치의 경로점이 필요합니다.`);
			return false;
		};
		records.set(def.id, r);
		if (settings.autoStart) {
			acquire(r);
			apply(r);
		};
		return true;
	};
	const advance = (r, delta) => {
		let travel = delta / r.settings.duration;
		if (r.settings.loop) {
			if (r.settings.yoyo) {
				const phase = ((r.direction === 1 ? r.progress : 2 - r.progress) + travel) % 2;
				r.progress = phase <= 1 ? phase : 2 - phase;
				r.direction = phase < 1 ? 1 : -1;
			} else r.progress = ((r.progress + r.direction * travel) % 1 + 1) % 1;
			return;
		};
		const edge = r.direction === 1 ? 1 : 0, distance = Math.abs(edge - r.progress);
		if (travel < distance) {
			r.progress += r.direction * travel;
			return;
		};
		r.progress = edge;
		travel -= distance;
		if (r.settings.yoyo && r.leg === 0) {
			r.leg = 1;
			r.direction = r.direction === 1 ? -1 : 1;
			if (travel < 1) r.progress += r.direction * travel;
			else {
				r.progress = r.direction === 1 ? 1 : 0;
				r.playing = false;
			}
		} else r.playing = false;
	};
	const update = (_time, delta) => {
		if (disposed) return;
		for (const [id, r] of records) {
			if (!r.go.scene || r.go.isDestroyed) {
				release(r);
				records.delete(id);
				continue;
			};
			if (r.go.active === false || !r.held) continue;
			if (r.playing && !r.go.getData?.("gameplayBlocked")) advance(r, Math.max(0, Number.isFinite(delta) ? delta : 0));
			apply(r);
		}
	};
	const command = (targetId, action, value) => {
		const r = records.get(targetId);
		if (!r) throw Error("대상에 사용 가능한 이동 경로가 없습니다.");
		if (action === "stop") {
			r.playing = false;
			r.progress = 0;
			r.direction = 1;
			r.leg = 0;
			teleport(r);
			release(r);
			return true;
		};
		if (action === "seek") {
			if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw Error("경로 위치는 0~1 사이의 숫자여야 합니다.");
			acquire(r);
			r.progress = value;
			r.playing = false;
			r.leg = 0;
			teleport(r);
			return true;
		};
		if (action === "pause") {
			if (r.held) r.playing = false;
			return true;
		};
		if (![
			"play",
			"restart",
			"reverse"
		].includes(action)) throw Error("지원하지 않는 이동 경로 명령입니다.");
		acquire(r);
		if (action === "restart") {
			r.progress = 0;
			r.direction = 1;
			r.leg = 0;
		} else if (action === "reverse") {
			r.direction = r.direction === 1 ? -1 : 1;
			r.leg = 0;
			if (r.direction === -1 && r.progress === 0) r.progress = 1;
			else if (r.direction === 1 && r.progress === 1) r.progress = 0;
		} else if (!r.playing && (r.direction === 1 && r.progress === 1 || r.direction === -1 && r.progress === 0)) {
			r.progress = r.direction === 1 ? 0 : 1;
			r.leg = 0;
		};
		r.playing = true;
		teleport(r);
		return true;
	};
	const snapshot = () => Object.fromEntries([...records].map(([id, r]) => [id, {
		progress: r.progress,
		direction: r.direction,
		leg: r.leg,
		playing: r.playing,
		held: r.held,
		origin: { ...r.origin }
	}]));
	const restore = (data) => {
		if (!data || typeof data !== "object") return;
		for (const [id, r] of records) {
			const s = data[id];
			if (!s || !Number.isFinite(s.progress) || s.progress < 0 || s.progress > 1 || ![1, -1].includes(s.direction) || ![0, 1].includes(s.leg) || typeof s.playing !== "boolean" || typeof s.held !== "boolean" || !Number.isFinite(s.origin?.x) || !Number.isFinite(s.origin?.y)) continue;
			r.progress = s.progress;
			r.direction = s.direction;
			r.leg = s.leg;
			r.playing = s.playing;
			r.origin = {
				x: s.origin.x,
				y: s.origin.y
			};
			if (s.held) {
				acquire(r);
				teleport(r);
			} else release(r);
		}
	};
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		scene.events?.off("preupdate", update);
		for (const r of records.values()) release(r);
		records.clear();
	};
	for (const actor of actors()) bind(actor.def, actor.go);
	scene.events?.on("preupdate", update);
	scene.events?.once("shutdown", dispose);
	return {
		bind,
		update,
		command,
		snapshot,
		restore,
		dispose,
		isDriving: (id) => !!records.get(id)?.held
	};
},function createCollisionRuntime(project, actors, error = () => {}) {
	const bits = new Map(["default", ...project.collisionGroups?.map((g) => g.id) ?? []].map((id, index) => [id, 1 << index]));
	const records = new Map(), tileSides = new WeakMap();
	const defaults = {
		enabled: true,
		category: "default",
		sensor: false,
		left: true,
		right: true,
		up: true,
		down: true
	};
	const apply = (record) => {
		const c = record.settings, target = record.go.body ?? record.go;
		target.collisionCategory = bits.get(c.category) ?? 1;
		target.collisionMask = !c.enabled ? 0 : c.mask === undefined ? -1 : c.mask.reduce((mask, id) => mask | (bits.get(id) ?? 0), 0);
		if (target.checkCollision) {
			target.checkCollision.none = !c.enabled;
			for (const side of [
				"left",
				"right",
				"up",
				"down"
			]) target.checkCollision[side] = c.enabled && c[side];
		} else if (record.go.forEachTile) {
			const signature = [
				c.left,
				c.right,
				c.up,
				c.down
			].join(",");
			if (signature !== record.layerDirections && (record.layerDirections !== undefined || ![
				c.left,
				c.right,
				c.up,
				c.down
			].every(Boolean))) {
				record.go.forEachTile((tile) => {
					if (!tile?.setCollision) return;
					let base = tileSides.get(tile);
					if (!base) {
						base = {
							left: !!tile.collideLeft,
							right: !!tile.collideRight,
							up: !!tile.collideUp,
							down: !!tile.collideDown
						};
						tileSides.set(tile, base);
					};
					tile.setCollision(base.left && c.left, base.right && c.right, base.up && c.up, base.down && c.down, false);
				});
				record.go.calculateFacesWithin?.();
			};
			record.layerDirections = signature;
		}
	};
	const bind = (def, go) => {
		if (!go || !go.body && def.kind !== "tilemap") return;
		const previous = records.get(def.id);
		if (previous && previous.go === go) {
			apply(previous);
			return;
		};
		const record = {
			go,
			settings: {
				...defaults,
				...def.collision,
				mask: def.collision?.mask?.slice()
			}
		};
		records.set(def.id, record);
		go.once?.("destroy", () => {
			if (records.get(def.id) === record) records.delete(def.id);
		});
		apply(record);
	};
	const recordFor = (value) => {
		const go = value?.gameObject ?? value?.tilemapLayer ?? value?.layer?.tilemapLayer ?? value;
		return records.get(go?.getData?.("forgeObjectId") ?? go?.getData?.("forgeId"));
	};
	const canSeparate = (a, b) => {
		const one = recordFor(a), two = recordFor(b);
		return !one?.settings.sensor && !two?.settings.sensor;
	};
	const command = (id, action, value) => {
		const record = records.get(id);
		if (!record) throw Error("충돌을 제어할 물리 오브젝트가 없습니다.");
		const c = record.settings;
		if (action === "enable" || action === "disable") c.enabled = action === "enable";
		else if (action === "sensor") {
			if (typeof value !== "boolean" && !["true", "false"].includes(String(value))) throw Error("통과 설정은 참거짓이어야 합니다.");
			c.sensor = value === true || value === "true";
		} else if (action === "category") {
			if (!bits.has(String(value))) throw Error("변경할 충돌 분류가 없습니다.");
			c.category = String(value);
		} else throw Error("지원하지 않는 충돌 명령입니다.");
		apply(record);
		return true;
	};
	const snapshot = () => ({
		version: 1,
		objects: [...records].filter(([, r]) => r.go.active).map(([id, r]) => ({
			id,
			...r.settings,
			mask: r.settings.mask?.slice()
		}))
	});
	const restore = (data) => {
		if (!data || data.version !== 1 || !Array.isArray(data.objects) || data.objects.length > 2e4) return false;
		const pending = [];
		for (const row of data.objects) {
			if (!row || typeof row.id !== "string" || !bits.has(row.category) || [
				"enabled",
				"sensor",
				"left",
				"right",
				"up",
				"down"
			].some((k) => typeof row[k] !== "boolean") || row.mask !== undefined && (!Array.isArray(row.mask) || row.mask.length > 32 || row.mask.some((id) => typeof id !== "string" || !bits.has(id)))) return false;
			const record = records.get(row.id);
			if (record) pending.push({
				record,
				settings: {
					enabled: row.enabled,
					sensor: row.sensor,
					category: row.category,
					left: row.left,
					right: row.right,
					up: row.up,
					down: row.down,
					mask: row.mask?.slice()
				}
			});
		};
		for (const { record, settings } of pending) {
			record.settings = settings;
			apply(record);
		};
		return true;
	};
	const dispose = () => records.clear();
	for (const actor of actors()) bind(actor.def, actor.go);
	return {
		bind,
		canSeparate,
		command,
		snapshot,
		restore,
		dispose
	};
},function createFactionRuntime(settings, host) {
	const names = new Map((settings?.factions ?? []).map((f) => [f.id, f.name])), relations = new Map(), hostile = new Map(), teams = new Map(), objects = new Map();
	let defaultRelation = settings?.defaultRelation ?? "hostile", enemyOfEnemy = settings?.enemyOfEnemy ?? false, disposed = false, revision = 0;
	const validId = (value) => typeof value === "string" && value.length <= 200;
	const validRelation = (value) => value === "friendly" || value === "neutral" || value === "hostile";
	const key = (from, to) => JSON.stringify([from, to]);
	const indexRelation = (row) => {
		const old = relations.get(key(row.from, row.to));
		if (old?.relation === "hostile") hostile.get(old.from)?.delete(old.to);
		relations.set(key(row.from, row.to), { ...row });
		if (row.relation === "hostile") {
			let targets = hostile.get(row.from);
			if (!targets) {
				targets = new Set();
				hostile.set(row.from, targets);
			};
			targets.add(row.to);
		}
	};
	for (const row of settings?.relations ?? []) indexRelation(row);
	const publish = (entry) => {
		if (entry.go?.isDestroyed) return;
		const team = teams.get(entry.def.id) ?? entry.def.gameplay?.faction ?? entry.def.gameplay?.combat?.team ?? "";
		if (entry.go?.getData?.("faction") !== team) entry.go?.setData?.("faction", team);
		if (entry.go?.getData?.("team") !== team) entry.go?.setData?.("team", team);
	};
	const alive = (entry) => !!entry?.go && !entry.go.isDestroyed && entry.go.active !== false;
	const refresh = () => {
		if (disposed) return;
		const current = new Set();
		for (const entry of host.actors()) if (alive(entry)) {
			current.add(entry.def.id);
			objects.set(entry.def.id, entry);
			publish(entry);
		};
		for (const id of objects.keys()) if (!current.has(id)) objects.delete(id);
	};
	const object = (id) => {
		let entry = objects.get(id);
		if (!alive(entry)) {
			refresh();
			entry = objects.get(id);
		};
		return alive(entry) ? entry : undefined;
	};
	const team = (id) => {
		const entry = object(id);
		if (!entry) return "";
		publish(entry);
		return teams.get(id) ?? entry.def.gameplay?.faction ?? entry.def.gameplay?.combat?.team ?? "";
	};
	const relation = (from, to) => {
		const explicit = relations.get(key(from, to));
		if (explicit) return explicit.relation;
		if (from === to) return "friendly";
		if (enemyOfEnemy) {
			for (const via of hostile.get(from) ?? []) if (hostile.get(via)?.has(to)) return "friendly";
		};
		return defaultRelation;
	};
	const setTeam = (id, value) => {
		if (disposed) throw Error("진영 서비스가 종료됐습니다.");
		if (!validId(value)) throw Error("진영 ID는 200자 이내 문자열이어야 합니다.");
		const entry = object(id);
		if (!entry || entry.go?.isDestroyed) throw Error("진영을 바꿀 오브젝트가 없습니다.");
		if (!teams.has(id) && teams.size >= 5e3) throw Error("변경할 진영 대상이 너무 많습니다.");
		if (team(id) !== value) revision++;
		teams.set(id, value);
		publish(entry);
		return true;
	};
	const setRelation = (from, to, value, bidirectional = false) => {
		if (disposed) throw Error("진영 서비스가 종료됐습니다.");
		if (!validId(from) || !validId(to) || !validRelation(value)) throw Error("진영과 관계 값을 확인하세요.");
		const additions = (!relations.has(key(from, to)) ? 1 : 0) + (bidirectional && from !== to && !relations.has(key(to, from)) ? 1 : 0);
		if (relations.size + additions > 4096) throw Error("진영 관계는 최대 4096개입니다.");
		const changed = relations.get(key(from, to))?.relation !== value || bidirectional && relations.get(key(to, from))?.relation !== value;
		indexRelation({
			from,
			to,
			relation: value
		});
		if (bidirectional) indexRelation({
			from: to,
			to: from,
			relation: value
		});
		if (changed) revision++;
		return true;
	};
	const clearRelation = (from, to, bidirectional = false) => {
		let changed = false;
		for (const [a, b] of bidirectional ? [[from, to], [to, from]] : [[from, to]]) {
			hostile.get(a)?.delete(b);
			changed = relations.delete(key(a, b)) || changed;
		};
		if (changed) revision++;
		return true;
	};
	const setDefault = (value) => {
		if (!validRelation(value)) throw Error("기본 진영 관계를 확인하세요.");
		if (defaultRelation !== value) revision++;
		defaultRelation = value;
		return true;
	};
	const setEnemyOfEnemy = (value) => {
		if (typeof value !== "boolean") throw Error("적의 적 규칙은 켜기 또는 끄기 값이어야 합니다.");
		if (enemyOfEnemy !== value) revision++;
		enemyOfEnemy = value;
		return true;
	};
	const snapshot = () => ({
		version: 1,
		defaultRelation,
		enemyOfEnemy,
		relations: [...relations.values()].map((r) => ({ ...r })),
		teams: [...teams].map(([objectId, team]) => ({
			objectId,
			team
		}))
	});
	const restore = (value) => {
		if (!value || value.version !== 1 || !validRelation(value.defaultRelation) || typeof value.enemyOfEnemy !== "boolean" || !Array.isArray(value.relations) || value.relations.length > 4096 || !Array.isArray(value.teams) || value.teams.length > 5e3) return false;
		const nextRelations = new Map(), nextTeams = new Map();
		for (const row of value.relations) {
			if (!row || !validId(row.from) || !validId(row.to) || !validRelation(row.relation) || nextRelations.has(key(row.from, row.to))) return false;
			nextRelations.set(key(row.from, row.to), {
				from: row.from,
				to: row.to,
				relation: row.relation
			});
		};
		for (const row of value.teams) {
			if (!row || !validId(row.objectId) || !row.objectId || !validId(row.team) || nextTeams.has(row.objectId)) return false;
			nextTeams.set(row.objectId, row.team);
		};
		relations.clear();
		hostile.clear();
		for (const row of nextRelations.values()) indexRelation(row);
		teams.clear();
		for (const [id, value] of nextTeams) teams.set(id, value);
		defaultRelation = value.defaultRelation;
		enemyOfEnemy = value.enemyOfEnemy;
		revision++;
		refresh();
		return true;
	};
	const inspect = () => {
		refresh();
		const factions = new Map(names);
		for (const entry of objects.values()) {
			const value = team(entry.def.id);
			if (!factions.has(value)) factions.set(value, value || "미지정");
		};
		for (const r of relations.values()) {
			if (!factions.has(r.from)) factions.set(r.from, r.from || "미지정");
			if (!factions.has(r.to)) factions.set(r.to, r.to || "미지정");
		};
		return {
			factions: [...factions].map(([id, name]) => ({
				id,
				name,
				registered: names.has(id)
			})),
			...snapshot()
		};
	};
	const dispose = () => {
		disposed = true;
		objects.clear();
		teams.clear();
		relations.clear();
		hostile.clear();
	};
	refresh();
	return {
		relation,
		team,
		setTeam,
		setRelation,
		clearRelation,
		setDefault,
		setEnemyOfEnemy,
		snapshot,
		restore,
		inspect,
		refresh,
		get revision() {
			return revision;
		},
		dispose
	};
},function createConnectionRuntime(scene, host) {
	const entries = new Map(), pending = new Map(), textures = new Map(), warned = new Set();
	let disposed = false, clock = 0, serial = 0;
	const finite = (value, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback, clamp = (value, min, max) => Math.max(min, Math.min(max, value));
	const defaults = {
		enabled: true,
		start: {
			mode: "self",
			targetId: "",
			offsetX: 0,
			offsetY: 0,
			x: 0,
			y: 0
		},
		end: {
			mode: "pointer",
			targetId: "",
			offsetX: 0,
			offsetY: 0,
			x: 0,
			y: 0
		},
		style: "line",
		textureMode: "stretch",
		assetId: "",
		frame: 0,
		textureSpeed: 0,
		jitterAmplitude: 0,
		jitterSpeed: 18,
		width: 4,
		color: "#d7bd82",
		opacity: 1,
		sag: 24,
		waveAmplitude: 0,
		waveSpeed: 1,
		segments: 24,
		maxLength: 0,
		progress: 1,
		extendDuration: 300,
		retractDuration: 300
	};
	const anchor = (go) => go?.getData?.("forgeAnchor") ?? go;
	const rootOf = (go) => {
		let root = anchor(go), depth = 0;
		while (root?.parentContainer && depth++ < 64) root = root.parentContainer;
		return root;
	};
	const visible = (go) => {
		if (!go || go.active === false || go.visible === false) return false;
		for (let node = anchor(go), depth = 0; node; node = node.parentContainer) if (++depth > 64 || node.active === false || node.visible === false) return false;
		return true;
	};
	const matrix = (entry) => {
		const go = anchor(entry.go);
		if (!go) return;
		let value;
		try {
			value = go.getWorldTransformMatrix?.();
		} catch {
			return;
		};
		if (!value) {
			if (go.parentContainer) return;
			const a = finite(go.rotation), sx = finite(go.scaleX, 1), sy = finite(go.scaleY, 1);
			value = {
				a: Math.cos(a) * sx,
				b: Math.sin(a) * sx,
				c: -Math.sin(a) * sy,
				d: Math.cos(a) * sy,
				tx: finite(go.x),
				ty: finite(go.y)
			};
		};
		const bx = finite(go.getData?.("forgeScaleX"), entry.def.kind === "sprite" && go.width > 0 ? entry.def.width / go.width : 1), by = finite(go.getData?.("forgeScaleY"), entry.def.kind === "sprite" && go.height > 0 ? entry.def.height / go.height : 1);
		if (Math.abs(bx) < 1e-9 || Math.abs(by) < 1e-9) return;
		const m = {
			a: value.a / bx,
			b: value.b / bx,
			c: value.c / by,
			d: value.d / by,
			tx: value.tx,
			ty: value.ty
		};
		return Object.values(m).every(Number.isFinite) ? m : undefined;
	};
	const camera = (entry) => {
		const owner = rootOf(entry.go), cameras = scene.cameras?.cameras ?? [scene.cameras?.main];
		return cameras.find((camera) => camera && camera.visible !== false && !(owner?.cameraFilter & camera.id)) ?? scene.cameras?.main;
	};
	const screenShift = (go, cam) => {
		const root = rootOf(go);
		return {
			x: finite(cam?.scrollX) * (1 - finite(root?.scrollFactorX, 1)),
			y: finite(cam?.scrollY) * (1 - finite(root?.scrollFactorY, 1))
		};
	};
	const resolve = (entry, value, actors, cam) => {
		if (value.mode === "point") return {
			x: value.x + value.offsetX,
			y: value.y + value.offsetY
		};
		if (value.mode === "pointer") {
			const pointer = scene.input?.activePointer;
			if (!pointer) return;
			const point = cam?.getWorldPoint?.(pointer.x, pointer.y) ?? {
				x: pointer.worldX ?? pointer.x,
				y: pointer.worldY ?? pointer.y
			};
			return {
				x: point.x + value.offsetX,
				y: point.y + value.offsetY
			};
		};
		const target = value.mode === "self" ? entry : actors.get(value.targetId);
		if (!target || !visible(target.go)) return;
		const m = matrix(target);
		if (!m) return;
		const shift = screenShift(target.go, cam);
		return {
			x: m.tx + m.a * value.offsetX + m.c * value.offsetY + shift.x,
			y: m.ty + m.b * value.offsetX + m.d * value.offsetY + shift.y
		};
	};
	// 씬 편집의 connectionCurve와 같은 식을 독립 게임 안에서도 사용한다.
	const curve = (start, end, settings) => {
		const count = Math.max(2, Math.min(128, Math.round(settings.segments))), dx = end.x - start.x, dy = end.y - start.y, chord = Math.hypot(dx, dy), nx = chord ? -dy / chord : 0, ny = chord ? dx / chord : 1, full = [];
		let totalLength = 0;
		if (chord < 1e-8) return {
			points: [{ ...start }, { ...start }],
			totalLength: 0,
			length: 0,
			end: { ...start }
		};
		const jitter = settings.jitterAmplitude ?? 0, tick = Math.floor(Math.max(0, clock) * (settings.jitterSpeed ?? 18));
		for (let i = 0; i <= count; i++) {
			const t = i / count;
			let wave = settings.waveAmplitude * Math.sin(Math.PI * t) * Math.sin(clock * settings.waveSpeed * Math.PI * 2 - t * Math.PI * 2);
			if (jitter > 0 && i > 0 && i < count) {
				let hash = Math.imul((tick ^ Math.imul(i, 374761393)) >>> 0, 668265263);
				hash = Math.imul(hash ^ hash >>> 13, 1274126177);
				hash = (hash ^ hash >>> 16) >>> 0;
				wave += (hash / 4294967295 * 2 - 1) * jitter * Math.sin(Math.PI * t);
			};
			const point = {
				x: start.x + dx * t + nx * wave,
				y: start.y + dy * t + settings.sag * 4 * t * (1 - t) + ny * wave
			};
			if (i) totalLength += Math.hypot(point.x - full[i - 1].x, point.y - full[i - 1].y);
			full.push(point);
		};
		const length = Math.min(totalLength, settings.maxLength > 0 ? settings.maxLength : totalLength) * clamp(settings.progress, 0, 1), points = [full[0]];
		let travelled = 0;
		for (let i = 1; i < full.length; i++) {
			const a = full[i - 1], b = full[i], span = Math.hypot(b.x - a.x, b.y - a.y);
			if (travelled + span >= length) {
				const t = span ? (length - travelled) / span : 0;
				points.push({
					x: a.x + (b.x - a.x) * t,
					y: a.y + (b.y - a.y) * t
				});
				break;
			};
			points.push(b);
			travelled += span;
		};
		if (points.length === 1) points.push({ ...points[0] });
		return {
			points,
			totalLength,
			length,
			end: points[points.length - 1]
		};
	};
	const warn = (key, message) => {
		if (!warned.has(key)) {
			warned.add(key);
			host.error?.(message);
		}
	};
	const isolated = (settings) => {
		const id = settings.assetId + ":" + settings.frame, cached = textures.get(id);
		if (cached) return cached;
		const source = host.source(settings.assetId, settings.frame);
		if (!source || !scene.textures?.exists(source.key)) return;
		const frame = scene.textures.getFrame(source.key, source.frame);
		if (!frame) return;
		const width = Math.round(frame.realWidth ?? frame.width), height = Math.round(frame.realHeight ?? frame.height);
		if (width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 4194304) {
			warn(id, "연결 그림은 한 프레임 4096픽셀·총 419만 픽셀 이하로 선택하세요.");
			return;
		};
		const key = "__forge_connection_" + scene.sys?.settings?.key + "_" + Date.now() + "_" + ++serial, texture = scene.textures.createCanvas(key, width, height);
		if (!texture) return;
		try {
			const ctx = texture.context, image = frame.source?.image;
			if (!image) throw Error("원본 그림이 없습니다.");
			ctx.imageSmoothingEnabled = false;
			const x = frame.x ?? 0, y = frame.y ?? 0;
			if (frame.rotated) {
				ctx.save();
				ctx.translate(x, y + frame.cutWidth);
				ctx.rotate(-Math.PI / 2);
				ctx.drawImage(image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
				ctx.restore();
			} else ctx.drawImage(image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, x, y, frame.cutWidth, frame.cutHeight);
			texture.refresh();
			const result = {
				key,
				width,
				height
			};
			textures.set(id, result);
			return result;
		} catch (error) {
			scene.textures.remove(key);
			warn(id, "연결 그림을 읽지 못했습니다: " + String(error));
			return;
		}
	};
	const slice = (points, from, to) => {
		const result = [];
		let travelled = 0;
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y), end = travelled + length;
			if (end >= from && travelled <= to) {
				const lo = length ? clamp((from - travelled) / length, 0, 1) : 0, hi = length ? clamp((to - travelled) / length, 0, 1) : 1;
				if (!result.length) result.push({
					x: a.x + (b.x - a.x) * lo,
					y: a.y + (b.y - a.y) * lo
				});
				const point = {
					x: a.x + (b.x - a.x) * hi,
					y: a.y + (b.y - a.y) * hi
				}, last = result[result.length - 1];
				if (Math.hypot(point.x - last.x, point.y - last.y) > 1e-8) result.push(point);
			};
			travelled = end;
			if (end >= to) break;
		};
		if (result.length === 1) result.push({ ...result[0] });
		return result;
	};
	const paint = (entry) => {
		const { settings: o, root, line, points } = entry, owner = rootOf(entry.go);
		let alpha = o.opacity;
		for (let node = anchor(entry.go), depth = 0; node && depth++ < 64; node = node.parentContainer) alpha *= finite(node.alpha, 1);
		root.cameraFilter = owner?.cameraFilter ?? 0;
		root.setDepth?.(finite(owner?.depth) + 1e-4);
		root.setAlpha?.(alpha);
		for (const child of root.list ?? []) child.cameraFilter = root.cameraFilter;
		if (!o.enabled || !visible(entry.go) || !entry.start || !entry.end || entry.length < 1e-7) {
			root.setVisible(false);
			return;
		};
		root.setVisible(true);
		line.clear();
		if (o.style === "texture" && scene.game?.renderer?.gl && scene.add?.rope && !entry.textureAttempted) {
			entry.texture = isolated(o);
			entry.textureAttempted = true;
		};
		const native = !!scene.game?.renderer?.gl && !!scene.add?.rope && entry.texture;
		if (o.style === "texture" && native) {
			entry.mode = "texture";
			line.setVisible(false);
			const texture = entry.texture, repeat = o.textureMode === "repeat", flow = repeat && finite(o.textureSpeed) !== 0, period = repeat ? Math.max(o.width * texture.width / texture.height, entry.length / (flow ? 127 : 128)) : entry.length, phase = flow ? (-clock * finite(o.textureSpeed) % period + period) % period : 0, count = repeat ? Math.min(128, Math.max(1, Math.ceil((entry.length + phase) / period))) : 1, scale = o.width / texture.height;
			for (let index = 0; index < count; index++) {
				const boundary = index * period - phase, from = Math.max(0, boundary), to = Math.min(entry.length, boundary + period), part = slice(points, from, to);
				if (part.length < 2) continue;
				let rope = entry.ropes[index];
				if (!rope) {
					rope = scene.add.rope(0, 0, texture.key, undefined, part);
					root.add(rope);
					entry.ropes[index] = rope;
				};
				const origin = part[0], local = part.map((point) => ({
					x: (point.x - origin.x) / scale,
					y: (point.y - origin.y) / scale
				}));
				rope.setPosition(origin.x, origin.y).setScale(scale).setVisible(true);
				rope.cameraFilter = root.cameraFilter;
				rope.setPoints(local, parseInt(o.color.slice(1), 16));
				let travelled = 0;
				const fraction = repeat ? (to - from) / period : 1, span = to - from, offset = repeat ? (from - boundary) / period : 0;
				for (let i = 0; i < part.length; i++) {
					if (i) travelled += Math.hypot(part[i].x - part[i - 1].x, part[i].y - part[i - 1].y);
					const u = clamp(offset + (span ? travelled / span * fraction : 0), 0, 1);
					rope.uv[i * 4] = u;
					rope.uv[i * 4 + 2] = u;
				};
				rope.dirty = true;
			};
			for (let index = count; index < entry.ropes.length; index++) entry.ropes[index].setVisible(false);
		} else {
			entry.mode = o.style === "texture" ? "line-fallback" : "line";
			for (const rope of entry.ropes) rope.setVisible(false);
			line.setVisible(true);
			line.lineStyle(o.width, parseInt(o.color.slice(1), 16), 1);
			line.beginPath();
			line.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i++) line.lineTo(points[i].x, points[i].y);
			line.strokePath();
		}
	};
	const load = (entry, saved) => {
		entry.settings.enabled = saved.enabled;
		entry.settings.start = { ...saved.start };
		entry.settings.end = { ...saved.end };
		entry.settings.progress = saved.progress;
		entry.motion = saved.motion ? { ...saved.motion } : undefined;
	};
	const bind = (def, go) => {
		if (disposed || !def.connection || !go) return false;
		const old = entries.get(def.id);
		if (old && old.go === go) return true;
		if (old) {
			old.root.destroy(true);
			entries.delete(def.id);
		};
		const settings = {
			...defaults,
			...def.connection,
			start: {
				...defaults.start,
				...def.connection.start
			},
			end: {
				...defaults.end,
				...def.connection.end
			}
		}, root = scene.add.container(0, 0), line = scene.add.graphics();
		root.add(line);
		root.setVisible(false);
		const entry = {
			def,
			go,
			settings,
			root,
			line,
			ropes: [],
			points: [],
			length: 0,
			mode: "line",
			textureAttempted: false
		};
		entries.set(def.id, entry);
		const saved = pending.get(def.id);
		if (saved) {
			load(entry, saved);
			pending.delete(def.id);
		};
		return true;
	};
	const measure = (entry, actors) => {
		const cam = camera(entry), start = resolve(entry, entry.settings.start, actors, cam), end = resolve(entry, entry.settings.end, actors, cam);
		entry.start = start;
		entry.end = end;
		if (start && end) {
			const result = curve(start, end, entry.settings);
			entry.points = result.points;
			entry.end = result.end;
			entry.length = result.length;
		} else {
			entry.points = [];
			entry.length = 0;
		}
	};
	const update = (delta = 0) => {
		if (disposed || entries.size === 0) return;
		const dt = clamp(finite(delta), 0, 1e3);
		clock += dt / 1e3;
		const actors = new Map(host.actors().map((entry) => [entry.def.id, entry]));
		for (const [id, entry] of entries) {
			if (!actors.has(id) || entry.go?.isDestroyed || entry.go?.scene === null) {
				entry.root.destroy(true);
				entries.delete(id);
				continue;
			};
			if (entry.motion) {
				const motion = entry.motion;
				motion.elapsed = Math.min(motion.duration, motion.elapsed + dt);
				entry.settings.progress = motion.from + (motion.to - motion.from) * (motion.duration ? motion.elapsed / motion.duration : 1);
				if (motion.elapsed >= motion.duration) {
					entry.motion = undefined;
					if (motion.to === 0) entry.settings.enabled = false;
				}
			};
			if (!entry.settings.enabled || !visible(entry.go)) {
				entry.root.setVisible(false);
				continue;
			};
			measure(entry, actors);
			paint(entry);
		}
	};
	const commandSingle = (name, id, value) => {
		if (disposed) return false;
		if (!entries.has(id)) {
			const actor = host.actors().find((actor) => actor.def.id === id);
			if (actor) bind(actor.def, actor.go);
		};
		const entry = entries.get(id);
		if (!entry) return false;
		const o = entry.settings;
		if ([
			"on",
			"off",
			"toggle",
			"enable",
			"disable"
		].includes(name)) {
			o.enabled = name === "toggle" ? !o.enabled : name === "on" || name === "enable";
			if (!o.enabled) entry.motion = undefined;
		} else if (name === "progress") {
			const next = Number(value);
			if (!Number.isFinite(next) || next < 0 || next > 1) throw Error("연결 진행률은 0~1 사이 숫자여야 합니다.");
			o.progress = next;
			entry.motion = undefined;
		} else if (name === "extend" || name === "retract") {
			const duration = value === undefined ? name === "extend" ? o.extendDuration : o.retractDuration : Number(value);
			if (!Number.isFinite(duration) || duration < 0 || duration > 6e4) throw Error("연결 시간은 0~60000ms여야 합니다.");
			if (name === "extend" && o.progress >= 1) o.progress = 0;
			o.enabled = true;
			entry.motion = {
				from: o.progress,
				to: name === "extend" ? 1 : 0,
				elapsed: 0,
				duration
			};
		} else if (name === "attachEnd" || name === "attachStart") {
			measure(entry, new Map(host.actors().map((actor) => [actor.def.id, actor])));
			if (!value || typeof value !== "object" || typeof value.targetId !== "string") throw Error("연결할 오브젝트를 선택하세요.");
			const input = value;
			if ((input.x !== undefined || input.y !== undefined) && (!Number.isFinite(input.x) || !Number.isFinite(input.y))) throw Error("부착점의 X/Y 좌표를 함께 입력하세요.");
			const actors = new Map(host.actors().map((actor) => [actor.def.id, actor])), target = actors.get(input.targetId);
			if (!target || !visible(target.go)) throw Error("연결할 실행 중인 오브젝트가 없습니다.");
			const m = matrix(target), point = name === "attachEnd" ? entry.end : entry.start, world = Number.isFinite(input.x) && Number.isFinite(input.y) ? {
				x: input.x,
				y: input.y
			} : point;
			if (!m || !world) throw Error("현재 연결점을 확인할 수 없습니다.");
			const determinant = m.a * m.d - m.b * m.c;
			if (Math.abs(determinant) < 1e-9) throw Error("크기가 0인 오브젝트에는 연결할 수 없습니다.");
			const shift = screenShift(target.go, camera(entry)), x = world.x - m.tx - shift.x, y = world.y - m.ty - shift.y, offsetX = (m.d * x - m.c * y) / determinant, offsetY = (m.a * y - m.b * x) / determinant;
			if (![offsetX, offsetY].every((value) => Number.isFinite(value) && Math.abs(value) <= 1e9)) throw Error("연결점이 오브젝트에서 너무 멉니다.");
			o[name === "attachEnd" ? "end" : "start"] = {
				mode: "object",
				targetId: input.targetId,
				offsetX,
				offsetY,
				x: 0,
				y: 0
			};
			if (name === "attachEnd") {
				o.progress = 1;
				entry.motion = undefined;
			}
		} else if (name === "release") {
			measure(entry, new Map(host.actors().map((actor) => [actor.def.id, actor])));
			if (entry.end) {
				o.end = {
					mode: "point",
					targetId: "",
					x: entry.end.x,
					y: entry.end.y,
					offsetX: 0,
					offsetY: 0
				};
				o.progress = 1;
				entry.motion = undefined;
			}
		} else throw Error("지원하지 않는 연결 명령입니다.");
		update(0);
		return true;
	};
	const command = (name, id, value) => {
		if (disposed) return false;
		if (entries.has(id)) return commandSingle(name, id, value);
		const actors = host.actors(), owner = actors.find((actor) => actor.def.id === id);
		if (!owner) return false;
		if (owner.def.connection) {
			bind(owner.def, owner.go);
			return commandSingle(name, id, value);
		};
		if (owner.def.kind !== "group") return false;
		const root = anchor(owner.go), children = [...entries.values()].filter((entry) => {
			const seen = new Set();
			let node = anchor(entry.go)?.parentContainer;
			for (let depth = 0; node && depth < 64; depth++) {
				if (seen.has(node)) return false;
				seen.add(node);
				if (node === root) return true;
				node = node.parentContainer;
			};
			return false;
		});
		if (!children.length) return false;
		const before = children.map((entry) => ({
			entry,
			settings: {
				...entry.settings,
				start: { ...entry.settings.start },
				end: { ...entry.settings.end }
			},
			motion: entry.motion && { ...entry.motion }
		}));
		try {
			for (const child of children) commandSingle(name, child.def.id, value);
			return true;
		} catch (error) {
			for (const saved of before) {
				saved.entry.settings = saved.settings;
				saved.entry.motion = saved.motion;
			};
			update(0);
			throw error;
		}
	};
	const snapshot = () => ({
		version: 1,
		clock,
		connections: [...[...entries.values()].map((entry) => ({
			id: entry.def.id,
			enabled: entry.settings.enabled,
			start: { ...entry.settings.start },
			end: { ...entry.settings.end },
			progress: entry.settings.progress,
			...entry.motion ? { motion: { ...entry.motion } } : {}
		})), ...[...pending.values()].map((saved) => ({
			...saved,
			start: { ...saved.start },
			end: { ...saved.end },
			...saved.motion ? { motion: { ...saved.motion } } : {}
		}))]
	});
	const restore = (value) => {
		if (disposed || !value || typeof value !== "object") return false;
		const input = value;
		if (input.version !== 1 || !Number.isFinite(input.clock) || input.clock < 0 || input.clock > 0xe8d4a51000 || !Array.isArray(input.connections) || input.connections.length > 5e3) return false;
		const ids = new Set(), validAnchor = (a) => a && [
			"self",
			"object",
			"point",
			"pointer"
		].includes(a.mode) && typeof a.targetId === "string" && a.targetId.length <= 200 && (a.bindingKey === undefined || typeof a.bindingKey === "string" && /^\$slot:[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(a.bindingKey)) && [
			a.x,
			a.y,
			a.offsetX,
			a.offsetY
		].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e9);
		for (const row of input.connections) {
			if (!row || typeof row.id !== "string" || !row.id || row.id.length > 200 || ids.has(row.id) || typeof row.enabled !== "boolean" || !validAnchor(row.start) || !validAnchor(row.end) || !Number.isFinite(row.progress) || row.progress < 0 || row.progress > 1) return false;
			ids.add(row.id);
			if (row.motion && (![
				row.motion.from,
				row.motion.to,
				row.motion.elapsed,
				row.motion.duration
			].every(Number.isFinite) || row.motion.from < 0 || row.motion.from > 1 || row.motion.to < 0 || row.motion.to > 1 || row.motion.duration < 0 || row.motion.duration > 6e4 || row.motion.elapsed < 0 || row.motion.elapsed > row.motion.duration)) return false;
		};
		clock = input.clock;
		pending.clear();
		for (const row of input.connections) {
			const saved = {
				...row,
				start: { ...row.start },
				end: { ...row.end },
				...row.motion ? { motion: { ...row.motion } } : {}
			}, entry = entries.get(row.id);
			if (entry) load(entry, saved);
			else pending.set(row.id, saved);
		};
		update(0);
		return true;
	};
	const inspect = () => [...entries.values()].map((entry) => ({
		id: entry.def.id,
		enabled: entry.settings.enabled,
		progress: entry.settings.progress,
		start: entry.start && { ...entry.start },
		end: entry.end && { ...entry.end },
		points: entry.points.map((point) => ({ ...point })),
		length: entry.length,
		mode: entry.mode,
		visible: entry.root.visible,
		textureKey: entry.texture?.key,
		renderPieces: entry.ropes.filter((rope) => rope.visible).length
	}));
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		for (const entry of entries.values()) entry.root.destroy(true);
		entries.clear();
		pending.clear();
		for (const texture of textures.values()) if (scene.textures?.exists(texture.key)) scene.textures.remove(texture.key);
		textures.clear();
	};
	return {
		bind,
		update,
		command,
		snapshot,
		restore,
		inspect,
		dispose
	};
},function createRopePhysicsRuntime(Phaser, scene) {
	const worlds = new Set();
	let disposed = false;
	const create = (config = {}) => {
		if (disposed) throw Error("종료한 씬에는 물리 세계를 만들 수 없습니다.");
		const M = Phaser.Physics.Matter.Matter, engine = M.Engine.create({
			positionIterations: 10,
			velocityIterations: 8,
			constraintIterations: 6
		});
		engine.gravity.x = 0;
		engine.gravity.y = (config.gravity ?? 980) / 1e3;
		engine.gravity.scale = .001;
		const entries = new Map(), ropes = new Set();
		let accumulator = 0, clock = 0, closed = false;
		const fixed = Math.max(1e3 / 240, Math.min(1e3 / 60, config.step ?? 1e3 / 120));
		const finite = (n) => {
			if (!Number.isFinite(n)) throw Error("물리 좌표와 값은 유한한 숫자여야 합니다.");
			return n;
		};
		const body = (id) => {
			const e = entries.get(id);
			if (!e) throw Error("물리 대상이 없습니다: " + id);
			return e.body;
		};
		const add = (id, shape, x, y, w, h, options = {}, go) => {
			if (closed || entries.has(id)) throw Error("물리 대상 ID가 중복되었거나 세계가 종료됐습니다.");
			[
				x,
				y,
				w,
				h
			].forEach(finite);
			if (w <= 0 || h <= 0) throw Error("충돌체 크기는 0보다 커야 합니다.");
			const b = shape === "circle" ? M.Bodies.circle(x, y, w, {
				...options,
				label: id
			}) : M.Bodies.rectangle(x, y, w, h, {
				...options,
				label: id
			});
			M.Composite.add(engine.world, b);
			const e = {
				body: b,
				go,
				kinematic: options.kinematic === true,
				offsetX: options.offsetX ?? 0,
				offsetY: options.offsetY ?? 0
			};
			entries.set(id, e);
			if (go?.body?.enable !== undefined) go.body.enable = false;
			return b;
		};
		const rope = (id, point, options = {}) => {
			const b = body(id), target = point.bodyId ? body(point.bodyId) : undefined, p = {
				x: finite(point.x),
				y: finite(point.y)
			}, min = Math.max(8, options.minLength ?? 40), max = Math.max(min, options.maxLength ?? 560), position = target ? {
				x: target.position.x + p.x,
				y: target.position.y + p.y
			} : p;
			const constraint = M.Constraint.create({
				bodyA: target,
				pointA: p,
				bodyB: b,
				pointB: {
					x: 0,
					y: 0
				},
				length: Math.max(min, Math.min(max, options.length ?? Math.hypot(b.position.x - position.x, b.position.y - position.y))),
				stiffness: options.stiffness ?? .98,
				damping: options.damping ?? .025
			});
			M.Composite.add(engine.world, constraint);
			let active = true;
			const handle = {
				constraint,
				minLength: min,
				maxLength: max,
				get active() {
					return active;
				},
				get length() {
					return constraint.length;
				},
				setLength(value) {
					constraint.length = Math.max(min, Math.min(max, finite(value)));
					return constraint.length;
				},
				anchor() {
					return target ? {
						x: target.position.x + p.x,
						y: target.position.y + p.y
					} : { ...p };
				},
				release() {
					if (!active) return;
					active = false;
					M.Composite.remove(engine.world, constraint);
					ropes.delete(handle);
				},
				update() {
					if (!active) return;
					const a = handle.anchor(), distance = Math.hypot(b.position.x - a.x, b.position.y - a.y), slack = options.slack !== false && distance < constraint.length - 2;
					constraint.stiffness = slack ? 0 : options.stiffness ?? .98;
					constraint.damping = slack ? 0 : options.damping ?? .025;
				}
			};
			ropes.add(handle);
			return handle;
		};
		const api = {
			engine,
			entries,
			rectangle: (id, x, y, w, h, o = {}, go) => add(id, "rectangle", x, y, w, h, o, go),
			circle: (id, x, y, r, o = {}, go) => add(id, "circle", x, y, r, r, o, go),
			body,
			rope,
			remove(id) {
				const e = entries.get(id);
				if (!e) return false;
				for (const r of [...ropes]) if (r.constraint.bodyA === e.body || r.constraint.bodyB === e.body) r.release();
				M.Composite.remove(engine.world, e.body);
				entries.delete(id);
				return true;
			},
			position(id, x, y) {
				M.Body.setPosition(body(id), {
					x: finite(x),
					y: finite(y)
				});
			},
			velocity(id, x, y) {
				const b = body(id);
				if (x !== undefined && y !== undefined) M.Body.setVelocity(b, {
					x: finite(x) / 60,
					y: finite(y) / 60
				});
				return {
					x: b.velocity.x * 60,
					y: b.velocity.y * 60
				};
			},
			accelerate(id, x, y) {
				const b = body(id);
				M.Body.applyForce(b, b.position, {
					x: finite(x) * b.mass / 1e6,
					y: finite(y) * b.mass / 1e6
				});
			},
			grounded(id, extra = 5) {
				const b = body(id), bounds = b.bounds;
				return [...entries.values()].some((e) => e.body !== b && !e.body.isSensor && e.body.bounds.min.y >= bounds.max.y - 10 && M.Query.region([e.body], {
					min: {
						x: bounds.min.x + 3,
						y: bounds.max.y - 2
					},
					max: {
						x: bounds.max.x - 3,
						y: bounds.max.y + extra
					}
				}).length > 0);
			},
			raycast(from, to, ignore = []) {
				return M.Query.ray([...entries.entries()].filter(([id, e]) => !ignore.includes(id) && !e.body.isSensor).map(([, e]) => e.body), from, to, 1).map((hit) => hit.bodyA.label);
			},
			touching(id, other) {
				return M.Query.collides(body(id), [body(other)]).length > 0;
			},
			step(delta, before) {
				if (closed) return;
				accumulator = Math.min(accumulator + Math.max(0, finite(delta)), fixed * 12);
				while (accumulator + 1e-7 >= fixed) {
					clock += fixed;
					before?.(fixed / 1e3, clock);
					for (const r of ropes) r.update();
					M.Engine.update(engine, fixed);
					accumulator = Math.max(0, accumulator - fixed);
				};
				for (const e of entries.values()) if (e.go?.active !== false) {
					e.go?.setPosition?.(e.body.position.x + e.offsetX, e.body.position.y + e.offsetY);
				}
			},
			snapshot() {
				return {
					version: 1,
					clock,
					bodies: [...entries].filter(([, e]) => !e.body.isStatic || e.kinematic).map(([id, e]) => ({
						id,
						x: e.body.position.x,
						y: e.body.position.y,
						vx: e.body.velocity.x * 60,
						vy: e.body.velocity.y * 60,
						angle: e.body.angle
					}))
				};
			},
			restore(value) {
				if (value?.version !== 1 || !Array.isArray(value.bodies)) return false;
				if (Number.isFinite(value.clock) && value.clock >= 0) clock = value.clock;
				accumulator = 0;
				for (const p of value.bodies) {
					if (!entries.has(p.id) || ![
						p.x,
						p.y,
						p.vx,
						p.vy,
						p.angle
					].every(Number.isFinite)) continue;
					api.position(p.id, p.x, p.y);
					api.velocity(p.id, p.vx, p.vy);
					M.Body.setAngle(body(p.id), p.angle);
					const e = entries.get(p.id);
					e.go?.setPosition?.(p.x + e.offsetX, p.y + e.offsetY);
				};
				return true;
			},
			destroy() {
				if (closed) return;
				closed = true;
				for (const r of [...ropes]) r.release();
				M.Composite.clear(engine.world, false);
				M.Engine.clear(engine);
				entries.clear();
				worlds.delete(api);
			}
		};
		worlds.add(api);
		return api;
	};
	const destroy = () => {
		if (disposed) return;
		disposed = true;
		for (const w of [...worlds]) w.destroy();
	};
	scene.events.once("shutdown", destroy);
	return {
		create,
		destroy
	};
},function createProjectileGuidanceRuntime(project, scene, host) {
	const entries = new Map(), pending = new Map(), warned = new Set();
	let disposed = false;
	const defaults = {
		enabled: false,
		mode: "homing",
		target: "object",
		targetId: "",
		ownerId: "",
		speed: 320,
		turnRate: 360,
		acquireRange: 800,
		trackDurationMs: 0,
		reacquireMs: 250,
		startDelayMs: 0,
		lostTarget: "reacquire",
		stopDistance: 12,
		arrival: "destroy",
		returnArrival: "destroy",
		lifetimeMs: 8e3,
		rotateToDirection: true,
		rotationOffset: 0,
		targetOffsetX: 0,
		targetOffsetY: 0,
		onAcquire: "",
		onArrive: "",
		onLost: ""
	};
	const finite = (n, fallback = 0) => typeof n === "number" && Number.isFinite(n) ? n : fallback, copy = (value) => JSON.parse(JSON.stringify(value));
	const anchor = (go) => go?.getData?.("forgeAnchor") ?? go;
	const warn = (id, message) => {
		if (!warned.has(id + message)) {
			warned.add(id + message);
			host.error?.(message);
		}
	};
	const usable = (go) => {
		if (!go || go.active === false || go.isDestroyed || go.scene === null) return false;
		for (let node = anchor(go), depth = 0; node; node = node.parentContainer) {
			if (++depth > 64 || node.active === false || node.visible === false) return false;
		};
		return true;
	};
	const live = (id, go) => {
		if (!usable(go)) return false;
		if (host.alive) return host.alive(id, go);
		const hp = go.getData?.("hp");
		return !(typeof hp === "number" && hp <= 0) && !go.getData?.("dead") && !go.getData?.("gameplayDead");
	};
	const matrix = (node) => {
		try {
			const value = node?.getWorldTransformMatrix?.();
			if (value && [
				"a",
				"b",
				"c",
				"d",
				"tx",
				"ty"
			].every((key) => Number.isFinite(value[key]))) return value;
		} catch {
			return;
		};
		if (!node || node.parentContainer) return;
		const angle = finite(node.rotation, finite(node.angle) * Math.PI / 180), sx = finite(node.scaleX, 1), sy = finite(node.scaleY, 1);
		return {
			a: Math.cos(angle) * sx,
			b: Math.sin(angle) * sx,
			c: -Math.sin(angle) * sy,
			d: Math.cos(angle) * sy,
			tx: finite(node.x),
			ty: finite(node.y)
		};
	};
	const position = (go) => {
		const m = matrix(anchor(go));
		return m ? {
			x: m.tx,
			y: m.ty
		} : undefined;
	};
	const local = (parent, world) => {
		if (!parent) return world;
		const m = matrix(parent);
		if (!m) return;
		const det = m.a * m.d - m.b * m.c;
		if (Math.abs(det) < 1e-10) return;
		const x = world.x - m.tx, y = world.y - m.ty;
		return {
			x: (m.d * x - m.c * y) / det,
			y: (m.a * y - m.b * x) / det
		};
	};
	const place = (entry, point) => {
		const p = local(entry.node.parentContainer, point);
		if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
		entry.node.x = p.x;
		entry.node.y = p.y;
		return true;
	};
	const rotate = (entry) => {
		if (!entry.settings.rotateToDirection) return;
		const angle = entry.heading + entry.settings.rotationOffset * Math.PI / 180, m = entry.node.parentContainer ? matrix(entry.node.parentContainer) : undefined;
		if (entry.node.parentContainer && !m) return;
		const desired = m ? Math.atan2(-m.b * Math.cos(angle) + m.a * Math.sin(angle), m.d * Math.cos(angle) - m.c * Math.sin(angle)) : angle;
		const determinant = m ? m.a * m.d - m.b * m.c : 1;
		entry.node.rotation = desired + (determinant < 0 ? Math.PI : 0) + (finite(entry.node.scaleX, 1) < 0 ? Math.PI : 0);
	};
	const conflict = (object) => object.physics === "static" ? "고정 물리 오브젝트는 유도 이동을 사용할 수 없습니다." : object.gameUi?.enabled ? "게임 UI의 위치 맞춤과 유도 이동을 함께 사용할 수 없습니다." : object.motionPath?.enabled ? "이동 경로와 유도 이동이 같은 위치를 제어합니다." : object.gameplay?.agent?.enabled ? "AI 이동과 유도 이동이 같은 위치를 제어합니다." : [
		"platformer",
		"topdown",
		"patrol",
		"float"
	].includes(object.behavior) ? "기본 이동 동작과 유도 이동이 같은 위치를 제어합니다." : object.tween === "float" || object.projectileGuidance?.rotateToDirection && (object.tween === "spin" || object.behavior === "rotate") ? "위치·회전 효과와 유도 이동이 같은 값을 바꿉니다." : "";
	const driveIssue = (def, go, settings) => {
		const message = conflict({
			...def,
			projectileGuidance: {
				...settings,
				enabled: true
			}
		});
		if (message) return message;
		const node = anchor(go);
		if (node?.body && !node.body.setDirectControl) return "이 물리 방식은 유도 이동을 지원하지 않습니다.";
		if (def.kind === "group" && host.actors().some((actor) => actor.go !== go && anchor(actor.go)?.body && (() => {
			for (let parent = anchor(actor.go).parentContainer, depth = 0; parent && depth++ < 64; parent = parent.parentContainer) if (parent === node) return true;
			return false;
		})())) return "물리 자식이 있는 그룹은 유도 이동을 사용할 수 없습니다.";
		return "";
	};
	const validSettings = (o) => o && typeof o.enabled === "boolean" && [
		"homing",
		"follow",
		"return"
	].includes(o.mode) && [
		"object",
		"nearestEnemy",
		"pointer",
		"owner"
	].includes(o.target) && [
		"straight",
		"reacquire",
		"stop",
		"destroy"
	].includes(o.lostTarget) && [
		"stop",
		"pass",
		"destroy",
		"return"
	].includes(o.arrival) && ["stop", "destroy"].includes(o.returnArrival) && typeof o.rotateToDirection === "boolean" && [
		"targetId",
		"ownerId",
		"onAcquire",
		"onArrive",
		"onLost"
	].every((k) => typeof o[k] === "string" && o[k].length <= 200) && [
		"speed",
		"turnRate",
		"acquireRange",
		"stopDistance",
		"trackDurationMs",
		"reacquireMs",
		"startDelayMs",
		"lifetimeMs",
		"rotationOffset",
		"targetOffsetX",
		"targetOffsetY"
	].every((k) => Number.isFinite(o[k])) && o.speed >= 0 && o.speed <= 1e4 && o.turnRate >= 0 && o.turnRate <= 36e3 && o.acquireRange >= 0 && o.acquireRange <= 1e6 && o.stopDistance >= 0 && o.stopDistance <= 1e6 && o.reacquireMs >= 16 && o.reacquireMs <= 6e4 && [
		"trackDurationMs",
		"startDelayMs",
		"lifetimeMs"
	].every((k) => o[k] >= 0 && o[k] <= 864e5) && Math.abs(o.rotationOffset) <= 36e3 && Math.abs(o.targetOffsetX) <= 1e6 && Math.abs(o.targetOffsetY) <= 1e6;
	const acquireBody = (entry) => {
		if (entry.held) return;
		entry.held = true;
		entry.node.setData?.("forgeProjectileGuidance", true);
		const body = entry.node.body;
		if (body?.setDirectControl) {
			entry.body = {
				direct: !!body.directControl,
				gravity: !!body.allowGravity,
				vx: finite(body.velocity?.x),
				vy: finite(body.velocity?.y),
				ax: finite(body.acceleration?.x),
				ay: finite(body.acceleration?.y)
			};
			body.setDirectControl(true);
			body.setAllowGravity?.(false);
			body.setAcceleration?.(0, 0);
			body.setVelocity?.(0, 0);
		}
	};
	const releaseBody = (entry) => {
		if (!entry.held) return;
		entry.held = false;
		entry.node.setData?.("forgeProjectileGuidance", false);
		const body = entry.node.body;
		if (body && entry.body) {
			body.setDirectControl?.(entry.body.direct);
			body.setAllowGravity?.(entry.body.gravity);
			body.setAcceleration?.(entry.body.ax, entry.body.ay);
			body.setVelocity?.(entry.body.vx, entry.body.vy);
		};
		entry.body = undefined;
	};
	const resolveId = (id, entry) => {
		try {
			return host.resolveTarget?.(id, entry.settings.ownerId, entry.id) ?? id;
		} catch {
			return "";
		}
	};
	const owner = (entry) => resolveId(entry.settings.ownerId || entry.go.getData?.("spawnOwnerId") || entry.go.getData?.("ownerId") || "", entry);
	const emit = (entry, kind, reason, point) => {
		const fn = entry.settings[kind];
		if (!fn) return;
		const at = position(entry.go) ?? {
			x: 0,
			y: 0
		};
		try {
			host.run(fn, {
				sourceId: entry.id,
				ownerId: owner(entry),
				targetId: entry.targetId,
				x: at.x,
				y: at.y,
				targetX: point?.x ?? at.x,
				targetY: point?.y ?? at.y,
				reason,
				phase: entry.phase
			}, entry.id);
		} catch (error) {
			warn(entry.id, entry.def.name + ": 유도 이벤트 실행 실패 " + String(error));
		}
	};
	const destroy = (entry) => {
		entries.delete(entry.id);
		releaseBody(entry);
		entry.go.destroy?.();
		if (entry.node !== entry.go && entry.node.active !== false && !entry.node.isDestroyed) entry.node.destroy?.();
	};
	const beginReturn = (entry) => {
		entry.phase = "returning";
		entry.returnStarted = true;
		entry.targetId = "";
		entry.acquired = false;
		entry.lostNotified = false;
		entry.arrived = false;
		entry.searchInMs = 0;
	};
	const candidate = (entry, id, actors) => {
		if (!id || id === entry.id) return;
		const go = actors.get(id)?.go ?? host.object(id);
		if (!live(id, go)) return;
		const p = position(go);
		if (!p) return;
		return {
			x: p.x + entry.settings.targetOffsetX,
			y: p.y + entry.settings.targetOffsetY
		};
	};
	const hostile = (entry, id, actors) => {
		const own = owner(entry) || entry.id, relation = host.relation?.(own, id);
		if (host.relation) return relation === "hostile" || relation === "enemy";
		const source = actors.get(own)?.def, other = actors.get(id)?.def, from = source?.gameplay?.faction ?? source?.gameplay?.combat?.team ?? "", to = other?.gameplay?.faction ?? other?.gameplay?.combat?.team ?? "";
		return !!from && !!to && from !== to;
	};
	const target = (entry, actors) => {
		const o = entry.settings;
		if (entry.phase === "returning") {
			const id = owner(entry), p = candidate(entry, id, actors);
			if (p) {
				const changed = entry.targetId !== id;
				entry.targetId = id;
				if (changed || !entry.acquired) {
					entry.acquired = true;
					entry.lostNotified = false;
					emit(entry, "onAcquire", "return", p);
				}
			};
			return p;
		};
		if (o.target === "pointer") {
			const pointer = scene.input?.activePointer;
			if (!pointer || pointer.active === false || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return;
			const camera = scene.cameras?.main, p = camera?.getWorldPoint?.(pointer.x, pointer.y) ?? {
				x: pointer.worldX ?? pointer.x,
				y: pointer.worldY ?? pointer.y
			};
			if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
			const point = {
				x: p.x + o.targetOffsetX,
				y: p.y + o.targetOffsetY
			};
			if (!entry.acquired) {
				entry.targetId = "";
				entry.acquired = true;
				entry.lostNotified = false;
				emit(entry, "onAcquire", "pointer", point);
			};
			return point;
		};
		if (entry.targetId) {
			const p = candidate(entry, entry.targetId, actors);
			if (p) return p;
		};
		if (entry.searchInMs > 0) return;
		entry.searchInMs = o.reacquireMs;
		const own = owner(entry), at = position(entry.go);
		if (!at) return;
		let id = o.target === "owner" ? own : o.target === "object" ? resolveId(o.targetId, entry) : "", p = id ? candidate(entry, id, actors) : undefined;
		if (o.target === "nearestEnemy") {
			let shortest = o.acquireRange > 0 ? o.acquireRange : Infinity;
			for (const actor of actors.values()) {
				if (actor.def.id === entry.id || actor.def.id === own || actor.go === entry.go || !hostile(entry, actor.def.id, actors)) continue;
				const point = candidate(entry, actor.def.id, actors);
				if (!point) continue;
				const distance = Math.hypot(point.x - at.x, point.y - at.y);
				if (distance < shortest || distance === shortest && (!id || actor.def.id < id)) {
					shortest = distance;
					id = actor.def.id;
					p = point;
				}
			}
		} else if (p && o.acquireRange > 0 && Math.hypot(p.x - at.x, p.y - at.y) > o.acquireRange) p = undefined;
		if (p) {
			entry.targetId = id;
			entry.acquired = true;
			entry.lostNotified = false;
			entry.arrived = false;
			emit(entry, "onAcquire", "acquire", p);
		};
		return p;
	};
	const lost = (entry) => {
		if (!entry.lostNotified) {
			entry.lostNotified = true;
			emit(entry, "onLost", entry.acquired ? "target-unavailable" : "target-not-found");
		};
		entry.targetId = "";
		entry.acquired = false;
		entry.arrived = false;
		if (entry.settings.lostTarget === "destroy") {
			destroy(entry);
			return false;
		};
		if (entry.settings.lostTarget === "stop") {
			entry.phase = "lost";
			return false;
		};
		if (entry.settings.lostTarget === "straight") {
			entry.phase = "coasting";
			return true;
		};
		return true;
	};
	const arrived = (entry, point) => {
		if (!entry.arrived) {
			entry.arrived = true;
			emit(entry, "onArrive", entry.phase === "returning" ? "returned" : "arrived", point);
		};
		if (!entries.has(entry.id) || !usable(entry.go)) return;
		const action = entry.phase === "returning" ? entry.settings.returnArrival : entry.settings.arrival;
		if (action === "destroy") {
			destroy(entry);
			return;
		};
		if (action === "return") {
			beginReturn(entry);
			return;
		};
		if (action === "stop") entry.phase = "arrived";
	};
	const bind = (def, go) => {
		if (disposed || !go || !def.projectileGuidance) return false;
		const old = entries.get(def.id);
		if (old?.go === go) return true;
		if (old) {
			releaseBody(old);
			entries.delete(def.id);
		};
		const settings = {
			...defaults,
			...def.projectileGuidance
		}, issue = settings.enabled ? driveIssue(def, go, settings) : "";
		if (issue) {
			warn(def.id, def.name + ": " + issue);
			return false;
		};
		if (!validSettings(settings)) {
			warn(def.id, def.name + ": 유도 이동 설정을 확인하세요.");
			return false;
		};
		const node = anchor(go);
		const m = matrix(node);
		if (!m) return false;
		const entry = {
			id: def.id,
			def,
			go,
			node,
			settings,
			playing: true,
			ageMs: 0,
			trackedMs: 0,
			searchInMs: 0,
			delayLeftMs: settings.startDelayMs,
			heading: Math.atan2(m.b, m.a) - settings.rotationOffset * Math.PI / 180,
			phase: "outbound",
			targetId: "",
			acquired: false,
			lostNotified: false,
			arrived: false,
			returnStarted: false,
			held: false
		};
		entries.set(def.id, entry);
		if (settings.enabled) acquireBody(entry);
		const saved = pending.get(def.id);
		if (saved) {
			load(entry, saved);
			pending.delete(def.id);
		};
		return true;
	};
	const step = (entry, delta, actors) => {
		entry.ageMs += delta;
		if (entry.settings.lifetimeMs > 0 && entry.ageMs >= entry.settings.lifetimeMs) {
			destroy(entry);
			return;
		};
		if (entry.delayLeftMs > 0) {
			const used = Math.min(entry.delayLeftMs, delta);
			entry.delayLeftMs -= used;
			delta -= used;
			if (!delta) return;
		};
		entry.searchInMs = Math.max(0, entry.searchInMs - delta);
		if (entry.phase === "lost" && entry.settings.mode !== "return") return;
		if (!entry.returnStarted && (entry.phase === "outbound" || entry.settings.mode === "return" && (entry.phase === "coasting" || entry.phase === "lost"))) {
			entry.trackedMs += delta;
			if (entry.settings.trackDurationMs > 0 && entry.trackedMs >= entry.settings.trackDurationMs) {
				if (entry.settings.mode === "return") beginReturn(entry);
				else if (entry.settings.mode === "follow") {
					entry.phase = "lost";
					return;
				} else entry.phase = "coasting";
			}
		};
		if (entry.phase === "lost") return;
		if (entry.phase === "arrived" && entry.settings.mode !== "follow") return;
		if (entry.acquired && entry.targetId && entry.phase !== "coasting" && (!candidate(entry, entry.targetId, actors) || entry.phase !== "returning" && entry.settings.target === "nearestEnemy" && !hostile(entry, entry.targetId, actors))) {
			if (!lost(entry)) return;
		};
		if (!entries.has(entry.id) || !entry.settings.enabled || !entry.playing) return;
		let aim;
		if (entry.phase !== "coasting") aim = target(entry, actors);
		if (!entries.has(entry.id) || !usable(entry.go) || !entry.settings.enabled || !entry.playing) return;
		if (!aim && entry.phase !== "coasting") {
			if (entry.phase === "arrived") return;
			if (!lost(entry)) return;
		};
		const initialPosition = position(entry.go);
		if (!initialPosition) return;
		let at = initialPosition;
		if (entry.phase === "arrived") {
			if (entry.settings.mode !== "follow" || !aim || Math.hypot(aim.x - at.x, aim.y - at.y) <= entry.settings.stopDistance + .5) return;
			entry.phase = "outbound";
			entry.arrived = false;
		};
		let remaining = delta;
		while (remaining > 0 && entries.has(entry.id) && usable(entry.go)) {
			const milliseconds = Math.min(remaining, 16), seconds = milliseconds / 1e3;
			remaining -= milliseconds;
			if (aim) {
				const distance = Math.hypot(aim.x - at.x, aim.y - at.y);
				if (distance <= entry.settings.stopDistance) {
					arrived(entry, aim);
					if (entry.phase !== "outbound" || entry.settings.arrival !== "pass") break;
				};
				const desired = Math.atan2(aim.y - at.y, aim.x - at.x), difference = Math.atan2(Math.sin(desired - entry.heading), Math.cos(desired - entry.heading)), turn = entry.settings.turnRate * Math.PI / 180 * seconds;
				entry.heading += Math.max(-turn, Math.min(turn, difference));
			};
			const travel = entry.settings.speed * seconds, next = {
				x: at.x + Math.cos(entry.heading) * travel,
				y: at.y + Math.sin(entry.heading) * travel
			};
			if (aim && !entry.arrived) {
				const dx = next.x - at.x, dy = next.y - at.y, length = dx * dx + dy * dy, t = length ? Math.max(0, Math.min(1, ((aim.x - at.x) * dx + (aim.y - at.y) * dy) / length)) : 0, nearest = {
					x: at.x + dx * t,
					y: at.y + dy * t
				};
				if (Math.hypot(aim.x - nearest.x, aim.y - nearest.y) <= entry.settings.stopDistance) {
					const action = entry.phase === "returning" ? entry.settings.returnArrival : entry.settings.arrival;
					if (action !== "pass") {
						const fx = at.x - aim.x, fy = at.y - aim.y, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - entry.settings.stopDistance * entry.settings.stopDistance, discriminant = b * b - 4 * length * c, hit = length && discriminant >= 0 ? Math.max(0, Math.min(1, (-b - Math.sqrt(discriminant)) / (2 * length))) : t;
						place(entry, {
							x: at.x + dx * hit,
							y: at.y + dy * hit
						});
						rotate(entry);
						arrived(entry, aim);
						break;
					};
					arrived(entry, aim);
				}
			};
			if (!place(entry, next)) {
				warn(entry.id, entry.def.name + ": 부모 좌표를 변환할 수 없습니다.");
				break;
			};
			rotate(entry);
			at = next;
		}
	};
	const update = (delta = 0) => {
		if (disposed || !entries.size || host.paused?.()) return;
		const dt = Math.min(1e3, Math.max(0, finite(delta)));
		if (!dt) return;
		const actors = new Map(host.actors().map((actor) => [actor.def.id, actor]));
		for (const [id, entry] of entries) {
			if (!actors.has(id) || entry.go.isDestroyed || entry.go.scene === null) {
				releaseBody(entry);
				entries.delete(id);
				continue;
			};
			if (!entry.settings.enabled || !entry.playing || !usable(entry.go) || entry.go.getData?.("gameplayBlocked")) continue;
			acquireBody(entry);
			let remaining = dt;
			while (remaining > 0 && entries.has(id) && entry.settings.enabled && entry.playing && usable(entry.go)) {
				const chunk = Math.min(remaining, 16);
				step(entry, chunk, actors);
				remaining -= chunk;
			}
		}
	};
	const command = (name, id, value) => {
		if (disposed) return false;
		let entry = entries.get(id);
		if (!entry) {
			const actor = host.actors().find((actor) => actor.def.id === id);
			if (actor) bind(actor.def, actor.go);
			entry = entries.get(id);
		};
		if (!entry) return false;
		if ([
			"enable",
			"on",
			"resume",
			"restart",
			"return"
		].includes(name)) {
			const issue = driveIssue(entry.def, entry.go, entry.settings);
			if (issue) {
				warn(id, entry.def.name + ": " + issue);
				return false;
			}
		};
		if (name === "enable" || name === "on" || name === "resume") {
			entry.settings.enabled = true;
			entry.playing = true;
			acquireBody(entry);
		} else if (name === "disable" || name === "off") {
			entry.settings.enabled = false;
			releaseBody(entry);
		} else if (name === "pause" || name === "stop") {
			entry.playing = false;
		} else if (name === "restart") {
			entry.ageMs = entry.trackedMs = entry.searchInMs = 0;
			entry.delayLeftMs = entry.settings.startDelayMs;
			entry.phase = "outbound";
			entry.targetId = "";
			entry.acquired = entry.lostNotified = entry.arrived = entry.returnStarted = false;
			entry.settings.enabled = entry.playing = true;
			acquireBody(entry);
		} else if (name === "return") {
			entry.settings.enabled = entry.playing = true;
			acquireBody(entry);
			beginReturn(entry);
		} else if (name === "target" || name === "retarget" || name === "owner") {
			if (typeof value !== "string" || value.length > 200) throw Error("연결할 오브젝트 ID를 입력하세요.");
			if (name === "owner") entry.settings.ownerId = value;
			else {
				entry.settings.target = "object";
				entry.settings.targetId = value;
				entry.phase = "outbound";
				entry.trackedMs = 0;
				entry.returnStarted = false;
			};
			entry.targetId = "";
			entry.acquired = entry.lostNotified = entry.arrived = false;
			entry.searchInMs = 0;
		} else throw Error("지원하지 않는 유도 이동 명령입니다.");
		return true;
	};
	const save = (entry) => ({
		id: entry.id,
		settings: copy(entry.settings),
		playing: entry.playing,
		ageMs: entry.ageMs,
		trackedMs: entry.trackedMs,
		searchInMs: entry.searchInMs,
		delayLeftMs: entry.delayLeftMs,
		heading: entry.heading,
		phase: entry.phase,
		targetId: entry.targetId,
		acquired: entry.acquired,
		lostNotified: entry.lostNotified,
		arrived: entry.arrived,
		returnStarted: entry.returnStarted,
		position: position(entry.go) ?? {
			x: 0,
			y: 0
		}
	});
	function load(entry, saved) {
		releaseBody(entry);
		entry.settings = copy(saved.settings);
		for (const key of [
			"playing",
			"ageMs",
			"trackedMs",
			"searchInMs",
			"delayLeftMs",
			"heading",
			"phase",
			"targetId",
			"acquired",
			"lostNotified",
			"arrived",
			"returnStarted"
		]) entry[key] = saved[key];
		const issue = entry.settings.enabled ? driveIssue(entry.def, entry.go, entry.settings) : "";
		if (issue) {
			entry.settings.enabled = false;
			warn(entry.id, entry.def.name + ": " + issue);
			return;
		};
		place(entry, saved.position);
		rotate(entry);
		entry.node.body?.updateFromGameObject?.();
		if (entry.settings.enabled) acquireBody(entry);
	}
	const snapshot = () => ({
		version: 1,
		projectiles: [...[...entries.values()].map(save), ...[...pending.values()].map(copy)]
	});
	const restore = (value) => {
		if (disposed || !value || typeof value !== "object") return false;
		const input = value;
		if (input.version !== 1 || !Array.isArray(input.projectiles) || input.projectiles.length > 5e3) return false;
		const ids = new Set();
		for (const row of input.projectiles) {
			if (!row || typeof row.id !== "string" || !row.id || row.id.length > 200 || ids.has(row.id) || !validSettings(row.settings) || ![
				"outbound",
				"returning",
				"coasting",
				"arrived",
				"lost"
			].includes(row.phase) || typeof row.targetId !== "string" || row.targetId.length > 200 || ![
				"playing",
				"acquired",
				"lostNotified",
				"arrived",
				"returnStarted"
			].every((k) => typeof row[k] === "boolean") || ![
				"ageMs",
				"trackedMs",
				"searchInMs",
				"delayLeftMs"
			].every((k) => Number.isFinite(row[k]) && row[k] >= 0 && row[k] <= 0xe8d4a51000) || !Number.isFinite(row.heading) || !row.position || ![row.position.x, row.position.y].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e9)) return false;
			ids.add(row.id);
		};
		pending.clear();
		for (const row of input.projectiles) {
			const saved = copy(row), entry = entries.get(row.id);
			if (entry) load(entry, saved);
			else pending.set(row.id, saved);
		};
		return true;
	};
	const inspect = () => [...entries.values()].map((entry) => ({
		id: entry.id,
		enabled: entry.settings.enabled,
		playing: entry.playing,
		phase: entry.phase,
		targetId: entry.targetId,
		heading: entry.heading * 180 / Math.PI,
		ageMs: entry.ageMs,
		trackedMs: entry.trackedMs,
		position: position(entry.go)
	}));
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		for (const entry of entries.values()) releaseBody(entry);
		entries.clear();
		pending.clear();
		warned.clear();
	};
	return {
		bind,
		update,
		command,
		snapshot,
		restore,
		inspect,
		isDriving: (id) => !!entries.get(id)?.held,
		dispose
	};
},function createRuntimeTextureLookup(project) {
	const registered = new Map();
	const frameIndex = (asset, frame) => {
		const frames = asset.atlas?.frames;
		const named = typeof frame === "string" ? frames?.findIndex((value) => value.name === frame) : -1;
		return named !== undefined && named >= 0 ? named : frame === "__BASE" ? 0 : Number(frame);
	};
	const physicalSource = (asset, frame = 0) => {
		const frames = asset.atlas?.frames, index = frameIndex(asset, frame);
		const area = Number.isInteger(index) && index >= 0 ? frames?.[index] : undefined;
		return {
			key: area?.pageId ?? asset.id,
			frame: area ? area.pageId ? `${asset.id}:${index}` : area.name : asset.type === "image" ? "__BASE" : frame
		};
	};
	const source = (asset, frame = 0) => {
		const physical = physicalSource(asset, frame);
		if (!registered.has(asset.id)) return physical;
		// Native objects also use the logical texture. Later user calls to
		// sprite.setFrame(N/name) therefore keep working after packing.
		const area = asset.atlas?.frames[frameIndex(asset, frame)];
		return {
			key: asset.id,
			frame: area?.name ?? physical.frame
		};
	};
	const register = (textures) => {
		for (const asset of project.assets) {
			const frames = asset.atlas?.frames;
			if (!frames?.some((frame) => frame.pageId) || textures.exists(asset.id)) continue;
			// Texture.create([]) allocates no image or GPU texture. Frames borrow the
			// already loaded page's TextureSource, including multi-page sheets.
			const entries = frames.map((_frame, index) => {
				const location = physicalSource(asset, index);
				if (!textures.exists(location.key)) return undefined;
				const page = textures.get(location.key);
				return page.has(location.frame) ? page.get(location.frame) : undefined;
			});
			if (entries.some((frame) => !frame)) continue;
			const alias = textures.create(asset.id, []);
			if (!alias) continue;
			const destroy = alias.destroy;
			alias.destroy = function() {
				// Only the physical page owns its GPU sources. Destroying a logical
				// texture must not invalidate other assets on the same page.
				this.source = [];
				this.dataSource = [];
				registered.delete(asset.id);
				destroy.call(this);
			};
			const add = (name, physical) => {
				if (Object.prototype.hasOwnProperty.call(alias.frames, name)) return;
				let index = alias.source.indexOf(physical.source);
				if (index < 0) index = alias.source.push(physical.source) - 1;
				const frame = physical.clone();
				frame.texture = alias;
				frame.name = name;
				frame.sourceIndex = index;
				frame.source = physical.source;
				frame.customData = physical.customData;
				frame.customPivot = physical.customPivot;
				frame.pivotX = physical.pivotX;
				frame.pivotY = physical.pivotY;
				if (frame.rotated) frame.updateUVsInverted();
				alias.frames[name] = frame;
				alias.frameTotal++;
			};
			// Reserve original names first: a named atlas may itself have numeric
			// names. Numeric aliases must never overwrite those names.
			frames.forEach((frame, index) => add(frame.name, entries[index]));
			frames.forEach((_frame, index) => add(index, entries[index]));
			add("__BASE", entries[0]);
			alias.firstFrame = frames[0].name;
			registered.set(asset.id, alias);
		}
	};
	return {
		source,
		register
	};
},function createProjectScriptRuntime(project, ctx, Phaser, onError) {
	const modules = new Map();
	const cache = new Map();
	function normalize(path) {
		const parts = [];
		for (const part of path.replaceAll("\\", "/").split("/")) {
			if (!part || part === ".") continue;
			if (part === "..") {
				if (!parts.length) throw Error("공통 코드의 경로가 프로젝트 밖을 가리킵니다: " + path);
				parts.pop();
			} else parts.push(part);
		};
		return parts.join("/");
	}
	for (const script of project.scripts) {
		if (!script.modulePath) continue;
		const path = normalize(script.modulePath);
		if (modules.has(path)) throw Error("공통 코드 경로가 중복됩니다: " + path);
		modules.set(path, script);
	};
	function resolve(request, from = "") {
		const parent = from.split("/").slice(0, -1).join("/");
		const path = normalize(request.startsWith(".") ? parent + "/" + request : request);
		const candidates = [
			path,
			path + ".js",
			path + "/index.js"
		];
		const result = candidates.find((candidate) => modules.has(candidate));
		if (!result) throw Error("연결된 공통 코드가 없습니다: " + request + (from ? " ← " + from : ""));
		return result;
	}
	function requireModule(request, from = "") {
		const path = resolve(request, from);
		const found = cache.get(path);
		if (found) return found.exports;
		const script = modules.get(path);
		const module = { exports: {} };
		cache.set(path, module);
		try {
			new Function("require", "module", "exports", "ctx", "Phaser", script.code + "\n//# sourceURL=forge-script:///" + encodeURI(path) + "\n")((id) => requireModule(id, path), module, module.exports, ctx, Phaser);
			return module.exports;
		} catch (error) {
			cache.delete(path);
			throw Error(script.name + " [" + path + "]: " + (error instanceof Error ? error.message : String(error)));
		}
	}
	return {
		require: (path) => requireModule(path),
		list: () => [...modules].map(([path, script]) => ({
			id: script.id,
			path,
			entry: !!script.moduleEntry,
			loaded: cache.has(path)
		})),
		load() {
			for (const script of project.scripts) {
				if (script.modulePath && !script.moduleEntry) continue;
				try {
					const result = script.modulePath ? requireModule(script.modulePath) : new Function("ctx", "Phaser", script.code + "\n//# sourceURL=forge-script:///" + encodeURIComponent(script.id) + ".js\n")(ctx, Phaser);
					if (result && typeof result === "object") Object.assign(ctx.utils, result);
				} catch (error) {
					onError(error instanceof Error ? error.message : String(error));
				}
			}
		}
	};
});