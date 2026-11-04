<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { apiConfig, apiMe, loginUrl, type MeResponse } from '#lib/api';

	let { children } = $props();
	let me = $state<MeResponse | null>(null);
	let mode = $state<'loading' | 'demo' | 'server'>('loading');
	let error = $state('');
	let offline = $state(false);

	const nav = [
		{ href: '/', label: 'Tổng quan' },
		{ href: '/khach', label: 'Khách' },
		{ href: '/inbox', label: 'Inbox' },
		{ href: '/lich', label: 'Lịch' },
		{ href: '/cai-dat', label: 'Cài đặt' }
	];

	onMount(async () => {
		const syncOffline = () => (offline = !navigator.onLine);
		syncOffline();
		window.addEventListener('online', syncOffline);
		window.addEventListener('offline', syncOffline);
		try {
			const cfg = await apiConfig();
			if (cfg.mode === 'demo' || cfg.server === false) {
				mode = 'demo';
				return;
			}
			me = await apiMe();
			mode = 'server';
		} catch (e: any) {
			if (String(e.message || '').includes('đăng nhập')) {
				mode = 'server';
				me = null;
			} else {
				mode = 'demo';
				error = e.message || '';
			}
		}
	});
</script>

{#if mode === 'loading'}
	<div class="page"><p class="muted">Đang tải Mayhomes CRM…</p></div>
{:else if mode === 'demo'}
	<p class="banner">Chế độ trải nghiệm — không ghi dữ liệu khách thật. Cấu hình máy chủ để dùng production.</p>
	{@render children()}
	<nav class="bottom-nav">
		{#each nav as item}
			<a href={item.href} class:active={$page.url.pathname === item.href}>{item.label}</a>
		{/each}
	</nav>
{:else if !me}
	<div class="page">
		<div class="card">
			<h1>Bắt đầu với Mayhomes CRM</h1>
			<p class="muted">Đăng nhập Google để vào không gian được mời.</p>
			{#if error}<p class="banner danger">{error}</p>{/if}
			<a class="btn" href={loginUrl()}>Đăng nhập Google</a>
		</div>
	</div>
{:else}
	<header class="topbar">
		<div>
			<strong>{me.user.workspaceName || 'Mayhomes CRM'}</strong>
			<div class="muted" style="color:#d7e6de">{me.user.name}</div>
		</div>
		{#if me.user.platformAdmin}
			<a class="btn secondary" href="/admin" style="min-height:36px;padding:0 10px;font-size:13px">Quản trị</a>
		{/if}
	</header>
	{#if offline}
		<p class="banner">Bạn đang offline — có thể xem dữ liệu đã cache; thao tác ghi sẽ bị chặn.</p>
	{/if}
	{#if me.workspaceActive === false}
		<p class="banner danger">Không gian đang tạm khóa. Không thể ghi dữ liệu.</p>
	{/if}
	<div class="app-shell">
		{@render children()}
	</div>
	<nav class="bottom-nav">
		{#each nav as item}
			<a href={item.href} class:active={$page.url.pathname === item.href}>{item.label}</a>
		{/each}
	</nav>
{/if}
