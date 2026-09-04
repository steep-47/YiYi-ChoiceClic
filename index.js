const EXT='[YiYi ChoiceClick]';
const PANEL='yiyi-choice-panel';
const INPUT_MARK='\n补充：';
let timer=null;
let lastScanKey='';
let managedInput=null;
let generating=false;

function ctx(){try{return globalThis.SillyTavern?.getContext?.()||globalThis.SillyTavern||null}catch{return null}}
function input(){return document.querySelector('#send_textarea')}
function setInput(v,{focus=false,caretEnd=false}={}){const e=input();if(!e)return false;e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));if(focus){e.focus();if(caretEnd&&typeof e.setSelectionRange==='function'){const n=e.value.length;e.setSelectionRange(n,n)}}return true}

const NUM_TOKEN='(?:([1-9]\\d*)|([①②③④⑤⑥⑦⑧⑨⑩]))';
const CHOICE_RE=new RegExp(`^\\s*${NUM_TOKEN}(?:\\s*(?:[.．、)）:：]|[-—])\\s*|\\s+)(.+?)\\s*$`);
const CIRCLED={'①':1,'②':2,'③':3,'④':4,'⑤':5,'⑥':6,'⑦':7,'⑧':8,'⑨':9,'⑩':10};
function choiceLine(raw){const m=String(raw||'').match(CHOICE_RE);if(!m)return null;const n=m[1]?Number(m[1]):CIRCLED[m[2]];const t=String(m[3]||'').trim();return Number.isSafeInteger(n)&&n>0&&t?{n,t}:null}
function parse(text){
 const lines=String(text||'').replace(/\r/g,'').split('\n');
 const runs=[];let run=[];
 const flush=()=>{if(run.length)runs.push(run);run=[]};
 for(const raw of lines){
   const c=choiceLine(raw);
   if(!c){flush();continue}
   if(!run.length){if(c.n===1)run=[c];continue}
   if(c.n===run.at(-1).n+1){run.push(c);continue}
   flush();if(c.n===1)run=[c];
 }
 flush();
 const valid=runs.filter(r=>r.length>=2);
 if(!valid.length)return [];
 return valid.at(-1);
}
function latestAIData(){const c=ctx();const chat=c?.chat||[];for(let i=chat.length-1;i>=0;i--){const x=chat[i];if(x&&!x.is_user&&!x.is_system)return {i,msg:x}}return null}
function messageElement(index){return document.querySelector(`#chat .mes[mesid="${index}"]`)||document.querySelector(`#chat .mes[mesId="${index}"]`)||null}
function selectionText(cs,order){const map=new Map(cs.map(c=>[c.n,c.t]));const arr=order.map(n=>map.get(n)).filter(Boolean);if(!arr.length)return '';return arr.length===1?arr[0]:'按以下顺序行动：\n'+arr.map((x,i)=>`${i+1}. ${x}`).join('\n')}
function currentExtra(v){const s=String(v||'');if(managedInput!==null&&s.startsWith(managedInput)){const tail=s.slice(managedInput.length);return tail.startsWith(INPUT_MARK)?tail.slice(INPUT_MARK.length).trim():tail.trim()}return s.trim()}
function compose(cs,order,extra){const base=selectionText(cs,order);if(!base)return '';const add=String(extra||'').trim();return add?`${base}${INPUT_MARK}${add}`:base}
function fillValue(cs,order,current){const base=selectionText(cs,order);if(!base)return '';const extra=currentExtra(current);managedInput=base;return `${base}${INPUT_MARK}${extra}`}
function send(v){if(!v||!setInput(v,{focus:false}))return;managedInput=null;const active=document.activeElement;if(active&&typeof active.blur==='function')active.blur();const c=ctx();if(typeof c?.sendMessage==='function'){c.sendMessage();return}document.querySelector('#send_but')?.click()}

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
 p.querySelector('.yiyi-run').addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();const old=input()?.value||'';send(compose(cs,order,currentExtra(old)))});
 text.insertAdjacentElement('afterend',p);
}

function scan(){
 if(generating)return;
 const d=latestAIData();
 if(!d){document.querySelectorAll('.'+PANEL).forEach(p=>p.remove());lastScanKey='';return;}
 const raw=String(d.msg?.mes||'');
 const key=`${d.i}:${d.msg?.swipe_id??''}:${raw}`;
 const target=messageElement(d.i);
 if(!target){lastScanKey='';schedule(160);return;}
 document.querySelectorAll('.'+PANEL).forEach(p=>{if(!target.contains(p))p.remove()});
 if(key===lastScanKey&&target.querySelector('.'+PANEL))return;
 lastScanKey=key;
 const cs=parse(raw);
 if(cs.length<2){target.querySelector('.'+PANEL)?.remove();return;}
 render(target,cs);
}
function schedule(ms=120){clearTimeout(timer);timer=setTimeout(scan,ms)}
function resetAndScan(ms=80){lastScanKey='';managedInput=null;schedule(ms)}
function finishGeneration(ms=80){generating=false;resetAndScan(ms)}

function init(){
 const c=ctx();const es=c?.eventSource,et=c?.eventTypes;
 if(es&&et){
   if(et.GENERATION_STARTED)es.on(et.GENERATION_STARTED,()=>{
     // Background extensions can emit their own generation events after the
     // visible reply has finished. Keep the current choices mounted; scan()
     // will replace or remove them when the actual chat message changes.
     generating=true;
   });
   if(et.GENERATION_ENDED)es.on(et.GENERATION_ENDED,()=>finishGeneration(80));
   if(et.GENERATION_STOPPED)es.on(et.GENERATION_STOPPED,()=>finishGeneration(120));
   ['CHARACTER_MESSAGE_RENDERED','MESSAGE_RECEIVED','MESSAGE_EDITED','CHAT_CHANGED','MESSAGE_SWIPED'].forEach(k=>{if(et[k])es.on(et[k],()=>resetAndScan(80))});
 }
 const chat=document.querySelector('#chat');
 if(chat)new MutationObserver(records=>{
   if(generating)return;
   const relevant=records.some(r=>{
     const node=r.target?.nodeType===1?r.target:r.target?.parentElement;
     if(node?.closest?.('.'+PANEL))return false;
     return !!node?.closest?.('.mes')||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.mes')||n.querySelector?.('.mes')));
   });
   if(relevant)schedule(180);
 }).observe(chat,{subtree:true,childList:true,characterData:true,attributes:false});
 document.addEventListener('click',e=>{if(e.target.closest('.swipe_left,.swipe_right,.swipe_left_button,.swipe_right_button'))resetAndScan(300)});
 schedule(0);console.log(EXT,'v0.3.5 loaded');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
