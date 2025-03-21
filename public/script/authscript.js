document.getElementById('loginform').addEventListener('submit', async (event) => {
	event.preventDefault();

	const username = document.getElementById('username').value;
	const password = document.getElementById('password').value;

	try {
		const response = await fetch('http://localhost:3000/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, password }),
			credentials: 'include',
		});

		const data = await response.json();

		if (response.ok) {
			window.location.href = data.redirectURL;
		} else {
			alert(data.message);
		}
	} catch (err) {
		console.log('Login error', err);
	}
});
