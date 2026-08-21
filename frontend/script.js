const API_BASE = "http://127.0.0.1:8000";
const STREAM_ENDPOINT = `${API_BASE}/chat/stream`;
const FALLBACK_ENDPOINT = `${API_BASE}/chat`;


const canvas = document.getElementById('network-canvas');
const ctx = canvas.getContext('2d');
let W, H, nodes = [];
const NODE_COUNT = 46;
const LINK_DIST = 140;

function resizeCanvas(){
  const hero = document.querySelector('.hero');
  W = canvas.width = hero.offsetWidth;
  H = canvas.height = hero.offsetHeight;
}

function initNodes(){
  nodes = Array.from({length: NODE_COUNT}, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    r: Math.random() * 1.6 + 1
  }));
}

function tick(){
  ctx.clearRect(0, 0, W, H);
  for(const n of nodes){
    n.x += n.vx; n.y += n.vy;
    if(n.x < 0 || n.x > W) n.vx *= -1;
    if(n.y < 0 || n.y > H) n.vy *= -1;
  }
  for(let i=0;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){
      const a = nodes[i], b = nodes[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if(d < LINK_DIST){
        ctx.strokeStyle = `rgba(61, 90, 254, ${0.12 * (1 - d/LINK_DIST)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  for(const n of nodes){
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0, 194, 172, 0.5)';
    ctx.fill();
  }
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => { resizeCanvas(); initNodes(); });
resizeCanvas(); initNodes(); tick();


const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chips = document.getElementById('chips');

function scrollToBottom(){
  chatBody.scrollTop = chatBody.scrollHeight;
}

function addUserMessage(text){
  const div = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `<div class="msg-avatar">YOU</div><div class="bubble"></div>`;
  div.querySelector('.bubble').textContent = text;
  chatBody.appendChild(div);
  scrollToBottom();
}

function addTypingIndicator(){
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typingIndicator';
  div.innerHTML = `<div class="msg-avatar">AI</div><div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  chatBody.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator(){
  const el = document.getElementById('typingIndicator');
  if(el) el.remove();
}

function createBotBubble(){
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = `<div class="msg-avatar">AI</div><div class="bubble"><span class="bubble-text"></span><span class="cursor"></span></div>`;
  chatBody.appendChild(div);
  scrollToBottom();
  return div.querySelector('.bubble-text');
}

async function streamAnswer(question){
  removeTypingIndicator();
  const textEl = createBotBubble();
  const cursor = textEl.nextElementSibling;

  try{
    const res = await fetch(STREAM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    if(!res.ok || !res.body) throw new Error('stream unavailable');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while(true){
      const { value, done } = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // incomplete chunk stays in buffer

      for(const part of parts){
        if(!part.startsWith('data:')) continue;
        const payload = part.replace('data:', '').trim();
        if(payload === '[DONE]') { cursor.remove(); return; }
        try{
          const json = JSON.parse(payload);
          if(json.token){
            textEl.textContent += json.token;
            scrollToBottom();
          }
          if(json.error){
            textEl.textContent = "Something went wrong on my end — try again in a moment.";
            cursor.remove();
            return;
          }
        }catch(e){}
      }
    }
    cursor.remove();
  }catch(err){
    cursor.remove();
    try{
      const res = await fetch(FALLBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await res.json();
      textEl.textContent = data.answer || "I couldn't reach the backend. Is it running?";
    }catch(e2){
      textEl.textContent = "Backend se connect nahi ho paya. Check karo ki server chal raha hai.";
    }
    scrollToBottom();
  }
}

async function handleSend(){
  const question = chatInput.value.trim();
  if(!question) return;
  addUserMessage(question);
  chatInput.value = '';
  sendBtn.disabled = true;
  addTypingIndicator();
  await streamAnswer(question);
  sendBtn.disabled = false;
  chatInput.focus();
}

sendBtn.addEventListener('click', handleSend);
chatInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') handleSend();
});
chips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if(!chip) return;
  chatInput.value = chip.dataset.q;
  handleSend();
});