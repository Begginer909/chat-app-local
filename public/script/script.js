const socket = io('http://localhost:3000');
const messageInput = document.getElementById('messageInput');
const messages = document.getElementById('messages');
const chatName = document.getElementById('name');
const fullname = document.getElementById('username');
let userId = null;
let lastSenderId = null;
let currentChatGroupID = null;
let currentChatUserID = null;

document.addEventListener('DOMContentLoaded', async () => {
	try {
		const response = await fetch('http://localhost:3000/cookie/protected', {
			method: 'GET',
			credentials: 'include',
		});

		if (!response.ok) {
			throw new Error('Failed to fetch user information');
		}
		const data = await response.json();

		setupChat(data.user);
	} catch (err) {
		console.log('Something went wrong: ', err);
	}
});

function setupChat(data) {
	userId = data.userID;

	fullname.textContent = `${data.username}`;

	socket.on('connect', () => {
		socket.emit('register', userId);
		console.log(`Reconnected! Registering userID ${userId} with new socket ID.`);
	});

	// Receive new messages
	socket.on('newMessage', handleNewMessage);

	//Function to process the incomming messages to show for both sender and receiver
	function handleNewMessage({ senderID, receiverID, username, message, messageType, fileUrl, groupID, chatType }) {
		console.log(`Received message: chatType=${chatType}, from=${senderID}, to=${receiverID}, group=${groupID}`);

		//Check if the chat type to determine what to display
		if (chatType === 'private') {
			// For private messages, check if this chat is currently active
			if (senderID === currentChatUserID || (receiverID === currentChatUserID && senderID === userId)) {
				displayMessage({ senderID, receiverID, username, message, messageType, fileUrl });
				console.log(`Sender: ${senderID} currentChatUserID ${currentChatUserID} receiverID ${receiverID} userId ${userId}`);
			}
		} else if (chatType === 'group') {
			// For group messages, check if this is for the current group
			if (groupID === currentChatGroupID) {
				displayMessage({ senderID, username, message, messageType, fileUrl, groupID });
				console.log(`groupID: ${groupID} currentchatGroupID ${currentChatGroupID}`);
			}
		}

		// Always refresh recent chats when receiving any message
		socket.emit('recentChat', userId);
	}

	function sendMessage(message, file) {
		if (!message.trim() && !file) return;

		const chatType = currentChatGroupID ? 'group' : 'private';
		const receiverID = currentChatGroupID || currentChatUserID;

		console.log(`Send message to ${receiverID}`);

		console.log('Chat Type: ' + chatType);

		const receiver = chatType === 'private' ? currentChatUserID : null;
		const groupID = chatType === 'group' ? currentChatGroupID : null;

		const payload = {
			senderID: userId,
			receiverID: receiver,
			groupID: groupID,
			chatType: chatType,
			message: message,
			messageType: file ? (file.type.startsWith('image') ? 'image' : 'file') : 'text',
			fileUrl: null,
		};

		if (!file) {
			socket.emit('sendmessage', payload);
			return;
		}

		const formData = new FormData();
		formData.append('senderID', userId);
		formData.append('receiverID', currentChatUserID);
		formData.append('chatType', chatType);
		formData.append('message', message || '');
		formData.append('files', file);
		formData.append('groupID', groupID);

		console.log(`Chat Type is ${chatType}`);
		console.log(`GROUP ID IS ${groupID}`);

		fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			body: formData,
		})
			.then((res) => res.json())
			.then((data) => {
				console.log('Upload response:', data);
				payload.fileUrl = data.fileUrl || null;
				console.log(`payload: ${payload}`);
				socket.emit('sendmessage', payload);
				socket.emit('recentChat', userId);
			})
			.catch((err) => console.error('Upload error:', err));
	}

	function displayMessage(msg) {
		console.log(msg.message);
		console.log(`msg${msg.fileUrl}`);
		const messageWrapper = document.createElement('div');
		messageWrapper.classList.add('message-wrapper');

		const isNewSender = lastSenderId !== msg.senderID;

		if (isNewSender) {
			const nameElement = document.createElement('p');
			nameElement.textContent = msg.senderID === userId ? 'You' : msg.username;
			nameElement.classList.add('message-name');
			messageWrapper.appendChild(nameElement);
		}

		const messageElement = document.createElement('div');
		messageElement.textContent = msg.message;
		messageElement.classList.add('message-box');

		// Check if the message was sent by the current user
		if (msg.senderID === userId) {
			messageWrapper.classList.add('my-message'); // Align right
		} else {
			messageWrapper.classList.add('other-message'); // Align left
		}

		console.log(`${msg.fileUrl} 222`);
		if (msg.messageType === 'image' && msg.fileUrl) {
			try {
				const fileUrls = JSON.parse(msg.fileUrl);
				console.log(`parse ${fileUrls}`);
				console.log(fileUrls);
				fileUrls.forEach((file) => {
					console.log(`url is: ${file.url}`);
					const imgElement = document.createElement('img');
					imgElement.src = `http://localhost/chat-app/server${file.url}`;
					imgElement.classList.add('chat-image', 'img-fluid'); // Add Bootstrap class

					imgElement.addEventListener('click', function () {
						openImageModal(this.src);
					});

					messageElement.appendChild(imgElement);
				});
			} catch (e) {
				console.error('Invalid image URL format:', msg.fileUrl);
			}
		} else if (msg.messageType === 'file' && msg.fileUrl) {
			try {
				const fileUrls = JSON.parse(msg.fileUrl);
				fileUrls.forEach((file) => {
					const displayname = ` ${file.originalName}`;
					const iconspan = document.createElement('span');
					iconspan.classList.add('file-icon');
					iconspan.innerHTML = '<i class="fas fa-file-alt"></i>';

					const fileLink = document.createElement('a');
					fileLink.append(iconspan);
					fileLink.href = `http://localhost/chat-app/server${file.url}`; // Correct URL format
					fileLink.append(displayname);
					fileLink.target = '_blank';
					fileLink.classList.add('file-link');

					if (msg.senderID === userId) {
						fileLink.classList.add('my-file-link'); //Check if the same user send a file
					} else {
						fileLink.classList.add('other-file-link'); //Check if other user send the file
					}

					fileLink.setAttribute('download', displayname.trim());
					messageElement.appendChild(fileLink);
				});
			} catch (e) {
				console.error('Invalid file URL format:', msg.fileUrl);
			}
		} else if (msg.messageType === 'text' && msg.message) {
			messageElement.textContent = msg.message;
		}

		// Append message to the container
		messageWrapper.appendChild(messageElement);
		messages.appendChild(messageWrapper);

		lastSenderId = msg.senderID;

		messages.scrollTop = messages.scrollHeight;
	}

	//Show recent chat on the left of window
	function recent(chats) {
		const chatlist = document.getElementById('recentchats');

		chatlist.innerHTML = ''; // Clear previous list
		const addedUsers = new Set(); // Track unique users

		//Create a list of button for the recent users
		chats.forEach((chat, index) => {
			let chatNameUsers;
			if (!addedUsers.has(chat.userID)) {
				addedUsers.add(chat.userID); // Prevent duplicates

				const chatItem = document.createElement('div');
				chatItem.classList.add('chat-item');

				const button = document.createElement('button');
				button.type = 'button';
				button.classList.add('btn', 'btn-light', 'mb-0', 'w-100', 'p-3', 'mb-2');

				if (chat.chatType === 'private') {
					button.textContent = `${chat.firstname} ${chat.lastname}`;
					chatNameUsers = `${chat.firstname} ${chat.lastname}`;
				} else {
					button.textContent = `${chat.username} (Group)`;
					chatNameUsers = `${chat.username} (Group)`;
				}

				// Fetch all messages for this user on click
				button.addEventListener('click', () => {
					fetchChatHistory(chat.userID, chat.chatType);
					chatName.textContent = `${chatNameUsers}`;

					// Remove hover-effect class from all buttons
					document.querySelectorAll('.chat-item button').forEach((btn) => {
						btn.classList.remove('hover-effect');
					});

					// Add hover effect class to the clicked button
					button.classList.add('hover-effect');
				});

				chatItem.appendChild(button);
				chatlist.append(chatItem);
			}
		});
	}

	function fetchChatHistory(otherUserID, chatType) {
		if (currentChatUserID === otherUserID) return;

		if (chatType === 'group') {
			currentChatGroupID = otherUserID; // Set group ID
			currentChatUserID = null; // Reset private chat ID
		} else {
			currentChatUserID = otherUserID; // Set private chat ID
			currentChatGroupID = null; // Reset group chat ID
		}

		console.log(`current: ${currentChatUserID}`);

		messages.innerHTML = '';

		//Data that needed to be sent in getMessages API to satisfy the condition
		const payload = {
			userID: userId,
			otherUserID: chatType === 'private' ? currentChatUserID : null,
			groupID: chatType === 'group' ? currentChatGroupID : null,
			chatType,
		};

		//Call the API using fetch with a method POST
		fetch(`http://localhost:3000/search/getMessages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		})
			.then((response) => response.json())
			.then((messages) => {
				console.log('Fetched messages:', messages);
				document.getElementById('messages').innerHTML = '';
				messages.forEach((msg) => {
					displayMessage(msg);
				});
			})
			.catch((error) => {
				console.error('Error fetching chat history:', error);
			});
	}

	console.log('It start to run this socket.emit');
	socket.emit('recentChat', userId);

	socket.on('recentChatResult', (data) => {
		console.log('Recent Data: ', data);
		recent(data);
	});

	//Able to show the users when creating a group
	async function fetchUsers() {
		try {
			const response = await fetch(`http://localhost:3000/search/users?userId=${userId}`);
			if (!response.ok) throw new Error('Failed to fetch users');

			const users = await response.json();
			const selectElement = document.getElementById('groupMembers');

			selectElement.innerHTML = ''; // Clear previous options

			users.forEach((user) => {
				const div = document.createElement('div');
				div.classList.add('form-check');

				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.value = user.userID;
				checkbox.id = `user-${user.userID}`;
				checkbox.classList.add('form-check-input');

				const label = document.createElement('label');
				label.htmlFor = `user-${user.userID}`;
				label.classList.add('form-check-label');
				label.textContent = `${user.firstname} ${user.lastname}`;

				div.appendChild(checkbox);
				div.appendChild(label);
				selectElement.appendChild(div);
			});
		} catch (error) {
			console.error('Error loading users:', error);
		}
	}

	//Create group when the modal submitted
	document.getElementById('groupForm').addEventListener('submit', async (e) => {
		e.preventDefault();

		const groupNameInput = document.getElementById('groupName');
		const groupName = groupNameInput.value;
		const members = Array.from(document.querySelectorAll('#groupMembers input[type="checkbox"]:checked')).map((checkbox) => checkbox.value);
		const creatorID = userId;
		console.log(creatorID);

		if (!groupName.trim() || members.length === 0) {
			alert('Please enter a group name and select at least one member.');
			return;
		}

		try {
			const response = await fetch('http://localhost:3000/search/createGroup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ groupName, members, creatorID }),
			});

			if (!response.ok) throw new Error('Failed to create group');

			const data = await response.json();

			alert('Group created successfully!');

			groupNameInput.value = '';

			fetchUsers();
			socket.emit('recentChat', userId);
			const modal = bootstrap.Modal.getInstance(document.getElementById('groupModal'));
			modal.hide();
		} catch (error) {
			console.error('Error creating group:', error);
		}
	});

	document.getElementById('createGroup').addEventListener('click', fetchUsers);

	//Search users to start a new chat
	const searchInput = document.getElementById('search');
	const searchResults = document.getElementById('searchResults');
	const recentChat = document.getElementById('recentchats');

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

	let lastSearchValue = ''; // Store the last search value

	// Detect typing in the search bar
	searchInput.addEventListener('input', async () => {
		const searchValue = searchInput.value.trim();

		if (searchValue === lastSearchValue) {
			return; // Prevent duplicate search requests
		}

		lastSearchValue = searchValue;

		if (searchValue === '') {
			// If search is empty, show recent chats again
			searchResults.innerHTML = '';
			searchResults.style.display = 'none';
			recentChat.style.display = 'block'; // Show recent chats
			return; // Exit function
		}
		searchResults.style.display = 'block';
		recentChat.style.display = 'none';

		// Fetch search results and display them
		const data = await fetchSearchResults(searchValue);
		displaySearchResults(data);
	});

	function displaySearchResults(data) {
		searchResults.innerHTML = ''; // Clear previous results
		chatType = 'private';

		if (data.length === 0) {
			searchResults.innerHTML = '<p class="text-muted">No results found</p>';
			return;
		}
		data.forEach((user) => {
			const userDiv = document.createElement('div');
			userDiv.classList.add('search-item', 'p-2', 'border-bottom');
			const button = document.createElement('button');
			button.type = 'button';
			button.classList.add('btn', 'btn-light', 'mb-0', 'w-100', 'p-3', 'mb-2');
			button.textContent = `${user.firstname} ${user.lastname} ${user.userID}`;

			// Fetch all messages for this user on click
			button.addEventListener('click', () => {
				fetchChatHistory(user.userID, chatType);
				searchResults.style.display = 'none';
				recentChat.style.display = 'block';
				chatName.textContent = `${user.firstname} ${user.lastname}`;
			});
			userDiv.appendChild(button);
			searchResults.appendChild(userDiv);
		});
		searchResults.scrollTop = searchResults.scrollHeight;
	}

	//Jquery for previewing the images or files when user selects it
	let selectedFiles = []; // Stores selected files or images

	// Function to add files to array and update preview
	function addFiles(files) {
		Array.from(files).forEach((file) => {
			selectedFiles.push(file);
			displayPreview(file);
		});
	}

	// Function to display file previews
	function displayPreview(file) {
		$('#previewContainer').show();

		const reader = new FileReader();
		reader.onload = function (e) {
			let previewItem = $("<div class='preview-item'></div>");

			if (file.type.startsWith('image/')) {
				previewItem.append(`<img src="${e.target.result}" class="preview-image">`);
			} else {
				previewItem.append(`<p class="preview-text"> <i class="fas fa-file-alt"></i> ${file.name}</p>`);
			}

			const removeBtn = $('<button>')
				.addClass('remove-file')
				.html('<i class="fas fa-times"></i>')
				.click(function () {
					previewItem.remove();
					if ($('#previewContent').children().length === 0) {
						$('#previewContainer').hide();
					}
				});

			previewItem.append(removeBtn);
			$('#previewContent').append(previewItem);
		};
		reader.readAsDataURL(file);
	}

	// Clear preview after sending
	function clearPreview() {
		selectedFiles = [];
		$('#previewContainer').hide();
		$('#previewContent').html('');
	}

	$(document).ready(function () {
		// Open file manager when clicking icons
		$('#fileIcon').click(() => $('#fileInput').click());
		$('#imageIcon').click(() => $('#imageInput').click());

		// Enable multiple file selection
		$('#fileInput, #imageInput').attr('multiple', true);

		// Handle file selection
		$('#fileInput, #imageInput').change(function (event) {
			addFiles(event.target.files);
		});

		// Send button logic (sends message with or without files)
		$('#sendButton').click(function () {
			const message = $('#messageInput').val().trim();

			// Send each selected file individually
			if (selectedFiles.length > 0) {
				selectedFiles.forEach((file) => {
					sendMessage('', file);
				});

				if (message) {
					sendMessage(message); // Send text-only message after files
				}

				clearPreview();
			} else {
				sendMessage(message);
			}

			$('#messageInput').val(''); // Clear input after sending
		});
	});

	//Keypress so when the user hit enter it will automatically sends a message, because it ables to call a fucntion
	messageInput.addEventListener('keypress', function (e) {
		if (e.key === 'Enter') {
			e.preventDefault(); // Prevent default Enter behavior
			const message = $('#messageInput').val().trim();
			// Send each selected file individually
			if (selectedFiles.length > 0) {
				selectedFiles.forEach((file) => {
					sendMessage('', file); // Send files with empty text
				});

				// Then send the text message separately if it exists
				if (message) {
					sendMessage(message); // Send text-only message after files
				}
				clearPreview();
			} else {
				sendMessage(message);
			}

			$('#messageInput').val(''); // Clear input after sending
		}
	});
}

function openImageModal(src) {
	const modal = document.getElementById('imageModal');
	const expandedImg = document.getElementById('expandedImage');

	expandedImg.style.backgroundColor = 'transparent';

	modal.style.display = 'block';

	expandedImg.src = src;

	// Add event listener to close button
	document.querySelector('.close-modal').addEventListener('click', function () {
		modal.style.display = 'none';
	});

	// Close modal when clicking outside the image
	modal.addEventListener('click', function (event) {
		if (event.target === modal) {
			modal.style.display = 'none';
		}
	});
}

//Close the Modal when esc button clicked
document.addEventListener('keydown', function (event) {
	if (event.key === 'Escape') {
		document.getElementById('imageModal').style.display = 'none';
	}
});
