/**
 * Friends service for managing friend requests and relationships
 */

import { writable } from 'svelte/store';

export interface Profile {
	id: string;
	displayName?: string;
	bio?: string;
	avatarUrl?: string;
	bannerUrl?: string;
	status?: string;
	customMessage?: string;
	lastSeen?: number;
}

export interface Friend extends Profile {
	isFriend: boolean;
	createdAt?: string;
}

export interface Friend extends Profile {
	isFriend: boolean;
	createdAt?: string;
}

export interface FriendRequest {
	id: number;
	fromId: string;
	toId: string;
	status: string;
	user: Profile;
	createdAt: string;
}

export const friendsList = writable<Friend[]>([]);
export const incomingRequests = writable<FriendRequest[]>([]);
export const outgoingRequests = writable<FriendRequest[]>([]);

const API_BASE = '/friends';

async function getAuthHeaders() {
	// Get auth token from localStorage or session
	const sessionToken = localStorage.getItem('sessionToken');
	return {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${sessionToken}`
	};
}

export async function getFriendsList(): Promise<Friend[]> {
	try {
		const response = await fetch(`${API_BASE}?action=list`, {
			headers: await getAuthHeaders()
		});
		if (response.ok) {
			const friends = await response.json();
			friendsList.set(friends);
			return friends;
		}
		throw new Error('Failed to fetch friends list');
	} catch (error) {
		console.error('Error fetching friends:', error);
		return [];
	}
}

export async function getIncomingRequests(): Promise<FriendRequest[]> {
	try {
		const response = await fetch(`${API_BASE}?action=requests`, {
			headers: await getAuthHeaders()
		});
		if (response.ok) {
			const requests = await response.json();
			incomingRequests.set(requests);
			return requests;
		}
		throw new Error('Failed to fetch incoming requests');
	} catch (error) {
		console.error('Error fetching incoming requests:', error);
		return [];
	}
}

export async function getOutgoingRequests(): Promise<FriendRequest[]> {
	try {
		const response = await fetch(`${API_BASE}?action=pending`, {
			headers: await getAuthHeaders()
		});
		if (response.ok) {
			const requests = await response.json();
			outgoingRequests.set(requests);
			return requests;
		}
		throw new Error('Failed to fetch outgoing requests');
	} catch (error) {
		console.error('Error fetching outgoing requests:', error);
		return [];
	}
}

export async function sendFriendRequest(toId: string): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE}?action=send-request`, {
			method: 'POST',
			headers: await getAuthHeaders(),
			body: JSON.stringify({ toId })
		});

		if (response.ok) {
			await getOutgoingRequests(); // Refresh list
			return true;
		}
		throw new Error(await response.text());
	} catch (error) {
		console.error('Error sending friend request:', error);
		return false;
	}
}

export async function acceptFriendRequest(requestId: number, fromId: string): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE}?action=accept-request`, {
			method: 'POST',
			headers: await getAuthHeaders(),
			body: JSON.stringify({ requestId, fromId })
		});

		if (response.ok) {
			await Promise.all([getFriendsList(), getIncomingRequests()]);
			return true;
		}
		throw new Error('Failed to accept request');
	} catch (error) {
		console.error('Error accepting friend request:', error);
		return false;
	}
}

export async function rejectFriendRequest(requestId: number): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE}?action=reject-request`, {
			method: 'POST',
			headers: await getAuthHeaders(),
			body: JSON.stringify({ requestId })
		});

		if (response.ok) {
			await getIncomingRequests();
			return true;
		}
		throw new Error('Failed to reject request');
	} catch (error) {
		console.error('Error rejecting friend request:', error);
		return false;
	}
}

export async function removeFriend(friendId: string): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE}?action=remove-friend`, {
			method: 'DELETE',
			headers: await getAuthHeaders(),
			body: JSON.stringify({ friendId })
		});

		if (response.ok) {
			await getFriendsList();
			return true;
		}
		throw new Error('Failed to remove friend');
	} catch (error) {
		console.error('Error removing friend:', error);
		return false;
	}
}

export async function cancelFriendRequest(requestId: number): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE}?action=cancel-request`, {
			method: 'DELETE',
			headers: await getAuthHeaders(),
			body: JSON.stringify({ requestId })
		});

		if (response.ok) {
			await getOutgoingRequests();
			return true;
		}
		throw new Error('Failed to cancel request');
	} catch (error) {
		console.error('Error cancelling friend request:', error);
		return false;
	}
}

export async function blockUser(userIdToBlock: string): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE}?action=block-user`, {
			method: 'DELETE',
			headers: await getAuthHeaders(),
			body: JSON.stringify({ userIdToBlock })
		});

		if (response.ok) {
			await getIncomingRequests();
			return true;
		}
		throw new Error('Failed to block user');
	} catch (error) {
		console.error('Error blocking user:', error);
		return false;
	}
}

// Load all friend-related data
export async function loadAllFriendsData() {
	await Promise.all([getFriendsList(), getIncomingRequests(), getOutgoingRequests()]);
}
