const EXT='[YiYi ChoiceClick]';
const PANEL='yiyi-choice-panel';
let timer=null;
function visible(e){if(!e)return false;const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.offsetParent!==null}
function generating(){return visible(document.querySelector('#mes_stop'))||document.body.classList.contains('generating')}
function latestAI(){const a=[...document.querySelectorAll('#chat .mes')].filter(m=>String(m.getAttribute('is_user')).toLowerCase()!=='true'&&!m.classList.contains('user_mes'));return a.at(-1)||null}
function parse(text){const f=new Map();for(const raw of (text||'').replace(/\r/g,'').split('\n')){const m=raw.trim().match(/^([123])[.．、]\s*(.+)$/);if(m&&!f.has(+m[1]))f.set(+m[1],m[2].trim())}return [1,2,3].every(n=>f.has(n))?[1,2,3].map(n=>({n,t:f.get(n)})):[]}
function input(){return document.querySelector('#send_textarea')}
function setInput(v){const e=input();if(!e)return false;e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.focus();return true}
function compose(cs,order,extra){const map=new Map(cs.map(c=>[c.n,c.t]));const arr=order.map(n=>map.get(n)).filter(Boolean);if(!arr.length)return '';let s=arr.length===1?arr[0]:'按以下顺序行动：\n'+arr.map((x,i)=>`${i+1}. ${x}`).join('\n');if((extra||'').trim())s+=`\n补充：${extra.trim()}`;return s}
function render(m,cs){const text=m.querySelector('.mes_text');if(!text)return;const sig=JSON.stringify(cs);let p=m.querySelector('.'+PANEL);if(p?.dataset.sig===sig)return;p?.remove();p=document.createElement('div');p.className=PANEL;p.dataset.sig=sig;p.innerHTML='<div class="yiyi-choice-title">点击可多选 · 按点击顺序执行</div><div class="yiyi-choice-list"></div><div class="yiyi-choice-actions"><button type="button" class="menu_button yiyi-fill" disabled>填入输入框</button><button type="button" class="menu_button yiyi-run" disabled>执行所选</button></div><div class="yiyi-choice-hint">输入框已有文字时，会作为补充一起带上。</div>';
 const order=[],list=p.querySelector('.yiyi-choice-list');
 function refresh(){p.querySelectorAll('.yiyi-choice-item').forEach(b=>{const pos=order.indexOf(+b.dataset.n);b.classList.toggle('selected',pos>=0);let badge=b.querySelector('.yiyi-order');if(pos<0)badge?.remove();else{if(!badge){badge=document.createElement('span');badge.className='yiyi-order';b.append(badge)}badge.textContent=String(pos+1)}});p.querySelector('.yiyi-fill').disabled=!order.length;p.querySelector('.yiyi-run').disabled=!order.length}
 for(const c of cs){const b=document.createElement('button');b.type='button';b.className='yiyi-choice-item';b.dataset.n=c.n;b.innerHTML=`<span class="yiyi-num">${c.n}</span><span class="yiyi-text"></span>`;b.querySelector('.yiyi-text').textContent=c.t;b.onclick=()=>{const i=order.indexOf(c.n);i>=0?order.splice(i,1):order.push(c.n);refresh()};list.append(b)}
 p.querySelector('.yiyi-fill').onclick=()=>{const old=input()?.value||'';setInput(compose(cs,order,old))};
 p.querySelector('.yiyi-run').onclick=()=>{if(generating())return globalThis.toastr?.warning?.('当前回复还在生成');const old=input()?.value||'',v=compose(cs,order,old);if(v&&setInput(v))document.querySelector('#send_but')?.click()};
 text.insertAdjacentElement('afterend',p)}
function scan(){const m=latestAI();document.querySelectorAll('.'+PANEL).forEach(p=>{if(!m?.contains(p))p.remove()});if(!m)return;const cs=parse(m.querySelector('.mes_text')?.innerText||'');if(cs.length===3)render(m,cs);else m.querySelector('.'+PANEL)?.remove()}
function schedule(ms=180){clearTimeout(timer);timer=setTimeout(scan,ms)}
new MutationObserver(()=>schedule()).observe(document.body,{subtree:true,childList:true,characterData:true});
document.addEventListener('click',e=>{if(e.target.closest('.swipe_left,.swipe_right,.swipe_left_button,.swipe_right_button'))schedule(350)});
schedule(0);console.log(EXT,'loaded');
