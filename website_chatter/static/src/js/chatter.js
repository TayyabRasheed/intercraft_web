(function () {
    if (window._intercraftChatInit) return;
    window._intercraftChatInit = true;

    setTimeout(function () {
        var panel        = document.getElementById('chatSidePanel');
        var fab          = document.getElementById('chatFabBtn');
        if (!panel || !fab) return;

        var overlay      = document.getElementById('chatOverlay');
        var closeBtn     = document.getElementById('chatCloseBtn');
        var clearBtn     = document.getElementById('chatClearBtn');
        var resizeBtn    = document.getElementById('chatResizeBtn');
        var sendBtn      = document.getElementById('chat-send-btn');
        var input        = document.getElementById('chat-input');
        var badge        = document.getElementById('chatBadge');
        var iconExpand   = document.getElementById('resizeIconExpand');
        var iconCollapse = document.getElementById('resizeIconCollapse');
        var msgBox       = document.getElementById('chat-messages');
        var chatApiUrl   = null;
        var isExpanded   = false;
        var STORAGE_KEY  = 'intercraft_chat_state';

        var BOT_AVATAR  = '<img src="/website_chatter/static/src/images/chatbot.png" alt="bot" style="width:42px;height:39px;object-fit:contain;"/>';
        var USER_AVATAR = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>';

        function loadState()   { try { var r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch (_) {} return { thread_id: null, messages: [], summary: null }; }
        function saveState(s)  { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {} }
        function clearStorage(){ try { localStorage.removeItem(STORAGE_KEY); } catch (_) {} }
        function clearState()  { return { thread_id: null, messages: [], summary: null }; }

        // Load history into memory for AI context, but never show it visually on reload
        var chatState = loadState();

        // Always start with panel closed
        panel.style.display = 'none';
        if (overlay) overlay.style.display = 'none';

        fetch('/web/chat/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} })
        }).then(r => r.json()).then(d => { chatApiUrl = d.result && d.result.api_url; });

        function applySize() {
            var vw = window.innerWidth, vh = window.innerHeight, mobile = vw <= 480;
            var s = mobile ? { w: vw, h: vh } : {
                w: Math.min(isExpanded ? 680 : 420, vw - 48),
                h: Math.min(isExpanded ? 780 : 580, Math.round(vh * (isExpanded ? 0.90 : 0.78)))
            };
            panel.style.width = s.w + 'px'; panel.style.height = s.h + 'px';
            panel.style.right = mobile ? '0px' : '24px'; panel.style.bottom = mobile ? '0px' : '90px';
            panel.style.borderRadius = mobile ? '0px' : '12px';
        }
        window.addEventListener('resize', function () { if (panel.style.display === 'flex') applySize(); });

        function openPanel() {
            panel.style.display = 'flex'; overlay.style.display = 'block';
            badge.style.display = 'none'; applySize(); input.focus();
            // Always show fresh welcome — history kept in chatState for AI context only
            if (!msgBox.children.length) {
                appendWelcome();
            }
        }
        function closePanel()  { panel.style.display = 'none'; overlay.style.display = 'none'; }
        function clearChat()   { msgBox.innerHTML = ''; clearStorage(); chatState = clearState(); appendWelcome(); }
        function toggleResize() {
            isExpanded = !isExpanded; applySize();
            iconExpand.style.display = isExpanded ? 'none' : 'block';
            iconCollapse.style.display = isExpanded ? 'block' : 'none';
            resizeBtn.title = isExpanded ? 'Collapse' : 'Expand';
            msgBox.scrollTop = 9999;
        }

        function getTime() {
            var d = new Date();
            return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
        }
        function renderMarkdown(text) {
            if (window.marked) { marked.setOptions({ breaks: true, gfm: true }); return marked.parse(text); }
            return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        }
        function applyBotStyles(div) {
            div.querySelectorAll('p').forEach(p => p.style.margin = '0 0 6px 0');
            div.querySelectorAll('ul,ol').forEach(l => { l.style.paddingLeft = '18px'; l.style.margin = '4px 0'; });
            div.querySelectorAll('code').forEach(c => c.style.cssText = 'background:#e2e2e2;padding:1px 4px;border-radius:3px;font-size:0.8rem;');
            div.querySelectorAll('pre').forEach(p => p.style.cssText = 'background:#e8e8e8;padding:8px;border-radius:6px;overflow-x:auto;font-size:0.8rem;');
            div.querySelectorAll('a').forEach(a => a.style.color = '#e8501a');
        }
        function makeAvatar(html, isBot) {
            var el = document.createElement('div');
            el.style.cssText = isBot
                ? 'width:42px;height:42px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:transparent;align-self:flex-start;'
                : 'width:38px;height:38px;background:#e8501a;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;align-self:flex-start;';
            el.innerHTML = html;
            return el;
        }

        function appendMsg(text, from) {
            var row = document.createElement('div'), col = document.createElement('div'),
                bubble = document.createElement('div'), ts = document.createElement('div');
            ts.style.cssText = 'font-size:0.7rem;color:#aaa;'; ts.textContent = getTime();
            bubble.style.cssText = 'padding:10px 14px;font-size:0.875rem;line-height:1.6;word-wrap:break-word;';
            if (from === 'bot') {
                row.style.cssText     = 'display:flex;align-items:flex-start;gap:10px;';
                col.style.cssText     = 'display:flex;flex-direction:column;gap:3px;max-width:82%;';
                bubble.style.cssText += 'border-radius:0 12px 12px 12px;background:#fff;color:#222;box-shadow:0 1px 4px rgba(0,0,0,0.07);';
                bubble.innerHTML = renderMarkdown(text); applyBotStyles(bubble);
                ts.style.paddingLeft = '4px';
                var av = makeAvatar(BOT_AVATAR, true);
                col.append(bubble, ts); row.append(av, col);
            } else {
                row.style.cssText     = 'display:flex;align-items:flex-start;gap:10px;justify-content:flex-end;';
                col.style.cssText     = 'display:flex;flex-direction:column;gap:3px;align-items:flex-end;max-width:75%;';
                bubble.style.cssText += 'border-radius:12px 12px 0 12px;background:#e8501a;color:#fff;';
                bubble.textContent = text; ts.style.paddingRight = '4px';
                col.append(bubble, ts); row.append(col, makeAvatar(USER_AVATAR));
            }
            msgBox.append(row); msgBox.scrollTop = msgBox.scrollHeight;
            return bubble;
        }
        function appendWelcome() {
            appendMsg('👋 Hello! Welcome to **Intercraft Support**. Our virtual assistant is here to guide you with services, inquiries, and support. \n\nPlease let us know how we can assist you?', 'bot');
        }
        function appendFollowUps(questions) {
            if (!questions || !questions.length) return;
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;max-width:90%;margin-top:2px;padding-left:46px;';
            wrapper.className = 'followup-chips';
            questions.forEach(function (q) {
                var btn = document.createElement('button');
                btn.textContent   = q;
                btn.style.cssText = 'background:#fff;border:1.5px solid #e8501a;color:#333;border-radius:20px;padding:7px 14px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:normal;text-align:left;line-height:1.4;box-shadow:0 1px 3px rgba(0,0,0,0.06);';
                btn.onmouseover = () => { btn.style.background = '#e8501a'; btn.style.color = '#fff'; };
                btn.onmouseout  = () => { btn.style.background = '#fff';    btn.style.color = '#333'; };
                btn.onclick     = () => { msgBox.querySelectorAll('.followup-chips').forEach(el => el.remove()); input.value = q; sendChat(); };
                wrapper.appendChild(btn);
            });
            msgBox.append(wrapper); msgBox.scrollTop = msgBox.scrollHeight;
        }

        function parseChunk(line, rawText, followUps, botDiv) {
            line = line.trim();
            if (!line || line === 'data: [DONE]') return { rawText, followUps };
            if (line.startsWith('data: ')) line = line.slice(6);
            try {
                var p = JSON.parse(line);
                if (p.thread_id) chatState.thread_id = p.thread_id;
                if (p.content !== undefined) {
                    rawText += p.content;
                    botDiv.innerHTML = renderMarkdown(rawText);
                    applyBotStyles(botDiv);
                    msgBox.scrollTop = msgBox.scrollHeight;
                }
                if (Array.isArray(p.follow_up) && p.follow_up.length) followUps = p.follow_up;
                if (p.summary && p.summary !== chatState.summary) {
                    chatState.summary = p.summary;
                }
                if (Array.isArray(p.messages)) chatState.messages = p.messages;
            } catch (_) {}
            return { rawText, followUps };
        }

        async function sendChat() {
            var msg = input.value.trim();
            if (!msg || !chatApiUrl) {
                if (!chatApiUrl) appendMsg('Chat is not configured yet. Please set the API endpoint in Settings.', 'bot');
                return;
            }
            input.value = ''; sendBtn.disabled = true;
            appendMsg(msg, 'user');
            msgBox.querySelectorAll('.followup-chips').forEach(el => el.remove());
            chatState.messages.push({ role: 'user', content: msg });

            var avatar = makeAvatar(BOT_AVATAR, true);
            var botDiv = document.createElement('div'), ts = document.createElement('div'),
                col = document.createElement('div'), row = document.createElement('div');
            botDiv.style.cssText = 'padding:10px 14px;border-radius:0 12px 12px 12px;font-size:0.875rem;line-height:1.6;word-wrap:break-word;background:#fff;color:#222;box-shadow:0 1px 4px rgba(0,0,0,0.07);';
            botDiv.innerHTML  = '<span style="color:#aaa;font-style:italic;font-size:0.8rem;">Typing\u2026</span>';
            ts.style.cssText  = 'font-size:0.7rem;color:#aaa;padding-left:4px;'; ts.textContent = getTime();
            col.style.cssText = 'display:flex;flex-direction:column;gap:3px;max-width:82%;';
            row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
            col.append(botDiv, ts); row.append(avatar, col);
            msgBox.append(row); msgBox.scrollTop = msgBox.scrollHeight;

            var rawText = '', followUps = [];
            try {
                var body = { message: msg, messages: chatState.messages, summary: chatState.summary || null, thread_id: chatState.thread_id || 'default' };
                var res = await fetch(chatApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                var reader = res.body.getReader(), decoder = new TextDecoder(), buffer = '';
                while (true) {
                    var { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    var lines = buffer.split('\n'); buffer = lines.pop();
                    for (var line of lines) ({ rawText, followUps } = parseChunk(line, rawText, followUps, botDiv));
                }
                if (buffer.trim()) ({ rawText, followUps } = parseChunk(buffer, rawText, followUps, botDiv));
                if (rawText) chatState.messages.push({ role: 'AI', content: rawText });
            } catch (e) {
                botDiv.textContent = 'Could not reach support. Please try again.';
                chatState.messages.pop();
            }
            saveState(chatState);
            if (followUps.length) appendFollowUps(followUps);
            sendBtn.disabled = false; input.focus();
        }

        fab.addEventListener('click',      () => panel.style.display === 'flex' ? closePanel() : openPanel());
        closeBtn.addEventListener('click',  closePanel);
        clearBtn.addEventListener('click',  clearChat);
        resizeBtn.addEventListener('click', toggleResize);
        overlay.addEventListener('click',   closePanel);
        sendBtn.addEventListener('click',   sendChat);
        input.addEventListener('keydown',   e => { if (e.key === 'Enter') sendChat(); });

    }, 500);
})();