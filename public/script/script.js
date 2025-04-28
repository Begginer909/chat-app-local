const socket = io('http://localhost:3000');
const messageInput = document.getElementById('messageInput');
const messages = document.getElementById('messages');
const chatName = document.getElementById('name');
const fullname = document.getElementById('username');
let userId = null;
let lastSenderId = null;
let currentChatGroupID = null;
let currentChatUserID = null;
let chatType;

//Lazy loading variables
let reachedBeginningOfChat = false;

// Add these variables at the top with your other variables
let typingTimer;
const typingDelay = 1000; // Delay in ms (1 second)
let isTyping = false;
let typingUsers = new Map(); // To track who's typing in group chats

const onlineUsers = new Set(); // To store online user IDs
const onlineGroups = new Map(); // To store group online status (groupID -> boolean)

// Global variables for emoji functionality
let emojiPicker = null;
let currentReactionTarget = null;

// Add this function inside the setupChat function after setting up other socket listeners
function setupTypingIndicator() {
	// Create typing indicator element if it doesn't exist
	if (!document.getElementById('typingIndicator')) {
		const typingIndicator = document.createElement('div');
		typingIndicator.id = 'typingIndicator';
		typingIndicator.classList.add('typing-indicator');
		typingIndicator.style.display = 'none';
		typingIndicator.style.fontStyle = 'italic';
		typingIndicator.style.color = '#666';
		typingIndicator.style.padding = '5px 10px';
		document.querySelector('.chat-body').appendChild(typingIndicator);
	}

	// Listen for typing event from server
	socket.on('userTyping', ({ userID, username, chatType, groupID }) => {
		const typingIndicator = document.getElementById('typingIndicator');

		// Only show typing indicator if we're in the correct chat
		if (chatType === 'private' && userID === currentChatUserID) {
			typingIndicator.textContent = `${username} is typing...`;
			typingIndicator.style.display = 'block';
		} else if (chatType === 'group' && groupID === currentChatGroupID) {
			// Add this user to the list of typing users
			typingUsers.set(userID, username);

			if (typingUsers.size === 1) {
				typingIndicator.textContent = `${username} is typing...`;
			} else {
				typingIndicator.textContent = `Someone is typing...`;
			}
			typingIndicator.style.display = 'block';
		}

		// Make sure typing indicator is visible
		messages.scrollTop = messages.scrollHeight;
	});

	// Listen for stopped typing event
	socket.on('userStoppedTyping', ({ userID, chatType, groupID }) => {
		const typingIndicator = document.getElementById('typingIndicator');

		if (chatType === 'private' && userID === currentChatUserID) {
			typingIndicator.style.display = 'none';
		} else if (chatType === 'group' && groupID === currentChatGroupID) {
			// Remove user from typing users
			typingUsers.delete(userID);

			if (typingUsers.size === 0) {
				typingIndicator.style.display = 'none';
			} else if (typingUsers.size === 1) {
				// Get the first (and only) username
				const [username] = [...typingUsers.values()];
				typingIndicator.textContent = `${username} is typing...`;
			} else {
				typingIndicator.textContent = `Several people are typing...`;
			}
		}
	});

	// Add input event listener to message input
	messageInput.addEventListener('input', function () {
		if (!isTyping) {
			isTyping = true;

			// Determine current chat type and target
			const currentChatType = currentChatGroupID ? 'group' : 'private';
			const targetID = currentChatType === 'private' ? currentChatUserID : currentChatGroupID;

			// Only emit if we're in an active chat
			if (targetID) {
				socket.emit('typing', {
					userID: userId,
					username: fullname.textContent,
					chatType: currentChatType,
					receiverID: currentChatType === 'private' ? targetID : null,
					groupID: currentChatType === 'group' ? targetID : null,
				});
			}
		}

		// Clear existing timer
		clearTimeout(typingTimer);

		// Set new timer
		typingTimer = setTimeout(() => {
			isTyping = false;

			const currentChatType = currentChatGroupID ? 'group' : 'private';
			const targetID = currentChatType === 'private' ? currentChatUserID : currentChatGroupID;

			if (targetID) {
				socket.emit('stopTyping', {
					userID: userId,
					chatType: currentChatType,
					receiverID: currentChatType === 'private' ? targetID : null,
					groupID: currentChatType === 'group' ? targetID : null,
				});
			}
		}, typingDelay);
	});
}

function initLazyLoading() {
    // Fix the selector syntax by removing the space
    const lazyImages = document.querySelectorAll('img.lazy-load');
    const lazyFiles = document.querySelectorAll('a.lazy-file');
    
    console.log(`Found ${lazyImages.length} lazy images and ${lazyFiles.length} lazy files to load`);
    
    if ('IntersectionObserver' in window) {
        // Create observer for images
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    // Only load if not already loaded
                    if (img.classList.contains('lazy-load')) {
                        img.src = img.dataset.src;
                        img.classList.remove('lazy-load');
                        observer.unobserve(img);
                        console.log(`Lazy loaded image: ${img.dataset.src}`);
                    }
                }
            });
        });
        
        // Create observer for file links
        const fileObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const link = entry.target;
                    // Only load if not already loaded
                    if (link.classList.contains('lazy-file')) {
                        link.href = link.dataset.href;
                        link.classList.remove('lazy-file');
                        observer.unobserve(link);
                        console.log(`Lazy loaded file link: ${link.dataset.href}`);
                    }
                }
            });
        });
        
        // Apply observers to new elements only
        lazyImages.forEach(img => {
            if (img.classList.contains('lazy-load')) {
                imageObserver.observe(img);
            }
        });
        
        lazyFiles.forEach(file => {
            if (file.classList.contains('lazy-file')) {
                fileObserver.observe(file);
            }
        });
    } 
    else {
        // Fallback for browsers that don't support Intersection Observer
        lazyImages.forEach(img => {
            if (img.classList.contains('lazy-load')) {
                img.src = img.dataset.src;
                img.classList.remove('lazy-load');
            }
        });
        
        lazyFiles.forEach(link => {
            if (link.classList.contains('lazy-file')) {
                link.href = link.dataset.href;
                link.classList.remove('lazy-file');
            }
        });
    }
}

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

		// Set up initial lazy loading
		initLazyLoading();
    
		// Set up scroll events for chat list
		const chatlist = document.getElementById('recentchats');
		if (chatlist) {
			chatlist.addEventListener('scroll', function() {
				initLazyLoading();
			});
		}
		
		// Set up scroll events for messages
		if (messages) {
			messages.addEventListener('scroll', function() {
				initLazyLoading();
			});
		}

		setupChat(data.user);
	} catch (err) {
		console.log('Something went wrong: ', err);
	}
});

function setupChat(data) {
	userId = data.userID;

	fullname.textContent = `${data.username}`;

	// Call this function in the setupChat function
	// Add this line after socket event listeners are set up
	setupTypingIndicator();

	socket.on('connect', () => {
		socket.emit('register', userId);
		console.log(`Reconnected! Registering userID ${userId} with new socket ID.`);
	});

	// Receive new messages
	socket.on('newMessage', handleNewMessage);

	//Function to process the incomming messages to show for both sender and receiver
	function handleNewMessage({ senderID, receiverID, username, message, messageType, fileUrl, groupID, chatType, messageID }) {
		//console.log(`Received message: chatType=${chatType}, from=${senderID}, to=${receiverID}, group=${groupID}`);

		//Check if the chat type to determine what to display
		if (chatType === 'private') {
			// For private messages, check if this chat is currently active
			if (senderID === currentChatUserID || (receiverID === currentChatUserID && senderID === userId)) {
				displayMessage({ senderID, receiverID, username, message, messageType, fileUrl, messageID });
				console.log(`Sender: ${senderID} currentChatUserID ${currentChatUserID} receiverID ${receiverID} userId ${userId} messageID ${messageID}`);
				console.log(typeof senderID, typeof currentChatUserID, typeof receiverID, typeof userId);

				
				// Only mark as seen if this is an incoming message AND the group chat is active
				if (senderID !== userId && !currentChatGroupID) {
					socket.emit('seenMessage', {
						messageID: messageID,
						senderID: senderID,
						userID: userId,
						chatType: 'private',
					});

					console.log("Works fines here", messageID);
				}
			}
		} else if (chatType === 'group') {
			// For group messages, check if this is for the current group
			if (groupID === currentChatGroupID) {
				displayMessage({ senderID, username, message, messageType, fileUrl, groupID, messageID });
				//console.log(`groupID: ${groupID} currentchatGroupID ${currentChatGroupID}`);
				//console.log('Works fine here before emitting');
				// Only mark as seen if this is an incoming message AND the group chat is active
				//console.log(`senderID: ${senderID} userID: ${userId} messageID: ${messageID} groupID: ${groupID} currentGroupID: ${currentChatGroupID}`);
				if (senderID !== userId && messageID && groupID === currentChatGroupID) {
					//console.log('Works fine here');
					socket.emit('seenMessage', {
						messageID: messageID,
						senderID: senderID,
						userID: userId,
						username: fullname.textContent,
						chatType: 'group',
						groupID: currentChatGroupID,
					});
				}
			}
		}

		// Always refresh recent chats when receiving any message
		socket.emit('recentChat', userId);
	}

	// Check Status of users
	socket.on('messageStatus', handleMessageStatus);

	function handleMessageStatus({ messageID, status, userID, username, seenByOthers }) {
		// Find the message element by messageID
		const messageElement = document.querySelector(`[data-message-id="${messageID}"]`);
		if (!messageElement) return;

		//console.log('Status update received:', messageID, status);

		// Update the status indicator
		const statusIndicator = messageElement.querySelector('.message-status');

		if (!statusIndicator) {
			const statusContainer = messageElement.querySelector('.message-status-container');
			if (statusContainer) {
				statusIndicator = statusContainer.querySelector('.message-status');
			}
		}

		if (!statusIndicator && messageElement.classList.contains('message-status-container')) {
			statusIndicator = messageElement.querySelector('.message-status');
		}

		if (!statusIndicator) return;

		//console.log(`Status: ${status}`);

		// Update status text and icon
		if (status === 'sent') {
			statusIndicator.innerHTML = '<i class="fas fa-check"></i>';
			statusIndicator.title = 'Sent';
			console.log('here');
		} else if (status === 'delivered') {
			statusIndicator.innerHTML = '<i class="fas fa-check-double"></i>';
			statusIndicator.title = 'Delivered';
			console.log('hair');
		} else if (status === 'seen') {
			statusIndicator.innerHTML = '<i class="fas fa-check-double seen-icon"></i>';
			console.log('hair1111');
			// For group chats, show who has seen the message
			if (currentChatGroupID) {
				const currentTitle = statusIndicator.title || '';
				// Parse existing seen users if any
				let seenUsers = [];

				if (currentTitle.startsWith('Seen by')) {
					seenUsers = currentTitle
						.replace('Seen by ', '')
						.split(', ')
						.filter((name) => name.trim() !== '');
				}

				// Only add username if not already in the list and not the current user
				if (username && !seenUsers.includes(username) && userID !== userId) {
					seenUsers.push(username);
				}

				// If we have seenByOthers from the database, use that instead
				if (seenByOthers && seenByOthers.trim()) {
					// This may already include duplicates, so we'll parse and deduplicate
					const otherUsers = seenByOthers.split(', ').filter((name) => name.trim() !== '');

					// Create a Set for deduplication
					const uniqueUsers = new Set([...seenUsers, ...otherUsers]);
					seenUsers = Array.from(uniqueUsers);
				}

				if (seenUsers.length > 0) {
					statusIndicator.title = `Seen by ${seenUsers.join(', ')}`;
				} else {
					statusIndicator.title = 'Seen';
				}
			} else {
				// Private message
				statusIndicator.title = 'Seen';
			}
		}
	}

	// Handle incoming reaction updates
	socket.on('reactionUpdate', handleReactionUpdate);
	socket.on('reactionRemoved', handleReactionRemoved);
	socket.on('messageReactions', handleMessageReactions);

	function handleReactionUpdate({ messageID, userID, username, emoji, chatType }) {
	const messageElement = document.querySelector(`[data-message-id="${messageID}"]`);
	if (!messageElement) return;
	
	// Get the reaction container
	const reactionContainer = messageElement.querySelector('.reaction-container');
	if (!reactionContainer) return;
	
	// Get current reactions from data attribute
	let reactions = {};
	try {
		reactions = JSON.parse(messageElement.getAttribute('data-reactions') || '{}');
	} catch (e) {
		reactions = {};
	}
	
	// Update reactions
	if (!reactions[emoji]) {
		reactions[emoji] = [];
		console.log("Hello there");
	}
	
	// Check if user already reacted with this emoji
	const userIndex = reactions[emoji].findIndex(r => r.userID === userID);
	if (userIndex === -1) {
		reactions[emoji].push({ userID, username });
		console.log("Hello there 2");
	}
	
	// Remove user from all existing emoji reactions
	for (const [em, users] of Object.entries(reactions)) {
		reactions[em] = users.filter(r => r.userID !== userID);
		}
		
	// Add user to new emoji reaction
	if (!reactions[emoji]) {
		reactions[emoji] = [];
	}
	reactions[emoji].push({ userID, username });

	// Update data attribute
	messageElement.setAttribute('data-reactions', JSON.stringify(reactions));
	
	// Update the UI
	updateReactionDisplay(reactionContainer, reactions);
	}

	setupEmojiPicker();
  
	// Add emoji button next to the message input
	const emojiButton = document.createElement('button');
	emojiButton.classList.add('btn', 'btn-secondary', 'ms-1');
	emojiButton.innerHTML = '<i class="far fa-smile"></i>';
	emojiButton.id = 'emojiButton';
	
	// Insert it after the image icon button
	const imageIconButton = document.getElementById('imageIcon');
	if (imageIconButton && imageIconButton.parentNode) {
		imageIconButton.parentNode.insertBefore(emojiButton, imageIconButton.nextSibling);
	}
	
	// Set up emoji button click handler
	emojiButton.addEventListener('click', function() {
		const messageInput = document.getElementById('messageInput');
		
		// Create a separate picker for inserting emojis into messages
		if (!window.messageEmojiPicker) {
		window.messageEmojiPicker = new EmojiButton({
			position: 'top-start',
			theme: 'auto',
			autoHide: true
		});
		
		window.messageEmojiPicker.on('emoji', emoji => {
			// Insert emoji at cursor position
			const cursorPos = messageInput.selectionStart;
			const textBeforeCursor = messageInput.value.substring(0, cursorPos);
			const textAfterCursor = messageInput.value.substring(cursorPos);
			
			messageInput.value = textBeforeCursor + emoji + textAfterCursor;
			
			// Move cursor position after the inserted emoji
			messageInput.selectionStart = cursorPos + emoji.length;
			messageInput.selectionEnd = cursorPos + emoji.length;
			messageInput.focus();
		});
		}
		
		window.messageEmojiPicker.togglePicker(emojiButton);
	});

	function sendMessage(message, file) {
		if (!message.trim() && !file) return;

		chatType = currentChatGroupID ? 'group' : 'private';
		const receiverID = currentChatGroupID || currentChatUserID;

		//console.log(`Send message to ${receiverID}`);

		//console.log('Chat Type: ' + chatType);

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

		//console.log(`Chat Type is ${chatType}`);
		//console.log(`GROUP ID IS ${groupID}`);

		fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			body: formData,
		})
			.then((res) => res.json())
			.then((data) => {
				//console.log('Upload response:', data);
				payload.fileUrl = data.fileUrl || null;
				//console.log(`payload: ${payload}`);
				socket.emit('sendmessage', payload);
				socket.emit('recentChat', userId);
			})
			.catch((err) => console.error('Upload error:', err));
	}

	function createMessageElement(msg) {
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
		messageElement.classList.add('message-box');
	
		if (msg.senderID === userId) {
			messageWrapper.classList.add('my-message');
		} else {
			messageWrapper.classList.add('other-message');
		}
	
		const statusContainer = document.createElement('div');
		statusContainer.classList.add('message-status-container');
	
		const statusIndicator = document.createElement('span');
		statusIndicator.classList.add('message-status');
	
		if (msg.messageType === 'image' && msg.fileUrl) {
			try {
				const fileUrls = JSON.parse(msg.fileUrl);
				fileUrls.forEach((file) => {
					const imgElement = document.createElement('img');
					imgElement.dataset.src = `http://localhost/chat-app/server${file.url}`;
					imgElement.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // blank placeholder
					imgElement.classList.add('chat-image', 'img-fluid', 'lazy-load');
					imgElement.addEventListener('click', function () {
						openImageModal(this.dataset.src || this.src);
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
					fileLink.classList.add('file-link', 'lazy-file');
					fileLink.dataset.href = `http://localhost/chat-app/server${file.url}`;
					fileLink.href = '#';
					fileLink.append(displayname);
					fileLink.target = '_blank';

					if (msg.senderID === userId) {
						fileLink.classList.add('my-file-link');
					} else {
						fileLink.classList.add('other-file-link');
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
	
		if (msg.messageID) {
			messageWrapper.setAttribute('data-message-id', msg.messageID);
		}
	
		const reactionButton = document.createElement('button');
		reactionButton.classList.add('reaction-button');
		reactionButton.innerHTML = '<i class="far fa-smile"></i>';
		reactionButton.title = "Add reaction";
		reactionButton.addEventListener('click', function(e) {
			e.preventDefault();
			e.stopPropagation();
	
			currentReactionTarget = this;
	
			if (emojiPicker) {
				emojiPicker.togglePicker(reactionButton);
			}
		});
	
		const reactionContainer = document.createElement('div');
		reactionContainer.classList.add('reaction-container');
		messageWrapper.setAttribute('data-reactions', '{}');
	
		const messageContentWrapper = document.createElement('div');
		messageContentWrapper.classList.add('message-content-wrapper');
	
		if (msg.senderID === userId) {
			statusIndicator.innerHTML = '<i class="fas fa-check"></i>';
			statusIndicator.title = 'Sent';
			messageContentWrapper.classList.add('sender-layout');
			statusContainer.appendChild(statusIndicator);
			messageContentWrapper.appendChild(reactionButton);
			messageContentWrapper.appendChild(messageElement);
			messageWrapper.appendChild(reactionContainer);
			messageWrapper.appendChild(messageContentWrapper);
			messageWrapper.appendChild(statusContainer);
		} else {
			messageContentWrapper.classList.add('receiver-layout');
			statusContainer.appendChild(statusIndicator);
			messageContentWrapper.appendChild(messageElement);
			messageContentWrapper.appendChild(reactionButton);
			messageWrapper.appendChild(reactionContainer);
			messageWrapper.appendChild(messageContentWrapper);
			messageWrapper.appendChild(statusContainer);
		}
	
		lastSenderId = msg.senderID;

		console.log(msg.messageID, msg.status, msg.username);
	
		handleMessageStatus({
			messageID: msg.messageID,
			status: msg.status,
			userID: msg.userID,
			username: msg.username,
			seenByOthers: msg.seenByUsers,
		});
	
		if (msg.messageID) {
			socket.emit('getMessageReactions', {
				messageID: msg.messageID,
				chatType: currentChatGroupID ? 'group' : 'private'
			});
		}
	
		return messageWrapper; 
	}

	function displayMessage(msg) {
		const messageElement = createMessageElement(msg);
		messages.appendChild(messageElement);
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

				// Create chatItem list
				const chatItem = document.createElement('div');
				chatItem.classList.add('chat-item', 'd-flex', 'align-items-center');

				// Create status indicator
				const statusIndicator = document.createElement('span');
				statusIndicator.classList.add('status-indicator', 'mr-2');

				// Set appropriate data attribute for status tracking
				if (chat.chatType === 'private') {
					statusIndicator.setAttribute('data-user-id', chat.userID);
					// Set initial status
					statusIndicator.classList.add(onlineUsers.has(chat.userID) ? 'online' : 'offline');
				} else {
					statusIndicator.setAttribute('data-group-id', chat.userID);
					// Set initial status for group
					statusIndicator.classList.add(onlineGroups.get(chat.userID) ? 'online' : 'offline');
				}

				const button = document.createElement('button');
				button.type = 'button';
				button.classList.add('btn', 'btn-light', 'mb-0', 'w-100', 'p-3', 'mb-2', 'text-left');

				// Text wrapper for the username
				const textSpan = document.createElement('span');
				textSpan.classList.add('ms-2', 'flex-grow-1');
				chatName.classList.add('fw-bold');
				if (chat.chatType === 'private') {
					textSpan.textContent = `${chat.firstname} ${chat.lastname}`;
					chatNameUsers = `${chat.firstname} ${chat.lastname}`;
				} else {
					textSpan.textContent = `${chat.username} (Group)`;
					chatNameUsers = `${chat.username} (Group)`;
				}

				// Append status indicator and text to button
				button.appendChild(statusIndicator);
				button.appendChild(textSpan);

				// Fetch all messages for this user on click
				button.addEventListener('click', () => {
					fetchChatHistory(chat.userID, chat.chatType);
					document.getElementById("sidebar").classList.remove("active");
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
		// Call status update after rendering the chat list
		updateUserStatusIndicators();
	}

	function fetchChatHistory(otherUserID, chatType,  offset = 0, limit = 20) {
		if ((chatType === 'private' && currentChatUserID === otherUserID && offset === 0) || 
        (chatType === 'group' && currentChatGroupID === otherUserID && offset === 0)) {
        	return;
    	}

		if (offset === 0) {
			reachedBeginningOfChat = false;

			// Only reset UI when loading the first batch
			if (chatType === 'group') {
				currentChatGroupID = otherUserID;
				currentChatUserID = null;
				updateGroupHeader(currentChatGroupID);
			} else {
				currentChatUserID = otherUserID;
				currentChatGroupID = null;
				updateHeaderStatus();
			}
	
			socket.emit('activateChat', {
				userID: userId,
				chatType,
				groupID: chatType === 'group' ? otherUserID : null,
				otherUserID: chatType === 'private' ? otherUserID : null,
			});
	
			messages.innerHTML = '';
			
			// Reset typing indicator
			const typingIndicator = document.getElementById('typingIndicator');
			if (typingIndicator) {
				typingIndicator.style.display = 'none';
			}
			typingUsers.clear();
			
			 // Remove old scroll listeners first to prevent duplicates
			 messages.removeEventListener('scroll', scrollHandler);
        
			 // Add scroll event listener for loading more messages
			 messages.addEventListener('scroll', scrollHandler);
		}

		// Show loading indicator if loading more messages
		if (offset > 0) {
			console.log('Loading more messages with offset:', offset);
			const existingIndicator = document.querySelector('.loading-messages');
			if (!existingIndicator) {
				const loadingIndicator = document.createElement('div');
				loadingIndicator.id = 'loading-messages-indicator';
				loadingIndicator.classList.add('loading-messages');
				loadingIndicator.textContent = 'Loading more messages...';
				messages.prepend(loadingIndicator);
			}
		}

		//Data that needed to be sent in getMessages API to satisfy the condition
		const payload = {
			userID: userId,
			otherUserID: chatType === 'private' ? currentChatUserID : null,
			groupID: chatType === 'group' ? currentChatGroupID : null,
			chatType,
			limit,
			offset,
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
			.then((messagesData) => {
				// Remove loading indicator if present
				const loadingIndicator = document.querySelector('.loading-messages');
				if (loadingIndicator) {
					messages.removeChild(loadingIndicator);
				}
				
				// Remember scroll position if loading more messages
				const scrollPos = messages.scrollHeight - messages.scrollTop;
				
				// Keep track of last sender for grouping messages
				if (offset === 0) {
					lastSenderId = null;
				}

				// No more messages to load
				if (messagesData.length < limit) {
					reachedBeginningOfChat = true;
					if (offset > 0 || messagesData.length === 0) {
						const existingEndMarker = document.querySelector('.end-of-messages');
						if (!existingEndMarker) {
							const endMarker = document.createElement('div');
							endMarker.classList.add('end-of-messages');
							endMarker.textContent = 'Beginning of conversation';
							messages.prepend(endMarker);
						}
					}
				}

				if (chatType === 'group') {
					// Group messages query returns in DESC order, so reverse
					messagesData = messagesData.reverse();
				}
				
				// If loading more messages, prepend them
				// Otherwise, append them

				if (offset > 0) {
					const fragment = document.createDocumentFragment();
					messagesData.forEach((msg) => {
						const messageWrapper = createMessageElement(msg);
						fragment.prepend(messageWrapper);

						handleMessageStatus({
							messageID: msg.messageID,
							status: msg.status,
							userID: msg.userID,
							username: msg.username,
							seenByOthers: msg.seenByUsers,
						});

					});
					
					messages.prepend(fragment);
					
					// Maintain scroll position
					messages.scrollTop = messages.scrollHeight - scrollPos;
				} else {
					// First load - append messages and scroll to bottom
					messagesData.forEach((msg) => {
						displayMessage(msg);

						handleMessageStatus({
							messageID: msg.messageID,
							status: msg.status,
							userID: msg.userID,
							username: msg.username,
							seenByOthers: msg.seenByUsers,
						});	
					});	
					messages.scrollTop = messages.scrollHeight;
				}
				// Initialize Intersection Observer for lazy loading images
				initLazyLoading();
			})
			.catch((error) => {
				console.error('Error fetching chat history:', error);
				const loadingIndicator = document.querySelector('.loading-messages');
				if (loadingIndicator) {
					loadingIndicator.remove();
				}
			});
	}

	function scrollHandler() {
		if (messages.scrollTop < 50 && !reachedBeginningOfChat && !isLoadingMoreMessages) {
			// User scrolled to top, load more messages
			isLoadingMoreMessages = true;
			const currentCount = document.querySelectorAll('.message-wrapper').length;
			const newOffset = currentCount; // Set new offset to current count
			fetchChatHistory(
				currentChatGroupID ? currentChatGroupID : currentChatUserID,
				currentChatGroupID ? 'group' : 'private',
				newOffset, // Use new offset
				20 // Limit
			);
			setTimeout(() => {
				isLoadingMoreMessages = false;
			}, 1000); // Debounce the scroll loading
		}
	}

	let isLoadingMoreMessages = false;

	//console.log('It start to run this socket.emit');
	socket.emit('recentChat', userId);

	let initialChatLoaded = false;

	socket.on('recentChatResult', (data) => {
		//console.log('Recent Data: ', data);
		recent(data);

		// Automatically open the first/most recent chat only on initial load
		if (data && data.length > 0 && !initialChatLoaded) {
			// Get the first chat (most recent)
			const recentChat = data[0];

			// Set the chat name in the header
			let chatNameUsers;
			if (recentChat.chatType === 'private') {
				chatNameUsers = `${recentChat.firstname} ${recentChat.lastname}`;
			} else {
				chatNameUsers = `${recentChat.username} (Group)`;
			}
			chatName.textContent = chatNameUsers;

			// Fetch the chat history for this user/group
			fetchChatHistory(recentChat.userID, recentChat.chatType);

			// Highlight the button
			setTimeout(() => {
				const firstChatButton = document.querySelector('.chat-item button');
				if (firstChatButton) {
					firstChatButton.classList.add('hover-effect');
				}
			}, 100);

			// Set the flag to true so we don't automatically open chats again
			initialChatLoaded = true;
		}
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
		//console.log(creatorID);

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

	// Create a debounced search function
	const performSearch = async (searchValue) => {
		if (searchValue === lastSearchValue) {
			return; // Prevent duplicate search requests
		}

		lastSearchValue = searchValue;

		if (searchValue === '') {
			// If search is empty, show recent chats again
			searchResults.innerHTML = '';
			searchResults.style.display = 'none';
			recentChat.style.display = 'block'; // Show recent chats
			return; 
		}
		
		searchResults.style.display = 'block';
		recentChat.style.display = 'none';

		// Fetch search results and display them
		const data = await fetchSearchResults(searchValue);
		displaySearchResults(data);
	};

	//Initializing the debounce function
	const debouncedSearch = debounce((value) => performSearch(value), 300);

	// Detect typing in the search bar
	searchInput.addEventListener('input', async () => {
		const searchValue = searchInput.value.trim();
		debouncedSearch(searchValue);
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

	// Add these handlers in your setupChat function
	socket.on('onlineUsers', (users) => {
		// Clear and refill the set
		onlineUsers.clear();
		users.forEach((userID) => {
			onlineUsers.add(userID.toString());
		});

		// Update UI
		updateUserStatusIndicators();
	});

	socket.on('groupStatusUpdate', ({ groupID, hasOnlineMembers }) => {
		// Update group status
		onlineGroups.set(parseInt(groupID), hasOnlineMembers);

		// Update UI
		updateUserStatusIndicators();

		// Update header if relevant
		if (currentChatGroupID === parseInt(groupID)) {
			updateGroupHeader(currentChatGroupID);
		}
	});

	socket.on('statusUpdate', ({ userID, status }) => {
		// Update individual user status
		const userIdString = String(userID);

		if (status === 'online') {
			onlineUsers.add(userIdString);
		} else {
			onlineUsers.delete(userIdString);
		}
		
		console.log('Hello World ');
		// Update UI
		updateUserStatusIndicators();

		// If we're in a group chat, update group header
		if (currentChatGroupID) {
			updateGroupHeader(currentChatGroupID);
		}
	});

	socket.on('groupOnlineStatus', (groupStatuses) => {
		// Parse and update group statuses
		Object.entries(groupStatuses).forEach(([groupID, isOnline]) => {
			onlineGroups.set(groupID, isOnline);
		});

		// Update UI
		updateUserStatusIndicators();
	});

	// Add this function to display online members count in the header
	function updateGroupHeader(groupID) {
		if (!groupID) return;

		// Fetch online members count for this group
		fetch(`http://localhost:3000/search/groupMembers?groupID=${groupID}`, {
			method: 'GET',
			credentials: 'include',
		})
			.then((response) => response.json())
			.then((members) => {
				// Ensure all IDs are strings before comparison
				const onlineCount = members.filter((member) => 
					onlineUsers.has(String(member.userID))
				).length;
				const totalCount = members.length;

				/*
				console.log(`Online Count: ${onlineCount} groupID: ${groupID}`);
				console.log('onlineUsers Set:', Array.from(onlineUsers));
				console.log(
					'member IDs:',
					members.map((m) => String(m.userID))
				);
				*/

				// Create status elements if they don't exist
				let statusText = document.getElementById('group-status-text');
				if (!statusText) {
					statusText = document.createElement('span');
					statusText.id = 'group-status-text';
					statusText.className = 'ms-2';
					document.querySelector('.chat-header').appendChild(statusText);
				}
	
				let statusIndicator = document.getElementById('chat-status-indicator');
				if (!statusIndicator) {
					statusIndicator = document.createElement('span');
					statusIndicator.id = 'chat-status-indicator';
					statusIndicator.className = 'status-indicator ms-2';
					document.querySelector('.chat-header').appendChild(statusIndicator);
				}
	
				// Update the status text
				statusText.textContent = `${onlineCount} of ${totalCount} online`;
				statusText.style.display = 'inline-block';
	
				// Update the status indicator
				statusIndicator.classList.remove('online', 'offline');
				statusIndicator.classList.add(onlineCount > 0 ? 'online': 'offline');
				statusIndicator.style.display = 'inline-block';
				statusIndicator.title = onlineCount > 0 ? 'Online' : 'Offline';

				//console.log(statusIndicator.classList);
			})
			.catch((error) => console.error('Error fetching group members:', error));
	}

	// Enhance the updateUserStatusIndicators function with tooltips
	function updateUserStatusIndicators() {
		// console.log('Updating status indicators...');
		// console.log('Online users:', Array.from(onlineUsers));
		// console.log('Online groups:', Array.from(onlineGroups.entries()));
		
		// Update private chat indicators
		document.querySelectorAll('.status-indicator[data-user-id]').forEach((indicator) => {
			const userID = indicator.dataset.userId;
			// Convert to string to ensure proper comparison
			const isOnline = onlineUsers.has(String(userID));
	
			indicator.classList.remove('online', 'offline');
			indicator.classList.add(isOnline ? 'online' : 'offline');
			indicator.setAttribute('title', isOnline ? 'Online' : 'Offline');
	
			// console.log(`Updating user ${userID} status to ${isOnline ? 'online' : 'offline'}`);
		});
	
		// Update group chat indicators
		document.querySelectorAll('.status-indicator[data-group-id]').forEach((indicator) => {
			const groupID = parseInt(indicator.dataset.groupId);
			// Ensure consistent comparison
			const hasOnlineMembers = Boolean(onlineGroups.get(groupID));
	
			indicator.classList.remove('online', 'offline');
			indicator.classList.add(hasOnlineMembers ? 'online' : 'offline');
			indicator.setAttribute('title', hasOnlineMembers ? 'Members online' : 'No members online');
	
			// console.log(`Updating group ${groupID} status to ${hasOnlineMembers ? 'online' : 'offline'}`);
		});
	
		// Update header status indicator
		updateHeaderStatus();
	}
	// Enhanced updateHeaderStatus function with tooltips
	function updateHeaderStatus() {
		const statusIndicator = document.getElementById('chat-status-indicator');
		const groupStatusText = document.getElementById('group-status-text');
		// Create elements if they don't exist 
		if (!statusIndicator) {
			const headerElement = document.querySelector('.chat-header');
			if (!headerElement) return;
			
			const newStatusIndicator = document.createElement('span');
			newStatusIndicator.id = 'chat-status-indicator';
			newStatusIndicator.className = 'status-indicator ms-2';
			headerElement.appendChild(newStatusIndicator);
		}

		if (!groupStatusText && currentChatGroupID) {
			const headerElement = document.querySelector('.chat-header');
			if (!headerElement) return;
			
			const newStatusText = document.createElement('span');
			newStatusText.id = 'group-status-text';
			newStatusText.className = 'ms-2';
			headerElement.appendChild(newStatusText);
		}

		// Get fresh references after possibly creating elements
		const updatedStatusIndicator = document.getElementById('chat-status-indicator');
		const updatedGroupStatusText = document.getElementById('group-status-text');
		
		if (!updatedStatusIndicator) return;
	
		// console.log('Updating header status:', {
		// 	currentChatUserID,
		// 	currentChatGroupID,
		// 	chatType: currentChatGroupID ? 'group' : 'private',
		// });
	
		// Hide both elements initially
		updatedStatusIndicator.style.display = 'none';
		if (updatedGroupStatusText) updatedGroupStatusText.style.display = 'none';

		if (currentChatUserID) {
			console.log(`current: ${currentChatUserID}`);
			// Private chat
			const isOnline = onlineUsers.has(String(currentChatUserID));
	
			updatedStatusIndicator.style.display = 'inline-block';
			updatedStatusIndicator.classList.remove('online', 'offline');
			updatedStatusIndicator.classList.add(isOnline ? 'online' : 'offline');

			groupStatusText.textContent = isOnline ? 'Online' : 'Offline';
			groupStatusText.style.display = 'inline-block';

		} else if (currentChatGroupID) {
			// Group chat
			const hasOnlineMembers = Boolean(onlineGroups.get(currentChatGroupID));

			console.log(`Has online members: ${ hasOnlineMembers }`);
	
			updatedStatusIndicator.style.display = 'inline-block';
			updatedStatusIndicator.classList.remove('online', 'offline');
			updatedStatusIndicator.classList.add(hasOnlineMembers ? 'online' : 'offline');
	
			// Show group status text if it exists
			if (updatedGroupStatusText) {
				updatedGroupStatusText.style.display = 'inline-block';
			}
		} else {
			// No chat selected
			updatedStatusIndicator.style.display = 'none';
		}
	}

	//Checking the file size, should be maximum of 10MB 
	function validateFileSize(file) {
		const maxSize = 10 * 1024 * 1024; // 10MB in bytes
		if (file.size > maxSize) {
		  alert(`File "${file.name}" exceeds the 10MB size limit.`);
		  return false;
		}
		return true;
	}

	//Creating debounce function
	function debounce(func, delay) {
		let timeoutId;
		return function(...args) {
		  clearTimeout(timeoutId);
		  timeoutId = setTimeout(() => {
			func.apply(this, args);
		  }, delay);
		};
	  }
	
	//Jquery for previewing the images or files when user selects it
	let selectedFiles = []; // Stores selected files or images

	// Function to add files to array and update preview
	function addFiles(files) {
		Array.from(files).forEach((file) => {
			if (validateFileSize(file)) {
				selectedFiles.push(file);
				displayPreview(file);
			}
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

		// Define the drop zone (your message input area)
		const dropZone = $('.chat-panel');
  
		// Prevent default behaviors for drag events
		['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
		  dropZone[0].addEventListener(eventName, preventDefaults, false);
		});
		
		function preventDefaults(e) {
		  e.preventDefault();
		  e.stopPropagation();
		}
		
		// Highlight drop zone when dragging over it
		['dragenter', 'dragover'].forEach(eventName => {
		  dropZone[0].addEventListener(eventName, highlight, false);
		});
		
		['dragleave', 'drop'].forEach(eventName => {
		  dropZone[0].addEventListener(eventName, unhighlight, false);
		});
		
		function highlight() {
		  dropZone.addClass('drag-highlight');
		}
		
		function unhighlight() {
		  dropZone.removeClass('drag-highlight');
		}
		
		// Handle dropped files
		dropZone[0].addEventListener('drop', handleDrop, false);
		
		function handleDrop(e) {
		  const dt = e.dataTransfer;
		  const files = dt.files;
		  
		  if (files.length > 0) {
			addFiles(files);
		  }
		}
		
		// Add this CSS to your stylesheet
		$('<style>')
		  .text(`
			.drag-highlight {
			  border: 2px dashed #007bff;
			  background-color: rgba(0, 123, 255, 0.1);
			}
		  `)
			.appendTo('head');
		
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

// Setup emoji library when the document is ready
function setupEmojiPicker() {
	// We'll use the picker-emoji library which is CDN available
	if (typeof EmojiButton !== 'undefined') {
	  // Initialize global emoji picker
	  emojiPicker = new EmojiButton({
		position: 'top-start',
		theme: 'auto',
		autoHide: true,
		emojiSize: '1.5rem'
	  });

		console.log("Emoji container here");
  
	  // Handle emoji selection
	  emojiPicker.on('emoji', emoji => {
		if (currentReactionTarget) {
		  const messageElement = currentReactionTarget.closest('[data-message-id]');
		  const messageID = messageElement.getAttribute('data-message-id');
		  
		  // Determine if this is a group or private chat
		  const chatType = currentChatGroupID ? 'group' : 'private';
		  
		  // Send the reaction to the server
		  socket.emit('addReaction', {
			messageID,
			userID: userId,
			emoji: emoji,
			chatType,
			groupID: currentChatGroupID,
			receiverID: currentChatUserID
		  });
		}
		currentReactionTarget = null;
	  });
	}
}

function handleReactionRemoved({ messageID, userID, emoji, chatType }) {
	const messageElement = document.querySelector(`[data-message-id="${messageID}"]`);
	if (!messageElement) return;
	
	// Get the reaction container
	const reactionContainer = messageElement.querySelector('.reaction-container');
	if (!reactionContainer) return;
	
	// Get current reactions
	let reactions = {};
	try {
	  reactions = JSON.parse(messageElement.getAttribute('data-reactions') || '{}');
	} catch (e) {
	  reactions = {};
	}
	
	// Remove this reaction
	if (reactions[emoji]) {
	  reactions[emoji] = reactions[emoji].filter(r => r.userID !== userID);
	  if (reactions[emoji].length === 0) {
		delete reactions[emoji];
	  }
	}
	
	// Update data attribute
	messageElement.setAttribute('data-reactions', JSON.stringify(reactions));
	
	// Update the UI
	updateReactionDisplay(reactionContainer, reactions);
}
  
function handleMessageReactions({ messageID, reactions }) {
	const messageElement = document.querySelector(`[data-message-id="${messageID}"]`);
	if (!messageElement) return;
	
	// Get the reaction container
	const reactionContainer = messageElement.querySelector('.reaction-container');
	if (!reactionContainer) return;
	
	// Transform reactions into the format we use
	let formattedReactions = {};
	reactions.forEach(r => {
	  if (!formattedReactions[r.emoji]) {
		formattedReactions[r.emoji] = [];
	  }
	  formattedReactions[r.emoji].push({ userID: r.userID, username: r.username });
	});
	
	// Update data attribute
	messageElement.setAttribute('data-reactions', JSON.stringify(formattedReactions));
	
	// Update the UI
	updateReactionDisplay(reactionContainer, formattedReactions);
}
  
function updateReactionDisplay(container, reactions) {
	// Clear the container
	container.innerHTML = '';
	
	// Add each emoji reaction
	Object.keys(reactions).forEach(emoji => {
	  if (reactions[emoji].length > 0) {
		const reactionBubble = document.createElement('div');
		reactionBubble.classList.add('reaction-bubble');
		
		// Emoji + count
		reactionBubble.innerHTML = `${emoji} <span class="reaction-count">${reactions[emoji].length}</span>`;
		
		// Add title with names of reactors
		const reactorNames = reactions[emoji].map(r => r.username).join(', ');
		reactionBubble.title = reactorNames;
		
		// Allow toggling your own reactions
		reactionBubble.addEventListener('click', function() {
		  const messageElement = container.closest('[data-message-id]');
		  const messageID = messageElement.getAttribute('data-message-id');
		  const chatType = currentChatGroupID ? 'group' : 'private';
		  
		  // Check if the current user has already reacted with this emoji
		  const userReacted = reactions[emoji].some(r => r.userID === userId);
		  
		  if (userReacted) {
			// Remove reaction
			socket.emit('removeReaction', {
			  messageID,
			  userID: userId,
			  emoji,
			  chatType,
			  groupID: currentChatGroupID,
			  receiverID: currentChatUserID
			});
		  } else {
			// Add reaction
			socket.emit('addReaction', {
			  messageID,
			  userID: userId,
			  emoji,
			  chatType,
			  groupID: currentChatGroupID,
			  receiverID: currentChatUserID
			});
		  }
		});
		
		container.appendChild(reactionBubble);
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
