<script lang="ts">
	import { onMount } from 'svelte';
	import { apiConfig, apiData, apiMe } from '#lib/api';
	import { loadDemo } from '#lib/demo';

	let loading = $state(true);
	let customers = $state<any[]>([]);
	let tasks = $state<any[]>([]);
	let name = $state('Tổng quan');

	onMount(async () => {
		try {
			const cfg = await apiConfig();
			if (cfg.mode === 'demo' || cfg.server === false) {
				const d = loadDemo();
				customers = d.customers;
				tasks = d.tasks;
				name = d.workspace.name;
			} else {
				const me = await apiMe();
				const data = await apiData(me.workspaceId);
				customers = data.customers;
				tasks = data.tasks.filter((t) => t.status === 'pending');
				name = data.workspace?.name || data.settings?.name || 'Tổng quan';
			}
		} catch {
			const d = loadDemo();
			customers = d.customers;
			tasks = d.tasks;
		} finally {
			loading = false;
		}
	});

	const dueToday = $derived(
		tasks.filter((t) => {
			const d = new Date(t.due_at);
			const n = new Date();
			return d.toDateString() === n.toDateString();
		}).length
	);
</script>

<div class="page">
	<h1>{name}</h1>
	{#if loading}
		<p class="muted">Đang tải…</p>
	{:else}
		<div class="grid">
			<div class="card stat"><span class="muted">Tổng khách</span><strong>{customers.length}</strong></div>
			<div class="card stat"><span class="muted">Việc hôm nay</span><strong>{dueToday}</strong></div>
			<div class="card stat"><span class="muted">Lịch chờ</span><strong>{tasks.length}</strong></div>
			<div class="card stat"><span class="muted">Quan tâm cao</span><strong>{customers.filter((c)=>c.interest==='high').length}</strong></div>
		</div>
		<div class="card">
			<h2>Việc cần chú ý</h2>
			{#if !tasks.length}
				<p class="muted">Chưa có lịch chăm sắp tới.</p>
			{:else}
				{#each tasks.slice(0,5) as t}
					<div class="list-item" style="margin-bottom:8px">
						<div>
							<strong>{t.title}</strong>
							<div class="muted">{new Date(t.due_at).toLocaleString('vi-VN')}</div>
						</div>
						<span class="tag">{t.kind}</span>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>
