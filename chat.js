(function () {
	const chatContainer = document.getElementById('chatContainer');
	const composerForm = document.getElementById('composer');
	const textInput = document.getElementById('textInput');
	const sendButton = document.getElementById('sendButton');
	const imageInput = document.getElementById('imageInput');
	const micButton = document.getElementById('micButton');
	const convoList = document.getElementById('convoList');
	const newChatBtn = document.getElementById('newChatBtn');

	// Build messages scroller inside chat container
	const messagesEl = document.createElement('div');
	messagesEl.className = 'messages';
	chatContainer.appendChild(messagesEl);

	function formatTime(date) {
		const d = date || new Date();
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function scrollToBottom() {
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	function createMessageElement(role, contentNode) {
		const wrapper = document.createElement('div');
		wrapper.className = `message ${role}`;

		const bubble = document.createElement('div');
		bubble.className = 'bubble';
		bubble.appendChild(contentNode);

		const time = document.createElement('span');
		time.className = 'timestamp';
		time.textContent = formatTime();
		bubble.appendChild(time);

		wrapper.appendChild(bubble);
		return wrapper;
	}

	function addTextMessage(role, text) {
		const p = document.createElement('div');
		p.textContent = text;
		const el = createMessageElement(role, p);
		messagesEl.appendChild(el);
		scrollToBottom();
		return el;
	}

	function addImageMessage(role, dataUrl) {
		const img = document.createElement('img');
		img.src = dataUrl;
		img.alt = 'uploaded image';
		const el = createMessageElement(role, img);
		messagesEl.appendChild(el);
		scrollToBottom();
		return el;
	}

	function addLoader() {
		const loader = document.createElement('div');
		loader.className = 'loader';
		loader.innerHTML = '<span></span><span></span><span></span>';
		const el = createMessageElement('bot', loader);
		messagesEl.appendChild(el);
		scrollToBottom();
		return el;
	}

	async function fileToDataUrl(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function sendPromptToApi(prompt) {
		const res = await fetch('http://localhost:11434/api/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: 'healthconnect-model', prompt, stream: false })
		});
		if (!res.ok) throw new Error(`API error: ${res.status}`);
		const data = await res.json();
		// Ollama returns { response: string } when stream=false
		return data.response || data.text || '';
	}

	// ------------------ Sessions (localStorage) ------------------
	const STORAGE_KEY = 'hc_sessions_v1';
	let sessions = [];
	let activeSessionId = null;

	function loadSessions() {
		try {
			sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
		} catch { sessions = []; }
		if (!Array.isArray(sessions)) sessions = [];
		if (!sessions.length) {
			const session = createNewSession();
			sessions.push(session);
			activeSessionId = session.id;
			saveSessions();
		} else if (!activeSessionId) {
			activeSessionId = sessions[0].id;
		}
	}

	function saveSessions() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
	}

	function createNewSession() {
		return {
			id: `s_${Date.now()}`,
			title: 'New chat',
			createdAt: Date.now(),
			messages: []
		};
	}

	function setActiveSession(sessionId) {
		activeSessionId = sessionId;
		renderMessages();
		renderSidebar();
	}

	function getActiveSession() {
		return sessions.find(s => s.id === activeSessionId);
	}

	function upsertTitleFromFirstUserMessage(session) {
		const first = session.messages.find(m => m.role === 'user');
		if (first) {
			const raw = typeof first.content === 'string' ? first.content : '[Image]';
			const title = raw.replace(/\s+/g, ' ').slice(0, 28) || 'Conversation';
			session.title = title;
		}
	}

	function renderSidebar() {
		convoList.innerHTML = '';
		sessions
			.sort((a,b) => b.createdAt - a.createdAt)
			.forEach(s => {
				const item = document.createElement('div');
				item.className = 'convo-item' + (s.id === activeSessionId ? ' active' : '');
				const actions = document.createElement('div');
				actions.className = 'convo-actions';
				const delBtn = document.createElement('button');
				delBtn.className = 'btn-icon';
				delBtn.title = 'Delete chat';
				delBtn.textContent = '🗑️';
				delBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					deleteSession(s.id);
				});
				actions.appendChild(delBtn);
				const title = document.createElement('div');
				title.className = 'convo-title';
				title.textContent = s.title || 'Conversation';
				const time = document.createElement('div');
				time.className = 'convo-time';
				time.textContent = new Date(s.createdAt).toLocaleString();
				item.appendChild(actions);
				item.appendChild(title);
				item.appendChild(time);
				item.addEventListener('click', () => {
					setActiveSession(s.id);
				});
				convoList.appendChild(item);
			});
	}

	function renderMessages() {
		messagesEl.innerHTML = '';
		const session = getActiveSession();
		if (!session) return;
		session.messages.forEach(m => {
			if (m.type === 'image') {
				addImageMessage(m.role, m.content);
			} else {
				addTextMessage(m.role, m.content);
			}
		});
		scrollToBottom();
	}

	function addToSession(role, content, type) {
		const session = getActiveSession();
		if (!session) return;
		session.messages.push({ role, content, type: type || 'text', ts: Date.now() });
		if (!session.title || session.title === 'New chat') {
			upsertTitleFromFirstUserMessage(session);
		}
		saveSessions();
		renderSidebar();
	}

	async function handleSendText(text) {
		if (!text) return;
		addTextMessage('user', text);
		addToSession('user', text, 'text');
		textInput.value = '';
		textInput.focus();
		const loader = addLoader();
		try {
			const reply = await sendPromptToApi(text);
			messagesEl.removeChild(loader);
			addTextMessage('bot', reply || '');
			addToSession('bot', reply || '', 'text');
		} catch (err) {
			messagesEl.removeChild(loader);
			addTextMessage('bot', 'Sorry, I had trouble replying.');
			// eslint-disable-next-line no-console
			console.error(err);
		}
	}

	async function handleSendImage(file) {
		if (!file) return;
		const dataUrl = await fileToDataUrl(file);
		addImageMessage('user', dataUrl);
		addToSession('user', dataUrl, 'image');
		const loader = addLoader();
		try {
			const reply = await sendPromptToApi(dataUrl);
			messagesEl.removeChild(loader);
			addTextMessage('bot', reply || '');
			addToSession('bot', reply || '', 'text');
		} catch (err) {
			messagesEl.removeChild(loader);
			addTextMessage('bot', 'Image upload worked, but the server failed to respond.');
			// eslint-disable-next-line no-console
			console.error(err);
		}
	}

	composerForm.addEventListener('submit', function (e) {
		e.preventDefault();
		handleSendText(textInput.value.trim());
	});

	sendButton.addEventListener('click', function (e) {
		e.preventDefault();
		handleSendText(textInput.value.trim());
	});

	imageInput.addEventListener('change', function () {
		if (imageInput.files && imageInput.files[0]) {
			handleSendImage(imageInput.files[0]);
			imageInput.value = '';
		}
	});

	// Voice to text (Web Speech API)
	let recognition;
	let recognizing = false;
	(function initSpeech() {
		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SpeechRecognition) return; // not supported
		recognition = new SpeechRecognition();
		recognition.lang = 'en-US';
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;
		recognition.onresult = (event) => {
			const text = event.results[0][0].transcript;
			textInput.value = text;
			handleSendText(text);
		};
		recognition.onend = () => {
			recognizing = false;
			micButton.classList.remove('active');
		};
	})();

	micButton.addEventListener('click', function (e) {
		e.preventDefault();
		if (!recognition) {
			addTextMessage('bot', 'Voice input not supported in this browser.');
			return;
		}
		if (recognizing) {
			recognition.stop();
			return;
		}
		try {
			recognition.start();
			recognizing = true;
			micButton.classList.add('active');
		} catch (_) {
			// ignore if already started
		}
	});

	// New Chat: archive current (already saved) and start a fresh one
	newChatBtn.addEventListener('click', function () {
		const session = createNewSession();
		sessions.push(session);
		saveSessions();
		setActiveSession(session.id);
	});

	function deleteSession(id) {
		const idx = sessions.findIndex(s => s.id === id);
		if (idx === -1) return;
		const ok = confirm('Delete this chat permanently?');
		if (!ok) return;
		sessions.splice(idx, 1);
		if (!sessions.length) {
			const s = createNewSession();
			sessions.push(s);
			activeSessionId = s.id;
		} else if (activeSessionId === id) {
			activeSessionId = sessions[0].id;
		}
		saveSessions();
		renderSidebar();
		renderMessages();
	}

	// Init
	loadSessions();
	renderSidebar();
	renderMessages();
})();


