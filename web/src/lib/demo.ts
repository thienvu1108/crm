const KEY = 'mayhomes-demo-v1';

export function loadDemo() {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		/* ignore */
	}
	const data = {
		customers: [
			{
				id: 'demo-1',
				name: 'Nguyễn Minh An',
				phone: '0901234567',
				stage: 'consulting',
				interest: 'high',
				area: 'Quận 7',
				budget: 3.5,
				source: 'Demo'
			}
		],
		tasks: [],
		activities: [],
		workspace: { id: 'demo', name: 'Không gian trải nghiệm', active: true }
	};
	localStorage.setItem(KEY, JSON.stringify(data));
	return data;
}

export function saveDemo(data: unknown) {
	localStorage.setItem(KEY, JSON.stringify(data));
}
