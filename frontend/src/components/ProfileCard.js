// GitHub profile card component
import { GetGitHubProfile } from '../../wailsjs/go/main/App';

export async function loadGitHubProfile() {
  try {
    const profile = await GetGitHubProfile();
    const card = document.getElementById('github-profile-card');
    if (profile && profile.avatar_url) {
      document.getElementById('profile-avatar').src = profile.avatar_url;
      document.getElementById('profile-name').innerText = profile.name || profile.bio || 'GitHub User';
      document.getElementById('profile-followers').innerText = `Followers: ${profile.followers} • Repos: ${profile.public_repos}`;
      card.style.display = 'flex';
      card.style.cursor = 'pointer';
      card.onclick = async () => {
        const { OpenBrowser } = await import('../../wailsjs/go/main/App');
        const username = document.getElementById('setting-username').value.trim();
        if (username) OpenBrowser(`https://github.com/${username}?tab=repositories`);
      };
    } else {
      card.style.display = 'none';
    }
  } catch (err) {
    console.log('Không thể nạp hồ sơ GitHub:', err);
    const card = document.getElementById('github-profile-card');
    if (card) card.style.display = 'none';
  }
}
