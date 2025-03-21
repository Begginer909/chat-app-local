document.getElementById('logout').addEventListener('click', function () {
	fetch('http://localhost:3000/auth/logout', {
		method: 'POST',
		credentials: 'include',
	})
		.then((response) => response.json())
		.then((data) => {
			alert(data.message);
			window.location.href = 'index.html';
		})
		.catch((error) => console.error('Logout failed:', error));
});

const authcheck = () => {
	fetch('http://localhost:3000/cookie/checkAuth', {
		credentials: 'include',
	})
		.then((response) => response.json())
		.then((data) => {
			if (!data.isAuthenticated) {
				alert('Your session has expired. You will now proceeding to login');
				window.location.href = 'index.html';
			}
		})
		.catch((err) => console.error('Something went wrong', err));
};

setInterval(authcheck, 5000);
