(async function restoreExportResources(project, manifestFiles) {
	const host = globalThis;
	const entries = [], urls = new Map();
	const load = (path) => new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = path;
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
		host.__forgeResourceManifest169 = (batch) => {
			entries.push(...batch);
		};
		for (const path of manifestFiles) await load(path);
		delete host.__forgeResourceManifest169;
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
		};
		delete host.__forgeResourcePart169;
		const restore = (data) => urls.get(data) ?? data;
		for (const asset of project.assets) asset.data = restore(asset.data);
		for (const page of project.atlasPages ?? []) page.data = restore(page.data);
		for (const resource of project.official?.resources ?? []) resource.data = restore(resource.data);
		urls.clear();
		entries.length = 0;
		// Keep the original Phaser -> project -> game order, with resources ready before preload.
		await load("game.js");
	} catch (error) {
		delete host.__forgeResourceManifest169;
		delete host.__forgeResourcePart169;
		urls.clear();
		entries.length = 0;
		const panel = document.createElement("div");
		panel.setAttribute("role", "alert");
		panel.style.cssText = "position:fixed;inset:0;display:grid;place-content:center;padding:24px;color:#eee;background:#11151c;font:16px sans-serif;white-space:pre-wrap";
		panel.textContent = "게임을 열지 못했습니다.\n" + (error instanceof Error ? error.message : String(error));
		document.body.appendChild(panel);
		throw error;
	}
})(project,["resources/manifest-0001.js"]);
