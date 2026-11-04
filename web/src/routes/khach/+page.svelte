<script lang="ts">
	import { onMount } from 'svelte';
	import { apiConfig, apiData, apiJson, apiMe } from '#lib/api';
	import { loadDemo, saveDemo } from '#lib/demo';

	let customers = $state<any[]>([]);
	let q = $state('');
	let workspaceId = $state('');
	let demo = $state(false);
	let locked = $state(false);
	let offline = $state(false);
	let form = $state({ name: '', phone: '', area: '', stage: 'new' });
	let msg = $state('');

	const filtered = $derived(
		customers.filter((c) => {
			const s = q.trim().toLowerCase();
			if (!s) return true;
			return [c.name, c.phone, c.area].join(' ').toLowerCase().includes(s);
		})
	);

	onMount(async () => {
		offline = !navigator.onLine;
		try {
			const cfg = await apiConfig();
			if (cfg.mode === 'demo' || cfg.server === false) {
				demo = true;
				customers = loadDemo().customers;
				return;
			}
			const me = await apiMe();
			workspaceId = me.workspaceId;
			locked = me.workspaceActive === false;
			const data = await apiData(workspaceId);
			customers = data.customers;
		} catch {
			demo = true;
			customers = loadDemo().customers;
		}
	});

	async function addCustomer() {
		msg = '';
		if (offline) {
			msg = 'Bạn đang offline — chưa thể lưu khách lên máy chủ.';
			return;
		}
		if (locked) {
			msg = 'Không gian đang tạm khóa.';
			return;
		}
		if (!form.name.trim()) {
			msg = 'Vui lòng nhập tên khách hàng.';
			return;
		}
		try {
			if (demo) {
				const d = loadDemo();
				d.customers.unshift({
					id: crypto.randomUUID(),
					...form,
					interest: 'unknown',
					budget: 0,
					source: 'Nhập tay'
				});
				saveDemo(d);
				customers = d.customers;
			} else {
				await apiJson('/api/customers', workspaceId, {
					method: 'POST',
					body: JSON.stringify(form)
				});
				customers = (await apiData(workspaceId)).customers;
			}
			form = { name: '', phone: '', area: '', stage: 'new' };
			msg = 'Đã lưu hồ sơ khách hàng.';
		} catch (e: any) {
			msg = e.message || 'Không lưu được.';
		}
	}
</script>

<div class="page">
	<h1>Khách hàng</h1>
	<input class="field" style="width:100%;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid var(--border);margin-bottom:12px" placeholder="Tìm tên, số điện thoại, khu vực…" bind:value={q} />

	<div class="card">
		<h2>Thêm khách hàng</h2>
		<label class="field">Tên<input bind:value={form.name} /></label>
		<label class="field">Điện thoại<input bind:value={form.phone} inputmode="tel" /></label>
		<label class="field">Khu vực<input bind:value={form.area} /></label>
		<label class="field">Giai đoạn
			<select bind:value={form.stage}>
				<option value="new">Khách mới</option>
				<option value="consulting">Đang tư vấn</option>
				<option value="viewing">Xem nhà</option>
				<option value="negotiating">Đàm phán</option>
				<option value="won">Đã giao dịch</option>
				<option value="lost">Đã xong</option>
			</select>
		</label>
		<button class="btn" onclick={addCustomer} disabled={locked || offline}>Lưu khách</button>
		{#if msg}<p class="muted">{msg}</p>{/if}
	</div>

	{#each filtered as c}
		<div class="card list-item">
			<div>
				<strong>{c.name}</strong>
				<div class="muted">{c.phone || 'Chưa có số điện thoại'} · {c.area || 'Chưa có địa điểm'}</div>
			</div>
			<span class="tag">{c.stage}</span>
		</div>
	{/each}
</div>
