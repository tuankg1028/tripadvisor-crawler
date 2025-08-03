import axios from 'axios';
import { ApiResponse, Profile, BrowserData } from '../types';

const instance = axios.create({
  baseURL: process.env.ADSPOWER_BASE_URL || 'http://local.adspower.net:50325',
});

const { HIDE_CHROME = '0', ADSPOWER_GROUP_ID = '3760701' } = process.env;

async function getGroups(): Promise<ApiResponse> {
  const res = await instance.get('/api/v1/group/list');
  return res.data;
}

async function createProfile(name?: string): Promise<ApiResponse> {
  const profileName = name || `TripAdvisor_${Date.now()}`;
  const res = await instance.post('/api/v1/user/create', {
    name: profileName,
    group_id: ADSPOWER_GROUP_ID,
    user_proxy_config: { proxy_soft: 'no_proxy' },
    fingerprint_config: {
      automatic_timezone: 1,
      language: ['en-US', 'en'],
      browser_kernel_config: {
        version: 'random'
      }
    }
  });

  return res.data;
}

async function deleteProfiles(userIds: string[]): Promise<ApiResponse> {
  const res = await instance.post('/api/v1/user/delete', {
    user_ids: userIds,
  });

  return res.data;
}

async function getProfiles(): Promise<Profile[]> {
  const res = await instance.get<ApiResponse<{ list: Profile[] }>>(
    `/api/v1/user/list?group_id=${ADSPOWER_GROUP_ID}&page_size=100`
  );

  if (res.data.code !== 0) {
    throw new Error(res.data.msg);
  }

  return res.data.data?.list ?? [];
}

async function openBrowser(userId: string): Promise<{ wsEndpoint: string; debugPort: string }> {
  const res = await instance.get<ApiResponse<BrowserData>>(
    `/api/v1/browser/start?user_id=${userId}&headless=${HIDE_CHROME}`
  );

  if (res.data.code !== 0) {
    throw new Error(res.data.msg || 'Failed to start browser');
  }

  const wsEndpoint = res.data.data?.ws.puppeteer;
  const debugPort = res.data.data?.debug_port;

  if (!wsEndpoint) {
    throw new Error('No WebSocket endpoint returned');
  }

  return { 
    wsEndpoint, 
    debugPort: debugPort || '9222' 
  };
}

async function closeBrowser(userId: string): Promise<ApiResponse> {
  const res = await instance.get(`/api/v1/browser/stop?user_id=${userId}`);
  return res.data;
}

async function checkBrowserStatus(userId: string): Promise<ApiResponse> {
  const res = await instance.get(`/api/v1/browser/active?user_id=${userId}`);
  return res.data;
}

async function getOrCreateProfile(profileName?: string): Promise<Profile> {
  const profiles = await getProfiles();
  
  // Try to find existing profile
  if (profileName) {
    const existingProfile = profiles.find(p => p.name === profileName);
    if (existingProfile) {
      return existingProfile;
    }
  }

  // Create new profile if not found
  const createResult = await createProfile(profileName);
  if (createResult.code !== 0) {
    throw new Error(createResult.msg || 'Failed to create profile');
  }

  // Get the newly created profile
  const updatedProfiles = await getProfiles();
  const newProfile = updatedProfiles.find(p => 
    profileName ? p.name === profileName : p.name.startsWith('TripAdvisor_')
  );

  if (!newProfile) {
    throw new Error('Failed to find newly created profile');
  }

  return newProfile;
}

export {
  getGroups,
  createProfile,
  deleteProfiles,
  getProfiles,
  openBrowser,
  closeBrowser,
  checkBrowserStatus,
  getOrCreateProfile,
};