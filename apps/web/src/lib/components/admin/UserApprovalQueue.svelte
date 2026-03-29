<script lang="ts">
  import { api } from '$lib/api';

  // Data
  let allUsers = $state<any[]>([]);
  let stats = $state<any>({ totalUsers: 0, pendingApproval: 0, totalDecks: 0, totalTokens: 0 });
  let loading = $state(true);
  let error = $state('');
  let actionInProgress = $state<string | null>(null);

  // Filters & sorting
  let statusFilter = $state('all');
  let sortField = $state('createdAt');
  let sortAsc = $state(false);

  // Usage modal
  let usageModalUser = $state<any>(null);
  let usageData = $state<any>(null);
  let usageLoading = $state(false);

  // Inline editing
  let editingCapId = $state<string | null>(null);
  let editingCapValue = $state('');

  const filteredUsers = $derived(() => {
    let filtered = allUsers;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }
    return filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (aVal == null) aVal = 0;
      if (bVal == null) bVal = 0;
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  });

  async function loadUsers() {
    loading = true;
    error = '';
    try {
      const res = await api.listAllUsers();
      allUsers = res.users ?? [];
      stats = res.stats ?? stats;
    } catch (err: any) {
      error = err.message || 'Failed to load users';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadUsers();
  });

  function toggleSort(field: string) {
    if (sortField === field) {
      sortAsc = !sortAsc;
    } else {
      sortField = field;
      sortAsc = true;
    }
  }

  function sortIndicator(field: string): string {
    if (sortField !== field) return '';
    return sortAsc ? ' ▲' : ' ▼';
  }

  function formatDate(dateStr: string | number | null): string {
    if (!dateStr) return '--';
    const date = new Date(typeof dateStr === 'number' ? dateStr : dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatTokens(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return String(n);
  }

  async function handleApprove(userId: string) {
    actionInProgress = userId;
    error = '';
    try {
      await api.updateUser(userId, { status: 'approved' });
      const user = allUsers.find((u) => u.id === userId);
      if (user) user.status = 'approved';
      allUsers = [...allUsers];
      stats.pendingApproval = allUsers.filter((u) => u.status === 'pending').length;
    } catch (err: any) {
      error = err.message || 'Failed to approve user';
    } finally {
      actionInProgress = null;
    }
  }

  async function handleReject(userId: string) {
    actionInProgress = userId;
    error = '';
    try {
      await api.updateUser(userId, { status: 'rejected' });
      const user = allUsers.find((u) => u.id === userId);
      if (user) user.status = 'rejected';
      allUsers = [...allUsers];
      stats.pendingApproval = allUsers.filter((u) => u.status === 'pending').length;
    } catch (err: any) {
      error = err.message || 'Failed to reject user';
    } finally {
      actionInProgress = null;
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    actionInProgress = userId;
    error = '';
    try {
      await api.updateUser(userId, { role: newRole });
      const user = allUsers.find((u) => u.id === userId);
      if (user) user.role = newRole;
      allUsers = [...allUsers];
    } catch (err: any) {
      error = err.message || 'Failed to update role';
    } finally {
      actionInProgress = null;
    }
  }

  function startEditCap(userId: string, currentCap: number) {
    editingCapId = userId;
    editingCapValue = String(currentCap);
  }

  async function saveCapEdit(userId: string) {
    const newCap = parseInt(editingCapValue, 10);
    if (isNaN(newCap) || newCap < 0) {
      editingCapId = null;
      return;
    }
    actionInProgress = userId;
    error = '';
    try {
      await api.updateUser(userId, { tokenCap: newCap });
      const user = allUsers.find((u) => u.id === userId);
      if (user) user.tokenCap = newCap;
      allUsers = [...allUsers];
    } catch (err: any) {
      error = err.message || 'Failed to update token cap';
    } finally {
      actionInProgress = null;
      editingCapId = null;
    }
  }

  async function showUsage(userId: string) {
    usageLoading = true;
    usageModalUser = allUsers.find((u) => u.id === userId) ?? null;
    usageData = null;
    try {
      usageData = await api.getUserUsage(userId);
    } catch (err: any) {
      error = err.message || 'Failed to load usage data';
    } finally {
      usageLoading = false;
    }
  }

  function closeUsageModal() {
    usageModalUser = null;
    usageData = null;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
</script>

<div class="admin-dashboard">
  <!-- Stats Cards -->
  <div class="stats-row">
    <div class="stat-card">
      <span class="stat-value">{stats.totalUsers}</span>
      <span class="stat-label">Total Users</span>
    </div>
    <div class="stat-card pending">
      <span class="stat-value">{stats.pendingApproval}</span>
      <span class="stat-label">Pending Approval</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{stats.totalDecks}</span>
      <span class="stat-label">Total Decks</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{formatTokens(stats.totalTokens)}</span>
      <span class="stat-label">Total Tokens Used</span>
    </div>
  </div>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  <!-- Filter Bar -->
  <div class="filter-bar">
    <span class="filter-label">Filter:</span>
    <button class="filter-btn" class:active={statusFilter === 'all'} onclick={() => statusFilter = 'all'}>All</button>
    <button class="filter-btn" class:active={statusFilter === 'pending'} onclick={() => statusFilter = 'pending'}>Pending</button>
    <button class="filter-btn" class:active={statusFilter === 'approved'} onclick={() => statusFilter = 'approved'}>Approved</button>
    <button class="filter-btn" class:active={statusFilter === 'rejected'} onclick={() => statusFilter = 'rejected'}>Rejected</button>
  </div>

  {#if loading}
    <p class="loading-text">Loading users...</p>
  {:else if filteredUsers().length === 0}
    <div class="empty-state">
      <p>No users match the current filter.</p>
    </div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="sortable" onclick={() => toggleSort('name')}>Name{sortIndicator('name')}</th>
            <th class="sortable" onclick={() => toggleSort('email')}>Email{sortIndicator('email')}</th>
            <th class="sortable" onclick={() => toggleSort('role')}>Role{sortIndicator('role')}</th>
            <th class="sortable" onclick={() => toggleSort('status')}>Status{sortIndicator('status')}</th>
            <th class="sortable" onclick={() => toggleSort('deckCount')}>Decks{sortIndicator('deckCount')}</th>
            <th class="sortable" onclick={() => toggleSort('tokensUsed')}>Tokens{sortIndicator('tokensUsed')}</th>
            <th>Cap</th>
            <th class="sortable" onclick={() => toggleSort('lastActive')}>Last Active{sortIndicator('lastActive')}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredUsers() as u (u.id)}
            <tr>
              <td class="name-cell">{u.name}</td>
              <td class="email-cell">{u.email}</td>
              <td>
                <select
                  class="role-select"
                  value={u.role}
                  onchange={(e) => handleRoleChange(u.id, (e.target as HTMLSelectElement).value)}
                  disabled={actionInProgress === u.id}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>
                <span class="status-badge {u.status}">{u.status}</span>
              </td>
              <td class="num-cell">{u.deckCount}</td>
              <td class="num-cell">{formatTokens(u.tokensUsed)}</td>
              <td class="cap-cell">
                {#if editingCapId === u.id}
                  <input
                    class="cap-input"
                    type="number"
                    bind:value={editingCapValue}
                    onkeydown={(e) => { if (e.key === 'Enter') saveCapEdit(u.id); if (e.key === 'Escape') editingCapId = null; }}
                    onblur={() => saveCapEdit(u.id)}
                  />
                {:else}
                  <button class="cap-display" onclick={() => startEditCap(u.id, u.tokenCap)} title="Click to edit">
                    {formatTokens(u.tokenCap)}
                  </button>
                {/if}
              </td>
              <td class="date-cell">{formatDate(u.lastActive)}</td>
              <td class="actions-cell">
                {#if u.status === 'pending'}
                  <button
                    class="btn-approve"
                    onclick={() => handleApprove(u.id)}
                    disabled={actionInProgress === u.id}
                  >
                    {actionInProgress === u.id ? '...' : 'Approve'}
                  </button>
                  <button
                    class="btn-reject"
                    onclick={() => handleReject(u.id)}
                    disabled={actionInProgress === u.id}
                  >
                    {actionInProgress === u.id ? '...' : 'Reject'}
                  </button>
                {/if}
                <button class="btn-usage" onclick={() => showUsage(u.id)}>Usage</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Usage Modal -->
{#if usageModalUser}
  <div class="modal-overlay" onclick={closeUsageModal} role="dialog" aria-modal="true">
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Token Usage: {usageModalUser.name}</h2>
        <button class="modal-close" onclick={closeUsageModal}>&times;</button>
      </div>

      {#if usageLoading}
        <p class="loading-text">Loading usage data...</p>
      {:else if usageData}
        <div class="usage-summary">
          <div class="usage-stat">
            <span class="usage-stat-value">{formatTokens(usageData.totalUsed)}</span>
            <span class="usage-stat-label">Used this year</span>
          </div>
          <div class="usage-stat">
            <span class="usage-stat-value">{formatTokens(usageData.remaining)}</span>
            <span class="usage-stat-label">Remaining</span>
          </div>
          <div class="usage-stat">
            <span class="usage-stat-value">{formatTokens(usageData.tokenCap)}</span>
            <span class="usage-stat-label">Annual Cap</span>
          </div>
        </div>

        <!-- Cap usage bar -->
        <div class="cap-bar-container">
          <div class="cap-bar">
            <div
              class="cap-bar-fill"
              class:cap-warning={usageData.tokenCap > 0 && (usageData.totalUsed / usageData.tokenCap) > 0.8}
              class:cap-exceeded={usageData.tokenCap > 0 && (usageData.totalUsed / usageData.tokenCap) >= 1}
              style="width: {Math.min(100, usageData.tokenCap > 0 ? (usageData.totalUsed / usageData.tokenCap * 100) : 0)}%"
            ></div>
          </div>
          <span class="cap-bar-label">{usageData.tokenCap > 0 ? Math.round(usageData.totalUsed / usageData.tokenCap * 100) : 0}% used</span>
        </div>

        <!-- Input/Output breakdown -->
        <div class="io-breakdown">
          <span>Input: {formatTokens(usageData.inputTotal)}</span>
          <span>Output: {formatTokens(usageData.outputTotal)}</span>
        </div>

        <!-- Monthly chart -->
        <h3>Monthly Usage</h3>
        <div class="monthly-chart">
          {#each Array(12) as _, i}
            {@const monthData = usageData.monthly?.find((m: any) => m.month === i + 1)}
            {@const monthTotal = monthData?.total ?? 0}
            {@const maxMonthly = Math.max(...(usageData.monthly?.map((m: any) => m.total) ?? [1]), 1)}
            <div class="month-bar-group">
              <div class="month-bar-container">
                <div
                  class="month-bar"
                  style="height: {maxMonthly > 0 ? Math.max(2, monthTotal / maxMonthly * 120) : 2}px"
                  title="{monthNames[i]}: {formatTokens(monthTotal)}"
                ></div>
              </div>
              <span class="month-label">{monthNames[i]}</span>
            </div>
          {/each}
        </div>

        <!-- Model breakdown -->
        {#if usageData.byModel?.length > 0}
          <h3>Model Breakdown</h3>
          <div class="model-list">
            {#each usageData.byModel as m}
              <div class="model-row">
                <span class="model-name">{m.model}</span>
                <span class="model-tokens">{formatTokens(m.total)}</span>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .admin-dashboard {
    width: 100%;
  }

  /* Stats Row */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 1.25rem 1rem;
  }

  .stat-card.pending {
    border-color: #f59e0b;
    background: #fffbeb;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    font-family: var(--font-display);
    line-height: 1;
    color: var(--color-primary-dark);
  }

  .stat-card.pending .stat-value {
    color: #d97706;
  }

  .stat-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  /* Filter Bar */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .filter-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .filter-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: var(--font-body);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-bg);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .filter-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .filter-btn.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  /* Error / Loading / Empty */
  .error-message {
    background: #fef2f2;
    color: var(--color-error);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    border: 1px solid #fecaca;
    margin-bottom: 1rem;
  }

  .loading-text {
    text-align: center;
    color: var(--color-text-muted);
    padding: 3rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  /* Table */
  .table-wrap {
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 900px;
  }

  th {
    text-align: left;
    padding: 0.625rem 0.75rem;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
  }

  th.sortable:hover {
    color: var(--color-primary);
  }

  td {
    padding: 0.625rem 0.75rem;
    font-size: 0.8125rem;
    border-bottom: 1px solid var(--color-border);
    vertical-align: middle;
  }

  tr:last-child td {
    border-bottom: none;
  }

  .name-cell {
    font-weight: 600;
    white-space: nowrap;
  }

  .email-cell {
    color: var(--color-text-secondary);
    font-size: 0.75rem;
  }

  .num-cell {
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .date-cell {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  /* Status Badge */
  .status-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .status-badge.pending {
    background: #fef3c7;
    color: #92400e;
  }

  .status-badge.approved {
    background: #d1fae5;
    color: #065f46;
  }

  .status-badge.rejected {
    background: #fecaca;
    color: #991b1b;
  }

  /* Role Select */
  .role-select {
    padding: 0.25rem 0.375rem;
    font-size: 0.75rem;
    font-family: var(--font-body);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    cursor: pointer;
  }

  /* Cap Editing */
  .cap-cell {
    text-align: center;
  }

  .cap-display {
    background: none;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    font-family: var(--font-body);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .cap-display:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .cap-input {
    width: 80px;
    padding: 0.2rem 0.375rem;
    font-size: 0.75rem;
    font-family: var(--font-body);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-md);
    text-align: center;
  }

  /* Action Buttons */
  .actions-cell {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    flex-wrap: nowrap;
  }

  .btn-approve {
    padding: 0.25rem 0.625rem;
    background: var(--color-success);
    color: white;
    border: none;
    border-radius: var(--radius-full);
    font-size: 0.6875rem;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-approve:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-approve:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-reject {
    padding: 0.25rem 0.625rem;
    background: none;
    color: var(--color-error);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-full);
    font-size: 0.6875rem;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-reject:hover:not(:disabled) {
    background: #fef2f2;
  }

  .btn-reject:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-usage {
    padding: 0.25rem 0.625rem;
    background: none;
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 0.6875rem;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-usage:hover {
    background: var(--color-primary);
    color: white;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    padding: 2rem;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .modal-header h2 {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-primary-dark);
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--color-text-secondary);
    line-height: 1;
    padding: 0.25rem;
  }

  .modal-close:hover {
    color: var(--color-text);
  }

  /* Usage Summary */
  .usage-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .usage-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }

  .usage-stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    font-family: var(--font-display);
    color: var(--color-primary-dark);
  }

  .usage-stat-label {
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 0.125rem;
  }

  /* Cap Bar */
  .cap-bar-container {
    margin-bottom: 1.25rem;
  }

  .cap-bar {
    height: 8px;
    background: var(--color-bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
  }

  .cap-bar-fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .cap-bar-fill.cap-warning {
    background: #f59e0b;
  }

  .cap-bar-fill.cap-exceeded {
    background: var(--color-error);
  }

  .cap-bar-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    margin-top: 0.25rem;
    display: block;
  }

  .io-breakdown {
    display: flex;
    gap: 1.5rem;
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    margin-bottom: 1.5rem;
  }

  /* Monthly Chart */
  .modal-content h3 {
    font-family: var(--font-display);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 0.75rem;
    margin-top: 0;
  }

  .monthly-chart {
    display: flex;
    align-items: flex-end;
    gap: 0.375rem;
    margin-bottom: 1.5rem;
    padding: 0.5rem 0;
  }

  .month-bar-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .month-bar-container {
    height: 120px;
    display: flex;
    align-items: flex-end;
  }

  .month-bar {
    width: 100%;
    min-width: 20px;
    background: var(--color-primary);
    border-radius: 3px 3px 0 0;
    transition: height 0.3s ease;
  }

  .month-label {
    font-size: 0.625rem;
    color: var(--color-text-secondary);
    margin-top: 0.25rem;
  }

  /* Model Breakdown */
  .model-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .model-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    font-size: 0.8125rem;
  }

  .model-name {
    color: var(--color-text);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 70%;
  }

  .model-tokens {
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
</style>
