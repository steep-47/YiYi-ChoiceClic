const EXT='[YiYi ChoiceClick]';
const PANEL='yiyi-choice-panel';
let timer=null;

function ctx(){try{return globalThis.SillyTavern?.getContext?.()||globalThis.SillyTavern||null}catch{return null}}
function input(){return document.querySelector('#send_textarea')}
function setInput(v,{focus=false,caretEnd=false}={}){const e=input();if(!e)return false;e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));if(focus){e.focus();if(caretEnd&&typeof e.setSelectionRange==='function'){const n=e.value.length;e.setSelectionRange(n,n)}}return true}
function parse(text){const f=new Map();for(const raw of String(text||'').replace(/\r/g,'').split('\n')){const m=raw.trim().match(/^([123])[.．、]\s*(.+)$/);if(m&&!f.has(+m[1]))f.set(+m[1],m[2].trim())}return [1,2,3].every(n=>f.has(n))?[1,2,3].map(n=>({n,t:f.get(n)})):[]}
function latestAIData(){const c=ctx();const chat=c?.chat||[];for(let i=chat.length-1;i>=0;i--){const x=chat[i];if(x&&!x.is_user&&!x.is_system)return {i,msg:x}}return null}
function messageElement(index){return document.querySelector(`#chat .mes[mesid="${index}"]`)||document.querySelector(`#chat .mes[mesId="${index}"]`)||[...document.querySelectorAll('#chat .mes')].filter(m=>String(m.getAttribute('is_user')).toLowerCase()!=='true'&&!m.classList.contains('user_mes')).at(-1)||null}
function selectionText(cs,order){const map=new Map(cs.map(c=>[c.n,c.t]));const arr=order.map(n=>map.get(n)).filter(Boolean);if(!arr.length)return '';return arr.length===1?arr[0]:'按以下顺序行动：\n'+arr.map((x,i)=>`${i+1}. ${x}`).join('\n')}
function extractSupplement(v){const s=String(v||'');const marker='\n补充：';const i=s.indexOf(marker);return i>=0?s.slice(i+marker.length).trim():s.trim()}
function compose(cs,order,extra){const base=selectionText(cs,order);if(!base)return '';const add=String(extra||'').trim();return add?`${base}\n补充：${add}`:base}
function fillValue(cs,order,current){const base=selectionText(cs,order);if(!base)return '';const add=extractSupplement(current);return `${base}\n补充：${add}`}
function send(v){if(!v||!setInput(v,{focus:false}))return;const active=document.activeElement;if(active&&typeof active.blur==='function')active.blur();const c=ctx();if(typeof c?.sendMessage==='function'){c.sendMessage();return}document.querySelector('#send_but')?.click()}

function render(m,cs){
 if(!m)return;const text=m.querySelector('.mes_text');if(!text)return;
 const sig=JSON.stringify(cs);let p=m.querySelector('.'+PANEL);
 if(p?.dataset.sig===sig)return;
 p?.remove();
 p=document.createElement('div');p.className=PANEL;p.dataset.sig=sig;
 p.innerHTML='<div class="yiyi-choice-title">点击选项 · 可多选 · 按点击顺序执行</div><div class="yiyi-choice-list"></div><div class="yiyi-choice-actions"><button type="button" class="menu_button yiyi-fill" disabled>填入输入框</button><button type="button" class="menu_button yiyi-run" disabled>执行所选</button></div><div class="yiyi-choice-hint">可选一项或多项；点“填入输入框”后会自动另起“补充：”，直接继续输入即可。</div>';
 const order=[],list=p.querySelector('.yiyi-choice-list');
 function refresh(){p.querySelectorAll('.yiyi-choice-item').forEach(b=>{const pos=order.indexOf(+b.dataset.n);b.classList.toggle('selected',pos>=0);b.setAttribute('aria-pressed',pos>=0?'true':'false');let badge=b.querySelector('.yiyi-order');if(pos<0)badge?.remove();else{if(!badge){badge=document.createElement('span');badge.className='yiyi-order';b.append(badge)}badge.textContent=String(pos+1)}});p.querySelector('.yiyi-fill').disabled=!order.length;p.querySelector('.yiyi-run').disabled=!order.length}
 for(const c of cs){const b=document.createElement('button');b.type='button';b.className='yiyi-choice-item';b.dataset.n=c.n;b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="yiyi-num">${c.n}</span><span class="yiyi-text"></span>`;b.querySelector('.yiyi-text').textContent=c.t;b.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();const i=order.indexOf(c.n);i>=0?order.splice(i,1):order.push(c.n);refresh()});list.append(b)}
 p.querySelector('.yiyi-fill').addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();const old=input()?.value||'';setInput(fillValue(cs,order,old),{focus:true,caretEnd:true})});
 p.querySelector('.yiyi-run').addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();const old=input()?.value||'';send(compose(cs,order,extractSupplement(old)))});
 text.insertAdjacentElement('afterend',p);
}

function scan(){
 const d=latestAIData();
 if(!d){document.querySelectorAll('.'+PANEL).forEach(p=>p.remove());return;}
 const cs=parse(d.msg?.mes||'');
 const target=messageElement(d.i);
 document.querySelectorAll('.'+PANEL).forEach(p=>{if(!target?.contains(p))p.remove()});
 if(cs.length!==3){target?.querySelector('.'+PANEL)?.remove();return;}
 render(target,cs);
}
function schedule(ms=120){clearTimeout(timer);timer=setTimeout(scan,ms)}

function init(){
 const c=ctx();const es=c?.eventSource,et=c?.eventTypes;
 if(es&&et){['CHARACTER_MESSAGE_RENDERED','MESSAGE_RECEIVED','MESSAGE_EDITED','CHAT_CHANGED','MESSAGE_SWIPED'].forEach(k=>{if(et[k])es.on(et[k],()=>schedule(80))})}
 const chat=document.querySelector('#chat');
 if(chat)new MutationObserver(records=>{
   const onlyOwnPanel=records.length>0&&records.every(r=>{
     const node=r.target?.nodeType===1?r.target:r.target?.parentElement;
     return node?.closest?.('.'+PANEL);
   });
   if(!onlyOwnPanel)schedule(180);
 }).observe(chat,{subtree:true,childList:true,characterData:true,attributes:false});
 document.addEventListener('click',e=>{if(e.target.closest('.swipe_left,.swipe_right,.swipe_left_button,.swipe_right_button'))schedule(300)});
 schedule(0);console.log(EXT,'v0.2.3 loaded');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
