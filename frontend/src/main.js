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
	GetGitHubProfile,
	GetRepoLanguageStats,
	GetRepoContents,
	GetRepoReadme,
	GetTokenReport,
	GetLocalGuideHTML,
	GetMyRepos,
	StartClone,
	DetectIDEs,
	OpenInIDE,
	OpenDirectoryInExplorer
} from '../wailsjs/go/main/App';

import { EventsOn } from '../wailsjs/runtime/runtime.js';

// Global variables
let selectedFolderPath = "";
let cachedDeleteKey = "";
let currentThemeSetting = "dark";
let searchCurrentPage = 0;
let searchTotalCount = 0;
const searchPageSize = 12;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
	loadSettings();
	loadLastPushedRepo();
	setupDragAndDrop();
	setupConsoleAutoScroll();
	setupThemeSystem();
	setupGlobalLinkInterceptor();
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
			if (file.path) {
				selectedFolderPath = file.path;
				document.getElementById("folder-path-display").innerText = selectedFolderPath;
				appendConsoleLog(`Đã chọn thư mục qua kéo thả: ${selectedFolderPath}`, "info");
				checkAndTriggerAutoPush();
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
				checkAndTriggerAutoPush();
			}
		} catch (err) {
			appendConsoleLog(`Lỗi chọn thư mục: ${err}`, "error");
		}
	});
}

// Check and trigger auto-push
async function checkAndTriggerAutoPush() {
	try {
		const cfg = await GetSettings();
		if (cfg && cfg.auto_push) {
			appendConsoleLog("Chế độ Tự động Push được kích hoạt. Bắt đầu đẩy bài...", "info");
			startPushProcess();
		}
	} catch (err) {
		console.error("Lỗi kiểm tra tự động push:", err);
	}
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
	} else if (tabId === "clone-tab") {
		document.getElementById("nav-clone").classList.add("active");
		loadGitHubReposForClone();
	} else if (tabId === "search-tab") {
		document.getElementById("nav-search").classList.add("active");
		// Đảm bảo ẩn trang chi tiết, hiện trang tìm kiếm chính
		const detailView = document.getElementById("repo-detail-view");
		const listView = document.getElementById("search-list-view");
		if (detailView) detailView.style.display = "none";
		if (listView) listView.style.display = "block";
		searchRepositories();
	} else if (tabId === "settings-tab") {
		document.getElementById("nav-settings").classList.add("active");
	} else if (tabId === "report-tab") {
		document.getElementById("nav-report").classList.add("active");
		loadReportTab();
	} else if (tabId === "guide-tab") {
		document.getElementById("nav-guide").classList.add("active");
		loadGuideTab();
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
			
			// New settings fields
			document.getElementById("setting-commit-name").value = cfg.git_commit_name || "";
			document.getElementById("setting-commit-email").value = cfg.git_commit_email || "";
			document.getElementById("setting-repo-private").value = cfg.repo_private ? "true" : "false";
			document.getElementById("setting-auto-push").checked = cfg.auto_push || false;
			document.getElementById("setting-default-commit-msg").value = cfg.default_commit_msg || "init";
			
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
	
	// New fields
	const commitName = document.getElementById("setting-commit-name").value.trim();
	const commitEmail = document.getElementById("setting-commit-email").value.trim();
	const repoPrivate = document.getElementById("setting-repo-private").value === "true";
	const autoPush = document.getElementById("setting-auto-push").checked;
	const defaultCommitMsg = document.getElementById("setting-default-commit-msg").value.trim();

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
		theme_mode: theme,
		git_commit_name: commitName,
		git_commit_email: commitEmail,
		repo_private: repoPrivate,
		auto_push: autoPush,
		default_commit_msg: defaultCommitMsg || "init"
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

// Auto save theme when changed
window.onThemeChange = async function () {
	const theme = document.getElementById("setting-theme").value;
	applyThemeSetting(theme);
	try {
		const cfg = await GetSettings();
		if (cfg) {
			cfg.theme_mode = theme;
			await SaveSettings(cfg);
			showToast("Đã tự động cập nhật và lưu giao diện!", "success");
		}
	} catch (err) {
		console.error("Lỗi tự động lưu giao diện:", err);
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
			
			// Click profile card to open user's GitHub personal repositories page
			card.style.cursor = "pointer";
			card.onclick = () => {
				const username = document.getElementById("setting-username").value.trim();
				if (username) {
					OpenBrowser(`https://github.com/${username}?tab=repositories`);
				}
			};
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
		const copyBtn = document.getElementById("btn-copy-recent");

		if (repo && repo.repo_name) {
			const date = new Date(repo.pushed_at);
			const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			const dateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
			
			textEl.innerText = `${repo.repo_name} (${timeStr} - ${dateStr})`;
			openBtn.style.display = "inline-block";
			openBtn.onclick = () => {
				OpenBrowser(repo.repo_url);
			};

			if (copyBtn) {
				copyBtn.style.display = "inline-block";
				copyBtn.onclick = () => {
					navigator.clipboard.writeText(repo.repo_url);
					copyBtn.innerText = "Copied!";
					showToast("Đã copy link repository gần đây nhất!", "success");
					setTimeout(() => { copyBtn.innerText = "Copy Link"; }, 2000);
				};
			}
		} else {
			textEl.innerText = "Không có lịch sử đẩy bài gần đây.";
			openBtn.style.display = "none";
			if (copyBtn) copyBtn.style.display = "none";
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
	// Clear console immediately at the absolute beginning of push
	clearConsole();
	lastSuccessUrl = "";

	if (!selectedFolderPath) {
		appendConsoleLog("Lỗi: Vui lòng chọn hoặc kéo thả thư mục chứa bài tập.", "error");
		showToast("Vui lòng chọn thư mục bài tập!", "error");
		return;
	}

	const mode = document.getElementById("mode-selector").value;
	const sessionVal = document.getElementById("session-num").value;
	const exVal = document.getElementById("ex-num").value;
	const miniProjectVal = document.getElementById("miniproject-text").value;
	const customRepoNameVal = document.getElementById("custom-repo-name").value;
	const useDefaultCommit = document.getElementById("toggle-default-commit").checked;
	const customCommitMsg = document.getElementById("custom-commit-msg").value;

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
		appendConsoleLog("Tiến trình hoàn thành thành công!", "success");
		await loadLastPushedRepo();
		
		// Hiển thị Toast thông báo thành công thay vì hiện Modal
		showToast("Đẩy bài tập thành công!", "success");
	} catch (err) {
		updateProgressBar(0, "Thất bại");
		appendConsoleLog(`Lỗi tiến trình: ${err}`, "error");
		showToast(`Push thất bại: ${err}`, "error");
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
let lastSuccessUrl = "";
EventsOn("git_log", (msg) => {
	if (msg.includes("Đẩy bài tập thành công!")) {
		appendConsoleLog(msg, "success");
		const match = msg.match(/https?:\/\/[^\s]+/);
		if (match) {
			lastSuccessUrl = match[0];
		}
	} else {
		appendConsoleLog(msg, "info");
	}
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

window.searchRepositories = async function (goToPage = 0) {
	searchCurrentPage = goToPage;
	const queryInput = document.getElementById("search-query");
	const query = queryInput.value.trim();
	const sortBy = document.getElementById("search-sort").value;
	const container = document.getElementById("repo-list-container");
	container.innerHTML = "<div style='grid-column: 1/-1; text-align: center; color: var(--text-secondary);'>Đang tìm kiếm...</div>";
	document.getElementById("pagination-controls").style.display = "none";

	// Cập nhật text nút dựa trên query thực tế được tìm kiếm
	const actionBtn = document.getElementById("btn-search-action");
	if (query) {
		actionBtn.innerText = "Xóa";
	} else {
		actionBtn.innerText = "Tìm kiếm";
	}

	try {
		const result = await SearchRepos(query, searchCurrentPage + 1, searchPageSize, sortBy);
		searchResults = result.repos || [];
		searchTotalCount = result.total_count || 0;
		renderRepositories();
	} catch (err) {
		container.innerHTML = `<div style='grid-column: 1/-1; text-align: center; color: var(--accent-red);'>Lỗi tìm kiếm: ${err}</div>`;
	}
};

window.handleSearchAction = function () {
	const queryInput = document.getElementById("search-query");
	const actionBtn = document.getElementById("btn-search-action");
	
	if (actionBtn.innerText === "Xóa" || actionBtn.innerText === "Clear") {
		queryInput.value = "";
		actionBtn.innerText = "Tìm kiếm";
		searchRepositories(0);
	} else {
		searchRepositories(0);
	}
};

window.handleSearchKeyUp = function (e) {
	if (e.key === "Enter") {
		searchRepositories(0);
	}
};

window.prevSearchPage = function () {
	if (searchCurrentPage > 0) {
		searchRepositories(searchCurrentPage - 1);
	}
};

window.nextSearchPage = function () {
	const totalPages = Math.ceil(searchTotalCount / searchPageSize);
	if (searchCurrentPage < totalPages - 1) {
		searchRepositories(searchCurrentPage + 1);
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

	const totalPages = Math.ceil(searchTotalCount / searchPageSize);
	const pageItems = searchResults;

	pageItems.forEach(repo => {
		const card = document.createElement("div");
		card.className = "repo-card glass-card";

		const header = document.createElement("div");
		header.className = "repo-card-header";

		const title = document.createElement("span");
		title.className = "repo-card-title";
		title.innerText = repo.name;
		title.style.cursor = "pointer";
		title.onclick = (e) => {
			e.preventDefault();
			enterRepoDetail(repo);
		};
		header.appendChild(title);

		// Calculate EMPTY / NEW tag dynamically based on DefaultBranch and PushedAt
		let tagText = "";
		let tagClass = "";
		if (!repo.default_branch) {
			tagText = "EMPTY";
			tagClass = "repo-tag empty-tag";
		} else {
			const pushedAtStr = repo.pushed_at;
			if (pushedAtStr) {
				const pushedAt = new Date(pushedAtStr);
				const now = new Date();
				const diffHours = (now - pushedAt) / (1000 * 60 * 60);
				if (diffHours < 24) {
					tagText = "NEW";
					tagClass = "repo-tag new-tag";
				}
			}
		}

		if (tagText) {
			const tag = document.createElement("span");
			tag.className = tagClass;
			tag.innerText = tagText;
			header.appendChild(tag);
		}

		card.appendChild(header);

		// Render language badge (lazy loaded)
		const langBadge = document.createElement("span");
		langBadge.className = "repo-lang-badge";
		langBadge.id = `lang-badge-${repo.name}`;
		langBadge.innerText = "Loading...";
		card.appendChild(langBadge);

		GetRepoLanguageStats(repo.name).then(lang => {
			const el = document.getElementById(`lang-badge-${repo.name}`);
			if (el) el.innerText = lang || "N/A";
		}).catch(() => {
			const el = document.getElementById(`lang-badge-${repo.name}`);
			if (el) el.innerText = "N/A";
		});

		const url = document.createElement("a");
		url.className = "repo-card-url";
		url.href = "#";
		url.innerText = repo.html_url;
		url.onclick = (e) => {
			e.preventDefault();
			enterRepoDetail(repo);
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

		const detailBtn = document.createElement("button");
		detailBtn.className = "btn-secondary";
		detailBtn.innerText = "Chi tiết";
		detailBtn.onclick = () => {
			enterRepoDetail(repo);
		};

		const deleteBtn = document.createElement("button");
		deleteBtn.className = "btn-danger";
		deleteBtn.innerText = "Xóa";
		deleteBtn.onclick = () => {
			confirmAndDeleteRepo(repo.name);
		};

		actions.appendChild(copyBtn);
		actions.appendChild(detailBtn);
		actions.appendChild(deleteBtn);

		card.appendChild(actions);
		container.appendChild(card);
	});

	// Render pagination controls
	const pagControls = document.getElementById("pagination-controls");
	if (searchTotalCount > searchPageSize) {
		pagControls.style.display = "flex";
		document.getElementById("page-info").innerText = `Trang ${searchCurrentPage + 1} / ${totalPages} (${searchTotalCount} repo)`;
		document.getElementById("btn-prev-page").disabled = (searchCurrentPage === 0);
		document.getElementById("btn-next-page").disabled = (searchCurrentPage >= totalPages - 1);
	} else {
		pagControls.style.display = "none";
	}
}

// Confirmation prompt and repository deletion
window.confirmAndDeleteRepo = function (name) {
	if (!cachedDeleteKey) {
		showToast("Chưa thiết lập Delete Key trong mục Cài đặt!", "error");
		switchTab("settings-tab");
		return;
	}

	const modal = document.getElementById("delete-confirm-modal");
	const repoNameSpan = document.getElementById("delete-confirm-repo-name");
	const inputEl = document.getElementById("delete-confirm-input");
	const confirmBtn = document.getElementById("btn-confirm-delete-action");

	repoNameSpan.innerText = name;
	inputEl.value = "";
	modal.style.display = "flex";
	inputEl.focus();

	confirmBtn.onclick = async () => {
		const enteredKey = inputEl.value;
		if (enteredKey.trim() !== cachedDeleteKey.trim()) {
			showToast("Delete Key không khớp! Không thể xóa repository.", "error");
			return;
		}

		modal.style.display = "none";
		try {
			appendConsoleLog(`Đang gửi yêu cầu xóa repository: ${name}...`, "info");
			await DeleteRepo(name);
			showToast(`Đã xóa thành công repository '${name}' khỏi GitHub.`, "success");
			searchRepositories(searchCurrentPage); // Reload list
		} catch (err) {
			showToast(`Xóa repository thất bại: ${err}`, "error");
		}
	};
};

window.closeDeleteConfirmModal = function () {
	document.getElementById("delete-confirm-modal").style.display = "none";
};

window.toggleDeleteConfirmVisibility = function () {
	const inputEl = document.getElementById("delete-confirm-input");
	inputEl.type = inputEl.type === "password" ? "text" : "password";
};

// Toast Notification System
window.showToast = function (message, type = "info") {
	let container = document.getElementById("toast-container");
	if (!container) {
		container = document.createElement("div");
		container.id = "toast-container";
		container.className = "toast-container";
		document.body.appendChild(container);
	}

	const toast = document.createElement("div");
	toast.className = `toast-item glass-card ${type}`;

	let icon = "";
	if (type === "success") {
		icon = `<svg class="toast-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
	} else if (type === "error") {
		icon = `<svg class="toast-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
	} else {
		icon = `<svg class="toast-icon info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
	}

	toast.innerHTML = `
		${icon}
		<span class="toast-message">${message}</span>
		<button class="toast-close-btn">&times;</button>
	`;

	container.appendChild(toast);

	// Close event
	toast.querySelector(".toast-close-btn").onclick = () => {
		toast.classList.add("fade-out");
		setTimeout(() => toast.remove(), 300);
	};

	// Auto remove
	setTimeout(() => {
		if (toast.parentNode) {
			toast.classList.add("fade-out");
			setTimeout(() => toast.remove(), 300);
		}
	}, 4000);
};

// Success Modal Overlay Logic
window.showSuccessPopup = function (url) {
	const modal = document.getElementById("success-modal");
	const urlDisplay = document.getElementById("success-modal-url");
	const copyBtn = document.getElementById("success-modal-copy-btn");
	const openBtn = document.getElementById("success-modal-open-btn");

	if (!modal || !urlDisplay) return;

	urlDisplay.innerText = url;
	modal.style.display = "flex";

	copyBtn.onclick = () => {
		navigator.clipboard.writeText(url);
		copyBtn.innerText = "Copied!";
		showToast("Đã copy link repository vào clipboard!", "success");
		setTimeout(() => {
			copyBtn.innerText = "Copy Link";
		}, 2000);
	};

	openBtn.onclick = () => {
		OpenBrowser(url);
	};
};

window.closeSuccessModal = function () {
	const modal = document.getElementById("success-modal");
	if (modal) modal.style.display = "none";
};

// --- REPOSITORY DETAIL VIEW & DIRECTORY EXPLORER ---
let activeRepo = null;
let repoExplorerPath = "";

window.enterRepoDetail = function (repo) {
	activeRepo = repo;
	repoExplorerPath = "";

	// Chuyển đổi giao diện sub-view
	document.getElementById("search-list-view").style.display = "none";
	document.getElementById("repo-detail-view").style.display = "block";

	// Cập nhật metadata
	document.getElementById("detail-repo-name").innerText = repo.name;
	document.getElementById("detail-repo-visibility").innerText = repo.private ? "Private" : "Public";
	document.getElementById("detail-repo-visibility").className = repo.private ? "repo-tag private-tag" : "repo-tag";

	document.getElementById("detail-repo-desc").innerText = repo.description || "Không có mô tả.";
	document.getElementById("detail-repo-stars").innerText = `⭐ ${repo.stargazers_count || 0} stars`;
	document.getElementById("detail-repo-forks").innerText = `🍴 ${repo.forks_count || 0} forks`;
	document.getElementById("detail-repo-watchers").innerText = `👁 ${repo.watchers_count || 0} watchers`;
	document.getElementById("detail-repo-size").innerText = `📦 ${formatBytes(repo.size * 1024)}`;

	document.getElementById("btn-open-in-github").onclick = () => {
		OpenBrowser(repo.html_url);
	};

	if (repo.language) {
		document.getElementById("detail-repo-lang").innerText = `🌐 Ngôn ngữ chính: ${repo.language}`;
	} else {
		document.getElementById("detail-repo-lang").innerText = `🌐 Ngôn ngữ chính: N/A`;
	}

	loadRepoFiles();
	loadRepoReadme();
};

window.hideRepoDetail = function () {
	document.getElementById("repo-detail-view").style.display = "none";
	document.getElementById("search-list-view").style.display = "block";
	activeRepo = null;
};

async function loadRepoFiles() {
	const tbody = document.getElementById("files-table-body");
	const pathDisplay = document.getElementById("explorer-current-path");

	pathDisplay.innerText = repoExplorerPath === "" ? "root" : `root / ${repoExplorerPath}`;
	tbody.innerHTML = "<tr><td colspan='3' style='text-align: center; color: var(--text-secondary);'>Đang tải danh sách tập tin...</td></tr>";

	try {
		const contents = await GetRepoContents(activeRepo.name, repoExplorerPath);
		tbody.innerHTML = "";

		// Thêm dòng quay lại ".." nếu đang duyệt thư mục con
		if (repoExplorerPath !== "") {
			const tr = document.createElement("tr");
			tr.className = "clickable";
			tr.onclick = () => {
				const parts = repoExplorerPath.split("/");
				parts.pop();
				repoExplorerPath = parts.join("/");
				loadRepoFiles();
			};
			tr.innerHTML = `
				<td style="font-weight: bold; color: var(--accent-blue);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px; margin-right:8px; display:inline-block; vertical-align:middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>.. (Thư mục cha)</td>
				<td style="color: var(--text-muted);">dir</td>
				<td style="text-align: right; color: var(--text-muted);">-</td>
			`;
			tbody.appendChild(tr);
		}

		if (!contents || contents.length === 0) {
			const tr = document.createElement("tr");
			tr.innerHTML = "<td colspan='3' style='text-align: center; color: var(--text-muted);'>Thư mục này trống.</td>";
			tbody.appendChild(tr);
			return;
		}

		// Sắp xếp thư mục lên trên, file xuống dưới
		contents.sort((a, b) => {
			if (a.type === b.type) return a.name.localeCompare(b.name);
			return a.type === "dir" ? -1 : 1;
		});

		contents.forEach(item => {
			const tr = document.createElement("tr");
			const isDir = item.type === "dir";

			if (isDir) {
				tr.className = "clickable";
				tr.onclick = () => {
					repoExplorerPath = repoExplorerPath === "" ? item.name : `${repoExplorerPath}/${item.name}`;
					loadRepoFiles();
				};
			}

			// Tạo icon SVGs giống thật
			let icon = "";
			if (isDir) {
				icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px; margin-right:8px; display:inline-block; vertical-align:middle; color: var(--accent-purple);"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.31c-.427 0-.838.169-1.14.47l-1.55 1.55z" /></svg>`;
			} else {
				icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px; margin-right:8px; display:inline-block; vertical-align:middle; color: var(--text-secondary);"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`;
			}

			tr.innerHTML = `
				<td>${icon} ${item.name}</td>
				<td style="color: var(--text-secondary);">${item.type}</td>
				<td style="text-align: right; color: var(--text-secondary);">${isDir ? "-" : formatBytes(item.size)}</td>
			`;
			tbody.appendChild(tr);
		});
	} catch (err) {
		tbody.innerHTML = `<tr><td colspan='3' style='text-align: center; color: var(--accent-red);'>Lỗi tải danh sách tập tin: ${err}</td></tr>`;
	}
}

async function loadRepoReadme() {
	const readmeContainer = document.getElementById("detail-readme-container");
	const readmeContent = document.getElementById("detail-readme-content");

	readmeContainer.style.display = "block";
	readmeContent.innerHTML = "<span style='color: var(--text-secondary);'>Đang tải README.md...</span>";

	try {
		const html = await GetRepoReadme(activeRepo.name);
		if (html) {
			readmeContent.innerHTML = html;
		} else {
			readmeContent.innerHTML = "<div style='color: var(--text-muted); text-align: center;'>Không có tệp README.md.</div>";
		}
	} catch (err) {
		readmeContent.innerHTML = `<div style='color: var(--accent-red);'>Lỗi tải README.md: ${err}</div>`;
	}
}

// --- DIAGNOSTICS & ACCOUNT REPORT VIEW ---
window.loadReportTab = async function () {
	const loading = document.getElementById("report-loading");
	const dataContainer = document.getElementById("report-data");

	loading.style.display = "block";
	dataContainer.style.display = "none";

	try {
		const r = await GetTokenReport();
		loading.style.display = "none";
		dataContainer.style.display = "grid";

		dataContainer.innerHTML = `
			<!-- Card 1: Token Permissions -->
			<div class="glass-card report-card-item">
				<h3>Quyền hạn Token (Scopes)</h3>
				<div class="scope-status-list">
					<div class="scope-status-item">
						<span class="status-icon ${r.has_repo_scope ? 'green' : 'red'}">${r.has_repo_scope ? '✓' : '✗'}</span>
						<div class="scope-desc">
							<strong>repo</strong>
							<span>Quyền tạo và truy cập kho lưu trữ (Bắt buộc)</span>
						</div>
					</div>
					<div class="scope-status-item">
						<span class="status-icon ${r.has_delete_scope ? 'green' : 'yellow'}">${r.has_delete_scope ? '✓' : '⚠'}</span>
						<div class="scope-desc">
							<strong>delete_repo</strong>
							<span>Quyền xóa kho lưu trữ (Cần cho tính năng Xóa)</span>
						</div>
					</div>
					<div class="scope-status-item">
						<span class="status-icon ${r.has_org_scope ? 'green' : 'info'}">${r.has_org_scope ? '✓' : 'ℹ'}</span>
						<div class="scope-desc">
							<strong>admin:org / write:org</strong>
							<span>Quyền quản lý tổ chức (Tùy chọn)</span>
						</div>
					</div>
				</div>
				<div class="raw-scopes">
					<strong>Danh sách Scope hiện tại:</strong>
					<code>${r.scopes.join(', ') || 'không có scope'}</code>
				</div>
			</div>
			
			<!-- Card 2: API Limit -->
			<div class="glass-card report-card-item">
				<h3>Giới hạn API GitHub</h3>
				<div class="rate-limit-display">
					<div class="rate-limit-circle">
						<span class="rate-val">${r.rate_remaining} / ${r.rate_limit}</span>
						<span class="rate-lbl">Còn lại</span>
					</div>
					<div class="rate-details">
						<p><strong>Thời gian Reset:</strong> ${r.rate_reset}</p>
						<p>Token cá nhân (PAT) được hưởng 5,000 yêu cầu mỗi giờ để đảm bảo hoạt động mượt mà.</p>
					</div>
				</div>
			</div>

			<!-- Card 3: Account Stats -->
			<div class="glass-card report-card-item" style="grid-column: 1 / -1;">
				<h3>Thông tin Tài khoản & Kho lưu trữ</h3>
				<div class="stats-grid">
					<div class="stat-box">
						<span class="stat-num">${r.public_repos}</span>
						<span class="stat-lbl">Public Repos</span>
					</div>
					<div class="stat-box">
						<span class="stat-num">${r.private_repos}</span>
						<span class="stat-lbl">Private Repos</span>
					</div>
					<div class="stat-box">
						<span class="stat-num">${formatBytes(r.disk_usage * 1024)}</span>
						<span class="stat-lbl">Dung lượng đã dùng</span>
					</div>
					<div class="stat-box">
						<span class="stat-num" style="text-transform: capitalize;">${r.plan_name || 'Free'}</span>
						<span class="stat-lbl">Gói dịch vụ</span>
					</div>
					<div class="stat-box">
						<span class="stat-num">${r.two_factor_authentication ? 'Đã bật' : 'Chưa bật'}</span>
						<span class="stat-lbl">Xác thực 2FA</span>
					</div>
				</div>
			</div>
		`;
	} catch (err) {
		loading.style.display = "none";
		dataContainer.style.display = "block";
		dataContainer.innerHTML = `<div style="color: var(--accent-red); text-align: center; padding: 20px;">Lỗi tải báo cáo chẩn đoán: ${err}</div>`;
	}
};

// Utilities
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// --- CLONE REPOSITORY LOGIC ---
let cloneSelectedFolderPath = "";

let cloneSourceType = "github";

window.setCloneSource = function (type) {
	cloneSourceType = type;
	const btnGithub = document.getElementById("btn-clone-src-github");
	const btnCustom = document.getElementById("btn-clone-src-custom");
	const githubGroup = document.getElementById("clone-github-group");
	const customGroup = document.getElementById("clone-custom-group");

	if (type === "github") {
		btnGithub.classList.add("active");
		btnCustom.classList.remove("active");
		githubGroup.style.display = "flex";
		customGroup.style.display = "none";
	} else {
		btnGithub.classList.remove("active");
		btnCustom.classList.add("active");
		githubGroup.style.display = "none";
		customGroup.style.display = "flex";
	}
};

window.loadGitHubReposForClone = async function () {
	const selectEl = document.getElementById("clone-repo-select");
	selectEl.innerHTML = "<option value=''>-- Đang tải danh sách repo --</option>";

	try {
		const repos = await GetMyRepos();
		selectEl.innerHTML = "";

		if (!repos || repos.length === 0) {
			selectEl.innerHTML = "<option value=''>Không tìm thấy repository nào</option>";
			return;
		}

		repos.forEach(repo => {
			const opt = document.createElement("option");
			opt.value = repo.html_url;
			opt.innerText = `${repo.name} (${repo.private ? 'Private' : 'Public'})`;
			selectEl.appendChild(opt);
		});
	} catch (err) {
		console.error("Lỗi tải danh sách repo cho clone:", err);
		selectEl.innerHTML = `<option value=''>Lỗi tải danh sách: ${err}</option>`;
	}
};

window.selectCloneDestination = async function () {
	try {
		const path = await SelectDirectory();
		if (path) {
			cloneSelectedFolderPath = path;
			document.getElementById("clone-dest-path").value = cloneSelectedFolderPath;
			appendCloneConsoleLog(`Đã chọn thư mục lưu trữ: ${cloneSelectedFolderPath}`, "info");
		}
	} catch (err) {
		appendCloneConsoleLog(`Lỗi chọn thư mục: ${err}`, "error");
	}
};

window.clearCloneConsole = function () {
	const consoleEl = document.getElementById("clone-console-output");
	if (consoleEl) consoleEl.innerHTML = "";
};

function appendCloneConsoleLog(msg, type = "info") {
	const consoleEl = document.getElementById("clone-console-output");
	if (!consoleEl) return;

	const line = document.createElement("div");
	line.className = `console-line ${type}`;
	line.innerText = msg;
	consoleEl.appendChild(line);

	consoleEl.scrollTop = consoleEl.scrollHeight;
}

window.startCloneProcess = async function () {
	clearCloneConsole();
	document.getElementById("clone-success-ide-actions").style.display = "none";

	// Determine repo URL
	const sourceType = cloneSourceType;
	let repoURL = "";

	if (sourceType === "github") {
		repoURL = document.getElementById("clone-repo-select").value;
		if (!repoURL) {
			showToast("Vui lòng chọn một repository từ danh sách!", "error");
			appendCloneConsoleLog("Lỗi: Chưa chọn repository để clone.", "error");
			return;
		}
	} else {
		repoURL = document.getElementById("clone-repo-url").value.trim();
		if (!repoURL) {
			showToast("Vui lòng nhập link clone repository!", "error");
			appendCloneConsoleLog("Lỗi: Link clone trống.", "error");
			return;
		}
	}

	if (!cloneSelectedFolderPath) {
		showToast("Vui lòng chọn thư mục lưu trữ!", "error");
		appendCloneConsoleLog("Lỗi: Chưa chọn thư mục lưu trữ.", "error");
		return;
	}

	// We should extract the repository name to create a subfolder
	let repoName = "";
	const match = repoURL.match(/\/([^/]+)\.git$/);
	if (match) {
		repoName = match[1];
	} else {
		const parts = repoURL.split("/");
		repoName = parts[parts.length - 1];
	}
	repoName = repoName.replace(/[^a-zA-Z0-9._-]/g, ""); // sanitize name

	const targetFolderPath = cloneSelectedFolderPath + "/" + repoName;

	updateCloneProgressBar(0, "Đang chuẩn bị...");
	setCloneBusyState(true);

	appendCloneConsoleLog(`Khởi động tiến trình clone. Link: ${repoURL}`, "info");
	appendCloneConsoleLog(`Thư mục đích: ${targetFolderPath}`, "info");

	try {
		await StartClone(repoURL, targetFolderPath);
		updateCloneProgressBar(100, "Hoàn tất!");
		showToast("Clone repository thành công!", "success");

		// Run IDE detection
		runIDEDetection(targetFolderPath);
	} catch (err) {
		updateCloneProgressBar(0, "Thất bại");
		appendCloneConsoleLog(`Lỗi tiến trình clone: ${err}`, "error");
		showToast(`Clone thất bại: ${err}`, "error");
	} finally {
		setCloneBusyState(false);
	}
};

window.cancelCloneProcess = function () {
	// git clone cancellation placeholder
};

function setCloneBusyState(busy) {
	document.getElementById("btn-clone-start").disabled = busy;
	document.getElementById("clone-repo-select").disabled = busy;
	document.getElementById("clone-repo-url").disabled = busy;
	document.querySelectorAll(".segment-btn").forEach(btn => btn.disabled = busy);
}

function updateCloneProgressBar(percent, text) {
	const bar = document.getElementById("clone-progress-bar");
	const pctText = document.getElementById("clone-progress-percent");
	const statusText = document.getElementById("clone-progress-text");

	if (bar) bar.style.width = `${percent}%`;
	if (pctText) pctText.innerText = `${percent}%`;
	if (statusText && text) statusText.innerText = text;
}

// Bind clone logs from Go backend
EventsOn("clone_log", (msg) => {
	appendCloneConsoleLog(msg, "info");
});

EventsOn("clone_progress", (percent) => {
	let statusText = "Đang tải dữ liệu...";
	if (percent <= 20) statusText = "Đang kết nối...";
	else if (percent >= 95) statusText = "Giải nén dữ liệu...";
	updateCloneProgressBar(percent, statusText);
});

async function runIDEDetection(folderPath) {
	const ideContainer = document.getElementById("ide-buttons-container");
	const panel = document.getElementById("clone-success-ide-actions");
	ideContainer.innerHTML = "";

	try {
		const ides = await DetectIDEs();
		
		// Always show Open in Windows Explorer button
		const explorerBtn = document.createElement("button");
		explorerBtn.className = "ide-btn explorer";
		explorerBtn.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.31c-.427 0-.838.169-1.14.47l-1.55 1.55z" /></svg>
			Mở Thư Mục
		`;
		explorerBtn.onclick = () => {
			OpenDirectoryInExplorer(folderPath);
		};
		ideContainer.appendChild(explorerBtn);

		if (ides && ides.length > 0) {
			ides.forEach(ide => {
				const btn = document.createElement("button");
				let ideClass = "vscode";
				if (ide.name === "IntelliJ IDEA") ideClass = "intellij";
				else if (ide.name === "Cursor") ideClass = "cursor-ide";
				else if (ide.name === "Antigravity") ideClass = "antigravity";

				btn.className = `ide-btn ${ideClass}`;
				btn.innerHTML = `
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
					Mở bằng ${ide.name}
				`;
				btn.onclick = () => {
					OpenInIDE(ide.path, folderPath).then(() => {
						showToast(`Đã mở dự án bằng ${ide.name}`, "success");
					}).catch(err => {
						showToast(`Không thể mở IDE: ${err}`, "error");
					});
				};
				ideContainer.appendChild(btn);
			});
		}

		panel.style.display = "block";
	} catch (err) {
		console.error("Lỗi phát hiện IDE:", err);
	}
}

// --- USER GUIDE TAB LOGIC ---
window.loadGuideTab = async function () {
	const contentEl = document.getElementById("guide-tab-content");
	contentEl.innerHTML = "<span style='color: var(--text-secondary);'>Đang tải tài liệu hướng dẫn sử dụng...</span>";

	try {
		const html = await GetLocalGuideHTML();
		if (html) {
			renderGuideSections(html);
		} else {
			contentEl.innerHTML = "<div style='color: var(--text-muted); text-align: center;'>Tài liệu hướng dẫn trống.</div>";
		}
	} catch (err) {
		contentEl.innerHTML = `<div style='color: var(--accent-red);'>Lỗi tải tài liệu: ${err}</div>`;
	}
};

function renderGuideSections(html) {
	const tempDiv = document.createElement("div");
	tempDiv.innerHTML = html;

	const sections = [];
	let currentSection = {
		title: "Tổng quan",
		content: document.createElement("div")
	};
	sections.push(currentSection);

	Array.from(tempDiv.childNodes).forEach(node => {
		if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "H2") {
			currentSection = {
				title: node.innerText.replace(/^\d+\.\s*/, ""), // Bỏ số thứ tự đầu dòng
				content: document.createElement("div")
			};
			sections.push(currentSection);
		} else {
			currentSection.content.appendChild(node.cloneNode(true));
		}
	});

	// Khởi dựng lại giao diện của guide-tab-content
	const container = document.getElementById("guide-tab-content");
	container.innerHTML = "";

	// Thanh công cụ tab nằm ngang
	const menu = document.createElement("div");
	menu.className = "guide-sub-menu";

	// Vùng nội dung hiển thị bên dưới
	const contentPane = document.createElement("div");
	contentPane.className = "guide-sub-content readme-content";
	contentPane.style.userSelect = "text";

	sections.forEach((sec, idx) => {
		const btn = document.createElement("button");
		btn.className = "menu-btn";
		btn.innerText = sec.title;
		
		if (idx === 0) {
			btn.classList.add("active");
			contentPane.appendChild(sec.content);
		}

		btn.onclick = () => {
			menu.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
			btn.classList.add("active");
			contentPane.innerHTML = "";
			contentPane.appendChild(sec.content);
		};

		menu.appendChild(btn);
	});

	container.appendChild(menu);
	container.appendChild(contentPane);
}

function setupGlobalLinkInterceptor() {
	document.addEventListener("click", (e) => {
		const target = e.target.closest("a");
		if (target && target.href) {
			const href = target.getAttribute("href");
			if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
				e.preventDefault();
				OpenBrowser(href);
			}
		}
	});
}


