import './style.css';
import './app.css';

import {
	GetSettings,
	SaveSettings,
	GetLastPushedRepo,
	OpenBrowser,
	SearchRepos,
	DeleteRepo,
	StartPush,
	CancelPush,
	SelectDirectory,
	GetGitHubProfile
} from '../wailsjs/go/main/App';

import { EventsOn } from '../wailsjs/runtime/runtime.js';

// Global variables
let selectedFolderPath = "";
let cachedDeleteKey = "";
let currentThemeSetting = "dark";
let searchCurrentPage = 0;
const searchPageSize = 12;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
	loadSettings();
	loadLastPushedRepo();
	setupDragAndDrop();
	setupConsoleAutoScroll();
	setupThemeSystem();
});

// Setup drag and drop for directory selection
function setupDragAndDrop() {
	const dropZone = document.getElementById("drop-zone");
	if (!dropZone) return;

	dropZone.addEventListener("dragover", (e) => {
		e.preventDefault();
		dropZone.classList.add("dragover");
	});

	dropZone.addEventListener("dragenter", (e) => {
		e.preventDefault();
		dropZone.classList.add("dragover");
	});

	dropZone.addEventListener("dragleave", () => {
		dropZone.classList.remove("dragover");
	});

	dropZone.addEventListener("drop", (e) => {
		e.preventDefault();
		dropZone.classList.remove("dragover");

		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			// path là thuộc tính không chuẩn do WebView2 cung cấp cho các file cục bộ
			if (file.path) {
				selectedFolderPath = file.path;
				document.getElementById("folder-path-display").innerText = selectedFolderPath;
				appendConsoleLog(`Đã chọn thư mục qua kéo thả: ${selectedFolderPath}`, "info");
			} else {
				appendConsoleLog("Không thể lấy đường dẫn thư mục kéo thả. Vui lòng click để chọn trực tiếp.", "error");
			}
		}
	});

	// Trigger directory selection dialog on click
	dropZone.addEventListener("click", async () => {
		try {
			const result = await SelectDirectory();
			if (result) {
				selectedFolderPath = result;
				document.getElementById("folder-path-display").innerText = selectedFolderPath;
				appendConsoleLog(`Đã chọn thư mục: ${selectedFolderPath}`, "info");
			}
		} catch (err) {
			appendConsoleLog(`Lỗi chọn thư mục: ${err}`, "error");
		}
	});
}

// Keep console scrolled to bottom unless user scrolled up
let autoScrollConsole = true;
function setupConsoleAutoScroll() {
	const consoleOutput = document.getElementById("console-output");
	if (!consoleOutput) return;

	consoleOutput.addEventListener("scroll", () => {
		const threshold = 15;
		autoScrollConsole = (consoleOutput.scrollHeight - consoleOutput.scrollTop - consoleOutput.clientHeight) <= threshold;
	});
}

// Switch tabs in sidebar
window.switchTab = function (tabId) {
	// Deactivate all tabs
	document.querySelectorAll(".tab-content").forEach(tab => {
		tab.classList.remove("active");
	});
	document.querySelectorAll(".menu-btn").forEach(btn => {
		btn.classList.remove("active");
	});

	// Activate selected tab
	document.getElementById(tabId).classList.add("active");

	// Active button styling
	if (tabId === "push-tab") {
		document.getElementById("nav-push").classList.add("active");
		loadLastPushedRepo();
	} else if (tabId === "search-tab") {
		document.getElementById("nav-search").classList.add("active");
		searchRepositories();
	} else if (tabId === "settings-tab") {
		document.getElementById("nav-settings").classList.add("active");
	}
};

// Handle mode selection changes
window.onModeChange = function () {
	const mode = document.getElementById("mode-selector").value;
	const sessionGroup = document.getElementById("session-group");
	const exGroup = document.getElementById("ex-group");
	const miniprojectGroup = document.getElementById("miniproject-group");
	const customRepoGroup = document.getElementById("custom-repo-group");

	if (mode === "SESSION_EX") {
		sessionGroup.style.display = "flex";
		exGroup.style.display = "flex";
		miniprojectGroup.style.display = "none";
		customRepoGroup.style.display = "none";
	} else if (mode === "MINI_PROJECT") {
		sessionGroup.style.display = "flex";
		exGroup.style.display = "none";
		miniprojectGroup.style.display = "flex";
		customRepoGroup.style.display = "none";
	} else if (mode === "CUSTOM_REPOSITORY") {
		sessionGroup.style.display = "none";
		exGroup.style.display = "none";
		miniprojectGroup.style.display = "none";
		customRepoGroup.style.display = "flex";
	}
};

// Handle default commit checkbox toggle
window.onCommitToggle = function () {
	const useDefault = document.getElementById("toggle-default-commit").checked;
	const wrapper = document.getElementById("custom-commit-wrapper");
	wrapper.style.display = useDefault ? "none" : "flex";
};

// Theme System & OS Synchronization
let themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
function setupThemeSystem() {
	themeMediaQuery.addEventListener('change', (e) => {
		if (currentThemeSetting === "system") {
			applyTheme(e.matches ? "dark" : "light");
		}
	});
}

function applyTheme(theme) {
	if (theme === "dark") {
		document.body.classList.add("dark-theme");
		document.body.classList.remove("light-theme");
	} else {
		document.body.classList.add("light-theme");
		document.body.classList.remove("dark-theme");
	}
}

function applyThemeSetting(mode) {
	currentThemeSetting = mode || "dark";
	if (currentThemeSetting === "system") {
		const isDark = themeMediaQuery.matches;
		applyTheme(isDark ? "dark" : "light");
	} else {
		applyTheme(currentThemeSetting);
	}
}

// Load configurations into Settings Tab
async function loadSettings() {
	try {
		const cfg = await GetSettings();
		if (cfg) {
			document.getElementById("setting-token").value = cfg.github_token || "";
			document.getElementById("setting-username").value = cfg.github_username || "";
			document.getElementById("setting-org").value = cfg.github_org_name || "";
			document.getElementById("setting-pattern").value = cfg.naming_pattern || "session%s-ex%s-homework";
			document.getElementById("setting-delete-key").value = cfg.delete_key || "";
			document.getElementById("setting-theme").value = cfg.theme_mode || "dark";
			cachedDeleteKey = cfg.delete_key || "";

			applyThemeSetting(cfg.theme_mode || "dark");
			checkConnectionStatus(cfg);
			loadGitHubProfile();
		}
	} catch (err) {
		console.error("Lỗi tải cài đặt:", err);
	}
}

// Update UI status footer
function checkConnectionStatus(cfg) {
	const statusDot = document.getElementById("status-dot");
	const statusText = document.getElementById("connection-status");

	if (cfg && cfg.github_token && cfg.github_username) {
		statusDot.className = "status-dot green";
		const owner = cfg.github_org_name ? cfg.github_org_name : cfg.github_username;
		statusText.innerText = `Connected as ${owner}`;
	} else {
		statusDot.className = "status-dot red";
		statusText.innerText = "Chưa cấu hình API";
	}
}

// Save Settings from UI
window.saveSettings = async function () {
	const token = document.getElementById("setting-token").value.trim();
	const username = document.getElementById("setting-username").value.trim();
	const org = document.getElementById("setting-org").value.trim();
	const pattern = document.getElementById("setting-pattern").value.trim();
	const deleteKey = document.getElementById("setting-delete-key").value.trim();
	const theme = document.getElementById("setting-theme").value;

	if (!token || !username) {
		showSettingsMessage("Token và Username không được để trống.", false);
		return;
	}

	const newCfg = {
		github_token: token,
		github_username: username,
		github_org_name: org,
		naming_pattern: pattern || "session%s-ex%s-homework",
		delete_key: deleteKey,
		theme_mode: theme
	};

	try {
		await SaveSettings(newCfg);
		cachedDeleteKey = deleteKey;
		applyThemeSetting(theme);
		checkConnectionStatus(newCfg);
		loadGitHubProfile();
		showSettingsMessage("Đã lưu cài đặt thành công!", true);
	} catch (err) {
		showSettingsMessage(`Lỗi lưu cài đặt: ${err}`, false);
	}
};

function showSettingsMessage(msg, isSuccess) {
	const msgEl = document.getElementById("settings-status-msg");
	msgEl.innerText = msg;
	msgEl.className = isSuccess ? "status-message success" : "status-message error";
	setTimeout(() => {
		msgEl.innerText = "";
	}, 4000);
}

// Load GitHub User Profile
async function loadGitHubProfile() {
	try {
		const profile = await GetGitHubProfile();
		const card = document.getElementById("github-profile-card");
		if (profile && profile.avatar_url) {
			document.getElementById("profile-avatar").src = profile.avatar_url;
			document.getElementById("profile-name").innerText = profile.name || profile.bio || "GitHub User";
			document.getElementById("profile-followers").innerText = `Followers: ${profile.followers} • Repos: ${profile.public_repos}`;
			card.style.display = "flex";
		} else {
			card.style.display = "none";
		}
	} catch (err) {
		console.log("Không thể nạp hồ sơ GitHub:", err);
		document.getElementById("github-profile-card").style.display = "none";
	}
}

// Toggle token field visibility
window.toggleTokenVisibility = function () {
	const tokenEl = document.getElementById("setting-token");
	if (tokenEl.type === "password") {
		tokenEl.type = "text";
	} else {
		tokenEl.type = "password";
	}
};

// Toggle delete key field visibility
window.toggleDeleteKeyVisibility = function () {
	const delKeyEl = document.getElementById("setting-delete-key");
	if (delKeyEl.type === "password") {
		delKeyEl.type = "text";
	} else {
		delKeyEl.type = "password";
	}
};

// Load last pushed repository info into Widget
async function loadLastPushedRepo() {
	try {
		const repo = await GetLastPushedRepo();
		const widget = document.getElementById("recent-push-widget");
		const textEl = document.getElementById("recent-repo-text");
		const openBtn = document.getElementById("btn-open-recent");

		if (repo && repo.repo_name) {
			const date = new Date(repo.pushed_at);
			const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			const dateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
			
			textEl.innerText = `${repo.repo_name} (${timeStr} - ${dateStr})`;
			openBtn.style.display = "inline-block";
			openBtn.onclick = () => {
				OpenBrowser(repo.repo_url);
			};
		} else {
			textEl.innerText = "Không có lịch sử đẩy bài gần đây.";
			openBtn.style.display = "none";
		}
	} catch (err) {
		console.error("Lỗi lấy lịch sử repo gần nhất:", err);
	}
}

// Log appending utility
function appendConsoleLog(msg, type = "info") {
	const consoleOutput = document.getElementById("console-output");
	if (!consoleOutput) return;

	const line = document.createElement("div");
	line.className = `console-line ${type}`;
	line.innerText = msg;
	consoleOutput.appendChild(line);

	if (autoScrollConsole) {
		consoleOutput.scrollTop = consoleOutput.scrollHeight;
	}
}

window.clearConsole = function () {
	const consoleOutput = document.getElementById("console-output");
	if (consoleOutput) consoleOutput.innerHTML = "";
};

// Push Process Execution
window.startPushProcess = async function () {
	if (!selectedFolderPath) {
		appendConsoleLog("Lỗi: Vui lòng chọn hoặc kéo thả thư mục chứa bài tập.", "error");
		return;
	}

	const mode = document.getElementById("mode-selector").value;
	const sessionVal = document.getElementById("session-num").value;
	const exVal = document.getElementById("ex-num").value;
	const miniProjectVal = document.getElementById("miniproject-text").value;
	const customRepoNameVal = document.getElementById("custom-repo-name").value;
	const useDefaultCommit = document.getElementById("toggle-default-commit").checked;
	const customCommitMsg = document.getElementById("custom-commit-msg").value;

	// Reset UI
	clearConsole();
	updateProgressBar(0, "Đang chuẩn bị...");
	setBusyState(true);

	appendConsoleLog(`Khởi động tiến trình push. Thư mục: ${selectedFolderPath}`, "info");

	try {
		await StartPush(
			selectedFolderPath,
			mode,
			sessionVal,
			exVal,
			miniProjectVal,
			customRepoNameVal,
			useDefaultCommit,
			customCommitMsg
		);
		
		updateProgressBar(100, "Hoàn tất!");
		appendConsoleLog("Tiến trình hoàn thành thành công!", "info");
		loadLastPushedRepo();
	} catch (err) {
		updateProgressBar(0, "Thất bại");
		appendConsoleLog(`Lỗi tiến trình: ${err}`, "error");
	} finally {
		setBusyState(false);
	}
};

window.cancelPushProcess = async function () {
	appendConsoleLog("Đang gửi yêu cầu hủy tiến trình...", "info");
	try {
		await CancelPush();
	} catch (err) {
		appendConsoleLog(`Lỗi khi hủy: ${err}`, "error");
	}
};

function setBusyState(busy) {
	document.getElementById("btn-push").disabled = busy;
	document.getElementById("btn-cancel-push").disabled = !busy;
	document.getElementById("mode-selector").disabled = busy;
	document.getElementById("session-num").disabled = busy;
	document.getElementById("ex-num").disabled = busy;
	document.getElementById("miniproject-text").disabled = busy;
	document.getElementById("custom-repo-name").disabled = busy;
	document.getElementById("toggle-default-commit").disabled = busy;
	document.getElementById("custom-commit-msg").disabled = busy;
}

function updateProgressBar(percent, text) {
	document.getElementById("progress-bar").style.width = `${percent}%`;
	document.getElementById("progress-percent").innerText = `${percent}%`;
	if (text) {
		document.getElementById("progress-text").innerText = text;
	}
}

// Bind backend streaming events
EventsOn("git_log", (msg) => {
	appendConsoleLog(msg, "info");
});

EventsOn("git_progress", (percent) => {
	let statusText = "Đang push code...";
	if (percent <= 20) statusText = "Tạo repository...";
	else if (percent <= 40) statusText = "Đồng bộ git...";
	else if (percent >= 95) statusText = "Đang dọn dẹp...";
	updateProgressBar(percent, statusText);
});


// Search Repositories Logic
let searchResults = [];

window.searchRepositories = async function () {
	const query = document.getElementById("search-query").value;
	const container = document.getElementById("repo-list-container");
	container.innerHTML = "<div style='grid-column: 1/-1; text-align: center; color: var(--text-secondary);'>Đang tìm kiếm...</div>";
	document.getElementById("pagination-controls").style.display = "none";

	try {
		const repos = await SearchRepos(query);
		searchResults = repos || [];
		searchCurrentPage = 0;
		renderRepositories();
	} catch (err) {
		container.innerHTML = `<div style='grid-column: 1/-1; text-align: center; color: var(--accent-red);'>Lỗi tìm kiếm: ${err}</div>`;
	}
};

window.handleSearchKeyUp = function (e) {
	if (e.key === "Enter") {
		searchRepositories();
	}
};

window.prevSearchPage = function () {
	if (searchCurrentPage > 0) {
		searchCurrentPage--;
		renderRepositories();
	}
};

window.nextSearchPage = function () {
	const totalPages = Math.ceil(searchResults.length / searchPageSize);
	if (searchCurrentPage < totalPages - 1) {
		searchCurrentPage++;
		renderRepositories();
	}
};

function renderRepositories() {
	const container = document.getElementById("repo-list-container");
	container.innerHTML = "";

	if (searchResults.length === 0) {
		container.innerHTML = "<div style='grid-column: 1/-1; text-align: center; color: var(--text-muted);'>Không tìm thấy repository nào.</div>";
		document.getElementById("pagination-controls").style.display = "none";
		return;
	}

	const totalPages = Math.ceil(searchResults.length / searchPageSize);
	const start = searchCurrentPage * searchPageSize;
	const end = Math.min(start + searchPageSize, searchResults.length);
	
	const pageItems = searchResults.slice(start, end);

	pageItems.forEach(repo => {
		const card = document.createElement("div");
		card.className = "repo-card glass-card";

		const header = document.createElement("div");
		header.className = "repo-card-header";

		const title = document.createElement("span");
		title.className = "repo-card-title";
		title.innerText = repo.name;
		header.appendChild(title);

		if (repo.size === 0) {
			const tag = document.createElement("span");
			tag.className = "repo-tag";
			tag.innerText = "EMPTY";
			header.appendChild(tag);
		}

		card.appendChild(header);

		const url = document.createElement("a");
		url.className = "repo-card-url";
		url.href = "#";
		url.innerText = repo.html_url;
		url.onclick = (e) => {
			e.preventDefault();
			OpenBrowser(repo.html_url);
		};
		card.appendChild(url);

		const actions = document.createElement("div");
		actions.className = "repo-card-actions";

		const copyBtn = document.createElement("button");
		copyBtn.className = "btn-secondary";
		copyBtn.innerText = "Copy Link";
		copyBtn.onclick = () => {
			navigator.clipboard.writeText(repo.html_url);
			copyBtn.innerText = "Copied!";
			setTimeout(() => { copyBtn.innerText = "Copy Link"; }, 2000);
		};

		const openBtn = document.createElement("button");
		openBtn.className = "btn-secondary";
		openBtn.innerText = "Mở";
		openBtn.onclick = () => {
			OpenBrowser(repo.html_url);
		};

		const deleteBtn = document.createElement("button");
		deleteBtn.className = "btn-danger";
		deleteBtn.innerText = "Xóa";
		deleteBtn.onclick = () => {
			confirmAndDeleteRepo(repo.name);
		};

		actions.appendChild(copyBtn);
		actions.appendChild(openBtn);
		actions.appendChild(deleteBtn);

		card.appendChild(actions);
		container.appendChild(card);
	});

	// Render pagination controls
	const pagControls = document.getElementById("pagination-controls");
	if (searchResults.length > searchPageSize) {
		pagControls.style.display = "flex";
		document.getElementById("page-info").innerText = `Trang ${searchCurrentPage + 1} / ${totalPages} (${searchResults.length} repo)`;
		document.getElementById("btn-prev-page").disabled = (searchCurrentPage === 0);
		document.getElementById("btn-next-page").disabled = (searchCurrentPage >= totalPages - 1);
	} else {
		pagControls.style.display = "none";
	}
}

// Confirmation prompt and repository deletion
async function confirmAndDeleteRepo(name) {
	if (!cachedDeleteKey) {
		alert("Chưa thiết lập Delete Key trong mục Cài đặt. Vui lòng cấu hình trước khi thực hiện xóa.");
		switchTab("settings-tab");
		return;
	}

	const confirmInput = prompt(`Để xác nhận xóa repository '${name}', vui lòng nhập Delete Key:`);
	if (confirmInput === null) return;

	if (confirmInput.trim() !== cachedDeleteKey.trim()) {
		alert("Delete Key không khớp! Không thể xóa repository.");
		return;
	}

	try {
		appendConsoleLog(`Đang gửi yêu cầu xóa repository: ${name}...`, "info");
		await DeleteRepo(name);
		alert(`Đã xóa thành công repository '${name}' khỏi GitHub.`);
		searchRepositories(); // Reload list
	} catch (err) {
		alert(`Xóa repository thất bại: ${err}`);
	}
}
