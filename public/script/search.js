document.addEventListener('DOMContentLoaded', () => {
	const searchInput = document.getElementById('search');
	const searchResults = document.getElementById('searchResults');
	const recent = document.getElementById('recentchats');

	function fetchSearchResults(searchValue) {
		if (!searchValue.trim()) return Promise.resolve([]); // Prevent empty search requests

		return fetch('http://localhost:3000/search/recent', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ search: searchValue }),
		})
			.then((response) => {
				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}
				return response.json();
			})
			.catch((error) => {
				console.error('Error fetching search results:', error);
				return []; // Return empty array if there's an error
			});
	}

	// Detect typing in the search bar
	searchInput.addEventListener('input', async () => {
		const searchValue = searchInput.value.trim();

		if (searchValue === '') {
			// If search is empty, show recent chats again
			searchResults.innerHTML = '';
			recent.style.display = 'block'; // Show recent chats
		} else {
			recent.style.display = 'none'; // Hide recent chats

			// Fetch search results and display them
			const data = await fetchSearchResults(searchValue);
			displaySearchResults(data);
		}
	});

	function displaySearchResults(data) {
		searchResults.innerHTML = ''; // Clear previous results

		if (data.length === 0) {
			searchResults.innerHTML = '<p class="text-muted">No results found</p>';
			return;
		}

		data.forEach((user) => {
			const userDiv = document.createElement('div');
			userDiv.classList.add('search-item', 'p-2', 'border-bottom');
			userDiv.innerHTML = `
                <div class="d-flex align-items-center">
                    <button type="button" onclick="alert('Hello ${user.firstname} ${user.lastname} your userID is: ${user.userID}');" class="btn btn-light mb-0 w-100 p-3">${user.firstname} ${user.lastname}</button>
                </div>
            `;
			searchResults.appendChild(userDiv);
		});
		searchResults.scrollTop = searchResults.scrollHeight;
	}
});
