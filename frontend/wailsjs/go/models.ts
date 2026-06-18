export namespace config {
	
	export class AppConfig {
	    github_token: string;
	    github_username: string;
	    github_org_name: string;
	    naming_pattern: string;
	    delete_key: string;
	    theme_mode: string;
	
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
	    }
	}

}

export namespace github {
	
	export class GitHubProfile {
	    avatar_url: string;
	    name: string;
	    bio: string;
	    followers: number;
	    public_repos: number;
	
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
	    }
	}
	export class RepositoryInfo {
	    name: string;
	    html_url: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new RepositoryInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.html_url = source["html_url"];
	        this.size = source["size"];
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

