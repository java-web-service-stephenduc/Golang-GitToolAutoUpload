export namespace config {
	
	export class AppConfig {
	    github_token: string;
	    github_username: string;
	    github_org_name: string;
	    naming_pattern: string;
	    delete_key: string;
	    theme_mode: string;
	    git_commit_name: string;
	    git_commit_email: string;
	    repo_private: boolean;
	    auto_push: boolean;
	    default_commit_msg: string;
	    ai_api_key: string;
	    ai_model: string;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.github_token = source["github_token"];
	        this.github_username = source["github_username"];
	        this.github_org_name = source["github_org_name"];
	        this.naming_pattern = source["naming_pattern"];
	        this.delete_key = source["delete_key"];
	        this.theme_mode = source["theme_mode"];
	        this.git_commit_name = source["git_commit_name"];
	        this.git_commit_email = source["git_commit_email"];
	        this.repo_private = source["repo_private"];
	        this.auto_push = source["auto_push"];
	        this.default_commit_msg = source["default_commit_msg"];
	        this.ai_api_key = source["ai_api_key"];
	        this.ai_model = source["ai_model"];
	    }
	}

}

export namespace github {
	
	export class ContentInfo {
	    name: string;
	    path: string;
	    type: string;
	    size: number;
	    download_url: string;
	
	    static createFrom(source: any = {}) {
	        return new ContentInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.type = source["type"];
	        this.size = source["size"];
	        this.download_url = source["download_url"];
	    }
	}
	export class FileContentInfo {
	    name: string;
	    path: string;
	    sha: string;
	    size: number;
	    content: string;
	    encoding: string;
	
	    static createFrom(source: any = {}) {
	        return new FileContentInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.sha = source["sha"];
	        this.size = source["size"];
	        this.content = source["content"];
	        this.encoding = source["encoding"];
	    }
	}
	export class GitHubProfile {
	    avatar_url: string;
	    name: string;
	    bio: string;
	    followers: number;
	    public_repos: number;
	    total_private_repos: number;
	
	    static createFrom(source: any = {}) {
	        return new GitHubProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.avatar_url = source["avatar_url"];
	        this.name = source["name"];
	        this.bio = source["bio"];
	        this.followers = source["followers"];
	        this.public_repos = source["public_repos"];
	        this.total_private_repos = source["total_private_repos"];
	    }
	}
	export class RepositoryInfo {
	    name: string;
	    html_url: string;
	    size: number;
	    description: string;
	    stargazers_count: number;
	    forks_count: number;
	    watchers_count: number;
	    private: boolean;
	    created_at: string;
	    updated_at: string;
	    pushed_at: string;
	    default_branch: string;
	
	    static createFrom(source: any = {}) {
	        return new RepositoryInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.html_url = source["html_url"];
	        this.size = source["size"];
	        this.description = source["description"];
	        this.stargazers_count = source["stargazers_count"];
	        this.forks_count = source["forks_count"];
	        this.watchers_count = source["watchers_count"];
	        this.private = source["private"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	        this.pushed_at = source["pushed_at"];
	        this.default_branch = source["default_branch"];
	    }
	}
	export class TokenReport {
	    scopes: string[];
	    rate_limit: number;
	    rate_remaining: number;
	    rate_reset: string;
	    public_repos: number;
	    private_repos: number;
	    disk_usage: number;
	    plan_name: string;
	    two_factor_authentication: boolean;
	    has_repo_scope: boolean;
	    has_delete_scope: boolean;
	    has_org_scope: boolean;
	    username: string;
	    avatar_url: string;
	    email: string;
	
	    static createFrom(source: any = {}) {
	        return new TokenReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.scopes = source["scopes"];
	        this.rate_limit = source["rate_limit"];
	        this.rate_remaining = source["rate_remaining"];
	        this.rate_reset = source["rate_reset"];
	        this.public_repos = source["public_repos"];
	        this.private_repos = source["private_repos"];
	        this.disk_usage = source["disk_usage"];
	        this.plan_name = source["plan_name"];
	        this.two_factor_authentication = source["two_factor_authentication"];
	        this.has_repo_scope = source["has_repo_scope"];
	        this.has_delete_scope = source["has_delete_scope"];
	        this.has_org_scope = source["has_org_scope"];
	        this.username = source["username"];
	        this.avatar_url = source["avatar_url"];
	        this.email = source["email"];
	    }
	}

}

export namespace history {
	
	export class PushedRepo {
	    repo_name: string;
	    repo_url: string;
	    pushed_at: string;
	    local_path: string;
	
	    static createFrom(source: any = {}) {
	        return new PushedRepo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.repo_name = source["repo_name"];
	        this.repo_url = source["repo_url"];
	        this.pushed_at = source["pushed_at"];
	        this.local_path = source["local_path"];
	    }
	}

}

export namespace main {
	
	export class AppContext {
	    config?: config.AppConfig;
	    last_pushed_repo?: history.PushedRepo;
	    git_available: boolean;
	    github_profile?: github.GitHubProfile;
	    platform: string;
	
	    static createFrom(source: any = {}) {
	        return new AppContext(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.config = this.convertValues(source["config"], config.AppConfig);
	        this.last_pushed_repo = this.convertValues(source["last_pushed_repo"], history.PushedRepo);
	        this.git_available = source["git_available"];
	        this.github_profile = this.convertValues(source["github_profile"], github.GitHubProfile);
	        this.platform = source["platform"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ChatMessage {
	    role: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new ChatMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.content = source["content"];
	    }
	}
	export class IDEInfo {
	    name: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new IDEInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	    }
	}
	export class SearchReposResponse {
	    repos: github.RepositoryInfo[];
	    total_count: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchReposResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.repos = this.convertValues(source["repos"], github.RepositoryInfo);
	        this.total_count = source["total_count"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class VoiceResult {
	    action: string;
	    params: Record<string, string>;
	    response: string;
	
	    static createFrom(source: any = {}) {
	        return new VoiceResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.action = source["action"];
	        this.params = source["params"];
	        this.response = source["response"];
	    }
	}

}

