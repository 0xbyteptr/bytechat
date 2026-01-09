<script lang="ts">
	import { onMount } from 'svelte';
	import * as SessionLib from '../lib/useSession';

	interface Profile {
		id: string;
		displayName?: string;
		bio?: string;
		avatarUrl?: string;
		bannerUrl?: string;
		status?: string;
		customMessage?: string;
		lastSeen?: number;
	}

	interface Friend extends Profile {
		isFriend: boolean;
		createdAt?: string;
	}

	interface FriendRequest {
		id: number;
		fromId: string;
		toId: string;
		status: string;
		user: Profile;
		createdAt: string;
	}

	let friends: Friend[] = [];
	let incomingRequests: FriendRequest[] = [];
	let outgoingRequests: FriendRequest[] = [];
	let loading = false;
	let error = '';
	let sessionToken: string = '';
	let userId: string = '';

	onMount(async () => {
		// Subscribe to session stores
		SessionLib.id.subscribe(value => userId = value);
		SessionLib.sessionToken.subscribe(value => sessionToken = value);
		
		const session = SessionLib.loadFromLocalStorage();
		if (!session?.token) {
			error = 'Not logged in';
			return;
		}
		
		await loadFriends();
		await loadRequests();
	});

	async function loadFriends() {
		try {
			loading = true;
			const response = await fetch('/friends?action=list', {
				headers: { 
					'X-ByteChat-ID': userId,
					'Authorization': `Bearer ${sessionToken}`
				}
			});
			if (response.ok) {
				friends = await response.json();
			}
		} catch (err) {
			error = 'Failed to load friends';
		} finally {
			loading = false;
		}
	}

	async function loadRequests() {
		try {
			const headers = {
				'X-ByteChat-ID': userId,
				'Authorization': `Bearer ${sessionToken}`
			};
			const [incoming, outgoing] = await Promise.all([
				fetch('/friends?action=requests', { headers }),
				fetch('/friends?action=pending', { headers })
			]);

			if (incoming.ok) {
				incomingRequests = await incoming.json();
			}
			if (outgoing.ok) {
				outgoingRequests = await outgoing.json();
			}
		} catch (err) {
			error = 'Failed to load requests';
		}
	}

	async function sendFriendRequest(toId: string) {
		try {
			const response = await fetch('/friends?action=send-request', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-ByteChat-ID': userId,
					'Authorization': `Bearer ${sessionToken}`
				},
				body: JSON.stringify({ toId })
			});

			if (response.ok) {
				await loadRequests();
			} else {
				error = await response.text();
			}
		} catch (err) {
			error = 'Failed to send request';
		}
	}

	async function acceptRequest(requestId: number, fromId: string) {
		try {
			const response = await fetch('/friends?action=accept-request', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-ByteChat-ID': userId,
					'Authorization': `Bearer ${sessionToken}`
				},
				body: JSON.stringify({ requestId, fromId })
			});

			if (response.ok) {
				await loadFriends();
				await loadRequests();
			}
		} catch (err) {
			error = 'Failed to accept request';
		}
	}

	async function rejectRequest(requestId: number) {
		try {
			const response = await fetch('/friends?action=reject-request', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-ByteChat-ID': userId,
					'Authorization': `Bearer ${sessionToken}`
				},
				body: JSON.stringify({ requestId })
			});

			if (response.ok) {
				await loadRequests();
			}
		} catch (err) {
			error = 'Failed to reject request';
		}
	}

	async function removeFriend(friendId: string) {
		try {
			const response = await fetch('/friends?action=remove-friend', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'X-ByteChat-ID': userId,
					'Authorization': `Bearer ${sessionToken}`
				},
				body: JSON.stringify({ friendId })
			});

			if (response.ok) {
				await loadFriends();
			}
		} catch (err) {
			error = 'Failed to remove friend';
		}
	}

	async function cancelRequest(requestId: number) {
		try {
			const response = await fetch('/friends?action=cancel-request', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'X-ByteChat-ID': userId,
					'Authorization': `Bearer ${sessionToken}`
				},
				body: JSON.stringify({ requestId })
			});

			if (response.ok) {
				await loadRequests();
			}
		} catch (err) {
			error = 'Failed to cancel request';
		}
	}
</script>

<div class="friends-container">
	<div class="friends-header">
		<h2>Friends</h2>
		<p class="subtitle">{friends.length} friends</p>
	</div>

	{#if error}
		<div class="error-banner">
			{error}
			<button on:click={() => error = ''}>×</button>
		</div>
	{/if}

	<!-- Friend Requests Section -->
	{#if incomingRequests.length > 0}
		<div class="section">
			<h3>Friend Requests ({incomingRequests.length})</h3>
			<div class="requests-list">
				{#each incomingRequests as request (request.id)}
					<div class="request-card">
						{#if request.user.avatarUrl}
							<img src={request.user.avatarUrl} alt={request.user.displayName} class="avatar" />
						{:else}
							<div class="avatar-placeholder">{request.user.id[0]?.toUpperCase()}</div>
						{/if}
						<div class="request-info">
							<p class="name">{request.user.displayName || request.user.id}</p>
							<p class="id">@{request.user.id}</p>
						</div>
						<div class="request-actions">
							<button class="accept-btn" on:click={() => acceptRequest(request.id, request.fromId)}>
								✓ Accept
							</button>
							<button class="reject-btn" on:click={() => rejectRequest(request.id)}>
								✕ Reject
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Pending Requests Section -->
	{#if outgoingRequests.length > 0}
		<div class="section">
			<h3>Pending Requests ({outgoingRequests.length})</h3>
			<div class="requests-list">
				{#each outgoingRequests as request (request.id)}
					<div class="request-card">
						{#if request.user.avatarUrl}
							<img src={request.user.avatarUrl} alt={request.user.displayName} class="avatar" />
						{:else}
							<div class="avatar-placeholder">{request.user.id[0]?.toUpperCase()}</div>
						{/if}
						<div class="request-info">
							<p class="name">{request.user.displayName || request.user.id}</p>
							<p class="id">@{request.user.id}</p>
						</div>
						<button class="cancel-btn" on:click={() => cancelRequest(request.id)}>
							Cancel
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Friends List Section -->
	<div class="section">
		<h3>Friends</h3>
		{#if loading}
			<p class="loading">Loading friends...</p>
		{:else if friends.length === 0}
			<p class="empty">No friends yet. Send a friend request to get started!</p>
		{:else}
			<div class="friends-list">
				{#each friends as friend (friend.id)}
					<div class="friend-card">
						{#if friend.avatarUrl}
							<img src={friend.avatarUrl} alt={friend.displayName} class="avatar" />
						{:else}
							<div class="avatar-placeholder">{friend.id[0]?.toUpperCase()}</div>
						{/if}
						<div class="friend-info">
							<p class="name">{friend.displayName || friend.id}</p>
							<p class="id">@{friend.id}</p>
							<p class="status" class:online={friend.status === 'online'}>{friend.status || 'offline'}</p>
						</div>
						<div class="friend-actions">
							<button class="message-btn" title="Send message">💬</button>
							<button class="remove-btn" on:click={() => removeFriend(friend.id)} title="Remove friend">
								✕
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.friends-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		max-width: 600px;
		margin: 0 auto;
	}

	.friends-header {
		border-bottom: 2px solid var(--color-border);
		padding-bottom: 1rem;
	}

	.friends-header h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
	}

	.subtitle {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.error-banner {
		background-color: #fee;
		color: #c00;
		padding: 1rem;
		border-radius: 8px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.error-banner button {
		background: none;
		border: none;
		color: #c00;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
	}

	.requests-list,
	.friends-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.request-card,
	.friend-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-card-bg);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		transition: background-color 0.2s;
	}

	.request-card:hover,
	.friend-card:hover {
		background-color: var(--color-hover-bg);
	}

	.avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		font-size: 1.2rem;
	}

	.request-info,
	.friend-info {
		flex: 1;
		min-width: 0;
	}

	.name {
		margin: 0;
		font-weight: 600;
		color: var(--color-text);
	}

	.id {
		margin: 0.25rem 0 0 0;
		font-size: 0.85rem;
		color: var(--color-text-secondary);
	}

	.status {
		margin: 0.25rem 0 0 0;
		font-size: 0.8rem;
		color: #999;
	}

	.status.online {
		color: #4ade80;
	}

	.request-actions {
		display: flex;
		gap: 0.5rem;
	}

	.accept-btn,
	.reject-btn,
	.cancel-btn,
	.message-btn,
	.remove-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-btn-bg);
		color: var(--color-text);
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s;
	}

	.accept-btn:hover {
		background-color: #dcfce7;
		border-color: #4ade80;
		color: #166534;
	}

	.reject-btn:hover,
	.remove-btn:hover {
		background-color: #fee;
		border-color: #f87171;
		color: #991b1b;
	}

	.cancel-btn:hover {
		background-color: #fef3c7;
		border-color: #fbbf24;
	}

	.message-btn,
	.remove-btn {
		width: 40px;
		height: 40px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
	}

	.friend-actions {
		display: flex;
		gap: 0.5rem;
	}

	.loading,
	.empty {
		text-align: center;
		color: var(--color-text-secondary);
		padding: 2rem;
		font-style: italic;
	}
</style>
