(async function restoreExportResources(project, manifestFiles, bundleFiles, cacheVersion, runtimeVersion) {
	const host = globalThis;
	const entries = [], urls = new Map();
	let loading;
	const load = (path, version = cacheVersion) => new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = path + (version ? "?v=" + encodeURIComponent(version) : "");
		script.async = false;
		script.onload = () => {
			script.remove();
			resolve();
		};
		script.onerror = () => {
			script.remove();
			reject(Error("리소스를 열지 못했습니다: " + path));
		};
		document.head.appendChild(script);
	});
	try {
		let progress, counter;
		if (bundleFiles) {
			loading = document.createElement("div");
			loading.setAttribute("role", "status");
			loading.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;gap:14px;background:#11151c;color:#e6e9f1;font:14px sans-serif;text-align:center";
			const label = document.createElement("span");
			label.textContent = "불러오는 중";
			progress = document.createElement("progress");
			progress.max = Math.max(1, bundleFiles.length);
			progress.value = 0;
			progress.setAttribute("aria-label", "리소스 불러오기");
			progress.style.cssText = "width:min(320px,75vw);height:6px;accent-color:#98a7cd";
			counter = document.createElement("span");
			counter.style.cssText = "font-size:12px;color:#a8b0c1";
			loading.append(label, progress, counter);
			(document.body ?? document.documentElement).appendChild(loading);
		};
		host.__forgeResourceManifest169 = (batch) => {
			entries.push(...batch);
		};
		for (const path of manifestFiles) await load(path);
		delete host.__forgeResourceManifest169;
		if (bundleFiles) {
			const pending = new Map(), holders = new Map(), expected = new Map();
			for (const item of [
				...project.assets,
				...project.atlasPages ?? [],
				...project.official?.resources ?? []
			]) {
				const list = holders.get(item.data) ?? [];
				list.push(item);
				holders.set(item.data, list);
			};
			for (const entry of entries) {
				if (pending.has(entry.url) || !entry.parts.length) throw Error("리소스 목록을 확인하세요.");
				pending.set(entry.url, {
					entry,
					parts: [],
					received: 0
				});
				for (const file of entry.parts) expected.set(file, (expected.get(file) ?? 0) + 1);
			};
			if (new Set(bundleFiles).size !== bundleFiles.length || [...expected.keys()].some((file) => !bundleFiles.includes(file))) throw Error("리소스 묶음 목록을 확인하세요.");
			let current = "", received = 0, failure = "";
			host.__forgeResourcePart169 = (url, index, body) => {
				if (failure) return;
				const row = pending.get(url);
				if (!row || !Number.isInteger(index) || index < 0 || index >= row.entry.parts.length || row.entry.parts[index] !== current || row.parts[index] !== undefined || typeof body !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(body) || body.length % 4 !== 0) {
					failure = "리소스 묶음의 내용을 확인하세요: " + current;
					return;
				};
				row.parts[index] = body;
				row.received++;
				received++;
				if (row.received !== row.entry.parts.length) return;
				const data = row.parts.join(""), bytes = data.length * 3 / 4 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
				if (bytes !== row.entry.bytes) {
					failure = "리소스 크기를 확인하세요: " + current;
					return;
				};
				const value = row.entry.header + data;
				for (const item of holders.get(url) ?? []) item.data = value;
				holders.delete(url);
				row.parts.length = 0;
				pending.delete(url);
			};
			for (let index = 0; index < bundleFiles.length; index++) {
				current = bundleFiles[index];
				received = 0;
				await load(current);
				if (failure || received !== (expected.get(current) ?? 0)) throw Error(failure || "리소스 묶음이 완전하지 않습니다: " + current);
				if (progress) progress.value = index + 1;
				if (counter) counter.textContent = index + 1 + " / " + bundleFiles.length;
			};
			if (pending.size) throw Error("리소스 묶음이 누락됐습니다.");
			holders.clear();
			expected.clear();
		} else {
			for (const entry of entries) {
				const parts = [];
				let failed = false;
				host.__forgeResourcePart169 = (url, index, body) => {
					if (url !== entry.url || index < 0 || index >= entry.parts.length || parts[index] !== undefined || !/^[A-Za-z0-9+/]*={0,2}$/.test(body)) {
						failed = true;
						return;
					};
					parts[index] = body;
				};
				// Sequential chunks bound compiler/temporary memory and work on offline file URLs.
				for (let index = 0; index < entry.parts.length; index++) {
					await load(entry.parts[index]);
					if (failed || parts[index] === undefined) throw Error("리소스 파일을 확인하세요: " + entry.parts[index]);
				};
				urls.set(entry.url, entry.header + parts.join(""));
				parts.length = 0;
			}
		};
		delete host.__forgeResourcePart169;
		const restore = (data) => urls.get(data) ?? data;
		for (const asset of project.assets) asset.data = restore(asset.data);
		for (const page of project.atlasPages ?? []) page.data = restore(page.data);
		for (const resource of project.official?.resources ?? []) resource.data = restore(resource.data);
		urls.clear();
		entries.length = 0;
		// Keep the original Phaser -> project -> game order, with resources ready before preload.
		await load("game.js", runtimeVersion ?? cacheVersion);
		loading?.remove();
	} catch (error) {
		loading?.remove();
		delete host.__forgeResourceManifest169;
		delete host.__forgeResourcePart169;
		urls.clear();
		entries.length = 0;
		const panel = document.createElement("div");
		panel.setAttribute("role", "alert");
		panel.style.cssText = "position:fixed;inset:0;display:grid;place-content:center;padding:24px;color:#eee;background:#11151c;font:16px sans-serif;white-space:pre-wrap";
		panel.textContent = "게임을 열지 못했습니다.\n" + (error instanceof Error ? error.message : String(error));
		(document.body ?? document.documentElement).appendChild(panel);
		throw error;
	}
})(project,["resources/manifest-0001.js","resources/manifest-174-mw3pok78tzr1nu.js"],["resources/bundle-0001.js","resources/bundle-0002.js","resources/bundle-0003.js","resources/bundle-0004.js","resources/bundle-0005.js","resources/bundle-0006.js","resources/bundle-0007.js","resources/bundle-174-mw3pok78tzr1nu.js"],"mw3kupy8a9rpdl","175-mw3z0gf2");
