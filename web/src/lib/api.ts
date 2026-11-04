export type MeResponse = {
	user: { id: string; name: string; email: string; role: string; platformAdmin: boolean; workspaceName?: string };
	workspaceId: string;
	workspaceActive: boolean | null;
	workspaces: Array<{ id: string; name: string; slug: string; active: boolean; role: string }>;
};

export type CrmData = {
	customers: any[];
	tasks: any[];
	activities: any[];
	members: any[];
	connections: any[];
	workspace?: { id: string; name: string; active: boolean };
	settings?: { name?: string };
};

async function parse(res: Response) {
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || 'Yêu cầu thất bại.');
	return data;
}

export async function apiConfig() {
	const res = await fetch('/api/config', { credentials: 'include' });
	if (res.status === 503) return { mode: 'demo', server: false, googleReady: false };
	return parse(res);
}

export async function apiMe(): Promise<MeResponse> {
	return parse(await fetch('/api/me', { credentials: 'include' }));
}

export async function apiData(workspaceId: string): Promise<CrmData> {
	return parse(
		await fetch('/api/data', {
			credentials: 'include',
			headers: { 'x-workspace-id': workspaceId }
		})
	);
}

export async function apiJson(path: string, workspaceId: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers || {});
	headers.set('x-workspace-id', workspaceId);
	if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
	return parse(await fetch(path, { ...init, credentials: 'include', headers }));
}

export function loginUrl() {
	return '/auth/google/start';
}
