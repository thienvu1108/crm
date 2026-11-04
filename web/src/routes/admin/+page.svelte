<script lang="ts">
	import { onMount } from 'svelte';
	import { apiJson, apiMe } from '#lib/api';

	let workspaces = $state<any[]>([]);
	let form = $state({ name: '', slug: '', owner_email: '' });
	let msg = $state('');
	let workspaceId = $state('');

	onMount(async () => {
		const me = await apiMe();
		if (!me.user.platformAdmin) {
			msg = 'Chỉ quản trị nền tảng được truy cập.';
			return;
		}
		workspaceId = me.workspaceId;
		workspaces = await apiJson('/api/platform/workspaces', me.workspaceId || '00000000-0000-4000-8000-000000000000', { method: 'GET' }).catch(async () => {
			// platform GET does not need workspace header strictly; use fetch
			const res = await fetch('/api/platform/workspaces', { credentials: 'include' });
			return res.json();
		});
		if (!Array.isArray(workspaces)) workspaces = [];
	});

	async function refresh() {
		const res = await fetch('/api/platform/workspaces', { credentials: 'include' });
		workspaces = await res.json();
	}

	async function createWs() {
		msg = '';
		const res = await fetch('/api/platform/workspaces', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(form)
		});
		const data = await res.json();
		if (!res.ok) {
			msg = data.error || 'Không tạo được.';
			return;
		}
		msg = 'Đã tạo không gian.';
		form = { name: '', slug: '', owner_email: '' };
		await refresh();
	}

	async function toggle(id: string, active: boolean) {
		const res = await fetch('/api/platform/workspaces/' + id, {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ active: !active })
		});
		const data = await res.json();
		if (!res.ok) {
			msg = data.error || 'Không cập nhật được.';
			return;
		}
		msg = !active ? 'Đã mở không gian.' : 'Đã tạm khóa không gian.';
		await refresh();
	}
</script>

<div class="page">
	<h1>Quản trị nền tảng</h1>
	{#if msg}<p class="banner">{msg}</p>{/if}
	<div class="card">
		<h2>Tạo không gian</h2>
		<label class="field">Tên<input bind:value={form.name} /></label>
		<label class="field">Mã (slug)<input bind:value={form.slug} placeholder="sale-quan-7" /></label>
		<label class="field">Gmail chủ sở hữu<input bind:value={form.owner_email} type="email" /></label>
		<button class="btn" onclick={createWs}>Tạo không gian</button>
	</div>
	{#each workspaces as w}
		<div class="card list-item">
			<div>
				<strong>{w.name}</strong>
				<div class="muted">{w.slug} · {w.owner_email}</div>
				<div class="tag">{w.active ? 'Đang mở' : 'Tạm khóa'}</div>
			</div>
			<button class="btn secondary" onclick={() => toggle(w.id, w.active)}>{w.active ? 'Khóa' : 'Mở'}</button>
		</div>
	{/each}
</div>
